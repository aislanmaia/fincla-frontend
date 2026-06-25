import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { getTransaction } from "../../../api/transactions";
import { TRANSACTIONS } from "../../data/mockFinance.js";
import {
  isUuidString,
  mapApiTransactionToUi,
  modalPaymentKeyFromTransactionUi,
  transactionDateIsoFromBrDisplay,
  transactionUiValAbsForEdit,
} from "../../data/transactionsAdapter.js";
import { FC, FC_MODAL } from "../../routing/searchContract.js";
import { transactionEditIdFromPathname } from "../../routing/transactionPathId.js";

/**
 * Controller do drawer «Nova transação»: estado de abertura, hidratação por URL
 * (search params `fc_modal`/`fc_tx`/`fc_card` + path id) e fetch de transação para edição
 * em modo live ou mock.
 *
 * Exposto:
 *  - `txModalOpen` / `novaRecorrenciaModal`
 *  - `modalPreConfig` / `setModalPreConfig` (callers usam para pré-configurar o drawer)
 *  - `openTxModal(patch)` / `closeTxModal()`
 */
export function useTransactionModalController({
  session,
  pathname,
  showOnboarding,
  dataMode,
  mockDataEnabled,
}) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false });

  const [modalPreConfig, setModalPreConfig] = useState(null);
  const urlHydratedRef = useRef(false);
  const editTxHydrateKeyRef = useRef(null);

  const transactionRouteEditId = transactionEditIdFromPathname(pathname);

  const txModalOpen =
    session.isAuthenticated &&
    !session.isBootstrapping &&
    !showOnboarding &&
    !session.onboardingRequired &&
    (search[FC.MODAL] === FC_MODAL.NEW_TRANSACTION ||
      search[FC.MODAL] === FC_MODAL.EDIT_TRANSACTION ||
      search[FC.MODAL] === FC_MODAL.NEW_RECURRING ||
      Boolean(transactionRouteEditId));

  const novaRecorrenciaModal =
    search[FC.MODAL] === FC_MODAL.NEW_RECURRING || Boolean(modalPreConfig?.novaRecorrencia);

  const closeTxModal = useCallback(() => {
    urlHydratedRef.current = false;
    const onTxDetailPath = Boolean(transactionEditIdFromPathname(pathname));
    navigate({
      replace: true,
      ...(onTxDetailPath
        ? {
            to: "/transactions/{-$transactionId}",
            params: { transactionId: undefined },
          }
        : {}),
      search: (prev) => {
        const next = { ...prev };
        delete next[FC.MODAL];
        delete next[FC.TX];
        delete next[FC.CARD];
        return next;
      },
    });
    setModalPreConfig(null);
  }, [navigate, pathname]);

  const openTxModal = useCallback(
    (patch = {}) => {
      urlHydratedRef.current = false;
      const txPatchId =
        patch[FC.TX] != null ? String(patch[FC.TX]).trim() : "";
      const useTxPath =
        txPatchId &&
        (isUuidString(txPatchId) || /^\d+$/.test(txPatchId)) &&
        (patch[FC.MODAL] ?? FC_MODAL.NEW_TRANSACTION) ===
          FC_MODAL.NEW_TRANSACTION;

      const onTxDetailPath = Boolean(transactionEditIdFromPathname(pathname));

      if (
        onTxDetailPath &&
        !patch.keepExistingIds &&
        !patch[FC.CARD] &&
        !useTxPath
      ) {
        navigate({
          replace: true,
          to: "/transactions/{-$transactionId}",
          params: { transactionId: undefined },
          search: (prev) => {
            const next = { ...prev };
            if (!patch.keepExistingIds) {
              delete next[FC.TX];
              delete next[FC.CARD];
            }
            next[FC.MODAL] = patch[FC.MODAL] ?? FC_MODAL.NEW_TRANSACTION;
            if (patch[FC.CARD]) next[FC.CARD] = patch[FC.CARD];
            if (patch[FC.TX]) next[FC.TX] = patch[FC.TX];
            return next;
          },
        });
        return;
      }

      if (useTxPath) {
        navigate({
          replace: true,
          to: "/transactions/{-$transactionId}",
          params: { transactionId: txPatchId },
          search: (prev) => {
            const next = { ...prev };
            delete next[FC.TX];
            delete next[FC.CARD];
            // Edição: o id no path já abre o modal; `fc_modal=new-transaction` fica só para «nova» na lista.
            delete next[FC.MODAL];
            if (patch[FC.CARD]) next[FC.CARD] = patch[FC.CARD];
            return next;
          },
        });
        return;
      }

      navigate({
        replace: true,
        search: (prev) => {
          const next = { ...prev };
          if (!patch.keepExistingIds) {
            delete next[FC.TX];
            delete next[FC.CARD];
          }
          next[FC.MODAL] = patch[FC.MODAL] ?? FC_MODAL.NEW_TRANSACTION;
          if (patch[FC.CARD]) next[FC.CARD] = patch[FC.CARD];
          if (patch[FC.TX]) next[FC.TX] = patch[FC.TX];
          return next;
        },
      });
    },
    [navigate, pathname],
  );

  useLayoutEffect(() => {
    if (!txModalOpen) {
      urlHydratedRef.current = false;
      return;
    }
    if (urlHydratedRef.current) return;
    if (search[FC.CARD] && isUuidString(String(search[FC.CARD]))) {
      setModalPreConfig((p) => ({
        ...(p || {}),
        tipo: "despesa",
        method: "credito",
        cartaoId: String(search[FC.CARD]),
      }));
      urlHydratedRef.current = true;
      return;
    }
    const qTx = search[FC.TX];
    if (
      qTx &&
      (isUuidString(String(qTx)) || /^\d+$/.test(String(qTx).trim()))
    ) {
      setModalPreConfig((p) => ({
        ...(p || {}),
        editingTransactionId: String(qTx),
      }));
      urlHydratedRef.current = true;
      return;
    }
    if (transactionRouteEditId) {
      setModalPreConfig((p) => ({
        ...(p || {}),
        editingTransactionId: String(transactionRouteEditId),
      }));
      urlHydratedRef.current = true;
    }
  }, [
    txModalOpen,
    search[FC.CARD],
    search[FC.TX],
    transactionRouteEditId,
  ]);

  // Modal só com id na URL: em live busca GET /transactions/:id; em mock (id numérico) usa TRANSACTIONS.
  useEffect(() => {
    if (!txModalOpen) {
      editTxHydrateKeyRef.current = null;
      return;
    }
    if (!session.isAuthenticated || session.isBootstrapping) return;

    const pc = modalPreConfig;
    const editFromPc =
      pc?.editingTransactionId != null
        ? String(pc.editingTransactionId).trim()
        : "";
    const routeId = transactionRouteEditId;
    const editId = editFromPc || (routeId ? String(routeId) : "");
    if (!editId) return;
    if (routeId && editFromPc && String(routeId) !== editFromPc) return;

    const hasEditorPayload =
      (pc?.desc != null && String(pc.desc).trim() !== "") ||
      (pc?.valorInicial != null &&
        pc.valorInicial !== "" &&
        Number.isFinite(Number(pc.valorInicial)));
    if (hasEditorPayload) return;

    if (dataMode === "mock" && mockDataEnabled && /^\d+$/.test(editId)) {
      const dedupeMock = `mock|${editId}`;
      if (editTxHydrateKeyRef.current === dedupeMock) return;
      const tx = TRANSACTIONS.find((t) => String(t.id) === editId);
      if (!tx) return;
      editTxHydrateKeyRef.current = dedupeMock;
      const txMethod = modalPaymentKeyFromTransactionUi(tx);
      const isParcelado = tx.parcela && tx.parcela.total > 1;
      setModalPreConfig((p) => ({
        ...(p || {}),
        tipo: tx.val > 0 ? "receita" : "despesa",
        desc: tx.desc,
        cat: tx.cat,
        categoryTagId: tx.categoryTagId ?? null,
        method: txMethod,
        valorInicial: transactionUiValAbsForEdit(tx),
        recorre: tx.rec,
        editingTransactionId: tx.id,
        dateIso:
          tx.dateIsoForEdit ??
          transactionDateIsoFromBrDisplay(tx.date) ??
          undefined,
        cartaoId: tx.cartaoId != null ? tx.cartaoId : undefined,
        modalidade:
          txMethod === "credito"
            ? isParcelado
              ? "parcelado"
              : "avista"
            : undefined,
        parcelas: isParcelado ? tx.parcela.total : undefined,
      }));
      return;
    }

    if (dataMode !== "live") return;
    const orgId = session.activeOrgId;
    if (!orgId) return;
    // API pode usar id numérico ou UUID na URL — ambos suportados em GET /transactions/:id
    if (!isUuidString(editId) && !/^\d+$/.test(editId)) return;

    const dedupeKey = `${orgId}|${editId}`;
    if (editTxHydrateKeyRef.current === dedupeKey) return;
    editTxHydrateKeyRef.current = dedupeKey;

    let cancelled = false;
    getTransaction(editId, orgId)
      .then((raw) => {
        if (cancelled) return;
        const ui = mapApiTransactionToUi(raw);
        const txMethod = modalPaymentKeyFromTransactionUi(ui);
        const isParcelado = ui.parcela && ui.parcela.total > 1;
        setModalPreConfig((p) => ({
          ...(p || {}),
          tipo: ui.val > 0 ? "receita" : "despesa",
          desc: ui.desc,
          cat: ui.cat,
          categoryTagId: ui.categoryTagId ?? null,
          categoryTagIsActive: ui.categoryTagIsActive !== false,
          method: txMethod,
          valorInicial: transactionUiValAbsForEdit(ui),
          recorre: ui.rec,
          editingTransactionId: ui.id,
          dateIso:
            ui.dateIsoForEdit ??
            transactionDateIsoFromBrDisplay(ui.date) ??
            undefined,
          cartaoId: ui.cartaoId != null ? ui.cartaoId : undefined,
          modalidade:
            txMethod === "credito"
              ? isParcelado
                ? "parcelado"
                : "avista"
              : undefined,
          parcelas: isParcelado ? ui.parcela.total : undefined,
          tags: ui.tags ?? [],
          detailTagIds: ui.detailTagIds ?? [],
          detailTagDisplayById: ui.detailTagDisplayById ?? {},
          detailTagMetaById: ui.detailTagMetaById ?? {},
        }));
      })
      .catch(() => {
        editTxHydrateKeyRef.current = null;
      });
    return () => {
      cancelled = true;
      editTxHydrateKeyRef.current = null;
    };
  }, [
    txModalOpen,
    dataMode,
    mockDataEnabled,
    session.isAuthenticated,
    session.isBootstrapping,
    session.activeOrgId,
    modalPreConfig,
    transactionRouteEditId,
  ]);

  return {
    txModalOpen,
    novaRecorrenciaModal,
    modalPreConfig,
    setModalPreConfig,
    openTxModal,
    closeTxModal,
  };
}
