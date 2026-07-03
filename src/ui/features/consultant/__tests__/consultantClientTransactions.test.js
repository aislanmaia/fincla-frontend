import { describe, expect, it } from "vitest";

import { filterTransactions, summarizeTransactions } from "../consultantClientTransactions";

const txs = [
  { id: "1", desc: "Salário", cat: "Renda", val: 5000, cartaoId: null },
  { id: "2", desc: "Aluguel", cat: "Moradia", val: -3000, cartaoId: null },
  { id: "3", desc: "Mercado", cat: "Alimentação", val: -900, cartaoId: 7 },
];

describe("summarizeTransactions", () => {
  it("soma receitas, despesas e resultado", () => {
    expect(summarizeTransactions(txs)).toEqual({ income: 5000, expense: 3900, result: 1100 });
  });
  it("é seguro com entrada inválida", () => {
    expect(summarizeTransactions(null)).toEqual({ income: 0, expense: 0, result: 0 });
  });
});

describe("filterTransactions", () => {
  it("filtro 'income' mantém só val ≥ 0", () => {
    const r = filterTransactions(txs, { filter: "income" });
    expect(r.map((t) => t.id)).toEqual(["1"]);
  });
  it("filtro 'expense' mantém só val < 0", () => {
    expect(filterTransactions(txs, { filter: "expense" }).map((t) => t.id)).toEqual(["2", "3"]);
  });
  it("filtro 'card' mantém só com cartaoId", () => {
    expect(filterTransactions(txs, { filter: "card" }).map((t) => t.id)).toEqual(["3"]);
  });
  it("busca por descrição/categoria (sem acento, case-insensitive)", () => {
    expect(filterTransactions(txs, { query: "aluguel" }).map((t) => t.id)).toEqual(["2"]);
    expect(filterTransactions(txs, { query: "ALIMENTACAO" }).map((t) => t.id)).toEqual(["3"]);
  });
  it("sem filtro/busca retorna tudo", () => {
    expect(filterTransactions(txs, {})).toHaveLength(3);
  });
});
