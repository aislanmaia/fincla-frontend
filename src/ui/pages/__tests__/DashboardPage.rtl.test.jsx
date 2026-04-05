/** @vitest-environment jsdom */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardPage } from "../DashboardPage.jsx";

vi.mock("../../features/dashboard/useDashboardData.js", () => ({
  useDashboardData: () => ({
    isLoading: false,
    error: "",
    summary: {
      total_income: 1000,
      total_expenses: 400,
      balance: 600,
      total_transactions: 2,
      recurring_in_period: {
        total_expense: 50,
        total_income: 0,
        period: { start_date: "2026-04-01", end_date: "2026-04-30" },
      },
    },
    transactions: [],
    categories: [],
    rhythmChart: [{ dia: 1, proj: 10, real: 5, dayLabel: "1" }],
    rhythmMeta: {
      dim: 30,
      today: 15,
      showTodayMarker: true,
      refLabel: "Hoje",
      progressSuffix: "",
      rhythmMode: "daily",
    },
    upcomingDebits: [],
    recurringSummary: { total_monthly_expense: 200 },
    recurringInPeriod: {
      total_expense: 50,
      total_income: 0,
      period: { start_date: "2026-04-01", end_date: "2026-04-30" },
    },
    hasRealData: true,
    refetch: vi.fn(),
  }),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="recharts-rc">{children}</div>,
  CartesianGrid: () => null,
  ComposedChart: ({ children }) => <div>{children}</div>,
  Line: () => null,
  ReferenceLine: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

describe("DashboardPage (RTL)", () => {
  it("renderiza Visão Geral com KPIs quando o hook retorna resumo", () => {
    render(
      <DashboardPage
        onNav={vi.fn()}
        stateCtrl={{ mounted: true, isMobile: false }}
        dataMode="live"
        organizationId="org-rtl"
        onNewTx={vi.fn()}
      />,
    );
    expect(screen.getByText("Geral")).toBeInTheDocument();
    expect(screen.getByText(/Receitas ·/)).toBeInTheDocument();
  });
});
