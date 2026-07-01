// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../api/consultant", () => ({
  getConsultantSummary: vi.fn(),
  getFinancialHealthIndex: vi.fn(),
}));

import {
  getConsultantSummary,
  getFinancialHealthIndex,
} from "../../../../api/consultant";
import { ConsultantPainelPage } from "../ConsultantPainelPage.jsx";

beforeEach(() => {
  vi.mocked(getConsultantSummary).mockResolvedValue({
    total_income: 50000,
    total_expenses: 32000,
    balance: 18000,
    total_transactions: 245,
    organizations_count: 8,
    period_start: "2026-06-01",
    period_end: "2026-06-30",
  });
  vi.mocked(getFinancialHealthIndex).mockResolvedValue({
    index: 72,
    balance_score: 80,
    debt_score: 65,
    reserve_score: 70,
    total_income: 50000,
    total_expenses: 32000,
    balance: 18000,
    total_debt: 12000,
    organizations_count: 8,
    period_start: "2026-06-01",
    period_end: "2026-06-30",
    formula_info: "",
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("<ConsultantPainelPage> (S1 — Painel da base)", () => {
  it("renders the title and the KPI cards with real aggregate data", async () => {
    render(<ConsultantPainelPage />);

    // Title "Painel da base" (sans + serif spans).
    expect(screen.getByText("Painel")).toBeInTheDocument();
    expect(screen.getByText("da base")).toBeInTheDocument();

    // KPI labels are present.
    expect(screen.getByText("Clientes ativos")).toBeInTheDocument();
    expect(screen.getByText("Saúde média da base")).toBeInTheDocument();

    // Real values arrive from the mocked endpoints.
    await waitFor(() => expect(screen.getByText("8")).toBeInTheDocument());
    expect(screen.getByText("72")).toBeInTheDocument();
  });
});
