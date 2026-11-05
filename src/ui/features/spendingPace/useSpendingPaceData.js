import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchAllTransactionsPages,
  formatDashboardApiError,
} from "../../data/dashboardAdapter.js";
import {
  formatBudgetsApiError,
  listBudgetsForUi,
  mapBudgetsResponseToUi,
} from "../../data/budgetsAdapter.js";
import {
  aggregateExpenseByDay,
  buildBudgetOvershootDay,
  buildDowAverages,
  buildSpendingPaceChartRowsBudgetlessCurrent,
  buildSpendingPaceChartRowsCurrent,
  buildSpendingPaceChartRowsPastLight,
  cumulativeFromDaily,
  getSpendingPaceMonthContext,
} from "./spendingPaceModel.js";

const EMPTY = {
  isLoading: false,
  error: "",
  /** Relendo (transação salva, "tentar de novo") com o gráfico anterior na tela. */
  isRefreshing: false,
  /** A última recarga falhou e os números na tela são os anteriores. */
  refreshFailed: false,
  refetch: () => {},
  viewMode: "current",
  periodLabel: "",
  daysInMonth: 31,
  todayInView: 1,
  chartData: [],
  dowData: [],
  budgetVal: 0,
  hasBudget: false,
  hasAnyExpense: false,
  realFinal: 0,
  projFinal: 0,
  projFim: 0,
  diff: 0,
  isOk: true,
  estouroDia: null,
  isClosed: false,
  start: "",
  end: "",
};

function shiftYearMonth(year, month, delta) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function useSpendingPaceData({
  organizationId,
  enabled,
  year,
  month,
  /** Sobe a cada transação criada/editada/excluída no app (#272). */
  refreshKey = 0,
}) {
  const [fetchTick, setFetchTick] = useState(0);
  const refetch = useCallback(() => setFetchTick((n) => n + 1), []);

  const ctx = useMemo(
    () => getSpendingPaceMonthContext(year, month),
    [year, month],
  );

  const loadedKeyRef = useRef(null);
  const [state, setState] = useState(() => ({
    ...EMPTY,
    isLoading: Boolean(enabled && organizationId),
    refetch,
  }));

  useEffect(() => {
    if (!enabled || !organizationId) {
      loadedKeyRef.current = null;
      setState({ ...EMPTY, refetch });
      return;
    }

    let cancelled = false;
    // Mesma org e mesmo mês da última leitura BEM-SUCEDIDA = recarga (transação
    // salva, "tentar de novo"): o gráfico fica até o novo chegar, e uma falha não
    // apaga o que se sabia — só marca `refreshFailed`.
    const key = `${organizationId}|${ctx.start}|${ctx.end}`;
    const isRefresh = loadedKeyRef.current === key;
    // Leitura NOVA (outro mês/org): esquece a anterior já. Se esta falhar e a pessoa
    // voltar, a volta é leitura nova — sem o erro do mês que falhou por cima.
    if (!isRefresh) loadedKeyRef.current = null;
    setState((s) => (isRefresh
      ? { ...s, isRefreshing: true, refreshFailed: false, refetch }
      : { ...s, isLoading: true, error: "", refreshFailed: false, refetch }));

    const run = async () => {
      try {
        const txPromise = fetchAllTransactionsPages({
          organization_id: organizationId,
          date_start: ctx.start,
          date_end: ctx.end,
          type: "expense",
          sort_by: "date",
          sort_order: "asc",
        });

        const budgetPromise =
          ctx.viewMode === "current"
            ? listBudgetsForUi(organizationId)
            : Promise.resolve(null);

        const [txRes, budgetsRes] = await Promise.all([txPromise, budgetPromise]);

        if (cancelled) return;

        const rawTx = txRes.data ?? [];
        const mappedBudget =
          budgetsRes != null ? mapBudgetsResponseToUi(budgetsRes) : null;
        const budgetVal = mappedBudget?.budget ?? 0;
        const hasBudget = budgetVal > 0;

        const expensesByDay = aggregateExpenseByDay(
          rawTx,
          year,
          month,
          ctx.daysInMonth,
        );
        const cum = cumulativeFromDaily(expensesByDay, ctx.daysInMonth);
        const hasAnyExpense = cum[ctx.daysInMonth] > 0;

        const dowData = buildDowAverages(
          rawTx,
          year,
          month,
          ctx.daysInMonth,
        );

        let chartData;
        if (ctx.viewMode === "pastLight") {
          chartData = buildSpendingPaceChartRowsPastLight({
            expensesByDay,
            daysInMonth: ctx.daysInMonth,
          });
        } else if (ctx.viewMode === "current" && hasBudget) {
          chartData = buildSpendingPaceChartRowsCurrent({
            expensesByDay,
            totalBudgeted: budgetVal,
            daysInMonth: ctx.daysInMonth,
            todayInView: ctx.todayInView,
          });
        } else if (ctx.viewMode === "current") {
          chartData = buildSpendingPaceChartRowsBudgetlessCurrent({
            expensesByDay,
            daysInMonth: ctx.daysInMonth,
            todayInView: ctx.todayInView,
          });
        } else {
          chartData = buildSpendingPaceChartRowsPastLight({
            expensesByDay,
            daysInMonth: ctx.daysInMonth,
          });
        }

        const tv = ctx.todayInView;
        const realFinal = cum[tv] ?? 0;
        const rowToday =
          ctx.viewMode === "current" && hasBudget && chartData[tv - 1]
            ? chartData[tv - 1]
            : chartData[ctx.daysInMonth - 1];
        const projFinal =
          ctx.viewMode === "current" && hasBudget && rowToday
            ? rowToday.proj ?? 0
            : 0;
        const diff = hasBudget ? realFinal - projFinal : 0;
        const isOk =
          ctx.viewMode === "pastLight" || !hasBudget ? true : diff <= 0;

        const dailyRate = tv > 0 ? realFinal / tv : 0;
        const projFim =
          ctx.viewMode === "pastLight"
            ? cum[ctx.daysInMonth]
            : ctx.viewMode === "current" && dailyRate > 0
              ? Math.round(dailyRate * ctx.daysInMonth)
              : realFinal;

        const estouroDia =
          ctx.viewMode === "current" && hasBudget
            ? buildBudgetOvershootDay(budgetVal, realFinal, tv)
            : null;

        setState({
          isLoading: false,
          error: "",
          refetch,
          viewMode: ctx.viewMode,
          periodLabel: ctx.periodLabel,
          daysInMonth: ctx.daysInMonth,
          todayInView: tv,
          chartData,
          dowData,
          budgetVal,
          hasBudget,
          hasAnyExpense,
          realFinal,
          projFinal,
          projFim,
          diff,
          isOk,
          estouroDia,
          isClosed: ctx.viewMode === "pastLight",
          start: ctx.start,
          end: ctx.end,
        });
        loadedKeyRef.current = key;
      } catch (error) {
        if (cancelled) return;
        const msg =
          formatDashboardApiError(error) ||
          formatBudgetsApiError(error) ||
          String(error?.message || error);
        if (isRefresh) {
          setState((s) => ({ ...s, isRefreshing: false, refreshFailed: true, refetch }));
          return;
        }
        setState({
          ...EMPTY,
          isLoading: false,
          error: msg,
          refetch,
          viewMode: ctx.viewMode,
          periodLabel: ctx.periodLabel,
          daysInMonth: ctx.daysInMonth,
          todayInView: ctx.todayInView,
          isClosed: ctx.viewMode === "pastLight",
          start: ctx.start,
          end: ctx.end,
        });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    organizationId,
    enabled,
    year,
    month,
    ctx.start,
    ctx.end,
    ctx.daysInMonth,
    ctx.todayInView,
    ctx.viewMode,
    ctx.periodLabel,
    fetchTick,
    refreshKey,
  ]);

  return state;
}

export { shiftYearMonth };
