/** @vitest-environment jsdom */

import React from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const navigateMock = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
  useSearch: () => ({}),
}));

import { CardHubPage } from "../CardHubPage.jsx";

const ORG = "11111111-1111-4111-8111-111111111111";
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 4, 12, 0, 0));
  navigateMock.mockReset();
});
afterEach(() => {
  server.resetHandlers();
  cleanup();
  vi.useRealTimers();
});

const money = (amount, currency = "BRL") => ({ amount, currency });

const cardFixture = (over = {}) => ({
  id: 1,
  organization_id: ORG,
  last4: "7112",
  brand: "Visa",
  due_day: 10,
  closing_day: 15,
  description: "Azul",
  color: "#1a1a2e",
  notes: "Pedir aumento de limite em dezembro.",
  account_id: "22222222-2222-4222-8222-222222222222",
  currency: "BRL",
  credit_limit: money("10000.00"),
  available_limit: money("6500.00"),
  used_limit: money("3500.00"),
  limit_usage_percent: 35,
  ...over,
});

const histRow = (year, month, status, total, items) => ({
  year, month, month_name: "", total_amount: money(total), status, items_count: items, top_category: "Alimentação",
});

const historyFixture = () => ({
  card_id: 1,
  card_name: "Azul",
  period_start: "2026-05-01",
  period_end: "2026-10-31",
  summary: { total_spent: money("0"), average_monthly: money("0"), highest_month: null, lowest_month: null },
  monthly_data: [
    histRow(2026, 8, "paid", "7340.00", 51),
    histRow(2026, 9, "closed", "6940.00", 58),
    histRow(2026, 10, "open", "8129.51", 62),
  ],
});

const currentFixture = (over = {}) => ({
  month: "2026-10",
  due_date: "2026-10-10",
  total_amount: money("8129.51"),
  status: "open",
  items: [],
  closing_date: "2026-10-15",
  days_until_due: 6,
  is_overdue: false,
  paid_date: null,
  previous_month_total: money("6940.00"),
  month_over_month_change: 17.1,
  limit_usage_percent: 65,
  items_count: 62,
  category_breakdown: [],
  ...over,
});

const futureFixture = (over = {}) => ({
  card_id: 1,
  card_name: "Azul",
  card_last4: "7112",
  credit_limit: money("10000.00"),
  current_available_limit: money("6500.00"),
  summary: { total_committed: money("0"), average_monthly: money("0"), lowest_month: null, highest_month: null },
  monthly_breakdown: [
    { year: 2026, month: 11, month_name: "novembro", total_amount: money("6050.28"), limit_usage_percent: 20, installments_count: 7, top_installments: [] },
    { year: 2026, month: 12, month_name: "dezembro", total_amount: money("5050.27"), limit_usage_percent: 15, installments_count: 5, top_installments: [] },
  ],
  ending_soon: [],
  insights: [],
  ...over,
});

/** Backend de mentira na camada HTTP: o cliente, o adapter e o hook reais rodam por cima. */
function mockApi({ cards = [cardFixture()], history, current, future, patch } = {}) {

  const patched = [];
  server.use(
    http.get("*/v1/credit-cards", () => (cards === "fail"
      ? HttpResponse.json({ detail: "boom" }, { status: 500 })
      : HttpResponse.json(cards))),
    http.get("*/v1/credit-cards/:id/invoices/history", () => (history === "fail"
      ? HttpResponse.json({ detail: "boom" }, { status: 500 })
      : HttpResponse.json(history ?? historyFixture()))),
    http.get("*/v1/credit-cards/:id/invoices/current", () => (current === "empty"
      ? HttpResponse.json({ detail: "Invoice not found" }, { status: 404 })
      : current === "fail"
        ? HttpResponse.json({ detail: "boom" }, { status: 500 })
        : HttpResponse.json(current ?? currentFixture()))),
    http.get("*/v1/credit-cards/:id/future-commitments", () => HttpResponse.json(future ?? futureFixture())),
    http.patch("*/v1/credit-cards/:id", async ({ request }) => {
      const body = await request.json();
      patched.push({ url: new URL(request.url), body });
      if (patch === "fail") return HttpResponse.json({ detail: "falha no servidor" }, { status: 500 });
      return HttpResponse.json({ ...cards[0], notes: body.notes === "" ? null : body.notes });
    }),
  );
  return patched;
}

const renderHub = (props = {}) => render(
  <CardHubPage organizationId={ORG} dataMode="live" onNewItem={vi.fn()} {...props} />,
);

const currentPanel = () => screen.getByTestId("hub-current-invoice");
const otherRows = () => screen.getByTestId("hub-other-invoices");

describe("CardHubPage — faturas do Hub", () => {
  it("destaca a aberta, mostra quatro estados reais e expande outras faturas inline", async () => {
    mockApi();
    renderHub();
    expect(await screen.findByTestId("hub-current-invoice")).toHaveAttribute("data-status", "open");
    expect(currentPanel()).toHaveTextContent("Outubro 2026");
    expect(currentPanel()).toHaveTextContent("17% vs mês anterior");
    expect(currentPanel()).toHaveTextContent("Limite utilizado");
    expect(currentPanel()).toHaveTextContent("65%");
    expect(otherRows()).toHaveTextContent("Fechada");
    expect(otherRows()).toHaveTextContent("Paga");
    expect(otherRows()).toHaveTextContent("Prevista");
    expect([...otherRows().querySelectorAll("a")].map((row) => row.getAttribute("href"))).toEqual([
      "/cards/1/invoices/2026/9", "/cards/1/invoices/2026/8",
      "/cards/1/invoices/2026/11", "/cards/1/invoices/2026/12",
    ]);
    expect(screen.getByTestId("invoice-counts")).toHaveTextContent("1 paga · 1 fechada · 1 aberta · 2 previstas");
    expect(screen.queryByRole("dialog", { name: "Todas as faturas" })).toBeNull();
  });

  it("expande e recolhe a lista no card e cada linha abre o dashboard", async () => {
    const history = { ...historyFixture(), monthly_data: [
      histRow(2026, 5, "paid", "100", 1), histRow(2026, 6, "paid", "200", 1),
      ...historyFixture().monthly_data,
    ] };
    mockApi({ history });
    const user = userEvent.setup();
    renderHub();
    await screen.findByTestId("hub-current-invoice");
    expect(otherRows().querySelectorAll("a")).toHaveLength(4);
    await user.click(screen.getByRole("button", { name: /outras faturas/ }));
    expect(otherRows().querySelectorAll("a")).toHaveLength(6);
    const link = otherRows().querySelector('a[href="/cards/1/invoices/2026/9"]');
    expect(link).not.toBeNull();
    await user.click(link);
    expect(navigateMock).toHaveBeenCalledWith({ to: "/cards/1/invoices/2026/9" });
    await user.click(screen.getByRole("button", { name: "Mostrar menos" }));
    expect(otherRows().querySelectorAll("a")).toHaveLength(4);
  });

  it("marca fatura pagável com data escolhida e atualiza status e histórico sem nova lista de cartões", async () => {
    let paid = false;
    let paidDate = null;
    const requests = [];
    mockApi();
    server.use(
      http.get("*/v1/credit-cards/:id/invoices/history", () => HttpResponse.json(paid ? {
        ...historyFixture(), monthly_data: historyFixture().monthly_data.map((row) => row.month === 10 ? { ...row, status: "paid" } : row),
      } : historyFixture())),
      http.get("*/v1/credit-cards/:id/invoices/current", () => HttpResponse.json(paid ? currentFixture({ status: "paid", paid_date: paidDate }) : currentFixture())),
      http.patch("*/v1/credit-cards/:id/invoices/:year/:month/mark-paid", async ({ request, params }) => {
        requests.push({ url: new URL(request.url), params, body: await request.json() });
        paidDate = requests.at(-1).body.paid_date;
        paid = true;
        return HttpResponse.json({ card_id: 1, year: 2026, month: 10, status: "paid", paid_date: paidDate });
      }),
    );
    const user = userEvent.setup();
    renderHub();
    await screen.findByTestId("hub-current-invoice");
    await user.clear(screen.getByLabelText("Data do pagamento"));
    await user.type(screen.getByLabelText("Data do pagamento"), "2026-10-03");
    await user.click(screen.getByRole("button", { name: /Marcar como paga/ }));
    await waitFor(() => expect(currentPanel()).toHaveAttribute("data-status", "paid"));
    expect(requests).toHaveLength(1);
    expect(requests[0].body).toEqual({ paid_date: "2026-10-03" });
    expect(requests[0].url.searchParams.get("organization_id")).toBe(ORG);
    expect(screen.queryByRole("button", { name: /Marcar como paga/ })).toBeNull();
    expect(screen.getByTestId("invoice-counts")).toHaveTextContent("2 pagas");
  });

  it("pagamento pendente não altera o cartão selecionado depois da troca", async () => {
    let finishPayment;
    mockApi({ cards: [cardFixture(), cardFixture({ id: 2, last4: "4420", description: "Roxo" })] });
    server.use(http.patch("*/v1/credit-cards/:id/invoices/:year/:month/mark-paid", async () => {
      await new Promise((resolve) => { finishPayment = resolve; });
      return HttpResponse.json({ card_id: 1, year: 2026, month: 10, status: "paid", paid_date: "2026-10-04" });
    }));
    const user = userEvent.setup();
    renderHub();
    await screen.findByTestId("hub-current-invoice");
    await user.click(screen.getByRole("button", { name: /Marcar como paga/ }));
    await waitFor(() => expect(finishPayment).toBeTypeOf("function"));
    await user.click(screen.getByText("Roxo"));
    await waitFor(() => expect(screen.getByText("Cartão selecionado:")).toHaveTextContent("Roxo"));
    finishPayment();
    await waitFor(() => expect(currentPanel()).toHaveAttribute("data-status", "open"));
    await waitFor(() => expect(screen.queryByText("Carregando faturas…")).toBeNull());
    expect(screen.getByRole("button", { name: /Marcar como paga/ })).toBeInTheDocument();
  });

  it("falha do pagamento preserva fatura e data para nova tentativa", async () => {
    mockApi();
    server.use(http.patch("*/v1/credit-cards/:id/invoices/:year/:month/mark-paid", () => HttpResponse.json({ detail: "error" }, { status: 500 })));
    const user = userEvent.setup();
    renderHub();
    await screen.findByTestId("hub-current-invoice");
    await user.click(screen.getByRole("button", { name: /Marcar como paga/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível marcar");
    expect(currentPanel()).toHaveAttribute("data-status", "open");
    expect(screen.getByLabelText("Data do pagamento")).toHaveValue("2026-10-04");
  });

  it("fatura atual paga não oferece pagamento; fechada não paga oferece", async () => {
    mockApi({ current: currentFixture({ status: "paid", paid_date: "2026-10-02" }) });
    const view = renderHub();
    await screen.findByTestId("hub-current-invoice");
    expect(currentPanel()).toHaveAttribute("data-status", "paid");
    expect(screen.queryByRole("button", { name: /Marcar como paga/ })).toBeNull();
    view.unmount();
    server.resetHandlers();
    mockApi({ current: currentFixture({ status: "closed" }) });
    renderHub();
    await screen.findByTestId("hub-current-invoice");
    expect(currentPanel()).toHaveAttribute("data-status", "closed");
    expect(screen.getByRole("button", { name: /Marcar como paga/ })).toBeInTheDocument();
  });

  it("sem fatura aberta e sem closing_day não inventa total nem oferece pagamento", async () => {
    mockApi({ cards: [cardFixture({ closing_day: null, due_day: null })], current: "empty", history: { ...historyFixture(), monthly_data: [] }, future: futureFixture({ monthly_breakdown: [] }) });
    renderHub();
    await screen.findByTestId("hub-current-invoice");
    expect(currentPanel()).toHaveTextContent("Sem lançamentos");
    expect(currentPanel()).not.toHaveTextContent("R$ 0");
    expect(screen.queryByRole("button", { name: /Marcar como paga/ })).toBeNull();
  });

  it("limita a carga inicial a quatro chamadas mesmo com vários cartões e meses", async () => {
    const requests = [];
    const onStart = ({ request }) => {
      const url = new URL(request.url);
      if (url.pathname.includes("/credit-cards")) requests.push(url.pathname);
    };
    server.events.on("request:start", onStart);
    try {
      mockApi({
        cards: Array.from({ length: 7 }, (_, index) => cardFixture({ id: index + 1 })),
        history: { ...historyFixture(), monthly_data: Array.from({ length: 12 }, (_, index) => histRow(2025, index + 1, "paid", "100", 1)) },
      });
      renderHub();
      await screen.findByTestId("hub-current-invoice");
      expect(requests).toHaveLength(4);
      expect(requests).toEqual(expect.arrayContaining([
        "/v1/credit-cards", "/v1/credit-cards/1/invoices/history",
        "/v1/credit-cards/1/invoices/current", "/v1/credit-cards/1/future-commitments",
      ]));
    } finally {
      server.events.removeListener("request:start", onStart);
    }
  });

  it("mobile mantém resumo e lista navegável", async () => {
    mockApi();
    renderHub({ isMobile: true });
    await screen.findByTestId("hub-current-invoice");
    expect(screen.getByTestId("compact-kpis")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-carousel")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-dots")).toBeInTheDocument();
    expect(screen.getByTestId("all-invoices-open-button")).toBeInTheDocument();
  });
});

describe("CardHubPage — KPIs e insights", () => {
  it("exibe Score de saúde, Velocidade de gasto (do ciclo real) e Melhor dia", async () => {
    mockApi();
    renderHub();
    await screen.findByTestId("hub-current-invoice");

    // limite 10000, usado 3500 (35%), parcelas da fatura aberta: nenhuma => score 65; fechamento dia 15 => melhor dia 16
    expect(screen.getByText("Score de saúde")).toBeInTheDocument();
    expect(screen.getByText("65")).toBeInTheDocument();
    expect(screen.getByText("Regular")).toBeInTheDocument();
    expect(screen.getByText("Velocidade de gasto")).toBeInTheDocument();
    // hoje 04/10, fechamento dia 15: ciclo 15/09-15/10 (30 dias), 19 decorridos = 63%
    expect(screen.getByText(/Avançamos 63% do ciclo/)).toBeInTheDocument();
    expect(screen.getByText(/81% do limite gasto/)).toBeInTheDocument();
    // 8129,51 / 19 * 30 = 12.836
    expect(screen.getByText(/Gasto acelerado/)).toHaveTextContent("12.836,00");
    expect(screen.getByText("Melhor dia para compras")).toBeInTheDocument();
    expect(screen.getByText("Dia 16")).toBeInTheDocument();
  });

  it("primeiro dia do ciclo ou fatura sem lançamentos: 'poucos dados', sem projeção inventada", async () => {
    mockApi({ current: "empty", history: { ...historyFixture(), monthly_data: [histRow(2026, 9, "paid", "6940.00", 58)] } });
    renderHub();
    await screen.findByTestId("hub-current-invoice");
    expect(screen.getByText(/Poucos dados ainda neste ciclo/)).toBeInTheDocument();
    expect(screen.queryByText(/Projeção/)).toBeNull();
  });

  it("fatura aberta ilegível: o score não é afirmado (sem parcelas, ele sairia inflado)", async () => {
    mockApi({ current: "fail" });
    renderHub();
    await screen.findByTestId("hub-current-invoice");
    expect(screen.getByText("Sem dados ainda")).toBeInTheDocument();
    expect(screen.queryByText("Regular")).toBeNull();
  });

  it("só mostra Insights quando o backend os entrega, com o texto dele", async () => {
    mockApi({ future: futureFixture({ insights: [{ type: "limit_warning", icon: "warning", message: "Dezembro usa 82% do limite." }] }) });
    renderHub();
    await screen.findByTestId("hub-current-invoice");
    expect(screen.getByTestId("insights-list")).toHaveTextContent("Dezembro usa 82% do limite.");
  });

  it("omite a seção de Insights quando não há dado", async () => {
    mockApi();
    renderHub();
    await screen.findByTestId("hub-current-invoice");
    expect(screen.queryByText(/Insights/)).toBeNull();
  });
});

describe("CardHubPage — anotação do cartão", () => {
  it("lê a anotação existente e salva via PATCH com {notes}", async () => {
    const patched = mockApi();
    const user = userEvent.setup();
    renderHub();
    await screen.findByTestId("hub-current-invoice");

    await user.click(screen.getByTestId("card-notes-open"));
    const textarea = screen.getByTestId("card-notes-textarea");
    expect(textarea).toHaveValue("Pedir aumento de limite em dezembro.");

    await user.clear(textarea);
    await user.type(textarea, "Trocar para o plano black");
    await user.click(screen.getByTestId("card-notes-save"));

    await waitFor(() => expect(patched).toHaveLength(1));
    expect(patched[0].body).toEqual({ notes: "Trocar para o plano black" });
    expect(patched[0].url.searchParams.get("organization_id")).toBe(ORG);
    await waitFor(() => expect(screen.queryByTestId("card-notes-textarea")).toBeNull());

    await user.click(screen.getByTestId("card-notes-open"));
    expect(screen.getByTestId("card-notes-textarea")).toHaveValue("Trocar para o plano black");
  });

  it("apagar o texto envia string vazia (limpa a anotação)", async () => {
    const patched = mockApi();
    const user = userEvent.setup();
    renderHub();
    await screen.findByTestId("hub-current-invoice");

    await user.click(screen.getByTestId("card-notes-open"));
    await user.clear(screen.getByTestId("card-notes-textarea"));
    await user.click(screen.getByTestId("card-notes-save"));
    await waitFor(() => expect(patched).toHaveLength(1));
    expect(patched[0].body).toEqual({ notes: "" });
  });

  it("se o salvamento falha, mostra o erro e NÃO apaga o texto digitado", async () => {
    mockApi({ patch: "fail" });
    const user = userEvent.setup();
    renderHub();
    await screen.findByTestId("hub-current-invoice");

    await user.click(screen.getByTestId("card-notes-open"));
    const textarea = screen.getByTestId("card-notes-textarea");
    await user.clear(textarea);
    await user.type(textarea, "texto que não pode se perder");
    await user.click(screen.getByTestId("card-notes-save"));

    expect(await screen.findByTestId("card-notes-error")).toBeInTheDocument();
    expect(screen.getByTestId("card-notes-textarea")).toHaveValue("texto que não pode se perder");
  });
});


const countRequests = () => {
  const seen = [];
  const onStart = ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname.includes("/credit-cards")) seen.push(`${request.method} ${url.pathname.replace(/\/credit-cards\/\d+/, "/credit-cards/:id")}`);
  };
  server.events.on("request:start", onStart);
  return { seen, stop: () => server.events.removeListener("request:start", onStart) };
};

describe("CardHubPage — navegação e atualização", () => {
  it("o link discreto leva para /cards sem view", async () => {
    mockApi();
    const user = userEvent.setup();
    renderHub();
    await screen.findByTestId("hub-current-invoice");

    await user.click(screen.getByTestId("classic-view-link"));
    const arg = navigateMock.mock.calls[0][0];
    expect(arg.to).toBe("/cards");
    expect(arg.search({ fc_tx: "9", view: "new" })).toEqual({ fc_tx: "9" });
  });

  it("convida a cadastrar o primeiro cartão (na tela anterior)", async () => {
    mockApi({ cards: [] });
    renderHub();
    expect(await screen.findByText(/ainda não cadastrou nenhum cartão/i)).toBeInTheDocument();
  });

  it("o refresh mantém o diálogo de anotação aberto e o rascunho digitado", async () => {
    mockApi();
    const user = userEvent.setup();
    const { rerender } = renderHub({ transactionsRefreshToken: 0 });
    await screen.findByTestId("hub-current-invoice");

    await user.click(screen.getByTestId("card-notes-open"));
    await user.clear(screen.getByTestId("card-notes-textarea"));
    await user.type(screen.getByTestId("card-notes-textarea"), "rascunho não salvo");

    const currentBefore = screen.getByTestId("hub-current-invoice");
    const counter = countRequests();
    rerender(<CardHubPage organizationId={ORG} dataMode="live" onNewItem={vi.fn()} transactionsRefreshToken={1} />);
    await waitFor(() => expect(counter.seen).toHaveLength(4));
    await new Promise((r) => setTimeout(r, 100));
    counter.stop();

    expect(screen.getByTestId("card-notes-textarea")).toHaveValue("rascunho não salvo");
    expect(screen.queryByText(/Carregando seus cartões/)).toBeNull();
    expect(screen.getByTestId("hub-current-invoice")).toBe(currentBefore);
    // um refresh = exatamente as 4 chamadas do Hub, sem duplicar
    expect(counter.seen.slice().sort()).toEqual([
      "GET /v1/credit-cards",
      "GET /v1/credit-cards/:id/future-commitments",
      "GET /v1/credit-cards/:id/invoices/current",
      "GET /v1/credit-cards/:id/invoices/history",
    ]);
  });

  it("refetch que falha com 500 mantém cartões e faturas e avisa discretamente", async () => {
    mockApi();
    const { rerender } = renderHub({ transactionsRefreshToken: 0 });
    await screen.findByTestId("hub-current-invoice");

    mockApi({ cards: "fail", history: "fail", current: "fail" });
    rerender(<CardHubPage organizationId={ORG} dataMode="live" onNewItem={vi.fn()} transactionsRefreshToken={1} />);

    expect(await screen.findByText(/Mostrando os dados anteriores/)).toBeInTheDocument();
    expect(screen.getByTestId("hub-current-invoice")).toHaveAttribute("data-status", "open");
    expect(screen.getByText("Cartão selecionado:")).toHaveTextContent("Azul");
  });
});
