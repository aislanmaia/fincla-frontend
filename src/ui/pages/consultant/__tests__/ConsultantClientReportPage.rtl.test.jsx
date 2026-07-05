// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
let currentParams = { id: "a" };

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useParams: () => currentParams,
}));

vi.mock("../../../../api/consultant", () => ({
  getConsultantClients: vi.fn(),
  getConsultantClientProfile: vi.fn().mockResolvedValue({ organization_id: "o", has_profile: false, tags: [] }),
}));

vi.mock("../../../../api/financialHealth", () => ({
  getFinancialHealth: vi.fn(),
}));

vi.mock("../../../../api/analytics", () => ({
  getByCategory: vi.fn(),
  getMonthlyEvolution: vi.fn().mockResolvedValue({ months: [] }),
}));

vi.mock("../../../data/goalsAdapter.js", () => ({
  listGoalsForUi: vi.fn(),
  mapGoalToUi: (g) => g,
  formatGoalsApiError: () => "erro",
  createGoalForUi: vi.fn(),
  updateGoalForUi: vi.fn(),
}));

import { getConsultantClients } from "../../../../api/consultant";
import { getFinancialHealth } from "../../../../api/financialHealth";
import { getByCategory } from "../../../../api/analytics";
import { listGoalsForUi } from "../../../data/goalsAdapter.js";
import { ConsultantClientReportPage } from "../ConsultantClientReportPage.jsx";

const HEALTH = {
  reference_month: "2026-06-01",
  ativo: 8500, passivo: 1200, patrimonio_liquido: 7300,
  avg_income: 7000, avg_expense: 4500, avg_surplus: 2500,
  income_commitment: 0.64, savings_rate: 0.36, emergency_fund_months: 1.9,
  goals_on_track: 3, goals_total: 5, goal_progress_avg: 42,
  cash_flow_risk: "low", score: 72,
};

function client(over = {}) {
  return {
    organization_id: over.organization_id ?? "a",
    organization_name: over.organization_name ?? "Família Silva",
    client_name: over.client_name ?? "Mariana Costa",
    health: over.health ?? 82,
    balance: over.balance ?? "1200.00",
    savings_pct: over.savings_pct ?? 15,
    debt_pct: over.debt_pct ?? 20,
    trend: over.trend ?? "up",
    last_active: over.last_active ?? "2026-06-28",
    patrimonio: over.patrimonio ?? "50000.00",
  };
}

beforeEach(() => {
  currentParams = { id: "a" };
  navigate.mockReset();
  vi.mocked(getConsultantClients).mockReset();
  vi.mocked(getFinancialHealth).mockReset();
  vi.mocked(getByCategory).mockReset();
  vi.mocked(listGoalsForUi).mockReset();
  vi.mocked(getFinancialHealth).mockResolvedValue(HEALTH);
  vi.mocked(getByCategory).mockResolvedValue({ categories: [{ tag_name: "Moradia", total: 3000, tag_color: "#0F0F0D" }], total_amount: 3000, period_start: "", period_end: "" });
  vi.mocked(listGoalsForUi).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ConsultantClientReportPage", () => {
  it("mostra o cabeçalho do cliente correspondente ao id da URL", async () => {
    vi.mocked(getConsultantClients).mockResolvedValue({ total: 1, clients: [client()] });
    render(<ConsultantClientReportPage />);

    await waitFor(() => expect(screen.getByText("Mariana Costa")).toBeInTheDocument());
    expect(screen.getByRole("tab", { name: "Visão geral" })).toBeInTheDocument();
    expect(screen.getByText("Em dia")).toBeInTheDocument(); // RiskBadge no header (health 82)
    // A aba "Visão geral" consome os reads por-org (metas do /score, donut de by-category).
    await waitFor(() => expect(screen.getByText("3 de 5")).toBeInTheDocument());
    expect(screen.getByText("Para onde vai o dinheiro")).toBeInTheDocument();
  });

  it("não busca a saúde quando o id não é cliente do consultor", async () => {
    currentParams = { id: "zzz" };
    vi.mocked(getConsultantClients).mockResolvedValue({ total: 1, clients: [client()] });
    render(<ConsultantClientReportPage />);
    await waitFor(() => expect(screen.getByText("Cliente não encontrado")).toBeInTheDocument());
    expect(getFinancialHealth).not.toHaveBeenCalled();
  });

  it("volta para a carteira ao clicar em voltar", async () => {
    vi.mocked(getConsultantClients).mockResolvedValue({ total: 1, clients: [client()] });
    render(<ConsultantClientReportPage />);
    await waitFor(() => expect(screen.getByText("Mariana Costa")).toBeInTheDocument());

    screen.getByRole("button", { name: "Clientes" }).click();
    expect(navigate).toHaveBeenCalledWith({ to: "/consultant/clients" });
  });

  it("mostra 'não encontrado' quando o id não é cliente do consultor", async () => {
    currentParams = { id: "zzz" };
    vi.mocked(getConsultantClients).mockResolvedValue({ total: 1, clients: [client()] });
    render(<ConsultantClientReportPage />);

    await waitFor(() => expect(screen.getByText("Cliente não encontrado")).toBeInTheDocument());
  });

  it("mostra erro quando a carga da carteira falha", async () => {
    vi.mocked(getConsultantClients).mockRejectedValue(new Error("boom"));
    render(<ConsultantClientReportPage />);

    await waitFor(() => expect(screen.getByText("Não foi possível carregar")).toBeInTheDocument());
  });
});
