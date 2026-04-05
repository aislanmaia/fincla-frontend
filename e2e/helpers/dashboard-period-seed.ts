/**
 * Cenário determinístico para o datepicker do dashboard:
 * séries com ocorrências nos dias 1–3 do mês (materializáveis quando hoje >= 4)
 * + uma série de despesa só a partir do mês corrente (não entra no mês passado).
 */
import {
  fetchFirstCategoriaTagId,
  loginOwnerBearer,
  postRecurringSeries,
  postTransaction,
} from "./api-owner";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymdDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export type DashboardPeriodExpectations = {
  /** Valores exibidos com fmtAbs (espaço após R$) */
  prev: {
    receitas: string;
    despesas: string;
    comprometido: string;
  };
  thisMonth: {
    receitas: string;
    despesas: string;
    comprometido: string;
  };
};

function fmtAbsPt(n: number): string {
  const s = Math.abs(n).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `R$ ${s}`;
}

const VAL = {
  eLong: 100,
  eFuture: 250,
  iLong: 800,
  iFuture: 5000,
  manualExpPrev: 33.33,
  manualExpThis: 44.44,
  manualIncThis: 150,
} as const;

/**
 * Pré-condição: `new Date().getDate() >= minDay` para o mês atual já ter
 * materializado as recorrências dos dias 1–3.
 */
export const DASHBOARD_PERIOD_MIN_DAY_OF_MONTH = 4;

/**
 * Janela do mês passado apenas nos dias 1–5 (via Personalizado):
 * entra I_LONG (dia 1) e E_LONG (dia 2); fora a avulsa do dia 15.
 */
export function expectedKpisPrevMonthFirstFiveDays(): {
  receitas: string;
  despesas: string;
  comprometido: string;
} {
  return {
    receitas: fmtAbsPt(VAL.iLong),
    despesas: fmtAbsPt(VAL.eLong),
    comprometido: fmtAbsPt(VAL.eLong),
  };
}

/**
 * Expectativas para `rangeBillingCycleFiveToFour(anchor)` alinhadas ao seed:
 * - Ciclo que termina no dia 4 do mês de `anchor`: mês anterior (a partir do dia 5) + dias 1–4 do atual
 *   → avulsa do dia 15 do mês anterior + recorrências dos dias 1–4 do mês atual (com séries “só mês atual”).
 * - Ciclo anterior (quando o dia 4 do mês atual ainda não passou): só dias 1–4 do mês anterior, sem essas séries.
 */
export function expectedKpisBillingCycleFiveToFour(anchor: Date): {
  receitas: string;
  despesas: string;
  comprometido: string;
} {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d = anchor.getDate();
  const endCurr = new Date(y, m, 4);
  const primary = endCurr.getTime() <= new Date(y, m, d).getTime();

  if (primary) {
    const manualThisMonthDay = Math.min(10, d);
    const avulsasNoTrechoInicial =
      manualThisMonthDay >= 1 && manualThisMonthDay <= 4;
    const receitas =
      VAL.iLong +
      VAL.iFuture +
      (avulsasNoTrechoInicial ? VAL.manualIncThis : 0);
    const despesas =
      VAL.manualExpPrev +
      VAL.eLong +
      VAL.eFuture +
      (avulsasNoTrechoInicial ? VAL.manualExpThis : 0);
    return {
      receitas: fmtAbsPt(receitas),
      despesas: fmtAbsPt(despesas),
      comprometido: fmtAbsPt(VAL.eLong + VAL.eFuture),
    };
  }
  return {
    receitas: fmtAbsPt(VAL.iLong),
    despesas: fmtAbsPt(VAL.eLong),
    comprometido: fmtAbsPt(VAL.eLong),
  };
}

export function buildDashboardPeriodExpectations(): DashboardPeriodExpectations {
  const committedPrev = VAL.eLong;
  const committedThis = VAL.eLong + VAL.eFuture;

  const receitasPrev = VAL.iLong;
  const despesasPrev = VAL.eLong + VAL.manualExpPrev;

  const receitasThis = VAL.iLong + VAL.iFuture + VAL.manualIncThis;
  const despesasThis = VAL.eLong + VAL.eFuture + VAL.manualExpThis;

  return {
    prev: {
      receitas: fmtAbsPt(receitasPrev),
      despesas: fmtAbsPt(despesasPrev),
      comprometido: fmtAbsPt(committedPrev),
    },
    thisMonth: {
      receitas: fmtAbsPt(receitasThis),
      despesas: fmtAbsPt(despesasThis),
      comprometido: fmtAbsPt(committedThis),
    },
  };
}

export async function seedDashboardRecurringPeriodData(organizationId: string): Promise<void> {
  const bearer = await loginOwnerBearer();
  const tagId = await fetchFirstCategoriaTagId(bearer, organizationId);

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const firstThis = new Date(y, m, 1);
  const firstThisYmd = ymdDate(firstThis);

  const midPrev = new Date(y, m - 1, 15);

  await postRecurringSeries(bearer, organizationId, {
    type: "expense",
    description: "E2E dash — despesa longa d2",
    value: VAL.eLong,
    payment_method: "pix",
    frequency: "monthly",
    start_date: "2020-01-02",
    day_of_month: 2,
    tag_ids: [],
  });

  await postRecurringSeries(bearer, organizationId, {
    type: "expense",
    description: "E2E dash — só mês atual d3",
    value: VAL.eFuture,
    payment_method: "pix",
    frequency: "monthly",
    start_date: firstThisYmd,
    day_of_month: 3,
    tag_ids: [],
  });

  await postRecurringSeries(bearer, organizationId, {
    type: "income",
    description: "E2E dash — receita longa d1",
    value: VAL.iLong,
    payment_method: "pix",
    frequency: "monthly",
    start_date: "2020-01-01",
    day_of_month: 1,
    tag_ids: [],
  });

  await postRecurringSeries(bearer, organizationId, {
    type: "income",
    description: "E2E dash — receita mês atual d3",
    value: VAL.iFuture,
    payment_method: "pix",
    frequency: "monthly",
    start_date: firstThisYmd,
    day_of_month: 3,
    tag_ids: [],
  });

  await postTransaction(bearer, {
    organization_id: organizationId,
    type: "expense",
    description: "E2E dash — avulsa mês anterior",
    tag_ids: [tagId],
    category: "food & groceries",
    value: VAL.manualExpPrev,
    payment_method: "cash",
    date: `${ymdDate(midPrev)}T12:00:00`,
  });

  await postTransaction(bearer, {
    organization_id: organizationId,
    type: "expense",
    description: "E2E dash — avulsa mês atual",
    tag_ids: [tagId],
    category: "food & groceries",
    value: VAL.manualExpThis,
    payment_method: "cash",
    date: `${ymdDate(new Date(y, m, Math.min(10, now.getDate())))}T12:00:00`,
  });

  await postTransaction(bearer, {
    organization_id: organizationId,
    type: "income",
    description: "E2E dash — avulsa mês atual",
    tag_ids: [tagId],
    category: "salário",
    value: VAL.manualIncThis,
    payment_method: "PIX",
    date: `${ymdDate(new Date(y, m, Math.min(10, now.getDate())))}T14:00:00`,
  });
}
