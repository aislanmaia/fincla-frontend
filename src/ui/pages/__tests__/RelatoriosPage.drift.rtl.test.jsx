/** @vitest-environment jsdom */

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RelatoriosPage } from "../RelatoriosPage.jsx";

afterEach(cleanup);

// jsdom não tem ResizeObserver (a página mede a cascata com ele).
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// O mock expõe as props que importam para a regressão: `stackId` e `dataKey` de
// cada <Area>. Empilhado, o traço de uma categoria fica na posição acumulada e o
// eixo Y continua na escala do total — foi assim que "Aislan - Pessoal"
// (R$ 103) apareceu partindo de R$ 34 mil.
vi.mock("recharts", () => {
  const passthrough = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: passthrough,
    AreaChart: ({ children }) => <div data-testid="area-chart">{children}</div>,
    Area: ({ dataKey, stackId }) => (
      <span data-testid="area" data-datakey={dataKey} data-stackid={stackId ?? ""} />
    ),
    BarChart: passthrough,
    ComposedChart: passthrough,
    PieChart: passthrough,
    Pie: () => null,
    Bar: () => null,
    Line: () => null,
    Cell: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ReferenceLine: () => null,
  };
});

const driftAreas = () =>
  screen.getAllByTestId("area").filter((el) => el.dataset.datakey !== "ideal" && el.dataset.datakey !== "real");

describe("RelatoriosPage — evolução por categoria", () => {
  it("empilha todas as categorias quando nenhuma está isolada", () => {
    render(<RelatoriosPage dataMode="mock" organizationId={null} />);
    const areas = driftAreas();
    expect(areas.length).toBeGreaterThan(1);
    expect(areas.every((el) => el.dataset.stackid === "1")).toBe(true);
  });

  it("ao isolar uma categoria, desenha só ela e sem empilhamento", async () => {
    const user = userEvent.setup();
    render(<RelatoriosPage dataMode="mock" organizationId={null} />);

    const chip = screen
      .getAllByRole("button")
      .find((el) => el.textContent.trim() === "Lazer");
    await user.click(chip);

    const areas = driftAreas();
    expect(areas).toHaveLength(1);
    expect(areas[0].dataset.datakey).toBe("Lazer");
    expect(areas[0].dataset.stackid).toBe("");
  });
});
