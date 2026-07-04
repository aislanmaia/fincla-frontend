// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

vi.mock("../../../../api/consultant", () => ({
  getFinancialHealthIndex: vi.fn(),
  getConsultantClients: vi.fn(),
  getExpensesByCategory: vi.fn(),
}));

import { getConsultantClients, getExpensesByCategory, getFinancialHealthIndex } from "../../../../api/consultant";
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
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("<ConsultantInsightsPage> (S4)", () => {
  it("renders KPIs, the real 'onde a base gasta' bars, movers and honest stubs", async () => {
    render(<ConsultantInsightsPage />);

    expect(screen.getByText("Insights")).toBeInTheDocument();
    expect(screen.getByText("da carteira")).toBeInTheDocument();

    // KPIs reais
    await waitFor(() => expect(screen.getByText("78/100")).toBeInTheDocument());
    expect(screen.getByText("Patrimônio total")).toBeInTheDocument();
    expect(screen.getByText("Clientes em risco")).toBeInTheDocument();

    // "Onde a base gasta" com as categorias reais
    await waitFor(() => expect(screen.getByText("Transporte")).toBeInTheDocument());
    expect(screen.getByText("Alimentação")).toBeInTheDocument();

    // Movers: Ana (up) em "Maiores evoluções", Bruno (down) em "Precisam de atenção"
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("Bruno Lima")).toBeInTheDocument();

    // Stubs honestos preservam o layout
    expect(screen.getByText("Migração de risco da base")).toBeInTheDocument();
    expect(screen.getByText("Tendências detectadas pela IA")).toBeInTheDocument();
    expect(screen.getByText("Taxa de retenção")).toBeInTheDocument();
  });
});
