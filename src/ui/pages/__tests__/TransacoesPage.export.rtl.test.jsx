/** @vitest-environment jsdom */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * fincla-api#521 — Exportar nas Transações: o botão "Exportar" (desktop e menu do celular) abre o painel
 * compartilhado, e o pedido leva TODOS os filtros da listagem — o mesmo objeto que pediu o resumo da tela.
 *
 * `filtersToLegacyParams` é substituído por um recorte com TODO filtro preenchido: se a página perder qualquer um
 * no caminho até o exportador (como os três caminhos antigos perdiam), o parâmetro correspondente some do pedido e
 * o teste falha. A camada de API é que é simulada; o painel e a página são reais.
 */
const FULL_SLICE = {
  search: "padaria",
  filterType: "despesa",
  filterCat: ["Alimentação", "aaaaaaaa-1111-4111-8111-111111111111"],
  filterMethod: ["pix"],
  period: "custom",
  customFrom: "2026-10-01",
  customTo: "2026-10-31",
  sortBy: "date-desc",
  valueMin: 10,
  valueMax: 500,
  valueCurrency: "BRL",
  recurring: false,
  tagMatch: "all",
  settlement: "a-pagar",
  accountIds: ["aaaaaaaa-0000-4000-8000-000000000001"],
  creditCardIds: ["5"],
  limit: 50,
};
let legacyOverride = null;
vi.mock("../../features/transactions/filters/filtersToLegacyParams.js", async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    filtersToLegacyParams: (...args) => legacyOverride ?? original.filtersToLegacyParams(...args),
  };
});

let routerSearch = {};
/** Total do período sem os outros filtros (o "de N" do cabeçalho). */
let facetTotalMock = null;
/** Histograma da faixa de valor (por moeda) devolvido pelas facetas. */
let facetBucketsMock = null;
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => routerSearch,
  useRouterState: (opts) =>
    typeof opts?.select === "function"
      ? opts.select({ location: { pathname: "/transactions", search: routerSearch } })
      : { location: { pathname: "/transactions", search: routerSearch } },
}));

const baseTransactions = [
  { id: "tx-1", date: "10/11/2026", desc: "Mercado", cat: "Alimentação", val: -100, method: "Pix",
    type: "expense", icon: "🍽", status: "confirmado", rec: false, tags: [], settled: true, settleable: true },
  { id: "tx-2", date: "02/11/2026", desc: "Padaria", cat: "Alimentação", val: -20, method: "Pix",
    type: "expense", icon: "🍞", status: "confirmado", rec: false, tags: [], settled: true, settleable: true },
];
let summaryMock;
let transactionsList;
const defaultTransactionsData = () => ({
  isLoading: false, error: "", hasLoaded: true,
  summary: summaryMock,
  transactions: transactionsList,
  total: 2, hasMore: false, removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
});
const transactionsDataMock = vi.fn(defaultTransactionsData);
vi.mock("../../features/transactions/useTransactionsData.js", () => ({
  useTransactionsData: (...args) => transactionsDataMock(...args),
}));
vi.mock("../../features/tags/useCategoryTagsData.js", () => ({
  useCategoryTagsData: () => ({ isLoading: false, categories: [{ id: "cat-alim", labelPt: "Alimentação", color: "#059669" }] }),
}));
let tagRows = [];
vi.mock("../../features/transactions/filters/useTransactionsTagCatalog.js", () => ({
  useTransactionsTagCatalog: () => ({ rows: tagRows, loading: false, error: "" }),
}));
/** Estado inicial extra dos filtros (etiquetas e modo), entrando pelo mesmo caminho do deep link. */
let deepLinkExtra = {};
vi.mock("../../features/transactions/transactionsDeepLink.js", async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, resolveTransactionsDeepLink: (...args) => ({ ...original.resolveTransactionsDeepLink(...args), ...deepLinkExtra }) };
});
vi.mock("../../features/transactions/useTransactionsFacetCounts.js", () => ({
  useTransactionsFacetCounts: () => ({ counts: null, isLoading: false, total: facetTotalMock, buckets: facetBucketsMock, optionCount: () => null, optionCountByLabel: () => null, binaryCount: () => null }),
}));
vi.mock("../../../api/balanceAdjustments", () => ({ listOrgBalanceAdjustments: vi.fn().mockResolvedValue([]) }));
const listAccountsMock = vi.fn();
vi.mock("../../../api/accounts", () => ({ listAccounts: (...args) => listAccountsMock(...args) }));
const listTransfersMock = vi.fn();
const exportMock = vi.fn();
vi.mock("../../../api/transactions", async (importOriginal) => ({
  ...(await importOriginal()),
  exportTransactions: (...args) => exportMock(...args),
}));
vi.mock("../../features/export/saveBlob.js", () => ({ saveBlob: vi.fn() }));
const listCreditCardsMock = vi.fn();
vi.mock("../../../api/creditCards", async (importOriginal) => ({
  ...(await importOriginal()),
  listCreditCards: (...args) => listCreditCardsMock(...args),
}));
const narrowestMock = vi.fn(() => ({ narrowest: null }));
vi.mock("../../features/transactions/useNarrowestFilter.js", () => ({
  useNarrowestFilter: (...args) => narrowestMock(...args),
}));
vi.mock("../../../api/transfers", () => ({ listTransfers: (...args) => listTransfersMock(...args) }));
let orgBaseCurrency = "BRL";
vi.mock("../../../api/organizations", () => ({
  getOrganization: vi.fn(() => Promise.resolve({ id: "org-test", base_currency: orgBaseCurrency })),
}));

import { TransacoesPage } from "../TransacoesPage.jsx";


beforeEach(() => {
  legacyOverride = null;
  tagRows = [];
  deepLinkExtra = {};
  facetTotalMock = null;
  facetBucketsMock = null;
  transactionsDataMock.mockImplementation(defaultTransactionsData);
  transactionsList = baseTransactions;
  routerSearch = {};
  orgBaseCurrency = "BRL";
  localStorage.clear();
  summaryMock = {
    total_transactions: 2, total_income: 0, total_expenses: 120, total_refunds: 0, balance: -120, currency: "BRL",
    unsettled_count: 1, consolidation: { target_currency: "BRL", rates: [], unavailable: null },
    result_by_currency: [{ currency: "BRL", total_transactions: 2, total_income: 0, total_expenses: 120, total_refunds: 0, balance: -120 }],
  };
  listAccountsMock.mockResolvedValue([]);
  listTransfersMock.mockResolvedValue([]);
  listCreditCardsMock.mockResolvedValue([]);
  exportMock.mockResolvedValue({ blob: new Blob(["x"]), fileName: "transacoes-2026-11-15.csv" });
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 900 });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderPage = (props = {}) =>
  render(
    <TransacoesPage onNav={vi.fn()} onNewTx={vi.fn()} onEditTx={vi.fn()} isMobile={false} dataMode="live"
      organizationId="org-test" transactionsRefreshToken={0} onTransactionsInvalidate={vi.fn()} {...props} />,
  );

async function exportCsv() {
  await userEvent.click(screen.getByRole("button", { name: "Exportar" }));
  const panel = await screen.findByRole("dialog", { name: "Exportar" });
  await userEvent.click(within(panel).getByRole("button", { name: "Exportar CSV" }));
  await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(1));
  return exportMock.mock.calls[0][0];
}

describe("<TransacoesPage> — Exportar (#521)", () => {
  it("o botão se chama Exportar (não CSV) e abre o painel com os três passos", async () => {
    renderPage();
    expect(screen.queryByRole("button", { name: /^CSV$/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Exportar" }));
    const panel = await screen.findByRole("dialog", { name: "Exportar" });
    for (const step of ["Lançamentos exportados", "Formato do arquivo", "Totais do relatório"]) {
      expect(within(panel).getByRole("heading", { name: step })).toBeInTheDocument();
    }
    expect(within(panel).getByText(/Sai o recorte inteiro/)).toHaveTextContent("2 lançamentos");
    expect(exportMock).not.toHaveBeenCalled();
  });

  it("o pedido leva todos os filtros da listagem, com o título, o prefixo e os filtros em texto", async () => {
    legacyOverride = FULL_SLICE;
    renderPage();
    const request = await exportCsv();

    expect(request).toMatchObject({
      organization_id: "org-test",
      format: "csv",
      title: "Transações",
      file_prefix: "transacoes",
      description: "padaria",
      type: "expense",
      category: ["Alimentação"],
      tag_id: ["aaaaaaaa-1111-4111-8111-111111111111"],
      tag_match: "all",
      payment_method: ["pix"],
      date_start: "2026-10-01",
      date_end: "2026-10-31",
      value_min: 10,
      value_max: 500,
      value_currency: "BRL",
      recurring: false,
      settled: false,
      account_id: ["aaaaaaaa-0000-4000-8000-000000000001"],
      credit_card_id: [5],
    });
    // O recorte inteiro, não uma página: nada de paginação nem ordenação no pedido.
    expect(request).not.toHaveProperty("page");
    expect(request).not.toHaveProperty("limit");
    expect(Array.isArray(request.filters_text)).toBe(true);
    expect(request.filters_text[0]).toMatch(/^Período: /);
  });

  it("o período sai nas datas do pedido, com ano — nunca o rótulo relativo do chip (QA BUG-04)", async () => {
    legacyOverride = FULL_SLICE; // datas 2026-10-01 a 2026-10-31 no pedido, enquanto o chip diz "Este mês"
    renderPage();
    const request = await exportCsv();
    expect(request.date_start).toBe("2026-10-01");
    expect(request.filters_text[0]).toBe("Período: 01/10/2026 a 31/10/2026");
    expect(request.filters_text.join(" | ")).not.toMatch(/Este mês|Mês anterior/);
  });

  it("sem filtro escolhido, o período padrão também sai em datas absolutas", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Exportar" }));
    const panel = await screen.findByRole("dialog", { name: "Exportar" });
    const chips = within(within(panel).getByRole("list", { name: "Filtros ativos" })).getAllByRole("listitem").map((li) => li.textContent);
    expect(chips[0]).toMatch(/^Período: \d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4}$/);
  });

  it.each([
    ["all", "Tags · Todas juntas (E): #Farmácia, #Combustível", { tag_match: "all" }],
    ["any", "Tags · Qualquer uma (OU): #Farmácia, #Combustível", {}],
  ])("etiquetas no modo %s: o texto diz o modo, no painel e no pedido (QA BUG-01)", async (mode, line, matchParam) => {
    tagRows = [{ id: "bbbbbbbb-1111-4111-8111-111111111111", name: "Farmácia" }, { id: "bbbbbbbb-2222-4222-8222-222222222222", name: "Combustível" }];
    deepLinkExtra = { tags: ["Farmácia", "Combustível"], tagMode: mode };
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Exportar" }));
    const panel = await screen.findByRole("dialog", { name: "Exportar" });
    const chips = within(within(panel).getByRole("list", { name: "Filtros ativos" })).getAllByRole("listitem").map((li) => li.textContent);
    expect(chips).toContain(line);
    expect(chips.filter((text) => text.startsWith("Tags"))).toEqual([line]);
    await userEvent.click(within(panel).getByRole("button", { name: "Exportar CSV" }));
    await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(1));
    const request = exportMock.mock.calls[0][0];
    expect(request.filters_text).toContain(line);
    expect(request.tag_id).toEqual(["bbbbbbbb-1111-4111-8111-111111111111", "bbbbbbbb-2222-4222-8222-222222222222"]);
    if (matchParam.tag_match) expect(request.tag_match).toBe("all");
    else expect(request).not.toHaveProperty("tag_match");
  });

  it("o arquivo é salvo com o nome que o servidor deu e o painel fecha", async () => {
    const { saveBlob } = await import("../../features/export/saveBlob.js");
    renderPage();
    await exportCsv();
    await waitFor(() => expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), "transacoes-2026-11-15.csv"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Exportar" })).toBeNull());
  });

  it("no celular, 'Exportar' do menu abre o mesmo painel", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 390 });
    renderPage({ isMobile: true });
    const menuButtons = screen.queryAllByRole("button", { name: /mais|opções|menu/i });
    for (const button of menuButtons) {
      if (screen.queryByRole("menuitem", { name: "Exportar" })) break;
      await userEvent.click(button);
    }
    await userEvent.click(await screen.findByRole("menuitem", { name: "Exportar" }));
    expect(await screen.findByRole("dialog", { name: "Exportar" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Exportar CSV/ })).toBeNull();
  });
});
