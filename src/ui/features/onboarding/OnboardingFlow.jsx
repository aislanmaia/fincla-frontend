import React, { useState } from "react";
import { T } from "../../tokens";
import { G, S, NUM } from "../../typography";
import { ONBOARDING_CATEGORY_ROWS } from "../../data/onboardingFlowCategories.js";
import { CategoryLucideIcon } from "../../components/CategoryLucideIcon.jsx";

/* ─── ONBOARDING DATA & COMPONENTS ──────────────────────────── */

const STEPS = [
  { id:"welcome",    leftBg:"#0F0F0D", leftAcc:"#F8F7F5", accent:"#0F0F0D", accentBg:"rgba(15,15,13,0.06)", leftDec:"✦",   leftNum:null, leftH:"Bem-vindo ao Fincla",        leftS:"A plataforma de finanças para famílias e organizações que querem clareza sobre seu dinheiro." },
  { id:"org",        leftBg:"#1E3A5F", leftAcc:"#93C5FD", accent:"#1E3A5F", accentBg:"#EFF6FF",            leftDec:null,  leftNum:"01", leftH:"Quem usa o Fincla?",         leftS:"Dê uma identidade à sua organização. Isso personaliza a linguagem e os relatórios." },
  { id:"categorias", leftBg:"#14532D", leftAcc:"#86EFAC", accent:"#166534", accentBg:"#ECFDF5",            leftDec:null,  leftNum:"02", leftH:"Onde vai o seu dinheiro?",  leftS:"As categorias selecionadas aparecem primeiro ao lançar transações — menos cliques no dia a dia." },
  { id:"cartoes",    leftBg:"#4C1D95", leftAcc:"#C4B5FD", accent:"#4C1D95", accentBg:"#F5F3FF",            leftDec:null,  leftNum:"03", leftH:"Cartões de crédito?",       leftS:"Se você usa cartões, o Fincla rastreia faturas, parcelas e assinaturas automaticamente." },
  { id:"receita",    leftBg:"#064E3B", leftAcc:"#6EE7B7", accent:"#065F46", accentBg:"#ECFDF5",            leftDec:null,  leftNum:"04", leftH:"Sua receita mensal",        leftS:"Registre uma receita recorrente agora para que os relatórios já nasçam calibrados para a sua realidade." },
  { id:"membros",    leftBg:"#1E1B4B", leftAcc:"#A5B4FC", accent:"#1E1B4B", accentBg:"#EEF2FF",            leftDec:null,  leftNum:"05", leftH:"Quem mais faz parte?",      leftS:"Convide membros para lançar transações juntos. Você é o owner — só você pode convidar ou remover." },
  { id:"pronto",     leftBg:"#0F0F0D", leftAcc:"#F8F7F5", accent:"#0F0F0D", accentBg:"rgba(15,15,13,0.06)", leftDec:"✓", leftNum:null, leftH:"Tudo pronto!",              leftS:"Sua organização está configurada. Vamos ao dashboard." },
];

/** IDs alinhados ao contrato da API: personal | couple | business (respostas canônicas em inglês). */
const ORG_TIPOS = [
  { id: "couple",   l: "Casal",   ic: "💑", s: "Finanças compartilhadas a dois" },
  { id: "business", l: "Negócio", ic: "💼", s: "Pequena empresa ou MEI" },
  { id: "personal", l: "Pessoal", ic: "✦",  s: "Uso individual ou grupo informal" },
];
const Arrow = ({c="#fff"}) => (
  <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
    <path d="M3 8h10M9 4l4 4-4 4" stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* Defined OUTSIDE App — prevents remount on every render (focus loss bug) */
const SI = ({value,onChange,placeholder,type="text",autoFocus=false,pre=null,accent,accentBg}) => {
  const [f,setF]=useState(false);
  return (
    <div style={{position:"relative",display:"flex",alignItems:"center"}}>
      {pre&&<span style={{...G,position:"absolute",left:13,fontSize:14,fontWeight:700,
        color:f?accent:T.inkLight,transition:"color 0.15s",pointerEvents:"none"}}>{pre}</span>}
      <input value={value} onChange={onChange} placeholder={placeholder}
        type={type} autoFocus={autoFocus}
        onFocus={()=>setF(true)} onBlur={()=>setF(false)}
        style={{...G,width:"100%",padding:pre?"12px 14px 12px 30px":"12px 14px",
          fontSize:14,color:T.ink,background:T.surface,
          border:`1.5px solid ${f?accent:T.border}`,borderRadius:10,outline:"none",
          boxShadow:f?`0 0 0 3px ${accentBg}`:"none",transition:"all 0.15s"}}/>
    </div>
  );
};

const CC = ({sel,onClick,ic,title,sub,large=false,accent,accentBg}) => (
  <button onClick={onClick} style={{
    padding:large?"20px 16px":"14px 16px",borderRadius:12,textAlign:"left",
    cursor:"pointer",transition:"all 0.15s",
    border:`1.5px solid ${sel?accent:T.border}`,
    background:sel?accent:T.surface,
    boxShadow:sel?`0 4px 16px ${accentBg}`:"none",
    display:"flex",flexDirection:"column",
    alignItems:large?"center":"flex-start",gap:large?8:6}}>
    <span style={{fontSize:large?28:20}}>{ic}</span>
    <span style={{...G,fontSize:13,fontWeight:700,color:sel?"#fff":T.ink}}>{title}</span>
    {sub&&<span style={{...G,fontSize:11,color:sel?"rgba(255,255,255,0.6)":T.inkLight,lineHeight:1.4}}>{sub}</span>}
  </button>
);


/* ─── ONBOARDING FLOW ───────────────────────────────────────── */

export const OnboardingFlow = ({
  onComplete,
  isMobile: mobile,
  isSubmitting = false,
  errorMessage = "",
}) => {
  const [step,setStep]   = useState(0);
  const [dir,setDir]     = useState("forward");
  const [key,setKey]     = useState(0);
  const [orgNome,setOrgNome]   = useState("");
  const [orgTipo,setOrgTipo]   = useState("couple");
  const [cats,setCats]         = useState(["moradia","alimentacao","transporte"]);
  const [temCartao,setTem]     = useState(null);
  const [cardNome,setCardNome] = useState("");
  const [cardLim,setCardLim]   = useState("");
  const [cardVenc,setCardVenc] = useState("");
  const [temRec,setTemRec]     = useState(null);
  const [recDesc,setRecDesc]   = useState("Salário");
  const [recVal,setRecVal]     = useState("");
  const [recDia,setRecDia]     = useState("5");
  const [recTipo,setRecTipo]   = useState("fixo");
  const [membros,setMembros]   = useState([""]);
  const cfg    = STEPS[step];
  const stepId = cfg.id;
  const goTo   = n => { setDir(n>step?"forward":"back"); setKey(k=>k+1); setStep(n); };
  const next   = () => goTo(Math.min(step+1,STEPS.length-1));
  const prev   = () => goTo(Math.max(step-1,0));

  const canNext = () => ({
    welcome:    true,
    org:        orgNome.trim().length>=2,
    categorias: cats.length>=1,
    cartoes:    temCartao!==null,
    receita:    temRec!==null,
    membros:    true,
    pronto:     true,
  }[stepId]);


  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:${T.bg}}
        @keyframes sfwd {from{opacity:0;transform:translateX(26px)}to{opacity:1;transform:translateX(0)}}
        @keyframes sback{from{opacity:0;transform:translateX(-26px)}to{opacity:1;transform:translateX(0)}}
        @keyframes fup  {from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fin  {from{opacity:0}to{opacity:1}}
        .fwd  {animation:sfwd  0.30s cubic-bezier(0.4,0,0.2,1) both}
        .back {animation:sback 0.30s cubic-bezier(0.4,0,0.2,1) both}
        .fup  {animation:fup   0.26s ease-out both}
        .fin  {animation:fin   0.20s ease-out both}
        input,select,button{font-family:'Geist',sans-serif}
        select{appearance:none}
      `}</style>

      <div style={{minHeight:"100vh",display:"flex",flexDirection:mobile?"column":"row"}}>

        {/* ══ LEFT ══ */}
        <div style={{
          width:mobile?"100%":330, minHeight:mobile?170:"100vh",
          background:cfg.leftBg, flexShrink:0,
          position:"relative", overflow:"hidden",
          display:"flex", flexDirection:"column", justifyContent:"space-between",
          padding:mobile?"26px 22px":"42px 34px",
          transition:"background 0.5s cubic-bezier(0.4,0,0.2,1)"}}>
          {/* orbs */}
          <div style={{position:"absolute",top:-70,right:-70,width:240,height:240,
            borderRadius:"50%",background:`${cfg.leftAcc}0E`,pointerEvents:"none",transition:"background 0.5s"}}/>
          <div style={{position:"absolute",bottom:-50,left:-30,width:170,height:170,
            borderRadius:"50%",background:`${cfg.leftAcc}07`,pointerEvents:"none",transition:"background 0.5s"}}/>
          {/* logo */}
          <div style={{position:"relative",display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:25,height:25,borderRadius:7,
              background:`${cfg.leftAcc}18`,border:`1.5px solid ${cfg.leftAcc}33`,
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{...G,fontSize:12,fontWeight:800,color:cfg.leftAcc}}>f</span>
            </div>
            <span style={{...G,fontSize:13,fontWeight:700,color:cfg.leftAcc,letterSpacing:"0.04em",opacity:0.9}}>Fincla</span>
          </div>
          {/* ← Instrument Serif italic: left panel headline only */}
          <div key={`L${step}`} className="fup" style={{position:"relative"}}>
            {cfg.leftNum&&(
              <div style={{...NUM,fontSize:mobile?52:68,fontWeight:800,
                color:`${cfg.leftAcc}14`,lineHeight:1,marginBottom:mobile?6:9,
                letterSpacing:"-0.04em",transition:"color 0.5s"}}>{cfg.leftNum}</div>
            )}
            {cfg.leftDec&&(
              <div style={{fontSize:mobile?38:50,marginBottom:10,color:cfg.leftAcc,lineHeight:1}}>{cfg.leftDec}</div>
            )}
            <h2 style={{...S,fontSize:mobile?18:24,color:cfg.leftAcc,lineHeight:1.3,marginBottom:9,transition:"color 0.5s"}}>{cfg.leftH}</h2>
            <p style={{...G,fontSize:mobile?11:12,color:`${cfg.leftAcc}70`,lineHeight:1.7,maxWidth:230,transition:"color 0.5s"}}>{cfg.leftS}</p>
          </div>
          {/* step dots */}
          {!mobile&&(
            <div style={{display:"flex",gap:5}}>
              {STEPS.map((_,i)=>(
                <div key={i} style={{
                  width:i===step?17:5,height:5,borderRadius:99,
                  background:i===step?cfg.leftAcc:`${cfg.leftAcc}28`,
                  transition:"all 0.35s cubic-bezier(0.4,0,0.2,1)",
                  cursor:i<step?"pointer":"default"}}
                  onClick={()=>i<step&&goTo(i)}/>
              ))}
            </div>
          )}
        </div>

        {/* ══ RIGHT ══ */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflowY:"auto",background:T.bg}}>
          {/* progress bar — accent color */}
          <div style={{height:3,background:T.border}}>
            <div style={{height:"100%",
              width:`${(step/(STEPS.length-1))*100}%`,
              background:cfg.accent,borderRadius:"0 2px 2px 0",
              transition:"width 0.4s cubic-bezier(0.4,0,0.2,1),background 0.5s"}}/>
          </div>
          {/* step label + skip */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
            padding:mobile?"13px 22px 0":"17px 50px 0",minHeight:42}}>
            <span style={{...G,fontSize:11,fontWeight:700,color:T.inkLight,
              textTransform:"uppercase",letterSpacing:"0.08em"}}>
              {step>0&&step<STEPS.length-1?`Passo ${step} de ${STEPS.length-2}`:""}
            </span>
            {step>0&&step<STEPS.length-1&&(
              <button onClick={next} style={{...G,fontSize:11,fontWeight:600,color:T.inkLight,
                background:"none",border:"none",cursor:"pointer",
                textDecoration:"underline",textDecorationStyle:"dotted",textUnderlineOffset:3}}>
                Pular etapa →
              </button>
            )}
          </div>

          {/* content */}
          <div key={`R${key}`} className={dir==="forward"?"fwd":"back"}
            style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",
              padding:mobile?"26px 22px 40px":"38px 50px 50px",maxWidth:530,width:"100%"}}>

            {/* WELCOME */}
            {stepId==="welcome"&&(
              <div style={{display:"flex",flexDirection:"column",gap:26}}>
                <div>
                  <div style={{...G,fontSize:11,fontWeight:700,color:cfg.accent,
                    textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:10,opacity:0.75}}>
                    Novo por aqui
                  </div>
                  {/* ← Instrument Serif italic: welcome headline — brand moment */}
                  <h1 style={{...S,fontSize:mobile?30:42,color:T.ink,lineHeight:1.1,marginBottom:14}}>
                    Controle financeiro para quem decide junto
                  </h1>
                  <p style={{...G,fontSize:15,color:T.inkMid,lineHeight:1.75,maxWidth:410}}>
                    O Fincla é para famílias, casais e negócios que querem clareza sobre o dinheiro. Configure em menos de 3 minutos.
                  </p>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                  {["✦ Transações manuais","📊 Relatórios em tempo real","🔄 Recorrências e parcelas","👥 Multi-membros","🎯 Metas e orçamentos"].map(f=>(
                    <span key={f} style={{...G,fontSize:12,fontWeight:600,color:T.ink,
                      background:T.surface,border:`1px solid ${T.border}`,borderRadius:99,padding:"5px 12px"}}>{f}</span>
                  ))}
                </div>
                <button onClick={next} style={{
                  ...G,alignSelf:"flex-start",background:T.ink,color:"#fff",border:"none",
                  borderRadius:13,padding:"14px 30px",fontSize:14,fontWeight:700,cursor:"pointer",
                  display:"flex",alignItems:"center",gap:8,
                  boxShadow:"0 6px 20px rgba(15,15,13,0.18)",transition:"transform 0.15s,box-shadow 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 10px 28px rgba(15,15,13,0.25)"}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 6px 20px rgba(15,15,13,0.18)"}}>
                  Começar configuração <Arrow/>
                </button>
              </div>
            )}

            {/* ORG */}
            {stepId==="org"&&(
              <div style={{display:"flex",flexDirection:"column",gap:24}}>
                <div>
                  {/* ← Geist 800 — functional question, not brand moment */}
                  <h2 style={{...G,fontSize:mobile?24:31,fontWeight:800,color:T.ink,lineHeight:1.15,marginBottom:7}}>Sua organização</h2>
                  <p style={{...G,fontSize:14,color:T.inkMid,lineHeight:1.6}}>Como devemos chamar o grupo que usará o Fincla?</p>
                </div>
                <div>
                  <label style={{...G,fontSize:11,fontWeight:700,color:T.inkLight,
                    textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:8}}>Nome</label>
                  <SI value={orgNome} onChange={e=>setOrgNome(e.target.value)}
                    placeholder="ex: Família Alves, Studio Criativo, Apê 204…" autoFocus accent={cfg.accent} accentBg={cfg.accentBg}/>
                  {orgNome.length>=2&&(
                    <div className="fin" style={{...G,fontSize:11,color:T.green,marginTop:6,display:"flex",alignItems:"center",gap:4}}>✓ Ótimo nome</div>
                  )}
                </div>
                <div>
                  <label style={{...G,fontSize:11,fontWeight:700,color:T.inkLight,
                    textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:10}}>Tipo</label>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                    {ORG_TIPOS.map(t=><CC key={t.id} sel={orgTipo===t.id} onClick={()=>setOrgTipo(t.id)} ic={t.ic} title={t.l} sub={t.s}accent={cfg.accent} accentBg={cfg.accentBg}/>)}
                  </div>
                </div>
              </div>
            )}

            {/* CATEGORIAS */}
            {stepId==="categorias"&&(
              <div style={{display:"flex",flexDirection:"column",gap:20}}>
                <div>
                  <h2 style={{...G,fontSize:mobile?24:31,fontWeight:800,color:T.ink,lineHeight:1.15,marginBottom:7}}>Principais categorias</h2>
                  <p style={{...G,fontSize:14,color:T.inkMid,lineHeight:1.6}}>
                    Selecione as mais comuns para <strong style={{color:T.ink}}>{orgNome||"sua organização"}</strong>. Aparecem primeiro ao lançar transações.
                  </p>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                  {ONBOARDING_CATEGORY_ROWS.map((c)=>{const sel=cats.includes(c.id);return(
                    <button key={c.id} onClick={()=>setCats(cs=>cs.includes(c.id)?cs.filter(x=>x!==c.id):[...cs,c.id])}
                      style={{padding:"13px 6px",borderRadius:11,cursor:"pointer",
                        display:"flex",flexDirection:"column",alignItems:"center",gap:6,
                        border:`1.5px solid ${sel?cfg.accent:T.border}`,
                        background:sel?cfg.accent:T.surface,
                        boxShadow:sel?`0 3px 10px ${cfg.accentBg}`:"none",
                        transition:"all 0.15s"}}>
                      <CategoryLucideIcon iconKey={c.iconKey} labelPt={c.labelPt} size={22} color={sel?"#fff":T.ink} />
                      <span style={{...G,fontSize:11,fontWeight:600,color:sel?"#fff":T.ink}}>{c.labelPt}</span>
                    </button>
                  );})}
                </div>
                <span style={{...G,fontSize:12,color:T.inkLight}}>{cats.length} selecionada{cats.length!==1?"s":""} · Você pode alterar depois</span>
              </div>
            )}

            {/* CARTÕES */}
            {stepId==="cartoes"&&(
              <div style={{display:"flex",flexDirection:"column",gap:22}}>
                <div>
                  <h2 style={{...G,fontSize:mobile?24:31,fontWeight:800,color:T.ink,lineHeight:1.2,marginBottom:7}}>
                    {orgNome||"Sua organização"} usa cartões de crédito?
                  </h2>
                  <p style={{...G,fontSize:14,color:T.inkMid,lineHeight:1.6}}>O Fincla rastreia faturas, parcelas e assinaturas por cartão.</p>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {[["sim","Sim, usamos","💳"],["nao","Não usamos","💵"]].map(([v,l,ic])=>(
                    <CC key={v} sel={temCartao===v} onClick={()=>setTem(v)} ic={ic} title={l} large accent={cfg.accent} accentBg={cfg.accentBg}/>
                  ))}
                </div>
                {temCartao==="sim"&&(
                  <div className="fup" style={{background:T.surface,
                    border:`1.5px solid ${cfg.accent}33`,borderRadius:13,padding:"18px 20px",
                    boxShadow:`0 2px 12px ${cfg.accentBg}`}}>
                    <div style={{...G,fontSize:11,fontWeight:700,color:T.inkLight,
                      textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>Primeiro cartão</div>
                    <div style={{display:"flex",flexDirection:"column",gap:9}}>
                      <SI value={cardNome} onChange={e=>setCardNome(e.target.value)} placeholder="Nome do cartão (ex: Nubank Roxinho)"accent={cfg.accent} accentBg={cfg.accentBg}/>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                        <SI value={cardLim} onChange={e=>setCardLim(e.target.value)} placeholder="Limite" pre="R$"accent={cfg.accent} accentBg={cfg.accentBg}/>
                        <SI value={cardVenc} onChange={e=>setCardVenc(e.target.value)} placeholder="Dia do vencimento"accent={cfg.accent} accentBg={cfg.accentBg}/>
                      </div>
                    </div>
                    <button onClick={next} style={{...G,fontSize:11,color:T.inkLight,background:"none",border:"none",cursor:"pointer",marginTop:10,textDecoration:"underline",textDecorationStyle:"dotted",textUnderlineOffset:3}}>
                      Preencher depois →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* RECEITA */}
            {stepId==="receita"&&(
              <div style={{display:"flex",flexDirection:"column",gap:22}}>
                <div>
                  <h2 style={{...G,fontSize:mobile?24:31,fontWeight:800,color:T.ink,lineHeight:1.2,marginBottom:7}}>Há uma receita fixa mensal?</h2>
                  <p style={{...G,fontSize:14,color:T.inkMid,lineHeight:1.65}}>Registrá-la agora calibra os relatórios e projeções desde o primeiro uso.</p>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {[["sim","Sim, quero registrar","💼"],["nao","Registrarei depois","⏳"]].map(([v,l,ic])=>(
                    <CC key={v} sel={temRec===v} onClick={()=>setTemRec(v)} ic={ic} title={l} large accent={cfg.accent} accentBg={cfg.accentBg}/>
                  ))}
                </div>
                {temRec==="sim"&&(
                  <div className="fup" style={{background:T.surface,
                    border:`1.5px solid ${cfg.accent}33`,borderRadius:13,padding:"18px 20px",
                    boxShadow:`0 2px 12px ${cfg.accentBg}`}}>
                    <div style={{...G,fontSize:11,fontWeight:700,color:T.inkLight,
                      textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>Receita recorrente</div>
                    <div style={{display:"flex",flexDirection:"column",gap:9}}>
                      <SI value={recDesc} onChange={e=>setRecDesc(e.target.value)} placeholder="Descrição (ex: Salário, Pró-labore…)"accent={cfg.accent} accentBg={cfg.accentBg}/>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                        <SI value={recVal} onChange={e=>setRecVal(e.target.value)} placeholder="0,00" pre="R$"accent={cfg.accent} accentBg={cfg.accentBg}/>
                        <div style={{position:"relative"}}>
                          <select value={recDia} onChange={e=>setRecDia(e.target.value)}
                            style={{...G,width:"100%",padding:"12px 14px",fontSize:14,color:T.ink,
                              background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:10,
                              cursor:"pointer",outline:"none",transition:"border-color 0.15s,box-shadow 0.15s"}}
                            onFocus={e=>{e.target.style.borderColor=cfg.accent;e.target.style.boxShadow=`0 0 0 3px ${cfg.accentBg}`;}}
                            onBlur={e=>{e.target.style.borderColor=T.border;e.target.style.boxShadow="none";}}>
                            {Array.from({length:28},(_,i)=>i+1).map(d=><option key={d} value={d}>Dia {d}</option>)}
                          </select>
                          <div style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                            pointerEvents:"none",color:T.inkLight,fontSize:10}}>▾</div>
                        </div>
                      </div>
                      {/* Tipo de valor — Geist, not serif */}
                      <div>
                        <div style={{...G,fontSize:11,fontWeight:700,color:T.inkLight,
                          textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Tipo de valor</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                          {[{v:"fixo",ic:"🔒",t:"Valor fixo",s:"Mesmo valor todo mês"},{v:"estimado",ic:"≈",t:"Estimado",s:"Varia, use como referência"}].map(({v,ic,t,s})=>{
                            const sel=recTipo===v;
                            return(
                              <button key={v} onClick={()=>setRecTipo(v)}
                                style={{padding:"11px 12px",borderRadius:10,textAlign:"left",cursor:"pointer",
                                  border:`1.5px solid ${sel?cfg.accent:T.border}`,
                                  background:sel?cfg.accent:T.surface,transition:"all 0.15s"}}>
                                <div style={{fontSize:16,marginBottom:4}}>{ic}</div>
                                <div style={{...G,fontSize:12,fontWeight:700,color:sel?"#fff":T.ink,marginBottom:2}}>{t}</div>
                                <div style={{...G,fontSize:10,color:sel?"rgba(255,255,255,0.55)":T.inkLight,lineHeight:1.4}}>{s}</div>
                              </button>
                            );
                          })}
                        </div>
                        {recTipo==="estimado"&&(
                          <div className="fin" style={{display:"flex",alignItems:"flex-start",gap:7,
                            background:T.amberLight,border:`1px solid ${T.amber}33`,
                            borderRadius:9,padding:"8px 11px",marginTop:8}}>
                            <span style={{color:T.amber,flexShrink:0}}>⚠</span>
                            <span style={{...G,fontSize:11,color:T.inkMid,lineHeight:1.55}}>
                              Valor de referência nas projeções. Atualize o real quando souber, direto em Recorrências.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MEMBROS */}
            {stepId==="membros"&&(
              <div style={{display:"flex",flexDirection:"column",gap:22}}>
                <div>
                  <h2 style={{...G,fontSize:mobile?24:31,fontWeight:800,color:T.ink,lineHeight:1.15,marginBottom:7}}>Convidar membros</h2>
                  <p style={{...G,fontSize:14,color:T.inkMid,lineHeight:1.65}}>
                    Membros podem lançar transações. Apenas você, como owner, pode convidar ou remover pessoas e acessar configurações da conta.
                  </p>
                </div>
                {/* owner */}
                <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",
                  background:T.surface,border:`1px solid ${T.border}`,borderRadius:11}}>
                  <div style={{width:34,height:34,borderRadius:99,background:cfg.accent,
                    display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <span style={{...G,fontSize:13,fontWeight:700,color:"#fff"}}>{(orgNome||"V")[0].toUpperCase()}</span>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{...G,fontSize:13,fontWeight:600,color:T.ink}}>
                      {orgNome||"Você"} <span style={{color:T.inkLight,fontWeight:400}}>(owner)</span>
                    </div>
                    <div style={{...G,fontSize:11,color:T.inkLight}}>Acesso total · não pode ser removido</div>
                  </div>
                  <span style={{...G,fontSize:10,fontWeight:700,color:"#fff",
                    background:cfg.accent,borderRadius:99,padding:"3px 9px",flexShrink:0}}>Owner</span>
                </div>
                {/* invite fields */}
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {membros.map((m,i)=>(
                    <div key={i} style={{display:"flex",gap:8}}>
                      <div style={{flex:1}}><SI value={m} onChange={e=>setMembros(ms=>ms.map((x,idx)=>idx===i?e.target.value:x))} placeholder="email@exemplo.com" type="email"accent={cfg.accent} accentBg={cfg.accentBg}/></div>
                      {membros.length>1&&(
                        <button onClick={()=>setMembros(ms=>ms.filter((_,idx)=>idx!==i))}
                          style={{...G,padding:"0 12px",borderRadius:9,border:`1px solid ${T.border}`,
                            background:T.surface,cursor:"pointer",color:T.inkLight,fontSize:16,
                            transition:"color 0.15s"}}
                          onMouseEnter={e=>e.currentTarget.style.color=T.ink}
                          onMouseLeave={e=>e.currentTarget.style.color=T.inkLight}>✕</button>
                      )}
                    </div>
                  ))}
                  {membros.length<5&&(
                    <button onClick={()=>setMembros(ms=>[...ms,""])}
                      style={{...G,padding:"10px 14px",borderRadius:9,
                        border:`1.5px dashed ${T.border}`,background:"none",cursor:"pointer",
                        fontSize:12,fontWeight:600,color:cfg.accent,
                        display:"flex",alignItems:"center",gap:5,justifyContent:"center",
                        transition:"border-color 0.15s"}}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=cfg.accent}
                      onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                      + Adicionar outro membro
                    </button>
                  )}
                </div>
                <p style={{...G,fontSize:11,color:T.inkLight,lineHeight:1.65}}>
                  Os convidados receberão um e-mail com link de acesso. Gerencie membros depois em Configurações.
                </p>
              </div>
            )}

            {/* PRONTO */}
            {stepId==="pronto"&&(
              <div style={{display:"flex",flexDirection:"column",gap:22}}>
                <div>
                  <div style={{fontSize:42,marginBottom:13}}>🎯</div>
                  {/* ← Instrument Serif italic: closing — mirrors Welcome, bookends the journey */}
                  <h2 style={{...S,fontSize:mobile?28:36,color:T.ink,lineHeight:1.15,marginBottom:10}}>
                    {orgNome||"Organização"} está pronta!
                  </h2>
                  <p style={{...G,fontSize:14,color:T.inkMid,lineHeight:1.7}}>Tudo configurado. Aqui está um resumo antes de entrar:</p>
                </div>
                {/* summary */}
                <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:13,overflow:"hidden"}}>
                  {[
                    {ic:"🏢",l:"Organização",v:orgNome||"—",s:ORG_TIPOS.find(t=>t.id===orgTipo)?.l},
                    {ic:"🗂", l:"Categorias",v:`${cats.length} selecionadas`,s:cats.slice(0,3).map((c)=>ONBOARDING_CATEGORY_ROWS.find((x)=>x.id===c)?.labelPt).join(", ")+(cats.length>3?"…":"")},
                    {ic:"💳",l:"Cartões",v:temCartao==="sim"?(cardNome||"1 cartão"):"Não usa",s:temCartao==="sim"&&cardLim?`Limite R$ ${cardLim}`:null},
                    {ic:"💰",l:"Receita",v:temRec==="sim"?(recVal?`R$ ${recVal}/mês`:"Configurada"):"A configurar",s:temRec==="sim"?recDesc:null},
                    {ic:"👥",l:"Membros",v:membros.filter(m=>m.trim()).length>0?`${membros.filter(m=>m.trim()).length} convidado${membros.filter(m=>m.trim()).length!==1?"s":""}` :"Só você por agora",s:null},
                  ].map((row,i,arr)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 18px",
                      borderBottom:i<arr.length-1?`1px solid ${T.border}`:"none"}}>
                      <span style={{fontSize:17}}>{row.ic}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{...G,fontSize:12,fontWeight:600,color:T.ink}}>{row.l}</div>
                        {row.s&&<div style={{...G,fontSize:11,color:T.inkLight,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.s}</div>}
                      </div>
                      <div style={{...G,fontSize:12,fontWeight:600,color:T.inkMid,flexShrink:0}}>{row.v}</div>
                    </div>
                  ))}
                </div>
                {/* mini checklist preview */}
                <div style={{background:cfg.accentBg,border:`1px solid ${cfg.accent}1A`,borderRadius:11,padding:"14px 18px"}}>
                  <div style={{...G,fontSize:11,fontWeight:700,color:cfg.accent,
                    marginBottom:10,textTransform:"uppercase",letterSpacing:"0.08em"}}>
                    🎯 Seus primeiros passos
                  </div>
                  {[{l:"Organização configurada",done:true},{l:"Primeira transação",done:false},{l:"Primeiro orçamento ou meta",done:false}].map((it,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:9,marginBottom:i<2?7:0}}>
                      <div style={{width:17,height:17,borderRadius:5,flexShrink:0,
                        background:it.done?cfg.accent:T.surface,
                        border:`1.5px solid ${it.done?cfg.accent:T.border}`,
                        display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {it.done&&<span style={{color:"#fff",fontSize:10}}>✓</span>}
                      </div>
                      <span style={{...G,fontSize:12,color:it.done?cfg.accent:T.inkMid,
                        textDecoration:it.done?"line-through":"none",fontWeight:it.done?400:500}}>{it.l}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* NAV */}
            {stepId!=="welcome"&&(
              <div style={{display:"flex",alignItems:"center",gap:10,marginTop:30}}>
                {step>0&&step<STEPS.length-1&&(
                  <button onClick={prev} style={{...G,padding:"12px 18px",borderRadius:11,
                    border:`1px solid ${T.border}`,background:T.surface,
                    color:T.inkMid,fontSize:13,fontWeight:600,cursor:"pointer",
                    display:"flex",alignItems:"center",gap:5,transition:"border-color 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=T.inkGhost}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                    <Arrow c={T.inkMid}/> Voltar
                  </button>
                )}
                {stepId!=="pronto"?(
                  <button onClick={next} disabled={!canNext()} style={{
                    ...G,flex:1,padding:"13px 22px",borderRadius:11,border:"none",
                    fontSize:13,fontWeight:700,
                    cursor:canNext()?"pointer":"not-allowed",
                    background:canNext()?cfg.accent:T.inkGhost,
                    color:"#fff",display:"flex",alignItems:"center",
                    justifyContent:"center",gap:7,
                    transition:"background 0.15s,opacity 0.15s",
                    opacity:canNext()?1:0.45}}
                    onMouseEnter={e=>{if(canNext())e.currentTarget.style.opacity="0.88"}}
                    onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                    {stepId==="membros"?(membros.some(m=>m.trim())?"Enviar convites →":"Pular →"):"Continuar"}
                    {canNext()&&<Arrow/>}
                  </button>
                ):(
                  <>
                  {errorMessage && (
                    <div style={{ ...G, fontSize:12, color:T.red, marginRight:"auto" }}>
                      {errorMessage}
                    </div>
                  )}
                  <button onClick={()=>onComplete({ orgNome, orgTipo, cats, temCartao, cardNome, cardLim, cardVenc, temRec, recDesc, recVal, recDia, recTipo, membros: membros.filter(m=>m.trim()) })} disabled={isSubmitting} style={{
                    ...G,flex:1,padding:"14px 22px",borderRadius:11,border:"none",
                    fontSize:14,fontWeight:800,cursor:isSubmitting?"not-allowed":"pointer",
                    background:isSubmitting?T.inkGhost:T.ink,color:"#fff",
                    display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                    boxShadow:"0 6px 20px rgba(15,15,13,0.2)",transition:"transform 0.15s, opacity 0.15s"}}
                    onMouseEnter={e=>{ if(!isSubmitting) e.currentTarget.style.transform="translateY(-1px)"; }}
                    onMouseLeave={e=>e.currentTarget.style.transform="none"}>
                    {isSubmitting ? "Configurando..." : "Ir para o dashboard"} {!isSubmitting && <Arrow/>}
                  </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
