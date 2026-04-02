/**
 * Pure helpers for Spending pace (Ritmo de gastos) — current vs pastLight (Opção A).
 */

const DOW_META = [
  { day: "Dom", short: "D" },
  { day: "Seg", short: "S" },
  { day: "Ter", short: "T" },
  { day: "Qua", short: "Q" },
  { day: "Qui", short: "Q" },
  { day: "Sex", short: "S" },
  { day: "Sáb", short: "S" },
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * @param {number} selectedYear
 * @param {number} selectedMonth 1-12
 * @param {Date} [now]
 */
export function getSpendingPaceMonthContext(selectedYear, selectedMonth, now = new Date()) {
  const dim = new Date(selectedYear, selectedMonth, 0).getDate();
  const start = `${selectedYear}-${pad2(selectedMonth)}-01`;
  const end = `${selectedYear}-${pad2(selectedMonth)}-${pad2(dim)}`;

  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  const curD = now.getDate();

  const isCurrent = selectedYear === curY && selectedMonth === curM;
  const isPast =
    selectedYear < curY || (selectedYear === curY && selectedMonth < curM);
  const isFuture =
    selectedYear > curY || (selectedYear === curY && selectedMonth > curM);

  let viewMode = "current";
  if (isPast) viewMode = "pastLight";
  else if (isFuture) viewMode = "future";

  const todayInView = isCurrent
    ? Math.min(Math.max(curD, 1), dim)
    : isPast
      ? dim
      : 1;

  const d = new Date(selectedYear, selectedMonth - 1, 1);
  const periodLabel = d
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(".", "");

  return {
    start,
    end,
    daysInMonth: dim,
    todayInView,
    viewMode,
    isCurrent,
    isPast,
    isFuture,
    periodLabel,
  };
}

export function transactionDayKey(isoDate) {
  if (!isoDate || typeof isoDate !== "string") return null;
  const dayPart = isoDate.slice(0, 10);
  const [y, m, d] = dayPart.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

/**
 * @param {Array<{ type?: string, date?: string, value?: number }>} transactions
 * @param {number} year
 * @param {number} month 1-12
 * @param {number} daysInMonth
 * @returns {number[]} index 0 unused; index d = sum for day d
 */
export function aggregateExpenseByDay(transactions, year, month, daysInMonth) {
  const daily = Array(daysInMonth + 1).fill(0);
  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    const key = transactionDayKey(tx.date);
    if (!key || key.y !== year || key.m !== month) continue;
    if (key.d >= 1 && key.d <= daysInMonth) {
      daily[key.d] += Number(tx.value) || 0;
    }
  }
  return daily;
}

/**
 * Cumulative expense by day.
 */
export function cumulativeFromDaily(daily, daysInMonth) {
  const cum = Array(daysInMonth + 1).fill(0);
  let acc = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    acc += daily[d] ?? 0;
    cum[d] = acc;
  }
  return cum;
}

/**
 * @param {{ expensesByDay: number[], totalBudgeted: number, daysInMonth: number, todayInView: number }}
 */
export function buildSpendingPaceChartRowsCurrent({
  expensesByDay,
  totalBudgeted,
  daysInMonth,
  todayInView,
}) {
  const cum = cumulativeFromDaily(expensesByDay, daysInMonth);
  const tv = Math.min(Math.max(todayInView, 1), daysInMonth);
  const dailyRate = tv > 0 ? cum[tv] / tv : 0;

  const rows = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const proj = Math.round((totalBudgeted / daysInMonth) * d);
    const real = d <= tv ? cum[d] : null;
    let ritmoAtual = null;
    if (d >= tv && dailyRate > 0) {
      ritmoAtual = Math.round(cum[tv] + dailyRate * (d - tv));
    }
    rows.push({ day: d, proj, real, ritmoAtual });
  }
  return rows;
}

/**
 * @param {{ expensesByDay: number[], daysInMonth: number }}
 */
/**
 * Mês atual sem orçamento: só curva real até hoje (sem projeção linear).
 */
export function buildSpendingPaceChartRowsBudgetlessCurrent({
  expensesByDay,
  daysInMonth,
  todayInView,
}) {
  const cum = cumulativeFromDaily(expensesByDay, daysInMonth);
  const tv = Math.min(Math.max(todayInView, 1), daysInMonth);
  const rows = [];
  for (let d = 1; d <= daysInMonth; d++) {
    rows.push({
      day: d,
      proj: null,
      real: d <= tv ? cum[d] : null,
      ritmoAtual: null,
    });
  }
  return rows;
}

export function buildSpendingPaceChartRowsPastLight({ expensesByDay, daysInMonth }) {
  const cum = cumulativeFromDaily(expensesByDay, daysInMonth);
  const rows = [];
  for (let d = 1; d <= daysInMonth; d++) {
    rows.push({
      day: d,
      proj: null,
      real: cum[d],
      ritmoAtual: null,
    });
  }
  return rows;
}

/**
 * Dia do mês em que, mantendo a média diária observada até `todayInView`, o acumulado atingiria o teto.
 */
export function buildBudgetOvershootDay(totalBudgeted, cumAtToday, todayInView) {
  if (totalBudgeted <= 0 || todayInView <= 0) return null;
  const rate = cumAtToday / todayInView;
  if (rate <= 0) return null;
  return Math.ceil(totalBudgeted / rate);
}

/**
 * @param {Array<{ type?: string, date?: string, value?: number }>} transactions
 * @param {number} year
 * @param {number} month 1-12
 * @param {number} daysInMonth
 */
export function buildDowAverages(transactions, year, month, daysInMonth) {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month - 1, d);
    const wd = dt.getDay();
    counts[wd] += 1;
  }

  const sums = [0, 0, 0, 0, 0, 0, 0];
  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    const key = transactionDayKey(tx.date);
    if (!key || key.y !== year || key.m !== month) continue;
    if (key.d < 1 || key.d > daysInMonth) continue;
    const dt = new Date(year, month - 1, key.d);
    const wd = dt.getDay();
    sums[wd] += Number(tx.value) || 0;
  }

  return DOW_META.map((meta, i) => ({
    day: meta.day,
    short: meta.short,
    val: counts[i] > 0 ? Math.round(sums[i] / counts[i]) : 0,
  }));
}
