import React, { useEffect, useState } from "react";
import { Pencil, Plus, X, Check } from "lucide-react";
import { T } from "../tokens";
import { G, NUM } from "../typography";
import { buildCreateGoalPayload, buildUpdateGoalPayload } from "../data/goalsAdapter.js";
import { M_MONO } from "../features/moodV4";
import { useGoalsData } from "../features/goals/useGoalsData.js";
import { PageTitle } from "../components/primitives";
import { resolveLocalData, shouldUseRealData as shouldUseRealDataForMode } from "../dataMode.js";

/* ─────────────────────────────────────────────────────────────
   METAS DATA
───────────────────────────────────────────────────────────── */
const METAS_INIT = [
  { id:"reserva",  nome:"Reserva de emergência", emoji:"🛡️",  meta:18000, atual:11400, mensal:800,  prazo:"Dez 2026", cor:"#059669", corLight:"#ECFDF5", prioridade:"alta",  desc:"6 meses de despesas fixas" },
  { id:"viagem",   nome:"Viagem para Europa",    emoji:"✈️",   meta:15000, atual:4200,  mensal:600,  prazo:"Jul 2027", cor:"#2563EB", corLight:"#EFF6FF", prioridade:"media", desc:"Portugal + Espanha + França" },
  { id:"notebook", nome:"Notebook novo",          emoji:"💻",  meta:6000,  atual:3800,  mensal:400,  prazo:"Jun 2026", cor:"#7C3AED", corLight:"#F5F3FF", prioridade:"alta",  desc:"MacBook Air M3" },
  { id:"carro",    nome:"Entrada do carro",       emoji:"🚗",  meta:25000, atual:5000,  mensal:500,  prazo:"Jan 2028", cor:"#D97706", corLight:"#FFFBEB", prioridade:"baixa", desc:"20% do valor total" },
];

/* ─────────────────────────────────────────────────────────────
   METAS PAGE
───────────────────────────────────────────────────────────── */
// Converte prazo "Dez 2026" → meses a partir de Mar/2026
const prazoParaMeses = (prazoStr) => {
  const MP = { jan:0,fev:1,mar:2,abr:3,mai:4,jun:5,jul:6,ago:7,set:8,out:9,nov:10,dez:11 };
  if (!prazoStr || prazoStr === "Sem prazo") return null;
  const parts = prazoStr.toLowerCase().split(/[\s/]+/);
  const mesKey = parts[0]?.slice(0,3);
  const ano    = parseInt(parts[1]);
  if (!MP.hasOwnProperty(mesKey) || isNaN(ano)) return null;
  const diff = (ano - 2026) * 12 + (MP[mesKey] - 2);
  return Math.max(1, diff);
};

export function MetasPage({
  isMobile = false,
  onContribuir,
  autoOpenModal = false,
  initialMetas,
  organizationId = null,
  dataMode = "live",
}) {
  const [metas,       setMetas]       = useState(() => resolveLocalData({
    dataMode,
    mockData: initialMetas !== undefined ? initialMetas : METAS_INIT,
    emptyData: initialMetas ?? [],
  }));
  const [drawer,      setDrawer]      = useState(autoOpenModal);
  const [success,     setSuccess]     = useState(false);
  const [tooltipMeta, setTooltipMeta] = useState(null);
  const [editingMeta, setEditingMeta] = useState(null);
  const shouldUseRealData = shouldUseRealDataForMode(organizationId, dataMode);
  const goalsData = useGoalsData({
    organizationId,
    enabled: shouldUseRealData,
  });

  useEffect(() => {
    if (shouldUseRealData && goalsData.hasRealData) {
      setMetas(goalsData.goals);
    }
  }, [goalsData.goals, goalsData.hasRealData, shouldUseRealData]);

  // drawer form state
  const [fNome,   setFNome]   = useState("");
  const [fDesc,   setFDesc]   = useState("");
  const [fEmoji,  setFEmoji]  = useState("🎯");
  const [fMeta,   setFMeta]   = useState("");
  const [fAtual,  setFAtual]  = useState("");
  const [fMensal, setFMensal] = useState("");
  const [fPrazo,  setFPrazo]  = useState("");
  const [fPrio,   setFPrio]   = useState("media");
  const [fCor,    setFCor]    = useState("#2563EB");

  const EMOJIS = ["🎯","🏠","✈️","💻","🚗","📚","💊","🎓","💍","🏋️","🎸","🌍","🏖️","🛡️","💰","🎁"];
  const CORES  = [
    { hex:"#2563EB", light:"#EFF6FF" }, { hex:"#059669", light:"#ECFDF5" },
    { hex:"#7C3AED", light:"#F5F3FF" }, { hex:"#D97706", light:"#FFFBEB" },
    { hex:"#DC2626", light:"#FEF2F2" }, { hex:"#0891B2", light:"#ECFEFF" },
    { hex:"#BE185D", light:"#FDF2F8" }, { hex:"#0F0F0D", light:"#F3F4F6" },
  ];

  const fmtBRL = (v) => "R$\u00a0" + v.toLocaleString("pt-BR", { minimumFractionDigits: 0 });
  const pct    = (a, m) => Math.min(100, Math.round(a / m * 100));

  if (shouldUseRealData && goalsData.isLoading && !goalsData.hasRealData) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
        <PageTitle sans="Minhas" serif="Metas" />
        <div style={{ ...G, fontSize:14, color:T.inkMid, background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:"28px 24px" }}>
          Carregando metas...
        </div>
      </div>
    );
  }

  if (shouldUseRealData && goalsData.error && metas.length === 0) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
        <PageTitle sans="Minhas" serif="Metas" />
        <div style={{ ...G, fontSize:14, color:T.red, background:T.redLight, border:`1px solid ${T.red}22`, borderRadius:16, padding:"28px 24px" }}>
          {goalsData.error}
        </div>
      </div>
    );
  }

  const totalMeta  = metas.reduce((s, m) => s + m.meta,  0);
  const totalAtual = metas.reduce((s, m) => s + m.atual, 0);

  // Empty state when no metas defined yet
  if (metas.length === 0 && !drawer) return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {shouldUseRealData && goalsData.error && (
          <div style={{ ...G, fontSize:13, color:T.red, background:T.redLight, border:`1px solid ${T.red}22`, borderRadius:12, padding:"12px 14px" }}>
            {goalsData.error}
          </div>
        )}
      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <PageTitle sans="Minhas" serif="Metas"/>
        <button onClick={() => setDrawer(true)} style={{ ...G, background:T.ink, color:"#fff", border:"none", borderRadius:11, padding:"10px 18px", fontSize:13, fontWeight:700, cursor:"pointer" }}>+ Nova meta</button>
      </div>
      <div style={{ ...G, fontSize:14, color:T.inkMid, lineHeight:1.65, marginBottom:4 }}>
        Defina objetivos financeiros e acompanhe seu progresso mês a mês.
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {[
          { ic:"🛡️", bg:"#FEF3C7", title:"Reserva de emergência", sub:"6× renda · alta prioridade"  },
          { ic:"✈️", bg:T.blueLight,  title:"Viagem dos sonhos",     sub:"Defina destino e data"       },
          { ic:"📈", bg:T.greenLight, title:"Investimento inicial",   sub:"Comece com qualquer valor"   },
        ].map((s,i) => (
          <div key={i} onClick={() => setDrawer(true)}
            style={{ display:"flex", alignItems:"center", gap:12, background:T.surface, border:`1.5px solid ${T.border}`, borderRadius:12, padding:"12px 14px", cursor:"pointer" }}>
            <div style={{ width:40, height:40, borderRadius:11, background:s.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{s.ic}</div>
            <div style={{ flex:1 }}>
              <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink, marginBottom:2 }}>{s.title}</div>
              <div style={{ ...G, fontSize:11, color:T.inkLight }}>{s.sub}</div>
            </div>
            <div style={{ fontSize:14, color:T.inkGhost }}>›</div>
          </div>
        ))}
      </div>
      <button onClick={() => setDrawer(true)} style={{ ...G, width:"100%", background:T.ink, color:"#fff", border:"none", borderRadius:11, padding:"11px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
        + Criar primeira meta
      </button>
    </div>
  );
  const totalPct   = Math.round(totalAtual / totalMeta * 100);
  const metasOK    = metas.filter(m => pct(m.atual, m.meta) >= 80).length;
  const proximaMeta = [...metas].sort((a, b) => {
    return Math.ceil((a.meta-a.atual)/(a.mensal||1)) - Math.ceil((b.meta-b.atual)/(b.mensal||1));
  })[0];

  const resetDrawer = () => {
    setFNome(""); setFDesc(""); setFEmoji("🎯"); setFMeta("");
    setFAtual(""); setFMensal(""); setFPrazo(""); setFPrio("media"); setFCor("#2563EB");
  };

  const handleSave = async () => {
    const mN = parseFloat(fMeta.replace(",",".")) || 0;
    if (!fNome || mN === 0) return;
    const corLight = CORES.find(c => c.hex === fCor)?.light || "#EFF6FF";
    if (shouldUseRealData) {
      try {
        await goalsData.createGoal(buildCreateGoalPayload({
          nome: fNome,
          desc: fDesc,
          meta: fMeta,
          atual: fAtual,
          prazo: fPrazo,
        }));
      } catch {
        return;
      }
    } else {
      setMetas(ms => [...ms, {
        id: fNome.toLowerCase().replace(/\s+/g,"-")+"-"+Date.now(),
        nome:fNome, desc:fDesc, emoji:fEmoji, meta:mN,
        atual: parseFloat(fAtual.replace(",",".")) || 0,
        mensal: parseFloat(fMensal.replace(",",".")) || 0,
        prazo: fPrazo || "Sem prazo", prioridade:fPrio, cor:fCor, corLight,
      }]);
    }
    setSuccess(true);
    setTimeout(() => { setSuccess(false); setDrawer(false); setEditingMeta(null); resetDrawer(); }, 1100);
  };

  const handleEdit = async () => {
    if (!editingMeta || !fNome || !fMeta) return;
    const corLight = CORES.find(c => c.hex === fCor)?.light || "#EFF6FF";
    if (shouldUseRealData) {
      try {
        await goalsData.updateGoal(editingMeta.id, buildUpdateGoalPayload({
          nome: fNome,
          desc: fDesc,
          meta: fMeta,
          atual: fAtual,
          prazo: fPrazo,
          status: editingMeta.status || "active",
        }));
      } catch {
        return;
      }
    } else {
      setMetas(ms => ms.map(m => m.id === editingMeta.id ? {
        ...m, nome:fNome, desc:fDesc, emoji:fEmoji,
        meta: parseFloat(fMeta.replace(",",".")) || 0,
        atual: parseFloat(fAtual.replace(",",".")) || 0,
        mensal: parseFloat(fMensal.replace(",",".")) || 0,
        prazo: fPrazo || "Sem prazo", prioridade:fPrio, cor:fCor, corLight,
      } : m));
    }
    setSuccess(true);
    setTimeout(() => { setSuccess(false); setDrawer(false); setEditingMeta(null); resetDrawer(); }, 1100);
  };

  const openEditMeta = (meta) => {
    setFNome(meta.nome); setFDesc(meta.desc || ""); setFEmoji(meta.emoji);
    setFMeta(String(meta.meta)); setFAtual(String(meta.atual));
    setFMensal(String(meta.mensal)); setFPrazo(meta.prazo === "Sem prazo" ? "" : meta.prazo);
    setFPrio(meta.prioridade); setFCor(meta.cor);
    setEditingMeta(meta); setDrawer(true);
  };

  const Ring = ({ valor, max, cor, size=80, stroke=7 }) => {
    const r = (size-stroke)/2, circ = 2*Math.PI*r;
    const dash = (Math.min(100, Math.round(valor/max*100))/100)*circ;
    return (
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)", flexShrink:0 }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.grayLight} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={cor} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition:"stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
      </svg>
    );
  };

  const PRIO_ORDER = { alta:0, media:1, baixa:2 };
  const sorted = [...metas].sort((a,b) => PRIO_ORDER[a.prioridade] - PRIO_ORDER[b.prioridade]);

  const FL = ({ children }) => (
    <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:7 }}>{children}</div>
  );
  const FI = ({ value, onChange, placeholder, prefix }) => (
    <div style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 12px", border:`1px solid ${T.border}`, borderRadius:9, background:T.surface, transition:"border-color 0.15s" }}
      onFocusCapture={e => e.currentTarget.style.borderColor = T.blue}
      onBlurCapture={e  => e.currentTarget.style.borderColor = T.border}>
      {prefix && <span style={{ ...G, fontSize:13, fontWeight:700, color:T.inkLight }}>{prefix}</span>}
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ ...G, flex:1, border:"none", outline:"none", background:"transparent", fontSize:13, color:T.ink }} />
    </div>
  );

  // drawer preview values
  const metaNum  = parseFloat(fMeta.replace(",","."))   || 0;
  const atualNum = parseFloat(fAtual.replace(",","."))  || 0;
  const mensalNum= parseFloat(fMensal.replace(",",".")) || 1;
  const restD    = Math.max(0, metaNum - atualNum);
  const mesesD   = mensalNum > 0 ? Math.ceil(restD / mensalNum) : null;
  const pctD     = metaNum > 0 ? Math.min(100, Math.round(atualNum / metaNum * 100)) : 0;
  const corLight = CORES.find(c => c.hex === fCor)?.light || "#EFF6FF";

  /* ── Shared drawer body ── */
  const DrawerBody = () => (
    <div style={{ flex:1, overflowY:"auto", padding:"20px", display:"flex", flexDirection:"column", gap:16 }}>
      {/* Preview ring */}
      <div style={{ display:"flex", alignItems:"center", gap:14, background:`${fCor}11`, borderRadius:12, padding:"11px 14px" }}>
        <div style={{ position:"relative", flexShrink:0 }}>
          <Ring valor={atualNum} max={metaNum||100} cor={fCor} size={52} stroke={5} />
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:16 }}>{fEmoji}</span>
          </div>
        </div>
        <div>
          <div style={{ ...G, fontSize:14, fontWeight:700, color:T.ink }}>{fNome || "Sua meta"}</div>
          {metaNum > 0 && <div style={{ ...G, ...NUM, fontSize:11, color:fCor }}>{pctD}% · falta {fmtBRL(restD)}</div>}
        </div>
      </div>
      <div><FL>Nome da meta</FL><FI value={fNome} onChange={setFNome} placeholder="ex: Viagem para o Japão" /></div>
      <div><FL>Descrição (opcional)</FL><FI value={fDesc} onChange={setFDesc} placeholder="Detalhe o objetivo..." /></div>
      <div>
        <FL>Ícone</FL>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {EMOJIS.map(e => (
            <button key={e} onClick={() => setFEmoji(e)} style={{ width:34, height:34, borderRadius:8, border:`2px solid ${fEmoji===e?T.ink:T.border}`, background:fEmoji===e?T.bg:T.surface, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>{e}</button>
          ))}
        </div>
      </div>
      <div>
        <FL>Cor</FL>
        <div style={{ display:"flex", gap:isMobile?10:6, flexWrap:"wrap" }}>
          {CORES.map(c => (
            <button key={c.hex} onClick={() => setFCor(c.hex)} style={{ flex:isMobile?1:undefined, height:isMobile?30:28, width:isMobile?undefined:28, borderRadius:7, background:c.hex, border:`3px solid ${fCor===c.hex?T.ink:"transparent"}`, cursor:"pointer" }} />
          ))}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, minWidth:0 }}>
        <div style={{minWidth:0}}><FL>Valor da meta</FL><FI value={fMeta} onChange={setFMeta} placeholder="0,00" prefix="R$" /></div>
        <div style={{minWidth:0}}><FL>Já guardei</FL><FI value={fAtual} onChange={setFAtual} placeholder="0,00" prefix="R$" /></div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, minWidth:0 }}>
        <div style={{minWidth:0}}><FL>Contribuição mensal</FL><FI value={fMensal} onChange={setFMensal} placeholder="0,00" prefix="R$" /></div>
        <div style={{minWidth:0}}><FL>Prazo estimado</FL><FI value={fPrazo} onChange={setFPrazo} placeholder="ex: Dez 2027" /></div>
      </div>
      <div>
        <FL>Prioridade</FL>
        <div style={{ display:"flex", gap:8 }}>
          {[["alta","Urgente",T.red,T.redLight],["media","Média",T.amber,T.amberLight],["baixa","Longo prazo",T.inkMid,T.grayLight]].map(([id,label,cor,corL]) => (
            <button key={id} onClick={() => setFPrio(id)} style={{ ...G, flex:1, padding:"8px 0", borderRadius:9, border:`1.5px solid ${fPrio===id?cor:T.border}`, background:fPrio===id?corL:T.surface, color:fPrio===id?cor:T.inkMid, fontSize:11, fontWeight:700, cursor:"pointer" }}>{label}</button>
          ))}
        </div>
      </div>
      {metaNum > 0 && mensalNum > 0 && (
        <div style={{ background:`${fCor}11`, border:`1px solid ${fCor}22`, borderRadius:12, padding:"12px 14px" }}>
          <div style={{ ...G, fontSize:10, fontWeight:700, color:fCor, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>Projeção</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            {[{ label:"Progresso", val:`${pctD}%` }, { label:"Falta", val:fmtBRL(restD) }, { label:"Conclusão", val:`${mesesD}m` }].map((s,i) => (
              <div key={i}>
                <div style={{ ...G, fontSize:8, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:2 }}>{s.label}</div>
                <div style={{ ...G, ...NUM, fontSize:13, fontWeight:800, color:fCor }}>{s.val}</div>
              </div>
            ))}
          </div>
          <div style={{ height:4, background:`${fCor}22`, borderRadius:99, overflow:"hidden", marginTop:8 }}>
            <div style={{ height:"100%", width:`${pctD}%`, background:fCor, borderRadius:99 }} />
          </div>
        </div>
      )}
    </div>
  );

  /* ── Desktop MetaCard ── */
  const MetaCard = ({ meta }) => {
    const p = pct(meta.atual, meta.meta);
    const restante = meta.meta - meta.atual;
    const mesesR = Math.ceil(restante / (meta.mensal||1));
    const prazoM = prazoParaMeses(meta.prazo);
    const onTrack = prazoM ? mesesR <= prazoM : mesesR <= 36;
    return (
      <div className="fincla-card-lift" style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:"20px", display:"flex", flexDirection:"column", gap:14, transition:"box-shadow 0.15s, transform 0.15s" }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow=T.md; e.currentTarget.style.transform="translateY(-2px)"; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow="none"; e.currentTarget.style.transform="translateY(0)"; }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ position:"relative", flexShrink:0 }}>
            <Ring valor={meta.atual} max={meta.meta} cor={meta.cor} size={76} stroke={6} />
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:18 }}>{meta.emoji}</span>
            </div>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginBottom:3 }}>
              <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink }}>{meta.nome}</div>
              <span style={{ ...G, fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:99, flexShrink:0,
                background:meta.prioridade==="alta"?T.redLight:meta.prioridade==="media"?T.amberLight:T.grayLight,
                color:meta.prioridade==="alta"?T.red:meta.prioridade==="media"?T.amber:T.inkMid }}>
                {meta.prioridade==="alta"?"urgente":meta.prioridade==="media"?"média":"longo prazo"}
              </span>
            </div>
            <div style={{ ...G, fontSize:10, color:T.inkLight, marginBottom:8 }}>{meta.desc}</div>
            <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
              <span style={{ ...G, ...NUM, fontSize:18, fontWeight:800, color:meta.cor }}>{fmtBRL(meta.atual)}</span>
              <span style={{ ...G, ...NUM, fontSize:11, color:T.inkLight }}>/ {fmtBRL(meta.meta)}</span>
            </div>
          </div>
        </div>
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ ...G, fontSize:10, fontWeight:600, color:meta.cor }}>{p}% concluído</span>
            <span style={{ ...G, ...NUM, fontSize:10, color:T.inkLight }}>falta {fmtBRL(restante)}</span>
          </div>
          <div style={{ height:5, background:T.grayLight, borderRadius:99, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${p}%`, background:meta.cor, borderRadius:99, transition:"width 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
          {[
            { label:"Mensal",   val:`${fmtBRL(meta.mensal)}/mês` },
            { label:"Prazo",    val:meta.prazo },
            { label:"Projeção", val:`${mesesR} meses`, warn:!onTrack },
          ].map((s,i) => (
            <div key={i} style={{ background:s.warn?T.amberLight:T.bg, borderRadius:8, padding:"7px 8px" }}>
              <div style={{ ...G, fontSize:8, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2 }}>{s.label}</div>
              <div style={{ ...G, ...NUM, fontSize:11, fontWeight:700, color:s.warn?T.amber:T.ink }}>{s.val}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => onContribuir && onContribuir(meta)}
            style={{ ...G, flex:1, padding:"9px", borderRadius:10, border:`1.5px solid ${meta.cor}22`, background:meta.corLight, color:meta.cor, fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background=meta.cor; e.currentTarget.style.color="#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background=meta.corLight; e.currentTarget.style.color=meta.cor; }}>
            + Contribuir agora
          </button>
          <button onClick={() => openEditMeta(meta)} style={{ ...G, width:36, height:36, borderRadius:9, border:`1px solid ${T.border}`, background:T.surface, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 }}
            onMouseEnter={e => e.currentTarget.style.background=T.bg}
            onMouseLeave={e => e.currentTarget.style.background=T.surface}>
            <Pencil size={13} color={T.inkMid} />
          </button>
        </div>
      </div>
    );
  };

  // When metas=[] and drawer is open, render minimal container so drawer can show
  if (metas.length === 0 && drawer) return (
    <>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between" }}>
          <div style={{ fontFamily:"'Geist',sans-serif", fontSize:22, fontWeight:800, color:T.ink }}>Minhas <span style={{ fontFamily:"'Instrument Serif',serif", fontStyle:"italic", fontWeight:400 }}>Metas</span></div>
          <button onClick={() => { setDrawer(false); resetDrawer(); }} style={{ fontFamily:"'Geist',sans-serif", background:"none", border:"none", cursor:"pointer", color:"#8C8C86", fontSize:13 }}>Cancelar</button>
        </div>
      </div>
      {/* Drawer only — no KPI grid with NaN values */}
      {isMobile ? (
        <div style={{ position:"fixed", inset:0, zIndex:300, overflow:"hidden", display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
          <div onClick={() => { setDrawer(false); resetDrawer(); }} style={{ flex:1 }}/>
          <div style={{ position:"relative", background:T.surface, borderRadius:"24px 24px 0 0", maxHeight:"90vh", overflowY:"auto", overflowX:"hidden" }}>
            <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}><div style={{ width:36, height:4, borderRadius:99, background:T.inkGhost }}/></div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 20px 12px" }}>
              <div style={{ fontFamily:"'Geist',sans-serif", fontSize:16, fontWeight:800, color:T.ink }}>Nova Meta</div>
              <button onClick={() => { setDrawer(false); resetDrawer(); }} style={{ background:"none", border:"none", cursor:"pointer" }}><X size={16} color={T.inkLight}/></button>
            </div>
            <DrawerBody/>
            <div style={{ padding:"14px 20px", borderTop:`1px solid ${T.border}`, display:"flex", gap:10, background:T.surface }}>
              <button onClick={() => { setDrawer(false); resetDrawer(); }} style={{ fontFamily:"'Geist',sans-serif", padding:"11px 16px", borderRadius:10, border:`1px solid ${T.border}`, background:"none", color:T.inkMid, fontSize:13, fontWeight:600, cursor:"pointer" }}>Cancelar</button>
              <button onClick={() => { void handleSave(); }} disabled={!fNome||!fMeta||goalsData.isSaving} style={{ fontFamily:"'Geist',sans-serif", flex:1, padding:"11px", borderRadius:10, border:"none", background:success?T.green:(!fNome||!fMeta)?T.inkGhost:T.ink, fontSize:13, fontWeight:700, color:"#fff", cursor:(!fNome||!fMeta||goalsData.isSaving)?"not-allowed":"pointer" }}>
                {success ? "✓ Meta criada!" : goalsData.isSaving ? "Salvando..." : "Criar meta"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ position:"fixed", inset:0, zIndex:200, overflow:"hidden", display:"flex", justifyContent:"flex-end" }}>
          <div onClick={() => { setDrawer(false); resetDrawer(); }} style={{ flex:1, background:"rgba(0,0,0,0.2)",  }}/>
          <div style={{ position:"relative", width:Math.min(420, window.innerWidth - 32), background:T.surface, borderLeft:`1px solid ${T.border}`, display:"flex", flexDirection:"column", overflowX:"hidden" }}>
            <div style={{ padding:"16px 20px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ fontFamily:"'Geist',sans-serif", fontSize:15, fontWeight:800, color:T.ink }}>Nova Meta</div>
              <button onClick={() => { setDrawer(false); resetDrawer(); }} style={{ background:"none", border:"none", cursor:"pointer" }}><X size={16} color={T.inkLight}/></button>
            </div>
            <DrawerBody/>
            <div style={{ padding:"14px 20px", borderTop:`1px solid ${T.border}`, display:"flex", gap:10 }}>
              <button onClick={() => { setDrawer(false); resetDrawer(); }} style={{ fontFamily:"'Geist',sans-serif", padding:"11px 16px", borderRadius:10, border:`1px solid ${T.border}`, background:"none", color:T.inkMid, fontSize:13, fontWeight:600, cursor:"pointer" }}>Cancelar</button>
              <button onClick={() => { void handleSave(); }} disabled={!fNome||!fMeta||goalsData.isSaving} style={{ fontFamily:"'Geist',sans-serif", flex:1, padding:"11px", borderRadius:10, border:"none", background:success?T.green:(!fNome||!fMeta)?T.inkGhost:T.ink, fontSize:13, fontWeight:700, color:"#fff", cursor:(!fNome||!fMeta||goalsData.isSaving)?"not-allowed":"pointer" }}>
                {success ? "✓ Meta criada!" : goalsData.isSaving ? "Salvando..." : "Criar meta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
  return (
    <>
    <style>{`@keyframes metaFadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

    {isMobile ? (
    /* ══ MOBILE ══ */
    <div style={{ display:"flex", flexDirection:"column", gap:0, paddingBottom:80 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingBottom:16 }}>
        <PageTitle sans="Minhas" serif="Metas" />
        <button onClick={() => { setEditingMeta(null); resetDrawer(); setDrawer(true); }} style={{ ...G, display:"flex", alignItems:"center", gap:5, background:T.ink, border:"none", borderRadius:9, padding:"8px 13px", fontSize:12, fontWeight:700, color:"#fff", cursor:"pointer" }}>
          <Plus size={13} /> Nova
        </button>
      </div>
      {/* Hero dark card */}
      <div style={{ background:T.darkBg, borderRadius:18, padding:"18px 20px", marginBottom:18, boxShadow:T.dark, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-30, right:-30, width:130, height:130, borderRadius:"50%", background:`${T.green}18`, pointerEvents:"none" }} />
        <div style={{ display:"flex", alignItems:"center", gap:18 }}>
          <div style={{ position:"relative", flexShrink:0 }}>
            <Ring valor={totalAtual} max={totalMeta} cor={T.green} size={72} stroke={6} />
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ ...G, ...NUM, fontSize:14, fontWeight:800, color:"#fff", lineHeight:1 }}>{totalPct}%</span>
            </div>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ ...G, fontSize:10, fontWeight:700, color:T.darkMuted, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4 }}>Portfolio de metas</div>
            <div style={{ ...M_MONO, ...NUM, fontSize:20, fontWeight:800, color:"#fff", letterSpacing:"-0.01em", marginBottom:2 }}>{fmtBRL(totalAtual)}</div>
            <div style={{ ...G, fontSize:11, color:T.darkMuted }}>de {fmtBRL(totalMeta)} em {metas.length} metas</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:0, marginTop:14, borderTop:"1px solid rgba(255,255,255,0.08)", paddingTop:14 }}>
          {[
            { label:"No ritmo",       val:`${metasOK} de ${metas.length}`, color:"#86EFAC" },
            { label:"Próx. conclusão", val:proximaMeta?.prazo||"—",        color:"#fff" },
            { label:"Contribuição",   val:`${fmtBRL(metas.reduce((s,m)=>s+m.mensal,0))}/mês`, color:"#fff" },
          ].map((s,i) => (
            <div key={i} style={{ flex:1, paddingLeft:i>0?12:0, borderLeft:i>0?"1px solid rgba(255,255,255,0.08)":"none" }}>
              <div style={{ ...G, fontSize:8, fontWeight:700, color:T.darkMuted, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>{s.label}</div>
              <div style={{ ...G, ...NUM, fontSize:12, fontWeight:700, color:s.color }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Goal list */}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {sorted.map((meta, idx) => {
          const p = pct(meta.atual, meta.meta);
          const restante = meta.meta - meta.atual;
          const mesesR = Math.ceil(restante / (meta.mensal||1));
          const prazoM = prazoParaMeses(meta.prazo);
          const onTrack = prazoM ? mesesR <= prazoM : mesesR <= 36;
          return (
            <div key={meta.id} style={{ background:T.surface, borderRadius:16, overflow:"hidden", border:`1px solid ${T.border}`, animation:`metaFadeIn 0.3s ease-out ${idx*0.05}s both` }}>
              <div style={{ height:3, background:meta.cor, width:`${p}%`, transition:"width 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
              <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:12 }}>
                {/* Top row */}
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ position:"relative", flexShrink:0 }}>
                    <Ring valor={meta.atual} max={meta.meta} cor={meta.cor} size={56} stroke={5} />
                    <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <span style={{ fontSize:14 }}>{meta.emoji}</span>
                    </div>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:2 }}>
                      <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{meta.nome}</div>
                      <span style={{ ...G, fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:99, flexShrink:0,
                        background:meta.prioridade==="alta"?T.redLight:meta.prioridade==="media"?T.amberLight:T.grayLight,
                        color:meta.prioridade==="alta"?T.red:meta.prioridade==="media"?T.amber:T.inkMid }}>
                        {meta.prioridade==="alta"?"urgente":meta.prioridade==="media"?"média":"longo prazo"}
                      </span>
                    </div>
                    <div style={{ ...G, fontSize:10, color:T.inkLight, marginBottom:6 }}>{meta.desc}</div>
                    <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
                      <span style={{ ...G, ...NUM, fontSize:16, fontWeight:800, color:meta.cor }}>{fmtBRL(meta.atual)}</span>
                      <span style={{ ...G, ...NUM, fontSize:10, color:T.inkLight }}>/ {fmtBRL(meta.meta)}</span>
                      <span style={{ ...G, fontSize:10, fontWeight:600, color:meta.cor, marginLeft:4 }}>{p}%</span>
                    </div>
                  </div>
                </div>
                {/* Stats chips */}
                <div style={{ display:"flex", gap:6 }}>
                  {[
                    { label:`${fmtBRL(meta.mensal)}/mês`, icon:"💰", clickable:false },
                    { label:meta.prazo, icon:"📅", clickable:false },
                    { label:onTrack?`${mesesR} meses`:`${mesesR}m`, icon:onTrack?"✅":"⏰", warn:!onTrack, clickable:true },
                  ].map((s,i) => (
                    s.clickable ? (
                      <button key={i} onClick={() => setTooltipMeta(tooltipMeta===meta.id ? null : meta.id)}
                        style={{ display:"flex", alignItems:"center", gap:4, background:s.warn?T.amberLight:T.bg, borderRadius:8, padding:"5px 8px", flex:1, border:`1px solid ${tooltipMeta===meta.id?(s.warn?T.amber:T.green):"transparent"}`, cursor:"pointer" }}>
                        <span style={{ fontSize:10 }}>{s.icon}</span>
                        <span style={{ ...G, ...NUM, fontSize:10, fontWeight:600, color:s.warn?T.amber:T.ink }}>{s.label}</span>
                        <span style={{ ...G, fontSize:10, color:s.warn?T.amber:T.green, marginLeft:"auto" }}>{tooltipMeta===meta.id?"▲":"ⓘ"}</span>
                      </button>
                    ) : (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:4, background:T.bg, borderRadius:8, padding:"5px 8px", flex:1 }}>
                        <span style={{ fontSize:10 }}>{s.icon}</span>
                        <span style={{ ...G, ...NUM, fontSize:10, fontWeight:600, color:T.ink, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.label}</span>
                      </div>
                    )
                  ))}
                </div>
                {/* Tooltip */}
                {tooltipMeta === meta.id && (() => {
                  const prazoM2 = prazoParaMeses(meta.prazo);
                  const onT2    = prazoM2 ? mesesR <= prazoM2 : mesesR <= 36;
                  const ideal   = prazoM2 ? Math.ceil((meta.meta-meta.atual)/prazoM2) : null;
                  return (
                    <div style={{ background:onT2?T.greenLight:T.amberLight, border:`1px solid ${onT2?T.green:T.amber}33`, borderRadius:12, padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                        <div style={{ ...G, fontSize:11, fontWeight:700, color:onT2?T.green:T.amber }}>{onT2?"✅ Meta no prazo":"⏰ Meta atrasada"}</div>
                        <button onClick={() => setTooltipMeta(null)} style={{ background:"none", border:"none", cursor:"pointer", padding:2, color:T.inkLight }}><X size={12} /></button>
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                        {[
                          { label:"Projeção atual",  val:`${mesesR} meses` },
                          { label:"Prazo definido",  val:prazoM2?`${prazoM2} meses`:"Sem prazo" },
                          { label:"Contribuição",    val:`${fmtBRL(meta.mensal)}/mês` },
                          { label:"Falta guardar",   val:fmtBRL(meta.meta-meta.atual), color:onT2?T.green:T.amber },
                        ].map((row,ri) => (
                          <div key={ri}>
                            <div style={{ ...G, fontSize:8, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:2 }}>{row.label}</div>
                            <div style={{ ...G, ...NUM, fontSize:12, fontWeight:700, color:row.color||T.ink }}>{row.val}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ ...G, fontSize:11, color:T.inkMid, lineHeight:1.55, borderTop:`1px solid ${onT2?T.green:T.amber}22`, paddingTop:8 }}>
                        {onT2
                          ? `No ritmo atual de ${fmtBRL(meta.mensal)}/mês, você conclui em ${mesesR} meses — dentro do prazo de ${meta.prazo}.`
                          : `No ritmo atual, você concluiria em ${mesesR} meses, mas o prazo é ${meta.prazo}${prazoM2?` (${prazoM2} meses)`:""}.`}
                      </div>
                      {!onT2 && ideal && (
                        <button onClick={() => { setMetas(ms => ms.map(m => m.id===meta.id?{...m,mensal:ideal}:m)); setTooltipMeta(null); }}
                          style={{ ...G, width:"100%", padding:"9px 12px", borderRadius:10, background:T.amber, border:"none", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                          ⚡ Readequar para {fmtBRL(ideal)}/mês
                        </button>
                      )}
                    </div>
                  );
                })()}
                {/* CTA row */}
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => onContribuir && onContribuir(meta)}
                    style={{ ...G, flex:1, padding:"10px", borderRadius:10, border:`1.5px solid ${meta.cor}33`, background:meta.corLight, color:meta.cor, fontSize:12, fontWeight:700, cursor:"pointer" }}
                    onMouseEnter={e => { e.currentTarget.style.background=meta.cor; e.currentTarget.style.color="#fff"; }}
                    onMouseLeave={e => { e.currentTarget.style.background=meta.corLight; e.currentTarget.style.color=meta.cor; }}>
                    + Contribuir
                  </button>
                  <button onClick={() => openEditMeta(meta)} style={{ ...G, width:40, height:40, borderRadius:10, border:`1px solid ${T.border}`, background:T.surface, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 }}
                    onMouseEnter={e => e.currentTarget.style.background=T.bg}
                    onMouseLeave={e => e.currentTarget.style.background=T.surface}>
                    <Pencil size={14} color={T.inkMid} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* FAB */}
      <div style={{ position:"fixed", bottom:24, right:20, zIndex:100 }}>
        <button onClick={() => { setEditingMeta(null); resetDrawer(); setDrawer(true); }}
          style={{ ...G, display:"flex", alignItems:"center", gap:7, height:50, padding:"0 20px", background:T.ink, border:"none", borderRadius:25, fontSize:13, fontWeight:700, color:"#fff", cursor:"pointer", boxShadow:"0 6px 20px rgba(0,0,0,0.25)" }}>
          <Plus size={16} /> Nova Meta
        </button>
      </div>
      {/* Bottom sheet */}
      {drawer && (
        <div style={{ position:"fixed", inset:0, zIndex:300, overflow:"hidden", display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
          <div onClick={() => { setDrawer(false); setEditingMeta(null); resetDrawer(); }} style={{ position:"absolute", inset:0, background:"rgba(15,23,35,0.5)" }} />
          <div style={{ position:"relative", background:T.surface, borderRadius:"24px 24px 0 0", maxHeight:"92vh", display:"flex", flexDirection:"column", animation:"sheetUp 0.5s cubic-bezier(0.32,0.72,0,1) both" }}>
            <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
              <div style={{ width:36, height:4, borderRadius:99, background:T.inkGhost }} />
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 20px 14px", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
              <div style={{ ...G, fontSize:16, fontWeight:800, color:T.ink }}>{editingMeta?"Editar Meta":"Nova Meta"}</div>
              <button onClick={() => { setDrawer(false); setEditingMeta(null); resetDrawer(); }} style={{ background:T.grayLight, border:"none", cursor:"pointer", padding:6, borderRadius:8, display:"flex" }}><X size={15} color={T.inkMid} /></button>
            </div>
            <DrawerBody />
            <div style={{ padding:"14px 20px", borderTop:`1px solid ${T.border}`, background:T.surface, flexShrink:0 }}>
              <button onClick={() => { void (editingMeta ? handleEdit() : handleSave()); }} disabled={!fNome||!fMeta||goalsData.isSaving}
                style={{ ...G, width:"100%", padding:"14px", borderRadius:12, border:"none",
                  background:success?T.green:(!fNome||!fMeta)?T.inkGhost:editingMeta?T.blue:T.ink,
                  fontSize:14, fontWeight:700, color:"#fff", cursor:(!fNome||!fMeta||goalsData.isSaving)?"not-allowed":"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:7, transition:"background 0.2s" }}>
                {success ? <><Check size={15} /> {editingMeta?"Salvo!":"Meta criada!"}</> : goalsData.isSaving ? "Salvando..." : editingMeta?"Salvar alterações":"Criar meta →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    ) : (
    /* ══ DESKTOP ══ */
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <PageTitle sans="Minhas" serif="Metas" />
        <button onClick={() => { setEditingMeta(null); resetDrawer(); setDrawer(true); }}
          style={{ ...G, display:"flex", alignItems:"center", gap:6, background:T.ink, border:"none", borderRadius:9, padding:"8px 14px", fontSize:12, fontWeight:700, color:"#fff", cursor:"pointer" }}>
          <Plus size={13} /> Nova Meta
        </button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {[
          { label:"Total guardado",   val:fmtBRL(totalAtual), sub:`de ${fmtBRL(totalMeta)} em metas`,                                                                color:T.ink   },
          { label:"Progresso global", val:`${totalPct}%`,     sub:"média ponderada",                                                                                color:T.blue  },
          { label:"Metas no ritmo",   val:`${metasOK} de ${metas.length}`, sub:"≥ 80% concluídas",                                                                  color:T.green },
          { label:"Próx. conclusão",  val:proximaMeta?proximaMeta.prazo:"—", sub:proximaMeta?`${proximaMeta.nome} · ${fmtBRL(proximaMeta.atual)} / ${fmtBRL(proximaMeta.meta)}`:"Nenhuma", color:T.purple },
        ].map((k,i) => (
          <div key={i} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:6 }}>{k.label}</div>
            <div style={{ ...G, ...NUM, fontSize:20, fontWeight:800, color:k.color, letterSpacing:"-0.01em" }}>{k.val}</div>
            <div style={{ ...G, fontSize:10, color:T.inkLight, marginTop:3 }}>{k.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        {sorted.map(m => <MetaCard key={m.id} meta={m} />)}
      </div>
      {/* Desktop drawer */}
      {drawer && (
        <div style={{ position:"fixed", inset:0, zIndex:200, overflow:"hidden", display:"flex", justifyContent:"flex-end" }}>
          <style>{`@keyframes drawerIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
          <div onClick={() => { setDrawer(false); setEditingMeta(null); resetDrawer(); }} style={{ position:"absolute", inset:0, background:"rgba(15,23,35,0.38)" }} />
          <div style={{ position:"relative", width:Math.min(420, typeof window!=="undefined"?window.innerWidth-40:420), background:T.surface, overflowX:"hidden", borderLeft:`1px solid ${T.border}`, boxShadow:"-8px 0 32px rgba(0,0,0,0.12)", display:"flex", flexDirection:"column", height:"100vh", animation:"drawerIn 0.22s ease-out" }}>
            <div style={{ padding:"16px 20px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
              <div style={{ ...G, fontSize:15, fontWeight:800, color:T.ink }}>{editingMeta?"Editar Meta":"Nova Meta"}</div>
              <button onClick={() => { setDrawer(false); setEditingMeta(null); resetDrawer(); }} style={{ background:"none", border:"none", cursor:"pointer", padding:4, borderRadius:6, display:"flex" }}
                onMouseEnter={e => e.currentTarget.style.background=T.bg}
                onMouseLeave={e => e.currentTarget.style.background="none"}>
                <X size={16} color={T.inkLight} />
              </button>
            </div>
            <DrawerBody />
            <div style={{ padding:"14px 20px", borderTop:`1px solid ${T.border}`, display:"flex", gap:8, flexShrink:0, background:T.surface }}>
              <button onClick={() => { setDrawer(false); setEditingMeta(null); resetDrawer(); }}
                style={{ ...G, padding:"11px 16px", borderRadius:10, border:`1px solid ${T.border}`, background:T.surface, fontSize:13, fontWeight:600, color:T.inkMid, cursor:"pointer" }}>
                Cancelar
              </button>
              <button onClick={() => { void (editingMeta ? handleEdit() : handleSave()); }} disabled={!fNome||!fMeta||goalsData.isSaving}
                style={{ ...G, flex:1, padding:"11px", borderRadius:10, border:"none",
                  background:success?T.green:(!fNome||!fMeta)?T.inkGhost:editingMeta?T.blue:T.ink,
                  fontSize:13, fontWeight:700, color:"#fff", cursor:(!fNome||!fMeta||goalsData.isSaving)?"not-allowed":"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:6, transition:"background 0.2s" }}>
                {success ? <><Check size={14} /> {editingMeta?"Salvo!":"Meta criada!"}</> : goalsData.isSaving ? "Salvando..." : editingMeta?"Salvar alterações":"Criar meta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    )}
    </>
  );
}
