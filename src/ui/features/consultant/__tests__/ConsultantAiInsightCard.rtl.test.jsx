// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Card "Resumo da base por IA" (A2) — o gating e o gatilho on-demand.
 *
 * `useCanSummarizePortfolioWithAi` lê `useFinclaPages().user.subscription`; mockamos
 * o contexto para alternar entitlement sem montar a árvore de billing inteira.
 */

let mockUser = null;
vi.mock("../../../routing/finclaPageContext.jsx", () => ({
  useFinclaPages: () => ({ user: mockUser }),
}));

import { ConsultantAiInsightCard } from "../ConsultantAiInsightCard.jsx";

const withAi = {
  subscription: { status: "active", features: ["consultant_ai", "multi_org_dashboard"] },
};
const withoutAi = {
  subscription: { status: "active", features: ["multi_org_dashboard"] },
};

afterEach(() => {
  cleanup();
  mockUser = null;
});

describe("<ConsultantAiInsightCard> (A2 — card do Painel)", () => {
  it("com o recurso: o botão dispara onOpen (abre o drawer on-demand)", () => {
    mockUser = withAi;
    const onOpen = vi.fn();

    render(<ConsultantAiInsightCard onOpen={onOpen} />);

    const button = screen.getByRole("button", { name: /Gerar relatório da base/ });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
    // Sem o recurso concedido, nenhum selo PRO.
    expect(screen.queryByText("PRO")).not.toBeInTheDocument();
  });

  it("sem o recurso: botão esmaecido, selo PRO, e nunca dispara onOpen", () => {
    mockUser = withoutAi;
    const onOpen = vi.fn();

    render(<ConsultantAiInsightCard onOpen={onOpen} />);

    const button = screen.getByRole("button", { name: /Gerar relatório da base/ });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.getByText("PRO")).toBeInTheDocument();
  });

  it("o card NÃO auto-carrega: sem clique, nenhuma run é disparada", () => {
    // A garantia central do custo: renderizar o Painel não pode gastar uma run.
    // O card não conhece a API — se um dia alguém a importar aqui e chamar no
    // render, este teste não pega sozinho, mas a ausência de onOpen chamado no
    // mount é a linha de defesa do comportamento on-demand.
    mockUser = withAi;
    const onOpen = vi.fn();

    render(<ConsultantAiInsightCard onOpen={onOpen} />);

    expect(onOpen).not.toHaveBeenCalled();
  });
});
