import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// IMPORTANTE: aqui NÃO mockamos `../../../api/client`. Fazer isso removeria o
// interceptor global de retry (`src/api/client.ts`) da equação — foi
// justamente essa costura errada que deixou passar uma versão anterior desta
// política, que chegava a disparar múltiplos POSTs físicos por chamada (um
// laço próprio somado ao retry do interceptor, cada um cego para o outro).
// Em vez disso, substituímos o adapter de transporte do axios
// (`apiClient.defaults.adapter`) por um contador programável — o cliente
// real, com os interceptores reais, roda por cima dele. Isso mede
// requisições HTTP de verdade, não chamadas de mock.
import apiClient from "../../../api/client";
import {
  createTransactionForUi,
  formatTransactionsApiError,
  isCreateTransactionErrorMaybePersisted,
  isCreateTransactionErrorRetryable,
} from "../transactionsAdapter.js";

// O ambiente de teste roda em "node" (sem DOM). O interceptor de request do
// client real lê `localStorage.getItem('auth_token')` — sem esse stub o teste
// quebraria antes mesmo de chegar no adapter fake, por um motivo que nada tem
// a ver com a política sendo testada aqui.
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
 * passo do script. Conta chamadas reais — é essa contagem que prova que
 * `createTransactionForUi` (e o interceptor global, para writes) nunca
 * repete, em vez de confiar em `toHaveBeenCalledTimes` num mock da função de
 * salvar.
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
 * ser chamada e a asserção rodar — um falso positivo de timing, não um bug
 * de verdade. A asserção real continua sendo feita no `promise` original.
 */
function settling(promise) {
  promise.catch(() => {});
  return promise;
}

describe("createTransactionForUi — SEM retry, nem próprio nem do interceptor (POST não é idempotente)", () => {
  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  // `createTransactionForUi` é hoje um passthrough puro para `createTransaction`
  // (ver `transactionsAdapter.js`) — a investigação completa (documentada em
  // `isCreateTransactionErrorRetryable`) concluiu que NENHUMA classe de erro
  // observável do cliente prova que o servidor não processou o POST. Isso
  // inclui 503 (o próprio backend pode devolver isso depois de uma exceção de
  // infra durante um commit ambíguo) e ERR_NETWORK/ECONNRESET (o interceptor
  // global de `src/api/client.ts` também NÃO repete mais nenhum write — só
  // GET/HEAD). Por isso cada classe abaixo deve gerar EXATAMENTE 1 requisição
  // física, sem nenhuma tentativa a mais, em lugar nenhum da pilha.
  it.each([
    ["503 (backend pode devolver isso por uma exceção de infra pós-commit)", () => (config) => respondWithStatus(config, 503, {})],
    ["500 genérico", () => (config) => respondWithStatus(config, 500, {})],
    ["422 de validação", () => (config) => respondWithStatus(config, 422, {})],
    ["409 de conflito", () => (config) => respondWithStatus(config, 409, {})],
    ["502", () => (config) => respondWithStatus(config, 502, {})],
    ["504", () => (config) => respondWithStatus(config, 504, {})],
    ["ERR_NETWORK persistente", () => (config) => networkFailure(config, "ERR_NETWORK")],
    ["ECONNRESET persistente", () => (config) => networkFailure(config, "ECONNRESET")],
    ["ECONNABORTED (timeout de leitura) persistente", () => (config) => networkFailure(config, "ECONNABORTED")],
  ])("%s: exatamente 1 requisição HTTP real, nunca repete", async (_label, makeStep) => {
    const adapter = scriptAdapter([makeStep(), makeStep(), makeStep(), makeStep()]);
    apiClient.defaults.adapter = adapter;

    const promise = settling(createTransactionForUi(PAYLOAD));
    await expect(promise).rejects.toBeTruthy();
    expect(adapter.callCount).toBe(1);
  });

  it("sucesso de primeira: 1 requisição, resolve com os dados da transação", async () => {
    const adapter = scriptAdapter([(config) => respondWithStatus(config, 201, { id: 1 })]);
    apiClient.defaults.adapter = adapter;

    await expect(createTransactionForUi(PAYLOAD)).resolves.toEqual({ id: 1 });
    expect(adapter.callCount).toBe(1);
  });

  it("depois de um erro, a função continua utilizável: nova chamada é uma tentativa independente e pode ter sucesso", async () => {
    const failingAdapter = scriptAdapter([(config) => respondWithStatus(config, 503, {})]);
    apiClient.defaults.adapter = failingAdapter;

    const firstError = await settling(createTransactionForUi(PAYLOAD)).catch((e) => e);
    // Mesma mensagem amigável que o formulário mostraria (via `handleApiError`
    // real do client, não um mock) — não o código/stack técnico do axios.
    expect(formatTransactionsApiError(firstError)).toBe(
      "Serviço temporariamente indisponível. Tente novamente em instantes.",
    );
    expect(failingAdapter.callCount).toBe(1);

    // "Tentar novamente" no modal chama de novo, do zero.
    const okAdapter = scriptAdapter([(config) => respondWithStatus(config, 201, { id: 3 })]);
    apiClient.defaults.adapter = okAdapter;
    await expect(createTransactionForUi(PAYLOAD)).resolves.toEqual({ id: 3 });
    expect(okAdapter.callCount).toBe(1);
  });
});

describe("isCreateTransactionErrorRetryable — sempre false (documentação; nunca chamada por createTransactionForUi)", () => {
  it("retorna false para qualquer entrada, incluindo undefined", () => {
    expect(isCreateTransactionErrorRetryable(undefined)).toBe(false);
    expect(isCreateTransactionErrorRetryable(new Error("boom"))).toBe(false);
    expect(
      isCreateTransactionErrorRetryable(
        new AxiosError("x", undefined, {}, undefined, { status: 503, data: {}, statusText: "", headers: {}, config: {} }),
      ),
    ).toBe(false);
  });
});

describe("isCreateTransactionErrorMaybePersisted — separa erro SEGURO de reenviar de erro AMBÍGUO (UI, não retry)", () => {
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

  it.each([400, 401, 403, 404, 409, 422])(
    "4xx (%i): SEGURO — API valida antes de gravar, reenvio direto",
    (status) => {
      expect(isCreateTransactionErrorMaybePersisted(httpError(status))).toBe(false);
    },
  );

  it.each([500, 502, 503, 504])(
    "5xx (%i): AMBÍGUO — pode já ter gravado, reenvio precisa avisar/confirmar",
    (status) => {
      expect(isCreateTransactionErrorMaybePersisted(httpError(status))).toBe(true);
    },
  );

  it.each(["ERR_NETWORK", "ECONNRESET", "ECONNABORTED", "ETIMEDOUT"])(
    "sem resposta (%s): AMBÍGUO",
    (code) => {
      expect(isCreateTransactionErrorMaybePersisted(networkError(code))).toBe(true);
    },
  );

  it("erro que não é do axios: trata como AMBÍGUO por segurança (não dá pra classificar)", () => {
    expect(isCreateTransactionErrorMaybePersisted(new Error("boom"))).toBe(true);
  });
});
