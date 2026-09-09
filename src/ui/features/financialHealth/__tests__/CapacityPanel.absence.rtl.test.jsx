/** @vitest-environment jsdom */

/**
 * O mês sem cotação não tem número nenhum — e a barra dele não pode dizer zero.
 *
 * `formatBRL(null)` já devolvia "—" nos totais do topo, mas as barras por mês
 * ficaram para trás: `Number(p.surplus || 0)` transformava a ausência em "R$ 0,00"
 * com uma trilha desenhada, afirmando que o mês fechou empatado quando o que houve
 * foi não conseguir ler o mês.
 */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CapacityPanel } from "../CapacityPanel.jsx";

const live = { data: null };

vi.mock("../useEconomyCapacityData.js", () => ({
  useEconomyCapacityData: () => ({
    isLoading: false,
    error: "",
    hasLoaded: true,
    data: live.data,
  }),
}));

afterEach(cleanup);

const BASE = {
  avg_income: null,
  avg_expense: null,
  avg_surplus: null,
  savings_rate: null,
  trend: "unknown",
  window_months: 3,
  months_with_data: 2,
  consolidation: { target_currency: "BRL", rates: [], unavailable: "sem cotação BRL→EUR" },
  avg_expense_by_currency: [
    { amount: "40.00", currency: "BRL" },
    { amount: "5.25", currency: "EUR" },
  ],
};

describe("CapacityPanel sem cotação", () => {
  it("o mês que não converteu mostra travessão, não R$ 0,00", () => {
    live.data = {
      ...BASE,
      months: [
        { year: 2026, month: 8, month_name: "agosto", surplus: null },
        { year: 2026, month: 9, month_name: "setembro", surplus: null },
      ],
    };

    render(<CapacityPanel organizationId="org-1" />);

    expect(screen.queryByText(/R\$\s*0,00/)).not.toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("com cotação, o mês continua mostrando o número dele", () => {
    live.data = {
      ...BASE,
      avg_expense: "40.00",
      consolidation: { target_currency: "BRL", rates: [], unavailable: null },
      months: [{ year: 2026, month: 9, month_name: "setembro", surplus: "120.00" }],
    };

    render(<CapacityPanel organizationId="org-1" />);

    expect(screen.getByText(/R\$\s*120,00/)).toBeInTheDocument();
  });
});
