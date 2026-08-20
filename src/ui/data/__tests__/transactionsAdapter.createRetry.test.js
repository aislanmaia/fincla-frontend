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
  hasObservedIdempotencySupport,
  noteIdempotencySupport,
  resetIdempotencySupportObservation,
} from "../../../api/idempotency";
import {
  createErrorReleasedIdempotencyKey,
  createResendIsProtected,
  createRetryDelayMs,
  createTransactionForUi,
  createTransactionPayloadFingerprint,
  hasRetainedCreateIdempotencyKey,
  formatTransactionsApiError,
  isCreateTransactionErrorMaybePersisted,
  isCreateTransactionErrorRetryable,
  releaseCreateIdempotencyKey,
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

/** Header que prova, na resposta, que este backend implementa idempotência. */
const REPLAY_HEADERS = { "idempotent-replay": "false" };

/** Replica o `settle()` interno do axios: só 2xx resolve; o resto rejeita com `.response`. */
function respondWithStatus(config, status, data = {}, headers = {}) {
  const response = { status, statusText: "", data, headers, config };
  if (status >= 200 && status < 300) return response;
  // `request: {}` (truthy) espelha o axios real: houve resposta, logo houve
  // requisição despachada. Sem isso o fake seria mais "limpo" que a realidade
  // e esconderia bugs em quem olha `error.request`.
  throw new AxiosError(`Request failed with status code ${status}`, undefined, config, {}, response);
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

/**
 * Faz UMA criação bem-sucedida com `Idempotent-Replay` na resposta — é assim
 * que o cliente descobre que o backend implementa a feature. Sem isso o retry
 * fica desligado de propósito (ver o teste do portão de suporte).
 */
async function observeIdempotencySupport() {
  apiClient.defaults.adapter = scriptAdapter([
    (config) => respondWithStatus(config, 201, { id: 0 }, REPLAY_HEADERS),
  ]);
  await createTransactionForUi({ organization_id: "org-1", description: "prova", value: 1 });
  resetCreateIdempotencyKey();
}

beforeEach(() => {
  // Cada cenário começa sem chave retida de um cenário anterior — a retenção
  // é estado de módulo por design (ela é o que atravessa os reenvios).
  resetCreateIdempotencyKey();
  resetIdempotencySupportObservation();
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  resetCreateIdempotencyKey();
  resetIdempotencySupportObservation();
  vi.restoreAllMocks();
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
  beforeEach(async () => {
    await observeIdempotencySupport();
  });

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
    // `retry-after: 0` mantém o teste instantâneo E prova que o zero é
    // honrado como espera válida em vez de cair no backoff interno.
    const adapter = scriptAdapter([
      (config) => idempotencyFailure(config, 409, "IDEMPOTENCY_KEY_IN_FLIGHT", { "retry-after": "0" }),
      (config) => respondWithStatus(config, 201, { id: 8 }, REPLAY_HEADERS),
    ]);
    apiClient.defaults.adapter = adapter;

    await expect(createTransactionForUi(PAYLOAD)).resolves.toEqual({ id: 8 });
    expect(adapter.callCount).toBe(2);
    expect(new Set(adapter.keys).size).toBe(1);
  });

  it("409 IN_FLIGHT persistente: 4 tentativas (contrato do backend), LIBERA a chave e diz que esperar não resolve", async () => {
    const step = (config) => idempotencyFailure(config, 409, "IDEMPOTENCY_KEY_IN_FLIGHT", { "retry-after": "0" });
    const adapter = scriptAdapter([step, step, step, step, step, step]);
    apiClient.defaults.adapter = adapter;

    const err = await settling(createTransactionForUi(PAYLOAD)).catch((e) => e);
    expect(adapter.callCount).toBe(4);
    expect(new Set(adapter.keys).size).toBe(1);
    expect(formatTransactionsApiError(err)).toBe(
      "Outro envio deste mesmo lançamento ficou preso no servidor. Confira seu extrato: se a transação não estiver lá, registre de novo.",
    );

    // Reserva órfã responde 409 pelas 24h inteiras: manter a chave retida
    // prenderia a pessoa num beco sem saída. A liberação faz o próximo
    // "Tentar novamente" sair com chave NOVA — e a UI avisa sobre o extrato.
    expect(createErrorReleasedIdempotencyKey(err)).toBe(true);
    expect(hasRetainedCreateIdempotencyKey(PAYLOAD)).toBe(false);
    expect(isCreateTransactionErrorMaybePersisted(err)).toBe(true);

    const next = scriptAdapter([(config) => respondWithStatus(config, 201, { id: 12 }, REPLAY_HEADERS)]);
    apiClient.defaults.adapter = next;
    await createTransactionForUi(PAYLOAD);
    expect(next.keys[0]).not.toBe(adapter.keys[0]);
  });
});

describe("createTransactionForUi — retry SÓ depois que o servidor prova que implementa idempotência", () => {
  // Este é o portão que torna a ordem de deploy segura sozinha: contra a
  // `main` do backend (sem idempotência), repetir um ERR_NETWORK criaria N
  // transações — exatamente a duplicata que a #102 eliminou.
  it("sem `Idempotent-Replay` nunca observado: ERR_NETWORK dá 1 requisição, como antes desta feature", async () => {
    const step = (config) => networkFailure(config, "ERR_NETWORK");
    const adapter = scriptAdapter([step, step, step, step]);
    apiClient.defaults.adapter = adapter;

    await expect(settling(createTransactionForUi(PAYLOAD))).rejects.toBeTruthy();
    expect(adapter.callCount).toBe(1);
  });

  it("resposta SEM o header (backend antigo) não conta como prova: segue sem repetir", async () => {
    // Um 201 sem `Idempotent-Replay` é exatamente o que a API atual devolve.
    apiClient.defaults.adapter = scriptAdapter([(config) => respondWithStatus(config, 201, { id: 1 })]);
    await createTransactionForUi({ ...PAYLOAD, description: "outra" });

    const step = (config) => respondWithStatus(config, 503, {});
    const adapter = scriptAdapter([step, step, step, step]);
    apiClient.defaults.adapter = adapter;
    await expect(settling(createTransactionForUi(PAYLOAD))).rejects.toBeTruthy();
    expect(adapter.callCount).toBe(1);
  });

  it("é o HEADER do 201 que arma a proteção: caminho feliz, sem depender de erro nenhum", async () => {
    // A detecção precisa funcionar pela via mais COMUM — a primeira criação
    // bem-sucedida. Se dependesse de um erro de idempotência, a proteção só
    // ligaria depois de algo dar errado. A API expõe o header no CORS
    // (`expose_headers`), então o browser o lê cross-origin.
    expect(hasObservedIdempotencySupport()).toBe(false);

    apiClient.defaults.adapter = scriptAdapter([
      (config) => respondWithStatus(config, 201, { id: 1 }, { "idempotent-replay": "false" }),
    ]);
    await createTransactionForUi(PAYLOAD);

    expect(hasObservedIdempotencySupport()).toBe(true);
  });

  it("`Idempotent-Replay: true` (o próprio replay) também arma — o que prova suporte é a PRESENÇA do header", async () => {
    apiClient.defaults.adapter = scriptAdapter([
      (config) => respondWithStatus(config, 201, { id: 1 }, { "idempotent-replay": "true" }),
    ]);
    await createTransactionForUi(PAYLOAD);
    expect(hasObservedIdempotencySupport()).toBe(true);
  });

  it("201 SEM o header não arma nada: é a resposta que a API atual devolve", async () => {
    apiClient.defaults.adapter = scriptAdapter([(config) => respondWithStatus(config, 201, { id: 1 })]);
    await createTransactionForUi(PAYLOAD);
    expect(hasObservedIdempotencySupport()).toBe(false);
  });

  it("depois de UMA resposta com o header, o retry liga", async () => {
    await observeIdempotencySupport();

    const step = (config) => respondWithStatus(config, 503, {});
    const adapter = scriptAdapter([step, step, step, step]);
    apiClient.defaults.adapter = adapter;
    await expect(settling(createTransactionForUi(PAYLOAD))).rejects.toBeTruthy();
    expect(adapter.callCount).toBe(3);
  });

  it("um 409 IN_FLIGHT prova suporte por si só: só existe em backend que implementa a feature", async () => {
    const adapter = scriptAdapter([
      (config) => idempotencyFailure(config, 409, "IDEMPOTENCY_KEY_IN_FLIGHT", { "retry-after": "0" }),
      (config) => respondWithStatus(config, 201, { id: 3 }, REPLAY_HEADERS),
    ]);
    apiClient.defaults.adapter = adapter;

    await expect(createTransactionForUi(PAYLOAD)).resolves.toEqual({ id: 3 });
    expect(adapter.callCount).toBe(2);
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
    "%s: bug NOSSO — 1 requisição e a chave é solta para a próxima tentativa nascer limpa",
    async (_label, status, code) => {
      const step = (config) => idempotencyFailure(config, status, code);
      const adapter = scriptAdapter([step, step, step]);
      apiClient.defaults.adapter = adapter;

      const err = await settling(createTransactionForUi(PAYLOAD)).catch((e) => e);
      expect(adapter.callCount).toBe(1);

      // Chave solta: sem isso a tentativa seguinte reusaria a chave rejeitada
      // e ficaria presa no mesmo erro até a janela de 24h vencer.
      expect(createErrorReleasedIdempotencyKey(err)).toBe(true);
      expect(hasRetainedCreateIdempotencyKey(PAYLOAD)).toBe(false);
      const next = scriptAdapter([(config) => respondWithStatus(config, 201, { id: 11 }, REPLAY_HEADERS)]);
      apiClient.defaults.adapter = next;
      await createTransactionForUi(PAYLOAD);
      expect(next.keys[0]).not.toBe(adapter.keys[0]);
    },
  );

  it("422 PAYLOAD_MISMATCH: o servidor TEM registro dessa chave, então a mensagem manda conferir o extrato — e o erro conta como possivelmente persistido", async () => {
    // Só reusamos chave quando a nossa própria impressão digital garantiu
    // payload idêntico. Um mismatch prova que a requisição anterior chegou a
    // ser processada; dizer só "registre de novo" empurraria para a duplicata.
    const adapter = scriptAdapter([
      (config) => idempotencyFailure(config, 422, "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH"),
    ]);
    apiClient.defaults.adapter = adapter;

    const err = await settling(createTransactionForUi(PAYLOAD)).catch((e) => e);
    expect(formatTransactionsApiError(err)).toBe(
      "Falha interna do aplicativo ao reenviar esta transação. O envio anterior chegou a ser processado — confira seu extrato antes de registrar de novo.",
    );
    expect(isCreateTransactionErrorMaybePersisted(err)).toBe(true);
  });

  it("400 INVALID_IDEMPOTENCY_KEY: recusa ANTES de gravar, então a mensagem afirma que nada foi salvo", async () => {
    const adapter = scriptAdapter([
      (config) => idempotencyFailure(config, 400, "INVALID_IDEMPOTENCY_KEY"),
    ]);
    apiClient.defaults.adapter = adapter;

    const err = await settling(createTransactionForUi(PAYLOAD)).catch((e) => e);
    expect(formatTransactionsApiError(err)).toBe(
      "Falha interna do aplicativo ao registrar esta transação. Nada foi salvo. Atualize a página e registre de novo.",
    );
    expect(isCreateTransactionErrorMaybePersisted(err)).toBe(false);
  });
});

describe("retenção da chave — o que a UI usa para decidir se ainda avisa", () => {
  it("depois de uma falha, reenviar o MESMO payload está protegido; um payload editado, não", async () => {
    const adapter = scriptAdapter([(config) => respondWithStatus(config, 500, {})]);
    apiClient.defaults.adapter = adapter;
    await settling(createTransactionForUi(PAYLOAD)).catch(() => {});

    expect(hasRetainedCreateIdempotencyKey(PAYLOAD)).toBe(true);
    expect(hasRetainedCreateIdempotencyKey({ ...PAYLOAD, value: 43 })).toBe(false);
  });

  it("sem falha pendente, nada está protegido", () => {
    expect(hasRetainedCreateIdempotencyKey(PAYLOAD)).toBe(false);
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

describe("armazenamento das chaves — mapa por tentativa, com TTL e liberação explícita", () => {
  it("registrar OUTRA transação com sucesso não apaga a chave retida da tentativa que falhou", async () => {
    // Com um slot global único, o sucesso de B limpava a chave de A e o
    // reenvio de A saía com chave NOVA — duplicando A se o POST original
    // tivesse persistido, bem enquanto a UI prometia "não duplica".
    const OTHER = { organization_id: "org-1", description: "Mercado", value: 90 };

    const failingA = scriptAdapter([(config) => respondWithStatus(config, 503, {})]);
    apiClient.defaults.adapter = failingA;
    await settling(createTransactionForUi(PAYLOAD)).catch(() => {});

    apiClient.defaults.adapter = scriptAdapter([
      (config) => respondWithStatus(config, 201, { id: 20 }, REPLAY_HEADERS),
    ]);
    await createTransactionForUi(OTHER);

    const resendA = scriptAdapter([(config) => respondWithStatus(config, 201, { id: 21 }, REPLAY_HEADERS)]);
    apiClient.defaults.adapter = resendA;
    await createTransactionForUi(PAYLOAD);
    expect(resendA.keys[0]).toBe(failingA.keys[0]);
  });

  it("duas tentativas falhadas coexistem, cada uma com a SUA chave", async () => {
    const OTHER = { organization_id: "org-1", description: "Mercado", value: 90 };

    const failingA = scriptAdapter([(config) => respondWithStatus(config, 503, {})]);
    apiClient.defaults.adapter = failingA;
    await settling(createTransactionForUi(PAYLOAD)).catch(() => {});

    const failingB = scriptAdapter([(config) => respondWithStatus(config, 503, {})]);
    apiClient.defaults.adapter = failingB;
    await settling(createTransactionForUi(OTHER)).catch(() => {});

    expect(failingA.keys[0]).not.toBe(failingB.keys[0]);
    expect(hasRetainedCreateIdempotencyKey(PAYLOAD)).toBe(true);
    expect(hasRetainedCreateIdempotencyKey(OTHER)).toBe(true);
  });

  it("a chave retida EXPIRA: café de manhã que falhou não engole o café da tarde com os mesmos dados", async () => {
    // Sem TTL, o payload idêntico (a data vai sempre normalizada) reusaria a
    // chave da manhã, o backend replayaria o registro antigo dentro das 24h e
    // a tela diria "Registrado!" para um lançamento que nunca foi criado.
    const t0 = Date.parse("2026-08-20T09:00:00Z");
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(t0);

    const morning = scriptAdapter([(config) => respondWithStatus(config, 503, {})]);
    apiClient.defaults.adapter = morning;
    await settling(createTransactionForUi(PAYLOAD)).catch(() => {});
    expect(hasRetainedCreateIdempotencyKey(PAYLOAD)).toBe(true);

    nowSpy.mockReturnValue(t0 + 6 * 60 * 60 * 1000); // 15:00
    expect(hasRetainedCreateIdempotencyKey(PAYLOAD)).toBe(false);

    const afternoon = scriptAdapter([(config) => respondWithStatus(config, 201, { id: 30 }, REPLAY_HEADERS)]);
    apiClient.defaults.adapter = afternoon;
    await createTransactionForUi(PAYLOAD);
    expect(afternoon.keys[0]).not.toBe(morning.keys[0]);
  });

  it("`releaseCreateIdempotencyKey` solta UMA tentativa — é o que o modal chama ao descartar a falha", async () => {
    const failing = scriptAdapter([(config) => respondWithStatus(config, 503, {})]);
    apiClient.defaults.adapter = failing;
    await settling(createTransactionForUi(PAYLOAD)).catch(() => {});
    expect(hasRetainedCreateIdempotencyKey(PAYLOAD)).toBe(true);

    releaseCreateIdempotencyKey(createTransactionPayloadFingerprint(PAYLOAD));
    expect(hasRetainedCreateIdempotencyKey(PAYLOAD)).toBe(false);

    const next = scriptAdapter([(config) => respondWithStatus(config, 201, { id: 31 }, REPLAY_HEADERS)]);
    apiClient.defaults.adapter = next;
    await createTransactionForUi(PAYLOAD);
    expect(next.keys[0]).not.toBe(failing.keys[0]);
  });
});

describe("createTransactionPayloadFingerprint — rejeita o que o JSON não representa", () => {
  it("`Date` explode em vez de virar `{}` (senão dois DIAS diferentes dividiriam a impressão digital)", () => {
    // `Object.keys(new Date())` é `[]`. Sem a guarda, transações de 20/08 e
    // 21/08 teriam a MESMA impressão digital e a segunda viraria replay.
    expect(() =>
      createTransactionPayloadFingerprint({ ...PAYLOAD, transaction_date: new Date("2026-08-20") }),
    ).toThrow(TypeError);
    expect(() =>
      createTransactionPayloadFingerprint({ ...PAYLOAD, transaction_date: new Date("2026-08-21") }),
    ).toThrow(TypeError);
  });

  it("rejeita função, NaN, Infinity, undefined no topo e instância de classe", () => {
    class Money {}
    expect(() => createTransactionPayloadFingerprint({ ...PAYLOAD, cb: () => {} })).toThrow(TypeError);
    expect(() => createTransactionPayloadFingerprint({ ...PAYLOAD, value: Number.NaN })).toThrow(TypeError);
    expect(() => createTransactionPayloadFingerprint({ ...PAYLOAD, value: Number.POSITIVE_INFINITY })).toThrow(TypeError);
    expect(() => createTransactionPayloadFingerprint(undefined)).toThrow(TypeError);
    expect(() => createTransactionPayloadFingerprint({ ...PAYLOAD, m: new Money() })).toThrow(TypeError);
    expect(() => createTransactionPayloadFingerprint({ ...PAYLOAD, ids: new Set([1]) })).toThrow(TypeError);
  });

  it("campo `undefined` é omitido, igual ao corpo que sai na requisição", () => {
    expect(createTransactionPayloadFingerprint({ ...PAYLOAD, card_id: undefined })).toBe(
      createTransactionPayloadFingerprint(PAYLOAD),
    );
  });

  it("números seguem a mesma normalização do hash canônico do backend: `100` e `100.0` são o mesmo payload", () => {
    expect(createTransactionPayloadFingerprint({ value: 100 })).toBe(
      createTransactionPayloadFingerprint({ value: 100.0 }),
    );
  });
});

describe("createRetryDelayMs — `Retry-After` honrado nas duas formas da RFC", () => {
  function errorWithRetryAfter(raw) {
    return new AxiosError("in flight", undefined, {}, {}, {
      status: 409,
      data: {},
      statusText: "",
      headers: raw == null ? {} : { "retry-after": raw },
      config: {},
    });
  }

  const NOW = Date.parse("2026-08-20T12:00:00Z");

  it("segundos viram a BASE do backoff: `Retry-After: 2` reproduz o 2s/4s/8s publicado", () => {
    // Antes o header SUBSTITUÍA o backoff. Como a API manda sempre
    // `Retry-After: 2`, o 2s/4s/8s documentado nos dois repositórios virava
    // 2s/2s/2s — quatro POSTs em seis segundos contra uma reserva órfã.
    expect(createRetryDelayMs(errorWithRetryAfter("2"), 1, { inFlight: true, nowMs: NOW })).toBe(2000);
    expect(createRetryDelayMs(errorWithRetryAfter("2"), 2, { inFlight: true, nowMs: NOW })).toBe(4000);
    expect(createRetryDelayMs(errorWithRetryAfter("2"), 3, { inFlight: true, nowMs: NOW })).toBe(8000);
    // `0` continua sendo espera válida (repetir já), em qualquer tentativa.
    expect(createRetryDelayMs(errorWithRetryAfter("0"), 1, { inFlight: true, nowMs: NOW })).toBe(0);
    expect(createRetryDelayMs(errorWithRetryAfter("0"), 3, { inFlight: true, nowMs: NOW })).toBe(0);
  });

  it("`Retry-After` é ignorado FORA do 409: em 502/503/504 o ritmo é nosso", () => {
    // Honrá-lo ali entregava o ritmo do drawer a qualquer proxy no caminho:
    // um `Retry-After: 3600` num 503 congelava a tela com o botão desabilitado.
    const gateway = new AxiosError("bad gateway", undefined, {}, {}, {
      status: 503,
      data: {},
      statusText: "",
      headers: { "retry-after": "3600" },
      config: {},
    });
    expect(createRetryDelayMs(gateway, 1, { nowMs: NOW })).toBe(400);
    expect(createRetryDelayMs(gateway, 2, { nowMs: NOW })).toBe(800);
  });

  it("HTTP-date: convertido para a espera real em vez de virar NaN e cair no backoff curto", () => {
    // Antes, a forma de data caía em `Number(raw) === NaN` e o cliente
    // martelava com 400ms justamente quem pediu pausa.
    const at = new Date(NOW + 5000).toUTCString();
    expect(createRetryDelayMs(errorWithRetryAfter(at), 1, { inFlight: true, nowMs: NOW })).toBe(5000);
    // Data no passado: repetir já, nunca espera negativa.
    const past = new Date(NOW - 5000).toUTCString();
    expect(createRetryDelayMs(errorWithRetryAfter(past), 1, { inFlight: true, nowMs: NOW })).toBe(0);
  });

  it("valor absurdo é limitado ao teto por espera, não ignorado", () => {
    expect(createRetryDelayMs(errorWithRetryAfter("86400"), 1, { inFlight: true, nowMs: NOW })).toBe(10_000);
  });

  it("sem header: backoff 2s/4s/8s no in-flight (contrato publicado) e curto no transiente", () => {
    expect(createRetryDelayMs(errorWithRetryAfter(null), 1, { inFlight: true, nowMs: NOW })).toBe(2000);
    expect(createRetryDelayMs(errorWithRetryAfter(null), 2, { inFlight: true, nowMs: NOW })).toBe(4000);
    expect(createRetryDelayMs(errorWithRetryAfter(null), 3, { inFlight: true, nowMs: NOW })).toBe(8000);
    expect(createRetryDelayMs(errorWithRetryAfter(null), 1, { nowMs: NOW })).toBe(400);
    expect(createRetryDelayMs(errorWithRetryAfter(null), 2, { nowMs: NOW })).toBe(800);
  });
});

describe("createResendIsProtected — a única pergunta que a UI faz", () => {
  it("com chave retida MAS sem suporte observado: NÃO protegido (o header vira enfeite num backend antigo)", async () => {
    apiClient.defaults.adapter = scriptAdapter([(config) => respondWithStatus(config, 503, {})]);
    await settling(createTransactionForUi(PAYLOAD)).catch(() => {});

    // A retenção existe...
    expect(hasRetainedCreateIdempotencyKey(PAYLOAD)).toBe(true);
    // ...mas sem prova de que o servidor honra a chave, reenviar duplica como
    // sempre duplicou. A UI precisa voltar a pedir confirmação.
    expect(hasObservedIdempotencySupport()).toBe(false);
    expect(createResendIsProtected(PAYLOAD)).toBe(false);
  });

  it("com suporte observado e chave retida: protegido; payload diferente: não", async () => {
    await observeIdempotencySupport();
    apiClient.defaults.adapter = scriptAdapter([(config) => respondWithStatus(config, 503, {})]);
    await settling(createTransactionForUi(PAYLOAD)).catch(() => {});

    expect(createResendIsProtected(PAYLOAD)).toBe(true);
    expect(createResendIsProtected({ ...PAYLOAD, value: 43 })).toBe(false);
  });

  it("respeita o TTL: aos 11 minutos deixa de proteger, e o adapter concorda emitindo chave NOVA", async () => {
    // O modal comparava fingerprints por conta própria e era CEGO ao TTL:
    // aos 11 min ele ainda dizia "é replay" enquanto `createTransactionForUi`
    // já emitia outra chave — reenvio sem aviso, duplicata possível.
    noteIdempotencySupport();
    const t0 = Date.parse("2026-08-20T09:00:00Z");
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(t0);

    const failing = scriptAdapter([(config) => respondWithStatus(config, 503, {})]);
    apiClient.defaults.adapter = failing;
    await settling(createTransactionForUi(PAYLOAD)).catch(() => {});
    expect(createResendIsProtected(PAYLOAD)).toBe(true);

    nowSpy.mockReturnValue(t0 + 11 * 60 * 1000);
    expect(createResendIsProtected(PAYLOAD)).toBe(false);

    const later = scriptAdapter([(config) => respondWithStatus(config, 201, { id: 40 }, REPLAY_HEADERS)]);
    apiClient.defaults.adapter = later;
    await createTransactionForUi(PAYLOAD);
    expect(later.keys[0]).not.toBe(failing.keys[0]);
  });

  it("liberação externa da chave derruba a proteção na mesma hora", async () => {
    await observeIdempotencySupport();
    apiClient.defaults.adapter = scriptAdapter([(config) => respondWithStatus(config, 503, {})]);
    await settling(createTransactionForUi(PAYLOAD)).catch(() => {});
    expect(createResendIsProtected(PAYLOAD)).toBe(true);

    releaseCreateIdempotencyKey(createTransactionPayloadFingerprint(PAYLOAD));
    expect(createResendIsProtected(PAYLOAD)).toBe(false);
  });
});

describe("createRetryDelayMs — orçamento do TOTAL dormido", () => {
  function inFlightError(retryAfter) {
    return new AxiosError("in flight", undefined, {}, {}, {
      status: 409,
      data: {},
      statusText: "",
      headers: { "retry-after": retryAfter },
      config: {},
    });
  }

  it("`null` quando a próxima espera estouraria o orçamento — é o sinal de desistir", () => {
    // Antes só a espera INDIVIDUAL era limitada: um `Retry-After: 3600` dava
    // 30s + 30s, ou seja ~1 min de drawer congelado com o botão desabilitado.
    const err = inFlightError("3600");
    expect(createRetryDelayMs(err, 1, { inFlight: true, spentMs: 0 })).toBe(10_000);
    expect(createRetryDelayMs(err, 2, { inFlight: true, spentMs: 10_000 })).toBe(10_000);
    expect(createRetryDelayMs(err, 3, { inFlight: true, spentMs: 20_000 })).toBeNull();
  });

  it("o 2s/4s/8s do contrato cabe inteiro no orçamento (14s < 20s)", () => {
    const err = inFlightError("2");
    expect(createRetryDelayMs(err, 1, { inFlight: true, spentMs: 0 })).toBe(2000);
    expect(createRetryDelayMs(err, 2, { inFlight: true, spentMs: 2000 })).toBe(4000);
    expect(createRetryDelayMs(err, 3, { inFlight: true, spentMs: 6000 })).toBe(8000);
  });
});

describe("impressão digital — classes de equivalência alinhadas ao hash canônico do backend", () => {
  it("campo ausente ≡ `null` ≡ `undefined` (o backend afrouxou; alinhar AUMENTA a proteção)", () => {
    // O modal ora omite `card_id`, ora manda `null`. Antes essa diferença de
    // FORMA gerava chave nova — lançamento novo onde deveria haver replay.
    const base = createTransactionPayloadFingerprint(PAYLOAD);
    expect(createTransactionPayloadFingerprint({ ...PAYLOAD, card_id: null })).toBe(base);
    expect(createTransactionPayloadFingerprint({ ...PAYLOAD, card_id: undefined })).toBe(base);
  });

  it("data-hora ISO equivalente é o mesmo payload, mesmo reformatada no reenvio", () => {
    const noon = createTransactionPayloadFingerprint({ ...PAYLOAD, transaction_date: "2026-08-20T12:00:00Z" });
    expect(createTransactionPayloadFingerprint({ ...PAYLOAD, transaction_date: "2026-08-20T12:00:00.000Z" })).toBe(noon);
    expect(createTransactionPayloadFingerprint({ ...PAYLOAD, transaction_date: "2026-08-20T09:00:00-03:00" })).toBe(noon);
    // Instantes diferentes seguem diferentes.
    expect(createTransactionPayloadFingerprint({ ...PAYLOAD, transaction_date: "2026-08-21T12:00:00Z" })).not.toBe(noon);
    // Date-only não é o mesmo instante que uma data-hora: fica de fora.
    expect(createTransactionPayloadFingerprint({ ...PAYLOAD, transaction_date: "2026-08-20" })).not.toBe(noon);
  });

  it("tipos diferentes continuam diferentes: `100` não é `\"100\"`", () => {
    expect(createTransactionPayloadFingerprint({ value: 100 })).not.toBe(
      createTransactionPayloadFingerprint({ value: "100" }),
    );
  });
});

describe("formatTransactionsApiError — código do servidor não indexa protótipo", () => {
  it("`detail.error === \"__proto__\"` devolve STRING, não objeto (senão o React derruba o drawer)", () => {
    // "Objects are not valid as a React child" com o drawer inteiro caindo:
    // indexar objeto literal com string vinda da rede alcança a herança.
    const err = new AxiosError("boom", undefined, {}, {}, {
      status: 422,
      data: { detail: { error: "__proto__", message: "x", type: "y" } },
      statusText: "",
      headers: {},
      config: {},
    });
    expect(typeof formatTransactionsApiError(err)).toBe("string");
  });

  it.each(["constructor", "toString", "valueOf", "hasOwnProperty"])(
    "`detail.error === \"%s\"` também devolve string",
    (code) => {
      const err = new AxiosError("boom", undefined, {}, {}, {
        status: 422,
        data: { detail: { error: code, message: "x", type: "y" } },
        statusText: "",
        headers: {},
        config: {},
      });
      expect(typeof formatTransactionsApiError(err)).toBe("string");
    },
  );
});
