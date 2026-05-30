import React from "react";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";

/* ─── PARCELA HYBRID (A+B+C) ───────────────────────────────────── */
export const ParcelaHybrid = ({ parcelas, valorNum }) => {
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
