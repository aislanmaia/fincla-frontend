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

const PREVIEW_DEBOUNCE_MS = 380;

/**
 * Dados de impacto financeiro (preview + ritmo diário) para o modal Nova transação.
 */
export function useNovaTransacaoFinancialImpact({
  open,
  organizationId,
  dataMode,
  novaRecorrencia,
  recorre,
  txDateYmd,
  categoryTagId,
  tipo,
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

  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [spending, setSpending] = useState(null);
  const [spendingLoading, setSpendingLoading] = useState(false);
  const [spendingError, setSpendingError] = useState("");

  const debounceRef = useRef(null);

  const transactionType = tipo === "receita" ? "income" : "expense";

  useEffect(() => {
    if (!live || !open || !organizationId || !txDateYmd) {
      setSpending(null);
      setSpendingError("");
      setSpendingLoading(false);
      return;
    }
    const bounds = monthBoundsFromYmd(txDateYmd);
    if (!bounds) return;

    let cancelled = false;
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
  }, [live, open, organizationId, txDateYmd, categoryTagId, transactionType]);

  const runPreview = useCallback(() => {
    if (!live || !open || !organizationId) {
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
    live,
    open,
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
    if (!live || !open) {
      setPreview(null);
      setPreviewError("");
      setPreviewLoading(false);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      runPreview();
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [live, open, runPreview]);

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
