/** @vitest-environment jsdom */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * fincla-api#531 — "Exportar seleção" nas Transações: a barra dos marcados abre o painel compartilhado no modo
 * seleção, como em Lançamentos do cartão (#524). O pedido do arquivo e o do resumo levam EXATAMENTE os ids marcados.
 *
 * A camada de API (`exportTransactions`, `getTransactionsSummary`) é que é simulada; a página, a barra, o painel e o
 * hook do resumo da seleção são reais — se a página não passar os ids, os pedidos saem sem eles e o teste falha.
 */
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
  useRouterState: (opts) =>
    typeof opts?.select === "function"
      ? opts.select({ location: { pathname: "/transactions", search: {} } })
      : { location: { pathname: "/transactions", search: {} } },
}));

let rows;
const transactionsDataMock = vi.fn(() => ({
  isLoading: false, error: "", hasLoaded: true,
  summary: {
    total_transactions: rows.length, total_income: 0, total_expenses: 999, total_refunds: 0, balance: -999, currency: "BRL",
    unsettled_count: 0, consolidation: { target_currency: "BRL", rates: [], unavailable: null },
    result_by_currency: [{ currency: "BRL", total_transactions: rows.length, total_income: 0, total_expenses: 999, total_refunds: 0, balance: -999 }],
  },
  transactions: rows, total: rows.length, hasMore: false, removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
}));
vi.mock("../../features/transactions/useTransactionsData.js", () => ({
  useTransactionsData: (...args) => transactionsDataMock(...args),
}));
vi.mock("../../features/tags/useCategoryTagsData.js", () => ({
  useCategoryTagsData: () => ({ isLoading: false, categories: [{ id: "cat-alim", labelPt: "Alimentação", color: "#059669" }] }),
}));
vi.mock("../../features/transactions/filters/useTransactionsTagCatalog.js", () => ({
  useTransactionsTagCatalog: () => ({ rows: [], loading: false, error: "" }),
}));
vi.mock("../../features/transactions/useTransactionsFacetCounts.js", () => ({
  useTransactionsFacetCounts: () => ({ counts: null, isLoading: false, total: null, buckets: null, optionCount: () => null, optionCountByLabel: () => null, binaryCount: () => null }),
}));
vi.mock("../../../api/balanceAdjustments", () => ({ listOrgBalanceAdjustments: vi.fn().mockResolvedValue([]) }));
vi.mock("../../../api/transfers", () => ({ listTransfers: vi.fn().mockResolvedValue([]) }));
vi.mock("../../../api/organizations", () => ({
  getOrganization: vi.fn(() => Promise.resolve({ id: "org-test", base_currency: "BRL" })),
}));
const ACC_A = "aaaaaaaa-0000-4000-8000-000000000001";
const ACC_B = "bbbbbbbb-0000-4000-8000-000000000002";
const TWO_ACCOUNTS = [
  { id: ACC_A, name: "Conta A", currency: "BRL" },
  { id: ACC_B, name: "Conta B", currency: "BRL" },
];
let accounts;
const listAccountsMock = vi.fn(() => Promise.resolve(accounts));
vi.mock("../../../api/accounts", () => ({ listAccounts: (...args) => listAccountsMock(...args) }));
const exportMock = vi.fn();
const summaryMock = vi.fn();
vi.mock("../../../api/transactions", async (importOriginal) => ({
  ...(await importOriginal()),
  exportTransactions: (...args) => exportMock(...args),
  getTransactionsSummary: (...args) => summaryMock(...args),
}));
vi.mock("../../features/export/saveBlob.js", () => ({ saveBlob: vi.fn() }));
/* G3-P-03: a seleção e a exportação são da PÁGINA (a caixa de cada linha mora
   no invólucro da página), não da linha. Uma linha mínima no lugar do `TxRow`
   completo deixa os testes de 500/501 linhas em ~1 s em vez de ~15 s. */
vi.mock("../../features/transactions/shared/TransactionRow.jsx", async (importOriginal) => ({
  ...(await importOriginal()),
  TxRow: ({ tx }) => <div data-testid="tx-row-stub">{tx.desc}</div>,
}));

import { TransacoesPage } from "../TransacoesPage.jsx";

const row = (id, desc, val, accountId = ACC_A) => ({
  id, desc, cat: "Alimentação", categoryTagId: "cat-alim", val, method: "Pix", paymentMethodKey: "pix", type: val > 0 ? "income" : "expense",
  icon: "🍽", status: "confirmado", rec: false, tags: [], detailTagIds: [], date: "10/11/2026", dateIsoForEdit: "2026-11-10",
  settled: true, settleable: true, accountId, currency: "BRL", seriesId: null,
});

/** O resumo dos marcados: um valor que nenhuma soma do recorte inteiro (999) dá. */
const selectionSummary = (n) => ({
  total_transactions: n, total_income: 0, total_expenses: 327.15, total_refunds: 0, balance: -327.15, currency: "BRL",
  unsettled_count: 0, consolidation: { target_currency: "BRL", rates: [], unavailable: null },
  result_by_currency: [{ currency: "BRL", total_transactions: n, total_income: 0, total_expenses: 327.15, total_refunds: 0, balance: -327.15 }],
});

beforeEach(() => {
  localStorage.clear();
  accounts = TWO_ACCOUNTS;
  rows = [row(101, "Jantar", -287.15), row(102, "Mercado", -40), row(103, "Padaria", -40, ACC_B)];
  summaryMock.mockImplementation((query) => Promise.resolve(query?.ids ? selectionSummary(query.ids.length) : selectionSummary(0)));
  exportMock.mockResolvedValue({ blob: new Blob(["x"]), fileName: "transacoes-2026-11-16.pdf" });
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

async function selectRows(user, ...descs) {
  for (const d of descs) await user.click(await screen.findByRole("checkbox", { name: `Selecionar ${d}` }));
}
async function openSelectionExport(user) {
  await user.click(within(screen.getByTestId("bulk-selection-bar")).getByRole("button", { name: "Exportar seleção" }));
  return screen.findByRole("dialog", { name: "Exportar seleção" });
}
/* A caixa "selecionar todos" por seletor, não por papel: com 500 linhas
   na tela, `findByRole`/`findByLabelText` recalculam o nome acessível de cada
   caixa e custavam ~9 s sozinhos (medido no G3-P-03). */
function selectAllLoadedBox() {
  return waitFor(() => {
    const box = document.querySelector('input[type="checkbox"][aria-label="Selecionar lançamentos carregados"]');
    expect(box).not.toBeNull();
    return box;
  });
}
const selectionSummaryCalls = () => summaryMock.mock.calls.map(([query]) => query).filter((query) => query?.ids);

describe("<TransacoesPage> — Exportar seleção (#531)", () => {
  it("com UMA conta: caixas nas linhas e a barra só com 'Exportar seleção' (mover precisa de outra conta)", async () => {
    accounts = [TWO_ACCOUNTS[0]];
    rows = [row(101, "Jantar", -287.15), row(102, "Mercado", -40)];
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(listAccountsMock).toHaveBeenCalled());
    await selectRows(user, "Mercado");
    const bar = screen.getByTestId("bulk-selection-bar");
    expect(within(bar).getByRole("button", { name: "Exportar seleção" })).toBeInTheDocument();
    expect(within(bar).queryByRole("button", { name: "Mover para conta…" })).toBeNull();
    const panel = await openSelectionExport(user);
    expect(within(panel).getByRole("region", { name: "Lançamentos exportados" })).toHaveTextContent("1 lançamento selecionado");
    await within(panel).findByTestId("export-totals");
    await user.click(within(panel).getByRole("button", { name: "Exportar PDF" }));
    await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(1));
    expect(exportMock.mock.calls[0][0].ids).toEqual(["102"]);
  });

  it("com 2 contas: a barra tem os dois botões", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectRows(user, "Mercado");
    const bar = screen.getByTestId("bulk-selection-bar");
    expect(await within(bar).findByRole("button", { name: "Mover para conta…" })).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: "Exportar seleção" })).toBeInTheDocument();
  });

  it("a barra dos marcados abre o painel no modo seleção; resumo e arquivo pedem EXATAMENTE os ids marcados", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectRows(user, "Jantar", "Padaria");
    const panel = await openSelectionExport(user);

    expect(within(panel).getByRole("region", { name: "Lançamentos exportados" })).toHaveTextContent("2 lançamentos selecionados");
    expect(within(panel).queryByRole("list", { name: "Filtros ativos" })).not.toBeInTheDocument();
    // Totais pelo resumo do servidor com os ids (não o resumo do recorte da tela, 999).
    const totals = await within(panel).findByTestId("export-totals");
    expect(totals).toHaveTextContent(/327,15/);
    expect(totals).not.toHaveTextContent(/999/);
    expect(selectionSummaryCalls()).toEqual([{ organization_id: "org-test", ids: ["101", "103"], slice_currency: true, locale: "pt-BR" }]);

    await user.click(within(panel).getByRole("button", { name: "Exportar PDF" }));
    await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(1));
    const request = exportMock.mock.calls[0][0];
    expect(request.ids).toEqual(["101", "103"]);
    expect(request).toMatchObject({ organization_id: "org-test", format: "pdf", title: "Transações", file_prefix: "transacoes", filters_text: [] });
    // A seleção substitui o recorte: nenhum filtro da tela vai junto.
    expect(request).not.toHaveProperty("date_start");
    expect(request).not.toHaveProperty("date_end");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Exportar seleção" })).toBeNull());
  });

  it("um marcado: '1 lançamento selecionado' (singular), e o pedido leva só ele", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectRows(user, "Mercado");
    const panel = await openSelectionExport(user);
    expect(within(panel).getByRole("region", { name: "Lançamentos exportados" })).toHaveTextContent("1 lançamento selecionado");
    expect(within(panel).getByRole("region", { name: "Lançamentos exportados" })).not.toHaveTextContent("lançamentos selecionados");
    await within(panel).findByTestId("export-totals");
    expect(selectionSummaryCalls().map((query) => query.ids)).toEqual([["102"]]);
    await user.click(within(panel).getByRole("button", { name: "Exportar PDF" }));
    await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(1));
    expect(exportMock.mock.calls[0][0].ids).toEqual(["102"]);
  });

  it("'selecionar todos' marca tudo o que foi carregado; acima de 500 avisa e não deixa exportar", async () => {
    rows = Array.from({ length: 501 }, (_, i) => row(1000 + i, `Compra ${i}`, -1));
    const user = userEvent.setup();
    renderPage();
    await user.click(await selectAllLoadedBox());
    const panel = await openSelectionExport(user);
    expect(within(panel).getByRole("region", { name: "Lançamentos exportados" })).toHaveTextContent("501 lançamentos selecionados");
    expect(within(panel).getByText(/A seleção tem 501 lançamentos e o máximo é 500/)).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Exportar PDF" })).toBeDisabled();
    // Acima do limite nem o resumo é pedido (a URL passaria do que o servidor aceita).
    expect(selectionSummaryCalls()).toEqual([]);
    expect(exportMock).not.toHaveBeenCalled();
  });

  it("exatamente 500 carregados: 'selecionar todos' exporta os 500 ids", async () => {
    rows = Array.from({ length: 500 }, (_, i) => row(1000 + i, `Compra ${i}`, -1));
    const user = userEvent.setup();
    renderPage();
    await user.click(await selectAllLoadedBox());
    const panel = await openSelectionExport(user);
    expect(within(panel).queryByText(/o máximo é 500/)).toBeNull();
    await within(panel).findByTestId("export-totals");
    const expected = rows.map((r) => String(r.id));
    expect(selectionSummaryCalls().map((query) => query.ids)).toEqual([expected]);
    await user.click(within(panel).getByRole("button", { name: "Exportar PDF" }));
    await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(1));
    expect(exportMock.mock.calls[0][0].ids).toEqual(expected);
  });

  it("o 'Exportar' do recorte inteiro continua igual com linhas marcadas: sem ids, com os filtros da tela", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectRows(user, "Jantar");
    await user.click(screen.getByRole("button", { name: "Exportar" }));
    const panel = await screen.findByRole("dialog", { name: "Exportar" });
    expect(within(panel).getByRole("list", { name: "Filtros ativos" })).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "Exportar PDF" }));
    await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(1));
    const request = exportMock.mock.calls[0][0];
    expect(request).not.toHaveProperty("ids");
    expect(request.date_start).toEqual(expect.any(String));
    expect(selectionSummaryCalls()).toEqual([]);
  });

  it("o painel guarda o que estava marcado ao abrir, mesmo que a seleção da tela mude por baixo", async () => {
    const user = userEvent.setup();
    const { rerender } = renderPage();
    await selectRows(user, "Jantar");
    const panel = await openSelectionExport(user);
    // Uma releitura da lista limpa a seleção da tela; o painel continua com o que foi marcado.
    rerender(
      <TransacoesPage onNav={vi.fn()} onNewTx={vi.fn()} onEditTx={vi.fn()} isMobile={false} dataMode="live"
        organizationId="org-test" transactionsRefreshToken={1} onTransactionsInvalidate={vi.fn()} />,
    );
    await waitFor(() => expect(screen.queryByTestId("bulk-selection-bar")).toBeNull());
    expect(within(panel).getByRole("region", { name: "Lançamentos exportados" })).toHaveTextContent("1 lançamento selecionado");
    await within(panel).findByTestId("export-totals");
    await user.click(within(panel).getByRole("button", { name: "Exportar PDF" }));
    await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(1));
    expect(exportMock.mock.calls[0][0].ids).toEqual(["101"]);
  });

  it("no celular a barra dos marcados também tem 'Exportar seleção', e abre o mesmo painel", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 390 });
    const user = userEvent.setup();
    renderPage({ isMobile: true });
    await selectRows(user, "Mercado", "Padaria");
    const panel = await openSelectionExport(user);
    expect(within(panel).getByRole("region", { name: "Lançamentos exportados" })).toHaveTextContent("2 lançamentos selecionados");
    await within(panel).findByTestId("export-totals");
    expect(selectionSummaryCalls().map((query) => query.ids)).toEqual([["102", "103"]]);
    await user.click(within(panel).getByRole("button", { name: "Exportar PDF" }));
    await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(1));
    expect(exportMock.mock.calls[0][0].ids).toEqual(["102", "103"]);
  });
});
