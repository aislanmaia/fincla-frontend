import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAllTransactionsPages,
  formatDashboardApiError,
  getByCategory,
  getTransactionsSummary,
  listRecurringTransactions,
} from "../../data/dashboardAdapter";
import { categoryLabelPtForTag } from "../../data/categoryLabels.js";
import {
  expandExpenseTxToAttributedParts,
  pickCategoryTagFromApiTransaction,
  pickDisplayAmount,
  pickTransactionListDateRawForDisplay,
} from "../../data/transactionsAdapter.js";
import {
  addLocalDays,
  daysInclusive,
  parseLocalYmd,
  previousPeriodRange,
  startOfLocalDay,
  toIsoLocalDate,
} from "./dashboardDateRange.js";

/** Máximo de linhas no card Gastos por Categoria (dashboard). */
const DASHBOARD_CATEGORY_CARD_LIMIT = 8;

/** Acima disso, o gráfico de ritmo agrega por semana (legibilidade). */
const RHYTHM_MAX_DAILY_POINTS = 62;

const EMPTY_STATE = {
  isLoading: false,
  error: "",
  summary: null,
  transactions: [],
  categories: [],
  rhythmChart: [],
  rhythmMeta: {
    dim: 31,
    today: 1,
    showTodayMarker: true,
    refLabel: "Hoje",
    progressSuffix: "",
    rhythmMode: "daily",
  },
  upcomingDebits: [],
  /** Resumo das séries recorrentes ativas (`GET /recurring-series?is_active=true`). */
  recurringSummary: null,
  /** Projeção no intervalo do dashboard (`GET /transactions/summary` → `recurring_in_period`). */
  recurringInPeriod: null,
};

function formatShortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function transactionDayKey(isoDate) {
  if (!isoDate || typeof isoDate !== "string") return null;
  const dayPart = isoDate.slice(0, 10);
  const [y, m, d] = dayPart.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function dayIndexInRange(isoDate, rangeStart, dayCount) {
  const key = transactionDayKey(isoDate);
  if (!key) return -1;
  const t = new Date(key.y, key.m - 1, key.d);
  const diff = Math.round(
    (startOfLocalDay(t) - startOfLocalDay(rangeStart)) / 86400000,
  );
  if (diff < 0 || diff >= dayCount) return -1;
  return diff;
}

function pickCategoryName(transaction) {
  if (transaction.category) {
    return categoryLabelPtForTag({ name: transaction.category });
  }

  const tagGroups = Object.values(transaction.tags ?? {});
  const firstTag = tagGroups.flat()[0];
  return categoryLabelPtForTag(firstTag ?? { name: "Sem categoria" });
}

function pickCategoryColor(category) {
  return category.tag_color ?? "#9CA3AF";
}

function pickTransactionIcon(transaction) {
  if (transaction.type === "income") return "💸";
  if (transaction.payment_method?.toLowerCase().includes("credito")) return "💳";
  if (transaction.payment_method?.toLowerCase().includes("pix")) return "⚡";
  return "🧾";
}

function mapTransaction(transaction) {
  const dateRaw = pickTransactionListDateRawForDisplay(transaction);
  const expenseAmt =
    transaction.type === "expense" ? pickDisplayAmount(transaction) : 0;
  return {
    id: transaction.id,
    desc: transaction.description,
    cat: pickCategoryName(transaction),
    date: formatShortDate(dateRaw),
    val:
      transaction.type === "income"
        ? Number(transaction.value) || 0
        : -expenseAmt,
    icon: pickTransactionIcon(transaction),
    rec: transaction.recurring,
    status: transaction.status === "pending" ? "pendente" : "confirmado",
    method: transaction.payment_method,
  };
}

function normalizeTagNameKey(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Agrega despesas retornadas pela API no período (já filtradas no servidor).
 */
function aggregateExpenseCategoriesFromTransactions(rawTx) {
  const map = new Map();

  for (const tx of rawTx) {
    if (tx.type !== "expense") continue;

    const tag = pickCategoryTagFromApiTransaction(tx);
    const rawName = tag?.name ?? tx.category ?? "Sem categoria";
    const mapKey =
      tag?.id != null && tag.id !== ""
        ? `id:${tag.id}`
        : `name:${normalizeTagNameKey(rawName)}`;

    const add = pickDisplayAmount(tx);
    const cur = map.get(mapKey);
    if (cur) {
      cur.total += add;
      if (!cur.color && tag?.color) cur.color = tag.color;
      if (!cur.tagId && tag?.id) cur.tagId = tag.id;
      if (!cur.icon_key && tag?.icon_key) cur.icon_key = tag.icon_key;
    } else {
      map.set(mapKey, {
        tagId: tag?.id ?? null,
        tagName: rawName,
        icon_key: tag?.icon_key ?? null,
        color: tag?.color ?? null,
        total: add,
      });
    }
  }

  return Array.from(map.values());
}

function buildDashboardCategoryRows(
  rawTx,
  rangeStartYmd,
  rangeEndYmd,
  apiCategories,
  prevTotalByTagId,
) {
  const fromTx = aggregateExpenseCategoriesFromTransactions(rawTx);
  const apiList = apiCategories ?? [];

  const apiColorByTagId = new Map(
    apiList.map((c) => [c.tag_id, c.tag_color]),
  );
  const apiColorByName = new Map(
    apiList.map((c) => [normalizeTagNameKey(c.tag_name), c.tag_color]),
  );

  const sourceRows =
    fromTx.length > 0
      ? fromTx
      : apiList.map((c) => ({
          tagId: c.tag_id,
          tagName: c.tag_name,
          icon_key: c.tag_icon_key ?? null,
          color: c.tag_color,
          total: c.total,
        }));

  return sourceRows
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, DASHBOARD_CATEGORY_CARD_LIMIT)
    .map((row) => {
      const color =
        row.color ||
        (row.tagId ? apiColorByTagId.get(row.tagId) : null) ||
        apiColorByName.get(normalizeTagNameKey(row.tagName)) ||
        "#9CA3AF";

      return mapCategory(
        {
          tag_id: row.tagId || undefined,
          tag_name: row.tagName,
          tag_icon_key: row.icon_key,
          total: row.total,
          tag_color: color,
        },
        prevTotalByTagId,
      );
    });
}

function mapCategory(category, prevTotalByTagId) {
  const prev =
    category.tag_id
      ? prevTotalByTagId.get(category.tag_id)
      : undefined;
  const fallbackAvg = Math.max(Math.round(category.total * 0.82), 1);
  const avg =
    typeof prev === "number" && prev > 0 ? prev : fallbackAvg;

  return {
    tagId: category.tag_id,
    name: categoryLabelPtForTag({
      name: category.tag_name,
      icon_key: category.tag_icon_key ?? null,
    }),
    value: category.total,
    avg,
    color: pickCategoryColor(category),
  };
}

function buildRhythmChart(transactions, summary, rangeStartYmd, rangeEndYmd) {
  const startD = parseLocalYmd(rangeStartYmd);
  const endD = parseLocalYmd(rangeEndYmd);
  if (!startD || !endD) {
    return {
      series: [],
      dim: 1,
      today: 1,
      showTodayMarker: false,
      refLabel: "Hoje",
      progressSuffix: "",
      rhythmMode: "daily",
    };
  }

  const D = daysInclusive(startD, endD);
  const now = new Date();
  const todayStartMs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();

  if (D <= RHYTHM_MAX_DAILY_POINTS) {
    return buildRhythmDaily(transactions, summary, startD, D, todayStartMs);
  }
  return buildRhythmWeekly(
    transactions,
    summary,
    startD,
    endD,
    D,
    todayStartMs,
  );
}

function buildRhythmDaily(transactions, summary, startD, D, todayStartMs) {
  const daily = Array(D).fill(0);
  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    for (const { date, amount } of expandExpenseTxToAttributedParts(tx)) {
      const idx = dayIndexInRange(date, startD, D);
      if (idx >= 0) daily[idx] += amount;
    }
  }

  const rawCum = [];
  let acc = 0;
  for (let i = 0; i < D; i++) {
    acc += daily[i];
    rawCum.push(acc);
  }

  let todayIdx = -1;
  for (let i = 0; i < D; i++) {
    const dayDate = addLocalDays(startD, i);
    if (startOfLocalDay(dayDate) <= todayStartMs) todayIdx = i;
    else break;
  }

  const targetExpenses = summary?.total_expenses ?? 0;
  const atToday = todayIdx >= 0 ? rawCum[todayIdx] : 0;
  const envelope = Math.max(
    summary?.total_income ?? 0,
    summary?.total_expenses ?? 0,
    1,
  );

  const scaledReal = (i) => {
    if (todayIdx < 0 || i > todayIdx) return null;
    const raw = rawCum[i] ?? 0;
    if (atToday > 0) return Math.round(raw * (targetExpenses / atToday));
    if (todayIdx >= 0 && targetExpenses > 0) {
      return Math.round(targetExpenses * ((i + 1) / (todayIdx + 1)));
    }
    return Math.round(raw);
  };

  const series = [];
  for (let i = 0; i < D; i++) {
    const dayDate = addLocalDays(startD, i);
    const proj = Math.round((envelope / D) * (i + 1));
    const dayLabel = dayDate
      .toLocaleDateString("pt-BR", { day: "numeric", month: "short" })
      .replace(/\./g, "");
    series.push({
      dia: i + 1,
      proj,
      real: scaledReal(i),
      dayLabel,
    });
  }

  const startMs = startOfLocalDay(startD);
  const endMs = startOfLocalDay(addLocalDays(startD, D - 1));
  let todayDisplay = 1;
  let showTodayMarker = true;
  let refLabel = "Hoje";

  if (todayStartMs < startMs) {
    todayDisplay = 1;
    showTodayMarker = false;
  } else if (todayStartMs > endMs) {
    todayDisplay = D;
    refLabel = "Fim";
  } else {
    todayDisplay = todayIdx + 1;
  }

  const pct = D > 0 ? Math.round((todayDisplay / D) * 100) : 0;
  const progressSuffix = `${todayDisplay}/${D} · ${pct}% do período`;

  return {
    series,
    dim: D,
    today: todayDisplay,
    showTodayMarker,
    refLabel,
    progressSuffix,
    rhythmMode: "daily",
  };
}

function buildRhythmWeekly(
  transactions,
  summary,
  startD,
  endD,
  D,
  todayStartMs,
) {
  const nB = Math.ceil(D / 7);
  const bucketSum = Array(nB).fill(0);

  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    for (const { date, amount } of expandExpenseTxToAttributedParts(tx)) {
      const idx = dayIndexInRange(date, startD, D);
      if (idx < 0) continue;
      const b = Math.floor(idx / 7);
      bucketSum[b] += amount;
    }
  }

  const rawCum = [];
  let acc = 0;
  for (let b = 0; b < nB; b++) {
    acc += bucketSum[b];
    rawCum.push(acc);
  }

  let todayIdx = -1;
  for (let i = 0; i < D; i++) {
    const dayMs = startOfLocalDay(addLocalDays(startD, i));
    if (dayMs <= todayStartMs) todayIdx = i;
    else break;
  }
  const todayBucket = todayIdx >= 0 ? Math.floor(todayIdx / 7) : -1;

  const targetExpenses = summary?.total_expenses ?? 0;
  const atToday = todayBucket >= 0 ? rawCum[todayBucket] : 0;
  const envelope = Math.max(
    summary?.total_income ?? 0,
    summary?.total_expenses ?? 0,
    1,
  );

  const scaledRealBucket = (b) => {
    if (todayBucket < 0 || b > todayBucket) return null;
    const raw = rawCum[b] ?? 0;
    if (atToday > 0) return Math.round(raw * (targetExpenses / atToday));
    if (todayBucket >= 0 && targetExpenses > 0) {
      return Math.round(targetExpenses * ((b + 1) / (todayBucket + 1)));
    }
    return Math.round(raw);
  };

  const series = [];
  for (let b = 0; b < nB; b++) {
    const fromDay = b * 7;
    const toDay = Math.min(fromDay + 6, D - 1);
    const d0 = addLocalDays(startD, fromDay);
    const d1 = addLocalDays(startD, toDay);
    const dayLabel = `${d0.getDate()}/${d0.getMonth() + 1}–${d1.getDate()}/${d1.getMonth() + 1}`;
    const proj = Math.round((envelope / nB) * (b + 1));
    series.push({
      dia: b + 1,
      proj,
      real: scaledRealBucket(b),
      dayLabel,
    });
  }

  const startMs = startOfLocalDay(startD);
  const endMs = startOfLocalDay(addLocalDays(startD, D - 1));
  let todayDisplay = 1;
  let showTodayMarker = true;
  let refLabel = "Hoje";

  if (todayStartMs < startMs) {
    todayDisplay = 1;
    showTodayMarker = false;
  } else if (todayStartMs > endMs) {
    todayDisplay = nB;
    refLabel = "Fim";
  } else {
    todayDisplay = todayBucket + 1;
  }

  const pct = nB > 0 ? Math.round((todayDisplay / nB) * 100) : 0;
  const progressSuffix = `sem. ${todayDisplay}/${nB} · ${pct}% do período`;

  return {
    series,
    dim: nB,
    today: todayDisplay,
    showTodayMarker,
    refLabel,
    progressSuffix,
    rhythmMode: "weekly",
  };
}

function startOfToday() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function mapUpcomingDebits(recurringResponse, horizonDays = 14) {
  const list = recurringResponse?.series ?? [];
  const start = startOfToday();
  const end = new Date(start);
  end.setDate(end.getDate() + horizonDays);

  return list
    .filter((r) => r.type === "expense" && r.is_active !== false)
    .map((r) => {
      const occ = new Date(`${String(r.next_occurrence).slice(0, 10)}T12:00:00`);
      return { r, occ };
    })
    .filter(
      ({ occ }) =>
        !Number.isNaN(occ.getTime()) && occ >= start && occ <= end,
    )
    .sort((a, b) => a.occ - b.occ)
    .map(({ r, occ }) => {
      const daysLeft = Math.max(
        0,
        Math.ceil((occ - start) / 86400000),
      );
      const tag = r.tags?.[0];
      return {
        id: r.id,
        name: r.description,
        value: r.value,
        day: occ.getDate(),
        monthShort: occ
          .toLocaleDateString("pt-BR", { month: "short" })
          .replace(".", ""),
        cat: tag?.name ?? r.category ?? "Recorrente",
        daysLeft,
        dateLabel: occ.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
      };
    });
}

export function useDashboardData({
  organizationId,
  enabled = true,
  dateStart,
  dateEnd,
}) {
  const [state, setState] = useState(EMPTY_STATE);
  const [fetchTick, setFetchTick] = useState(0);

  const refetch = useCallback(() => {
    setFetchTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !organizationId || !dateStart || !dateEnd) {
      setState(EMPTY_STATE);
      return;
    }

    let cancelled = false;
    const start = dateStart;
    const end = dateEnd;
    const prevPeriod = previousPeriodRange(start, end);

    setState((current) => ({
      ...current,
      isLoading: true,
      error: "",
    }));

    Promise.all([
      getTransactionsSummary({
        organization_id: organizationId,
        date_start: start,
        date_end: end,
      }),
      fetchAllTransactionsPages({
        organization_id: organizationId,
        date_start: start,
        date_end: end,
        sort_by: "date",
        sort_order: "desc",
      }),
      getByCategory(organizationId, {
        dateStart: start,
        dateEnd: end,
        transactionType: "expense",
      }),
      getByCategory(organizationId, {
        dateStart: prevPeriod.start,
        dateEnd: prevPeriod.end,
        transactionType: "expense",
      }),
      listRecurringTransactions(organizationId, {
        isActive: true,
        dateStart: start,
        dateEnd: end,
      }),
    ])
      .then(
        ([
          summary,
          transactionsResponse,
          categoriesResponse,
          prevCategoriesResponse,
          recurring,
        ]) => {
        if (cancelled) return;

        const rawTx = transactionsResponse.data ?? [];
        const recent = rawTx.slice(0, 5).map(mapTransaction);
        const rhythm = buildRhythmChart(rawTx, summary, start, end);

        const prevTotalByTagId = new Map(
          (prevCategoriesResponse.categories ?? []).map((c) => [
            c.tag_id,
            Number(c.total) || 0,
          ]),
        );
        const categories = buildDashboardCategoryRows(
          rawTx,
          start,
          end,
          categoriesResponse.categories,
          prevTotalByTagId,
        );

        setState({
          isLoading: false,
          error: "",
          summary,
          transactions: recent,
          categories,
          rhythmChart: rhythm.series,
          rhythmMeta: {
            dim: rhythm.dim,
            today: rhythm.today,
            showTodayMarker: rhythm.showTodayMarker,
            refLabel: rhythm.refLabel,
            progressSuffix: rhythm.progressSuffix,
            rhythmMode: rhythm.rhythmMode,
          },
          upcomingDebits: mapUpcomingDebits(recurring),
          recurringSummary: recurring?.summary ?? null,
          recurringInPeriod: summary?.recurring_in_period ?? null,
        });
      })
      .catch((error) => {
        if (cancelled) return;

        setState({
          isLoading: false,
          error: formatDashboardApiError(error),
          summary: null,
          transactions: [],
          categories: [],
          rhythmChart: [],
          rhythmMeta: {
            dim: 31,
            today: 1,
            showTodayMarker: true,
            refLabel: "Hoje",
            progressSuffix: "",
            rhythmMode: "daily",
          },
          upcomingDebits: [],
          recurringSummary: null,
          recurringInPeriod: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId, fetchTick, dateStart, dateEnd]);

  const hasRealData = useMemo(() => {
    return Boolean(state.summary);
  }, [state.summary]);

  return {
    ...state,
    hasRealData,
    refetch,
    rangeStart: dateStart ?? null,
    rangeEnd: dateEnd ?? null,
  };
}
