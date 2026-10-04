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
    http.get("*/v1/credit-cards", () => HttpResponse.json(cards)),
    http.get("*/v1/credit-cards/:id/invoices/history", () => (history === "fail"
      ? HttpResponse.json({ detail: "boom" }, { status: 500 })
      : HttpResponse.json(history ?? historyFixture()))),
    http.get("*/v1/credit-cards/:id/invoices/current", () => (current === "empty"
      ? HttpResponse.json({ detail: "Invoice not found" }, { status: 404 })
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

const cardsInOrder = () => Array.from(document.querySelectorAll('[data-testid^="invoice-card-"]'));
const statusOf = (el) => el.getAttribute("data-status");

async function waitForCarousel() {
  await screen.findByTestId("invoice-carousel");
}

describe("CardHubPage — carrossel de faturas", () => {
  it("mostra passadas, atual e futuras em ordem cronológica, com os 4 status distintos", async () => {
    mockApi();
    renderHub();
    await waitForCarousel();

    expect(cardsInOrder().map((el) => [el.getAttribute("data-testid"), statusOf(el)])).toEqual([
      ["invoice-card-2026-08", "paid"],
      ["invoice-card-2026-09", "closed"],
      ["invoice-card-2026-10", "open"],
      ["invoice-card-2026-11", "forecast"],
      ["invoice-card-2026-12", "forecast"],
    ]);
    const labelOf = (key) => within(screen.getByTestId(`invoice-card-${key}`)).getByTestId("invoice-status").textContent;
    expect(["2026-08", "2026-09", "2026-10", "2026-11"].map(labelOf)).toEqual(["Paga", "Fechada", "Aberta", "Prevista"]);
    expect(screen.getByTestId("invoice-counts")).toHaveTextContent("1 paga · 1 fechada · 1 aberta · 2 previstas");
  });

  it("abre com a fatura aberta selecionada e troca a seleção ao clicar em outra", async () => {
    mockApi();
    const user = userEvent.setup();
    renderHub();
    await waitForCarousel();

    expect(screen.getByTestId("invoice-card-2026-10")).toHaveAttribute("data-selected", "true");
    await user.click(screen.getByTestId("invoice-card-2026-12"));
    expect(screen.getByTestId("invoice-card-2026-12")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("invoice-card-2026-10")).toHaveAttribute("data-selected", "false");
  });

  it("escreve o dinheiro de cada fatura na moeda do cartão", async () => {
    mockApi({
      cards: [cardFixture({ currency: "EUR", credit_limit: money("1000.00", "EUR"), available_limit: money("600.00", "EUR"), used_limit: money("400.00", "EUR") })],
      history: { ...historyFixture(), monthly_data: [histRow(2026, 9, "paid", "250.00", 3)].map((r) => ({ ...r, total_amount: money("250.00", "EUR") })) },
      current: currentFixture({ total_amount: money("123.45", "EUR") }),
      future: futureFixture({ monthly_breakdown: [] }),
    });
    renderHub();
    await waitForCarousel();

    expect(screen.getByTestId("invoice-card-2026-10")).toHaveTextContent("€");
    expect(screen.getByTestId("invoice-card-2026-10")).not.toHaveTextContent("R$");
    expect(screen.getByTestId("kpi-available")).toHaveTextContent("€");
  });

  it("fatura aberta sem lançamentos (404) é estado vazio, não erro", async () => {
    mockApi({ current: "empty", history: { ...historyFixture(), monthly_data: [histRow(2026, 9, "paid", "6940.00", 58)] } });
    renderHub();
    await waitForCarousel();

    const open = screen.getByTestId("invoice-card-2026-10");
    expect(open).toHaveAttribute("data-status", "open");
    expect(open).toHaveTextContent("Sem lançamentos ainda");
    expect(open).not.toHaveTextContent("R$");
    expect(screen.queryByText(/não puderam ser carregadas/i)).toBeNull();
  });

  it("se o histórico falha, avisa e ainda mostra a atual e as futuras", async () => {
    mockApi({ history: "fail" });
    renderHub();
    await waitForCarousel();

    expect(screen.getByText(/não puderam ser carregadas/i)).toBeInTheDocument();
    expect(cardsInOrder().map(statusOf)).toEqual(["open", "forecast", "forecast"]);
  });

  it("o link do dashboard da fatura aponta para /cards/<id>/invoices/<ano>/<mês> e navega sem recarregar", async () => {
    mockApi();
    const user = userEvent.setup();
    renderHub();
    await waitForCarousel();

    const link = within(screen.getByTestId("invoice-card-2026-09")).getByTestId("invoice-dashboard-link");
    expect(link).toHaveAttribute("href", "/cards/1/invoices/2026/9");
    await user.click(link);
    expect(navigateMock).toHaveBeenCalledWith({ to: "/cards/1/invoices/2026/9" });
  });
});

describe("CardHubPage — KPIs e insights", () => {
  it("exibe Score de saúde, Velocidade de gasto e Melhor dia calculados pela heurística existente", async () => {
    mockApi();
    renderHub();
    await waitForCarousel();

    // limite 10000, usado 3500 (35%), parcelas da fatura aberta: nenhuma => score 65; fechamento dia 15 => melhor dia 16
    expect(screen.getByText("Score de saúde")).toBeInTheDocument();
    expect(screen.getByText("65")).toBeInTheDocument();
    expect(screen.getByText("Regular")).toBeInTheDocument();
    expect(screen.getByText("Velocidade de gasto")).toBeInTheDocument();
    expect(screen.getByText(/Avançamos 60% do mês/)).toBeInTheDocument();
    expect(screen.getByText(/81% do limite gasto/)).toBeInTheDocument();
    expect(screen.getByText("Melhor dia para compras")).toBeInTheDocument();
    expect(screen.getByText("Dia 16")).toBeInTheDocument();
  });

  it("só mostra Insights quando o backend os entrega, com o texto dele", async () => {
    mockApi({ future: futureFixture({ insights: [{ type: "limit_warning", icon: "warning", message: "Dezembro usa 82% do limite." }] }) });
    renderHub();
    await waitForCarousel();
    expect(screen.getByTestId("insights-list")).toHaveTextContent("Dezembro usa 82% do limite.");
  });

  it("omite a seção de Insights quando não há dado", async () => {
    mockApi();
    renderHub();
    await waitForCarousel();
    expect(screen.queryByText(/Insights/)).toBeNull();
  });
});

describe("CardHubPage — anotação do cartão", () => {
  it("lê a anotação existente e salva via PATCH com {notes}", async () => {
    const patched = mockApi();
    const user = userEvent.setup();
    renderHub();
    await waitForCarousel();

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
    await waitForCarousel();

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
    await waitForCarousel();

    await user.click(screen.getByTestId("card-notes-open"));
    const textarea = screen.getByTestId("card-notes-textarea");
    await user.clear(textarea);
    await user.type(textarea, "texto que não pode se perder");
    await user.click(screen.getByTestId("card-notes-save"));

    expect(await screen.findByTestId("card-notes-error")).toBeInTheDocument();
    expect(screen.getByTestId("card-notes-textarea")).toHaveValue("texto que não pode se perder");
  });
});

describe("CardHubPage — todas as faturas e tela anterior", () => {
  it("desktop: lista completa num diálogo; escolher uma linha seleciona a fatura no carrossel", async () => {
    mockApi();
    const user = userEvent.setup();
    renderHub();
    await waitForCarousel();

    await user.click(screen.getByTestId("all-invoices-open-button"));
    const dialog = screen.getByRole("dialog", { name: "Todas as faturas" });
    expect(within(dialog).getByTestId("all-invoices-list").children).toHaveLength(5);
    // mais recente primeiro
    expect(within(dialog).getByTestId("all-invoices-list").firstElementChild).toHaveAttribute("data-testid", "all-invoices-row-2026-12");

    await user.click(within(dialog).getByTestId("all-invoices-row-2026-08").querySelector("button"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("invoice-card-2026-08")).toHaveAttribute("data-selected", "true");
  });

  it("o link discreto leva para /cards?view=classic", async () => {
    mockApi();
    const user = userEvent.setup();
    renderHub();
    await waitForCarousel();

    await user.click(screen.getByTestId("classic-view-link"));
    const arg = navigateMock.mock.calls[0][0];
    expect(arg.to).toBe("/cards");
    expect(arg.search({ fc_tx: "9" })).toEqual({ fc_tx: "9", view: "classic" });
  });
});

describe("CardHubPage — mobile", () => {
  it("usa pontos de posição, tira compacta de KPIs e bottom sheet para todas as faturas", async () => {
    mockApi({ future: futureFixture({ insights: [{ type: "best_month", icon: "x", message: "Janeiro é o mês mais leve." }] }) });
    const user = userEvent.setup();
    renderHub({ isMobile: true });
    await waitForCarousel();

    const dots = screen.getByTestId("invoice-dots");
    expect(dots.children).toHaveLength(5);
    expect(dots.querySelector('[data-active="true"]')).toBe(dots.children[2]);
    expect(screen.getByTestId("compact-kpis")).toBeInTheDocument();
    expect(screen.queryByText("Velocidade de gasto")).toBeNull();

    // o carrossel é nativo e o wrapper pode encolher (senão a página inteira ganha rolagem horizontal)
    const carousel = screen.getByTestId("invoice-carousel");
    expect(carousel.parentElement.style.minWidth).toBe("0px");
    expect(carousel.style.scrollSnapType).toBe("x mandatory");

    await user.click(screen.getByRole("button", { name: "Insights" }));
    expect(screen.getByRole("dialog", { name: "Insights" })).toHaveTextContent("Janeiro é o mês mais leve.");
    await user.click(screen.getByRole("button", { name: "Fechar" }));

    await user.click(screen.getByTestId("all-invoices-open-button"));
    expect(screen.getByRole("dialog", { name: "Todas as faturas" })).toBeInTheDocument();
  });
});

describe("CardHubPage — sem cartões", () => {
  it("convida a cadastrar o primeiro cartão (na tela anterior)", async () => {
    mockApi({ cards: [] });
    renderHub();
    expect(await screen.findByText(/ainda não cadastrou nenhum cartão/i)).toBeInTheDocument();
  });
});
