import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSpendingByDay } from "../../../api/analytics";
import { previewTransactionImpact } from "../../../api/budgets";
import { handleApiError } from "../../../api/client";
import {
  mapUiPaymentMethodToApi,
  todayLocalYmd,
} from "../../data/transactionsAdapter.js";
import {
  buildImpactLineChartData,
  getCategoryRunRateProjectionMeta,
  monthBoundsFromYmd,
  parseApiDecimal,
  referenceDayInTxMonth,
} from "../../data/novaTransacaoImpactUtils.js";

/** Debounce só para alterações do valor monetário (digitação); abertura do painel e outras mudanças são imediatas. */
const VALOR_PREVIEW_DEBOUNCE_MS = 3000;

/**
 * Dados de impacto financeiro (preview + ritmo diário) para o modal Nova transação.
 *
 * @param {boolean} [props.impactPanelOpen=true] — Se false, não chama spending-by-day nem preview-transaction
 *   (ex.: secção «Impacto financeiro» recolhida no desktop ou colapsada na revisão mobile).
 */
export function useNovaTransacaoFinancialImpact({
  open,
  organizationId,
  dataMode,
  novaRecorrencia,
  recorre,
  impactPanelOpen = true,
  txDateYmd,
  categoryTagId,
  tipo,
  isRefund = false,
  valorNum,
  method,
  modalidade,
  parcelas,
  cartao,
}) {
  const live =
    Boolean(organizationId) &&
    dataMode === "live" &&
    !novaRecorrencia &&
    !recorre;

  const shouldFetchImpact = live && open && impactPanelOpen;

  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [spending, setSpending] = useState(null);
  const [spendingLoading, setSpendingLoading] = useState(false);
  const [spendingError, setSpendingError] = useState("");

  const previewDebounceRef = useRef(null);
  const impactPanelWasOpenRef = useRef(false);
  const lastPreviewCommitRef = useRef(null);

  const transactionType =
    tipo === "receita"
      ? "income"
      : tipo === "estorno" || tipo === "refund" || (tipo === "despesa" && isRefund)
        ? "refund"
        : "expense";

  useEffect(() => {
    let cancelled = false;
    if (!shouldFetchImpact || !organizationId || !txDateYmd) {
      setSpending(null);
      setSpendingError("");
      setSpendingLoading(false);
      return;
    }
    const bounds = monthBoundsFromYmd(txDateYmd);
    if (!bounds) return;

    setSpendingLoading(true);
    setSpendingError("");
    getSpendingByDay(organizationId, bounds.start, bounds.end, {
      tagId: categoryTagId || undefined,
      transactionType,
    })
      .then((res) => {
        if (!cancelled) setSpending(res);
      })
      .catch((e) => {
        if (!cancelled) {
          setSpending(null);
          setSpendingError(handleApiError(e));
        }
      })
      .finally(() => {
        if (!cancelled) setSpendingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [shouldFetchImpact, organizationId, txDateYmd, categoryTagId, transactionType]);

  const runPreview = useCallback(() => {
    if (!shouldFetchImpact || !organizationId) {
      setPreview(null);
      setPreviewError("");
      return;
    }
    if (!(valorNum > 0)) {
      setPreview(null);
      setPreviewError("");
      setPreviewLoading(false);
      return;
    }

    let installmentsCount = null;
    if (method === "credito" && modalidade === "parcelado" && parcelas > 1) {
      installmentsCount = parcelas;
    }
    const cardNum = Number(cartao);
    const cardId =
      method === "credito" && cartao && cartao !== "novo" && Number.isFinite(cardNum)
        ? cardNum
        : null;

    setPreviewLoading(true);
    setPreviewError("");
    previewTransactionImpact({
      organization_id: organizationId,
      type: transactionType,
      value: valorNum,
      tag_id: categoryTagId || null,
      date: txDateYmd,
      payment_method: mapUiPaymentMethodToApi(method),
      installments_count: installmentsCount,
      card_id: cardId,
    })
      .then((res) => {
        setPreview(res);
      })
      .catch((e) => {
        setPreview(null);
        setPreviewError(handleApiError(e));
      })
      .finally(() => {
        setPreviewLoading(false);
      });
  }, [
    shouldFetchImpact,
    organizationId,
    valorNum,
    categoryTagId,
    txDateYmd,
    transactionType,
    method,
    modalidade,
    parcelas,
    cartao,
  ]);

  useEffect(() => {
    if (!shouldFetchImpact || !organizationId) {
      impactPanelWasOpenRef.current = false;
      lastPreviewCommitRef.current = null;
      setPreview(null);
      setPreviewError("");
      setPreviewLoading(false);
      if (previewDebounceRef.current) {
        clearTimeout(previewDebounceRef.current);
        previewDebounceRef.current = null;
      }
      return;
    }

    const snapshot = () => ({
      valorNum,
      categoryTagId,
      txDateYmd,
      transactionType,
      method,
      modalidade,
      parcelas,
      cartao,
      organizationId,
    });

    const snap = snapshot();
    const panelJustOpened = shouldFetchImpact && !impactPanelWasOpenRef.current;
    impactPanelWasOpenRef.current = true;

    const commitSnapshot = () => {
      lastPreviewCommitRef.current = snap;
    };

    const runNow = () => {
      if (previewDebounceRef.current) {
        clearTimeout(previewDebounceRef.current);
        previewDebounceRef.current = null;
      }
      runPreview();
      commitSnapshot();
    };

    if (panelJustOpened) {
      runNow();
      return () => {
        if (previewDebounceRef.current) {
          clearTimeout(previewDebounceRef.current);
          previewDebounceRef.current = null;
        }
      };
    }

    const prev = lastPreviewCommitRef.current;
    if (!prev) {
      runNow();
      return () => {
        if (previewDebounceRef.current) {
          clearTimeout(previewDebounceRef.current);
          previewDebounceRef.current = null;
        }
      };
    }

    const othersEqual =
      prev.categoryTagId === snap.categoryTagId &&
      prev.txDateYmd === snap.txDateYmd &&
      prev.transactionType === snap.transactionType &&
      prev.method === snap.method &&
      prev.modalidade === snap.modalidade &&
      prev.parcelas === snap.parcelas &&
      prev.cartao === snap.cartao &&
      prev.organizationId === snap.organizationId;

    const onlyValorChanged =
      othersEqual && prev.valorNum !== snap.valorNum;

    if (onlyValorChanged) {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
      previewDebounceRef.current = setTimeout(() => {
        previewDebounceRef.current = null;
        runPreview();
        lastPreviewCommitRef.current = snapshot();
      }, VALOR_PREVIEW_DEBOUNCE_MS);
      return () => {
        if (previewDebounceRef.current) {
          clearTimeout(previewDebounceRef.current);
          previewDebounceRef.current = null;
        }
      };
    }

    runNow();

    return () => {
      if (previewDebounceRef.current) {
        clearTimeout(previewDebounceRef.current);
        previewDebounceRef.current = null;
      }
    };
  }, [
    shouldFetchImpact,
    organizationId,
    runPreview,
    valorNum,
    categoryTagId,
    txDateYmd,
    transactionType,
    method,
    modalidade,
    parcelas,
    cartao,
  ]);

  /** Metadados + valor da projeção fim de mês (categoria), para gráfico e texto explicativo no card. */
  const categoryProjectionMeta = useMemo(() => {
    if (tipo !== "despesa" || !preview?.category) return null;
    const spentAfter = parseApiDecimal(preview.category.spent_after);
    const spentBefore = parseApiDecimal(preview.category.spent_before);
    const bounds = monthBoundsFromYmd(txDateYmd);
    if (spentAfter == null || !bounds) return null;
    return getCategoryRunRateProjectionMeta(
      txDateYmd,
      todayLocalYmd(),
      bounds.dim,
      spentAfter,
      spentBefore,
    );
  }, [preview, tipo, txDateYmd]);

  const categoryProjectedEom = categoryProjectionMeta?.projectedEom ?? null;

  const chartData = useMemo(() => {
    if (!spending?.points) return [];
    return buildImpactLineChartData(spending.points, txDateYmd, categoryProjectedEom);
  }, [spending, txDateYmd, categoryProjectedEom]);

  const refLineDay = useMemo(
    () => referenceDayInTxMonth(txDateYmd, todayLocalYmd()),
    [txDateYmd],
  );

  const chartSlice = useMemo(() => {
    const bounds = monthBoundsFromYmd(txDateYmd);
    const dim = bounds?.dim ?? 31;
    const cap = Math.min(dim, 31);
    return chartData.slice(0, cap);
  }, [chartData, txDateYmd]);

  const showProjLine = useMemo(
    () => chartSlice.some((r) => r.proj != null && Number.isFinite(r.proj)),
    [chartSlice],
  );

  return {
    impactLive: live,
    preview,
    previewLoading,
    previewError,
    spendingLoading,
    spendingError,
    chartData: chartSlice,
    refLineDay,
    showProjLine,
    categoryProjectedEom,
    categoryProjectionMeta,
  };
}
