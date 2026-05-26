import React, { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from "react";
import { flushSync } from "react-dom";
import {
  LayoutDashboard, ArrowLeftRight, CreditCard, BarChart2,
  Target, Plus, Bell, ChevronDown, TrendingUp, TrendingDown,
  ArrowUpRight, Calendar, Search, ChevronRight, ChevronLeft, Edit3,
  Trash2, Activity, X, Check, Repeat, Filter, Download,
  Sparkles, Hash, AlertTriangle, Upload,
  Pause, Pencil, Tv, Phone, Dumbbell, Home, Music, Zap,
  Wallet, MoreHorizontal, ChevronUp, FileText, Landmark,
  RefreshCw, RotateCcw, Circle, Star, Car,
  SlidersHorizontal, Leaf, ShieldCheck, Gauge, Flame,
  Eye, EyeOff, ArrowRight, Trophy, Flag,
  Award, Clock, Percent, ArrowDown, ArrowUp, Menu,
} from "lucide-react";
import {
  LineChart, Line, BarChart as ReBarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  Cell,
} from "recharts";


import "./injectFonts";
import { T } from "./tokens";
import { AnimStyles } from "./animations";
import { G, S, NUM } from "./typography";

import {
  PageEnter,
  Card,
  PageTitle,
  ProgBar,
  Btn,
} from "./components/primitives";
import { Sidebar } from "./layouts/Sidebar.jsx";
import { Topbar } from "./layouts/Topbar.jsx";
import { DragScrollTabs } from "./layouts/DragScrollTabs.jsx";

import {
  M_MONO,
  MOODS,
  calcMood,
} from "./features/moodV4";

import { OnboardingFlow } from "./features/onboarding/OnboardingFlow.jsx";
import { useFirstStepsLiveStatus } from "./features/onboarding/useFirstStepsLiveStatus.js";
import { submitOnboarding } from "./features/onboarding/onboardingApi.js";
import {
  buildImmediateCreditCardPreview,
  buildImmediateRecurringPreview,
} from "./features/onboarding/onboardingValueUtils.js";
import { DashboardPage as DashboardPageView } from "./pages/DashboardPage.jsx";
import { RitmoPage as RitmoPageView } from "./pages/RitmoPage.jsx";
import { TransacoesPage as TransacoesPageView } from "./pages/TransacoesPage.jsx";
import { RecorrenciasPage as RecorrenciasPageView } from "./pages/RecorrenciasPage.jsx";
import { ConfiguracoesPage } from "./pages/ConfiguracoesPage.jsx";
import { MetasPage as MetasPageView } from "./pages/MetasPage.jsx";
import { OrcamentosPage } from "./pages/OrcamentosPage.jsx";
import { RelatoriosPage } from "./pages/RelatoriosPage.jsx";
import { SimulacaoPage as SimulacaoPageView } from "./pages/SimulacaoPage.jsx";
import { listCreditCards } from "../api/creditCards";
import { getTransaction } from "../api/transactions";
import {
  buildCreateCreditCardPayload,
  buildUpdateCreditCardPayload,
  defaultFaturaIndexForCard,
  faturaIdxAfterCardsRefresh,
  faturaIdxMatchingInvoiceRef,
  fetchPastInvoiceItemsForUi,
  formatCreditCardsApiError,
  mapCreditCardToModalPickerRow,
} from "./data/creditCardsAdapter.js";
import { useCreditCardsData } from "./features/creditCards/useCreditCardsData.js";

import { MiniChecklist, StatePanelV4, EmptyState } from "./features/shellExtras.jsx";

import { acceptOrganizationInvitation } from "./data/invitationAdapter.js";
import {
  parseAuthEntryUrl,
  stripAuthEntryQueryAndHash,
} from "./features/auth/authEntryUrl.js";
import {
  AcceptInvitationPage,
  LoginPage,
  PasswordResetPage,
  ErrorBoundary,
} from "./features/authViews.jsx";
import {
  Outlet,
  useNavigate,
  useRouterState,
  useSearch,
} from "@tanstack/react-router";
import { useSession } from "./features/auth/useSession.js";
import {
  finclaMainOutletRemountKey,
  firstPathSegment,
  isAuthRouteSegment,
} from "./routing/appSegments.js";
import {
  capturePostLoginRedirectFromPathnameAndSearchStr,
  consumePostLoginNavigateArgs,
  isReturnableFinclaPathname,
} from "./routing/postLoginRedirect.js";
import { transactionEditIdFromPathname } from "./routing/transactionPathId.js";
import { useFinclaDocumentTitle } from "./routing/useFinclaDocumentTitle.js";
import { FC, FC_MODAL, mergeNavSearch } from "./routing/searchContract.js";
import { FinclaPageContext } from "./routing/finclaPageContext.jsx";
import { resolveDataMode, shouldUseRealData as shouldUseRealDataForMode } from "./dataMode.js";
import { useCategoryTagsData } from "./features/tags/useCategoryTagsData.js";
import { useNovaTransacaoDetailTags } from "./features/tags/useNovaTransacaoDetailTags.js";
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
  mapApiTransactionToUi,
  modalPaymentKeyFromTransactionUi,
  transactionUiValAbsForEdit,
  normalizeStoredNovaTxPaymentMethod,
  readStoredNovaTransacaoPrefs,
  serializeNovaTxFormStateToStoredPrefs,
  shouldApplyStoredNovaTxCategoryPrefs,
  todayLocalYmd,
  transactionDateIsoFromBrDisplay,
  transactionDateIsoFromYmd,
  updateTransactionForUi,
  writeStoredNovaTransacaoDate,
  writeStoredNovaTransacaoPrefs,
} from "./data/transactionsAdapter.js";
import {
  buildCreateRecurringSeriesPayload,
  buildUpdateRecurringSeriesPayload,
  createRecurringSeriesForUi,
  formatRecurringTransactionsApiError,
  updateRecurringSeriesForUi,
} from "./data/recurringTransactionsAdapter.js";
import {
  computeEndDateFromOccurrences as computeEndDateFromOccurrencesMath,
  computeFirstOccurrence as computeFirstOccurrenceMath,
} from "./data/recurrenceDateMath.js";
import { CategoryLucideIcon } from "./components/CategoryLucideIcon.jsx";
import { LocaleDatePicker } from "./components/LocaleDatePicker.jsx";
import { APP_UI_LOCALE } from "./appLocale.js";
import { useNovaTransacaoFinancialImpact } from "./features/novaTransacao/useNovaTransacaoFinancialImpact.js";
import {
  useNovaTransacaoPeriodSaldo,
  projectedBalanceAfterTx,
  fmtSaldoLine,
  clearNovaTransacaoSummaryCache,
} from "./features/novaTransacao/useNovaTransacaoPeriodSaldo.js";
import {
  parseApiDecimal,
  fmtBrl,
  formatProjectionCardExplain,
} from "./data/novaTransacaoImpactUtils.js";
import { NovaTransacaoImpactPanel } from "./components/NovaTransacaoImpactPanel.jsx";
import { TRANSACTIONS } from "./data/mockFinance.js";

/* ─── SIMULAÇÃO — estado inicial (cenários mock) ─────────── */

const SIM_CENARIOS_INIT = [
  { id: 1, nome: "Setup home office", budgetOverride: null,
    items: [
      { id:1, tipo:"despesa_parcelada",  nome:"MacBook Air M3",       cat:"Tecnologia",  banco:"Nubank",            parcelas:12, meses:null, valParcela:349.17, total:4190,  badge:"12× meses", isReceita:false, isAjuste:false },
      { id:2, tipo:"despesa_parcelada",  nome:'Monitor LG 27"',        cat:"Tecnologia",  banco:"Itaú Personnalité", parcelas:3,  meses:null, valParcela:183.33, total:550,   badge:"3× meses",  isReceita:false, isAjuste:false },
      { id:3, tipo:"despesa_recorrente", nome:"Adobe Creative Cloud",  cat:"Assinaturas", banco:"-",                 parcelas:1,  meses:12,   valParcela:89.90,  total:89.90, badge:"12 meses",  isReceita:false, isAjuste:false },
      { id:4, tipo:"despesa_recorrente", nome:"Notion Pro",            cat:"Assinaturas", banco:"-",                 parcelas:1,  meses:6,    valParcela:45,     total:45,    badge:"6 meses",   isReceita:false, isAjuste:false },
    ]
  },
  { id: 2, nome: "Upgrade assinaturas", budgetOverride: 4800,
    items: [
      { id:1, tipo:"despesa_recorrente", nome:"Adobe Creative Cloud",  cat:"Assinaturas", banco:"-",                 parcelas:1,  meses:12,   valParcela:89.90,  total:89.90, badge:"12 meses",  isReceita:false, isAjuste:false },
      { id:2, tipo:"receita_recorrente", nome:"Freela mensal",         cat:"Renda",       banco:"-",                 parcelas:1,  meses:6,    valParcela:800,    total:800,   badge:"6 meses",   isReceita:true,  isAjuste:false },
      { id:3, tipo:"ajuste_categoria",   nome:"Corte em Alimentação",  cat:"Alimentação", banco:"-",                 parcelas:1,  meses:3,    valParcela:200,    total:200,   badge:"3 meses",   isReceita:false, isAjuste:true  },
    ]
  },
  { id: 3, nome: "Reforma do quarto", budgetOverride: null,
    items: [
      { id:1, tipo:"despesa_parcelada",  nome:"Materiais",             cat:"Moradia",     banco:"Itaú Personnalité", parcelas:6,  meses:null, valParcela:533.33, total:3200,  badge:"6× meses",  isReceita:false, isAjuste:false },
      { id:2, tipo:"despesa_recorrente", nome:"Netflix Premium",       cat:"Assinaturas", banco:"-",                 parcelas:1,  meses:12,   valParcela:55.90,  total:55.90, badge:"12 meses",  isReceita:false, isAjuste:false },
    ]
  },
];


/* ─── NOVA TRANSAÇÃO DRAWER ─────────────────────────────── */
/* ─── PARCELA HYBRID (A+B+C) ───────────────────────────────────── */
const ParcelaHybrid = ({ parcelas, valorNum, T, G, NUM }) => {
  if (!parcelas || !valorNum || parcelas < 2) return null;
  const parcelaVal = valorNum / parcelas;
  const MON = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  const startM = 3, startY = 2026;
  const allMonths = Array.from({length: parcelas}, (_, i) => {
    const tot = startM + i;
    return { m: MON[tot % 12], y: startY + Math.floor(tot / 12) };
  });
  const end = allMonths[allMonths.length - 1];
  const endLabel = `${end.m}/${String(end.y).slice(2)}`;
  const showAll  = parcelas <= 5;
  const impactPct = Math.round((parcelaVal / 6500) * 1000) / 10;
  const impactHigh = impactPct >= 10;

  const dotStyle = (kind) => ({
    width:8, height:8, borderRadius:"50%", flexShrink:0,
    background: kind==="past" ? T.blue : kind==="now" ? T.ink : "#BFDBFE",
    boxShadow: kind==="now" ? "0 0 0 2.5px rgba(37,99,235,.2)" : "none",
  });
  const segStyle = (past) => ({
    flex:1, height:2, borderRadius:99,
    background: past ? T.blue : "#BFDBFE",
  });
  const pill = (label, active) => ({
    ...G, fontSize:10, fontWeight:600, padding:"2px 8px",
    borderRadius:99, flexShrink:0, whiteSpace:"nowrap",
    background: active ? T.blue : "#BFDBFE",
    color: active ? "#fff" : T.blue,
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", borderRadius:12,
      overflow:"hidden", border:"1.5px solid #BFDBFE" }}>

      {/* B — Split card */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:1, background:"#BFDBFE" }}>
        <div style={{ background:"#fff", padding:"10px 13px" }}>
          <div style={{ ...G, fontSize:9, fontWeight:700, color:T.blue,
            textTransform:"uppercase", letterSpacing:".07em", opacity:.7, marginBottom:2 }}>Por mês</div>
          <div style={{ ...G, ...NUM, fontSize:16, fontWeight:800, color:T.ink, letterSpacing:"-.02em" }}>
            R$ {parcelaVal.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}
          </div>
          <div style={{ ...G, fontSize:10, color:T.inkGhost, marginTop:1 }}>{parcelas} parcelas</div>
        </div>
        <div style={{ background:"#EFF6FF", padding:"10px 13px" }}>
          <div style={{ ...G, fontSize:9, fontWeight:700, color:T.blue,
            textTransform:"uppercase", letterSpacing:".07em", opacity:.7, marginBottom:2 }}>Total</div>
          <div style={{ ...G, ...NUM, fontSize:16, fontWeight:800, color:T.blue, letterSpacing:"-.02em" }}>
            R$ {valorNum.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}
          </div>
          <div style={{ ...G, fontSize:10, color:T.inkGhost, marginTop:1 }}>
            abr/26{parcelas > 1 ? ` → ${endLabel}` : ""}
          </div>
        </div>
      </div>

      {/* A — Timeline */}
      <div style={{ padding:"9px 13px", background:"#fff", borderTop:"1px solid #BFDBFE" }}>
        <div style={{ ...G, fontSize:9, fontWeight:700, color:T.blue,
          textTransform:"uppercase", letterSpacing:".07em", opacity:.7, marginBottom:5 }}>
          {parcelas} {parcelas===1?"mês":"meses"}
        </div>
        <div style={{ display:"flex", alignItems:"center" }}>
          {showAll ? allMonths.map((_, i) => (
            <React.Fragment key={i}>
              <div style={dotStyle(i===0?"past":i===1?"now":"future")}/>
              {i < allMonths.length-1 && <div style={segStyle(i===0)}/>}
            </React.Fragment>
          )) : (
            <>
              <div style={dotStyle("past")}/>
              <div style={segStyle(true)}/>
              <div style={dotStyle("now")}/>
              <div style={{ ...G, ...NUM, fontSize:11, fontWeight:700,
                color:"#BFDBFE", flex:1, textAlign:"center", letterSpacing:1 }}>···</div>
              <div style={dotStyle("future")}/>
              <div style={segStyle(false)}/>
              <div style={dotStyle("future")}/>
            </>
          )}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
          <div style={{ ...G, fontSize:10, color:T.inkLight }}>abr/26</div>
          {parcelas > 1 && <div style={{ ...G, fontSize:10, color:T.blue, fontWeight:600 }}>→ {endLabel}</div>}
        </div>
      </div>

      {/* C — Month pills */}
      <div style={{ padding:"7px 13px", background:"#EFF6FF",
        borderTop:"1px solid #BFDBFE", display:"flex", alignItems:"center", gap:4 }}>
        {showAll ? allMonths.map((mo, i) => (
          <span key={i} style={pill(mo.m, i <= 1)}>{mo.m}</span>
        )) : (
          <>
            <span style={pill(allMonths[0].m, true)}>{allMonths[0].m}</span>
            <span style={pill(allMonths[1].m, true)}>{allMonths[1].m}</span>
            <span style={{ ...G, fontSize:10, color:"#BFDBFE", fontWeight:700 }}>→</span>
            <span style={{ ...G, fontSize:10, fontWeight:700, padding:"2px 8px",
              borderRadius:99, background:"#F3F4F6", color:T.inkGhost, flexShrink:0 }}>
              +{parcelas - 3} meses
            </span>
            <span style={{ ...G, fontSize:10, color:"#BFDBFE", fontWeight:700 }}>→</span>
            <span style={pill(endLabel, false)}>{endLabel}</span>
          </>
        )}
      </div>

      {/* B — Impact */}
      <div style={{ padding:"8px 13px",
        background: impactHigh ? "#FEF2F2" : "#FFFBEB",
        borderTop: `1px solid ${impactHigh ? "#FECACA" : "#FDE68A"}`,
        display:"flex", alignItems:"flex-start", gap:8 }}>
        <span style={{ fontSize:13, flexShrink:0, marginTop:1 }}>{impactHigh ? "⚠️" : "⚡"}</span>
        <span style={{ ...G, fontSize:11, lineHeight:1.5,
          color: impactHigh ? "#DC2626" : "#D97706" }}>
          <strong style={{ color: impactHigh ? "#991B1B" : "#92400E" }}>
            {impactPct}% do orçamento/mês
          </strong>
          {" "}por {parcelas} {parcelas===1?"mês":"meses"} · vence dia 10
        </span>
      </div>
    </div>
  );
};

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

const NovaTransacaoModal = ({
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
                <ParcelaHybrid parcelas={parcelas} valorNum={valorNum} T={T} G={G} NUM={NUM}/>
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


/* ─── CARTÕES DATA ───────────────────────────────────────── */
const CARTOES_DATA = [
  {
    id:"nubank", banco:"Nubank", nome:"Nu Roxinho", dig:"1177",
    bandeira:"Mastercard", vencimento:10, fechamento:3,
    limite:4800, disponivel:2960,
    cor1:"#6016A8", cor2:"#8B11D4", corChip:"#A855F7", corText:"#fff",
    faturas: [
      { id:"f1", mes:"Out'25", val:1240, pago:true,  venc:"10/11/2025" },
      { id:"f2", mes:"Nov'25", val:1680, pago:true,  venc:"10/12/2025" },
      { id:"f3", mes:"Dez'25", val:2310, pago:true,  venc:"10/01/2026" },
      { id:"f4", mes:"Jan'26", val:1550, pago:true,  venc:"10/02/2026" },
      { id:"f5", mes:"Fev'26", val:1420, pago:true,  venc:"10/03/2026" },
      { id:"f6", mes:"Mar'26", val:1840, pago:false, venc:"10/04/2026", atual:true },
    ],
    // Category trend data for Análises
    tendencia: [
      { mes:"Out'25", Assinaturas:297, Alimentação:410, Transporte:180, Saúde:110, Eletrônicos:0,   Outros:243 },
      { mes:"Nov'25", Assinaturas:297, Alimentação:520, Transporte:210, Saúde:150, Eletrônicos:350, Outros:153 },
      { mes:"Dez'25", Assinaturas:297, Alimentação:680, Transporte:190, Saúde:200, Eletrônicos:420, Outros:523 },
      { mes:"Jan'26", Assinaturas:297, Alimentação:480, Transporte:220, Saúde:130, Eletrônicos:653, Outros:270 },
      { mes:"Fev'26", Assinaturas:297, Alimentação:390, Transporte:195, Saúde:194, Eletrônicos:0,   Outros:344 },
      { mes:"Mar'26", Assinaturas:297, Alimentação:560, Transporte:225, Saúde:194, Eletrônicos:653, Outros:111 },
    ],
    itens: [
      { id:1,  desc:"Netflix",         cat:"Assinaturas", val:55.90,  data:"01/03", icon:"📺", rec:true,  parcela:null      },
      { id:2,  desc:"Spotify",         cat:"Assinaturas", val:21.90,  data:"01/03", icon:"🎵", rec:true,  parcela:null      },
      { id:3,  desc:"Amazon Prime",    cat:"Assinaturas", val:19.90,  data:"01/03", icon:"📦", rec:true,  parcela:null      },
      { id:4,  desc:"Adobe CC",        cat:"Assinaturas", val:179.90, data:"02/03", icon:"🎨", rec:true,  parcela:null      },
      { id:5,  desc:"iFood +",         cat:"Assinaturas", val:19.90,  data:"01/03", icon:"⭐", rec:true,  parcela:null      },
      { id:6,  desc:"Posto Shell",     cat:"Transporte",  val:180.00, data:"04/03", icon:"⛽", rec:false, parcela:null      },
      { id:7,  desc:"iFood",           cat:"Alimentação", val:89.90,  data:"06/03", icon:"🍔", rec:false, parcela:null      },
      { id:8,  desc:"Smart Fit",       cat:"Saúde",       val:109.90, data:"07/03", icon:"💪", rec:true,  parcela:null      },
      { id:9,  desc:"iPhone 16 Pro",   cat:"Eletrônicos", val:420.00, data:"08/03", icon:"📱", rec:false, parcela:{n:3,t:12}},
      { id:10, desc:"Mercado Extra",   cat:"Alimentação", val:312.50, data:"09/03", icon:"🛒", rec:false, parcela:null      },
      { id:11, desc:"Rappi",           cat:"Alimentação", val:67.80,  data:"11/03", icon:"🛵", rec:false, parcela:null      },
      { id:12, desc:"Monitor LG 27\"", cat:"Eletrônicos", val:233.00, data:"12/03", icon:"🖥️",rec:false, parcela:{n:2,t:6} },
      { id:13, desc:"Uber",            cat:"Transporte",  val:45.20,  data:"13/03", icon:"🚗", rec:false, parcela:null      },
      { id:14, desc:"Farmácia",        cat:"Saúde",       val:84.00,  data:"14/03", icon:"💊", rec:false, parcela:null      },
      { id:15, desc:"Uber Eats",       cat:"Alimentação", val:89.90,  data:"16/03", icon:"🛵", rec:false, parcela:null      },
    ],
    parcelas_ativas: [
      { id:"p1", desc:"iPhone 16 Pro",   cat:"Eletrônicos", vParcela:420.00, pago:3,  total:12, vTotal:5040, icon:"📱" },
      { id:"p2", desc:"Monitor LG 27\"", cat:"Eletrônicos", vParcela:233.00, pago:2,  total:6,  vTotal:1398, icon:"🖥️" },
      { id:"p3", desc:"Notebook Dell",   cat:"Eletrônicos", vParcela:380.00, pago:1,  total:10, vTotal:3800, icon:"💻" },
      { id:"p4", desc:"Curso Alura",     cat:"Educação",    vParcela:89.90,  pago:4,  total:12, vTotal:1079, icon:"📚" },
      { id:"p5", desc:"Airfryer Philco", cat:"Casa",        vParcela:110.00, pago:2,  total:5,  vTotal:550,  icon:"🍳" },
    ],
  },
  {
    id:"itau", banco:"Itaú Unibanco", nome:"Personnalité", dig:"0034",
    bandeira:"Visa Infinite", vencimento:20, fechamento:13,
    limite:15000, disponivel:11800,
    cor1:"#003087", cor2:"#0050C8", corChip:"#60A5FA", corText:"#fff",
    faturas: [
      { id:"g1", mes:"Out'25", val:2800, pago:true,  venc:"20/11/2025" },
      { id:"g2", mes:"Nov'25", val:4100, pago:true,  venc:"20/12/2025" },
      { id:"g3", mes:"Dez'25", val:5600, pago:true,  venc:"20/01/2026" },
      { id:"g4", mes:"Jan'26", val:3100, pago:true,  venc:"20/02/2026" },
      { id:"g5", mes:"Fev'26", val:2900, pago:true,  venc:"20/03/2026" },
      { id:"g6", mes:"Mar'26", val:3200, pago:false, venc:"20/04/2026", atual:true },
    ],
    tendencia: [
      { mes:"Out'25", Moradia:2220, Alimentação:380, Transporte:0, Viagem:0,    Outros:200 },
      { mes:"Nov'25", Moradia:2220, Alimentação:580, Transporte:0, Viagem:0,    Outros:1300},
      { mes:"Dez'25", Moradia:2220, Alimentação:480, Transporte:0, Viagem:1200, Outros:1700},
      { mes:"Jan'26", Moradia:2220, Alimentação:380, Transporte:0, Viagem:0,    Outros:500 },
      { mes:"Fev'26", Moradia:2220, Alimentação:320, Transporte:0, Viagem:0,    Outros:360 },
      { mes:"Mar'26", Moradia:2220, Alimentação:380, Transporte:180, Viagem:420, Outros:0  },
    ],
    itens: [
      { id:20, desc:"Aluguel",          cat:"Moradia",     val:1800.00, data:"05/03", icon:"🏠", rec:true,  parcela:null       },
      { id:21, desc:"Condomínio",       cat:"Moradia",     val:420.00,  data:"05/03", icon:"🏢", rec:true,  parcela:null       },
      { id:22, desc:"IPTU",             cat:"Moradia",     val:180.00,  data:"05/03", icon:"📋", rec:false, parcela:{n:3,t:10} },
      { id:23, desc:"Restaurante Fogo", cat:"Alimentação", val:380.00,  data:"08/03", icon:"🍖", rec:false, parcela:null       },
      { id:24, desc:"Viagem Floripa",   cat:"Viagem",      val:420.00,  data:"10/03", icon:"✈️", rec:false, parcela:{n:1,t:3}  },
    ],
    parcelas_ativas: [
      { id:"p6", desc:"IPTU parcelado",  cat:"Moradia",     vParcela:180.00, pago:3, total:10, vTotal:1800, icon:"📋" },
      { id:"p7", desc:"Viagem Floripa",  cat:"Viagem",      vParcela:420.00, pago:1, total:3,  vTotal:1260, icon:"✈️" },
      { id:"p8", desc:"TV Samsung 65\"", cat:"Eletrônicos", vParcela:350.00, pago:2, total:12, vTotal:4200, icon:"📺" },
    ],
  },
  {
    id:"inter", banco:"Banco Inter", nome:"Mastercard Black", dig:"5521",
    bandeira:"Mastercard Black", vencimento:5, fechamento:28,
    limite:2500, disponivel:1520,
    cor1:"#1C1C1E", cor2:"#3A3A3C", corChip:"#D4AF37", corText:"#fff",
    faturas: [
      { id:"h1", mes:"Out'25", val:720,  pago:true,  venc:"05/11/2025" },
      { id:"h2", mes:"Nov'25", val:1100, pago:true,  venc:"05/12/2025" },
      { id:"h3", mes:"Dez'25", val:1380, pago:true,  venc:"05/01/2026" },
      { id:"h4", mes:"Jan'26", val:850,  pago:true,  venc:"05/02/2026" },
      { id:"h5", mes:"Fev'26", val:760,  pago:true,  venc:"05/03/2026" },
      { id:"h6", mes:"Mar'26", val:980,  pago:false, venc:"05/04/2026", atual:true },
    ],
    tendencia: [
      { mes:"Out'25", Alimentação:320, Transporte:180, Saúde:120, Lazer:0,   Educação:100 },
      { mes:"Nov'25", Alimentação:410, Transporte:190, Saúde:80,  Lazer:200, Educação:220 },
      { mes:"Dez'25", Alimentação:580, Transporte:160, Saúde:80,  Lazer:320, Educação:240 },
      { mes:"Jan'26", Alimentação:360, Transporte:200, Saúde:140, Lazer:0,   Educação:150 },
      { mes:"Fev'26", Alimentação:290, Transporte:180, Saúde:200, Lazer:0,   Educação:90  },
      { mes:"Mar'26", Alimentação:387, Transporte:65,  Saúde:218, Lazer:120, Educação:189 },
    ],
    itens: [
      { id:30, desc:"Padaria São Bento", cat:"Alimentação", val:42.50,  data:"02/03", icon:"🥐", rec:false, parcela:null      },
      { id:31, desc:"99 Táxi",           cat:"Transporte",  val:28.90,  data:"04/03", icon:"🚕", rec:false, parcela:null      },
      { id:32, desc:"Farmácia Popular",  cat:"Saúde",       val:67.40,  data:"06/03", icon:"💊", rec:false, parcela:null      },
      { id:33, desc:"Steam (jogos)",     cat:"Lazer",       val:119.90, data:"08/03", icon:"🎮", rec:false, parcela:null      },
      { id:34, desc:"Livros Amazon",     cat:"Educação",    val:189.00, data:"10/03", icon:"📚", rec:false, parcela:null      },
      { id:35, desc:"Supermercado",      cat:"Alimentação", val:241.30, data:"12/03", icon:"🛒", rec:false, parcela:null      },
      { id:36, desc:"Uber Eats",         cat:"Alimentação", val:54.80,  data:"14/03", icon:"🛵", rec:false, parcela:null      },
      { id:37, desc:"Corrida Uber",      cat:"Transporte",  val:36.20,  data:"14/03", icon:"🚗", rec:false, parcela:null      },
      { id:38, desc:"Tênis Nike",        cat:"Saúde",       val:151.00, data:"17/03", icon:"👟", rec:false, parcela:{n:1,t:3} },
    ],
    parcelas_ativas: [
      { id:"p9", desc:"Tênis Nike", cat:"Saúde", vParcela:151.00, pago:1, total:3, vTotal:453, icon:"👟" },
    ],
  },
];

const CAT_COLORS_CARD = {
  "Alimentação":"#2563EB",           "Transporte":"#D97706",
  "Saúde":"#059669",                 "Educação":"#BE185D",
  "Lazer & Entretenimento":"#9333EA","Compras Pessoais":"#DC2626",
  "Serviços":"#6B7280",              "Assinaturas & Software":"#7C3AED",
  "Impostos & Taxas":"#D97706",      "Moradia":"#374151",
  "Receita":"#059669",
  Assinaturas:"#7C3AED", Lazer:"#9333EA", Casa:"#64748B",
  Eletrônicos:"#0891B2", Viagem:"#0D9488", Outros:"#9CA3AF",
};
const safe = (num, den, fallback=0) => (!den || isNaN(num/den)) ? fallback : Math.round(num/den*100);

const CARD_BRAND_OPTIONS = [
  "Visa", "Mastercard", "Elo", "Amex", "Hipercard", "Visa Infinite", "Mastercard Black",
];

function matchBrandToSelectOption(raw) {
  const r = String(raw ?? "").trim();
  const exact = CARD_BRAND_OPTIONS.find((o) => o.toLowerCase() === r.toLowerCase());
  if (exact) return exact;
  const lo = r.toLowerCase();
  if (lo.includes("infinite")) return "Visa Infinite";
  if (lo.includes("black")) return "Mastercard Black";
  if (lo.includes("master")) return "Mastercard";
  if (lo.includes("visa")) return "Visa";
  if (lo.includes("elo")) return "Elo";
  if (lo.includes("amex") || lo.includes("american")) return "Amex";
  if (lo.includes("hiper")) return "Hipercard";
  return CARD_BRAND_OPTIONS[0];
}

function formatLimitInputFromNumber(value) {
  if (value == null || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ─── CARTÕES PAGE ───────────────────────────────────────── */
const CartõesPage = ({ onNav, isMobile = false, onNovaItem, onLancarEstorno = null, cards: cardsProp, dataMode = "mock", organizationId = null, transactionsRefreshToken = 0 }) => {
  const urlSearch = useSearch({ strict: false });
  const navigate = useNavigate();
  const shouldUseRealData = shouldUseRealDataForMode(organizationId, dataMode);
  const creditCardsData = useCreditCardsData({
    organizationId,
    enabled: shouldUseRealData,
    transactionsRefreshToken,
  });
  const hasSeededCards = cardsProp !== undefined;
  const localCards = (cardsProp && cardsProp.length > 0)
    ? cardsProp
    : (hasSeededCards ? [] : (dataMode === "mock" ? CARTOES_DATA : []));
  const CARDS = shouldUseRealData
    ? (creditCardsData.cards.length > 0 ? creditCardsData.cards : (dataMode === "empty" ? localCards : []))
    : localCards;
  const isEmptyCards = (dataMode === "empty" && hasSeededCards && CARDS.length === 0) || (shouldUseRealData && !creditCardsData.isLoading && CARDS.length === 0);
  /* ── State ───────────────────────────────────────────────── */
  const [cardId,        setCardId]        = useState(() => (cardsProp && cardsProp.length > 0 ? cardsProp[0].id : "nubank"));
  const [tab,           setTab]           = useState("fatura");
  const [faturaIdx,     setFaturaIdx]     = useState(5);
  const faturaIdxRef = useRef(faturaIdx);
  const prevCardsSnapshotRef = useRef(null);
  faturaIdxRef.current = faturaIdx;
  const [search,        setSearch]        = useState("");
  const [filterCat,     setFilterCat]     = useState(null);
  const [expandedDate,  setExpandedDate]  = useState(null);
  const [parcelaModal,  setParcelaModal]  = useState(null);
  const [parcelaTarget, setParcelaTarget] = useState(null);
  const [parcelaOk,     setParcelaOk]     = useState(false);
  const [markedPago,    setMarkedPago]    = useState({});
  const [markingPago,   setMarkingPago]   = useState(false);
  const [exportModal,   setExportModal]   = useState(false);
  const [expCats,       setExpCats]       = useState({});
  const [expParcelas,   setExpParcelas]   = useState(true);
  const [expRec,        setExpRec]        = useState(true);
  const [expNormal,     setExpNormal]     = useState(true);
  const [addCardSheet,  setAddCardSheet]  = useState(false);
  const [editCardSheet, setEditCardSheet] = useState(false);
  const [editingCardId, setEditingCardId] = useState(null);
  const [visibleGroups, setVisibleGroups] = useState(8); // pagination
  const [draftIssuer,     setDraftIssuer]     = useState("");
  const [draftName,       setDraftName]       = useState("");
  const [draftLast4,      setDraftLast4]      = useState("");
  const [draftBrand,      setDraftBrand]      = useState("Visa");
  const [draftLimit,      setDraftLimit]      = useState("");
  const [draftDueDay,     setDraftDueDay]     = useState("");
  const [draftClosingDay, setDraftClosingDay] = useState("");
  const [draftSuccess,    setDraftSuccess]    = useState(false);
  const cardSheetOpen = addCardSheet || editCardSheet;
  const clearCardFormState = () => {
    setDraftSuccess(false);
    setAddCardSheet(false);
    setEditCardSheet(false);
    setEditingCardId(null);
    setDraftIssuer("");
    setDraftName("");
    setDraftLast4("");
    setDraftBrand("Visa");
    setDraftLimit("");
    setDraftDueDay("");
    setDraftClosingDay("");
  };
  const openAddCardSheet = useCallback(() => {
    setDraftSuccess(false);
    setEditCardSheet(false);
    setEditingCardId(null);
    setDraftIssuer("");
    setDraftName("");
    setDraftLast4("");
    setDraftBrand("Visa");
    setDraftLimit("");
    setDraftDueDay("");
    setDraftClosingDay("");
    setAddCardSheet(true);
  }, []);
  useEffect(() => {
    if (urlSearch[FC.ADD] !== "1") return;
    openAddCardSheet();
    navigate({
      replace: true,
      search: (prev) => {
        const next = { ...prev };
        delete next[FC.ADD];
        return next;
      },
    });
  }, [urlSearch[FC.ADD], navigate, openAddCardSheet]);

  const handleSaveCard = async () => {
    if (shouldUseRealData) {
      try {
        await creditCardsData.createCard(buildCreateCreditCardPayload({
          organizationId,
          brand: draftBrand || draftIssuer,
          displayName: draftName || draftIssuer,
          last4Digits: draftLast4,
          limitInput: draftLimit,
          dueDay: draftDueDay,
          closingDay: draftClosingDay,
        }));
      } catch {
        return;
      }
    }
    setDraftSuccess(true);
    setTimeout(() => { clearCardFormState(); }, 1100);
  };

  const handleUpdateCard = async () => {
    if (!editingCardId || !shouldUseRealData) return;
    try {
      await creditCardsData.updateCard(editingCardId, buildUpdateCreditCardPayload({
        organizationId,
        brand: draftBrand || draftIssuer,
        displayName: draftName || draftIssuer,
        last4Digits: draftLast4,
        limitInput: draftLimit,
        dueDay: draftDueDay,
        closingDay: draftClosingDay,
      }));
    } catch {
      return;
    }
    setDraftSuccess(true);
    setTimeout(() => { clearCardFormState(); }, 1100);
  };

  /* ── Card form sheet (add / edit) ─────────────────────────── */
  const CardFormSheet = () => {
    if (!cardSheetOpen) return null;
    const isEdit = editCardSheet;
    const canSave = draftIssuer&&draftName&&draftLast4&&draftLimit&&draftDueDay;
    const saving = isEdit ? creditCardsData.isUpdatingCard : creditCardsData.isSavingCard;
    const FI=({val,set,ph,type="text"})=>(
      <div style={{display:"flex",alignItems:"center",padding:"9px 12px",border:`1px solid ${T.border}`,borderRadius:9,background:T.surface,transition:"border-color 0.15s"}}
        onFocusCapture={e=>e.currentTarget.style.borderColor=T.blue}
        onBlurCapture={e=>e.currentTarget.style.borderColor=T.border}>
        <input value={val} onChange={e=>set(e.target.value)} placeholder={ph} type={type}
          style={{...G,flex:1,minWidth:0,border:"none",outline:"none",background:"transparent",fontSize:13,color:T.ink}}/>
      </div>
    );
    const inner=(
      <>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexShrink:0,gap:12}}>
          <div style={{minWidth:0}}>
            <div style={{...G,fontSize:14,fontWeight:800,color:T.ink}}>{isEdit?"Editar cartão":"Adicionar cartão"}</div>
            {isEdit && (
              <div style={{...G,fontSize:12,fontWeight:500,color:T.inkMid,marginTop:5,lineHeight:1.45}}>
                Atualize nome, limite e datas. Alterar os 4 dígitos afeta como o cartão é identificado nas transações.
              </div>
            )}
          </div>
          <button type="button" onClick={clearCardFormState} style={{background:T.grayLight,border:"none",cursor:"pointer",padding:7,borderRadius:8,display:"flex",flexShrink:0}}><X size={14} color={T.inkMid}/></button>
        </div>
        <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"20px",display:"flex",flexDirection:"column",gap:14}}>
          {/* Preview card stub */}
          <div style={{height:96,borderRadius:14,background:`linear-gradient(135deg,#374151,#6B7280)`,
            display:"flex",flexDirection:"column",justifyContent:"space-between",padding:"14px 18px",
            position:"relative",overflow:"hidden",marginBottom:4}}>
            <div style={{position:"absolute",top:-20,right:-20,width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,0.06)"}}/>
            <div style={{...G,fontSize:10,fontWeight:800,color:"rgba(255,255,255,0.7)",textTransform:"uppercase",letterSpacing:"0.14em"}}>
              {draftIssuer||"BANCO"}
            </div>
            <div style={{...M_MONO,...NUM,fontSize:13,color:"rgba(255,255,255,0.6)",letterSpacing:"0.18em"}}>
              ···· ···· ···· {draftLast4||"····"}
            </div>
            <div style={{...G,fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.9)"}}>{draftName||"Nome do cartão"}</div>
          </div>
          <div>
            <div style={{...G,fontSize:10,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:7}}>Banco / Emissor</div>
            <FI val={draftIssuer} set={setDraftIssuer} ph="ex: Nubank, Itaú, Bradesco…"/>
          </div>
          <div>
            <div style={{...G,fontSize:10,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:7}}>Nome do cartão</div>
            <FI val={draftName} set={setDraftName} ph="ex: Nubank Roxinho, Personnalité…"/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <div style={{...G,fontSize:10,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:7}}>4 últimos dígitos</div>
              <FI val={draftLast4} set={setDraftLast4} ph="1234" type="number"/>
            </div>
            <div>
              <div style={{...G,fontSize:10,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:7}}>Bandeira</div>
              <div style={{display:"flex",flexDirection:"column",position:"relative"}}>
                <select value={draftBrand} onChange={e=>setDraftBrand(e.target.value)}
                  style={{...G,padding:"9px 12px",border:`1px solid ${T.border}`,borderRadius:9,background:T.surface,fontSize:13,color:T.ink,cursor:"pointer",appearance:"none"}}>
                  {CARD_BRAND_OPTIONS.map((b) => <option key={b}>{b}</option>)}
                </select>
                <ChevronDown size={13} color={T.inkLight} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}/>
              </div>
            </div>
          </div>
          <div>
            <div style={{...G,fontSize:10,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:7}}>Limite total</div>
            <div style={{display:"flex",alignItems:"center",padding:"9px 12px",border:`1px solid ${T.border}`,borderRadius:9,background:T.surface}}
              onFocusCapture={e=>e.currentTarget.style.borderColor=T.blue}
              onBlurCapture={e=>e.currentTarget.style.borderColor=T.border}>
              <span style={{...G,fontSize:13,fontWeight:700,color:T.inkLight,marginRight:4}}>R$</span>
              <input value={draftLimit} onChange={e=>setDraftLimit(e.target.value)} placeholder="0,00" type="text"
                style={{...G,...NUM,flex:1,border:"none",outline:"none",background:"transparent",fontSize:13,color:T.ink}}/>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <div style={{...G,fontSize:10,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:7}}>Dia do vencimento</div>
              <FI val={draftDueDay} set={setDraftDueDay} ph="ex: 10" type="number"/>
            </div>
            <div>
              <div style={{...G,fontSize:10,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:7}}>Dia do fechamento</div>
              <FI val={draftClosingDay} set={setDraftClosingDay} ph="ex: 3" type="number"/>
            </div>
          </div>
          <div style={{background:T.blueLight,border:`1px solid ${T.blue}22`,borderRadius:10,padding:"10px 14px"}}>
            <div style={{...G,fontSize:11,color:T.blue,lineHeight:1.65}}>
              💡 <strong>Dica financeira:</strong> O dia do fechamento define o início do período de compras. Compras feitas logo após o fechamento têm mais prazo para pagamento.
            </div>
          </div>
        </div>
        <div style={{padding:"14px 20px",borderTop:`1px solid ${T.border}`,flexShrink:0}}>
          {creditCardsData.error && (
            <div style={{...G,fontSize:12,color:T.red,background:T.redLight,border:`1px solid ${T.red}22`,borderRadius:10,padding:"10px 12px",marginBottom:12,lineHeight:1.5}}>
              {creditCardsData.error}
            </div>
          )}
          <button type="button" onClick={isEdit?handleUpdateCard:handleSaveCard} disabled={!canSave || saving}
            style={{...G,width:"100%",padding:"13px",borderRadius:10,border:"none",
              background:draftSuccess?T.green:(!canSave || saving)?T.inkGhost:T.ink,
              color:"#fff",fontSize:13,fontWeight:700,cursor:canSave?"pointer":"not-allowed",
              display:"flex",alignItems:"center",justifyContent:"center",gap:7,transition:"background 0.2s"}}>
            {draftSuccess
              ? <><Check size={14}/> {isEdit?"Alterações salvas!":"Cartão adicionado!"}</>
              : (isEdit?"Salvar alterações":"Adicionar cartão")}
          </button>
        </div>
      </>
    );
    const wrap=(ch)=>isMobile?(
      <div style={{position:"fixed",inset:0,zIndex:400,overflow:"hidden",display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
        <div onClick={clearCardFormState} style={{position:"absolute",inset:0,background:"rgba(15,23,35,0.5)"}}/>
        <div style={{position:"relative",background:T.surface,borderRadius:"24px 24px 0 0",maxHeight:"95vh",display:"flex",flexDirection:"column",animation:"sheetUp 0.5s cubic-bezier(0.32,0.72,0,1) both"}}>
          <div style={{display:"flex",justifyContent:"center",padding:"12px 0 4px"}}><div style={{width:36,height:4,borderRadius:99,background:T.inkGhost}}/></div>
          {ch}
        </div>
      </div>
    ):(
      <div style={{position:"fixed",inset:0,zIndex:400,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div onClick={clearCardFormState} style={{position:"absolute",inset:0,background:"rgba(15,23,35,0.38)"}}/>
        <div style={{position:"relative",width:460,maxHeight:"88vh",background:T.surface,borderRadius:18,boxShadow:T.dark,display:"flex",flexDirection:"column",overflow:"hidden"}}>{ch}</div>
      </div>
    );
    return wrap(inner);
  };
  useEffect(() => {
    if (CARDS.length === 0) {
      prevCardsSnapshotRef.current = CARDS;
      return;
    }
    const nextCard = CARDS.find((item) => item.id === cardId) || CARDS[0];
    if (!nextCard) return;

    const fixCardId = nextCard.id !== cardId;
    if (fixCardId) setCardId(nextCard.id);

    const prevCards = prevCardsSnapshotRef.current;
    const refresh = prevCards != null && prevCards !== CARDS;
    const firstSync = prevCards == null;

    if (refresh) {
      setFaturaIdx(
        faturaIdxAfterCardsRefresh(nextCard, prevCards, faturaIdxRef.current),
      );
    } else if (fixCardId || firstSync) {
      setFaturaIdx(defaultFaturaIndexForCard(nextCard.faturas || []));
    }

    prevCardsSnapshotRef.current = CARDS;
  }, [CARDS, cardId]);

  const card =
    CARDS.length > 0 ? (CARDS.find((c) => c.id === cardId) || CARDS[0]) : null;
  // Sentinel for cards with no billing history (e.g. freshly onboarded card)
  const EMPTY_FATURA = { id:"empty", mes:"—", val:0, pago:false, venc:"—", atual:true };
  const faturas   = card?.faturas || [];
  const fatura    = faturas.length > 0
    ? (faturas[faturaIdx] ?? faturas[faturas.length-1])
    : EMPTY_FATURA;
  const fatPrev   = faturaIdx > 0 ? faturas[faturaIdx-1] : null;
  const fatNext   = faturaIdx < faturas.length-1 ? faturas[faturaIdx+1] : null;
  const isAtual   = !!fatura?.atual;
  const isPago    = markedPago[fatura?.id] || fatura?.pago;

  const usoPct   = card ? safe(card.limite - card.disponivel, card.limite) : 0;
  const usoColor = usoPct >= 90 ? T.red : usoPct >= 70 ? T.amber : T.green;
  const mediaVal = faturas.length > 0 ? Math.round(faturas.reduce((s,f) => s+f.val, 0) / faturas.length) : 0;
  const diffPct  = fatPrev && fatPrev.val > 0
    ? Math.round((((fatura?.val||0)||0) - fatPrev.val) / fatPrev.val * 100)
    : 0;

  const fmtBRL = v => "R$\u00a0" + Math.abs(v).toLocaleString("pt-BR",{minimumFractionDigits:2});
  const fmtK   = v => Math.abs(v)>=1000 ? (Math.abs(v)/1000).toFixed(1)+"k" : String(Math.abs(v));

  const switchCard = (id) => {
    const fromCard = CARDS.find((x) => x.id === cardId) || CARDS[0];
    const fromList = fromCard?.faturas || [];
    const viewedInvoice = fromList[faturaIdx];

    setCardId(id);
    const c = CARDS.find((x) => x.id === id) || CARDS[0];
    setFaturaIdx(faturaIdxMatchingInvoiceRef(c?.faturas || [], viewedInvoice));
    setSearch(""); setFilterCat(null); setTab("fatura"); setVisibleGroups(8);
  };

  const canEditSelectedCard =
    Boolean(shouldUseRealData && card && card.cardId != null && Number.isFinite(Number(card.cardId)));

  const openEditCardSheet = () => {
    if (!canEditSelectedCard || !card) return;
    setAddCardSheet(false);
    setDraftSuccess(false);
    setEditingCardId(card.cardId);
    setDraftIssuer(String(card.banco || ""));
    setDraftName(String(card.nome || ""));
    setDraftLast4(String(card.dig || "").replace(/\D/g, "").slice(-4));
    setDraftBrand(matchBrandToSelectOption(card.bandeira || card.banco));
    setDraftLimit(formatLimitInputFromNumber(card.limite));
    setDraftDueDay(String(card.vencimento ?? ""));
    setDraftClosingDay(card.fechamento != null ? String(card.fechamento) : "");
    setEditCardSheet(true);
  };

  useEffect(() => { setVisibleGroups(8); }, [cardId, filterCat, search, faturaIdx]);

  // Itens de faturas anteriores (busca sob demanda ao navegar entre meses)
  const [pastItens,        setPastItens]        = useState([]);
  const [pastItensLoading, setPastItensLoading] = useState(false);

  useEffect(() => {
    if (isAtual || !shouldUseRealData || !card || !fatura?.year || !fatura?.month || !organizationId) {
      setPastItens([]);
      setPastItensLoading(false);
      return;
    }
    let cancelled = false;
    setPastItensLoading(true);
    fetchPastInvoiceItemsForUi(card.cardId, fatura.year, fatura.month, organizationId)
      .then((items) => { if (!cancelled) setPastItens(items); })
      .catch(() => { if (!cancelled) setPastItens([]); })
      .finally(() => { if (!cancelled) setPastItensLoading(false); });
    return () => { cancelled = true; };
  }, [
    isAtual,
    shouldUseRealData,
    card?.cardId,
    fatura?.year,
    fatura?.month,
    organizationId,
    transactionsRefreshToken,
  ]);

  // Safe aliases — guard against empty onboarding card
  const cardFaturas    = faturas;
  const cardItens      = card?.itens           || [];
  const cardParcelas   = card?.parcelas_ativas || [];
  const cardTendencia  = card?.tendencia       || [];
  const displayItens   = isAtual ? cardItens : pastItens;
  const recItems     = displayItens.filter(i => i.rec);
  const recTotal     = recItems.reduce((s,i) => s+i.val, 0);
  // Total comprometido em parcelas futuras (LÍQUIDO — descontando estornos).
  // Usa `card.limite − card.disponivel` que reflete o `used_limit` do backend,
  // já calculado como (Σ parcelas futuras − Σ estornos futuros), clamp em 0.
  const totalParcelasBruto = cardParcelas.reduce((s,p) => s+p.vParcela*(p.total-p.pago), 0);
  const totalEstornos = cardParcelas.reduce(
    (s,p) => s + (p.refundsSummary ? Number(p.refundsSummary.totalValue) : 0),
    0,
  );
  const totalParcelas = Math.max(0, totalParcelasBruto - totalEstornos);
  const hasParcelasEstornadas = totalEstornos > 0;

  const catColor = (it) => it.catColor || CAT_COLORS_CARD[it.cat] || T.inkMid;

  const faturaFilterChips = useMemo(() => {
    const m = new Map();
    displayItens.forEach((it) => {
      if (m.has(it.cat)) return;
      m.set(it.cat, catColor(it));
    });
    return Array.from(m.entries());
  }, [displayItens]);

  const TODAY_DAY  = 18;
  const projecao =
    card && isAtual && TODAY_DAY > 0 && ((fatura?.val || 0) || 0) > 0
      ? Math.round(
          (((fatura?.val || 0) || 0) / TODAY_DAY) *
            (card.vencimento > card.fechamento
              ? card.vencimento - card.fechamento
              : 30 + card.vencimento - card.fechamento),
        )
      : 0;
  const projecaoRisk = (card?.disponivel||0) > 0 && projecao > (card.disponivel + ((fatura?.val||0)||0));

  const filtered = useMemo(() => {
    let items = displayItens;
    if (filterCat) items = items.filter(i => i.cat === filterCat);
    if (search)    items = items.filter(i =>
      i.desc.toLowerCase().includes(search.toLowerCase()) ||
      i.cat.toLowerCase().includes(search.toLowerCase()));
    return items;
  }, [displayItens, filterCat, search]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((i) => {
      const key = i.dataKey || i.data || "—";
      if (!map[key]) map[key] = [];
      map[key].push(i);
    });
    const parseForSort = (k) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k)) {
        const [y, mo, d] = k.split("-").map(Number);
        return new Date(y, mo - 1, d).getTime();
      }
      const parts = k.split("/");
      if (parts.length >= 2 && k !== "—") {
        const da = Number(parts[0]);
        const ma = Number(parts[1]);
        if (Number.isFinite(da) && Number.isFinite(ma)) return new Date(2026, ma - 1, da).getTime();
      }
      return 0;
    };
    return Object.entries(map).sort((a, b) => parseForSort(b[0]) - parseForSort(a[0]));
  }, [filtered]);

  const PAGE_GROUPS   = 8;
  const pagedGroups   = grouped.slice(0, visibleGroups);
  const hasMoreGroups = grouped.length > visibleGroups;
  const totalItems    = filtered.length;
  const visibleItems  = pagedGroups.reduce((s,[,items])=>s+items.length, 0);

  const catTotals = useMemo(() => {
    const map = {};
    const colorByCat = {};
    displayItens.forEach((i) => {
      map[i.cat] = (map[i.cat] || 0) + i.val;
      if (colorByCat[i.cat] == null) colorByCat[i.cat] = catColor(i);
    });
    const total = displayItens.reduce((s,i)=>s+i.val,0);
    return Object.entries(map)
      .sort((a,b) => b[1]-a[1])
      .map(([cat,val]) => ({
        cat, val,
        pct: total > 0 ? Math.round(val/total*100) : 0,
        color: colorByCat[cat] || T.inkMid,
      }));
  }, [displayItens]);

  // Category alerts: grew >20% vs prev month
  const catAlerts = useMemo(() => {
    if (!cardTendencia || cardTendencia.length < 2) return [];
    const last = cardTendencia.length > 0 ? cardTendencia[cardTendencia.length-1] : null;
    const prev = cardTendencia[cardTendencia.length-2];
    return Object.entries(last)
      .filter(([cat,val]) => cat!=="mes" && prev[cat]>0 && val>prev[cat] && ((val-prev[cat])/prev[cat])>0.15)
      .map(([cat,val]) => ({ cat, val, prev:prev[cat], pct:Math.round((val-prev[cat])/prev[cat]*100) }))
      .sort((a,b)=>b.pct-a.pct)
      .slice(0,3);
  }, [card]);

  // Loading / erro (dados reais) — antes do empty state; Rules of Hooks ok (só retorno condicional)
  if (
    shouldUseRealData &&
    creditCardsData.error &&
    creditCardsData.cards.length === 0 &&
    !creditCardsData.isLoading
  ) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div style={{ ...G, fontSize:22, fontWeight:800, color:T.ink }}>Meus <span style={{ fontFamily:"'Instrument Serif',serif", fontStyle:"italic", fontWeight:400 }}>Cartões</span></div>
        </div>
        <div style={{ ...G, fontSize:14, color:T.red, background:T.redLight, border:`1px solid ${T.red}22`, borderRadius:16, padding:"28px 24px" }}>
          {creditCardsData.error}
        </div>
      </div>
    );
  }

  if (shouldUseRealData && creditCardsData.isLoading && creditCardsData.cards.length === 0) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div style={{ ...G, fontSize:22, fontWeight:800, color:T.ink }}>Meus <span style={{ fontFamily:"'Instrument Serif',serif", fontStyle:"italic", fontWeight:400 }}>Cartões</span></div>
        </div>
        <div style={{ ...G, fontSize:14, color:T.inkMid, background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:"28px 24px" }}>
          Carregando cartões…
        </div>
      </div>
    );
  }

  // Empty state — must run after every hook above (Rules of Hooks)
  if (CARDS.length === 0) {
    return (
      <>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
            <div style={{ ...G, fontSize:22, fontWeight:800, color:T.ink }}>Meus <span style={{ fontFamily:"'Instrument Serif',serif", fontStyle:"italic", fontWeight:400 }}>Cartões</span></div>
          </div>
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:"48px 32px", textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:14 }}>
            <div style={{ fontSize:40 }}>💳</div>
            <div style={{ ...G, fontSize:18, fontWeight:800, color:T.ink }}>Nenhum cartão cadastrado</div>
            <div style={{ ...G, fontSize:14, color:T.inkMid, lineHeight:1.7, maxWidth:380 }}>
              Adicione seus cartões de crédito para rastrear faturas, parcelas e assinaturas automaticamente.
            </div>
            <button type="button" onClick={openAddCardSheet}
              style={{ ...G, background:T.ink, color:"#fff", border:"none", borderRadius:11, padding:"11px 26px", fontSize:13, fontWeight:700, cursor:"pointer", marginTop:4 }}>
              + Adicionar cartão
            </button>
          </div>
        </div>
        <CardFormSheet/>
      </>
    );
  }

  /* ── Helpers ─────────────────────────────────────────────── */
  const parseFutureLabel = (label) => {
    const months = { Jan:1, Fev:2, Mar:3, Abr:4, Mai:5, Jun:6, Jul:7, Ago:8, Set:9, Out:10, Nov:11, Dez:12 };
    const match = /^([A-Za-zÀ-ú]{3})'(\d{2})$/.exec(label || "");
    if (!match) return null;
    const month = months[match[1]] || null;
    const year = Number(`20${match[2]}`);
    if (!month) return null;
    return { year, month };
  };

  const handleMarkPago = async () => {
    if (shouldUseRealData && fatura?.year && fatura?.month) {
      setMarkingPago(true);
      try {
        await creditCardsData.markInvoicePaid({
          cardId: card.cardId,
          year: fatura.year,
          month: fatura.month,
          organizationId,
        });
      } catch {
        setMarkingPago(false);
        return;
      }
      setMarkingPago(false);
      return;
    }

    setMarkingPago(true);
    setTimeout(()=>{ setMarkingPago(false); setMarkedPago(m=>({...m,[fatura?.id]:true})); }, 800);
  };

  const handleRealoc = async () => {
    if (shouldUseRealData && parcelaModal?.chargeId && parcelaModal?.installmentId && parcelaTarget) {
      const target = parseFutureLabel(parcelaTarget);
      if (!target) return;
      try {
        await creditCardsData.moveInstallment({
          cardId: card.cardId,
          chargeId: parcelaModal.chargeId,
          installmentId: parcelaModal.installmentId,
          organizationId,
          targetYear: target.year,
          targetMonth: target.month,
        });
      } catch {
        return;
      }
    }

    setParcelaOk(true);
    setTimeout(()=>{ setParcelaOk(false); setParcelaModal(null); setParcelaTarget(null); }, 1100);
  };

  const handleExportCSV = () => {
    let rows = ["Descrição,Categoria,Valor,Data,Parcela,Recorrente"];
    let items = displayItens;
    const activeCats = Object.entries(expCats).filter(([,v])=>v).map(([k])=>k);
    if (activeCats.length>0) items = items.filter(i=>activeCats.includes(i.cat));
    if (!expParcelas) items = items.filter(i=>!i.parcela);
    if (!expRec)      items = items.filter(i=>!i.rec);
    if (!expNormal)   items = items.filter(i=>i.rec||i.parcela);
    items.forEach(i => rows.push(
      `"${i.desc}","${i.cat}","${i.val.toFixed(2).replace(".",",")}","${i.data}","${i.parcela?`${i.parcela.n}/${i.parcela.t}`:"-"}","${i.rec?"Sim":"Não"}"`
    ));
    const a = Object.assign(document.createElement("a"),{
      href:URL.createObjectURL(new Blob([rows.join("\n")],{type:"text/csv"})),
      download:`fatura-${card.nome}-${fatura?.mes}.csv`
    });
    a.click(); setExportModal(false);
  };


  /* ── CardVisual ──────────────────────────────────────────── */
  const CardVisual = ({ c, selected, size="md" }) => {
    const W = size==="sm"?130:size==="md"?200:260, H=Math.round(W/1.586);
    const pct = safe(c.limite-c.disponivel, c.limite);
    return (
      <div onClick={()=>switchCard(c.id)} style={{
        width:W,height:H,borderRadius:size==="sm"?12:16,flexShrink:0,cursor:"pointer",
        position:"relative",overflow:"hidden",
        background:`linear-gradient(135deg, ${c.cor1} 0%, ${c.cor2} 100%)`,
        boxShadow:selected?`0 20px 50px ${c.cor2}55,0 0 0 2px ${c.corChip}88`:"0 4px 20px rgba(0,0,0,0.18)",
        transition:"all 0.25s cubic-bezier(0.4,0,0.2,1)",
        transform:selected?"translateY(-4px) scale(1.02)":"none",
        padding:size==="sm"?"11px 13px":"16px 18px",
        display:"flex",flexDirection:"column",justifyContent:"space-between",userSelect:"none",
      }}>
        <div style={{position:"absolute",top:-W*0.3,right:-W*0.2,width:W*0.8,height:W*0.8,
          borderRadius:"50%",background:`${c.corChip}12`,pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:-W*0.2,left:-W*0.1,width:W*0.55,height:W*0.55,
          borderRadius:"50%",background:"rgba(255,255,255,0.04)",pointerEvents:"none"}}/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",position:"relative"}}>
          <div style={{...G,fontSize:size==="sm"?8:10,fontWeight:800,color:c.corChip,
            textTransform:"uppercase",letterSpacing:"0.16em"}}>{c.banco}</div>
          <svg width={size==="sm"?14:17} height={size==="sm"?18:22} viewBox="0 0 17 22" fill="none">
            <circle cx="4" cy="11" r="2" fill="rgba(255,255,255,0.7)"/>
            <path d="M7 6 Q14 11 7 16" stroke="rgba(255,255,255,0.55)" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
            <path d="M10 3 Q20 11 10 19" stroke="rgba(255,255,255,0.3)" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
          </svg>
        </div>
        {size!=="sm" && (
          <div style={{width:30,height:22,borderRadius:4,alignSelf:"flex-start",
            background:"linear-gradient(135deg,#C9A84C 0%,#F0D060 45%,#C9A84C 100%)",position:"relative"}}>
            <div style={{position:"absolute",top:"40%",left:0,right:0,height:"1px",background:"rgba(0,0,0,0.2)"}}/>
            <div style={{position:"absolute",left:"33%",top:0,bottom:0,width:"1px",background:"rgba(0,0,0,0.15)"}}/>
          </div>
        )}
        <div style={{...M_MONO,...NUM,fontSize:size==="sm"?9:11,color:"rgba(255,255,255,0.65)",letterSpacing:"0.18em"}}>
          ···· ···· ···· {c.dig}
        </div>
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",position:"relative"}}>
          <div>
            <div style={{...G,fontSize:size==="sm"?7.5:9,color:"rgba(255,255,255,0.5)",marginBottom:2}}>vence dia {c.vencimento}</div>
            <div style={{...G,fontSize:size==="sm"?10:12,fontWeight:700,color:"rgba(255,255,255,0.92)"}}>{c.nome}</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
            {pct>=70&&<div style={{...G,fontSize:7,fontWeight:800,color:pct>=90?"#7F1D1D":"#78350F",
              background:pct>=90?"#FCA5A5":"#FCD34D",borderRadius:5,padding:"2px 6px"}}>{pct}%</div>}
            <div style={{...G,fontSize:size==="sm"?7:8,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:"0.1em"}}>{c.bandeira}</div>
          </div>
        </div>
      </div>
    );
  };

  /* ── FaturaNav ───────────────────────────────────────────── */
  const FaturaNav = ({ compact=false }) => (
    <div style={{display:"flex",alignItems:"center",gap:compact?8:12}}>
      <button onClick={()=>fatPrev&&setFaturaIdx(i=>i-1)} style={{width:30,height:30,borderRadius:9,
        border:`1px solid ${T.border}`,background:fatPrev?T.surface:T.grayLight,
        cursor:fatPrev?"pointer":"not-allowed",display:"flex",alignItems:"center",
        justifyContent:"center",opacity:fatPrev?1:0.3,transition:"all 0.15s"}}>
        <ChevronLeft size={14} color={T.inkMid}/>
      </button>
      <div style={{textAlign:"center",minWidth:compact?80:100}}>
        <div style={{...G,...NUM,fontSize:compact?12:14,fontWeight:800,color:T.ink}}>{fatura?.mes}</div>
        {fatura?.atual&&<div style={{...G,fontSize:10,fontWeight:700,color:T.blue,textTransform:"uppercase",letterSpacing:"0.09em"}}>Atual</div>}
      </div>
      <button onClick={()=>fatNext&&setFaturaIdx(i=>i+1)} style={{width:30,height:30,borderRadius:9,
        border:`1px solid ${T.border}`,background:fatNext?T.surface:T.grayLight,
        cursor:fatNext?"pointer":"not-allowed",display:"flex",alignItems:"center",
        justifyContent:"center",opacity:fatNext?1:0.3,transition:"all 0.15s"}}>
        <ChevronRight size={14} color={T.inkMid}/>
      </button>
    </div>
  );

  /* ── KPI strip (always visible at top) ──────────────────── */
  const KpiStrip = () => {
    const limiteUtilizado = safe(card.limite-card.disponivel, card.limite);
    const saudeLabel = limiteUtilizado<=30?"Saudável":limiteUtilizado<=60?"Regular":limiteUtilizado<=80?"Atenção":"Crítico";
    const saudeColor = limiteUtilizado<=30?T.green:limiteUtilizado<=60?T.blue:limiteUtilizado<=80?T.amber:T.red;
    return (
      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:isMobile?10:12}}>
        {[
          { label:"Fatura atual",   val:fmtBRL((fatura?.val||0)), sub: diffPct!==0?`${diffPct>0?"↑":"↓"} ${Math.abs(diffPct)}% vs ${fatPrev?.mes||"—"}`:"Primeira fatura", color:diffPct>0?T.red:T.green },
          { label:"Disponível",     val:fmtBRL(card.disponivel), sub:`${100-limiteUtilizado}% do limite livre`, color:usoColor },
          { label:"Média mensal",   val:fmtBRL(mediaVal), sub:`últimos ${cardFaturas.length} meses`, color:T.blue },
          { label:"Saúde do cartão",val:saudeLabel, sub:`${limiteUtilizado}% do limite utilizado`, color:saudeColor },
        ].map((k,i)=>(
          <div key={i} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:isMobile?"12px 14px":"14px 16px"}}>
            <div style={{...G,fontSize:10,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:5}}>{k.label}</div>
            <div style={{...G,...NUM,fontSize:isMobile?15:18,fontWeight:800,color:k.color,lineHeight:1.2}}>{k.val}</div>
            <div style={{...G,fontSize:10,color:T.inkMid,marginTop:4}}>{k.sub}</div>
          </div>
        ))}
      </div>
    );
  };

  /* ── LimitBar ────────────────────────────────────────────── */
  const LimitBar = () => (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
        <span style={{...G,fontSize:11,color:T.inkMid}}>Limite utilizado</span>
        <span style={{...G,fontSize:11,fontWeight:700,color:usoColor}}>{usoPct}%</span>
      </div>
      <div style={{height:6,background:T.grayLight,borderRadius:99,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${usoPct}%`,
          background:`linear-gradient(90deg,${usoColor}88,${usoColor})`,
          borderRadius:99,transition:"width 0.9s cubic-bezier(0.4,0,0.2,1)"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
        <span style={{...G,...NUM,fontSize:10,color:T.inkLight}}>{fmtBRL(card.limite-card.disponivel)} usados</span>
        <span style={{...G,...NUM,fontSize:10,color:T.inkLight}}>limite {fmtBRL(card.limite)}</span>
      </div>
    </div>
  );

  /* ── CatBars ─────────────────────────────────────────────── */
  const CatBars = () => (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {catTotals.map((c,i)=>(
        <div key={i} onClick={()=>setFilterCat(filterCat===c.cat?null:c.cat)}
          style={{cursor:"pointer",opacity:filterCat&&filterCat!==c.cat?0.35:1,transition:"opacity 0.15s"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              <div style={{width:8,height:8,borderRadius:2,background:c.color,flexShrink:0}}/>
              <span style={{...G,fontSize:12,color:T.ink,fontWeight:filterCat===c.cat?700:400}}>{c.cat}</span>
            </div>
            <div style={{display:"flex",gap:10}}>
              <span style={{...G,...NUM,fontSize:12,fontWeight:700,color:T.ink}}>{fmtBRL(c.val)}</span>
              <span style={{...G,fontSize:10,color:T.inkLight,minWidth:28,textAlign:"right"}}>{c.pct}%</span>
            </div>
          </div>
          <div style={{height:4,background:T.grayLight,borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${c.pct}%`,background:c.color,borderRadius:99,transition:"width 0.7s cubic-bezier(0.4,0,0.2,1)"}}/>
          </div>
        </div>
      ))}
      {filterCat&&<button onClick={()=>setFilterCat(null)} style={{...G,fontSize:11,color:T.inkMid,background:"none",border:`1px solid ${T.border}`,borderRadius:8,padding:"5px 12px",cursor:"pointer",alignSelf:"flex-start"}}>✕ Limpar filtro</button>}
    </div>
  );

  /* ── TxRow ───────────────────────────────────────────────── */
  const TxRow = ({ item }) => {
    const isParcela = item.parcela && item.parcela.n;
    const parcelaVal = isParcela
      ? (item.parcela.val != null && Number.isFinite(Number(item.parcela.val)) ? item.parcela.val : item.val)
      : 0;
    const parcelaTotal = isParcela
      ? (item.parcela.total != null && Number.isFinite(Number(item.parcela.total))
        ? item.parcela.total
        : parcelaVal * item.parcela.t)
      : 0;
    const cc = catColor(item);
    const [expanded, setExpanded] = useState(false);
    const hasLinkedRefunds = !!(item.refundsSummary && item.refundsSummary.count > 0);
    const canLancarEstorno = !item.isRefund && item.transactionId != null && !!onLancarEstorno && !hasLinkedRefunds;
    const expandable = !!(item.method || isParcela || hasLinkedRefunds || canLancarEstorno);

    return (
      <div style={{ borderBottom:`1px solid ${T.border}` }}>
        {/* ── Main row ── */}
        <div
          onClick={() => expandable && setExpanded((e) => !e)}
          style={{
            display:"flex", alignItems:"center", gap:0,
            padding:"0 20px", cursor: expandable ? "pointer" : "default",
            background: expanded ? `${cc}06` : "transparent",
            transition:"background 0.12s",
          }}
          onMouseEnter={e => { if (!expanded && expandable) e.currentTarget.style.background = T.bg; }}
          onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = "transparent"; }}
        >
          {/* Category accent bar */}
          <div style={{ width:3, alignSelf:"stretch", background: expanded ? cc : "transparent",
            borderRadius:99, marginRight:14, flexShrink:0, transition:"background 0.15s" }}/>

          {/* Icon */}
          <div style={{ width:40, height:40, borderRadius:12, flexShrink:0,
            background:`${cc}15`, display:"flex", alignItems:"center",
            justifyContent:"center", fontSize:19, margin:"12px 14px 12px 0" }}>
            {item.icon}
          </div>

          {/* Description + meta */}
          <div style={{ flex:1, minWidth:0, padding:"13px 0" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
              <span style={{ ...G, fontSize:13, fontWeight:600, color:T.ink,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {item.desc}
              </span>
              {isParcela && (
                <span style={{ ...G, fontSize:10, fontWeight:800, color:T.blue,
                  background:T.blueLight, borderRadius:6, padding:"1px 6px", flexShrink:0,
                  letterSpacing:"0.02em" }}>
                  {item.parcela.n}/{item.parcela.t}×
                </span>
              )}
              {item.rec && (
                <span style={{ ...G, fontSize:10, fontWeight:700, color:T.purple,
                  background:T.purpleLight, borderRadius:6, padding:"1px 6px", flexShrink:0 }}>
                  ↻
                </span>
              )}
              {hasLinkedRefunds && !item.isRefund && (
                <span title={`${item.refundsSummary.count} estorno${item.refundsSummary.count !== 1 ? "s" : ""} relacionado${item.refundsSummary.count !== 1 ? "s" : ""} · ${fmtBRL(item.refundsSummary.totalValue)} abatido${item.refundsSummary.count !== 1 ? "s" : ""}`}
                  style={{ ...G, fontSize:10, fontWeight:700, color:T.green,
                    background:T.greenLight, borderRadius:99, padding:"1px 6px", flexShrink:0,
                    cursor:"help", whiteSpace:"nowrap" }}>
                  ↺ Estorno
                </span>
              )}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:7, height:7, borderRadius:2, background:cc, flexShrink:0 }}/>
              <span style={{ ...G, fontSize:11, color:cc, fontWeight:600 }}>{item.cat}</span>
              <span style={{ color:T.border }}>·</span>
              <span style={{ ...G, fontSize:11, color:T.inkLight }}>{item.data}</span>
              {isParcela && (
                <>
                  <span style={{ color:T.border }}>·</span>
                  <span style={{ ...G, fontSize:11, color:T.inkLight }}>
                    {fmtBRL(parcelaVal)}/mês
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Amount + chevron */}
          <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0, paddingLeft:12 }}>
            <div style={{ textAlign:"right" }}>
              <div style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:14,
                fontWeight:700, color:T.ink, letterSpacing:"-0.01em" }}>
                {fmtBRL(item.val)}
              </div>
              {isParcela && (
                <div style={{ ...G, fontSize:10, color:T.blue, fontFamily:"'Geist Mono',monospace" }}>
                  total {fmtBRL(parcelaTotal)}
                </div>
              )}
            </div>
            <ChevronRight size={13} color={expanded ? cc : T.inkGhost}
              style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                transition:"transform 0.18s ease", flexShrink:0, opacity: expandable ? 1 : 0.22 }}/>
          </div>
        </div>

        {/* ── Expanded detail ── */}
        {expanded && expandable && (() => {
          const detailChips = [
            item.method && { label:"Método", val: item.method },
            isParcela    && { label:"Parcela", val:`${item.parcela.n}ª de ${item.parcela.t}` },
            isParcela    && { label:"Valor mensal", val: fmtBRL(parcelaVal), mono:true },
            isParcela    && { label:"Total compra", val: fmtBRL(parcelaTotal), mono:true },
            isParcela    && { label:"Restante", val: fmtBRL(parcelaTotal - item.parcela.n * parcelaVal), mono:true, color:T.blue },
          ].filter(Boolean);
          if (detailChips.length === 0 && !isParcela && !hasLinkedRefunds && !canLancarEstorno) return null;
          return (
          <div style={{ padding:"0 20px 14px 71px",
            background:`${cc}06`, animation:"fadeIn 0.15s ease" }}>
            {detailChips.length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {detailChips.map((chip, i) => (
                <div key={i} style={{ background:T.surface, border:`1px solid ${T.border}`,
                  borderRadius:9, padding:"6px 12px" }}>
                  <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkGhost,
                    textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:2 }}>
                    {chip.label}
                  </div>
                  <div style={{ ...G, fontSize:12, fontWeight:700,
                    fontFamily: chip.mono ? "'Geist Mono',monospace" : "inherit",
                    color: chip.color || T.ink }}>
                    {chip.val}
                  </div>
                </div>
              ))}
            </div>
            )}
            {isParcela && (
              <div style={{ marginTop: detailChips.length > 0 ? 10 : 0 }}>
                <div style={{ height:4, background:T.grayLight, borderRadius:99, overflow:"hidden" }}>
                  <div style={{ height:"100%", borderRadius:99,
                    width:`${Math.round((item.parcela.n / item.parcela.t) * 100)}%`,
                    background:`linear-gradient(to right, ${cc}, ${T.blue})`,
                    transition:"width 0.6s cubic-bezier(0.16,1,0.3,1)" }}/>
                </div>
                <div style={{ ...G, fontSize:10, color:T.inkLight, marginTop:4 }}>
                  {Math.round((item.parcela.n / item.parcela.t) * 100)}% pago
                  · {item.parcela.t - item.parcela.n} parcelas restantes
                </div>
              </div>
            )}
            {hasLinkedRefunds && (
              <div style={{ marginTop:10, padding:"10px 12px", background:T.greenLight,
                border:`1px solid ${T.green}33`, borderRadius:9,
                display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:14, color:T.green }}>↺</span>
                <div style={{ flex:1 }}>
                  <div style={{ ...G, fontSize:11, fontWeight:700, color:T.green }}>
                    Esta compra possui estorno relacionado
                  </div>
                  <div style={{ ...G, fontSize:10, color:T.inkMid, marginTop:2 }}>
                    {item.refundsSummary.count} lançamento{item.refundsSummary.count !== 1 ? "s" : ""} de estorno
                    {" · "}
                    <span style={{ fontFamily:"'Geist Mono',monospace", fontWeight:700 }}>
                      {fmtBRL(item.refundsSummary.totalValue)}
                    </span>
                    {" abatido"}{item.refundsSummary.count !== 1 ? "s" : ""}{" no total"}
                  </div>
                </div>
              </div>
            )}
            {/* CTA: lançar estorno linkado a esta exata compra (parcela ou não).
                Oculto em linhas que já são estorno OU que já têm estorno linkado
                (evita botão "Lançar estorno" duplicado quando o banner verde
                "Esta compra possui estorno relacionado" já está renderizado acima). */}
            {canLancarEstorno && (
              <div style={{ marginTop:10 }}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onLancarEstorno(item, card); }}
                  style={{ ...G, display:"inline-flex", alignItems:"center", gap:6,
                    padding:"7px 12px", borderRadius:8, border:`1px dashed ${T.green}66`,
                    background:"transparent", color:T.green, fontSize:11, fontWeight:700, cursor:"pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = T.greenLight; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <RotateCcw size={12} /> Lançar estorno desta compra
                </button>
              </div>
            )}
          </div>
          );
        })()}
      </div>
    );
  };

  /* ── DateGroup ─────────────────────────────────────────────── */
  const DateGroup = ({ date, items }) => {
    const total    = items.reduce((s,i) => s + i.val, 0);
    const isOpen   = expandedDate === null || expandedDate === date;
    const dayLabel = (() => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const [y, mo, d] = date.split("-").map(Number);
        const dt = new Date(y, mo - 1, d);
        const wd = dt.toLocaleDateString("pt-BR",{weekday:"short"});
        const dm = dt.toLocaleDateString("pt-BR",{day:"numeric", month:"long"});
        return { weekday: wd.replace(".",""), full: dm };
      }
      const parts = date.split("/");
      if (parts.length < 2) return date;
      const d  = new Date(2026, +parts[1]-1, +parts[0]);
      const wd = d.toLocaleDateString("pt-BR",{weekday:"short"});
      const dm = d.toLocaleDateString("pt-BR",{day:"numeric", month:"long"});
      return { weekday: wd.replace(".",""), full: dm };
    })();
    return (
      <div style={{ marginBottom:0 }}>
        {/* Group header */}
        <div
          onClick={() => setExpandedDate(expandedDate === date ? null : date)}
          style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"8px 20px", cursor:"pointer", userSelect:"none",
            background:T.bg, borderBottom:`1px solid ${T.border}`,
            position:"sticky", top:0, zIndex:1 }}
          onMouseEnter={e => e.currentTarget.style.background = "#EFEEEB"}
          onMouseLeave={e => e.currentTarget.style.background = T.bg}
        >
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <ChevronRight size={11} color={T.inkLight}
              style={{ transform:isOpen?"rotate(90deg)":"rotate(0deg)",
                transition:"transform 0.18s" }}/>
            <span style={{ ...G, fontSize:10, fontWeight:700, color:T.inkGhost,
              textTransform:"uppercase", letterSpacing:"0.07em", minWidth:28 }}>
              {typeof dayLabel === "string" ? dayLabel : dayLabel.weekday}
            </span>
            <span style={{ ...G, fontSize:12, fontWeight:700, color:T.inkMid }}>
              {typeof dayLabel === "string" ? "" : dayLabel.full}
            </span>
            <span style={{ ...G, fontSize:11, color:T.inkGhost, fontWeight:500 }}>
              · {items.length} {items.length === 1 ? "item" : "itens"}
            </span>
          </div>
          <span style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:12,
            fontWeight:700, color:T.inkMid, letterSpacing:"-0.01em" }}>
            {fmtBRL(total)}
          </span>
        </div>
        {/* Items */}
        {isOpen && items.map(item => <TxRow key={item.id} item={item}/>)}
      </div>
    );
  };

  /* ── RecorrênciasTab ─────────────────────────────────────── */
  const RecorrenciasTab = () => {
    const hasItems = recItems.length > 0;
    return (
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {/* Alert insight */}
        <div style={{background:T.purpleLight,border:`1px solid ${T.purple}22`,borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"flex-start",gap:10}}>
          <Repeat size={15} color={T.purple} style={{flexShrink:0,marginTop:1}}/>
          <div>
            <div style={{...G,fontSize:12,fontWeight:700,color:T.purple,marginBottom:3}}>Assinaturas e cobranças recorrentes</div>
            <div style={{...G,fontSize:11,color:T.inkMid,lineHeight:1.65}}>
              {hasItems
                ? <>{recItems.length} cobranças automáticas totalizam <strong style={{color:T.ink}}>{fmtBRL(recTotal)}</strong>/mês. São {(fatura?.val||0)>0?Math.round(recTotal/(fatura.val)*100):0}% da fatura atual.</>
                : "Nenhuma recorrência identificada nesta fatura."}
            </div>
          </div>
        </div>
        {hasItems && (
          <>
            {/* Summary KPIs */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:10}}>
              {[
                {label:"Total mensal",    val:fmtBRL(recTotal),         sub:`${recItems.length} assinaturas ativas`},
                {label:"Total anual",     val:fmtBRL(recTotal*12),      sub:"projeção 12 meses"},
                {label:"% da fatura",     val:`${(fatura?.val||0)>0?Math.round(recTotal/(fatura?.val||0)*100):0}%`, sub:"das cobranças são fixas"},
              ].map((k,i)=>(
                <div key={i} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px"}}>
                  <div style={{...G,fontSize:10,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:5}}>{k.label}</div>
                  <div style={{...G,...NUM,fontSize:16,fontWeight:800,color:T.purple}}>{k.val}</div>
                  <div style={{...G,fontSize:10,color:T.inkMid,marginTop:3}}>{k.sub}</div>
                </div>
              ))}
            </div>
            {/* List */}
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"0 16px"}}>
              <div style={{...G,fontSize:12,fontWeight:700,color:T.ink,padding:"13px 0",borderBottom:`1px solid ${T.border}`}}>
                Cobranças automáticas
              </div>
              {recItems.map(item=><TxRow key={item.id} item={item}/>)}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderTop:`1px solid ${T.border}`,marginTop:4}}>
                <span style={{...G,fontSize:12,color:T.inkMid}}>{recItems.length} recorrências</span>
                <span style={{...M_MONO,...NUM,fontSize:14,fontWeight:800,color:T.purple}}>{fmtBRL(recTotal)}</span>
              </div>
            </div>
            {/* Insight: potential savings */}
            <div style={{background:T.amberLight,border:`1px solid ${T.amber}22`,borderRadius:12,padding:"12px 16px"}}>
              <div style={{...G,fontSize:12,fontWeight:700,color:T.amber,marginBottom:4}}>💡 Revisão de assinaturas</div>
              <div style={{...G,fontSize:11,color:T.inkMid,lineHeight:1.65}}>
                Consultores financeiros recomendam revisar assinaturas a cada 3 meses. Cancele o que não usa — uma assinatura de {fmtBRL(recItems[0]?.val||0)} representa <strong>{fmtBRL((recItems[0]?.val||0)*12)}/ano</strong>.
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  /* ── AnálisesTab ─────────────────────────────────────────── */
  const AnálisesTab = () => {
          const hasData = cardFaturas.length > 0 || cardTendencia.length > 0;
      if (!hasData) return (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
          justifyContent:"center", padding:"48px 24px", gap:12, textAlign:"center" }}>
          <div style={{ fontSize:40 }}>📊</div>
          <div style={{ ...G, fontSize:15, fontWeight:700, color:T.ink }}>Sem histórico ainda</div>
          <div style={{ ...G, fontSize:13, color:T.inkMid, lineHeight:1.65, maxWidth:320 }}>
            As análises aparecem após o primeiro mês de uso do cartão.
          </div>
        </div>
      );
const trendCats = (cardTendencia && cardTendencia.length > 0) ? Object.keys(cardTendencia[0]).filter(k=>k!=="mes") : [];
    const trendColors = trendCats.reduce((m,c)=>({...m,[c]:CAT_COLORS_CARD[c]||T.inkMid}),{});
    // Spending velocity: day 18 of ~30
    const diasNoMes = 30;
    const velocPct  = safe(TODAY_DAY, diasNoMes);
    const gastosPct = safe((fatura?.val||0), card.limite);
    const onPace    = gastosPct <= velocPct;
    // Limite health score (0-100)
    const healthScore = card.limite > 0
      ? Math.max(0, 100 - usoPct - (totalParcelas / card.limite * 30))
      : (usoPct === 0 ? 100 : 0);
    const healthColor = healthScore>=70?T.green:healthScore>=40?T.amber:T.red;
    // Best purchase day tip
    const bestDay = card.fechamento + 1 > 28 ? 1 : card.fechamento + 1;
    return (
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {/* Consultant insights strip */}
        {catAlerts.length>0&&(
          <div style={{background:T.surface,border:`1px solid ${T.amber}44`,borderRadius:14,padding:"14px 18px"}}>
            <div style={{...G,fontSize:11,fontWeight:700,color:T.amber,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:10}}>⚠ Alertas de comportamento</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {catAlerts.map((a,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:T.amberLight,borderRadius:10}}>
                  <div style={{width:8,height:8,borderRadius:2,background:CAT_COLORS_CARD[a.cat]||T.inkMid,flexShrink:0}}/>
                  <span style={{...G,fontSize:12,color:T.ink,flex:1}}>
                    <strong>{a.cat}</strong> cresceu <strong style={{color:T.amber}}>+{a.pct}%</strong> em relação ao mês anterior
                  </span>
                  <span style={{...G,...NUM,fontSize:11,fontWeight:700,color:T.amber}}>{fmtBRL(a.val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cards row: velocity + health + best day */}
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:12}}>
          {/* Spending velocity */}
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px 18px"}}>
            <div style={{...G,fontSize:11,fontWeight:700,color:T.inkLight,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:10}}>Velocidade de gasto</div>
            <div style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{...G,fontSize:11,color:T.inkMid}}>Avançamos {velocPct}% do mês</span>
                <span style={{...G,fontSize:11,fontWeight:700,color:onPace?T.green:T.red}}>
                  {gastosPct}% do limite gasto
                </span>
              </div>
              <div style={{height:8,background:T.grayLight,borderRadius:99,overflow:"hidden",position:"relative"}}>
                <div style={{height:"100%",width:`${velocPct}%`,background:T.border,borderRadius:99}}/>
                <div style={{position:"absolute",top:0,left:0,height:"100%",width:`${gastosPct}%`,
                  background:`linear-gradient(90deg,${onPace?T.green:T.red}99,${onPace?T.green:T.red})`,borderRadius:99,transition:"width 0.8s"}}/>
              </div>
            </div>
            <div style={{...G,fontSize:11,color:T.inkMid,lineHeight:1.6}}>
              {onPace
                ? <>✅ Ritmo controlado. Projeção de fechamento: <strong>{fmtBRL(projecao)}</strong>.</>
                : <>🔴 Gasto acelerado. Projeção: <strong style={{color:T.red}}>{fmtBRL(projecao)}</strong> — acima do ritmo.</>}
            </div>
          </div>
          {/* Health score */}
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px 18px"}}>
            <div style={{...G,fontSize:11,fontWeight:700,color:T.inkLight,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:10}}>Score de saúde</div>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:10}}>
              <svg width={60} height={60} viewBox="0 0 60 60">
                <circle cx={30} cy={30} r={24} fill="none" stroke={T.grayLight} strokeWidth={6}/>
                <circle cx={30} cy={30} r={24} fill="none" stroke={healthColor} strokeWidth={6}
                  strokeDasharray={`${(healthScore/100)*150.8} 150.8`}
                  strokeLinecap="round" transform="rotate(-90 30 30)"
                  style={{transition:"stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)"}}/>
                <text x={30} y={35} textAnchor="middle" fontSize={14} fontWeight={800}
                  fill={healthColor} fontFamily="Geist Mono,monospace">{Math.round(healthScore)}</text>
              </svg>
              <div>
                <div style={{...G,fontSize:14,fontWeight:700,color:healthColor}}>
                  {healthScore>=70?"Saudável":healthScore>=40?"Regular":"Atenção"}
                </div>
                <div style={{...G,fontSize:10,color:T.inkLight,marginTop:2}}>de 100 pontos</div>
              </div>
            </div>
            <div style={{...G,fontSize:11,color:T.inkMid,lineHeight:1.6}}>
              Uso ideal do limite: abaixo de 30% preserva seu score de crédito.
            </div>
          </div>
          {/* Best day tip */}
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px 18px"}}>
            <div style={{...G,fontSize:11,fontWeight:700,color:T.inkLight,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:10}}>Melhor dia para compras</div>
            <div style={{...G,...NUM,fontSize:36,fontWeight:800,color:T.blue,marginBottom:6}}>
              Dia {bestDay}
            </div>
            <div style={{...G,fontSize:11,color:T.inkMid,lineHeight:1.65}}>
              Compras feitas logo após o fechamento (dia {card.fechamento}) têm quase <strong>30 dias extras</strong> de prazo sem juros.
            </div>
          </div>
        </div>

        {/* Trend chart */}
        {cardTendencia && (
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px 20px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div>
                <div style={{...G,fontSize:13,fontWeight:700,color:T.ink}}>Tendência por categoria</div>
                <div style={{...G,fontSize:10,color:T.inkLight,marginTop:2}}>Evolução dos gastos nos últimos 6 meses</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={isMobile?160:200}>
              <ReBarChart data={cardTendencia} margin={{top:4,right:4,left:-22,bottom:0}} barCategoryGap="32%">
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
                <XAxis dataKey="mes" tick={{...G,fontSize:10,fill:T.inkLight}} axisLine={false} tickLine={false}/>
                <YAxis tick={{...G,fontSize:10,fill:T.inkLight}} axisLine={false} tickLine={false} tickFormatter={v=>"R$"+fmtK(v)}/>
                <Tooltip content={({active,payload,label})=>{
                  if(!active||!payload?.length) return null;
                  return (
                    <div style={{...G,background:T.ink,borderRadius:10,padding:"8px 12px",boxShadow:T.dark}}>
                      <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginBottom:5}}>{label}</div>
                      {payload.map((p,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                          <div style={{width:6,height:6,borderRadius:2,background:p.fill}}/>
                          <span style={{fontSize:10,color:"rgba(255,255,255,0.7)"}}>{p.dataKey}</span>
                          <span style={{fontSize:10,fontWeight:700,color:"#fff",marginLeft:"auto"}}>R$ {fmtK(p.value)}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}/>
                {trendCats.map(cat=>(
                  <Bar key={cat} dataKey={cat} stackId="a" fill={trendColors[cat]} maxBarSize={28} radius={cat===trendCats[trendCats.length-1]?[3,3,0,0]:[0,0,0,0]}/>
                ))}
              </ReBarChart>
            </ResponsiveContainer>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
              {trendCats.map(cat=>(
                <div key={cat} style={{display:"flex",alignItems:"center",gap:4}}>
                  <div style={{width:8,height:8,borderRadius:2,background:trendColors[cat]}}/>
                  <span style={{...G,fontSize:10,color:T.inkMid}}>{cat}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fatura comparison */}
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px 20px"}}>
          <div style={{...G,fontSize:13,fontWeight:700,color:T.ink,marginBottom:14}}>Comparativo de faturas</div>
          <ResponsiveContainer width="100%" height={isMobile?140:170}>
            <ReBarChart data={cardFaturas} margin={{top:4,right:4,left:-22,bottom:0}} barCategoryGap="38%">
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
              <XAxis dataKey="mes" tick={{...G,fontSize:10,fill:T.inkLight}} axisLine={false} tickLine={false}/>
              <YAxis tick={{...G,fontSize:10,fill:T.inkLight}} axisLine={false} tickLine={false} tickFormatter={v=>"R$"+fmtK(v)}/>
              <Tooltip content={({active,payload,label})=>{
                if(!active||!payload?.length) return null;
                const d=payload[0].payload;
                return (
                  <div style={{...G,background:T.ink,borderRadius:10,padding:"8px 12px"}}>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginBottom:4}}>{label}</div>
                    <div style={{...NUM,fontSize:13,fontWeight:700,color:"#fff"}}>{fmtBRL(d.val)}</div>
                    <div style={{fontSize:10,color:d.pago?"#86efac":d.atual?"#FCD34D":"#9CA3AF",marginTop:3}}>
                      {d.pago?"✓ Paga":d.atual?"Em aberto":"—"}
                    </div>
                  </div>
                );
              }}/>
              <ReferenceLine y={mediaVal} stroke={T.blue} strokeDasharray="4 3"
                label={{value:`Média R$ ${fmtK(mediaVal)}`,position:"right",fontSize:8,fill:T.blue,fontFamily:"Geist,sans-serif"}}/>
              <Bar dataKey="val" maxBarSize={26} radius={[4,4,0,0]}>
                {cardFaturas.map((f,i)=>(
                  <Cell key={i} fill={f.atual?(card.corChip||T.blue):f.pago?T.green:T.inkGhost} fillOpacity={f.atual?0.9:0.65}/>
                ))}
              </Bar>
            </ReBarChart>
          </ResponsiveContainer>
          <div style={{display:"flex",gap:12,marginTop:8,flexWrap:"wrap"}}>
            {[["Paga",T.green],["Atual",card.corChip||T.blue],["Média",T.blue]].map(([l,c])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:8,height:8,borderRadius:2,background:c}}/>
                <span style={{...G,fontSize:10,color:T.inkMid}}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Parcelas exposure */}
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px 20px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div style={{...G,fontSize:13,fontWeight:700,color:T.ink}}>Exposição de parcelas</div>
            <div style={{...G,...NUM,fontSize:13,fontWeight:700,color:T.blue}}>{fmtBRL(totalParcelas)}</div>
          </div>
          <div style={{...G,fontSize:11,color:T.inkMid,marginBottom:hasParcelasEstornadas?4:12,lineHeight:1.65}}>
            Total comprometido em parcelas futuras · {Math.round(cardParcelas.reduce((s,p)=>s+p.vParcela,0)/card.limite*100)}% do limite mensal · {fmtBRL(cardParcelas.reduce((s,p)=>s+p.vParcela,0))}/mês.
          </div>
          {hasParcelasEstornadas && (
            <div style={{...G,fontSize:10,color:T.green,fontWeight:600,marginBottom:12}}>
              ↓ {fmtBRL(totalEstornos)} em estornos abatidos · líquido {fmtBRL(totalParcelas)}
            </div>
          )}
          {cardParcelas.map((p,i)=>{
            const exposurePct = safe(p.vParcela, card.limite); // % mensal sobre o limite
            const hasRefund = p.refundsSummary && p.refundsSummary.count > 0;
            return (
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <span style={{fontSize:15}}>{p.icon}</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,alignItems:"center",gap:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0,flex:1}}>
                      <span style={{...G,fontSize:12,color:T.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.desc}</span>
                      {hasRefund && (
                        <span title={`${p.refundsSummary.count} estorno${p.refundsSummary.count!==1?"s":""} · ${fmtBRL(p.refundsSummary.totalValue)} abatido${p.refundsSummary.count!==1?"s":""}`}
                          style={{...G,fontSize:9,color:T.green,background:T.greenLight,borderRadius:99,padding:"1px 6px",fontWeight:700,whiteSpace:"nowrap",cursor:"default"}}>
                          ↺ Estornado
                        </span>
                      )}
                    </div>
                    <span style={{...G,...NUM,fontSize:11,fontWeight:700,color:T.ink}}>{fmtBRL(p.vParcela*(p.total-p.pago))}</span>
                  </div>
                  <div style={{height:3,background:T.grayLight,borderRadius:99,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${exposurePct}%`,background:T.blue,borderRadius:99}}/>
                  </div>
                </div>
                <span style={{...G,fontSize:10,color:T.inkLight,minWidth:28,textAlign:"right"}}>{exposurePct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ── HistóricoTab ────────────────────────────────────────── */
  const HistóricoTab = () => {
    const mediaV = Math.round(cardFaturas.reduce((s,f)=>s+f.val,0)/cardFaturas.length);
    return (
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:10}}>
          {[
            {label:"Total de faturas", val:cardFaturas.length, sub:"histórico disponível"},
            {label:"Valor total",      val:fmtBRL(cardFaturas.reduce((s,f)=>s+f.val,0)), sub:"período completo"},
            {label:"Média mensal",     val:fmtBRL(mediaV), sub:`últimos ${cardFaturas.length} meses`},
          ].map((k,i)=>(
            <div key={i} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px"}}>
              <div style={{...G,fontSize:10,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:5}}>{k.label}</div>
              <div style={{...G,...NUM,fontSize:18,fontWeight:800,color:T.ink}}>{k.val}</div>
              <div style={{...G,fontSize:10,color:T.inkLight,marginTop:3}}>{k.sub}</div>
            </div>
          ))}
        </div>
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr auto":"2fr 1fr 1fr auto",
            padding:"10px 18px",borderBottom:`1px solid ${T.border}`,background:T.bg,gap:12}}>
            {(isMobile?["Mês","Valor"]:["Mês / Ano","Vencimento","Valor","Status"]).map(h=>(
              <div key={h} style={{...G,fontSize:10,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em"}}>{h}</div>
            ))}
          </div>
          {[...cardFaturas].reverse().map((f,i)=>{
            const over=!f.pago&&!f.atual;
            const sc=f.pago?T.green:f.atual?T.blue:T.red;
            const sl=f.pago?"Paga":f.atual?"Aberta":"Vencida";
            return (
              <div key={f.id} style={{display:"grid",gridTemplateColumns:isMobile?"1fr auto":"2fr 1fr 1fr auto",
                gap:12,padding:"13px 18px",alignItems:"center",
                borderBottom:i<cardFaturas.length-1?`1px solid ${T.border}`:"none",
                background:f.atual?`${T.blueLight}55`:"transparent"}}>
                <div>
                  <div style={{...G,fontSize:13,fontWeight:700,color:T.ink}}>{f.mes}</div>
                  {f.atual&&<div style={{...G,fontSize:10,color:T.blue}}>Fatura atual</div>}
                </div>
                {!isMobile&&<div style={{...G,fontSize:12,color:T.inkMid}}>{f.venc}</div>}
                <div style={{...G,...NUM,fontSize:13,fontWeight:700,color:over?T.red:T.ink}}>{fmtBRL(f.val)}</div>
                <span style={{...G,fontSize:10,fontWeight:700,color:sc,background:f.pago?"#DCFCE7":f.atual?"#EFF6FF":"#FEF2F2",
                  borderRadius:8,padding:"3px 10px",whiteSpace:"nowrap"}}>{sl}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ── ParcelasTab ─────────────────────────────────────────── */
  const ParcelasTab = () => {
    const [expandedParcela, setExpandedParcela] = useState(null);
    const [sortBy, setSortBy] = useState("valor"); // "valor" | "progresso" | "restante"
    const mensalTotal = cardParcelas.reduce((s,p) => s+p.vParcela, 0);
    const mensalPct   = safe(mensalTotal, card.limite);
    const limitColor  = mensalPct >= 40 ? T.amber : T.green;

    const sorted = [...cardParcelas].sort((a,b) => {
      if (sortBy === "valor")      return b.vParcela - a.vParcela;
      if (sortBy === "progresso")  return Math.round(a.pago/a.total*100) - Math.round(b.pago/b.total*100);
      if (sortBy === "restante")   return (b.total-b.pago)*b.vParcela - (a.total-a.pago)*a.vParcela;
      return 0;
    });

    return (
      <div style={{display:"flex",flexDirection:"column",gap:14}}>

        {/* ── KPI strip ── */}
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:12}}>
          {[
            { label:"Parcelas ativas",       val:cardParcelas.length, valSuffix: cardParcelas.length===1?" item":" itens", sub:"em andamento neste cartão",      color:T.blue,  icon:"🧩" },
            { label:"Total comprometido",     val:fmtBRL(totalParcelas),       valSuffix:"",                                                sub: hasParcelasEstornadas ? `líquido após ${fmtBRL(totalEstornos)} em estornos` : "soma de todas as parcelas futuras", color:T.ink,   icon:"💳" },
            { label:"Comprometimento mensal", val:`${mensalPct}%`,             valSuffix:"",                                                sub:`${fmtBRL(mensalTotal)}/mês do limite`, color:limitColor, icon:mensalPct>=40?"⚠️":"✅" },
          ].map((k,i) => (
            <div key={i} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px 18px",display:"flex",flexDirection:"column",gap:8}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{...G,fontSize:11,fontWeight:600,color:T.inkMid}}>{k.label}</span>
                <span style={{fontSize:16}}>{k.icon}</span>
              </div>
              <div style={{...G,...NUM,fontSize:isMobile?20:22,fontWeight:800,color:k.color,lineHeight:1.1,letterSpacing:"-0.01em"}}>
                {k.val}<span style={{fontSize:isMobile?14:16,fontWeight:600}}>{k.valSuffix}</span>
              </div>
              <div style={{...G,fontSize:11,color:T.inkLight,lineHeight:1.5}}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Consultant tip ── */}
        <div style={{background:T.blueLight,border:`1px solid ${T.blue}22`,borderRadius:12,padding:"12px 16px"}}>
          <div style={{...G,fontSize:12,fontWeight:700,color:T.blue,marginBottom:4}}>💡 Estratégia financeira</div>
          <div style={{...G,fontSize:12,color:T.inkMid,lineHeight:1.7}}>
            Ao quitar uma parcela antecipadamente, você libera espaço no limite e reduz o juros implícito.
            Priorize as de maior valor por parcela. Use "Mover" para distribuir o impacto em meses com mais folga.
          </div>
        </div>

        {/* ── Alert ── */}
        {mensalPct >= 30 && (
          <div style={{display:"flex",alignItems:"flex-start",gap:10,background:T.amberLight,border:`1px solid ${T.amber}33`,borderRadius:12,padding:"12px 16px"}}>
            <AlertTriangle size={15} color={T.amber} style={{flexShrink:0,marginTop:1}}/>
            <div>
              <div style={{...G,fontSize:13,fontWeight:700,color:T.amber,marginBottom:2}}>Comprometimento elevado</div>
              <div style={{...G,fontSize:12,color:T.inkMid,lineHeight:1.6}}>
                {fmtBRL(mensalTotal)}/mês em parcelas representa {mensalPct}% do limite.
                Consultores recomendam manter abaixo de 30% para preservar margem de segurança.
              </div>
            </div>
          </div>
        )}

        {/* ── Sort + count header ── */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <span style={{...G,fontSize:12,fontWeight:600,color:T.inkMid}}>
            {sorted.length} parcela{sorted.length!==1?"s":""}
          </span>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{...G,fontSize:11,color:T.inkLight}}>Ordenar:</span>
            {[["valor","Valor"],["progresso","Progresso"],["restante","Restante"]].map(([key,label]) => (
              <button key={key} onClick={()=>setSortBy(key)}
                style={{...G,fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:8,
                  border:`1.5px solid ${sortBy===key?T.ink:T.border}`,
                  background:sortBy===key?T.ink:T.surface,
                  color:sortBy===key?"#fff":T.inkMid,
                  cursor:"pointer",transition:"all 0.12s"}}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Parcela list — compact rows, expand on tap ── */}
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden"}}>
          {sorted.map((p, idx) => {
            const pct      = Math.round(p.pago / p.total * 100);
            const restN    = p.total - p.pago;
            const restVal  = restN * p.vParcela;
            const catColor = CAT_COLORS_CARD[p.cat] || T.inkMid;
            const isOpen   = expandedParcela === p.id;
            const isLast   = idx === sorted.length - 1;
            return (
              <div key={p.id}>
                {/* ── Compact row ── */}
                <div
                  onClick={() => setExpandedParcela(isOpen ? null : p.id)}
                  style={{
                    display:"flex", alignItems:"center", gap:12,
                    padding:"12px 16px",
                    borderBottom: isLast && !isOpen ? "none" : `1px solid ${T.border}`,
                    cursor:"pointer", userSelect:"none",
                    background: isOpen ? T.bg : "transparent",
                    transition:"background 0.12s",
                  }}
                  onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = T.bg; }}
                  onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = "transparent"; }}
                >
                  {/* Icon */}
                  <div style={{width:36,height:36,borderRadius:10,flexShrink:0,
                    background:`${catColor}14`,display:"flex",alignItems:"center",
                    justifyContent:"center",fontSize:17}}>
                    {p.icon}
                  </div>

                  {/* Name + progress bar */}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5,flexWrap:"wrap"}}>
                      <span style={{...G,fontSize:13,fontWeight:600,color:T.ink,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {p.desc}
                      </span>
                      <span style={{...G,fontSize:10,fontWeight:700,color:catColor,
                        background:`${catColor}14`,borderRadius:5,padding:"1px 6px",flexShrink:0}}>
                        {p.cat}
                      </span>
                      {p.refundsSummary && p.refundsSummary.count > 0 && (
                        <span title={`${p.refundsSummary.count} estorno${p.refundsSummary.count!==1?"s":""} · ${fmtBRL(p.refundsSummary.totalValue)} abatido${p.refundsSummary.count!==1?"s":""}`}
                          style={{...G,fontSize:10,fontWeight:700,color:T.green,background:T.greenLight,borderRadius:5,padding:"1px 6px",flexShrink:0,cursor:"default"}}>
                          ↺ Estornado
                        </span>
                      )}
                    </div>
                    {/* Mini progress bar with frações */}
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{flex:1,height:4,background:T.grayLight,borderRadius:99,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${pct}%`,background:catColor,borderRadius:99,
                          transition:"width 0.7s cubic-bezier(0.4,0,0.2,1)"}}/>
                      </div>
                      <span style={{...G,fontSize:10,color:T.inkMid,flexShrink:0,minWidth:40,textAlign:"right"}}>
                        {p.pago}/{p.total}
                      </span>
                    </div>
                  </div>

                  {/* Right: monthly value + chevron */}
                  <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                    <div style={{textAlign:"right"}}>
                      <div style={{...G,...NUM,fontSize:14,fontWeight:700,color:T.ink}}>
                        {fmtBRL(p.vParcela)}
                      </div>
                      <div style={{...G,fontSize:10,color:T.inkLight}}>
                        {restN}× restam
                      </div>
                    </div>
                    <ChevronDown size={14} color={T.inkLight}
                      style={{transform:isOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}/>
                  </div>
                </div>

                {/* ── Expanded detail ── */}
                {isOpen && (
                  <div style={{
                    padding:"14px 16px 16px",
                    borderBottom: isLast ? "none" : `1px solid ${T.border}`,
                    background:T.bg,
                    animation:"tabIn 0.15s ease-out",
                  }}>
                    {/* Stat row */}
                    <div style={{display:"flex",alignItems:"center",gap:0,
                      background:T.surface,borderRadius:10,overflow:"hidden",
                      border:`1px solid ${T.border}`,marginBottom:12}}>
                      {[
                        {label:"Por parcela",    val:fmtBRL(p.vParcela)},
                        {label:`${restN}× restam`, val:fmtBRL(restVal)},
                        {label:"Total original", val:fmtBRL(p.vTotal)},
                      ].map((s,i) => (
                        <div key={i} style={{flex:1,padding:"10px 12px",
                          borderLeft:i>0?`1px solid ${T.border}`:"none",
                          textAlign:i===2?"right":"left"}}>
                          <div style={{...G,fontSize:10,fontWeight:500,color:T.inkLight,marginBottom:3,
                            whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.label}</div>
                          <div style={{...G,...NUM,fontSize:13,fontWeight:700,color:T.ink}}>{s.val}</div>
                        </div>
                      ))}
                    </div>
                    {/* Progress detail */}
                    <div style={{marginBottom:12}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                        <span style={{...G,fontSize:12,color:T.inkMid}}>{p.pago} de {p.total} parcelas pagas</span>
                        <span style={{...G,...NUM,fontSize:12,fontWeight:700,color:catColor}}>{pct}%</span>
                      </div>
                      <div style={{height:6,background:T.grayLight,borderRadius:99,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${pct}%`,background:catColor,borderRadius:99,
                          transition:"width 0.7s cubic-bezier(0.4,0,0.2,1)"}}/>
                      </div>
                    </div>
                    {/* Action button */}
                    <button onClick={e=>{e.stopPropagation();setParcelaModal(p);}}
                      style={{...G,display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:700,
                        color:T.blue,background:T.blueLight,border:"none",
                        borderRadius:9,padding:"8px 14px",cursor:"pointer"}}>
                      <RefreshCw size={12}/> Mover para outra fatura
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    );
  };

  /* ── PlanejamentoTab ─────────────────────────────────────── */
  const PlanejamentoTab = () => {
    const planningMonths = card?.planejamento?.length ? card.planejamento : null;
    const meses = planningMonths ? planningMonths.map((item) => item.mes) : ["Abr'26","Mai'26","Jun'26","Jul'26","Ago'26","Set'26"];
    return (
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{background:T.blueLight,border:`1px solid ${T.blue}22`,borderRadius:12,padding:"12px 16px"}}>
          <div style={{...G,fontSize:12,fontWeight:700,color:T.blue,marginBottom:3}}>Compromissos futuros</div>
          <div style={{...G,fontSize:11,color:T.inkMid,lineHeight:1.65}}>
            Parcelas já aprovadas que vão aparecer nas próximas faturas. Use para planejar seu orçamento com antecedência.
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:12}}>
          {meses.map((mes,idx)=>{
            const monthData = planningMonths?.find((item) => item.mes === mes) || null;
            const ativos = monthData ? monthData.itens : cardParcelas.filter(p=>p.pago+idx+1<=p.total);
            const total = monthData ? monthData.total : ativos.reduce((s,p)=>s+p.vParcela,0);
            const totalCount = monthData?.count ?? ativos.length;
            const isNext=idx===0;
            return (
              <div key={mes} style={{background:isNext?`${T.blueLight}80`:T.surface,
                border:`1.5px solid ${isNext?T.blue:T.border}`,borderRadius:14,padding:"16px 18px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{...G,fontSize:13,fontWeight:800,color:T.ink}}>{mes}</div>
                  {isNext&&<span style={{...G,fontSize:10,fontWeight:700,color:"#fff",background:T.blue,borderRadius:6,padding:"2px 8px"}}>Próximo</span>}
                </div>
                <div style={{...G,fontSize:10,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:4}}>Total previsto</div>
                <div style={{...G,...NUM,fontSize:20,fontWeight:800,color:T.ink,marginBottom:10}}>
                  {total>0?fmtBRL(total):"R$\u00a00,00"}
                </div>
                {ativos.length>0?(
                  <div style={{display:"flex",flexDirection:"column",gap:5}}>
                    <div style={{...G,fontSize:10,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:3}}>
                      {totalCount} parcela{totalCount!==1?"s":""}
                    </div>
                    {ativos.slice(0,3).map(p=>(
                      <div key={p.id} style={{display:"flex",flexDirection:"column",gap:2,padding:"5px 0",borderTop:`1px solid ${T.border}`}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                          <span style={{...G,fontSize:11,color:T.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"70%"}}>{p.desc}</span>
                          <span style={{...G,...NUM,fontSize:11,fontWeight:700,color:T.ink,flexShrink:0}}>{fmtBRL(monthData ? p.val : p.vParcela)}</span>
                        </div>
                        {p.hasRefundsLinked&&(
                          <div title={`Esta compra tem ${p.refundsCount} estorno${p.refundsCount!==1?"s":""} vinculado${p.refundsCount!==1?"s":""} totalizando ${fmtBRL(p.refundsTotalValue||0)}. Considere isso ao planejar o orçamento.`}
                            style={{...G,fontSize:9.5,color:T.green,display:"flex",alignItems:"center",gap:4,fontWeight:700}}>
                            <RotateCcw size={9}/> Tem estorno{p.refundsTotalValue>0?` · ${fmtBRL(p.refundsTotalValue)} abatido${p.refundsCount!==1?"s":""}`:""}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ):(
                  <div style={{...G,fontSize:11,color:T.inkLight,display:"flex",alignItems:"center",gap:6}}>
                    <Check size={13} color={T.green}/> Sem parcelas previstas
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ── ParcelaModal ────────────────────────────────────────── */
  const ParcelaModal = () => {
    if (!parcelaModal) return null;
    const futuros=(card?.planejamento?.length ? card.planejamento.map((item) => item.mes).slice(0,4) : ["Abr'26","Mai'26","Jun'26","Jul'26"]);
    const inner = (
      <>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div>
            <div style={{...G,fontSize:14,fontWeight:800,color:T.ink}}>Realocar parcela</div>
            <div style={{...G,fontSize:11,color:T.inkMid,marginTop:2}}>{parcelaModal.desc} · {fmtBRL(parcelaModal.vParcela)}/mês</div>
          </div>
          <button onClick={()=>{setParcelaModal(null);setParcelaTarget(null);}} style={{background:T.grayLight,border:"none",cursor:"pointer",padding:7,borderRadius:8,display:"flex"}}><X size={14} color={T.inkMid}/></button>
        </div>
        <div style={{padding:"16px 20px",flex:1,overflowY:"auto"}}>
          <p style={{...G,fontSize:11,color:T.inkMid,lineHeight:1.7,marginBottom:12}}>
            Mova a <strong>próxima cobrança</strong> para uma fatura futura:
          </p>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {futuros.map(f=>(
              <button key={f} onClick={()=>setParcelaTarget(f)}
                style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",borderRadius:10,
                  border:`1.5px solid ${parcelaTarget===f?T.blue:T.border}`,background:parcelaTarget===f?T.blueLight:T.surface,cursor:"pointer",transition:"all 0.15s"}}>
                <span style={{...G,fontSize:13,fontWeight:600,color:parcelaTarget===f?T.blue:T.ink}}>{f}</span>
                {parcelaTarget===f&&<Check size={14} color={T.blue}/>}
              </button>
            ))}
          </div>
          {parcelaTarget&&(
            <div style={{background:T.blueLight,border:`1px solid ${T.blue}22`,borderRadius:10,padding:"10px 14px",marginTop:12}}>
              <span style={{...G,fontSize:11,color:T.blue,lineHeight:1.65}}>
                A parcela de <strong>{fmtBRL(parcelaModal.vParcela)}</strong> será movida para <strong>{parcelaTarget}</strong>.
              </span>
            </div>
          )}
        </div>
        <div style={{padding:"14px 20px",borderTop:`1px solid ${T.border}`,flexShrink:0}}>
          <button onClick={handleRealoc} disabled={!parcelaTarget}
            style={{...G,width:"100%",padding:"12px",borderRadius:10,border:"none",
              background:parcelaOk?T.green:!parcelaTarget?T.inkGhost:T.blue,
              color:"#fff",fontSize:13,fontWeight:700,cursor:parcelaTarget?"pointer":"not-allowed",
              display:"flex",alignItems:"center",justifyContent:"center",gap:7,transition:"background 0.2s"}}>
            {parcelaOk?<><Check size={14}/> Realocado!</>:"Confirmar"}
          </button>
        </div>
      </>
    );
    const wrap = (children) => isMobile?(
      <div style={{position:"fixed",inset:0,zIndex:400,overflow:"hidden",display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
        <div onClick={()=>{setParcelaModal(null);setParcelaTarget(null);}} style={{position:"absolute",inset:0,background:"rgba(15,23,35,0.5)"}}/>
        <div style={{position:"relative",background:T.surface,borderRadius:"24px 24px 0 0",maxHeight:"88vh",display:"flex",flexDirection:"column",animation:"sheetUp 0.5s cubic-bezier(0.32,0.72,0,1) both"}}>
          <div style={{display:"flex",justifyContent:"center",padding:"12px 0 4px"}}><div style={{width:36,height:4,borderRadius:99,background:T.inkGhost}}/></div>
          {children}
        </div>
      </div>
    ):(
      <div style={{position:"fixed",inset:0,zIndex:400,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div onClick={()=>{setParcelaModal(null);setParcelaTarget(null);}} style={{position:"absolute",inset:0,background:"rgba(15,23,35,0.38)"}}/>
        <div style={{position:"relative",width:400,maxHeight:"80vh",background:T.surface,borderRadius:18,boxShadow:T.dark,display:"flex",flexDirection:"column",overflow:"hidden"}}>{children}</div>
      </div>
    );
    return wrap(inner);
  };

  /* ── ExportModal ─────────────────────────────────────────── */
  const ExportModal = () => {
    if (!exportModal) return null;
    const allCats=[...new Set(displayItens.map(i=>i.cat))];
    const inner=(
      <>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div>
            <div style={{...G,fontSize:14,fontWeight:800,color:T.ink}}>Exportar fatura</div>
            <div style={{...G,fontSize:11,color:T.inkMid,marginTop:2}}>{card.nome} · {fatura?.mes}</div>
          </div>
          <button onClick={()=>setExportModal(false)} style={{background:T.grayLight,border:"none",cursor:"pointer",padding:7,borderRadius:8,display:"flex"}}><X size={14} color={T.inkMid}/></button>
        </div>
        <div style={{padding:"16px 20px",flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:16}}>
          {/* Types */}
          <div>
            <div style={{...G,fontSize:11,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:10}}>Tipos de transação</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[["expRec",expRec,setExpRec,"Recorrentes","Assinaturas e cobranças automáticas"],
                ["expParcelas",expParcelas,setExpParcelas,"Parcelados","Compras divididas"],
                ["expNormal",expNormal,setExpNormal,"Avulsos","Compras únicas"],
              ].map(([key,val,setter,label,sub])=>(
                <div key={key} onClick={()=>setter(v=>!v)}
                  style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",
                    borderRadius:10,border:`1.5px solid ${val?T.ink:T.border}`,background:val?T.bg:T.surface,cursor:"pointer",transition:"all 0.15s"}}>
                  <div>
                    <div style={{...G,fontSize:13,fontWeight:600,color:T.ink}}>{label}</div>
                    <div style={{...G,fontSize:10,color:T.inkLight}}>{sub}</div>
                  </div>
                  <div style={{width:20,height:20,borderRadius:6,border:`2px solid ${val?T.ink:T.border}`,background:val?T.ink:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {val&&<Check size={11} color="#fff"/>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Categories */}
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div style={{...G,fontSize:11,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em"}}>Categorias</div>
              <button onClick={()=>setExpCats({})} style={{...G,fontSize:10,color:T.blue,background:"none",border:"none",cursor:"pointer"}}>Todas</button>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
              {allCats.map(cat=>{
                const active=!!expCats[cat];
                const color=CAT_COLORS_CARD[cat]||T.inkMid;
                return (
                  <button key={cat} onClick={()=>setExpCats(m=>({...m,[cat]:!m[cat]}))}
                    style={{...G,fontSize:11,fontWeight:600,padding:"5px 12px",borderRadius:20,
                      border:`1.5px solid ${active?color:T.border}`,background:active?color+"18":T.surface,
                      color:active?color:T.inkMid,cursor:"pointer",transition:"all 0.15s"}}>{cat}</button>
                );
              })}
            </div>
          </div>
          {/* Format (only CSV for now) */}
          <div>
            <div style={{...G,fontSize:11,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:10}}>Formato de exportação</div>
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,border:`1.5px solid ${T.ink}`,background:T.bg}}>
              <div style={{width:22,height:22,borderRadius:6,background:T.ink,display:"flex",alignItems:"center",justifyContent:"center"}}><Check size={12} color="#fff"/></div>
              <div>
                <div style={{...G,fontSize:13,fontWeight:600,color:T.ink}}>CSV</div>
                <div style={{...G,fontSize:10,color:T.inkLight}}>Compatível com Excel, Sheets, etc.</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{padding:"14px 20px",borderTop:`1px solid ${T.border}`,flexShrink:0}}>
          <button onClick={handleExportCSV}
            style={{...G,width:"100%",padding:"13px",borderRadius:10,border:"none",background:T.ink,
              color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
            <Download size={14}/> Exportar CSV
          </button>
        </div>
      </>
    );
    const wrap=(ch)=>isMobile?(
      <div style={{position:"fixed",inset:0,zIndex:400,overflow:"hidden",display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
        <div onClick={()=>setExportModal(false)} style={{position:"absolute",inset:0,background:"rgba(15,23,35,0.5)"}}/>
        <div style={{position:"relative",background:T.surface,borderRadius:"24px 24px 0 0",maxHeight:"92vh",display:"flex",flexDirection:"column",animation:"sheetUp 0.5s cubic-bezier(0.32,0.72,0,1) both"}}>
          <div style={{display:"flex",justifyContent:"center",padding:"12px 0 4px"}}><div style={{width:36,height:4,borderRadius:99,background:T.inkGhost}}/></div>
          {ch}
        </div>
      </div>
    ):(
      <div style={{position:"fixed",inset:0,zIndex:400,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div onClick={()=>setExportModal(false)} style={{position:"absolute",inset:0,background:"rgba(15,23,35,0.38)"}}/>
        <div style={{position:"relative",width:440,maxHeight:"85vh",background:T.surface,borderRadius:18,boxShadow:T.dark,display:"flex",flexDirection:"column",overflow:"hidden"}}>{ch}</div>
      </div>
    );
    return wrap(inner);
  };



  const TABS=[
    {id:"fatura",      icon:"📋", label:"Fatura"},
    {id:"recorrencias",icon:"🔄", label:"Recorrências"},
    {id:"parcelas",    icon:"🧩", label:"Parcelas"},
    {id:"analises",    icon:"📊", label:"Análises"},
    {id:"historico",   icon:"📈", label:"Histórico"},
    {id:"planejamento",icon:"📅", label:"Planejamento"},
  ];

  /* ══════════════════════════════════════════════════════════
     MOBILE
  ══════════════════════════════════════════════════════════ */
  if (isMobile) return (
    <>
    <div style={{display:"flex",flexDirection:"column",gap:0,paddingBottom:40}}>
      <style>{`
        @keyframes tabIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
      <ParcelaModal/><ExportModal/><CardFormSheet/>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,gap:8}}>
        <PageTitle sans="Meus" serif="Cartões"/>
        <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end"}}>
          <button onClick={()=>onNovaItem&&onNovaItem(cardId)}
            title="Novo item"
            style={{...G,display:"flex",alignItems:"center",gap:5,background:T.green,border:"none",
              borderRadius:9,padding:"8px 12px",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",flexShrink:0}}>
            <Plus size={13}/> <span>Item</span>
          </button>
          {canEditSelectedCard && (
            <button type="button" onClick={openEditCardSheet} title="Editar cartão selecionado"
              style={{...G,display:"flex",alignItems:"center",gap:5,background:T.surface,border:`1px solid ${T.border}`,
                borderRadius:9,padding:"8px 12px",fontSize:12,fontWeight:700,color:T.ink,cursor:"pointer",flexShrink:0}}>
              <Pencil size={13}/> <span>Editar</span>
            </button>
          )}
          <button onClick={openAddCardSheet} type="button"
            title="Novo cartão"
            style={{...G,display:"flex",alignItems:"center",gap:5,background:T.ink,border:"none",
              borderRadius:9,padding:"8px 12px",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",flexShrink:0}}>
            <CreditCard size={13}/> <span style={{whiteSpace:"nowrap"}}>+ Cartão</span>
          </button>
        </div>
      </div>

      {/* Card carousel */}
      <div style={{marginBottom:2}}>
        <DragScrollTabs bg={T.bg}>
          {CARDS.map(c=>(
            <div key={c.id} style={{paddingTop:8,paddingBottom:0}}>
              <CardVisual c={c} selected={c.id===cardId} size="sm"/>
            </div>
          ))}
          <div onClick={openAddCardSheet}
            style={{width:130,height:Math.round(130/1.586),marginTop:8,borderRadius:12,flexShrink:0,
              border:`2px dashed ${T.border}`,display:"flex",flexDirection:"column",
              alignItems:"center",justifyContent:"center",gap:5,cursor:"pointer",background:T.surface}}>
            <Plus size={18} color={T.inkLight}/>
            <span style={{...G,fontSize:10,color:T.inkMid}}>Novo cartão</span>
          </div>
        </DragScrollTabs>
      </div>

      {/* Fatura summary */}
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:"16px 18px",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <FaturaNav compact/>
          <div style={{textAlign:"right"}}>
            {fatura?.atual&&<div style={{...G,fontSize:10,fontWeight:700,color:T.blue,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:3}}>Fatura aberta</div>}
            <div style={{...G,...NUM,fontSize:22,fontWeight:800,color:T.ink,lineHeight:1}}>{fmtBRL((fatura?.val||0))}</div>
            {diffPct!==0&&<div style={{...G,fontSize:11,fontWeight:600,marginTop:3,color:diffPct>0?T.red:T.green}}>{diffPct>0?"↑":"↓"} {Math.abs(diffPct)}% vs {fatPrev?.mes}</div>}
          </div>
        </div>
        <LimitBar/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:12}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <Calendar size={12} color={T.inkLight}/>
            <span style={{...G,fontSize:11,color:T.inkMid}}>Vence {fatura?.venc}</span>
          </div>
          <div style={{display:"flex",gap:8}}>
            {isAtual&&(
              <button onClick={()=>setExportModal(true)} style={{...G,display:"flex",alignItems:"center",gap:5,fontSize:11,fontWeight:600,color:T.inkMid,background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:"5px 10px",cursor:"pointer"}}>
                <Download size={11}/> CSV
              </button>
            )}
            {isAtual&&!isPago&&(
              <button onClick={handleMarkPago} style={{...G,display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:8,border:`1.5px solid ${T.green}`,background:T.greenLight,color:T.green,fontSize:11,fontWeight:700,cursor:"pointer"}}>
                {markingPago?<><RefreshCw size={11}/> …</>:<><Check size={11}/> Pagar</>}
              </button>
            )}
            {isPago&&<div style={{...G,display:"flex",alignItems:"center",gap:5,fontSize:11,fontWeight:700,color:T.green}}><Check size={12}/> Paga</div>}
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{marginBottom:14}}><KpiStrip/></div>

      {/* Tabs — drag-scrollable */}
      <div style={{marginBottom:14}}>
        <DragScrollTabs bg={T.bg}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{...G,display:"flex",alignItems:"center",gap:6,padding:"8px 15px",borderRadius:22,
                border:`1.5px solid ${tab===t.id?T.ink:T.border}`,
                background:tab===t.id?T.ink:T.surface,
                color:tab===t.id?"#fff":T.inkMid,
                fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0,
                transition:"all 0.15s",whiteSpace:"nowrap"}}>
              <span style={{fontSize:13}}>{t.icon}</span>{t.label}
            </button>
          ))}
        </DragScrollTabs>
      </div>

      {/* Tab content */}
      <div key={tab+cardId} style={{animation:"tabIn 0.2s ease-out"}}>
        {tab==="fatura"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr",gap:20,alignItems:"start"}}>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,display:"flex",alignItems:"center",gap:8,background:T.surface,border:`1px solid ${T.border}`,borderRadius:9,padding:"8px 12px"}}>
                  <Search size={13} color={T.inkLight}/>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar lançamentos..." style={{...G,flex:1,border:"none",outline:"none",background:"transparent",fontSize:13,color:T.ink}}/>
                  {search&&<button onClick={()=>setSearch("")} style={{background:"none",border:"none",cursor:"pointer",padding:2}}><X size={13} color={T.inkLight}/></button>}
                </div>
                <div style={{display:"flex",gap:5}}>
                  {faturaFilterChips.map(([c,color])=>(
                    <button key={c} onClick={()=>setFilterCat(filterCat===c?null:c)} title={c} style={{width:20,height:20,borderRadius:6,background:color,border:`2.5px solid ${filterCat===c?T.ink:"transparent"}`,cursor:"pointer",opacity:filterCat&&filterCat!==c?0.25:1,transition:"all 0.15s"}}/>
                  ))}
                  {filterCat&&<button onClick={()=>setFilterCat(null)} style={{...G,fontSize:10,color:T.inkMid,background:T.grayLight,border:"none",borderRadius:6,padding:"2px 8px",cursor:"pointer"}}>✕</button>}
                </div>
              </div>
              <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}>
                  <span style={{...G,fontSize:12,fontWeight:700,color:T.ink}}>{displayItens.length>0?`${filtered.length} de ${displayItens.length} lançamentos`:`Fatura ${fatura?.mes} · ${fatura?.pago?"Paga":"Pendente"}`}</span>
                  {filtered.length>0&&<button onClick={()=>setExpandedDate(expandedDate===null?grouped[0]?.[0]:null)} style={{...G,fontSize:11,color:T.blue,background:"none",border:"none",cursor:"pointer"}}>{expandedDate===null?"Recolher tudo":"Expandir tudo"}</button>}
                </div>
                {pastItensLoading && !isAtual
                  ?<div style={{textAlign:"center",padding:"36px 20px"}}><div style={{...G,fontSize:13,color:T.inkLight}}>Carregando lançamentos…</div></div>
                  :grouped.length>0?pagedGroups.map(([date,items])=><DateGroup key={date} date={date} items={items}/>)
                  :displayItens.length>0&&filtered.length===0?<div style={{textAlign:"center",padding:"36px 20px"}}><div style={{fontSize:26,marginBottom:8}}>🔍</div><div style={{...G,fontSize:13,color:T.inkMid}}>Nenhum resultado</div></div>
                  :shouldUseRealData?<div style={{textAlign:"center",padding:"36px 20px"}}><div style={{fontSize:26,marginBottom:8}}>📭</div><div style={{...G,fontSize:13,color:T.inkMid}}>Nenhum lançamento encontrado</div><div style={{...G,fontSize:11,color:T.inkLight,marginTop:4}}>Fatura {fatura?.mes} · {fmtBRL((fatura?.val||0))}</div></div>
                  :<div style={{textAlign:"center",padding:"36px 20px"}}><div style={{fontSize:26,marginBottom:8}}>🔍</div><div style={{...G,fontSize:13,color:T.inkMid}}>Nenhum resultado</div></div>}
                {filtered.length>0&&hasMoreGroups&&(
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 20px",borderTop:`1px solid ${T.border}`}}>
                    <span style={{...G,fontSize:12,color:T.inkMid}}>
                      {visibleItems} de {totalItems} lançamentos
                    </span>
                    <span style={{...M_MONO,...NUM,fontSize:16,fontWeight:800,color:T.ink}}>{fmtBRL(filtered.reduce((s,i)=>s+i.val,0))}</span>
                  </div>
                )}
                {filtered.length>0&&(
                  hasMoreGroups?(
                    <button type="button" onClick={()=>setVisibleGroups((v)=>v+PAGE_GROUPS)}
                      style={{...G,width:"100%",padding:"13px 20px",background:T.bg,
                        border:"none",borderTop:`1px solid ${T.border}`,
                        fontSize:12,fontWeight:700,color:T.inkMid,cursor:"pointer",
                        display:"flex",alignItems:"center",justifyContent:"center",gap:7,transition:"background 0.15s"}}
                      onMouseEnter={(e)=>{ e.currentTarget.style.background=T.grayLight; }}
                      onMouseLeave={(e)=>{ e.currentTarget.style.background=T.bg; }}>
                      <ChevronDown size={14} color={T.inkMid}/> Mostrar mais {Math.min(PAGE_GROUPS, grouped.length-visibleGroups)} grupos · {grouped.slice(visibleGroups,visibleGroups+PAGE_GROUPS).reduce((s,[,items])=>s+items.length,0)} lançamentos
                    </button>
                  ):(
                    <div style={{...G,display:"flex",alignItems:"center",justifyContent:"center",padding:"13px 20px",
                      borderTop:`1px solid ${T.border}`,background:T.bg,
                      fontSize:12,fontWeight:700,color:T.inkMid,gap:7}}>
                      {grouped.length} {grouped.length===1?"grupo":"grupos"} · {totalItems} {totalItems===1?"lançamento":"lançamentos"}
                    </div>
                  )
                )}
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px 20px"}}><LimitBar/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:14}}>{[{label:"Disponível",val:fmtBRL(card.disponivel),c:usoColor},{label:"Utilizado",val:fmtBRL(card.limite-card.disponivel),c:T.ink},{label:"Limite",val:fmtBRL(card.limite),c:T.inkMid},{label:"Parcelas",val:fmtBRL(totalParcelas),c:T.blue}].map((k,i)=><div key={i} style={{background:T.bg,borderRadius:9,padding:"9px 10px"}}><div style={{...G,fontSize:8,fontWeight:700,color:T.inkLight,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:3}}>{k.label}</div><div style={{...G,...NUM,fontSize:13,fontWeight:700,color:k.c}}>{k.val}</div></div>)}</div></div>
              {isAtual&&catTotals.length>0&&<div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px 20px"}}><div style={{...G,fontSize:12,fontWeight:700,color:T.ink,marginBottom:4}}>Análise de gastos</div><div style={{...G,fontSize:10,color:T.inkLight,marginBottom:14}}>Clique para filtrar</div><CatBars/>{recTotal>0&&<div style={{display:"flex",alignItems:"center",gap:7,background:T.purpleLight,border:`1px solid ${T.purple}22`,borderRadius:9,padding:"8px 12px",marginTop:14}}><Repeat size={12} color={T.purple}/><span style={{...G,fontSize:11,color:T.inkMid}}>Assinaturas: <strong style={{color:T.purple}}>{fmtBRL(recTotal)}</strong></span></div>}</div>}
              {fatPrev&&<div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px"}}><div style={{...G,fontSize:10,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:8}}>Média mensal</div><div style={{...G,...NUM,fontSize:18,fontWeight:800,color:T.ink}}>{fmtBRL(mediaVal)}</div><div style={{...G,fontSize:11,fontWeight:600,marginTop:4,color:diffPct>0?T.red:T.green}}>{diffPct>0?"↑":"↓"} {Math.abs(diffPct)}% vs {fatPrev.mes}</div></div>}
            </div>
          </div>
        )}
        {tab==="recorrencias"&&<RecorrenciasTab/>}
        {tab==="parcelas"    &&<ParcelasTab/>}
        {tab==="analises"    &&<AnálisesTab/>}
        {tab==="historico"   &&<HistóricoTab/>}
        {tab==="planejamento"&&<PlanejamentoTab/>}
      </div>
    </div>
    </>
  );

  // ── Desktop return ───────────────────────────────────────────────────────
  return (
    <>
      <style>{`@keyframes drawerIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
      <ParcelaModal/><ExportModal/><CardFormSheet/>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <PageTitle sans="Meus" serif="Cartões"/>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"flex-end" }}>
          <button type="button" onClick={()=>onNovaItem&&onNovaItem(cardId)}
            style={{...G,display:"flex",alignItems:"center",gap:6,background:T.green,border:"none",borderRadius:10,padding:"9px 16px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer"}}>
            <Plus size={14}/> Novo item
          </button>
          {canEditSelectedCard && (
            <button type="button" onClick={openEditCardSheet} title="Editar cartão selecionado"
              style={{...G,display:"flex",alignItems:"center",gap:6,background:T.surface,border:`1px solid ${T.border}`,
                borderRadius:10,padding:"9px 16px",fontSize:13,fontWeight:700,color:T.ink,cursor:"pointer"}}>
              <Pencil size={14}/> Editar
            </button>
          )}
          <button type="button" onClick={openAddCardSheet}
            style={{...G,display:"flex",alignItems:"center",gap:6,background:T.ink,border:"none",borderRadius:10,padding:"9px 16px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer"}}>
            <CreditCard size={14}/> + Cartão
          </button>
        </div>
      </div>

      {/* Card carousel */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:"flex", gap:14, overflowX:"auto", paddingBottom:8, paddingTop:6, scrollbarWidth:"none" }}>
          {CARDS.map(c=><CardVisual key={c.id} c={c} selected={c.id===cardId} size="md"/>)}
          <div onClick={openAddCardSheet} style={{ width:200, height:Math.round(200/1.586), borderRadius:16, flexShrink:0, border:`2px dashed ${T.border}`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6, cursor:"pointer", background:T.surface }}>
            <Plus size={22} color={T.inkLight}/>
            <span style={{...G,fontSize:11,color:T.inkMid}}>Novo cartão</span>
          </div>
        </div>
      </div>

      {/* Fatura header */}
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"16px 20px", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <FaturaNav/>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {fatura?.atual && <div style={{...G,fontSize:11,fontWeight:700,color:T.blue,textTransform:"uppercase",letterSpacing:"0.08em"}}>Fatura aberta</div>}
            <div style={{...G,...NUM,fontSize:24,fontWeight:800,color:T.ink,lineHeight:1}}>{fmtBRL((fatura?.val||0))}</div>
            {diffPct!==0 && <div style={{...G,fontSize:12,fontWeight:600,color:diffPct>0?T.red:T.green}}>{diffPct>0?"↑":"↓"} {Math.abs(diffPct)}% vs {fatPrev?.mes}</div>}
          </div>
        </div>
        <LimitBar/>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <Calendar size={13} color={T.inkLight}/>
            <span style={{...G,fontSize:12,color:T.inkMid}}>Vence {fatura?.venc}</span>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {isAtual && <button onClick={()=>setExportModal(true)} style={{...G,display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:600,color:T.inkMid,background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:"6px 12px",cursor:"pointer"}}><Download size={12}/> CSV</button>}
            {isAtual&&!isPago && <button onClick={handleMarkPago} style={{...G,display:"flex",alignItems:"center",gap:5,padding:"6px 14px",borderRadius:8,border:`1.5px solid ${T.green}`,background:T.greenLight,color:T.green,fontSize:12,fontWeight:700,cursor:"pointer"}}>{markingPago?<><RefreshCw size={12}/> …</>:<><Check size={12}/> Marcar como paga</>}</button>}
            {isPago && <div style={{...G,display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:700,color:T.green}}><Check size={13}/> Paga</div>}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ marginBottom:14 }}><KpiStrip/></div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:2, background:T.grayLight, borderRadius:12, padding:4, width:"fit-content", marginBottom:14 }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{...G,display:"flex",alignItems:"center",gap:7,padding:"9px 18px",borderRadius:9,border:"none",background:tab===t.id?T.surface:"transparent",color:tab===t.id?T.ink:T.inkMid,fontSize:12,fontWeight:700,cursor:"pointer",boxShadow:tab===t.id?T.sm:"none",transition:"all 0.15s"}}>
            <span style={{fontSize:14}}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div key={tab+cardId} style={{animation:"tabIn 0.2s ease-out"}}>
        {tab==="fatura"&&(
          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 300px",gap:20,alignItems:"start"}}>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,display:"flex",alignItems:"center",gap:8,background:T.surface,border:`1px solid ${T.border}`,borderRadius:9,padding:"8px 12px"}}>
                  <Search size={13} color={T.inkLight}/>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar lançamentos..." style={{...G,flex:1,border:"none",outline:"none",background:"transparent",fontSize:13,color:T.ink}}/>
                  {search&&<button onClick={()=>setSearch("")} style={{background:"none",border:"none",cursor:"pointer",padding:2}}><X size={13} color={T.inkLight}/></button>}
                </div>
                <div style={{display:"flex",gap:5}}>
                  {faturaFilterChips.map(([c,color])=>(
                    <button key={c} onClick={()=>setFilterCat(filterCat===c?null:c)} title={c} style={{width:20,height:20,borderRadius:6,background:color,border:`2.5px solid ${filterCat===c?T.ink:"transparent"}`,cursor:"pointer",opacity:filterCat&&filterCat!==c?0.25:1,transition:"all 0.15s"}}/>
                  ))}
                  {filterCat&&<button onClick={()=>setFilterCat(null)} style={{...G,fontSize:10,color:T.inkMid,background:T.grayLight,border:"none",borderRadius:6,padding:"2px 8px",cursor:"pointer"}}>✕</button>}
                </div>
              </div>
              <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderBottom:`1px solid ${T.border}`}}>
                  <span style={{...G,fontSize:12,fontWeight:700,color:T.ink}}>{displayItens.length>0?`${filtered.length} de ${displayItens.length} lançamentos`:`Fatura ${fatura?.mes} · ${fatura?.pago?"Paga":"Pendente"}`}</span>
                  {filtered.length>0&&<button onClick={()=>setExpandedDate(expandedDate===null?grouped[0]?.[0]:null)} style={{...G,fontSize:11,color:T.blue,background:"none",border:"none",cursor:"pointer"}}>{expandedDate===null?"Recolher tudo":"Expandir tudo"}</button>}
                </div>
                {pastItensLoading && !isAtual
                  ?<div style={{textAlign:"center",padding:"36px 20px"}}><div style={{...G,fontSize:13,color:T.inkLight}}>Carregando lançamentos…</div></div>
                  :grouped.length>0?pagedGroups.map(([date,items])=><DateGroup key={date} date={date} items={items}/>)
                  :displayItens.length>0&&filtered.length===0?<div style={{textAlign:"center",padding:"36px 20px"}}><div style={{fontSize:26,marginBottom:8}}>🔍</div><div style={{...G,fontSize:13,color:T.inkMid}}>Nenhum resultado</div></div>
                  :shouldUseRealData?<div style={{textAlign:"center",padding:"36px 20px"}}><div style={{fontSize:26,marginBottom:8}}>📭</div><div style={{...G,fontSize:13,color:T.inkMid}}>Nenhum lançamento encontrado</div><div style={{...G,fontSize:11,color:T.inkLight,marginTop:4}}>Fatura {fatura?.mes} · {fmtBRL((fatura?.val||0))}</div></div>
                  :<div style={{textAlign:"center",padding:"36px 20px"}}><div style={{fontSize:26,marginBottom:8}}>🔍</div><div style={{...G,fontSize:13,color:T.inkMid}}>Nenhum resultado</div></div>}
                {filtered.length>0&&hasMoreGroups&&(
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 20px",borderTop:`1px solid ${T.border}`}}>
                    <span style={{...G,fontSize:12,color:T.inkMid}}>
                      {visibleItems} de {totalItems} lançamentos
                    </span>
                    <span style={{...M_MONO,...NUM,fontSize:16,fontWeight:800,color:T.ink}}>{fmtBRL(filtered.reduce((s,i)=>s+i.val,0))}</span>
                  </div>
                )}
                {filtered.length>0&&(
                  hasMoreGroups?(
                    <button type="button" onClick={()=>setVisibleGroups((v)=>v+PAGE_GROUPS)}
                      style={{...G,width:"100%",padding:"13px 20px",background:T.bg,
                        border:"none",borderTop:`1px solid ${T.border}`,
                        fontSize:12,fontWeight:700,color:T.inkMid,cursor:"pointer",
                        display:"flex",alignItems:"center",justifyContent:"center",gap:7,transition:"background 0.15s"}}
                      onMouseEnter={(e)=>{ e.currentTarget.style.background=T.grayLight; }}
                      onMouseLeave={(e)=>{ e.currentTarget.style.background=T.bg; }}>
                      <ChevronDown size={14} color={T.inkMid}/> Mostrar mais {Math.min(PAGE_GROUPS, grouped.length-visibleGroups)} grupos · {grouped.slice(visibleGroups,visibleGroups+PAGE_GROUPS).reduce((s,[,items])=>s+items.length,0)} lançamentos
                    </button>
                  ):(
                    <div style={{...G,display:"flex",alignItems:"center",justifyContent:"center",padding:"13px 20px",
                      borderTop:`1px solid ${T.border}`,background:T.bg,
                      fontSize:12,fontWeight:700,color:T.inkMid,gap:7}}>
                      {grouped.length} {grouped.length===1?"grupo":"grupos"} · {totalItems} {totalItems===1?"lançamento":"lançamentos"}
                    </div>
                  )
                )}
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px 20px"}}><LimitBar/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:14}}>{[{label:"Disponível",val:fmtBRL(card.disponivel),c:usoColor},{label:"Utilizado",val:fmtBRL(card.limite-card.disponivel),c:T.ink},{label:"Limite",val:fmtBRL(card.limite),c:T.inkMid},{label:"Parcelas",val:fmtBRL(totalParcelas),c:T.blue}].map((k,i)=><div key={i} style={{background:T.bg,borderRadius:9,padding:"9px 10px"}}><div style={{...G,fontSize:10,fontWeight:700,color:T.inkLight,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:3}}>{k.label}</div><div style={{...G,...NUM,fontSize:13,fontWeight:700,color:k.c}}>{k.val}</div></div>)}</div></div>
              {fatPrev&&<div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px"}}><div style={{...G,fontSize:10,fontWeight:700,color:T.inkLight,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:8}}>Média mensal</div><div style={{...G,...NUM,fontSize:18,fontWeight:800,color:T.ink}}>{fmtBRL(mediaVal)}</div><div style={{...G,fontSize:11,fontWeight:600,marginTop:4,color:diffPct>0?T.red:T.green}}>{diffPct>0?"↑":"↓"} {Math.abs(diffPct)}% vs {fatPrev.mes}</div></div>}
            </div>
          </div>
        )}
        {tab==="recorrencias"&&<RecorrenciasTab/>}
        {tab==="parcelas"    &&<ParcelasTab/>}
        {tab==="analises"    &&<AnálisesTab/>}
        {tab==="historico"   &&<HistóricoTab/>}
        {tab==="planejamento"&&<PlanejamentoTab/>}
      </div>
    </>
  );

};

/* ─── APP ────────────────────────────────────────────────── */
export default function App() {
  const session = useSession();
  const mockDataEnabled = import.meta.env.VITE_ENABLE_UI_MOCKS === "true";
  const navigate = useNavigate();
  const { pathname, searchStr } = useRouterState({
    select: (s) => ({
      pathname: s.location.pathname,
      searchStr: s.location.searchStr ?? "",
    }),
  });
  useFinclaDocumentTitle(pathname);
  useLayoutEffect(() => {
    document.querySelector("[data-fincla-main-scroll]")?.scrollTo?.(0, 0);
  }, [pathname]);
  const activeSegment = useMemo(() => {
    const seg = firstPathSegment(pathname);
    return isAuthRouteSegment(seg) ? seg : "";
  }, [pathname]);

  useEffect(() => {
    if (session.isBootstrapping) return;
    if (session.isAuthenticated) return;
    if (!firstPathSegment(pathname)) return;
    if (isReturnableFinclaPathname(pathname)) {
      capturePostLoginRedirectFromPathnameAndSearchStr(pathname, searchStr);
    }
    navigate({ to: "/", replace: true });
  }, [
    session.isBootstrapping,
    session.isAuthenticated,
    pathname,
    searchStr,
    navigate,
  ]);
  // shared simulation state — empty by default (API-driven); mock only when VITE_ENABLE_UI_MOCKS
  const [cenarios,   setCenarios]  = useState(mockDataEnabled ? SIM_CENARIOS_INIT : []);
  const [cenarioId,  setCenarioId] = useState(mockDataEnabled ? SIM_CENARIOS_INIT[0].id : null);
  const [modalPreConfig, setModalPreConfig] = useState(null); // pre-fill (não serializado na URL)
  const [panelOpen,          setPanelOpen]          = useState(false);
  /** Legado: botão fixo (Sliders, canto superior direito) que alterna `StatePanelV4`. `true` para reexibir na UI. */
  const showLegacyStatePanelFloatButton = false;
  const [requestedDataMode,  setRequestedDataMode]  = useState("live"); // "live" | "mock" | "empty"
  const [showOnboarding,     setShowOnboarding]     = useState(false);
  const [onboardingData,     setOnboardingData]      = useState(null);
  const [onboardingSubmitting, setOnboardingSubmitting] = useState(false);
  const [onboardingError, setOnboardingError] = useState("");
  const [extraRecs,         setExtraRecs]          = useState([]); // recorrências semeadas pelo onboarding
  const [extraCards,        setExtraCards]         = useState([]); // cartões semeados pelo onboarding
  // Synthetic transactions derived from seeded recorrências (shown in Transações when empty)
  const extraTx = extraRecs.map((r, i) => ({
    id: `onb-tx-${i+1}`,
    desc: r.desc,
    cat: r.cat,
    val: r.tipo === "receita" ? +r.val : -r.val,
    date: `${String(r.dia).padStart(2,"0")}/04`,
    icon: r.icone || "💼",
    method: r.metodo || "Pix",
    rec: true,
    status: "agendado",
    valorTipo: r.valorTipo,
  }));
  const [checklistDismissed, setChecklistDismissed]  = useState(false);
  const [checklistProbeVersion, setChecklistProbeVersion] = useState(0);
  const [mounted, setMounted]     = useState(false);
  const [day, setDay]             = useState(11);
  const [budgetPct, setBudgetPct] = useState(38);
  const [freePct, setFreePct]     = useState(45);
  const [isMobile, setIsMobile]   = useState(() => window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [transactionsListVersion, setTransactionsListVersion] = useState(0);
  const bumpTransactionsList = useCallback(() => {
    setTransactionsListVersion((n) => n + 1);
  }, []);

  useEffect(() => {
    setChecklistProbeVersion((v) => v + 1);
  }, [transactionsListVersion]);

  // Revalida o checklist «primeiros passos» quando o utilizador volta ao separador.
  // Não usar `window` `focus`: ao clicar na app após o DevTools (ou outro painel do browser)
  // o evento dispara e refaz GETs de transactions/budgets/goals sem necessidade.
  useEffect(() => {
    let wasHidden = document.visibilityState === "hidden";
    const onVisibility = () => {
      const hidden = document.visibilityState === "hidden";
      if (wasHidden && !hidden) {
        setChecklistProbeVersion((v) => v + 1);
      }
      wasHidden = hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => { clearTimeout(t); window.removeEventListener("resize", onResize); };
  }, []);

  const moodKey  = useMemo(() => calcMood(day, budgetPct, freePct), [day, budgetPct, freePct]);
  const mood     = MOODS[moodKey];
  const stateCtrl= { day, budgetPct, freePct, mounted, isMobile };
  const activeOrganization = useMemo(
    () =>
      session.organizations.find(
        (item) => item.organization.id === session.activeOrgId,
      )?.organization ?? null,
    [session.activeOrgId, session.organizations],
  );
  const dataMode = resolveDataMode(requestedDataMode, mockDataEnabled);

  const firstStepsLive = useFirstStepsLiveStatus({
    organizationId: session.activeOrgId,
    enabled: session.isAuthenticated && dataMode === "live",
    refreshToken: checklistProbeVersion,
  });
  const completedTx = firstStepsLive.completedTx;
  const completedBudget = firstStepsLive.completedBudget;

  useEffect(() => {
    if (!session.isAuthenticated) {
      setShowOnboarding(false);
    }
  }, [session.isAuthenticated]);

  useEffect(() => {
    if (session.isBootstrapping) return;
    if (!session.isAuthenticated) return;
    if (showOnboarding || session.onboardingRequired) return;
    if (pathname !== "/" && pathname !== "") return;
    const next = consumePostLoginNavigateArgs();
    if (next) {
      navigate(next);
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }, [
    session.isBootstrapping,
    session.isAuthenticated,
    session.onboardingRequired,
    showOnboarding,
    pathname,
    navigate,
  ]);

  useEffect(() => {
    if (!activeOrganization) return;

    setOnboardingData((current) => ({
      ...(current ?? {}),
      orgNome: current?.orgNome ?? activeOrganization.name,
      orgTipo: current?.orgTipo ?? activeOrganization.org_type ?? "personal",
      membros: current?.membros ?? [],
    }));
  }, [activeOrganization]);

  const search = useSearch({ strict: false });
  const urlHydratedRef = useRef(false);
  const editTxHydrateKeyRef = useRef(null);

  const transactionRouteEditId = transactionEditIdFromPathname(pathname);

  const txModalOpen =
    session.isAuthenticated &&
    !session.isBootstrapping &&
    !showOnboarding &&
    !session.onboardingRequired &&
    (search[FC.MODAL] === FC_MODAL.NEW_TRANSACTION ||
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

  const navTo = useCallback(
    (target, opts = {}) => {
      if (target === "__logout__") {
        session.signOut();
        setShowOnboarding(false);
        setOnboardingData(null);
        setExtraRecs([]);
        setExtraCards([]);
        setRequestedDataMode("live");
        navigate({ to: "/", replace: true });
        return;
      }
      if (opts.cenarioId) setCenarioId(opts.cenarioId);
      if (typeof target === "string" && isAuthRouteSegment(target)) {
        const to = target === "profile" ? "/profile/account" : `/${target}`;
        navigate({
          to,
          search: (prev) => mergeNavSearch(prev, target, opts),
        });
      }
    },
    [navigate, session, setCenarioId],
  );
  const pages = {
    dashboard:    <DashboardPageView onNav={navTo} stateCtrl={stateCtrl} dataMode={dataMode} onboardingData={onboardingData} extraRecs={extraRecs} onNewTx={()=>openTxModal()} organizationId={session.activeOrgId} />,
    rhythm:        dataMode==="empty" ? (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <PageTitle sans="Ritmo de" serif="Gastos"/>
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:16 }}>
          <div style={{ ...G, fontSize:11, fontWeight:700, color:T.ink, marginBottom:10 }}>Projeção · Março 2026</div>
          <div style={{ background:T.bg, borderRadius:10, padding:"10px 10px 0", position:"relative", overflow:"hidden", height:90, marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:70, filter:"blur(2px)", opacity:0.15, pointerEvents:"none" }}>
              {[32,54,41,72,46,63,37,85,53,67,44,78].map((h,i)=>(
                <div key={i} style={{ flex:1, borderRadius:"2px 2px 0 0", background:T.ink, height:`${h}%` }}/>
              ))}
            </div>
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <span style={{ fontSize:18 }}>🔐</span>
              <span style={{ ...G, fontSize:12, fontWeight:700, color:T.inkMid }}>Desbloqueado com a primeira transação</span>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:9, marginBottom:14 }}>
            {[
              { n:"1", text:<><strong>Registre um gasto</strong> — qualquer compra do dia a dia.</> },
              { n:"2", text:<><strong>O gráfico mostra</strong> sua curva real vs. projeção ideal do mês.</> },
              { n:"3", text:<><strong>Receba alertas</strong> quando o ritmo sair do ideal.</> },
            ].map((s,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:9 }}>
                <div style={{ width:20, height:20, borderRadius:"50%", background:T.ink, color:"#fff", fontSize:10, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>{s.n}</div>
                <div style={{ ...G, fontSize:12, color:T.inkMid, lineHeight:1.6 }}>{s.text}</div>
              </div>
            ))}
          </div>
          <button onClick={()=>openTxModal()} style={{ ...G, width:"100%", background:T.redLight, color:T.red, border:"none", borderRadius:9, padding:"10px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
            + Registrar primeira transação
          </button>
        </div>
      </div>
    ) : (
      <RitmoPageView
        onNav={navTo}
        isMobile={isMobile}
        dataMode={dataMode}
        organizationId={session.activeOrgId}
        onNewTx={() => openTxModal()}
      />
    ),
    transactions:   dataMode==="empty" ? (
      extraTx.length > 0 ? (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
            <PageTitle sans="Transações" serif=""/>
            <button onClick={()=>openTxModal()} style={{ ...G, background:T.ink, color:"#fff", border:"none", borderRadius:11, padding:"9px 18px", fontSize:12, fontWeight:700, cursor:"pointer" }}>+ Nova transação</button>
          </div>
          <div style={{ ...G, fontSize:12, color:T.inkLight }}>Transações registradas no onboarding</div>
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden" }}>
            {extraTx.map((tx, i) => (
              <div key={tx.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 18px",
                borderBottom: i < extraTx.length-1 ? `1px solid ${T.border}` : "none" }}>
                <div style={{ width:36, height:36, borderRadius:10, background:T.grayLight,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{tx.icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ ...G, fontSize:13, fontWeight:600, color:T.ink }}>{tx.desc}</div>
                  <div style={{ ...G, fontSize:11, color:T.inkLight }}>{tx.cat} · {tx.method} · {tx.date}
                    {tx.rec && <span style={{ ...G, fontSize:10, color:T.blue, background:T.blueLight, borderRadius:99, padding:"1px 7px", marginLeft:6, fontWeight:600 }}>recorrente</span>}
                    {tx.valorTipo==="estimado" && <span style={{ ...G, fontSize:10, color:T.amber, background:T.amberLight, borderRadius:99, padding:"1px 7px", marginLeft:4, fontWeight:600 }}>≈ estimado</span>}
                  </div>
                </div>
                <div style={{ ...G, ...NUM, fontSize:14, fontWeight:700, flexShrink:0,
                  color: tx.val > 0 ? T.green : T.ink }}>
                  {tx.val > 0 ? "+" : "−"}R$ {Math.abs(tx.val).toLocaleString("pt-BR",{minimumFractionDigits:2})}
                </div>
              </div>
            ))}
          </div>
          <div style={{ ...G, fontSize:12, color:T.inkLight, textAlign:"center" }}>
            Registre despesas e mais receitas para acompanhar seu fluxo completo.
          </div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <PageTitle sans="Transações" serif=""/>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"48px 24px", gap:12, textAlign:"center" }}>
            <div style={{ fontSize:28 }}>📭</div>
            <div style={{ ...G, fontSize:16, fontWeight:800, color:T.ink }}>Nenhuma transação ainda</div>
            <div style={{ ...G, fontSize:13, color:T.inkMid, lineHeight:1.7, maxWidth:360 }}>Suas transações aparecerão aqui conforme forem registradas. Registre receitas, despesas e transferências para acompanhar seu fluxo.</div>
            <button onClick={()=>openTxModal()} style={{ ...G, background:T.ink, color:"#fff", border:"none", borderRadius:11, padding:"11px 24px", fontSize:13, fontWeight:700, cursor:"pointer", marginTop:4 }}>+ Nova transação</button>
          </div>
        </div>
      )
    ) : <TransacoesPageView
      onNav={navTo}
      isMobile={isMobile}
      dataMode={dataMode}
      organizationId={session.activeOrgId}
      transactionsRefreshToken={transactionsListVersion}
      onTransactionsInvalidate={bumpTransactionsList}
      onNewTx={() => openTxModal()}
      onEditTx={(tx) => {
        const txMethod = modalPaymentKeyFromTransactionUi(tx);
        const isParcelado = tx.parcela && tx.parcela.total > 1;
        // Refund: tx.val é positivo mas o tipo no domínio é 'refund' → drawer abre na aba Despesa com toggle estorno ON.
        let tipoForModal;
        if (tx.type === "refund") tipoForModal = "despesa";
        else if (tx.type === "income" || tx.val > 0) tipoForModal = "receita";
        else tipoForModal = "despesa";
        flushSync(() => {
          setModalPreConfig({
            tipo: tipoForModal,
            isEstorno: tx.type === "refund",
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
            modalidade: txMethod === "credito"
              ? (isParcelado ? "parcelado" : "avista")
              : undefined,
            parcelas: isParcelado ? tx.parcela.total : undefined,
            tags: tx.tags ?? [],
            detailTagIds: tx.detailTagIds ?? [],
            detailTagDisplayById: tx.detailTagDisplayById ?? {},
            refundOfTransactionId: tx.refundOfTransactionId ?? null,
          });
        });
        openTxModal({ [FC.TX]: String(tx.id) });
      }}
    />,
    recurring: (dataMode==="empty" && extraRecs.length===0) ? (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <PageTitle sans="Recorrências &" serif="Compromissos"/>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ ...G, fontSize:14, color:T.inkMid, lineHeight:1.7 }}>
            Tudo começa com uma recorrência. Salário, aluguel, Spotify — cada item fixo aqui vira uma previsão automática no dashboard.
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
            {[
              { ic:"💰", title:"Receitas fixas",  sub:"Salário, pró-labore, aluguel recebido.", color:T.green,  colorL:T.greenLight,  action:"+ Receita",  mode:"recorrencia", tipo:"receita"  },
              { ic:"📋", title:"Despesas fixas", sub:"Boletos, assinaturas, débito automático.", color:T.red,    colorL:T.redLight,    action:"+ Despesa",  mode:"recorrencia", tipo:"despesa"  },
            ].map((c,i)=>(
              <div key={i} style={{ background:T.surface, border:`1.5px dashed ${T.border}`, borderRadius:13, padding:"18px 16px", textAlign:"center", display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ fontSize:28 }}>{c.ic}</div>
                <div style={{ ...G, fontSize:14, fontWeight:700, color:T.ink }}>{c.title}</div>
                <div style={{ ...G, fontSize:12, color:T.inkLight, lineHeight:1.55 }}>{c.sub}</div>
                <button onClick={()=>{ setModalPreConfig({ novaRecorrencia:true, tipo: c.tipo }); openTxModal({ [FC.MODAL]: FC_MODAL.NEW_RECURRING }); }} style={{ ...G, background:c.colorL, color:c.color, border:"none", borderRadius:9, padding:"9px", fontSize:12, fontWeight:700, cursor:"pointer" }}>{c.action}</button>
              </div>
            ))}
          </div>
          <div>
            <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Comuns para começar</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {["🏠 Aluguel","⚡ Conta de luz","📱 Plano celular","🎵 Spotify","🏋️ Academia","📺 Netflix"].map(p=>(
                <span key={p} style={{ ...G, fontSize:11, fontWeight:600, background:T.grayLight, color:T.inkMid, borderRadius:99, padding:"4px 12px" }}>{p}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    ) : <RecorrenciasPageView onNav={navTo} cenarios={cenarios} isMobile={isMobile} dataMode={dataMode} extraRecs={extraRecs} organizationId={session.activeOrgId} recurringRefreshToken={transactionsListVersion} onNovaRec={() => { openTxModal({ [FC.MODAL]: FC_MODAL.NEW_RECURRING }); }} onEditar={(rec) => {
              const freqId = rec.freqId || rec.freq?.split(" ")[0]?.toLowerCase() || "mensal";
              const encId  = rec.encId || (rec.enc === "Sem data fim" ? "sem-fim" : rec.enc === "Após N repetições" ? "repeticoes" : rec.enc === "Data específica" ? "data" : "sem-fim");
              const methodId = rec.methodId || (rec.metodo === "Pix" ? "pix" : rec.metodo === "Boleto" ? "boleto" : rec.metodo === "Débito" || rec.metodo === "Débito auto." ? "debito" : rec.metodo === "Transferência" ? "transferencia" : rec.metodo === "Cartão crédito" ? "credito" : "pix");
              setModalPreConfig({
                tipo: rec.tipo,
                desc: rec.desc,
                cat: rec.cat,
                categoryTagId: rec.categoryTagId ?? undefined,
                method: methodId,
                valorInicial: rec.val,
                recorre: true,
                freqRec: freqId,
                encRec: encId,
                dataFimRec: rec.endDateRaw || undefined,
                encEndDateYmdRec: rec.endDateRaw || undefined,
                valorTipoRec: rec.valorTipo || "fixo",
                isEditRecorrencia: true,
                recId: rec.id,
                cartaoId: rec.creditCardId != null ? String(rec.creditCardId) : undefined,
                transactionDate: rec.nextOccurrenceIso || undefined,
                selectedDayOfWeek: rec.dayOfWeek ?? null,
                selectedDayOfMonth: rec.dayOfMonth ?? null,
                customIntervalRec: rec.interval ?? 1,
                customUnitRec: rec.intervalUnit || "month",
                firstOccurrenceYmd: rec.startDateRaw || rec.nextOccurrenceIso || undefined,
              });
              openTxModal();
            }} />,
    cards:      <CartõesPage    onNav={navTo} isMobile={isMobile} cards={dataMode==="empty" ? extraCards : undefined} dataMode={dataMode} organizationId={session.activeOrgId} transactionsRefreshToken={transactionsListVersion} onNovaItem={(cartaoId) => {
      const id = String(cartaoId);
      setModalPreConfig((p) => ({
        ...(p || {}),
        tipo: "despesa",
        method: "credito",
        cartaoId: id,
      }));
      openTxModal(isUuidString(id) ? { [FC.CARD]: id } : {});
    }} onLancarEstorno={(item, fromCard) => {
      // Abre o drawer já configurado pra estorno linkado à compra original (transaction_id pai).
      if (!item || item.transactionId == null) return;
      const cardIdNum = fromCard?.cardId != null && Number.isFinite(Number(fromCard.cardId))
        ? Number(fromCard.cardId)
        : null;
      const totalCompraOriginal = item.parcela?.total != null
        ? Number(item.parcela.total)
        : Number(item.val);
      setModalPreConfig({
        tipo: "despesa",
        isEstorno: true,
        method: "credito",
        cartaoId: cardIdNum != null ? String(cardIdNum) : undefined,
        cat: item.cat,
        categoryTagId: null,
        refundOfTransactionId: Number(item.transactionId),
        refundLinkedTx: {
          id: Number(item.transactionId),
          desc: item.desc,
          dateLabel: item.data,
          val: Math.abs(totalCompraOriginal),
          cat: item.cat,
          categoryTagId: null,
          paymentMethodKey: "credito",
          cardId: cardIdNum,
        },
        valorInicial: Math.abs(totalCompraOriginal),
      });
      openTxModal(cardIdNum != null ? { [FC.CARD]: String(cardIdNum) } : {});
    }} />,
    budgets:   <OrcamentosPage onNav={navTo} isMobile={isMobile} dataMode={dataMode} organizationId={session.activeOrgId} />,
    goals:        <MetasPageView    isMobile={isMobile} initialMetas={dataMode==="empty" ? [] : undefined} dataMode={dataMode} organizationId={session.activeOrgId} onContribuir={(meta) => { setModalPreConfig({ tipo:"receita", desc:`Aporte — ${meta.nome}`, cat:"Poupança" }); openTxModal(); }} />,
    profile:        <ConfiguracoesPage onNav={navTo} isMobile={isMobile} onboardingData={onboardingData} dataMode={dataMode} organizationId={session.activeOrgId} currentUser={session.user} />,
    reports:   <RelatoriosPage onNav={(dest)=>{ if(dest==="_nova_transacao") openTxModal(); else navTo(dest); }} isMobile={isMobile} dataMode={dataMode} extraRecs={extraRecs} organizationId={session.activeOrgId} />,
    simulation:    <SimulacaoPageView cenarios={cenarios} setCenarios={setCenarios} cenarioId={cenarioId} setCenarioId={setCenarioId} isMobile={isMobile} organizationId={session.activeOrgId} dataMode={dataMode} />,
  };

  if (session.isBootstrapping) return (
    <>
      <AnimStyles/>
      <div style={{ ...G, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:T.bg, padding:24 }}>
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:"28px 24px", minWidth:320, textAlign:"center", boxShadow:T.sm }}>
          <img src="/logo.png" alt="Fincla" width={32} height={32} style={{ objectFit:"contain", display:"block", margin:"0 auto 14px" }} />
          <div style={{ ...S, fontSize:28, color:T.ink, marginBottom:10 }}>
            Carregando sua sessao
          </div>
          <div style={{ ...G, fontSize:13, color:T.inkMid, lineHeight:1.65 }}>
            Buscando usuario, organizacao ativa e estado inicial do app.
          </div>
        </div>
      </div>
    </>
  );

  if (session.isAuthenticated && (session.onboardingRequired || showOnboarding)) return (
    <OnboardingFlow
      isMobile={isMobile}
      isSubmitting={onboardingSubmitting}
      errorMessage={onboardingError}
      onComplete={async (data) => {
        setOnboardingError("");
        setOnboardingSubmitting(true);
        setOnboardingData(data);
        try {
          const onboardingResult = await submitOnboarding(data);
          session.completeOnboarding(onboardingResult);
          setShowOnboarding(false);
          setChecklistDismissed(false);
          setRequestedDataMode("live");
          setCenarios([]);
          setCenarioId(null);
          const recurringPreview = buildImmediateRecurringPreview(data);
          const creditCardPreview = buildImmediateCreditCardPreview(data);

          setExtraRecs(recurringPreview ? [recurringPreview] : []);
          setExtraCards(creditCardPreview ? [creditCardPreview] : []);

          navigate({ to: "/dashboard", replace: true });
        } catch (error) {
          setOnboardingError(
            error instanceof Error ? error.message : "Nao foi possivel concluir o onboarding.",
          );
        } finally {
          setOnboardingSubmitting(false);
        }
      }}
    />
  );

  if (!session.isAuthenticated) {
    const entry = parseAuthEntryUrl();
    if (entry.kind === "invite" && entry.token) {
      return (
        <AcceptInvitationPage
          token={entry.token}
          onAccept={acceptOrganizationInvitation}
          onComplete={() => {
            stripAuthEntryQueryAndHash();
            window.location.reload();
          }}
        />
      );
    }
    if (entry.kind === "reset" && entry.token) {
      return (
        <PasswordResetPage
          token={entry.token}
          onResetPassword={session.resetPasswordWithToken}
          onComplete={() => {
            stripAuthEntryQueryAndHash();
            window.location.reload();
          }}
        />
      );
    }
    return (
      <LoginPage
        onLogin={session.signIn}
        initialError={session.error}
        onRequestPasswordReset={session.requestPasswordReset}
        showDemoAccessHint={mockDataEnabled}
      />
    );
  }

  return (
    <>
    <AnimStyles/>
    <FinclaPageContext.Provider value={{ pages, user: session.user }}>
    <div style={{ ...G, display:"flex", height:"100vh", background:T.bg, overflow:"hidden" }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 99px; }
        input[type=range] { -webkit-appearance: none; height: 4px; border-radius: 99px; outline: none; cursor: pointer; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: ${T.ink}; border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
      `}</style>
      <Sidebar
        page={activeSegment} onNav={navTo}
        isMobile={isMobile}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={session.user}
      />
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <Topbar
          onNew={() => openTxModal()}
          isMobile={isMobile}
          onMenuOpen={() => setSidebarOpen(true)}
          onNav={navTo}
          page={activeSegment}
          user={session.user}
        />

        {/* Mood top border on dashboard */}
        {activeSegment === "dashboard" && mood.topBorder !== "transparent" && (
          <div style={{ height:2, background:mood.topBorder, transition:"background 0.18s", flexShrink:0 }} />
        )}

        {/* Legado: toggle flutuante do painel de estado — desligado na UI; ver `showLegacyStatePanelFloatButton` */}
        {showLegacyStatePanelFloatButton && activeSegment === "dashboard" && !isMobile && (
          <button onClick={() => setPanelOpen(p => !p)} style={{ position:"fixed", top:68, right:16, zIndex:201, width:32, height:32, borderRadius:8, border:`1px solid ${T.border}`, background:panelOpen?T.ink:T.surface, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"all 0.2s", boxShadow:T.sm }}>
            <SlidersHorizontal size={13} color={panelOpen?"#fff":T.inkMid} />
          </button>
        )}

        {!isMobile && <StatePanelV4 open={panelOpen} day={day} setDay={setDay} budgetPct={budgetPct} setBudgetPct={setBudgetPct} freePct={freePct} setFreePct={setFreePct} moodKey={moodKey} onStartOnboarding={() => { setPanelOpen(false); setShowOnboarding(true); }} dataMode={dataMode} allowDataModeToggle={mockDataEnabled} onSetDataMode={(mode) => { setRequestedDataMode(mode); if (mode === 'empty') { setCenarios([]); setCenarioId(null); } else { setCenarios(SIM_CENARIOS_INIT); setCenarioId(SIM_CENARIOS_INIT[0].id); } }} />}

        <div data-fincla-main-scroll style={{ flex:1, overflowY:"auto", overflowX:"hidden", padding:isMobile?"14px 14px 40px":"20px 28px 40px" }}>
          {activeSegment === "dashboard" && onboardingData && !checklistDismissed && (
            <MiniChecklist
              onboardingData={onboardingData}
              completedTx={completedTx}
              completedBudget={completedBudget}
              onDismiss={() => setChecklistDismissed(true)}
              onNav={(dest) => { if (dest === "_nova_transacao") { openTxModal(); } else { navTo(dest); } }}
            />
          )}
          <ErrorBoundary key={finclaMainOutletRemountKey(pathname)}><PageEnter key={finclaMainOutletRemountKey(pathname)}><Outlet /></PageEnter></ErrorBoundary>
        </div>
      </div>
      <NovaTransacaoModal open={txModalOpen} onClose={closeTxModal} onTransactionSaved={bumpTransactionsList} novaRecorrencia={novaRecorrenciaModal} preConfig={modalPreConfig} isMobile={isMobile} organizationId={session.activeOrgId} dataMode={dataMode} />
    </div>
    </FinclaPageContext.Provider>
    </>
  );
}
