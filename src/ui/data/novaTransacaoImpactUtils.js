/** @param {string|number|null|undefined} v */
export function parseApiDecimal(v) {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function monthBoundsFromYmd(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m] = ymd.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const dim = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(dim).padStart(2, "0")}`;
  return { start, end, dim, y, m };
}

/**
 * @param {{ date: string, total_expenses: string }[]} points
 * @param {string} ymdInMonth qualquer data YYYY-MM-DD do mês alvo
 * @param {number|null} projectedEndTotal total projetado fim do mês (despesa); null = sem linha tracejada
 */
export function buildImpactLineChartData(points, ymdInMonth, projectedEndTotal) {
  const bounds = monthBoundsFromYmd(ymdInMonth);
  if (!bounds) return [];
  const { dim } = bounds;
  const byDay = new Map();
  for (const p of points || []) {
    const d = parseInt(String(p.date).slice(8, 10), 10);
    if (d >= 1 && d <= dim) {
      byDay.set(d, (byDay.get(d) || 0) + (parseApiDecimal(p.total_expenses) ?? 0));
    }
  }
  let cum = 0;
  const P =
    projectedEndTotal != null && Number.isFinite(projectedEndTotal)
      ? projectedEndTotal
      : null;
  const rows = [];
  for (let d = 1; d <= dim; d++) {
    cum += byDay.get(d) ?? 0;
    rows.push({
      day: d,
      real: Math.round(cum * 100) / 100,
      proj: P != null ? Math.round(((P * d) / dim) * 100) / 100 : null,
    });
  }
  return rows;
}

/** Dia do mês "hoje" se `txYmd` for o mês corrente; senão null (sem linha de referência). */
export function referenceDayInTxMonth(txYmd, todayYmd) {
  if (!txYmd || !todayYmd) return null;
  if (txYmd.slice(0, 7) !== todayYmd.slice(0, 7)) return null;
  return parseInt(todayYmd.slice(8, 10), 10);
}

/** Mínimo de dias na base do ritmo para não explodir a projeção no início do mês (ex.: R$ 50 no dia 1). */
export const MIN_RUN_RATE_DAYS_FOR_PROJECTION = 7;

/**
 * Metadados da projeção fim de mês (categoria).
 *
 * `spentBefore`: gasto já registrado na categoria no período **antes** do lançamento hipotético (API `spent_before`).
 * Se não houve gasto real no mês e estamos nos primeiros dias, **não** extrapolamos o mês inteiro — número grande confunde.
 *
 * @param {number | null} [spentBefore] centavos implícitos no decimal API
 */
export function getCategoryRunRateProjectionMeta(
  txYmd,
  todayYmd,
  dim,
  spentAfter,
  spentBefore = null,
) {
  if (spentAfter == null || !Number.isFinite(spentAfter) || dim < 1) return null;
  const txMonth = txYmd.slice(0, 7);
  const curMonth = todayYmd.slice(0, 7);
  const txDom = parseInt(txYmd.slice(8, 10), 10) || 1;
  const todayDom = parseInt(todayYmd.slice(8, 10), 10) || 1;

  const before =
    spentBefore != null && Number.isFinite(spentBefore) ? spentBefore : 0;
  const hadRealSpendInMonth = before > 0.0001;

  if (txMonth < curMonth) {
    return {
      mode: "past_month",
      projectionKind: "past_month",
      projectedEom: spentAfter,
      spentAfter,
      elapsedDays: dim,
      dim,
      usedMinimumDayFloor: false,
    };
  }
  if (txMonth > curMonth) {
    return {
      mode: "future_month",
      projectionKind: "future_month",
      projectedEom: spentAfter,
      spentAfter,
      elapsedDays: 1,
      dim,
      usedMinimumDayFloor: false,
    };
  }

  let elapsed;
  const calendarElapsed = txYmd > todayYmd ? txDom : todayDom;
  if (txYmd > todayYmd) {
    elapsed = Math.max(MIN_RUN_RATE_DAYS_FOR_PROJECTION, txDom);
  } else {
    elapsed = Math.max(MIN_RUN_RATE_DAYS_FOR_PROJECTION, todayDom);
  }
  const usedMinimumDayFloor =
    calendarElapsed < MIN_RUN_RATE_DAYS_FOR_PROJECTION &&
    elapsed === MIN_RUN_RATE_DAYS_FOR_PROJECTION;

  /**
   * Sem histórico real no mês + “base mínima de 7 dias” = extrapolação não faz sentido para leigo (ex.: R$ 50 virar ~R$ 214).
   */
  const extrapolationWouldBeMisleading =
    usedMinimumDayFloor && !hadRealSpendInMonth;

  const runRateEom = (spentAfter / elapsed) * dim;

  if (extrapolationWouldBeMisleading) {
    return {
      mode: "current_month",
      projectionKind: "insufficient_history",
      projectedEom: null,
      spentAfter,
      elapsedDays: elapsed,
      dim,
      usedMinimumDayFloor,
    };
  }

  return {
    mode: "current_month",
    projectionKind: "run_rate",
    projectedEom: runRateEom,
    spentAfter,
    elapsedDays: elapsed,
    dim,
    usedMinimumDayFloor,
  };
}

/**
 * Projeção de fim de mês **só da categoria** (ritmo), quando faz sentido exibir.
 */
export function categoryRunRateProjectedEndOfMonth(
  txYmd,
  todayYmd,
  dim,
  spentAfter,
  spentBefore = null,
) {
  const meta = getCategoryRunRateProjectionMeta(
    txYmd,
    todayYmd,
    dim,
    spentAfter,
    spentBefore,
  );
  return meta?.projectedEom ?? null;
}

export function fmtBrl(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Texto para tooltip (hover) do ícone ao lado de “Projeção fim mês” — linguagem simples.
 */
export function formatProjectionCardExplain(meta) {
  if (!meta) return "";
  if (meta.mode === "past_month") {
    return "Mês já encerrado aqui: mostramos o total da categoria no período, sem extrapolar dia a dia.";
  }
  if (meta.mode === "future_month") {
    return "Mês futuro: só o efeito deste lançamento no total, sem estimar gasto por dia.";
  }
  if (meta.projectionKind === "run_rate") {
    return "Estimativa de quanto a categoria pode fechar no mês se o gasto diário continuar parecido. Já inclui o valor que você está lançando — é tendência, não certeza.";
  }
  return "";
}
