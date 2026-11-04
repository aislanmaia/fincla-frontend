/** @vitest-environment jsdom */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * #281 — "Mover para a conta…" em lote nas Transações. Seleção com a mesma mecânica
 * dos Lançamentos do cartão; o diálogo, o plano (elegíveis, grupos por moeda), a
 * cotação e o PUT rodam de verdade — o único dublê da escrita é o `apiClient`.
 */
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
  useRouterState: (opts) =>
    typeof opts?.select === "function"
      ? opts.select({ location: { pathname: "/transactions", search: {} } })
      : { location: { pathname: "/transactions", search: {} } },
}));

vi.mock("../../../api/client", async () => {
  const actual = await vi.importActual("../../../api/client");
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

let rows;
const transactionsDataMock = vi.fn(() => ({
  isLoading: false, error: "", hasLoaded: true,
  summary: { total_income: 0, total_expenses: 0, total_refunds: 0, balance: 0, currency: "BRL" },
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
const listAccountsMock = vi.fn();
vi.mock("../../../api/accounts", () => ({ listAccounts: (...args) => listAccountsMock(...args) }));

import apiClient from "../../../api/client";
import { TransacoesPage } from "../TransacoesPage.jsx";

const ACC_A = "aaaaaaaa-0000-4000-8000-000000000001";
const ACC_B = "bbbbbbbb-0000-4000-8000-000000000002";
const ACC_W = "cccccccc-0000-4000-8000-000000000003";
const ACCOUNTS = [
  { id: ACC_A, name: "Conta A Itaú", currency: "BRL" },
  { id: ACC_B, name: "Conta B Nubank", currency: "BRL" },
  { id: ACC_W, name: "Wise", currency: "USD" },
];

const row = (id, desc, val, extra = {}) => ({
  id, desc, cat: "Alimentação", categoryTagId: "cat-alim", val, method: "Pix", paymentMethodKey: "pix", type: val > 0 ? "income" : "expense",
  icon: "🍽", status: "confirmado", rec: false, tags: [], detailTagIds: [], date: "10/11/2026", dateIsoForEdit: "2026-11-10",
  settled: true, settleable: true, accountId: ACC_A, currency: "BRL", seriesId: null, ...extra,
});

let quotation;
let putImpl;
beforeEach(() => {
  localStorage.clear();
  rows = [row(101, "Jantar em Nova York", -287.15), row(102, "Mercado", -40)];
  listAccountsMock.mockResolvedValue(ACCOUNTS);
  quotation = () => Promise.resolve({ data: { base: "USD", quote: "BRL", rate: "5.4914", quoted_on: "2026-11-04" } });
  putImpl = (url, body) => Promise.resolve({ data: { id: Number(url.split("/").pop()), ...body } });
  apiClient.get.mockImplementation((url) => {
    if (url === "/quotations/USD/BRL") return quotation();
    return Promise.resolve({ data: [] });
  });
  apiClient.put.mockImplementation((url, body) => putImpl(url, body));
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

const puts = () => apiClient.put.mock.calls.map(([url, body]) => ({ id: url.split("/").pop(), body }));

async function selectRows(user, ...descs) {
  for (const d of descs) await user.click(await screen.findByRole("checkbox", { name: `Selecionar ${d}` }));
}
async function openMoveTo(user, accountLabel) {
  await user.click(within(screen.getByTestId("bulk-selection-bar")).getByRole("button", { name: "Mover para conta…" }));
  const picker = await screen.findByRole("group", { name: "Contas de destino" });
  await user.click(within(picker).getByRole("button", { name: new RegExp(accountLabel) }));
}

describe("<TransacoesPage> — seleção em lote e mover para conta (#281)", () => {
  it("com 2+ contas: caixas nas linhas, 'N selecionados' e a barra com 'Mover para conta…'; 'selecionar todos' pega os carregados", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectRows(user, "Mercado");
    const bar = screen.getByTestId("bulk-selection-bar");
    expect(bar).toHaveTextContent("1 selecionado");
    expect(within(bar).getByRole("button", { name: "Mover para conta…" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Selecionar lançamentos carregados" }));
    expect(screen.getByTestId("bulk-selection-bar")).toHaveTextContent("2 selecionados");
    await user.click(within(screen.getByTestId("bulk-selection-bar")).getByRole("button", { name: "Limpar seleção" }));
    expect(screen.queryByTestId("bulk-selection-bar")).toBeNull();
  });

  it("com UMA conta ativa não há seleção (a única ação é mover de conta)", async () => {
    listAccountsMock.mockResolvedValue([ACCOUNTS[0]]);
    renderPage();
    await screen.findAllByText("Mercado");
    await waitFor(() => expect(listAccountsMock).toHaveBeenCalled());
    expect(screen.queryByRole("checkbox", { name: "Selecionar Mercado" })).toBeNull();
  });

  it("mesma moeda: a conta de origem sai do seletor; um PUT por lançamento só com account_id; lista e saldos releem", async () => {
    const onTransactionsInvalidate = vi.fn();
    const user = userEvent.setup();
    renderPage({ onTransactionsInvalidate });
    await selectRows(user, "Jantar em Nova York", "Mercado");
    await user.click(within(screen.getByTestId("bulk-selection-bar")).getByRole("button", { name: "Mover para conta…" }));
    const picker = await screen.findByRole("group", { name: "Contas de destino" });
    expect(within(picker).queryByRole("button", { name: /Conta A Itaú/ })).toBeNull();
    await user.click(within(picker).getByRole("button", { name: /Conta B Nubank/ }));
    await user.click(await screen.findByRole("button", { name: "Mover 2 lançamentos" }));
    expect(await screen.findByTestId("bulk-move-results")).toHaveTextContent("2 movidos");
    expect(puts()).toHaveLength(2);
    for (const p of puts()) {
      expect(p.body.account_id).toBe(ACC_B);
      expect(p.body).not.toHaveProperty("value");
      expect(p.body).not.toHaveProperty("value_currency");
    }
    expect(onTransactionsInvalidate).toHaveBeenCalled();
  });

  it("1 conta ativa + 1 desativada: nada de seleção nem de 'Mover para conta…' (desativada não conta)", async () => {
    listAccountsMock.mockResolvedValue([ACCOUNTS[0], { id: ACC_B, name: "Conta B Nubank", currency: "BRL", is_active: false }]);
    renderPage();
    await screen.findAllByText("Mercado");
    await waitFor(() => expect(listAccountsMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("checkbox", { name: "Selecionar Mercado" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "Selecionar lançamentos carregados" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mover para conta…" })).toBeNull();
  });

  it("entre moedas, 'Converter pela cotação': aviso com taxa e data, valor = origem ÷ taxa, PUT com value + value_currency", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectRows(user, "Jantar em Nova York");
    await openMoveTo(user, "Wise");
    const group = await screen.findByTestId("bulk-move-group-BRL");
    await waitFor(() => expect(group).toHaveTextContent("cotação de 04/11 (US$ 1 = R$ 5,4914)"));
    expect(group).toHaveTextContent("A cotação é a de hoje, não a da data de cada lançamento.");
    expect(within(group).getByLabelText("Valor de Jantar em Nova York em US$")).toHaveValue("52,29");
    await user.click(screen.getByRole("button", { name: "Mover 1 lançamento" }));
    await screen.findByTestId("bulk-move-results");
    expect(puts()[0].body).toMatchObject({ account_id: ACC_W, value: 52.29, value_currency: "USD" });
  });

  it("'Manter os números': o mesmo número na moeda nova", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectRows(user, "Jantar em Nova York");
    await openMoveTo(user, "Wise");
    const group = await screen.findByTestId("bulk-move-group-BRL");
    await waitFor(() => expect(within(group).getByLabelText("Valor de Jantar em Nova York em US$")).toHaveValue("52,29"));
    await user.click(within(group).getByRole("radio", { name: /Manter os números/ }));
    expect(within(group).getByLabelText("Valor de Jantar em Nova York em US$")).toHaveValue("287,15");
    await user.click(screen.getByRole("button", { name: "Mover 1 lançamento" }));
    await screen.findByTestId("bulk-move-results");
    expect(puts()[0].body).toMatchObject({ account_id: ACC_W, value: 287.15, value_currency: "USD" });
  });

  it("valor editado é o enviado", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectRows(user, "Jantar em Nova York");
    await openMoveTo(user, "Wise");
    const field = await screen.findByLabelText("Valor de Jantar em Nova York em US$");
    await waitFor(() => expect(field).toHaveValue("52,29"));
    await user.clear(field);
    await user.type(field, "50,00");
    await user.click(screen.getByRole("button", { name: "Mover 1 lançamento" }));
    await screen.findByTestId("bulk-move-results");
    expect(puts()[0].body.value).toBe(50);
  });

  it("valor digitado antes de a cotação chegar não é sobrescrito por ela", async () => {
    let release;
    quotation = () => new Promise((r) => { release = () => r({ data: { base: "USD", quote: "BRL", rate: "5.4914", quoted_on: "2026-11-04" } }); });
    const user = userEvent.setup();
    renderPage();
    await selectRows(user, "Jantar em Nova York");
    await openMoveTo(user, "Wise");
    const field = await screen.findByLabelText("Valor de Jantar em Nova York em US$");
    await user.type(field, "60,00");
    release();
    await waitFor(() => expect(screen.getByTestId("bulk-move-group-BRL")).toHaveTextContent("5,4914"));
    expect(screen.getByLabelText("Valor de Jantar em Nova York em US$")).toHaveValue("60,00");
  });

  it("sem cotação: campos vazios, sem mover até informar o valor ou manter os números (nunca taxa 1)", async () => {
    quotation = () => Promise.reject(Object.assign(new Error("503"), { isAxiosError: true, response: { status: 503, data: {} } }));
    const user = userEvent.setup();
    renderPage();
    await selectRows(user, "Jantar em Nova York");
    await openMoveTo(user, "Wise");
    const group = await screen.findByTestId("bulk-move-group-BRL");
    await waitFor(() => expect(group).toHaveTextContent("Sem cotação agora"));
    expect(within(group).getByLabelText("Valor de Jantar em Nova York em US$")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Mover 1 lançamento" })).toBeDisabled();
    await user.click(within(group).getByRole("radio", { name: /Manter os números/ }));
    expect(screen.getByRole("button", { name: "Mover 1 lançamento" })).toBeEnabled();
  });

  it("inelegíveis listados com o motivo e não tentados (cartão, recorrência)", async () => {
    rows = [
      row(101, "Jantar em Nova York", -287.15),
      row(103, "Notebook", -4299, { settleable: false, paymentMethodKey: "credito", method: "Cartão de crédito" }),
      row(104, "Netflix", -55.9, { seriesId: "series-1", rec: true }),
    ];
    const user = userEvent.setup();
    renderPage();
    await selectRows(user, "Jantar em Nova York", "Notebook", "Netflix");
    await openMoveTo(user, "Conta B Nubank");
    const inel = await screen.findByTestId("bulk-move-ineligible");
    expect(inel).toHaveTextContent("Não podem ser movidos (2)");
    expect(inel).toHaveTextContent("Notebook — Compra no cartão");
    expect(inel).toHaveTextContent("Netflix — Ocorrência de recorrência: mova a série");
    await user.click(screen.getByRole("button", { name: "Mover 1 lançamento" }));
    await screen.findByTestId("bulk-move-results");
    expect(puts().map((p) => p.id)).toEqual(["101"]);
  });

  it("falha parcial: resultado por item, sem 'sucesso' total, e 'tentar de novo' só nos que falharam", async () => {
    let failMercado = true;
    putImpl = (url, body) => {
      if (url.endsWith("/102") && failMercado) {
        return Promise.reject(Object.assign(new Error("422"), { isAxiosError: true, response: { status: 422, data: { detail: "Esta transação é um aporte de meta; mova o aporte pela meta." } } }));
      }
      return Promise.resolve({ data: { id: 1, ...body } });
    };
    const user = userEvent.setup();
    renderPage();
    await selectRows(user, "Jantar em Nova York", "Mercado");
    await openMoveTo(user, "Conta B Nubank");
    await user.click(await screen.findByRole("button", { name: "Mover 2 lançamentos" }));
    const results = await screen.findByTestId("bulk-move-results");
    expect(results).toHaveTextContent("1 movido, 1 falhou");
    expect(results).toHaveTextContent("Mercado: Esta transação é um aporte de meta");
    expect(puts().map((p) => p.id).sort()).toEqual(["101", "102"]);

    failMercado = false;
    await user.click(screen.getByRole("button", { name: "Tentar de novo os que falharam" }));
    await waitFor(() => expect(screen.getByTestId("bulk-move-results")).toHaveTextContent("2 movidos"));
    expect(puts().map((p) => p.id)).toEqual(expect.arrayContaining(["102"]));
    expect(puts().filter((p) => p.id === "101")).toHaveLength(1);
  });

  it("celular: o diálogo abre como sheet portalizado", async () => {
    const user = userEvent.setup();
    const { container } = renderPage({ isMobile: true });
    await selectRows(user, "Mercado");
    await user.click(within(screen.getByTestId("bulk-selection-bar")).getByRole("button", { name: "Mover para conta…" }));
    const sheet = await screen.findByRole("dialog", { name: "Mover para a conta…" });
    expect(container.contains(sheet)).toBe(false);
    expect(screen.getByTestId("bulk-move-handle")).toBeInTheDocument();
  });
});
