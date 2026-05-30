import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  AlertTriangle, Calendar, Check, ChevronDown, ChevronLeft, ChevronRight,
  CreditCard, Download, Pencil, Plus, RefreshCw, Repeat, RotateCcw, Search, X,
} from "lucide-react";
import {
  Bar, BarChart as ReBarChart, CartesianGrid, Cell, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { T } from "../tokens";
import { G, S, NUM } from "../typography";
import { Card, PageTitle } from "../components/primitives";
import { DragScrollTabs } from "../layouts/DragScrollTabs.jsx";
import { M_MONO } from "../features/moodV4";
import { useCreditCardsData } from "../features/creditCards/useCreditCardsData.js";
import { CardFormSheet } from "../features/creditCards/CardFormSheet.jsx";
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
      <ParcelaModal/><ExportModal/><CardFormSheet
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
      <ParcelaModal/><ExportModal/><CardFormSheet
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
