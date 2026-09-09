/** @vitest-environment jsdom */

/**
 * Sem cotação para converter, a simulação não tem projeção — nem veredito (#170).
 *
 * Toda derivação desta tela passa por `num()`, e `Number(null)` é `0`. Sem a guarda,
 * a página mostraria margem zero, "projeção ok" em verde e recomendações de corte de
 * gasto tiradas de um cenário que ninguém calculou. É pior que um erro: parece uma
 * resposta.
 */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { SimulacaoPage } from "../SimulacaoPage.jsx";

const live = { result: null };

// A página lê a URL para abrir o modal de item; o roteador não é o assunto aqui.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => {},
  useSearch: () => ({}),
}));

vi.mock("../../data/simulationAdapter.js", async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    simulateForUi: () => Promise.resolve(live.result),
    formatSimulationApiError: () => "erro",
  };
});

afterEach(cleanup);

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock("recharts", () => {
  const passthrough = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: passthrough,
    AreaChart: passthrough, Area: () => null,
    BarChart: passthrough, Bar: () => null,
    ComposedChart: passthrough, Line: () => null,
    PieChart: passthrough, Pie: () => null, Cell: () => null,
    XAxis: () => null, YAxis: () => null, CartesianGrid: () => null,
    Tooltip: () => null, ReferenceLine: () => null, Legend: () => null,
  };
});

/* O cenário precisa de um item parcelado: é ele que faz as recomendações
   existirem. Com o cenário vazio, `deriveRecsFromResponse` cai no texto padrão
   "adicione mais itens" com ou sem a guarda — e o teste mediria nada. */
const CENARIO = {
  id: 1,
  nome: "Cenário",
  budgetOverride: null,
  items: [
    {
      id: 1,
      tipo: "despesa_parcelada",
      nome: "Notebook",
      cat: "Tecnologia",
      total: 1200,
      valParcela: 100,
      parcelas: 12,
      isReceita: false,
    },
  ],
};

function renderPage() {
  return render(
    <SimulacaoPage
      cenarios={[CENARIO]}
      setCenarios={() => {}}
      cenarioId={1}
      setCenarioId={() => {}}
      organizationId="org-1"
    />,
  );
}

const MESES_NULOS = [
  {
    month: "2026-09",
    projected_income: null, base_expenses: null, card_commitments: null,
    savings_goal: null, total_expenses: null, balance: null, status: "unknown",
  },
];

describe("SimulacaoPage sem consolidação", () => {
  it("avisa em vez de projetar, e não recomenda nada", async () => {
    live.result = {
      months: MESES_NULOS,
      global_verdict: "unknown",
      summary: {
        total_projected_income: null, total_base_expenses: null,
        total_card_commitments: null, total_savings_goal: null,
      },
      currency_unavailable: "sem cotação EUR→BRL para 2026-09-09",
      income_by_currency: [{ amount: 5000, currency: "BRL" }],
      base_expenses_by_currency: [{ amount: 100, currency: "EUR" }],
    };

    renderPage();

    await waitFor(() =>
      expect(screen.getAllByText(/Sem projeção nesta simulação/i).length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText(/sem cotação EUR→BRL/).length).toBeGreaterThan(0);
    // Sem projeção, nenhuma recomendação: elas saem de `global_verdict`, e um
    // "parcele em 18×" tirado de um veredito que ninguém calculou é conselho
    // financeiro inventado.
    expect(screen.queryByText(/Parcelar/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/dentro da margem segura/i)).not.toBeInTheDocument();
  });

  it("com consolidação, a projeção aparece como sempre", async () => {
    live.result = {
      months: [
        {
          month: "2026-09",
          projected_income: 5000, base_expenses: 1000, card_commitments: 0,
          savings_goal: 0, total_expenses: 1000, balance: 4000, status: "success",
        },
      ],
      global_verdict: "viable",
      summary: {
        total_projected_income: 5000, total_base_expenses: 1000,
        total_card_commitments: 0, total_savings_goal: 0,
      },
      currency_unavailable: null,
      income_by_currency: [], base_expenses_by_currency: [],
    };

    renderPage();

    await waitFor(() =>
      expect(screen.getAllByText(/dentro da margem segura/i).length).toBeGreaterThan(0),
    );
    expect(screen.queryByText(/Sem projeção nesta simulação/i)).not.toBeInTheDocument();
  });
});
