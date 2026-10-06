/** @vitest-environment jsdom */

import React from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const navigateMock = vi.fn();
const CARD_PUBLIC_ID = "00000000-0000-4000-8000-000000000001";
let routeParams = { cardId: CARD_PUBLIC_ID, year: "2026", month: "10" };
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
  useParams: () => routeParams,
}));

import { InvoiceDashboardPage } from "../InvoiceDashboardPage.jsx";

const ORG = "11111111-1111-4111-8111-111111111111";
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 4, 12, 0, 0));
  navigateMock.mockReset();
  routeParams = { cardId: CARD_PUBLIC_ID, year: "2026", month: "10" };
});
afterEach(() => {
  server.resetHandlers();
  cleanup();
  vi.useRealTimers();
});

const money = (amount, currency = "BRL") => ({ amount, currency });

const cardFixture = (over = {}) => ({
  id: 1, public_id: over.public_id ?? `00000000-0000-4000-8000-${String(over.id ?? 1).padStart(12, "0")}`, organization_id: ORG, last4: "7112", brand: "Visa", due_day: 10, closing_day: 15,
  description: "Azul", color: "#1a1a2e", notes: null, currency: "BRL",
  credit_limit: money("10000.00"), available_limit: money("6500.00"), used_limit: money("3500.00"), limit_usage_percent: 35,
  ...over,
});

const histRow = (year, month, status, total, items) => ({
  year, month, month_name: "", total_amount: money(total), status, items_count: items, top_category: "Alimentação",
});
const historyFixture = () => ({
  card_id: 1, card_name: "Azul", period_start: "2026-05-01", period_end: "2026-10-31",
  summary: { total_spent: money("0"), average_monthly: money("0"), highest_month: null, lowest_month: null },
  monthly_data: [
    histRow(2026, 8, "paid", "7340.00", 51),
    histRow(2026, 9, "closed", "6940.00", 58),
    histRow(2026, 10, "open", "8129.51", 62),
  ],
});
const futureFixture = () => ({
  card_id: 1, card_name: "Azul", card_last4: "7112", credit_limit: money("10000.00"), current_available_limit: money("6500.00"),
  summary: { total_committed: money("0"), average_monthly: money("0"), lowest_month: null, highest_month: null },
  monthly_breakdown: [
    {
      year: 2026, month: 11, month_name: "novembro", total_amount: money("6050.28"), limit_usage_percent: 20, installments_count: 7,
      top_installments: [{ description: "Celular", amount: money("269.00"), installment_number: 3, total_installments: 12, category_name: "Compras", category_color: null }],
    },
    { year: 2026, month: 12, month_name: "dezembro", total_amount: money("5050.27"), limit_usage_percent: 15, installments_count: 5, top_installments: [] },
  ],
  ending_soon: [], insights: [],
});

const item = (id, description, amount, date, extra = {}) => ({
  id, series_id: `s${id}`, transaction_id: id, transaction_date: date, description, amount: money(amount),
  installment_number: 1, total_installments: 1, modality: "cash", tags: { categoria: [{ id: "c1", name: "Alimentação", color: "#22C55E" }] },
  purchase_info: null, ...extra,
});

const detailFixture = (over = {}) => ({
  month: "2026-10", due_date: "2026-10-10", total_amount: money("8129.51"), status: "open",
  closing_date: "2026-10-15", paid_date: null, days_until_due: 6, is_overdue: false,
  previous_month_total: money("6940.00"), month_over_month_change: 17.1, limit_usage_percent: 65, items_count: 62,
  category_breakdown: [
    { category_id: "c1", category_name: "Alimentação", category_color: "#22C55E", total: money("3000.00"), percentage: 36.9, transaction_count: 15 },
    { category_id: "c2", category_name: "Moradia", category_color: "#6B7280", total: money("2000.00"), percentage: 24.6, transaction_count: 3 },
    { category_id: "c3", category_name: "Transporte", category_color: "#2563EB", total: money("1500.00"), percentage: 18.4, transaction_count: 9 },
    { category_id: "c4", category_name: "Serviços", category_color: "#7C3AED", total: money("800.00"), percentage: 9.8, transaction_count: 4 },
    { category_id: "c5", category_name: "Lazer", category_color: "#DB2777", total: money("400.00"), percentage: 4.9, transaction_count: 4 },
    { category_id: "c6", category_name: "Saúde", category_color: "#0891B2", total: money("300.00"), percentage: 3.7, transaction_count: 2 },
    { category_id: "c7", category_name: "Educação", category_color: "#65A30D", total: money("129.51"), percentage: 1.6, transaction_count: 1 },
  ],
  items: [
    item(1, "Supermercado Extra", "412.30", "2026-10-02"),
    item(2, "Netflix", "44.90", "2026-10-01"),
    item(3, "Celular", "269.00", "2026-09-28", { installment_number: 9, total_installments: 21, modality: "installment" }),
    item(4, "Posto Ipiranga", "180.00", "2026-09-27"),
    item(5, "Estorno farmácia", "38.90", "2026-09-26", { modality: "refund" }),
    item(6, "Compra antiga", "10.00", "2026-09-01"),
  ],
  ...over,
});

const DETAILS = {
  "2026/10": () => detailFixture(),
  "2026/9": () => detailFixture({ month: "2026-09", due_date: "2026-09-10", total_amount: money("6940.00"), status: "closed", closing_date: "2026-09-15", days_until_due: -24, is_overdue: true, previous_month_total: null, month_over_month_change: null, items_count: 58 }),
  "2026/8": () => detailFixture({ month: "2026-08", due_date: "2026-08-10", total_amount: money("7340.00"), status: "paid", closing_date: "2026-08-15", paid_date: "2026-08-09", days_until_due: -55, items_count: 51 }),
};

/** Backend de mentira na camada HTTP: cliente, adapter, hook e tela reais rodam por cima. */
function mockApi({ cards = [cardFixture()], detail = DETAILS, patch, listStatus = 200, future = futureFixture() } = {}) {
  const calls = [];
  calls.queries = [];
  const paidOverride = {};
  server.use(
    http.get("*/v1/credit-cards", ({ request }) => {
      calls.push(`GET ${new URL(request.url).pathname}`);
      return listStatus === 200 ? HttpResponse.json(cards) : HttpResponse.json({ detail: "x" }, { status: listStatus });
    }),
    http.get("*/v1/credit-cards/:id/invoices/history", ({ request }) => {
      calls.push(`GET ${new URL(request.url).pathname}`);
      return HttpResponse.json(historyFixture());
    }),
    http.get("*/v1/credit-cards/:id/future-commitments", ({ request }) => {
      calls.push(`GET ${new URL(request.url).pathname}`);
      return HttpResponse.json(future);
    }),
    http.get("*/v1/credit-cards/:id/invoices/:year/:month", ({ request, params }) => {
      calls.push(`GET ${new URL(request.url).pathname}`);
      calls.queries.push(new URL(request.url).search);
      const make = detail[`${params.year}/${params.month}`];
      if (detail === "fail") return HttpResponse.json({ detail: "boom" }, { status: 500 });
      if (!make) return HttpResponse.json({ detail: "Invoice not found for the specified card/month" }, { status: 404 });
      const override = paidOverride[`${params.year}/${params.month}`];
      return HttpResponse.json({ ...make(), ...(override ?? {}) });
    }),
    http.patch("*/v1/credit-cards/:id/invoices/:year/:month/:action", async ({ request, params }) => {
      const body = await request.json();
      calls.push(`PATCH ${new URL(request.url).pathname}`);
      if (patch?.status) return HttpResponse.json({ detail: patch.detail ?? "boom" }, { status: patch.status });
      const paid = params.action === "mark-paid";
      paidOverride[`${params.year}/${params.month}`] = { status: paid ? "paid" : "open", paid_date: paid ? (body.paid_date ?? "2026-10-04") : null };
      return HttpResponse.json({
        card_id: 1, year: Number(params.year), month: Number(params.month),
        status: paid ? "paid" : "open", paid_date: paid ? (body.paid_date ?? "2026-10-04") : null,
      });
    }),
  );
  return calls;
}

const renderPage = (props = {}) => render(
  <InvoiceDashboardPage organizationId={ORG} dataMode="live" {...props} />,
);

const readyDesktop = () => screen.findByTestId("invoice-title");

describe("InvoiceDashboardPage — card da fatura", () => {
  it.each([false, true])("exibe média e velocidade reais no layout mobile=%s com opt-in", async (isMobile) => {
    const calls = mockApi({ detail: {
      ...DETAILS,
      "2026/10": () => detailFixture({
        six_month_average: money("5000.00"), six_month_average_change: 62.6,
        six_month_average_invoices_count: 2,
        spending_pace: {
          cycle_start: "2026-09-15", cycle_end: "2026-10-14",
          current: [{ day: 1, date: "2026-09-15", cumulative: money("0.00") }, { day: 2, date: "2026-09-16", cumulative: money("150.00") }],
          previous: { cycle_start: "2026-08-15", cycle_end: "2026-09-14", points: [{ day: 1, date: "2026-08-15", cumulative: money("0.00") }, { day: 2, date: "2026-08-16", cumulative: money("80.00") }] },
        },
      }),
    } });
    renderPage({ isMobile });
    expect(await screen.findByTestId("six-month-average")).toHaveTextContent("5.000,00");
    expect(screen.getByTestId("six-month-average")).toHaveTextContent("2 faturas");
    expect(screen.getByTestId("spending-pace")).toHaveTextContent("Ciclo atual");
    expect(screen.getByTestId("spending-pace")).toHaveTextContent("Ciclo anterior");
    const chart = within(screen.getByTestId("spending-pace")).getByRole("img");
    chart.focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(within(screen.getByTestId("spending-pace")).getByRole("status")).toHaveTextContent("Dia 1");
    expect(calls.filter((call) => call.startsWith("GET /v1/credit-cards"))).toHaveLength(4);
    expect(calls.queries).toContainEqual(expect.stringContaining("include_metrics=true"));
  });

  it("não transforma falta de histórico em média zero ou ciclo anterior inventado", async () => {
    mockApi({ detail: {
      ...DETAILS,
      "2026/10": () => detailFixture({
        six_month_average: null, six_month_average_change: null,
        six_month_average_invoices_count: 0,
        spending_pace: { cycle_start: "2026-09-15", cycle_end: "2026-10-14", current: [{ day: 1, date: "2026-09-15", cumulative: money("0.00") }], previous: null },
      }),
    } });
    renderPage();
    expect(await screen.findByTestId("six-month-average")).toHaveTextContent("Sem faturas anteriores");
    expect(screen.getByTestId("six-month-average")).not.toHaveTextContent("R$ 0,00");
    expect(screen.getByTestId("spending-pace")).not.toHaveTextContent("Ciclo anterior");
    expect(within(screen.getByTestId("spending-pace")).getByTestId("pace-current-point")).toBeVisible();
    expect(within(screen.getByTestId("spending-pace")).getByTestId("pace-tooltip")).toHaveTextContent("R$ 0,00");
    expect(within(screen.getByTestId("spending-pace")).getByTestId("pace-tooltip").querySelector("div:last-child")).toHaveStyle({ fontSize: "12px" });
  });

  it("mostra a fatura aberta com total, comparação, lançamentos, timeline, limite, categorias e itens", async () => {
    mockApi();
    renderPage();
    await screen.findByTestId("invoice-count");

    expect(screen.getByTestId("invoice-title")).toHaveTextContent("Outubro 2026");
    expect(screen.getByTestId("card-name-label")).toHaveTextContent("Visa •7112 · Azul");
    const card = screen.getByTestId("invoice-card-2026-10");
    expect(card).toHaveAttribute("data-status", "open");
    expect(within(card).getByTestId("invoice-status")).toHaveTextContent("Aberta");
    expect(screen.getByTestId("invoice-total")).toHaveTextContent("8.129,51");
    expect(screen.getByTestId("invoice-comparison")).toHaveTextContent("↑ 17% vs setembro");
    expect(screen.getByTestId("invoice-comparison")).toHaveTextContent("6.940,00");
    expect(screen.getByTestId("invoice-count")).toHaveTextContent("62 lançamentos");
    expect(card).toHaveTextContent("maior categoria: Alimentação");
    expect(screen.getByTestId("invoice-timeline")).toHaveTextContent("Fecha 15/10");
    expect(screen.getByTestId("invoice-timeline")).toHaveTextContent("vence em 6 dias (10/10)");
    expect(screen.getByTestId("invoice-limit")).toHaveTextContent("65% de");
    expect(screen.getByTestId("invoice-limit")).toHaveTextContent("10.000,00");

    const breakdown = screen.getByTestId("category-breakdown");
    expect(within(breakdown).getAllByTestId("category-row")).toHaveLength(6);
    expect(breakdown).toHaveTextContent("Alimentação");
    expect(breakdown).toHaveTextContent("Outras");

    const recent = within(screen.getByTestId("recent-items")).getAllByTestId("recent-item");
    expect(recent).toHaveLength(5);
    expect(recent[0]).toHaveTextContent("Supermercado Extra");
    expect(recent[2]).toHaveTextContent("9/21");
    expect(screen.getByTestId("recent-items")).not.toHaveTextContent("Compra antiga");
    expect(screen.getByTestId("recent-items")).toHaveTextContent("mostrando 5 de 62 lançamentos");
  });

  it.each([
    ["2026", "10", "open", "Aberta"],
    ["2026", "9", "closed", "Fechada"],
    ["2026", "8", "paid", "Paga"],
    ["2026", "11", "forecast", "Prevista"],
  ])("fatura %s/%s tem o status %s", async (year, month, status, label) => {
    mockApi();
    routeParams = { cardId: CARD_PUBLIC_ID, year, month };
    renderPage();
    await waitFor(() => expect(screen.getByTestId(`invoice-card-${year}-${month.padStart(2, "0")}`)).toHaveAttribute("data-status", status));
    if (status !== "forecast") await screen.findByTestId("invoice-count");
    expect(within(screen.getByTestId(`invoice-card-${year}-${month.padStart(2, "0")}`)).getByTestId("invoice-status")).toHaveTextContent(label);
  });

  it("fatura fechada vencida mostra atraso; fatura paga mostra a data do pagamento e oferece desfazer", async () => {
    mockApi();
    routeParams = { cardId: CARD_PUBLIC_ID, year: "2026", month: "9" };
    const first = renderPage();
    await screen.findByTestId("invoice-count");
    expect(screen.getByTestId("invoice-timeline")).toHaveTextContent("venceu há 24 dias (10/09)");
    expect(screen.getByTestId("invoice-timeline")).toHaveTextContent("em atraso");
    expect(screen.getByTestId("mark-paid")).toBeInTheDocument();
    first.unmount();

    routeParams = { cardId: CARD_PUBLIC_ID, year: "2026", month: "8" };
    renderPage();
    await screen.findByTestId("paid-note");
    expect(screen.getByTestId("paid-note")).toHaveTextContent("Fatura paga em 09/08");
    expect(screen.getByTestId("unmark-paid")).toBeInTheDocument();
    expect(screen.queryByTestId("mark-paid")).toBeNull();
  });

  it("fatura prevista sem fatura real (404 do detalhe) usa future-commitments e não oferece pagar", async () => {
    const calls = mockApi();
    routeParams = { cardId: CARD_PUBLIC_ID, year: "2026", month: "11" };
    renderPage();
    await screen.findByTestId("forecast-installments");

    expect(screen.getByTestId("invoice-total")).toHaveTextContent("6.050,28");
    expect(screen.getByTestId("invoice-card-2026-11")).toHaveTextContent("7 parcelas já garantidas");
    expect(screen.getByTestId("forecast-installments")).toHaveTextContent("Celular");
    expect(screen.queryByTestId("pay-controls")).toBeNull();
    expect(screen.queryByTestId("export-csv")).toBeNull();
    expect(calls.filter((c) => /invoices\/2026\/11$/.test(c))).toHaveLength(1);
  });

  it("fatura posterior à aberta que já existe no servidor (compra futura/parcelas) mostra a fatura real, ainda como Prevista", async () => {
    mockApi({ detail: { ...DETAILS, "2026/11": () => detailFixture({ month: "2026-11", due_date: "2026-11-10", total_amount: money("35.00"), items_count: 1, closing_date: "2026-11-03", days_until_due: 37, previous_month_total: null, month_over_month_change: null, limit_usage_percent: null, items: [item(9, "Padaria", "35.00", "2026-10-13")], category_breakdown: [] }) } });
    routeParams = { cardId: CARD_PUBLIC_ID, year: "2026", month: "11" };
    renderPage();
    await screen.findByTestId("invoice-count");

    expect(screen.getByTestId("invoice-card-2026-11")).toHaveAttribute("data-status", "forecast");
    expect(screen.getByTestId("invoice-total")).toHaveTextContent("35,00");
    expect(screen.getByTestId("invoice-total")).not.toHaveTextContent("6.050,28");
    expect(screen.getByTestId("recent-items")).toHaveTextContent("Padaria");
    expect(screen.queryByTestId("pay-controls")).toBeNull();
  });

  it("fatura prevista que future-commitments zera e o servidor desconhece é 'Sem lançamentos', nunca R$ 0,00", async () => {
    mockApi({
      future: {
        ...futureFixture(),
        monthly_breakdown: [{ year: 2026, month: 11, month_name: "novembro", total_amount: money("0.00"), limit_usage_percent: null, installments_count: 0, top_installments: [] }],
      },
    });
    routeParams = { cardId: CARD_PUBLIC_ID, year: "2026", month: "11" };
    renderPage();
    await waitFor(() => expect(screen.getByTestId("invoice-total")).toHaveTextContent("Sem lançamentos"));
    expect(screen.getByTestId("invoice-total")).not.toHaveTextContent("R$");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("InvoiceDashboardPage — orçamento de chamadas", () => {
  it("carrega com lista, histórico, futuras e UM detalhe, mesmo com 5 cartões, sem /current", async () => {
    const cards = [1, 2, 3, 4, 5].map((id) => cardFixture({ id, last4: String(7000 + id) }));
    const calls = mockApi({ cards });
    renderPage();
    await screen.findByTestId("invoice-count");
    await new Promise((r) => setTimeout(r, 50));

    expect(calls.filter((c) => c.includes("/credit-cards")).sort()).toEqual([
      "GET /v1/credit-cards",
      "GET /v1/credit-cards/1/future-commitments",
      "GET /v1/credit-cards/1/invoices/2026/10",
      "GET /v1/credit-cards/1/invoices/history",
    ]);
  });

  it("o detalhe de outra fatura só é buscado ao selecioná-la, e cada fatura é buscada uma vez", async () => {
    const calls = mockApi();
    const view = renderPage();
    await screen.findByTestId("invoice-count");
    const detailCalls = () => calls.filter((c) => /invoices\/\d{4}\/\d+$/.test(c));
    expect(detailCalls()).toEqual(["GET /v1/credit-cards/1/invoices/2026/10"]);

    routeParams = { cardId: CARD_PUBLIC_ID, year: "2026", month: "9" };
    view.rerender(<InvoiceDashboardPage organizationId={ORG} dataMode="live" />);
    await waitFor(() => expect(screen.getByTestId("invoice-card-2026-09")).toHaveAttribute("data-status", "closed"));
    await waitFor(() => expect(screen.getByTestId("invoice-count")).toHaveTextContent("58 lançamentos"));
    expect(detailCalls()).toHaveLength(2);

    routeParams = { cardId: CARD_PUBLIC_ID, year: "2026", month: "10" };
    view.rerender(<InvoiceDashboardPage organizationId={ORG} dataMode="live" />);
    await waitFor(() => expect(screen.getByTestId("invoice-count")).toHaveTextContent("62 lançamentos"));
    expect(detailCalls()).toHaveLength(2);
  });
});

describe("InvoiceDashboardPage — navegação entre faturas (desktop)", () => {
  it("setas e seletor navegam pela URL da fatura vizinha, em ordem cronológica", async () => {
    mockApi();
    const user = userEvent.setup();
    renderPage();
    await readyDesktop();
    await screen.findByTestId("invoice-count");

    await user.click(screen.getByTestId("invoice-prev"));
    expect(navigateMock).toHaveBeenLastCalledWith({ to: `/cards/${CARD_PUBLIC_ID}/invoices/2026/9`, replace: true });
    await user.click(screen.getByTestId("invoice-next"));
    expect(navigateMock).toHaveBeenLastCalledWith({ to: `/cards/${CARD_PUBLIC_ID}/invoices/2026/11`, replace: true });

    await user.selectOptions(screen.getByTestId("invoice-select"), "2026-08");
    expect(navigateMock).toHaveBeenLastCalledWith({ to: `/cards/${CARD_PUBLIC_ID}/invoices/2026/8`, replace: true });

    const labels = within(screen.getByTestId("invoice-select")).getAllByRole("option").map((o) => o.textContent);
    expect(labels[0]).toMatch(/Dezembro 2026 · Prevista/);
    expect(labels.find((l) => l.startsWith("Outubro 2026"))).toMatch(/Aberta · R\$.*8\.129,51/);
  });

  it("não há seta além da última fatura prevista", async () => {
    mockApi();
    routeParams = { cardId: CARD_PUBLIC_ID, year: "2026", month: "12" };
    renderPage();
    await readyDesktop();
    expect(screen.getByTestId("invoice-next")).toBeDisabled();
  });
});

describe("InvoiceDashboardPage — marcar como paga", () => {
  it("marca como paga com a data escolhida e atualiza a tela sem voltar para 'Carregando'", async () => {
    const calls = mockApi();
    const user = userEvent.setup();
    const sawLoading = [];
    renderPage();
    await screen.findByTestId("invoice-count");
    const observer = new MutationObserver(() => {
      if (document.body.textContent.includes("Carregando fatura")) sawLoading.push(true);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    await user.click(screen.getByRole("button", { name: /Data do pagamento/ }));
    await user.click(within(screen.getByRole("dialog", { name: "Calendário" })).getByRole("button", { name: "3", exact: true }));
    await user.click(screen.getByTestId("mark-paid"));

    await screen.findByTestId("paid-note");
    expect(screen.getByTestId("paid-note")).toHaveTextContent("Fatura paga em 03/10");
    expect(within(screen.getByTestId("invoice-card-2026-10")).getByTestId("invoice-status")).toHaveTextContent("Paga");
    expect(calls).toContain("PATCH /v1/credit-cards/1/invoices/2026/10/mark-paid");
    expect(screen.getByTestId("invoice-total")).toHaveTextContent("8.129,51");

    await waitFor(() => expect(calls.filter((c) => c.endsWith("/invoices/2026/10")).length).toBe(2));
    observer.disconnect();
    expect(sawLoading).toEqual([]);
  });

  it("envia a data escolhida no corpo e não aceita data futura", async () => {
    mockApi();
    let body = null;
    server.use(http.patch("*/v1/credit-cards/:id/invoices/:year/:month/mark-paid", async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ card_id: 1, year: 2026, month: 10, status: "paid", paid_date: body.paid_date });
    }));
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("invoice-count");

    await user.click(screen.getByRole("button", { name: /Data do pagamento/ }));
    const calendar = screen.getByRole("dialog", { name: "Calendário" });
    expect(within(calendar).getByRole("button", { name: "9", exact: true })).toHaveAttribute("aria-disabled", "true");
    await user.click(within(calendar).getByRole("button", { name: "2", exact: true }));
    expect(screen.getByRole("button", { name: /Data do pagamento/ })).toHaveAttribute("data-date-value", "2026-10-02");
    await user.click(screen.getByTestId("mark-paid"));
    await waitFor(() => expect(body).toEqual({ paid_date: "2026-10-02" }));
  });

  it("em falha mostra o erro e preserva a fatura como estava", async () => {
    mockApi({ patch: { status: 400, detail: "paid_date is in the future" } });
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("invoice-count");

    await user.click(screen.getByTestId("mark-paid"));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent.length).toBeGreaterThan(0);
    expect(within(screen.getByTestId("invoice-card-2026-10")).getByTestId("invoice-status")).toHaveTextContent("Aberta");
    expect(screen.getByTestId("invoice-total")).toHaveTextContent("8.129,51");
    expect(screen.getByTestId("mark-paid")).toBeEnabled();
    expect(screen.queryByTestId("paid-note")).toBeNull();
  });

  it("desmarca o pagamento e volta ao status do servidor", async () => {
    mockApi();
    routeParams = { cardId: CARD_PUBLIC_ID, year: "2026", month: "8" };
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("paid-note");

    await user.click(screen.getByTestId("unmark-paid"));
    await screen.findByTestId("mark-paid");
    expect(screen.queryByTestId("paid-note")).toBeNull();
    expect(within(screen.getByTestId("invoice-card-2026-08")).getByTestId("invoice-status")).toHaveTextContent("Fechada");
  });

  it("falha ao desmarcar mantém a fatura paga e mostra o erro", async () => {
    mockApi({ patch: { status: 500 } });
    routeParams = { cardId: CARD_PUBLIC_ID, year: "2026", month: "8" };
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("paid-note");

    await user.click(screen.getByTestId("unmark-paid"));
    await screen.findByRole("alert");
    expect(screen.getByTestId("paid-note")).toBeInTheDocument();
    expect(within(screen.getByTestId("invoice-card-2026-08")).getByTestId("invoice-status")).toHaveTextContent("Paga");
  });
});

describe("InvoiceDashboardPage — exportar CSV", () => {
  it("baixa o CSV da fatura selecionada", async () => {
    mockApi();
    let blob = null;
    URL.createObjectURL = vi.fn((b) => { blob = b; return "blob:x"; });
    URL.revokeObjectURL = vi.fn();
    const clicked = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function recordClick() { clicked.push(this.download); });
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("invoice-count");

    await user.click(screen.getByTestId("export-csv"));

    expect(clicked).toEqual(["fatura-Azul-2026-10.csv"]);
    const text = await blob.text();
    const lines = text.split("\n");
    expect(lines[0]).toBe("Descrição,Categoria,Valor,Data,Parcela,Recorrente");
    expect(lines).toHaveLength(7);
    expect(lines.find((l) => l.includes("Supermercado Extra"))).toContain('"412,30"');
    click.mockRestore();
  });
});

describe("InvoiceDashboardPage — estados de borda", () => {
  it("fatura sem lançamentos (404 do detalhe) é estado vazio, nunca erro", async () => {
    mockApi({ detail: {} });
    renderPage();
    await screen.findByTestId("invoice-empty");

    expect(screen.getByTestId("invoice-empty")).toHaveTextContent("A fatura aberta ainda não recebeu compras.");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByTestId("pay-controls")).toBeNull();
    expect(screen.getByTestId("invoice-total")).toHaveTextContent("Sem lançamentos");
    expect(screen.getByTestId("invoice-total")).not.toHaveTextContent("R$");
  });

  it("falha do detalhe mostra erro e permite tentar de novo", async () => {
    mockApi({ detail: "fail" });
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("alert");
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar esta fatura.");

    mockApi();
    await user.click(screen.getByTestId("invoice-retry"));
    await screen.findByTestId("invoice-count");
  });

  it("cartão que não existe na organização leva ao estado de erro com volta ao Hub", async () => {
    mockApi({ cards: [cardFixture({ id: 99 })] });
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("invoice-dashboard-error");

    expect(screen.getByRole("alert")).toHaveTextContent("Cartão não encontrado ou sem acesso.");
    await user.click(screen.getByTestId("back-to-cards"));
    expect(navigateMock).toHaveBeenCalledWith({ to: "/cards", search: { view: "new", card: CARD_PUBLIC_ID } });
  });

  it("sem acesso à organização (403) também é erro claro com volta ao Hub", async () => {
    mockApi({ listStatus: 403 });
    renderPage();
    await screen.findByTestId("invoice-dashboard-error");
    expect(screen.getByRole("alert")).toHaveTextContent("Cartão não encontrado ou sem acesso.");
    expect(screen.getByTestId("back-to-cards")).toBeInTheDocument();
  });

  it("não mostra 'Carregando' de novo ao trocar de fatura já em cache", async () => {
    mockApi();
    const view = renderPage();
    await screen.findByTestId("invoice-count");
    routeParams = { cardId: CARD_PUBLIC_ID, year: "2026", month: "9" };
    view.rerender(<InvoiceDashboardPage organizationId={ORG} dataMode="live" />);
    await waitFor(() => expect(screen.getByTestId("invoice-count")).toHaveTextContent("58 lançamentos"));
  });
});

describe("InvoiceDashboardPage — mobile", () => {
  it("cada item do carrossel é o card da fatura; só o selecionado traz o detalhe completo", async () => {
    const calls = mockApi();
    renderPage({ isMobile: true });
    await screen.findByTestId("invoice-count");

    const keys = Array.from(document.querySelectorAll('[data-testid^="invoice-card-"]')).map((e) => e.getAttribute("data-testid"));
    expect(keys).toEqual(["invoice-card-2026-08", "invoice-card-2026-09", "invoice-card-2026-10", "invoice-card-2026-11", "invoice-card-2026-12"]);
    expect(screen.getByTestId("invoice-card-2026-10")).toHaveAttribute("data-selected", "true");
    expect(within(screen.getByTestId("invoice-card-2026-10")).getByTestId("mark-paid")).toBeInTheDocument();
    expect(screen.getAllByTestId("mark-paid")).toHaveLength(1);
    expect(screen.getAllByTestId("invoice-timeline")).toHaveLength(1);

    const sept = screen.getByTestId("invoice-card-2026-09");
    expect(sept).toHaveTextContent("6.940,00");
    expect(sept).toHaveTextContent("58 lançamentos");
    expect(within(sept).queryByTestId("export-csv")).toBeNull();
    expect(calls.filter((c) => /invoices\/\d{4}\/\d+$/.test(c))).toHaveLength(1);
    expect(screen.getByTestId("invoice-dots")).toBeInTheDocument();
    expect(screen.queryByText(/ver todas as faturas/i)).toBeNull();
  });

  it("tocar em outra fatura do carrossel navega para ela", async () => {
    mockApi();
    const user = userEvent.setup();
    renderPage({ isMobile: true });
    await screen.findByTestId("invoice-count");

    await user.click(screen.getByTestId("invoice-card-2026-09"));
    expect(navigateMock).toHaveBeenLastCalledWith({ to: `/cards/${CARD_PUBLIC_ID}/invoices/2026/9`, replace: true });
  });

  it("o card de categorias abre um bottom sheet com o detalhe completo", async () => {
    mockApi();
    const user = userEvent.setup();
    renderPage({ isMobile: true });
    await screen.findByTestId("category-breakdown");

    await user.click(screen.getByTestId("category-open-sheet"));
    const sheet = screen.getByRole("dialog", { name: "Por categoria" });
    expect(within(sheet).getAllByTestId("category-row")).toHaveLength(7);
    expect(sheet).toHaveTextContent("Educação");
    expect(sheet).toHaveTextContent("1 lançamento");
    await user.click(within(sheet).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
