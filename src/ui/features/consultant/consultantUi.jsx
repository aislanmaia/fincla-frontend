import React from "react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { healthTone } from "./consultantFormat";

/**
 * Primitivas visuais do Painel do Consultor (RF.1a) — portadas fielmente da
 * referência de design (Claude Design, `consultor/cons-ui.jsx`) e adaptadas ao
 * design system do Fincla (`tokens.js`/`typography.js`, sem Tailwind). `Card`,
 * `Badge`, `Btn` e `ProgBar` continuam vindo de `components/primitives`; aqui
 * ficam só as que faltavam: ícones ricos, avatar, anel/rótulo de saúde e os
 * gráficos SVG (sparkline, donut). Tudo presentational e determinístico.
 */

/** `true` quando a viewport é mais estreita que `max` (mobile-first: colunas empilham). */
export function useIsNarrow(max = 900) {
  const query = `(max-width: ${max}px)`;
  const [narrow, setNarrow] = React.useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches,
  );
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mql = window.matchMedia(query);
    const onChange = (e) => setNarrow(e.matches);
    setNarrow(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return narrow;
}

/** Conjunto de ícones (traço, estilo lucide) usado pela área do consultor. */
export function Icon({ name, size = 16, color = "currentColor", strokeWidth = 1.8, style = {} }) {
  const p = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", style,
  };
  switch (name) {
    case "layout": return (<svg {...p}><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>);
    case "users": return (<svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>);
    case "user": return (<svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>);
    case "message": return (<svg {...p}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>);
    case "bar": return (<svg {...p}><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>);
    case "sparkles": return (<svg {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 14l.7 1.9L21.5 16.5l-1.8.6L19 19l-.6-1.9L16.5 16.5l1.9-.6L19 14z"/></svg>);
    case "search": return (<svg {...p}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>);
    case "plus": return (<svg {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>);
    case "bell": return (<svg {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>);
    case "chevron-right": return (<svg {...p}><polyline points="9 18 15 12 9 6"/></svg>);
    case "chevron-down": return (<svg {...p}><polyline points="6 9 12 15 18 9"/></svg>);
    case "chevron-left": return (<svg {...p}><polyline points="15 18 9 12 15 6"/></svg>);
    case "arrow-right": return (<svg {...p}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>);
    case "up": return (<svg {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>);
    case "down": return (<svg {...p}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>);
    case "alert": return (<svg {...p}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>);
    case "check": return (<svg {...p}><polyline points="20 6 9 17 4 12"/></svg>);
    case "check-circle": return (<svg {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>);
    case "x": return (<svg {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>);
    case "send": return (<svg {...p}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>);
    case "filter": return (<svg {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>);
    case "download": return (<svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>);
    case "more": return (<svg {...p}><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/></svg>);
    case "target": return (<svg {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>);
    case "wallet": return (<svg {...p}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>);
    case "card": return (<svg {...p}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>);
    case "calendar": return (<svg {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>);
    case "repeat": return (<svg {...p}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>);
    case "file": return (<svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>);
    case "clock": return (<svg {...p}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>);
    case "refresh": return (<svg {...p}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>);
    case "pencil": return (<svg {...p}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>);
    case "flag": return (<svg {...p}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>);
    case "trending": return (<svg {...p}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>);
    case "dot": return (<svg width={size} height={size} viewBox="0 0 24 24" style={style}><circle cx="12" cy="12" r="5" fill={color}/></svg>);
    default: return null;
  }
}

/** Iniciais (até 2 letras) de um nome, para o Avatar. */
export function avatarInitials(name) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_GRADIENTS = [
  [T.blue, T.purple],
  [T.green, T.blue],
  [T.amber, T.red],
  [T.purple, T.red],
  [T.blue, T.green],
];

/** Gradiente determinístico a partir de uma seed (id/nome do cliente). */
export function avatarGradient(seed) {
  const s = String(seed ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

/** Avatar com gradiente + iniciais. `name` deriva iniciais; `seed` o gradiente. */
export function Avatar({ name, seed, size = 34, ring, grad }) {
  const g = grad || avatarGradient(seed ?? name);
  return (
    <div style={{
      width: size, height: size, borderRadius: 9999, flexShrink: 0,
      background: `linear-gradient(135deg, ${g[0]}, ${g[1]})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 800, fontSize: size * 0.36, ...G,
      boxShadow: ring ? `0 0 0 3px ${ring}` : "none",
    }}>
      {avatarInitials(name)}
    </div>
  );
}

/** Ponto de semáforo por faixa de saúde. */
export function RiskDot({ health, size = 8 }) {
  const r = healthTone(health);
  return <span style={{ width: size, height: size, borderRadius: 9999, background: r.color, display: "inline-block", flexShrink: 0, boxShadow: `0 0 0 3px ${r.bg}` }} />;
}

/** Selo (cor/rótulo) da faixa de saúde do cliente. */
export function RiskBadge({ health }) {
  const r = healthTone(health);
  return (
    <span style={{ ...G, ...NUM, fontSize: 10, fontWeight: 700, color: r.color, background: r.bg, padding: "2px 8px", borderRadius: 9999, whiteSpace: "nowrap", letterSpacing: "0.02em", display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: 9999, background: r.color }} />{r.label}
    </span>
  );
}

/** Anel de score de saúde (0–100). */
export function HealthRing({ health, size = 56, stroke = 5, showNum = true }) {
  const r = healthTone(health);
  const empty = health == null;
  const value = empty ? null : Math.max(0, Math.min(100, Math.round(Number(health))));
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const off = empty ? circ : circ * (1 - value / 100);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Score ausente: trilho pontilhado, sem arco. Desenhar um arco de 0%
            pintaria de vermelho um cliente que ninguém avaliou. */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={T.grayLight} strokeWidth={stroke}
          strokeDasharray={empty ? "3 4" : undefined} strokeLinecap={empty ? "round" : undefined} />
        {!empty && (
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={r.color} strokeWidth={stroke}
            strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1)" }} />
        )}
      </svg>
      {showNum && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ ...G, ...NUM, fontSize: size * 0.3, fontWeight: 800, color: r.color, lineHeight: 1 }}>
            {empty ? "—" : value}
          </span>
        </div>
      )}
    </div>
  );
}

/** Sparkline SVG (linha + área). `data` = série numérica. */
export function Sparkline({ data = [], color = T.blue, w = 88, h = 28, fill = true }) {
  // useId antes de qualquer return: hooks não podem ficar após um early-return
  // (a ordem tem de ser estável entre renders — rules of hooks).
  const gid = React.useId();
  if (!Array.isArray(data) || data.length < 2) return <svg width={w} height={h} />;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 4) - 2;
    return [x, y];
  });
  const line = pts.map((pt, i) => (i === 0 ? "M" : "L") + pt[0].toFixed(1) + " " + pt[1].toFixed(1)).join(" ");
  const area = line + ` L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} />
    </svg>
  );
}

/** Donut SVG. `segments` = [{ value, color }]; `center` = conteúdo central. */
export function Donut({ segments = [], size = 132, stroke = 18, center }) {
  const total = segments.reduce((s, x) => s + (Number(x.value) || 0), 0) || 1;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  let acc = 0;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={T.grayLight} strokeWidth={stroke} />
        {segments.map((s, i) => {
          const len = ((Number(s.value) || 0) / total) * circ;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={s.color} strokeWidth={stroke}
              strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-acc}
              style={{ transition: "stroke-dasharray 0.8s ease" }} />
          );
          acc += len;
          return el;
        })}
      </svg>
      {center && <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>{center}</div>}
    </div>
  );
}
