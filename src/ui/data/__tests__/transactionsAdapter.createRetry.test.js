import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mocka o CLIENTE HTTP (apiClient.post), não `createTransactionForUi` nem
// `createTransaction` — é o transporte real que decide se um erro chegou
// com resposta do servidor ou não, e é exatamente essa distinção que a
// política de retry de `transactionsAdapter.js` precisa classificar direito.
vi.mock("../../../api/client", () => ({
  default: { post: vi.fn() },
  handleApiError: vi.fn(() => "erro genérico"),
}));

import apiClient, { handleApiError } from "../../../api/client";
import {
  createTransactionForUi,
  formatTransactionsApiError,
  isCreateTransactionErrorRetryable,
} from "../transactionsAdapter.js";

/** Erro de rede: a conexão caiu antes de qualquer byte trafegar — sem `response`. */
function networkError(code = "ERR_NETWORK") {
  return new AxiosError("Network Error", code);
}

/** Erro com resposta HTTP: o servidor processou o request (mesmo que com erro). */
function httpError(status, data = {}) {
  return new AxiosError(
    `Request failed with status code ${status}`,
    "ERR_BAD_RESPONSE",
    {},
    {},
    {
      status,
      data,
      statusText: "",
      headers: {},
      config: {},
    },
  );
}

/** Timeout de LEITURA: axios desiste esperando resposta — sem `response`, mas o
 * POST pode já ter sido processado no servidor (diferente de erro de rede puro). */
function readTimeoutError() {
  return new AxiosError("timeout of 30000ms exceeded", "ECONNABORTED");
}

const PAYLOAD = { organization_id: "org-1", description: "Uber", value: 42 };

describe("createTransactionForUi — política de retry (POST não é idempotente)", () => {
  beforeEach(() => {
    apiClient.post.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("erro de REDE (sem resposta): repete e conclui com sucesso na 2ª tentativa", async () => {
    apiClient.post
      .mockRejectedValueOnce(networkError())
      .mockResolvedValueOnce({ data: { id: 1 } });

    const onRetryAttempt = vi.fn();
    const result = await createTransactionForUi(PAYLOAD, { onRetryAttempt });

    expect(result).toEqual({ id: 1 });
    expect(apiClient.post).toHaveBeenCalledTimes(2);
    expect(onRetryAttempt).toHaveBeenCalledTimes(1);
    expect(onRetryAttempt).toHaveBeenCalledWith(2);
  });

  it("503 (gateway indisponível): repete", async () => {
    apiClient.post
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce({ data: { id: 2 } });

    const result = await createTransactionForUi(PAYLOAD);

    expect(result).toEqual({ id: 2 });
    expect(apiClient.post).toHaveBeenCalledTimes(2);
  });

  it("422 de validação: NUNCA repete — exatamente 1 chamada, erro propagado", async () => {
    apiClient.post.mockRejectedValueOnce(httpError(422, { detail: "invalid" }));

    await expect(createTransactionForUi(PAYLOAD)).rejects.toThrow();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it("500 genérico: NUNCA repete (pode ter gravado antes de estourar) — exatamente 1 chamada", async () => {
    apiClient.post.mockRejectedValueOnce(httpError(500));

    await expect(createTransactionForUi(PAYLOAD)).rejects.toThrow();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it("timeout de LEITURA após o envio: NUNCA repete — exatamente 1 chamada", async () => {
    apiClient.post.mockRejectedValueOnce(readTimeoutError());

    await expect(createTransactionForUi(PAYLOAD)).rejects.toThrow();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it("4xx qualquer (ex.: 409 de conflito): NUNCA repete", async () => {
    apiClient.post.mockRejectedValueOnce(httpError(409));

    await expect(createTransactionForUi(PAYLOAD)).rejects.toThrow();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it("tentativas esgotadas (erro de rede persistente): no máximo 2 chamadas, erro final em PT-BR e formulário reutilizável", async () => {
    const finalError = networkError();
    apiClient.post.mockRejectedValueOnce(networkError()).mockRejectedValueOnce(finalError);

    await expect(createTransactionForUi(PAYLOAD)).rejects.toBe(finalError);
    // No máximo 2 tentativas — não pode virar espera infinita nem martelar o backend.
    expect(apiClient.post).toHaveBeenCalledTimes(2);

    // O mesmo erro que o formulário exibiria via `formatTransactionsApiError`
    // (chama o `handleApiError` compartilhado) — mensagem amigável, não a
    // stack/código técnico do axios.
    expect(formatTransactionsApiError(finalError)).toBe("erro genérico");
    expect(handleApiError).toHaveBeenCalledWith(finalError);

    // Depois do erro final, a função está livre para ser chamada de novo —
    // é isso que mantém o formulário "utilizável" (o catch do modal já
    // reseta `txSubmitting`/`txSubmitError`; aqui provamos que não sobra
    // nenhum estado de retry pendurado na função em si).
    apiClient.post.mockReset();
    apiClient.post.mockResolvedValueOnce({ data: { id: 3 } });
    await expect(createTransactionForUi(PAYLOAD)).resolves.toEqual({ id: 3 });
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });
});

describe("isCreateTransactionErrorRetryable", () => {
  it("classifica corretamente cada categoria de erro", () => {
    expect(isCreateTransactionErrorRetryable(networkError("ERR_NETWORK"))).toBe(true);
    expect(isCreateTransactionErrorRetryable(networkError("ECONNRESET"))).toBe(true);
    expect(isCreateTransactionErrorRetryable(httpError(502))).toBe(true);
    expect(isCreateTransactionErrorRetryable(httpError(503))).toBe(true);
    expect(isCreateTransactionErrorRetryable(httpError(504))).toBe(true);

    expect(isCreateTransactionErrorRetryable(httpError(400))).toBe(false);
    expect(isCreateTransactionErrorRetryable(httpError(401))).toBe(false);
    expect(isCreateTransactionErrorRetryable(httpError(409))).toBe(false);
    expect(isCreateTransactionErrorRetryable(httpError(422))).toBe(false);
    expect(isCreateTransactionErrorRetryable(httpError(500))).toBe(false);
    expect(isCreateTransactionErrorRetryable(readTimeoutError())).toBe(false);
    expect(isCreateTransactionErrorRetryable(networkError("ETIMEDOUT"))).toBe(false);
    expect(isCreateTransactionErrorRetryable(new Error("boom"))).toBe(false);
  });
});
