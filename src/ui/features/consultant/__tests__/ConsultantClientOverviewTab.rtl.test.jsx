// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConsultantClientOverviewTab } from "../ConsultantClientOverviewTab.jsx";

const HEALTH = {
  patrimonio_liquido: 7300, avg_income: 7000, avg_expense: 4500, avg_surplus: 2500,
  income_commitment: 0.64, savings_rate: 0.36, emergency_fund_months: 1.9,
  goals_on_track: 3, goals_total: 5, goal_progress_avg: 42,
  cash_flow_risk: "low", score: 72,
};

const client = { client_name: "Mariana Costa", organization_id: "a", balance: "1200.00" };

function state(over = {}) {
  return { loading: false, error: "", hasLoaded: true, data: null, ...over };
}

const healthState = state({ data: HEALTH });
const categoriesState = { loading: false, error: "", hasLoaded: true, categories: [
  { tag_name: "Moradia", total: 3000, tag_color: "#0F0F0D" },
  { tag_name: "Alimentação", total: 900, tag_color: "#2563EB" },
] };
const goalsState = { isLoading: false, error: "", hasLoaded: true, goals: [
  { id: "g1", nome: "Reserva", progress: 70 },
  { id: "g2", nome: "Viagem", progress: 20 },
] };

afterEach(() => cleanup());

describe("ConsultantClientOverviewTab", () => {
  it("mostra os 4 KPIs, o donut de categorias, o diagnóstico e as metas", () => {
    render(<ConsultantClientOverviewTab client={client} health={healthState} categories={categoriesState} goals={goalsState} />);
    // KPIs (o rótulo "Taxa de poupança" também aparece no diagnóstico → getAllByText)
    expect(screen.getByText("Saldo atual")).toBeInTheDocument();
    expect(screen.getAllByText("Taxa de poupança").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("36.0%")).toBeInTheDocument();
    // Donut "para onde vai o dinheiro"
    expect(screen.getByText("Para onde vai o dinheiro")).toBeInTheDocument();
    expect(screen.getByText("Moradia")).toBeInTheDocument();
    // Diagnóstico
    expect(screen.getByText("Diagnóstico de saúde")).toBeInTheDocument();
    expect(screen.getByText("Reserva de emergência")).toBeInTheDocument();
    // Metas
    expect(screen.getByText("Metas em andamento")).toBeInTheDocument();
    expect(screen.getByText("Reserva")).toBeInTheDocument();
    expect(screen.getByText("3 de 5")).toBeInTheDocument();
  });

  it("renderiza os blocos de Trilha B como stub 'em breve'", () => {
    render(<ConsultantClientOverviewTab client={client} health={healthState} categories={categoriesState} goals={goalsState} />);
    expect(screen.getByText(/Leitura da IA/)).toBeInTheDocument();
    expect(screen.getByText("Alertas ativos")).toBeInTheDocument();
    expect(screen.getByText("Notas do consultor")).toBeInTheDocument();
    expect(screen.getByText("Próximos passos sugeridos")).toBeInTheDocument();
    expect(screen.getAllByText("em breve").length).toBeGreaterThanOrEqual(4);
  });

  it("KPIs de saúde mostram '…' enquanto a saúde carrega (saldo já aparece)", () => {
    const loadingHealth = { loading: true, error: "", hasLoaded: false, data: null };
    render(<ConsultantClientOverviewTab client={client} health={loadingHealth} categories={categoriesState} goals={goalsState} />);
    expect(screen.getByText("R$ 1.200")).toBeInTheDocument(); // saldo (da carteira)
    expect(screen.getAllByText("…").length).toBeGreaterThanOrEqual(1); // renda/poupança/comprometimento
  });
});
