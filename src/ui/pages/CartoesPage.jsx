import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Calendar, Check, ChevronDown, CreditCard, Download, Pencil, Plus,
  RefreshCw, Repeat, Search, X,
} from "lucide-react";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { T } from "../tokens";
import { G, NUM } from "../typography";
import { Card, PageTitle } from "../components/primitives";
import { DragScrollTabs } from "../layouts/DragScrollTabs.jsx";
import { M_MONO } from "../features/moodV4";
import { useCreditCardsData } from "../features/creditCards/useCreditCardsData.js";
import { CardFormSheet } from "../features/creditCards/CardFormSheet.jsx";
import {
  CardVisual,
  FaturaNav,
  KpiStrip,
  LimitBar,
  CatBars,
} from "../features/creditCards/cartoesPanels.jsx";
import { DateGroup, TxRow } from "../features/creditCards/CardFaturaList.jsx";
import { CartoesPageModals } from "../features/creditCards/CartoesPageModals.jsx";
import {
  AnalisesTab,
  HistoricoTab,
  ParcelasTab,
  PlanejamentoTab,
  RecorrenciasTab,
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

export const CartoesPage = ({ onNav, isMobile = false, onNovaItem, onLancarEstorno = null, cards: cardsProp, dataMode = "mock", organizationId = null, transactionsRefreshToken = 0 }) => {
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

  const TABS = [
    { id: "fatura",       icon: "📋", label: "Fatura" },
    { id: "recorrencias", icon: "🔄", label: "Recorrências" },
    { id: "parcelas",     icon: "🧩", label: "Parcelas" },
    { id: "analises",     icon: "📊", label: "Análises" },
    { id: "historico",    icon: "📈", label: "Histórico" },
    { id: "planejamento", icon: "📅", label: "Planejamento" },
  ];

  const modalsBundle = (
    <CartoesPageModals
      isMobile={isMobile}
      card={card}
      fatura={fatura}
      fmtBRL={fmtBRL}
      parcelaModal={parcelaModal}
      parcelaTarget={parcelaTarget}
      setParcelaTarget={setParcelaTarget}
      parcelaOk={parcelaOk}
      onCloseParcelaModal={() => { setParcelaModal(null); setParcelaTarget(null); }}
      onConfirmParcela={handleRealoc}
      exportModal={exportModal}
      displayItens={displayItens}
      expCats={expCats}
      setExpCats={setExpCats}
      expParcelas={expParcelas}
      setExpParcelas={setExpParcelas}
      expRec={expRec}
      setExpRec={setExpRec}
      expNormal={expNormal}
      setExpNormal={setExpNormal}
      onCloseExportModal={() => setExportModal(false)}
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
              <CardVisual c={c} selected={c.id===cardId} size="sm" onClick={switchCard}/>
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
          <FaturaNav compact fatura={fatura} fatPrev={fatPrev} fatNext={fatNext} onPrev={()=>fatPrev&&setFaturaIdx(i=>i-1)} onNext={()=>fatNext&&setFaturaIdx(i=>i+1)}/>
          <div style={{textAlign:"right"}}>
            {fatura?.atual&&<div style={{...G,fontSize:10,fontWeight:700,color:T.blue,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:3}}>Fatura aberta</div>}
            <div style={{...G,...NUM,fontSize:22,fontWeight:800,color:T.ink,lineHeight:1}}>{fmtBRL((fatura?.val||0))}</div>
            {diffPct!==0&&<div style={{...G,fontSize:11,fontWeight:600,marginTop:3,color:diffPct>0?T.red:T.green}}>{diffPct>0?"↑":"↓"} {Math.abs(diffPct)}% vs {fatPrev?.mes}</div>}
          </div>
        </div>
        <LimitBar card={card} usoPct={usoPct} usoColor={usoColor} fmtBRL={fmtBRL}/>
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
      <div style={{marginBottom:14}}><KpiStrip card={card} fatura={fatura} fatPrev={fatPrev} fmtBRL={fmtBRL} diffPct={diffPct} usoColor={usoColor} mediaVal={mediaVal} cardFaturas={cardFaturas} isMobile={isMobile}/></div>

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
                  :grouped.length>0?pagedGroups.map(([date,items])=><DateGroup key={date} date={date} items={items} card={card} expandedDate={expandedDate} setExpandedDate={setExpandedDate} catColor={catColor} fmtBRL={fmtBRL} onLancarEstorno={onLancarEstorno}/>)
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
              <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px 20px"}}><LimitBar card={card} usoPct={usoPct} usoColor={usoColor} fmtBRL={fmtBRL}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:14}}>{[{label:"Disponível",val:fmtBRL(card.disponivel),c:usoColor},{label:"Utilizado",val:fmtBRL(card.limite-card.disponivel),c:T.ink},{label:"Limite",val:fmtBRL(card.limite),c:T.inkMid},{label:"Parcelas",val:fmtBRL(totalParcelas),c:T.blue}].map((k,i)=><div key={i} style={{background:T.bg,borderRadius:9,padding:"9px 10px"}}><div style={{...G,fontSize:8,fontWeight:700,color:T.inkLight,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:3}}>{k.label}</div><div style={{...G,...NUM,fontSize:13,fontWeight:700,color:k.c}}>{k.val}</div></div>)}</div></div>
              {isAtual&&catTotals.length>0&&<div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px 20px"}}><div style={{...G,fontSize:12,fontWeight:700,color:T.ink,marginBottom:4}}>Análise de gastos</div><div style={{...G,fontSize:10,color:T.inkLight,marginBottom:14}}>Clique para filtrar</div><CatBars catTotals={catTotals} filterCat={filterCat} setFilterCat={setFilterCat} fmtBRL={fmtBRL}/>{recTotal>0&&<div style={{display:"flex",alignItems:"center",gap:7,background:T.purpleLight,border:`1px solid ${T.purple}22`,borderRadius:9,padding:"8px 12px",marginTop:14}}><Repeat size={12} color={T.purple}/><span style={{...G,fontSize:11,color:T.inkMid}}>Assinaturas: <strong style={{color:T.purple}}>{fmtBRL(recTotal)}</strong></span></div>}</div>}
              {fatPrev&&<div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px"}}><div style={{...G,fontSize:10,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:8}}>Média mensal</div><div style={{...G,...NUM,fontSize:18,fontWeight:800,color:T.ink}}>{fmtBRL(mediaVal)}</div><div style={{...G,fontSize:11,fontWeight:600,marginTop:4,color:diffPct>0?T.red:T.green}}>{diffPct>0?"↑":"↓"} {Math.abs(diffPct)}% vs {fatPrev.mes}</div></div>}
            </div>
          </div>
        )}
        {tab==="recorrencias"&&<RecorrenciasTab recItems={recItems} recTotal={recTotal} fatura={fatura} card={card} isMobile={isMobile} fmtBRL={fmtBRL} catColor={catColor} onLancarEstorno={onLancarEstorno}/>}
        {tab==="parcelas"    &&<ParcelasTab cardParcelas={cardParcelas} card={card} totalParcelas={totalParcelas} totalEstornos={totalEstornos} hasParcelasEstornadas={hasParcelasEstornadas} isMobile={isMobile} fmtBRL={fmtBRL} onMoverParcela={setParcelaModal}/>}
        {tab==="analises"    &&<AnalisesTab cardFaturas={cardFaturas} cardTendencia={cardTendencia} fatura={fatura} card={card} usoPct={usoPct} totalParcelas={totalParcelas} totalEstornos={totalEstornos} hasParcelasEstornadas={hasParcelasEstornadas} catAlerts={catAlerts} mediaVal={mediaVal} projecao={projecao} cardParcelas={cardParcelas} isMobile={isMobile} fmtBRL={fmtBRL} fmtK={fmtK}/>}
        {tab==="historico"   &&<HistoricoTab cardFaturas={cardFaturas} isMobile={isMobile} fmtBRL={fmtBRL}/>}
        {tab==="planejamento"&&<PlanejamentoTab card={card} cardParcelas={cardParcelas} isMobile={isMobile} fmtBRL={fmtBRL}/>}
      </div>
    </div>
    </>
  );

  // ── Desktop return ───────────────────────────────────────────────────────
  return (
    <>
      <style>{`@keyframes drawerIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
      {modalsBundle}

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
          {CARDS.map(c=><CardVisual key={c.id} c={c} selected={c.id===cardId} size="md" onClick={switchCard}/>)}
          <div onClick={openAddCardSheet} style={{ width:200, height:Math.round(200/1.586), borderRadius:16, flexShrink:0, border:`2px dashed ${T.border}`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6, cursor:"pointer", background:T.surface }}>
            <Plus size={22} color={T.inkLight}/>
            <span style={{...G,fontSize:11,color:T.inkMid}}>Novo cartão</span>
          </div>
        </div>
      </div>

      {/* Fatura header */}
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"16px 20px", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <FaturaNav fatura={fatura} fatPrev={fatPrev} fatNext={fatNext} onPrev={()=>fatPrev&&setFaturaIdx(i=>i-1)} onNext={()=>fatNext&&setFaturaIdx(i=>i+1)}/>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {fatura?.atual && <div style={{...G,fontSize:11,fontWeight:700,color:T.blue,textTransform:"uppercase",letterSpacing:"0.08em"}}>Fatura aberta</div>}
            <div style={{...G,...NUM,fontSize:24,fontWeight:800,color:T.ink,lineHeight:1}}>{fmtBRL((fatura?.val||0))}</div>
            {diffPct!==0 && <div style={{...G,fontSize:12,fontWeight:600,color:diffPct>0?T.red:T.green}}>{diffPct>0?"↑":"↓"} {Math.abs(diffPct)}% vs {fatPrev?.mes}</div>}
          </div>
        </div>
        <LimitBar card={card} usoPct={usoPct} usoColor={usoColor} fmtBRL={fmtBRL}/>
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
      <div style={{ marginBottom:14 }}><KpiStrip card={card} fatura={fatura} fatPrev={fatPrev} fmtBRL={fmtBRL} diffPct={diffPct} usoColor={usoColor} mediaVal={mediaVal} cardFaturas={cardFaturas} isMobile={isMobile}/></div>

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
                  :grouped.length>0?pagedGroups.map(([date,items])=><DateGroup key={date} date={date} items={items} card={card} expandedDate={expandedDate} setExpandedDate={setExpandedDate} catColor={catColor} fmtBRL={fmtBRL} onLancarEstorno={onLancarEstorno}/>)
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
              <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px 20px"}}><LimitBar card={card} usoPct={usoPct} usoColor={usoColor} fmtBRL={fmtBRL}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:14}}>{[{label:"Disponível",val:fmtBRL(card.disponivel),c:usoColor},{label:"Utilizado",val:fmtBRL(card.limite-card.disponivel),c:T.ink},{label:"Limite",val:fmtBRL(card.limite),c:T.inkMid},{label:"Parcelas",val:fmtBRL(totalParcelas),c:T.blue}].map((k,i)=><div key={i} style={{background:T.bg,borderRadius:9,padding:"9px 10px"}}><div style={{...G,fontSize:10,fontWeight:700,color:T.inkLight,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:3}}>{k.label}</div><div style={{...G,...NUM,fontSize:13,fontWeight:700,color:k.c}}>{k.val}</div></div>)}</div></div>
              {fatPrev&&<div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px"}}><div style={{...G,fontSize:10,fontWeight:700,color:T.inkLight,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:8}}>Média mensal</div><div style={{...G,...NUM,fontSize:18,fontWeight:800,color:T.ink}}>{fmtBRL(mediaVal)}</div><div style={{...G,fontSize:11,fontWeight:600,marginTop:4,color:diffPct>0?T.red:T.green}}>{diffPct>0?"↑":"↓"} {Math.abs(diffPct)}% vs {fatPrev.mes}</div></div>}
            </div>
          </div>
        )}
        {tab==="recorrencias"&&<RecorrenciasTab recItems={recItems} recTotal={recTotal} fatura={fatura} card={card} isMobile={isMobile} fmtBRL={fmtBRL} catColor={catColor} onLancarEstorno={onLancarEstorno}/>}
        {tab==="parcelas"    &&<ParcelasTab cardParcelas={cardParcelas} card={card} totalParcelas={totalParcelas} totalEstornos={totalEstornos} hasParcelasEstornadas={hasParcelasEstornadas} isMobile={isMobile} fmtBRL={fmtBRL} onMoverParcela={setParcelaModal}/>}
        {tab==="analises"    &&<AnalisesTab cardFaturas={cardFaturas} cardTendencia={cardTendencia} fatura={fatura} card={card} usoPct={usoPct} totalParcelas={totalParcelas} totalEstornos={totalEstornos} hasParcelasEstornadas={hasParcelasEstornadas} catAlerts={catAlerts} mediaVal={mediaVal} projecao={projecao} cardParcelas={cardParcelas} isMobile={isMobile} fmtBRL={fmtBRL} fmtK={fmtK}/>}
        {tab==="historico"   &&<HistoricoTab cardFaturas={cardFaturas} isMobile={isMobile} fmtBRL={fmtBRL}/>}
        {tab==="planejamento"&&<PlanejamentoTab card={card} cardParcelas={cardParcelas} isMobile={isMobile} fmtBRL={fmtBRL}/>}
      </div>
    </>
  );

};
