import { useEffect, useMemo, useState } from "react";
import { listTransactions } from "../../../api/transactions";
import { buildCalendarEvents, monthSummary, ymd } from "./calendarModel.js";

const EMPTY = { loading: false, error: "", byDay: {}, hasLoaded: false };

export function useCalendarData({ organizationId, year, month, enabled = true }) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!enabled || !organizationId) {
      setState(EMPTY);
      return undefined;
    }
    let cancelled = false;
    setState({ ...EMPTY, loading: true });
    const last = new Date(year, month, 0).getDate();
    listTransactions({
      organization_id: organizationId,
      date_start: ymd(year, month, 1),
      date_end: ymd(year, month, last),
      limit: 100,
      sort_by: "date",
      sort_order: "asc",
    })
      .then((res) => {
        if (cancelled) return;
        setState({ loading: false, error: "", byDay: buildCalendarEvents(res.data || [], year, month), hasLoaded: true });
      })
      .catch((err) => {
        if (cancelled) return;
        const detail = err?.response?.data?.detail;
        setState({ ...EMPTY, error: (typeof detail === "string" && detail) || err?.message || "Erro ao carregar o calendário.", hasLoaded: true });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId, year, month]);

  const summary = useMemo(() => monthSummary(state.byDay), [state.byDay]);
  return { ...state, summary };
}
