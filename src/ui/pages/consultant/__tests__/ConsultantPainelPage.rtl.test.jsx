// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../api/consultant", () => ({
  getFinancialHealthIndex: vi.fn(),
  getClientsAtRisk: vi.fn(),
  getConsultantClients: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../../../routing/finclaPageContext.jsx", () => ({
  useFinclaPages: () => ({ user: { name: "Helena Castro" } }),
}));

import {
  getClientsAtRisk,
  getConsultantClients,
  getFinancialHealthIndex,
} from "../../../../api/consultant";
import { ConsultantPainelPage } from "../ConsultantPainelPage.jsx";

beforeEach(() => {
  vi.mocked(getFinancialHealthIndex).mockResolvedValue({
    index: 72,
    balance_score: 80,
    debt_score: 65,
    reserve_score: 70,
    total_income: "50000",
    total_expenses: "32000",
    balance: "18000",
    total_debt: "12000",
    organizations_count: 8,
    period_start: "2026-06-01",
    period_end: "2026-06-30",
    formula_info: "",
  });
  vi.mocked(getClientsAtRisk).mockResolvedValue({
    clients: [
      {
        organization_id: "org-1",
        organization_name: "Org 1",
        client_name: "Diego Albuquerque",
        main_situation: "Gasto maior que a renda",
        current_balance: -1200,
        last_invoice_status: "overdue",
        risk_score: 88,
      },
    ],
    total: 1,
    as_of_date: "2026-06-30",
  });
  vi.mocked(getConsultantClients).mockResolvedValue({
    clients: [
      { organization_id: "org-1", client_name: "Diego Albuquerque", health: 35 },
      { organization_id: "org-2", client_name: "Ana Souza", health: 82 },
    ],
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("<ConsultantPainelPage> (S1 — Painel da base)", () => {
  it("renders the title and the KPI cards from the health-index aggregate", async () => {
    render(<ConsultantPainelPage />);

    // Title "Painel da base" (sans + serif spans).
    expect(screen.getByText("Painel")).toBeInTheDocument();
    expect(screen.getByText("da base")).toBeInTheDocument();

    // KPI labels are present.
    expect(screen.getByText("Clientes ativos")).toBeInTheDocument();
    expect(screen.getByText("Saúde média da base")).toBeInTheDocument();

    // A single aggregate call feeds both real KPIs.
    await waitFor(() => expect(screen.getByText("8")).toBeInTheDocument());
    expect(getFinancialHealthIndex).toHaveBeenCalledTimes(1);

    // health value 72 renders in BOTH the KPI card and the semáforo center;
    // asserting exactly 2 guards the KPI card specifically (a KPI-card
    // regression would drop this to 1).
    expect(screen.getAllByText("72")).toHaveLength(2);

    // Semáforo + "precisam de atenção" render below the KPIs.
    expect(screen.getByText("Semáforo da carteira")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Diego Albuquerque")).toBeInTheDocument()
    );
    // count badge is unique to the attention list (1 at-risk of 8 in the base)
    expect(screen.getByText("1 de 8")).toBeInTheDocument();
  });
});
