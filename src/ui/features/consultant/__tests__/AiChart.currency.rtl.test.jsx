// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * #314 — a spec dos gráficos da IA diz `value_format: "brl0"` mas não diz moeda. O
 * eixo e o tooltip escreviam "R$" em tudo; agora escrevem na moeda que quem desenha
 * passa (a do cliente avaliado, ou a da carteira quando ela é de moeda única).
 */
afterEach(cleanup);

vi.mock("recharts", () => {
  const box = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: box, ComposedChart: box, LineChart: box, PieChart: box,
    Bar: () => null, Line: () => null, Area: () => null, Pie: box, Cell: () => null,
    CartesianGrid: () => null, Legend: () => null, XAxis: () => null,
    YAxis: ({ tickFormatter }) => <span data-testid="y-tick">{tickFormatter?.(3400, 0)}</span>,
    Tooltip: ({ content }) => <div data-testid="tooltip">{React.cloneElement(content, {
      active: true, label: "Moradia", payload: [{ dataKey: "value", name: "Valor", value: 3400 }],
    })}</div>,
  };
});

import { AiChart } from "../AiChart.jsx";

const spec = {
  type: "bar", title: "Gastos", x: { key: "label" },
  series: [{ key: "value", name: "Valor", kind: "bar", color: "purple" }],
  data: [{ label: "Moradia", value: 3400 }], value_format: "brl0",
};

describe("AiChart — moeda (#314)", () => {
  it("escreve eixo e tooltip na moeda recebida", () => {
    render(<AiChart spec={spec} currency="USD" />);
    expect(screen.getByTestId("y-tick").textContent).toBe("US$ 3.400");
    expect(screen.getByTestId("tooltip").textContent).toContain("US$ 3.400");
  });

  it("real sai como antes", () => {
    render(<AiChart spec={spec} currency="BRL" />);
    expect(screen.getByTestId("y-tick").textContent).toBe("R$ 3.400");
  });

  it("sem moeda: eixo sem rótulo e tooltip com '—', nunca 'R$'", () => {
    render(<AiChart spec={spec} />);
    expect(screen.getByTestId("y-tick").textContent).toBe("");
    expect(screen.getByTestId("tooltip").textContent).toContain("—");
    expect(document.body.textContent).not.toContain("R$");
  });

  it("percentual não depende de moeda", () => {
    render(<AiChart spec={{ ...spec, value_format: "pct" }} />);
    expect(screen.getByTestId("y-tick").textContent).toBe("3400.0%");
  });
});
