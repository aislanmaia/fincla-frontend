import React from "react";
import { T } from "../tokens";
import { G, NUM } from "../typography";
import { Badge } from "../components/primitives";
import { MOODS, M_MONO } from "./moodV4";

/* ─── ONBOARDING MINI-CHECKLIST ─────────────────────────────── */
export const MiniChecklist = ({ onboardingData, completedTx, completedBudget, onDismiss, onNav }) => {
  if (!onboardingData) return null;
  const items = [
    {
      label: "Organização configurada",
      done: true,
      cta: null,
    },
    {
      label: "Registrar primeira transação",
      done: completedTx,
      cta: { label: "Registrar →", action: () => onNav && onNav("_nova_transacao") },
    },
    {
      label: "Criar orçamento ou meta",
      done: completedBudget,
      cta: { label: "Criar →", action: () => onNav && onNav("orcamentos") },
    },
  ];
  if (items.every(i => i.done)) return null;
  const doneCount = items.filter(i => i.done).length;
  const total = items.length;
  return (
    <div style={{ ...G, background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 11, padding: "10px 16px", marginBottom: 16,
      display:"flex", alignItems:"center", gap: 16, flexWrap:"wrap",
      boxShadow: T.sm }}>
      {/* Label + progress */}
      <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
        <div style={{ width:28, height:28, borderRadius:99,
          background: T.grayLight, position:"relative",
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width={28} height={28} viewBox="0 0 28 28" style={{ position:"absolute", top:0, left:0 }}>
            <circle cx={14} cy={14} r={11} fill="none" stroke={T.border} strokeWidth={2.5}/>
            <circle cx={14} cy={14} r={11} fill="none" stroke={T.green} strokeWidth={2.5}
              strokeDasharray={`${(doneCount/total)*69.1} 69.1`}
              strokeLinecap="round" transform="rotate(-90 14 14)"
              style={{ transition:"stroke-dasharray 0.5s ease" }}/>
          </svg>
          <span style={{ ...G, fontSize:10, fontWeight:800, color:T.ink, position:"relative" }}>
            {doneCount}/{total}
          </span>
        </div>
        <span style={{ ...G, fontSize:12, fontWeight:700, color:T.ink }}>
          Primeiros passos
        </span>
      </div>
      {/* Separator */}
      <div style={{ width:1, height:20, background:T.border, flexShrink:0 }}/>
      {/* Items inline */}
      <div style={{ display:"flex", alignItems:"center", gap:12, flex:1, flexWrap:"wrap" }}>
        {items.map((it, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:14, height:14, borderRadius:4, flexShrink:0,
              background: it.done ? T.green : "transparent",
              border: `1.5px solid ${it.done ? T.green : T.border}`,
              display:"flex", alignItems:"center", justifyContent:"center",
              transition:"all 0.3s" }}>
              {it.done && <span style={{ color:"#fff", fontSize:8, lineHeight:1 }}>✓</span>}
            </div>
            <span style={{ ...G, fontSize:12,
              color: it.done ? T.inkLight : T.ink,
              textDecoration: it.done ? "line-through" : "none" }}>
              {it.label}
            </span>
            {!it.done && it.cta && (
              <button onClick={it.cta.action}
                style={{ ...G, fontSize:11, fontWeight:700, color: T.blue,
                  background: T.blueLight, border:"none", borderRadius:6,
                  padding:"2px 8px", cursor:"pointer" }}>
                {it.cta.label}
              </button>
            )}
            {i < items.length - 1 && (
              <span style={{ color:T.border, fontSize:14, marginLeft:4 }}>·</span>
            )}
          </div>
        ))}
      </div>
      {/* Dismiss */}
      <button onClick={onDismiss} style={{ background:"none", border:"none",
        cursor:"pointer", color:T.inkLight, fontSize:16, lineHeight:1,
        flexShrink:0, padding:"0 2px" }}>✕</button>
    </div>
  );
};

export const StatePanelV4 = ({ open, day, setDay, budgetPct, setBudgetPct, freePct, setFreePct, moodKey, onStartOnboarding, dataMode, onSetDataMode, allowDataModeToggle = false }) => {
  const mood = MOODS[moodKey];
  const { Icon: MoodIcon } = mood;
  return (
    <div style={{ position:"fixed", top:56, right:0, zIndex:200, width:260, background:T.surface, borderLeft:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}`, padding:18, borderBottomLeftRadius:14, transform:open?"translateX(0)":"translateX(100%)", transition:"transform 0.35s cubic-bezier(0.4,0,0.2,1)", boxShadow:open?"-4px 4px 24px rgba(0,0,0,0.08)":"none" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
        <div>
          <div style={{ ...G, fontSize:11, fontWeight:700, color:T.ink, letterSpacing:"0.06em" }}>PAINEL DE ESTADOS</div>
          <div style={{ ...G, fontSize:10, color:T.inkLight, marginTop:2 }}>Simule condições do dashboard</div>
        </div>
        <Badge color={mood.badgeColor} bg={mood.badgeBg}><MoodIcon size={9}/> {mood.label}</Badge>
      </div>
      <button onClick={onStartOnboarding}
        style={{ ...G, width:"100%", padding:"9px 12px", borderRadius:9, marginBottom:8,
          border:"none", background:T.ink, color:"#fff",
          fontSize:11, fontWeight:700, cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
        ✦ Iniciar Onboarding
      </button>
      {allowDataModeToggle && (
        <div style={{ display:"flex", gap:4, marginBottom:14 }}>
          {[["mock","📦 Com dados"],["empty","✦ Estado inicial"]].map(([mode, label]) => (
            <button key={mode} onClick={() => onSetDataMode(mode)}
              style={{ ...G, flex:1, padding:"7px 6px", borderRadius:8,
                border:`1.5px solid ${dataMode===mode ? T.ink : T.border}`,
                background: dataMode===mode ? T.ink : T.surface,
                color: dataMode===mode ? "#fff" : T.inkMid,
                fontSize:10, fontWeight:700, cursor:"pointer", transition:"all 0.15s" }}>
              {label}
            </button>
          ))}
        </div>
      )}
      {[
        { label:"Dia do mês",      value:day,       set:setDay,       min:1,  max:31,  unit:`dia ${day}`,    color:T.ink    },
        { label:"Orçamento gasto", value:budgetPct, set:setBudgetPct, min:0,  max:150, unit:`${budgetPct}%`, color:mood.bar },
        { label:"Saldo livre",     value:freePct,   set:setFreePct,   min:0,  max:100, unit:`${freePct}%`,   color:mood.accent },
      ].map(({ label, value, set, min, max, unit, color }) => (
        <div key={label} style={{ marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ ...G, fontSize:11, color:T.inkMid, fontWeight:500 }}>{label}</span>
            <span style={{ ...M_MONO, ...NUM, fontSize:11, color, fontWeight:700, transition:"color 0.4s" }}>{unit}</span>
          </div>
          <input type="range" min={min} max={max} value={value} onChange={e => set(+e.target.value)} style={{ width:"100%", accentColor:color }} />
        </div>
      ))}
      <div style={{ marginTop:4, padding:12, background:T.bg, borderRadius:10, border:`1px solid ${T.border}` }}>
        <div style={{ ...G, fontSize:10, color:T.inkLight, fontWeight:700, letterSpacing:"0.05em", marginBottom:8 }}>MOODS DISPONÍVEIS</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
          {Object.entries(MOODS).map(([k, m]) => (
            <span key={k} style={{ ...G, fontSize:10, fontWeight:600, padding:"3px 8px", borderRadius:99, background:k===moodKey?m.badgeBg:T.grayLight, color:k===moodKey?m.badgeColor:T.inkLight, border:k===moodKey?`1px solid ${m.insightBorder}`:"1px solid transparent", transition:"all 0.3s" }}>{m.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─── Compact empty block (cards, lists) — Finly v4 reference patterns ─── */
export const CardEmptyWithCta = ({
  icon = "📭",
  iconSize = 22,
  title,
  sub,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  primaryVariant = "ink",
}) => {
  const primaryBtnStyle =
    primaryVariant === "redLight"
      ? { background: T.redLight, color: T.red, border: "none" }
      : { background: T.ink, color: "#fff", border: "none" };
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 16px 22px",
        gap: 10,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: iconSize, lineHeight: 1 }}>{icon}</div>
      <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink }}>{title}</div>
      {sub ? (
        <div style={{ ...G, fontSize: 11, color: T.inkLight, maxWidth: 280, lineHeight: 1.6 }}>{sub}</div>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 4 }}>
        {primaryLabel && onPrimary ? (
          <button
            type="button"
            onClick={onPrimary}
            style={{
              ...G,
              ...primaryBtnStyle,
              borderRadius: 9,
              padding: "7px 16px",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {primaryLabel}
          </button>
        ) : null}
        {secondaryLabel && onSecondary ? (
          <button
            type="button"
            onClick={onSecondary}
            style={{
              ...G,
              background: "none",
              color: T.inkMid,
              border: `1px solid ${T.border}`,
              borderRadius: 9,
              padding: "7px 14px",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
};

/* ─── EMPTY STATE COMPONENT ─────────────────────────────────── */
export const EmptyState = ({ icon, title, sub, cta, ctaLabel, onCta, secondaryCta, secondaryLabel, onSecondaryCta }) => (
  <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
    justifyContent:"center", textAlign:"center",
    padding:"64px 32px", gap:16, minHeight:320 }}>
    <div style={{ fontSize:48, lineHeight:1, marginBottom:4 }}>{icon}</div>
    <div style={{ ...G, fontSize:20, fontWeight:800, color:T.ink, maxWidth:320, lineHeight:1.3 }}>{title}</div>
    <div style={{ ...G, fontSize:14, color:T.inkMid, maxWidth:380, lineHeight:1.7 }}>{sub}</div>
    {cta && (
      <div style={{ display:"flex", gap:10, marginTop:8, flexWrap:"wrap", justifyContent:"center" }}>
        <button onClick={onCta}
          style={{ ...G, background:T.ink, color:"#fff", border:"none",
            borderRadius:11, padding:"11px 22px", fontSize:13, fontWeight:700,
            cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
          {cta}
        </button>
        {secondaryCta && (
          <button onClick={onSecondaryCta}
            style={{ ...G, background:"none", color:T.inkMid, border:`1px solid ${T.border}`,
              borderRadius:11, padding:"11px 22px", fontSize:13, fontWeight:600,
              cursor:"pointer" }}>
            {secondaryCta}
          </button>
        )}
      </div>
    )}
  </div>
);

