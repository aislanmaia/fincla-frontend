import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createCreditCardForUi,
  formatCreditCardsApiError,
  listCreditCardsForUi,
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

export function useCreditCardsData({
  organizationId,
  enabled = true,
  transactionsRefreshToken = 0,
}) {
  const [state, setState] = useState(() => ({
    ...EMPTY_STATE,
    // Evita um frame de “lista vazia” antes do efeito marcar loading (org já conhecida no 1º render)
    isLoading: Boolean(enabled && organizationId),
  }));

  const reload = useCallback(async () => {
    if (!organizationId) return;
    setState((current) => ({ ...current, isLoading: true, error: "" }));
    try {
      const result = await listCreditCardsForUi(organizationId);
      setState((current) => ({
        ...current,
        isLoading: false,
        error: "",
        cards: result.cards,
        consolidatedCommitments: result.consolidatedCommitments,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        isLoading: false,
        error: formatCreditCardsApiError(error),
      }));
    }
  }, [organizationId]);

  useEffect(() => {
    if (!enabled || !organizationId) {
      setState(EMPTY_STATE);
      return;
    }
    let cancelled = false;
    setState((current) => ({ ...current, isLoading: true, error: "" }));
    listCreditCardsForUi(organizationId)
      .then((result) => {
        if (cancelled) return;
        setState((current) => ({
          ...current,
          isLoading: false,
          error: "",
          cards: result.cards,
          consolidatedCommitments: result.consolidatedCommitments,
        }));
      })
      .catch((error) => {
        if (cancelled) return;
        setState((current) => ({
          ...current,
          isLoading: false,
          error: formatCreditCardsApiError(error),
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId, reload, transactionsRefreshToken]);

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
    createCard,
    updateCard,
    markInvoicePaid,
    moveInstallment,
    deleteInvoiceItem,
  }), [createCard, updateCard, markInvoicePaid, moveInstallment, deleteInvoiceItem, reload, state]);
}
