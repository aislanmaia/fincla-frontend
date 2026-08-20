import { useEffect, useMemo, useState } from "react";
import { listTransactions } from "../../../api/transactions";
import { listOrgBalanceAdjustments } from "../../../api/balanceAdjustments";
import { buildCalendarEvents, monthSummary, ymd } from "./calendarModel.js";

const EMPTY = { loading: false, error: "", byDay: {}, hasLoaded: false };

export function useCalendarData({ organizationId, year, month, enabled = true, transactionsRefreshToken = 0 }) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!enabled || !organizationId) {
      setState(EMPTY);
      return undefined;
    }
    let cancelled = false;
    setState({ ...EMPTY, loading: true });
    const last = new Date(year, month, 0).getDate();
    const start = ymd(year, month, 1);
    const end = ymd(year, month, last);
    Promise.all([
      listTransactions({
        organization_id: organizationId,
        date_start: start,
        date_end: end,
        limit: 100,
        sort_by: "date",
        sort_order: "asc",
      }),
      // Ajustes de saldo do mês — entram no saldo, fora dos KPIs. Não derruba o
      // calendário se o feed falhar (ex.: backend sem a feature ainda).
      listOrgBalanceAdjustments(organizationId, start, end).catch(() => []),
    ])
      .then(([res, adjustments]) => {
        if (cancelled) return;
        setState({
          loading: false,
          error: "",
          byDay: buildCalendarEvents(res.data || [], year, month, adjustments || []),
          hasLoaded: true,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        const detail = err?.response?.data?.detail;
        setState({ ...EMPTY, error: (typeof detail === "string" && detail) || err?.message || "Erro ao carregar o calendário.", hasLoaded: true });
      });
    return () => {
      cancelled = true;
    };
    // `transactionsRefreshToken` sobe de App.jsx (mesmo padrão de Cartões/Recorrências):
    // muda toda vez que uma transação é criada/editada/excluída em qualquer tela,
    // forçando este efeito a rebuscar mesmo com organização/mês inalterados.
  }, [enabled, organizationId, year, month, transactionsRefreshToken]);

  const summary = useMemo(() => monthSummary(state.byDay), [state.byDay]);
  return { ...state, summary };
}
