import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getCurrentCreditCardInvoice,
  getFutureCommitments,
  getInvoiceHistory,
  markInvoicePaid,
  listCreditCards,
  updateCreditCard,
} from "../../../api/creditCards";
import { mapCreditCardToUi } from "../../data/creditCardsAdapter.js";
import { buildInvoiceCards, defaultInvoiceKey } from "./hubInvoices.js";

const HISTORY_MONTHS = 12;
const FUTURE_MONTHS = 12;

const LOADING_DETAIL = {
  loading: true,
  history: null,
  current: null,
  currentState: "unavailable",
  future: null,
  historyFailed: false,
  futureFailed: false,
};

function isNotFound(error) {
  return error?.response?.status === 404;
}

const settle = (promise) => promise.then((value) => ({ ok: true, value }), (error) => ({ ok: false, error }));

/**
 * Dados do Hub do cartão: lista de cartões e, para o selecionado, as três fontes
 * de faturas (histórico, aberta, futuras). `404` na fatura aberta é "ainda sem
 * lançamentos", nunca erro. Falha de uma fonte não derruba as outras.
 *
 * Stale-while-revalidate: só a primeira carga (ou troca de organização/cartão)
 * mostra carregamento. Um refetch mantém a UI e os dados atuais e só os troca
 * quando chega dado novo; se falha, o dado antigo fica e `refreshFailed` avisa.
 */
export function useCardHubData({ organizationId, enabled = true, refreshToken = 0 }) {
  const active = Boolean(enabled && organizationId);
  const [cardsState, setCardsState] = useState({ orgId: null, error: "", cards: [] });
  const [refreshFailedCards, setRefreshFailedCards] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [invoiceRefresh, setInvoiceRefresh] = useState(0);
  const [paidDates, setPaidDates] = useState({});
  const [detail, setDetail] = useState({ ...LOADING_DETAIL, cardId: null, orgId: null, refreshFailed: false });

  useEffect(() => {
    if (!active) {
      setCardsState({ orgId: null, error: "", cards: [] });
      return undefined;
    }
    let cancelled = false;
    listCreditCards(organizationId)
      .then((list) => {
        if (cancelled) return;
        setCardsState({ orgId: organizationId, error: "", cards: list });
        setRefreshFailedCards(false);
      })
      .catch(() => {
        if (cancelled) return;
        setCardsState((s) => (s.orgId === organizationId
          ? s
          : { orgId: organizationId, error: "Não foi possível carregar seus cartões.", cards: [] }));
        setRefreshFailedCards(true);
      });
    return () => { cancelled = true; };
  }, [active, organizationId, refreshToken]);

  const isLoading = active && cardsState.orgId !== organizationId;
  const cards = cardsState.orgId === organizationId ? cardsState.cards : [];
  const error = cardsState.orgId === organizationId ? cardsState.error : "";

  const selectedCard = useMemo(() => {
    if (cards.length === 0) return null;
    return cards.find((c) => c.id === selectedId) ?? cards[0];
  }, [cards, selectedId]);
  const selectedCardId = selectedCard?.id ?? null;

  useEffect(() => {
    if (!active || selectedCardId == null) return undefined;
    let cancelled = false;
    Promise.all([
      settle(getInvoiceHistory(selectedCardId, organizationId, HISTORY_MONTHS)),
      settle(getCurrentCreditCardInvoice(selectedCardId, organizationId)),
      settle(getFutureCommitments(selectedCardId, organizationId, FUTURE_MONTHS)),
    ]).then(([history, current, future]) => {
      if (cancelled) return;
      setDetail((prev) => {
        const sameCard = prev.cardId === selectedCardId && !prev.loading;
        const keep = (res, old, key) => (res.ok || !sameCard ? (res.ok ? res.value : null) : old[key]);
        const currentState = current.ok ? "ok" : isNotFound(current.error) ? "empty" : sameCard ? prev.currentState : "unavailable";
        return {
          cardId: selectedCardId,
          orgId: organizationId,
          loading: false,
          history: keep(history, prev, "history"),
          historyFailed: sameCard ? (history.ok ? false : prev.historyFailed) : !history.ok,
          current: current.ok ? current.value : currentState === "empty" ? null : sameCard ? prev.current : null,
          currentState,
          future: keep(future, prev, "future"),
          futureFailed: sameCard ? (future.ok ? false : prev.futureFailed) : !future.ok,
          refreshFailed: sameCard && (!history.ok || (!current.ok && !isNotFound(current.error)) || !future.ok),
        };
      });
    });
    return () => { cancelled = true; };
  }, [active, organizationId, selectedCardId, refreshToken, invoiceRefresh]);

  // Detalhe de OUTRO cartão (troca em andamento) conta como carregando: nunca se
  // mistura com o `closing_day`/`due_day` do cartão recém-selecionado.
  const detailReady = detail.cardId === selectedCardId && detail.orgId === organizationId && !detail.loading;
  const viewDetail = detailReady ? detail : { ...LOADING_DETAIL, cardId: selectedCardId, orgId: organizationId, refreshFailed: false };

  const invoiceCards = useMemo(() => {
    if (!selectedCard || !detailReady) return [];
    return buildInvoiceCards({
      card: selectedCard,
      history: detail.history,
      current: detail.current,
      currentState: detail.currentState,
      future: detail.future,
    }).map((invoice) => ({ ...invoice, paidDate: invoice.paidDate ?? (invoice.status === "paid" ? paidDates[`${organizationId}:${selectedCardId}:${invoice.key}`] ?? null : null) }));
  }, [selectedCard, selectedCardId, detail, detailReady, paidDates, organizationId]);

  const initialInvoiceKey = useMemo(() => defaultInvoiceKey(invoiceCards), [invoiceCards]);

  const uiCards = useMemo(
    () => cards.map((card) => (
      card.id === selectedCardId && detailReady
        ? mapCreditCardToUi({
          card,
          currentInvoice: detail.current,
          history: detail.history ?? undefined,
          futureCommitments: detail.future ?? undefined,
        })
        : mapCreditCardToUi({ card })
    )),
    [cards, selectedCardId, detail, detailReady],
  );

  const saveNotes = useCallback(async (notes) => {
    const updated = await updateCreditCard(selectedCardId, { organization_id: organizationId, notes });
    setCardsState((s) => ({
      ...s,
      cards: s.cards.map((c) => (c.id === updated.id ? { ...c, notes: updated.notes ?? null } : c)),
    }));
    return updated.notes ?? "";
  }, [organizationId, selectedCardId]);

  const payInvoice = useCallback(async (invoice, paidDate) => {
    await markInvoicePaid(selectedCardId, invoice.year, invoice.month, organizationId, paidDate);
    setDetail((prev) => prev.cardId === selectedCardId && prev.orgId === organizationId ? {
      ...prev,
      history: prev.history ? { ...prev.history, monthly_data: prev.history.monthly_data.map((row) =>
        row.year === invoice.year && row.month === invoice.month ? { ...row, status: "paid" } : row) } : prev.history,
      current: prev.current?.month === invoice.key ? { ...prev.current, status: "paid", paid_date: paidDate } : prev.current,
    } : prev);
    setPaidDates((dates) => ({ ...dates, [`${organizationId}:${selectedCardId}:${invoice.key}`]: paidDate }));
    setInvoiceRefresh((value) => value + 1);
  }, [organizationId, selectedCardId]);

  return {
    isLoading,
    error,
    refreshFailed: refreshFailedCards && cards.length > 0 || viewDetail.refreshFailed,
    cards,
    uiCards,
    selectedCard,
    selectedCardId,
    selectCard: setSelectedId,
    detail: viewDetail,
    invoiceCards,
    initialInvoiceKey,
    saveNotes,
    payInvoice,
  };
}
