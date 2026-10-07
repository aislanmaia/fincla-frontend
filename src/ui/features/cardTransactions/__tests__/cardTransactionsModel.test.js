import { describe, expect, it } from "vitest";
import { invoiceRows, tagOptions, weeklySpending } from "../cardTransactionsModel.js";
import { sortItems } from "../../transactions/filters/search/sortModel.js";

describe("saídas observadas na fatura inteira", () => {
  it("inclui compras anteriores ao mês nominal, subtrai estornos e distingue semanas sem dados", () => {
    const rows = weeklySpending([
      { transaction_date: "2026-09-28", amount: 100, modality: "cash" },
      { transaction_date: "2026-10-12", amount: 60, modality: "installment" },
      { transaction_date: "2026-10-19", amount: 20, modality: "refund" },
    ]);
    expect(rows.map(({ label, amount, hasData }) => ({ label, amount, hasData }))).toEqual([
      { label: "28/09", amount: 100, hasData: true },
      { label: "05/10", amount: 0, hasData: false },
      { label: "12/10", amount: 60, hasData: true },
      { label: "19/10", amount: -20, hasData: true },
    ]);
  });
});

describe("facetas sobre todos os itens da fatura", () => {
  const item = (id, date, categoryId, categoryName, value, tags = [], modality = "cash") => ({
    id, series_id: null, transaction_id: id, transaction_date: date,
    description: `Compra ${id}`, amount: value, installment_number: 1, total_installments: 1,
    modality, tags: { categoria: [{ id: categoryId, name: categoryName, color: "#2563EB" }], etiqueta: tags.map((name) => ({ id: name, name })) },
  });
  const items = [
    item(1, "2026-12-30", "c1", "Alimentação", 100, ["trabalho", "mercado"]),
    item(2, "2027-01-04", "c2", "Transporte", 45, ["trabalho"]),
    item(3, "2027-01-06", "c1", "Alimentação", 20, ["mercado"], "refund"),
  ];

  it("aceita o timestamp ISO retornado pela API nas linhas e no gráfico semanal", () => {
    const withTime = { ...items[0], transaction_date: "2026-12-30T12:00:00" };
    expect(invoiceRows([withTime], { from: "2026-12-30", to: "2026-12-30" })[0]).toMatchObject({
      transactionDate: "2026-12-30", date: "30/12/2026",
    });
    expect(weeklySpending([withTime])).toMatchObject([{ hasData: true, amount: 100 }]);
  });

  it("combina período, categoria, tag E, modalidade e faixa de valor", () => {
    expect(tagOptions(items)).toEqual(["mercado", "trabalho"]);
    expect(invoiceRows(items, { from: "2026-12-01", to: "2026-12-31", cats: ["c1"], tags: ["trabalho", "mercado"], tagMode: "all", valueMin: "50" }).map((row) => row.id)).toEqual([1]);
    expect(invoiceRows(items, { from: "2027-01-01", tags: ["mercado"], modality: "refund", valueMax: "30" }).map((row) => row.id)).toEqual([3]);
    expect(invoiceRows(items, { search: "transporte" }).map((row) => row.id)).toEqual([2]);
  });

  it("ordena cobranças na virada do ano e separa data de compra da data exibida", () => {
    const crossed = [
      { ...items[0], purchase_info: { purchase_date: "2026-08-01" } },
      items[1],
    ];
    const rows = invoiceRows(crossed);
    expect(rows[0]).toMatchObject({ data: "30/12", date: "30/12/2026", purchaseDate: "2026-08-01" });
    expect(sortItems(rows, [{ field: "date", dir: "desc" }]).map((row) => row.id)).toEqual([2, 1]);
  });

  it("não trata valor ausente como zero ao aplicar faixa", () => {
    const missing = { ...items[0], id: 4, amount: null };
    expect(invoiceRows([missing], {}).map((row) => row.id)).toEqual([4]);
    expect(invoiceRows([missing], { valueMax: "1" })).toEqual([]);
  });
});
