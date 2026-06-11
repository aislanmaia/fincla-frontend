// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SavedViewsCards } from "../../filters/savedViews/SavedViewsCards.jsx";

afterEach(cleanup);

const VIEWS = [
  { id: "v1", label: "Despesas do mês", icon: "calendar", color: "#0F0F0D", hint: "42 transações" },
  { id: "v2", label: "Cartão Nubank", icon: "card", color: "#7C3AED", hint: "23 lançamentos" },
];

function setup(overrides = {}) {
  const props = {
    items: VIEWS,
    active: "v1",
    onActivate: vi.fn(),
    onDelete: vi.fn(),
    onOpenSaveForm: vi.fn(),
    onSaveView: vi.fn(),
    activeFacets: [],
    ...overrides,
  };
  const view = render(<SavedViewsCards {...props} />);
  return { ...view, props };
}

describe("<SavedViewsCards>", () => {
  it("renderiza o label de seção e todos os cards", () => {
    setup();
    expect(screen.getByText(/Visualizações salvas/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Despesas do mês" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cartão Nubank" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Nova$/ })).toBeInTheDocument();
  });

  it("clicar num card inativo o ativa", async () => {
    const { props } = setup({ active: null });
    await userEvent.click(screen.getByRole("button", { name: "Cartão Nubank" }));
    expect(props.onActivate).toHaveBeenCalledWith("v2");
  });

  it("clicar no card ativo desaplica via callback (mesmo id)", async () => {
    const { props } = setup({ active: "v1" });
    await userEvent.click(screen.getByRole("button", { name: "Despesas do mês" }));
    expect(props.onActivate).toHaveBeenCalledWith("v1");
  });

  it("card modificado exibe Filtros alterados", () => {
    setup({
      items: [{ ...VIEWS[0], modified: true }],
      active: "v1",
    });
    expect(screen.getByText(/Filtros alterados/i)).toBeInTheDocument();
  });

  it("Enter no card ativa via teclado", () => {
    const { props } = setup({ active: null });
    const card = screen.getByRole("button", { name: "Despesas do mês" });
    card.focus();
    fireEvent.keyDown(card, { key: "Enter" });
    expect(props.onActivate).toHaveBeenCalledWith("v1");
  });

  it("aria-pressed reflete a view ativa", () => {
    setup({ active: "v2" });
    expect(screen.getByRole("button", { name: "Despesas do mês" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Cartão Nubank" })).toHaveAttribute("aria-pressed", "true");
  });

  it("clicar em + Nova abre form de criação", async () => {
    const { props } = setup();
    await userEvent.click(screen.getByRole("button", { name: /^Nova$/ }));
    expect(props.onOpenSaveForm).toHaveBeenCalledWith("create");
    expect(screen.getByText("Nova visualização")).toBeInTheDocument();
  });

  it("Salvar como nova visualização chama onSaveView em modo create", async () => {
    const { props } = setup();
    await userEvent.click(screen.getByRole("button", { name: /^Nova$/ }));
    await userEvent.type(screen.getByLabelText(/Nome da visualização/i), "Mercado");
    await userEvent.click(
      screen.getByRole("button", { name: /Salvar como nova visualização/i }),
    );
    expect(props.onSaveView).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "create", name: "Mercado" }),
    );
  });

  it("modo update usa CTA com nome da view", async () => {
    setup({
      saveFormMode: "update",
      saveFormInitialName: "Receitas",
      updateViewLabel: "Receitas",
      active: "v1",
      newFormOpen: true,
    });
    expect(
      screen.getByRole("button", { name: /Salvar na visualização Receitas/i }),
    ).toBeInTheDocument();
  });

  it("modo update ancora o form abaixo do card ativo, não em + Nova", () => {
    const { container } = setup({
      saveFormMode: "update",
      saveFormInitialName: "Despesas do mês",
      updateViewLabel: "Despesas do mês",
      active: "v1",
      newFormOpen: true,
    });
    expect(screen.getByText("Atualizar visualização")).toBeInTheDocument();
    const activeCard = container.querySelector(".saved-view-card[aria-pressed='true']");
    expect(activeCard).toBeTruthy();
    expect(activeCard.parentElement?.textContent).toContain("Atualizar visualização");
    const novaBtn = screen.getByRole("button", { name: /^Nova$/ });
    expect(novaBtn.parentElement?.textContent).not.toContain("Atualizar visualização");
    expect(container.querySelector('[style*="dashed"]')).toBeTruthy();
  });

  it("Excluir no popover chama onDelete e fecha", () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Excluir Cartão Nubank/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^Excluir$/ }));
    expect(props.onDelete).toHaveBeenCalledWith("v2");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
