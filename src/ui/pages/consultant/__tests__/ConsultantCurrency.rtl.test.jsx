// @vitest-environment jsdom

/**
 * #314 — a área do consultor escrevia "R$" em todo valor de cliente, inclusive no de
 * um cliente cuja organização é em dólar. A moeda vinha no fio (`{amount, currency}`)
 * e se perdia em `unwrapMoney`, na fronteira da API.
 *
 * Aqui o backend é de mentira só na camada HTTP (MSW): `src/api/consultant.ts`, os
 * adapters, os hooks e as telas são os de verdade. Cada tela é conferida com um
 * cliente em dólar (sai "US$", e nenhum "R$"), com um cliente em real (sai igual a
 * antes, byte a byte) e — nos agregados — com uma carteira mista.
 */
import React from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

let routeParams = { id: "org-usd" };
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => routeParams,
}));
vi.mock("../../../routing/finclaPageContext.jsx", () => ({
  useFinclaPages: () => ({ user: { name: "Helena Castro", email: "h@x.com" } }),
}));
vi.mock("../../../features/consultant/consultantAiAccess.js", () => ({
  useCanEvaluateClientWithAi: () => false,
  useCanSummarizePortfolioWithAi: () => false,
  useCanDetectTrendsWithAi: () => false,
  useCanUseCopilotoAi: () => true,
}));
// recharts precisa de ResizeObserver (ausente no jsdom). O eixo Y desenha um rótulo
// com o `tickFormatter` de verdade, para o símbolo do eixo também ser conferido.
vi.mock("recharts", () => {
  const passthrough = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: passthrough,
    ComposedChart: passthrough, LineChart: passthrough, BarChart: passthrough, PieChart: passthrough,
    CartesianGrid: () => null, Bar: () => null, Line: () => null, Area: () => null, Pie: () => null,
    Cell: () => null, Legend: () => null, Tooltip: () => null, XAxis: () => null,
    YAxis: ({ tickFormatter }) => <span data-testid="y-tick">{tickFormatter?.(2000, 1)}</span>,
  };
});

import { ConsultantClientsPage } from "../ConsultantClientsPage.jsx";
import { ConsultantPainelPage } from "../ConsultantPainelPage.jsx";
import { ConsultantClientReportPage } from "../ConsultantClientReportPage.jsx";
import { ConsultantInsightsPage } from "../ConsultantInsightsPage.jsx";
import { ConsultantProfilePage } from "../ConsultantProfilePage.jsx";
import { ConsultantCopilotoPage } from "../ConsultantCopilotoPage.jsx";
import { __resetStore } from "../../../features/consultant/copilotoStore.js";

const money = (amount, currency) => ({ amount, currency });
const NBSP = " ";

const clientRow = ({ id, name, currency, patrimonio = "12500.00", balance = "4200.00" }) => ({
  organization_id: id,
  organization_name: `Org ${name}`,
  role: "consultant",
  membership_created_at: "2026-01-01T00:00:00",
  client_name: name,
  health: 61,
  health_computed_at: "2026-06-30T03:12:44",
  balance: money(balance, currency),
  savings_pct: 12.5,
  debt_pct: 18,
  trend: "up",
  last_active: "2026-06-28",
  patrimonio: patrimonio == null ? null : money(patrimonio, currency),
  pending_activation: false,
});

const USD_CLIENT = clientRow({ id: "org-usd", name: "Rui Teixeira", currency: "USD" });
const BRL_CLIENT = clientRow({ id: "org-brl", name: "Marina Andrade", currency: "BRL", patrimonio: "82500.00" });

// Estado do backend de mentira, redefinido a cada teste.
let clients;
let readingCurrency;
let atRisk;
let copilotoBlocks;
// fincla-api#505: `null` = API anterior (sem recibo, soma só rotulada); "converted" =
// convertido com cotação; "unavailable" = convertido, mas faltou cotação.
let aggregates;

const receipt = () => (aggregates === "converted"
  ? { consolidation: { target_currency: readingCurrency, rates: [{ base: "USD", quote: readingCurrency, rate: "5.2500000000", quoted_on: "2026-06-30" }], unavailable: null } }
  : aggregates === "unavailable"
    ? { consolidation: { target_currency: readingCurrency, rates: [], unavailable: `USD/${readingCurrency}: sem cotação` } }
    : {});
const aggregateAmount = (value) => (aggregates === "unavailable" ? null : money(value, readingCurrency));

const server = setupServer(
  http.get("*/v1/consultant/clients", () =>
    HttpResponse.json({ total: clients.length, clients, health_pending: 0 })),
  http.get("*/v1/consultant/quota", () => HttpResponse.json({ limit: 10, used: clients.length, remaining: 10 - clients.length })),
  http.get("*/v1/consultant/clients-at-risk", () =>
    HttpResponse.json({ clients: atRisk, total: atRisk.length, as_of_date: "2026-06-30" })),
  http.get("*/v1/consultant/financial-health-index", () => HttpResponse.json({
    index: 61, clients_scored: 1, clients_pending: 0,
    total_income: money("45000.00", readingCurrency), total_expenses: money("38200.00", readingCurrency),
    balance: money("6800.00", readingCurrency), total_debt: money("7350.00", readingCurrency),
    organizations_count: clients.length, period_start: "2026-01-01", period_end: "2026-06-30", formula_info: "",
  })),
  http.get("*/v1/consultant/total-credit-card-debt", () => HttpResponse.json({
    total_debt: aggregateAmount("7350.00"), organizations_count: clients.length, as_of_date: "2026-06-30", ...receipt(),
  })),
  http.get("*/v1/consultant/expenses-by-category", () => HttpResponse.json({
    categories: [{ name: "Moradia", total: aggregateAmount("12000.00"), percentage: aggregates === "unavailable" ? null : 100 }],
    total_expenses: aggregateAmount("12000.00"), period_start: "2026-01-01", period_end: "2026-06-30", ...receipt(),
  })),
  http.get("*/v1/consultant/cash-flow", () => HttpResponse.json({
    monthly_data: [{
      month: "2026-06", year: 2026, month_number: 6,
      total_income: aggregateAmount("7800.00"), total_expenses: aggregateAmount("7350.00"),
      balance: aggregateAmount("450.00"),
    }],
    period_start: "2026-06-01", period_end: "2026-06-30", ...receipt(),
  })),
  http.get("*/v1/consultant/income-commitment", () => HttpResponse.json({ monthly_data: [], period_start: "2026-06-01", period_end: "2026-06-30" })),
  http.get("*/v1/consultant/goals-progress-by-type", () => HttpResponse.json({ by_type: [], organizations_count: 0, as_of_date: "2026-06-30" })),
  http.get("*/v1/consultant/clients/:id/profile", ({ params }) => {
    const c = clients.find((x) => x.organization_id === params.id);
    const currency = c?.balance.currency ?? "BRL";
    return HttpResponse.json({
      organization_id: params.id, has_profile: true, notes: "Foco em reserva", tags: [],
      experience_level: null, main_goal: null, priority: false, phone: null, occupation: null,
      estimated_income: money("8000.00", currency),
    });
  }),
  http.get("*/v1/financial-health/score", ({ request }) => {
    const org = new URL(request.url).searchParams.get("organization_id");
    const currency = clients.find((x) => x.organization_id === org)?.balance.currency ?? "BRL";
    return HttpResponse.json({
      reference_month: "2026-06-01",
      ativo: money("8500.00", currency), passivo: money("1200.00", currency), patrimonio_liquido: money("7300.00", currency),
      avg_income: money("7000.00", currency), avg_expense: money("4500.00", currency), avg_surplus: money("2500.00", currency),
      income_commitment: 0.3, savings_rate: 0.2, emergency_fund_months: 2, goals_on_track: 1, goals_total: 2,
      goal_progress_avg: 40, cash_flow_risk: "low", score: 61,
    });
  }),
  http.get("*/v1/analytics/by-category", ({ request }) => {
    const org = new URL(request.url).searchParams.get("organization_id");
    const currency = clients.find((x) => x.organization_id === org)?.balance.currency ?? "BRL";
    return HttpResponse.json({
      categories: [
        { tag_id: "t1", tag_name: "Moradia", tag_color: "#111", total: money("600.00", currency), percentage: 60, transaction_count: 2 },
        { tag_id: "t2", tag_name: "Transporte", tag_color: "#222", total: money("400.00", currency), percentage: 40, transaction_count: 1 },
      ],
      total_amount: money("1000.00", currency),
    });
  }),
  http.get("*/v1/analytics/monthly-evolution", () => HttpResponse.json({ months: [] })),
  http.get("*/v1/goals", () => HttpResponse.json([])),
  http.get("*/v1/transactions", ({ request }) => {
    const org = new URL(request.url).searchParams.get("organization_id");
    const currency = clients.find((x) => x.organization_id === org)?.balance.currency ?? "BRL";
    const row = (id, type, value, description) => ({
      id, type, description, value: money(value, currency), date: "2026-06-10T12:00:00",
      paid_at: "2026-06-10T12:00:00", status: "paid", payment_method: "pix", tags: {},
    });
    const data = [row(1, "income", "5000.00", "Salário"), row(2, "expense", "1234.00", "Aluguel")];
    return HttpResponse.json({ data, pagination: { page: 1, limit: 100, total: data.length, has_next: false } });
  }),
  http.get("*/v1/credit-cards", ({ request }) => {
    const org = new URL(request.url).searchParams.get("organization_id");
    const currency = clients.find((x) => x.organization_id === org)?.balance.currency ?? "BRL";
    return HttpResponse.json([{
      id: 1, public_id: "00000000-0000-4000-8000-000000000001", organization_id: org,
      last4: "7112", brand: "Visa", due_day: 10, closing_day: 3, description: "Azul", color: "#1a1a2e",
      account_id: "22222222-2222-4222-8222-222222222222", currency,
      credit_limit: money("10000.00", currency), available_limit: money("6500.00", currency),
      used_limit: money("3500.00", currency), limit_usage_percent: 35,
    }]);
  }),
  http.get("*/v1/credit-cards/:id/invoices/current", ({ request }) => {
    const org = new URL(request.url).searchParams.get("organization_id");
    const currency = clients.find((x) => x.organization_id === org)?.balance.currency ?? "BRL";
    return HttpResponse.json({
      month: "2026-06", due_date: "2026-06-10", total_amount: money("3500.00", currency), status: "open",
      items: [], closing_date: "2026-06-03", days_until_due: 6, is_overdue: false, paid_date: null,
      previous_month_total: money("0", currency), month_over_month_change: 0, limit_usage_percent: 35,
      items_count: 0, category_breakdown: [],
    });
  }),
  // Mês sem fatura: 404 é "não há", e o adapter segue com o cartão.
  http.get("*/v1/credit-cards/:id/invoices/:year/:month", () => HttpResponse.json({ detail: "sem fatura" }, { status: 404 })),
  http.post("*/v1/consultant/ai-copiloto", () => HttpResponse.json({
    correlation_id: "c", session_id: "s", run_id: "r",
    output: { answer: "Veja a distribuição.", blocks: copilotoBlocks, suggested_actions: [], disclaimers: [] },
  })),
  http.all("*", () => HttpResponse.json({ detail: "fora do escopo" }, { status: 503 })),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
beforeEach(() => {
  localStorage.setItem("auth_token", "t");
  clients = [USD_CLIENT];
  readingCurrency = "USD";
  atRisk = [];
  copilotoBlocks = [];
  aggregates = null;
  routeParams = { id: "org-usd" };
  __resetStore();
});

const text = () => document.body.textContent ?? "";
const noReal = () => expect(text()).not.toMatch(/R\$/);

describe("Carteira (#314)", () => {
  it("escreve o patrimônio de um cliente em dólar em dólar — tabela, card e cabeçalho", async () => {
    render(<ConsultantClientsPage />);
    await waitFor(() => expect(text()).toContain("US$ 12.500,00 sob acompanhamento"));
    // card (visão padrão)
    expect(screen.getAllByText("US$ 12.500,00").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /tabela/i }));
    await waitFor(() => expect(screen.getAllByText("US$ 12.500,00").length).toBeGreaterThan(0));
    noReal();
  });

  it("cliente em real sai como antes", async () => {
    clients = [BRL_CLIENT];
    render(<ConsultantClientsPage />);
    await waitFor(() => expect(text()).toContain("R$ 82.500,00 sob acompanhamento"));
    expect(text()).not.toContain("US$");
  });

  it("carteira mista não soma moedas sob um símbolo: mostra a quebra por moeda", async () => {
    clients = [BRL_CLIENT, USD_CLIENT];
    render(<ConsultantClientsPage />);
    await waitFor(() => expect(text()).toContain("R$ 82.500,00 + US$ 12.500,00 sob acompanhamento"));
    expect(text()).not.toContain("R$ 95.000");
  });
});

describe("Painel (#314)", () => {
  it("KPI de patrimônio e saldo da lista de atenção na moeda do cliente", async () => {
    atRisk = [{
      organization_id: "org-usd", organization_name: "Org Rui", client_name: "Rui Teixeira",
      main_situation: "gasto acima da renda", current_balance: money("-1450.00", "USD"),
      last_invoice_status: "overdue", risk_score: 78,
    }];
    render(<ConsultantPainelPage />);
    await waitFor(() => expect(text()).toContain("US$ 12.500"));
    await waitFor(() => expect(text()).toContain("−US$ 1.450,00"));
    noReal();
  });

  it("carteira mista: o KPI mostra a quebra, não uma soma", async () => {
    clients = [BRL_CLIENT, USD_CLIENT];
    readingCurrency = "BRL";
    render(<ConsultantPainelPage />);
    await waitFor(() => expect(text()).toContain("R$ 82.500 + US$ 12.500"));
  });

  it("carteira em real sai como antes", async () => {
    clients = [BRL_CLIENT];
    readingCurrency = "BRL";
    atRisk = [{
      organization_id: "org-brl", organization_name: "Org", client_name: "Marina Andrade",
      main_situation: "x", current_balance: money("-1450.00", "BRL"), last_invoice_status: "overdue", risk_score: 70,
    }];
    render(<ConsultantPainelPage />);
    await waitFor(() => expect(text()).toContain("R$ 82.500"));
    await waitFor(() => expect(text()).toContain("−R$ 1.450,00"));
    expect(text()).not.toContain("US$");
  });
});

describe("Relatório do cliente (#314)", () => {
  it("Visão geral: KPIs, donut, evolução e renda estimada na moeda do cliente", async () => {
    render(<ConsultantClientReportPage />);
    await waitFor(() => expect(text()).toContain("US$ 4.200"));
    await waitFor(() => expect(text()).toContain("US$ 7.000"));
    await waitFor(() => expect(text()).toContain("despesas · US$ 1.000"));
    expect(text()).toContain("US$1.0k");
    expect(text()).toContain("US$ 600");
    await waitFor(() => expect(text()).toContain(`US$${NBSP}8.000,00`));
    noReal();
  });

  it("Visão geral de um cliente em real sai como antes", async () => {
    clients = [BRL_CLIENT];
    routeParams = { id: "org-brl" };
    render(<ConsultantClientReportPage />);
    await waitFor(() => expect(text()).toContain("R$ 4.200"));
    await waitFor(() => expect(text()).toContain("despesas · R$ 1.000"));
    expect(text()).toContain("R$1.0k");
    await waitFor(() => expect(text()).toContain(`R$${NBSP}8.000,00`));
    expect(text()).not.toContain("US$");
  });

  it("Transações: linhas e resumo na moeda do cliente", async () => {
    const user = userEvent.setup();
    render(<ConsultantClientReportPage />);
    await user.click(await screen.findByRole("tab", { name: /Transações/ }));
    await waitFor(() => expect(text()).toContain("+US$ 5.000"));
    expect(text()).toContain("−US$ 1.234");
    expect(text()).toContain("US$ 3.766");
    noReal();
  });

  it("Cartões: fatura, limite e disponível na moeda do cartão", async () => {
    const user = userEvent.setup();
    render(<ConsultantClientReportPage />);
    await user.click(await screen.findByRole("tab", { name: /Cartões/ }));
    await waitFor(() => expect(text()).toContain("US$ 10.000"));
    expect(text()).toContain("US$ 6.500");
    noReal();
  });

  it("Categorias: totais na moeda do cliente", async () => {
    const user = userEvent.setup();
    render(<ConsultantClientReportPage />);
    await user.click(await screen.findByRole("tab", { name: /Categorias/ }));
    await waitFor(() => expect(text()).toContain("US$ 600"));
    expect(text()).toContain("US$ 400");
    noReal();
  });
});

describe("Insights (#314)", () => {
  it("carteira toda em dólar, rótulo em dólar: KPIs, gastos e fluxo em dólar", async () => {
    render(<ConsultantInsightsPage />);
    await waitFor(() => expect(text()).toContain("US$ 7.350,00"));
    expect(text()).toContain("US$ 12.500,00");
    await waitFor(() => expect(text()).toContain("US$ 12.000,00"));
    expect(screen.getAllByTestId("y-tick")[0].textContent).toBe("US$ 2.000");
    noReal();
  });

  it("carteira mista: soma não convertida sai como ausência, patrimônio como quebra", async () => {
    clients = [BRL_CLIENT, USD_CLIENT];
    readingCurrency = "BRL";
    render(<ConsultantInsightsPage />);
    await waitFor(() => expect(text()).toContain("R$ 82.500,00 + US$ 12.500,00"));
    // `/total-credit-card-debt` e `/expenses-by-category` empilham real e dólar sem
    // cotação e rotulam em real: escrever "R$ 7.350,00" seria mentir a unidade.
    expect(text()).not.toContain("7.350");
    expect(text()).not.toContain("12.000,00");
  });

  it("clientes em dólar com rótulo em real (base do consultor): nada sai como real", async () => {
    readingCurrency = "BRL";
    render(<ConsultantInsightsPage />);
    await waitFor(() => expect(text()).toContain("US$ 12.500,00"));
    expect(text()).not.toContain("7.350");
    noReal();
  });

  it("carteira em real sai como antes", async () => {
    clients = [BRL_CLIENT];
    readingCurrency = "BRL";
    render(<ConsultantInsightsPage />);
    await waitFor(() => expect(text()).toContain("R$ 7.350,00"));
    expect(text()).toContain("R$ 82.500,00");
    await waitFor(() => expect(text()).toContain("R$ 12.000,00"));
    expect(screen.getAllByTestId("y-tick")[0].textContent).toBe("R$ 2.000");
    expect(text()).not.toContain("US$");
  });
});

describe("Insights com agregados convertidos (fincla-api#505)", () => {
  it("carteira mista convertida: dívida, gastos e fluxo saem na moeda de leitura", async () => {
    clients = [BRL_CLIENT, USD_CLIENT];
    readingCurrency = "BRL";
    aggregates = "converted";
    render(<ConsultantInsightsPage />);
    await waitFor(() => expect(text()).toContain("R$ 7.350,00"));
    await waitFor(() => expect(text()).toContain("R$ 12.000,00"));
    expect(screen.getAllByTestId("y-tick")[0].textContent).toBe("R$ 2.000");
    // O patrimônio continua sendo a quebra por moeda: ele não é um desses agregados.
    expect(text()).toContain("R$ 82.500,00 + US$ 12.500,00");
  });

  it("clientes em dólar, leitura em real, convertido: sai em real (é a conversão, não um rótulo)", async () => {
    readingCurrency = "BRL";
    aggregates = "converted";
    render(<ConsultantInsightsPage />);
    await waitFor(() => expect(text()).toContain("R$ 7.350,00"));
  });

  it("sem cotação: os totais saem ausentes, nunca zero", async () => {
    clients = [BRL_CLIENT, USD_CLIENT];
    readingCurrency = "BRL";
    aggregates = "unavailable";
    render(<ConsultantInsightsPage />);
    await waitFor(() => expect(text()).toContain("R$ 82.500,00 + US$ 12.500,00"));
    await waitFor(() => expect(text()).toContain("Moradia"));
    expect(text()).not.toMatch(/R\$ 0(,00)?\b/);
    expect(text()).not.toContain("7.350");
    expect(text()).not.toContain("12.000");
  });
});

describe("Perfil do consultor (#314)", () => {
  it("patrimônio sob gestão na moeda dos clientes", async () => {
    render(<ConsultantProfilePage />);
    await waitFor(() => expect(text()).toContain("US$ 12.500,00"));
    noReal();
  });
});

describe("Copiloto (#314)", () => {
  it("bloco de categorias que declara a moeda é escrito nela (fincla-api#505)", async () => {
    const user = userEvent.setup();
    // O cliente na carteira é em dólar, mas o bloco diz euro: vale o que o bloco diz,
    // porque ele vem do resultado da tool que somou aqueles números.
    copilotoBlocks = [{
      type: "client_categories", organization_id: "org-usd", client_name: "Rui Teixeira", total: 1000,
      currency: "EUR", period_start: "2026-01-01", period_end: "2026-06-30",
      categories: [{ name: "Moradia", total: 600, pct: 60 }],
    }];
    render(<ConsultantCopilotoPage />);
    await user.type(screen.getByLabelText("Mensagem para o Copiloto"), "onde gastam?");
    await user.click(screen.getByLabelText("Enviar mensagem"));
    await waitFor(() => expect(text()).toContain("€ 1.000"));
    expect(text()).not.toContain("US$ 1.000");
  });

  it("distribuição de gastos de um cliente em dólar sai em dólar", async () => {
    const user = userEvent.setup();
    copilotoBlocks = [{
      type: "client_categories", organization_id: "org-usd", client_name: "Rui Teixeira", total: 1000,
      period_start: "2026-01-01", period_end: "2026-06-30",
      categories: [{ name: "Moradia", total: 600, pct: 60 }],
    }];
    render(<ConsultantCopilotoPage />);
    await user.type(screen.getByLabelText("Mensagem para o Copiloto"), "onde gastam?");
    await user.click(screen.getByLabelText("Enviar mensagem"));
    await waitFor(() => expect(text()).toContain("US$ 1.000"));
    expect(text()).toContain("US$ 600");
    noReal();
  });
});
