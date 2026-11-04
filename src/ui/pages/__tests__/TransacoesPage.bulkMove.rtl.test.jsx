/** @vitest-environment jsdom */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
let summaryCurrency;
let orgBase;
const transactionsDataMock = vi.fn(() => ({
  isLoading: false, error: "", hasLoaded: true,
  summary: { total_income: 0, total_expenses: 0, total_refunds: 0, balance: 0, currency: summaryCurrency },
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
import { TransactionsSkeleton } from "../../features/transactions/TransactionsSkeleton.jsx";

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
  summaryCurrency = "BRL";
  orgBase = "BRL";
  rows = [row(101, "Jantar em Nova York", -287.15), row(102, "Mercado", -40)];
  listAccountsMock.mockResolvedValue(ACCOUNTS);
  quotation = () => Promise.resolve({ data: { base: "USD", quote: "BRL", rate: "5.4914", quoted_on: "2026-11-04" } });
  putImpl = (url, body) => Promise.resolve({ data: { id: Number(url.split("/").pop()), ...body } });
  apiClient.get.mockImplementation((url) => {
    if (url === "/organizations/org-test") return Promise.resolve({ data: { id: "org-test", base_currency: orgBase } });
    if (url === "/quotations/USD/BRL") return quotation();
    if (url === "/quotations/EUR/USD") return Promise.resolve({ data: { base: "EUR", quote: "USD", rate: "1.0753", quoted_on: "2026-11-04" } });
    if (url === "/quotations/BRL/USD") return Promise.resolve({ data: { base: "BRL", quote: "USD", rate: "0.1821", quoted_on: "2026-11-04" } });
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

  it("seleção velha não sobrevive: trocar o recorte (busca) limpa", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectRows(user, "Mercado");
    expect(screen.getByTestId("bulk-selection-bar")).toHaveTextContent("1 selecionado");
    await user.type(screen.getAllByLabelText("Buscar transações")[0], "mer");
    await waitFor(() => expect(screen.queryByTestId("bulk-selection-bar")).toBeNull(), { timeout: 3000 });
  });

  it("um lançamento selecionado que sai da lista (excluído) sai da contagem; releitura por token limpa tudo", async () => {
    const user = userEvent.setup();
    const props = { onNav: vi.fn(), onNewTx: vi.fn(), onEditTx: vi.fn(), isMobile: false, dataMode: "live", organizationId: "org-test", onTransactionsInvalidate: vi.fn() };
    const { rerender } = render(<TransacoesPage {...props} transactionsRefreshToken={0} />);
    await selectRows(user, "Jantar em Nova York", "Mercado");
    expect(screen.getByTestId("bulk-selection-bar")).toHaveTextContent("2 selecionados");
    const all = rows;
    rows = rows.filter((r) => r.desc !== "Mercado");
    rerender(<TransacoesPage {...props} transactionsRefreshToken={0} />);
    await waitFor(() => expect(screen.getByTestId("bulk-selection-bar")).toHaveTextContent("1 selecionado"));
    // Se a linha voltar, ela NÃO volta selecionada às escondidas.
    rows = all;
    rerender(<TransacoesPage {...props} transactionsRefreshToken={0} />);
    await screen.findByText("Mercado");
    expect(screen.getByTestId("bulk-selection-bar")).toHaveTextContent("1 selecionado");
    rerender(<TransacoesPage {...props} transactionsRefreshToken={1} />);
    await waitFor(() => expect(screen.queryByTestId("bulk-selection-bar")).toBeNull());
  });

  it("com o lote em voo, ✕ / fundo não fecham; os resultados aparecem", async () => {
    let release;
    putImpl = (url, body) => new Promise((r) => { release = () => r({ data: { id: 1, ...body } }); });
    const user = userEvent.setup();
    renderPage();
    await selectRows(user, "Mercado");
    await openMoveTo(user, "Conta B Nubank");
    await user.click(await screen.findByRole("button", { name: "Mover 1 lançamento" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Fechar" }));
    fireEvent.click(dialog.parentElement);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    release();
    expect(await screen.findByTestId("bulk-move-results")).toHaveTextContent("1 movido");
  });

  it("valores editados: o toque no fundo não descarta; o ✕ fecha", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectRows(user, "Jantar em Nova York");
    await openMoveTo(user, "Wise");
    const field = await screen.findByLabelText("Valor de Jantar em Nova York em US$");
    await user.clear(field);
    await user.type(field, "50,00");
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog.parentElement);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("organização em US$: linha sem moeda usa a base (US$); sem base conhecida, a linha é inelegível", async () => {
    summaryCurrency = "USD";
    orgBase = "USD";
    rows = [row(201, "Taxi", -20, { currency: null })];
    const user = userEvent.setup();
    const first = renderPage();
    await selectRows(user, "Taxi");
    await openMoveTo(user, "Conta B Nubank");
    // USD → BRL: um grupo de conversão a partir de USD, não "BRL" chutado.
    expect(await screen.findByTestId("bulk-move-group-USD")).toBeInTheDocument();
    first.unmount();

    summaryCurrency = null;
    renderPage();
    await selectRows(user, "Taxi");
    await openMoveTo(user, "Conta B Nubank");
    expect(await screen.findByTestId("bulk-move-ineligible")).toHaveTextContent("Taxi — Moeda desconhecida");
  });

  it("conta de destino sem moeda: o seletor não mostra 'R$' chutado", async () => {
    listAccountsMock.mockResolvedValue([...ACCOUNTS, { id: "dddddddd-0000-4000-8000-000000000004", name: "Conta Sem Moeda", currency: null }]);
    const user = userEvent.setup();
    renderPage();
    await selectRows(user, "Mercado");
    await user.click(within(screen.getByTestId("bulk-selection-bar")).getByRole("button", { name: "Mover para conta…" }));
    const picker = await screen.findByRole("group", { name: "Contas de destino" });
    expect(within(picker).getByRole("button", { name: /Conta Sem Moeda/ })).not.toHaveTextContent("R$");
  });

  it("'Manter os números' não espera a cotação", async () => {
    quotation = () => new Promise(() => {});
    const user = userEvent.setup();
    renderPage();
    await selectRows(user, "Jantar em Nova York");
    await openMoveTo(user, "Wise");
    const group = await screen.findByTestId("bulk-move-group-BRL");
    expect(screen.getByRole("button", { name: "Mover 1 lançamento" })).toBeDisabled();
    await user.click(within(group).getByRole("radio", { name: /Manter os números/ }));
    expect(screen.getByRole("button", { name: "Mover 1 lançamento" })).toBeEnabled();
  });

  it("valor que arredonda para 0,00 é apontado na própria linha", async () => {
    rows = [row(301, "Bala", -0.01)];
    const user = userEvent.setup();
    renderPage();
    await selectRows(user, "Bala");
    await openMoveTo(user, "Wise");
    const group = await screen.findByTestId("bulk-move-group-BRL");
    await waitFor(() => expect(within(group).getByRole("alert")).toHaveTextContent("Fica US$ 0,00 nessa moeda"));
    expect(screen.getByRole("button", { name: "Mover 1 lançamento" })).toBeDisabled();
  });

  it("duas moedas de origem: dois grupos, uma cotação por par", async () => {
    rows = [row(101, "Jantar em Nova York", -287.15), row(401, "Croissant", -4.65, { currency: "EUR" })];
    const user = userEvent.setup();
    renderPage();
    await selectRows(user, "Jantar em Nova York", "Croissant");
    await openMoveTo(user, "Wise");
    expect(await screen.findByTestId("bulk-move-group-BRL")).toBeInTheDocument();
    const eur = screen.getByTestId("bulk-move-group-EUR");
    await waitFor(() => expect(within(eur).getByLabelText("Valor de Croissant em US$")).toHaveValue("5,00"));
    const quotes = apiClient.get.mock.calls.map(([u]) => u).filter((u) => u.startsWith("/quotations"));
    // Nenhum lado é a base (R$): "1 € = US$ 1,0753", buscada nessa direção.
    expect(eur).toHaveTextContent(" 1 = US$ 1,0753");
    expect(quotes.sort()).toEqual(["/quotations/EUR/USD", "/quotations/USD/BRL"]);
    await user.click(screen.getByRole("button", { name: "Mover 2 lançamentos" }));
    await screen.findByTestId("bulk-move-results");
    const byId = Object.fromEntries(puts().map((p) => [p.id, p.body]));
    expect(byId["101"]).toMatchObject({ value: 52.29, value_currency: "USD" });
    expect(byId["401"]).toMatchObject({ value: 5, value_currency: "USD" });
  });

  it("o esqueleto reserva a coluna da seleção (sem salto quando o dado chega)", () => {
    render(<TransactionsSkeleton rows={1} leadingGutterPx={34} />);
    expect(screen.getByTestId("transactions-skeleton").firstChild).toHaveStyle({ paddingLeft: "48px" });
  });

  it("valor que não é número diz 'Valor inválido', não '0,00'", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectRows(user, "Jantar em Nova York");
    await openMoveTo(user, "Wise");
    const field = await screen.findByLabelText("Valor de Jantar em Nova York em US$");
    await user.clear(field);
    await user.type(field, "abc");
    const group = screen.getByTestId("bulk-move-group-BRL");
    expect(within(group).getByRole("alert")).toHaveTextContent("Valor inválido");
    expect(within(group).getByRole("alert")).not.toHaveTextContent("0,00");
    expect(screen.getByRole("button", { name: "Mover 1 lançamento" })).toBeDisabled();
  });

  describe("celular (sheet)", () => {
    const SLIDE_WAIT = 600;
    const drag = (handle) => {
      fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] });
      fireEvent.touchMove(document, { touches: [{ clientY: 300 }] });
      fireEvent.touchEnd(document);
    };

    it("com o lote em voo, Esc / ✕ / fundo / arraste não fecham; os resultados ficam", async () => {
      let release;
      putImpl = (url, body) => new Promise((r) => { release = () => r({ data: { id: 1, ...body } }); });
      const user = userEvent.setup();
      renderPage({ isMobile: true });
      await selectRows(user, "Mercado");
      await openMoveTo(user, "Conta B Nubank");
      await user.click(await screen.findByRole("button", { name: "Mover 1 lançamento" }));
      fireEvent.keyDown(document, { key: "Escape" });
      await user.click(screen.getByRole("button", { name: "Fechar mover para conta" }));
      fireEvent.click(screen.getByTestId("bulk-move-backdrop"));
      drag(screen.getByTestId("bulk-move-handle"));
      await new Promise((r) => setTimeout(r, SLIDE_WAIT));
      expect(screen.getByRole("dialog", { name: /Mover/ })).toBeInTheDocument();
      release();
      expect(await screen.findByTestId("bulk-move-results")).toHaveTextContent("1 movido");
      await new Promise((r) => setTimeout(r, SLIDE_WAIT));
      expect(screen.getByTestId("bulk-move-results")).toBeInTheDocument();
    });

    it("valor editado: o fundo não fecha; o ✕ fecha", async () => {
      const user = userEvent.setup();
      renderPage({ isMobile: true });
      await selectRows(user, "Jantar em Nova York");
      await openMoveTo(user, "Wise");
      const field = await screen.findByLabelText("Valor de Jantar em Nova York em US$");
      await user.clear(field);
      await user.type(field, "50,00");
      fireEvent.click(screen.getByTestId("bulk-move-backdrop"));
      await new Promise((r) => setTimeout(r, SLIDE_WAIT));
      expect(screen.getByRole("dialog", { name: /Mover/ })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Fechar mover para conta" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });
  });

  it("US$ → R$ (para a base): mostra 'US$ 1 = R$ 5,4914' e MULTIPLICA pela mesma taxa", async () => {
    rows = [row(501, "Hotel em Miami", -52.4, { accountId: ACC_W, currency: "USD" })];
    const user = userEvent.setup();
    renderPage();
    await selectRows(user, "Hotel em Miami");
    await openMoveTo(user, "Conta B Nubank");
    const group = await screen.findByTestId("bulk-move-group-USD");
    await waitFor(() => expect(group).toHaveTextContent("cotação de 04/11 (US$ 1 = R$ 5,4914)"));
    // 52,40 × 5,4914 = 287,749… → 287,75
    expect(within(group).getByLabelText("Valor de Hotel em Miami em R$")).toHaveValue("287,75");
    const quotes = apiClient.get.mock.calls.map(([u]) => u).filter((u) => u.startsWith("/quotations"));
    expect(quotes).toEqual(["/quotations/USD/BRL"]);
  });
});

