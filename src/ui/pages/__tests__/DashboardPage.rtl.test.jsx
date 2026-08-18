/** @vitest-environment jsdom */

import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { DashboardPage } from "../DashboardPage.jsx";

let mockDashboardData;

vi.mock("../../features/dashboard/useDashboardData.js", () => ({
  useDashboardData: () => mockDashboardData,
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

/**
 * `getRecurringProjection` é chamada pela própria página, não pelo hook mockado.
 * `null` simula endpoint fora do ar — que é o padrão dos testes que não se importam
 * com a projeção, e o caso em que a barra não pode prometer "depois das recorrências".
 */
let projectionItems = null;
vi.mock("../../../api/recurringSeries", () => ({
  getRecurringProjection: () =>
    projectionItems === null
      ? Promise.reject(new Error("projeção fora do ar"))
      : Promise.resolve({ items: projectionItems }),
}));

// Sem isto os renders se acumulam no mesmo DOM e um mesmo testid aparece N vezes.
afterEach(cleanup);

/**
 * Baseline explícito, em função.
 *
 * Antes cada `describe` espalhava (`...mockDashboardData`) o que o describe anterior
 * tinha deixado na variável — os testes passavam pela ORDEM em que rodam. Com a
 * fábrica, cada bloco parte do mesmo estado conhecido.
 */
function baseData() {
  return {
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
  };
}

beforeEach(() => {
  projectionItems = null;
  mockDashboardData = baseData();
});

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

  it("não mostra comparação falsa quando o avg não existe", () => {
    mockDashboardData = {
      ...mockDashboardData,
      categories: [
        {
          tagId: 1,
          name: "Alimentação",
          value: 220,
          avg: null,
          color: "#EF4444",
        },
      ],
    };

    render(
      <DashboardPage
        onNav={vi.fn()}
        stateCtrl={{ mounted: true, isMobile: false }}
        dataMode="live"
        organizationId="org-rtl"
        onNewTx={vi.fn()}
      />,
    );

    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.queryByText(/\+22%/)).not.toBeInTheDocument();
    expect(screen.queryByText("referência")).not.toBeInTheDocument();
  });
});

/**
 * O saldo em conta saiu do quarto KPI e virou o HEADLINE (opção D). O que estes
 * testes garantem não mudou — número real, pluralização, sinal do negativo, degradar
 * para "—" e independência das fontes — só o lugar onde a tela mostra isso.
 */
describe("DashboardPage — saldo em conta no headline (opção D)", () => {
  function renderDash() {
    return render(
      <DashboardPage
        onNav={vi.fn()}
        stateCtrl={{ mounted: true, isMobile: false }}
        dataMode="live"
        organizationId="org-rtl"
        onNewTx={vi.fn()}
      />,
    );
  }

  beforeEach(() => {
    mockDashboardData = {
      ...baseData(),
      balanceSummary: {
        as_of: "2026-08-16T12:00:00",
        total_available: 329.91,
        total_all: 329.91,
        account_count: 1,
        by_type: [],
      },
    };
  });

  it("mostra o saldo REAL das contas, não o resultado do período", () => {
    renderDash();
    const headline = screen.getByTestId("dashboard-headline-saldo-conta");
    expect(headline).toHaveTextContent("Saldo em conta");
    expect(headline).toHaveTextContent(/329,91/);
    // O resultado do período continua na tela, ao lado e menor, com o SEU número.
    const periodo = screen.getByTestId("dashboard-headline-resultado");
    expect(periodo).toHaveTextContent("Resultado do período");
    expect(periodo).toHaveTextContent(/600/);
    // E não pode herdar a cor do humor: saldo em conta é fato, não tem humor.
    expect(headline).not.toHaveTextContent(/ritmo/i);
  });

  it("pluraliza a contagem de contas", () => {
    renderDash();
    expect(screen.getByTestId("dashboard-headline-saldo-conta")).toHaveTextContent("em 1 conta");

    cleanup();
    mockDashboardData = {
      ...mockDashboardData,
      balanceSummary: { ...mockDashboardData.balanceSummary, account_count: 3 },
    };
    renderDash();
    expect(screen.getByTestId("dashboard-headline-saldo-conta")).toHaveTextContent("em 3 contas");
  });

  it("saldo negativo mostra o sinal — não pode parecer positivo", () => {
    mockDashboardData = {
      ...mockDashboardData,
      balanceSummary: { ...mockDashboardData.balanceSummary, total_available: -1500 },
    };
    renderDash();
    const card = screen.getByTestId("dashboard-headline-saldo-conta");
    // fmtAbs sozinho renderizaria "R$ 1.500,00", idêntico a um saldo positivo,
    // com a cor da seta como única pista. Conta no vermelho não pode mentir.
    expect(card).toHaveTextContent("−R$ 1.500,00");
    expect(card).toHaveTextContent(/negativa/);
  });

  it("degrada para '—' quando o saldo não vem — zero seria uma mentira plausível", () => {
    mockDashboardData = { ...mockDashboardData, balanceSummary: null };
    renderDash();
    const card = screen.getByTestId("dashboard-headline-saldo-conta");
    expect(card).toHaveTextContent("—");
    expect(card).toHaveTextContent("Dados indisponíveis");
  });

  it("aparece mesmo quando o resumo do período falhou (fontes independentes)", () => {
    mockDashboardData = {
      ...mockDashboardData,
      summary: null,
      error: "backend fora",
      hasRealData: false,
    };
    renderDash();
    expect(screen.getByTestId("dashboard-headline-saldo-conta")).toHaveTextContent(/329,91/);
  });
});

/**
 * A barra de composição somava o que não podia ser somado.
 *
 * A versão antiga desenhava `Gasto + Comprometido + Sobra` e imprimia o total. Como
 * `Sobra` é `receitas − Gasto` por definição, aquele total era SEMPRE
 * `receitas + Comprometido` — numa org medida em produção, R$ 23.813,06 contra
 * R$ 19.685,42 de receita. E o `Comprometido` vinha de `recurring_in_period`, que o
 * backend documenta como projeção do intervalo inteiro: as recorrências já pagas
 * estavam dentro do `Gasto` e as futuras dentro da `Sobra`, contadas duas vezes e
 * desenhadas como terceira fatia. Todas as larguras saíam comprimidas.
 */
describe("DashboardPage — barra de composição é partição das receitas", () => {
  function renderDash() {
    return render(
      <DashboardPage
        onNav={vi.fn()}
        stateCtrl={{ mounted: true, isMobile: false }}
        dataMode="live"
        organizationId="org-bar"
        onNewTx={vi.fn()}
      />,
    );
  }

  it("as três fatias somam exatamente as receitas do período", async () => {
    projectionItems = [
      { series_id: "s1", date: "2026-04-20", value: 150, type: "expense", description: "Internet", category: "casa" },
      { series_id: "s2", date: "2026-04-28", value: 50, type: "expense", description: "Streaming", category: "lazer" },
    ];
    renderDash();

    // Gasto 400 + Comprometido a vencer 200 + Sobra 400 = 1000 = receitas.
    const comprometido = await screen.findByTestId("dashboard-composicao-comprometido");
    expect(comprometido).toHaveTextContent("R$ 200,00");
    const barra = screen.getByTestId("dashboard-composicao");
    expect(within(barra).getByTestId("dashboard-composicao-total")).toHaveTextContent("R$ 1.000,00");
    expect(within(barra).getByText("Sobra depois das recorrências")).toBeTruthy();
  });

  it("sem a projeção, a fatia do meio não existe e o rótulo não promete o que não sabe", () => {
    projectionItems = null; // endpoint fora do ar
    renderDash();

    const barra = screen.getByTestId("dashboard-composicao");
    expect(within(barra).queryByTestId("dashboard-composicao-comprometido")).toBeNull();
    // Nem a barra nem o KPI podem prometer "depois das recorrências" sem saber quais são.
    expect(screen.queryByText("Sobra depois das recorrências")).toBeNull();
    expect(within(barra).getByText("Sobra do período")).toBeTruthy();
  });
});

/**
 * O conselho do Insight recomendava gastar dinheiro que não existe.
 *
 * `dailyBudget` era `balance / diasRestantes`, e `balance` é receitas − despesas do
 * período: competência, não caixa. Medido em produção: "mantenha R$ 625/dia pelos
 * próximos 16 dias" — R$ 10.000 — com R$ 315,57 na conta, porque o caixa já tinha ido
 * no pagamento da fatura. Não era otimista: era impossível de seguir.
 */
describe("DashboardPage — valor/dia é limitado pelo caixa", () => {
  function renderDash() {
    return render(
      <DashboardPage
        onNav={vi.fn()}
        stateCtrl={{ mounted: true, isMobile: false }}
        dataMode="live"
        organizationId="org-cash"
        onNewTx={vi.fn()}
      />,
    );
  }

  it("usa o caixa quando ele é menor que a sobra do ciclo", () => {
    // Sobra do ciclo = 600. Caixa = 30. O conselho tem de sair do caixa.
    mockDashboardData = {
      ...mockDashboardData,
      balanceSummary: { as_of: "2026-04-15T12:00:00", total_available: 30, total_all: 30, account_count: 1, by_type: [] },
    };
    renderDash();
    const insight = screen.getByTestId("dashboard-insight-quantias").parentElement;
    expect(insight.textContent).not.toMatch(/R\$ 600/);
  });

  it("sem saber o caixa, não inventa um teto — zero seria pior que o comportamento antigo", () => {
    mockDashboardData = { ...mockDashboardData, balanceSummary: null };
    renderDash();
    // Não pode virar "R$ 0/dia" só porque o endpoint de saldo caiu.
    const insight = screen.getByTestId("dashboard-insight-quantias").parentElement;
    expect(insight.textContent).not.toMatch(/R\$ 0\/dia/);
  });
});

/**
 * O Insight mostrava a DIFERENÇA em corpo 26 — "R$ 544 à frente" — uma grandeza que
 * não está em conta nenhuma. E o mesmo número aparecia três vezes na tela com três
 * nomes diferentes, como se fossem três medidas distintas.
 */
describe("DashboardPage — Insight mostra as duas quantias", () => {
  it("mostra gasto e ritmo linear, não a diferença entre eles", () => {
    render(
      <DashboardPage
        onNav={vi.fn()}
        stateCtrl={{ mounted: true, isMobile: false }}
        dataMode="live"
        organizationId="org-insight"
        onNewTx={vi.fn()}
      />,
    );
    const quantias = screen.getByTestId("dashboard-insight-quantias");
    expect(quantias).toHaveTextContent("R$ 400,00"); // despesas reais
    expect(quantias).toHaveTextContent("gastos no período");
    expect(quantias).toHaveTextContent("seria o ritmo linear da receita");
    // A frase antiga prometia uma régua que a tela nunca definia.
    expect(quantias).not.toHaveTextContent(/ritmo esperado/i);
    expect(quantias).not.toHaveTextContent(/à frente/i);
  });

  it("resultado negativo mostra o sinal — a cor do humor mede ritmo, não sinal", () => {
    // Na `main` o sinal sobrevivia no KPI "Saldo do período" (seta vermelha). Ao subir
    // o número para o headline esta PR removeu aquele KPI, e `fmtAbs` aplica Math.abs:
    // −1.200 renderizava idêntico a +1.200.
    mockDashboardData = {
      ...baseData(),
      summary: { ...baseData().summary, total_expenses: 2200, balance: -1200 },
    };
    render(
      <DashboardPage
        onNav={vi.fn()}
        stateCtrl={{ mounted: true, isMobile: false }}
        dataMode="live"
        organizationId="org-neg"
        onNewTx={vi.fn()}
      />,
    );
    const resultado = screen.getByTestId("dashboard-headline-resultado");
    expect(resultado).toHaveTextContent("−R$ 1.200,00");
  });

  it("os botões navegam — antes eram cursor:pointer sem onClick", () => {
    const onNav = vi.fn();
    render(
      <DashboardPage
        onNav={onNav}
        stateCtrl={{ mounted: true, isMobile: false }}
        dataMode="live"
        organizationId="org-cta"
        onNewTx={vi.fn()}
      />,
    );
    const botao = screen.getByRole("button", { name: /Simular uma compra|Simular impacto|Ver projeção|O que posso cortar|Revisão urgente/ });
    botao.click();
    // A validade do destino é garantida em `moodActions.test.js`, contra os mesmos
    // predicados que `navTo` usa — aqui basta provar que o clique chega ao despachante
    // com a sub-área junto, que é o que o mock desta suíte consegue observar.
    expect(onNav).toHaveBeenCalledTimes(1);
    const [alvo, opts] = onNav.mock.calls[0];
    expect(typeof alvo).toBe("string");
    if (alvo === "planning") expect(opts?.area).toBeTruthy();
  });
});
