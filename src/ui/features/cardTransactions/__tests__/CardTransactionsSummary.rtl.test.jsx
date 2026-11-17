/** @vitest-environment jsdom */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardTransactionsSummary } from "../CardTransactionsSummary.jsx";
import { categoryColorResolver } from "../cardTransactionsModel.js";

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

  it("no sheet mobile a legenda só fica ao lado da rosca quando cabe com folga", () => {
    render(<CardTransactionsSummary summary={summary} isCategorySelected={() => false} onToggleCategory={() => {}} isMobile />);
    expect(screen.getByRole("list", { name: "Categorias em BRL" }).style.flexBasis).toBe("230px");
  });
});

/* QA display-and-pagination BUG-02: a cor do ponto vinha da POSIÇÃO na lista (azul para a primeira), não da
   categoria. "Saude da Familia QA" (Saúde renomeada) era azul aqui, cinza nas Transações e vermelha na Visão
   Geral. Agora a cor sai do catálogo da organização pela chave estável `system_key`. */
describe("CardTransactionsSummary — cor da categoria (BUG-02)", () => {
  const catalog = [
    // Catálogo sem cor própria para a renomeada: a chave do sistema decide.
    { id: "h", label: "Saude da Familia QA", apiName: "health", systemKey: "health", color: null },
    { id: "f", label: "Alimentação", apiName: "food_groceries", systemKey: "food_groceries", color: "#059669" },
  ];
  const renamedSummary = {
    total_transactions: 2,
    by_currency: [{ currency: "BRL", amount: "300.00" }],
    breakdown: { by_category: [cat("Alimentação", "200"), cat("Saude da Familia QA", "100")] },
  };
  const dotColor = (name) => {
    const label = within(screen.getByRole("list", { name: "Categorias em BRL" })).getByTitle(name);
    return label.previousElementSibling.style.background;
  };

  it("a renomeada tem a cor de Saúde e cada categoria a sua, independentemente da posição", () => {
    render(<CardTransactionsSummary summary={renamedSummary} isCategorySelected={() => false} onToggleCategory={() => {}} colorForCategory={categoryColorResolver(catalog)} />);
    expect(dotColor("Saude da Familia QA")).toBe("rgb(220, 38, 38)");
    expect(dotColor("Alimentação")).toBe("rgb(5, 150, 105)");
  });

  it("a mesma cor que a linha das Transações usa para a mesma categoria", async () => {
    const { catColor } = await import("../../transactions/shared/transactionFormat.js");
    const resolve = categoryColorResolver(catalog);
    expect(resolve("Saude da Familia QA")).toBe(catColor("Saude da Familia QA", "health", null));
    expect(resolve("Alimentação")).toBe(catColor("Alimentação", "food_groceries", "#059669"));
  });

  it("sem catálogo, o nome canônico ainda dá a cor da categoria", () => {
    render(<CardTransactionsSummary summary={{ ...renamedSummary, breakdown: { by_category: [cat("Transporte", "50"), cat("Saúde", "40")] } }} isCategorySelected={() => false} onToggleCategory={() => {}} />);
    expect(dotColor("Saúde")).toBe("rgb(220, 38, 38)");
    expect(dotColor("Transporte")).toBe("rgb(37, 99, 235)");
  });
});
