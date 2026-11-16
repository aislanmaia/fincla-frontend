import { describe, expect, it } from "vitest";
import { invoiceExportFilter, invoiceRows, tagOptions, weeklySpending } from "../cardTransactionsModel.js";
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
    // #525: a busca olha só a descrição (como a API); o nome da categoria tem filtro próprio.
    expect(invoiceRows(items, { search: "transporte" })).toEqual([]);
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

describe("invoiceExportFilter: os filtros de Lançamentos da fatura como parâmetros da API (fincla-api#525)", () => {
  const base = { organizationId: "org", cardId: 7, invoiceId: 41 };
  const tagged = (id, tags) => ({ id, description: `L${id}`, amount: { amount: "10.00", currency: "BRL" }, transaction_date: "2026-10-01", modality: "cash", tags });
  const items = [
    tagged(1, { categoria: [{ id: "c1", name: "Casa" }], detalhe: [{ id: "t1", name: "viagem" }] }),
    tagged(2, { categoria: [{ id: "c2", name: "Lazer" }], pessoa: [{ id: "t2", name: "viagem" }, { id: "t3", name: "ana" }] }),
  ];

  it("sem filtros: só organização, cartão e fatura", () => {
    expect(invoiceExportFilter({ ...base, items })).toEqual({ params: { organization_id: "org", credit_card_id: 7, invoice_id: [41] }, blocked: null });
  });

  it("fatura sem id não vira pedido sem fatura (seria o cartão inteiro)", () => {
    const result = invoiceExportFilter({ ...base, invoiceId: null, items });
    expect(result.params).toBeNull();
    expect(result.blocked).toMatch(/ainda não tem lançamentos/);
  });

  it("etiqueta com nome repetido: no modo qualquer manda todos os ids; no modo todas recusa", () => {
    const any = invoiceExportFilter({ ...base, items, tags: ["viagem"], tagMode: "any" });
    expect(any.params.tag_id.sort()).toEqual(["t1", "t2"]);
    expect(any.params.tag_match).toBe("any");
    const all = invoiceExportFilter({ ...base, items, tags: ["viagem", "ana"], tagMode: "all" });
    expect(all.params).toBeNull();
    expect(all.blocked).toMatch(/mesmo nome/);
    expect(invoiceExportFilter({ ...base, items, tags: ["ana"], tagMode: "all" }).params).toMatchObject({ tag_id: ["t3"], tag_match: "all" });
  });

  it("categoria vai pelo id da categoria, nunca pelo rótulo traduzido ou personalizado (G3-2-01)", () => {
    // O que a fatura devolve: o rótulo de tela ("Transporte" é a tradução da semente `Transport`; "Mercado" é o
    // nome que a pessoa deu). O filtro `category` da API não conhece esses rótulos — só o nome interno ou o id.
    const categories = [
      { id: "8f0c1a2e-0000-4000-8000-000000000001", name: "Transporte" },
      { id: "8f0c1a2e-0000-4000-8000-000000000002", name: "Mercado" },
      { id: "8f0c1a2e-0000-4000-8000-000000000009", name: "mercado" },
    ];
    expect(invoiceExportFilter({ ...base, items, categories, cats: ["8f0c1a2e-0000-4000-8000-000000000001"] }).params.category)
      .toEqual(["8f0c1a2e-0000-4000-8000-000000000001"]);
    // Rótulos repetidos não atrapalham: o id separa as duas categorias.
    const one = invoiceExportFilter({ ...base, items, categories, cats: ["8f0c1a2e-0000-4000-8000-000000000002"] });
    expect(one.blocked).toBeNull();
    expect(one.params.category).toEqual(["8f0c1a2e-0000-4000-8000-000000000002"]);
    const params = invoiceExportFilter({ ...base, items, categories, cats: ["8f0c1a2e-0000-4000-8000-000000000002", "8f0c1a2e-0000-4000-8000-000000000009"] }).params;
    expect(params.category).toEqual(["8f0c1a2e-0000-4000-8000-000000000002", "8f0c1a2e-0000-4000-8000-000000000009"]);
    expect(JSON.stringify(params)).not.toMatch(/Transporte|Mercado|mercado/);
    expect(invoiceExportFilter({ ...base, items, categories, cats: ["uncategorized"] }).blocked).toMatch(/Sem Categoria/);
  });

  it("valor lido na moeda da fatura, como a tela lê (US$ '1,500' é 1500)", () => {
    const { params } = invoiceExportFilter({ ...base, items, valueMin: "1,500", valueMax: "2,000.50", valueCurrency: "USD" });
    expect(params.value_min).toBe(1500);
    expect(params.value_max).toBe(2000.5);
  });

  it("busca aparada, modalidade 'Todas' não filtra e período vira datas", () => {
    const { params } = invoiceExportFilter({ ...base, items, search: "  pão ", modality: "all", from: "2026-10-01", to: "2026-10-31" });
    expect(params).toEqual({ organization_id: "org", credit_card_id: 7, invoice_id: [41], description: "pão", date_start: "2026-10-01", date_end: "2026-10-31" });
  });
});

describe("busca da tela = busca da API (só a descrição gravada)", () => {
  const row = (id, description, modality, category) => ({ id, description, amount: { amount: "1.00", currency: "BRL" }, transaction_date: "2026-10-01", modality, tags: { categoria: [{ id: "c", name: category }] } });
  it("não acha pelo nome da categoria nem pelo prefixo 'Estorno:' que a tela desenha", () => {
    const list = [row(1, "Loja", "refund", "Mercado"), row(2, "Mercado Pão", "cash", "Casa")];
    expect(invoiceRows(list, { search: "mercado" }).map((r) => r.id)).toEqual([2]);
    expect(invoiceRows(list, { search: "estorno" })).toEqual([]);
    expect(invoiceRows(list, { search: "LOJA" }).map((r) => r.id)).toEqual([1]);
  });
});
