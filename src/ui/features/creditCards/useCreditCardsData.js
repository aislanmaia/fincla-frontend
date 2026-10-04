import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createCreditCardForUi,
  formatCreditCardsApiError,
  listCreditCardsBasicForUi,
  loadCreditCardDetailForUi,
  markInvoicePaidForUi,
  moveInstallmentForUi,
  updateCreditCardForUi,
} from "../../data/creditCardsAdapter.js";
import { deleteTransactionForUi } from "../../data/transactionsAdapter.js";

const EMPTY_STATE = {
  isLoading: false,
  isSavingCard: false,
  isUpdatingCard: false,
  isMarkingInvoice: false,
  isMovingInstallment: false,
  isDeletingInvoiceItem: false,
  error: "",
  cards: [],
  consolidatedCommitments: null,
};

/**
 * Cartões da tela de Cartões.
 *
 * A carga busca a lista (1 chamada) e o detalhe só do cartão SELECIONADO
 * (`selectedCardId`; sem ele, o primeiro). Os demais ficam "básicos"
 * (`detailLoaded: false`) até alguém selecioná-los: `ensureCardDetail` busca e
 * guarda em cache. O cache vive no hook (por montagem) e é descartado por inteiro
 * a cada recarga, que é o que toda mutação (pagar fatura, mover parcela, criar,
 * editar, excluir lançamento) e a mudança de `transactionsRefreshToken` fazem.
 */
export function useCreditCardsData({
  organizationId,
  enabled = true,
  transactionsRefreshToken = 0,
  selectedCardId = null,
}) {
  const [state, setState] = useState(() => ({
    ...EMPTY_STATE,
    // Evita um frame de “lista vazia” antes do efeito marcar loading (org já conhecida no 1º render)
    isLoading: Boolean(enabled && organizationId),
  }));

  const selectedCardIdRef = useRef(selectedCardId);
  selectedCardIdRef.current = selectedCardId;
  const rawCardsRef = useRef(new Map());
  const detailCacheRef = useRef(new Map());
  const detailInFlightRef = useRef(new Map());
  const overviewInFlightRef = useRef(null);
  /** Sobe a cada carga aplicada: detalhe pedido antes dela não pode entrar no cache depois. */
  const generationRef = useRef(0);
  /** Cada carga pedida ganha um número; só a mais recente pode aplicar o resultado. */
  const loadSeqRef = useRef(0);

  const fetchOverview = useCallback(async (orgId) => {
    const { rawCards, cards } = await listCreditCardsBasicForUi(orgId);
    const target = cards.find((c) => c.id === selectedCardIdRef.current) || cards[0];
    const raw = target ? rawCards.find((c) => String(c.id) === target.id) : null;
    const detailed = raw ? await loadCreditCardDetailForUi(raw, orgId) : null;
    return { rawCards, cards, detailed };
  }, []);

  /**
   * `shareKey` junta duas cargas idênticas ainda em voo (o StrictMode dobra o
   * efeito de montagem) numa só requisição. Recarga após mutação passa `null`:
   * nunca pode herdar uma resposta pedida antes da mutação.
   */
  const startOverview = useCallback((orgId, shareKey) => {
    const inFlight = overviewInFlightRef.current;
    if (shareKey && inFlight?.key === shareKey) return inFlight.promise;
    const promise = fetchOverview(orgId).finally(() => {
      if (overviewInFlightRef.current?.promise === promise) overviewInFlightRef.current = null;
    });
    overviewInFlightRef.current = { key: shareKey, promise };
    return promise;
  }, [fetchOverview]);

  const applyOverview = useCallback(({ rawCards, cards, detailed }) => {
    generationRef.current += 1;
    rawCardsRef.current = new Map(rawCards.map((c) => [String(c.id), c]));
    detailCacheRef.current = new Map(detailed ? [[detailed.id, detailed]] : []);
    detailInFlightRef.current = new Map();
    setState((current) => ({
      ...current,
      isLoading: false,
      error: "",
      cards: cards.map((c) => (detailed && c.id === detailed.id ? detailed : c)),
    }));
  }, []);

  const reload = useCallback(async () => {
    if (!organizationId) return;
    const seq = (loadSeqRef.current += 1);
    setState((current) => ({ ...current, isLoading: true, error: "" }));
    try {
      const result = await startOverview(organizationId, null);
      if (seq === loadSeqRef.current) applyOverview(result);
    } catch (error) {
      if (seq !== loadSeqRef.current) return;
      setState((current) => ({
        ...current,
        isLoading: false,
        error: formatCreditCardsApiError(error),
      }));
    }
  }, [organizationId, startOverview, applyOverview]);

  useEffect(() => {
    if (!enabled || !organizationId) {
      loadSeqRef.current += 1;
      generationRef.current += 1;
      rawCardsRef.current = new Map();
      detailCacheRef.current = new Map();
      detailInFlightRef.current = new Map();
      setState(EMPTY_STATE);
      return;
    }
    let cancelled = false;
    const seq = (loadSeqRef.current += 1);
    setState((current) => ({ ...current, isLoading: true, error: "" }));
    startOverview(organizationId, `${organizationId}:${transactionsRefreshToken}`)
      .then((result) => {
        if (cancelled || seq !== loadSeqRef.current) return;
        applyOverview(result);
      })
      .catch((error) => {
        if (cancelled || seq !== loadSeqRef.current) return;
        setState((current) => ({
          ...current,
          isLoading: false,
          error: formatCreditCardsApiError(error),
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId, transactionsRefreshToken, startOverview, applyOverview]);

  /** Detalhe de um cartão: do cache, de uma busca já em voo, ou de uma nova. */
  const ensureCardDetail = useCallback(async (cardId) => {
    const id = String(cardId);
    const cached = detailCacheRef.current.get(id);
    if (cached) return cached;
    const raw = rawCardsRef.current.get(id);
    if (!raw || !organizationId) return null;
    const inFlight = detailInFlightRef.current.get(id);
    if (inFlight) return inFlight;

    const generation = generationRef.current;
    const promise = loadCreditCardDetailForUi(raw, organizationId)
      .then((detailed) => {
        if (generation === generationRef.current) {
          detailCacheRef.current.set(id, detailed);
          setState((current) => ({
            ...current,
            cards: current.cards.map((c) => (c.id === id ? detailed : c)),
          }));
        }
        return detailed;
      })
      .finally(() => {
        if (detailInFlightRef.current.get(id) === promise) detailInFlightRef.current.delete(id);
      });
    detailInFlightRef.current.set(id, promise);
    return promise;
  }, [organizationId]);

  // Rede de segurança: o cartão selecionado nunca fica "básico" (ex.: o seletor
  // caiu no primeiro porque o escolhido sumiu da lista).
  useEffect(() => {
    if (state.cards.length === 0) return;
    const target = state.cards.find((c) => c.id === selectedCardId) || state.cards[0];
    if (target.detailLoaded === false) ensureCardDetail(target.id).catch(() => {});
  }, [state.cards, selectedCardId, ensureCardDetail]);

  const createCard = useCallback(async (payload) => {
    setState((current) => ({ ...current, isSavingCard: true, error: "" }));
    try {
      await createCreditCardForUi(payload);
      await reload();
    } catch (error) {
      setState((current) => ({
        ...current,
        isSavingCard: false,
        error: formatCreditCardsApiError(error),
      }));
      throw error;
    }
    setState((current) => ({ ...current, isSavingCard: false }));
  }, [reload]);

  const updateCard = useCallback(async (cardId, payload) => {
    setState((current) => ({ ...current, isUpdatingCard: true, error: "" }));
    try {
      await updateCreditCardForUi(cardId, payload);
      await reload();
    } catch (error) {
      setState((current) => ({
        ...current,
        isUpdatingCard: false,
        error: formatCreditCardsApiError(error),
      }));
      throw error;
    }
    setState((current) => ({ ...current, isUpdatingCard: false }));
  }, [reload]);

  const markInvoicePaid = useCallback(async (payload) => {
    setState((current) => ({ ...current, isMarkingInvoice: true, error: "" }));
    try {
      await markInvoicePaidForUi(payload);
      await reload();
    } catch (error) {
      setState((current) => ({
        ...current,
        isMarkingInvoice: false,
        error: formatCreditCardsApiError(error),
      }));
      throw error;
    }
    setState((current) => ({ ...current, isMarkingInvoice: false }));
  }, [reload]);

  const moveInstallment = useCallback(async (payload) => {
    setState((current) => ({ ...current, isMovingInstallment: true, error: "" }));
    try {
      await moveInstallmentForUi(payload);
      await reload();
    } catch (error) {
      setState((current) => ({
        ...current,
        isMovingInstallment: false,
        error: formatCreditCardsApiError(error),
      }));
      throw error;
    }
    setState((current) => ({ ...current, isMovingInstallment: false }));
  }, [reload]);

  const deleteInvoiceItem = useCallback(async (transactionId) => {
    if (!organizationId) return;
    setState((current) => ({ ...current, isDeletingInvoiceItem: true, error: "" }));
    try {
      await deleteTransactionForUi(transactionId, organizationId);
      await reload();
    } catch (error) {
      setState((current) => ({
        ...current,
        isDeletingInvoiceItem: false,
        error: formatCreditCardsApiError(error),
      }));
      throw error;
    }
    setState((current) => ({ ...current, isDeletingInvoiceItem: false }));
  }, [organizationId, reload]);

  return useMemo(() => ({
    ...state,
    hasRealData: state.cards.length > 0,
    reload,
    ensureCardDetail,
    createCard,
    updateCard,
    markInvoicePaid,
    moveInstallment,
    deleteInvoiceItem,
  }), [createCard, updateCard, markInvoicePaid, moveInstallment, deleteInvoiceItem, reload, ensureCardDetail, state]);
}
