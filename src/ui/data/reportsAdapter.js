import {
  downloadTransactionsCsv,
  getByCategory,
  getMonthlyEvolution,
  getSpendingRhythm,
} from "../../api/analytics";
import { handleApiError } from "../../api/client";
import { listTransactions } from "../../api/transactions";
import { categoryLabelPtForTag } from "./categoryLabels.js";

/**
 * Rótulo PT para pontos de analytics (nome EN/PT da API + icon_key opcional).
 * @param {{ tag_name?: string | null; tag_icon_key?: string | null; tagIconKey?: string | null } | null | undefined} category
 */
function analyticsCategoryLabelPt(category) {
  if (!category) return "Categoria";
  return categoryLabelPtForTag({
    tag_name: category.tag_name,
    name: category.tag_name,
    icon_key: category.tag_icon_key ?? category.tagIconKey ?? null,
  });
}

const PERIOD_MONTHS = {
  "3m": 3,
  "6m": 6,
  "12m": 12,
};

function formatMonthLabel(year, month) {
  const date = new Date(year, month - 1, 1);
  const monthLabel = date.toLocaleDateString("pt-BR", { month: "short" });
  const shortYear = String(year).slice(-2);
  return `${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1, 3)}'${shortYear}`;
}

function parseMonthLabel(value) {
  const [monthPart, yearPart] = String(value || "").split("/");
  const months = {
    jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
    jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
  };
  const month = months[monthPart?.slice(0, 3).toLowerCase()] || 1;
  const year = Number(yearPart) || new Date().getFullYear();
  return { month, year };
}

function monthBounds(year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const fmt = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  return {
    dateStart: fmt(start),
    dateEnd: fmt(end),
  };
}

export function resolveReportMonths(periodo) {
  return PERIOD_MONTHS[periodo] || 6;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function mapMonthlyEvolutionToUi(months) {
  return (months ?? []).map((item, index, all) => {
    const r = num(item.total_income);
    const g = num(item.total_expenses);
    const bal = num(item.balance);
    const score =
      r > 0 ? Math.min(100, Math.max(0, Math.round(((r - g) / r) * 100))) : 0;
    return {
      mes: formatMonthLabel(item.year, item.month),
      receita: r,
      gasto: g,
      saldo: bal,
      score,
      current: index === all.length - 1,
    };
  });
}

export function buildCategoryComposition(categories) {
  return [...(categories ?? [])]
    .sort((a, b) => Number(b.total) - Number(a.total))
    .map((category) => ({
      name: analyticsCategoryLabelPt(category),
      value: Number(category.total) || 0,
      color: category.tag_color || "#9CA3AF",
    }));
}

export function buildDriftData(response) {
  const driftData = (response?.months ?? []).map((label, monthIndex) => {
    const { month, year } = parseMonthLabel(label);
    const row = { mes: formatMonthLabel(year, month) };

    for (const category of response?.categories ?? []) {
      const labelPt = analyticsCategoryLabelPt(category);
      const raw = category.monthly_totals?.[monthIndex];
      const mt = Number(raw);
      row[labelPt] = Number.isFinite(mt) ? mt : 0;
    }

    return row;
  });

  const driftColors = Object.fromEntries(
    (response?.categories ?? []).map((category) => [
      analyticsCategoryLabelPt(category),
      category.tag_color || "#9CA3AF",
    ]),
  );

  return { driftData, driftColors };
}

export function buildReportKpis(activeData) {
  const periodTotalR = activeData.reduce((sum, item) => sum + num(item.receita), 0);
  const periodTotalG = activeData.reduce((sum, item) => sum + num(item.gasto), 0);
  const periodSaldo = periodTotalR - periodTotalG;
  const periodTaxa =
    periodTotalR > 0 ? Math.round((periodSaldo / periodTotalR) * 100) : 0;

  const last = activeData[activeData.length - 1] || null;
  const prev = activeData[activeData.length - 2] || null;
  const latestReceita = last ? num(last.receita) : 0;
  const latestGasto = last ? num(last.gasto) : 0;
  const latestSaldo = last ? num(last.saldo) : latestReceita - latestGasto;
  const latestTaxa =
    latestReceita > 0 ? Math.round((latestSaldo / latestReceita) * 100) : 0;

  const pr = prev ? num(prev.receita) : 0;
  const pg = prev ? num(prev.gasto) : 0;
  const tendR =
    pr !== 0 && last
      ? Math.round(((num(last.receita) - pr) / pr) * 100)
      : 0;
  const tendG =
    pg !== 0 && last
      ? Math.round(((num(last.gasto) - pg) / pg) * 100)
      : 0;

  return {
    /** Último ponto da série — alinhado a cascata, composição e velocidade (mês de referência). */
    totalR: latestReceita,
    totalG: latestGasto,
    saldo: latestSaldo,
    taxa: latestTaxa,
    latestReceita,
    latestGasto,
    latestSaldo,
    latestTaxa,
    /** Soma de todos os meses do período selecionado (3m / 6m / 12m). */
    periodTotalR,
    periodTotalG,
    periodSaldo,
    periodTaxa,
    last,
    prev,
    tendR,
    tendG,
  };
}

export async function fetchReportsAnalytics(organizationId, periodo) {
  const months = resolveReportMonths(periodo);
  const monthlyResponse = await getMonthlyEvolution(organizationId, months);
  const monthlyData = mapMonthlyEvolutionToUi(monthlyResponse.months);
  const latestMonth = monthlyResponse.months[monthlyResponse.months.length - 1];
  const compositionWindow = latestMonth
    ? monthBounds(latestMonth.year, latestMonth.month)
    : null;

  const [spendingRhythm, composition] = await Promise.all([
    getSpendingRhythm(organizationId, months),
    getByCategory(organizationId, {
      dateStart: compositionWindow?.dateStart,
      dateEnd: compositionWindow?.dateEnd,
      transactionType: "expense",
    }),
  ]);

  const latestIncome = latestMonth ? num(latestMonth.total_income) : 0;
  const latestGasto = latestMonth ? num(latestMonth.total_expenses) : 0;
  const waterfallRows = buildWaterfallRowsFromCategories(
    latestIncome,
    composition.categories,
  );

  let velocityDaily = [];
  if (compositionWindow?.dateStart && compositionWindow?.dateEnd) {
    try {
      const txs = await fetchAllExpenseTransactionsInRange(
        organizationId,
        compositionWindow.dateStart,
        compositionWindow.dateEnd,
      );
      velocityDaily = buildVelocityDailyFromTransactions(
        txs,
        compositionWindow.dateStart,
        compositionWindow.dateEnd,
        latestGasto,
      );
    } catch {
      velocityDaily = [];
    }
  }

  return {
    monthlyData,
    drift: buildDriftData(spendingRhythm),
    compositionData: buildCategoryComposition(composition.categories),
    compositionWindowLabel: monthlyData[monthlyData.length - 1]?.mes || null,
    waterfallRows,
    velocityDaily,
  };
}

export async function downloadReportsCsvForUi(organizationId, periodo) {
  const months = resolveReportMonths(periodo);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  return downloadTransactionsCsv(
    organizationId,
    {
      dateStart: fmt(start),
      dateEnd: fmt(end),
    },
    `relatorios-${periodo}.csv`,
  );
}

export function formatReportsApiError(error) {
  return handleApiError(error);
}

const WATERFALL_MAX_DESPESAS = 10;

/**
 * Cascata de caixa: receita, despesas por categoria (API), saldo final.
 * @param {number} income total_income do mês
 * @param {Array<{ tag_name?: string; total?: unknown; tag_color?: string | null }>} categories resposta bruta de by-category
 */
export function buildWaterfallRowsFromCategories(income, categories) {
  const inc = num(income);
  const rows = (categories ?? [])
    .map((c) => ({
      nome: analyticsCategoryLabelPt(c),
      val: -Math.abs(num(c.total)),
      tipo: "despesa",
    }))
    .filter((r) => r.val !== 0)
    .sort((a, b) => Math.abs(b.val) - Math.abs(a.val));

  const top = rows.slice(0, WATERFALL_MAX_DESPESAS);
  const rest = rows.slice(WATERFALL_MAX_DESPESAS);
  let despesas = top;
  if (rest.length) {
    const sumRest = rest.reduce((s, r) => s + r.val, 0);
    despesas = [...top, { nome: "Outros", val: sumRest, tipo: "despesa" }];
  }

  const expenseSum = despesas.reduce((s, r) => s + r.val, 0);
  const saldoVal = inc + expenseSum;

  return [
    { nome: "Receita", val: inc, tipo: "receita" },
    ...despesas,
    { nome: "Saldo", val: saldoVal, tipo: "saldo" },
  ];
}

export async function fetchAllExpenseTransactionsInRange(
  organizationId,
  dateStart,
  dateEnd,
) {
  const all = [];
  let page = 1;
  const limit = 100;
  for (;;) {
    const res = await listTransactions({
      organization_id: organizationId,
      type: "expense",
      date_start: dateStart,
      date_end: dateEnd,
      page,
      limit,
      sort_by: "date",
      sort_order: "asc",
    });
    all.push(...(res.data ?? []));
    if (!res.pagination?.has_next) break;
    page += 1;
  }
  return all;
}

/**
 * Gasto acumulado por dia vs ritmo linear até total de despesas do mês (API).
 */
export function buildVelocityDailyFromTransactions(
  transactions,
  dateStart,
  dateEnd,
  monthExpenseTotal,
) {
  const ds = String(dateStart || "");
  const de = String(dateEnd || "");
  if (!/^\d{4}-\d{2}-\d{2}/.test(ds) || !/^\d{4}-\d{2}-\d{2}/.test(de)) {
    return [];
  }
  const y = Number(ds.slice(0, 4));
  const mo = Number(ds.slice(5, 7));
  if (!y || !mo) return [];

  const dim = new Date(y, mo, 0).getDate();
  const now = new Date();
  const isCurrentMonth =
    now.getFullYear() === y && now.getMonth() + 1 === mo;
  const displayDays = isCurrentMonth ? Math.min(now.getDate(), dim) : dim;

  const buckets = Array(dim + 1).fill(0);

  for (const tx of transactions ?? []) {
    if (tx.type !== "expense") continue;
    const inst = tx.installment_info;
    if (Array.isArray(inst) && inst.length > 0) {
      for (const part of inst) {
        const due = part?.due_date;
        if (!due || due < ds || due > de) continue;
        const day = Number(due.slice(8, 10));
        if (day >= 1 && day <= dim) {
          buckets[day] += Math.abs(num(part.amount));
        }
      }
    } else {
      const d = tx.date;
      if (!d || d < ds || d > de) continue;
      const day = Number(d.slice(8, 10));
      if (day >= 1 && day <= dim) {
        buckets[day] += Math.abs(num(tx.value));
      }
    }
  }

  const target = Math.max(num(monthExpenseTotal), 0);
  let acc = 0;
  const out = [];
  for (let day = 1; day <= displayDays; day++) {
    acc += buckets[day] || 0;
    const ideal = dim > 0 ? (target / dim) * day : 0;
    out.push({
      dia: `D${day}`,
      ideal: Math.round(ideal * 100) / 100,
      real: Math.round(acc * 100) / 100,
    });
  }
  return out;
}

/** % acima/abaixo do ritmo ideal no 5.º dia (para texto de insight), ou null. */
export function velocityPressureVsIdealAtDay(velocityDaily, dayIndex = 4) {
  if (!velocityDaily?.length) return null;
  const row = velocityDaily[Math.min(dayIndex, velocityDaily.length - 1)];
  if (!row || !Number.isFinite(row.ideal) || row.ideal <= 0) return null;
  return Math.round(((row.real - row.ideal) / row.ideal) * 100);
}
