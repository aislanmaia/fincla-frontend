// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ConsultantEvaluationDrawer } from "../ConsultantEvaluationDrawer.jsx";
import { evaluateClientWithAi } from "../../../../api/consultant";

vi.mock("../../../../api/consultant", () => ({
  evaluateClientWithAi: vi.fn(),
  newEvaluationRequestId: () => "req-1",
}));

/**
 * Cliente sem dado não é uma falha do sistema: é um estado do cliente.
 *
 * O backend distingue os dois com `detail.code` (`insufficient_data` vs
 * `generation_failed`), ambos sob `422`. Ramificar pelo status sozinho pintava
 * "cliente vazio" com a mesma cara de "a OpenAI caiu" — e oferecia um retry que
 * nunca poderia dar certo.
 */
const reject = (status, detail) =>
  Promise.reject({ response: { status, data: { detail } } });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderDrawer = () =>
  render(
    <ConsultantEvaluationDrawer open organizationId="org-1" clientName="João da Silva" onClose={() => {}} />
  );

describe("drawer: 422 insufficient_data", () => {
  it("mostra o estado amigável, sem 'Tentar novamente'", async () => {
    evaluateClientWithAi.mockImplementation(() =>
      reject(422, { code: "insufficient_data", message: "irrelevante — a copy é do front" })
    );

    renderDrawer();

    expect(await screen.findByText(/Ainda não há dados para analisar/i)).toBeTruthy();
    expect(screen.getByText(/não registrou nenhuma transação/i)).toBeTruthy();
    // Retentar contra um cliente vazio não pode mudar nada.
    expect(screen.queryByRole("button", { name: /Tentar novamente/i })).toBeNull();
    // E não é vermelho: "Não foi possível avaliar" é a copy de falha real.
    expect(screen.queryByText(/Não foi possível avaliar/i)).toBeNull();
  });

  it("um 422 de geração continua sendo erro, com retry", async () => {
    evaluateClientWithAi.mockImplementation(() => reject(422, { code: "generation_failed", message: "x" }));

    renderDrawer();

    expect(await screen.findByText(/Não foi possível avaliar/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Tentar novamente/i })).toBeTruthy();
  });

  it("sobrevive ao formato antigo de `detail` (string), sem quebrar", async () => {
    // Um deploy do front pode preceder o do backend: `detail.code` some, e o
    // fallback por status tem de continuar entregando um erro utilizável.
    evaluateClientWithAi.mockImplementation(() => reject(422, "não foi possível gerar"));

    renderDrawer();

    expect(await screen.findByText(/Não foi possível avaliar/i)).toBeTruthy();
  });
});
