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
// requisições HTTP de verdade, não chamadas de mock, e deixa inspecionar o
// header `Idempotency-Key` que saiu em CADA tentativa.
import apiClient from "../../../api/client";
import {
  createRetryIsProtectedFor,
  createTransactionForUi,
  createTransactionPayloadFingerprint,
  formatTransactionsApiError,
  isCreateTransactionErrorMaybePersisted,
  isCreateTransactionErrorRetryable,
  resetCreateIdempotencyKey,
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
function respondWithStatus(config, status, data = {}, headers = {}) {
  const response = { status, statusText: "", data, headers, config };
  if (status >= 200 && status < 300) return response;
  throw new AxiosError(`Request failed with status code ${status}`, undefined, config, undefined, response);
}

/** Erro de rede: adapter nunca recebeu resposta alguma (sem `response`). */
function networkFailure(config, code = "ERR_NETWORK") {
  throw new AxiosError("Network Error", code, config);
}

/** Erro no formato `detail = {error, message, type}` que o backend usa. */
function idempotencyFailure(config, status, errorCode, headers = {}) {
  return respondWithStatus(
    config,
    status,
    { detail: { error: errorCode, message: errorCode, type: "idempotency" } },
    headers,
  );
}

/** Header enviado — `config.headers` é um `AxiosHeaders`, não um objeto cru. */
function sentIdempotencyKey(config) {
  const headers = config.headers;
  if (typeof headers?.get === "function") return headers.get("Idempotency-Key");
  return headers?.["Idempotency-Key"];
}

/**
 * Adapter de transporte programável: cada chamada física consome o próximo
 * passo do script (o último passo se repete). Conta chamadas reais e guarda a
 * chave de idempotência de cada uma — é essa contagem, e essa lista de
 * chaves, que provam a política, em vez de confiar num
 * `toHaveBeenCalledTimes` sobre um mock da função de salvar.
 */
function scriptAdapter(steps) {
  let calls = 0;
  const keys = [];
  const fn = vi.fn(async (config) => {
    calls += 1;
    keys.push(sentIdempotencyKey(config));
    const step = steps[Math.min(calls, steps.length) - 1];
    return step(config);
  });
  Object.defineProperty(fn, "callCount", { get: () => calls });
  Object.defineProperty(fn, "keys", { get: () => keys });
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

beforeEach(() => {
  // Cada cenário começa sem chave retida de um cenário anterior — a retenção
  // é estado de módulo por design (ela é o que atravessa os reenvios).
  resetCreateIdempotencyKey();
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  resetCreateIdempotencyKey();
});

describe("createTransactionForUi — `Idempotency-Key` no POST", () => {
  it("manda o header em toda criação, com uma chave no formato aceito pelo backend", async () => {
    const adapter = scriptAdapter([(config) => respondWithStatus(config, 201, { id: 1 })]);
    apiClient.defaults.adapter = adapter;

    await createTransactionForUi(PAYLOAD);

    expect(adapter.callCount).toBe(1);
    // 8–255 chars em [A-Za-z0-9._:-] — fora disso o backend responde 400.
    expect(adapter.keys[0]).toMatch(/^[A-Za-z0-9._:-]{8,255}$/);
  });

  it("sucesso SOLTA a chave: registrar um lançamento idêntico depois usa chave NOVA (senão o backend replicaria o primeiro)", async () => {
    const first = scriptAdapter([(config) => respondWithStatus(config, 201, { id: 1 })]);
    apiClient.defaults.adapter = first;
    await createTransactionForUi(PAYLOAD);

    const second = scriptAdapter([(config) => respondWithStatus(config, 201, { id: 2 })]);
    apiClient.defaults.adapter = second;
    await createTransactionForUi({ ...PAYLOAD });

    expect(second.keys[0]).not.toBe(first.keys[0]);
  });

  it("payload diferente = tentativa diferente = chave nova (senão o backend responderia 422 PAYLOAD_MISMATCH)", async () => {
    const failing = scriptAdapter([(config) => respondWithStatus(config, 500, {})]);
    apiClient.defaults.adapter = failing;
    await settling(createTransactionForUi(PAYLOAD)).catch(() => {});

    const edited = scriptAdapter([(config) => respondWithStatus(config, 201, { id: 9 })]);
    apiClient.defaults.adapter = edited;
    await createTransactionForUi({ ...PAYLOAD, description: "Uber (corrigido)" });

    expect(edited.keys[0]).not.toBe(failing.keys[0]);
  });

  it("mesmo payload depois de falhar = MESMA tentativa = MESMA chave, mesmo com as chaves do objeto em outra ordem", async () => {
    const failing = scriptAdapter([(config) => respondWithStatus(config, 500, {})]);
    apiClient.defaults.adapter = failing;
    await settling(createTransactionForUi(PAYLOAD)).catch(() => {});

    // Reenvio manual ("Tentar novamente"): o payload é remontado do zero pelo
    // modal, então a ordem das chaves do objeto pode variar. A impressão
    // digital tem de ser por CONTEÚDO, não pela serialização crua.
    const resent = scriptAdapter([(config) => respondWithStatus(config, 201, { id: 7 })]);
    apiClient.defaults.adapter = resent;
    await createTransactionForUi({ value: 42, description: "Uber", organization_id: "org-1" });

    expect(resent.keys[0]).toBe(failing.keys[0]);
  });
});

describe("createTransactionForUi — retry das classes que a chave tornou seguras", () => {
  // Estas são exatamente as classes que a issue #102 provou AMBÍGUAS (nenhuma
  // prova que o servidor não gravou) e que por isso não eram repetidas. Com
  // `Idempotency-Key` repetir deixou de arriscar duplicata, então voltam a
  // ser repetíveis: 3 tentativas físicas no total.
  it.each([
    ["502", () => (config) => respondWithStatus(config, 502, {})],
    ["503", () => (config) => respondWithStatus(config, 503, {})],
    ["504", () => (config) => respondWithStatus(config, 504, {})],
    ["ERR_NETWORK", () => (config) => networkFailure(config, "ERR_NETWORK")],
    ["ECONNRESET", () => (config) => networkFailure(config, "ECONNRESET")],
    ["ECONNABORTED (timeout de leitura)", () => (config) => networkFailure(config, "ECONNABORTED")],
    ["ETIMEDOUT", () => (config) => networkFailure(config, "ETIMEDOUT")],
  ])("%s persistente: 3 requisições físicas, TODAS com a mesma chave", async (_label, makeStep) => {
    const adapter = scriptAdapter([makeStep(), makeStep(), makeStep(), makeStep()]);
    apiClient.defaults.adapter = adapter;

    await expect(settling(createTransactionForUi(PAYLOAD))).rejects.toBeTruthy();

    expect(adapter.callCount).toBe(3);
    // O coração da feature: repetir com chave NOVA a cada tentativa criaria N
    // transações no servidor. Esta asserção é o que reprova essa mutação.
    expect(new Set(adapter.keys).size).toBe(1);
    expect(adapter.keys[0]).toMatch(/^[A-Za-z0-9._:-]{8,255}$/);
  });

  it("falha transitória seguida de sucesso: 2 requisições, mesma chave, resolve com a transação", async () => {
    const adapter = scriptAdapter([
      (config) => networkFailure(config, "ECONNRESET"),
      (config) => respondWithStatus(config, 201, { id: 5 }),
    ]);
    apiClient.defaults.adapter = adapter;

    await expect(createTransactionForUi(PAYLOAD)).resolves.toEqual({ id: 5 });
    expect(adapter.callCount).toBe(2);
    expect(new Set(adapter.keys).size).toBe(1);
  });

  it("409 IDEMPOTENCY_KEY_IN_FLIGHT: repete com a MESMA chave (chave nova aqui criaria a duplicata que o 409 impede)", async () => {
    const adapter = scriptAdapter([
      (config) => idempotencyFailure(config, 409, "IDEMPOTENCY_KEY_IN_FLIGHT", { "retry-after": "1" }),
      (config) => respondWithStatus(config, 201, { id: 8 }),
    ]);
    apiClient.defaults.adapter = adapter;

    await expect(createTransactionForUi(PAYLOAD)).resolves.toEqual({ id: 8 });
    expect(adapter.callCount).toBe(2);
    expect(new Set(adapter.keys).size).toBe(1);
  });

  it("409 IDEMPOTENCY_KEY_IN_FLIGHT persistente: para em 3 tentativas e explica o estado em PT-BR", async () => {
    const step = (config) => idempotencyFailure(config, 409, "IDEMPOTENCY_KEY_IN_FLIGHT", { "retry-after": "1" });
    const adapter = scriptAdapter([step, step, step, step]);
    apiClient.defaults.adapter = adapter;

    const err = await settling(createTransactionForUi(PAYLOAD)).catch((e) => e);
    expect(adapter.callCount).toBe(3);
    expect(new Set(adapter.keys).size).toBe(1);
    expect(formatTransactionsApiError(err)).toBe(
      "Este mesmo lançamento ainda está sendo registrado. Aguarde alguns segundos e confira seu extrato antes de tentar de novo.",
    );
  });
});

describe("createTransactionForUi — classes que continuam SEM retry", () => {
  it.each([
    ["500 genérico (quase sempre bug determinístico do servidor)", () => (config) => respondWithStatus(config, 500, {})],
    ["422 de validação", () => (config) => respondWithStatus(config, 422, {})],
    ["409 de conflito de negócio (sem código de idempotência)", () => (config) => respondWithStatus(config, 409, {})],
    ["400 de dados inválidos", () => (config) => respondWithStatus(config, 400, {})],
    ["403", () => (config) => respondWithStatus(config, 403, {})],
  ])("%s: exatamente 1 requisição física", async (_label, makeStep) => {
    const adapter = scriptAdapter([makeStep(), makeStep(), makeStep(), makeStep()]);
    apiClient.defaults.adapter = adapter;

    await expect(settling(createTransactionForUi(PAYLOAD))).rejects.toBeTruthy();
    expect(adapter.callCount).toBe(1);
  });

  it.each([
    ["422 IDEMPOTENCY_KEY_PAYLOAD_MISMATCH", 422, "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH"],
    ["400 INVALID_IDEMPOTENCY_KEY", 400, "INVALID_IDEMPOTENCY_KEY"],
  ])(
    "%s: bug NOSSO — 1 requisição, mensagem de falha interna e a chave é solta para a próxima tentativa nascer limpa",
    async (_label, status, code) => {
      const step = (config) => idempotencyFailure(config, status, code);
      const adapter = scriptAdapter([step, step, step]);
      apiClient.defaults.adapter = adapter;

      const err = await settling(createTransactionForUi(PAYLOAD)).catch((e) => e);
      expect(adapter.callCount).toBe(1);
      expect(formatTransactionsApiError(err)).toBe(
        "Falha interna do aplicativo ao reenviar esta transação. Atualize a página e registre de novo.",
      );

      // Chave solta: sem isso a tentativa seguinte reusaria a chave rejeitada
      // e ficaria presa no mesmo erro para sempre.
      expect(createRetryIsProtectedFor(PAYLOAD)).toBe(false);
      const next = scriptAdapter([(config) => respondWithStatus(config, 201, { id: 11 })]);
      apiClient.defaults.adapter = next;
      await createTransactionForUi(PAYLOAD);
      expect(next.keys[0]).not.toBe(adapter.keys[0]);
    },
  );
});

describe("retenção da chave — o que a UI usa para decidir se ainda avisa", () => {
  it("depois de uma falha, reenviar o MESMO payload está protegido; um payload editado, não", async () => {
    const adapter = scriptAdapter([(config) => respondWithStatus(config, 500, {})]);
    apiClient.defaults.adapter = adapter;
    await settling(createTransactionForUi(PAYLOAD)).catch(() => {});

    expect(createRetryIsProtectedFor(PAYLOAD)).toBe(true);
    expect(createRetryIsProtectedFor({ ...PAYLOAD, value: 43 })).toBe(false);
  });

  it("sem falha pendente, nada está protegido", () => {
    expect(createRetryIsProtectedFor(PAYLOAD)).toBe(false);
  });
});

describe("createTransactionPayloadFingerprint — a MESMA noção de tentativa que o modal usa", () => {
  it("é igual por conteúdo (ordem das chaves não conta) e muda quando qualquer campo muda", () => {
    expect(createTransactionPayloadFingerprint(PAYLOAD)).toBe(
      createTransactionPayloadFingerprint({ value: 42, description: "Uber", organization_id: "org-1" }),
    );
    expect(createTransactionPayloadFingerprint(PAYLOAD)).not.toBe(
      createTransactionPayloadFingerprint({ ...PAYLOAD, value: 43 }),
    );
  });

  it("é a MESMA função que decide a chave: fingerprint igual ⇒ chave reaproveitada", async () => {
    // Sem essa amarração, o modal poderia dizer "protegido" (não avisa) num
    // caso em que o adapter, na verdade, geraria uma chave nova.
    const failing = scriptAdapter([(config) => respondWithStatus(config, 503, {})]);
    apiClient.defaults.adapter = failing;
    await settling(createTransactionForUi(PAYLOAD)).catch(() => {});

    const resent = scriptAdapter([(config) => respondWithStatus(config, 201, { id: 4 })]);
    apiClient.defaults.adapter = resent;
    const samePayload = { value: 42, description: "Uber", organization_id: "org-1" };
    expect(createTransactionPayloadFingerprint(samePayload)).toBe(
      createTransactionPayloadFingerprint(PAYLOAD),
    );
    await createTransactionForUi(samePayload);
    expect(resent.keys[0]).toBe(failing.keys[0]);

    // Arrays aninhados (tag_ids) também comparam por conteúdo.
    expect(createTransactionPayloadFingerprint({ ...PAYLOAD, tag_ids: ["a", "b"] })).not.toBe(
      createTransactionPayloadFingerprint({ ...PAYLOAD, tag_ids: ["b", "a"] }),
    );
  });
});

describe("isCreateTransactionErrorRetryable — classificação pura", () => {
  function httpError(status, data = {}, headers = {}) {
    return new AxiosError(`Request failed with status code ${status}`, undefined, {}, {}, {
      status,
      data,
      statusText: "",
      headers,
      config: {},
    });
  }

  it.each([502, 503, 504])("5xx de gateway/indisponibilidade (%i): repetível com chave", (status) => {
    expect(isCreateTransactionErrorRetryable(httpError(status))).toBe(true);
  });

  it.each([400, 401, 403, 404, 409, 422, 500])("%i: não repetível", (status) => {
    expect(isCreateTransactionErrorRetryable(httpError(status))).toBe(false);
  });

  it("409 IDEMPOTENCY_KEY_IN_FLIGHT: repetível (com a mesma chave)", () => {
    expect(
      isCreateTransactionErrorRetryable(
        httpError(409, { detail: { error: "IDEMPOTENCY_KEY_IN_FLIGHT", message: "", type: "idempotency" } }),
      ),
    ).toBe(true);
  });

  it.each(["ERR_NETWORK", "ECONNRESET", "ECONNABORTED", "ETIMEDOUT"])("erro de rede %s: repetível", (code) => {
    expect(isCreateTransactionErrorRetryable(new AxiosError("Network Error", code, {}, {}))).toBe(true);
  });

  it("erro que não é do axios: não repetível", () => {
    expect(isCreateTransactionErrorRetryable(new TypeError("boom"))).toBe(false);
    expect(isCreateTransactionErrorRetryable(undefined)).toBe(false);
  });
});

describe("isCreateTransactionErrorMaybePersisted — separa erro SEGURO de erro AMBÍGUO (mensagem da UI, não retry)", () => {
  // `request: {}` (truthy) simula que uma requisição de verdade saiu do
  // navegador — é o que faz sentido para erros de status HTTP e códigos de
  // rede reais. Os casos "sem `.request`" abaixo testam exatamente o oposto:
  // nada saiu, então nunca é ambíguo, não importa o resto do shape do erro.
  function httpError(status) {
    return new AxiosError(`Request failed with status code ${status}`, undefined, {}, {}, {
      status,
      data: {},
      statusText: "",
      headers: {},
      config: {},
    });
  }

  function networkError(code) {
    return new AxiosError("Network Error", code, {}, {});
  }

  it.each([400, 401, 403, 404, 409, 422])(
    "4xx (%i): SEGURO — API valida antes de gravar, reenvio direto",
    (status) => {
      expect(isCreateTransactionErrorMaybePersisted(httpError(status))).toBe(false);
    },
  );

  it.each([500, 502, 503, 504])(
    "5xx (%i): AMBÍGUO — pode já ter gravado; a UI avisa se os dados mudarem antes do reenvio",
    (status) => {
      expect(isCreateTransactionErrorMaybePersisted(httpError(status))).toBe(true);
    },
  );

  it.each(["ERR_NETWORK", "ECONNRESET", "ECONNABORTED", "ETIMEDOUT"])(
    "sem resposta, mas com requisição comprovadamente despachada (%s): AMBÍGUO",
    (code) => {
      expect(isCreateTransactionErrorMaybePersisted(networkError(code))).toBe(true);
    },
  );

  it("erro que não é do axios (ex.: TypeError local em buildCreateTransactionPayload, antes de qualquer request): SEGURO — nada saiu do navegador", () => {
    expect(isCreateTransactionErrorMaybePersisted(new TypeError("Cannot read properties of undefined"))).toBe(false);
  });

  it("erro do axios sem `.request` (falhou montando o request, nunca despachou): SEGURO", () => {
    const err = new AxiosError("Transform failed", undefined, {}, undefined, undefined);
    expect(err.request).toBeUndefined();
    expect(isCreateTransactionErrorMaybePersisted(err)).toBe(false);
  });
});
