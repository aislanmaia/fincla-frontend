// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConsultantClientOverviewTab } from "../ConsultantClientOverviewTab.jsx";

const health = {
  reference_month: "2026-06-01",
  ativo: 8500, passivo: 1200, patrimonio_liquido: 7300,
  avg_income: 7000, avg_expense: 4500, avg_surplus: 2500,
  income_commitment: 0.64, savings_rate: 0.36, emergency_fund_months: 1.9,
  goals_on_track: 3, goals_total: 5, goal_progress_avg: 42,
  cash_flow_risk: "low", score: 72,
};

afterEach(() => {
  cleanup();
});

describe("ConsultantClientOverviewTab", () => {
  it("mostra score, faixa de risco, KPIs e resumo de metas", () => {
    render(<ConsultantClientOverviewTab data={health} loading={false} error="" hasLoaded />);
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("Risco baixo")).toBeInTheDocument();
    expect(screen.getByText("Patrimônio líquido")).toBeInTheDocument();
    expect(screen.getByText("64.0%")).toBeInTheDocument(); // comprometimento
    expect(screen.getByText("3 de 5")).toBeInTheDocument();
    expect(screen.getByText("progresso médio 42%")).toBeInTheDocument();
  });

  it("estado de carregamento antes de haver dados", () => {
    render(<ConsultantClientOverviewTab data={null} loading error="" hasLoaded={false} />);
    expect(screen.getByText("Carregando…")).toBeInTheDocument();
  });

  it("estado de erro quando falha sem dados", () => {
    render(<ConsultantClientOverviewTab data={null} loading={false} error="boom" hasLoaded />);
    expect(screen.getByText("Não foi possível carregar")).toBeInTheDocument();
  });

  it("estado sem dados quando carregou vazio", () => {
    render(<ConsultantClientOverviewTab data={null} loading={false} error="" hasLoaded />);
    expect(screen.getByText("Sem dados suficientes")).toBeInTheDocument();
  });
});
