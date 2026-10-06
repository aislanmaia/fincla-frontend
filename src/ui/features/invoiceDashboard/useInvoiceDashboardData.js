import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getCreditCardInvoice,
  getFutureCommitments,
  getInvoiceHistory,
  listCreditCards,
  markInvoicePaid,
  unmarkInvoicePaid,
} from "../../../api/creditCards";
import { formatCreditCardsApiError } from "../../data/creditCardsAdapter.js";
import { useToday } from "../cardHub/useToday.js";
import { buildDashboardInvoices, isForecastInvoice } from "./invoiceDashboardModel.js";

const HISTORY_MONTHS = 12;
const FUTURE_MONTHS = 12;

const statusOf = (error) => error?.response?.status;
const settle = (promise) => promise.then((value) => ({ ok: true, value }), (error) => ({ ok: false, error }));
const detailId = (orgId, cardId, year, month) => `${orgId}:${cardId}:${year}-${month}`;

/**
 * Dados do dashboard de UMA fatura. Carga limitada e independente do número de
 * cartões e de meses: lista de cartões, histórico, compromissos futuros e o detalhe
 * da fatura SELECIONADA. O detalhe de outra fatura só é buscado quando ela é
 * selecionada (cacheado por fatura). Fatura posterior à aberta também consulta o
 * detalhe: compra com data futura e parcelas já formam fatura real no servidor, e
 * future-commitments nem sempre concorda com ela; sem detalhe (404) vale a previsão.
 *
 * `404` do detalhe é "fatura sem lançamentos", nunca erro. Stale-while-revalidate:
 * só a primeira carga mostra carregamento; refetch e mutações mantêm a tela.
 */
export function useInvoiceDashboardData({ organizationId, cardId, year, month, enabled = true, refreshToken = 0 }) {
  const active = Boolean(enabled && organizationId);
  const now = useToday();
  const inflight = useRef(new Map());
  const [cardsState, setCardsState] = useState({ orgId: null, status: "idle", cards: [] });
  const [aux, setAux] = useState({ id: null, history: null, future: null, historyFailed: false, futureFailed: false, ready: false });
  const [details, setDetails] = useState({});
  const [mutation, setMutation] = useState({ pending: false, error: "" });
  const detailsRef = useRef(details);
  detailsRef.current = details;

  const once = useCallback((id, run) => {
    const hit = inflight.current.get(id);
    if (hit) return hit;
    const promise = run().finally(() => inflight.current.delete(id));
    inflight.current.set(id, promise);
    return promise;
  }, []);

  useEffect(() => {
    if (!active) {
      setCardsState({ orgId: null, status: "idle", cards: [] });
      return;
    }
    let cancelled = false;
    once(`cards:${organizationId}:${refreshToken}`, () => listCreditCards(organizationId))
      .then((list) => { if (!cancelled) setCardsState({ orgId: organizationId, status: "ok", cards: list }); })
      .catch((error) => {
        if (cancelled) return;
        setCardsState((s) => (s.orgId === organizationId && s.status === "ok"
          ? s
          : { orgId: organizationId, status: statusOf(error) === 403 ? "forbidden" : "error", cards: [] }));
      });
    return () => { cancelled = true; };
  }, [active, organizationId, refreshToken, once]);

  const cardsReady = cardsState.orgId === organizationId;
  const card = useMemo(
    () => (cardsReady ? cardsState.cards.find((c) => c.public_id === cardId) ?? null : null),
    [cardsReady, cardsState.cards, cardId],
  );
  const numericCardId = card?.id ?? null;

  const loadAux = useCallback(() => {
    if (numericCardId == null) return Promise.resolve();
    const id = `${organizationId}:${numericCardId}`;
    return Promise.all([
      once(`history:${id}`, () => settle(getInvoiceHistory(numericCardId, organizationId, HISTORY_MONTHS))),
      once(`future:${id}`, () => settle(getFutureCommitments(numericCardId, organizationId, FUTURE_MONTHS))),
    ]).then(([history, future]) => {
      setAux((prev) => {
        const same = prev.id === id && prev.ready;
        return {
          id,
          ready: true,
          history: history.ok ? history.value : same ? prev.history : null,
          historyFailed: !history.ok,
          future: future.ok ? future.value : same ? prev.future : null,
          futureFailed: !future.ok,
        };
      });
    });
  }, [numericCardId, organizationId, once]);

  useEffect(() => {
    if (!active || numericCardId == null) return;
    loadAux();
  }, [active, numericCardId, refreshToken, loadAux]);

  const forecast = card ? isForecastInvoice(card, year, month, now) : false;
  const selectedId = detailId(organizationId, numericCardId, year, month);
  const selectedEntry = details[selectedId];
  const selectedStale = selectedEntry?.stale === true;

  const fetchDetail = useCallback((id) => once(`detail:${id}`, () => settle(
    getCreditCardInvoice(numericCardId, year, month, organizationId),
  )).then((res) => {
    setDetails((prev) => {
      const old = prev[id];
      if (res.ok) return { ...prev, [id]: { state: "ok", data: res.value, stale: false, refreshFailed: false } };
      const status = statusOf(res.error);
      if (status === 404) return { ...prev, [id]: { state: "empty", data: null, stale: false, refreshFailed: false } };
      if (old && old.state === "ok") return { ...prev, [id]: { ...old, stale: false, refreshFailed: true } };
      return { ...prev, [id]: { state: status === 403 ? "forbidden" : "error", data: null, stale: false, refreshFailed: false } };
    });
  }), [numericCardId, year, month, organizationId, once]);

  useEffect(() => {
    if (!active || numericCardId == null) return;
    const entry = detailsRef.current[selectedId];
    if (entry && !entry.stale && entry.state !== "error") return;
    fetchDetail(selectedId);
  }, [active, numericCardId, selectedId, selectedStale, fetchDetail]);

  const firstToken = useRef(refreshToken);
  useEffect(() => {
    if (firstToken.current === refreshToken) return;
    firstToken.current = refreshToken;
    setDetails((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, stale: true }])));
  }, [refreshToken]);

  const detailState = !card ? "loading" : !selectedEntry ? "loading" : selectedEntry.state === "empty" && forecast ? "forecast" : selectedEntry.state;
  const detail = selectedEntry?.state === "ok" ? selectedEntry.data : null;

  const invoices = useMemo(() => buildDashboardInvoices({
    card,
    history: aux.id === `${organizationId}:${numericCardId}` ? aux.history : null,
    future: aux.id === `${organizationId}:${numericCardId}` ? aux.future : null,
    selected: card ? { year, month, state: detailState, detail } : null,
    now,
  }), [card, aux, organizationId, numericCardId, year, month, detailState, detail, now]);

  const futureRow = useMemo(
    () => (aux.future?.monthly_breakdown ?? []).find((r) => r.year === year && r.month === month) ?? null,
    [aux.future, year, month],
  );

  const patchDetail = (id, patch) => setDetails((prev) => (prev[id]?.state === "ok"
    ? { ...prev, [id]: { ...prev[id], data: { ...prev[id].data, ...patch } } }
    : prev));
  const patchHistoryRow = (status) => setAux((prev) => (prev.history
    ? {
      ...prev,
      history: {
        ...prev.history,
        monthly_data: (prev.history.monthly_data ?? []).map((row) => (row.year === year && row.month === month ? { ...row, status } : row)),
      },
    }
    : prev));

  const mutate = useCallback(async (request) => {
    if (numericCardId == null || mutation.pending) return { ok: false };
    const id = detailId(organizationId, numericCardId, year, month);
    setMutation({ pending: true, error: "" });
    try {
      const res = await request();
      patchDetail(id, { status: res.status, paid_date: res.paid_date ?? null });
      patchHistoryRow(res.status);
      setMutation({ pending: false, error: "" });
      setDetails((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], stale: true } } : prev));
      loadAux();
      return { ok: true };
    } catch (error) {
      setMutation({ pending: false, error: formatCreditCardsApiError(error) });
      return { ok: false };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericCardId, organizationId, year, month, mutation.pending, loadAux]);

  const markPaid = useCallback((paidDate) => mutate(
    () => markInvoicePaid(numericCardId, year, month, organizationId, paidDate),
  ), [mutate, numericCardId, year, month, organizationId]);
  const unmarkPaid = useCallback(() => mutate(
    () => unmarkInvoicePaid(numericCardId, year, month, organizationId),
  ), [mutate, numericCardId, year, month, organizationId]);
  const retryDetail = useCallback(() => { fetchDetail(selectedId); }, [fetchDetail, selectedId]);
  const clearMutationError = useCallback(() => setMutation((m) => (m.error ? { ...m, error: "" } : m)), []);

  return {
    now,
    isLoading: active && !cardsReady,
    loadFailed: cardsReady && (cardsState.status === "error" || cardsState.status === "forbidden"),
    forbidden: cardsReady && cardsState.status === "forbidden",
    cardNotFound: cardsReady && cardsState.status === "ok" && card === null,
    card,
    auxReady: aux.ready && aux.id === `${organizationId}:${numericCardId}`,
    historyFailed: aux.historyFailed,
    futureFailed: aux.futureFailed,
    forecast,
    futureRow,
    detailState,
    detail,
    refreshFailed: selectedEntry?.refreshFailed === true,
    invoices,
    mutation,
    markPaid,
    unmarkPaid,
    clearMutationError,
    retryDetail,
  };
}
