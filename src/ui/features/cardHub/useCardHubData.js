import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createCreditCard,
  getCurrentCreditCardInvoice,
  getFutureCommitments,
  getInvoiceHistory,
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
  const [detail, setDetail] = useState({ ...LOADING_DETAIL, cardId: null, refreshFailed: false });

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
  }, [active, organizationId, selectedCardId, refreshToken]);

  // Detalhe de OUTRO cartão (troca em andamento) conta como carregando: nunca se
  // mistura com o `closing_day`/`due_day` do cartão recém-selecionado.
  const detailReady = detail.cardId === selectedCardId && !detail.loading;
  const viewDetail = detailReady ? detail : { ...LOADING_DETAIL, cardId: selectedCardId, refreshFailed: false };

  const invoiceCards = useMemo(() => {
    if (!selectedCard || !detailReady) return [];
    return buildInvoiceCards({
      card: selectedCard,
      history: detail.history,
      current: detail.current,
      currentState: detail.currentState,
      future: detail.future,
    });
  }, [selectedCard, detail, detailReady]);

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

  const createCard = useCallback(async (payload) => {
    const created = await createCreditCard(payload);
    setCardsState((state) => ({
      ...state,
      cards: [...state.cards, created],
    }));
    setSelectedId(created.id);
    return created;
  }, []);

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
    createCard,
  };
}
