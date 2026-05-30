import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  AlertTriangle, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  CreditCard, Plus, Repeat, RotateCcw, Search, Star, X, Zap,
} from "lucide-react";
import { flushSync } from "react-dom";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Btn } from "../../components/primitives";
import { CategoryLucideIcon } from "../../components/CategoryLucideIcon.jsx";
import { LocaleDatePicker } from "../../components/LocaleDatePicker.jsx";
import { NovaTransacaoImpactPanel } from "../../components/NovaTransacaoImpactPanel.jsx";
import { APP_UI_LOCALE } from "../../appLocale.js";

import { useCategoryTagsData } from "../tags/useCategoryTagsData.js";
import { useNovaTransacaoDetailTags } from "../tags/useNovaTransacaoDetailTags.js";
import { useNovaTransacaoFinancialImpact } from "./useNovaTransacaoFinancialImpact.js";
import {
  useNovaTransacaoPeriodSaldo,
  projectedBalanceAfterTx,
  fmtSaldoLine,
  clearNovaTransacaoSummaryCache,
} from "./useNovaTransacaoPeriodSaldo.js";
import { ParcelaHybrid } from "./ParcelaHybrid.jsx";

import {
  parseApiDecimal,
  fmtBrl,
  formatProjectionCardExplain,
} from "../../data/novaTransacaoImpactUtils.js";
import {
  buildCreateTransactionPayload,
  buildUpdateTransactionPayload,
  createTransactionForUi,
  fetchRefundCandidates,
  formatTransactionsApiError,
  formatYmdToLocaleDisplay,
  clampNovaTxPrefsParcelas,
  initialNovaTransacaoDateYmd,
  isUuidString,
  normalizeStoredNovaTxPaymentMethod,
  readStoredNovaTransacaoPrefs,
  serializeNovaTxFormStateToStoredPrefs,
  shouldApplyStoredNovaTxCategoryPrefs,
  todayLocalYmd,
  transactionDateIsoFromYmd,
  updateTransactionForUi,
  writeStoredNovaTransacaoDate,
  writeStoredNovaTransacaoPrefs,
} from "../../data/transactionsAdapter.js";
import {
  buildCreateRecurringSeriesPayload,
  buildUpdateRecurringSeriesPayload,
  createRecurringSeriesForUi,
  formatRecurringTransactionsApiError,
  updateRecurringSeriesForUi,
} from "../../data/recurringTransactionsAdapter.js";
import {
  computeEndDateFromOccurrences as computeEndDateFromOccurrencesMath,
  computeFirstOccurrence as computeFirstOccurrenceMath,
} from "../../data/recurrenceDateMath.js";
import { listCreditCards } from "../../../api/creditCards";
import {
  formatCreditCardsApiError,
  mapCreditCardToModalPickerRow,
} from "../../data/creditCardsAdapter.js";

/* ─── NOVA TRANSAÇÃO DRAWER ─────────────────────────────── */

const MOCK_CARTOES_MODAL = [
  { id: "nubank", banco: "NUBANK", nome: "Nu Roxinho", dig: "1177", disp: 2400, novo: false },
  { id: "itau", banco: "ITAÚ", nome: "Personnalité", dig: "0034", disp: 8000, novo: false },
  { id: "inter", banco: "INTER", nome: "Mastercard", dig: "5521", disp: 1200, novo: false },
  { id: "novo", banco: "", nome: "+ Novo cartão", dig: "", disp: 0, novo: true },
];

/**
 * Carimbo estável do `preConfig` para o modal reaplicar o preenchimento quando o pai
 * atualiza (hidratação da URL, editar com `flushSync` + `navigate`, etc.), sem
 * reexecutar a cada render com o mesmo conteúdo.
 */
function novaTxDetailDisplayStamp(detailTagDisplayById) {
  if (!detailTagDisplayById || typeof detailTagDisplayById !== "object") return "";
  return Object.keys(detailTagDisplayById)
    .sort()
    .map((k) => `${k}=${detailTagDisplayById[k]}`)
    .join(";");
}

function novaTxModalInitStamp(organizationId, novaRecorrencia, preConfig) {
  const oid = organizationId ?? "";
  if (novaRecorrencia) {
    const pc = preConfig;
    return `${oid}|nr|${pc?.recId ?? ""}|${pc?.isEditRecorrencia ? "1" : "0"}|${pc?.tipo ?? ""}|${String(pc?.valorInicial ?? "")}|${pc?.desc ?? ""}|${pc?.freqRec ?? ""}`;
  }
  const pc = preConfig;
  if (pc == null) return `${oid}|empty`;
  const eid =
    pc.editingTransactionId != null && String(pc.editingTransactionId) !== ""
      ? String(pc.editingTransactionId)
      : "";
  return [
    oid,
    "tx",
    eid,
    pc.desc ?? "",
    String(pc.valorInicial ?? ""),
    pc.cat ?? "",
    String(pc.categoryTagId ?? ""),
    pc.method ?? "",
    String(pc.cartaoId ?? ""),
    pc.dateIso ?? "",
    pc.dateIsoForEdit ?? "",
    pc.recorre ? "1" : "0",
    pc.modalidade ?? "",
    String(pc.parcelas ?? ""),
    Array.isArray(pc.tags) ? JSON.stringify(pc.tags) : "",
    Array.isArray(pc.detailTagIds) ? pc.detailTagIds.join(",") : "",
    novaTxDetailDisplayStamp(pc.detailTagDisplayById),
    pc.novaRecorrencia ? "1" : "0",
  ].join("|");
}

const NOVA_TX_QUICK_DETAIL_LABELS = ["semanal", "família"];

export const NovaTransacaoModal = ({
  open,
  onClose,
  onTransactionSaved,
  novaRecorrencia = false,
  preConfig = null,
  isMobile = false,
  organizationId = null,
  dataMode = "live",
}) => {
  const [tipo,      setTipo]      = useState("despesa");
  // Toggle "↺ Isto é um estorno?" — só ativável quando tipo === "despesa".
  // Quando true, o payload enviado ao backend usa type='refund' (dinheiro voltando).
  const [isEstorno, setIsEstorno] = useState(false);
  // Picker de "🔗 Linkar à compra estornada" — FK opcional pra UI mostrar relação e backend agregar.
  const [refundOfTransactionId, setRefundOfTransactionId] = useState(null);
  const [refundLinkedTx, setRefundLinkedTx] = useState(null); // { id, desc, dateLabel, valLabel, val, categoryTagId, cat, paymentMethodKey, cardId }
  const [refundPickerOpen, setRefundPickerOpen] = useState(false);
  const [refundPickerQuery, setRefundPickerQuery] = useState("");
  const [refundPickerCandidates, setRefundPickerCandidates] = useState([]);
  const [refundPickerLoading, setRefundPickerLoading] = useState(false);
  const [valor,     setValor]     = useState("");
  const [desc,      setDesc]      = useState("");
  const [cat,       setCat]       = useState("");
  const [tags,      setTags]      = useState([]);
  /** Em modo live: UUIDs de tags API tipo `detalhe` (além da categoria). */
  const [detailTagIds, setDetailTagIds] = useState([]);
  /** Rótulos vindos do GET da transação (id → nome), para chips sem depender só de GET /tags?tag_type=detalhe. */
  const [detailTagLabelById, setDetailTagLabelById] = useState({});
  const [newTag,    setNewTag]    = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [method,    setMethod]    = useState("pix");
  const [parcelas,  setParcelas]  = useState(3);
  const [recorre,   setRecorre]   = useState(false);
  const [panelCartaoOpen, setPanelCartaoOpen] = useState(false);
  const [panelCartaoExiting, setPanelCartaoExiting] = useState(false);
  const [panelRecorrenciaOpen, setPanelRecorrenciaOpen] = useState(false);
  const [panelRecorrenciaExiting, setPanelRecorrenciaExiting] = useState(false);
  const [cartao,    setCartao]    = useState("");
  const [txDateYmd, setTxDateYmd]  = useState(() => todayLocalYmd());
  const [modalidade,setMod]       = useState("parcelado");
  const [freqRec,   setFreqRec]   = useState(preConfig?.freqRec || "mensal");
  const [encRec,    setEncRec]    = useState(preConfig?.encRec || "sem-fim");
  const [valorTipoRec, setValorTipoRec] = useState(preConfig?.valorTipoRec || "fixo");
  // Painel Recorrência — campos novos
  const [selectedDayOfWeek,    setSelectedDayOfWeek]    = useState(preConfig?.selectedDayOfWeek ?? null);
  const [selectedDayOfMonth,   setSelectedDayOfMonth]   = useState(preConfig?.selectedDayOfMonth ?? null);
  const [customIntervalRec, setCustomIntervalRec] = useState(preConfig?.customIntervalRec ?? 1);
  const [customUnitRec,     setCustomUnitRec]     = useState(preConfig?.customUnitRec || "month");
  const [firstOccurrenceYmd,    setFirstOccurrenceYmd]    = useState(preConfig?.firstOccurrenceYmd || null);
  /**
   * Mensagem efêmera mostrada abaixo do datepicker quando a 1ª ocorrência é ajustada
   * automaticamente por mudança de dia-da-semana / dia-do-mês. Limpa em ~3s.
   */
  const [firstOccurrenceAutoAdjustNote, setFirstOccurrenceAutoAdjustNote] = useState(null);
  const [encRepetitionsRec, setEncRepetitionsRec] = useState(preConfig?.encRepetitionsRec ?? 12);
  const [encEndDateYmdRec,  setEncEndDateYmdRec]  = useState(preConfig?.encEndDateYmdRec || preConfig?.dataFimRec || null);
  const [showImpact,setShowImpact]= useState(false);
  /** Revisão mobile: acordeão «Impacto financeiro» (controlado no pai para não ir à API até expandir). */
  const [mobileReviewImpactOpen, setMobileReviewImpactOpen] = useState(false);
  const [review,    setReview]    = useState(false);
  const [reviewDir, setReviewDir] = useState("forward");
  const [success,        setSuccess]        = useState(false);
  const [successOverlay, setSuccessOverlay] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const closeAnimGuardRef = useRef(false);
  const DRAWER_CLOSE_MS = 320;
  const SIDE_PANEL_MS = 320;
  const beginCloseCartaoPanel = useCallback(() => {
    if (!(panelCartaoOpen || panelCartaoExiting)) return;
    setPanelCartaoOpen(false);
    setPanelCartaoExiting(true);
  }, [panelCartaoOpen, panelCartaoExiting]);
  const beginCloseRecorrenciaPanel = useCallback(() => {
    if (!(panelRecorrenciaOpen || panelRecorrenciaExiting)) return;
    setPanelRecorrenciaOpen(false);
    setPanelRecorrenciaExiting(true);
  }, [panelRecorrenciaOpen, panelRecorrenciaExiting]);
  const beginClose = useCallback(() => {
    if (closeAnimGuardRef.current) return;
    closeAnimGuardRef.current = true;
    setDrawerClosing(true);
    window.setTimeout(() => {
      closeAnimGuardRef.current = false;
      setDrawerClosing(false);
      onClose();
    }, DRAWER_CLOSE_MS);
  }, [onClose]);
  useEffect(() => {
    if (open) {
      closeAnimGuardRef.current = false;
      setDrawerClosing(false);
    }
  }, [open]);
  // Mobile step state
  const [mStep,     setMStep]     = useState(1);
  const [mStepAnimating, setMStepAnimating] = useState(false);
  const mStepAnimTimerRef = useRef(null);
  useEffect(() => {
    if (open) return;
    if (mStepAnimTimerRef.current) {
      clearTimeout(mStepAnimTimerRef.current);
      mStepAnimTimerRef.current = null;
    }
    setMStepAnimating(false);
  }, [open]);
  // AI suggestion simulation
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiApplied,    setAiApplied]    = useState(false);
  const [descFocused,  setDescFocused]  = useState(false);
  const [descError,    setDescError]    = useState(false);
  const valorInputRef = useRef(null);
  const descRef       = useRef(null);
  // Banking-style valor input (integer cents)
  const [centavos,      setCentavos]     = useState(0);
  // Parcela calculator
  const [parcelaMode,   setParcelaMode]  = useState(false);
  const [pCalcCents,    setPCalcCents]   = useState(0);
  const [pCalcN,        setPCalcN]       = useState(2);
  const [pCalcCustom,   setPCalcCustom]  = useState(false); // show custom input in calc
  const [pCalcCustomInput, setPCalcCustomInput] = useState(""); // raw text while user types
  const [parcelasCustom,setParcelasCustom]= useState(false); // show custom input in panel
  const [parcelasInput, setParcelasInput] = useState("");    // raw input for custom parcelas
  // Quick-add card inline
  const [addingCartao,  setAddingCartao] = useState(false);
  const [quickAddCardName, setQuickAddCardName] = useState("");
  const [quickAddCardLast4, setQuickAddCardLast4] = useState("");

  const [categoryTagId, setCategoryTagId] = useState(null);
  const [txSubmitError, setTxSubmitError] = useState("");
  const [txSubmitting, setTxSubmitting] = useState(false);
  const [modalCardsRows, setModalCardsRows] = useState([]);
  const [modalCardsLoading, setModalCardsLoading] = useState(false);
  const [modalCardsError, setModalCardsError] = useState("");
  const appliedModalInitStampRef = useRef(null);

  const useLiveCategoryTags = Boolean(organizationId && dataMode === "live");
  const categoryTagsData = useCategoryTagsData({
    organizationId,
    enabled: open && useLiveCategoryTags,
  });

  const useLiveDetailTags = Boolean(
    organizationId && dataMode === "live" && useLiveCategoryTags,
  );
  const {
    findByLabel,
    ensureDetailTag,
    labelForDetailId,
    detailTagRowsForCategory,
    error: detailTagsError,
  } = useNovaTransacaoDetailTags({
    organizationId,
    categoryTagId,
    enabled: open && useLiveDetailTags,
  });

  const detailTagRowsAvailable = useMemo(() => {
    if (!useLiveDetailTags || !categoryTagId) return [];
    const sel = new Set(detailTagIds.map((id) => String(id)));
    return [...detailTagRowsForCategory]
      .filter((row) => row?.id && !sel.has(String(row.id)))
      .sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), "pt-BR", {
          sensitivity: "base",
        }),
      );
  }, [useLiveDetailTags, categoryTagId, detailTagRowsForCategory, detailTagIds]);

  const addDetailTagByRow = useCallback((row) => {
    if (!row?.id) return;
    const id = String(row.id);
    const name = row.name != null && String(row.name).trim() ? String(row.name).trim() : "";
    setDetailTagIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    if (name) setDetailTagLabelById((prev) => ({ ...prev, [id]: name }));
  }, []);

  const detailChipLabel = useCallback(
    (id) => {
      const sid = String(id);
      return detailTagLabelById[sid] || labelForDetailId(sid);
    },
    [detailTagLabelById, labelForDetailId],
  );

  const addQuickDetailTag = useCallback(
    async (label) => {
      const trimmed = String(label || "").trim();
      if (!trimmed) return;
      if (!useLiveDetailTags) {
        setTags((tg) => (tg.includes(trimmed) ? tg : [...tg, trimmed]));
        return;
      }
      setTxSubmitError("");
      try {
        const id = await ensureDetailTag(trimmed);
        setDetailTagLabelById((prev) => ({ ...prev, [String(id)]: trimmed }));
        setDetailTagIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      } catch (err) {
        setTxSubmitError(
          typeof err?.message === "string"
            ? err.message
            : "Não foi possível adicionar a tag",
        );
      }
    },
    [useLiveDetailTags, ensureDetailTag],
  );

  useEffect(() => {
    if (!open) {
      appliedModalInitStampRef.current = null;
      return;
    }
    const stamp = novaTxModalInitStamp(organizationId, novaRecorrencia, preConfig);
    if (appliedModalInitStampRef.current === stamp) return;
    appliedModalInitStampRef.current = stamp;

    const pc = preConfig;
    const nr = novaRecorrencia;

    setTxSubmitError("");
    setTxSubmitting(false);
    setCategoryTagId(null);
    setMStep(1);
    setReview(false);
    setSuccess(false);
    setSuccessOverlay(false);
    setPanelCartaoExiting(false);
    setPanelRecorrenciaExiting(false);
    setShowImpact(false);
    setMobileReviewImpactOpen(false);
    setAiSuggestion(null);
    setAiApplied(false);
    setDescFocused(false);
    setAddingCartao(false);
    setQuickAddCardName("");
    setQuickAddCardLast4("");
    setNewTag("");
    setAddingTag(false);
    setDetailTagIds([]);
    setDetailTagLabelById({});
    setParcelaMode(false);
    setPCalcCents(0);
    setPCalcN(2);
    setPCalcCustom(false);
    setPCalcCustomInput("");
    setParcelasCustom(false);
    setParcelasInput("");
    setParcelas(3);
    setMod("parcelado");

    const applyValor = (v) => {
      if (v != null && v !== "") {
        const cents = Math.round(Number(v) * 100);
        if (Number.isFinite(cents)) {
          setCentavos(cents);
          setValor(cents === 0 ? "" : (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
          return;
        }
      }
      setCentavos(0);
      setValor("");
    };

    if (nr) {
      setTipo(pc?.tipo || "despesa");
      applyValor(pc?.valorInicial);
      setDesc(pc?.desc || "");
      setTags([]);
      setDetailTagIds([]);
      setDetailTagLabelById({});
      setMethod("debito");
      setPanelCartaoOpen(false);
      setPanelCartaoExiting(false);
      setPanelRecorrenciaOpen(true);
      setPanelRecorrenciaExiting(false);
      setRecorre(true);
      setCartao("");
      setFreqRec(pc?.freqRec || "mensal");
      setEncRec(pc?.encRec || "sem-fim");
      setValorTipoRec(pc?.valorTipoRec || "fixo");
      setSelectedDayOfWeek(pc?.selectedDayOfWeek ?? null);
      setSelectedDayOfMonth(pc?.selectedDayOfMonth ?? null);
      setCustomIntervalRec(pc?.customIntervalRec ?? 1);
      setCustomUnitRec(pc?.customUnitRec || "month");
      setFirstOccurrenceYmd(pc?.firstOccurrenceYmd || null);
      setEncRepetitionsRec(pc?.encRepetitionsRec ?? 12);
      setEncEndDateYmdRec(pc?.encEndDateYmdRec || pc?.dataFimRec || null);
      setCat(pc?.cat || "");
      setTxDateYmd(initialNovaTransacaoDateYmd(organizationId, pc));
      return;
    }

    if (pc) {
      setTipo(pc.tipo || "despesa");
      setIsEstorno(Boolean(pc.isEstorno));
      setRefundOfTransactionId(pc.refundOfTransactionId ?? null);
      setRefundLinkedTx(pc.refundLinkedTx ?? null);
      setRefundPickerOpen(false);
      setRefundPickerQuery("");
      setRefundPickerCandidates([]);
      applyValor(pc.valorInicial);
      setDesc(pc.desc || "");
      setTags(Array.isArray(pc.tags) ? pc.tags : []);
      setDetailTagIds(
        Array.isArray(pc.detailTagIds)
          ? pc.detailTagIds.map((id) => String(id))
          : [],
      );
      setDetailTagLabelById(
        pc.detailTagDisplayById && typeof pc.detailTagDisplayById === "object"
          ? { ...pc.detailTagDisplayById }
          : {},
      );
      const editingTx =
        pc.editingTransactionId != null &&
        String(pc.editingTransactionId).trim() !== "";
      const prefsMerge = editingTx ? null : readStoredNovaTransacaoPrefs(organizationId);
      const m = pc.method || "pix";
      setMethod(typeof m === "string" ? m : "pix");
      setRecorre(!!pc.recorre);
      setFreqRec(pc.freqRec || "mensal");
      setEncRec(pc.encRec || "sem-fim");
      setValorTipoRec(pc.valorTipoRec || "fixo");
      setSelectedDayOfWeek(pc?.selectedDayOfWeek ?? null);
      setSelectedDayOfMonth(pc?.selectedDayOfMonth ?? null);
      setCustomIntervalRec(pc?.customIntervalRec ?? 1);
      setCustomUnitRec(pc?.customUnitRec || "month");
      setFirstOccurrenceYmd(pc?.firstOccurrenceYmd || null);
      setEncRepetitionsRec(pc?.encRepetitionsRec ?? 12);
      setEncEndDateYmdRec(pc?.encEndDateYmdRec || pc?.dataFimRec || null);
      const explicitPcCat =
        pc.cat != null && String(pc.cat).trim() !== "";
      const explicitPcCatId =
        pc.categoryTagId != null &&
        isUuidString(String(pc.categoryTagId));

      let mergedCat = "";
      if (editingTx) {
        mergedCat = pc.cat || "";
      } else if (explicitPcCat) {
        mergedCat = String(pc.cat).trim();
      } else if (prefsMerge?.cat != null) {
        const s = String(prefsMerge.cat).trim();
        if (s) mergedCat = s;
      }

      let mergedCatId = null;
      if (editingTx) {
        mergedCatId = pc.categoryTagId ?? null;
      } else if (explicitPcCatId) {
        mergedCatId = pc.categoryTagId;
      } else {
        const prefId = prefsMerge?.categoryTagId;
        if (prefId != null && isUuidString(String(prefId))) {
          mergedCatId = prefId;
        }
      }

      setCat(mergedCat);
      setCategoryTagId(mergedCatId);

      if (pc.modalidade) {
        setMod(pc.modalidade);
      } else if (m === "credito" && prefsMerge) {
        const isAvista = prefsMerge.modalidade === "avista";
        setMod(isAvista ? "avista" : "parcelado");
      }

      if (pc.parcelas) {
        setParcelas(pc.parcelas);
      } else if (m === "credito" && prefsMerge) {
        const pp = clampNovaTxPrefsParcelas(prefsMerge.parcelas);
        if (pp != null) setParcelas(pp);
      }
      if (m === "credito") {
        setPanelCartaoOpen(true);
        setPanelCartaoExiting(false);
        setPanelRecorrenciaOpen(!!pc.recorre);
        setPanelRecorrenciaExiting(false);
        setCartao(pc.cartaoId != null ? String(pc.cartaoId) : "");
      } else {
        setPanelCartaoOpen(false);
        setPanelCartaoExiting(false);
        setPanelRecorrenciaOpen(!!pc.recorre);
        setPanelRecorrenciaExiting(false);
        setCartao("");
      }
      setTxDateYmd(initialNovaTransacaoDateYmd(organizationId, pc));
      return;
    }

    const prefs = readStoredNovaTransacaoPrefs(organizationId);
    const prefTipo = prefs.tipo === "receita" ? "receita" : "despesa";
    setTipo(prefTipo);
    applyValor(null);
    setDesc("");
    setTags([]);
    setDetailTagIds([]);
    setDetailTagLabelById({});
    const prefMethod =
      normalizeStoredNovaTxPaymentMethod(prefs.method, prefTipo) ?? "pix";
    setMethod(prefMethod);
    setPanelCartaoOpen(prefMethod === "credito");
    setPanelCartaoExiting(false);
    setPanelRecorrenciaOpen(false);
    setPanelRecorrenciaExiting(false);
    setRecorre(false);
    setCartao(
      prefMethod === "credito" && prefs.cartaoId != null
        ? String(prefs.cartaoId)
        : "",
    );
    setFreqRec("mensal");
    setEncRec("sem-fim");
    setValorTipoRec("fixo");
    setSelectedDayOfWeek(null);
    setSelectedDayOfMonth(null);
    setCustomIntervalRec(1);
    setCustomUnitRec("month");
    setFirstOccurrenceYmd(null);
    setEncRepetitionsRec(12);
    setEncEndDateYmdRec(null);
    setCat(
      prefs.cat != null && String(prefs.cat).trim()
        ? String(prefs.cat).trim()
        : "",
    );
    if (prefMethod === "credito") {
      setMod(prefs.modalidade === "avista" ? "avista" : "parcelado");
      const pp = clampNovaTxPrefsParcelas(prefs.parcelas);
      if (pp != null) setParcelas(pp);
    }
    setTxDateYmd(initialNovaTransacaoDateYmd(organizationId, null));
  }, [open, novaRecorrencia, preConfig, organizationId]);

  useEffect(() => {
    if (!open) {
      setModalCardsRows([]);
      setModalCardsLoading(false);
      setModalCardsError("");
      return;
    }
    if (!organizationId || dataMode !== "live") return;

    let cancelled = false;
    setModalCardsLoading(true);
    setModalCardsError("");
    listCreditCards(organizationId)
      .then((cards) => {
        if (cancelled) return;
        setModalCardsRows(cards.map(mapCreditCardToModalPickerRow));
        setModalCardsLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setModalCardsError(formatCreditCardsApiError(e));
        setModalCardsRows([]);
        setModalCardsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, organizationId, dataMode]);

  const cartoes = useMemo(() => {
    if (organizationId && dataMode === "live") {
      const rows = [...modalCardsRows];
      rows.push({
        id: "novo",
        banco: "",
        nome: "+ Novo cartão",
        dig: "",
        disp: 0,
        novo: true,
      });
      return rows;
    }
    return MOCK_CARTOES_MODAL;
  }, [organizationId, dataMode, modalCardsRows]);

  useEffect(() => {
    if (!open) return;
    if (!(organizationId && dataMode === "live")) return;
    if (modalCardsLoading) return;
    if (method !== "credito") return;
    const realIds = modalCardsRows.map((r) => String(r.id));
    if (realIds.length === 0) return;
    const want =
      preConfig?.cartaoId != null && String(preConfig.cartaoId)
        ? String(preConfig.cartaoId)
        : null;
    if (want && realIds.includes(want)) {
      if (cartao !== want) setCartao(want);
      return;
    }
    if (cartao && cartao !== "novo" && realIds.includes(String(cartao))) return;
    setCartao(String(realIds[0]));
  }, [
    open,
    organizationId,
    dataMode,
    modalCardsLoading,
    modalCardsRows,
    method,
    preConfig?.cartaoId,
    cartao,
  ]);

  const modalCategoryChoices = useMemo(() => {
    const FALLBACK = [
      "Alimentação", "Moradia", "Transporte", "Saúde", "Lazer", "Educação", "Vestuário", "Assinaturas", "Outros", "Receita",
    ].map((labelPt) => ({
      id: null,
      labelPt,
      iconKey: labelPt === "Receita" ? "wallet" : null,
    }));
    if (useLiveCategoryTags && categoryTagsData.categories.length > 0) {
      return categoryTagsData.categories.map((c) => ({
        id: c.id,
        labelPt: c.labelPt,
        iconKey: c.iconKey,
      }));
    }
    return FALLBACK;
  }, [useLiveCategoryTags, categoryTagsData.categories]);

  useEffect(() => {
    if (!open) return;
    setTxSubmitError("");
    if (!useLiveCategoryTags) {
      setCategoryTagId(null);
      return;
    }
    const rows = categoryTagsData.categories;
    if (!rows.length) return;
    const prefs = shouldApplyStoredNovaTxCategoryPrefs(preConfig)
      ? readStoredNovaTransacaoPrefs(organizationId)
      : null;
    const matchById =
      preConfig?.categoryTagId && isUuidString(preConfig.categoryTagId)
        ? rows.find((c) => c.id === preConfig.categoryTagId)
        : prefs?.categoryTagId && isUuidString(prefs.categoryTagId)
          ? rows.find((c) => c.id === prefs.categoryTagId)
          : null;
    const match =
      preConfig?.cat
        ? rows.find((c) => c.labelPt === preConfig.cat)
        : prefs?.cat
          ? rows.find((c) => c.labelPt === prefs.cat)
          : null;
    const row = matchById ?? match ?? rows[0];
    setCategoryTagId(row.id);
    setCat(row.labelPt);
  }, [
    open,
    useLiveCategoryTags,
    categoryTagsData.categories,
    organizationId,
    preConfig,
    preConfig?.cat,
    preConfig?.categoryTagId,
  ]);

  const skipPersistNovaTxPrefs =
    novaRecorrencia ||
    (preConfig?.editingTransactionId != null &&
      String(preConfig.editingTransactionId).trim() !== "");

  useEffect(() => {
    if (!open || skipPersistNovaTxPrefs) return;
    writeStoredNovaTransacaoPrefs(
      organizationId,
      serializeNovaTxFormStateToStoredPrefs({
        tipo,
        method,
        cat,
        categoryTagId,
        modalidade,
        parcelas,
        cartao,
      }),
    );
  }, [
    open,
    skipPersistNovaTxPrefs,
    organizationId,
    tipo,
    method,
    cat,
    categoryTagId,
    modalidade,
    parcelas,
    cartao,
  ]);

  // Global key capture: digits typed anywhere → Valor field
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      // O campo Valor já trata teclas em onKeyDown; se duplicar com este listener, cada dígito entra 2×.
      if (document.activeElement === valorInputRef.current) return;

      // Skip if any input/textarea/select is focused (except our valor field)
      const tag = document.activeElement?.tagName;
      const isOtherInput = (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") &&
                           document.activeElement !== valorInputRef.current;
      if (isOtherInput || descFocused) return;
      // Skip modifier keys and non-digit keys
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= "0" && e.key <= "9") {
        // Focus valor input first, then process
        valorInputRef.current?.focus();
        e.preventDefault();
        const next = Math.min(centavos * 10 + parseInt(e.key), 9999999);
        setCentavos(next);
        setValor(next === 0 ? "" : (next / 100).toLocaleString("pt-BR", { minimumFractionDigits:2 }));
        if (parcelaMode) setParcelaMode(false);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        if (document.activeElement === valorInputRef.current) return; // handled by onKeyDown
        valorInputRef.current?.focus();
        e.preventDefault();
        if (e.key === "Delete") { setCentavos(0); setValor(""); }
        else { const n = Math.floor(centavos / 10); setCentavos(n); setValor(n===0?"": (n/100).toLocaleString("pt-BR",{minimumFractionDigits:2})); }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, centavos, descFocused, parcelaMode]);

  const valorFieldHasSelection = (el) =>
    el &&
    typeof el.selectionStart === "number" &&
    typeof el.selectionEnd === "number" &&
    el.selectionStart !== el.selectionEnd;

  // Banking-style input handler (digit-shift preserves decimal)
  const handleValorKey = (e) => {
    const el = e.currentTarget;
    const replacing = valorFieldHasSelection(el);

    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      e.stopPropagation();
      const base = replacing ? 0 : centavos;
      const next = Math.min(base * 10 + parseInt(e.key, 10), 9999999);
      setCentavos(next);
      setValor(
        next === 0
          ? ""
          : (next / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      );
      if (parcelaMode) setParcelaMode(false);
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Delete" || replacing) {
        setCentavos(0);
        setValor("");
      } else {
        const next = Math.floor(centavos / 10);
        setCentavos(next);
        setValor(
          next === 0
            ? ""
            : (next / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        );
      }
    }
  };
  const handlePCalcKey = (e) => {
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      setPCalcCents(prev => Math.min(prev * 10 + parseInt(e.key), 9999999));
    } else if (e.key === "Backspace") {
      e.preventDefault();
      setPCalcCents(prev => Math.floor(prev / 10));
    } else if (e.key === "Delete") {
      e.preventDefault();
      setPCalcCents(0);
    }
  };
  const applyParcelaCalc = () => {
    const total = pCalcCents * pCalcN;
    setCentavos(total);
    setValor(total === 0 ? "" : (total / 100).toLocaleString("pt-BR", { minimumFractionDigits:2 }));
    setMethod("credito"); setPanelCartaoOpen(true); setPanelCartaoExiting(false); setMod("parcelado"); setParcelas(pCalcN);
    setParcelaMode(false); setPCalcCents(0);
  };
  const valorNum   = centavos / 100;

  const periodSaldo = useNovaTransacaoPeriodSaldo({
    open,
    organizationId,
    dataMode,
    txDateYmd,
  });
  const saldoAposLancamento = projectedBalanceAfterTx(
    periodSaldo.periodBalance,
    tipo,
    valorNum,
  );

  const impactPanelOpen = useMemo(() => {
    if (!open) return false;
    if (isMobile) return mStep === "review" && mobileReviewImpactOpen;
    if (review) {
      return true;
    }
    return showImpact;
  }, [open, isMobile, mStep, mobileReviewImpactOpen, review, showImpact]);

  const financialImpact = useNovaTransacaoFinancialImpact({
    open,
    organizationId,
    dataMode,
    novaRecorrencia,
    recorre,
    impactPanelOpen,
    txDateYmd,
    categoryTagId,
    tipo,
    valorNum,
    method,
    modalidade,
    parcelas,
    cartao,
  });

  const impactKpis = useMemo(() => {
    const empty = {
      afterVal: "—",
      afterSub: "—",
      projVal: "—",
      projSub: "—",
      projExplain: "",
      marginVal: "—",
      marginSub: "até o limite total",
      displayCat: null,
      catIconKey: null,
      catBefore: null,
      catAfter: null,
      catLimit: null,
      catPct: 0,
      catHasBudget: false,
      catOverBudget: false,
    };
    const p = financialImpact.preview;
    if (!p) return empty;

    const c = p.category;
    const hasBudget =
      c.budget_amount != null && String(c.budget_amount).trim() !== "";

    const after = parseApiDecimal(c.spent_after);
    const pctAfter = c.usage_percent_after;
    const margin = hasBudget
      ? parseApiDecimal(c.remaining_after)
      : parseApiDecimal(p.budgets_summary.total_remaining_after);

    const spentBefore = parseApiDecimal(c.spent_before);
    const spentAfter = parseApiDecimal(c.spent_after);
    const budgetAmt = parseApiDecimal(c.budget_amount);
    const usageAfter = c.usage_percent_after;

    const projMeta = financialImpact.categoryProjectionMeta;
    const projEom = projMeta?.projectedEom ?? null;
    const projInsufficient =
      tipo === "despesa" && projMeta?.projectionKind === "insufficient_history";

    const catRowForImpact =
      categoryTagId != null && String(categoryTagId).length > 0
        ? modalCategoryChoices.find(
            (r) => r.id != null && String(r.id) === String(categoryTagId),
          )
        : modalCategoryChoices.find((r) => r.labelPt === cat);
    const displayCatResolved =
      catRowForImpact?.labelPt ?? (cat ? cat : null) ?? c.tag_name ?? null;
    const catIconKeyResolved = catRowForImpact?.iconKey ?? null;

    return {
      afterVal: fmtBrl(after),
      afterSub:
        pctAfter != null && Number.isFinite(pctAfter)
          ? `${Math.round(pctAfter)}% do orçamento desta categoria`
          : "—",
      projVal:
        tipo === "despesa" && projInsufficient
          ? "—"
          : tipo === "despesa" && projEom != null && Number.isFinite(projEom)
            ? fmtBrl(projEom)
            : "—",
      projSub:
        tipo === "receita"
          ? "Não aplicável à receita"
          : projInsufficient
            ? "Precisa de gasto real antes no mês"
            : projEom != null && Number.isFinite(projEom)
              ? "Tendência se o ritmo continuar"
              : "Sem dados para estimar o ritmo",
      projExplain:
        tipo === "despesa" && projMeta && projMeta.projectionKind !== "insufficient_history"
          ? formatProjectionCardExplain(projMeta)
          : "",
      marginVal: fmtBrl(margin),
      marginSub:
        margin != null && margin < 0
          ? "Acima do orçamento desta categoria"
          : hasBudget
            ? "restante nesta categoria"
            : "restante (visão geral)",
      displayCat: displayCatResolved,
      catIconKey: catIconKeyResolved,
      catBefore: spentBefore,
      catAfter: spentAfter,
      catLimit: budgetAmt,
      catPct: usageAfter ?? 0,
      catHasBudget: hasBudget,
      catOverBudget: (usageAfter ?? 0) >= 100,
    };
  }, [
    financialImpact.preview,
    financialImpact.categoryProjectionMeta,
    tipo,
    categoryTagId,
    cat,
    modalCategoryChoices,
  ]);

  const impactMobileSummary = useMemo(() => {
    if (!financialImpact.impactLive) return "Preview indisponível";
    if (!(valorNum > 0)) return "Informe um valor";
    if (isMobile && mStep === "review" && !mobileReviewImpactOpen) return "Toque para ver o impacto";
    if (financialImpact.previewLoading) return "Calculando…";
    const p = financialImpact.preview;
    if (!p) return "—";
    const c = p.category;
    const after = parseApiDecimal(c.spent_after);
    const pct = c.usage_percent_after;
    if (after == null) return "—";
    const pctStr =
      pct != null && Number.isFinite(pct) ? ` · ${Math.round(pct)}%` : "";
    return `${fmtBrl(after)}${pctStr}`;
  }, [
    financialImpact.impactLive,
    financialImpact.previewLoading,
    financialImpact.preview,
    valorNum,
    isMobile,
    mStep,
    mobileReviewImpactOpen,
  ]);

  // Estorno (despesa + isEstorno) = dinheiro voltando → verde como receita.
  const effectiveTypeIsMoneyIn = tipo === "receita" || (tipo === "despesa" && isEstorno);
  const typeColor  = effectiveTypeIsMoneyIn ? T.green : T.red;
  const typeLight  = effectiveTypeIsMoneyIn ? T.greenLight : T.redLight;

  const FREQ_LABELS = { semanal:"Semanal", quinzenal:"Quinzenal", mensal:"Mensal", anual:"Anual", personalizado:"Personalizado" };
  // Aceita aliases legados que podem vir de preConfig ou de séries antigas.
  const normalizeFreqRecId = (id) => {
    const v = String(id || "").toLowerCase();
    if (v === "diário" || v === "diario") return "mensal";
    if (v === "custom") return "personalizado";
    if (FREQ_LABELS[v]) return v;
    return "mensal";
  };
  const ENC_LABELS  = { "sem-fim":"Sem data fim", repeticoes:"Após N repetições", data:"Data específica" };
  const MET_LABELS  = { pix:"Pix", boleto:"Boleto", dinheiro:"Dinheiro", debito:"Débito", credito:"Crédito", transferencia:"Transferência" };

  const freqs = ["Semanal","Quinzenal","Mensal","Anual","Personalizado"];
  const parcs = [2,3,4,6,8,10,12];

  // Painel Recorrência — valores derivados a partir da data da transação
  // se o usuário ainda não tiver setado seus próprios.
  const firstOccurrenceDate = firstOccurrenceYmd || txDateYmd;
  const effectiveDayOfWeek = useMemo(() => {
    if (selectedDayOfWeek != null) return selectedDayOfWeek;
    if (!firstOccurrenceDate) return null;
    const d = new Date(`${firstOccurrenceDate}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d.getDay();
  }, [selectedDayOfWeek, firstOccurrenceDate]);
  const effectiveDayOfMonth = useMemo(() => {
    if (selectedDayOfMonth != null) return selectedDayOfMonth;
    if (!firstOccurrenceDate) return null;
    const n = Number.parseInt(String(firstOccurrenceDate).slice(8, 10), 10);
    return Number.isFinite(n) ? n : null;
  }, [selectedDayOfMonth, firstOccurrenceDate]);

  const DOW_LABELS_SHORT = ["dom","seg","ter","qua","qui","sex","sab"];
  const DOW_LABELS_FULL  = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];
  const MONTH_NAMES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const CUSTOM_UNIT_LABEL = { day: ["dia","dias"], week: ["semana","semanas"], month: ["mês","meses"] };

  /** Linha 1 do resumo: descrição da regra ("Todo dia 5", "Toda terça-feira", etc.). */
  const recurrenceRuleSummary = useMemo(() => {
    if (freqRec === "semanal" && effectiveDayOfWeek != null) return `Toda ${DOW_LABELS_FULL[effectiveDayOfWeek]}`;
    if (freqRec === "quinzenal" && effectiveDayOfWeek != null) return `A cada 2 semanas, ${DOW_LABELS_FULL[effectiveDayOfWeek]}`;
    if (freqRec === "mensal" && effectiveDayOfMonth != null) return `Todo dia ${effectiveDayOfMonth} de cada mês`;
    if (freqRec === "anual" && firstOccurrenceDate) {
      const d = new Date(`${firstOccurrenceDate}T12:00:00`);
      if (!Number.isNaN(d.getTime())) return `Todo dia ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
    }
    if (freqRec === "personalizado") {
      const n = Math.max(1, Number(customIntervalRec) || 1);
      const [sing, plur] = CUSTOM_UNIT_LABEL[customUnitRec] || ["unidade","unidades"];
      return `A cada ${n} ${n === 1 ? sing : plur}`;
    }
    return FREQ_LABELS[freqRec] || "";
  }, [freqRec, effectiveDayOfWeek, effectiveDayOfMonth, firstOccurrenceDate, customIntervalRec, customUnitRec]);

  /**
   * 1ª ocorrência que o backend vai gravar (espelha compute_first_occurrence).
   * Para monthly avança ao próximo mês se day_of_month já passou no mês corrente.
   * Para weekly/biweekly/yearly/custom usa firstOccurrenceDate como âncora literal.
   */
  const recurrenceNextOccurrence = useMemo(() => {
    if (!firstOccurrenceDate) return null;
    const anchor = new Date(`${firstOccurrenceDate}T12:00:00`);
    if (Number.isNaN(anchor.getTime())) return firstOccurrenceDate;
    const apiFreq = (
      freqRec === "semanal" ? "weekly" :
      freqRec === "quinzenal" ? "biweekly" :
      freqRec === "mensal" ? "monthly" :
      freqRec === "anual" ? "yearly" :
      freqRec === "personalizado" ? "custom" : "monthly"
    );
    const result = computeFirstOccurrenceMath(anchor, apiFreq, {
      dayOfMonth: effectiveDayOfMonth,
      dayOfWeek: effectiveDayOfWeek,
    });
    if (!(result instanceof Date)) return firstOccurrenceDate;
    const y = result.getFullYear();
    const m = String(result.getMonth() + 1).padStart(2, "0");
    const d = String(result.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [firstOccurrenceDate, freqRec, effectiveDayOfMonth, effectiveDayOfWeek]);

  /** end_date calculada quando encRec=repeticoes (apenas para exibir no resumo). */
  const recurrenceComputedEndDate = useMemo(() => {
    if (encRec !== "repeticoes") return null;
    const n = Number(encRepetitionsRec);
    if (!Number.isFinite(n) || n < 1) return null;
    const apiFreq = (
      freqRec === "semanal" ? "weekly" :
      freqRec === "quinzenal" ? "biweekly" :
      freqRec === "mensal" ? "monthly" :
      freqRec === "anual" ? "yearly" :
      freqRec === "personalizado" ? "custom" : "monthly"
    );
    return computeEndDateFromOccurrencesMath({
      startDateYmd: firstOccurrenceDate,
      frequency: apiFreq,
      n,
      dayOfMonth: effectiveDayOfMonth,
      dayOfWeek: effectiveDayOfWeek,
      interval: customIntervalRec,
      intervalUnit: customUnitRec,
    });
  }, [encRec, encRepetitionsRec, freqRec, firstOccurrenceDate, effectiveDayOfMonth, effectiveDayOfWeek, customIntervalRec, customUnitRec]);

  const fmtDateBr = (ymd) => {
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(String(ymd))) return "—";
    const [y, m, d] = ymd.split("-");
    return `${d}/${m}/${y}`;
  };

  const ymdFromDate = (d) => {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  };

  useEffect(() => {
    if (!firstOccurrenceAutoAdjustNote) return undefined;
    const id = setTimeout(() => setFirstOccurrenceAutoAdjustNote(null), 3500);
    return () => clearTimeout(id);
  }, [firstOccurrenceAutoAdjustNote]);

  /**
   * Variante A: ao mudar dia-da-semana, avança automaticamente a 1ª ocorrência
   * para o próximo dia-da-semana selecionado, garantindo que a série gravada no
   * backend já comece no dia "certo". Mostra um aviso curto para o usuário.
   */
  const handleSelectDayOfWeek = (idx) => {
    setSelectedDayOfWeek(idx);
    if (!firstOccurrenceDate) return;
    const anchor = new Date(`${firstOccurrenceDate}T12:00:00`);
    if (Number.isNaN(anchor.getTime())) return;
    if (anchor.getDay() === idx) return;
    const targetMs = anchor.getTime() + ((idx - anchor.getDay() + 7) % 7 || 7) * 24 * 60 * 60 * 1000;
    const target = new Date(targetMs);
    const nextYmd = ymdFromDate(target);
    if (nextYmd && nextYmd !== firstOccurrenceYmd) {
      setFirstOccurrenceYmd(nextYmd);
      setFirstOccurrenceAutoAdjustNote(`Primeira ocorrência ajustada para ${fmtDateBr(nextYmd)} (próxima ${DOW_LABELS_FULL[idx]}).`);
    }
  };

  /**
   * Variante A para mensal: ao mudar dia-do-mês, recalcula a 1ª ocorrência
   * espelhando o backend (mesmo mês se ainda futuro, próximo mês caso contrário).
   */
  const handleSelectDayOfMonth = (n) => {
    setSelectedDayOfMonth(n);
    if (!firstOccurrenceDate || n == null) return;
    const anchor = new Date(`${firstOccurrenceDate}T12:00:00`);
    if (Number.isNaN(anchor.getTime())) return;
    const next = computeFirstOccurrenceMath(anchor, "monthly", { dayOfMonth: n });
    const nextYmd = ymdFromDate(next);
    if (nextYmd && nextYmd !== firstOccurrenceYmd) {
      setFirstOccurrenceYmd(nextYmd);
      setFirstOccurrenceAutoAdjustNote(`Primeira ocorrência ajustada para ${fmtDateBr(nextYmd)} (próximo dia ${n}).`);
    }
  };

  const customUnitOpts = [
    { id: "day",   label: "dias" },
    { id: "week",  label: "semanas" },
    { id: "month", label: "meses" },
  ];

  /** Bloco completo do painel "Recorrência" (frequência + condicionais + âncora + encerramento + resumo). */
  const renderRecurrenceConfigBody = (compact) => {
    const f = {
      sectionGap: compact ? 18 : 14,
      labelSize: compact ? 12 : 10,
      labelMargin: compact ? 10 : 8,
      fieldGap: compact ? 8 : 6,
      pillPadding: compact ? "12px 10px" : "8px 10px",
      pillFontSize: compact ? 13 : 12,
      dowSize: compact ? 36 : 28,
      inputPadding: compact ? "10px 12px" : "8px 10px",
      smallText: compact ? 12 : 11,
      hintText: compact ? 11 : 10,
    };
    const Label = ({ children }) => (
      <div style={{ ...G, fontSize: f.labelSize, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: f.labelMargin }}>{children}</div>
    );
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: f.sectionGap }}>
        {/* ─── FREQUÊNCIA ─── */}
        <div>
          <Label>Frequência</Label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: f.fieldGap }}>
            {freqs.map((label) => {
              const fid = label.toLowerCase();
              const active = freqRec === fid;
              return (
                <button key={label} type="button" onClick={() => setFreqRec(fid)}
                  style={{ ...G, padding: f.pillPadding, borderRadius: 10, border: `1.5px solid ${active ? T.ink : T.border}`, background: active ? T.ink : T.surface, color: active ? "#fff" : T.inkMid, fontSize: f.pillFontSize, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── CAMPOS CONDICIONAIS ─── */}
        {(freqRec === "semanal" || freqRec === "quinzenal") && (
          <div>
            <Label>{freqRec === "quinzenal" ? "Dia da semana (a cada 2)" : "Dia da semana"}</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {DOW_LABELS_SHORT.map((lbl, idx) => {
                const active = effectiveDayOfWeek === idx;
                return (
                  <button key={idx} type="button" onClick={() => handleSelectDayOfWeek(idx)}
                    aria-label={DOW_LABELS_FULL[idx]}
                    title={DOW_LABELS_FULL[idx]}
                    style={{ ...G, height: f.dowSize, padding: 0, borderRadius: 8, border: `1.5px solid ${active ? T.ink : T.border}`, background: active ? T.ink : T.surface, color: active ? "#fff" : T.inkMid, fontSize: compact ? 12 : 10, fontWeight: 700, cursor: "pointer", textTransform: "lowercase" }}>
                    {lbl}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {freqRec === "mensal" && (
          <div>
            <Label>Dia do mês</Label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ ...G, fontSize: f.smallText, color: T.inkMid }}>Todo dia</span>
              <input type="number" min={1} max={31} value={effectiveDayOfMonth ?? ""}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  const clamped = Number.isFinite(n) ? Math.min(31, Math.max(1, n)) : null;
                  handleSelectDayOfMonth(clamped);
                }}
                style={{ ...G, width: 64, padding: f.inputPadding, borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: f.pillFontSize, fontWeight: 700, color: T.ink, textAlign: "center" }} />
              <span style={{ ...G, fontSize: f.smallText, color: T.inkMid }}>de cada mês</span>
            </div>
            {effectiveDayOfMonth != null && effectiveDayOfMonth > 28 && (
              <div style={{ ...G, fontSize: f.hintText, color: T.inkLight, marginTop: 6, lineHeight: 1.4 }}>
                Em meses sem o dia {effectiveDayOfMonth}, a transação cai no último dia do mês.
              </div>
            )}
          </div>
        )}

        {freqRec === "anual" && (
          <div>
            <Label>Dia e mês</Label>
            <LocaleDatePicker
              locale={APP_UI_LOCALE}
              value={firstOccurrenceDate}
              onChange={(ymd) => setFirstOccurrenceYmd(ymd || null)}
              style={{ width: "100%" }}
            />
            <div style={{ ...G, fontSize: f.hintText, color: T.inkLight, marginTop: 6 }}>
              Repete todo {firstOccurrenceDate ? (() => { const d = new Date(`${firstOccurrenceDate}T12:00:00`); return Number.isNaN(d.getTime()) ? "—" : `${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`; })() : "—"}.
            </div>
          </div>
        )}

        {freqRec === "personalizado" && (
          <div>
            <Label>A cada</Label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" min={1} value={customIntervalRec}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  setCustomIntervalRec(Number.isFinite(n) && n >= 1 ? n : 1);
                }}
                style={{ ...G, width: 64, padding: f.inputPadding, borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: f.pillFontSize, fontWeight: 700, color: T.ink, textAlign: "center" }} />
              <select value={customUnitRec} onChange={(e) => setCustomUnitRec(e.target.value)}
                style={{ ...G, flex: 1, padding: f.inputPadding, borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: f.pillFontSize, fontWeight: 600, color: T.ink, background: T.surface }}>
                {customUnitOpts.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* ─── PRIMEIRA OCORRÊNCIA (âncora) ─── */}
        <div>
          <Label>Primeira ocorrência</Label>
          <LocaleDatePicker
            locale={APP_UI_LOCALE}
            value={firstOccurrenceDate}
            onChange={(ymd) => { setFirstOccurrenceYmd(ymd || null); setFirstOccurrenceAutoAdjustNote(null); }}
            style={{ width: "100%" }}
          />
          {firstOccurrenceAutoAdjustNote ? (
            <div role="status" aria-live="polite"
              style={{ ...G, fontSize: f.hintText, color: T.ink, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 8px", marginTop: 6, lineHeight: 1.4 }}>
              ↻ {firstOccurrenceAutoAdjustNote}
            </div>
          ) : (
            <div style={{ ...G, fontSize: f.hintText, color: T.inkLight, marginTop: 6 }}>
              Pode ser diferente da data da transação.
            </div>
          )}
        </div>

        {/* ─── ENCERRAMENTO ─── */}
        <div>
          <Label>Encerramento</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: f.fieldGap }}>
            {[
              { id: "sem-fim", label: "Sem data fim", sub: "Até cancelar manualmente" },
              { id: "repeticoes", label: "Após N repetições", sub: "Informe a quantidade" },
              { id: "data", label: "Data específica", sub: "Escolher término" },
            ].map((opt) => {
              const active = encRec === opt.id;
              return (
                <div key={opt.id} onClick={() => setEncRec(opt.id)}
                  style={{ display: "flex", flexDirection: "column", gap: 8, padding: compact ? "12px 14px" : "10px 12px", borderRadius: 10, border: `1.5px solid ${active ? T.ink : T.border}`, cursor: "pointer", background: active ? T.bg : T.surface }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ width: compact ? 16 : 14, height: compact ? 16 : 14, borderRadius: 9999, border: `2px solid ${active ? T.ink : T.border}`, background: active ? T.ink : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      {active && <div style={{ width: compact ? 6 : 5, height: compact ? 6 : 5, borderRadius: 9999, background: "#fff" }} />}
                    </div>
                    <div>
                      <div style={{ ...G, fontSize: f.pillFontSize, fontWeight: 600, color: T.ink }}>{opt.label}</div>
                      <div style={{ ...G, fontSize: f.hintText, color: T.inkLight, marginTop: 1 }}>{opt.sub}</div>
                    </div>
                  </div>
                  {active && opt.id === "repeticoes" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: compact ? 26 : 24 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ ...G, fontSize: f.smallText, color: T.inkMid }}>Após</span>
                        <input type="number" min={1} value={encRepetitionsRec}
                          onChange={(e) => {
                            const n = Number.parseInt(e.target.value, 10);
                            setEncRepetitionsRec(Number.isFinite(n) && n >= 1 ? n : 1);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{ ...G, width: 64, padding: f.inputPadding, borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: f.pillFontSize, fontWeight: 700, color: T.ink, textAlign: "center" }} />
                        <span style={{ ...G, fontSize: f.smallText, color: T.inkMid }}>
                          {freqRec === "semanal" ? (Number(encRepetitionsRec) === 1 ? "semana" : "semanas") :
                            freqRec === "quinzenal" ? (Number(encRepetitionsRec) === 1 ? "quinzena" : "quinzenas") :
                            freqRec === "mensal" ? (Number(encRepetitionsRec) === 1 ? "mês" : "meses") :
                            freqRec === "anual" ? (Number(encRepetitionsRec) === 1 ? "ano" : "anos") :
                            (Number(encRepetitionsRec) === 1 ? "ocorrência" : "ocorrências")}
                        </span>
                      </div>
                      {recurrenceComputedEndDate && (
                        <div style={{ ...G, fontSize: f.hintText, color: T.inkLight }}>
                          Termina em <strong style={{ color: T.ink }}>{fmtDateBr(recurrenceComputedEndDate)}</strong>.
                        </div>
                      )}
                    </div>
                  )}
                  {active && opt.id === "data" && (
                    <div onClick={(e) => e.stopPropagation()} style={{ paddingLeft: compact ? 26 : 24 }}>
                      <LocaleDatePicker
                        locale={APP_UI_LOCALE}
                        value={encEndDateYmdRec}
                        onChange={(ymd) => setEncEndDateYmdRec(ymd || null)}
                        style={{ width: "100%" }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── RESUMO ─── */}
        <div style={{ padding: compact ? "12px 14px" : "10px 12px", background: T.bg, borderRadius: 10, border: `1px solid ${T.border}` }}>
          <div style={{ ...G, fontSize: f.hintText, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Resumo</div>
          <div style={{ ...G, fontSize: compact ? 14 : 13, fontWeight: 700, color: T.ink }}>{recurrenceRuleSummary || "—"}</div>
          <div style={{ ...G, fontSize: f.hintText, color: T.inkLight, marginTop: 2 }}>
            Próxima: {fmtDateBr(recurrenceNextOccurrence)} · {ENC_LABELS[encRec]?.toLowerCase()}
            {encRec === "repeticoes" && recurrenceComputedEndDate && (
              <> · termina em {fmtDateBr(recurrenceComputedEndDate)}</>
            )}
            {encRec === "data" && encEndDateYmdRec && (
              <> · termina em {fmtDateBr(encEndDateYmdRec)}</>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Methods by tipo
  const METHODS_DESPESA = [["pix","Pix"],["debito","Débito"],["credito","Crédito"],["dinheiro","Dinheiro"],["boleto","Boleto"]];
  const METHODS_RECEITA = [["pix","Pix"],["dinheiro","Dinheiro"],["transferencia","Transferência"]];
  const methodsList = tipo === "receita" ? METHODS_RECEITA : METHODS_DESPESA;

  // Fix method when tipo changes to receita; reset isEstorno when leaving despesa.
  const handleSetTipo = (t) => {
    setTipo(t);
    if (t !== "despesa") {
      setIsEstorno(false);
      setRefundOfTransactionId(null);
      setRefundLinkedTx(null);
      setRefundPickerOpen(false);
      setRefundPickerQuery("");
      setRefundPickerCandidates([]);
    }
    if (t === "receita" && (method === "credito" || method === "boleto")) setMethod("pix");
  };

  // Quando toggle "↺ Isto é um estorno?" volta para OFF, descarta vínculo já escolhido.
  useEffect(() => {
    if (!isEstorno) {
      if (refundOfTransactionId != null) setRefundOfTransactionId(null);
      if (refundLinkedTx != null) setRefundLinkedTx(null);
      if (refundPickerOpen) setRefundPickerOpen(false);
      if (refundPickerQuery) setRefundPickerQuery("");
      if (refundPickerCandidates.length) setRefundPickerCandidates([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEstorno]);

  // Busca candidatas (expenses recentes) com debounce quando o picker está aberto.
  useEffect(() => {
    if (!isEstorno || !refundPickerOpen || refundLinkedTx) return;
    if (!organizationId) return;
    let cancelled = false;
    setRefundPickerLoading(true);
    const cardIdNum =
      method === "credito" && cartao && cartao !== "novo" ? Number(cartao) : null;
    const handle = setTimeout(async () => {
      // Quando o usuário já escolheu cartão de crédito, estreita pelo cartão.
      // Caso contrário, deixa amplo (não filtra por payment_method) — o picker
      // serve pra qualquer despesa recente, não só pix/credito.
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
  }, [isEstorno, refundPickerOpen, refundLinkedTx, refundPickerQuery, method, cartao, organizationId]);

  const handleRefundLink = (candidate) => {
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
    if (!categoryTagId && candidate.categoryTagId) setCategoryTagId(candidate.categoryTagId);
    if (candidate.paymentMethodKey && candidate.paymentMethodKey !== method && method === "pix") {
      setMethod(candidate.paymentMethodKey);
    }
    if (candidate.paymentMethodKey === "credito" && candCardId != null && !cartao) {
      setCartao(String(candCardId));
    }
    setRefundPickerOpen(false);
    setRefundPickerQuery("");
    setRefundPickerCandidates([]);
  };

  const handleRefundUnlink = () => {
    setRefundOfTransactionId(null);
    setRefundLinkedTx(null);
  };

  /**
   * Bloco "🔗 Linkar à compra estornada" — renderizado logo após o toggle
   * "↺ Isto é um estorno?" tanto no drawer mobile quanto desktop.
   * Mostra: card de linkado (se houver), ou botão de abrir picker, ou picker aberto.
   */
  const renderRefundLinkBlock = (variant = "desktop") => {
    if (!isEstorno || tipo !== "despesa") return null;
    const fsLg = variant === "mobile" ? 13 : 12;
    const fsSm = variant === "mobile" ? 11 : 10;
    const pad = variant === "mobile" ? "12px 14px" : "10px 12px";
    const fmt = (v) => "R$ " + Math.abs(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (refundLinkedTx) {
      return (
        <div style={{
          background: T.greenLight, border: `1px solid ${T.green}44`, borderRadius: 10,
          padding: pad, display: "flex", alignItems: "center", gap: 10,
        }}>
          <RotateCcw size={14} color={T.green} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...G, fontSize: fsSm, fontWeight: 700, color: T.green, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
              Estornando a compra
            </div>
            <div style={{ ...G, fontSize: fsLg, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {refundLinkedTx.desc}
            </div>
            <div style={{ ...G, fontSize: fsSm, color: T.inkMid, marginTop: 2 }}>
              {refundLinkedTx.dateLabel} · <span style={{ fontFamily: "'Geist Mono',monospace", fontWeight: 700 }}>{fmt(refundLinkedTx.val)}</span>
              {refundLinkedTx.cat ? ` · ${refundLinkedTx.cat}` : ""}
            </div>
          </div>
          <button type="button" onClick={handleRefundUnlink}
            style={{ ...G, background: "transparent", border: `1px solid ${T.green}66`, color: T.green, borderRadius: 8, padding: "5px 9px", fontSize: fsSm, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
            Desvincular
          </button>
        </div>
      );
    }

    if (!refundPickerOpen) {
      return (
        <button type="button" onClick={() => setRefundPickerOpen(true)}
          style={{ ...G, display: "flex", alignItems: "center", gap: 8, padding: pad, borderRadius: 10, border: `1px dashed ${T.green}66`, background: "transparent", cursor: "pointer", textAlign: "left", color: T.green, fontSize: fsLg, fontWeight: 600 }}>
          🔗 <span>Qual a compra estornada? (opcional)</span>
        </button>
      );
    }

    return (
      <div style={{ border: `1px solid ${T.green}44`, borderRadius: 10, padding: pad, display: "flex", flexDirection: "column", gap: 8, background: T.surface }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Search size={13} color={T.inkLight} />
          <input
            autoFocus
            value={refundPickerQuery}
            onChange={(e) => setRefundPickerQuery(e.target.value)}
            placeholder="Buscar compra original (descrição)…"
            style={{ ...G, flex: 1, border: "none", outline: "none", background: "transparent", fontSize: fsLg, color: T.ink }}
          />
          <button type="button" onClick={() => { setRefundPickerOpen(false); setRefundPickerQuery(""); setRefundPickerCandidates([]); }}
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, color: T.inkMid }}>
            <X size={13} />
          </button>
        </div>
        {refundPickerLoading ? (
          <div style={{ ...G, fontSize: fsSm, color: T.inkLight, padding: "8px 4px" }}>Buscando…</div>
        ) : refundPickerCandidates.length === 0 ? (
          <div style={{ ...G, fontSize: fsSm, color: T.inkLight, padding: "8px 4px" }}>
            {refundPickerQuery ? "Nenhuma compra encontrada nos últimos 365 dias." : "Digite parte da descrição da compra original."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" }}>
            {refundPickerCandidates.map((c) => (
              <button key={c.id} type="button" onClick={() => handleRefundLink(c)}
                style={{ ...G, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, cursor: "pointer", textAlign: "left" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...G, fontSize: fsLg, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.desc}</div>
                  <div style={{ ...G, fontSize: fsSm, color: T.inkMid, marginTop: 1 }}>
                    {c.date}{c.cat ? ` · ${c.cat}` : ""}{c.method ? ` · ${c.method}` : ""}
                  </div>
                </div>
                <span style={{ ...G, fontFamily: "'Geist Mono',monospace", fontSize: fsLg, fontWeight: 700, color: T.ink, flexShrink: 0 }}>
                  {fmt(c.val)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // AI simulation: trigger when desc >= 4 chars
  useEffect(() => {
    if (desc.length < 4) { setAiSuggestion(null); setAiApplied(false); return; }
    const lower = desc.toLowerCase();
    let suggestion = null;
    if (lower.includes("mercado") || lower.includes("supermercado") || lower.includes("extra") || lower.includes("pão de açúcar"))
      suggestion = { cat: "Alimentação", iconKey: "shopping-cart", tags: ["mercado", "compras"] };
    else if (lower.includes("uber") || lower.includes("99") || lower.includes("gasolina") || lower.includes("combustível"))
      suggestion = { cat: "Transporte", iconKey: "car", tags: ["transporte"] };
    else if (lower.includes("netflix") || lower.includes("spotify") || lower.includes("adobe") || lower.includes("amazon"))
      suggestion = { cat: "Assinaturas", iconKey: "smartphone", tags: ["streaming", "assinatura"] };
    else if (lower.includes("academia") || lower.includes("smartfit") || lower.includes("farmácia") || lower.includes("remédio"))
      suggestion = { cat: "Saúde", iconKey: "pill", tags: ["saúde"] };
    else if (lower.includes("aluguel") || lower.includes("condomínio") || lower.includes("iptu"))
      suggestion = { cat: "Moradia", iconKey: "home", tags: ["moradia", "fixo"] };
    else if (lower.includes("salário") || lower.includes("freela") || lower.includes("aporte"))
      suggestion = { cat: "Receita", iconKey: "wallet", tags: ["receita"] };
    setAiSuggestion(suggestion);
    setAiApplied(false);
  }, [desc]);

  const applyAi = async () => {
    if (!aiSuggestion) return;
    const rows = useLiveCategoryTags ? categoryTagsData.categories : [];
    const byKey =
      aiSuggestion.iconKey && rows.length
        ? rows.find((c) => c.iconKey === aiSuggestion.iconKey)
        : null;
    const byLabel = rows.find((c) => c.labelPt === aiSuggestion.cat);
    const row = byKey || byLabel;
    if (row?.labelPt) setCat(row.labelPt);
    else setCat(aiSuggestion.cat);
    const catIdForDetailTags = row?.id ?? null;
    if (row?.id) setCategoryTagId(row.id);
    if (useLiveDetailTags && catIdForDetailTags) {
      const nextIds = [];
      const nextLabels = {};
      for (const t of aiSuggestion.tags || []) {
        try {
          const id = await ensureDetailTag(String(t), catIdForDetailTags);
          if (!nextIds.includes(id)) {
            nextIds.push(id);
            nextLabels[String(id)] = String(t);
          }
        } catch {
          /* ignora tag individual */
        }
      }
      setDetailTagIds(nextIds);
      setDetailTagLabelById(nextLabels);
      setTags([]);
    } else {
      setTags(aiSuggestion.tags || []);
      setDetailTagIds([]);
      setDetailTagLabelById({});
    }
    setAiApplied(true);
  };

  // Mobile: dynamic steps flow
  const mStepsFlow = useMemo(() => {
    const f = [1, 2];
    if (tipo === "despesa" && method === "credito") f.push("cartao");
    if (recorre) f.push("recorrencia");
    f.push("review");
    return f;
  }, [tipo, method, recorre]);

  const mCurrentIdx  = mStepsFlow.indexOf(mStep);
  const mTotalSteps  = mStepsFlow.length;
  const mIsLast      = mCurrentIdx === mTotalSteps - 1;
  const mNextStep    = mStepsFlow[mCurrentIdx + 1];
  const mPrevStep    = mCurrentIdx > 0 ? mStepsFlow[mCurrentIdx - 1] : null;

  const mNextLabel = () => {
    if (mNextStep === "review")      return "Revisar →";
    if (mNextStep === "cartao")      return "Cartão →";
    if (mNextStep === "recorrencia") return "Recorrência →";
    return "Continuar →";
  };

  const animateMobileStepChange = () => {
    if (!isMobile) return;
    setMStepAnimating(true);
    if (mStepAnimTimerRef.current) clearTimeout(mStepAnimTimerRef.current);
    mStepAnimTimerRef.current = window.setTimeout(() => {
      mStepAnimTimerRef.current = null;
      setMStepAnimating(false);
    }, 260);
  };
  const goNext = () => {
    if (!mNextStep) return;
    animateMobileStepChange();
    setMStep(mNextStep);
  };
  const goPrev = () => {
    if (mPrevStep === null) return;
    animateMobileStepChange();
    setMStep(mPrevStep);
  };

  const handleSave = async () => {
    const rawEditTxId = preConfig?.editingTransactionId;
    const editingTransactionId =
      rawEditTxId != null && Number.isFinite(Number(rawEditTxId))
        ? Number(rawEditTxId)
        : null;
    const editingTransactionIdStr =
      rawEditTxId != null && isUuidString(String(rawEditTxId))
        ? String(rawEditTxId)
        : null;

    const isEditSeries =
      Boolean(preConfig?.isEditRecorrencia) &&
      preConfig?.recId &&
      isUuidString(String(preConfig.recId));

    const shouldSaveLiveSeries =
      organizationId &&
      dataMode === "live" &&
      editingTransactionId == null &&
      editingTransactionIdStr == null &&
      (novaRecorrencia || recorre || isEditSeries);

    const detailIdsForApi = useLiveDetailTags ? detailTagIds : [];

    if (shouldSaveLiveSeries) {
      if (!categoryTagId) {
        setTxSubmitError("Escolha uma categoria da lista.");
        return;
      }
      if (!(valorNum > 0)) {
        setTxSubmitError("Informe um valor válido.");
        return;
      }
      if (method === "credito") {
        const idNum = Number(cartao);
        if (!cartao || cartao === "novo" || !Number.isFinite(idNum)) {
          setTxSubmitError("Selecione um cartão de crédito.");
          return;
        }
      }
      setTxSubmitting(true);
      setTxSubmitError("");
      try {
        const cardId =
          method === "credito" && cartao && cartao !== "novo"
            ? Number(cartao)
            : null;
        const endYmd =
          encRec === "data" && encEndDateYmdRec &&
          /^\d{4}-\d{2}-\d{2}$/.test(String(encEndDateYmdRec))
            ? String(encEndDateYmdRec)
            : undefined;
        const recurrenceSharedPayload = {
          description: desc,
          value: valorNum,
          paymentMethodKey: method,
          categoryTagId,
          detailTagIds: detailIdsForApi,
          startDateYmd: firstOccurrenceDate,
          freqRec,
          encRec,
          endDateYmd: endYmd,
          valorTipoRec,
          categoryLabel: cat,
          cardId: Number.isFinite(cardId) ? cardId : null,
          dayOfWeek: effectiveDayOfWeek,
          dayOfMonth: effectiveDayOfMonth,
          interval: customIntervalRec,
          intervalUnit: customUnitRec,
          repetitions: encRec === "repeticoes" ? Number(encRepetitionsRec) : null,
        };
        if (isEditSeries) {
          await updateRecurringSeriesForUi(
            String(preConfig.recId),
            organizationId,
            buildUpdateRecurringSeriesPayload(recurrenceSharedPayload),
          );
        } else {
          await createRecurringSeriesForUi(
            organizationId,
            buildCreateRecurringSeriesPayload({ tipo, ...recurrenceSharedPayload }),
          );
        }
        clearNovaTransacaoSummaryCache();
        onTransactionSaved?.();
      } catch (err) {
        setTxSubmitError(formatRecurringTransactionsApiError(err));
        setTxSubmitting(false);
        return;
      }
      setTxSubmitting(false);
      setSuccessOverlay(true);
      return;
    }

    const liveOneShot =
      organizationId &&
      dataMode === "live" &&
      !novaRecorrencia &&
      (!recorre ||
        editingTransactionId != null ||
        editingTransactionIdStr != null);

    if (liveOneShot) {
      if (!categoryTagId) {
        setTxSubmitError("Escolha uma categoria da lista.");
        return;
      }
      setTxSubmitting(true);
      setTxSubmitError("");
      try {
        if (method === "credito") {
          const idNum = Number(cartao);
          if (!cartao || cartao === "novo" || !Number.isFinite(idNum)) {
            setTxSubmitError("Selecione um cartão de crédito.");
            setTxSubmitting(false);
            return;
          }
        }
        let modality = null;
        let installmentsCount = null;
        if (method === "credito" && modalidade === "parcelado" && parcelas > 1) {
          modality = "installment";
          installmentsCount = parcelas;
        } else if (method === "credito") {
          modality = "cash";
        }
        const cardId =
          method === "credito" && cartao && cartao !== "novo"
            ? Number(cartao)
            : null;
        const dateIso = transactionDateIsoFromYmd(txDateYmd);
        if (editingTransactionIdStr != null || editingTransactionId != null) {
          const effectiveTipoEdit = tipo === "despesa" && isEstorno ? "estorno" : tipo;
          // Update endpoint não aceita refund_of_transaction_id (backend preserva o existente).
          await updateTransactionForUi(
            editingTransactionIdStr ?? editingTransactionId,
            organizationId,
            buildUpdateTransactionPayload({
              tipo: effectiveTipoEdit,
              description: desc,
              value: valorNum,
              paymentMethodKey: method,
              categoryTagId,
              detailTagIds: detailIdsForApi,
              dateIso,
              installmentsCount,
              modality,
              cardId: Number.isFinite(cardId) ? cardId : null,
              recurring: recorre,
            }),
          );
        } else {
          const effectiveTipo = tipo === "despesa" && isEstorno ? "estorno" : tipo;
          await createTransactionForUi(
            buildCreateTransactionPayload({
              organizationId,
              tipo: effectiveTipo,
              description: desc,
              value: valorNum,
              paymentMethodKey: method,
              categoryTagId,
              detailTagIds: detailIdsForApi,
              dateIso,
              installmentsCount,
              modality,
              cardId: Number.isFinite(cardId) ? cardId : null,
              refundOfTransactionId: isEstorno ? refundOfTransactionId : null,
            }),
          );
        }
        clearNovaTransacaoSummaryCache();
        onTransactionSaved?.();
      } catch (err) {
        setTxSubmitError(formatTransactionsApiError(err));
        setTxSubmitting(false);
        return;
      }
      setTxSubmitting(false);
    }

    setSuccessOverlay(true);
  };

  // Desktop-only helpers
  const goReview = () => { setReviewDir("forward"); setReview(true); };
  const goBack   = () => { setReviewDir("back");    setReview(false); };

  const handleNewTransaction = () => {
    const prefs = readStoredNovaTransacaoPrefs(organizationId);
    const prefTipo = prefs.tipo === "receita" ? "receita" : "despesa";
    const prefMethod = normalizeStoredNovaTxPaymentMethod(prefs.method, prefTipo) ?? "pix";
    setTipo(prefTipo);
    setIsEstorno(false);
    setRefundOfTransactionId(null);
    setRefundLinkedTx(null);
    setRefundPickerOpen(false);
    setRefundPickerQuery("");
    setRefundPickerCandidates([]);
    setCentavos(0); setValor("");
    setDesc(""); setTags([]); setDetailTagIds([]); setDetailTagLabelById({});
    setMethod(prefMethod);
    setPanelCartaoOpen(prefMethod === "credito"); setPanelCartaoExiting(false);
    setPanelRecorrenciaOpen(false); setPanelRecorrenciaExiting(false);
    setRecorre(false);
    setCartao(prefMethod === "credito" && prefs.cartaoId != null ? String(prefs.cartaoId) : "");
    setFreqRec("mensal"); setEncRec("sem-fim"); setValorTipoRec("fixo");
    setSelectedDayOfWeek(null); setSelectedDayOfMonth(null);
    setCustomIntervalRec(1); setCustomUnitRec("month");
    setFirstOccurrenceYmd(null);
    setEncRepetitionsRec(12); setEncEndDateYmdRec(null);
    setCat(prefs.cat != null && String(prefs.cat).trim() ? String(prefs.cat).trim() : "");
    setCategoryTagId(null);
    if (prefMethod === "credito") {
      setMod(prefs.modalidade === "avista" ? "avista" : "parcelado");
      const pp = clampNovaTxPrefsParcelas(prefs.parcelas);
      if (pp != null) setParcelas(pp);
    } else {
      setMod("parcelado"); setParcelas(3);
    }
    setTxDateYmd(initialNovaTransacaoDateYmd(organizationId, null));
    setReview(false); setMStep(1); setSuccess(false); setSuccessOverlay(false);
    setTxSubmitError(""); setTxSubmitting(false); setDescError(false);
    setMobileReviewImpactOpen(false); setAiSuggestion(null); setAiApplied(false);
    setDescFocused(false); setAddingCartao(false); setQuickAddCardName(""); setQuickAddCardLast4("");
    setNewTag(""); setAddingTag(false); setParcelaMode(false); setPCalcCents(0);
    setParcelasCustom(false); setParcelasInput(""); setShowImpact(false);
  };

  const PanelHeader = ({ icon: Icon, title, onCollapse }) => (
    <div style={{ padding:"15px 18px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <Icon size={15} color={T.ink} />
        <span style={{ ...G, fontSize:14, fontWeight:700, color:T.ink }}>{title}</span>
      </div>
      <button onClick={onCollapse} style={{ background:"none", border:"none", cursor:"pointer", padding:4, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center" }}
        onMouseEnter={e => e.currentTarget.style.background = T.bg}
        onMouseLeave={e => e.currentTarget.style.background = "none"}>
        <X size={15} color={T.inkLight} />
      </button>
    </div>
  );

  /* ── MobileImpact — collapsible in review ── */
  const MobileImpact = () => (
      <div style={{ border:`1px solid ${T.amber}33`, borderRadius:12, overflow:"hidden" }}>
        <button onClick={() => setMobileReviewImpactOpen((v) => !v)}
          style={{ ...G, width:"100%", display:"flex", alignItems:"center", gap:8, padding:"10px 13px", background:T.amberLight, border:"none", cursor:"pointer" }}>
          <Zap size={13} color={T.amber} fill={T.amber} style={{ flexShrink:0 }} />
          <div style={{ flex:1, textAlign:"left" }}>
            <span style={{ ...G, fontSize:12, fontWeight:700, color:T.ink }}>Impacto financeiro</span>
            <span style={{ ...G, fontSize:11, color:T.amber, marginLeft:8 }}>{impactMobileSummary}</span>
          </div>
          <ChevronDown size={14} color={T.amber} style={{ transition:"transform 0.22s", transform: mobileReviewImpactOpen ? "rotate(180deg)" : "rotate(0deg)", flexShrink:0 }} />
        </button>
        {mobileReviewImpactOpen && (
          <div style={{ padding:"12px 14px", background:T.surface, borderTop:`1px solid ${T.amber}22`, display:"flex", flexDirection:"column", gap:12 }}>
            <NovaTransacaoImpactPanel
              impactLive={financialImpact.impactLive}
              financialImpact={financialImpact}
              impactKpis={impactKpis}
              valorNum={valorNum}
              modalCategoryChoices={modalCategoryChoices}
              cat={cat}
              chartHeight={64}
              marginBottom={10}
              kpiValSize={13}
              kpiTitleSize={7}
              categoryNumSize={10}
            />
          </div>
        )}
      </div>
  );

  /* ── ReviewBody (shared desktop + mobile) ── */
  const ReviewBody = ({ mobile = false } = {}) => (
    <div style={mobile ? {} : { animation: reviewDir === "forward" ? "revSlideIn 0.26s ease-out" : "revSlideBack 0.26s ease-out" }}>
      <div style={{ background: typeLight, borderBottom:`1px solid ${typeColor}18`, padding: mobile ? "14px 18px" : "14px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:6 }}>
          <div style={{ width:18, height:18, borderRadius:9999, background:typeColor, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Check size={10} color="#fff" strokeWidth={3} />
          </div>
          <span style={{ ...G, fontSize:10, fontWeight:700, color:typeColor, textTransform:"uppercase", letterSpacing:"0.09em" }}>
            {novaRecorrencia || recorre ? "Recorrência pronta para confirmar" : "Pronto para registrar"}
          </span>
        </div>
        <div style={{ ...G, fontSize:18, fontWeight:800, color:T.ink, letterSpacing:"-0.01em" }}>{desc || "(sem descrição)"}</div>
        <div style={{ display:"flex", alignItems:"baseline", gap:5, marginTop:4 }}>
          <span style={{ ...G, ...NUM, fontSize:28, fontWeight:800, color:typeColor, letterSpacing:"-0.02em" }}>
            {effectiveTypeIsMoneyIn ? "+" : "−"}R$ {valorNum.toLocaleString("pt-BR",{minimumFractionDigits:2})}
          </span>
          {(novaRecorrencia || recorre) && (
            <span style={{ ...G, fontSize:12, color:typeColor, opacity:0.7 }}>
              / {FREQ_LABELS[freqRec]?.toLowerCase() || "mês"}
            </span>
          )}
        </div>
        {(novaRecorrencia || recorre) && (
          <div style={{ ...G, fontSize:11, color:typeColor, opacity:0.65, marginTop:3 }}>
            {recurrenceRuleSummary || FREQ_LABELS[freqRec]} · {ENC_LABELS[encRec]}
          </div>
        )}
      </div>
      <div style={{ padding: mobile ? "14px 18px" : "16px 20px", display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:1, background:T.border, borderRadius:12, overflow:"hidden", border:`1px solid ${T.border}` }}>
          {[
            { label:"TIPO",        val: tipo === "despesa" ? (isEstorno ? "↺ Estorno" : "Despesa") : "Receita", valColor: typeColor },
            { label:"CATEGORIA",   val: cat    },
            { label:"FORMA PAG.",  val: MET_LABELS[method] || method },
            { label:"DATA",        val: formatYmdToLocaleDisplay(txDateYmd, APP_UI_LOCALE) },
            ...(recorre || novaRecorrencia ? [
              { label:"FREQUÊNCIA",   val: FREQ_LABELS[freqRec] || freqRec },
              { label:"ENCERRAMENTO", val: ENC_LABELS[encRec] || encRec },
              { label:"TIPO DE VALOR", val: valorTipoRec === "estimado" ? "≈ Estimado" : "Fixo" },
            ] : [
              { label:"MODALIDADE", val: method === "credito" ? (modalidade === "avista" ? "À vista (1×)" : `${parcelas}× de R$ ${(valorNum/parcelas).toFixed(2)}`) : "—" },
              { label:"CARTÃO",    val: method === "credito" ? cartoes.find(c=>c.id===cartao)?.nome || "—" : "—" },
            ]),
          ].map((f,i) => (
            <div key={i} style={{ background:T.surface, padding:"10px 14px" }}>
              <div style={{ ...G, fontSize:8, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>{f.label}</div>
              <div style={{ ...G, fontSize:12, fontWeight:600, color:f.valColor || T.ink }}>{f.val}</div>
            </div>
          ))}
        </div>
        {((useLiveDetailTags && detailTagIds.length > 0) || (!useLiveDetailTags && tags.length > 0)) && (
          <div>
            <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>Tags</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {useLiveDetailTags
                ? detailTagIds.map((id) => (
                    <span key={id} style={{ ...G, fontSize:11, fontWeight:600, color:"#fff", background:T.purple, padding:"4px 10px", borderRadius:9999 }}>+ {detailChipLabel(id)}</span>
                  ))
                : tags.map((tag) => (
                    <span key={tag} style={{ ...G, fontSize:11, fontWeight:600, color:"#fff", background:T.purple, padding:"4px 10px", borderRadius:9999 }}>+ {tag}</span>
                  ))}
            </div>
          </div>
        )}
        {/* Impact — full on desktop, compact on mobile */}
        {!mobile && (
          <div style={{ border:`1px solid ${T.amber}33`, borderRadius:12, overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", gap:7, padding:"11px 14px", background:T.amberLight, borderBottom:`1px solid ${T.amber}22` }}>
              <Zap size={13} color={T.amber} fill={T.amber} />
              <span style={{ ...G, fontSize:12, fontWeight:700, color:T.ink }}>Impacto financeiro</span>
            </div>
            <div style={{ padding:"12px 14px", background:T.surface }}>
              <NovaTransacaoImpactPanel
                impactLive={financialImpact.impactLive}
                financialImpact={financialImpact}
                impactKpis={impactKpis}
                valorNum={valorNum}
                modalCategoryChoices={modalCategoryChoices}
                cat={cat}
                chartHeight={72}
                marginBottom={12}
                kpiValSize={14}
                kpiTitleSize={8}
                categoryNumSize={11}
              />
            </div>
          </div>
        )}
        {/* Mobile impact — collapsible */}
        {mobile && MobileImpact()}
      </div>
    </div>
  );

  if (!open && !drawerClosing) return null;

  const isRecurrence = novaRecorrencia || recorre;

  /* ════════════════════════════════════════════════════════════
     MOBILE — Bottom sheet with dynamic steps
  ════════════════════════════════════════════════════════════ */
  if (isMobile) {
    const stepLabel = {
      1: "Valor",
      2: "Detalhes",
      cartao: "Cartão",
      recorrencia: "Recorrência",
      review: "Confirmação",
    };
    const mobileStepInStyle = mStepAnimating
      ? { animation: "stepIn 0.22s ease-out" }
      : {};

    return (
      <div style={{ position:"fixed", inset:0, zIndex:300, overflow:"hidden", display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
        <style>{`
          @keyframes sheetUp { from { transform:translateY(100%) } to { transform:translateY(0) } }
          @keyframes sheetDown { from { transform:translateY(0) } to { transform:translateY(100%) } }
          @keyframes stepIn  { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }
          @keyframes stepBack{ from { opacity:0; transform:translateX(-20px) } to { opacity:1; transform:translateX(0) } }
          @keyframes overlayContentIn { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
          @keyframes checkBounce { from { opacity:0; transform:scale(0.4) } to { opacity:1; transform:scale(1) } }
        `}</style>
        {/* Backdrop */}
        <div onClick={beginClose} style={{ position:"absolute", inset:0, background:"rgba(15,23,35,0.5)" }} />

        {/* Sheet */}
        <div style={{ position:"relative", background:T.surface, borderRadius:"24px 24px 0 0", maxHeight:"94vh", display:"flex", flexDirection:"column", animation: drawerClosing ? "sheetDown 0.32s cubic-bezier(0.32,0.72,0,1) forwards" : "sheetUp 0.5s cubic-bezier(0.32,0.72,0,1) both", boxShadow:"0 -2px 0 rgba(0,0,0,0.05), 0 -8px 32px rgba(0,0,0,0.14), 0 -24px 80px rgba(0,0,0,0.08)" }}>

          {successOverlay && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 28px 36px" }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", width:"100%", animation:"overlayContentIn 0.3s cubic-bezier(0.32,0.72,0,1)" }}>
                <div style={{ width:80, height:80, borderRadius:"50%", background:T.greenLight, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:22, animation:"checkBounce 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.1s both" }}>
                  <Check size={36} color={T.green} strokeWidth={2.5} />
                </div>
                <div style={{ ...G, fontSize:22, fontWeight:800, color:T.ink, textAlign:"center", marginBottom:6 }}>
                  {isRecurrence ? "Recorrência salva!" : (tipo==="despesa" ? (isEstorno ? "Estorno registrado!" : "Despesa registrada!") : "Receita registrada!")}
                </div>
                <div style={{ ...G, ...NUM, fontSize:28, fontWeight:800, color:typeColor, marginBottom:8 }}>
                  {tipo==="despesa" ? "−" : "+"}R${" "}{valorNum.toLocaleString("pt-BR",{minimumFractionDigits:2})}
                </div>
                {desc && <div style={{ ...G, fontSize:13, color:T.inkMid, textAlign:"center", marginBottom:36, maxWidth:280, lineHeight:1.5 }}>{desc}</div>}
                <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%", maxWidth:320 }}>
                  {!isRecurrence && (
                    <button onClick={handleNewTransaction}
                      style={{ ...G, width:"100%", padding:"14px", borderRadius:12, border:"none", background:T.ink, fontSize:14, fontWeight:700, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"opacity 0.15s" }}
                      onMouseEnter={e=>e.currentTarget.style.opacity="0.85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                      <Plus size={15}/> Nova transação
                    </button>
                  )}
                  <button onClick={beginClose}
                    style={{ ...G, width:"100%", padding:"13px", borderRadius:12, border:`1px solid ${T.border}`, background:T.surface, fontSize:14, fontWeight:600, color:T.inkMid, cursor:"pointer", transition:"background 0.15s" }}
                    onMouseEnter={e=>e.currentTarget.style.background=T.bg} onMouseLeave={e=>e.currentTarget.style.background=T.surface}>
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}

          {!successOverlay && <>
          {/* Handle */}
          <div style={{ display:"flex", justifyContent:"center", padding:"10px 0 4px" }}>
            <div style={{ width:36, height:4, borderRadius:99, background:T.inkGhost }} />
          </div>

          {/* Step dots + header */}
          <div style={{ padding:"4px 20px 12px", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
            {/* Progress dots */}
            <div style={{ display:"flex", justifyContent:"center", gap:5, marginBottom:10 }}>
              {mStepsFlow.map((s, i) => (
                <div key={s} style={{ width: s === mStep ? 18 : 6, height:6, borderRadius:99, background: i < mCurrentIdx ? T.inkGhost : s === mStep ? T.ink : T.border, transition:"all 0.25s" }} />
              ))}
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em" }}>
                  Step {mCurrentIdx + 1} de {mTotalSteps}
                </div>
                <div style={{ ...G, fontSize:16, fontWeight:800, color:T.ink, marginTop:1 }}>{stepLabel[mStep]}</div>
              </div>
              <button onClick={beginClose} style={{ background:T.grayLight, border:"none", cursor:"pointer", padding:7, borderRadius:9, display:"flex" }}>
                <X size={16} color={T.inkMid} />
              </button>
            </div>
          </div>

          {/* Scrollable step content */}
          <div style={{ flex:1, overflowY:"auto" }}>

            {/* ── STEP 1: Tipo + Valor + Descrição ── */}
            {mStep === 1 && (
              <div style={{ padding:"18px 20px", display:"flex", flexDirection:"column", gap:16, ...mobileStepInStyle }}>
                {/* Tipo tabs */}
                <div style={{ display:"flex", background:T.grayLight, borderRadius:11, padding:3, gap:2 }}>
                  {[["despesa","↑ Despesa",T.red],["receita","↓ Receita",T.green]].map(([t, label, color]) => (
                    <button key={t} onClick={() => handleSetTipo(t)}
                      style={{ ...G, flex:1, padding:"10px 0", borderRadius:9, border:"none", fontSize:13, fontWeight:700, cursor:"pointer",
                        background: tipo === t ? T.surface : "transparent",
                        color: tipo === t ? color : T.inkMid,
                        boxShadow: tipo === t ? T.sm : "none",
                        transition:"all 0.18s" }}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Valor — hero */}
                <div style={{ textAlign:"center" }}>
                  <div style={{ ...G, fontSize:13, fontWeight:600, color:T.inkLight, marginBottom:4 }}>Valor</div>
                  <div style={{ display:"flex", alignItems:"baseline", justifyContent:"center", gap:6 }}>
                    <span style={{ ...G, fontSize:22, fontWeight:700, color:T.inkLight }}>R$</span>
                    <input
                      ref={valorInputRef}
                      value={valor}
                      onChange={() => {}}
                      onKeyDown={handleValorKey}
                      placeholder="0,00"
                      inputMode="numeric"
                      style={{
                        ...G,
                        ...NUM,
                        fontSize: 48,
                        fontWeight: 800,
                        color: centavos === 0 ? T.inkGhost : T.ink,
                        border: "none",
                        outline: "none",
                        background: "transparent",
                        letterSpacing: "-0.02em",
                        width: "100%",
                        maxWidth: 240,
                        textAlign: "center",
                      }}
                    />
                  </div>
                  {/* Parcela + saldo — same row, pill style */}
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginTop:6, flexWrap:"wrap" }}>
                    {method === "credito" && modalidade === "parcelado" && parcelas > 1 && valorNum > 0 && (
                      <span style={{ ...G, ...NUM, display:"inline-flex", alignItems:"center",
                        fontSize:13, fontWeight:700, color:T.blue,
                        background:T.blueLight, padding:"3px 10px", borderRadius:99 }}>
                        {parcelas}× R$ {(valorNum/parcelas).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}
                      </span>
                    )}
                    {periodSaldo.live ? (
                      <span style={{ ...G, fontSize:11, color:T.inkLight }}>
                        {periodSaldo.loading ? (
                          <>Saldo no mês: …</>
                        ) : periodSaldo.error ? (
                          <>Saldo no mês indisponível</>
                        ) : (
                          <>
                            Saldo no mês:{" "}
                            <span style={{ color:T.blue, fontWeight:600 }}>{fmtSaldoLine(periodSaldo.periodBalance)}</span>
                            {valorNum > 0 && saldoAposLancamento != null ? (
                              <>
                                {" · "}
                                Após:{" "}
                                <span
                                  style={{
                                    color: saldoAposLancamento >= 0 ? T.green : T.red,
                                    fontWeight: 600,
                                  }}
                                >
                                  {fmtSaldoLine(saldoAposLancamento)}
                                </span>
                              </>
                            ) : null}
                          </>
                        )}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Toggle Estorno — só na aba Despesa, abaixo do VALOR (mobile) */}
                {tipo === "despesa" && (
                  <button
                    type="button"
                    onClick={() => setIsEstorno((v) => !v)}
                    style={{
                      ...G,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: `1px solid ${isEstorno ? T.green : T.border}`,
                      background: isEstorno ? T.greenLight : T.surface,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <RotateCcw size={16} color={isEstorno ? T.green : T.inkMid} />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: isEstorno ? T.green : T.ink }}>
                      {isEstorno ? "Lançando como estorno" : "Isto é um estorno?"}
                    </span>
                    <span
                      aria-hidden
                      style={{
                        width: 32,
                        height: 18,
                        borderRadius: 9999,
                        background: isEstorno ? T.green : T.border,
                        position: "relative",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: 2,
                          left: isEstorno ? 16 : 2,
                          width: 14,
                          height: 14,
                          borderRadius: 9999,
                          background: "#fff",
                          transition: "left 0.15s",
                        }}
                      />
                    </span>
                  </button>
                )}

                {renderRefundLinkBlock("mobile")}

                {/* Descrição */}
                <div>
                  <div style={{ ...G, fontSize:12, fontWeight:600, color:T.inkMid, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                    Descrição
                    <span style={{ ...G, fontSize:10, fontWeight:700, color:T.purple, background:T.purpleLight, padding:"1px 7px", borderRadius:99, display:"flex", alignItems:"center", gap:3 }}>
                      <Star size={8} fill={T.purple} /> IA
                    </span>
                  </div>
                  <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex: Mercado Extra, academia..."
                    style={{ ...G, width:"100%", padding:"13px 14px", borderRadius:12, border:`1px solid ${T.border}`, fontSize:15, color:T.ink, outline:"none", background:T.surface, transition:"border-color 0.15s" }}
                    onFocus={e => e.target.style.borderColor = T.blue}
                    onBlur={e => e.target.style.borderColor = T.border} />

                  {/* AI chip */}
                  {aiSuggestion && !aiApplied && (
                    <button onClick={applyAi}
                      style={{ ...G, marginTop:8, width:"100%", display:"flex", alignItems:"center", gap:8, padding:"10px 14px", background:T.purpleLight, border:`1px solid ${T.purple}33`, borderRadius:10, cursor:"pointer", textAlign:"left" }}>
                      <Star size={12} fill={T.purple} color={T.purple} style={{ flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <span style={{ ...G, fontSize:11, color:T.purple, fontWeight:700 }}>IA identificou: </span>
                        <span style={{ ...G, fontSize:11, color:T.ink }}>{aiSuggestion.cat}</span>
                        <span style={{ ...G, fontSize:11, color:T.inkMid }}> · {aiSuggestion.tags.map(t => `#${t}`).join(" ")}</span>
                      </div>
                      <span style={{ ...G, fontSize:10, fontWeight:700, color:T.purple }}>Aplicar →</span>
                    </button>
                  )}
                  {aiApplied && (
                    <div style={{ ...G, marginTop:8, display:"flex", alignItems:"center", gap:6, padding:"8px 12px", background:T.greenLight, borderRadius:9 }}>
                      <Check size={11} color={T.green} strokeWidth={2.5} />
                      <span style={{ fontSize:11, color:T.green, fontWeight:600 }}>Categoria e tags aplicadas automaticamente</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 2: Categoria + Método + Recorrência ── */}
            {mStep === 2 && (
              <div style={{ padding:"18px 20px", display:"flex", flexDirection:"column", gap:18, ...mobileStepInStyle }}>

                {/* Categoria */}
                <div>
                  <div style={{ ...G, fontSize:12, fontWeight:600, color:T.inkMid, marginBottom:10 }}>Categoria</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {modalCategoryChoices.map((row) => (
                      <button key={row.id || row.labelPt} onClick={() => { setCat(row.labelPt); setCategoryTagId(row.id); setDetailTagIds([]); setDetailTagLabelById({}); }}
                        style={{ ...G, display:"flex", alignItems:"center", gap:5, padding:"8px 12px", borderRadius:99, border:`1.5px solid ${cat === row.labelPt ? T.ink : T.border}`, background:cat === row.labelPt ? T.ink : T.surface, color:cat === row.labelPt ? "#fff" : T.inkMid, fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.15s" }}>
                        <CategoryLucideIcon iconKey={row.iconKey} labelPt={row.labelPt} size={15} color={cat === row.labelPt ? "#fff" : T.inkMid} />
                        {row.labelPt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ ...G, fontSize:12, fontWeight:600, color:T.inkMid, marginBottom:10 }}>Data</div>
                  <LocaleDatePicker
                    id="nova-tx-date-mobile"
                    variant="mobile"
                    locale={APP_UI_LOCALE}
                    value={txDateYmd}
                    onChange={(v) => {
                      setTxDateYmd(v);
                      writeStoredNovaTransacaoDate(organizationId, v);
                    }}
                  />
                </div>

                {/* Método de pagamento */}
                <div>
                  <div style={{ ...G, fontSize:12, fontWeight:600, color:T.inkMid, marginBottom:10 }}>Forma de pagamento</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {methodsList.map(([id, label]) => (
                      <button key={id} onClick={() => setMethod(id)}
                        style={{ ...G, flex:1, minWidth:70, padding:"10px 8px", borderRadius:10, border:`1.5px solid ${method === id ? T.ink : T.border}`, background:method === id ? T.ink : T.surface, color:method === id ? "#fff" : T.inkMid, fontSize:12, fontWeight:600, cursor:"pointer", textAlign:"center", transition:"all 0.15s" }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recorrência toggle — escondido em modo estorno (v1: refund não pode ser recorrente) */}
                {!isEstorno && (
                  <div onClick={() => { setRecorre(r => { if (!r) setMod("avista"); return !r; }); }}
                    style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", background:recorre ? T.blueLight : T.bg, borderRadius:12, border:`1px solid ${recorre ? T.blue : T.border}`, cursor:"pointer", transition:"all 0.18s" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <Repeat size={16} color={recorre ? T.blue : T.inkLight} />
                      <div>
                        <div style={{ ...G, fontSize:13, fontWeight:600, color:T.ink }}>Transação recorrente</div>
                        <div style={{ ...G, fontSize:11, color:T.inkLight, marginTop:1 }}>Repetir automaticamente</div>
                      </div>
                    </div>
                    <div style={{ width:42, height:24, borderRadius:12, background:recorre ? T.blue : T.inkGhost, position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                      <div style={{ position:"absolute", top:3, left:recorre ? 21 : 3, width:18, height:18, borderRadius:9999, background:"#fff", transition:"left 0.2s", boxShadow:T.sm }} />
                    </div>
                  </div>
                )}

                {/* Tags */}
                <div>
                  <div style={{ ...G, fontSize:12, fontWeight:600, color:T.inkMid, marginBottom:10 }}>Tags</div>
                  {detailTagsError ? (
                    <div style={{ ...G, fontSize:11, color:T.red, marginBottom:8 }}>{detailTagsError}</div>
                  ) : null}
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
                    {useLiveDetailTags
                      ? detailTagIds.map((id) => (
                          <span key={id} onClick={() => {
                            const sid = String(id);
                            setDetailTagIds((prev) => prev.filter((x) => String(x) !== sid));
                            setDetailTagLabelById((prev) => {
                              const next = { ...prev };
                              delete next[sid];
                              return next;
                            });
                          }}
                            style={{ ...G, fontSize:12, fontWeight:600, color:"#fff", background:T.purple, padding:"5px 11px", borderRadius:9999, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
                            + {detailChipLabel(id)} <span style={{ opacity:0.7, fontSize:10 }}>✕</span>
                          </span>
                        ))
                      : tags.map((tag) => (
                          <span key={tag} onClick={() => setTags((ts) => ts.filter((t) => t !== tag))}
                            style={{ ...G, fontSize:12, fontWeight:600, color:"#fff", background:T.purple, padding:"5px 11px", borderRadius:9999, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
                            + {tag} <span style={{ opacity:0.7, fontSize:10 }}>✕</span>
                          </span>
                        ))}
                    {detailTagRowsAvailable.map((row) => (
                      <span
                        key={row.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.preventDefault();
                          addDetailTagByRow(row);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            addDetailTagByRow(row);
                          }
                        }}
                        style={{ ...G, fontSize:12, color:T.inkMid, background:T.grayLight, padding:"5px 11px", borderRadius:9999, cursor:"pointer" }}
                      >
                        {row.name}
                      </span>
                    ))}
                    {NOVA_TX_QUICK_DETAIL_LABELS.filter((t) => {
                      if (!useLiveDetailTags) return !tags.includes(t);
                      if (findByLabel(t)) return false;
                      return true;
                    }).map((t) => (
                      <span key={t} role="button" tabIndex={0}
                        onClick={(e) => { e.preventDefault(); void addQuickDetailTag(t); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void addQuickDetailTag(t); } }}
                        style={{ ...G, fontSize:12, color:T.inkMid, background:T.grayLight, padding:"5px 11px", borderRadius:9999, cursor:"pointer" }}>{t}</span>
                    ))}
                    {addingTag ? (
                      <input autoFocus value={newTag} onChange={e => setNewTag(e.target.value)}
                        onKeyDown={e => { if(e.key==="Enter"&&newTag.trim()){ if(useLiveDetailTags) void addQuickDetailTag(newTag.trim()); else setTags(ts=>[...ts,newTag.trim()]); setNewTag("");setAddingTag(false);} if(e.key==="Escape"){setNewTag("");setAddingTag(false);} }}
                        onBlur={() => { if(newTag.trim()){ if(useLiveDetailTags) void addQuickDetailTag(newTag.trim()); else setTags(ts=>[...ts,newTag.trim()]); } setNewTag(""); setAddingTag(false); }}
                        style={{ ...G, fontSize:12, color:T.blue, border:`1px dashed ${T.blue}`, padding:"4px 10px", borderRadius:9999, outline:"none", width:90, background:"transparent" }} />
                    ) : (
                      <span onClick={() => setAddingTag(true)} style={{ ...G, fontSize:12, color:T.blue, border:`1px dashed ${T.blue}`, padding:"4px 10px", borderRadius:9999, cursor:"pointer" }}>+ nova</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP CARTÃO ── */}
            {mStep === "cartao" && (
              <div style={{ padding:"18px 20px", display:"flex", flexDirection:"column", gap:16, ...mobileStepInStyle }}>
                <div>
                  <div style={{ ...G, fontSize:12, fontWeight:600, color:T.inkMid, marginBottom:10 }}>Selecionar cartão</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {organizationId && dataMode === "live" && modalCardsLoading && modalCardsRows.length === 0 ? (
                      <div style={{ ...G, fontSize:12, color:T.inkLight, padding:"12px 0" }}>Carregando cartões…</div>
                    ) : organizationId && dataMode === "live" && modalCardsError ? (
                      <div style={{ ...G, fontSize:12, color:T.red, padding:"12px 0" }}>{modalCardsError}</div>
                    ) : cartoes.filter(c => !c.novo).length === 0 ? (
                      <div style={{ ...G, fontSize:12, color:T.inkLight, padding:"12px 0" }}>
                        Nenhum cartão cadastrado. Use &quot;+ Novo cartão&quot; no painel desktop ou cadastre em Cartões.
                      </div>
                    ) : null}
                    {!(organizationId && dataMode === "live" && modalCardsLoading && modalCardsRows.length === 0) &&
                      !modalCardsError &&
                      cartoes.filter(c => !c.novo).map(c => (
                      <div key={c.id} onClick={() => setCartao(c.id)}
                        style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderRadius:14, border:`2px solid ${cartao === c.id ? T.ink : T.border}`, background:cartao === c.id ? T.ink : T.surface, cursor:"pointer", transition:"all 0.15s" }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ ...G, fontSize:8, fontWeight:700, color:cartao===c.id?"rgba(255,255,255,0.5)":T.inkLight, letterSpacing:"0.08em", marginBottom:2 }}>{c.banco}</div>
                          <div style={{ ...G, fontSize:14, fontWeight:700, color:cartao===c.id?"#fff":T.ink }}>{c.nome}</div>
                          <div style={{ ...G, ...NUM, fontSize:10, color:cartao===c.id?"rgba(255,255,255,0.5)":T.inkLight, marginTop:1 }}>···· {c.dig}</div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ ...G, ...NUM, fontSize:13, fontWeight:700, color:cartao===c.id?"#86efac":T.green }}>R$ {c.disp.toLocaleString("pt-BR")}</div>
                          <div style={{ ...G, fontSize:10, color:cartao===c.id?"rgba(255,255,255,0.4)":T.inkLight }}>disponível</div>
                        </div>
                        {cartao===c.id && <div style={{ width:16, height:16, borderRadius:9999, background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Check size={10} color={T.ink} /></div>}
                      </div>
                    ))}
                  </div>
                </div>
                {!isEstorno && (
                  <div>
                    <div style={{ ...G, fontSize:12, fontWeight:600, color:T.inkMid, marginBottom:10 }}>Modalidade</div>
                    <div style={{ display:"flex", gap:8 }}>
                      {[["avista","À vista","1× sem juros"],["parcelado","Parcelado","Dividir em parcelas"]].map(([id, label, sub]) => {
                        const disabled = id === "parcelado" && recorre;
                        const selected = modalidade === id;
                        return (
                          <button key={id} onClick={() => !disabled && setMod(id)}
                            style={{ flex:1, padding:"12px", borderRadius:12,
                              border:`1.5px solid ${disabled ? T.border : selected ? T.ink : T.border}`,
                              background: disabled ? T.grayLight : selected ? T.ink : T.surface,
                              cursor: disabled ? "not-allowed" : "pointer",
                              textAlign:"left", transition:"all 0.15s", opacity: disabled ? 0.5 : 1 }}>
                            <div style={{ ...G, fontSize:13, fontWeight:700, color: disabled ? T.inkGhost : selected?"#fff":T.ink }}>{label}</div>
                            <div style={{ ...G, fontSize:10, color: disabled ? T.inkGhost : selected?"rgba(255,255,255,0.5)":T.inkLight, marginTop:2 }}>
                              {disabled ? "Indisponível com recorrência" : sub}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {isEstorno && (
                  <div style={{ ...G, fontSize:11, color:T.inkMid, padding:"10px 12px", background:T.greenLight, borderRadius:10, border:`1px solid ${T.green}33` }}>
                    <strong style={{ color:T.green }}>↺ Estorno em cartão:</strong> sempre 1 parcela na fatura cuja janela contém a data — sem opção de parcelamento.
                  </div>
                )}
                {!isEstorno && modalidade === "parcelado" && (
                  <div>
                    <div style={{ ...G, fontSize:12, fontWeight:600, color:T.inkMid, marginBottom:10 }}>Parcelas</div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                      {parcs.map(p => (
                        <button key={p} onClick={() => setParcelas(p)} style={{ padding:"10px 4px", borderRadius:10, border:`1.5px solid ${parcelas===p ? T.ink : T.border}`, background:parcelas===p ? T.ink : T.surface, cursor:"pointer", textAlign:"center", transition:"all 0.15s" }}>
                          <div style={{ ...G, fontSize:13, fontWeight:700, color:parcelas===p?"#fff":T.ink }}>{p}×</div>
                          <div style={{ ...G, ...NUM, fontSize:10, color:parcelas===p?"rgba(255,255,255,0.5)":T.inkLight, marginTop:1 }}>{valorNum > 0 ? `R$${(valorNum/p).toFixed(0)}` : "—"}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Aviso academia */}
                {recorre && modalidade === "avista" && (
                  <div style={{ display:"flex", gap:8, padding:"10px 12px", background:T.amberLight, border:`1px solid ${T.amber}44`, borderRadius:10 }}>
                    <span style={{ fontSize:14, flexShrink:0 }}>⚠️</span>
                    <span style={{ ...G, fontSize:11, color:T.inkMid, lineHeight:1.55 }}>Recorrente + à vista: será cobrado <strong style={{ color:T.ink }}>1× por mês</strong> no cartão selecionado.</span>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP RECORRÊNCIA ── */}
            {mStep === "recorrencia" && (
              <div style={{ padding:"18px 20px", ...mobileStepInStyle }}>
                {renderRecurrenceConfigBody(true)}
              </div>
            )}

            {/* ── REVIEW ── */}
            {mStep === "review" && ReviewBody({ mobile: true })}

          </div>

          {/* Footer with navigation */}
          <div style={{ padding:"14px 20px", borderTop:`1px solid ${T.border}`, background:T.surface, flexShrink:0 }}>
            {txSubmitError && (
              <div style={{ ...G, fontSize:12, fontWeight:600, color:T.red, marginBottom:10, textAlign:"center" }}>{txSubmitError}</div>
            )}
            {mStep === "review" ? (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {!desc.trim() && (
                  <div style={{ ...G, fontSize:12, fontWeight:600, color:T.red, display:"flex", alignItems:"center", gap:6, padding:"8px 12px", background:`${T.red}11`, borderRadius:8 }}>
                    <AlertTriangle size={13} color={T.red} /> Volte e adicione uma descrição para confirmar.
                  </div>
                )}
                <div style={{ display:"flex", gap:10 }}>
                <button onClick={goPrev} style={{ ...G, display:"flex", alignItems:"center", gap:5, padding:"13px 16px", borderRadius:12, border:`1px solid ${T.border}`, background:T.surface, fontSize:14, fontWeight:600, color:T.inkMid, cursor:"pointer" }}>
                  <ChevronLeft size={16} /> Editar
                </button>
                <button onClick={handleSave} disabled={txSubmitting || !desc.trim()}
                  style={{ ...G, flex:1, padding:"13px", borderRadius:12, border:"none", background:success ? T.green : (!desc.trim() ? T.inkGhost : typeColor), fontSize:14, fontWeight:800, color:"#fff", cursor:(txSubmitting || !desc.trim()) ? "not-allowed" : "pointer", opacity:(txSubmitting || !desc.trim()) ? 0.75 : 1, display:"flex", alignItems:"center", justifyContent:"center", gap:7, transition:"background 0.25s" }}>
                  {success ? <><Check size={16} /> {recorre || novaRecorrencia ? "Recorrência salva!" : "Registrado!"}</> : (recorre || novaRecorrencia ? "Confirmar recorrência" : (txSubmitting ? "Enviando…" : `Confirmar ${tipo === "despesa" ? (isEstorno ? "estorno" : "despesa") : "receita"}`))}
                </button>
              </div>
              </div>
            ) : (
              <div style={{ display:"flex", gap:10 }}>
                {mPrevStep !== null && (
                  <button onClick={goPrev} style={{ ...G, width:48, height:50, borderRadius:12, border:`1px solid ${T.border}`, background:T.surface, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 }}>
                    <ChevronLeft size={18} color={T.inkMid} />
                  </button>
                )}
                <button onClick={goNext} disabled={mStep === 1 && !valorNum}
                  style={{ ...G, flex:1, padding:"13px", borderRadius:12, border:"none", background: (mStep === 1 && !valorNum) ? T.inkGhost : T.ink, fontSize:14, fontWeight:800, color:"#fff", cursor:(mStep===1&&!valorNum)?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7, transition:"background 0.2s" }}>
                  {mNextLabel()}
                </button>
              </div>
            )}
          </div>
          </>}
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
     DESKTOP — original drawer (preserved)
  ════════════════════════════════════════════════════════════ */
  return (
    <div style={{ position:"fixed", inset:0, zIndex:200, overflow:"hidden", display:"flex", justifyContent:"flex-end" }}>
      <style>{`
        @keyframes drawerIn    { from { transform:translateX(100%); opacity:0 } to { transform:translateX(0); opacity:1 } }
        @keyframes drawerOut   { from { transform:translateX(0); opacity:1 } to { transform:translateX(100%); opacity:1 } }
        @keyframes novaSidePanelContentIn { from { opacity:0; transform:translateX(22px) } to { opacity:1; transform:translateX(0) } }
        @keyframes novaSidePanelContentOut { from { opacity:1; transform:translateX(0) } to { opacity:0; transform:translateX(22px) } }
        @keyframes novaSideShellIn250 { from { max-width:0 } to { max-width:250px } }
        @keyframes novaSideShellOut250 { from { max-width:250px } to { max-width:0 } }
        @keyframes novaSideShellIn280 { from { max-width:0 } to { max-width:280px } }
        @keyframes novaSideShellOut280 { from { max-width:280px } to { max-width:0 } }
        @keyframes revSlideIn  { from { transform:translateX(28px); opacity:0 } to { transform:translateX(0); opacity:1 } }
        @keyframes revSlideBack{ from { transform:translateX(-28px); opacity:0 } to { transform:translateX(0); opacity:1 } }
        @keyframes successPop  { 0%{transform:scale(1)} 40%{transform:scale(1.04)} 100%{transform:scale(1)} }
        @keyframes overlayContentIn { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes checkBounce  { from { opacity:0; transform:scale(0.4) } to { opacity:1; transform:scale(1) } }
      `}</style>
      <div onClick={beginClose} style={{ position:"absolute", inset:0, background:"rgba(15,23,35,0.18)" }} />
      <div style={{ position:"relative", display:"flex", height:"100vh", boxShadow:T.dark, animation: drawerClosing ? `drawerOut ${DRAWER_CLOSE_MS}ms cubic-bezier(0.32,0.72,0,1) forwards` : "drawerIn 0.22s ease-out" }}>

        {/* SUB-PANEL: Recorrência — shell colapsa no flex (evita “fantasma” de borda); conteúdo faz fade+slide */}
        {(panelRecorrenciaOpen || panelRecorrenciaExiting) && (
          <div
            style={{
              flexShrink: 0,
              minWidth: 0,
              overflow: "hidden",
              boxSizing: "border-box",
              alignSelf: "stretch",
              animation: panelRecorrenciaExiting
                ? `novaSideShellOut250 ${SIDE_PANEL_MS}ms cubic-bezier(0.32,0.72,0,1) forwards`
                : `novaSideShellIn250 ${SIDE_PANEL_MS}ms cubic-bezier(0.32,0.72,0,1) both`,
            }}
            onAnimationEnd={(e) => {
              if (e.target !== e.currentTarget) return;
              setPanelRecorrenciaExiting((ex) => (ex ? false : ex));
            }}
          >
            <div
              style={{
                width: 250,
                boxSizing: "border-box",
                background: T.surface,
                borderLeft: `1px solid ${T.border}`,
                display: "flex",
                flexDirection: "column",
                minHeight: "100vh",
                animation: panelRecorrenciaExiting
                  ? `novaSidePanelContentOut ${SIDE_PANEL_MS}ms cubic-bezier(0.32,0.72,0,1) forwards`
                  : `novaSidePanelContentIn ${SIDE_PANEL_MS}ms cubic-bezier(0.32,0.72,0,1) both`,
              }}
            >
            <PanelHeader icon={Repeat} title="Recorrência" onCollapse={beginCloseRecorrenciaPanel} />
            <div style={{ flex:1, overflowY:"auto", padding:"16px 18px", display:"flex", flexDirection:"column", gap:18 }}>
              {renderRecurrenceConfigBody(false)}
              {/* Tipo de valor */}
              <div>
                <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>Tipo de valor</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                  {[
                    { id:"fixo",     label:"Valor fixo",      sub:"Mesmo valor todo mês",             icon:"🔒" },
                    { id:"estimado", label:"Valor estimado",   sub:"Varia, mas use como referência",   icon:"≈"  },
                  ].map(opt => (
                    <button key={opt.id} onClick={() => setValorTipoRec(opt.id)}
                      style={{ padding:"10px 12px", borderRadius:9, textAlign:"left", cursor:"pointer",
                        border:`1.5px solid ${valorTipoRec===opt.id ? T.ink : T.border}`,
                        background:valorTipoRec===opt.id ? T.ink : T.surface,
                        transition:"all 0.15s" }}>
                      <div style={{ ...G, fontSize:13, marginBottom:2 }}>{opt.icon}</div>
                      <div style={{ ...G, fontSize:12, fontWeight:700, color:valorTipoRec===opt.id?"#fff":T.ink }}>{opt.label}</div>
                      <div style={{ ...G, fontSize:10, color:valorTipoRec===opt.id?"rgba(255,255,255,0.55)":T.inkLight, marginTop:2, lineHeight:1.4 }}>{opt.sub}</div>
                    </button>
                  ))}
                </div>
                {valorTipoRec==="estimado" && (
                  <div style={{ display:"flex", alignItems:"flex-start", gap:7, background:T.amberLight,
                    border:`1px solid ${T.amber}33`, borderRadius:9, padding:"8px 11px", marginTop:8 }}>
                    <AlertTriangle size={12} color={T.amber} style={{ flexShrink:0, marginTop:1 }} />
                    <span style={{ ...G, fontSize:11, color:T.inkMid, lineHeight:1.55 }}>
                      O valor informado serve como referência nas projeções. Você pode atualizar o valor real a qualquer momento diretamente na tela de Recorrências.
                    </span>
                  </div>
                )}
              </div>
              {!novaRecorrencia && (
                <button onClick={beginCloseRecorrenciaPanel} style={{ ...G, width:"100%", padding:"11px", borderRadius:10, border:"none", background:T.ink, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                  Confirmar recorrência
                </button>
              )}
            </div>
            </div>
          </div>
        )}

        {/* SUB-PANEL: Cartão — mesmo padrão: shell + conteúdo (recorrência acompanha no flex ao fechar o cartão) */}
        {(panelCartaoOpen || panelCartaoExiting) && (
          <div
            style={{
              flexShrink: 0,
              minWidth: 0,
              overflow: "hidden",
              boxSizing: "border-box",
              alignSelf: "stretch",
              animation: panelCartaoExiting
                ? `novaSideShellOut280 ${SIDE_PANEL_MS}ms cubic-bezier(0.32,0.72,0,1) forwards`
                : `novaSideShellIn280 ${SIDE_PANEL_MS}ms cubic-bezier(0.32,0.72,0,1) both`,
            }}
            onAnimationEnd={(e) => {
              if (e.target !== e.currentTarget) return;
              setPanelCartaoExiting((ex) => (ex ? false : ex));
            }}
          >
            <div
              style={{
                width: 280,
                boxSizing: "border-box",
                background: T.surface,
                borderLeft: `1px solid ${T.border}`,
                display: "flex",
                flexDirection: "column",
                minHeight: "100vh",
                animation: panelCartaoExiting
                  ? `novaSidePanelContentOut ${SIDE_PANEL_MS}ms cubic-bezier(0.32,0.72,0,1) forwards`
                  : `novaSidePanelContentIn ${SIDE_PANEL_MS}ms cubic-bezier(0.32,0.72,0,1) both`,
              }}
            >
            <PanelHeader icon={CreditCard} title="Cartão de crédito" onCollapse={beginCloseCartaoPanel} />
            <div style={{ flex:1, overflowY:"auto", padding:"16px 18px", display:"flex", flexDirection:"column", gap:16 }}>
              <div>
                <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:10 }}>Selecionar Cartão</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {organizationId && dataMode === "live" && modalCardsLoading && modalCardsRows.length === 0 ? (
                    <div style={{ ...G, gridColumn:"1 / -1", fontSize:12, color:T.inkLight, padding:"16px 8px" }}>Carregando cartões…</div>
                  ) : organizationId && dataMode === "live" && modalCardsError ? (
                    <div style={{ ...G, gridColumn:"1 / -1", fontSize:12, color:T.red, padding:"16px 8px" }}>{modalCardsError}</div>
                  ) : (
                  cartoes.map(c => (
                    <div key={c.id} onClick={() => !c.novo && setCartao(c.id)}
                      style={{ padding:"12px", borderRadius:10, border:`2px solid ${cartao===c.id&&!c.novo ? T.ink : T.border}`, cursor:"pointer", background:c.novo ? T.bg : cartao===c.id ? T.ink : T.surface, transition:"all 0.12s", position:"relative", display:"flex", flexDirection:"column", gap:3, alignItems:c.novo?"center":"flex-start", justifyContent:c.novo?"center":"flex-start", minHeight:72 }}>
                      {c.novo ? (
                        <div onClick={e=>{e.stopPropagation();setAddingCartao(true);}}
                          style={{ ...G, fontSize:11, color:T.blue, display:"flex", alignItems:"center", gap:5,
                            fontWeight:700, cursor:"pointer" }}>
                          <Plus size={12} color={T.blue}/> Novo cartão
                        </div>
                      ) : (
                        <>
                          <div style={{ ...G, fontSize:8, fontWeight:700, color:cartao===c.id?"rgba(255,255,255,0.6)":T.inkLight, letterSpacing:"0.08em" }}>{c.banco}</div>
                          <div style={{ ...G, fontSize:12, fontWeight:700, color:cartao===c.id?"#fff":T.ink }}>{c.nome}</div>
                          <div style={{ ...G, ...NUM, fontSize:10, color:cartao===c.id?"rgba(255,255,255,0.5)":T.inkLight }}>···· {c.dig}</div>
                          <div style={{ ...G, ...NUM, fontSize:10, fontWeight:700, color:cartao===c.id?"#86efac":T.green, marginTop:2 }}>R$ {c.disp.toLocaleString("pt-BR")} disp.</div>
                          {cartao===c.id && <div style={{ position:"absolute", top:7, right:7, width:14, height:14, borderRadius:9999, background:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}><Check size={9} color={T.ink} /></div>}
                        </>
                      )}
                    </div>
                  )))}
                </div>
              </div>
              {addingCartao && (
                <div style={{ background:T.bg, border:`1px solid ${T.blue}33`, borderRadius:10, padding:"12px 14px",
                  animation:"revSlideIn 0.18s ease-out" }}>
                  <div style={{ ...G, fontSize:11, fontWeight:700, color:T.blue, marginBottom:10 }}>
                    Adicionar cartão
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    <input value={quickAddCardName} onChange={e=>setQuickAddCardName(e.target.value)}
                      placeholder="Nome (ex: Nubank Roxinho)"
                      style={{ ...G, padding:"8px 10px", borderRadius:8, border:`1px solid ${T.border}`,
                        fontSize:12, color:T.ink, outline:"none", background:T.surface,
                        transition:"border-color 0.15s" }}
                      onFocus={e=>e.target.style.borderColor=T.blue}
                      onBlur={e=>e.target.style.borderColor=T.border}/>
                    <input value={quickAddCardLast4} onChange={e=>setQuickAddCardLast4(e.target.value.slice(0,4))}
                      placeholder="4 últimos dígitos" maxLength={4}
                      style={{ ...G, ...NUM, padding:"8px 10px", borderRadius:8, border:`1px solid ${T.border}`,
                        fontSize:12, color:T.ink, outline:"none", background:T.surface,
                        transition:"border-color 0.15s" }}
                      onFocus={e=>e.target.style.borderColor=T.blue}
                      onBlur={e=>e.target.style.borderColor=T.border}/>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={()=>{setAddingCartao(false);setQuickAddCardName("");setQuickAddCardLast4("");}}
                        style={{ ...G, flex:1, padding:"7px", borderRadius:8, border:`1px solid ${T.border}`,
                          background:T.surface, fontSize:11, fontWeight:600, color:T.inkMid, cursor:"pointer" }}>
                        Cancelar
                      </button>
                      <button
                        disabled={!quickAddCardName||quickAddCardLast4.length<4}
                        onClick={()=>{
                          setAddingCartao(false); setQuickAddCardName(""); setQuickAddCardLast4("");
                        }}
                        style={{ ...G, flex:1, padding:"7px", borderRadius:8, border:"none",
                          background:quickAddCardName&&quickAddCardLast4.length===4?T.blue:T.inkGhost,
                          fontSize:11, fontWeight:700, color:"#fff",
                          cursor:quickAddCardName&&quickAddCardLast4.length===4?"pointer":"not-allowed", transition:"background 0.15s" }}>
                        Adicionar
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {!isEstorno && (
                <div>
                  <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>Modalidade</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                    {[["avista","À vista","1× sem juros"],["parcelado","Parcelado","Dividir em parcelas"]].map(([id,label,sub]) => {
                      const disabled = id === "parcelado" && recorre;
                      const selected = modalidade === id;
                      return (
                        <button key={id} onClick={() => !disabled && setMod(id)}
                          style={{ padding:"10px 12px", borderRadius:9,
                            border:`1.5px solid ${disabled ? T.border : selected ? T.ink : T.border}`,
                            background: disabled ? T.grayLight : selected ? T.ink : T.surface,
                            cursor: disabled ? "not-allowed" : "pointer",
                            textAlign:"left", opacity: disabled ? 0.5 : 1, transition:"all 0.15s" }}>
                          <div style={{ ...G, fontSize:12, fontWeight:700, color: disabled ? T.inkGhost : selected?"#fff":T.ink }}>{label}</div>
                          <div style={{ ...G, fontSize:10, color: disabled ? T.inkGhost : selected?"rgba(255,255,255,0.6)":T.inkLight, marginTop:2 }}>
                            {disabled ? "Indisponível com recorrência" : sub}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {isEstorno && (
                <div style={{ ...G, fontSize:11, color:T.inkMid, padding:"10px 12px", background:T.greenLight, borderRadius:9, border:`1px solid ${T.green}33` }}>
                  <strong style={{ color:T.green }}>↺ Estorno em cartão:</strong> sempre 1 parcela na fatura cuja janela contém a data.
                </div>
              )}
              {!isEstorno && modalidade==="parcelado" && (
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <span style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em" }}>Parcelas</span>
                    <span style={{ ...G, ...NUM, fontSize:11, color:T.inkLight }}>R$ {valorNum.toFixed(2)} total</span>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
                    {parcs.map(p => (
                      <button key={p} onClick={() => setParcelas(p)} style={{ padding:"8px 4px", borderRadius:8, border:`1.5px solid ${parcelas===p ? T.ink : T.border}`, background:parcelas===p ? T.ink : T.surface, cursor:"pointer", textAlign:"center" }}>
                        <div style={{ ...G, fontSize:12, fontWeight:700, color:parcelas===p?"#fff":T.ink }}>{p}×</div>
                        <div style={{ ...G, ...NUM, fontSize:10, color:parcelas===p?"rgba(255,255,255,0.6)":T.inkLight, marginTop:2 }}>{(valorNum/p).toFixed(2)}</div>
                      </button>
                    ))}
                    {parcelasCustom ? (
                      <div style={{ padding:"4px", borderRadius:8, border:`1.5px solid ${T.ink}`,
                        background:T.ink, display:"flex", flexDirection:"column",
                        alignItems:"center", justifyContent:"center", gap:2 }}>
                        <input
                          autoFocus
                          value={parcelasInput}
                          onChange={e => {
                            const raw = e.target.value.replace(/\D/g,"");
                            setParcelasInput(raw);
                            const n = parseInt(raw);
                            if (n >= 1 && n <= 360) setParcelas(n);
                          }}
                          onBlur={() => {
                            if (!parcelasInput || parseInt(parcelasInput) < 1) {
                              setParcelasCustom(false); setParcelasInput("");
                            }
                          }}
                          onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") { setParcelasCustom(false); } }}
                          placeholder="N"
                          maxLength={3}
                          style={{ ...G, ...NUM, width:"100%", background:"transparent", border:"none",
                            outline:"none", textAlign:"center", fontSize:12, fontWeight:700,
                            color:"#fff" }} />
                        <div style={{ ...G, ...NUM, fontSize:10, color:"rgba(255,255,255,0.55)" }}>
                          {parcelasInput && valorNum > 0
                            ? (valorNum/parseInt(parcelasInput||1)).toFixed(2)
                            : "R$/parc"}
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setParcelasCustom(true); setParcelasInput(""); }}
                        style={{ padding:"8px 4px", borderRadius:8,
                          border:`1.5px solid ${!parcs.includes(parcelas)?T.ink:T.border}`,
                          background:!parcs.includes(parcelas)?T.ink:T.surface,
                          cursor:"pointer", textAlign:"center" }}>
                        <div style={{ ...G, fontSize:11, fontWeight:700,
                          color:!parcs.includes(parcelas)?"#fff":T.inkMid }}>
                          {!parcs.includes(parcelas) ? `${parcelas}×` : "outro"}
                        </div>
                        {!parcs.includes(parcelas) && valorNum > 0 && (
                          <div style={{ ...G, ...NUM, fontSize:10, color:"rgba(255,255,255,0.55)", marginTop:2 }}>
                            {(valorNum/parcelas).toFixed(2)}
                          </div>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
              {modalidade === "parcelado" && (
                <ParcelaHybrid parcelas={parcelas} valorNum={valorNum}/>
              )}
            </div>
            </div>
          </div>
        )}
        <div style={{ width:400, background:T.surface, borderLeft:`1px solid ${T.border}`, display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden" }}>
          {successOverlay && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 32px" }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", width:"100%", animation:"overlayContentIn 0.3s cubic-bezier(0.32,0.72,0,1)" }}>
                <div style={{ width:80, height:80, borderRadius:"50%", background:T.greenLight, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:22, animation:"checkBounce 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.1s both" }}>
                  <Check size={36} color={T.green} strokeWidth={2.5} />
                </div>
                <div style={{ ...G, fontSize:22, fontWeight:800, color:T.ink, textAlign:"center", marginBottom:6 }}>
                  {isRecurrence ? "Recorrência salva!" : (tipo==="despesa" ? (isEstorno ? "Estorno registrado!" : "Despesa registrada!") : "Receita registrada!")}
                </div>
                <div style={{ ...G, ...NUM, fontSize:28, fontWeight:800, color:typeColor, marginBottom:8 }}>
                  {tipo==="despesa" ? "−" : "+"}R${" "}{valorNum.toLocaleString("pt-BR",{minimumFractionDigits:2})}
                </div>
                {desc && <div style={{ ...G, fontSize:13, color:T.inkMid, textAlign:"center", marginBottom:36, maxWidth:280, lineHeight:1.5 }}>{desc}</div>}
                <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%", maxWidth:320 }}>
                  {!isRecurrence && (
                    <button onClick={handleNewTransaction}
                      style={{ ...G, width:"100%", padding:"13px", borderRadius:12, border:"none", background:T.ink, fontSize:14, fontWeight:700, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"opacity 0.15s" }}
                      onMouseEnter={e=>e.currentTarget.style.opacity="0.85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                      <Plus size={15}/> Nova transação
                    </button>
                  )}
                  <button onClick={beginClose}
                    style={{ ...G, width:"100%", padding:"12px", borderRadius:12, border:`1px solid ${T.border}`, background:T.surface, fontSize:14, fontWeight:600, color:T.inkMid, cursor:"pointer", transition:"background 0.15s" }}
                    onMouseEnter={e=>e.currentTarget.style.background=T.bg} onMouseLeave={e=>e.currentTarget.style.background=T.surface}>
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}
          {!successOverlay && <>
          <div style={{ display:"flex", flexShrink:0, borderBottom:`1px solid ${T.border}` }}>
            {[["despesa","↑ Despesa"],["receita","↓ Receita"]].map(([t,label]) => (
              <button key={t} onClick={() => !review && handleSetTipo(t)} style={{ ...G, flex:1, padding:"15px 16px", border:"none", cursor:review?"default":"pointer", fontSize:13, fontWeight:600, background:tipo===t ? T.surface : T.bg, color:tipo===t ? (t==="despesa" ? T.red : T.green) : T.inkMid, borderBottom:tipo===t ? `2px solid ${t==="despesa" ? T.red : T.green}` : "2px solid transparent", transition:"all 0.12s" }}>
                {label}
              </button>
            ))}
            <button onClick={beginClose} style={{ background:"none", border:"none", borderBottom:"2px solid transparent", padding:"0 16px", cursor:"pointer", flexShrink:0 }}>
              <X size={16} color={T.inkLight} />
            </button>
          </div>
          <div style={{ flex:1, overflowY:"auto", overflowX:"hidden" }}>
            {review ? ReviewBody() : (
              <div style={{ padding:"18px 20px", display:"flex", flexDirection:"column", gap:16, animation:"revSlideBack 0.26s ease-out", minWidth:0, width:"100%" }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                    <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em" }}>Valor</div>
                    <button onClick={() => { setParcelaMode(m=>!m); if(parcelaMode){ setPCalcCents(0); } }}
                      style={{ ...G, fontSize:10, fontWeight:700, color:parcelaMode?T.purple:T.inkMid,
                        background:parcelaMode?T.purpleLight:"none", border:`1px dashed ${parcelaMode?T.purple:T.border}`,
                        borderRadius:7, padding:"3px 9px", cursor:"pointer", display:"flex", alignItems:"center", gap:5,
                        transition:"all 0.15s" }}>
                      ÷ {parcelaMode ? "Cancelar cálculo" : "Calcular por parcela"}
                    </button>
                  </div>
                  {/* Main valor input — banking style */}
                  <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:6 }}>
                    <span style={{ ...G, fontSize:18, fontWeight:700, color:T.inkLight, flexShrink:0 }}>R$</span>
                    <input
                      ref={valorInputRef}
                      value={valor}
                      onChange={() => {}}
                      onKeyDown={handleValorKey}
                      placeholder="0,00"
                      tabIndex={0}
                      style={{ ...G, ...NUM, flex:1, fontSize:38, fontWeight:800,
                        color: centavos===0 ? T.inkGhost : T.ink,
                        border:"none", outline:"none", background:"transparent",
                        letterSpacing:"-0.02em", caretColor:T.ink, cursor:"text",
                        minWidth:0 }} />
                  </div>
                  {method === "credito" && modalidade === "parcelado" && parcelas > 1 && valorNum > 0 && (
                    <div style={{ display:"flex", alignItems:"baseline", gap:5, marginTop:4 }}>
                      <span style={{ ...G, fontSize:11, color:T.inkGhost, fontWeight:400 }}>em</span>
                      <span style={{ ...G, ...NUM, fontSize:13, fontWeight:700, color:T.inkMid }}>{parcelas}×</span>
                      <span style={{ ...G, ...NUM, fontSize:13, fontWeight:600, color:T.blue, opacity:.8 }}>
                        R$ {(valorNum/parcelas).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}
                      </span>
                    </div>
                  )}
                  {/* Parcela calculator */}
                  {parcelaMode && (
                    <div style={{ background:T.purpleLight, border:`1px solid ${T.purple}22`,
                      borderRadius:10, padding:"12px 14px", marginBottom:8,
                      animation:"successPop 0.18s ease-out",
                      display:"flex", flexDirection:"column", gap:10 }}>
                      <div style={{ ...G, fontSize:10, fontWeight:700, color:T.purple,
                        textTransform:"uppercase", letterSpacing:"0.09em" }}>
                        Calculadora de parcela
                      </div>
                      {/* Row: parcela input × N selector */}
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ display:"flex", alignItems:"baseline", gap:5, flex:"0 0 auto" }}>
                          <span style={{ ...G, fontSize:13, fontWeight:700, color:T.purple, flexShrink:0 }}>R$</span>
                          <input
                            value={pCalcCents===0 ? "" : (pCalcCents/100).toLocaleString("pt-BR",{minimumFractionDigits:2})}
                            onChange={() => {}}
                            onKeyDown={handlePCalcKey}
                            placeholder="0,00"
                            tabIndex={0}
                            autoFocus
                            style={{ ...G, ...NUM, width:100, fontSize:22, fontWeight:800, color:T.purple,
                              border:"none", outline:"none", background:"transparent",
                              letterSpacing:"-0.01em", cursor:"text", caretColor:T.purple }} />
                        </div>
                        <span style={{ ...G, fontSize:15, fontWeight:700, color:T.inkMid, flexShrink:0 }}>×</span>
                        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                          {[2,3,4,6,8,10,12].map(n => (
                            <button key={n} onClick={()=>{setPCalcN(n);setPCalcCustom(false);}}
                              style={{ ...G, ...NUM, width:32, height:32, borderRadius:8,
                                border:`1.5px solid ${pCalcN===n&&!pCalcCustom?T.purple:T.border}`,
                                background:pCalcN===n&&!pCalcCustom?T.purple:T.surface,
                                color:pCalcN===n&&!pCalcCustom?"#fff":T.inkMid,
                                fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.12s" }}>
                              {n}×
                            </button>
                          ))}
                          {pCalcCustom ? (
                            <input
                              autoFocus
                              value={pCalcCustomInput}
                              onChange={e => {
                                const raw = e.target.value.replace(/[^0-9]/g, "");
                                setPCalcCustomInput(raw);
                                const n = parseInt(raw);
                                if (n >= 1 && n <= 360) setPCalcN(n);
                              }}
                              onBlur={() => {
                                if (!pCalcCustomInput || parseInt(pCalcCustomInput) < 1) {
                                  setPCalcCustom(false);
                                  setPCalcCustomInput("");
                                  setPCalcN(2);
                                }
                              }}
                              onKeyDown={e => {
                                if (e.key === "Enter") e.target.blur();
                                if (e.key === "Escape") { setPCalcCustom(false); setPCalcCustomInput(""); setPCalcN(2); }
                              }}
                              placeholder="ex: 18"
                              maxLength={3}
                              style={{ ...G, ...NUM, width:64, height:32, borderRadius:8, textAlign:"center",
                                border:`1.5px solid ${T.purple}`, outline:"none", fontSize:13, fontWeight:700,
                                color:T.purple, background:T.purpleLight }} />
                          ) : (
                            <button onClick={() => { setPCalcCustom(true); setPCalcCustomInput(""); }}
                              style={{ ...G, width:46, height:32, borderRadius:8,
                                border:`1.5px solid ${T.border}`, background:T.surface,
                                color:T.inkMid, fontSize:11, fontWeight:600, cursor:"pointer" }}>
                              +…
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Result row + confirm */}
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                        paddingTop:8, borderTop:`1px solid ${T.purple}22` }}>
                        <div>
                          {pCalcCents > 0 ? (
                            <div style={{ ...G, fontSize:13, color:T.inkMid }}>
                              Total: <strong style={{ color:T.ink, ...NUM, fontSize:14 }}>
                                R${((pCalcCents*pCalcN)/100).toLocaleString("pt-BR",{minimumFractionDigits:2})}
                              </strong>
                            </div>
                          ) : (
                            <div style={{ ...G, fontSize:11, color:T.inkLight }}>
                              Digite o valor de cada parcela
                            </div>
                          )}
                        </div>
                        <button onClick={applyParcelaCalc} disabled={pCalcCents===0}
                          style={{ ...G, fontSize:12, fontWeight:700,
                            color:"#fff",
                            background: pCalcCents>0 ? T.purple : T.inkGhost,
                            border:"none", borderRadius:8, padding:"8px 16px",
                            cursor: pCalcCents>0 ? "pointer" : "not-allowed",
                            transition:"all 0.15s", flexShrink:0 }}>
                          Usar este valor →
                        </button>
                      </div>
                    </div>
                  )}
                  {periodSaldo.live ? (
                    <div style={{ ...G, fontSize:11, color:T.inkLight, marginTop:4 }}>
                      {periodSaldo.loading ? (
                        <>Saldo no mês: …</>
                      ) : periodSaldo.error ? (
                        <>Saldo no mês indisponível</>
                      ) : (
                        <>
                          Saldo no mês:{" "}
                          <span style={{ color:T.blue, fontWeight:600 }}>{fmtSaldoLine(periodSaldo.periodBalance)}</span>
                          {valorNum > 0 && saldoAposLancamento != null ? (
                            <>
                              {" · "}
                              Após:{" "}
                              <span
                                style={{
                                  color: saldoAposLancamento >= 0 ? T.green : T.red,
                                  fontWeight: 600,
                                }}
                              >
                                {fmtSaldoLine(saldoAposLancamento)}
                              </span>
                            </>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
                {/* Toggle Estorno — só na aba Despesa, abaixo do VALOR */}
                {tipo === "despesa" && (
                  <button
                    type="button"
                    onClick={() => setIsEstorno((v) => !v)}
                    style={{
                      ...G,
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1px solid ${isEstorno ? T.green : T.border}`,
                      background: isEstorno ? T.greenLight : T.surface,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s",
                    }}
                  >
                    <RotateCcw size={14} color={isEstorno ? T.green : T.inkMid} />
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: isEstorno ? T.green : T.ink }}>
                      {isEstorno ? "Lançando como estorno" : "Isto é um estorno?"}
                    </span>
                    <span
                      aria-hidden
                      style={{
                        width: 28,
                        height: 16,
                        borderRadius: 9999,
                        background: isEstorno ? T.green : T.border,
                        position: "relative",
                        transition: "background 0.15s",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: 2,
                          left: isEstorno ? 14 : 2,
                          width: 12,
                          height: 12,
                          borderRadius: 9999,
                          background: "#fff",
                          transition: "left 0.15s",
                        }}
                      />
                    </span>
                  </button>
                )}
                {renderRefundLinkBlock("desktop")}
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:8 }}>
                    <span style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em" }}>Descrição</span>
                    <span style={{ ...G, fontSize:10, fontWeight:600, color:T.purple, background:T.purpleLight, padding:"1px 7px", borderRadius:99, display:"flex", alignItems:"center", gap:3 }}>
                      <Star size={8} fill={T.purple} /> IA
                    </span>
                  </div>
                  <div style={{ position:"relative" }}>
                    <textarea ref={descRef} value={desc} onChange={e => { setDesc(e.target.value); if (e.target.value.trim()) setDescError(false); }} rows={3}
                      onFocus={() => setDescFocused(true)}
                      onBlur={() => setDescFocused(false)}
                      style={{ ...G, width:"100%", boxSizing:"border-box", padding:"10px 12px 30px", borderRadius:10, border:`1px solid ${descError ? T.red : T.border}`, fontSize:13, color:T.ink, resize:"none", outline:"none", background:T.surface, lineHeight:1.5, transition:"border-color 0.15s" }} />
                    <button style={{ ...G, position:"absolute", bottom:8, right:8, display:"flex", alignItems:"center", gap:4, background:T.purpleLight, border:`1px solid ${T.purple}33`, borderRadius:7, padding:"4px 9px", fontSize:10, fontWeight:600, color:T.purple, cursor:"pointer" }}>
                      <Star size={9} fill={T.purple} /> Sugerir com IA
                    </button>
                  </div>
                  {descError && (
                    <div style={{ ...G, fontSize:11, fontWeight:600, color:T.red, marginTop:5, display:"flex", alignItems:"center", gap:5 }}>
                      <AlertTriangle size={11} color={T.red} /> Descrição obrigatória para registrar a transação.
                    </div>
                  )}
                  {aiSuggestion && !aiApplied && (
                    <button type="button" onClick={applyAi}
                      style={{ ...G, marginTop:8, width:"100%", display:"flex", alignItems:"center", gap:8, padding:"10px 14px", background:T.purpleLight, border:`1px solid ${T.purple}33`, borderRadius:9, cursor:"pointer", textAlign:"left" }}>
                      <Star size={12} fill={T.purple} color={T.purple} style={{ flexShrink:0 }} />
                      <span style={{ ...G, fontSize:11, color:T.inkMid, flex:1 }}>
                        IA identificou: categoria <strong style={{ color:T.purple }}>{aiSuggestion.cat}</strong>
                        {aiSuggestion.tags?.length ? (
                          <> com tags {aiSuggestion.tags.map((t, i) => (
                            <React.Fragment key={t}>
                              {i > 0 && (i === aiSuggestion.tags.length - 1 ? " e " : ", ")}
                              <strong style={{ color:T.green }}>{t}</strong>
                            </React.Fragment>
                          ))}</>
                        ) : null}
                        {" "}— toque para aplicar.
                      </span>
                      <span style={{ ...G, fontSize:10, fontWeight:700, color:T.purple, flexShrink:0 }}>Aplicar →</span>
                    </button>
                  )}
                  {aiSuggestion && aiApplied && (
                    <div style={{ ...G, marginTop:8, display:"flex", alignItems:"center", gap:6, padding:"8px 12px", background:T.greenLight, borderRadius:9 }}>
                      <Check size={11} color={T.green} strokeWidth={2.5} />
                      <span style={{ fontSize:11, color:T.green, fontWeight:600 }}>Categoria e tags aplicadas</span>
                    </div>
                  )}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div>
                    <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>Categoria</div>
                    {useLiveCategoryTags && modalCategoryChoices.some((r) => r.id) ? (
                      <select
                        value={categoryTagId || ""}
                        onChange={(e) => {
                          const id = e.target.value;
                          const row = modalCategoryChoices.find((r) => r.id === id);
                          setCategoryTagId(id || null);
                          if (row?.labelPt) setCat(row.labelPt);
                          setDetailTagIds([]);
                          setDetailTagLabelById({});
                        }}
                        style={{ ...G, width:"100%", boxSizing:"border-box", padding:"9px 12px", border:`1.5px solid ${T.blue}`, borderRadius:9, background:"#EFF6FF", fontSize:12, fontWeight:600, color:T.ink, cursor:"pointer" }}>
                        {modalCategoryChoices.filter((r) => r.id).map((r) => (
                          <option key={r.id} value={r.id}>{r.labelPt}</option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 12px", border:`1.5px solid ${T.blue}`, borderRadius:9, background:"#EFF6FF", cursor:"pointer" }}>
                        <CategoryLucideIcon
                          iconKey={modalCategoryChoices.find((r) => r.labelPt === cat)?.iconKey}
                          labelPt={cat}
                          size={14}
                          color={T.ink}
                        />
                        <span style={{ ...G, fontSize:12, fontWeight:600, color:T.ink }}>{cat}</span>
                        <ChevronDown size={11} color={T.inkLight} style={{ marginLeft:"auto" }} />
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>Data</div>
                    <LocaleDatePicker
                      id="nova-tx-date-desktop"
                      variant="desktop"
                      locale={APP_UI_LOCALE}
                      value={txDateYmd}
                      onChange={(v) => {
                        setTxDateYmd(v);
                        writeStoredNovaTransacaoDate(organizationId, v);
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>Tags</div>
                  {detailTagsError ? (
                    <div style={{ ...G, fontSize:11, color:T.red, marginBottom:8 }}>{detailTagsError}</div>
                  ) : null}
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
                    {useLiveDetailTags
                      ? detailTagIds.map((id) => (
                          <span key={id} onClick={() => {
                            const sid = String(id);
                            setDetailTagIds((prev) => prev.filter((x) => String(x) !== sid));
                            setDetailTagLabelById((prev) => {
                              const next = { ...prev };
                              delete next[sid];
                              return next;
                            });
                          }}
                            style={{ ...G, fontSize:11, fontWeight:600, color:"#fff", background:T.purple, padding:"4px 9px", borderRadius:9999, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                            + {detailChipLabel(id)} <span style={{ opacity:0.7, fontSize:10 }}>✕</span>
                          </span>
                        ))
                      : tags.map((tag) => (
                          <span key={tag} onClick={() => setTags((tg) => tg.filter((t) => t !== tag))}
                            style={{ ...G, fontSize:11, fontWeight:600, color:"#fff", background:T.purple, padding:"4px 9px", borderRadius:9999, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                            + {tag} <span style={{ opacity:0.7, fontSize:10 }}>✕</span>
                          </span>
                        ))}
                    {detailTagRowsAvailable.map((row) => (
                      <span
                        key={row.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.preventDefault();
                          addDetailTagByRow(row);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            addDetailTagByRow(row);
                          }
                        }}
                        style={{ ...G, fontSize:11, color:T.inkMid, background:T.grayLight, padding:"4px 9px", borderRadius:9999, cursor:"pointer" }}
                      >
                        {row.name}
                      </span>
                    ))}
                    {NOVA_TX_QUICK_DETAIL_LABELS.filter((t) => {
                      if (!useLiveDetailTags) return !tags.includes(t);
                      if (findByLabel(t)) return false;
                      return true;
                    }).map((t) => (
                      <span key={t} role="button" tabIndex={0}
                        onClick={(e) => { e.preventDefault(); void addQuickDetailTag(t); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void addQuickDetailTag(t); } }}
                        style={{ ...G, fontSize:11, color:T.inkMid, background:T.grayLight, padding:"4px 9px", borderRadius:9999, cursor:"pointer" }}>{t}</span>
                    ))}
                    {addingTag ? (
                      <input autoFocus value={newTag} onChange={e => setNewTag(e.target.value)}
                        onKeyDown={e => { if(e.key==="Enter"&&newTag.trim()){ if(useLiveDetailTags) void addQuickDetailTag(newTag.trim()); else setTags(tg=>[...tg,newTag.trim()]); setNewTag("");setAddingTag(false);} if(e.key==="Escape"){setNewTag("");setAddingTag(false);} }}
                        onBlur={() => { if(newTag.trim()){ if(useLiveDetailTags) void addQuickDetailTag(newTag.trim()); else setTags(tg=>[...tg,newTag.trim()]); } setNewTag(""); setAddingTag(false); }}
                        style={{ ...G, fontSize:11, color:T.blue, border:`1px dashed ${T.blue}`, padding:"3px 9px", borderRadius:9999, outline:"none", width:80, background:"transparent" }} />
                    ) : (
                      <span onClick={() => setAddingTag(true)} style={{ ...G, fontSize:11, color:T.blue, border:`1px dashed ${T.blue}`, padding:"3px 9px", borderRadius:9999, cursor:"pointer" }}>+ nova</span>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>Forma de Pagamento</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", width:"100%", minWidth:0 }}>
                    {methodsList.map(([id, label]) => (
                      <button key={id} onClick={() => {
                        setMethod(id);
                        if (id !== "credito") beginCloseCartaoPanel();
                        else if (panelCartaoExiting) {
                          setPanelCartaoOpen(true);
                          setPanelCartaoExiting(false);
                        } else if (panelCartaoOpen) beginCloseCartaoPanel();
                        else {
                          setPanelCartaoOpen(true);
                          setPanelCartaoExiting(false);
                        }
                      }}
                        style={{
                          ...G,
                          flex: id === "credito" ? "0 0 auto" : "1 1 0",
                          minWidth: id === "credito" ? 90 : 56,
                          ...(id === "credito" ? { width: 90 } : {}),
                          display:"flex",
                          alignItems:"center",
                          justifyContent:"center",
                          gap: id === "credito" ? 5 : 0,
                          padding:"7px 8px",
                          borderRadius:9,
                          border:`1.5px solid ${method===id ? T.ink : T.border}`,
                          background:method===id ? T.ink : T.surface,
                          color:method===id ? "#fff" : T.inkMid,
                          fontSize:12,
                          fontWeight:600,
                          cursor:"pointer",
                        }}>
                        {id === "credito" ? (
                          <>
                            <CreditCard size={11} style={{ flexShrink:0 }} />
                            <span style={{ whiteSpace:"nowrap" }}>{label}</span>
                            <span
                              aria-hidden
                              style={{
                                width:5,
                                height:5,
                                borderRadius:9999,
                                flexShrink:0,
                                background: method === "credito" ? (panelCartaoOpen && !panelCartaoExiting ? T.green : T.purple) : "transparent",
                              }}
                            />
                          </>
                        ) : (
                          <span style={{ whiteSpace:"nowrap" }}>{label}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                {!isEstorno && (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", background:T.bg, borderRadius:10, border:`1px solid ${recorre ? T.blue : T.border}`, cursor:"pointer", transition:"border-color 0.15s" }}
                    onClick={() => {
                      setRecorre((r) => {
                        if (!r) setMod("avista");
                        return !r;
                      });
                      if (!recorre) {
                        setPanelRecorrenciaOpen(true);
                        setPanelRecorrenciaExiting(false);
                      } else beginCloseRecorrenciaPanel();
                    }}>
                    <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                      <Repeat size={14} color={recorre ? T.blue : T.inkLight} />
                      <div>
                        <div style={{ ...G, fontSize:12, fontWeight:600, color:T.ink }}>Transação recorrente</div>
                        <div style={{ ...G, fontSize:10, color:T.inkLight }}>Repetir automaticamente</div>
                      </div>
                    </div>
                    <div style={{ width:38, height:22, borderRadius:11, background:recorre ? T.blue : T.inkGhost, position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                      <div style={{ position:"absolute", top:3, left:recorre?18:3, width:16, height:16, borderRadius:9999, background:"#fff", transition:"left 0.2s", boxShadow:T.sm }} />
                    </div>
                  </div>
                )}
                {!novaRecorrencia && (
                  <div style={{ border:`1px solid ${T.border}`, borderRadius:12 }}>
                    <div onClick={() => setShowImpact(s => !s)}
                      style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", cursor:"pointer", userSelect:"none", borderRadius:12, transition:"background 0.12s" }}
                      onMouseEnter={e => e.currentTarget.style.background = T.bg}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                        <Zap size={14} color={T.amber} fill={T.amber} />
                        <span style={{ ...G, fontSize:13, fontWeight:700, color:T.ink }}>Impacto financeiro</span>
                      </div>
                      <span style={{ ...G, display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600, color:T.blue }}>
                        {showImpact ? "Recolher" : "Ver detalhes"} {showImpact ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </span>
                    </div>
                    {showImpact && (
                      <div style={{ padding:"0 16px 16px", borderTop:`1px solid ${T.border}` }}>
                        <NovaTransacaoImpactPanel
                          impactLive={financialImpact.impactLive}
                          financialImpact={financialImpact}
                          impactKpis={impactKpis}
                          valorNum={valorNum}
                          modalCategoryChoices={modalCategoryChoices}
                          cat={cat}
                          chartHeight={90}
                          marginBottom={14}
                          kpiValSize={14}
                          kpiTitleSize={8}
                          categoryNumSize={11}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ flexShrink:0, padding:"14px 20px", borderTop:`1px solid ${T.border}`, background:T.surface }}>
            {txSubmitError && (
              <div style={{ ...G, fontSize:12, fontWeight:600, color:T.red, marginBottom:10, textAlign:"center" }}>{txSubmitError}</div>
            )}
            {review ? (
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={goBack}
                  style={{ ...G, display:"flex", alignItems:"center", gap:6, padding:"11px 16px", borderRadius:10, border:`1px solid ${T.border}`, background:T.surface, fontSize:13, fontWeight:600, color:T.inkMid, cursor:"pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = T.bg}
                  onMouseLeave={e => e.currentTarget.style.background = T.surface}>
                  <ChevronLeft size={14} /> Editar
                </button>
                <button onClick={handleSave} disabled={txSubmitting}
                  style={{ ...G, flex:1, padding:"11px", borderRadius:10, border:"none", background:success ? T.green : typeColor, fontSize:13, fontWeight:700, color:"#fff", cursor:txSubmitting ? "not-allowed" : "pointer", opacity:txSubmitting ? 0.75 : 1, display:"flex", alignItems:"center", justifyContent:"center", gap:6, transition:"background 0.25s", animation:success?"successPop 0.35s ease-out":"none" }}>
                  {success
                    ? <><Check size={14} /> {novaRecorrencia || recorre ? "Recorrência salva!" : "Registrado!"}</>
                    : novaRecorrencia || recorre ? "Confirmar recorrência" : (txSubmitting ? "Enviando…" : `Confirmar ${tipo === "despesa" ? (isEstorno ? "estorno" : "despesa") : "receita"}`)
                  }
                </button>
              </div>
            ) : (
              <div style={{ display:"flex", gap:8 }}>
                <Btn variant="outGray" onClick={beginClose}>Cancelar</Btn>
                {novaRecorrencia || recorre ? (
                  <button onClick={() => { if (!desc.trim()) { setDescError(true); descRef.current?.focus(); return; } goReview(); }}
                    style={{ ...G, flex:1, padding:"11px", borderRadius:10, border:"none", background:typeColor, fontSize:13, fontWeight:700, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                    Revisar recorrência <ChevronRight size={14} />
                  </button>
                ) : (
                  <button onClick={() => { if (!desc.trim()) { setDescError(true); descRef.current?.focus(); return; } goReview(); }} disabled={!valorNum}
                    style={{ ...G, flex:1, padding:"11px", borderRadius:10, border:"none", background:!valorNum ? T.inkGhost : typeColor, fontSize:13, fontWeight:700, color:"#fff", cursor:!valorNum ? "not-allowed" : "pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6, transition:"background 0.2s" }}>
                    Revisar {tipo==="despesa" ? "despesa" : "receita"} <ChevronRight size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
          </>}
        </div>
      </div>
    </div>
  );
};
