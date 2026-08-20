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

  /** Mesma regra de `daysLeftInRange` na página: do dia de hoje até o fim do mês. */
  function diasRestantes() {
    const hoje = new Date();
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    const t = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
    const e = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate()).getTime();
    if (e < t) return 1;
    return Math.max(1, Math.floor((e - t) / 86400000) + 1);
  }
  const brl = (v) =>
    `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  it("usa o caixa quando ele é menor que a sobra do ciclo", () => {
    // Sobra do ciclo = 600, caixa = 30 → o teto tem de sair do caixa.
    // Afirmar o VALOR, não uma negativa: `not.toMatch(/R$ 600/)` passaria igual se o
    // teto por caixa fosse removido, porque a fórmula antiga (600/dias) também nunca
    // imprime "600" fora do último dia do período.
    mockDashboardData = {
      ...baseData(),
      balanceSummary: { as_of: "2026-04-15T12:00:00", total_available: 30, total_all: 30, account_count: 1, by_type: [] },
    };
    renderDash();
    const insight = screen.getByTestId("dashboard-insight-quantias").parentElement;
    const esperado = brl(Math.round(30 / diasRestantes()));
    expect(insight.textContent).toContain(`${esperado}/dia`);
  });

  it("sem saber o caixa, não inventa um teto — cai no ciclo, não em zero", () => {
    mockDashboardData = { ...baseData(), balanceSummary: null };
    renderDash();
    const insight = screen.getByTestId("dashboard-insight-quantias").parentElement;
    // A asserção anterior era `not.toMatch(/R$ 0\/dia/)`, que NUNCA casa: `fmtAbs`
    // sempre emite duas casas ("R$ 0,00/dia"). Passava com qualquer implementação.
    const esperado = brl(Math.round(600 / diasRestantes()));
    expect(insight.textContent).toContain(`${esperado}/dia`);
    expect(insight.textContent).not.toMatch(/Sem caixa disponível/i);
  });

  it("resultado negativo com caixa cheio NÃO diz 'sem caixa'", () => {
    // A guarda amarrada a `dailyBudget <= 0` fazia qualquer período negativo afirmar
    // falta de caixa — inclusive com R$ 50.000 na conta, e inclusive com o endpoint
    // de saldo fora do ar, contradizendo o próprio invariante da página.
    mockDashboardData = {
      ...baseData(),
      summary: { ...baseData().summary, total_expenses: 2200, balance: -1200 },
      balanceSummary: { as_of: "2026-04-15T12:00:00", total_available: 50000, total_all: 50000, account_count: 1, by_type: [] },
    };
    renderDash();
    const insight = screen.getByTestId("dashboard-insight-quantias").parentElement;
    expect(insight.textContent).not.toMatch(/Sem caixa disponível/i);
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

/**
 * Dois falsos-negativos que sobreviveram à primeira correção do clamp: o número que
 * o KPI imprime e a frase que o Insight escreve quando não há caixa.
 */
describe("DashboardPage — o que sobra pode ser negativo, e sem caixa não há folga", () => {
  function renderDash(orgId) {
    return render(
      <DashboardPage
        onNav={vi.fn()}
        stateCtrl={{ mounted: true, isMobile: false }}
        dataMode="live"
        organizationId={orgId}
        onNewTx={vi.fn()}
      />,
    );
  }

  it("compromissos maiores que a sobra dão número negativo, não zero", async () => {
    // Sobra do ciclo 600, recorrências a vencer 3.000 → a verdade é −2.400.
    // O clamp existe para a largura da fatia; imprimi-lo aqui diria "R$ 0,00" e
    // esconderia exatamente o que o usuário precisa saber.
    projectionItems = [
      { series_id: "s1", date: "2026-04-25", value: 3000, type: "expense", description: "Fatura", category: "cartao" },
    ];
    renderDash("org-neg-sobra");
    const kpi = await screen.findByTestId("dashboard-kpi-sobra");
    expect(kpi).toHaveTextContent("−R$ 2.400,00");
  });

  it("sem caixa, o Insight não promete folga", () => {
    mockDashboardData = {
      ...baseData(),
      balanceSummary: { as_of: "2026-04-15T12:00:00", total_available: 0, total_all: 0, account_count: 1, by_type: [] },
    };
    renderDash("org-sem-caixa");
    // A frase da faixa `serene` diria "você pode gastar até R$ 0,00/dia com folga"
    // logo abaixo de "Suas finanças respiram bem hoje".
    const insight = screen.getByTestId("dashboard-insight-quantias").parentElement;
    expect(insight.textContent).not.toMatch(/com folga/i);
    expect(insight.textContent).toMatch(/Sem caixa disponível/i);
  });
});

/**
 * O sintoma que abriu a #88 — "Total · próx. 14 dias" imprimindo R$ NaN — não tinha
 * teste de renderização em lugar nenhum: o fixture fixava `upcomingDebits: []`, e a
 * soma dava zero com ou sem a correção. Uma revisão provou por mutação que reverter
 * o `reduce` mantinha tudo verde.
 *
 * Este caso alimenta os débitos com `value` em STRING, que é como a API entregava
 * antes da normalização na fronteira, e prova que o total sai somado — não
 * concatenado.
 */
describe("DashboardPage — Total dos Próximos Débitos", () => {
  it("soma os valores em vez de concatenar", () => {
    mockDashboardData = {
      ...baseData(),
      upcomingDebits: [
        { id: "d1", name: "Internet", value: "120.00", day: 20, monthShort: "ago", cat: "Serviços", daysLeft: 1, dateLabel: "20/08" },
        { id: "d2", name: "Energia", value: "310.50", day: 22, monthShort: "ago", cat: "Moradia", daysLeft: 3, dateLabel: "22/08" },
      ],
    };
    render(
      <DashboardPage
        onNav={vi.fn()}
        stateCtrl={{ mounted: true, isMobile: false }}
        dataMode="live"
        organizationId="org-debitos"
        onNewTx={vi.fn()}
      />,
    );
    const total = screen.getByText(/Total · próx\. 14 dias/i).parentElement;
    expect(total.textContent).toContain("R$ 430,50");
    expect(total.textContent).not.toMatch(/NaN/);
  });
});

/**
 * Issue #87 — no Poco X7 Pro (e telas estreitas em geral) o card de saldo/resultado
 * e o card de Insight estouravam a largura da tela, forçando scroll horizontal na
 * página — proibido pelo shell (CLAUDE.md). As linhas flex culpadas tinham vários
 * elementos (badge + saudação + chip da régua; número + rótulo comprido) sem
 * `flexWrap`, então cresciam além do container em vez de quebrar linha.
 */
describe("DashboardPage — issue #87: sem estouro horizontal no mobile", () => {
  function renderMobile(overrides) {
    if (overrides) mockDashboardData = { ...baseData(), ...overrides };
    return render(
      <DashboardPage
        onNav={vi.fn()}
        stateCtrl={{ mounted: true, isMobile: true }}
        dataMode="live"
        organizationId="org-mobile-87"
        onNewTx={vi.fn()}
      />,
    );
  }

  it("a linha do selo de humor + chip da régua pode quebrar no mobile", () => {
    renderMobile();
    const regua = screen.getByTestId("dashboard-regua-ritmo");
    // O pai imediato é a linha flex que junta badge de humor + saudação + régua.
    const linha = regua.parentElement;
    expect(getComputedStyle(linha).flexWrap).toBe("wrap");
  });

  it("as duas linhas de quantia do Insight (número + rótulo) podem quebrar no mobile", () => {
    renderMobile();
    const quantias = screen.getByTestId("dashboard-insight-quantias");
    const linhas = quantias.children;
    expect(linhas.length).toBeGreaterThanOrEqual(2);
    for (const linha of linhas) {
      expect(getComputedStyle(linha).flexWrap).toBe("wrap");
    }
  });

  it("o filete vertical entre saldo e resultado não sobra sozinho quando as colunas quebram", () => {
    renderMobile();
    const saldo = screen.getByTestId("dashboard-headline-saldo-conta");
    const resultado = screen.getByTestId("dashboard-headline-resultado");
    // No mobile as duas colunas ficam lado a lado do filete: se ele sobrevivesse,
    // apareceria como um terceiro irmão entre elas.
    expect(saldo.parentElement).toBe(resultado.parentElement);
    const irmaos = Array.from(saldo.parentElement.children);
    expect(irmaos.indexOf(saldo) + 1).toBe(irmaos.indexOf(resultado));
  });
});
