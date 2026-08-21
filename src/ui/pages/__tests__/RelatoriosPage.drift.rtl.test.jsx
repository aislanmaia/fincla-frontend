/** @vitest-environment jsdom */

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RelatoriosPage } from "../RelatoriosPage.jsx";

/** Estado servido pelo hook de dados reais — mutável para simular a resposta do
 *  período seguinte trazendo outra lista de categorias. */
const liveReports = {
  driftData: [],
  driftColors: {},
};
vi.mock("../../features/reports/useReportsData.js", () => ({
  useReportsData: () => ({
    isLoading: false,
    error: "",
    monthlyData: [],
    driftData: liveReports.driftData,
    driftColors: liveReports.driftColors,
    compositionData: [],
    compositionWindowLabel: null,
    waterfallRows: [],
    velocityDaily: [],
    kpis: { periodTotalR: 0, periodTotalG: 0 },
    hasRealData: true,
  }),
}));

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

  it("solta a categoria isolada que sumiu da resposta do novo período", async () => {
    const user = userEvent.setup();
    liveReports.driftData = [
      { mes: "Jul'26", Moradia: 1500, "Educação": 300 },
      { mes: "Ago'26", Moradia: 1500, "Educação": 280 },
    ];
    liveReports.driftColors = { Moradia: "#0F0F0D", "Educação": "#2563EB" };

    const props = { dataMode: "live", organizationId: "org-1" };
    const { rerender } = render(<RelatoriosPage {...props} />);

    await user.click(
      screen.getAllByRole("button").find((el) => el.textContent.trim() === "Educação"),
    );
    expect(driftAreas()).toHaveLength(1);

    // Resposta seguinte (outro período, escolhido dentro da página) sem
    // "Educação". Sem a guarda, sobraria uma Area apontando para um dataKey
    // que não existe em linha nenhuma — plot vazio.
    liveReports.driftData = [{ mes: "Set'26", Moradia: 1500 }];
    liveReports.driftColors = { Moradia: "#0F0F0D" };
    rerender(<RelatoriosPage {...props} />);

    const areas = driftAreas();
    expect(areas).toHaveLength(1);
    expect(areas[0].dataset.datakey).toBe("Moradia");
    expect(areas[0].dataset.stackid).toBe("1");
  });
});
