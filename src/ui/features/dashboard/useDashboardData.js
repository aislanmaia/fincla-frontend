import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAllTransactionsPages,
  formatDashboardApiError,
  getByCategory,
  getTransactionsSummary,
  listRecurringTransactions,
} from "../../data/dashboardAdapter";

const EMPTY_STATE = {
  isLoading: false,
  error: "",
  summary: null,
  transactions: [],
  categories: [],
  rhythmChart: [],
  rhythmMeta: { dim: 31, today: 1 },
  upcomingDebits: [],
};

function toIsoLocalDate(date) {
  return date.toISOString().slice(0, 10);
}

function monthBounds(referenceDate = new Date()) {
  const start = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    1,
  );
  const end = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    0,
  );

  return {
    start: toIsoLocalDate(start),
    end: toIsoLocalDate(end),
    daysInMonth: end.getDate(),
    today: referenceDate.getDate(),
  };
}

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

function pickCategoryName(transaction) {
  if (transaction.category) return transaction.category;

  const tagGroups = Object.values(transaction.tags ?? {});
  const firstTag = tagGroups.flat()[0];
  return firstTag?.name ?? "Sem categoria";
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
  return {
    id: transaction.id,
    desc: transaction.description,
    cat: pickCategoryName(transaction),
    date: formatShortDate(transaction.date),
    val: transaction.type === "income" ? transaction.value : -transaction.value,
    icon: pickTransactionIcon(transaction),
    rec: transaction.recurring,
    status: transaction.status === "pending" ? "pendente" : "confirmado",
    method: transaction.payment_method,
  };
}

function mapCategory(category) {
  return {
    name: category.tag_name,
    value: category.total,
    avg: Math.max(Math.round(category.total * 0.82), 1),
    color: pickCategoryColor(category),
  };
}

function buildRhythmChart(transactions, summary, bounds) {
  const { daysInMonth: dim, today, start } = bounds;
  const startParts = start.split("-").map(Number);
  const y0 = startParts[0];
  const m0 = startParts[1];

  const daily = Array(dim + 1).fill(0);
  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    const key = transactionDayKey(tx.date);
    if (!key || key.y !== y0 || key.m !== m0) continue;
    if (key.d >= 1 && key.d <= dim) daily[key.d] += tx.value;
  }

  const rawCum = [];
  let acc = 0;
  for (let d = 1; d <= dim; d++) {
    acc += daily[d];
    rawCum.push(acc);
  }

  const targetExpenses = summary?.total_expenses ?? 0;
  const atToday = today >= 1 && today <= dim ? rawCum[today - 1] : 0;

  const envelope = Math.max(
    summary?.total_income ?? 0,
    summary?.total_expenses ?? 0,
    1,
  );

  const scaledReal = (d) => {
    if (d < 1 || d > dim || d > today) return null;
    const raw = rawCum[d - 1] ?? 0;
    if (atToday > 0) return Math.round(raw * (targetExpenses / atToday));
    if (today > 0 && targetExpenses > 0)
      return Math.round(targetExpenses * (d / today));
    return Math.round(raw);
  };

  const series = [];
  for (let d = 1; d <= dim; d++) {
    const proj = Math.round((envelope / dim) * d);
    series.push({ dia: d, proj, real: scaledReal(d) });
  }

  return { series, dim, today };
}

function startOfToday() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function mapUpcomingDebits(recurringResponse, horizonDays = 14) {
  const list = recurringResponse?.recurring_transactions ?? [];
  const start = startOfToday();
  const end = new Date(start);
  end.setDate(end.getDate() + horizonDays);

  return list
    .filter((r) => r.type === "expense" && r.is_active !== false)
    .map((r) => {
      const occ = new Date(r.next_occurrence);
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
        cat: tag?.name ?? "Recorrente",
        daysLeft,
        dateLabel: occ.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
      };
    });
}

export function useDashboardData({ organizationId, enabled = true }) {
  const [state, setState] = useState(EMPTY_STATE);
  const [fetchTick, setFetchTick] = useState(0);

  const refetch = useCallback(() => {
    setFetchTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !organizationId) {
      setState(EMPTY_STATE);
      return;
    }

    let cancelled = false;
    const bounds = monthBounds();
    const { start, end, daysInMonth, today } = bounds;

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
      listRecurringTransactions(organizationId, true),
    ])
      .then(([summary, transactionsResponse, categoriesResponse, recurring]) => {
        if (cancelled) return;

        const rawTx = transactionsResponse.data ?? [];
        const recent = rawTx.slice(0, 5).map(mapTransaction);
        const { series, dim, today: tDay } = buildRhythmChart(
          rawTx,
          summary,
          { daysInMonth, today, start },
        );

        setState({
          isLoading: false,
          error: "",
          summary,
          transactions: recent,
          categories: (categoriesResponse.categories ?? [])
            .slice(0, 5)
            .map(mapCategory),
          rhythmChart: series,
          rhythmMeta: { dim, today: tDay },
          upcomingDebits: mapUpcomingDebits(recurring),
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
          rhythmMeta: { dim: 31, today: 1 },
          upcomingDebits: [],
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId, fetchTick]);

  const hasRealData = useMemo(() => {
    return Boolean(state.summary);
  }, [state.summary]);

  return {
    ...state,
    hasRealData,
    refetch,
  };
}
