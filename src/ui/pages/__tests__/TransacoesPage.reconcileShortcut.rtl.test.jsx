/** @vitest-environment jsdom */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Atalho "Conciliar extrato" na tela de Transações (decisão do Owner de 2026-11-17, T1–T4): na
 * linha que conta as transações, só para o dono, sem quebrar a tela quando os pedidos falham.
 */

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
vi.mock("../../features/transactions/filters/useTransactionsTagCatalog.js", () => ({
  useTransactionsTagCatalog: () => ({ rows: [], loading: false, error: "" }),
}));
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
  exportTransactionsCsv: (...args) => exportMock(...args),
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

const listDraftsMock = vi.fn();
const getImportMock = vi.fn();
const listImportsMock = vi.fn();
vi.mock("../../../api/statementImports", async (importOriginal) => ({
  ...(await importOriginal()),
  listStatementImportDrafts: (...args) => listDraftsMock(...args),
  getStatementImport: (...args) => getImportMock(...args),
  listStatementImports: (...args) => listImportsMock(...args),
}));

import { TransacoesPage } from "../TransacoesPage.jsx";
import contract from "../../../api/__fixtures__/statement_import.example.json";
import { normalizeStatementImport } from "../../../api/statementImports";
import { passedStepsOf, stepProgress } from "../../features/statementImport/reconciliationSteps.js";

const ACC_A = "aaaaaaaa-0000-4000-8000-000000000001";
const ACC_B = "bbbbbbbb-0000-4000-8000-000000000002";
const ACC_EUR = "eeeeeeee-0000-4000-8000-000000000003";
const CARDS = [
  { id: 5, description: "Nubank Roxinho", brand: "Mastercard", last4: "1234", color: null },
  { id: 7, description: "Itaú Azul", brand: "Visa", last4: "9876", color: null },
];
const TWO_ACCOUNTS = [
  { id: ACC_A, name: "Conta A Itaú", currency: "BRL" },
  { id: ACC_B, name: "Conta B Nubank", currency: "BRL" },
];

beforeEach(() => {
  facetTotalMock = null;
  facetBucketsMock = null;
  // `mockImplementation` de um teste sobrevive ao `clearAllMocks`: volta ao padrão.
  transactionsDataMock.mockImplementation(defaultTransactionsData);
  transactionsList = baseTransactions;
  routerSearch = {};
  orgBaseCurrency = "BRL";
  localStorage.clear();
  summaryMock = { total_income: 0, total_expenses: 120, total_refunds: 0, balance: -120, currency: "BRL" };
  listAccountsMock.mockResolvedValue(TWO_ACCOUNTS);
  listTransfersMock.mockResolvedValue([]);
  listCreditCardsMock.mockResolvedValue(CARDS);
  listDraftsMock.mockResolvedValue([]);
  getImportMock.mockImplementation(() => new Promise(() => {}));
  listImportsMock.mockResolvedValue([]);
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 900 });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderPage = (props = {}) => {
  const onReconcileStatement = vi.fn();
  render(
    <TransacoesPage onNav={vi.fn()} onNewTx={vi.fn()} onEditTx={vi.fn()} isMobile={false} dataMode="live"
      organizationId="org-test" transactionsRefreshToken={0} onTransactionsInvalidate={vi.fn()}
      onReconcileStatement={onReconcileStatement} {...props} />,
  );
  return onReconcileStatement;
};

const header = () => screen.getByTestId("transactions-list-header");

describe("<TransacoesPage> — atalho Conciliar extrato", () => {
  it("UMA conta filtrada: 'Conciliar extrato da <conta>' na linha do chip do filtro, e vai direto", async () => {
    routerSearch = { fc_account: ACC_B };
    const onReconcile = renderPage();
    const chips = await screen.findByTestId("account-filter-chips");
    const btn = await within(chips).findByRole("button", { name: "Conciliar extrato da Conta B Nubank" });
    await userEvent.click(btn);
    expect(onReconcile).toHaveBeenCalledWith(ACC_B, null);
    expect(listDraftsMock).toHaveBeenCalledWith("org-test");
  });

  it("várias contas sem filtro: 'Conciliar extrato…' na linha da contagem, antes da soma, e abre a escolha", async () => {
    const onReconcile = renderPage();
    const btn = await screen.findByRole("button", { name: "Conciliar extrato…" });
    const row = header();
    expect(row).toContainElement(btn);
    // Antes da soma, à direita da contagem.
    const soma = within(row).getByText("soma");
    expect(btn.compareDocumentPosition(soma) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.click(btn);
    const menu = await screen.findByRole("menu", { name: "Conciliar o extrato de qual conta?" });
    // Só contas: os cartões da organização não aparecem.
    expect(within(menu).getAllByRole("menuitem").map((i) => i.querySelector("b").textContent)).toEqual(["Conta A Itaú", "Conta B Nubank"]);
    expect(menu).not.toHaveTextContent("Nubank Roxinho");
    expect(menu).not.toHaveTextContent("Itaú Azul");
    await userEvent.click(within(menu).getByRole("menuitem", { name: /Conta A Itaú/ }));
    expect(onReconcile).toHaveBeenCalledWith(ACC_A, null);
  });

  it("organização com UMA conta ativa (e uma desativada): vai direto para a ativa, sem filtro", async () => {
    listAccountsMock.mockResolvedValue([
      { id: ACC_A, name: "Conta A Itaú", currency: "BRL", is_active: true },
      { id: ACC_B, name: "Conta B Nubank", currency: "BRL", is_active: false },
    ]);
    const onReconcile = renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Conciliar extrato da Conta A Itaú" }));
    expect(onReconcile).toHaveBeenCalledWith(ACC_A, null);
  });

  it("sem conta elegível: sem botão", async () => {
    listAccountsMock.mockResolvedValue([{ id: ACC_A, name: "Conta A Itaú", currency: "BRL", is_active: false }]);
    renderPage();
    await screen.findAllByText("Mercado");
    await waitFor(() => expect(listAccountsMock).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /Conciliar extrato|Continuar conciliação/ })).toBeNull();
    expect(listDraftsMock).not.toHaveBeenCalled();
  });

  it("quem não é dono (sem onReconcileStatement): sem botão e sem pedir rascunhos", async () => {
    renderPage({ onReconcileStatement: null });
    await screen.findAllByText("Mercado");
    await waitFor(() => expect(listAccountsMock).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /Conciliar extrato|Continuar conciliação/ })).toBeNull();
    expect(listDraftsMock).not.toHaveBeenCalled();
  });

  it("erro na lista de rascunhos: texto básico, e a lista de transações segue intacta", async () => {
    listDraftsMock.mockRejectedValue(new Error("500"));
    routerSearch = { fc_account: ACC_A };
    renderPage();
    await waitFor(() => expect(listDraftsMock).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: "Conciliar extrato da Conta A Itaú" })).toBeInTheDocument();
    expect(screen.getAllByText("Mercado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Padaria").length).toBeGreaterThan(0);
  });

  it("rascunho na conta filtrada: 'Continuar conciliação' leva ao rascunho", async () => {
    listDraftsMock.mockResolvedValue([{ id: "d-1", account_id: ACC_A, status: "draft", last_activity_at: "2026-11-14T10:00:00" }]);
    routerSearch = { fc_account: ACC_A };
    const onReconcile = renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /Continuar conciliação/ }));
    expect(onReconcile).toHaveBeenCalledWith(ACC_A, "d-1");
  });

  it("computador com uma conta filtrada: o chip da conta continua", async () => {
    routerSearch = { fc_account: ACC_A };
    renderPage();
    const chips = await screen.findByTestId("account-filter-chips");
    expect(chips).toHaveTextContent("Conta A Itaú");
  });

  it("G3 achado 1: filtrar por uma conta e tirar o filtro não pede os rascunhos de novo, e o número já está lá", async () => {
    listDraftsMock.mockResolvedValue([{ id: "d-1", account_id: ACC_A, status: "draft", last_activity_at: "2026-11-14T10:00:00" }]);
    getImportMock.mockResolvedValue({ ...normalizeStatementImport(contract.draft), id: "d-1", account_id: ACC_A, reviewed_steps: ["suggested", "doubt"] });
    routerSearch = { fc_account: ACC_A };
    renderPage();
    const chips = await screen.findByTestId("account-filter-chips");
    await waitFor(() => expect(within(chips).getByRole("button", { name: /Continuar conciliação/ })).toHaveTextContent(/de 8 passos/));
    const steps = within(chips).getByRole("button", { name: /Continuar conciliação/ }).textContent.replace("Continuar conciliação", "");

    // Tira o filtro: o atalho vai para a linha da contagem (menu, duas contas).
    await userEvent.click(screen.getByRole("button", { name: "Remover filtro de conta Conta A Itaú" }));
    const btn = within(header()).getByRole("button", { name: "Conciliar extrato…" });
    await userEvent.click(btn);
    const items = within(await screen.findByRole("menu")).getAllByRole("menuitem");
    // Sem esperar: o progresso da Corrente já veio quando ela estava filtrada.
    expect(items[0]).toHaveTextContent(`Conciliação começada · ${steps}`);
    expect(listDraftsMock).toHaveBeenCalledTimes(1);
    expect(getImportMock).toHaveBeenCalledTimes(1);
  });

  it("G3 achado 2: sem filtro e com várias contas, nenhum detalhe de rascunho é pedido até abrir o menu", async () => {
    listDraftsMock.mockResolvedValue([
      { id: "d-a", account_id: ACC_A, status: "draft", last_activity_at: "2026-11-14T10:00:00" },
      { id: "d-b", account_id: ACC_B, status: "draft", last_activity_at: "2026-11-14T10:00:00" },
    ]);
    renderPage();
    const btn = await screen.findByRole("button", { name: "Conciliar extrato…" });
    await waitFor(() => expect(listDraftsMock).toHaveBeenCalledTimes(1));
    await act(async () => { await Promise.resolve(); });
    expect(getImportMock).not.toHaveBeenCalled();
    await userEvent.click(btn);
    await screen.findByRole("menu");
    await waitFor(() => expect(getImportMock).toHaveBeenCalledTimes(2));
  });
});

/* ── Celular (decisão do Owner de 2026-11-22: M1b, M2, M3; ajustes do mesmo dia: "Continuar
   conciliações" com o número num selo, e a seta › no fim dos dois chips). No computador nada muda (os testes acima). ── */
const draftItem = (accountId, id, lastActivity = "2026-11-14T10:00:00") => ({ id, account_id: accountId, status: "draft", last_activity_at: lastActivity });
const detailOf = (accountId, id, reviewed) => ({ ...normalizeStatementImport(contract.draft), id, account_id: accountId, reviewed_steps: reviewed });
const REVIEWED = { "d-a": ["suggested", "doubt"], "d-b": ["suggested", "doubt", "invoice", "yield"] };
const nOf = (id) => {
  const d = detailOf("x", id, REVIEWED[id]);
  return stepProgress(d, passedStepsOf(d)).done;
};
const resolveDetails = () => getImportMock.mockImplementation((accountId, _org, id) => Promise.resolve(detailOf(accountId, id, REVIEWED[id])));
const mobileChipRow = () => screen.queryByTestId("reconcile-mobile-chip-row");
const openListOptions = async () => {
  await userEvent.click(await screen.findByRole("button", { name: "Opções da lista" }));
  return screen.getByRole("menu");
};

describe("<TransacoesPage> — atalho Conciliar extrato no CELULAR", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 844 });
  });
  const renderMobile = (props = {}) => renderPage({ isMobile: true, ...props });

  it("M1b, conta filtrada com rascunho: chip 'Continuar conciliação' + 'N de 8 passos' (o N do stepProgress) entre a busca e a lista, fora do quadro; toque abre o rascunho", async () => {
    expect(nOf("d-a")).toBe(2);
    listDraftsMock.mockResolvedValue([draftItem(ACC_A, "d-a"), draftItem(ACC_B, "d-b")]);
    resolveDetails();
    routerSearch = { fc_account: ACC_A };
    const onReconcile = renderMobile();
    const chip = await screen.findByRole("button", { name: `Continuar conciliação da Conta A Itaú, ${nOf("d-a")} de 8 passos` });
    expect(chip).toHaveTextContent(`Continuar conciliação${nOf("d-a")} de 8 passos`);
    // O anel mostra a mesma fração.
    expect(chip.querySelector("[data-testid='reconcile-progress-ring']")).toHaveAttribute("data-progress", `${nOf("d-a")}/8`);
    // Linha própria, fora do cabeçalho/quadro da lista, depois da busca e antes da lista.
    const row = mobileChipRow();
    expect(row).toContainElement(chip);
    expect(header()).not.toContainElement(chip);
    const search = screen.getByPlaceholderText("Buscar por descrição, categoria ou tag…");
    expect(search.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(row.compareDocumentPosition(header()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(row.contains(header())).toBe(false);
    // A linha antiga acima da contagem saiu.
    expect(screen.queryByTestId("reconcile-shortcut-row")).toBeNull();
    // Só o detalhe da conta de destino.
    expect(getImportMock).toHaveBeenCalledTimes(1);
    expect(getImportMock).toHaveBeenCalledWith(ACC_A, "org-test", "d-a");
    await userEvent.click(chip);
    expect(onReconcile).toHaveBeenCalledWith(ACC_A, "d-a");
  });

  it("M1b, antes de o N chegar: o chip aparece sem o selo (nunca um 0 inventado)", async () => {
    listDraftsMock.mockResolvedValue([draftItem(ACC_A, "d-a")]);
    routerSearch = { fc_account: ACC_A };
    renderMobile();
    const chip = await screen.findByRole("button", { name: "Continuar conciliação da Conta A Itaú" });
    expect(chip).toHaveTextContent(/^Continuar conciliação$/);
    expect(chip.querySelector("[data-testid='reconcile-progress-ring']")).toBeNull();
  });

  it("M1b, organização com UMA conta elegível e rascunho: chip sem filtro", async () => {
    listAccountsMock.mockResolvedValue([{ id: ACC_A, name: "Conta A Itaú", currency: "BRL" }]);
    listDraftsMock.mockResolvedValue([draftItem(ACC_A, "d-a")]);
    resolveDetails();
    const onReconcile = renderMobile();
    await userEvent.click(await screen.findByRole("button", { name: `Continuar conciliação da Conta A Itaú, ${nOf("d-a")} de 8 passos` }));
    expect(onReconcile).toHaveBeenCalledWith(ACC_A, "d-a");
  });

  it("M1b, sem filtro, várias contas e exatamente UM rascunho: o chip leva a ele", async () => {
    listDraftsMock.mockResolvedValue([draftItem(ACC_B, "d-b")]);
    resolveDetails();
    const onReconcile = renderMobile();
    const chip = await screen.findByRole("button", { name: `Continuar conciliação da Conta B Nubank, ${nOf("d-b")} de 8 passos` });
    expect(getImportMock).toHaveBeenCalledTimes(1);
    await userEvent.click(chip);
    expect(onReconcile).toHaveBeenCalledWith(ACC_B, "d-b");
  });

  it("M3, dois rascunhos: chip 'Continuar conciliações' + selo '2' abre a folha; detalhes só ao abrir; Continuar leva ao rascunho da linha", async () => {
    listDraftsMock.mockResolvedValue([draftItem(ACC_A, "d-a"), draftItem(ACC_B, "d-b")]);
    resolveDetails();
    const onReconcile = renderMobile();
    const chip = await screen.findByRole("button", { name: "Continuar 2 conciliações começadas" });
    expect(chip).toHaveTextContent(/^Continuar conciliações2$/);
    expect(within(chip).getByText("2")).toHaveAttribute("data-testid", "reconcile-chip-badge");
    expect(chip).toHaveAttribute("aria-haspopup", "dialog");
    expect(mobileChipRow()).toContainElement(chip);
    await act(async () => { await Promise.resolve(); });
    expect(getImportMock).not.toHaveBeenCalled();

    await userEvent.click(chip);
    const sheet = await screen.findByRole("dialog", { name: "Conciliações começadas" });
    expect(sheet).toHaveTextContent("Continue de onde parou em cada conta.");
    await waitFor(() => expect(getImportMock).toHaveBeenCalledTimes(2));
    const rows = within(sheet).getAllByRole("button", { name: /^Continuar a conciliação da / });
    expect(rows.map((r) => r.getAttribute("aria-label"))).toEqual([
      "Continuar a conciliação da Conta A Itaú",
      "Continuar a conciliação da Conta B Nubank",
    ]);
    await waitFor(() => expect(rows[0]).toHaveTextContent(`Conta A Itaú${nOf("d-a")} de 8 passos conferidosContinuar`));
    expect(rows[1]).toHaveTextContent(`Conta B Nubank${nOf("d-b")} de 8 passos conferidosContinuar`);
    await userEvent.click(rows[1]);
    expect(onReconcile).toHaveBeenCalledWith(ACC_B, "d-b");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("M3, 'Conciliar outra conta…' abre a escolha da conta na própria folha (sem cartões)", async () => {
    listAccountsMock.mockResolvedValue([...TWO_ACCOUNTS, { id: ACC_EUR, name: "Conta Euro", currency: "EUR" }]);
    listDraftsMock.mockResolvedValue([draftItem(ACC_A, "d-a"), draftItem(ACC_B, "d-b")]);
    resolveDetails();
    const onReconcile = renderMobile();
    await userEvent.click(await screen.findByRole("button", { name: "Continuar 2 conciliações começadas" }));
    const sheet = await screen.findByRole("dialog", { name: "Conciliações começadas" });
    await userEvent.click(within(sheet).getByRole("button", { name: "Conciliar outra conta…" }));
    const choice = await screen.findByRole("dialog", { name: "Conciliar o extrato de qual conta?" });
    expect(choice).not.toHaveTextContent("Nubank Roxinho");
    expect(choice).toHaveTextContent("Cartões de crédito não aparecem");
    await userEvent.click(within(choice).getByRole("button", { name: /Conta Euro/ }));
    expect(onReconcile).toHaveBeenCalledWith(ACC_EUR, null);
  });

  it("M3, folha acessível: foco entra, Tab fica dentro, Esc fecha e o foco volta ao chip", async () => {
    listDraftsMock.mockResolvedValue([draftItem(ACC_A, "d-a"), draftItem(ACC_B, "d-b")]);
    resolveDetails();
    renderMobile();
    const chip = await screen.findByRole("button", { name: "Continuar 2 conciliações começadas" });
    await userEvent.click(chip);
    const sheet = await screen.findByRole("dialog", { name: "Conciliações começadas" });
    expect(sheet).toHaveAttribute("aria-modal", "true");
    await waitFor(() => expect(sheet).toContainElement(document.activeElement));
    for (let i = 0; i < 6; i += 1) {
      await userEvent.tab();
      expect(sheet).toContainElement(document.activeElement);
    }
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(chip);
  });

  it("M3, tocar fora fecha a folha", async () => {
    listDraftsMock.mockResolvedValue([draftItem(ACC_A, "d-a"), draftItem(ACC_B, "d-b")]);
    renderMobile();
    await userEvent.click(await screen.findByRole("button", { name: "Continuar 2 conciliações começadas" }));
    await screen.findByRole("dialog", { name: "Conciliações começadas" });
    await userEvent.click(screen.getByTestId("reconcile-sheet-backdrop"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("M2, nada começado e várias contas: sem chip; 'Conciliar extrato…' é o ÚLTIMO item do ⋯ (depois de Exportar CSV) e abre a escolha", async () => {
    const onReconcile = renderMobile();
    await waitFor(() => expect(listDraftsMock).toHaveBeenCalled());
    await screen.findAllByText("Mercado");
    expect(mobileChipRow()).toBeNull();
    expect(screen.queryByRole("button", { name: /Continuar/ })).toBeNull();
    const menu = await openListOptions();
    const items = [...menu.querySelectorAll("[role^='menuitem']")];
    expect(items.map((i) => i.textContent.trim())).toEqual(["▦ Agrupar por data", "Exportar CSV", "Conciliar extrato…"]);
    // Separador entre Exportar CSV e o atalho.
    expect(items.at(-1).previousElementSibling).toHaveAttribute("role", "separator");
    await userEvent.click(items.at(-1));
    expect(screen.queryByRole("menu")).toBeNull();
    const choice = await screen.findByRole("dialog", { name: "Conciliar o extrato de qual conta?" });
    await userEvent.click(within(choice).getByRole("button", { name: /Conta B Nubank/ }));
    expect(onReconcile).toHaveBeenCalledWith(ACC_B, null);
  });

  it("M2, conta filtrada sem rascunho: o item do ⋯ vai direto, sem escolha", async () => {
    routerSearch = { fc_account: ACC_B };
    const onReconcile = renderMobile();
    await waitFor(() => expect(listDraftsMock).toHaveBeenCalled());
    const menu = await openListOptions();
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Conciliar extrato…" }));
    expect(onReconcile).toHaveBeenCalledWith(ACC_B, null);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("conta filtrada sem rascunho e UMA outra com: sem chip; o ⋯ vai direto à filtrada", async () => {
    listDraftsMock.mockResolvedValue([draftItem(ACC_A, "d-a")]);
    routerSearch = { fc_account: ACC_B };
    const onReconcile = renderMobile();
    await waitFor(() => expect(listDraftsMock).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(mobileChipRow()).toBeNull();
    const menu = await openListOptions();
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Conciliar extrato…" }));
    expect(onReconcile).toHaveBeenCalledWith(ACC_B, null);
  });

  it("quem não é dono: sem chip, sem item no ⋯ e sem pedir rascunhos", async () => {
    renderMobile({ onReconcileStatement: null });
    await screen.findAllByText("Mercado");
    await waitFor(() => expect(listAccountsMock).toHaveBeenCalled());
    const menu = await openListOptions();
    expect(within(menu).queryByRole("menuitem", { name: "Conciliar extrato…" })).toBeNull();
    expect(mobileChipRow()).toBeNull();
    expect(listDraftsMock).not.toHaveBeenCalled();
  });

  it("sem conta elegível: sem chip e sem item no ⋯", async () => {
    listAccountsMock.mockResolvedValue([{ id: ACC_A, name: "Conta A Itaú", currency: "BRL", is_active: false }]);
    renderMobile();
    await waitFor(() => expect(listAccountsMock).toHaveBeenCalled());
    await screen.findAllByText("Mercado");
    const menu = await openListOptions();
    expect(within(menu).queryByRole("menuitem", { name: "Conciliar extrato…" })).toBeNull();
    expect(mobileChipRow()).toBeNull();
  });

  it("erro na lista de rascunhos: sem chip, o item do ⋯ continua e a lista segue intacta", async () => {
    listDraftsMock.mockRejectedValue(new Error("500"));
    const onReconcile = renderMobile();
    await waitFor(() => expect(listDraftsMock).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(mobileChipRow()).toBeNull();
    expect(screen.getAllByText("Mercado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Padaria").length).toBeGreaterThan(0);
    const menu = await openListOptions();
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Conciliar extrato…" }));
    const choice = await screen.findByRole("dialog", { name: "Conciliar o extrato de qual conta?" });
    await userEvent.click(within(choice).getByRole("button", { name: /Conta A Itaú/ }));
    expect(onReconcile).toHaveBeenCalledWith(ACC_A, null);
  });
});
