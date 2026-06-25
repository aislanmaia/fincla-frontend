import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { T } from "../tokens";
import { G } from "../typography";
import { DragScrollTabs } from "../layouts/DragScrollTabs.jsx";
import { useCreditCardsData } from "../features/creditCards/useCreditCardsData.js";
import { CardFormSheet } from "../features/creditCards/CardFormSheet.jsx";
import { KpiStrip } from "../features/creditCards/cartoesPanels.jsx";
import { CardsPageModals } from "../features/creditCards/CartoesPageModals.jsx";
import { InvoiceTab } from "../features/creditCards/CartoesFaturaTab.jsx";
import { CardsPageHeader } from "../features/creditCards/CardsPageHeader.jsx";
import { CardsInvoiceHeader } from "../features/creditCards/CardsInvoiceHeader.jsx";
import { CardsCarousel } from "../features/creditCards/CardsCarousel.jsx";
import {
  AnalyticsTab,
  HistoryTab,
  InstallmentsTab,
  PlanningTab,
  RecurringTab,
} from "../features/creditCards/CartoesTabs.jsx";
import { shouldUseRealData as shouldUseRealDataForMode } from "../dataMode.js";
import { FC } from "../routing/searchContract.js";
import {
  CARTOES_DATA,
  CAT_COLORS_CARD,
} from "../data/creditCardsMockData.js";
import {
  buildCreateCreditCardPayload,
  buildUpdateCreditCardPayload,
  defaultFaturaIndexForCard,
  faturaIdxAfterCardsRefresh,
  faturaIdxMatchingInvoiceRef,
  fetchPastInvoiceItemsForUi,
  CARD_BRAND_OPTIONS,
  matchBrandToSelectOption,
  formatLimitInputFromNumber,
  safePctOrFallback as safe,
} from "../data/creditCardsAdapter.js";

export const CartoesPage = ({
  onNav,
  isMobile = false,
  onNewItem,
  onLaunchRefund = null,
  onOpenTransaction = null,
  onTransactionsInvalidate = null,
  cards: cardsProp,
  dataMode = "mock",
  organizationId = null,
  transactionsRefreshToken = 0,
}) => {
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
  const [cardId,             setCardId]             = useState(() => (cardsProp && cardsProp.length > 0 ? cardsProp[0].id : "nubank"));
  const [tab,                setTab]                = useState("invoice");
  const [invoiceIdx,         setInvoiceIdx]         = useState(5);
  const invoiceIdxRef = useRef(invoiceIdx);
  const prevCardsSnapshotRef = useRef(null);
  invoiceIdxRef.current = invoiceIdx;
  const [search,             setSearch]             = useState("");
  const [filterCategory,     setFilterCategory]     = useState(null);
  const [expandedDate,       setExpandedDate]       = useState(null);
  const [installmentModal,   setInstallmentModal]   = useState(null);
  const [installmentTarget,  setInstallmentTarget]  = useState(null);
  const [installmentSaved,   setInstallmentSaved]   = useState(false);
  const [deleteItemModal,    setDeleteItemModal]    = useState(null);
  const [markedPaid,         setMarkedPaid]         = useState({});
  const [markingPaid,        setMarkingPaid]        = useState(false);
  const [exportModalOpen,    setExportModalOpen]    = useState(false);
  const [exportCategories,   setExportCategories]   = useState({});
  const [exportInstallments, setExportInstallments] = useState(true);
  const [exportRecurring,    setExportRecurring]    = useState(true);
  const [exportOneTime,      setExportOneTime]      = useState(true);
  const [addCardSheet,       setAddCardSheet]       = useState(false);
  const [editCardSheet,      setEditCardSheet]      = useState(false);
  const [editingCardId,      setEditingCardId]      = useState(null);
  const [visibleGroups,      setVisibleGroups]      = useState(8); // pagination
  const [draftIssuer,        setDraftIssuer]        = useState("");
  const [draftName,          setDraftName]          = useState("");
  const [draftLast4,         setDraftLast4]         = useState("");
  const [draftBrand,         setDraftBrand]         = useState("Visa");
  const [draftLimit,         setDraftLimit]         = useState("");
  const [draftDueDay,        setDraftDueDay]        = useState("");
  const [draftClosingDay,    setDraftClosingDay]    = useState("");
  const [draftSuccess,       setDraftSuccess]       = useState(false);
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
      setInvoiceIdx(
        faturaIdxAfterCardsRefresh(nextCard, prevCards, invoiceIdxRef.current),
      );
    } else if (fixCardId || firstSync) {
      setInvoiceIdx(defaultFaturaIndexForCard(nextCard.faturas || []));
    }

    prevCardsSnapshotRef.current = CARDS;
  }, [CARDS, cardId]);

  const card =
    CARDS.length > 0 ? (CARDS.find((c) => c.id === cardId) || CARDS[0]) : null;
  // Sentinel para cartões sem histórico de fatura (ex.: cartão recém-onboarded)
  const EMPTY_INVOICE = { id:"empty", mes:"—", val:0, pago:false, venc:"—", atual:true };
  const invoices       = card?.faturas || [];
  const invoice        = invoices.length > 0
    ? (invoices[invoiceIdx] ?? invoices[invoices.length-1])
    : EMPTY_INVOICE;
  const previousInvoice = invoiceIdx > 0 ? invoices[invoiceIdx-1] : null;
  const nextInvoice     = invoiceIdx < invoices.length-1 ? invoices[invoiceIdx+1] : null;
  const isCurrent       = !!invoice?.atual;
  const isPaid          = markedPaid[invoice?.id] || invoice?.pago;

  const usagePercent = card ? safe(card.limite - card.disponivel, card.limite) : 0;
  const usageColor   = usagePercent >= 90 ? T.red : usagePercent >= 70 ? T.amber : T.green;
  const averageValue = invoices.length > 0 ? Math.round(invoices.reduce((s,f) => s+f.val, 0) / invoices.length) : 0;
  const diffPercent  = previousInvoice && previousInvoice.val > 0
    ? Math.round((((invoice?.val||0)||0) - previousInvoice.val) / previousInvoice.val * 100)
    : 0;

  const formatBRL = v => "R$ " + Math.abs(v).toLocaleString("pt-BR",{minimumFractionDigits:2});
  const formatK   = v => Math.abs(v)>=1000 ? (Math.abs(v)/1000).toFixed(1)+"k" : String(Math.abs(v));

  const switchCard = (id) => {
    const fromCard = CARDS.find((x) => x.id === cardId) || CARDS[0];
    const fromList = fromCard?.faturas || [];
    const viewedInvoice = fromList[invoiceIdx];

    setCardId(id);
    const c = CARDS.find((x) => x.id === id) || CARDS[0];
    setInvoiceIdx(faturaIdxMatchingInvoiceRef(c?.faturas || [], viewedInvoice));
    setSearch(""); setFilterCategory(null); setTab("invoice"); setVisibleGroups(8);
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

  useEffect(() => { setVisibleGroups(8); }, [cardId, filterCategory, search, invoiceIdx]);

  // Itens de faturas anteriores (busca sob demanda ao navegar entre meses)
  const [pastItems,        setPastItems]        = useState([]);
  const [pastItemsLoading, setPastItemsLoading] = useState(false);

  useEffect(() => {
    if (isCurrent || !shouldUseRealData || !card || !invoice?.year || !invoice?.month || !organizationId) {
      setPastItems([]);
      setPastItemsLoading(false);
      return;
    }
    let cancelled = false;
    setPastItemsLoading(true);
    fetchPastInvoiceItemsForUi(card.cardId, invoice.year, invoice.month, organizationId)
      .then((items) => { if (!cancelled) setPastItems(items); })
      .catch(() => { if (!cancelled) setPastItems([]); })
      .finally(() => { if (!cancelled) setPastItemsLoading(false); });
    return () => { cancelled = true; };
  }, [
    isCurrent,
    shouldUseRealData,
    card?.cardId,
    invoice?.year,
    invoice?.month,
    organizationId,
    transactionsRefreshToken,
  ]);

  // Safe aliases — guard against empty onboarding card
  const cardInvoices     = invoices;
  const cardItems        = card?.itens           || [];
  const cardInstallments = card?.parcelas_ativas || [];
  const cardTrend        = card?.tendencia       || [];
  const displayItems     = isCurrent ? cardItems : pastItems;
  const recurringItems   = displayItems.filter(i => i.rec);
  const recurringTotal   = recurringItems.reduce((s,i) => s+i.val, 0);
  // Total comprometido em parcelas futuras (LÍQUIDO — descontando estornos).
  // Usa `card.limite − card.disponivel` que reflete o `used_limit` do backend,
  // já calculado como (Σ parcelas futuras − Σ estornos futuros), clamp em 0.
  const grossInstallmentsTotal = cardInstallments.reduce((s,p) => s+p.vParcela*(p.total-p.pago), 0);
  const totalRefunds           = cardInstallments.reduce(
    (s,p) => s + (p.refundsSummary ? Number(p.refundsSummary.totalValue) : 0),
    0,
  );
  const totalInstallments       = Math.max(0, grossInstallmentsTotal - totalRefunds);
  const hasRefundedInstallments = totalRefunds > 0;

  const categoryColor = (it) => it.catColor || CAT_COLORS_CARD[it.cat] || T.inkMid;

  const invoiceFilterChips = useMemo(() => {
    const m = new Map();
    displayItems.forEach((it) => {
      if (m.has(it.cat)) return;
      m.set(it.cat, categoryColor(it));
    });
    return Array.from(m.entries());
  }, [displayItems]);

  const TODAY_DAY = 18;
  const projection =
    card && isCurrent && TODAY_DAY > 0 && ((invoice?.val || 0) || 0) > 0
      ? Math.round(
          (((invoice?.val || 0) || 0) / TODAY_DAY) *
            (card.vencimento > card.fechamento
              ? card.vencimento - card.fechamento
              : 30 + card.vencimento - card.fechamento),
        )
      : 0;
  const projectionRisk = (card?.disponivel||0) > 0 && projection > (card.disponivel + ((invoice?.val||0)||0));

  const filtered = useMemo(() => {
    let items = displayItems;
    if (filterCategory) items = items.filter(i => i.cat === filterCategory);
    if (search)         items = items.filter(i =>
      i.desc.toLowerCase().includes(search.toLowerCase()) ||
      i.cat.toLowerCase().includes(search.toLowerCase()));
    return items;
  }, [displayItems, filterCategory, search]);

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

  const categoryTotals = useMemo(() => {
    const map = {};
    const colorByCat = {};
    displayItems.forEach((i) => {
      map[i.cat] = (map[i.cat] || 0) + i.val;
      if (colorByCat[i.cat] == null) colorByCat[i.cat] = categoryColor(i);
    });
    const total = displayItems.reduce((s,i)=>s+i.val,0);
    return Object.entries(map)
      .sort((a,b) => b[1]-a[1])
      .map(([cat,val]) => ({
        cat, val,
        pct: total > 0 ? Math.round(val/total*100) : 0,
        color: colorByCat[cat] || T.inkMid,
      }));
  }, [displayItems]);

  // Alertas por categoria: cresceram >20% vs mês anterior
  const categoryAlerts = useMemo(() => {
    if (!cardTrend || cardTrend.length < 2) return [];
    const last = cardTrend.length > 0 ? cardTrend[cardTrend.length-1] : null;
    const prev = cardTrend[cardTrend.length-2];
    return Object.entries(last)
      .filter(([cat,val]) => cat!=="mes" && prev[cat]>0 && val>prev[cat] && ((val-prev[cat])/prev[cat])>0.15)
      .map(([cat,val]) => ({ cat, val, prev:prev[cat], pct:Math.round((val-prev[cat])/prev[cat]*100) }))
      .sort((a,b)=>b.pct-a.pct)
      .slice(0,3);
  }, [card]);

  const closeDeleteItemModal = useCallback(() => {
    if (creditCardsData.isDeletingInvoiceItem) return;
    setDeleteItemModal(null);
  }, [creditCardsData.isDeletingInvoiceItem]);

  const handleDeleteInvoiceItem = useCallback(async () => {
    if (!deleteItemModal?.transactionId) return;
    if (shouldUseRealData) {
      try {
        await creditCardsData.deleteInvoiceItem(deleteItemModal.transactionId);
        onTransactionsInvalidate?.();
      } catch {
        return;
      }
    }
    setDeleteItemModal(null);
  }, [creditCardsData, deleteItemModal?.transactionId, onTransactionsInvalidate, shouldUseRealData]);

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
        <CardFormSheet
          open={cardSheetOpen}
          isMobile={isMobile}
          isEdit={editCardSheet}
          draftIssuer={draftIssuer}
          setDraftIssuer={setDraftIssuer}
          draftName={draftName}
          setDraftName={setDraftName}
          draftLast4={draftLast4}
          setDraftLast4={setDraftLast4}
          draftBrand={draftBrand}
          setDraftBrand={setDraftBrand}
          draftLimit={draftLimit}
          setDraftLimit={setDraftLimit}
          draftDueDay={draftDueDay}
          setDraftDueDay={setDraftDueDay}
          draftClosingDay={draftClosingDay}
          setDraftClosingDay={setDraftClosingDay}
          draftSuccess={draftSuccess}
          saving={editCardSheet ? creditCardsData.isUpdatingCard : creditCardsData.isSavingCard}
          error={creditCardsData.error}
          onSave={handleSaveCard}
          onUpdate={handleUpdateCard}
          onCancel={clearCardFormState}
        />
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

  const handleMarkPaid = async () => {
    if (shouldUseRealData && invoice?.year && invoice?.month) {
      setMarkingPaid(true);
      try {
        await creditCardsData.markInvoicePaid({
          cardId: card.cardId,
          year: invoice.year,
          month: invoice.month,
          organizationId,
        });
      } catch {
        setMarkingPaid(false);
        return;
      }
      setMarkingPaid(false);
      return;
    }

    setMarkingPaid(true);
    setTimeout(()=>{ setMarkingPaid(false); setMarkedPaid(m=>({...m,[invoice?.id]:true})); }, 800);
  };

  const handleReallocate = async () => {
    if (shouldUseRealData && installmentModal?.transactionId && installmentTarget) {
      const target = parseFutureLabel(installmentTarget);
      if (!target) return;
      try {
        await creditCardsData.moveInstallment({
          cardId: card.cardId,
          transactionId: installmentModal.transactionId,
          organizationId,
          targetYear: target.year,
          targetMonth: target.month,
        });
      } catch {
        return;
      }
    }

    setInstallmentSaved(true);
    setTimeout(()=>{ setInstallmentSaved(false); setInstallmentModal(null); setInstallmentTarget(null); }, 1100);
  };

  const handleExportCSV = () => {
    let rows = ["Descrição,Categoria,Valor,Data,Parcela,Recorrente"];
    let items = displayItems;
    const activeCats = Object.entries(exportCategories).filter(([,v])=>v).map(([k])=>k);
    if (activeCats.length>0)  items = items.filter(i=>activeCats.includes(i.cat));
    if (!exportInstallments)  items = items.filter(i=>!i.parcela);
    if (!exportRecurring)     items = items.filter(i=>!i.rec);
    if (!exportOneTime)       items = items.filter(i=>i.rec||i.parcela);
    items.forEach(i => rows.push(
      `"${i.desc}","${i.cat}","${i.val.toFixed(2).replace(".",",")}","${i.data}","${i.parcela?`${i.parcela.n}/${i.parcela.t}`:"-"}","${i.rec?"Sim":"Não"}"`
    ));
    const a = Object.assign(document.createElement("a"),{
      href:URL.createObjectURL(new Blob([rows.join("\n")],{type:"text/csv"})),
      download:`fatura-${card.nome}-${invoice?.mes}.csv`
    });
    a.click(); setExportModalOpen(false);
  };

  const TABS = [
    { id: "invoice",      icon: "📋", label: "Fatura" },
    { id: "recurring",    icon: "🔄", label: "Recorrências" },
    { id: "installments", icon: "🧩", label: "Parcelas" },
    { id: "analytics",    icon: "📊", label: "Análises" },
    { id: "history",      icon: "📈", label: "Histórico" },
    { id: "planning",     icon: "📅", label: "Planejamento" },
  ];

  const modalsBundle = (
    <CardsPageModals
      isMobile={isMobile}
      card={card}
      invoice={invoice}
      formatBRL={formatBRL}
      installmentModal={installmentModal}
      installmentTarget={installmentTarget}
      setInstallmentTarget={setInstallmentTarget}
      installmentSaved={installmentSaved}
      onCloseInstallmentModal={() => { setInstallmentModal(null); setInstallmentTarget(null); }}
      onConfirmInstallment={handleReallocate}
      deleteItemModal={deleteItemModal}
      deletingInvoiceItem={creditCardsData.isDeletingInvoiceItem}
      onCloseDeleteItemModal={closeDeleteItemModal}
      onConfirmDeleteItem={handleDeleteInvoiceItem}
      exportModalOpen={exportModalOpen}
      displayItems={displayItems}
      exportCategories={exportCategories}
      setExportCategories={setExportCategories}
      exportInstallments={exportInstallments}
      setExportInstallments={setExportInstallments}
      exportRecurring={exportRecurring}
      setExportRecurring={setExportRecurring}
      exportOneTime={exportOneTime}
      setExportOneTime={setExportOneTime}
      onCloseExportModal={() => setExportModalOpen(false)}
      onExportCSV={handleExportCSV}
      cardSheetOpen={cardSheetOpen}
      editCardSheet={editCardSheet}
      draftIssuer={draftIssuer}
      setDraftIssuer={setDraftIssuer}
      draftName={draftName}
      setDraftName={setDraftName}
      draftLast4={draftLast4}
      setDraftLast4={setDraftLast4}
      draftBrand={draftBrand}
      setDraftBrand={setDraftBrand}
      draftLimit={draftLimit}
      setDraftLimit={setDraftLimit}
      draftDueDay={draftDueDay}
      setDraftDueDay={setDraftDueDay}
      draftClosingDay={draftClosingDay}
      setDraftClosingDay={setDraftClosingDay}
      draftSuccess={draftSuccess}
      savingCard={editCardSheet ? creditCardsData.isUpdatingCard : creditCardsData.isSavingCard}
      cardSheetError={creditCardsData.error}
      onSaveCard={handleSaveCard}
      onUpdateCard={handleUpdateCard}
      onCancelCardForm={clearCardFormState}
    />
  );

  const invoiceTabBundle = (variant) => (
    <InvoiceTab
      variant={variant}
      card={card} invoice={invoice} previousInvoice={previousInvoice}
      filtered={filtered} displayItems={displayItems}
      grouped={grouped} pagedGroups={pagedGroups}
      categoryTotals={categoryTotals} recurringTotal={recurringTotal}
      averageValue={averageValue} diffPercent={diffPercent}
      totalItems={totalItems} visibleItems={visibleItems} hasMoreGroups={hasMoreGroups}
      pastItemsLoading={pastItemsLoading} isCurrent={isCurrent}
      shouldUseRealData={shouldUseRealData} totalInstallments={totalInstallments}
      usagePercent={usagePercent} usageColor={usageColor} pageGroupsLimit={PAGE_GROUPS}
      formatBRL={formatBRL} categoryColor={categoryColor}
      search={search} setSearch={setSearch}
      invoiceFilterChips={invoiceFilterChips}
      filterCategory={filterCategory} setFilterCategory={setFilterCategory}
      expandedDate={expandedDate} setExpandedDate={setExpandedDate}
      visibleGroups={visibleGroups} setVisibleGroups={setVisibleGroups}
      onLaunchRefund={onLaunchRefund}
      onOpenTransaction={onOpenTransaction}
      onDeleteTransaction={setDeleteItemModal}
    />
  );

  // Bloco compartilhado entre mobile e desktop — só o `variant` interno do
  // invoiceTab muda. Mantemos `key={tab+cardId}` para forçar replay do
  // `animation:"tabIn"` quando troca de tab ou cartão.
  const tabContentBundle = (
    <div key={tab + cardId} style={{ animation: "tabIn 0.2s ease-out" }}>
      {tab === "invoice"      && invoiceTabBundle(isMobile ? "mobile" : "desktop")}
      {tab === "recurring"    && <RecurringTab recurringItems={recurringItems} recurringTotal={recurringTotal} invoice={invoice} card={card} isMobile={isMobile} formatBRL={formatBRL} categoryColor={categoryColor} onLaunchRefund={onLaunchRefund} />}
      {tab === "installments" && <InstallmentsTab cardInstallments={cardInstallments} card={card} totalInstallments={totalInstallments} totalRefunds={totalRefunds} hasRefundedInstallments={hasRefundedInstallments} isMobile={isMobile} formatBRL={formatBRL} onMoveInstallment={setInstallmentModal} />}
      {tab === "analytics"    && <AnalyticsTab cardInvoices={cardInvoices} cardTrend={cardTrend} invoice={invoice} card={card} usagePercent={usagePercent} totalInstallments={totalInstallments} totalRefunds={totalRefunds} hasRefundedInstallments={hasRefundedInstallments} categoryAlerts={categoryAlerts} averageValue={averageValue} projection={projection} cardInstallments={cardInstallments} isMobile={isMobile} formatBRL={formatBRL} formatK={formatK} />}
      {tab === "history"      && <HistoryTab cardInvoices={cardInvoices} isMobile={isMobile} formatBRL={formatBRL} />}
      {tab === "planning"     && <PlanningTab card={card} cardInstallments={cardInstallments} isMobile={isMobile} formatBRL={formatBRL} />}
    </div>
  );

  /* ══════════════════════════════════════════════════════════
     MOBILE
  ══════════════════════════════════════════════════════════ */
  if (isMobile) return (
    <>
    <div style={{display:"flex",flexDirection:"column",gap:0,paddingBottom:40}}>
      <style>{`
        @keyframes tabIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
      {modalsBundle}

      <CardsPageHeader
        variant="mobile"
        cardId={cardId}
        canEditSelectedCard={canEditSelectedCard}
        onNewItem={onNewItem}
        onEditCard={openEditCardSheet}
        onAddCard={openAddCardSheet}
      />

      <CardsCarousel
        variant="mobile"
        cards={CARDS}
        selectedCardId={cardId}
        onSwitchCard={switchCard}
        onAddCard={openAddCardSheet}
      />

      {/* Invoice summary */}
      <CardsInvoiceHeader
        variant="mobile"
        card={card} invoice={invoice} previousInvoice={previousInvoice} nextInvoice={nextInvoice}
        diffPercent={diffPercent} usagePercent={usagePercent} usageColor={usageColor}
        isCurrent={isCurrent} isPaid={isPaid} markingPaid={markingPaid}
        formatBRL={formatBRL}
        onPrevInvoice={()=>previousInvoice&&setInvoiceIdx(i=>i-1)}
        onNextInvoice={()=>nextInvoice&&setInvoiceIdx(i=>i+1)}
        onOpenExport={()=>setExportModalOpen(true)}
        onMarkPaid={handleMarkPaid}
      />

      {/* KPI Strip */}
      <div style={{marginBottom:14}}>
        <KpiStrip card={card} invoice={invoice} previousInvoice={previousInvoice} formatBRL={formatBRL}
          diffPercent={diffPercent} usageColor={usageColor} averageValue={averageValue}
          cardInvoices={cardInvoices} isMobile={isMobile}/>
      </div>

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

      {tabContentBundle}
    </div>
    </>
  );

  // ── Desktop return ───────────────────────────────────────────────────────
  return (
    <>
      <style>{`@keyframes drawerIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
      {modalsBundle}

      <CardsPageHeader
        variant="desktop"
        cardId={cardId}
        canEditSelectedCard={canEditSelectedCard}
        onNewItem={onNewItem}
        onEditCard={openEditCardSheet}
        onAddCard={openAddCardSheet}
      />

      <CardsCarousel
        variant="desktop"
        cards={CARDS}
        selectedCardId={cardId}
        onSwitchCard={switchCard}
        onAddCard={openAddCardSheet}
      />

      <CardsInvoiceHeader
        variant="desktop"
        card={card} invoice={invoice} previousInvoice={previousInvoice} nextInvoice={nextInvoice}
        diffPercent={diffPercent} usagePercent={usagePercent} usageColor={usageColor}
        isCurrent={isCurrent} isPaid={isPaid} markingPaid={markingPaid}
        formatBRL={formatBRL}
        onPrevInvoice={()=>previousInvoice&&setInvoiceIdx(i=>i-1)}
        onNextInvoice={()=>nextInvoice&&setInvoiceIdx(i=>i+1)}
        onOpenExport={()=>setExportModalOpen(true)}
        onMarkPaid={handleMarkPaid}
      />

      {/* KPI strip */}
      <div style={{ marginBottom:14 }}>
        <KpiStrip card={card} invoice={invoice} previousInvoice={previousInvoice} formatBRL={formatBRL}
          diffPercent={diffPercent} usageColor={usageColor} averageValue={averageValue}
          cardInvoices={cardInvoices} isMobile={isMobile}/>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:2, background:T.grayLight, borderRadius:12, padding:4, width:"fit-content", marginBottom:14 }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{...G,display:"flex",alignItems:"center",gap:7,padding:"9px 18px",borderRadius:9,border:"none",background:tab===t.id?T.surface:"transparent",color:tab===t.id?T.ink:T.inkMid,fontSize:12,fontWeight:700,cursor:"pointer",boxShadow:tab===t.id?T.sm:"none",transition:"all 0.15s"}}>
            <span style={{fontSize:14}}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {tabContentBundle}
    </>
  );

};
