/** @vitest-environment jsdom */

/**
 * #315 — o insight da composição ("R$ 3.300 (38% da receita) … Março") é cópia de
 * DEMONSTRAÇÃO, com números inventados, e aparecia também com dados reais: afirmava
 * números que não são da pessoa, em real, num mês qualquer. Decisão do Owner: só na
 * demonstração; com dados reais o insight some (não se inventa um cálculo).
 */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RelatoriosPage } from "../RelatoriosPage.jsx";

vi.mock("../../features/reports/useReportsData.js", () => ({
  useReportsData: () => ({
    isLoading: false,
    error: "",
    monthlyData: [],
    driftData: [],
    driftColors: {},
    compositionData: [],
    compositionWindowLabel: null,
    waterfallRows: [],
    velocityDaily: [],
    kpis: { periodTotalR: 0, periodTotalG: 0 },
    hasRealData: true,
  }),
}));
vi.mock("../../money/useOrganizationBaseCurrency.js", () => ({
  useOrganizationBaseCurrency: () => ({ status: "ready", currency: "USD" }),
}));
vi.mock("../../../api/recurringSeries", () => ({
  listRecurringSeries: () => Promise.resolve({ series: [] }),
}));

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
vi.mock("recharts", () => {
  const passthrough = ({ children }) => <div>{children}</div>;
  const nothing = () => null;
  return {
    ResponsiveContainer: passthrough, AreaChart: passthrough, BarChart: passthrough, ComposedChart: passthrough,
    PieChart: passthrough, Pie: nothing, Area: nothing, Bar: nothing, Line: nothing, Cell: nothing,
    XAxis: nothing, YAxis: nothing, CartesianGrid: nothing, Tooltip: nothing, ReferenceLine: nothing,
  };
});

afterEach(cleanup);

const DEMO = /3\.300 \(38% da receita\)/;
const text = () => document.body.textContent ?? "";

describe("RelatoriosPage — insight de demonstração da composição (#315)", () => {
  it("dados reais (desktop): o insight inventado não aparece", () => {
    render(<RelatoriosPage dataMode="live" organizationId="org-1" isMobile={false} />);
    expect(screen.getByText("Composição dos")).toBeInTheDocument();
    expect(text()).not.toMatch(DEMO);
    expect(text()).not.toMatch(/Margem discricionária/);
  });

  it("dados reais (mobile, aba Composição): também não aparece", async () => {
    render(<RelatoriosPage dataMode="live" organizationId="org-1" isMobile />);
    await userEvent.click(screen.getByRole("button", { name: /Composição/ }));
    expect(text()).not.toMatch(DEMO);
  });

  it("demonstração (desktop): o insight continua lá", () => {
    render(<RelatoriosPage dataMode="mock" organizationId={null} isMobile={false} />);
    expect(text()).toMatch(DEMO);
  });

  it("demonstração (mobile, aba Composição): o insight continua lá", async () => {
    render(<RelatoriosPage dataMode="mock" organizationId={null} isMobile />);
    await userEvent.click(screen.getByRole("button", { name: /Composição/ }));
    expect(text()).toMatch(DEMO);
  });
});
