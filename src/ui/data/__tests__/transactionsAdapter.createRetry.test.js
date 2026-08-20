import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// IMPORTANTE: aqui NÃO mockamos `../../../api/client`. Fazer isso removeria o
// interceptor global de retry (`src/api/client.ts:77`) da equação — foi
// justamente essa costura errada que deixou passar uma versão anterior desta
// política, que chegava a disparar 6 POSTs físicos por chamada em erro de
// rede persistente (retry próprio somado ao do interceptor, cada um cego
// para o outro). Em vez disso, substituímos o adapter de transporte do axios
// (`apiClient.defaults.adapter`) por um contador programável — o cliente
// real, com os interceptores reais, roda por cima dele. Isso mede
// requisições HTTP de verdade, não chamadas de mock.
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
 * ser chamada e `await expect(promise).rejects...` rodar — um falso positivo
 * de timing, não um bug de verdade. A asserção real continua sendo feita no
 * `promise` original.
 */
function settling(promise) {
  promise.catch(() => {});
  return promise;
}

describe("createTransactionForUi — SEM retry automático (POST não é idempotente)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    apiClient.defaults.adapter = originalAdapter;
  });

  // Investigação completa (documentada em `isCreateTransactionErrorRetryable`):
  // NENHUMA classe de erro observável do cliente prova que o servidor não
  // processou o POST. Isso inclui 503 — que parecia a mais segura até se ler
  // que o próprio backend do Fincla devolve 503 depois de já ter gravado a
  // linha em alguns fluxos (`ServiceTemporarilyUnavailableError`). Por isso
  // cada uma das classes abaixo deve gerar EXATAMENTE 1 requisição física —
  // nunca mais.
  it.each([
    ["503 (o próprio backend pode devolver isso pós-gravação)", 503],
    ["500 genérico (pode ter gravado antes de estourar)", 500],
    ["422 de validação", 422],
    ["409 de conflito", 409],
    ["502 (upstream pode fechar a conexão pós-processamento)", 502],
    ["504 (mesmo evento do timeout de leitura, um salto de rede acima)", 504],
  ])("%s: nunca repete — exatamente 1 requisição HTTP real", async (_label, status) => {
    const adapter = scriptAdapter([(config) => respondWithStatus(config, status, {})]);
    apiClient.defaults.adapter = adapter;

    const promise = settling(createTransactionForUi(PAYLOAD));
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toMatchObject({ response: { status } });
    expect(adapter.callCount).toBe(1);
  });

  it("regressão: 503 não dispara uma 2ª tentativa que reabriria o retry do interceptor (bug antigo chegava a 4 POSTs)", async () => {
    // No código antigo, um laço próprio retentava em 503 chamando
    // `createTransaction` de novo — um config NOVO, que reiniciava o
    // `__retryCount` do interceptor. Se essa 2ª tentativa esbarrasse em erro
    // de rede, o interceptor global tentava mais até 3x por cima, somando 4
    // POSTs físicos para uma única submissão do formulário. Hoje não existe
    // 2ª tentativa: só o interceptor pode agir, e só dentro da ÚNICA chamada
    // a `createTransaction`.
    const adapter = scriptAdapter([
      (config) => respondWithStatus(config, 503, {}),
      (config) => networkFailure(config),
      (config) => networkFailure(config),
      (config) => networkFailure(config),
    ]);
    apiClient.defaults.adapter = adapter;

    const promise = settling(createTransactionForUi(PAYLOAD));
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toMatchObject({ response: { status: 503 } });
    expect(adapter.callCount).toBe(1);
  });

  it("erro de REDE persistente: total de requisições reais é só o teto do interceptor global (3: 1 inicial + 2 retries dele), nunca mais", async () => {
    // O interceptor de `src/api/client.ts` repete ERR_NETWORK/ECONNRESET para
    // writes por conta própria (até `MAX_RETRY_ATTEMPTS = 2`, ou seja, até 3
    // tentativas físicas). Isso é comportamento PRÉ-EXISTENTE do interceptor,
    // não desta função — `createTransactionForUi` não adiciona nada em cima.
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

  it("erro de REDE que se recupera dentro do próprio retry do interceptor: transparente para esta função, sucesso", async () => {
    const adapter = scriptAdapter([
      (config) => networkFailure(config),
      (config) => respondWithStatus(config, 201, { id: 9 }),
    ]);
    apiClient.defaults.adapter = adapter;

    const promise = createTransactionForUi(PAYLOAD);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ id: 9 });
    expect(adapter.callCount).toBe(2);
  });

  it("depois de um erro, a função continua utilizável: nova chamada é uma tentativa independente e pode ter sucesso", async () => {
    const failingAdapter = scriptAdapter([(config) => respondWithStatus(config, 503, {})]);
    apiClient.defaults.adapter = failingAdapter;

    const firstAttempt = settling(createTransactionForUi(PAYLOAD));
    await vi.runAllTimersAsync();
    const firstError = await firstAttempt.catch((e) => e);

    // Mesma mensagem amigável que o formulário mostraria (via `handleApiError`
    // real do client, não um mock) — não o código/stack técnico do axios.
    expect(formatTransactionsApiError(firstError)).toBe(
      "Serviço temporariamente indisponível. Tente novamente em instantes.",
    );
    expect(failingAdapter.callCount).toBe(1);

    // "Tentar novamente" no modal chama de novo, do zero — não há estado de
    // retry pendurado nesta função entre chamadas.
    const okAdapter = scriptAdapter([(config) => respondWithStatus(config, 201, { id: 3 })]);
    apiClient.defaults.adapter = okAdapter;
    await expect(createTransactionForUi(PAYLOAD)).resolves.toEqual({ id: 3 });
    expect(okAdapter.callCount).toBe(1);
  });

  it("guard defensivo: com maxAttempts=0 (configuração inválida) lança em vez de resolver undefined, e não toca a rede", async () => {
    // `maxAttempts` só existe para este teste (ver doc da função) — o uso real
    // nunca passa essa opção. Sem o `throw` final, um `maxAttempts` zerado por
    // engano faria o laço nunca rodar e a função retornaria `undefined`
    // silenciosamente: o modal leria isso como sucesso e mostraria
    // "Registrado!" para uma transação que nunca foi enviada.
    const adapter = scriptAdapter([(config) => respondWithStatus(config, 201, { id: 1 })]);
    apiClient.defaults.adapter = adapter;

    await expect(createTransactionForUi(PAYLOAD, { maxAttempts: 0 })).rejects.toThrow(
      "createTransactionForUi: nenhuma tentativa foi executada.",
    );
    expect(adapter.callCount).toBe(0);
  });
});

describe("isCreateTransactionErrorRetryable — sempre false (nenhuma classe de erro prova não-processamento)", () => {
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

  it.each([
    ["503 — o próprio backend do Fincla pode devolver isso pós-gravação", httpError(503)],
    ["502 — upstream pode fechar a conexão pós-processamento", httpError(502)],
    ["504 — mesmo evento do timeout de leitura, um salto de rede acima", httpError(504)],
    ["500 genérico", httpError(500)],
    ["400", httpError(400)],
    ["401", httpError(401)],
    ["409", httpError(409)],
    ["422", httpError(422)],
    ["ERR_NETWORK", networkError("ERR_NETWORK")],
    ["ECONNRESET", networkError("ECONNRESET")],
    ["ECONNABORTED (timeout de leitura)", networkError("ECONNABORTED")],
    ["ETIMEDOUT", networkError("ETIMEDOUT")],
    ["erro que não é do axios", new Error("boom")],
  ])("%s → false", (_label, error) => {
    expect(isCreateTransactionErrorRetryable(error)).toBe(false);
  });
});
