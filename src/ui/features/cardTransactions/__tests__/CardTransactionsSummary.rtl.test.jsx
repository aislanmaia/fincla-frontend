/** @vitest-environment jsdom */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardTransactionsSummary } from "../CardTransactionsSummary.jsx";

afterEach(cleanup);
const cat = (category, amount) => ({ category, amount, amount_currency: "BRL" });
const summary = { total_transactions: 9, by_currency: [{ currency: "BRL", amount: "700.00" }], breakdown: { by_category: [cat("A", "100"), cat("B", "90"), cat("C", "80"), cat("D", "70"), cat("E", "60"), cat("F", "50"), cat("G", "40")] } };

describe("CardTransactionsSummary — categorias", () => {
  it("mostra as 5 maiores e abre a lista completa, onde cada categoria filtra", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<CardTransactionsSummary summary={summary} isCategorySelected={() => false} onToggleCategory={onToggle} />);
    const list = screen.getByRole("list", { name: "Categorias em BRL" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);
    await user.click(within(list).getByRole("button", { name: /Filtrar por A/ }));
    expect(onToggle).toHaveBeenCalledWith("A");
    await user.click(screen.getByRole("button", { name: "Ver mais 2 categorias" }));
    const dialog = screen.getByRole("dialog", { name: "Categorias do recorte" });
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(7);
    await user.click(within(dialog).getByRole("button", { name: "Filtrar por G" }));
    expect(onToggle).toHaveBeenLastCalledWith("G");
  });

  it("com 5 categorias ou menos não há link de ver mais", () => {
    render(<CardTransactionsSummary summary={{ ...summary, breakdown: { by_category: [cat("A", "1"), cat("B", "2")] } }} isCategorySelected={() => false} onToggleCategory={() => {}} />);
    expect(screen.queryByText(/Ver mais/)).toBeNull();
    expect(screen.queryByText(/Outros/)).toBeNull();
  });

  it("com 6 categorias o link fala no singular", () => {
    render(<CardTransactionsSummary summary={{ ...summary, breakdown: { by_category: summary.breakdown.by_category.slice(0, 6) } }} isCategorySelected={() => false} onToggleCategory={() => {}} />);
    expect(screen.getByRole("button", { name: "Ver mais 1 categoria" })).toBeTruthy();
  });

  it("com duas moedas cada uma abre a própria lista", async () => {
    const usd = ["A", "B", "C", "D", "E", "F"].map((c, i) => ({ category: `U${c}`, amount: String(60 - i), amount_currency: "USD" }));
    const user = userEvent.setup();
    render(<CardTransactionsSummary summary={{ ...summary, breakdown: { by_category: [...summary.breakdown.by_category, ...usd] } }} isCategorySelected={() => false} onToggleCategory={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Ver mais 1 categoria" }));
    const dialog = screen.getByRole("dialog", { name: "Categorias do recorte" });
    expect(within(dialog).getByRole("list", { name: "Todas as categorias em USD" })).toBeTruthy();
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(6);
  });

  it("deixa a legenda quebrar para baixo da rosca, em vez de espremer os nomes", () => {
    render(<CardTransactionsSummary summary={summary} isCategorySelected={() => false} onToggleCategory={() => {}} />);
    const list = screen.getByRole("list", { name: "Categorias em BRL" });
    expect(list.parentElement.style.flexWrap).toBe("wrap");
    expect(list.style.flexBasis).toBe("190px");
  });
});
