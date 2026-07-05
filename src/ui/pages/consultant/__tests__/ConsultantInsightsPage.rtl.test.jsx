// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

// recharts precisa de ResizeObserver (ausente no jsdom) — mock leve, como nos
// demais testes de página com gráfico (ex.: DashboardPage).
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="recharts-rc">{children}</div>,
  CartesianGrid: () => null,
  ComposedChart: ({ children }) => <div>{children}</div>,
  LineChart: ({ children }) => <div>{children}</div>,
  Bar: () => null,
  Line: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

vi.mock("../../../../api/consultant", () => ({
  getFinancialHealthIndex: vi.fn(),
  getConsultantClients: vi.fn(),
  getExpensesByCategory: vi.fn(),
  getCashFlow: vi.fn(),
  getIncomeCommitment: vi.fn(),
  getGoalsProgressByType: vi.fn(),
  getTotalCreditCardDebt: vi.fn(),
  getConsultantConsolidatedReport: vi.fn(),
}));

import {
  getCashFlow,
  getConsultantClients,
  getExpensesByCategory,
  getFinancialHealthIndex,
  getGoalsProgressByType,
  getIncomeCommitment,
  getTotalCreditCardDebt,
} from "../../../../api/consultant";
import { ConsultantInsightsPage } from "../ConsultantInsightsPage.jsx";

beforeEach(() => {
  navigate.mockReset();
  vi.mocked(getFinancialHealthIndex).mockResolvedValue({ index: 78, organizations_count: 3 });
  vi.mocked(getConsultantClients).mockResolvedValue({
    total: 3,
    clients: [
      { organization_id: "a", client_name: "Ana Souza", health: 92, trend: "up", patrimonio: "50000.00" },
      { organization_id: "b", client_name: "Bruno Lima", health: 30, trend: "down", patrimonio: "8000.00" },
      { organization_id: "c", client_name: "Carla Dias", health: 55, trend: "flat", patrimonio: "12000.00" },
    ],
  });
  vi.mocked(getExpensesByCategory).mockResolvedValue({
    total_expenses: 1000,
    categories: [
      { name: "Transporte", total: 700, percentage: 70 },
      { name: "Alimentação", total: 300, percentage: 30 },
    ],
  });
  vi.mocked(getCashFlow).mockResolvedValue({
    monthly_data: [
      { month: "2025-01", month_number: 1, year: 2025, total_income: 50000, total_expenses: 32000, balance: 18000 },
      { month: "2025-02", month_number: 2, year: 2025, total_income: 52000, total_expenses: 35000, balance: 17000 },
    ],
  });
  vi.mocked(getIncomeCommitment).mockResolvedValue({
    monthly_data: [{ month: "2025-02", month_number: 2, year: 2025, income_commitment_percent: 35.5 }],
  });
  vi.mocked(getGoalsProgressByType).mockResolvedValue({
    by_type: [{ goal_name: "reserva_emergencia", avg_progress: 65.5, count: 5 }],
    organizations_count: 3,
  });
  vi.mocked(getTotalCreditCardDebt).mockResolvedValue({ total_debt: 12345, organizations_count: 3 });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("<ConsultantInsightsPage> (S4)", () => {
  it("renders real KPIs, cash-flow, expenses, goals, movers and the honest AI stub", async () => {
    render(<ConsultantInsightsPage />);

    expect(screen.getByText("Insights")).toBeInTheDocument();
    expect(screen.getByText("da carteira")).toBeInTheDocument();

    // KPIs reais — inclui a nova "Dívida de cartão" (substitui a antiga "Taxa de retenção")
    await waitFor(() => expect(screen.getByText("78/100")).toBeInTheDocument());
    expect(screen.getByText("Patrimônio total")).toBeInTheDocument();
    expect(screen.getByText("Clientes em risco")).toBeInTheDocument();
    expect(screen.getByText("Dívida de cartão")).toBeInTheDocument();

    // Novos painéis reais (backed por endpoints do consultor)
    expect(screen.getByText("Fluxo da base")).toBeInTheDocument();
    expect(screen.getByText("Comprometimento de renda")).toBeInTheDocument();
    expect(screen.getByText("Progresso de metas por tipo")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Reserva de emergência/)).toBeInTheDocument());

    // "Onde a base gasta" com as categorias reais
    await waitFor(() => expect(screen.getByText("Transporte")).toBeInTheDocument());
    expect(screen.getByText("Alimentação")).toBeInTheDocument();

    // Movers
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("Bruno Lima")).toBeInTheDocument();

    // Ação de exportar (abre o modal) + único stub restante (IA)
    expect(screen.getByRole("button", { name: "Exportar" })).toBeEnabled();
    expect(screen.getByText("Tendências detectadas pela IA")).toBeInTheDocument();

    // Os stubs comerciais/históricos saíram
    expect(screen.queryByText("Taxa de retenção")).not.toBeInTheDocument();
    expect(screen.queryByText("Migração de risco da base")).not.toBeInTheDocument();
  });

  it("o botão Exportar abre o modal de formato (CSV real, PDF em breve)", async () => {
    render(<ConsultantInsightsPage />);
    await waitFor(() => expect(screen.getByText("78/100")).toBeInTheDocument());

    // Modal fechado por padrão
    expect(screen.queryByText("Formato de exportação")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Exportar" }));

    expect(screen.getByText("Exportar consolidado")).toBeInTheDocument();
    expect(screen.getByText("Formato de exportação")).toBeInTheDocument();
    expect(screen.getByText("CSV")).toBeInTheDocument();
    expect(screen.getByText("PDF")).toBeInTheDocument();
    // PDF fica como opção futura (subtítulo próprio do modal); o download é do CSV
    expect(screen.getByText("Relatório para apresentar ao cliente")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Exportar CSV/ })).toBeInTheDocument();
  });
});
