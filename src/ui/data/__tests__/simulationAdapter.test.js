/**
 * Cobre os bugs encontrados em 2026-06 na tela de Simulação:
 *
 * 1. O backend serializa Decimal como string ("0", "1234.56") e o adapter
 *    fazia aritmética direto, gerando NaN nas KPIs (PROJEÇÃO, MARGEM).
 * 2. O nome do campo é `total_projected_income` (não `income`) — o adapter
 *    lia o campo errado e caía em `undefined` → NaN.
 * 3. O label de "Projeção" era hardcoded "março" — o adapter agora devolve
 *    `lastMonthLabel` para o consumer formatar dinamicamente.
 */
import { describe, expect, it } from "vitest";
import {
  deriveChartDataFromResponse,
  deriveImpactsFromResponse,
  deriveKpisFromResponse,
  deriveRisksFromResponse,
} from "../simulationAdapter";

const RESPONSE_WITH_DATA = {
  months: [
    {
      month: "2026-06",
      projected_income: "10000.00",
      base_expenses: "4000.00",
      card_commitments: "1500.00",
      savings_goal: "500.00",
      total_expenses: "6000.00",
      balance: "4000.00",
      status: "success",
    },
    {
      month: "2026-07",
      projected_income: "10000.00",
      base_expenses: "4000.00",
      card_commitments: "1500.00",
      savings_goal: "500.00",
      total_expenses: "6000.00",
      balance: "4000.00",
      status: "warning",
    },
    {
      month: "2026-08",
      projected_income: "10000.00",
      base_expenses: "4000.00",
      card_commitments: "1500.00",
      savings_goal: "500.00",
      total_expenses: "6000.00",
      balance: "4000.00",
      status: "danger",
    },
  ],
  global_verdict: "caution",
  summary: {
    total_projected_income: "30000.00",
    total_base_expenses: "12000.00",
    total_card_commitments: "4500.00",
    total_savings_goal: "1500.00",
  },
};

const EMPTY_RESPONSE = {
  months: [
    {
      month: "2026-06",
      projected_income: "0",
      base_expenses: "0",
      card_commitments: "0",
      savings_goal: "0",
      total_expenses: "0",
      balance: "0",
      status: "success",
    },
  ],
  global_verdict: "viable",
  summary: {
    total_projected_income: "0",
    total_base_expenses: "0",
    total_card_commitments: "0",
    total_savings_goal: "0",
  },
};

describe("deriveKpisFromResponse", () => {
  it("aceita Decimal serializado como string e calcula KPIs sem NaN", () => {
    const kpis = deriveKpisFromResponse(RESPONSE_WITH_DATA);

    expect(Number.isFinite(kpis.income)).toBe(true);
    expect(Number.isFinite(kpis.totalSim)).toBe(true);
    expect(Number.isFinite(kpis.totalExpenses)).toBe(true);
    expect(Number.isFinite(kpis.margem)).toBe(true);

    expect(kpis.income).toBe(30000);
    expect(kpis.baseExpenses).toBe(12000);
    expect(kpis.cardCommitments).toBe(4500);
    expect(kpis.savingsGoal).toBe(1500);
    expect(kpis.totalSim).toBe(6000); // card_commitments + savings_goal
    expect(kpis.totalExpenses).toBe(18000); // base + totalSim
    expect(kpis.margem).toBe(12000); // income - totalExpenses
    expect(kpis.projecaoOk).toBe(true);
    expect(kpis.verdict).toBe("caution");
  });

  it("zera tudo sem retornar NaN quando a API responde com 0", () => {
    const kpis = deriveKpisFromResponse(EMPTY_RESPONSE);

    expect(kpis.income).toBe(0);
    expect(kpis.totalSim).toBe(0);
    expect(kpis.totalExpenses).toBe(0);
    expect(kpis.margem).toBe(0);
    expect(kpis.projecaoOk).toBe(true); // margem >= 0
    expect(kpis.verdict).toBe("viable");
  });

  it("expõe lastMonthLabel para o KPI 'Projeção <mês>' não ficar hardcoded", () => {
    expect(deriveKpisFromResponse(RESPONSE_WITH_DATA).lastMonthLabel).toBe("ago/26");
    expect(deriveKpisFromResponse(EMPTY_RESPONSE).lastMonthLabel).toBe("jun/26");
  });

  it("tolera summary com nomes curtos (income / base_expenses / etc) caso o backend evolua", () => {
    const shortFormat = {
      months: [{ month: "2026-06", status: "success", balance: "0" }],
      global_verdict: "viable",
      summary: {
        income: "5000",
        base_expenses: "1000",
        card_commitments: "500",
        savings_goal: "100",
      },
    };
    const kpis = deriveKpisFromResponse(shortFormat);
    expect(kpis.income).toBe(5000);
    expect(kpis.totalExpenses).toBe(1600);
    expect(kpis.margem).toBe(3400);
  });

  it("não quebra com summary vazio (proteção de defesa em profundidade)", () => {
    const broken = { months: [], global_verdict: "viable", summary: undefined };
    const kpis = deriveKpisFromResponse(broken);
    expect(kpis.income).toBe(0);
    expect(kpis.totalSim).toBe(0);
    expect(kpis.margem).toBe(0);
    expect(kpis.lastMonthLabel).toBe(null);
  });
});

describe("deriveChartDataFromResponse", () => {
  it("converte campos do mês de string para number para o Recharts plotar", () => {
    const rows = deriveChartDataFromResponse(RESPONSE_WITH_DATA);
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(typeof r.receita).toBe("number");
      expect(typeof r.despBase).toBe("number");
      expect(typeof r.comSim).toBe("number");
      expect(typeof r.saldo).toBe("number");
    }
    expect(rows[0]).toMatchObject({
      label: "jun/26",
      month: "2026-06",
      receita: 10000,
      despBase: 4000,
      comSim: 6000,
      saldo: 4000,
      status: "success",
    });
  });

  it("devolve [] quando não há months", () => {
    expect(deriveChartDataFromResponse({ months: [], summary: {} })).toEqual([]);
    expect(deriveChartDataFromResponse(undefined)).toEqual([]);
    expect(deriveChartDataFromResponse({})).toEqual([]);
  });
});

describe("deriveRisksFromResponse", () => {
  const fmt = (n) => `R$ ${n.toFixed(2)}`;

  it("retorna [] quando não há months (não estoura .length em undefined)", () => {
    expect(deriveRisksFromResponse({}, fmt)).toEqual([]);
    expect(deriveRisksFromResponse(undefined, fmt)).toEqual([]);
  });

  it("emite risco ALTO para o primeiro mês em danger com balance string", () => {
    const r = deriveRisksFromResponse(RESPONSE_WITH_DATA, fmt);
    const alto = r.find((x) => x.nivel === "ALTO");
    expect(alto).toBeDefined();
    expect(alto.title).toContain("ago/26");
    expect(alto.desc).toContain("R$ 4000.00");
  });

  it("emite BAIXO 'Fluxo sustentável' só quando TODOS são success", () => {
    const allSuccess = {
      months: [
        { month: "2026-06", status: "success", balance: "0" },
        { month: "2026-07", status: "success", balance: "0" },
      ],
      summary: {},
      global_verdict: "viable",
    };
    const r = deriveRisksFromResponse(allSuccess, fmt);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ nivel: "BAIXO", title: "Fluxo sustentável no período" });
  });

  it("não emite 'Fluxo sustentável' quando months está vazio", () => {
    const r = deriveRisksFromResponse({ months: [], summary: {} }, fmt);
    expect(r).toEqual([]);
  });
});

describe("deriveImpactsFromResponse", () => {
  it("calcula limite por categoria sem dividir por zero quando months está vazio", () => {
    const items = [
      { tipo: "despesa_parcelada", isReceita: false, cat: "Tecnologia", valParcela: 300, total: 3600 },
    ];
    const impactos = deriveImpactsFromResponse({ months: [], summary: {} }, items);
    expect(impactos).toHaveLength(1);
    expect(impactos[0].cat).toBe("Tecnologia");
    expect(impactos[0].limite).toBe(0); // budget=0 → limite=0
    expect(impactos[0].pct).toBe(100);
  });

  it("usa total_base_expenses (não base_expenses) para o budget", () => {
    const items = [
      { tipo: "despesa_parcelada", isReceita: false, cat: "Tecnologia", valParcela: 300, total: 3600 },
    ];
    const impactos = deriveImpactsFromResponse(RESPONSE_WITH_DATA, items);
    // budget = total_base_expenses / months = 12000 / 3 = 4000
    // limite = round(4000 * 0.3) = 1200
    expect(impactos[0].limite).toBe(1200);
  });
});
