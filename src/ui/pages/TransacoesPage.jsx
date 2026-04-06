import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Search,
  ChevronRight,
  X,
  Check,
  Pencil,
  Trash2,
  Download,
  SlidersHorizontal,
  Calendar,
  ArrowUpDown,
} from "lucide-react";
import { T } from "../tokens";
import { G } from "../typography";
import { PageTitle } from "../components/primitives";
import { TRANSACTIONS } from "../data/mockFinance";
import { buildTransactionsCsvOptions, downloadTransactionsCsvForUi } from "../data/transactionsAdapter.js";
import { useCategoryTagsData } from "../features/tags/useCategoryTagsData.js";
import { PeriodCalendar } from "../features/transactions/PeriodCalendar.jsx";
import { useTransactionsData } from "../features/transactions/useTransactionsData.js";
import { resolveLocalData, shouldUseRealData as shouldUseRealDataForMode } from "../dataMode.js";
import { CardEmptyWithCta } from "../features/shellExtras.jsx";
import { FINCLA_CALENDAR_SHADOW } from "../components/finclaCalendarStyles.js";
import {
  getTransactionsPeriodBootstrap,
  writeTransactionsPeriodToStorage,
  TRANSACTIONS_DEFAULT_PERIOD,
} from "../features/transactions/transactionsPeriodStorage.js";

export function TransacoesPage({
  onNav,
  isMobile = false,
  onEditTx,
  onNewTx,
  dataMode = "live",
  organizationId = null,
  initialFilterCat = "",
  transactionsRefreshToken = 0,
  onTransactionsInvalidate,
}) {
  const PAGE_SIZE = 10;

  const CAT_COLORS = {
    Alimentação: "#059669",
    Transporte: "#2563EB",
    Moradia: "#6B7280",
    Saúde: "#DC2626",
    Receita: "#059669",
    Assinaturas: "#7C3AED",
    "Assinaturas & Software": "#0891B2",
    Streaming: "#7C3AED",
    Lazer: "#D97706",
    "Lazer & Entretenimento": "#D97706",
    Compras: "#0891B2",
    "Compras Pessoais": "#DC2626",
    Educação: "#7C3AED",
    Outros: "#374151",
    Serviços: "#6B7280",
    "Impostos & Taxas": "#D97706",
    Vestuário: "#BE185D",
  };
  const catColor = (label) => CAT_COLORS[label] || T.inkMid;
  const catBg = (label) => `${catColor(label)}18`;

  const fmtBRL = v => "R$\u00a0" + Math.abs(v).toLocaleString("pt-BR",{minimumFractionDigits:2});
  const parseDate = d => {
    if (!d) return new Date(0);
    const parts = d.split("/");
    if (parts.length === 3) return new Date(+parts[2], +parts[1]-1, +parts[0]);
    if (parts.length === 2) return new Date(new Date().getFullYear(), +parts[1]-1, +parts[0]);
    return new Date(0);
  };
  const fmtDateLabel = (d) => {
    const dt = parseDate(d);
    const today = new Date();
    const yest  = new Date();
    yest.setDate(today.getDate() - 1);
    if (dt.toDateString() === today.toDateString()) return "Hoje";
    if (dt.toDateString() === yest.toDateString())  return "Ontem";
    return dt.toLocaleDateString("pt-BR",{weekday:"long", day:"numeric", month:"long"});
  };

  // ── State ─────────────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState("");
  const [filterType,  setFilterType]  = useState("todos");
  const [filterCat,   setFilterCat]   = useState("todas");
  const [filterMethod,setFilterMethod]= useState("todos");
  const [sortBy,      setSortBy]      = useState("date-desc"); // date-desc|date-asc|val-desc|val-asc|name-asc|name-desc
  /** Período: default "mes" + persistência por org (`transactionsPeriodStorage`). */
  const periodBootstrapRef = useRef(null);
  if (periodBootstrapRef.current === null) {
    periodBootstrapRef.current = getTransactionsPeriodBootstrap(organizationId);
  }
  const b0 = periodBootstrapRef.current;
  const [period,      setPeriod]      = useState(b0.period);
  const [customFrom,  setCustomFrom]  = useState(b0.customFrom);
  const [customTo,    setCustomTo]    = useState(b0.customTo);
  const periodPersistFingerprintRef = useRef("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [periodOpen,  setPeriodOpen]  = useState(false);
  // ── Bottom sheet drag-to-dismiss ──────────────────────────────
  const sheetRef      = useRef(null);
  const snapFullRef   = useRef(false);   // read in RAF/touch handlers (no stale closure)
  const isClosingRef  = useRef(false);   // prevents double-close
  const [snapFull,    setSnapFull]    = useState(false);  // false=72dvh, true=92dvh
  const [sheetClosing,setSheetClosing]= useState(false);  // drives exit animation
  const [sortOpen,    setSortOpen]    = useState(false);
  const [selected,    setSelected]    = useState(null);
  const [visible,     setVisible]     = useState(PAGE_SIZE);
  const listScrollRef = useRef(null);
  const loadMoreSentinelRef = useRef(null);
  const loadMoreCooldownRef = useRef(false);
  const [deletingId,  setDeletingId]  = useState(null);
  const [mockTxList,  setMockTxList]  = useState(TRANSACTIONS);

  useLayoutEffect(() => {
    if (!organizationId) {
      periodPersistFingerprintRef.current = "";
      return;
    }
    const row = getTransactionsPeriodBootstrap(organizationId);
    periodPersistFingerprintRef.current = JSON.stringify({
      org: organizationId,
      period: row.period,
      customFrom: row.customFrom,
      customTo: row.customTo,
    });
    setPeriod(row.period);
    setCustomFrom(row.customFrom);
    setCustomTo(row.customTo);
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    const fp = JSON.stringify({
      org: organizationId,
      period,
      customFrom,
      customTo,
    });
    if (fp === periodPersistFingerprintRef.current) return;
    periodPersistFingerprintRef.current = fp;
    writeTransactionsPeriodToStorage(organizationId, {
      period,
      customFrom,
      customTo,
    });
  }, [organizationId, period, customFrom, customTo]);

  const shouldUseRealData = shouldUseRealDataForMode(organizationId, dataMode);
  const transactionsFilters = useMemo(() => ({
    search,
    filterType,
    filterCat,
    filterMethod,
    period,
    customFrom,
    customTo,
    sortBy,
    limit: visible,
  }), [search, filterMethod, filterType, filterCat, period, customFrom, customTo, sortBy, visible]);
  const transactionsData = useTransactionsData({
    organizationId,
    enabled: shouldUseRealData,
    filters: transactionsFilters,
    refreshToken: transactionsRefreshToken,
  });
  const categoryTagsData = useCategoryTagsData({
    organizationId,
    enabled: shouldUseRealData,
  });
  const txList = shouldUseRealData
    ? transactionsData.transactions
    : resolveLocalData({ dataMode, mockData: mockTxList, emptyData: [] });

  const ALL_CAT_CHIPS = useMemo(() => {
    if (shouldUseRealData && categoryTagsData.categories?.length) {
      return categoryTagsData.categories.map((c) => ({
        value: c.id,
        label: c.labelPt,
        colorHex: c.color || null,
      }));
    }
    return [...new Set(txList.map((t) => t.cat))]
      .sort()
      .map((label) => ({ value: label, label, colorHex: null }));
  }, [shouldUseRealData, categoryTagsData.categories, txList]);

  const catColorForChip = (row) => row.colorHex || CAT_COLORS[row.label] || T.inkMid;
  const catBgForChip = (row) => `${catColorForChip(row)}18`;

  const filterCatLabel =
    filterCat === "todas"
      ? ""
      : ALL_CAT_CHIPS.find((r) => r.value === filterCat)?.label ?? filterCat;

  const ALL_METHODS = [...new Set(txList.map(t=>t.method))].sort();

  useEffect(() => {
    if (!initialFilterCat) return;
    if (shouldUseRealData && categoryTagsData.categories?.length) {
      const byId = categoryTagsData.categories.find((c) => c.id === initialFilterCat);
      if (byId) {
        setFilterCat(byId.id);
        setFiltersOpen(false);
        return;
      }
      const byLabel = categoryTagsData.categories.find((c) => c.labelPt === initialFilterCat);
      if (byLabel) {
        setFilterCat(byLabel.id);
        setFiltersOpen(false);
        return;
      }
    }
    setFilterCat(initialFilterCat);
    setFiltersOpen(false);
  }, [initialFilterCat, shouldUseRealData, categoryTagsData.categories]);

  // Period presets
  const TODAY = new Date();
  const PERIOD_LABELS = {
    tudo:"Todo período", hoje:"Hoje", semana:"Esta semana",
    mes:"Este mês", "mes-ant":"Mês anterior", "3m":"Últimos 3 meses",
    ano:"Este ano", custom:"Personalizado"
  };
  const periodFilter = (t) => {
    const d = parseDate(t.date);
    if (period === "tudo")    return true;
    if (period === "hoje")    return d.toDateString() === TODAY.toDateString();
    if (period === "semana")  { const w = new Date(TODAY); w.setDate(w.getDate()-7); return d >= w; }
    if (period === "mes")     return d.getMonth()===TODAY.getMonth() && d.getFullYear()===TODAY.getFullYear();
    if (period === "mes-ant") { const m = new Date(TODAY); m.setMonth(m.getMonth()-1); return d.getMonth()===m.getMonth() && d.getFullYear()===m.getFullYear(); }
    if (period === "3m")      { const m3 = new Date(TODAY); m3.setMonth(m3.getMonth()-3); return d >= m3; }
    if (period === "ano")     return d.getFullYear()===TODAY.getFullYear();
    if (period === "custom")  {
      const from = customFrom ? new Date(customFrom) : null;
      const to   = customTo   ? new Date(customTo+"T23:59:59") : null;
      if (from && d < from) return false;
      if (to   && d > to)   return false;
      return true;
    }
    return true;
  };

  const SORT_LABELS = {
    "date-desc":"Data ↓ (mais recente)", "date-asc":"Data ↑ (mais antiga)",
    "val-desc":"Valor ↓ (maior)", "val-asc":"Valor ↑ (menor)",
    "name-asc":"Nome A→Z", "name-desc":"Nome Z→A"
  };
  const sortFn = (a,b) => {
    if (sortBy==="date-desc") return parseDate(b.date)-parseDate(a.date);
    if (sortBy==="date-asc")  return parseDate(a.date)-parseDate(b.date);
    if (sortBy==="val-desc")  return Math.abs(b.val)-Math.abs(a.val);
    if (sortBy==="val-asc")   return Math.abs(a.val)-Math.abs(b.val);
    if (sortBy==="name-asc")  return a.desc.localeCompare(b.desc,"pt-BR");
    if (sortBy==="name-desc") return b.desc.localeCompare(a.desc,"pt-BR");
    return 0;
  };

  const clearAll = () => {
    setSearch(""); setFilterType("todos"); setFilterCat("todas");
    setFilterMethod("todos");
    setPeriod(TRANSACTIONS_DEFAULT_PERIOD);
    setCustomFrom("");
    setCustomTo("");
    setSortBy("date-desc");
    setCustomFrom(""); setCustomTo(""); setVisible(PAGE_SIZE);
  };

  const activeChips = [
    period !== TRANSACTIONS_DEFAULT_PERIOD && { key:"period",  label: period==="custom" ? `${customFrom||"?"} → ${customTo||"?"}` : PERIOD_LABELS[period], onRemove:()=>{ setPeriod(TRANSACTIONS_DEFAULT_PERIOD); setCustomFrom(""); setCustomTo(""); } },
    filterType!=="todos"  && { key:"type",    label: filterType==="receita"?"↑ Receitas":"↓ Despesas",            onRemove:()=>setFilterType("todos") },
    filterCat!=="todas"   && { key:"cat",     label: filterCatLabel,                                               onRemove:()=>setFilterCat("todas") },
    filterMethod!=="todos"&& { key:"method",  label: filterMethod,                                                 onRemove:()=>setFilterMethod("todos") },
    sortBy!=="date-desc"  && { key:"sort",    label: "↕ "+SORT_LABELS[sortBy].split("(")[0].trim(),               onRemove:()=>setSortBy("date-desc") },
    search                && { key:"search",  label: `"${search}"`,                                                onRemove:()=>setSearch("") },
  ].filter(Boolean);

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (shouldUseRealData) return txList;

    return txList.filter(t => {
      if (!periodFilter(t)) return false;
      if (filterType === "receita"  && t.val < 0) return false;
      if (filterType === "despesa"  && t.val > 0) return false;
      if (filterCat   !== "todas"   && t.cat !== filterCat) return false;
      if (filterMethod!== "todos"   && t.method !== filterMethod) return false;
      if (search && ![t.desc, t.cat, ...(t.tags||[])].some(s => s.toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    }).sort(sortFn);
  }, [shouldUseRealData, txList, search, filterType, filterCat, filterMethod, period, sortBy, customFrom, customTo]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const canUseRemoteSummary = shouldUseRealData;
  const totalReceita = canUseRemoteSummary && transactionsData.summary
    ? transactionsData.summary.total_income
    : filtered.filter(t=>t.val>0).reduce((s,t)=>s+t.val,0);
  const totalDespesa = canUseRemoteSummary && transactionsData.summary
    ? transactionsData.summary.total_expenses
    : filtered.filter(t=>t.val<0).reduce((s,t)=>s+Math.abs(t.val),0);
  const saldo = canUseRemoteSummary && transactionsData.summary
    ? transactionsData.summary.balance
    : totalReceita - totalDespesa;
  const filteredCount = canUseRemoteSummary ? transactionsData.total : filtered.length;

  // ── Group by date ─────────────────────────────────────────────────────────
  const groups = useMemo(() => {
    const map = {};
    filtered.slice(0, visible).forEach(t => {
      const k = t.date || "Sem data";
      if (!map[k]) map[k] = [];
      map[k].push(t);
    });
    const entries = Object.entries(map);
    return shouldUseRealData
      ? entries
      : entries.sort((a,b) => parseDate(b[0]) - parseDate(a[0]));
  }, [shouldUseRealData, filtered, visible]);

  const hasMore = shouldUseRealData
    ? transactionsData.hasMore
    : visible < filtered.length;

  const tryLoadMore = useCallback(() => {
    if (!hasMore) return;
    if (shouldUseRealData && transactionsData.isLoading) return;
    if (loadMoreCooldownRef.current) return;
    loadMoreCooldownRef.current = true;
    setVisible((v) => v + PAGE_SIZE);
    window.setTimeout(() => {
      loadMoreCooldownRef.current = false;
    }, 400);
  }, [hasMore, shouldUseRealData, transactionsData.isLoading]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasMore) return;
    const root = isMobile ? null : listScrollRef.current;
    if (!isMobile && !root) return;

    const io = new IntersectionObserver(
      (entries) => {
        const [e] = entries;
        if (!e?.isIntersecting) return;
        tryLoadMore();
      },
      { root, rootMargin: "160px", threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [hasMore, isMobile, tryLoadMore]);

  const listFiltersActive =
    search.trim() !== "" ||
    filterType !== "todos" ||
    filterCat !== "todas" ||
    filterMethod !== "todos" ||
    period !== TRANSACTIONS_DEFAULT_PERIOD ||
    sortBy !== "date-desc" ||
    (period === "custom" && (Boolean(customFrom) || Boolean(customTo)));

  // ── CSV export ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const header = "Data,Descrição,Categoria,Método,Valor,Status,Tags";
    if (shouldUseRealData && organizationId && !search && filterCat === "todas") {
      downloadTransactionsCsvForUi(
        organizationId,
        buildTransactionsCsvOptions({
          filterType,
          filterMethod,
          period,
          customFrom,
          customTo,
        }),
      ).catch(() => {});
      return;
    }

    const rows = filtered.map((t) =>
      `${t.date},"${t.desc}","${t.cat}","${t.method}","${t.val > 0 ? "+" : ""}${t.val}","${t.status}","${(t.tags || []).join(";")}"`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "transacoes.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Detail panel content ──────────────────────────────────────────────────
  const DetailPanel = ({ tx, onClose }) => {
    if (!tx) return null;
    const isReceita = tx.val > 0;
    return (
      <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0 }}>
        {/* Header */}
        <div style={{ padding:"18px 20px", borderBottom:`1px solid ${T.border}`,
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ ...G, fontSize:14, fontWeight:800, color:T.ink }}>Detalhes</div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer",
            padding:6, borderRadius:7, display:"flex" }}
            onMouseEnter={e=>e.currentTarget.style.background=T.bg}
            onMouseLeave={e=>e.currentTarget.style.background="none"}>
            <X size={15} color={T.inkMid}/>
          </button>
        </div>
        {/* Amount hero */}
        <div style={{ padding:"24px 20px 16px", background: isReceita ? T.greenLight : T.redLight,
          borderBottom:`1px solid ${T.border}`, textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:6 }}>{tx.icon}</div>
          <div style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:26, fontWeight:800,
            color: isReceita ? T.green : T.red, letterSpacing:"-0.02em" }}>
            {isReceita ? "+" : "−"}{fmtBRL(tx.val)}
          </div>
          <div style={{ ...G, fontSize:13, color:T.inkMid, marginTop:4 }}>{tx.desc}</div>
        </div>
        {/* Fields */}
        <div style={{ flex:1, overflowY:"auto", overflowX:"hidden", padding:"16px 20px", display:"flex", flexDirection:"column", gap:0, minHeight:0 }}>
          {[
            { label:"Categoria", val: <span style={{ ...G, display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:catColor(tx.cat), flexShrink:0 }}/>
                {tx.cat}
              </span>},
            { label:"Data",      val: tx.date },
            { label:"Método",    val: tx.method + (tx.parcela?.cartao ? ` · ${tx.parcela.cartao}` : "") },
            { label:"Status",    val: <span style={{ ...G, fontSize:12, fontWeight:700, padding:"2px 8px", borderRadius:99,
                background: tx.status==="confirmado" ? T.greenLight : T.amberLight,
                color:       tx.status==="confirmado" ? T.green       : T.amber }}>
                {tx.status === "confirmado" ? "✓ Confirmado" : "⏳ Pendente"}
              </span>},
            { label:"Recorrente",val: tx.rec ? "Sim" : "Não" },
            ...(tx.parcela ? [
              { label:"Parcela",      val: `${tx.parcela.atual}ª de ${tx.parcela.total}` },
              { label:"Vencimento",   val: tx.parcela.vencimento },
              { label:"Valor parcela",val: <span style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:13, fontWeight:700, color:T.blue }}>{fmtBRL(tx.parcela.valParcela)}/mês</span> },
              { label:"Valor total",  val: <span style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:13, fontWeight:600 }}>{fmtBRL(tx.parcela.valorTotal)}</span> },
              { label:"Já pago",      val: <span style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:13, fontWeight:600, color:T.green }}>{fmtBRL(tx.parcela.valorPago)}</span> },
              { label:"Valor residual",val: <span style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:13, fontWeight:700, color:T.red }}>{fmtBRL(tx.parcela.valorResidual)}</span> },
            ] : []),
          ].map(({label,val})=>(
            <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"11px 0", borderBottom:`1px solid ${T.border}` }}>
              <div style={{ ...G, fontSize:12, color:T.inkMid }}>{label}</div>
              <div style={{ ...G, fontSize:13, color:T.ink, fontWeight:500 }}>{val}</div>
            </div>
          ))}
          {tx.parcela && (
            <div style={{ padding:"11px 0", borderBottom:`1px solid ${T.border}` }}>
              <div style={{ ...G, fontSize:12, color:T.inkMid, marginBottom:8 }}>Progresso das parcelas</div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                <span style={{ ...G, fontSize:11, color:T.green, fontWeight:600 }}>{fmtBRL(tx.parcela.valorPago)} pago</span>
                <span style={{ ...G, fontSize:11, color:T.red, fontWeight:600 }}>{fmtBRL(tx.parcela.valorResidual)} restante</span>
              </div>
              <div style={{ height:6, background:T.grayLight, borderRadius:99, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.round(tx.parcela.valorPago/tx.parcela.valorTotal*100)}%`,
                  background:`linear-gradient(to right, ${T.green}, ${T.blue})`, borderRadius:99,
                  animation:"progressFill 0.8s cubic-bezier(0.16,1,0.3,1) both" }}/>
              </div>
              <div style={{ ...G, fontSize:11, color:T.inkMid, textAlign:"center", marginTop:5 }}>
                {Math.round(tx.parcela.valorPago/tx.parcela.valorTotal*100)}% pago · {tx.parcela.total - tx.parcela.atual} parcelas restantes
              </div>
            </div>
          )}
          {(tx.tags||[]).length > 0 && (
            <div style={{ padding:"11px 0" }}>
              <div style={{ ...G, fontSize:12, color:T.inkMid, marginBottom:8 }}>Tags</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                {tx.tags.map(tag => (
                  <span key={tag} style={{ ...G, fontSize:11, background:T.grayLight,
                    color:T.inkMid, padding:"3px 9px", borderRadius:99 }}>#{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Actions */}
        <div style={{ padding:"14px 20px", borderTop:`1px solid ${T.border}`, display:"flex", gap:10 }}>
          <button
            onClick={() => { onEditTx && onEditTx(tx); onClose(); }}
            style={{ ...G, flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6,
              background:T.ink, color:"#fff", border:"none", borderRadius:10,
              padding:"10px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
            <Pencil size={13}/> Editar
          </button>
          {deletingId === tx.id ? (
            <button onClick={async () => {
              if (shouldUseRealData) {
                try {
                  await transactionsData.removeTransaction(tx.id);
                  onTransactionsInvalidate?.();
                } catch (_) {
                  return;
                }
              } else {
                setMockTxList((prev) => prev.filter((item) => item.id !== tx.id));
              }
              setSelected(null);
              setDeletingId(null);
            }}
              style={{ ...G, flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                background:T.red, color:"#fff", border:"none", borderRadius:10,
                padding:"10px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              <Trash2 size={13}/> Confirmar exclusão
            </button>
          ) : (
            <button onClick={() => setDeletingId(tx.id)}
              style={{ ...G, display:"flex", alignItems:"center", justifyContent:"center",
                background:"none", color:T.red, border:`1px solid ${T.red}44`,
                borderRadius:10, padding:"10px 14px", fontSize:13, cursor:"pointer" }}>
              <Trash2 size={13}/>
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── Transaction row ───────────────────────────────────────────────────────
  // ── Tooltip helper ─────────────────────────────────────────────────────────
  const Tip = ({ label, children, pos = "top" }) => {
    const [rect, setRect] = useState(null);
    const ref = useRef(null);
    if (!label) return <>{children}</>;

    const show = (e) => {
      if (ref.current) setRect(ref.current.getBoundingClientRect());
    };
    const hide = () => setRect(null);

    // Compute fixed position from measured rect
    const tipStyle = rect ? (pos === "top"
      ? { top: rect.top - 6, left: rect.left + rect.width / 2,
          transform: "translate(-50%, -100%)" }
      : { top: rect.bottom + 6, left: rect.left + rect.width / 2,
          transform: "translateX(-50%)" }
    ) : null;

    return (
      <span ref={ref} style={{ position:"relative", display:"inline-flex", alignItems:"center" }}
        onMouseEnter={show} onMouseLeave={hide}
        onTouchStart={e => { e.stopPropagation(); rect ? hide() : show(e); }}>
        {children}
        {rect && tipStyle && (
          <span style={{
            position:"fixed",
            top: tipStyle.top, left: tipStyle.left,
            transform: tipStyle.transform,
            background:"#1A1A2E", color:"#fff",
            fontSize:11, fontWeight:600, borderRadius:7, padding:"5px 9px",
            whiteSpace:"nowrap", zIndex:9999, pointerEvents:"none",
            boxShadow:"0 4px 14px rgba(0,0,0,0.28)", lineHeight:1.4,
          }}>
            {label}
          </span>
        )}
      </span>
    );
  };


  const TxRow = ({ tx }) => {
    const isSelected = selected?.id === tx.id;
    const isReceita  = tx.val > 0;
    const hasParcela = !!tx.parcela;
    const isCredito  = tx.method === "Crédito";
    const tags       = tx.tags || [];
    const visibleTags = tags.slice(0,2);
    const hiddenTags  = tags.slice(2);

    return (
      <div
        onClick={() => setSelected(isSelected ? null : tx)}
        className="fincla-row"
        style={{ display:"flex", alignItems:"flex-start", gap:12,
          padding: isMobile ? "13px 16px" : "12px 18px",
          background: isSelected ? `${catColor(tx.cat)}08` : "transparent",
          borderLeft: isSelected ? `3px solid ${catColor(tx.cat)}` : "3px solid transparent",
          cursor:"pointer", transition:"background 0.12s, border-color 0.12s" }}>

        {/* Icon */}
        <div style={{ width:38, height:38, borderRadius:11, background:catBg(tx.cat),
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0, marginTop:1 }}>
          {tx.icon}
        </div>

        {/* Main info */}
        <div style={{ flex:1, minWidth:0 }}>

          {/* Row 1: description — clean, no badge (parcela info is on row 3) */}
          <div style={{ ...G, fontSize:13, fontWeight:600, color:T.ink,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:3 }}>
            {tx.desc}
          </div>

          {/* Row 2: categoria · método · card digits · status chips */}
          <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap",
            marginBottom: (hasParcela || visibleTags.length > 0) ? 4 : 0 }}>
            <Tip label={`Categoria: ${tx.cat}`}>
              <span style={{ ...G, fontSize:11, color:catColor(tx.cat), fontWeight:600 }}>{tx.cat}</span>
            </Tip>
            <span style={{ ...G, fontSize:11, color:T.inkGhost }}>·</span>

            {/* Para Crédito: mostra "Crédito ●● 1177" inline se tiver cartão, senão só "Crédito" */}
            {isCredito ? (
              <Tip label={tx.parcela?.cartao || "Cartão de crédito"}>
                <span style={{ ...G, fontSize:11, color:T.inkMid }}>
                  Crédito
                  {tx.parcela?.cartao && (
                    <span style={{ color:T.inkGhost, fontFamily:"'Geist Mono',monospace", letterSpacing:"0.04em" }}>
                      {" ●● "}{tx.parcela.cartao.split("••")[1]?.trim()}
                    </span>
                  )}
                </span>
              </Tip>
            ) : (
              <Tip label={`Método: ${tx.method}`}>
                <span style={{ ...G, fontSize:11, color:T.inkMid }}>{tx.method}</span>
              </Tip>
            )}

            {tx.rec && (
              <Tip label="Transação recorrente — repete todo mês">
                <span style={{ ...G, fontSize:11, color:T.blue, background:T.blueLight,
                  borderRadius:99, padding:"1px 6px", fontWeight:700, cursor:"default" }}>↻</span>
              </Tip>
            )}

            {tx.status === "pendente" && (
              <Tip label="Aguardando confirmação do lançamento">
                <span style={{ ...G, fontSize:11, color:T.amber, background:T.amberLight,
                  borderRadius:99, padding:"1px 6px", fontWeight:700 }}>⏳ Pendente</span>
              </Tip>
            )}
          </div>

          {/* Row 3: parcela — compacta, sem redundância com row 2 */}
          {hasParcela && (
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom: visibleTags.length > 0 ? 4 : 0 }}>
              <Tip label={`${tx.parcela.atual}ª de ${tx.parcela.total} parcelas · ${tx.parcela.cartao}`}>
                <span style={{ ...G, fontSize:11, color:T.blue, fontWeight:600,
                  fontFamily:"'Geist Mono',monospace" }}>
                  {tx.parcela.atual}/{tx.parcela.total}×
                </span>
              </Tip>
              <span style={{ ...G, fontSize:10, color:T.inkGhost }}>·</span>
              <Tip label={`Parcela: ${fmtBRL(tx.parcela.valParcela)}/mês · Vence ${tx.parcela.vencimento}`}>
                <span style={{ ...G, fontSize:11, color:T.inkMid,
                  fontFamily:"'Geist Mono',monospace" }}>
                  {fmtBRL(tx.parcela.valParcela)}/mês
                </span>
              </Tip>
              <span style={{ ...G, fontSize:10, color:T.inkGhost }}>·</span>
              <Tip label={`Já pago: ${fmtBRL(tx.parcela.valorPago)} · Residual: ${fmtBRL(tx.parcela.valorResidual)}`}>
                <span style={{ ...G, fontSize:11, color:T.inkLight }}>
                  {tx.parcela.total - tx.parcela.atual} restantes
                </span>
              </Tip>
            </div>
          )}

          {/* Row 4: tags */}
          {visibleTags.length > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:4, flexWrap:"wrap" }}>
              {visibleTags.map(tag => (
                <span key={tag} style={{ ...G, fontSize:10, color:T.inkMid, background:T.grayLight,
                  borderRadius:99, padding:"2px 8px", fontWeight:500 }}>#{tag}</span>
              ))}
              {hiddenTags.length > 0 && (
                <Tip label={`Todas: ${tags.map(t=>"#"+t).join(", ")}`} pos="top">
                  <span style={{ ...G, fontSize:10, color:T.blue, background:T.blueLight,
                    borderRadius:99, padding:"2px 8px", fontWeight:700, cursor:"default" }}>
                    +{hiddenTags.length}
                  </span>
                </Tip>
              )}
            </div>
          )}
        </div>

        {/* Amount column — total da compra + parcela/mês abaixo */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", flexShrink:0, gap:2, marginTop:1 }}>
          <Tip label={hasParcela ? `Total da compra: ${fmtBRL(tx.val)}` : ""} pos="top">
            <div style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:14, fontWeight:700,
              color: isReceita ? T.green : T.ink }}>
              {isReceita ? "+" : "−"}{fmtBRL(tx.val)}
            </div>
          </Tip>
          {!isMobile && (
            <ChevronRight size={12} color={isSelected ? catColor(tx.cat) : T.inkGhost}
              style={{ marginTop:2, transition:"color 0.12s" }}/>
          )}
        </div>
      </div>
    );
  };


  // ── Filter bar (advanced: tipo, método, categoria) ───────────────────────
  const FilterBar = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:10,
      background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"14px 16px",
      animation:"fadeIn 0.15s ease" }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div>
          <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase",
            letterSpacing:"0.07em", marginBottom:6 }}>Tipo</div>
          <div style={{ display:"flex", gap:5 }}>
            {[["todos","Todos"],["receita","↑ Receita"],["despesa","↓ Despesa"]].map(([v,l])=>(
              <button key={v} onClick={()=>{setFilterType(v);setVisible(PAGE_SIZE);}}
                style={{ ...G, flex:1, padding:"6px 0", borderRadius:8,
                  border:`1px solid ${filterType===v?T.ink:T.border}`,
                  background:filterType===v?T.ink:"none",
                  color:filterType===v?"#fff":T.inkMid,
                  fontSize:11, fontWeight:700, cursor:"pointer" }}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase",
            letterSpacing:"0.07em", marginBottom:6 }}>Método</div>
          <select value={filterMethod} onChange={e=>{setFilterMethod(e.target.value);setVisible(PAGE_SIZE);}}
            style={{ ...G, width:"100%", padding:"7px 10px", borderRadius:8,
              border:`1px solid ${T.border}`, background:T.surface,
              fontSize:12, color:T.ink, cursor:"pointer", outline:"none" }}>
            <option value="todos">Todos</option>
            {ALL_METHODS.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
      <div>
        <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase",
          letterSpacing:"0.07em", marginBottom:6 }}>Categoria</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
          {[{ value: "todas", label: "Todas" }, ...ALL_CAT_CHIPS].map((row) => (
            <button key={row.value} onClick={()=>{setFilterCat(row.value);setVisible(PAGE_SIZE);}}
              style={{ ...G, padding:"4px 10px", borderRadius:99,
                border:`1px solid ${filterCat===row.value?(row.value==="todas"?T.ink:catColorForChip(row)):T.border}`,
                background:filterCat===row.value?(row.value==="todas"?T.ink:catBgForChip(row)):"none",
                color:filterCat===row.value?(row.value==="todas"?"#fff":catColorForChip(row)):T.inkMid,
                fontSize:11, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>
              {row.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const listContent = (
    <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
      {groups.length === 0 ? (
        <CardEmptyWithCta
          icon="🔍"
          iconSize={28}
          title="Nenhuma transação encontrada"
          sub="Tente ajustar os filtros ou a busca — ou registre um lançamento novo."
          primaryLabel={listFiltersActive ? "Limpar filtros" : onNewTx ? "+ Nova transação" : undefined}
          onPrimary={listFiltersActive ? clearAll : onNewTx || undefined}
          secondaryLabel={listFiltersActive && onNewTx ? "+ Nova transação" : undefined}
          onSecondary={listFiltersActive && onNewTx ? onNewTx : undefined}
        />
      ) : (
        groups.map(([date, txs]) => (
          <div key={date}>
            {/* Date group header */}
            <div style={{ display:"flex", alignItems:"center", gap:10, padding: isMobile ? "10px 16px 4px" : "10px 18px 4px",
              position:"sticky", top:0, background:T.bg, zIndex:2,
              boxShadow:"0 1px 0 rgba(15,23,42,0.06)" }}>
              <div style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid,
                textTransform:"capitalize" }}>{fmtDateLabel(date)}</div>
              <div style={{ flex:1, height:1, background:T.border }}/>
              <div style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:11,
                color: txs.reduce((s,t)=>s+t.val,0) >= 0 ? T.green : T.red, fontWeight:700 }}>
                {txs.reduce((s,t)=>s+t.val,0) >= 0 ? "+" : "−"}{fmtBRL(Math.abs(txs.reduce((s,t)=>s+t.val,0)))}
              </div>
            </div>
            {/* Rows */}
            <div style={{ background:T.surface, borderRadius:12, overflow:"hidden",
              border:`1px solid ${T.border}`, margin: isMobile ? "0 0 10px" : "0 0 8px" }}>
              {txs.map((tx, i) => (
                <div key={tx.id} style={{ borderBottom: i<txs.length-1?`1px solid ${T.border}`:"none" }}>
                  <TxRow tx={tx}/>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
      {/* Paginação infinita: sentinel + feedback (carregamento ao chegar ao fim da lista) */}
      {hasMore && (
        <div
          ref={loadMoreSentinelRef}
          style={{ height:1, marginTop:8, flexShrink:0 }}
          aria-hidden
        />
      )}
      {hasMore && shouldUseRealData && transactionsData.isLoading && (
        <div style={{ ...G, textAlign:"center", fontSize:12, color:T.inkLight, padding:"10px 0 4px" }}>
          Carregando mais…
        </div>
      )}
    </div>
  );

  // ── Bottom sheet drag & snap ─────────────────────────────────────
  // Rule: DOM direct for 60fps drag. React state only for layout snaps + close.

  const onSheetClose = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setSheetClosing(true);
    // Wait for CSS exit animation (sheetDown) then unmount
    setTimeout(() => {
      setFiltersOpen(false);
      setSheetClosing(false);
      setSnapFull(false);
      snapFullRef.current  = false;
      isClosingRef.current = false;
    }, 420);
  };

  const onSheetTouchStart = (e) => {
    const el = sheetRef.current;
    if (!el) return;
    const startY = e.touches[0].clientY;
    const startT = Date.now();
    let lastDelta = 0;

    const onMove = (ev) => {
      const delta = ev.touches[0].clientY - startY;
      lastDelta = delta;
      if (delta < 0) {
        // ── Drag UP ──────────────────────────────────────────────
        if (!snapFullRef.current && delta < -52) {
          // Expand to fullscreen — update ref first, then state
          snapFullRef.current = true;
          setSnapFull(true);
          el.style.transform = '';
          cleanup();
        } else if (snapFullRef.current) {
          // Rubber-band at top
          el.style.transform = `translateY(${delta / 3}px)`;
        }
      } else {
        // ── Drag DOWN ────────────────────────────────────────────
        if (snapFullRef.current && delta > 64) {
          // Collapse from fullscreen to default snap
          snapFullRef.current = false;
          setSnapFull(false);
          el.style.transform = '';
          cleanup();
        } else {
          // Live follow finger (dismiss gesture or rubber-band from full)
          const resistance = snapFullRef.current ? 0.3 : 1;
          el.style.transform = `translateY(${Math.max(0, delta * resistance)}px)`;
        }
      }
    };

    const onEnd = () => {
      const elapsed  = Date.now() - startT;
      const velocity = lastDelta / Math.max(elapsed, 1); // px/ms
      const sheetH   = el.offsetHeight || 400;
      if (!snapFullRef.current && (velocity > 0.45 || lastDelta > sheetH * 0.30)) {
        // Dismiss — animate sheet off screen, then close
        el.style.transition = 'transform 0.38s cubic-bezier(0.32,0.72,0,1)';
        el.style.transform  = 'translateY(105%)';
        setTimeout(() => {
          el.style.transform  = '';
          el.style.transition = '';
          onSheetClose();
        }, 380);
      } else {
        // Snap back with spring
        el.style.transition = 'transform 0.4s cubic-bezier(0.32,0.72,0,1)';
        el.style.transform  = 'translateY(0)';
        setTimeout(() => { el.style.transition = ''; }, 400);
      }
      cleanup();
    };

    const cleanup = () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend',  onEnd);
    };

    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend',  onEnd);
  };


  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14, height: isMobile ? undefined : "calc(100dvh - 116px)" }}>
      {shouldUseRealData && transactionsData.error && (
        <div style={{ ...G, fontSize:13, color:T.red, background:T.redLight, border:`1px solid ${T.red}22`, borderRadius:12, padding:"12px 14px" }}>
          {transactionsData.error}
        </div>
      )}

      {/* ── Row 1: Title + CSV ─────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <PageTitle sans="Minhas" serif="Transações"/>
        <button onClick={exportCSV}
          style={{ ...G, display:"flex", alignItems:"center", gap:5, background:T.surface,
            border:`1px solid ${T.border}`, borderRadius:9, padding:"8px 13px",
            fontSize:12, fontWeight:600, color:T.inkMid, cursor:"pointer", flexShrink:0 }}>
          <Download size={13}/> CSV
        </button>
      </div>

      {/* ── Row 2: Search + filter buttons ─────────────────────────── */}
      <div style={{ display:"flex", gap:8 }}>

        {/* Search */}
        <div style={{ flex:1, display:"flex", alignItems:"center", gap:8,
          background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"9px 14px" }}>
          <Search size={14} color={T.inkMid}/>
          <input value={search} onChange={e=>{setSearch(e.target.value);setVisible(PAGE_SIZE);}}
            placeholder="Buscar por descrição, categoria ou tag…"
            style={{ ...G, flex:1, minWidth:0, border:"none", outline:"none",
              background:"transparent", fontSize:13, color:T.ink }}/>
          {search && <button onClick={()=>setSearch("")} style={{ background:"none", border:"none",
            cursor:"pointer", padding:2, display:"flex" }}><X size={12} color={T.inkLight}/></button>}
        </div>

        {isMobile ? (
          /* ── MOBILE: single "Filtros" button → bottom sheet ── */
          <button onClick={()=>{ setFiltersOpen(true); setSnapFull(false); }}
            style={{ ...G, display:"flex", alignItems:"center", gap:6, padding:"9px 13px",
              background: (activeChips.length > 0) ? T.ink : T.surface,
              color:       (activeChips.length > 0) ? "#fff" : T.inkMid,
              border:`1px solid ${activeChips.length > 0 ? T.ink : T.border}`,
              borderRadius:10, fontSize:12, fontWeight:700, cursor:"pointer", flexShrink:0 }}>
            <SlidersHorizontal size={14}/>
            {activeChips.length > 0 && (
              <span style={{ background:"#fff", color:T.ink, borderRadius:"50%",
                width:18, height:18, fontSize:11, fontWeight:800, display:"flex",
                alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {activeChips.length}
              </span>
            )}
          </button>
        ) : (
          /* ── DESKTOP: individual dropdowns ── */
          <>
            {/* Period picker */}
            <div style={{ position:"relative", flexShrink:0 }}>
              <button onClick={()=>{setPeriodOpen(o=>!o);setSortOpen(false);setFiltersOpen(false);}}
                style={{ ...G, display:"flex", alignItems:"center", gap:6, padding:"9px 13px",
                  background: period !== TRANSACTIONS_DEFAULT_PERIOD ? T.ink : T.surface,
                  color:       period !== TRANSACTIONS_DEFAULT_PERIOD ? "#fff"  : T.inkMid,
                  border:`1px solid ${period !== TRANSACTIONS_DEFAULT_PERIOD ? T.ink : T.border}`,
                  borderRadius:10, fontSize:12, fontWeight:700, cursor:"pointer",
                  whiteSpace:"nowrap", transition:"all 0.15s" }}>
                <Calendar size={13}/>
                {period==="custom" && customFrom
                  ? `${new Date(customFrom+"T00:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})}${customTo?" → "+new Date(customTo+"T00:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short"}):" →…"}`
                  : PERIOD_LABELS[period] || "Período"}
              </button>
              {periodOpen && (
                <>
                <div onClick={()=>setPeriodOpen(false)} style={{ position:"fixed", inset:0, zIndex:199 }}/>
                <div style={{ position:"absolute", top:"calc(100% + 8px)", right:0, zIndex:200,
                  background:T.surface, border:`1px solid ${T.border}`, borderRadius:16,
                  boxShadow: FINCLA_CALENDAR_SHADOW,
                  minWidth:300, overflow:"hidden", animation:"fadeIn 0.14s ease" }}>
                  <div style={{ padding:"14px 14px 10px", borderBottom:`1px solid ${T.border}` }}>
                    <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid,
                      textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Intervalo rápido</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                      {[["tudo","Todo período"],["hoje","Hoje"],["semana","Esta semana"],
                        ["mes","Este mês"],["mes-ant","Mês anterior"],["3m","Últimos 3m"],["ano","Este ano"]
                      ].map(([key,label])=>(
                        <button key={key}
                          onClick={()=>{ setPeriod(key); setCustomFrom(""); setCustomTo(""); setVisible(PAGE_SIZE); setPeriodOpen(false); }}
                          style={{ ...G, display:"flex", alignItems:"center", gap:5, padding:"5px 11px", borderRadius:99, fontSize:12, fontWeight:600,
                            cursor:"pointer", transition:"all 0.13s",
                            border:`1.5px solid ${period===key ? T.ink : T.border}`,
                            background: period===key ? T.ink : "none",
                            color: period===key ? "#fff" : T.inkMid }}>
                          {period===key && <Check size={10} color="#fff"/>}
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <PeriodCalendar
                    period={period} setPeriod={setPeriod}
                    customFrom={customFrom} setCustomFrom={setCustomFrom}
                    customTo={customTo}     setCustomTo={setCustomTo}
                    setVisible={setVisible} PAGE_SIZE={PAGE_SIZE}
                    onClose={()=>setPeriodOpen(false)}
                  />
                </div>
                </>
              )}
            </div>

            {/* Sort */}
            <div style={{ position:"relative", flexShrink:0 }}>
              <button onClick={()=>{setSortOpen(o=>!o);setPeriodOpen(false);setFiltersOpen(false);}}
                style={{ ...G, display:"flex", alignItems:"center", gap:6, padding:"9px 13px",
                  background: sortBy!=="date-desc" ? T.ink : T.surface,
                  color:       sortBy!=="date-desc" ? "#fff"  : T.inkMid,
                  border:`1px solid ${sortBy!=="date-desc" ? T.ink : T.border}`,
                  borderRadius:10, fontSize:12, fontWeight:700, cursor:"pointer",
                  whiteSpace:"nowrap", transition:"all 0.15s" }}>
                <ArrowUpDown size={13}/>
                {sortBy==="date-desc" ? "Ordenar" : SORT_LABELS[sortBy].split("(")[0].trim()}
              </button>
              {sortOpen && (
                <>
                <div onClick={()=>setSortOpen(false)} style={{ position:"fixed", inset:0, zIndex:199 }}/>
                <div style={{ position:"absolute", top:"calc(100% + 6px)", right:0, zIndex:200,
                  background:T.surface, border:`1px solid ${T.border}`, borderRadius:14,
                  boxShadow:T.lg, minWidth:220, overflow:"hidden", animation:"fadeIn 0.12s ease" }}>
                  <div style={{ padding:"10px 12px 4px", ...G, fontSize:10, fontWeight:700,
                    color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.07em" }}>Ordenação</div>
                  {Object.entries(SORT_LABELS).map(([key,label])=>(
                    <button key={key} onClick={()=>{ setSortBy(key); setSortOpen(false); setVisible(PAGE_SIZE); }}
                      style={{ ...G, display:"flex", alignItems:"center", justifyContent:"space-between",
                        width:"100%", textAlign:"left", padding:"9px 14px",
                        background:sortBy===key?`${T.ink}08`:"none", border:"none",
                        color:sortBy===key?T.ink:T.inkMid, fontWeight:sortBy===key?700:400,
                        fontSize:13, cursor:"pointer",
                        borderLeft:sortBy===key?`3px solid ${T.ink}`:"3px solid transparent" }}>
                      <span>{label}</span>
                      {sortBy===key && <Check size={13} color={T.ink}/>}
                    </button>
                  ))}
                </div>
                </>
              )}
            </div>

            {/* Advanced filters */}
            <button onClick={()=>{setFiltersOpen(o=>!o);setPeriodOpen(false);setSortOpen(false);}}
              style={{ ...G, display:"flex", alignItems:"center", gap:6, padding:"9px 13px",
                background: [filterType!=="todos",filterCat!=="todas",filterMethod!=="todos"].some(Boolean) ? T.ink : T.surface,
                color: [filterType!=="todos",filterCat!=="todas",filterMethod!=="todos"].some(Boolean) ? "#fff" : T.inkMid,
                border:`1px solid ${[filterType!=="todos",filterCat!=="todas",filterMethod!=="todos"].some(Boolean)?T.ink:T.border}`,
                borderRadius:10, fontSize:12, fontWeight:700, cursor:"pointer", flexShrink:0, transition:"all 0.15s" }}>
              <SlidersHorizontal size={13}/>
              Filtros
              {[filterType!=="todos",filterCat!=="todas",filterMethod!=="todos"].filter(Boolean).length > 0 && (
                <span style={{ background:"#fff", color:T.ink, borderRadius:"50%",
                  width:16, height:16, fontSize:10, fontWeight:800, display:"flex",
                  alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {[filterType!=="todos",filterCat!=="todas",filterMethod!=="todos"].filter(Boolean).length}
                </span>
              )}
            </button>
          </>
        )}
      </div>

      {/* ── MOBILE FILTER BOTTOM SHEET ───────────────────────────────── */}
      {isMobile && (filtersOpen || sheetClosing) && (
        <div style={{ position:"fixed", inset:0, zIndex:500, display:"flex",
          flexDirection:"column", justifyContent:"flex-end" }}
          onClick={e=>{ if(e.target===e.currentTarget) onSheetClose(); }}>
          {/* Backdrop */}
          <div onClick={onSheetClose}
            style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.45)",
              animation: sheetClosing
                ? "backdropOut 0.38s ease-in both"
                : "backdropIn 0.22s ease-out both" }}/>
          {/* Sheet */}
          <div
            ref={sheetRef}
            style={{ position:"relative", background:T.surface,
              borderRadius:"24px 24px 0 0",
              maxHeight: snapFull ? "92dvh" : "72dvh",
              transition: "max-height 0.38s cubic-bezier(0.32,0.72,0,1)",
              display:"flex", flexDirection:"column",
              animation: sheetClosing
                ? "sheetDown 0.38s cubic-bezier(0.32,0.72,0,1) both"
                : "sheetUp 0.5s cubic-bezier(0.32,0.72,0,1) both",
              willChange:"transform",
              boxShadow:"0 -2px 0 rgba(0,0,0,0.05), 0 -8px 32px rgba(0,0,0,0.14), 0 -24px 80px rgba(0,0,0,0.08)" }}>
            {/* Handle — ONLY drag zone. Touch here = dismiss/expand. Content scroll is unaffected. */}
            <div
              onTouchStart={onSheetTouchStart}
              style={{ padding:"12px 0 8px", flexShrink:0, cursor:"grab", userSelect:"none",
                touchAction:"none", display:"flex", flexDirection:"column",
                alignItems:"center", gap:4,
                minHeight:44 }}>
              <div style={{ width:36, height:4, borderRadius:99,
                background:"rgba(0,0,0,0.18)" }}/>
              <div style={{ fontSize:7, color:"rgba(0,0,0,0.2)", lineHeight:1,
                letterSpacing:1, userSelect:"none" }}>
                {snapFull ? "▼" : "▲"}
              </div>
            </div>
            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"4px 20px 10px", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
              <div style={{ ...G, fontSize:16, fontWeight:800, color:T.ink }}>Filtros</div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                {activeChips.length > 0 && (
                  <button onClick={clearAll}
                    style={{ ...G, background:T.redLight, border:"none", cursor:"pointer",
                      fontSize:12, color:T.red, fontWeight:700, padding:"6px 12px",
                      borderRadius:8 }}>
                    Limpar tudo
                  </button>
                )}
                <button onClick={onSheetClose}
                  style={{ background:"none", border:"none", cursor:"pointer", padding:6,
                    borderRadius:8, display:"flex" }}>
                  <X size={18} color={T.inkMid}/>
                </button>
              </div>
            </div>
            {/* Scrollable content */}
            <div style={{ overflowY:"auto", flex:1, padding:"0 0 16px",
              overscrollBehavior:"contain" }}>

              {/* ── PERÍODO ── */}
              <div style={{ padding:"16px 20px 0" }}>
                <div style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid,
                  textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Período</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
                  {[["tudo","Todo período"],["hoje","Hoje"],["semana","Esta semana"],
                    ["mes","Este mês"],["mes-ant","Mês anterior"],["3m","Últimos 3m"],["ano","Este ano"]
                  ].map(([key,label])=>(
                    <button key={key}
                      onClick={()=>{ setPeriod(key); setCustomFrom(""); setCustomTo(""); setVisible(PAGE_SIZE); }}
                      style={{ ...G, display:"flex", alignItems:"center", gap:5,
                        padding:"8px 14px", borderRadius:99, fontSize:13, fontWeight:600,
                        cursor:"pointer", transition:"all 0.13s",
                        border:`1.5px solid ${period===key ? T.ink : T.border}`,
                        background: period===key ? T.ink : T.surface,
                        color: period===key ? "#fff" : T.inkMid }}>
                      {period===key && <Check size={11} color="#fff"/>}
                      {label}
                    </button>
                  ))}
                  <button
                    onClick={()=>setPeriod("custom")}
                    style={{ ...G, display:"flex", alignItems:"center", gap:5,
                      padding:"8px 14px", borderRadius:99, fontSize:13, fontWeight:600,
                      cursor:"pointer", transition:"all 0.13s",
                      border:`1.5px solid ${period==="custom" ? T.ink : T.border}`,
                      background: period==="custom" ? T.ink : T.surface,
                      color: period==="custom" ? "#fff" : T.inkMid }}>
                    {period==="custom" && <Check size={11} color="#fff"/>}
                    Personalizado
                  </button>
                </div>
                {/* Custom date pickers — inline when custom selected */}
                {period==="custom" && (
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12,
                    padding:"14px", background:T.bg, borderRadius:12, border:`1px solid ${T.border}` }}>
                    <div>
                      <div style={{ ...G, fontSize:11, color:T.inkMid, fontWeight:600, marginBottom:6 }}>De</div>
                      <input type="date" value={customFrom}
                        onChange={e=>{setCustomFrom(e.target.value);setVisible(PAGE_SIZE);}}
                        style={{ ...G, width:"100%", padding:"10px 12px", borderRadius:9,
                          border:`1px solid ${T.border}`, fontSize:13, color:T.ink,
                          background:T.surface, outline:"none" }}/>
                    </div>
                    <div>
                      <div style={{ ...G, fontSize:11, color:T.inkMid, fontWeight:600, marginBottom:6 }}>Até</div>
                      <input type="date" value={customTo}
                        onChange={e=>{setCustomTo(e.target.value);setVisible(PAGE_SIZE);}}
                        style={{ ...G, width:"100%", padding:"10px 12px", borderRadius:9,
                          border:`1px solid ${T.border}`, fontSize:13, color:T.ink,
                          background:T.surface, outline:"none" }}/>
                    </div>
                  </div>
                )}
              </div>

              {/* ── ORDENAÇÃO ── */}
              <div style={{ padding:"16px 20px 0" }}>
                <div style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid,
                  textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Ordenação</div>
                <div style={{ background:T.surface, borderRadius:12,
                  border:`1px solid ${T.border}`, overflow:"hidden" }}>
                  {Object.entries(SORT_LABELS).map(([key,label],i)=>(
                    <button key={key}
                      onClick={()=>{ setSortBy(key); setVisible(PAGE_SIZE); }}
                      style={{ ...G, display:"flex", alignItems:"center", justifyContent:"space-between",
                        width:"100%", padding:"14px 16px", border:"none",
                        borderTop: i>0 ? `1px solid ${T.border}` : "none",
                        background: sortBy===key ? `${T.ink}06` : T.surface,
                        color: sortBy===key ? T.ink : T.inkMid,
                        fontWeight: sortBy===key ? 700 : 400,
                        fontSize:14, cursor:"pointer",
                        borderLeft: sortBy===key ? `3px solid ${T.ink}` : "3px solid transparent" }}>
                      {label}
                      {sortBy===key && <Check size={15} color={T.ink}/>}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── TIPO ── */}
              <div style={{ padding:"16px 20px 0" }}>
                <div style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid,
                  textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Tipo</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                  {[["todos","Todos"],["receita","↑ Receita"],["despesa","↓ Despesa"]].map(([v,l])=>(
                    <button key={v} onClick={()=>{setFilterType(v);setVisible(PAGE_SIZE);}}
                      style={{ ...G, padding:"12px 0", borderRadius:10,
                        border:`1.5px solid ${filterType===v ? T.ink : T.border}`,
                        background: filterType===v ? T.ink : T.surface,
                        color: filterType===v ? "#fff" : T.inkMid,
                        fontSize:13, fontWeight:700, cursor:"pointer" }}>{l}</button>
                  ))}
                </div>
              </div>

              {/* ── MÉTODO ── */}
              <div style={{ padding:"16px 20px 0" }}>
                <div style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid,
                  textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Método</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {["todos",...ALL_METHODS].map(m=>(
                    <button key={m}
                      onClick={()=>{setFilterMethod(m);setVisible(PAGE_SIZE);}}
                      style={{ ...G, padding:"10px 16px", borderRadius:99, fontSize:13, fontWeight:600,
                        cursor:"pointer",
                        border:`1.5px solid ${filterMethod===m ? T.ink : T.border}`,
                        background: filterMethod===m ? T.ink : T.surface,
                        color: filterMethod===m ? "#fff" : T.inkMid }}>
                      {m==="todos" ? "Todos" : m}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── CATEGORIA ── */}
              <div style={{ padding:"16px 20px 0" }}>
                <div style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid,
                  textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Categoria</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {[{ value: "todas", label: "Todas" }, ...ALL_CAT_CHIPS].map((row)=>(
                    <button key={row.value}
                      onClick={()=>{setFilterCat(row.value);setVisible(PAGE_SIZE);}}
                      style={{ ...G, padding:"10px 16px", borderRadius:99, fontSize:13, fontWeight:600,
                        cursor:"pointer",
                        border:`1.5px solid ${filterCat===row.value ? (row.value==="todas" ? T.ink : catColorForChip(row)) : T.border}`,
                        background: filterCat===row.value ? (row.value==="todas" ? T.ink : catBgForChip(row)) : T.surface,
                        color: filterCat===row.value ? (row.value==="todas" ? "#fff" : catColorForChip(row)) : T.inkMid }}>
                      {row.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>
            {/* Footer CTA — safe area aware */}
            <div style={{ padding:"12px 20px", paddingBottom:"calc(12px + env(safe-area-inset-bottom, 0px))",
              borderTop:`1px solid ${T.border}`, background:T.surface, flexShrink:0 }}>
              <button onClick={onSheetClose}
                style={{ ...G, width:"100%", background:T.ink, color:"#fff",
                  border:"none", borderRadius:12, padding:"15px",
                  fontSize:15, fontWeight:800, cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                Ver {filteredCount} transaç{filteredCount!==1?"ões":"ão"}
              </button>
            </div>
          </div>
        </div>
      )}

            {/* ── Row 3: Advanced filter panel (desktop only) ────────── */}
      {!isMobile && filtersOpen && <FilterBar/>}

      {/* ── Row 4: Active filter chips ───────────────────────────── */}
      {activeChips.length > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
          <span style={{ ...G, fontSize:11, color:T.inkMid, fontWeight:600, flexShrink:0 }}>Filtros:</span>
          {activeChips.map(chip => (
            <span key={chip.key} style={{ display:"flex", alignItems:"center", gap:5,
              background:T.ink, color:"#fff", borderRadius:99, padding:"4px 10px 4px 12px",
              fontSize:12, fontWeight:600, animation:"fadeIn 0.15s ease" }}>
              <span style={{ ...G }}>{chip.label}</span>
              <button onClick={chip.onRemove}
                style={{ background:"rgba(255,255,255,0.25)", border:"none", cursor:"pointer",
                  borderRadius:"50%", width:16, height:16, display:"flex",
                  alignItems:"center", justifyContent:"center", padding:0, flexShrink:0 }}>
                <X size={9} color="#fff"/>
              </button>
            </span>
          ))}
          <button onClick={clearAll}
            style={{ ...G, background:"none", border:"none", cursor:"pointer",
              fontSize:11, color:T.red, fontWeight:700, padding:"4px 8px",
              borderRadius:8, flexShrink:0 }}>
            Limpar tudo
          </button>
        </div>
      )}

      {/* ── Row 5: KPI strip ─────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: isMobile ? 8 : 12 }}>
        {[
          { label:"Receitas", val:totalReceita, color:T.green, bg:T.greenLight },
          { label:"Despesas", val:totalDespesa, color:T.red,   bg:T.redLight   },
          { label:"Saldo",    val:saldo,         color:saldo>=0?T.green:T.red, bg:saldo>=0?T.greenLight:T.redLight },
        ].map(k=>(
          <div key={k.label} style={{ background:T.surface, border:`1px solid ${T.border}`,
            borderRadius:12, padding: isMobile ? "12px 14px" : "14px 18px",
            gridColumn: isMobile && k.label==="Saldo" ? "1 / -1" : "auto" }}>
            <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid,
              textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:5 }}>{k.label}</div>
            <div style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize: isMobile?14:16,
              fontWeight:800, color:k.color, letterSpacing:"-0.01em" }}>
              {k.label==="Saldo"&&saldo<0?"−":"+"}{fmtBRL(k.val)}
            </div>
            <div style={{ ...G, fontSize:10, color:T.inkLight, marginTop:3 }}>
              {filteredCount} transaç{filteredCount!==1?"ões":"ão"}
            </div>
          </div>
        ))}
      </div>

            {/* List + Detail panel */}
      {isMobile ? (
        /* Mobile: list full width, detail as bottom sheet */
        <>
          {listContent}
          {selected && (
            <div
              style={{ position:"fixed", inset:0, zIndex:400,
                display:"flex", flexDirection:"column", justifyContent:"flex-end" }}
              onClick={e=>{ if(e.target===e.currentTarget) setSelected(null); }}>
              {/* Backdrop */}
              <div onClick={()=>setSelected(null)}
                style={{ position:"absolute", inset:0,
                  background:"rgba(0,0,0,0.45)",
                  animation:"backdropIn 0.22s ease-out both" }}/>
              {/* Sheet */}
              <div style={{ position:"relative", background:T.surface,
                borderRadius:"24px 24px 0 0",
                height:"85dvh", display:"flex", flexDirection:"column",
                animation:"sheetUp 0.5s cubic-bezier(0.32,0.72,0,1) both",
                boxShadow:"0 -2px 0 rgba(0,0,0,0.05), 0 -8px 32px rgba(0,0,0,0.14), 0 -24px 80px rgba(0,0,0,0.08)" }}
                id="tx-detail-sheet">
                {/* Handle — drag down to dismiss */}
                <div
                  onTouchStart={e => {
                    const sheet  = document.getElementById('tx-detail-sheet');
                    const startY = e.touches[0].clientY;
                    const startT = Date.now();
                    let last = 0;
                    const mv = ev => {
                      last = ev.touches[0].clientY - startY;
                      if (last > 0) sheet.style.transform = `translateY(${last}px)`;
                    };
                    const up = () => {
                      const vel = last / Math.max(1, Date.now() - startT);
                      sheet.style.transition = 'transform 0.34s cubic-bezier(0.22,1,0.36,1)';
                      if (vel > 0.45 || last > sheet.offsetHeight * 0.3) {
                        sheet.style.transform = 'translateY(110%)';
                        setTimeout(() => { setSelected(null); sheet.style.transform=''; sheet.style.transition=''; }, 340);
                      } else {
                        sheet.style.transform = '';
                        setTimeout(() => sheet.style.transition = '', 340);
                      }
                      document.removeEventListener('touchmove', mv);
                      document.removeEventListener('touchend', up);
                    };
                    document.addEventListener('touchmove', mv, { passive: true });
                    document.addEventListener('touchend', up);
                  }}
                  style={{ padding:"12px 0 6px", flexShrink:0, cursor:"grab",
                    touchAction:"none", display:"flex", justifyContent:"center" }}>
                  <div style={{ width:36, height:4, borderRadius:99, background:"rgba(0,0,0,0.15)" }}/>
                </div>
                <DetailPanel tx={selected} onClose={()=>setSelected(null)}/>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Desktop: master-detail — flex:1 fills remaining height, list scrolls internally */
        <div style={{ display:"flex", gap:16, flex:1, minHeight:0, overflow:"hidden" }}>
          {/* List — scrolls internally */}
          <div
            ref={listScrollRef}
            style={{ flex:1, minWidth:0, overflowY:"auto", overflowX:"hidden" }}
          >
            {listContent}
          </div>
          {/* Detail panel — fixed width, fills full height of this zone */}
          {selected && (
            <div style={{ width:320, flexShrink:0, display:"flex", flexDirection:"column",
              background:T.surface, border:`1px solid ${T.border}`, borderRadius:16,
              overflow:"hidden", boxShadow:"0 4px 24px rgba(0,0,0,0.08)",
              animation:"fadeIn 0.15s ease" }}>
              <DetailPanel tx={selected} onClose={()=>setSelected(null)}/>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
