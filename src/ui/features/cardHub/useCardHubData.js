import { useCallback, useEffect, useMemo, useState } from "react";

import {
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

const NO_DETAIL = {
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

/**
 * Dados do Hub do cartão: lista de cartões e, para o selecionado, as três fontes
 * de faturas (histórico, aberta, futuras). `404` na fatura aberta é "ainda sem
 * lançamentos", nunca erro. Falha de uma fonte não derruba as outras.
 */
export function useCardHubData({ organizationId, enabled = true, refreshToken = 0 }) {
  const active = Boolean(enabled && organizationId);
  const [cardsState, setCardsState] = useState({ loading: active, error: "", cards: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(NO_DETAIL);

  useEffect(() => {
    if (!active) {
      setCardsState({ loading: false, error: "", cards: [] });
      return undefined;
    }
    let cancelled = false;
    setCardsState((s) => ({ ...s, loading: true, error: "" }));
    listCreditCards(organizationId)
      .then((list) => {
        if (!cancelled) setCardsState({ loading: false, error: "", cards: list });
      })
      .catch(() => {
        if (!cancelled) {
          setCardsState({ loading: false, error: "Não foi possível carregar seus cartões.", cards: [] });
        }
      });
    return () => { cancelled = true; };
  }, [active, organizationId, refreshToken]);

  const cards = cardsState.cards;
  const selectedCard = useMemo(() => {
    if (cards.length === 0) return null;
    return cards.find((c) => c.id === selectedId) ?? cards[0];
  }, [cards, selectedId]);
  const selectedCardId = selectedCard?.id ?? null;

  useEffect(() => {
    if (!active || selectedCardId == null) {
      setDetail(NO_DETAIL);
      return undefined;
    }
    let cancelled = false;
    setDetail(NO_DETAIL);
    const settle = (promise) => promise.then((value) => ({ ok: true, value }), (error) => ({ ok: false, error }));
    Promise.all([
      settle(getInvoiceHistory(selectedCardId, organizationId, HISTORY_MONTHS)),
      settle(getCurrentCreditCardInvoice(selectedCardId, organizationId)),
      settle(getFutureCommitments(selectedCardId, organizationId, FUTURE_MONTHS)),
    ]).then(([history, current, future]) => {
      if (cancelled) return;
      setDetail({
        loading: false,
        history: history.ok ? history.value : null,
        historyFailed: !history.ok,
        current: current.ok ? current.value : null,
        currentState: current.ok ? "ok" : isNotFound(current.error) ? "empty" : "unavailable",
        future: future.ok ? future.value : null,
        futureFailed: !future.ok,
      });
    });
    return () => { cancelled = true; };
  }, [active, organizationId, selectedCardId, refreshToken]);

  const invoiceCards = useMemo(() => {
    if (!selectedCard || detail.loading) return [];
    return buildInvoiceCards({
      card: selectedCard,
      history: detail.history,
      current: detail.current,
      currentState: detail.currentState,
      future: detail.future,
    });
  }, [selectedCard, detail]);

  const initialInvoiceKey = useMemo(() => defaultInvoiceKey(invoiceCards), [invoiceCards]);

  const uiCards = useMemo(
    () => cards.map((card) => (
      card.id === selectedCardId && !detail.loading
        ? mapCreditCardToUi({
          card,
          currentInvoice: detail.current,
          history: detail.history ?? undefined,
          futureCommitments: detail.future ?? undefined,
        })
        : mapCreditCardToUi({ card })
    )),
    [cards, selectedCardId, detail],
  );

  const saveNotes = useCallback(async (notes) => {
    const updated = await updateCreditCard(selectedCardId, { organization_id: organizationId, notes });
    setCardsState((s) => ({
      ...s,
      cards: s.cards.map((c) => (c.id === updated.id ? { ...c, notes: updated.notes ?? null } : c)),
    }));
    return updated.notes ?? "";
  }, [organizationId, selectedCardId]);

  return {
    isLoading: cardsState.loading,
    error: cardsState.error,
    cards,
    uiCards,
    selectedCard,
    selectedCardId,
    selectCard: setSelectedId,
    detail,
    invoiceCards,
    initialInvoiceKey,
    saveNotes,
  };
}
