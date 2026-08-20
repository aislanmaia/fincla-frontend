import { useEffect, useMemo, useState } from "react";
import { listTransactions } from "../../../api/transactions";
import { listOrgBalanceAdjustments } from "../../../api/balanceAdjustments";
import { buildCalendarEvents, monthSummary, ymd } from "./calendarModel.js";

const EMPTY = { loading: false, error: "", byDay: {}, hasLoaded: false };

// Evita o quadro em que a tela mostra "vazio"/R$ 0,00 antes do efeito marcar
// loading=true — a organização já é conhecida no 1º render (mesmo padrão do
// useCreditCardsData: `isLoading: Boolean(enabled && organizationId)`).
function initialState(enabled, organizationId) {
  return { ...EMPTY, loading: Boolean(enabled && organizationId) };
}

export function useCalendarData({ organizationId, year, month, enabled = true, transactionsRefreshToken = 0 }) {
  const [state, setState] = useState(() => initialState(enabled, organizationId));

  // Chave do período (organização + mês) que os dados em `state` representam.
  // Quando ela muda — troca de mês/ano ou de organização —, os dados atuais são
  // de OUTRO período e precisam sumir AGORA, durante o render, e não só depois
  // que o efeito abaixo rodar. Sem isto, o React chega a pintar (por um quadro)
  // o total do mês antigo sob o rótulo do mês novo, porque o efeito só reseta o
  // estado depois do commit. `transactionsRefreshToken` fica de fora da chave de
  // propósito: revalidar o MESMO período (ex.: transação nova salva com o
  // calendário aberto) não deve apagar a grade — ver o efeito abaixo.
  const periodKey = `${organizationId || ""}|${year}|${month}`;
  const [trackedPeriodKey, setTrackedPeriodKey] = useState(periodKey);
  if (periodKey !== trackedPeriodKey) {
    setTrackedPeriodKey(periodKey);
    setState(initialState(enabled, organizationId));
  }

  useEffect(() => {
    if (!enabled || !organizationId) {
      setState(EMPTY);
      return undefined;
    }
    let cancelled = false;
    // Stale-while-revalidate: sinaliza loading SEM apagar os dados já carregados.
    // A troca de período (mês/organização) já foi zerada de forma síncrona acima;
    // o que sobra aqui é ou o primeiro carregamento (byDay já está vazio) ou uma
    // revalidação do mesmo período (ex.: transactionsRefreshToken mudou) — nesse
    // caso os chips do mês não podem sumir enquanto o request está em voo.
    setState((current) => ({ ...current, loading: true, error: "" }));
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
        // Mantém os dados anteriores na tela (`...current`) — uma revalidação que
        // falha não pode apagar o que já estava correto; só liga o aviso de erro.
        setState((current) => ({
          ...current,
          loading: false,
          error: (typeof detail === "string" && detail) || err?.message || "Erro ao carregar o calendário.",
          hasLoaded: true,
        }));
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
