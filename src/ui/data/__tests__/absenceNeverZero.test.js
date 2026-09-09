/**
 * As quatro leituras que ainda transformavam ausência de cotação em zero (#188).
 *
 * O backend manda `null` de propósito quando não dá para converter as moedas da
 * organização. Cada uma destas funções desfazia isso na última camada — e o
 * resultado não era um número faltando na tela, era um número ERRADO com cara de
 * certo: barra rente ao eixo, área colada no fundo, curva achatada.
 */
import { describe, expect, it } from "vitest";

import { selectClientEvolutionSeries } from "../../features/consultant/consultantClientOverview.js";
import { buildRhythmChart } from "../../features/dashboard/useDashboardData.js";
import { buildDriftData } from "../reportsAdapter.js";
import { buildImpactLineChartData } from "../novaTransacaoImpactUtils.js";

describe("evolução do cliente no painel do consultor", () => {
  it("o mês sem cotação vira lacuna, não uma barra zerada", () => {
    const serie = selectClientEvolutionSeries([
      { year: 2026, month: 8, total_income: 5000, total_expenses: 3000, balance: 2000 },
      { year: 2026, month: 9, total_income: null, total_expenses: null, balance: null },
    ]);

    expect(serie[0]).toMatchObject({ income: 5000, expenses: 3000, balance: 2000 });
    // `Number(null) || 0` dava 0 aqui, e o gráfico afirmava um mês sem receita
    // nem gasto para o cliente.
    expect(serie[1]).toMatchObject({ income: null, expenses: null, balance: null });
  });
});

describe("evolução por categoria dos Relatórios", () => {
  it("o mês sem total vira lacuna na área da categoria", () => {
    const { driftData } = buildDriftData({
      months: ["jan/26", "fev/26"],
      categories: [
        { tag_id: "t1", tag_name: "Moradia", monthly_totals: [1500, null] },
      ],
    });

    expect(driftData[0].Moradia).toBe(1500);
    expect(driftData[1].Moradia).toBeNull();
  });

  it("um valor inválido continua caindo em lacuna, não em zero", () => {
    const { driftData } = buildDriftData({
      months: ["jan/26"],
      categories: [{ tag_id: "t1", tag_name: "Moradia", monthly_totals: ["lixo"] }],
    });

    expect(driftData[0].Moradia).toBeNull();
  });
});

describe("impacto financeiro da Nova Transação", () => {
  const dias = (valores) =>
    valores.map((v, i) => ({
      date: `2026-09-${String(i + 1).padStart(2, "0")}`,
      total_expenses: v,
    }));

  it("com todos os dias legíveis, a curva acumula normalmente", () => {
    const linhas = buildImpactLineChartData(dias([10, 20, 30]), "2026-09-15", null);

    expect(linhas[0].real).toBe(10);
    expect(linhas[1].real).toBe(30);
    expect(linhas[2].real).toBe(60);
  });

  it("um dia sem cotação apaga a curva inteira", () => {
    /* A curva é ACUMULADA: tratar o dia nulo como zero não erraria só aquele
       ponto — achataria todo o resto do mês para baixo, e a linha continuaria
       com cara de linha. */
    expect(buildImpactLineChartData(dias([10, null, 30]), "2026-09-15", null)).toEqual([]);
  });
});

describe("ritmo de gastos do Painel", () => {
  const TX = [
    { date: "2026-09-02", value: "100.00", type: "expense" },
    { date: "2026-09-05", value: "200.00", type: "expense" },
  ];

  it("com os totais do período, o gráfico é desenhado", () => {
    const r = buildRhythmChart(
      TX,
      { total_expenses: 300, total_income: 5000 },
      "2026-09-01",
      "2026-09-30",
    );

    expect(r.series.length).toBe(30);
  });

  it("sem os totais, não desenha nada", () => {
    /* `?? 0` achatava a projeção rente ao eixo e jogava a curva real no ramo de
       fallback — a soma NOMINAL das transações, com euro empilhado em real.
       Duas linhas erradas com aparência de gráfico. */
    const r = buildRhythmChart(
      TX,
      { total_expenses: null, total_income: null },
      "2026-09-01",
      "2026-09-30",
    );

    expect(r.series).toEqual([]);
    expect(r.showTodayMarker).toBe(false);
  });
});
