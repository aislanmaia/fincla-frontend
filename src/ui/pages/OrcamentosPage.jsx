import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { FC } from "../routing/searchContract.js";
import {
  ArrowRight,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Plus,
} from "lucide-react";
import { T } from "../tokens";
import { G, NUM } from "../typography";
import { buildCreateBudgetPayload, parseBudgetAmountInput } from "../data/budgetsAdapter.js";
import { CategoryLucideIcon } from "../components/CategoryLucideIcon.jsx";
import { CollapsibleSection, PageTitle } from "../components/primitives";
import { useBudgetsData } from "../features/budgets/useBudgetsData.js";
import { shouldUseRealData as shouldUseRealDataForMode } from "../dataMode.js";

/* ─── ORÇAMENTOS DATA ────────────────────────────────────── */
const BUDGET_CONFIG = { total: 6500, modo: "top-down" };

const CATS_ORC_INIT = [
  { id:"alimentacao", nome:"Alimentação",  categoryIconKey:"shopping-cart", limite:1200, gasto:1046, membros:["A","M"], envelopes:[
      { id:"mercado",      nome:"Mercado",       limite:800, gasto:720 },
      { id:"restaurantes", nome:"Restaurantes",  limite:400, gasto:326 }]},
  { id:"moradia",    nome:"Moradia",       categoryIconKey:"home", limite:1500, gasto:1500, membros:["A","M"], envelopes:[] },
  { id:"transporte", nome:"Transporte",    categoryIconKey:"car", limite:600,  gasto:320,  membros:["A"], envelopes:[
      { id:"combustivel", nome:"Combustível", limite:300, gasto:180 },
      { id:"apps",        nome:"Uber / 99",   limite:200, gasto:120 },
      { id:"manutencao",  nome:"Manutenção",  limite:100, gasto:20  }]},
  { id:"saude",      nome:"Saúde",         categoryIconKey:"pill", limite:400,  gasto:180,  membros:["A","M"], envelopes:[] },
  { id:"lazer",      nome:"Lazer",         categoryIconKey:"party-popper", limite:500,  gasto:388,  membros:["A","M"], envelopes:[
      { id:"streaming", nome:"Streaming", limite:200, gasto:188 },
      { id:"saidas",    nome:"Saídas",    limite:300, gasto:200 }]},
  { id:"educacao",   nome:"Educação",      categoryIconKey:"book-open", limite:800,  gasto:487,  membros:["A"],     envelopes:[] },
  { id:"vestuario",  nome:"Vestuário",     categoryIconKey:"shopping-bag", limite:300,  gasto:160,  membros:["M"],     envelopes:[] },
  { id:"outros",     nome:"Outros",        categoryIconKey:null, limite:200,  gasto:300,  membros:["A","M"], envelopes:[] },
];

const HIST_ORC = [
  { m:"Out", spent:5100, budget:6000 },
  { m:"Nov", spent:6300, budget:6000 },
  { m:"Dez", spent:7200, budget:6200 },
  { m:"Jan", spent:5800, budget:6500 },
  { m:"Fev", spent:5400, budget:6500 },
  { m:"Mar", spent:4381, budget:6500, current:true },
];

const CAT_COLORS = ["#2563EB","#059669","#D97706","#7C3AED","#DC2626","#0891B2","#BE185D","#6B7280"];
const AVATAR_COLORS_ORC = { A:"#7C3AED", M:"#2563EB", F:"#059669", J:"#D97706" };

/* ─── ORÇAMENTOS PAGE ────────────────────────────────────── */
export function OrcamentosPage({
  onNav,
  isMobile = false,
  dataMode = "live",
  extraRecs = [],
  orgTipo = "personal",
  organizationId = null,
}) {
  const urlSearch = useSearch({ strict: false });
  const navigate = useNavigate();
  const [month,    setMonth]    = useState(2);
  const [showAdd,  setShowAdd]  = useState(false);
  const [addSelId,   setAddSelId]   = useState(null);
  const [addLimStr,  setAddLimStr]  = useState("");
  const resetAddForm = () => { setAddSelId(null); setAddLimStr(""); };

  const [expanded, setExpanded] = useState({});
  const [histOpen, setHistOpen] = useState(true);
  const [mockCats, setMockCats] = useState(() => dataMode === "mock" ? CATS_ORC_INIT : []);
  const [mockBudget] = useState(() => dataMode === "mock" ? BUDGET_CONFIG.total : 0);
  const shouldUseRealData = shouldUseRealDataForMode(organizationId, dataMode);
  const budgetsData = useBudgetsData({
    organizationId,
    enabled: shouldUseRealData,
  });

  useEffect(() => {
    if (urlSearch[FC.ADD] !== "1") return;
    setShowAdd(true);
    navigate({
      replace: true,
      search: (prev) => {
        const next = { ...prev };
        delete next[FC.ADD];
        return next;
      },
    });
  }, [urlSearch[FC.ADD], navigate]);

  const MONTHS_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const displayMonth = shouldUseRealData ? currentMonth : month;
  const cats = shouldUseRealData ? (budgetsData.data?.cats || []) : mockCats;
  const budget = shouldUseRealData ? (budgetsData.data?.budget || 0) : mockBudget;
  const historyData = shouldUseRealData ? budgetsData.history : (dataMode === "mock" ? HIST_ORC : []);

  const totalGasto  = shouldUseRealData ? (budgetsData.data?.totalGasto || 0) : cats.reduce((s, c) => s + c.gasto, 0);
  const totalDisp   = shouldUseRealData ? (budgetsData.data?.totalDisp || 0) : budget - totalGasto;
  const totalPct    = shouldUseRealData ? (budgetsData.data?.totalPct || 0) : (budget > 0 ? Math.round(totalGasto / budget * 100) : 0);
  const alertCount  = shouldUseRealData ? (budgetsData.data?.alertCount || 0) : cats.filter(c => c.limite > 0 && c.gasto / c.limite >= 0.85).length;
  const healthLabel = shouldUseRealData ? (budgetsData.data?.healthLabel || "Saudável") : (alertCount === 0 ? "Saudável" : alertCount <= 2 ? "Atenção" : "Crítico");
  const healthColor = alertCount === 0 ? T.green : alertCount <= 2 ? T.amber : T.red;

  const pct = (g, l) => (l > 0 ? Math.min(100, Math.round(g / l * 100)) : 0);
  const barColor = (p) => p >= 100 ? T.red : p >= 75 ? T.amber : T.green;
  const barLight  = (p) => p >= 100 ? T.redLight : p >= 75 ? T.amberLight : T.greenLight;
  const fmtBRL = (v) => "R$ " + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const toggleCat = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const CatCard = ({ cat, idx }) => {
    const p      = pct(cat.gasto, cat.limite);
    const bColor = barColor(p);
    const bLight = barLight(p);
    const isExp  = !!expanded[cat.id];
    const hasEnv = cat.envelopes.length > 0;
    const AlertBadge = () => {
      if (p >= 100) return <span style={{ ...G, fontSize:10, fontWeight:700, background:T.redLight, color:T.red, padding:"3px 8px", borderRadius:99 }}>🔴 +{fmtBRL(cat.gasto - cat.limite)}</span>;
      if (p >= 85)  return <span style={{ ...G, fontSize:10, fontWeight:700, background:T.amberLight, color:T.amber, padding:"3px 8px", borderRadius:99 }}>⚠ {p}% usado</span>;
      return <span style={{ ...G, fontSize:10, fontWeight:600, background:T.greenLight, color:T.green, padding:"3px 8px", borderRadius:99 }}>{p}% usado</span>;
    };
    return (
      <div style={{ background:T.surface, border:`1px solid ${p>=100?T.red+"44":p>=85?T.amber+"44":T.border}`, borderRadius:14, overflow:"hidden", transition:"box-shadow 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = T.md}
        onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
        <div onClick={() => hasEnv && toggleCat(cat.id)}
          style={{ padding:isMobile?"12px 14px 10px":"14px 16px 12px", cursor:hasEnv?"pointer":"default", userSelect:"none" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:isMobile?6:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:isMobile?8:10, minWidth:0 }}>
              <div style={{ width:isMobile?30:38, height:isMobile?30:38, borderRadius:isMobile?8:10, background:bLight, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <CategoryLucideIcon iconKey={cat.categoryIconKey} labelPt={cat.nome} size={isMobile?16:18} color={T.ink} />
              </div>
              <div>
                <div style={{ ...G, fontSize:isMobile?12:13, fontWeight:700, color:T.ink, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{cat.nome}</div>
                {isMobile
                  ? <AlertBadge />
                  : <div style={{ ...G, fontSize:10, color:T.inkLight, marginTop:1 }}>{hasEnv ? `${cat.envelopes.length} envelopes` : "Sem envelopes"}</div>}
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:isMobile?4:6, flexShrink:0, marginLeft:6 }}>
              {!isMobile && <AlertBadge />}
              {hasEnv && <ChevronDown size={14} color={T.inkLight} style={{ transform:isExp?"rotate(180deg)":"rotate(0deg)", transition:"transform 0.22s" }} />}
            </div>
          </div>
          <div style={{ height:isMobile?5:6, background:T.grayLight, borderRadius:99, overflow:"hidden", marginBottom:isMobile?6:8 }}>
            <div style={{ height:"100%", width:`${p}%`, background:bColor, borderRadius:99, transition:"width 0.5s cubic-bezier(0.4,0,0.2,1)" }} />
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
              <span style={{ ...G, ...NUM, fontSize:isMobile?13:14, fontWeight:800, color:bColor }}>{fmtBRL(cat.gasto)}</span>
              <span style={{ ...G, ...NUM, fontSize:isMobile?10:11, color:T.inkLight }}>/ {fmtBRL(cat.limite)}</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:isMobile?6:8, marginLeft:isMobile?0:"auto" }}>
              <div style={{ display:"flex" }}>
                {cat.membros.map((m, i) => (
                  <div key={m} style={{ width:20, height:20, borderRadius:"50%", background:AVATAR_COLORS_ORC[m]||T.inkMid, border:`2px solid ${T.surface}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:700, color:"#fff", marginLeft:i===0?0:-5 }}>{m}</div>
                ))}
              </div>
              <button onClick={e => { e.stopPropagation(); onNav && onNav("transactions", { filterCat: cat.navFilter || cat.nome }); }}
                style={{ ...G, fontSize:10, fontWeight:600, color:T.blue, background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", alignItems:"center", gap:3 }}
                onMouseEnter={e => e.currentTarget.style.textDecoration="underline"}
                onMouseLeave={e => e.currentTarget.style.textDecoration="none"}>
                Ver → <ArrowRight size={9} color={T.blue} />
              </button>
            </div>
          </div>
        </div>
        {hasEnv && (
          <CollapsibleSection open={isExp}>
            <div style={{ borderTop:`1px solid ${T.border}`, padding:"10px 16px 12px" }}>
              <div style={{ ...G, fontSize:8, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>Envelopes</div>
              {cat.envelopes.map((env, i) => {
                const ep = pct(env.gasto, env.limite);
                return (
                  <div key={env.id} style={{ display:"flex", alignItems:"center", gap:8, paddingBottom:8, marginBottom:i<cat.envelopes.length-1?8:0, borderBottom:i<cat.envelopes.length-1?`1px solid ${T.border}`:"none" }}>
                    <div style={{ ...G, fontSize:isMobile?10:11, color:T.ink, flex:"0 0 90px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{env.nome}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ height:4, background:T.grayLight, borderRadius:99, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${ep}%`, background:barColor(ep), borderRadius:99, transition:"width 0.5s" }} />
                      </div>
                    </div>
                    <div style={{ ...G, ...NUM, fontSize:isMobile?9:10, textAlign:"right", minWidth:isMobile?80:100 }}>
                      <span style={{ fontWeight:700, color:T.ink }}>{isMobile?`R$${env.gasto}`:fmtBRL(env.gasto)}</span>
                      <span style={{ color:T.inkLight }}> / {isMobile?`R$${env.limite}`:fmtBRL(env.limite)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        )}
      </div>
    );
  };

  const DistBar = () => {
    let offset = 0;
    return (
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"16px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, flexWrap:"wrap", gap:8 }}>
          <div style={{ ...G, fontSize:isMobile?12:13, fontWeight:700, color:T.ink }}>
            Distribuição — <span style={{ ...NUM, color:T.blue }}>{fmtBRL(budget)}</span>
          </div>
          {shouldUseRealData ? (
            <span style={{ ...G, fontSize:10, fontWeight:600, color:T.inkLight, background:T.bg, border:`1px solid ${T.border}`, borderRadius:7, padding:"4px 10px" }}
              title="Valor igual à soma dos limites que você definiu em cada categoria.">
              Soma dos orçamentos
            </span>
          ) : (
            <button style={{ ...G, fontSize:10, fontWeight:600, color:T.blue, background:"none", border:`1px solid ${T.border}`, borderRadius:7, padding:"4px 10px", cursor:"pointer" }}>Editar total</button>
          )}
        </div>
        <div style={{ height:10, background:T.grayLight, borderRadius:99, overflow:"hidden", position:"relative", marginBottom:12 }}>
          {cats.map((c, i) => {
            const w = budget > 0 ? (c.limite / budget * 100).toFixed(2) : "0";
            const seg = <div key={c.id} style={{ position:"absolute", top:0, left:`${offset}%`, width:`${w}%`, height:"100%", background:c.color || CAT_COLORS[i], transition:"width 0.4s" }} title={`${c.nome}: ${fmtBRL(c.limite)}`} />;
            offset += parseFloat(w);
            return seg;
          })}
        </div>
        <div style={{ display:isMobile?"grid":"flex", gridTemplateColumns:isMobile?"1fr 1fr":undefined, gap:isMobile?6:10, flexWrap:"wrap" }}>
          {cats.map((c, i) => (
            <div key={c.id} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:8, height:8, borderRadius:2, background:c.color || CAT_COLORS[i], flexShrink:0 }} />
              <span style={{ ...G, fontSize:isMobile?9:10, color:T.inkMid }}>{c.nome}</span>
              {!isMobile && <span style={{ ...G, ...NUM, fontSize:10, fontWeight:700, color:T.ink }}>{fmtBRL(c.limite)}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const Historico = () => {
    const maxVal = Math.max(...historyData.map(h => Math.max(h.spent, h.budget || 0)), 1);
    return (
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden" }}>
        <div onClick={() => setHistOpen(o => !o)}
          style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", cursor:"pointer", userSelect:"none" }}
          onMouseEnter={e => e.currentTarget.style.background = T.bg}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <BarChart2 size={14} color={T.inkMid} />
            <span style={{ ...G, fontSize:13, fontWeight:700, color:T.ink }}>
              {shouldUseRealData ? "Gasto mensal dos últimos 6 meses" : "Histórico dos últimos 6 meses"}
            </span>
          </div>
          <span style={{ ...G, fontSize:11, fontWeight:600, color:T.blue, display:"flex", alignItems:"center", gap:4 }}>
            {histOpen ? "Recolher" : "Ver histórico"} {histOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </span>
        </div>
        <CollapsibleSection open={histOpen}>
          <div style={{ padding:"0 20px 20px", borderTop:`1px solid ${T.border}` }}>
            <div style={{ display:"flex", alignItems:"flex-end", gap:isMobile?8:16, paddingTop:16 }}>
              {historyData.map(h => {
                const sh = Math.round(h.spent  / maxVal * 68);
                const bh = h.budget ? Math.round(h.budget / maxVal * 68) : 0;
                const over = h.budget ? h.spent > h.budget : false;
                return (
                  <div key={h.m} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
                    <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:72 }}>
                      {h.budget ? (
                        <div style={{ width:isMobile?11:14, height:bh, background:T.grayLight, borderRadius:"4px 4px 0 0", flexShrink:0 }} />
                      ) : null}
                      <div style={{ width:isMobile?11:14, height:sh, background:over?T.red:h.current?T.blue:T.ink, borderRadius:"4px 4px 0 0", flexShrink:0 }} />
                    </div>
                    <div style={{ ...G, fontSize:isMobile?8:9, fontWeight:600, color:h.current?T.blue:T.inkLight }}>{h.m}</div>
                    <div style={{ ...G, ...NUM, fontSize:isMobile?8:9, fontWeight:700, color:over?T.red:T.ink }}>{(h.spent/1000).toFixed(1)}k</div>
                  </div>
                );
              })}
              <div style={{ display:"flex", flexDirection:"column", gap:6, paddingLeft:8, paddingBottom:24 }}>
                {(shouldUseRealData ? [{bg:T.ink,label:"Gasto"}] : [{bg:T.grayLight,label:"Limite"},{bg:T.ink,label:"Gasto"}]).map((x,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <div style={{ width:10, height:10, borderRadius:2, background:x.bg, border:i===0?`1px solid ${T.border}`:undefined }} />
                    <span style={{ ...G, fontSize:10, color:T.inkMid }}>{x.label}</span>
                  </div>
                ))}
              </div>
            </div>
            {shouldUseRealData && (
              <div style={{ ...G, fontSize:10, color:T.inkLight, marginTop:8 }}>
                O backend ainda não expõe o limite histórico por mês. Por isso, aqui mostramos apenas os gastos reais do período.
              </div>
            )}
          </div>
        </CollapsibleSection>
      </div>
    );
  };

  if (shouldUseRealData && budgetsData.isLoading && !budgetsData.hasRealData) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
        <PageTitle sans="Meus" serif="Orçamentos" />
        <div style={{ ...G, fontSize:14, color:T.inkMid, background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:"28px 24px" }}>
          Carregando orçamentos...
        </div>
      </div>
    );
  }

  if (shouldUseRealData && budgetsData.error && !budgetsData.hasRealData) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
        <PageTitle sans="Meus" serif="Orçamentos" />
        <div style={{ ...G, fontSize:14, color:T.red, background:T.redLight, border:`1px solid ${T.red}22`, borderRadius:16, padding:"28px 24px" }}>
          {budgetsData.error}
        </div>
      </div>
    );
  }



  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <PageTitle sans="Meus" serif="Orçamentos" />
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", border:`1px solid ${T.border}`, borderRadius:10, overflow:"hidden" }}>
            <button disabled={shouldUseRealData} onClick={() => setMonth(m => (m+11)%12)} style={{ ...G, background:T.surface, border:"none", padding:"7px 12px", cursor:shouldUseRealData?"default":"pointer", color:T.inkMid, fontSize:14, fontWeight:600, opacity:shouldUseRealData?0.45:1 }} onMouseEnter={e => { if (!shouldUseRealData) e.currentTarget.style.background=T.grayLight; }} onMouseLeave={e => e.currentTarget.style.background=T.surface}>‹</button>
            <div style={{ ...G, padding:"7px 14px", fontSize:isMobile?12:13, fontWeight:700, color:T.ink, borderLeft:`1px solid ${T.border}`, borderRight:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>{isMobile?MONTHS_FULL[displayMonth].slice(0,3)+`/${String(currentYear).slice(-2)}`:MONTHS_FULL[displayMonth]+` ${currentYear}`}</div>
            <button disabled={shouldUseRealData} onClick={() => setMonth(m => (m+1)%12)} style={{ ...G, background:T.surface, border:"none", padding:"7px 12px", cursor:shouldUseRealData?"default":"pointer", color:T.inkMid, fontSize:14, fontWeight:600, opacity:shouldUseRealData?0.45:1 }} onMouseEnter={e => { if (!shouldUseRealData) e.currentTarget.style.background=T.grayLight; }} onMouseLeave={e => e.currentTarget.style.background=T.surface}>›</button>
          </div>
          <button onClick={() => setShowAdd(true)} style={{ ...G, display:"flex", alignItems:"center", gap:6, background:T.ink, border:"none", borderRadius:9, padding:"8px 14px", fontSize:12, fontWeight:700, color:"#fff", cursor:"pointer" }}>
            <Plus size={13} /> {isMobile?"Novo":"Novo Orçamento"}
          </button>
        </div>
      </div>
      {shouldUseRealData && budgetsData.error && (
        <div style={{ ...G, fontSize:13, color:T.red, background:T.redLight, border:`1px solid ${T.red}22`, borderRadius:12, padding:"12px 14px" }}>
          {budgetsData.error}
        </div>
      )}
      {cats.length > 0 && <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:isMobile?10:12 }}>
        {[
          { label:"Total orçado",   val:fmtBRL(budget),     sub:"limite do mês",             color:T.ink },
          { label:"Gasto até hoje", val:fmtBRL(totalGasto), sub:`${totalPct}% do orçamento`, color:T.red },
          { label:"Disponível",     val:fmtBRL(totalDisp),  sub:"saldo restante do orçamento", color:totalDisp>=0?T.green:T.red },
          { label:"Saúde geral",    val:healthLabel,        sub:`${alertCount} no limite`,    color:healthColor },
        ].map((k, i) => (
          <div key={i} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:isMobile?"12px 14px":"14px 16px" }}>
            <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:5 }}>{k.label}</div>
            <div style={{ ...G, ...NUM, fontSize:isMobile?i===3?13:17:i===3?15:20, fontWeight:800, color:k.color, letterSpacing:"-0.01em", display:"flex", alignItems:"center", gap:6 }}>
              {i===3 && <span style={{ width:8, height:8, borderRadius:"50%", background:k.color, display:"inline-block", flexShrink:0 }} />}
              {k.val}
            </div>
            <div style={{ ...G, fontSize:10, color:T.inkMid, marginTop:3 }}>{k.sub}</div>
          </div>
        ))}
      </div>}
      {cats.length > 0 && <DistBar />}
      {cats.length === 0 ? (() => {
        const rec0 = extraRecs && extraRecs[0];
        const hasSuggestedIncome = Boolean(rec0) && !shouldUseRealData;
        const recVal = rec0 ? rec0.val : 0;
        const fmtRec = v => "R$ " + Math.abs(v).toLocaleString("pt-BR",{minimumFractionDigits:0});
        const sugs = recVal > 0 && !shouldUseRealData ? [
          { id:"moradia",     categoryIconKey:"home", nome:"Moradia",     pct:0.30, hint:"30% da renda" },
          { id:"alimentacao", categoryIconKey:"shopping-cart", nome:"Alimentação", pct:0.15, hint:"15% da renda" },
          { id:"transporte",  categoryIconKey:"car", nome:"Transporte",  pct:0.10, hint:"10% da renda" },
        ] : [];
        return (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ textAlign:"center", padding:"8px 0 8px" }}>
              <div style={{ width:52, height:52, background:hasSuggestedIncome?T.greenLight:T.grayLight, borderRadius:15, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, margin:"0 auto 13px" }}>📋</div>
              <div style={{ ...G, fontSize:16, fontWeight:800, color:T.ink, marginBottom:6 }}>{hasSuggestedIncome ? "Sugestões prontas para você" : "Nenhum orçamento ainda"}</div>
              <div style={{ ...G, fontSize:13, color:T.inkLight, lineHeight:1.65, maxWidth:340, margin:"0 auto" }}>
                {hasSuggestedIncome ? <span>Baseado na sua receita de <strong style={{ color:T.green }}>{fmtRec(recVal)}/mês</strong>, calculamos limites para as categorias que você selecionou.</span>
                      : "Defina limites por categoria para controlar quanto pode gastar em cada área."}
              </div>
            </div>
            {!hasSuggestedIncome && (
              <div style={{ display:"flex", alignItems:"flex-start", gap:10, background:T.blueLight, border:`1px solid ${T.blue}22`, borderRadius:10, padding:"11px 13px" }}>
                <span style={{ fontSize:16, flexShrink:0 }}>💡</span>
                <div style={{ flex:1 }}>
                  <div style={{ ...G, fontSize:12, fontWeight:700, color:T.ink, marginBottom:2 }}>
                    {shouldUseRealData ? "Crie seu primeiro orçamento" : "Registre sua receita primeiro"}
                  </div>
                  <div style={{ ...G, fontSize:11, color:T.inkMid, lineHeight:1.55 }}>
                    {shouldUseRealData
                      ? "Selecione uma categoria e defina um limite mensal para começar a acompanhar seus gastos."
                      : "Com o valor da sua renda, sugerimos limites automáticos por categoria (regra 50/30/20)."}
                  </div>
                </div>
                {!shouldUseRealData && (
                  <button onClick={()=>onNav("recurring")} style={{ ...G, fontSize:11, fontWeight:700, color:T.blue, background:"none", border:"none", cursor:"pointer", flexShrink:0 }}>Ir →</button>
                )}
              </div>
            )}
            {sugs.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {sugs.map(s=>(
                  <div key={s.id} style={{ display:"flex", alignItems:"center", gap:10, background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 13px" }}>
                    <CategoryLucideIcon iconKey={s.categoryIconKey} labelPt={s.nome} size={20} color={T.ink} />
                    <div style={{ flex:1 }}><div style={{ ...G, fontSize:12, fontWeight:700, color:T.ink }}>{s.nome}</div><div style={{ ...G, fontSize:10, color:T.inkLight }}>{s.hint}</div></div>
                    <div style={{ ...G, ...NUM, fontSize:12, fontWeight:700, color:T.inkMid, marginRight:8 }}>{fmtRec(Math.round(recVal*s.pct))}</div>
                    <button onClick={()=>{ const f=CATS_ORC_INIT.find(c=>c.id===s.id); if(f) setMockCats(prev=>[...prev,{...f,gasto:0,limite:Math.round(recVal*s.pct)}]); }} style={{ ...G, background:T.ink, color:"#fff", border:"none", borderRadius:7, padding:"5px 12px", fontSize:11, fontWeight:700, cursor:"pointer" }}>Usar</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display:"flex", gap:10 }}>
              {sugs.length > 0 && (
                <button onClick={()=>sugs.forEach(s=>{ const f=CATS_ORC_INIT.find(c=>c.id===s.id); if(f) setMockCats(prev=>prev.find(x=>x.id===s.id)?prev:[...prev,{...f,gasto:0,limite:Math.round(recVal*s.pct)}]); })} style={{ ...G, flex:2, padding:"11px", borderRadius:11, border:"none", background:T.ink, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", justifyContent:"center" }}>✓ Aplicar todos</button>
              )}
              <button onClick={()=>setShowAdd(true)} style={{ ...G, flex:sugs.length>0?1:2, padding:"11px", borderRadius:11, border:`1px solid ${T.border}`, background:"none", color:T.inkMid, fontSize:13, fontWeight:600, cursor:"pointer" }}>{sugs.length>0?"Personalizar":"+ Criar primeiro orçamento"}</button>
            </div>
          </div>
        );
      })() : (
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
          {cats.map((cat, i) => <CatCard key={cat.id} cat={cat} idx={i} />)}
        </div>
      )}
      <Historico />
      {showAdd && (() => {
        const available = shouldUseRealData
          ? budgetsData.choices
          : CATS_ORC_INIT.filter(c => !cats.find(x => x.id === c.id));
        const selCat    = available.find(c => c.id === addSelId) || null;
        const limVal    = parseBudgetAmountInput(addLimStr);
        const canSave   = addSelId !== null && limVal > 0;
        const handleSave = async () => {
          if (!canSave) return;
          try {
            if (shouldUseRealData) {
              await budgetsData.createBudget(buildCreateBudgetPayload(addSelId, limVal));
            } else {
              setMockCats(prev => [...prev, { ...selCat, gasto:0, membros:[], envelopes:[], limite:limVal }]);
            }
            resetAddForm();
            setShowAdd(false);
          } catch {}
        };
        return (
          <div style={{ position:"fixed", inset:0, zIndex:400, overflow:"hidden",
            background:"rgba(0,0,0,0.4)",
            display:"flex",
            alignItems: isMobile ? "flex-end" : "center",
            justifyContent:"center",
            padding: isMobile ? 0 : 24 }}
            onClick={() => { if (!budgetsData.isSaving) { setShowAdd(false); resetAddForm(); } }}>
            <div style={{ width:"100%", maxWidth: isMobile ? "100%" : 460,
              maxHeight: isMobile ? "min(88vh, 720px)" : "min(90vh, 640px)",
              display:"flex", flexDirection:"column", overflow:"hidden",
              background:T.surface,
              borderRadius: isMobile ? "18px 18px 0 0" : 18,
              padding: isMobile ? "20px 20px 32px" : "26px 26px 22px",
              boxShadow:"0 -4px 40px rgba(0,0,0,0.15)" }}
              onClick={e => e.stopPropagation()}>
              {isMobile && <div style={{ width:36, height:4, background:T.border, borderRadius:99, margin:"0 auto 18px" }}/>}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
                <div style={{ ...G, fontSize:16, fontWeight:800, color:T.ink }}>Novo Orçamento</div>
                {!isMobile && (
                  <button onClick={() => { if (!budgetsData.isSaving) { setShowAdd(false); resetAddForm(); } }}
                    style={{ background:"none", border:"none", cursor:"pointer", color:T.inkLight, fontSize:22, lineHeight:1 }}>×</button>
                )}
              </div>
              <div style={{ marginBottom:16, flex:1, minHeight:0, display:"flex", flexDirection:"column" }}>
                <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10, flexShrink:0 }}>
                  Selecione a categoria
                </div>
                {available.length === 0 ? (
                  <div style={{ ...G, fontSize:13, color:T.inkMid, padding:"14px 0", textAlign:"center", lineHeight:1.7 }}>
                    Todas as categorias já têm orçamento. Edite os limites diretamente nos cards abaixo.
                  </div>
                ) : (
                  <div style={{ flex:1, minHeight:0, maxHeight: isMobile ? 320 : 280, overflowY:"auto", overflowX:"hidden", WebkitOverflowScrolling:"touch", paddingRight:4 }}>
                    <div style={{
                      display:"grid",
                      gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))",
                      gap:8,
                    }}>
                      {available.map(c => (
                        <button key={c.id}
                          onClick={() => { setAddSelId(c.id); setAddLimStr(String(c.suggestedLimit || c.limite || "")); }}
                          style={{ ...G, display:"flex", alignItems:"center", gap:9,
                            minWidth:0, maxWidth:"100%", boxSizing:"border-box",
                            padding:"11px 10px", borderRadius:11, textAlign:"left",
                            border:`1.5px solid ${addSelId===c.id ? T.ink : T.border}`,
                            background: addSelId===c.id ? T.ink : T.surface,
                            cursor:"pointer", transition:"all 0.12s" }}>
                          <CategoryLucideIcon iconKey={c.categoryIconKey} labelPt={c.nome} size={20} color={addSelId===c.id ? "#fff" : T.ink} />
                          <span style={{ ...G, fontSize:12, fontWeight:700, minWidth:0, flex:1,
                            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                            color: addSelId===c.id ? "#fff" : T.ink }}>{c.nome}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {selCat && (
                <div style={{ marginBottom:20, flexShrink:0 }}>
                  <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>
                    Limite mensal — {selCat.nome}
                  </div>
                  <div style={{ position:"relative", display:"flex", alignItems:"center" }}>
                    <span style={{ ...G, position:"absolute", left:13, fontSize:14, fontWeight:700, color:T.inkLight, pointerEvents:"none" }}>R$</span>
                    <input value={addLimStr} onChange={e => setAddLimStr(e.target.value)}
                      placeholder="0,00" type="text" inputMode="decimal" autoFocus
                      style={{ ...G, ...NUM, width:"100%", padding:"12px 14px 12px 36px", fontSize:15,
                        color:T.ink, background:T.bg, border:`1.5px solid ${T.ink}`, borderRadius:10, outline:"none" }}
                      onKeyDown={e => { if (e.key==="Enter") void handleSave(); }}/>
                  </div>
                </div>
              )}
              <div style={{ display:"flex", gap:10, marginTop: selCat ? 0 : 4, flexShrink:0 }}>
                <button onClick={() => { if (!budgetsData.isSaving) { setShowAdd(false); resetAddForm(); } }}
                  disabled={budgetsData.isSaving}
                  style={{ ...G, flex:1, padding:"11px", borderRadius:11, border:`1px solid ${T.border}`,
                    background:"none", color:T.inkMid, fontSize:13, fontWeight:600, cursor:budgetsData.isSaving?"not-allowed":"pointer", opacity:budgetsData.isSaving?0.5:1 }}>
                  Cancelar
                </button>
                {available.length > 0 && (
                  <button onClick={() => { void handleSave(); }} disabled={!canSave || budgetsData.isSaving}
                    style={{ ...G, flex:2, padding:"11px", borderRadius:11, border:"none",
                      background: canSave ? T.ink : T.inkGhost, color:"#fff",
                      fontSize:13, fontWeight:700, cursor: canSave ? "pointer" : "not-allowed",
                      opacity: canSave ? 1 : 0.5, transition:"all 0.15s" }}>
                    {budgetsData.isSaving ? "Criando..." : "Criar orçamento"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
