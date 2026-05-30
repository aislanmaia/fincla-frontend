import { useCallback, useEffect, useState } from "react";

import { fetchRefundCandidates } from "../../data/transactionsAdapter.js";

/**
 * Sub-fluxo do toggle "↺ Isto é um estorno?" do drawer Nova Transação:
 * mantém o estado do picker, busca debounced de candidatas e helpers de
 * hidratação/reset. O componente apresentacional é `./RefundLinkPanel.jsx`.
 *
 * Recebe os setters de cat/categoryTagId/method/cartao para auto-aplicar
 * valores razoáveis quando o usuário linka uma compra original (sem pisar
 * por cima de escolhas já feitas).
 */
export function useRefundPicker({
  open,
  isEstorno,
  organizationId,
  method,
  cartao,
  cat,
  categoryTagId,
  setCat,
  setCategoryTagId,
  setMethod,
  setCartao,
}) {
  const [refundOfTransactionId, setRefundOfTransactionId] = useState(null);
  const [refundLinkedTx, setRefundLinkedTx] = useState(null);
  const [refundPickerOpen, setRefundPickerOpen] = useState(false);
  const [refundPickerQuery, setRefundPickerQuery] = useState("");
  const [refundPickerCandidates, setRefundPickerCandidates] = useState([]);
  const [refundPickerLoading, setRefundPickerLoading] = useState(false);

  // Toggle volta para OFF → descarta vínculo já escolhido.
  useEffect(() => {
    if (isEstorno) return;
    if (refundOfTransactionId != null) setRefundOfTransactionId(null);
    if (refundLinkedTx != null) setRefundLinkedTx(null);
    if (refundPickerOpen) setRefundPickerOpen(false);
    if (refundPickerQuery) setRefundPickerQuery("");
    if (refundPickerCandidates.length) setRefundPickerCandidates([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEstorno]);

  // Busca debounced de candidatas (expenses recentes) com o picker aberto.
  useEffect(() => {
    if (!open) return undefined;
    if (!isEstorno || !refundPickerOpen || refundLinkedTx) return undefined;
    if (!organizationId) return undefined;
    let cancelled = false;
    setRefundPickerLoading(true);
    const cardIdNum =
      method === "credito" && cartao && cartao !== "novo" ? Number(cartao) : null;
    const handle = setTimeout(async () => {
      const candidates = await fetchRefundCandidates({
        organizationId,
        query: refundPickerQuery,
        paymentMethodKey: method === "credito" ? "credito" : null,
        cardId: Number.isFinite(cardIdNum) ? cardIdNum : null,
      });
      if (cancelled) return;
      setRefundPickerCandidates(candidates);
      setRefundPickerLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [
    open,
    isEstorno,
    refundPickerOpen,
    refundLinkedTx,
    refundPickerQuery,
    method,
    cartao,
    organizationId,
  ]);

  const openPicker = useCallback(() => {
    setRefundPickerOpen(true);
  }, []);

  const closePickerAndReset = useCallback(() => {
    setRefundPickerOpen(false);
    setRefundPickerQuery("");
    setRefundPickerCandidates([]);
  }, []);

  const handleLink = useCallback(
    (candidate) => {
      const candCardId =
        candidate.cartaoId != null && Number.isFinite(Number(candidate.cartaoId))
          ? Number(candidate.cartaoId)
          : null;
      setRefundOfTransactionId(Number(candidate.id));
      setRefundLinkedTx({
        id: Number(candidate.id),
        desc: candidate.desc,
        dateLabel: candidate.date,
        val: Math.abs(Number(candidate.val) || 0),
        cat: candidate.cat,
        categoryTagId: candidate.categoryTagId ?? null,
        paymentMethodKey: candidate.paymentMethodKey,
        cardId: candCardId,
      });
      if (!cat && candidate.cat) setCat(candidate.cat);
      if (!categoryTagId && candidate.categoryTagId) {
        setCategoryTagId(candidate.categoryTagId);
      }
      if (
        candidate.paymentMethodKey &&
        candidate.paymentMethodKey !== method &&
        method === "pix"
      ) {
        setMethod(candidate.paymentMethodKey);
      }
      if (
        candidate.paymentMethodKey === "credito" &&
        candCardId != null &&
        !cartao
      ) {
        setCartao(String(candCardId));
      }
      setRefundPickerOpen(false);
      setRefundPickerQuery("");
      setRefundPickerCandidates([]);
    },
    [cat, categoryTagId, method, cartao, setCat, setCategoryTagId, setMethod, setCartao],
  );

  const handleUnlink = useCallback(() => {
    setRefundOfTransactionId(null);
    setRefundLinkedTx(null);
  }, []);

  /** Aplica refundOfTransactionId/refundLinkedTx vindos do preConfig. */
  const hydrateFromPreConfig = useCallback((pc) => {
    setRefundOfTransactionId(pc?.refundOfTransactionId ?? null);
    setRefundLinkedTx(pc?.refundLinkedTx ?? null);
    setRefundPickerOpen(false);
    setRefundPickerQuery("");
    setRefundPickerCandidates([]);
  }, []);

  /** Reset completo (used em handleSetTipo ≠ despesa e handleNewTransaction). */
  const resetAll = useCallback(() => {
    setRefundOfTransactionId(null);
    setRefundLinkedTx(null);
    setRefundPickerOpen(false);
    setRefundPickerQuery("");
    setRefundPickerCandidates([]);
  }, []);

  return {
    refundOfTransactionId,
    refundLinkedTx,
    refundPickerOpen,
    refundPickerQuery,
    refundPickerCandidates,
    refundPickerLoading,
    setRefundPickerQuery,
    openPicker,
    closePickerAndReset,
    handleLink,
    handleUnlink,
    hydrateFromPreConfig,
    resetAll,
  };
}
