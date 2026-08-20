import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// IMPORTANTE: aqui NÃO mockamos `../../../api/client`. Fazer isso removeria o
// interceptor global de retry (`src/api/client.ts:77`) da equação, e foi
// justamente essa costura errada que deixou passar uma versão anterior desta
// política que disparava 6 POSTs físicos por chamada em vez de 2 (o laço
// daqui somado ao retry do interceptor, cada um cego para o outro). Em vez
// disso, substituímos o adapter de transporte do axios (`apiClient.defaults.adapter`)
// por um contador programável — o cliente real, com os interceptores reais,
// roda por cima dele. Isso mede requisições HTTP de verdade, não chamadas de
// mock.
import apiClient from "../../../api/client";
import {
  createTransactionForUi,
  formatTransactionsApiError,
  isCreateTransactionErrorRetryable,
} from "../transactionsAdapter.js";

// O ambiente de teste roda em "node" (sem DOM). O interceptor de request do
// client real lê `localStorage.getItem('auth_token')` — sem esse stub o teste
// quebraria antes mesmo de chegar no adapter fake, por um motivo que nada tem
// a ver com a política de retry sendo testada aqui.
vi.stubGlobal("localStorage", {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
});

const originalAdapter = apiClient.defaults.adapter;

/** Replica o `settle()` interno do axios: só 2xx resolve; o resto rejeita com `.response`. */
function respondWithStatus(config, status, data = {}) {
  const response = { status, statusText: "", data, headers: {}, config };
  if (status >= 200 && status < 300) return response;
  throw new AxiosError(`Request failed with status code ${status}`, undefined, config, undefined, response);
}

/** Erro de rede: adapter nunca recebeu resposta alguma (sem `response`). */
function networkFailure(config, code = "ERR_NETWORK") {
  throw new AxiosError("Network Error", code, config);
}

/**
 * Adapter de transporte programável: cada chamada física consome o próximo
 * passo do script (o último passo se repete se o script acabar). Conta
 * chamadas reais — é essa contagem que a revisão pediu para medir, em vez de
 * `toHaveBeenCalledTimes` num mock da função de salvar.
 */
function scriptAdapter(steps) {
  let calls = 0;
  const fn = vi.fn(async (config) => {
    calls += 1;
    const step = steps[Math.min(calls, steps.length) - 1];
    return step(config);
  });
  Object.defineProperty(fn, "callCount", { get: () => calls });
  return fn;
}

const PAYLOAD = { organization_id: "org-1", description: "Uber", value: 42 };

/**
 * Anexa um `.catch()` vazio já na criação da promise. Sem isso, o Node marca
 * a rejeição como "unhandled" no intervalo entre `createTransactionForUi(...)`
 * ser chamada e `await expect(promise).rejects...` rodar (que só acontece
 * depois de `vi.runAllTimersAsync()`) — um falso positivo de timing, não um
 * bug de verdade. A asserção real continua sendo feita no `promise` original.
 */
function settling(promise) {
  promise.catch(() => {});
  return promise;
}

describe("createTransactionForUi — política de retry (POST não é idempotente)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    apiClient.defaults.adapter = originalAdapter;
  });

  it("503: repete e conclui com sucesso na 2ª tentativa (2 requisições HTTP reais)", async () => {
    const adapter = scriptAdapter([
      (config) => respondWithStatus(config, 503, {}),
      (config) => respondWithStatus(config, 201, { id: 1 }),
    ]);
    apiClient.defaults.adapter = adapter;

    const onRetryAttempt = vi.fn();
    const promise = createTransactionForUi(PAYLOAD, { onRetryAttempt });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ id: 1 });
    expect(adapter.callCount).toBe(2);
    expect(onRetryAttempt).toHaveBeenCalledTimes(1);
    expect(onRetryAttempt).toHaveBeenCalledWith(2);
  });

  it("503 persistente: para nas 2 tentativas (nunca martela o backend), erro final em PT-BR e função reutilizável depois", async () => {
    const adapter = scriptAdapter([
      (config) => respondWithStatus(config, 503, {}),
      (config) => respondWithStatus(config, 503, {}),
    ]);
    apiClient.defaults.adapter = adapter;

    const promise = settling(createTransactionForUi(PAYLOAD));
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toMatchObject({ response: { status: 503 } });

    // No máximo 2 tentativas — não pode virar espera infinita nem martelar o backend.
    expect(adapter.callCount).toBe(2);

    const finalError = await promise.catch((e) => e);
    // Mesma mensagem amigável que o formulário mostraria (via `handleApiError`
    // real do client, não um mock) — não o código/stack técnico do axios.
    expect(formatTransactionsApiError(finalError)).toBe(
      "Serviço temporariamente indisponível. Tente novamente em instantes.",
    );

    // Depois do erro final, a função continua livre para ser chamada de novo —
    // é isso que mantém o formulário "utilizável" (o catch do modal já reseta
    // `txSubmitting`/`txSubmitError`; aqui provamos que não sobra nenhum
    // estado de retry pendurado na função em si).
    const okAdapter = scriptAdapter([(config) => respondWithStatus(config, 201, { id: 3 })]);
    apiClient.defaults.adapter = okAdapter;
    await expect(createTransactionForUi(PAYLOAD)).resolves.toEqual({ id: 3 });
    expect(okAdapter.callCount).toBe(1);
  });

  it("500 genérico: NUNCA repete (pode ter gravado antes de estourar) — exatamente 1 requisição real", async () => {
    const adapter = scriptAdapter([(config) => respondWithStatus(config, 500, {})]);
    apiClient.defaults.adapter = adapter;

    const promise = settling(createTransactionForUi(PAYLOAD));
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toMatchObject({ response: { status: 500 } });
    expect(adapter.callCount).toBe(1);
  });

  it("422 de validação: NUNCA repete — exatamente 1 requisição real", async () => {
    const adapter = scriptAdapter([
      (config) => respondWithStatus(config, 422, { detail: "invalid" }),
    ]);
    apiClient.defaults.adapter = adapter;

    const promise = settling(createTransactionForUi(PAYLOAD));
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toMatchObject({ response: { status: 422 } });
    expect(adapter.callCount).toBe(1);
  });

  it("409 de conflito: NUNCA repete — exatamente 1 requisição real", async () => {
    const adapter = scriptAdapter([(config) => respondWithStatus(config, 409, {})]);
    apiClient.defaults.adapter = adapter;

    const promise = settling(createTransactionForUi(PAYLOAD));
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toMatchObject({ response: { status: 409 } });
    expect(adapter.callCount).toBe(1);
  });

  it("502: tem resposta, mas NÃO prova ausência de processamento (pode ser pós-commit) — NUNCA repete, 1 requisição real", async () => {
    const adapter = scriptAdapter([(config) => respondWithStatus(config, 502, {})]);
    apiClient.defaults.adapter = adapter;

    const promise = settling(createTransactionForUi(PAYLOAD));
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toMatchObject({ response: { status: 502 } });
    expect(adapter.callCount).toBe(1);
  });

  it("504: é o mesmo evento de timeout de leitura, um salto de rede acima — NUNCA repete, 1 requisição real", async () => {
    const adapter = scriptAdapter([(config) => respondWithStatus(config, 504, {})]);
    apiClient.defaults.adapter = adapter;

    const promise = settling(createTransactionForUi(PAYLOAD));
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toMatchObject({ response: { status: 504 } });
    expect(adapter.callCount).toBe(1);
  });

  it("erro de REDE persistente: o laço daqui NÃO soma retry ao interceptor global — total de requisições reais é o teto do interceptor (3: 1 inicial + 2 retries), não 6", async () => {
    // O interceptor de `src/api/client.ts` já repete ERR_NETWORK/ECONNRESET para
    // writes (até `MAX_RETRY_ATTEMPTS = 2`, ou seja, até 3 tentativas físicas no
    // total). `isCreateTransactionErrorRetryable` retorna `false` para erro sem
    // resposta propositalmente (ver comentário na implementação) — este teste
    // prova que NÃO duplicamos esse retry por cima, o que antes gerava 6 POSTs.
    const adapter = scriptAdapter([
      (config) => networkFailure(config),
      (config) => networkFailure(config),
      (config) => networkFailure(config),
      (config) => networkFailure(config),
    ]);
    apiClient.defaults.adapter = adapter;

    const promise = settling(createTransactionForUi(PAYLOAD));
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toMatchObject({ code: "ERR_NETWORK" });
    expect(adapter.callCount).toBe(3);
  });

  it("erro de REDE que se recupera dentro do próprio retry do interceptor: nosso laço nem percebe, sucesso", async () => {
    const adapter = scriptAdapter([
      (config) => networkFailure(config),
      (config) => respondWithStatus(config, 201, { id: 9 }),
    ]);
    apiClient.defaults.adapter = adapter;

    const onRetryAttempt = vi.fn();
    const promise = createTransactionForUi(PAYLOAD, { onRetryAttempt });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ id: 9 });
    // Recuperação aconteceu dentro do interceptor global — nosso próprio laço
    // nunca viu uma rejeição, então nunca chamou `onRetryAttempt`.
    expect(onRetryAttempt).not.toHaveBeenCalled();
    expect(adapter.callCount).toBe(2);
  });
});

describe("isCreateTransactionErrorRetryable", () => {
  function httpError(status) {
    return new AxiosError(`Request failed with status code ${status}`, undefined, {}, undefined, {
      status,
      data: {},
      statusText: "",
      headers: {},
      config: {},
    });
  }

  function networkError(code) {
    return new AxiosError("Network Error", code);
  }

  it("só 503 é repetível — o único status com evidência forte de não-processamento", () => {
    expect(isCreateTransactionErrorRetryable(httpError(503))).toBe(true);
  });

  it("502/504 não são repetíveis: ambos podem ocorrer DEPOIS do processamento", () => {
    expect(isCreateTransactionErrorRetryable(httpError(502))).toBe(false);
    expect(isCreateTransactionErrorRetryable(httpError(504))).toBe(false);
  });

  it("4xx nunca é repetível", () => {
    expect(isCreateTransactionErrorRetryable(httpError(400))).toBe(false);
    expect(isCreateTransactionErrorRetryable(httpError(401))).toBe(false);
    expect(isCreateTransactionErrorRetryable(httpError(409))).toBe(false);
    expect(isCreateTransactionErrorRetryable(httpError(422))).toBe(false);
  });

  it("500 genérico nunca é repetível", () => {
    expect(isCreateTransactionErrorRetryable(httpError(500))).toBe(false);
  });

  it("erro de rede sem resposta (ERR_NETWORK/ECONNRESET) nunca é repetível aqui — o interceptor global já cobre, e mesmo esse retry é inseguro para writes", () => {
    expect(isCreateTransactionErrorRetryable(networkError("ERR_NETWORK"))).toBe(false);
    expect(isCreateTransactionErrorRetryable(networkError("ECONNRESET"))).toBe(false);
  });

  it("timeout de leitura (ECONNABORTED/ETIMEDOUT) nunca é repetível — mesmo evento físico do 504, veredito consistente", () => {
    expect(isCreateTransactionErrorRetryable(networkError("ECONNABORTED"))).toBe(false);
    expect(isCreateTransactionErrorRetryable(networkError("ETIMEDOUT"))).toBe(false);
  });

  it("erro que não é do axios: nunca repetível (não dá para classificar)", () => {
    expect(isCreateTransactionErrorRetryable(new Error("boom"))).toBe(false);
  });
});
