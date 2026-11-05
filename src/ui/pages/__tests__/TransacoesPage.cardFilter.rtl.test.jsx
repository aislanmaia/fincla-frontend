/** @vitest-environment jsdom */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * #280 (revisão do #293) — filtro Cartão pelo hook de dados DE VERDADE: só
 * `api/transactions` é mockado, então cada consulta conta como uma requisição.
 */

let routerSearch = {};
/** Total do período sem os outros filtros (o "de N" do cabeçalho). */
let facetTotalMock = null;
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
/* Referências ESTÁVEIS entre renders, como os hooks de verdade: com o hook de dados
   real, um array novo por render vira consulta nova a cada render — um laço. */
const STABLE = vi.hoisted(() => ({
  categories: { isLoading: false, categories: [{ id: "cat-alim", labelPt: "Alimentação", color: "#059669" }] },
  tags: { rows: [], loading: false, error: "" },
  facets: { counts: null, isLoading: false, total: null, buckets: null, optionCount: () => null, optionCountByLabel: () => null, binaryCount: () => null },
  narrowest: { narrowest: null },
}));
vi.mock("../../features/tags/useCategoryTagsData.js", () => ({
  useCategoryTagsData: () => STABLE.categories,
}));
vi.mock("../../features/transactions/filters/useTransactionsTagCatalog.js", () => ({
  useTransactionsTagCatalog: () => STABLE.tags,
}));
vi.mock("../../features/transactions/useTransactionsFacetCounts.js", () => ({
  useTransactionsFacetCounts: () => STABLE.facets,
}));
vi.mock("../../../api/balanceAdjustments", () => ({ listOrgBalanceAdjustments: vi.fn().mockResolvedValue([]) }));
const listAccountsMock = vi.fn();
vi.mock("../../../api/accounts", () => ({ listAccounts: (...args) => listAccountsMock(...args) }));
const listTransfersMock = vi.fn();
const exportMock = vi.fn();
const listTransactionsMock = vi.fn();
const summaryApiMock = vi.fn();
vi.mock("../../../api/transactions", async (importOriginal) => ({
  ...(await importOriginal()),
  listTransactions: (...args) => listTransactionsMock(...args),
  getTransactionsSummary: (...args) => summaryApiMock(...args),
  exportTransactionsCsv: (...args) => exportMock(...args),
}));
vi.mock("../../features/export/saveBlob.js", () => ({ saveBlob: vi.fn() }));
const listCreditCardsMock = vi.fn();
vi.mock("../../../api/creditCards", async (importOriginal) => ({
  ...(await importOriginal()),
  listCreditCards: (...args) => listCreditCardsMock(...args),
}));
const narrowestMock = vi.fn(() => STABLE.narrowest);
vi.mock("../../features/transactions/useNarrowestFilter.js", () => ({
  useNarrowestFilter: (...args) => narrowestMock(...args),
}));
vi.mock("../../../api/transfers", () => ({ listTransfers: (...args) => listTransfersMock(...args) }));
let orgBaseCurrency = "BRL";
vi.mock("../../../api/organizations", () => ({
  getOrganization: vi.fn(() => Promise.resolve({ id: "org-test", base_currency: orgBaseCurrency })),
}));

import { TransacoesPage } from "../TransacoesPage.jsx";

const CARDS = [
  { id: 5, description: "Nubank Roxinho", brand: "Mastercard", last4: "1234", color: null },
  { id: 7, description: "Itaú Azul", brand: "Visa", last4: "9876", color: null },
];
const API_ROW = { id: 1, description: "Mercado", amount: -100, value: 100, type: "expense", date: "2026-11-10", tags: {} };
const PAGE = { data: [API_ROW], pagination: { total: 1, has_next: false } };
const SUMMARY = { total_income: 0, total_expenses: 100, total_refunds: 0, balance: -100, currency: "BRL" };
const NOT_FOUND = () => Promise.reject(Object.assign(new Error("404"), {
  isAxiosError: true, response: { status: 404, data: { error: "CREDIT_CARD_NOT_FOUND", type: "not_found" } },
}));
const has7 = (q) => (q?.credit_card_id ?? []).map(Number).includes(7);

beforeEach(() => {
  routerSearch = {};
  orgBaseCurrency = "BRL";
  localStorage.clear();
  listAccountsMock.mockResolvedValue([]);
  listTransfersMock.mockResolvedValue([]);
  listCreditCardsMock.mockResolvedValue(CARDS);
  listTransactionsMock.mockImplementation(() => Promise.resolve(PAGE));
  summaryApiMock.mockImplementation(() => Promise.resolve(SUMMARY));
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 900 });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const props = (extra = {}) => ({
  onNav: vi.fn(), onNewTx: vi.fn(), onEditTx: vi.fn(), isMobile: false, dataMode: "live",
  organizationId: "org-test", transactionsRefreshToken: 0, onTransactionsInvalidate: vi.fn(), ...extra,
});
const tick = () => new Promise((r) => setTimeout(r, 50));

async function openCardPanel() {
  const btn = screen.queryAllByRole("button", { name: /^(Abrir |Fechar )?Filtros/i })[0];
  if (btn && btn.getAttribute("aria-expanded") !== "true") await userEvent.click(btn);
  await userEvent.click(await screen.findByRole("button", { name: /^Cartão\b/ }));
}

describe("filtro Cartão pelo hook real (#280)", () => {
  it("abrir a página com os cartões chegando DEPOIS: UMA lista e UM resumo", async () => {
    let releaseCards;
    listCreditCardsMock.mockImplementation(() => new Promise((r) => { releaseCards = () => r(CARDS); }));
    render(<TransacoesPage {...props()} />);
    await waitFor(() => expect(listTransactionsMock).toHaveBeenCalledTimes(1));
    releaseCards();
    await waitFor(() => expect(listCreditCardsMock).toHaveBeenCalledTimes(1));
    await tick();
    await tick();
    expect(listTransactionsMock).toHaveBeenCalledTimes(1);
    expect(summaryApiMock).toHaveBeenCalledTimes(1);
  });

  it("trocar de organização: o cartão da anterior não viaja, e com a lista nova falhando o painel não mostra os cartões da outra", async () => {
    const { rerender } = render(<TransacoesPage {...props()} />);
    await openCardPanel();
    await userEvent.click(await screen.findByRole("button", { name: "Nubank Roxinho" }));
    await waitFor(() => expect(listTransactionsMock.mock.calls.at(-1)[0].credit_card_id).toEqual([5]));
    listCreditCardsMock.mockImplementation(() => Promise.reject(new Error("503")));
    listTransactionsMock.mockClear();
    rerender(<TransacoesPage {...props({ organizationId: "org-outra" })} />);
    await waitFor(() => expect(listTransactionsMock).toHaveBeenCalled());
    await tick();
    for (const [q] of listTransactionsMock.mock.calls) {
      expect(q.organization_id).toBe("org-outra");
      expect(q).not.toHaveProperty("credit_card_id");
    }
    expect(screen.queryByRole("button", { name: "Nubank Roxinho" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Itaú Azul" })).toBeNull();
  });

  it("404 com a releitura dos cartões FALHANDO: a página não fica presa — o id recusado deixa de viajar", async () => {
    listTransactionsMock.mockImplementation((q) => (has7(q) ? NOT_FOUND() : Promise.resolve(PAGE)));
    summaryApiMock.mockImplementation((q) => (has7(q) ? NOT_FOUND() : Promise.resolve(SUMMARY)));
    render(<TransacoesPage {...props()} />);
    await openCardPanel();
    listCreditCardsMock.mockImplementation(() => Promise.reject(new Error("503")));
    await userEvent.click(await screen.findByRole("button", { name: "Itaú Azul" }));
    await waitFor(() => expect(listTransactionsMock.mock.calls.at(-1)[0]).not.toHaveProperty("credit_card_id"), { timeout: 3000 });
    expect(listCreditCardsMock).toHaveBeenCalledTimes(2);
    await tick();
    expect(listCreditCardsMock).toHaveBeenCalledTimes(2);
  });

  it("404 de um cartão que a lista AINDA traz: uma releitura só, depois o id é recusado (sem laço)", async () => {
    listTransactionsMock.mockImplementation((q) => (has7(q) ? NOT_FOUND() : Promise.resolve(PAGE)));
    summaryApiMock.mockImplementation((q) => (has7(q) ? NOT_FOUND() : Promise.resolve(SUMMARY)));
    render(<TransacoesPage {...props()} />);
    await openCardPanel();
    await userEvent.click(await screen.findByRole("button", { name: "Itaú Azul" }));
    await waitFor(() => expect(listTransactionsMock.mock.calls.at(-1)[0]).not.toHaveProperty("credit_card_id"), { timeout: 3000 });
    await tick();
    await tick();
    expect(listCreditCardsMock).toHaveBeenCalledTimes(2);
    // Escolher de novo é deliberado: a combinação é perguntada outra vez, e o novo
    // 404 recusa sem nova releitura (nada de laço).
    const before = listTransactionsMock.mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: "Itaú Azul" })); // tira
    await userEvent.click(screen.getByRole("button", { name: "Itaú Azul" })); // põe de novo
    await waitFor(() => expect(listTransactionsMock.mock.calls.slice(before).some(([q]) => has7(q))).toBe(true));
    await waitFor(() => expect(listTransactionsMock.mock.calls.at(-1)[0]).not.toHaveProperty("credit_card_id"));
    await tick();
    expect(listCreditCardsMock).toHaveBeenCalledTimes(2);
  });

  it("dois cartões, um apagado em outra aba: a recuperação mantém o válido e avisa", async () => {
    listTransactionsMock.mockImplementation((q) => (has7(q) ? NOT_FOUND() : Promise.resolve(PAGE)));
    summaryApiMock.mockImplementation((q) => (has7(q) ? NOT_FOUND() : Promise.resolve(SUMMARY)));
    render(<TransacoesPage {...props()} />);
    await openCardPanel();
    await userEvent.click(await screen.findByRole("button", { name: "Nubank Roxinho" }));
    await waitFor(() => expect(listTransactionsMock.mock.calls.at(-1)[0].credit_card_id).toEqual([5]));
    listCreditCardsMock.mockResolvedValue([CARDS[0]]); // o 7 sumiu
    await userEvent.click(screen.getByRole("button", { name: "Itaú Azul" }));
    await waitFor(() => expect(listTransactionsMock.mock.calls.at(-1)[0].credit_card_id).toEqual([5]), { timeout: 3000 });
    expect(await screen.findByTestId("card-filter-notice")).toHaveTextContent("Um cartão selecionado não existe mais e foi removido do filtro.");
    expect(screen.getByRole("button", { name: "Nubank Roxinho" })).toHaveAttribute("aria-pressed", "true");
  });

  it("dois cartões e a releitura FALHA: só a combinação é recusada — o cartão válido continua utilizável", async () => {
    listTransactionsMock.mockImplementation((q) => (has7(q) ? NOT_FOUND() : Promise.resolve(PAGE)));
    summaryApiMock.mockImplementation((q) => (has7(q) ? NOT_FOUND() : Promise.resolve(SUMMARY)));
    render(<TransacoesPage {...props()} />);
    await openCardPanel();
    await userEvent.click(await screen.findByRole("button", { name: "Nubank Roxinho" }));
    listCreditCardsMock.mockImplementation(() => Promise.reject(new Error("503")));
    await userEvent.click(screen.getByRole("button", { name: "Itaú Azul" }));
    await waitFor(() => expect(listTransactionsMock.mock.calls.at(-1)[0]).not.toHaveProperty("credit_card_id"), { timeout: 3000 });
    expect(await screen.findByTestId("card-filter-notice")).toHaveTextContent("Não foi possível aplicar o filtro de cartão");
    // O 5 não foi envenenado: sem o 7, o filtro por ele volta a valer.
    await userEvent.click(screen.getByRole("button", { name: "Itaú Azul" }));
    await waitFor(() => expect(listTransactionsMock.mock.calls.at(-1)[0].credit_card_id).toEqual([5]));
    expect(screen.getByRole("button", { name: "Nubank Roxinho" })).toHaveAttribute("aria-pressed", "true");
  });
});
