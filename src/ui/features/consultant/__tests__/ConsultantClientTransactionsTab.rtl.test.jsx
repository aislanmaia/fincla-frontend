// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConsultantClientTransactionsTab } from "../ConsultantClientTransactionsTab.jsx";

const TXS = [
  { id: "1", desc: "Salário", cat: "Renda", val: 5000, method: "Pix", date: "01/06/2026", cartaoId: null, categoryIconKey: null },
  { id: "2", desc: "Aluguel", cat: "Moradia", val: -3000, method: "Pix", date: "05/06/2026", cartaoId: null, categoryIconKey: null, rec: true },
  { id: "3", desc: "Mercado", cat: "Alimentação", val: -900, method: "Crédito", date: "10/06/2026", cartaoId: 7, categoryIconKey: null },
];

function state(over = {}) {
  return { loading: false, error: "", hasLoaded: true, transactions: TXS, ...over };
}

afterEach(() => cleanup());

describe("ConsultantClientTransactionsTab", () => {
  it("mostra resumo (receitas/despesas/resultado) e a lista", () => {
    render(<ConsultantClientTransactionsTab transactions={state()} />);
    expect(screen.getByText("Receitas no mês")).toBeInTheDocument();
    expect(screen.getByText("Despesas no mês")).toBeInTheDocument();
    expect(screen.getByText("Resultado")).toBeInTheDocument();
    // Resultado = 5000 − 3900 = 1100 (valor único, não colide com nenhuma linha).
    expect(screen.getByText(/R\$\s*1\.100/)).toBeInTheDocument();
    expect(screen.getByText("Salário")).toBeInTheDocument();
    expect(screen.getByText("Aluguel")).toBeInTheDocument();
    expect(screen.getByText("Mercado")).toBeInTheDocument();
  });

  it("filtra por 'Despesas'", () => {
    render(<ConsultantClientTransactionsTab transactions={state()} />);
    fireEvent.click(screen.getByRole("button", { name: "Despesas" }));
    expect(screen.queryByText("Salário")).not.toBeInTheDocument();
    expect(screen.getByText("Aluguel")).toBeInTheDocument();
  });

  it("filtra por 'No cartão'", () => {
    render(<ConsultantClientTransactionsTab transactions={state()} />);
    fireEvent.click(screen.getByRole("button", { name: "No cartão" }));
    expect(screen.getByText("Mercado")).toBeInTheDocument();
    expect(screen.queryByText("Aluguel")).not.toBeInTheDocument();
  });

  it("busca por descrição", () => {
    render(<ConsultantClientTransactionsTab transactions={state()} />);
    fireEvent.change(screen.getByLabelText("Buscar transação"), { target: { value: "merc" } });
    expect(screen.getByText("Mercado")).toBeInTheDocument();
    expect(screen.queryByText("Salário")).not.toBeInTheDocument();
  });

  it("'Nova transação' é stub 'em breve' (desabilitado)", () => {
    render(<ConsultantClientTransactionsTab transactions={state()} />);
    expect(screen.getByRole("button", { name: /Nova transação/ })).toBeDisabled();
  });

  it("estado de carregamento e vazio", () => {
    const { rerender } = render(<ConsultantClientTransactionsTab transactions={state({ loading: true, hasLoaded: false, transactions: [] })} />);
    expect(screen.getByText("Carregando transações…")).toBeInTheDocument();
    rerender(<ConsultantClientTransactionsTab transactions={state({ transactions: [] })} />);
    expect(screen.getByText("Nenhuma transação encontrada.")).toBeInTheDocument();
  });
});
