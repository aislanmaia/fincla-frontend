/** @vitest-environment jsdom */

/**
 * #320 — com dados reais a página de Relatórios só mostra fatos calculados, ou nada.
 * As frases de DEMONSTRAÇÃO (categorias, meses e percentuais inventados) apareciam
 * também com dados reais: "Lazer e Outros variaram +134% em Nov–Dez vs set.",
 * "Gasto 35% mais rápido que o ideal…", "Moradia + Alimentação = 30% da receita de
 * Março…". Na demonstração elas continuam.
 */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RelatoriosPage } from "../RelatoriosPage.jsx";

const fixture = vi.hoisted(() => ({ current: null }));

vi.mock("../../features/reports/useReportsData.js", () => ({
  useReportsData: () => fixture.current,
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

/** Dados reais sem nada que permita calcular os insights de cascata e velocidade. */
const LIVE_NOTHING_COMPUTABLE = {
  isLoading: false,
  error: "",
  monthlyData: [
    { mes: "Out'26", receita: 5000, gasto: 4000, saldo: 1000, score: 20 },
    { mes: "Nov'26", receita: 5200, gasto: 3900, saldo: 1300, score: 25, current: true },
  ],
  driftData: [
    { mes: "Out'26", Mercado: 900, Farmácia: 120 },
    { mes: "Nov'26", Mercado: 950, Farmácia: 80 },
  ],
  driftColors: { Mercado: "#2563EB", Farmácia: "#059669" },
  compositionData: [],
  compositionWindowLabel: "Nov'26",
  waterfallRows: [],
  velocityDaily: [],
  hasRealData: true,
};

/** Dados reais com cascata e série diária: os insights calculados aparecem. */
const LIVE_COMPUTABLE = {
  ...LIVE_NOTHING_COMPUTABLE,
  waterfallRows: [
    { nome: "Receita", val: 5200, tipo: "receita" },
    { nome: "Mercado", val: -950, tipo: "despesa" },
    { nome: "Aluguel", val: -1650, tipo: "despesa" },
    { nome: "Farmácia", val: -80, tipo: "despesa" },
    { nome: "Saldo", val: 2520, tipo: "saldo" },
  ],
  velocityDaily: Array.from({ length: 6 }, (_, i) => ({
    dia: `D${i + 1}`,
    ideal: 100 * (i + 1),
    real: 150 * (i + 1),
  })),
};

/** Frases de demonstração — nenhuma pode aparecer com dados reais. */
const FAKE = [
  /Lazer e Outros/,
  /\+134%/,
  /Nov–Dez vs set/,
  /35% mais rápido/,
  /primeiros 5 dias/,
  /Moradia \+ Alimentação/,
  /da receita<\/strong> de Março|receita de Março/,
  /principais drivers/,
  /alavancas de economia/,
];
const text = () => document.body.textContent ?? "";
const expectNoFake = () => {
  for (const re of FAKE) expect(text()).not.toMatch(re);
};

async function visitAllMobileTabs() {
  const seen = [];
  for (const name of [/Resumo/, /Fluxo/, /Categorias/, /Score/, /Composição/]) {
    await userEvent.click(screen.getByRole("button", { name }));
    seen.push(text());
  }
  return seen.join("\n");
}

describe("RelatoriosPage — dados reais não mostram cópia de demonstração (#320)", () => {
  it("desktop, sem cascata nem série diária: nenhuma frase inventada", () => {
    fixture.current = LIVE_NOTHING_COMPUTABLE;
    render(<RelatoriosPage dataMode="live" organizationId="org-1" isMobile={false} />);
    expect(screen.getByText("Evolução por")).toBeInTheDocument();
    expectNoFake();
    // A instrução (não é um fato) continua.
    expect(text()).toMatch(/Clique nas categorias abaixo para isolar\./);
  });

  it("mobile, todas as abas, sem cascata nem série diária: nenhuma frase inventada", async () => {
    fixture.current = LIVE_NOTHING_COMPUTABLE;
    render(<RelatoriosPage dataMode="live" organizationId="org-1" isMobile />);
    const all = await visitAllMobileTabs();
    for (const re of FAKE) expect(all).not.toMatch(re);
    await userEvent.click(screen.getByRole("button", { name: /Categorias/ }));
    expect(text()).toMatch(/Toque em uma categoria para isolar\./);
  });

  it("desktop, com cascata e série diária: mostra os números calculados", () => {
    fixture.current = LIVE_COMPUTABLE;
    render(<RelatoriosPage dataMode="live" organizationId="org-1" isMobile={false} />);
    expectNoFake();
    // Mercado + Aluguel = 2600 / 5200 = 50%; dia 5: 750 vs 500 = +50%.
    expect(text()).toMatch(/Mercado \+ Aluguel ≈ 50% da receita/);
    expect(text()).toMatch(/50% acima do ritmo ideal/);
  });

  it("mobile, com série diária: a aba Fluxo mostra o número calculado", async () => {
    fixture.current = LIVE_COMPUTABLE;
    render(<RelatoriosPage dataMode="live" organizationId="org-1" isMobile />);
    const all = await visitAllMobileTabs();
    for (const re of FAKE) expect(all).not.toMatch(re);
    expect(all).toMatch(/50% acima do ritmo ideal/);
  });
});

describe("RelatoriosPage — demonstração mantém a cópia de exemplo (#320)", () => {
  it("desktop: as frases de exemplo continuam", () => {
    fixture.current = { ...LIVE_NOTHING_COMPUTABLE, hasRealData: false };
    render(<RelatoriosPage dataMode="mock" organizationId={null} isMobile={false} />);
    expect(text()).toMatch(/Lazer e Outros variaram \+134% em Nov–Dez vs set\./);
    expect(text()).toMatch(/35% mais rápido que o ideal/);
    expect(text()).toMatch(/Moradia \+ Alimentação = 30% da receita de Março/);
  });

  it("mobile: as frases de exemplo continuam nas abas Fluxo e Categorias", async () => {
    fixture.current = { ...LIVE_NOTHING_COMPUTABLE, hasRealData: false };
    render(<RelatoriosPage dataMode="mock" organizationId={null} isMobile />);
    await userEvent.click(screen.getByRole("button", { name: /Fluxo/ }));
    expect(text()).toMatch(/35% mais rápido que o ideal/);
    await userEvent.click(screen.getByRole("button", { name: /Categorias/ }));
    expect(text()).toMatch(
      /Lazer e Outros foram os principais drivers de variação no período\. Toque em uma categoria para isolar\./,
    );
  });
});
