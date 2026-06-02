// @vitest-environment jsdom
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
    onCreate: vi.fn(),
    activeFacets: [],
    ...overrides,
  };
  render(<SavedViewsCards {...props} />);
  return props;
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
    const props = setup({ active: null });
    await userEvent.click(screen.getByRole("button", { name: "Cartão Nubank" }));
    expect(props.onActivate).toHaveBeenCalledWith("v2");
  });

  it("clicar no card ativo desativa (manda null)", async () => {
    const props = setup({ active: "v1" });
    await userEvent.click(screen.getByRole("button", { name: "Despesas do mês" }));
    expect(props.onActivate).toHaveBeenCalledWith(null);
  });

  it("Enter no card ativa via teclado", () => {
    const props = setup({ active: null });
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

  it("clicar no × abre o popover de confirmação", () => {
    setup();
    const del = screen.getByRole("button", { name: /Excluir Despesas do mês/i });
    // O botão é hover-revealed (pointer-events:none até hover); usamos fireEvent.click
    // que ignora o check de pointer-events.
    fireEvent.click(del);
    expect(screen.getByRole("dialog", { name: /Confirmar exclusão de Despesas do mês/i })).toBeInTheDocument();
    expect(screen.getByText(/Excluir esta visualização\?/i)).toBeInTheDocument();
  });

  it("Excluir no popover chama onDelete e fecha", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: /Excluir Cartão Nubank/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^Excluir$/ }));
    expect(props.onDelete).toHaveBeenCalledWith("v2");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Cancelar no popover não chama onDelete e fecha", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: /Excluir Cartão Nubank/i }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Cancelar/i }));
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Esc no popover fecha", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Excluir Cartão Nubank/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clicar em + Nova abre o NewViewForm; cancelar fecha", async () => {
    setup();
    const newBtn = screen.getByRole("button", { name: /^Nova$/ });
    expect(newBtn).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(newBtn);
    expect(screen.getByText("Nova visualização")).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome da visualização/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(screen.queryByText("Nova visualização")).not.toBeInTheDocument();
  });

  it("Salvar no NewViewForm chama onCreate com nome trimado e fecha", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: /^Nova$/ }));
    const input = screen.getByLabelText(/Nome da visualização/i);
    await userEvent.type(input, "   Mercado   ");
    await userEvent.click(screen.getByRole("button", { name: /Salvar visualização/i }));
    expect(props.onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Mercado", icon: "bookmark" }),
    );
    expect(screen.queryByText("Nova visualização")).not.toBeInTheDocument();
  });

  it("Enter no input salva", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: /^Nova$/ }));
    const input = screen.getByLabelText(/Nome da visualização/i);
    await userEvent.type(input, "Spotify{Enter}");
    expect(props.onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: "Spotify" }));
  });

  it("botão Salvar desabilita com nome vazio", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /^Nova$/ }));
    expect(screen.getByRole("button", { name: /Salvar visualização/i })).toBeDisabled();
  });

  it("Esc no input do form cancela", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /^Nova$/ }));
    const input = screen.getByLabelText(/Nome da visualização/i);
    await userEvent.type(input, "Algo");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByText("Nova visualização")).not.toBeInTheDocument();
  });
});
