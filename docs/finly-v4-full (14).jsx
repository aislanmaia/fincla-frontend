import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LayoutDashboard, ArrowLeftRight, CreditCard, BarChart2,
  Target, Plus, Bell, ChevronDown, TrendingUp, TrendingDown,
  ArrowUpRight, Calendar, Search, ChevronRight, ChevronLeft, Tag, Edit3,
  Trash2, Activity, X, Check, Repeat, Filter, Download,
  FlaskConical, Sparkles, Hash, AlertTriangle, Upload,
  Pause, Pencil, Tv, Phone, Dumbbell, Home, Music, Zap,
  Info, PlusCircle, Users, Play, ShoppingCart, Settings,
  Wallet, MoreHorizontal, ChevronUp, FileText, Landmark,
  RefreshCw, RotateCcw, Circle, Star, Car,
  SlidersHorizontal, Leaf, ShieldCheck, Gauge, Flame,
  Eye, EyeOff, ArrowRight, Trophy, Flag,
  Award, Clock, Percent, ArrowDown, ArrowUp, Menu,
  Lock, MessageCircle, Building2, UserPlus, Key, Globe, Mail, ArrowUpDown,
  Smartphone, CheckCircle2, LogOut, ToggleLeft, ToggleRight
} from "lucide-react";
import {
  LineChart, Line, BarChart as ReBarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  ComposedChart, Area, AreaChart, PieChart, Pie, Cell, Legend
} from "recharts";

/* ─── FONTS ─────────────────────────────────────────────── */
(() => {
  if (document.getElementById("finly-fonts")) return;
  const l = document.createElement("link");
  l.id = "finly-fonts";
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600;700&display=swap";
  document.head.appendChild(l);
})();

/* ─── DESIGN TOKENS ─────────────────────────────────────── */
const T = {
  bg:          "#F8F7F5",
  surface:     "#FFFFFF",
  surfaceHov:  "#F9FAFB",
  border:      "#E2E5EA",
  borderHov:   "#D1D5DB",
  ink:         "#0F0F0D",
  inkMid:      "#374151",
  inkLight:    "#4B5563",
  inkGhost:    "#9CA3AF",
  blue:        "#2563EB",
  blueLight:   "#EFF6FF",
  red:         "#DC2626",
  redLight:    "#FEF2F2",
  redBar:      "#F87171",
  green:       "#059669",
  greenLight:  "#ECFDF5",
  greenBar:    "#34D399",
  amber:       "#D97706",
  amberLight:  "#FFFBEB",
  purple:      "#7C3AED",
  purpleLight: "#F5F3FF",
  purpleBar:   "#A78BFA",
  grayLight:   "#F3F4F6",
  darkBg:      "#1A1A2E",
  darkText:    "#F1F5F9",
  darkMuted:   "#94A3B8",
  darkPurple:  "#C4B5FD",
  darkRed:     "#F87171",
  sm:  "0 1px 2px rgba(0,0,0,0.05)",
  md:  "0 4px 12px rgba(0,0,0,0.07)",
  lg:  "0 8px 28px rgba(0,0,0,0.10)",
  dark:"0 8px 32px rgba(0,0,0,0.35)",
};

/* ─── GLOBAL ANIMATIONS ─────────────────────────────────────── */
const ANIM_CSS = `
  @keyframes fadeSlideUp {
    from { opacity:0; transform:translateY(8px); }
    to   { opacity:1; transform:translateY(0);   }
  }
  @keyframes fadeIn {
    from { opacity:0; }
    to   { opacity:1; }
  }
  @keyframes slideInRight {
    from { opacity:0; transform:translateX(18px); }
    to   { opacity:1; transform:translateX(0);    }
  }
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  }
  @keyframes countUp {
    from { opacity:0; transform:translateY(4px) scale(0.97); }
    to   { opacity:1; transform:translateY(0)   scale(1);    }
  }
  @keyframes progressFill {
    from { width: 0% !important; }
  }
  @keyframes pulseOnce {
    0%   { box-shadow: 0 0 0 0 rgba(37,99,235,0.25); }
    70%  { box-shadow: 0 0 0 8px rgba(37,99,235,0);  }
    100% { box-shadow: 0 0 0 0 rgba(37,99,235,0);    }
  }
  .finly-row { transition: background 0.11s; }
  .finly-row:hover { background: #F0EFEB !important; }
  .finly-card-lift { transition: box-shadow 0.18s ease, transform 0.18s ease; }
  .finly-card-lift:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.09) !important; transform: translateY(-1px); }
  .finly-btn { transition: opacity 0.13s, transform 0.13s; }
  .finly-btn:active { transform: scale(0.97) !important; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes sheetUp {
    from { transform: translateY(100%); opacity: 0;   }
    to   { transform: translateY(0);    opacity: 1;   }
  }
  @keyframes sheetDown {
    from { transform: translateY(0);    opacity: 1;   }
    to   { transform: translateY(100%); opacity: 0;   }
  }
  @keyframes backdropIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes backdropOut {
    from { opacity: 1; }
    to   { opacity: 0; }
  }
  /* DragScrollTabs — hide native scrollbar everywhere */
  .dstabs-scroll { -webkit-overflow-scrolling: touch; }
  .dstabs-scroll::-webkit-scrollbar { display: none; width: 0; height: 0; }
  .dstabs-scroll { scrollbar-width: none; -ms-overflow-style: none; }
`;

/* Injects ANIM_CSS once */
const AnimStyles = () => {
  const id = "finly-anim-styles";
  if (typeof document !== "undefined" && !document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.textContent = ANIM_CSS;
    document.head.appendChild(s);
  }
  return null;
};

/* Page-level fade — opacity only (no transform to avoid breaking position:fixed) */
const PageEnter = ({ children, key: k }) => (
  <div style={{ animation: "fadeIn 0.18s ease both" }} key={k}>
    {children}
  </div>
);

/* Animated progress bar */
const AnimBar = ({ pct, color, h = 4, delay = 0 }) => (
  <div style={{ height: h, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
    <div style={{
      height: "100%", width: `${Math.min(100, pct)}%`,
      background: color, borderRadius: 99,
      animation: `progressFill 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
    }}/>
  </div>
);

/* Animated monetary value — counts up from 0 */
const AnimNum = ({ value, prefix = "R$\u00a0", style = {}, suffix = "" }) => {
  const [display, setDisplay] = useState(0);
  const target = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.,]/g,"").replace(",",".")) || 0;
  useEffect(() => {
    let start = null;
    const dur = 700;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3); // ease-out-cubic
      setDisplay(target * ease);
      if (p < 1) requestAnimationFrame(step);
      else setDisplay(target);
    };
    const raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  const fmt = display.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <span style={{ ...style, animation: "countUp 0.3s ease both" }}>{prefix}{fmt}{suffix}</span>;
};


const G   = { fontFamily: "'Geist', 'DM Sans', system-ui, sans-serif" };
const S   = { fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic" };
const NUM = { fontVariantNumeric: "tabular-nums" };

/* ─── DATA ───────────────────────────────────────────────── */
const TODAY_CAL = 8;   // March 8 (calendar context)
const TODAY_RIT = 18;  // March 18 (ritmo context)
const BUDGET    = 4200;
const dpr       = BUDGET / 31;

const rhythmData = Array.from({ length: 31 }, (_, i) => {
  const d = i + 1;
  const proj = +(dpr * d).toFixed(0);
  const real = d <= TODAY_RIT
    ? Math.max(50, Math.round(dpr * d * 0.97 + Math.sin(d * 1.7) * 110 + Math.cos(d * 0.9) * 60))
    : null;
  return { day: d, proj, real };
});
const curReal = rhythmData[TODAY_RIT - 1].real;
const curProj = rhythmData[TODAY_RIT - 1].proj;
const dailyRateReal = curReal / TODAY_RIT; // média diária real observada

// Projeção ao ritmo atual: parte do ponto real do dia TODAY_RIT e extrapola
const estouroDia = dailyRateReal > 0
  ? Math.ceil(BUDGET / dailyRateReal)
  : null;

// Adiciona ritmoAtual a cada ponto do rhythmData
rhythmData.forEach(d => {
  if (d.day >= TODAY_RIT) {
    d.ritmoAtual = Math.round(curReal + dailyRateReal * (d.day - TODAY_RIT));
  } else {
    d.ritmoAtual = null;
  }
});

// ── FEV/26 — mês fechado (28 dias) ──────────────────────────
const BUDGET_FEV = 4200;
const dpr_fev    = BUDGET_FEV / 28;
const fev26Data  = Array.from({ length: 28 }, (_, i) => {
  const d    = i + 1;
  const proj = +(dpr_fev * d).toFixed(0);
  const real = Math.max(80, Math.round(
    dpr_fev * d * 1.04
    + Math.sin(d * 1.4) * 130
    + Math.cos(d * 0.7) * 70
  ));
  return { day: d, proj, real, ritmoAtual: null };
});
const fev26Real  = fev26Data[27].real;
const fev26Proj  = fev26Data[27].proj;
const fev26Daily = Math.round(fev26Real / 28);
const fev26Over  = fev26Real > BUDGET_FEV;

const TRANSACTIONS = [
  { id:1,  desc:"Supermercado Extra",   cat:"Alimentação",  val:-320.50, date:"10/03/2026", icon:"🛒", method:"Débito",      rec:false, status:"confirmado", tags:["mercado","compras"] },
  { id:2,  desc:"Salário Março",        cat:"Receita",      val:+6400,   date:"05/03/2026", icon:"💼", method:"TED",          rec:true,  status:"confirmado", tags:["salário"] },
  { id:3,  desc:"Netflix",              cat:"Assinaturas",  val:-55.90,  date:"08/03/2026", icon:"📺", method:"Crédito",      rec:true,  status:"confirmado", tags:["streaming"] },
  { id:4,  desc:"Posto Shell",          cat:"Transporte",   val:-180.00, date:"09/03/2026", icon:"⛽", method:"Crédito",      rec:false, status:"confirmado", tags:["combustível"] },
  { id:5,  desc:"Aluguel",              cat:"Moradia",      val:-1800,   date:"05/03/2026", icon:"🏠", method:"TED",          rec:true,  status:"confirmado", tags:["aluguel"] },
  { id:6,  desc:"iFood",               cat:"Alimentação",  val:-89.90,  date:"10/03/2026", icon:"🍔", method:"Crédito",      rec:false, status:"pendente",   tags:["delivery"] },
  { id:7,  desc:"Spotify",             cat:"Assinaturas",  val:-21.90,  date:"07/03/2026", icon:"🎵", method:"Crédito",      rec:true,  status:"confirmado", tags:["streaming"] },
  { id:8,  desc:"Academia Smart Fit",  cat:"Saúde",        val:-109.90, date:"01/03/2026", icon:"💪", method:"Crédito",      rec:true,  status:"confirmado", tags:["academia"] },
  { id:9,  desc:"Uber — Centro",        cat:"Transporte",   val:-32.50,  date:"11/03/2026", icon:"🚗", method:"Crédito",      rec:false, status:"confirmado", tags:["uber"] },
  { id:10, desc:"Farmácia Drogas Raia", cat:"Saúde",        val:-67.80,  date:"11/03/2026", icon:"💊", method:"Débito",       rec:false, status:"confirmado", tags:["farmácia"] },
  { id:11, desc:"Conta de Luz",         cat:"Moradia",      val:-214.30, date:"12/03/2026", icon:"⚡", method:"Boleto",       rec:true,  status:"confirmado", tags:["energia"] },
  { id:12, desc:"Restaurante Madero",   cat:"Alimentação",  val:-156.00, date:"13/03/2026", icon:"🍽️", method:"Crédito",     rec:false, status:"confirmado", tags:["restaurante"] },
  { id:13, desc:"Freelance — Design",   cat:"Receita",      val:+2800,   date:"14/03/2026", icon:"🎨", method:"Pix",          rec:false, status:"confirmado", tags:["freelance"] },
  { id:14, desc:"Internet Vivo Fibra",  cat:"Moradia",      val:-99.90,  date:"15/03/2026", icon:"📶", method:"Débito",       rec:true,  status:"confirmado", tags:["internet"] },
  { id:15, desc:"Mercado Livre",        cat:"Compras",      val:-248.90, date:"15/03/2026", icon:"📦", method:"Crédito",      rec:false, status:"confirmado", tags:["compras","online"] },
  { id:16, desc:"Cinema CineCity",      cat:"Lazer",        val:-85.00,  date:"16/03/2026", icon:"🎬", method:"Crédito",      rec:false, status:"confirmado", tags:["lazer"] },
  { id:17, desc:"Pix recebido — Ana",   cat:"Receita",      val:+350,    date:"17/03/2026", icon:"📲", method:"Pix",          rec:false, status:"confirmado", tags:["pix recebido"] },
  { id:18, desc:"Padaria Dona Benta",   cat:"Alimentação",  val:-42.50,  date:"18/03/2026", icon:"🥐", method:"Débito",       rec:false, status:"confirmado", tags:["padaria"] },
  { id:19, desc:"Uber Eats",           cat:"Alimentação",  val:-73.80,  date:"19/03/2026", icon:"🛵", method:"Crédito",      rec:false, status:"pendente",   tags:["delivery"] },
  { id:20, desc:"Condomínio",           cat:"Moradia",      val:-520,    date:"05/03/2026", icon:"🏢", method:"Boleto",       rec:true,  status:"confirmado", tags:["condomínio"] },
  { id:21, desc:"MacBook Pro 14pol",       cat:"Compras",      val:-3600,   date:"18/03/2026", icon:"💻", method:"Crédito",      rec:false, status:"confirmado", tags:["eletrônico","trabalho"], parcela:{atual:1, total:12, valParcela:300, cartao:"Nubank •• 1177", vencimento:"10/04/2026", valorTotal:3600, valorPago:300, valorResidual:3300} },
  { id:22, desc:"Curso de React",         cat:"Educação",     val:-899,    date:"12/03/2026", icon:"📚", method:"Crédito",      rec:false, status:"confirmado", tags:["curso"], parcela:{atual:3, total:6, valParcela:149.83, cartao:"Inter •• 5521", vencimento:"15/04/2026", valorTotal:899, valorPago:449.49, valorResidual:449.51} },
  { id:23, desc:"iPhone 15 — Americanas", cat:"Compras",      val:-8000,   date:"02/03/2026", icon:"📱", method:"Crédito",      rec:false, status:"confirmado", tags:["eletrônico"], parcela:{atual:5, total:24, valParcela:333.33, cartao:"Nubank •• 1177", vencimento:"10/04/2026", valorTotal:8000, valorPago:1666.65, valorResidual:6333.35} },
];

const RECORRENCIAS = [
  // despesas
  { id:1,  desc:"Nubank — fatura cartão", cat:"Cartão crédito", val:1240,  dia:10, ativa:true,  proximo:"10/03/2026", proximoFull:"10/04/2026", tipo:"despesa", metodo:"Cartão crédito", freq:"Mensal · dia 10", inicio:"Jan 2024", enc:"Sem data fim", urgente:true, diasUrg:2, pago:false, icone:"💳", valorTipo:"fixo", progPct: 68 },
  { id:2,  desc:"Aluguel",                cat:"Moradia",        val:1500,  dia:5,  ativa:true,  proximo:"05/04/2026", proximoFull:"05/04/2026", tipo:"despesa", metodo:"Pix",           freq:"Mensal · dia 5",  inicio:"Mar 2022", enc:"Sem data fim", pago:true,                icone:"🏠", valorTipo:"fixo", progPct: 100 },
  { id:3,  desc:"Conta de luz (CEMAR)",   cat:"Utilidades",     val:180,   dia:13, ativa:true,  proximo:"13/03/2026", proximoFull:"13/03/2026", tipo:"despesa", metodo:"Boleto",        freq:"Mensal · dia 13", inicio:"Jan 2020", enc:"Sem data fim", urgente:true, diasUrg:5, pago:false, icone:"⚡", valorTipo:"estimado", progPct: 45 },
  { id:4,  desc:"Plano celular Vivo",     cat:"Comunicação",    val:120,   dia:15, ativa:true,  proximo:"15/03/2026", proximoFull:"15/03/2026", tipo:"despesa", metodo:"Débito auto.",  freq:"Mensal · dia 15", inicio:"Jun 2021", enc:"Sem data fim",                           icone:"📱", valorTipo:"fixo", progPct: 35 },
  { id:5,  desc:"Academia SmartFit",      cat:"Saúde",          val:99.90, dia:1,  ativa:false, proximo:"01/04/2026", proximoFull:"01/04/2026", tipo:"despesa", metodo:"Débito auto.",  freq:"Mensal · dia 1",  inicio:"Ago 2023", enc:"Sem data fim",                           icone:"💪", valorTipo:"fixo", progPct: 0  },
  // receitas
  { id:7,  desc:"Salário — Empresa XYZ", cat:"Renda", val:6200, dia:5,  ativa:true, proximo:"05/04/2026", proximoFull:"05/04/2026", tipo:"receita", metodo:"Transferência", freq:"Mensal · dia 5",  inicio:"Mar 2020", enc:"Sem data fim", pago:true,                icone:"💼", valorTipo:"estimado", progPct: 100 },
  { id:8,  desc:"Salário — Consultoria", cat:"Renda", val:2200, dia:10, ativa:true, proximo:"10/03/2026", proximoFull:"10/03/2026", tipo:"receita", metodo:"Pix",           freq:"Mensal · dia 10", inicio:"Jan 2025", enc:"Sem data fim", urgente:true, diasUrg:2, pago:false, icone:"💼", valorTipo:"estimado", progPct: 80  },
];

const FLUXO_MENSAL = [
  { mes:"jan", desp:3200, rec:8900, sim:0    },
  { mes:"fev", desp:4100, rec:8900, sim:0    },
  { mes:"mar", desp:4830, rec:8900, sim:229.9},
  { mes:"abr", desp:3800, rec:8900, sim:229.9},
];

const PROXIMOS = [
  { dia:10, mes:"MAR", desc:"Salário Consultoria",    tipo:"receita",  metodo:"Pix",           val:+2200   },
  { dia:10, mes:"MAR", desc:"Fatura Nubank",           tipo:"despesa",  metodo:"Cartão crédito",val:-1240   },
  { dia:13, mes:"MAR", desc:"Conta de luz",             tipo:"despesa",  metodo:"Boleto",        val:-180    },
  { dia:1,  mes:"ABR", desc:"Adobe Creative Cloud",    tipo:"simulada", metodo:"Assinaturas",   val:-54.99  },
  { dia:1,  mes:"ABR", desc:"Renda extra freelance",   tipo:"simulada", metodo:"Renda",         val:+800    },
];

const SIM_ITEMS = [
  { id:1, nome:"MacBook Air M3",  cat:"Tecnologia", banco:"Nubank", parcelas:12, valParcela:349.17, total:4190, badge:"12× meses" },
  { id:2, nome:'Monitor LG 27"', cat:"Tecnologia", banco:"Itaú",   parcelas:3,  valParcela:183.33, total:550,  badge:"3× meses"  },
  { id:3, nome:"Teclado + Mouse", cat:"Tecnologia", banco:"Pix",    parcelas:1,  valParcela:150,    total:150,  badge:null        },
];

const simRhythm = Array.from({ length: 31 }, (_, i) => {
  const d = i + 1;
  const proj = +(dpr * d).toFixed(0);
  const real = d <= 12
    ? Math.max(50, Math.round(dpr * d * 0.97 + Math.sin(d * 1.7) * 90))
    : null;
  const withSim = d > 12
    ? Math.round((dpr * 12 * 0.97) + (dpr * 1.18) * (d - 12))
    : null;
  return { day: d, proj, real, budget: BUDGET, withSim };
});

const cashflow = [
  { m:"Out", r:5200, d:3800 }, { m:"Nov", r:5800, d:4200 },
  { m:"Dez", r:6200, d:5100 }, { m:"Jan", r:5400, d:3600 },
  { m:"Fev", r:5900, d:4800 }, { m:"Mar", r:6100, d:4100 },
];

/* ─── HELPERS ───────────────────────────────────────────── */
const fmtAbs = v => "R$ " + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtSgn = v => (v >= 0 ? "+" : "−") + "R$ " + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtK   = v => v >= 1000 ? "R$" + (v / 1000).toFixed(1) + "k" : "R$" + v;

/* ─── BASE COMPONENTS ───────────────────────────────────── */

// InfoTip: ⓘ icon that shows a tooltip on hover
const InfoTip = ({ text, width = 220 }) => {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 14, height: 14, borderRadius: 9999, background: T.grayLight, color: T.inkMid, fontSize: 10, fontWeight: 700, cursor: "default", userSelect: "none", fontFamily: "system-ui", flexShrink: 0 }}
      >ⓘ</span>
      {show && (
        <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", width, background: T.ink, color: "#fff", borderRadius: 9, padding: "9px 12px", fontSize: 11, lineHeight: 1.55, fontFamily: "'Geist', sans-serif", boxShadow: "0 4px 16px rgba(0,0,0,0.18)", zIndex: 999, pointerEvents: "none", whiteSpace: "pre-wrap" }}>
          {text}
          <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `5px solid ${T.ink}` }} />
        </div>
      )}
    </span>
  );
};

const Card = ({ children, style = {}, onClick }) => (
  <div onClick={onClick} style={{ background: T.surface, borderRadius: 14, border: `1px solid ${T.border}`, boxShadow: T.sm, ...style }}
    onMouseEnter={e => { if (onClick) { e.currentTarget.style.boxShadow = T.md; e.currentTarget.style.transform = "translateY(-1px)"; } }}
    onMouseLeave={e => { if (onClick) { e.currentTarget.style.boxShadow = T.sm; e.currentTarget.style.transform = ""; } }}>
    {children}
  </div>
);

const Badge = ({ children, color, bg }) => (
  <span style={{ ...G, ...NUM, fontSize: 10, fontWeight: 600, color: color || T.inkMid, background: bg || T.grayLight, padding: "2px 7px", borderRadius: 9999, whiteSpace: "nowrap", letterSpacing: "0.02em" }}>
    {children}
  </span>
);

const Breadcrumb = ({ label }) => (
  <div style={{ ...G, fontSize: 11, fontWeight: 500, color: T.inkLight, marginBottom: 6, letterSpacing: "0.02em" }}>{label}</div>
);

const PageTitle = ({ sans, serif: serifWord }) => (
  <h1 style={{ margin: 0, lineHeight: 1.1, display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 7 }}>
    <span style={{ ...G, fontSize: 30, fontWeight: 800, color: T.ink, letterSpacing: "-0.025em" }}>{sans}</span>
    {serifWord && <span style={{ ...S, fontSize: 32, color: T.ink }}>{serifWord}</span>}
  </h1>
);

const SectionDiv = ({ label, count, total, color = T.inkMid }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "20px 0 10px" }}>
    <div style={{ width: 18, height: 2, background: color, borderRadius: 99, flexShrink: 0 }} />
    <span style={{ ...G, fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.09em" }}>{label}</span>
    {count && <span style={{ ...G, fontSize: 10, color: T.inkLight, fontWeight: 400 }}>{count}</span>}
    {total && <span style={{ ...G, ...NUM, fontSize: 12, fontWeight: 700, color, marginLeft: "auto" }}>{total}</span>}
  </div>
);

const ProgBar = ({ pct, color, h = 3, delay = 0 }) => (
  <div style={{ width: "100%", height: h, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
    <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: "100%", background: color, borderRadius: 99, animation: `progressFill 0.85s cubic-bezier(0.16,1,0.3,1) ${delay}ms both` }} />
  </div>
);

const Btn = ({ children, variant = "outline", color = T.ink, onClick, full, small }) => {
  const styles = {
    dark:    { bg: T.ink,      txt: "#fff",   brd: T.ink      },
    red:     { bg: T.red,      txt: "#fff",   brd: T.red      },
    purple:  { bg: T.purple,   txt: "#fff",   brd: T.purple   },
    outGray: { bg: "transparent", txt: T.inkMid,  brd: T.border   },
    outPurp: { bg: "transparent", txt: T.purple,  brd: T.purple   },
    outRed:  { bg: "transparent", txt: T.red,     brd: T.red      },
    outAmber:{ bg: T.amberLight, txt: T.amber,   brd: T.amber    },
    ghost:   { bg: "transparent", txt: T.inkMid,  brd: "transparent" },
  };
  const s = styles[variant] || styles.outGray;
  return (
    <button onClick={onClick} style={{ ...G, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, padding: small ? "5px 10px" : "8px 14px", borderRadius: 9, border: `1.5px solid ${s.brd}`, background: s.bg, color: s.txt, fontSize: small ? 11 : 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", width: full ? "100%" : undefined, transition: "opacity 0.15s" }}
      onMouseEnter={e => e.currentTarget.style.opacity = "0.82"}
      onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
      {children}
    </button>
  );
};

/* ─── SIDEBAR ───────────────────────────────────────────── */
const NAV = [
  { sec: "PRINCIPAL" },
  { id: "dashboard",    label: "Visão Geral",    Icon: LayoutDashboard },
  { id: "transacoes",   label: "Transações",      Icon: ArrowLeftRight   },
  { id: "ritmo",        label: "Ritmo de Gastos", Icon: Activity         },
  { sec: "PLANEJAR" },
  { id: "orcamentos",   label: "Orçamentos",      Icon: Target           },
  { id: "recorrencias", label: "Recorrências",    Icon: Repeat           },
  { id: "simulacao",    label: "Simulação",       Icon: FlaskConical,    badge: "1" },
  { id: "metas",        label: "Metas",           Icon: BarChart2        },
  { sec: "GESTÃO" },
  { id: "cartoes",      label: "Cartões",         Icon: CreditCard       },
  { id: "relatorios",   label: "Relatórios",      Icon: FileText         },
  { sec: "CONTA" },
  { id: "perfil",       label: "Perfil",          Icon: Settings         },
];

const SidebarInner = ({ page, onNav, onClose }) => (
  <div style={{ width: 195, minWidth: 195, background: T.surface, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", height: "100vh" }}>

    {/* Logo */}
    <div style={{ padding: "18px 14px 14px", borderBottom: `1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: `linear-gradient(135deg, ${T.blue}, ${T.purple})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Activity size={14} color="#fff" strokeWidth={2.5} />
        </div>
        <span style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink, letterSpacing: "0.02em" }}>FINLY</span>
      </div>
      {onClose && (
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", padding:4, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center" }}
          onMouseEnter={e => e.currentTarget.style.background = T.bg}
          onMouseLeave={e => e.currentTarget.style.background = "none"}>
          <X size={16} color={T.inkLight} />
        </button>
      )}
    </div>

    {/* Nav */}
    <nav style={{ flex: 1, padding: "6px 8px", overflowY: "auto" }}>
      {NAV.map((item, i) => {
        if (item.sec) return (
          /* Section label — structural scaffolding, whisper-level */
          <div key={i} style={{
            ...G, fontSize: 10, fontWeight: 500,
            color: T.inkGhost,
            textTransform: "uppercase", letterSpacing: "0.09em",
            padding: "14px 6px 3px",
            userSelect: "none"
          }}>
            {item.sec}
          </div>
        );
        const active = page === item.id;
        const { Icon } = item;
        return (
          <button key={item.id}
            onClick={() => { onNav(item.id); onClose && onClose(); }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = T.bg; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
            style={{
              ...G,
              width: "100%",
              display: "flex", alignItems: "center", gap: 8,
              /* Active: filled background + left accent strip */
              padding: "8px 10px",
              borderRadius: 8, border: "none", cursor: "pointer",
              marginBottom: 1,
              transition: "background 0.12s",
              background: active ? T.ink : "transparent",
              /* Typography: weight does the heavy lifting for hierarchy */
              color: active ? "#fff" : T.inkMid,
              fontWeight: active ? 600 : 400,
              fontSize: 13,

            }}>
            {/* Icon slightly dimmer than label on inactive — creates icon/label depth */}
            <Icon
              size={14}
              strokeWidth={active ? 2.5 : 1.8}
              color={active ? "#fff" : T.inkLight}
            />
            <span style={{ flex: 1, textAlign: "left", color: active ? "#fff" : T.inkMid }}>
              {item.label}
            </span>
            {item.badge && (
              <span style={{
                ...G, fontSize: 10, fontWeight: 700,
                color: active ? "rgba(255,255,255,0.8)" : T.blue,
                background: active ? "rgba(255,255,255,0.15)" : T.blueLight,
                padding: "1px 6px", borderRadius: 99
              }}>
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>

    {/* User */}
    <div style={{ padding: "10px 12px 14px", borderTop: `1px solid ${T.border}` }}>
      <div
        style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 8px", borderRadius:9, cursor:"pointer", transition:"background 0.13s" }}
        onMouseEnter={e => { e.currentTarget.style.background = T.bg; const lb = e.currentTarget.querySelector(".sb-logout"); if(lb) lb.style.opacity="1"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; const lb = e.currentTarget.querySelector(".sb-logout"); if(lb) lb.style.opacity="0"; }}
        onClick={() => onNav("perfil")}
      >
        <div style={{ width: 28, height: 28, borderRadius: 9999, background: `linear-gradient(135deg,${T.blue},${T.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff", flexShrink: 0 }}>AS</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ ...G, fontSize:12, fontWeight:600, color:T.ink }}>Aislan</div>
          <span style={{ ...G, fontSize:10, fontWeight:700, color:T.purple, background:T.purpleLight, padding:"1px 6px", borderRadius:99, letterSpacing:"0.04em", textTransform:"uppercase" }}>PREMIUM</span>
        </div>
        <button className="sb-logout"
          onClick={e => { e.stopPropagation(); onNav("__logout__"); }}
          title="Sair da conta"
          style={{ opacity:0, background:"none", border:"none", cursor:"pointer", padding:5, borderRadius:7, display:"flex", alignItems:"center", transition:"opacity 0.15s, background 0.12s", flexShrink:0 }}
          onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.background = T.redLight; }}
          onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>
          <LogOut size={13} color={T.red}/>
        </button>
      </div>
    </div>
  </div>
);

const Sidebar = ({ page, onNav, isMobile, open, onClose }) => {
  if (!isMobile) return <SidebarInner page={page} onNav={onNav} />;

  // Mobile: drawer com overlay
  if (!open) return null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:300, overflow:"hidden", display:"flex" }}>
      <style>{`@keyframes sidebarIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>
      {/* Overlay */}
      <div onClick={onClose}
        style={{ position:"absolute", inset:0, background:"rgba(15,23,35,0.42)" }} />
      {/* Drawer */}
      <div style={{ position:"relative", animation:"sidebarIn 0.22s ease-out" }}>
        <SidebarInner page={page} onNav={onNav} onClose={onClose} />
      </div>
    </div>
  );
};

/* ─── TOPBAR ────────────────────────────────────────────── */
const Topbar = ({ onNew, isMobile, onMenuOpen, onNav, page }) => {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQ, setCmdQ] = useState("");
  const cmdRef = useRef(null);
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(true); setCmdQ(""); }
      if (e.key === "Escape") setCmdOpen(false);
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);
  useEffect(() => { if (cmdOpen && cmdRef.current) cmdRef.current.focus(); }, [cmdOpen]);

  const CMD_ITEMS = [
    { group:"Navegar", icon:"📊", label:"Visão Geral",   action:()=>{ onNav&&onNav("dashboard");   setCmdOpen(false); } },
    { group:"Navegar", icon:"💸", label:"Transações",     action:()=>{ onNav&&onNav("transacoes");  setCmdOpen(false); } },
    { group:"Navegar", icon:"💳", label:"Cartões",        action:()=>{ onNav&&onNav("cartoes");     setCmdOpen(false); } },
    { group:"Navegar", icon:"📈", label:"Relatórios",     action:()=>{ onNav&&onNav("relatorios");  setCmdOpen(false); } },
    { group:"Navegar", icon:"🎯", label:"Metas",          action:()=>{ onNav&&onNav("metas");       setCmdOpen(false); } },
    { group:"Navegar", icon:"📋", label:"Orçamentos",     action:()=>{ onNav&&onNav("orcamentos");  setCmdOpen(false); } },
    { group:"Navegar", icon:"🔄", label:"Recorrências",   action:()=>{ onNav&&onNav("recorrencias");setCmdOpen(false); } },
    { group:"Navegar", icon:"⚙️", label:"Configurações",  action:()=>{ onNav&&onNav("perfil");      setCmdOpen(false); } },
    { group:"Ação",    icon:"✚",  label:"Nova transação", action:()=>{ onNew&&onNew(); setCmdOpen(false); } },
  ];
  const filtered = cmdQ.trim() ? CMD_ITEMS.filter(i => i.label.toLowerCase().includes(cmdQ.toLowerCase())) : CMD_ITEMS;
  const grouped  = filtered.reduce((a,i)=>{ if(!a[i.group])a[i.group]=[]; a[i.group].push(i); return a; }, {});

  return (
    <>
    <div style={{ height:56, borderBottom:`1px solid ${T.border}`, background:T.surface, display:"flex", alignItems:"center", justifyContent:"space-between", padding:isMobile?"0 16px":"0 28px", flexShrink:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        {isMobile && (
          <button onClick={onMenuOpen} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:8, padding:"7px 8px", cursor:"pointer", display:"flex", alignItems:"center" }}>
            <Menu size={15} color={T.ink}/>
          </button>
        )}
        {!isMobile && (
          <button onClick={()=>{ setCmdOpen(true); setCmdQ(""); }}
            style={{ ...G, display:"flex", alignItems:"center", gap:8, background:T.bg, border:`1px solid ${T.border}`, borderRadius:9, padding:"7px 14px", cursor:"text", width:240, transition:"border-color 0.15s" }}
            onMouseEnter={e=>e.currentTarget.style.borderColor=T.ink}
            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            <Search size={12} color={T.inkMid}/>
            <span style={{ ...G, fontSize:12, color:T.inkMid, flex:1, textAlign:"left" }}>Buscar ou navegar…</span>
            <span style={{ ...G, fontSize:10, color:T.inkGhost, background:T.grayLight, borderRadius:5, padding:"1px 6px", fontFamily:"monospace" }}>⌘K</span>
          </button>
        )}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <button onClick={onNew} style={{ ...G, display:"flex", alignItems:"center", gap:5, background:T.ink, color:"#fff", border:"none", borderRadius:9, padding:isMobile?"8px 10px":"9px 16px", fontSize:13, fontWeight:700, cursor:"pointer" }}
          onMouseEnter={e=>e.currentTarget.style.opacity="0.88"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
          <Plus size={13} strokeWidth={2.5}/> {isMobile ? "Transação" : "Nova transação"}
        </button>
        <button style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, padding:"8px", cursor:"pointer", position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}
          onMouseEnter={e=>e.currentTarget.style.background=T.grayLight} onMouseLeave={e=>e.currentTarget.style.background=T.bg}>
          <Bell size={14} color={T.ink}/>
          <div style={{ position:"absolute", top:5, right:5, width:6, height:6, borderRadius:"50%", background:T.red, border:`1.5px solid ${T.surface}` }}/>
        </button>
        <button onClick={()=>onNav&&onNav("perfil")} style={{ width:32, height:32, borderRadius:9999, background:`linear-gradient(135deg,${T.blue},${T.purple})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:"#fff", border:"none", cursor:"pointer", flexShrink:0 }}
          onMouseEnter={e=>e.currentTarget.style.opacity="0.85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
          AS
        </button>
      </div>
    </div>
    {cmdOpen && (
      <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.45)", backdropFilter:"blur(4px)", display:"flex", alignItems:"flex-start", justifyContent:"center", paddingTop:"15vh" }}
        onClick={()=>setCmdOpen(false)}>
        <div style={{ width:"100%", maxWidth:520, background:T.surface, borderRadius:16, boxShadow:"0 25px 60px rgba(0,0,0,0.2)", overflow:"hidden" }} onClick={e=>e.stopPropagation()}>
          <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 18px", borderBottom:`1px solid ${T.border}` }}>
            <Search size={16} color={T.inkMid}/>
            <input ref={cmdRef} value={cmdQ} onChange={e=>setCmdQ(e.target.value)} placeholder="Buscar ou navegar…"
              style={{ ...G, flex:1, border:"none", outline:"none", fontSize:15, color:T.ink, background:"transparent" }}/>
            <span style={{ ...G, fontSize:11, color:T.inkGhost, background:T.bg, borderRadius:6, padding:"2px 8px", fontFamily:"monospace" }}>ESC</span>
          </div>
          <div style={{ maxHeight:360, overflowY:"auto", padding:"8px 0" }}>
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.08em", padding:"8px 18px 4px" }}>{group}</div>
                {items.map((item, i) => (
                  <button key={i} onClick={item.action} style={{ ...G, width:"100%", display:"flex", alignItems:"center", gap:12, padding:"10px 18px", background:"none", border:"none", cursor:"pointer", textAlign:"left" }}
                    onMouseEnter={e=>e.currentTarget.style.background=T.bg} onMouseLeave={e=>e.currentTarget.style.background="none"}>
                    <span style={{ fontSize:16 }}>{item.icon}</span>
                    <span style={{ ...G, fontSize:13, color:T.ink }}>{item.label}</span>
                    <ChevronRight size={12} color={T.inkGhost} style={{ marginLeft:"auto" }}/>
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && <div style={{ ...G, fontSize:13, color:T.inkMid, textAlign:"center", padding:"24px" }}>Nenhum resultado para "{cmdQ}"</div>}
          </div>
        </div>
      </div>
    )}
    </>
  );
};

/* ─── V4 MOOD SYSTEM ────────────────────────────────────── */
const M_MONO = { fontFamily: "'Geist Mono', monospace" };

const MOODS = {
  serene:  { label:"Sereno",    Icon:Leaf,          accent:T.green,  accentLight:T.greenLight,  bar:T.greenBar,  insightBorder:"#6EE7B7", insightBg:"#F0FDF6", kicker:"#059669", headlineColor:"#1A5C3A", topBorder:"transparent", badgeBg:"#D1FAE5", badgeColor:"#065F46", bgFx:"radial-gradient(ellipse at 85% 0%,rgba(52,211,153,0.06) 0%,transparent 55%)", greeting:"Suas finanças respiram bem hoje.",           InsightIcon:ShieldCheck,  headlineSize:"3.8rem" },
  healthy: { label:"Saudável",  Icon:Activity,       accent:T.amber,  accentLight:T.amberLight,  bar:"#F59E0B",   insightBorder:"#FCD34D", insightBg:"#FFFBEB", kicker:T.amber,   headlineColor:"#92400E", topBorder:"transparent", badgeBg:"#FDE68A", badgeColor:"#78350F", bgFx:"radial-gradient(ellipse at 85% 0%,rgba(245,158,11,0.06) 0%,transparent 55%)", greeting:"Ritmo equilibrado. Continue assim.",          InsightIcon:Gauge,        headlineSize:"3.5rem" },
  watchful:{ label:"Atenção",   Icon:Gauge,          accent:"#D97706",accentLight:"#FFF7ED",     bar:"#F97316",   insightBorder:"#FDBA74", insightBg:"#FFF7ED", kicker:"#C2410C", headlineColor:"#9A3412", topBorder:"#FDBA74",    badgeBg:"#FED7AA", badgeColor:"#9A3412", bgFx:"radial-gradient(ellipse at 85% 0%,rgba(249,115,22,0.07) 0%,transparent 55%)", greeting:"Olho no ritmo — você está acelerando.",     InsightIcon:Flame,        headlineSize:"3.3rem" },
  tense:   { label:"Tenso",     Icon:TrendingUp,     accent:T.red,    accentLight:T.redLight,    bar:"#EF4444",   insightBorder:"#FCA5A5", insightBg:"#FEF2F2", kicker:T.red,     headlineColor:"#991B1B", topBorder:"#FCA5A5",    badgeBg:"#FEE2E2", badgeColor:"#7F1D1D", bgFx:"radial-gradient(ellipse at 85% 0%,rgba(239,68,68,0.07) 0%,transparent 55%)", greeting:"Atenção: seu orçamento está pressionado.",  InsightIcon:AlertTriangle,headlineSize:"3rem"   },
  alert:   { label:"Crítico",   Icon:AlertTriangle,  accent:"#B91C1C",accentLight:"#FFF1F2",     bar:"#BE123C",   insightBorder:"#FB7185", insightBg:"#FFF1F2", kicker:"#9F1239", headlineColor:"#7F1D1D", topBorder:"#FB7185",    badgeBg:"#FFE4E6", badgeColor:"#881337", bgFx:"radial-gradient(ellipse at 85% 0%,rgba(190,18,60,0.09) 0%,transparent 55%)", greeting:"Situação crítica. Revise seus gastos agora.",InsightIcon:AlertTriangle,headlineSize:"2.8rem" },
};

function calcMood(day, budgetPct, freePct) {
  const ratio = budgetPct / ((day / 31) * 100);
  if (freePct < 10 || ratio > 1.3) return "alert";
  if (ratio > 1.1) return "tense";
  if (ratio > 0.95 || freePct < 20) return "watchful";
  if (ratio > 0.80) return "healthy";
  return "serene";
}

function getMoodActions(moodKey) {
  return ({
    serene:   [{ label:"Definir meta extra",       Icon:Target        }, { label:"Ver projeção",         Icon:TrendingUp    }],
    healthy:  [{ label:"Simular uma compra",        Icon:FlaskConical  }, { label:"Ver categorias",       Icon:Activity      }],
    watchful: [{ label:"Simular impacto",           Icon:FlaskConical  }, { label:"Revisar recorrências", Icon:Repeat        }],
    tense:    [{ label:"O que posso cortar?",       Icon:AlertTriangle }, { label:"Recorrências caras",   Icon:Repeat        }],
    alert:    [{ label:"Revisão urgente",           Icon:AlertTriangle }, { label:"Pausar recorrências",  Icon:Repeat        }],
  })[moodKey] || [];
}

function genRhythmData(day, budgetPct) {
  return Array.from({ length: 31 }, (_, i) => {
    const d = i + 1;
    const proj = Math.round((4200 / 31) * d);
    const real = d <= day ? Math.round(4200 * (budgetPct / 100) * (d / day) * (1 + Math.sin(d * 2.1) * 0.06)) : null;
    return { dia: d, proj, real };
  });
}

const CATS_V4 = [
  { name:"Alimentação", value:847, avg:720, color:T.green    },
  { name:"Transporte",  value:401, avg:380, color:T.amber    },
  { name:"Moradia",     value:356, avg:356, color:T.purple   },
  { name:"Lazer",       value:267, avg:180, color:T.blue     },
  { name:"Saúde",       value:200, avg:220, color:"#BE185D"  },
  { name:"Streaming",   value: 89, avg: 89, color:"#78716C"  },
  { name:"Outros",      value: 67, avg: 90, color:T.inkLight },
];

const DEBITS_V4 = [
  { name:"Conta de Luz", value:180.00, day:13, daysLeft:2,  cat:"Utilidades"  },
  { name:"Spotify Duo",  value: 21.90, day:15, daysLeft:4,  cat:"Assinaturas" },
  { name:"Adobe CC",     value: 89.99, day:18, daysLeft:7,  cat:"Trabalho"    },
  { name:"Academia",     value: 89.90, day:20, daysLeft:9,  cat:"Saúde"       },
  { name:"Seguro Auto",  value:342.00, day:22, daysLeft:11, cat:"Transporte"  },
];

const PERIODS_V4 = [
  { key:"mes", label:"Este mês",  badge:"mar/26"        },
  { key:"3m",  label:"3 meses",   badge:"jan–mar/26"    },
  { key:"6m",  label:"6 meses",   badge:"out/25–mar/26" },
  { key:"12m", label:"12 meses",  badge:"mar/25–mar/26" },
];

const RhythmTooltipV4 = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...G, fontSize:11, background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 14px", boxShadow:T.md }}>
      <div style={{ color:T.inkLight, marginBottom:5 }}>Dia {label}</div>
      {payload.map((p,i) => p.value != null && (
        <div key={i} style={{ ...NUM, color:p.color, fontWeight:600 }}>{p.name==="proj"?"Projeção":"Real"}: {fmtAbs(p.value)}</div>
      ))}
    </div>
  );
};

/* ─── ONBOARDING DATA & COMPONENTS ──────────────────────────── */

const STEPS = [
  { id:"welcome",    leftBg:"#0F0F0D", leftAcc:"#F8F7F5", accent:"#0F0F0D", accentBg:"rgba(15,15,13,0.06)", leftDec:"✦",   leftNum:null, leftH:"Bem-vindo ao finly",        leftS:"A plataforma de finanças para famílias e organizações que querem clareza sobre seu dinheiro." },
  { id:"org",        leftBg:"#1E3A5F", leftAcc:"#93C5FD", accent:"#1E3A5F", accentBg:"#EFF6FF",            leftDec:null,  leftNum:"01", leftH:"Quem usa o finly?",         leftS:"Dê uma identidade à sua organização. Isso personaliza a linguagem e os relatórios." },
  { id:"categorias", leftBg:"#14532D", leftAcc:"#86EFAC", accent:"#166534", accentBg:"#ECFDF5",            leftDec:null,  leftNum:"02", leftH:"Onde vai o seu dinheiro?",  leftS:"As categorias selecionadas aparecem primeiro ao lançar transações — menos cliques no dia a dia." },
  { id:"cartoes",    leftBg:"#4C1D95", leftAcc:"#C4B5FD", accent:"#4C1D95", accentBg:"#F5F3FF",            leftDec:null,  leftNum:"03", leftH:"Cartões de crédito?",       leftS:"Se você usa cartões, o finly rastreia faturas, parcelas e assinaturas automaticamente." },
  { id:"receita",    leftBg:"#064E3B", leftAcc:"#6EE7B7", accent:"#065F46", accentBg:"#ECFDF5",            leftDec:null,  leftNum:"04", leftH:"Sua receita mensal",        leftS:"Registre uma receita recorrente agora para que os relatórios já nasçam calibrados para a sua realidade." },
  { id:"membros",    leftBg:"#1E1B4B", leftAcc:"#A5B4FC", accent:"#1E1B4B", accentBg:"#EEF2FF",            leftDec:null,  leftNum:"05", leftH:"Quem mais faz parte?",      leftS:"Convide membros para lançar transações juntos. Você é o owner — só você pode convidar ou remover." },
  { id:"pronto",     leftBg:"#0F0F0D", leftAcc:"#F8F7F5", accent:"#0F0F0D", accentBg:"rgba(15,15,13,0.06)", leftDec:"✓", leftNum:null, leftH:"Tudo pronto!",              leftS:"Sua organização está configurada. Vamos ao dashboard." },
];

const ORG_TIPOS = [
  { id:"casal",    l:"Casal",    ic:"💑", s:"Finanças compartilhadas a dois"  },
  { id:"negocio",  l:"Negócio",  ic:"💼", s:"Pequena empresa ou MEI"          },
  { id:"outro",    l:"Outro",    ic:"✦",  s:"Associação, república, grupo…"  },
];
const CATS = [
  { id:"moradia",     ic:"🏠", l:"Moradia"      },
  { id:"alimentacao", ic:"🍔", l:"Alimentação"  },
  { id:"transporte",  ic:"🚗", l:"Transporte"   },
  { id:"saude",       ic:"💊", l:"Saúde"        },
  { id:"educacao",    ic:"📚", l:"Educação"     },
  { id:"lazer",       ic:"🎭", l:"Lazer"        },
  { id:"negocios",    ic:"📊", l:"Negócios"     },
  { id:"assinaturas", ic:"📱", l:"Assinaturas"  },
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

const OnboardingFlow = ({ onComplete, isMobile: mobile }) => {
  const [step,setStep]   = useState(0);
  const [dir,setDir]     = useState("forward");
  const [key,setKey]     = useState(0);
  const [orgNome,setOrgNome]   = useState("");
  const [orgTipo,setOrgTipo]   = useState("familia");
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
            <span style={{...G,fontSize:13,fontWeight:700,color:cfg.leftAcc,letterSpacing:"0.04em",opacity:0.9}}>finly</span>
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
                    O finly é para famílias, casais e negócios que querem clareza sobre o dinheiro. Configure em menos de 3 minutos.
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
                  <p style={{...G,fontSize:14,color:T.inkMid,lineHeight:1.6}}>Como devemos chamar o grupo que usará o finly?</p>
                </div>
                <div>
                  <label style={{...G,fontSize:11,fontWeight:700,color:T.inkLight,
                    textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:8}}>Nome</label>
                  <SI value={orgNome} onChange={e=>setOrgNome(e.target.value)}
                    placeholder="ex: Família Alves, Studio Criativo, Apê 204…" autoFocusaccent={cfg.accent} accentBg={cfg.accentBg}/>
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
                  {CATS.map(c=>{const sel=cats.includes(c.id);return(
                    <button key={c.id} onClick={()=>setCats(cs=>cs.includes(c.id)?cs.filter(x=>x!==c.id):[...cs,c.id])}
                      style={{padding:"13px 6px",borderRadius:11,cursor:"pointer",
                        display:"flex",flexDirection:"column",alignItems:"center",gap:6,
                        border:`1.5px solid ${sel?cfg.accent:T.border}`,
                        background:sel?cfg.accent:T.surface,
                        boxShadow:sel?`0 3px 10px ${cfg.accentBg}`:"none",
                        transition:"all 0.15s"}}>
                      <span style={{fontSize:20}}>{c.ic}</span>
                      <span style={{...G,fontSize:11,fontWeight:600,color:sel?"#fff":T.ink}}>{c.l}</span>
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
                  <p style={{...G,fontSize:14,color:T.inkMid,lineHeight:1.6}}>O finly rastreia faturas, parcelas e assinaturas por cartão.</p>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {[["sim","Sim, usamos","💳"],["nao","Não usamos","💵"]].map(([v,l,ic])=>(
                    <CC key={v} sel={temCartao===v} onClick={()=>setTem(v)} ic={ic} title={l} largeaccent={cfg.accent} accentBg={cfg.accentBg}/>
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
                    <CC key={v} sel={temRec===v} onClick={()=>setTemRec(v)} ic={ic} title={l} largeaccent={cfg.accent} accentBg={cfg.accentBg}/>
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
                    {ic:"🗂", l:"Categorias",v:`${cats.length} selecionadas`,s:cats.slice(0,3).map(c=>CATS.find(x=>x.id===c)?.l).join(", ")+(cats.length>3?"…":"")},
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
                  <button onClick={()=>onComplete({ orgNome, orgTipo, cats, temCartao, cardNome, cardLim, cardVenc, temRec, recDesc, recVal, recDia, recTipo, membros: membros.filter(m=>m.trim()) })} style={{
                    ...G,flex:1,padding:"14px 22px",borderRadius:11,border:"none",
                    fontSize:14,fontWeight:800,cursor:"pointer",
                    background:T.ink,color:"#fff",
                    display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                    boxShadow:"0 6px 20px rgba(15,15,13,0.2)",transition:"transform 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.transform="translateY(-1px)"}
                    onMouseLeave={e=>e.currentTarget.style.transform="none"}>
                    Ir para o dashboard <Arrow/>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── ONBOARDING MINI-CHECKLIST ─────────────────────────────── */
const MiniChecklist = ({ onboardingData, completedTx, completedBudget, onDismiss, onNav }) => {
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

const StatePanelV4 = ({ open, day, setDay, budgetPct, setBudgetPct, freePct, setFreePct, moodKey, onStartOnboarding, dataMode, onSetDataMode }) => {
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
      {/* Data mode toggle */}
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

/* ─── EMPTY STATE COMPONENT ─────────────────────────────────── */
const EmptyState = ({ icon, title, sub, cta, ctaLabel, onCta, secondaryCta, secondaryLabel, onSecondaryCta }) => (
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


/* ─── DASHBOARD ─────────────────────────────────────────── */
const DashboardPage = ({ onNav, stateCtrl, dataMode = "mock", onboardingData = null, extraRecs = [], onNewTx }) => {
  const { day, budgetPct, freePct, mounted, isMobile } = stateCtrl;
  if (dataMode === "empty") {
    const rec = extraRecs && extraRecs[0];
    const orgLabel = onboardingData?.orgNome || "Organização";
    const recValNum = rec ? rec.val : 0;
    const fmtR = v => "R$ " + Math.abs(v).toLocaleString("pt-BR",{minimumFractionDigits:2});
    const orgTipo = onboardingData?.orgTipo || "familia";

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <PageTitle sans="Visão" serif="Geral"/>
          <button onClick={onNewTx}
            style={{ ...G, display:"flex", alignItems:"center", gap:6, background:T.ink, color:"#fff", border:"none", borderRadius:11, padding:"10px 18px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
            + Nova transação
          </button>
        </div>

        {rec ? (
          /* ── Com receita registrada ── */
          <>
            {/* Hero escuro com dados reais */}
            <div style={{ background:T.darkBg, borderRadius:16, padding:"20px 24px", position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", top:-50, right:-50, width:160, height:160, borderRadius:"50%", background:"rgba(134,239,172,0.07)", pointerEvents:"none" }}/>
              <div style={{ ...G, fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.4)", textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:4 }}>Receita mensal registrada</div>
              <div style={{ ...G, ...NUM, fontSize:isMobile?24:30, fontWeight:800, color:"#86EFAC", letterSpacing:"-0.02em", lineHeight:1, marginBottom:5 }}><AnimNum value={recValNum} style={{...G, ...NUM, fontSize:isMobile?24:30, fontWeight:800, color:"#86EFAC", letterSpacing:"-0.02em"}}/></div>
              <div style={{ ...G, fontSize:12, color:"rgba(255,255,255,0.35)", marginBottom:14 }}>{rec.desc} · todo dia {rec.dia}{rec.valorTipo==="estimado"?<span style={{ ...G, fontSize:11, color:"#FCD34D", marginLeft:8 }}>≈ estimado</span>:null}</div>
              <div style={{ display:"flex", gap:18, flexWrap:"wrap", paddingTop:14, borderTop:"1px solid rgba(255,255,255,0.07)" }}>
                {[
                  { label:"Saldo projetado",    val:fmtR(recValNum),  sub:"sem despesas",  color:"#86EFAC" },
                  { label:"Próximo crédito",     val:`dia ${rec.dia}`, sub:"de cada mês",   color:"rgba(255,255,255,0.8)" },
                  { label:"Comprometido fixo",   val:"R$ 0",           sub:"sem recorrências", color:"rgba(255,255,255,0.45)" },
                ].map((k,i) => (
                  <div key={i}>
                    <div style={{ ...G, fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.35)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>{k.label}</div>
                    <div style={{ ...G, ...NUM, fontSize:15, fontWeight:800, color:k.color }}>{k.val}</div>
                    <div style={{ ...G, fontSize:10, color:"rgba(255,255,255,0.28)", marginTop:1 }}>{k.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* KPI strip */}
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10 }}>
              <Card style={{ padding:"13px 14px", borderColor:T.green, borderWidth:1.5 }}>
                <div style={{ ...G, fontSize:10, fontWeight:700, color:T.green, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Receita do mês</div>
                <div style={{ ...G, ...NUM, fontSize:18, fontWeight:800, color:T.green, marginBottom:3 }}>{fmtR(recValNum)}</div>
                <div style={{ ...G, fontSize:10, color:T.green }}>registrada ✓</div>
              </Card>
              <Card style={{ padding:"13px 14px", background:"#FAFAF9" }}>
                <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Gastos</div>
                <div style={{ ...G, ...NUM, fontSize:18, fontWeight:800, color:T.inkGhost, marginBottom:5 }}>R$ 0</div>
                <button onClick={onNewTx} style={{ ...G, background:T.redLight, color:T.red, border:"none", borderRadius:7, padding:"5px 10px", fontSize:10, fontWeight:700, cursor:"pointer" }}>+ Registrar</button>
              </Card>
              <Card style={{ padding:"13px 14px", background:"#FAFAF9" }}>
                <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Saldo livre</div>
                <div style={{ ...G, ...NUM, fontSize:18, fontWeight:800, color:T.inkGhost, marginBottom:3 }}>—</div>
                <div style={{ ...G, fontSize:10, color:T.inkLight }}>após transações</div>
              </Card>
              <Card style={{ padding:"13px 14px", background:"#FAFAF9" }}>
                <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Saúde</div>
                <div style={{ fontSize:18, margin:"4px 0" }}>⚪</div>
                <div style={{ ...G, fontSize:10, color:T.inkLight }}>sem dados</div>
              </Card>
            </div>

            {/* 2-col: ritmo + insight */}
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 280px", gap:14 }}>
              {/* Ritmo ghost */}
              <Card style={{ padding:16 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                  <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink }}>Ritmo de gastos</div>
                  <div style={{ ...G, fontSize:10, fontWeight:600, color:T.inkLight, background:T.grayLight, borderRadius:99, padding:"3px 9px" }}>Março 2026</div>
                </div>
                <div style={{ background:T.bg, borderRadius:10, padding:"10px 10px 0", marginBottom:12, position:"relative", overflow:"hidden", height:80 }}>
                  <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:60, filter:"blur(2px)", opacity:0.15, pointerEvents:"none" }}>
                    {[32,54,41,72,46,63,37,85,53,67].map((h,i)=>(
                      <div key={i} style={{ flex:1, borderRadius:"2px 2px 0 0", background:T.ink, height:`${h}%` }}/>
                    ))}
                  </div>
                  <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
                    <span style={{ fontSize:14 }}>📊</span>
                    <span style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid }}>Desbloqueado com a primeira transação</span>
                  </div>
                </div>
                <button onClick={onNewTx} style={{ ...G, width:"100%", background:T.redLight, color:T.red, border:"none", borderRadius:9, padding:"9px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                  + Registrar primeira transação
                </button>
              </Card>
              {/* Insight */}
              <Card style={{ padding:16, display:"flex", flexDirection:"column" }}>
                <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink, marginBottom:12 }}>Insight do mês</div>
                <div style={{ flex:1, background:T.bg, borderRadius:10, padding:16, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", gap:8, marginBottom:12 }}>
                  <div style={{ fontSize:26 }}>🔮</div>
                  <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink }}>Sem dados ainda</div>
                  <div style={{ ...G, fontSize:11, color:T.inkLight, lineHeight:1.6, maxWidth:160 }}>Aparece após a primeira transação do mês.</div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                  <button onClick={() => onNav("orcamentos")} style={{ ...G, width:"100%", background:T.blueLight, color:T.blue, border:"none", borderRadius:9, padding:"8px", fontSize:11, fontWeight:700, cursor:"pointer" }}>📋 Criar orçamento</button>
                  <button onClick={() => onNav("metas")} style={{ ...G, width:"100%", background:T.purpleLight, color:T.purple, border:"none", borderRadius:9, padding:"8px", fontSize:11, fontWeight:700, cursor:"pointer" }}>🎯 Definir meta</button>
                </div>
              </Card>
            </div>

            {/* 2-col: transações + próximos */}
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 280px", gap:14 }}>
              {/* Transações recentes */}
              <Card style={{ overflow:"hidden" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px 10px" }}>
                  <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink }}>Transações recentes</div>
                  <div style={{ ...G, fontSize:11, color:T.inkLight }}>nenhuma ainda</div>
                </div>
                <div style={{ height:1, background:T.border }}/>
                {/* Tx real do onboarding */}
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 18px", borderBottom:`1px solid ${T.border}` }}>
                  <div style={{ width:34, height:34, borderRadius:9, background:T.greenLight, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>💼</div>
                  <div style={{ flex:1 }}>
                    <div style={{ ...G, fontSize:12, fontWeight:600, color:T.ink }}>{rec.desc}</div>
                    <div style={{ ...G, fontSize:10, color:T.inkLight }}>
                      Renda · Pix · dia {String(rec.dia).padStart(2,"0")}/04
                      <span style={{ ...G, fontSize:10, fontWeight:700, background:T.grayLight, color:T.inkMid, borderRadius:99, padding:"1px 7px", marginLeft:6 }}>agendado</span>
                    </div>
                  </div>
                  <div style={{ ...G, ...NUM, fontSize:13, fontWeight:700, color:T.green }}>+{fmtR(recValNum)}</div>
                </div>
                {/* Empty honesto */}
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px 20px", gap:10, textAlign:"center" }}>
                  <div style={{ fontSize:20 }}>📭</div>
                  <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink }}>Nenhuma despesa ainda</div>
                  <div style={{ ...G, fontSize:11, color:T.inkLight, maxWidth:220, lineHeight:1.6 }}>Suas transações aparecerão aqui conforme forem registradas.</div>
                  <button onClick={onNewTx} style={{ ...G, background:T.redLight, color:T.red, border:"none", borderRadius:9, padding:"7px 16px", fontSize:11, fontWeight:700, cursor:"pointer" }}>+ Registrar primeiro gasto</button>
                </div>
              </Card>
              {/* Próximos vencimentos */}
              <Card style={{ padding:"14px 16px" }}>
                <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink, marginBottom:12 }}>Próximos vencimentos</div>
                <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:10 }}>
                  <div style={{ background:T.greenLight, borderRadius:7, padding:"3px 7px", textAlign:"center", flexShrink:0 }}>
                    <div style={{ ...G, ...NUM, fontSize:13, fontWeight:800, color:T.green }}>{String(rec.dia).padStart(2,"0")}</div>
                    <div style={{ ...G, fontSize:8, fontWeight:700, color:T.green, textTransform:"uppercase", letterSpacing:"0.06em" }}>ABR</div>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ ...G, fontSize:11, fontWeight:600, color:T.ink }}>{rec.desc}</div>
                    <div style={{ ...G, fontSize:10, color:T.inkMid }}>Pix · recorrente</div>
                  </div>
                  <div style={{ ...G, ...NUM, fontSize:11, fontWeight:700, color:T.green }}>+{fmtR(recValNum)}</div>
                </div>
                <div style={{ background:T.bg, border:`1.5px dashed ${T.border}`, borderRadius:9, padding:12, textAlign:"center" }}>
                  <div style={{ ...G, fontSize:11, color:T.inkLight, lineHeight:1.6, marginBottom:8 }}>Registre despesas fixas para ver boletos e assinaturas aqui.</div>
                  <button onClick={() => onNav("recorrencias")} style={{ ...G, width:"100%", background:"none", color:T.inkMid, border:`1px solid ${T.border}`, borderRadius:8, padding:"7px", fontSize:11, fontWeight:600, cursor:"pointer" }}>+ Adicionar recorrência</button>
                </div>
              </Card>
            </div>

            {/* Tip: receita em Recorrências */}
            <div style={{ display:"flex", alignItems:"center", gap:12, background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"12px 16px" }}>
              <div style={{ fontSize:18, flexShrink:0 }}>💡</div>
              <div style={{ flex:1 }}>
                <div style={{ ...G, fontSize:13, fontWeight:600, color:T.ink, marginBottom:2 }}>Sua receita já está em Recorrências</div>
                <div style={{ ...G, fontSize:12, color:T.inkMid, lineHeight:1.6 }}>{rec.desc} aparece na tela de Recorrências. Você pode editar o valor ou adicionar outras entradas e despesas fixas.</div>
              </div>
              <button onClick={() => onNav("recorrencias")} style={{ ...G, padding:"7px 12px", borderRadius:9, border:`1px solid ${T.border}`, background:T.surface, fontSize:12, fontWeight:600, color:T.inkMid, cursor:"pointer", flexShrink:0 }}>Ver →</button>
            </div>
          </>
        ) : (
          /* ── Sem receita registrada ── */
          <>
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:"28px 24px", textAlign:"center" }}>
              <div style={{ fontSize:36, marginBottom:12 }}>✦</div>
              <div style={{ ...G, fontSize:18, fontWeight:800, color:T.ink, marginBottom:8 }}>Olá, {orgLabel}!</div>
              <div style={{ ...G, fontSize:14, color:T.inkMid, lineHeight:1.7, maxWidth:380, margin:"0 auto 20px" }}>O dashboard nasce aqui. Comece registrando sua primeira transação — receita ou despesa.</div>
              <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
                <button onClick={onNewTx} style={{ ...G, background:T.ink, color:"#fff", border:"none", borderRadius:11, padding:"11px 22px", fontSize:13, fontWeight:700, cursor:"pointer" }}>+ Nova transação</button>
                <button onClick={() => onNav("recorrencias")} style={{ ...G, background:"none", color:T.inkMid, border:`1px solid ${T.border}`, borderRadius:11, padding:"11px 22px", fontSize:13, fontWeight:600, cursor:"pointer" }}>Recorrências</button>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"flex-start", gap:10, background:T.blueLight, border:`1px solid ${T.blue}22`, borderRadius:10, padding:"11px 13px" }}>
              <span style={{ fontSize:16, flexShrink:0 }}>💡</span>
              <div style={{ flex:1 }}>
                <div style={{ ...G, fontSize:12, fontWeight:700, color:T.ink, marginBottom:2 }}>Registre sua receita mensal</div>
                <div style={{ ...G, fontSize:11, color:T.inkMid, lineHeight:1.55 }}>Em Recorrências, adicione seu salário ou renda. O dashboard mostrará projeções reais desde o início.</div>
              </div>
              <button onClick={() => onNav("recorrencias")} style={{ ...G, fontSize:11, fontWeight:700, color:T.blue, background:"none", border:"none", cursor:"pointer", flexShrink:0 }}>Ir →</button>
            </div>
          </>
        )}
      </div>
    );
  }
  const moodKey    = useMemo(() => calcMood(day, budgetPct, freePct), [day, budgetPct, freePct]);
  const mood       = MOODS[moodKey];
  const moodActions= getMoodActions(moodKey);
  const rhythmData = useMemo(() => genRhythmData(day, budgetPct), [day, budgetPct]);
  const [period, setPeriod] = useState("mes");
  const periodBadge = PERIODS_V4.find(p => p.key === period)?.badge;

  const BUDGET    = 4200;
  const spent     = Math.round(BUDGET * budgetPct / 100);
  const timePct   = Math.round((day / 31) * 100);
  const balance   = 8230;
  const freeAmt   = Math.round(balance * freePct / 100);
  const committed = Math.round(balance * 0.22);
  const usedAmt   = balance - freeAmt - committed;
  const daysLeft  = 31 - day;
  const dailyBudget = Math.round((BUDGET * (1 - budgetPct / 100)) / Math.max(daysLeft, 1));

  const { Icon: MoodIcon, InsightIcon } = mood;

  const insightStat = budgetPct <= timePct
    ? `R$ ${Math.abs(Math.round(BUDGET * (timePct / 100 - budgetPct / 100)))} à frente`
    : `R$ ${Math.abs(Math.round(BUDGET * (budgetPct / 100 - timePct / 100)))} acima`;

  const insightBody = {
    serene:   `Com ${daysLeft} dias restantes, você pode gastar até ${fmtAbs(dailyBudget)}/dia com folga.`,
    healthy:  `Ritmo equilibrado — tente manter ${fmtAbs(dailyBudget)}/dia pelos próximos ${daysLeft} dias.`,
    watchful: `Reduza cerca de R$ 80/dia para fechar o mês no zero. Revise categorias variáveis.`,
    tense:    `Limite gastos a ${fmtAbs(dailyBudget)}/dia para não estourar o orçamento de março.`,
    alert:    `Evite novas despesas e avalie pausar recorrências não essenciais esta semana.`,
  }[moodKey];

  const anim = (d = 0) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(12px)",
    transition: `opacity 0.45s ${d}s, transform 0.45s ${d}s`,
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18, position:"relative" }}>
      {/* BG FX */}
      <div style={{ position:"fixed", inset:0, background:mood.bgFx, pointerEvents:"none", zIndex:0, transition:"background 0.18s" }} />

      <div style={{ position:"relative", zIndex:1, paddingTop:4 }}>
        <Breadcrumb label="Início" />
        <PageTitle sans="Visão" serif="Geral" />
      </div>

      {/* ── PERIOD SELECTOR ── */}
      <div style={{ ...anim(0.03), display:"flex", alignItems:"center", justifyContent:"space-between", position:"relative", zIndex:1 }}>
        <div style={{ display:"flex", gap:2, background:T.grayLight, borderRadius:9, padding:3 }}>
          {PERIODS_V4.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)} style={{ ...G, padding:"5px 13px", borderRadius:7, border:"none", fontSize:12, fontWeight:period===p.key?600:400, cursor:"pointer", background:period===p.key?T.surface:"transparent", color:period===p.key?T.ink:T.inkLight, boxShadow:period===p.key?T.sm:"none", transition:"all 0.18s" }}>
              {isMobile ? p.badge : p.label}
            </button>
          ))}
        </div>
        {!isMobile && (
          <div style={{ ...G, display:"flex", alignItems:"center", gap:6, fontSize:11, color:T.inkLight }}>
            <span>Cards históricos:</span>
            <Badge color={T.inkMid} bg={T.grayLight}>{periodBadge}</Badge>
            <span>· Saldo e ritmo sempre em tempo real</span>
          </div>
        )}
      </div>

      {/* ── HERO ROW ── */}
      <div style={{ ...anim(0.06), display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 300px", gap:14, position:"relative", zIndex:1 }}>

        {/* Main headline card */}
        <Card style={{ padding:22 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, background:mood.badgeBg, color:mood.badgeColor, borderRadius:9999, padding:"3px 10px", fontSize:11, fontWeight:700, border:`1px solid ${mood.insightBorder}`, transition:"all 0.8s" }}>
              <MoodIcon size={10} /> {mood.label}
            </div>
            <span style={{ ...S, fontSize:13, fontWeight:600, color: moodKey==="serene"||moodKey==="healthy" ? T.inkMid : moodKey==="watchful" ? T.amber : T.red, transition:"color 0.18s" }}>{mood.greeting}</span>
          </div>

          <div style={{ ...S, ...NUM, fontSize:isMobile?"2.2rem":mood.headlineSize, lineHeight:1.05, color:mood.headlineColor, transition:"font-size 0.6s, color 0.8s", letterSpacing:"-1px", marginBottom:8 }}>
            {fmtAbs(freeAmt)}
          </div>
          <div style={{ ...G, display:"flex", alignItems:"center", gap:8, marginBottom:18 }}>
            <span style={{ fontSize:12, color:T.inkMid }}>saldo livre de compromissos</span>
            <InfoTip width={260} text={"Saldo bancário (" + fmtAbs(balance) + ")\nmenos gastos do período (" + fmtAbs(usedAmt) + ")\nmenos comprometido c/ recorrências (" + fmtAbs(committed) + ")\n= " + fmtAbs(freeAmt) + " disponíveis agora."} />
            <span style={{ fontSize:12, fontWeight:700, color:moodKey==="serene"||moodKey==="healthy"?T.green:T.red, display:"flex", alignItems:"center", gap:3 }}>
              {moodKey==="serene"||moodKey==="healthy"?<TrendingUp size={12}/>:<TrendingDown size={12}/>}
              <span>
                {moodKey==="serene"?"+R$ 340":moodKey==="healthy"?"+R$ 90":"-R$ 210"}
                {" "}
                <span style={{ fontWeight:400, color:T.inkMid }}>vs ritmo</span>
              </span>
              <InfoTip width={240} text={moodKey==="serene"||moodKey==="healthy"
                ? "No dia " + day + ", o ritmo linear do orçamento projetava R$ " + Math.round(4200*(day/31)).toLocaleString("pt-BR") + ". Você gastou menos — diferença positiva."
                : "No dia " + day + ", o ritmo linear do orçamento projetava R$ " + Math.round(4200*(day/31)).toLocaleString("pt-BR") + ". Você já gastou mais do que deveria até agora."} />
            </span>
          </div>

          {/* Balance bar */}
          <div>
            <div style={{ ...G, display:"flex", justifyContent:"space-between", marginBottom:6 }}>
              <span style={{ fontSize:11, color:T.inkMid }}>Composição do saldo</span>
              <span style={{ ...M_MONO, ...NUM, fontSize:12, fontWeight:700, color:T.ink }}>{fmtAbs(balance)}</span>
            </div>
            <div style={{ height:7, background:T.grayLight, borderRadius:99, overflow:"hidden", display:"flex" }}>
              <div style={{ width:`${(usedAmt/balance)*100}%`, background:T.inkGhost, transition:"width 0.6s" }} />
              <div style={{ width:`${(committed/balance)*100}%`, background:mood.bar, opacity:0.4, transition:"width 0.6s, background 0.8s" }} />
              <div style={{ flex:1, background:mood.bar, transition:"background 0.18s" }} />
            </div>
            <div style={{ ...G, display:"flex", gap:14, marginTop:7 }}>
              {[
                { label:"Gasto",        color:T.inkGhost, value:fmtAbs(usedAmt),   opacity:1   },
                { label:"Comprometido", color:mood.bar,   value:fmtAbs(committed), opacity:0.5 },
                { label:"Livre",        color:mood.bar,   value:fmtAbs(freeAmt),   opacity:1   },
              ].map(({ label, color, value, opacity }) => (
                <div key={label} style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <div style={{ width:7, height:7, borderRadius:2, background:color, opacity, transition:"background 0.18s", flexShrink:0 }} />
                  <span style={{ fontSize:10, color:T.inkMid }}>{label}</span>
                  <span style={{ ...M_MONO, ...NUM, fontSize:10, color:T.inkMid, fontWeight:600 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Insight card */}
        <Card style={{ padding:isMobile?14:20, background:mood.insightBg, border:`1px solid ${mood.insightBorder}`, boxShadow:"none", transition:"all 0.8s" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <InsightIcon size={13} color={mood.kicker} />
              <span style={{ ...G, fontSize:10, fontWeight:700, color:mood.kicker, letterSpacing:"0.08em" }}>INSIGHT DO DIA</span>
            </div>
            <Sparkles size={12} color={mood.kicker} style={{ opacity:0.5 }} />
          </div>

          {/* Big stat in Geist Mono */}
          <div style={{ ...M_MONO, ...NUM, fontSize:26, fontWeight:700, color:mood.headlineColor, lineHeight:1, marginBottom:4, transition:"color 0.18s" }}>
            {insightStat}
          </div>
          <div style={{ ...G, fontSize:11, color:mood.kicker, fontWeight:600, marginBottom:12, transition:"color 0.18s" }}>
            {budgetPct <= timePct ? "do ritmo esperado ✓" : "do ritmo esperado ↑"}
          </div>

          {/* Body in plain Geist — readable */}
          <p style={{ ...G, fontSize:13, lineHeight:1.6, color:T.inkMid, marginBottom:16 }}>{insightBody}</p>

          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {moodActions.map(({ label, Icon: ActionIcon }) => (
              <button key={label} style={{ ...G, display:"flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.7)", border:`1px solid ${mood.insightBorder}`, borderRadius:9, padding:"7px 11px", fontSize:12, color:mood.kicker, fontWeight:600, cursor:"pointer", textAlign:"left" }}>
                <ActionIcon size={12} color={mood.kicker} /> {label}
                <ChevronRight size={11} style={{ marginLeft:"auto" }} />
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* ── METRICS ── */}
      <div style={{ ...anim(0.1), display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(3,1fr)", gap:12, position:"relative", zIndex:1 }}>
        {[
          { label:"Receitas em março",   value:fmtAbs(7500), delta:"+R$ 700 vs fev",    up:true  },
          { label:"Despesas em março",   value:fmtAbs(spent),delta:budgetPct>timePct?"acima do ritmo":"no ritmo", up:budgetPct<=timePct },
          { label:"Recorrências ativas", value:fmtAbs(1840), delta:"6 cobranças ativas", up:null  },
        ].map(({ label, value, delta, up }) => (
          <Card key={label} style={{ padding:"16px 18px" }}>
            <div style={{ ...G, fontSize:11, fontWeight:500, color:T.inkMid, marginBottom:8 }}>{label}</div>
            <div style={{ ...G, ...NUM, fontSize:20, fontWeight:700, color:T.ink, marginBottom:4 }}>{value}</div>
            <div style={{ ...G, display:"flex", alignItems:"center", gap:4, fontSize:11, color:up==null?T.inkLight:up?T.green:T.red }}>
              {up===true && <TrendingUp size={10} />}{up===false && <TrendingDown size={10} />}{delta}
            </div>
          </Card>
        ))}
      </div>

      {/* ── RHYTHM + RIGHT COLUMN ── */}
      <div style={{ ...anim(0.14), display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 300px", gap:14, position:"relative", zIndex:1 }}>

        {/* Ritmo de Gastos — protagonist */}
        <Card style={{ padding:"20px 20px 14px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <div>
              <div style={{ ...G, fontSize:14, fontWeight:700, color:T.ink }}>Ritmo de Gastos</div>
              <div style={{ ...G, fontSize:11, color:T.inkLight, marginTop:2 }}>Real acumulado vs. projeção linear — {periodBadge}</div>
            </div>
            <div style={{ display:"flex", gap:12 }}>
              {[["#D1D5DB","Projeção"],[mood.bar,"Real"]].map(([c,l]) => (
                <div key={l} style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <div style={{ width:14, height:2, background:c, borderRadius:1, transition:"background 0.18s" }} />
                  <span style={{ ...G, fontSize:10, color:T.inkLight }}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:8, background:mood.accentLight, borderRadius:9, padding:"7px 13px", marginBottom:12, transition:"background 0.18s" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:mood.bar, transition:"background 0.18s", flexShrink:0 }} />
            <span style={{ ...G, fontSize:12, color:mood.kicker, fontWeight:700, transition:"color 0.18s" }}>
              {budgetPct <= timePct
                ? `R$ ${Math.abs(Math.round(BUDGET*(timePct/100 - budgetPct/100)))} à frente do ritmo`
                : `R$ ${Math.abs(Math.round(BUDGET*(budgetPct/100 - timePct/100)))} acima do ritmo`}
            </span>
            <span style={{ ...G, fontSize:11, color:T.inkMid, marginLeft:"auto" }}>dia {day}/31 · {timePct}% do mês</span>
          </div>

          <ResponsiveContainer width="100%" height={isMobile ? 150 : 190}>
            <ComposedChart data={rhythmData} margin={{ top:4, right:4, bottom:0, left:-10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
              <XAxis dataKey="dia" tick={{ ...G, fontSize:10, fill:T.inkLight }} tickLine={false} axisLine={false} tickFormatter={v => v%5===0||v===1?`${v}`:""} />
              <YAxis tick={{ ...G, ...NUM, fontSize:10, fill:T.inkLight }} tickLine={false} axisLine={false} tickFormatter={fmtK} />
              <Tooltip content={<RhythmTooltipV4 />} />
              <ReferenceLine x={day} stroke={mood.bar} strokeDasharray="4 2" strokeWidth={1.5} label={{ value:"Hoje", position:"top", fill:mood.bar, fontSize:10, fontFamily:"Geist,sans-serif" }} />
              <Line type="monotone" dataKey="proj" stroke="#D1D5DB" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
              <Line type="monotone" dataKey="real" stroke={mood.bar} strokeWidth={2.5} dot={false} connectNulls={false} style={{ transition:"stroke 0.8s" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        {/* Right column — Gastos por Categoria only */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

          {/* Gastos por Categoria */}
          <Card style={{ padding:18 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
              <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink }}>Gastos por Categoria</div>
              <Badge color={T.inkMid} bg={T.grayLight}>{periodBadge}</Badge>
            </div>
            <div style={{ display:"flex", gap:12, marginBottom:12, marginTop:4 }}>
              {[["#D1D5DB","atual"],["#9CA3AF","média"],["#FCA5A5","acima"]].map(([c,l]) => (
                <div key={l} style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <div style={{ width:10, height:l==="média"?2:5, background:c, borderRadius:l==="média"?1:2 }} />
                  <span style={{ ...G, fontSize:10, color:T.inkLight }}>{l}</span>
                </div>
              ))}
            </div>
            {(() => {
              const maxVal = Math.max(...CATS_V4.map(c => Math.max(c.value, c.avg)));
              return CATS_V4.map(c => {
                const barPct  = (c.value / maxVal) * 100;
                const avgPct  = (c.avg   / maxVal) * 100;
                const isOver  = c.value > c.avg;
                const safePct = Math.min(barPct, avgPct);
                const overPct = isOver ? barPct - avgPct : 0;
                return (
                  <div key={c.name} style={{ marginBottom:9 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div style={{ width:7, height:7, borderRadius:2, background:c.color, flexShrink:0 }} />
                        <span style={{ ...G, fontSize:12, fontWeight:500, color:T.ink }}>{c.name}</span>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        {isOver && <span style={{ ...G, fontSize:10, fontWeight:700, color:T.red, background:T.redLight, borderRadius:99, padding:"1px 5px" }}>+{Math.round((c.value/c.avg-1)*100)}%</span>}
                        <span style={{ ...M_MONO, ...NUM, fontSize:11, fontWeight:600, color:T.ink }}>{fmtAbs(c.value)}</span>
                      </div>
                    </div>
                    <div style={{ position:"relative", height:6, background:T.grayLight, borderRadius:99 }}>
                      <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${safePct}%`, background:c.color, opacity:0.55, borderRadius:99 }} />
                      {overPct>0 && <div style={{ position:"absolute", left:`${avgPct}%`, top:0, height:"100%", width:`${overPct}%`, background:T.red, opacity:0.5, borderRadius:"0 99px 99px 0" }} />}
                      <div style={{ position:"absolute", top:-3, left:`${avgPct}%`, width:2, height:12, background:T.inkMid, borderRadius:1, transform:"translateX(-50%)", zIndex:2 }} />
                    </div>
                  </div>
                );
              });
            })()}
          </Card>

        </div>
      </div>

      {/* ── TRANSACTIONS + PRÓXIMOS DÉBITOS ── */}
      <div style={{ ...anim(0.18), display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 300px", gap:14, position:"relative", zIndex:1 }}>

        {/* Últimas Transações */}
        <Card style={{ overflow:"hidden" }}>
          <div style={{ padding:"16px 20px 12px", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:`1px solid ${T.border}` }}>
            <span style={{ ...G, fontSize:14, fontWeight:700, color:T.ink }}>Últimas Transações</span>
            <button onClick={() => onNav("transacoes")} style={{ ...G, display:"flex", alignItems:"center", gap:4, background:"none", border:"none", fontSize:12, fontWeight:600, color:T.blue, cursor:"pointer" }}>
              Ver todas <ArrowUpRight size={12} />
            </button>
          </div>
          {TRANSACTIONS.slice(0, 5).map((t, i) => (
            <div key={t.id} style={{ display:"flex", alignItems:"center", gap:isMobile?8:12, padding:isMobile?"10px 14px":"12px 20px", borderBottom:i<4?`1px solid ${T.border}`:"none", transition:"background 0.1s" }}
              onMouseEnter={e => e.currentTarget.style.background = T.surfaceHov}
              onMouseLeave={e => e.currentTarget.style.background = ""}>
              <div style={{ fontSize:22 }}>{t.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ ...G, fontSize:13, fontWeight:600, color:T.ink, display:"flex", alignItems:"center", gap:6 }}>
                  {t.desc} {t.rec && <Repeat size={10} color={T.blue} />}
                  {t.status === "pendente" && <Badge color={T.amber} bg={T.amberLight}>Pendente</Badge>}
                </div>
                <div style={{ ...G, fontSize:11, color:T.inkMid, marginTop:1 }}>{t.cat} · {t.date}</div>
              </div>
              <div style={{ ...G, ...NUM, fontSize:14, fontWeight:700, color:t.val > 0 ? T.green : T.ink }}>{fmtSgn(t.val)}</div>
            </div>
          ))}
        </Card>

        {/* Próximos Débitos — compact */}
          <Card style={{ padding:16 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink }}>Próximos Débitos</div>
              <Badge color={T.inkMid} bg={T.grayLight}>mar/26</Badge>
            </div>

            {/* First highlighted */}
            <div style={{ background:mood.accentLight, border:`1px solid ${mood.insightBorder}`, borderRadius:10, padding:"10px 12px", marginBottom:8, display:"flex", alignItems:"center", justifyContent:"space-between", transition:"all 0.8s" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ textAlign:"center", minWidth:32 }}>
                  <div style={{ ...M_MONO, ...NUM, fontSize:16, fontWeight:700, color:mood.headlineColor, lineHeight:1, transition:"color 0.18s" }}>{DEBITS_V4[0].day}</div>
                  <div style={{ ...G, fontSize:8, color:T.inkLight, fontWeight:600, letterSpacing:"0.06em" }}>MAR</div>
                </div>
                <div style={{ width:1, height:28, background:mood.insightBorder }} />
                <div>
                  <div style={{ ...G, fontSize:12, fontWeight:700, color:T.ink }}>{DEBITS_V4[0].name}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:1 }}>
                    <span style={{ ...G, fontSize:10, color:T.inkMid }}>{DEBITS_V4[0].cat}</span>
                    <Badge color={mood.kicker} bg={mood.badgeBg}>em {DEBITS_V4[0].daysLeft}d</Badge>
                  </div>
                </div>
              </div>
              <div style={{ ...M_MONO, ...NUM, fontSize:14, fontWeight:700, color:mood.headlineColor, transition:"color 0.18s" }}>{fmtAbs(DEBITS_V4[0].value)}</div>
            </div>

            {DEBITS_V4.slice(1).map((d, i) => (
              <div key={d.name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 2px", borderBottom:i<DEBITS_V4.length-2?`1px solid ${T.bg}`:"none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ ...M_MONO, ...NUM, fontSize:11, fontWeight:600, color:T.inkMid, width:32, textAlign:"center" }}>{d.day}/03</span>
                  <div>
                    <div style={{ ...G, fontSize:12, fontWeight:500, color:T.ink }}>{d.name}</div>
                    <div style={{ ...G, fontSize:10, color:T.inkMid }}>{d.cat}</div>
                  </div>
                </div>
                <span style={{ ...M_MONO, ...NUM, fontSize:12, fontWeight:600, color:T.ink }}>{fmtAbs(d.value)}</span>
              </div>
            ))}

            <div style={{ display:"flex", justifyContent:"space-between", marginTop:10, paddingTop:10, borderTop:`1px solid ${T.border}` }}>
              <span style={{ ...G, fontSize:11, color:T.inkMid }}>Total · próx. 14 dias</span>
              <span style={{ ...M_MONO, ...NUM, fontSize:13, fontWeight:700, color:T.ink }}>{fmtAbs(DEBITS_V4.reduce((s,d)=>s+d.value,0))}</span>
            </div>
          </Card>

      </div>
    </div>
  );
};

/* ─── RITMO ─────────────────────────────────────────────── */
const DOW_DATA_MAR = [
  { day: "Dom", short: "D", val: 145 },
  { day: "Seg", short: "S", val: 318 },
  { day: "Ter", short: "T", val: 204 },
  { day: "Qua", short: "Q", val: 271 },
  { day: "Qui", short: "Q", val: 487 },
  { day: "Sex", short: "S", val: 362 },
  { day: "Sáb", short: "S", val: 231 },
];
const DOW_DATA_FEV = [
  { day: "Dom", short: "D", val: 98  },
  { day: "Seg", short: "S", val: 344 },
  { day: "Ter", short: "T", val: 221 },
  { day: "Qua", short: "Q", val: 298 },
  { day: "Qui", short: "Q", val: 510 },
  { day: "Sex", short: "S", val: 412 },
  { day: "Sáb", short: "S", val: 189 },
];

const PERIODOS_RITMO = [
  { key: "mar26", label: "mar/26", isClosed: false },
  { key: "fev26", label: "fev/26", isClosed: true  },
];

const RitmoPage = ({ onNav, isMobile = false }) => {
  const [periodoKey, setPeriodoKey] = useState("mar26");
  const periodo   = PERIODOS_RITMO.find(p => p.key === periodoKey);
  const isClosed  = periodo.isClosed;

  // Dados do período selecionado
  const chartData   = isClosed ? fev26Data  : rhythmData;
  const totalDays   = isClosed ? 28         : 31;
  const budgetVal   = isClosed ? BUDGET_FEV : BUDGET;
  const todayDay    = isClosed ? totalDays  : TODAY_RIT;  // mês fechado = último dia
  const realFinal   = isClosed ? fev26Real  : curReal;
  const projFinal   = isClosed ? fev26Proj  : curProj;
  const dowData     = isClosed ? DOW_DATA_FEV : DOW_DATA_MAR;
  const dowMax      = Math.max(...dowData.map(d => d.val));

  const diff        = realFinal - projFinal;
  const isOk        = diff <= 0;
  const projFim     = isClosed ? realFinal : Math.round((curReal / TODAY_RIT) * 31);
  const daysLeft    = isClosed ? 0 : totalDays - todayDay;
  const spentPct    = Math.round((realFinal / budgetVal) * 100);
  const timePct     = Math.round((todayDay / totalDays) * 100);
  const dailyLeft   = daysLeft > 0 ? Math.round((budgetVal - realFinal) / daysLeft) : 0;
  const dailyAvg    = Math.round(realFinal / todayDay);
  const projOver    = projFim > budgetVal;
  const projColor   = projOver ? T.red : T.green;
  const diffColor   = isOk ? T.green : T.red;

  const RitmoTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const realVal  = payload.find(p => p.dataKey === "real")?.value;
    const projVal  = payload.find(p => p.dataKey === "proj")?.value;
    const ritmoVal = payload.find(p => p.dataKey === "ritmoAtual")?.value;
    const hasDiff  = realVal != null && projVal != null;
    const diffVal  = hasDiff ? realVal - projVal : null;
    const diffPct  = hasDiff ? ((realVal / projVal - 1) * 100).toFixed(1) : null;
    const abaixo   = diffVal < 0;
    return (
      <div style={{ ...G, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 14px", boxShadow: T.md, fontSize: 11, minWidth: 200 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: T.ink, fontSize: 12 }}>Dia {label}</div>
        {projVal != null && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: 9999, background: "#D1D5DB" }} />
            <span style={{ color: T.inkMid, flex: 1 }}>Projeção linear</span>
            <span style={{ ...M_MONO, ...NUM, fontWeight: 600 }}>{fmtAbs(projVal)}</span>
          </div>
        )}
        {realVal != null && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: 9999, background: isOk ? T.green : T.red }} />
            <span style={{ color: T.inkMid, flex: 1 }}>Real acumulado</span>
            <span style={{ ...M_MONO, ...NUM, fontWeight: 600 }}>{fmtAbs(realVal)}</span>
          </div>
        )}
        {ritmoVal != null && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: 9999, background: T.purple }} />
            <span style={{ color: T.inkMid, flex: 1 }}>Se mantiver ritmo</span>
            <span style={{ ...M_MONO, ...NUM, fontWeight: 600 }}>{fmtAbs(ritmoVal)}</span>
          </div>
        )}
        {hasDiff && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12 }}>{abaixo ? "↓" : "↑"}</span>
            <span style={{ ...M_MONO, ...NUM, fontWeight: 700, color: abaixo ? T.green : T.red }}>{fmtAbs(Math.abs(diffVal))}</span>
            <span style={{ color: abaixo ? T.green : T.red, fontWeight: 600 }}>
              {abaixo ? `−${Math.abs(diffPct)}% abaixo` : `+${diffPct}% acima`}
            </span>
          </div>
        )}
      </div>
    );
  };

  const DowTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ ...G, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 13px", boxShadow: T.md, fontSize: 11 }}>
        <div style={{ fontWeight: 700, color: T.ink, marginBottom: 3 }}>{label}</div>
        <div style={{ ...M_MONO, ...NUM, fontSize: 13, fontWeight: 700, color: T.ink }}>{fmtAbs(payload[0].value)}</div>
        <div style={{ ...G, fontSize: 10, color: T.inkLight, marginTop: 1 }}>média neste período</div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Header */}
      <div style={{ paddingTop: 4, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div><Breadcrumb label="Planejar" /><PageTitle sans="Ritmo" serif="de Gastos" /></div>
        {/* Period navigator */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "4px 6px", boxShadow: T.sm }}>
          <button
            onClick={() => setPeriodoKey(k => k === "mar26" ? "fev26" : "mar26")}
            style={{ background: "none", border: "none", cursor: periodoKey==="mar26"?"default":"pointer", color: periodoKey==="mar26"?T.inkGhost:T.inkMid, padding: "4px 8px", borderRadius: 7, display: "flex", alignItems: "center" }}>
            <ChevronLeft size={14} />
          </button>
          <span style={{ ...G, fontSize: 12, fontWeight: 700, color: T.ink, padding: "0 6px", minWidth: 60, textAlign: "center" }}>
            {periodo.label}
            {isClosed && <span style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid, marginLeft: 4 }}>fechado</span>}
          </span>
          <button
            onClick={() => setPeriodoKey(k => k === "fev26" ? "mar26" : "fev26")}
            style={{ background: "none", border: "none", cursor: periodoKey==="mar26"?"default":"pointer", color: periodoKey==="mar26"?T.inkGhost:T.inkMid, padding: "4px 8px", borderRadius: 7, display: "flex", alignItems: "center" }}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Status banner */}
      <div style={{ background: isOk ? T.greenLight : T.redLight, border: `1px solid ${isOk ? T.green : T.red}33`, borderRadius: 14, padding: "13px 18px", display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: 14, flexWrap: isMobile ? "wrap" : "nowrap" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: isOk ? T.green : T.red, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {isOk ? <TrendingDown size={18} color="#fff" /> : <TrendingUp size={18} color="#fff" />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ ...G, fontSize: 13, fontWeight: 700, color: isOk ? T.green : T.red }}>
            {isClosed
              ? isOk
                ? `Fechou ${Math.abs(((realFinal/budgetVal)-1)*100).toFixed(1)}% abaixo do orçamento — mês controlado`
                : `Fechou ${(((realFinal/budgetVal)-1)*100).toFixed(1)}% acima do orçamento em ${periodo.label}`
              : isOk
                ? `${Math.abs(((curReal/curProj)-1)*100).toFixed(1)}% abaixo do ritmo esperado — você está no controle`
                : `${(((curReal/curProj)-1)*100).toFixed(1)}% acima do ritmo esperado — atenção necessária`}
          </div>
          <div style={{ ...G, fontSize: 11, color: `${isOk ? T.green : T.red}bb`, marginTop: 2 }}>
            {isClosed
              ? `${totalDays} dias · mês encerrado · total realizado: ${fmtAbs(realFinal)} de ${fmtAbs(budgetVal)} orçados`
              : `Dia ${todayDay} de ${totalDays} · ${timePct}% do período · ${daysLeft} dias restantes`}
          </div>
        </div>
        {!isClosed && <Btn variant="dark" onClick={() => onNav("simulacao")}><FlaskConical size={12} /> Simular</Btn>}
      </div>

      {/* 3 metric cards — mobile: 2-col, 3rd spans full width */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: 10 }}>
        {(isClosed ? [
          { label: isMobile ? "Total realizado" : `Total realizado · ${periodo.label}`, val: fmtAbs(realFinal), color: projOver ? T.red : T.green, sub: `de ${fmtAbs(budgetVal)} orçados` },
          { label: isMobile ? "Média diária" : "Média diária realizada", val: fmtAbs(dailyAvg), color: T.ink, sub: `em ${totalDays} dias` },
          { label: "Diferença final", val: fmtAbs(Math.abs(realFinal - budgetVal)), color: diffColor, sub: isOk ? "abaixo do orçamento ✓" : "acima do orçamento ↑" },
        ] : [
          { label: isMobile ? `Gasto · dia ${todayDay}` : `Gasto real · dia ${todayDay}`, val: fmtAbs(realFinal), color: T.ink, sub: `de ${fmtAbs(budgetVal)} orçados` },
          { label: isMobile ? "Ritmo hoje" : "Ritmo esperado hoje", val: fmtAbs(projFinal), color: T.blue, sub: "acumulado linear" },
          { label: "Diferença", val: fmtAbs(Math.abs(diff)), color: diffColor, sub: isOk ? "abaixo do esperado ✓" : "acima do esperado ↑" },
        ]).map((k, i) => (
          <Card key={i} style={{ padding: isMobile ? "12px 14px" : "14px 18px", gridColumn: isMobile && i === 2 ? "1 / -1" : undefined }}>
            <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{k.label}</div>
            <div style={{ ...M_MONO, ...NUM, fontSize: isMobile ? 16 : 18, fontWeight: 700, color: k.color, marginBottom: 3 }}>{k.val}</div>
            <div style={{ ...G, fontSize: isMobile ? 9 : 10, color: T.inkMid }}>{k.sub}</div>
          </Card>
        ))}
      </div>

      {/* Chart + Projeção/Resultado — stacked on mobile */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 280px", gap: 14 }}>

        {/* Gráfico principal */}
        <Card style={{ padding: "20px 20px 14px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ ...G, fontSize: 14, fontWeight: 700, color: T.ink }}>
              {isClosed ? "Histórico Real vs. Projeção" : "Acumulado vs. Projeção"}
            </div>
            <div style={{ display: "flex", gap: isMobile ? 8 : 12, flexWrap: "wrap" }}>
              {[
                ["#D1D5DB", true, isMobile ? "Projeção" : "Projeção linear"],
                [isOk ? T.green : T.red, false, "Real"],
                ...(!isClosed ? [[T.purple, true, isMobile ? "Ritmo atual" : "Se mantiver ritmo"]] : []),
              ].map(([c, dash, l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <svg width="14" height="6"><line x1="0" y1="3" x2="14" y2="3" stroke={c} strokeWidth="2" strokeDasharray={dash ? "4 3" : ""} /></svg>
                  <span style={{ ...G, fontSize: isMobile ? 9 : 10, color: T.inkMid }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 14 }}>
            {isClosed ? `Mês completo · ${periodo.label} · ${totalDays} dias` : `Gasto real × ritmo orçado diário · Março 2026`}
          </div>
          <div style={{ flex: 1, minHeight: isMobile ? 160 : 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                <XAxis dataKey="day" tick={{ ...G, fontSize: 10, fill: T.inkLight }} axisLine={false} tickLine={false} tickFormatter={v => v % 5 === 0 || v === 1 ? `${v}` : ""} />
                <YAxis tick={{ ...G, ...NUM, fontSize: 10, fill: T.inkLight }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
                <Tooltip content={<RitmoTooltip />} />
                {!isClosed && (
                  <ReferenceLine x={todayDay} stroke={T.amber} strokeWidth={1.5} strokeDasharray="4 3"
                    label={{ value: "Hoje", position: "top", fill: T.amber, fontSize: 10, fontFamily: "Geist,sans-serif" }} />
                )}
                <ReferenceLine y={budgetVal} stroke={`${T.blue}44`} strokeDasharray="5 4"
                  label={isMobile ? undefined : { value: "Orçamento", position: "right", fill: T.blue, fontSize: 10, fontFamily: "Geist,sans-serif" }} />
                {!isClosed && estouroDia && estouroDia <= 31 && estouroDia > TODAY_RIT && (
                  <ReferenceLine x={estouroDia} stroke={`${T.red}88`} strokeWidth={1.5} strokeDasharray="3 3"
                    label={{ value: `estouro dia ${estouroDia}`, position: "insideTopLeft", fill: T.red, fontSize: 10, fontFamily: "Geist,sans-serif" }} />
                )}
                <Area dataKey="proj" name="proj" type="monotone" fill={`${T.blue}06`} stroke="#D1D5DB" strokeWidth={1.5} strokeDasharray="6 4" dot={false} />
                <Line dataKey="real" name="real" type="monotone" stroke={isOk ? T.green : T.red} strokeWidth={2.5} dot={false} connectNulls={false} />
                {!isClosed && (
                  <Line dataKey="ritmoAtual" name="ritmoAtual" type="monotone" stroke={T.purple} strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls={false} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Card direito: Projeção (aberto) ou Resultado (fechado) */}
        {/* Mobile: compact 2x2 grid — Desktop: full vertical card */}
        {isMobile ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: isClosed ? "Total realizado" : "Projeção fim de mês", val: fmtAbs(projFim), color: projColor, sub: projOver ? `+${fmtAbs(projFim-budgetVal)} acima` : `${fmtAbs(budgetVal-projFim)} de margem` },
              { label: "Orçamento",   val: fmtAbs(budgetVal), color: T.ink, sub: periodo.label },
              { label: "Diferença",   val: fmtAbs(Math.abs(projFim-budgetVal)), color: projOver ? T.red : T.green, sub: projOver ? "acima ↑" : "abaixo ✓" },
              { label: isClosed ? "Média diária" : "Ritmo necessário", val: `${fmtAbs(isClosed ? dailyAvg : dailyLeft)}/dia`, color: T.ink, sub: isClosed ? `${totalDays} dias` : `${daysLeft} dias restantes` },
            ].map((k, i) => (
              <Card key={i} style={{ padding: "12px 14px" }}>
                <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{k.label}</div>
                <div style={{ ...M_MONO, ...NUM, fontSize: 15, fontWeight: 800, color: k.color, marginBottom: 2 }}>{k.val}</div>
                <div style={{ ...G, fontSize: 10, color: k.color === T.ink ? T.inkMid : k.color, fontWeight: 500 }}>{k.sub}</div>
              </Card>
            ))}
            {/* Progress bar spanning full width */}
            <Card style={{ padding: "12px 14px", gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.07em" }}>{isClosed ? "Execução" : "Progresso"}</span>
                <span style={{ ...G, ...NUM, fontSize: 10, fontWeight: 700, color: spentPct > timePct ? T.red : T.green }}>{spentPct}% consumido</span>
              </div>
              {!isClosed && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ ...G, fontSize: 10, color: T.inkMid }}>Tempo</span>
                    <span style={{ ...G, ...NUM, fontSize: 10, color: T.inkMid }}>{timePct}%</span>
                  </div>
                  <div style={{ height: 4, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${timePct}%`, background: T.inkGhost, borderRadius: 99 }} />
                  </div>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ ...G, fontSize: 10, color: T.inkMid }}>Gasto</span>
                <span style={{ ...G, ...NUM, fontSize: 10, color: spentPct > timePct ? T.red : T.green }}>{spentPct}%</span>
              </div>
              <div style={{ height: 5, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(spentPct, 100)}%`, background: spentPct > timePct ? T.red : T.green, borderRadius: 99, transition: "width 0.6s" }} />
              </div>
            </Card>
          </div>
        ) : (
        <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 3 }}>
            {isClosed ? "Resultado do Período" : "Projeção Fim de Período"}
          </div>
          <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 20 }}>
            {isClosed ? `Mês encerrado · ${periodo.label}` : "Baseado no ritmo atual"}
          </div>
          <div style={{ marginBottom: 18, paddingBottom: 18, borderBottom: `1px solid ${T.border}` }}>
            <div style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
              {isClosed ? "Total realizado" : "Projeção atual"}
            </div>
            <div style={{ ...M_MONO, ...NUM, fontSize: 22, fontWeight: 800, color: projColor, letterSpacing: "-0.02em" }}>{fmtAbs(projFim)}</div>
            <div style={{ ...G, fontSize: 10, color: projColor, marginTop: 3, fontWeight: 600 }}>
              {projOver ? `+${fmtAbs(projFim - budgetVal)} acima do orçamento` : `${fmtAbs(budgetVal - projFim)} ${isClosed ? "de economia" : "de margem"}`}
            </div>
          </div>
          <div style={{ marginBottom: 18, paddingBottom: 18, borderBottom: `1px solid ${T.border}` }}>
            <div style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Orçamento do período</div>
            <div style={{ ...M_MONO, ...NUM, fontSize: 18, fontWeight: 700, color: T.ink }}>{fmtAbs(budgetVal)}</div>
          </div>
          <div style={{ marginBottom: 20, paddingBottom: 18, borderBottom: `1px solid ${T.border}` }}>
            <div style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Diferença {isClosed ? "final" : "estimada"}</div>
            <div style={{ ...M_MONO, ...NUM, fontSize: 18, fontWeight: 700, color: projOver ? T.red : T.green }}>
              {projOver ? "+" : "−"}{fmtAbs(Math.abs(projFim - budgetVal))}
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                {isClosed ? "Execução do período" : "Progresso do período"}
              </div>
              <span style={{ ...G, ...NUM, fontSize: 11, fontWeight: 700, color: spentPct > timePct ? T.red : T.green }}>{spentPct}%</span>
            </div>
            {isClosed ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ ...G, fontSize: 10, color: T.inkMid }}>Realizado vs. orçamento</span>
                  <span style={{ ...G, ...NUM, fontSize: 10, color: projOver ? T.red : T.green }}>{spentPct}%</span>
                </div>
                <div style={{ height: 7, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(spentPct, 100)}%`, background: projOver ? T.red : T.green, borderRadius: 99 }} />
                </div>
                {spentPct > 100 && <div style={{ ...G, fontSize: 10, color: T.red, marginTop: 4, fontWeight: 600 }}>+{spentPct - 100}% além do orçamento</div>}
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ ...G, fontSize: 10, color: T.inkMid }}>Tempo decorrido</span>
                    <span style={{ ...G, ...NUM, fontSize: 10, color: T.inkMid }}>{timePct}%</span>
                  </div>
                  <div style={{ height: 5, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${timePct}%`, background: T.inkGhost, borderRadius: 99 }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ ...G, fontSize: 10, color: T.inkMid }}>Orçamento consumido</span>
                    <span style={{ ...G, ...NUM, fontSize: 10, color: spentPct > timePct ? T.red : T.green }}>{spentPct}%</span>
                  </div>
                  <div style={{ height: 5, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(spentPct, 100)}%`, background: spentPct > timePct ? T.red : T.green, borderRadius: 99, transition: "width 0.6s" }} />
                  </div>
                </div>
              </>
            )}
          </div>
          <div style={{ background: T.grayLight, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
              {isClosed ? "Média diária realizada" : "Ritmo necessário"}
            </div>
            <div style={{ ...M_MONO, ...NUM, fontSize: 17, fontWeight: 800, color: T.ink }}>
              {fmtAbs(isClosed ? dailyAvg : dailyLeft)}
              <span style={{ ...G, fontSize: 10, fontWeight: 500, color: T.inkMid }}>/dia</span>
            </div>
            <div style={{ ...G, fontSize: 10, color: T.inkMid, marginTop: 3 }}>
              {isClosed ? `média ao longo de ${totalDays} dias` : `para fechar dentro do orçamento · ${daysLeft} dias restantes`}
            </div>
          </div>
        </Card>
        )}
      </div>

      {/* Gasto por Dia da Semana */}
      <Card style={{ padding: "20px 20px 14px" }}>
        <div style={{ marginBottom: 4 }}>
          <div style={{ ...G, fontSize: 14, fontWeight: 700, color: T.ink }}>Gasto por Dia da Semana</div>
          <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 2 }}>
            Média de gastos por dia · {periodo.label}
          </div>
        </div>
        <div style={{ marginTop: 20, display: "flex", alignItems: "flex-end", gap: 10, height: 140 }}>
          {dowData.map((d, i) => {
            const pct       = d.val / dowMax;
            const isWeekend = i === 0 || i === 6;
            const isToday   = !isClosed && i === 3;
            const barH      = Math.round(pct * 110);
            const barColor  = isToday ? T.blue : pct > 0.75 ? T.red : pct > 0.5 ? T.amber : T.inkGhost;
            return (
              <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                {!isMobile && <span style={{ ...M_MONO, ...NUM, fontSize: 10, fontWeight: 600, color: pct > 0.75 ? T.red : pct > 0.5 ? T.amber : T.inkMid }}>{fmtAbs(d.val)}</span>}
                <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 110 }}>
                  <div style={{ width: "100%", height: barH, background: barColor, borderRadius: "5px 5px 3px 3px", opacity: isWeekend && !isToday ? 0.5 : 1, transition: "height 0.4s, background 0.3s", position: "relative" }}>
                    {isToday && (
                      <div style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)", ...G, fontSize: 8, fontWeight: 700, color: T.blue, whiteSpace: "nowrap", background: T.blueLight, padding: "2px 5px", borderRadius: 4 }}>hoje</div>
                    )}
                  </div>
                </div>
                <span style={{ ...G, fontSize: isMobile ? 10 : 11, fontWeight: isToday ? 700 : 500, color: isToday ? T.blue : isWeekend ? T.inkMid : T.ink }}>{isMobile ? d.short : d.day}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: isMobile ? "grid" : "flex", gridTemplateColumns: isMobile ? "1fr 1fr" : undefined, gap: isMobile ? 6 : 16, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
          {[
            { color: T.blue,     label: "Hoje" },
            { color: T.red,      label: isMobile ? "Alto >75%" : "Alto (>75%)" },
            { color: T.amber,    label: isMobile ? "Moderado 50–75%" : "Moderado (50–75%)" },
            { color: T.inkGhost, label: isMobile ? "Baixo <50%" : "Baixo (<50%)" },
          ].map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: l.color, flexShrink: 0 }} />
              <span style={{ ...G, fontSize: 10, color: T.inkMid }}>{l.label}</span>
            </div>
          ))}
          {!isMobile && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ ...G, fontSize: 10, color: T.inkMid }}>Maior gasto:</span>
              <span style={{ ...G, fontSize: 10, fontWeight: 700, color: T.ink }}>{dowData.reduce((a, b) => a.val > b.val ? a : b).day}</span>
            </div>
          )}
        </div>
      </Card>

    </div>
  );
};


/* ─── TRANSAÇÕES ────────────────────────────────────────── */
/* ─── TRANSAÇÕES PAGE ────────────────────────────────────────── */

/* ─── PERIOD CALENDAR ─────────────────────────────────────────── */
const PeriodCalendar = ({ period, setPeriod, customFrom, setCustomFrom, customTo, setCustomTo, setVisible, PAGE_SIZE, onClose }) => {
  const [calYear,  setCalYear]  = useState(2026);
  const [calMonth, setCalMonth] = useState(2); // 0-indexed, March=2
  const [hoverDay, setHoverDay] = useState(null);

  const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const DAYS   = ["D","S","T","Q","Q","S","S"];

  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();

  const fromDate = customFrom ? new Date(customFrom+"T00:00:00") : null;
  const toDate   = customTo   ? new Date(customTo+"T00:00:00")   : null;

  const prevMonth = () => { if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1); };
  const nextMonth = () => { if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1); };

  const padNum = n => String(n).padStart(2,"0");
  const toStr  = d => `${d.getFullYear()}-${padNum(d.getMonth()+1)}-${padNum(d.getDate())}`;

  const dayClick = (day) => {
    const clicked = new Date(calYear, calMonth, day);
    const str = toStr(clicked);
    if (!fromDate || (fromDate && toDate)) {
      setCustomFrom(str); setCustomTo(""); setPeriod("custom"); setVisible(PAGE_SIZE);
    } else {
      if (clicked < fromDate) { setCustomFrom(str); setCustomTo(toStr(fromDate)); }
      else { setCustomTo(str); }
      setPeriod("custom"); setVisible(PAGE_SIZE);
    }
  };

  const isFrom  = d => fromDate && fromDate.getDate()===d && fromDate.getMonth()===calMonth && fromDate.getFullYear()===calYear;
  const isTo    = d => toDate   && toDate.getDate()===d   && toDate.getMonth()===calMonth   && toDate.getFullYear()===calYear;
  const inRange = d => {
    const cur = new Date(calYear, calMonth, d);
    const end = toDate || (hoverDay && fromDate && !toDate ? new Date(calYear, calMonth, hoverDay) : null);
    if (!fromDate || !end) return false;
    const lo = fromDate < end ? fromDate : end;
    const hi = fromDate < end ? end : fromDate;
    return cur > lo && cur < hi;
  };
  const isEdge  = d => isFrom(d) || isTo(d);
  const isToday = d => { const t = new Date(2026,2,20); return t.getDate()===d && t.getMonth()===calMonth && t.getFullYear()===calYear; };

  const cells = [];
  for (let i=0; i<firstDay; i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) cells.push(d);

  return (
    <div style={{ padding:"12px 14px 14px" }}>
      {/* Month nav */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <button onClick={prevMonth} style={{ background:"none", border:"none", cursor:"pointer",
          padding:"4px 8px", borderRadius:8, display:"flex", alignItems:"center", color:T.inkMid }}
          onMouseEnter={e=>e.currentTarget.style.background=T.bg}
          onMouseLeave={e=>e.currentTarget.style.background="none"}>
          <ChevronLeft size={15}/>
        </button>
        <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink }}>
          {MONTHS[calMonth]} {calYear}
        </div>
        <button onClick={nextMonth} style={{ background:"none", border:"none", cursor:"pointer",
          padding:"4px 8px", borderRadius:8, display:"flex", alignItems:"center", color:T.inkMid }}
          onMouseEnter={e=>e.currentTarget.style.background=T.bg}
          onMouseLeave={e=>e.currentTarget.style.background="none"}>
          <ChevronRight size={15}/>
        </button>
      </div>

      {/* Weekday headers */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:4 }}>
        {DAYS.map((d,i) => (
          <div key={i} style={{ ...G, fontSize:10, fontWeight:700, color:T.inkGhost,
            textAlign:"center", padding:"2px 0" }}>{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"2px 0" }}
        onMouseLeave={()=>setHoverDay(null)}>
        {cells.map((day,idx) => {
          if (!day) return <div key={`e${idx}`}/>;
          const edge  = isEdge(day);
          const from  = isFrom(day);
          const to    = isTo(day);
          const range = inRange(day);
          const today = isToday(day);
          const hov   = hoverDay===day;
          return (
            <div key={day}
              onClick={()=>dayClick(day)}
              onMouseEnter={()=>setHoverDay(day)}
              style={{ textAlign:"center", cursor:"pointer", padding:"1px 0",
                background: range ? `${T.blue}18` : "transparent",
                borderRadius: from&&to ? 8 : from ? "8px 0 0 8px" : to ? "0 8px 8px 0" : "none" }}>
              <div style={{ width:28, height:28, borderRadius:"50%", margin:"0 auto",
                display:"flex", alignItems:"center", justifyContent:"center",
                background: edge ? T.ink : hov ? T.bg : "transparent",
                border: today && !edge ? `1.5px solid ${T.ink}` : "none",
                transition:"background 0.1s" }}>
                <span style={{ ...G, fontSize:12, fontWeight: edge||today ? 700 : 400,
                  color: edge ? "#fff" : today ? T.ink : T.inkMid }}>
                  {day}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected range display */}
      {(fromDate || toDate) && (
        <div style={{ marginTop:10, padding:"8px 10px", background:T.bg,
          borderRadius:9, display:"flex", alignItems:"center", justifyContent:"space-between", gap:6 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ ...G, fontSize:11, color:T.inkMid }}>De</div>
            <div style={{ ...G, fontSize:12, fontWeight:700, color:T.ink }}>
              {fromDate ? fromDate.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"}) : "—"}
            </div>
          </div>
          <div style={{ width:20, height:1, background:T.border }}/>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ ...G, fontSize:11, color:T.inkMid }}>Até</div>
            <div style={{ ...G, fontSize:12, fontWeight:700, color:T.ink }}>
              {toDate ? toDate.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"}) : "—"}
            </div>
          </div>
          <button onClick={()=>{ setCustomFrom(""); setCustomTo(""); setPeriod("tudo"); setVisible(PAGE_SIZE); }}
            style={{ ...G, background:"none", border:"none", cursor:"pointer",
              fontSize:11, color:T.red, fontWeight:600, padding:"2px 6px", borderRadius:6 }}>
            Limpar
          </button>
        </div>
      )}

      {fromDate && toDate && (
        <button onClick={onClose}
          style={{ ...G, width:"100%", marginTop:8, background:T.ink, color:"#fff",
            border:"none", borderRadius:9, padding:"9px", fontSize:13, fontWeight:700,
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
          <Check size={13}/> Aplicar intervalo
        </button>
      )}
    </div>
  );
};

const TransacoesPage = ({ onNav, isMobile = false, onEditTx, dataMode = "mock" }) => {
  const PAGE_SIZE = 10;

  const CAT_COLORS = {
    "Alimentação":"#059669","Transporte":"#2563EB","Moradia":"#6B7280",
    "Saúde":"#DC2626","Receita":"#059669","Assinaturas":"#7C3AED",
    "Streaming":"#7C3AED","Lazer":"#D97706","Compras":"#0891B2",
    "Educação":"#BE185D","Outros":"#374151",
  };
  const catColor = (cat) => CAT_COLORS[cat] || T.inkMid;
  const catBg    = (cat) => (catColor(cat)) + "18";

  const fmtBRL = v => "R$\u00a0" + Math.abs(v).toLocaleString("pt-BR",{minimumFractionDigits:2});
  const parseDate = d => {
    if (!d) return new Date(0);
    const parts = d.split("/");
    if (parts.length === 3) return new Date(+parts[2], +parts[1]-1, +parts[0]);
    if (parts.length === 2) return new Date(2026, +parts[1]-1, +parts[0]);
    return new Date(0);
  };
  const fmtDateLabel = (d) => {
    const dt = parseDate(d);
    const today = new Date(2026,2,20);
    const yest  = new Date(2026,2,19);
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
  const [period,      setPeriod]      = useState("tudo");      // tudo|hoje|semana|mes|mes-ant|3m|ano|custom
  const [customFrom,  setCustomFrom]  = useState("");
  const [customTo,    setCustomTo]    = useState("");
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
  const [deletingId,  setDeletingId]  = useState(null);
  const [txList,      setTxList]      = useState(TRANSACTIONS);

  const ALL_CATS    = [...new Set(txList.map(t=>t.cat))].sort();
  const ALL_METHODS = [...new Set(txList.map(t=>t.method))].sort();

  // Period presets
  const TODAY = new Date(2026,2,20);
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
    setFilterMethod("todos"); setPeriod("tudo"); setSortBy("date-desc");
    setCustomFrom(""); setCustomTo(""); setVisible(PAGE_SIZE);
  };

  const activeChips = [
    period!=="tudo" && { key:"period",  label: period==="custom" ? `${customFrom||"?"} → ${customTo||"?"}` : PERIOD_LABELS[period], onRemove:()=>{ setPeriod("tudo"); setCustomFrom(""); setCustomTo(""); } },
    filterType!=="todos"  && { key:"type",    label: filterType==="receita"?"↑ Receitas":"↓ Despesas",            onRemove:()=>setFilterType("todos") },
    filterCat!=="todas"   && { key:"cat",     label: filterCat,                                                    onRemove:()=>setFilterCat("todas") },
    filterMethod!=="todos"&& { key:"method",  label: filterMethod,                                                 onRemove:()=>setFilterMethod("todos") },
    sortBy!=="date-desc"  && { key:"sort",    label: "↕ "+SORT_LABELS[sortBy].split("(")[0].trim(),               onRemove:()=>setSortBy("date-desc") },
    search                && { key:"search",  label: `"${search}"`,                                                onRemove:()=>setSearch("") },
  ].filter(Boolean);

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return txList.filter(t => {
      if (!periodFilter(t)) return false;
      if (filterType === "receita"  && t.val < 0) return false;
      if (filterType === "despesa"  && t.val > 0) return false;
      if (filterCat   !== "todas"   && t.cat !== filterCat) return false;
      if (filterMethod!== "todos"   && t.method !== filterMethod) return false;
      if (search && ![t.desc, t.cat, ...(t.tags||[])].some(s => s.toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    }).sort(sortFn);
  }, [txList, search, filterType, filterCat, filterMethod, period, sortBy, customFrom, customTo]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalReceita = filtered.filter(t=>t.val>0).reduce((s,t)=>s+t.val,0);
  const totalDespesa = filtered.filter(t=>t.val<0).reduce((s,t)=>s+Math.abs(t.val),0);
  const saldo        = totalReceita - totalDespesa;

  // ── Group by date ─────────────────────────────────────────────────────────
  const groups = useMemo(() => {
    const map = {};
    filtered.slice(0, visible).forEach(t => {
      const k = t.date || "Sem data";
      if (!map[k]) map[k] = [];
      map[k].push(t);
    });
    return Object.entries(map).sort((a,b) => parseDate(b[0]) - parseDate(a[0]));
  }, [filtered, visible]);

  const hasMore = visible < filtered.length;

  // ── CSV export ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const header = "Data,Descrição,Categoria,Método,Valor,Status,Tags";
    const rows   = filtered.map(t =>
      `${t.date},"${t.desc}","${t.cat}","${t.method}","${t.val > 0 ? "+" : ""}${t.val}","${t.status}","${(t.tags||[]).join(";")}"`
    );
    const csv  = [header, ...rows].join("\n");
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href=url; a.download="transacoes.csv"; a.click();
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
            <button onClick={() => { setTxList(prev => prev.filter(t => t.id !== tx.id)); setSelected(null); setDeletingId(null); }}
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
        className="finly-row"
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
          {["todas", ...ALL_CATS].map(cat => (
            <button key={cat} onClick={()=>{setFilterCat(cat);setVisible(PAGE_SIZE);}}
              style={{ ...G, padding:"4px 10px", borderRadius:99,
                border:`1px solid ${filterCat===cat?(cat==="todas"?T.ink:catColor(cat)):T.border}`,
                background:filterCat===cat?(cat==="todas"?T.ink:catBg(cat)):"none",
                color:filterCat===cat?(cat==="todas"?"#fff":catColor(cat)):T.inkMid,
                fontSize:11, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>
              {cat==="todas"?"Todas":cat}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const listContent = (
    <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
      {groups.length === 0 ? (
        <div style={{ textAlign:"center", padding:"48px 24px" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>🔍</div>
          <div style={{ ...G, fontSize:15, fontWeight:700, color:T.ink, marginBottom:6 }}>Nenhuma transação encontrada</div>
          <div style={{ ...G, fontSize:13, color:T.inkMid }}>Tente ajustar os filtros ou a busca.</div>
        </div>
      ) : (
        groups.map(([date, txs]) => (
          <div key={date}>
            {/* Date group header */}
            <div style={{ display:"flex", alignItems:"center", gap:10, padding: isMobile ? "10px 16px 4px" : "10px 18px 4px",
              position:"sticky", top:"-20px", background:T.bg, zIndex:1 }}>
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
      {/* Load more */}
      {hasMore && (
        <button onClick={()=>setVisible(v=>v+PAGE_SIZE)}
          style={{ ...G, width:"100%", padding:"12px", background:T.surface, border:`1px solid ${T.border}`,
            borderRadius:12, fontSize:13, fontWeight:600, color:T.inkMid, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginTop:4 }}>
          <ChevronDown size={14}/> Carregar mais ({filtered.length - visible} restantes)
        </button>
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
          <button onClick={()=>{ setFiltersOpen(true); setSnapFull(false); setDragY(0); }}
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
                  background: period!=="tudo" ? T.ink : T.surface,
                  color:       period!=="tudo" ? "#fff"  : T.inkMid,
                  border:`1px solid ${period!=="tudo" ? T.ink : T.border}`,
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
                  boxShadow:`0 8px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)`,
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
                  {["todas",...ALL_CATS].map(cat=>(
                    <button key={cat}
                      onClick={()=>{setFilterCat(cat);setVisible(PAGE_SIZE);}}
                      style={{ ...G, padding:"10px 16px", borderRadius:99, fontSize:13, fontWeight:600,
                        cursor:"pointer",
                        border:`1.5px solid ${filterCat===cat ? (cat==="todas" ? T.ink : catColor(cat)) : T.border}`,
                        background: filterCat===cat ? (cat==="todas" ? T.ink : catBg(cat)) : T.surface,
                        color: filterCat===cat ? (cat==="todas" ? "#fff" : catColor(cat)) : T.inkMid }}>
                      {cat==="todas" ? "Todas" : cat}
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
                Ver {filtered.length} transaç{filtered.length!==1?"ões":"ão"}
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
              {filtered.length} transaç{filtered.length!==1?"ões":"ão"}
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
          <div style={{ flex:1, minWidth:0, overflowY:"auto", overflowX:"hidden" }}>
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
};

/* ─── CollapsibleSection ─────────────────────────────────────
   Wrapper animado controlado pela prop `open`.
   Usa o truque CSS grid-template-rows: 0fr → 1fr para
   animar altura sem JavaScript e sem height fixo.
───────────────────────────────────────────────────────────── */
const CollapsibleSection = ({ open, children }) => (
  <div style={{
    display: "grid",
    gridTemplateRows: open ? "1fr" : "0fr",
    transition: "grid-template-rows 0.22s cubic-bezier(0.4,0,0.2,1)",
    overflow: "hidden",
  }}>
    <div style={{ minHeight: 0 }}>
      {children}
    </div>
  </div>
);

/* ─── RecRow ─────────────────────────────────────────────────
   Linha de recorrência. Props:
     r          — objeto RECORRENCIAS (desc, cat, val, dia, ativa,
                  proximo, tipo, metodo, freq, icone, urgente, pago,
                  diasUrg, valorTipo, progPct)
     isExp      — accordion expandido
     onToggle   — toggle accordion
     onTogglePause — pausar/reativar
     onEditar   — editar
     onNav      — navegar
     isMobile
───────────────────────────────────────────────────────────── */
const RecRow = ({ r, isExp, onToggle, onTogglePause, onNav, onEditar, isMobile }) => {
  const isReceita = r.tipo === "receita";
  const valColor  = isReceita ? T.green : T.ink;
  const sign      = isReceita ? "+" : "−";

  return (
    <div style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden", opacity: r.ativa ? 1 : 0.55, transition: "opacity 0.18s" }}>
      {/* ── Linha principal ── */}
      <div onClick={onToggle} className="finly-row"
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", cursor: "pointer" }}>
        {/* Ícone */}
        <div style={{ width: 34, height: 34, borderRadius: 10, background: isReceita ? T.greenLight : T.redLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
          {r.icone}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.desc}
            </span>
            {!r.ativa && (
              <span style={{ ...G, fontSize: 9, fontWeight: 700, color: T.inkGhost, background: T.grayLight, borderRadius: 99, padding: "2px 6px" }}>
                PAUSADA
              </span>
            )}
            {r.urgente && r.ativa && (
              <span style={{ ...G, fontSize: 9, fontWeight: 700, color: T.amber, background: T.amberLight, borderRadius: 99, padding: "2px 6px" }}>
                {r.diasUrg}d
              </span>
            )}
          </div>
          <div style={{ ...G, fontSize: 11, color: T.inkGhost }}>
            {r.freq} · {r.cat}
          </div>
        </div>

        {/* Valor */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ ...G, ...NUM, fontSize: 14, fontWeight: 700, color: valColor }}>
            {sign} R$ {Math.abs(r.val).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <div style={{ ...G, fontSize: 10, color: r.pago ? T.green : T.inkGhost, marginTop: 1 }}>
            {r.pago ? "✓ pago" : `dia ${r.dia}`}
          </div>
        </div>

        {/* Chevron */}
        <div style={{ marginLeft: 4, transition: "transform 0.2s", transform: isExp ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
          <ChevronDown size={14} color={T.inkGhost} />
        </div>
      </div>

      {/* ── Accordion expandido ── */}
      <CollapsibleSection open={isExp}>
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Barra de progresso do mês */}
          {r.progPct !== undefined && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ ...G, fontSize: 10, color: T.inkGhost }}>Progresso do mês</span>
                <span style={{ ...G, ...NUM, fontSize: 10, fontWeight: 600, color: r.progPct >= 100 ? T.green : T.inkMid }}>{r.progPct}%</span>
              </div>
              <ProgBar pct={r.progPct} color={r.progPct >= 100 ? T.green : isReceita ? T.green : T.blue} h={4} />
            </div>
          )}

          {/* Detalhes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "Próximo",   val: r.proximo  },
              { label: "Método",    val: r.metodo   },
              { label: "Início",    val: r.inicio   },
              { label: "Encerra",   val: r.enc      },
            ].map(({ label, val }) => (
              <div key={label}>
                <div style={{ ...G, fontSize: 9, fontWeight: 700, color: T.inkGhost, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{label}</div>
                <div style={{ ...G, fontSize: 12, fontWeight: 600, color: T.inkMid }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Ações */}
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 2 }}>
            <button onClick={e => { e.stopPropagation(); onEditar && onEditar(r); }}
              style={{ ...G, fontSize: 11, fontWeight: 600, color: T.ink, background: T.grayLight, border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <Pencil size={11} /> Editar
            </button>
            <button onClick={e => { e.stopPropagation(); onTogglePause && onTogglePause(); }}
              style={{ ...G, fontSize: 11, fontWeight: 600, color: r.ativa ? T.amber : T.green, background: r.ativa ? T.amberLight : T.greenLight, border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              {r.ativa ? <><Pause size={11}/> Pausar</> : <><Play size={11}/> Reativar</>}
            </button>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
};

/* ─── SimRow ─────────────────────────────────────────────────
   Linha de recorrência simulada (derivada de cenários).
   Props:
     item        — { nome, cat, valParcela, meses, badge, isReceita,
                     cenarioNome, uid, tipo }
     isExp       — accordion expandido
     onToggle    — toggle accordion
     isMuted     — item silenciado no cálculo
     onToggleMute — silenciar/restaurar
     onNav       — navegar
     isMobile
───────────────────────────────────────────────────────────── */
const SimRow = ({ item, isExp, onToggle, isMuted, onToggleMute, onNav, isMobile }) => {
  const isReceita = !!item.isReceita;
  const valColor  = isReceita ? T.green : T.purple;
  const sign      = isReceita ? "+" : "−";

  return (
    <div style={{ background: isMuted ? T.grayLight : T.surface, borderRadius: 12, border: `1px solid ${isMuted ? T.border : T.purple}40`, overflow: "hidden", opacity: isMuted ? 0.5 : 1, transition: "opacity 0.18s" }}>
      {/* ── Linha principal ── */}
      <div onClick={onToggle} className="finly-row"
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", cursor: "pointer" }}>
        {/* Ícone / badge simulado */}
        <div style={{ width: 34, height: 34, borderRadius: 10, background: T.purpleLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
          <Sparkles size={14} color={T.purple} />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2, flexWrap: "wrap" }}>
            <span style={{ ...G, fontSize: 13, fontWeight: 600, color: isMuted ? T.inkGhost : T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.nome}
            </span>
            <span style={{ ...G, fontSize: 9, fontWeight: 700, color: T.purple, background: T.purpleLight, borderRadius: 99, padding: "2px 6px", whiteSpace: "nowrap" }}>
              Simulada
            </span>
          </div>
          <div style={{ ...G, fontSize: 11, color: T.inkGhost }}>
            {item.cat} · {item.badge || (item.meses ? `${item.meses} meses` : "recorrente")} · {item.cenarioNome}
          </div>
        </div>

        {/* Valor */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ ...G, ...NUM, fontSize: 14, fontWeight: 700, color: isMuted ? T.inkGhost : valColor }}>
            {sign} R$ {Math.abs(item.valParcela).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <div style={{ ...G, fontSize: 10, color: T.inkGhost, marginTop: 1 }}>por mês</div>
        </div>

        <div style={{ marginLeft: 4, transition: "transform 0.2s", transform: isExp ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
          <ChevronDown size={14} color={T.inkGhost} />
        </div>
      </div>

      {/* ── Accordion ── */}
      <CollapsibleSection open={isExp}>
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "Cenário",   val: item.cenarioNome },
              { label: "Categoria", val: item.cat         },
              { label: "Duração",   val: item.badge || `${item.meses || "∞"} meses` },
              { label: "Tipo",      val: isReceita ? "Receita" : "Despesa" },
            ].map(({ label, val }) => (
              <div key={label}>
                <div style={{ ...G, fontSize: 9, fontWeight: 700, color: T.inkGhost, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{label}</div>
                <div style={{ ...G, fontSize: 12, fontWeight: 600, color: T.inkMid }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 7, marginTop: 4 }}>
            <button onClick={e => { e.stopPropagation(); onToggleMute && onToggleMute(); }}
              style={{ ...G, fontSize: 11, fontWeight: 600, color: isMuted ? T.purple : T.inkMid, background: isMuted ? T.purpleLight : T.grayLight, border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}>
              {isMuted ? "Restaurar" : "Silenciar"}
            </button>
            <button onClick={e => { e.stopPropagation(); onNav && onNav("simulacao"); }}
              style={{ ...G, fontSize: 11, fontWeight: 600, color: T.purple, background: T.purpleLight, border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}>
              Ver simulação →
            </button>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
};

/* ─── MiniCalendar ───────────────────────────────────────────
   Mini calendário visual do mês atual marcando dias com
   vencimentos de recorrências. Purely decorativo / informativo.
───────────────────────────────────────────────────────────── */
const MiniCalendar = ({ recorrencias = [] }) => {
  const hoje    = new Date(2026, 2, 10); // March 10 2026
  const ano     = hoje.getFullYear();
  const mes     = hoje.getMonth();
  const daysInMonth = new Date(ano, mes + 1, 0).getDate();
  const firstDow    = new Date(ano, mes, 1).getDay(); // 0=Dom
  const diasVenc    = new Set(recorrencias.filter(r => r.ativa).map(r => r.dia));
  const DAY_LABELS  = ["D","S","T","Q","Q","S","S"];

  return (
    <div style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, padding: "12px 14px" }}>
      <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.ink, marginBottom: 10 }}>
        Março 2026
      </div>
      {/* Cabeçalho dias da semana */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
        {DAY_LABELS.map((d, i) => (
          <div key={i} style={{ ...G, fontSize: 9, fontWeight: 600, color: T.inkGhost, textAlign: "center", padding: "2px 0" }}>{d}</div>
        ))}
      </div>
      {/* Dias */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day     = i + 1;
          const isHoje  = day === hoje.getDate();
          const isVenc  = diasVenc.has(day);
          return (
            <div key={day} style={{
              ...G, fontSize: 10, fontWeight: isVenc || isHoje ? 700 : 400,
              textAlign: "center", padding: "4px 2px", borderRadius: 6,
              background: isHoje ? T.ink : isVenc ? T.blueLight : "transparent",
              color: isHoje ? "#fff" : isVenc ? T.blue : T.inkMid,
              position: "relative",
            }}>
              {day}
              {isVenc && !isHoje && (
                <div style={{ width: 3, height: 3, borderRadius: "50%", background: T.blue, margin: "1px auto 0" }} />
              )}
            </div>
          );
        })}
      </div>
      {/* Legenda */}
      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: T.ink }} />
          <span style={{ ...G, fontSize: 9, color: T.inkGhost }}>Hoje</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: T.blueLight, border: `1px solid ${T.blue}` }} />
          <span style={{ ...G, fontSize: 9, color: T.inkGhost }}>Vencimento</span>
        </div>
      </div>
    </div>
  );
};

const RecorrenciasPage = ({ onNav, cenarios = [], onNovaRec, onEditar, isMobile = false, dataMode = "mock", extraRecs = [] }) => {
  const [list, setList]     = useState(() => dataMode === "empty" ? extraRecs : RECORRENCIAS);
  const [expanded, setExp]  = useState(null);
  const [activeTab, setTab] = useState("todos");
  const [secOpen, setSecOpen] = useState({ sim: true, desp: true, rec: true });
  const PAGE_SIZE = 5;
  const [shown, setShown]   = useState({ sim: PAGE_SIZE, desp: PAGE_SIZE, rec: PAGE_SIZE });
  const [mutedItems, setMuted] = useState(new Set());

  const toggleSec  = key => setSecOpen(s => ({ ...s, [key]: !s[key] }));
  const showMore   = key => setShown(s => ({ ...s, [key]: s[key] + PAGE_SIZE }));
  const toggleMute = uid => setMuted(prev => {
    const next = new Set(prev);
    next.has(uid) ? next.delete(uid) : next.add(uid);
    return next;
  });
  const toggle = id => setList(l => l.map(r => r.id === id ? { ...r, ativa: !r.ativa } : r));

  // Derive simulated recorrências from all cenários
  const simRecorrencias = useMemo(() => {
    const items = [];
    cenarios.forEach(c => {
      c.items
        .filter(it => it.tipo === "despesa_recorrente" || it.tipo === "receita_recorrente")
        .forEach(it => items.push({ ...it, cenarioId: c.id, cenarioNome: c.nome, uid: `${c.id}-${it.id}` }));
    });
    return items;
  }, [cenarios]);

  const visibleSim   = simRecorrencias.filter(it => !mutedItems.has(it.uid));
  const totalSimVal  = visibleSim.filter(it => !it.isReceita).reduce((s, it) => s + it.valParcela, 0)
                     - visibleSim.filter(it =>  it.isReceita).reduce((s, it) => s + it.valParcela, 0);
  const simCenCount  = new Set(visibleSim.map(x => x.cenarioId)).size;

  const despesas  = list.filter(r => r.tipo === "despesa");
  const receitas  = list.filter(r => r.tipo === "receita");
  const totalDesp = despesas.filter(r => r.ativa).reduce((s, r) => s + r.val, 0);
  const totalRec  = receitas.filter(r => r.ativa).reduce((s, r) => s + r.val, 0);
  const saldoFixo = totalRec - totalDesp;

  const tipoBadge = r => {
    if (!r.ativa)                       return { txt: "pausado",               color: T.inkLight, bg: T.grayLight  };
    if (r.urgente)                      return { txt: `vence em ${r.diasUrg} dias`, color: T.amber, bg: T.amberLight };
    if (r.pago && r.tipo==="receita")   return { txt: "recebe em 2 dias",      color: T.green,    bg: T.greenLight };
    return { txt: "fixo", color: T.inkMid, bg: T.grayLight };
  };

  /* ── RecRow — item real ── */
  /* ── SectionHeader ── */
  const SectionHeader = ({ label, count, total, color, secKey, open }) => (
    <div onClick={() => toggleSec(secKey)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 2px", cursor: "pointer", userSelect: "none", marginTop: 6 }}>
      <div style={{ width: 3, height: 16, borderRadius: 99, background: color, flexShrink: 0 }} />
      <span style={{ ...G, fontSize: 11, fontWeight: 700, color: T.ink, textTransform: "uppercase", letterSpacing: "0.07em", flex: 1 }}>{label}</span>
      <span style={{ ...G, fontSize: 10, color: T.inkMid }}>{count}</span>
      <span style={{ ...G, ...NUM, fontSize: 11, fontWeight: 700, color }}>{total}</span>
      <div style={{ width: 18, height: 18, borderRadius: 6, background: T.grayLight, display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)", transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>
        <ChevronDown size={11} color={T.inkMid} />
      </div>
    </div>
  );

  /* ── VerMais ── */
  const VerMais = ({ total, shown: s, secKey }) => s < total ? (
    <button onClick={() => showMore(secKey)} style={{ ...G, width: "100%", padding: "9px", background: "none", border: `1px dashed ${T.border}`, borderRadius: 9, fontSize: 11, fontWeight: 600, color: T.inkMid, cursor: "pointer", marginTop: 4 }}>
      Ver mais {Math.min(PAGE_SIZE, total - s)} de {total - s} restantes
    </button>
  ) : null;

  /* ── Right panel ── */
  const RightPanel = () => (
    <div style={{ width: isMobile ? "100%" : 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 14 }}>
      {visibleSim.length > 0 && (
        <div style={{ background: T.darkBg, borderRadius: 14, padding: 16, boxShadow: T.dark }}>
          <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.darkPurple, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Recorrências em simulação</div>
          {isMobile ? (
            /* Mobile: 2x2 grid of stats */
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              {[
                { label: "Custo adicional", val: `−${fmtAbs(totalSimVal)}`, color: T.darkRed },
                { label: "Saldo fixo atual", val: fmtAbs(saldoFixo), color: T.darkText },
                { label: "Saldo simulado", val: fmtAbs(saldoFixo - totalSimVal), color: T.darkText },
                { label: "Redução", val: saldoFixo > 0 ? `−${((totalSimVal / saldoFixo) * 100).toFixed(1)}%` : "—", color: T.darkRed },
              ].map((m, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ ...G, fontSize: 8, fontWeight: 600, color: T.darkMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{m.label}</div>
                  <div style={{ ...G, ...NUM, fontSize: 13, fontWeight: 700, color: m.color }}>{m.val}</div>
                </div>
              ))}
            </div>
          ) : (
            [
              { label: "Custo mensal adicional", val: `−${fmtAbs(totalSimVal)}`, color: T.darkRed },
              { label: "Saldo fixo atual", val: fmtAbs(saldoFixo), color: T.darkText },
              { label: "Saldo fixo simulado", val: fmtAbs(saldoFixo - totalSimVal), color: T.darkText },
              { label: "Redução", val: saldoFixo > 0 ? `−${((totalSimVal / saldoFixo) * 100).toFixed(1)}%` : "—", color: T.darkRed },
            ].map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ ...G, fontSize: 11, color: T.darkMuted }}>{m.label}</span>
                <span style={{ ...G, ...NUM, fontSize: 12, fontWeight: 700, color: m.color }}>{m.val}</span>
              </div>
            ))
          )}
          <div style={{ marginTop: isMobile ? 0 : 12, marginBottom: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ ...G, fontSize: 10, color: T.darkMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>saldo comprometido</span>
              <span style={{ ...G, ...NUM, fontSize: 10, color: T.darkPurple, fontWeight: 700 }}>{Math.round((totalDesp / totalRec) * 100)}%</span>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.12)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, (totalDesp / totalRec) * 100)}%`, height: "100%", background: T.darkPurple, borderRadius: 99 }} />
            </div>
          </div>
          <button onClick={() => onNav("simulacao")} style={{ ...G, marginTop: 14, width: "100%", padding: "9px", background: T.purple, color: "#fff", border: "none", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Abrir simulação completa
          </button>
        </div>
      )}
      <Card style={{ padding: 16 }}>
        <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.ink, marginBottom: 4 }}>Fluxo fixo mensal</div>
        <div style={{ ...G, ...NUM, fontSize: 14, fontWeight: 700, color: T.green, marginBottom: 12 }}>Saldo comprometido {fmtSgn(saldoFixo)}</div>
        <ResponsiveContainer width="100%" height={80}>
          <ReBarChart data={FLUXO_MENSAL} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
            <XAxis dataKey="mes" tick={{ ...G, fontSize: 10, fill: T.inkLight }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ ...G, fontSize: 10, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8 }}
              formatter={(v, n) => [fmtAbs(v), n === "rec" ? "Receitas" : n === "desp" ? "Despesas" : "Simulado"]} />
            <Bar dataKey="desp" stackId="a" fill={T.redBar}    radius={[0,0,0,0]} />
            <Bar dataKey="sim"  stackId="a" fill={T.purpleBar} radius={[3,3,0,0]} />
            <Bar dataKey="rec"  fill={T.greenBar} radius={[3,3,0,0]} />
          </ReBarChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          {[{ c: T.redBar, l: "Despesas" }, { c: T.greenBar, l: "Receitas" }, { c: T.purpleBar, l: "Simulado" }].map((x, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: 9999, background: x.c }} />
              <span style={{ ...G, fontSize: 10, color: T.inkMid }}>{x.l}</span>
            </div>
          ))}
        </div>
      </Card>
      {!isMobile && (
        <Card style={{ padding: 16 }}>
          <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.ink, marginBottom: 12 }}>Próximos vencimentos</div>
          <MiniCalendar />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {PROXIMOS.map((p, i) => {
              const col = p.tipo === "receita" ? T.green : p.tipo === "simulada" ? T.purple : T.inkMid;
              const bg  = p.tipo === "receita" ? T.greenLight : p.tipo === "simulada" ? T.purpleLight : T.grayLight;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ background: bg, borderRadius: 6, padding: "3px 6px", textAlign: "center", flexShrink: 0 }}>
                    <div style={{ ...G, ...NUM, fontSize: 12, fontWeight: 800, color: col }}>{p.dia}</div>
                    <div style={{ ...G, fontSize: 7, fontWeight: 600, color: col, textTransform: "uppercase", letterSpacing: "0.06em" }}>{p.mes}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...G, fontSize: 11, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.desc}</div>
                    <div style={{ ...G, fontSize: 10, color: T.inkMid }}>{p.metodo}</div>
                  </div>
                  <div style={{ ...G, ...NUM, fontSize: 11, fontWeight: 700, color: p.val > 0 ? T.green : p.tipo === "simulada" ? T.purple : T.ink, flexShrink: 0 }}>
                    {p.val > 0 ? "+" : "−"}R$ {Math.abs(p.val).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
      <div style={{ paddingTop: 4, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
        <div><Breadcrumb label="Planejar" /><PageTitle sans="Recorrências &" serif="Compromissos" /></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!isMobile && <Btn variant="outGray"><Upload size={12} /> Exportar</Btn>}
          {!isMobile && <Btn variant="outPurp" onClick={() => onNav("simulacao", { autoOpenModal: true, autoTipo: "despesa_recorrente" })}><Sparkles size={12} /> Simular recorrência</Btn>}
          <button onClick={onNovaRec} style={{ ...G, display: "flex", alignItems: "center", gap: 5, background: T.ink, border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
            <Plus size={13} /> {isMobile ? "Nova" : "Nova Recorrência"} <span style={{ width: 5, height: 5, background: T.purple, borderRadius: 9999, display: "inline-block", marginLeft: 2 }} />
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 10 }}>
        {[
          { label: "Compromissos mensais",  val: fmtAbs(totalDesp),  sub: `${despesas.filter(r=>r.ativa).length} ativas · ${despesas.filter(r=>r.ativa&&r.valorTipo==="estimado").length} estimadas`, color: T.red   },
          { label: "Receitas recorrentes",  val: fmtAbs(totalRec),   sub: `${receitas.filter(r=>r.ativa).length} ativas · ${receitas.filter(r=>r.ativa&&r.valorTipo==="estimado").length} estimadas`,        color: T.green },
          { label: "Saldo fixo mensal",     val: fmtSgn(saldoFixo),  sub: "após todos compromissos",                                      color: saldoFixo > 0 ? T.green : T.red },
          { label: "Próximos 7 dias",       val: fmtAbs(1240),       sub: "3 vencimentos chegando",                                       color: T.amber },
        ].map((k, i) => (
          <Card key={i} style={{ padding: isMobile ? "12px 14px" : "14px 16px" }}>
            <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{k.label}</div>
            <div style={{ ...G, ...NUM, fontSize: isMobile ? 17 : 22, fontWeight: 700, color: k.color }}>{k.val}</div>
            <div style={{ ...G, fontSize: 10, color: T.inkMid, marginTop: 3 }}>{k.sub}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 8 : 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, padding: "7px 13px", flex: isMobile ? undefined : 1, maxWidth: isMobile ? undefined : 280 }}>
          <Search size={12} color={T.inkLight} />
          <input placeholder="Buscar recorrência..." style={{ ...G, border: "none", outline: "none", fontSize: 12, color: T.ink, background: "transparent", flex: 1 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 10 }}>
          <div style={{ display: "flex", gap: 2, background: T.grayLight, borderRadius: 9, padding: 3, flex: isMobile ? 1 : undefined }}>
            {["todos","despesas","receitas","pausados"].map(tab => (
              <button key={tab} onClick={() => setTab(tab)} style={{ ...G, flex: isMobile ? 1 : undefined, padding: isMobile ? "6px 8px" : "6px 12px", borderRadius: 7, border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", background: activeTab === tab ? T.surface : "transparent", color: activeTab === tab ? T.ink : T.inkMid, boxShadow: activeTab === tab ? T.sm : "none", transition: "all 0.12s", whiteSpace: "nowrap" }}>
                {isMobile
                  ? (tab === "todos" ? "Todos" : tab === "despesas" ? "Desp." : tab === "receitas" ? "Rec." : "Pausa.")
                  : (tab === "todos" ? "Todos" : tab === "despesas" ? "Despesas" : tab === "receitas" ? "Receitas" : "Pausados")}
              </button>
            ))}
          </div>
          {!isMobile && <Btn variant="outGray" small><ChevronDown size={11} /> Próx. vencimento</Btn>}
        </div>
      </div>

      {visibleSim.length > 0 && (
        <div style={{ background: T.purpleLight, border: `1px solid ${T.purple}33`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 16 }}>✦</div>
          <div style={{ flex: 1, minWidth: isMobile ? "100%" : 0 }}>
            <div style={{ ...G, fontSize: isMobile ? 12 : 13, fontWeight: 700, color: T.purple }}>
              {visibleSim.length} {visibleSim.length === 1 ? "recorrência simulada" : "recorrências simuladas"} · {simCenCount} {simCenCount === 1 ? "cenário" : "cenários"} · {fmtAbs(Math.abs(totalSimVal))}/mês
            </div>
            <div style={{ ...G, fontSize: 11, color: `${T.purple}99`, marginTop: 2 }}>
              Impacto no saldo fixo: {fmtAbs(saldoFixo)} → {fmtAbs(saldoFixo - totalSimVal)}
              {mutedItems.size > 0 && <span style={{ marginLeft: 8, color: T.inkLight }}>· {mutedItems.size} muted</span>}
            </div>
          </div>
          <Btn variant="purple" small onClick={() => onNav("simulacao")}>Abrir simulação completa</Btn>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>

          {simRecorrencias.length > 0 && (
            <>
              <SectionHeader label="Simuladas" count={`${visibleSim.length} de ${simRecorrencias.length}`} total={`${fmtAbs(Math.abs(totalSimVal))}/mês`} color={T.purple} secKey="sim" open={secOpen.sim} />
              <CollapsibleSection open={secOpen.sim}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 8 }}>
                  {simRecorrencias.slice(0, shown.sim).map(item => <SimRow key={item.uid} item={item} isExp={expanded===item.uid} onToggle={() => setExp(expanded===item.uid ? null : item.uid)} isMuted={mutedItems.has(item.uid)} onToggleMute={() => toggleMute(item.uid)} onNav={onNav} isMobile={isMobile} />)}
                  <VerMais total={simRecorrencias.length} shown={shown.sim} secKey="sim" />
                </div>
              </CollapsibleSection>
            </>
          )}

          <SectionHeader label="Despesas Fixas" count={`${despesas.filter(r=>r.ativa).length} ativas`} total={`−${fmtAbs(totalDesp)}/mês`} color={T.red} secKey="desp" open={secOpen.desp} />
          <CollapsibleSection open={secOpen.desp}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 8 }}>
              {despesas.slice(0, shown.desp).map(r => <RecRow key={r.id} r={r} isExp={expanded===r.id} onToggle={() => setExp(expanded===r.id ? null : r.id)} onTogglePause={() => toggle(r.id)} onNav={onNav} onEditar={onEditar} isMobile={isMobile} />)}
              <VerMais total={despesas.length} shown={shown.desp} secKey="desp" />
            </div>
          </CollapsibleSection>

          <SectionHeader label="Receitas Fixas" count={`${receitas.filter(r=>r.ativa).length} ativas`} total={`+${fmtAbs(totalRec)}/mês`} color={T.green} secKey="rec" open={secOpen.rec} />
          <CollapsibleSection open={secOpen.rec}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 8 }}>
              {receitas.slice(0, shown.rec).map(r => <RecRow key={r.id} r={r} isExp={expanded===r.id} onToggle={() => setExp(expanded===r.id ? null : r.id)} onTogglePause={() => toggle(r.id)} onNav={onNav} onEditar={onEditar} isMobile={isMobile} />)}
              <VerMais total={receitas.length} shown={shown.rec} secKey="rec" />
            </div>
          </CollapsibleSection>

        </div>
        {/* RightPanel: sidebar on desktop, stacked below on mobile */}
        <RightPanel />
      </div>
    </div>
  );
};

/* ─── SIMULAÇÃO ─────────────────────────────────────────── */

const T_RED   = "#DC2626"; const T_AMBER = "#D97706";
const T_GREEN = "#059669"; const T_BLUE  = "#2563EB";

const TIPOS_ITEM = [
  { id: "despesa_parcelada",  label: "Despesa parcelada",  emoji: "🛍️", cor: T_RED   },
  { id: "despesa_recorrente", label: "Despesa recorrente", emoji: "🔁", cor: T_AMBER  },
  { id: "receita_pontual",    label: "Receita pontual",    emoji: "💰", cor: T_GREEN  },
  { id: "receita_recorrente", label: "Receita recorrente", emoji: "📈", cor: T_GREEN  },
  { id: "ajuste_categoria",   label: "Ajuste de categoria",emoji: "✂️", cor: T_BLUE   },
];

const BANCOS_SIM     = ["Nubank", "Itaú Personnalité", "Bradesco", "Inter", "Pix", "Dinheiro"];
const CATEGORIAS_SIM = ["Tecnologia","Alimentação","Transporte","Moradia","Lazer","Saúde","Assinaturas","Outros"];
const BUDGET_BASE    = 4200;

const SIM_CENARIOS_INIT = [
  { id: 1, nome: "Setup home office", budgetOverride: null,
    items: [
      { id:1, tipo:"despesa_parcelada",  nome:"MacBook Air M3",       cat:"Tecnologia",  banco:"Nubank",            parcelas:12, meses:null, valParcela:349.17, total:4190,  badge:"12× meses", isReceita:false, isAjuste:false },
      { id:2, tipo:"despesa_parcelada",  nome:'Monitor LG 27"',        cat:"Tecnologia",  banco:"Itaú Personnalité", parcelas:3,  meses:null, valParcela:183.33, total:550,   badge:"3× meses",  isReceita:false, isAjuste:false },
      { id:3, tipo:"despesa_recorrente", nome:"Adobe Creative Cloud",  cat:"Assinaturas", banco:"-",                 parcelas:1,  meses:12,   valParcela:89.90,  total:89.90, badge:"12 meses",  isReceita:false, isAjuste:false },
      { id:4, tipo:"despesa_recorrente", nome:"Notion Pro",            cat:"Assinaturas", banco:"-",                 parcelas:1,  meses:6,    valParcela:45,     total:45,    badge:"6 meses",   isReceita:false, isAjuste:false },
    ]
  },
  { id: 2, nome: "Upgrade assinaturas", budgetOverride: 4800,
    items: [
      { id:1, tipo:"despesa_recorrente", nome:"Adobe Creative Cloud",  cat:"Assinaturas", banco:"-",                 parcelas:1,  meses:12,   valParcela:89.90,  total:89.90, badge:"12 meses",  isReceita:false, isAjuste:false },
      { id:2, tipo:"receita_recorrente", nome:"Freela mensal",         cat:"Renda",       banco:"-",                 parcelas:1,  meses:6,    valParcela:800,    total:800,   badge:"6 meses",   isReceita:true,  isAjuste:false },
      { id:3, tipo:"ajuste_categoria",   nome:"Corte em Alimentação",  cat:"Alimentação", banco:"-",                 parcelas:1,  meses:3,    valParcela:200,    total:200,   badge:"3 meses",   isReceita:false, isAjuste:true  },
    ]
  },
  { id: 3, nome: "Reforma do quarto", budgetOverride: null,
    items: [
      { id:1, tipo:"despesa_parcelada",  nome:"Materiais",             cat:"Moradia",     banco:"Itaú Personnalité", parcelas:6,  meses:null, valParcela:533.33, total:3200,  badge:"6× meses",  isReceita:false, isAjuste:false },
      { id:2, tipo:"despesa_recorrente", nome:"Netflix Premium",       cat:"Assinaturas", banco:"-",                 parcelas:1,  meses:12,   valParcela:55.90,  total:55.90, badge:"12 meses",  isReceita:false, isAjuste:false },
    ]
  },
];

/* ── Modal Novo Cenário ────────────────────────────────── */
const ModalNovoCenario = ({ open, onClose, onCriar, initialTipo = null }) => {
  const [nome,       setNome]       = useState("");
  const [budgetEdit, setBudgetEdit] = useState(false);
  const [budgetVal,  setBudgetVal]  = useState(String(BUDGET_BASE));
  const [items,      setItems]      = useState([]);
  const [showForm,   setShowForm]   = useState(false);
  // form novo item
  const [tipo,    setTipo]    = useState(initialTipo || "despesa_parcelada");
  const [iNome,   setINome]   = useState("");
  const [iValor,  setIValor]  = useState("");
  const [iCat,    setICat]    = useState("Tecnologia");
  const [iBanco,  setIBanco]  = useState("Nubank");
  const [iParcelas,setIParcelas] = useState("12");
  const [iMeses,  setIMeses]  = useState("6");

  // quando o modal abre com um tipo pré-definido, já expande o formulário
  useEffect(() => {
    if (open && initialTipo) {
      setTipo(initialTipo);
      setShowForm(true);
    }
    if (!open) {
      // reset ao fechar
      setNome(""); setBudgetEdit(false); setBudgetVal(String(BUDGET_BASE));
      setItems([]); setShowForm(false);
      setTipo(initialTipo || "despesa_parcelada");
      setINome(""); setIValor("");
    }
  }, [open]);

  const budgetNum  = parseFloat(budgetVal.replace(/[^\d.,]/g,"").replace(",",".")) || BUDGET_BASE;
  const overridden = budgetNum !== BUDGET_BASE;
  const totalItems = items.reduce((s,i) => s + i.total, 0);
  const totalMes   = items.reduce((s,i) => s + i.valParcela, 0);

  const resetForm = () => { setINome(""); setIValor(""); setICat("Tecnologia"); setIBanco("Nubank"); setIParcelas("12"); setIMeses("6"); setShowForm(false); };

  const addItem = () => {
    const val = parseFloat(iValor.replace(/[^\d.,]/g,"").replace(",",".")) || 0;
    if (!iNome || !val) return;
    const parc = tipo === "despesa_parcelada" ? parseInt(iParcelas) || 1 : 1;
    const mes  = tipo === "despesa_recorrente" || tipo === "receita_recorrente" ? parseInt(iMeses) || 1 : null;
    const isReceita = tipo === "receita_pontual" || tipo === "receita_recorrente";
    const isAjuste  = tipo === "ajuste_categoria";
    const valParcela = parc > 1 ? +(val / parc).toFixed(2) : val;
    const badge = parc > 1 ? `${parc}× meses` : mes ? `${mes} meses` : null;
    setItems(l => [...l, { id: Date.now(), tipo, nome: iNome, cat: iCat, banco: tipo === "ajuste_categoria" ? "-" : iBanco, parcelas: parc, meses: mes, valParcela, total: isReceita ? -val : val, badge, isReceita, isAjuste }]);
    resetForm();
  };

  const criar = () => {
    onCriar({ nome: nome || "Novo cenário", budgetOverride: overridden ? budgetNum : null, items });
    setNome(""); setBudgetEdit(false); setBudgetVal(String(BUDGET_BASE)); setItems([]); resetForm();
  };

  if (!open) return null;

  const inputStyle = { ...G, height: 36, border: `1.5px solid ${T.border}`, borderRadius: 9, padding: "0 11px", fontSize: 12, color: T.ink, background: T.surface, outline: "none", width: "100%", fontFamily: "'Geist', sans-serif" };
  const selectStyle = { ...inputStyle, appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239CA3AF'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 11px center", paddingRight: 28 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,15,13,0.5)", zIndex: 500, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 48 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.surface, borderRadius: 18, width: 560, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.22)", overflow: "hidden" }}>

        {/* Header roxo */}
        <div style={{ background: "linear-gradient(135deg, #4C1D95 0%, #6D28D9 100%)", padding: "20px 24px 18px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
          <div>
            <div style={{ ...G, display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.15)", borderRadius: 99, padding: "3px 10px", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.06em", marginBottom: 8 }}>✦ SIMULAÇÃO</div>
            <div style={{ ...G, fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Novo cenário</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.8)", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {/* Body scrollável */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", flex: 1 }}>

          {/* Nome */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ ...G, fontSize: 11, fontWeight: 600, color: T.inkMid }}>Nome do cenário</label>
            <input style={{ ...inputStyle, ...(nome ? {} : { borderColor: T.purple, boxShadow: `0 0 0 3px ${T.purple}11` }) }}
              placeholder="Ex: Compra do notebook novo"
              value={nome} onChange={e => setNome(e.target.value)} autoFocus />
          </div>

          {/* Orçamento */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <label style={{ ...G, fontSize: 11, fontWeight: 600, color: T.inkMid }}>Orçamento do período</label>
              <span style={{ ...G, fontSize: 10, color: T.inkLight }}>opcional</span>
            </div>
            {!budgetEdit ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", background: T.grayLight, border: `1.5px solid ${T.border}`, borderRadius: 10, cursor: "pointer" }}
                onClick={() => setBudgetEdit(true)}>
                <span style={{ fontSize: 13 }}>💰</span>
                <span style={{ ...M_MONO, ...NUM, fontSize: 14, fontWeight: 800, color: T.ink, flex: 1 }}>R$ 4.200,00</span>
                <span style={{ ...G, fontSize: 10, color: T.inkLight, display: "flex", alignItems: "center", gap: 4 }}>✏️ Ajustar para este cenário</span>
              </div>
            ) : (
              <div style={{ border: `1.5px solid ${overridden && budgetNum > BUDGET_BASE ? T.purple : T.border}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 13px", background: overridden ? T.purpleLight : T.grayLight }}>
                  <span style={{ fontSize: 13 }}>💰</span>
                  {overridden && <span style={{ ...M_MONO, ...NUM, fontSize: 12, color: T.inkLight, textDecoration: "line-through" }}>R$ 4.200</span>}
                  {overridden && <span style={{ fontSize: 11, color: T.inkLight }}>→</span>}
                  <input style={{ ...G, fontFamily: "'Geist Mono', monospace", fontSize: 14, fontWeight: 800, color: overridden ? T.purple : T.ink, background: "none", border: "none", outline: "none", flex: 1, fontVariantNumeric: "tabular-nums" }}
                    value={budgetVal}
                    onChange={e => setBudgetVal(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") setBudgetEdit(false); if (e.key === "Escape") { setBudgetVal(String(BUDGET_BASE)); setBudgetEdit(false); } }}
                    autoFocus />
                  {overridden && <button onClick={() => { setBudgetVal(String(BUDGET_BASE)); setBudgetEdit(false); }} style={{ ...G, background: "none", border: "none", fontSize: 10, color: T.inkLight, cursor: "pointer", textDecoration: "underline" }}>Restaurar</button>}
                </div>
                <div style={{ display: "flex", borderTop: `1px solid ${T.border}` }}>
                  <button onClick={() => setBudgetEdit(false)} style={{ ...G, flex: 1, height: 32, background: T.purple, color: "#fff", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>✓ Confirmar</button>
                  <button onClick={() => { setBudgetVal(String(BUDGET_BASE)); setBudgetEdit(false); }} style={{ ...G, flex: 1, height: 32, background: "none", borderLeft: `1px solid ${T.border}`, border: "none", borderLeft: `1px solid ${T.border}`, cursor: "pointer", fontSize: 11, color: T.inkMid }}>✕ Cancelar</button>
                </div>
              </div>
            )}
            <div style={{ ...G, fontSize: 10, color: T.inkLight }}>Deixe como está para usar o orçamento real da conta.</div>
          </div>

          {/* Divider itens */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.09em", whiteSpace: "nowrap" }}>Itens do cenário</div>
            <div style={{ flex: 1, height: 1, background: T.border }} />
            <span style={{ ...G, fontSize: 10, color: T.inkLight }}>opcional</span>
          </div>

          {/* Lista de itens já adicionados */}
          {items.map(item => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: T.grayLight, border: `1px solid ${T.border}`, borderRadius: 9 }}>
              <span style={{ fontSize: 16 }}>{TIPOS_ITEM.find(t => t.id === item.tipo)?.emoji || "📦"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...G, fontSize: 12, fontWeight: 600, color: T.ink }}>{item.nome}</div>
                <div style={{ ...G, fontSize: 10, color: T.inkMid }}>{item.cat} · {item.parcelas > 1 ? `${item.parcelas}×` : item.meses ? `${item.meses} meses` : "à vista"}</div>
              </div>
              {item.badge && <Badge color={T.amber} bg={T.amberLight}>{item.badge}</Badge>}
              <span style={{ ...M_MONO, ...NUM, fontSize: 12, fontWeight: 700, color: item.isReceita ? T.green : T.ink }}>{item.isReceita ? "+" : ""}{fmtAbs(Math.abs(item.total))}</span>
              <button onClick={() => setItems(l => l.filter(x => x.id !== item.id))} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkLight, padding: 2 }}><X size={13} /></button>
            </div>
          ))}

          {/* Formulário inline de novo item */}
          {showForm ? (
            <div style={{ border: `1.5px dashed ${T.purple}55`, borderRadius: 12, padding: 14, background: T.purpleLight, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.purple }}>Novo item</div>

              {/* Pills de tipo */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                {TIPOS_ITEM.map(t => (
                  <button key={t.id} onClick={() => setTipo(t.id)}
                    style={{ ...G, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 4px", border: `1.5px solid ${tipo === t.id ? T.purple : T.border}`, borderRadius: 9, cursor: "pointer", background: tipo === t.id ? T.surface : "rgba(255,255,255,0.5)", transition: "all 0.15s" }}>
                    <span style={{ fontSize: 16 }}>{t.emoji}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: tipo === t.id ? T.purple : T.inkMid, textAlign: "center", lineHeight: 1.3 }}>{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Campos comuns: nome + valor */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Nome</label>
                  <input style={inputStyle} placeholder="Ex: MacBook Air M3" value={iNome} onChange={e => setINome(e.target.value)} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>{tipo.startsWith("ajuste") ? "Valor do ajuste" : "Valor total"}</label>
                  <input style={{ ...inputStyle, fontFamily: "'Geist Mono', monospace" }} placeholder="R$ 0,00" value={iValor} onChange={e => setIValor(e.target.value)} />
                </div>
              </div>

              {/* Campos específicos por tipo */}
              {tipo === "despesa_parcelada" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Categoria</label>
                    <select style={selectStyle} value={iCat} onChange={e => setICat(e.target.value)}>{CATEGORIAS_SIM.map(c => <option key={c}>{c}</option>)}</select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Cartão / banco</label>
                    <select style={selectStyle} value={iBanco} onChange={e => setIBanco(e.target.value)}>{BANCOS_SIM.map(b => <option key={b}>{b}</option>)}</select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Parcelas</label>
                    <select style={selectStyle} value={iParcelas} onChange={e => setIParcelas(e.target.value)}>
                      {[1,2,3,4,5,6,7,8,9,10,11,12,18,24].map(n => <option key={n} value={n}>{n === 1 ? "à vista" : `${n}× (R$ ${iValor ? (parseFloat(iValor.replace(/[^\d.,]/g,"").replace(",","."))/n).toFixed(2) : "—"})`}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {(tipo === "despesa_recorrente" || tipo === "receita_recorrente") && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Categoria</label>
                    <select style={selectStyle} value={iCat} onChange={e => setICat(e.target.value)}>{CATEGORIAS_SIM.map(c => <option key={c}>{c}</option>)}</select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Duração</label>
                    <select style={selectStyle} value={iMeses} onChange={e => setIMeses(e.target.value)}>
                      {[1,2,3,4,5,6,9,12,24].map(n => <option key={n} value={n}>{n} {n === 1 ? "mês" : "meses"}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Periodicidade</label>
                    <select style={selectStyle}><option>Mensal</option><option>Semanal</option></select>
                  </div>
                </div>
              )}
              {tipo === "receita_pontual" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Categoria</label>
                    <select style={selectStyle} value={iCat} onChange={e => setICat(e.target.value)}>{CATEGORIAS_SIM.map(c => <option key={c}>{c}</option>)}</select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Data prevista</label>
                    <input style={inputStyle} type="date" />
                  </div>
                </div>
              )}
              {tipo === "ajuste_categoria" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Categoria</label>
                    <select style={selectStyle} value={iCat} onChange={e => setICat(e.target.value)}>{CATEGORIAS_SIM.map(c => <option key={c}>{c}</option>)}</select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Direção</label>
                    <select style={selectStyle}><option>Cortar</option><option>Aumentar</option></select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Tipo de valor</label>
                    <select style={selectStyle}><option>Valor fixo (R$)</option><option>Percentual (%)</option></select>
                  </div>
                </div>
              )}

              {/* Ações do form */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={resetForm} style={{ ...G, height: 32, padding: "0 12px", border: `1px solid ${T.border}`, borderRadius: 8, background: "none", fontSize: 11, color: T.inkMid, cursor: "pointer" }}>Cancelar</button>
                <button onClick={addItem} style={{ ...G, height: 32, padding: "0 14px", background: T.purple, border: "none", borderRadius: 8, fontSize: 11, fontWeight: 700, color: "#fff", cursor: "pointer" }}>+ Adicionar item</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowForm(true)}
              style={{ ...G, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 14, border: `1.5px dashed ${T.border}`, borderRadius: 9, background: "none", fontSize: 11, fontWeight: 700, color: T.purple, cursor: "pointer", transition: "all 0.15s" }}>
              <Plus size={13} /> Adicionar {items.length === 0 ? "primeiro item" : "outro item"}
            </button>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: T.grayLight, flexShrink: 0 }}>
          <span style={{ ...G, fontSize: 10, color: T.inkLight }}>
            {items.length === 0 ? "Você pode adicionar itens depois de criar o cenário." : `${items.length} ${items.length === 1 ? "item" : "itens"} · ${fmtAbs(totalItems)} total`}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ ...G, height: 36, padding: "0 14px", border: `1px solid ${T.border}`, borderRadius: 9, background: "none", fontSize: 12, color: T.inkMid, cursor: "pointer" }}>Cancelar</button>
            <button onClick={criar} disabled={!nome.trim()} style={{ ...G, height: 36, padding: "0 18px", background: nome.trim() ? T.purple : T.inkGhost, border: "none", borderRadius: 9, fontSize: 12, fontWeight: 700, color: "#fff", cursor: nome.trim() ? "pointer" : "default", transition: "background 0.2s" }}>
              Criar cenário →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Onboarding (estado vazio) ─────────────────────────── */
const SimOnboarding = ({ onNovo }) => {
  const casos = [
    { emoji: "💻", titulo: "Compra grande",     desc: "Simule uma compra parcelada e veja o impacto no orçamento.", tipo: "despesa_parcelada"  },
    { emoji: "📈", titulo: "Aumento de salário", desc: "Veja como uma receita recorrente melhora sua margem mensal.", tipo: "receita_recorrente" },
    { emoji: "✂️", titulo: "Corte de gastos",   desc: "Simule a redução de uma categoria e descubra quanto sobra.", tipo: "ajuste_categoria"   },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 480, gap: 32 }}>
      {/* Ícone central */}
      <div style={{ width: 64, height: 64, borderRadius: 18, background: T.purpleLight, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 8px ${T.purple}0D` }}>
        <FlaskConical size={28} color={T.purple} />
      </div>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ ...G, fontSize: 20, fontWeight: 800, color: T.ink, letterSpacing: "-0.02em", marginBottom: 8 }}>Nenhum cenário ativo</div>
        <div style={{ ...G, fontSize: 13, color: T.inkMid, lineHeight: 1.7 }}>
          Crie um cenário para simular o impacto de despesas, receitas ou mudanças no orçamento — sem afetar os seus dados reais.
        </div>
      </div>
      {/* Cards de caso de uso — cada um passa o tipo correto */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, width: "100%", maxWidth: 560 }}>
        {casos.map((c, i) => (
          <button key={i} onClick={() => onNovo(c.tipo)}
            style={{ ...G, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, padding: "14px 14px", background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12, cursor: "pointer", textAlign: "left", transition: "border 0.15s, box-shadow 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.purple; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.purple}11`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}>
            <span style={{ fontSize: 22 }}>{c.emoji}</span>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>{c.titulo}</div>
            <div style={{ fontSize: 11, color: T.inkMid, lineHeight: 1.5 }}>{c.desc}</div>
          </button>
        ))}
      </div>
      {/* CTA genérico — abre sem tipo pré-selecionado */}
      <button onClick={() => onNovo(null)} style={{ ...G, display: "flex", alignItems: "center", gap: 8, height: 42, padding: "0 24px", background: T.purple, border: "none", borderRadius: 11, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: `0 4px 14px ${T.purple}44` }}>
        <Plus size={15} /> Criar primeiro cenário
      </button>
    </div>
  );
};

/* ── SimulacaoPage principal ───────────────────────────── */
const SimulacaoPage = ({ cenarios, setCenarios, cenarioId, setCenarioId, autoOpenModal = false, autoTipo = null, isMobile = false, dataMode = "mock" }) => {
  const [showModal,   setShowModal]  = useState(false);
  const [modalTipo,   setModalTipo]  = useState(null);

  // auto-open quando chegamos via navTo com autoOpenModal
  useEffect(() => {
    if (autoOpenModal) {
      setModalTipo(autoTipo);
      setShowModal(true);
    }
  }, [autoOpenModal, autoTipo]);
  const [showDropCen, setShowDropCen]= useState(false);
  const [simTab, setSimTab] = useState("itens"); // mobile tab nav

  const cenario = cenarios.find(c => c.id === cenarioId) || null;
  const items   = cenario?.items || [];
  const setItems = newItems => setCenarios(cs => cs.map(c => c.id === cenarioId ? { ...c, items: newItems } : c));

  // Budget override inline
  const budgetOverride = cenario?.budgetOverride || null;
  const budgetAtivo    = budgetOverride !== null ? budgetOverride : BUDGET_BASE;
  const [budgetEditing, setBudgetEditing] = useState(false);
  const [budgetInputVal, setBudgetInputVal] = useState("");

  const setBudgetOverride = val => setCenarios(cs => cs.map(c => c.id === cenarioId ? { ...c, budgetOverride: val } : c));

  const parseBudgetInput = raw => parseFloat(raw.replace(/[^\d.,]/g,"").replace(",",".")) || 0;
  const budgetPreview    = budgetEditing ? parseBudgetInput(budgetInputVal) : budgetAtivo;
  const budgetIsOk       = budgetPreview >= 0;
  const projFimComInput  = Math.round((items.reduce((s,i) => s + Math.abs(i.total), 0) + (curReal || 0) / TODAY_RIT * 31));
  const projFimOkPreview = projFimComInput <= budgetPreview;

  const startBudgetEdit = () => { setBudgetInputVal(String(budgetAtivo)); setBudgetEditing(true); };
  const confirmBudget   = () => {
    const v = parseBudgetInput(budgetInputVal);
    if (v > 0) setBudgetOverride(v === BUDGET_BASE ? null : v);
    setBudgetEditing(false);
  };
  const cancelBudget    = () => { setBudgetEditing(false); setBudgetInputVal(""); };
  const restoreBudget   = () => { setBudgetOverride(null); setBudgetEditing(false); };

  const total    = items.reduce((s, i) => s + Math.abs(i.total), 0);
  const totalMes = items.reduce((s, i) => s + i.valParcela, 0);

  // KPIs derivados
  const projFim = Math.round(total + curReal);
  const margem  = budgetAtivo - projFim;
  const projecaoOk = projFim <= budgetAtivo;

  // simRhythm reativo ao budgetAtivo
  const simRhythmAtivo = useMemo(() => {
    const b   = budgetAtivo;
    const dpr = b / 31;
    return Array.from({ length: 31 }, (_, i) => {
      const d = i + 1;
      const proj   = +(dpr * d).toFixed(0);
      const real   = d <= TODAY_RIT ? Math.max(50, Math.round(dpr * d * 0.97 + Math.sin(d * 1.7) * 90)) : null;
      const withSim = d > TODAY_RIT ? Math.round((dpr * TODAY_RIT * 0.97) + (dpr * 1.18) * (d - TODAY_RIT)) : null;
      return { day: d, proj, real, budget: b, withSim };
    });
  }, [budgetAtivo]);

  const riscos = [
    { nivel: "ALTO",  color: T.red,   dot: "#EF4444", title: "Estouro do orçamento em março",   desc: `A simulação ultrapassa o orçamento em ${fmtAbs(Math.abs(margem))}, com extrapolação a partir do dia 21.` },
    { nivel: "MÉDIO", color: T.amber, dot: "#F59E0B", title: "Limite Nubank em risco",           desc: "R$ 4.190 comprometem 175% do limite disponível (R$ 2.400)." },
    { nivel: "BAIXO", color: T.green, dot: "#10B981", title: "Fluxo anual sustentável",          desc: "Após março, as parcelas cabem no saldo mensal disponível de R$ 4.070." },
  ];
  const impactos = [
    { cat: "Tecnologia",  icon: "💻", val: 4890, limite: 0,    pct: 100 },
    { cat: "Alimentação", icon: "🛒", val: 920,  limite: 1200, pct: 76  },
    { cat: "Assinaturas", icon: "⚡", val: 340,  limite: 300,  pct: 113 },
  ];
  const recs = [
    { emoji: "💡", txt: "Adiar o MacBook para **abril** distribui o impacto e mantém março dentro do orçamento." },
    { emoji: "💳", txt: "Usar o **Itaú Personnalité** (R$ 8.000 disponíveis) ao invés do Nubank evita estourar o limite." },
    { emoji: "📦", txt: "Parcelar em **18×** reduz o impacto mensal para R$ 233, bem dentro da sua margem fixa." },
  ];

  const criarCenario = ({ nome, budgetOverride: bo, items: its }) => {
    const novoId = Date.now();
    const novo = { id: novoId, nome, budgetOverride: bo, items: its.map((it, i) => ({ ...it, id: i + 1 })) };
    setCenarios(cs => [...cs, novo]);
    setCenarioId(novoId);
    setShowModal(false);
  };

  /* ── Mobile tab labels ── */
  const SIM_TABS = [
    { id:"itens",    label:"Itens",    icon:"✏️" },
    { id:"analise",  label:"Análise",  icon:"📊" },
    { id:"grafico",  label:"Ritmo",    icon:"📈" },
    { id:"insights", label:"Riscos",   icon:"⚠️" },
  ];

  /* ── SimTooltip (needed in both layouts) ── */
  const SimTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ ...G, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", boxShadow: T.md, fontSize: 11 }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: T.ink }}>Dia {label}</div>
        {payload.filter(p => p.value != null).map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <div style={{ width: 7, height: 7, borderRadius: 9999, background: p.color }} />
            <span style={{ color: T.inkMid, flex: 1 }}>{p.name}</span>
            <span style={{ ...M_MONO, ...NUM, fontWeight: 600, marginLeft: 12 }}>{fmtAbs(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  /* ── Shared: items list ── */
  const ItemsList = () => (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {items.length === 0 && (
        <div style={{ border: `1.5px dashed ${T.purple}44`, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "28px 16px", background: T.purpleLight, margin: "4px 0" }}>
          <div style={{ fontSize: 24 }}>✦</div>
          <div style={{ ...G, fontSize: 12, fontWeight: 700, color: T.purple }}>Nenhum item ainda</div>
          <div style={{ ...G, fontSize: 11, color: `${T.purple}99`, textAlign: "center" }}>Simule despesas, receitas ou ajustes de categoria</div>
        </div>
      )}
      {items.map(item => (
        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: isMobile ? 18 : 20 }}>{TIPOS_ITEM.find(t => t.id === item.tipo)?.emoji || "📦"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.nome}</div>
            <div style={{ ...G, fontSize: 11, color: T.inkMid }}>
              {item.cat}{item.parcelas > 1 ? ` · ${item.parcelas}× · ${fmtAbs(item.valParcela)}/mês` : item.meses ? ` · ${item.meses} meses` : ""}
            </div>
          </div>
          {item.badge && <Badge color={item.isReceita ? T.green : T.amber} bg={item.isReceita ? T.greenLight : T.amberLight}>{item.badge}</Badge>}
          <div style={{ ...M_MONO, ...NUM, fontSize: 13, fontWeight: 700, color: item.isReceita ? T.green : T.ink, flexShrink: 0 }}>{item.isReceita ? "+" : ""}{fmtAbs(Math.abs(item.total))}</div>
          <button onClick={() => setItems(items.filter(x => x.id !== item.id))} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkLight, padding: 4, flexShrink: 0 }}><X size={14} /></button>
        </div>
      ))}
      {items.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, marginTop: 4 }}>
          <span style={{ ...G, fontSize: 11, color: T.inkMid }}>{items.length} {items.length === 1 ? "item" : "itens"}</span>
          <div style={{ ...M_MONO, ...NUM, fontSize: 14, fontWeight: 800, color: projecaoOk ? T.green : T.red }}>{fmtAbs(total)}</div>
        </div>
      )}
    </div>
  );

  /* ── Shared: analysis KPIs ── */
  const KpiGrid = () => (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 1, background: T.border, borderRadius: 10, overflow: "hidden" }}>
      {[
        { label: "Total simulado",  val: fmtAbs(total),    delta: `+${fmtAbs(total)}`, sub: "mês 1", deltaColor: T.red, bg: T.surface },
        { label: "Projeção março",  val: fmtAbs(projFim),  delta: projecaoOk ? `${Math.round(projFim/budgetAtivo*100)}% do orçamento` : `+${fmtAbs(Math.abs(margem))}`, sub: projecaoOk ? "dentro do limite ✓" : "acima do orçamento", deltaColor: projecaoOk ? T.green : T.red, bg: T.surface },
        { label: "Margem",          val: (margem < 0 ? "−" : "+") + fmtAbs(Math.abs(margem)), delta: margem < 0 ? "ultrapassado" : "dentro do limite", sub: "saldo do cenário", deltaColor: margem < 0 ? T.red : T.green, bg: margem < 0 ? T.redLight : T.greenLight },
      ].map((k, i) => (
        <div key={i} style={{ background: k.bg, padding: isMobile ? "12px 11px" : "13px 12px", gridColumn: isMobile && i === 2 ? "1 / -1" : undefined, transition: "background 0.4s" }}>
          <div style={{ ...G, fontSize: 10, fontWeight: 700, color: i === 2 ? (margem < 0 ? T.red : T.green) : T.inkLight, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>{k.label}</div>
          <div style={{ ...M_MONO, ...NUM, fontSize: isMobile ? 16 : 15, fontWeight: 800, color: i === 1 ? k.deltaColor : (i === 2 ? k.deltaColor : T.red), marginBottom: 3, transition: "color 0.4s" }}>{k.val}</div>
          <div style={{ ...G, fontSize: 10, fontWeight: 700, color: k.deltaColor, marginBottom: 2 }}>{k.delta}</div>
          <div style={{ ...G, fontSize: 10, color: T.inkMid }}>{k.sub}</div>
        </div>
      ))}
    </div>
  );

  /* ── Shared: budget editor ── */
  const BudgetEditor = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Orçamento do período</div>
        <div style={{ ...G, fontSize: 10, color: budgetOverride ? T.purple : T.inkLight, fontWeight: budgetOverride ? 600 : 400 }}>
          {budgetOverride ? "ajustado para este cenário" : "orçamento real da conta"}
        </div>
      </div>
      {budgetEditing ? (
        <div style={{ border: `1.5px solid ${projFimOkPreview ? T.green : T.purple}`, borderRadius: 10, overflow: "hidden", boxShadow: `0 0 0 3px ${projFimOkPreview ? T.green : T.purple}11`, transition: "border 0.2s, box-shadow 0.2s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 13px", background: projFimOkPreview ? T.greenLight : T.purpleLight, transition: "background 0.2s" }}>
            <span style={{ fontSize: 13 }}>💰</span>
            <span style={{ ...M_MONO, ...NUM, fontSize: 12, color: T.inkLight, textDecoration: "line-through" }}>R$ {BUDGET_BASE.toLocaleString("pt-BR")}</span>
            <span style={{ fontSize: 11, color: T.inkLight }}>→</span>
            <input autoFocus
              style={{ ...G, fontFamily: "'Geist Mono', monospace", fontSize: 15, fontWeight: 800, color: projFimOkPreview ? T.green : T.purple, background: "none", border: "none", outline: "none", flex: 1, fontVariantNumeric: "tabular-nums" }}
              value={budgetInputVal} onChange={e => setBudgetInputVal(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmBudget(); if (e.key === "Escape") cancelBudget(); }} />
          </div>
          <div style={{ padding: "6px 13px", background: projFimOkPreview ? "#F0FDF4" : "#FAF8FF", borderTop: `1px solid ${projFimOkPreview ? T.green : T.purple}22`, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: projFimOkPreview ? T.green : T.red }}>
              {projFimOkPreview ? `✓ Projeção: ${fmtAbs(projFim)} · dentro do orçamento` : `✕ Projeção: ${fmtAbs(projFim)} · ainda acima`}
            </span>
            {projFimOkPreview && <span style={{ ...G, fontSize: 10, color: T.green, marginLeft: "auto", fontWeight: 600 }}>+{fmtAbs(budgetPreview - projFim)} de margem</span>}
            {!projFimOkPreview && <span style={{ ...G, fontSize: 10, color: T.inkMid, marginLeft: "auto" }}>precisa de {fmtAbs(projFim)}+</span>}
          </div>
          <div style={{ display: "flex", borderTop: `1px solid ${projFimOkPreview ? T.green : T.purple}22` }}>
            <button onClick={confirmBudget} style={{ ...G, flex: 1, height: 32, background: projFimOkPreview ? T.green : T.purple, color: "#fff", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, transition: "background 0.2s" }}>✓ Confirmar</button>
            <button onClick={cancelBudget}  style={{ ...G, flex: 1, height: 32, background: "none", borderLeft: `1px solid ${T.border}`, cursor: "pointer", fontSize: 11, color: T.inkMid }}>✕ Cancelar</button>
          </div>
        </div>
      ) : budgetOverride ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", background: T.purpleLight, border: `1.5px solid ${T.purple}44`, borderRadius: 10, cursor: "pointer" }} onClick={startBudgetEdit}>
          <span style={{ fontSize: 13 }}>💰</span>
          <span style={{ ...M_MONO, ...NUM, fontSize: 12, color: T.inkLight, textDecoration: "line-through" }}>R$ {BUDGET_BASE.toLocaleString("pt-BR")}</span>
          <span style={{ fontSize: 11, color: T.inkLight }}>→</span>
          <span style={{ ...M_MONO, ...NUM, fontSize: 15, fontWeight: 800, color: T.purple, flex: 1 }}>R$ {budgetOverride.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          <div style={{ width: 7, height: 7, borderRadius: 99, background: T.purple, flexShrink: 0 }} />
          <button onClick={e => { e.stopPropagation(); restoreBudget(); }} style={{ ...G, background: "none", border: "none", fontSize: 10, color: T.inkLight, cursor: "pointer", textDecoration: "underline" }}>Restaurar</button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", background: T.grayLight, border: `1.5px solid ${T.border}`, borderRadius: 10, cursor: "pointer", transition: "border 0.15s" }}
          onClick={startBudgetEdit}
          onMouseEnter={e => e.currentTarget.style.borderColor = T.borderHov}
          onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
          <span style={{ fontSize: 13 }}>💰</span>
          <span style={{ ...M_MONO, ...NUM, fontSize: 15, fontWeight: 800, color: T.ink, flex: 1 }}>R$ {BUDGET_BASE.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          <span style={{ ...G, fontSize: 10, color: T.inkLight, display: "flex", alignItems: "center", gap: 4 }}>✏️ Ajustar para este cenário</span>
        </div>
      )}
    </div>
  );

  /* ── Shared: rhythm chart ── */
  const RhythmChart = () => (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
        <span style={{ ...G, fontSize: isMobile ? 13 : 14, fontWeight: 700, color: T.ink }}>Ritmo de Gastos</span>
        <div style={{ display: "flex", alignItems: "center", gap: 5, background: T.purpleLight, border: `1px solid ${T.purple}22`, borderRadius: 9999, padding: "3px 9px" }}>
          <div style={{ width: 5, height: 5, borderRadius: 9999, background: T.purple }} />
          <span style={{ ...G, fontSize: 10, fontWeight: 600, color: T.purple }}>com simulação</span>
        </div>
      </div>
      {!isMobile && <div style={{ ...G, fontSize: 11, color: T.inkMid, marginBottom: 14 }}>Acumulado diário · Março 2026 + impacto simulado{budgetOverride ? ` · orçamento ajustado para ${fmtAbs(budgetOverride)}` : ""}</div>}
      <ResponsiveContainer width="100%" height={isMobile ? 180 : 220}>
        <ComposedChart data={simRhythmAtivo} margin={{ top: 10, right: isMobile ? 8 : 24, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
          <XAxis dataKey="day" tick={{ ...G, fontSize: 10, fill: T.inkLight }} axisLine={false} tickLine={false} tickFormatter={v => v % 5 === 0 || v === 1 ? `${v}` : ""} />
          <YAxis tick={{ ...G, ...NUM, fontSize: 10, fill: T.inkLight }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
          <Tooltip content={<SimTooltip />} />
          <ReferenceLine x={TODAY_RIT} stroke={T.amber} strokeWidth={1.5} strokeDasharray="4 3" label={{ value: "hoje", position: "top", fill: T.amber, fontSize: 10, fontFamily: "Geist,sans-serif" }} />
          <ReferenceLine y={budgetAtivo} stroke={`${T.red}66`} strokeDasharray="5 4"
            label={isMobile ? undefined : { value: "orçamento", position: "right", fill: T.red, fontSize: 10, fontFamily: "Geist,sans-serif" }} />
          <Line dataKey="real"    name="Realizado"     type="monotone" stroke={T.ink}      strokeWidth={2.5} dot={false} connectNulls={false} />
          <Line dataKey="proj"    name="Projeção base" type="monotone" stroke={T.inkGhost} strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
          <Line dataKey="withSim" name="Com simulação" type="monotone" stroke={T.purple}   strokeWidth={2.5} dot={false} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: isMobile ? 10 : 16, marginTop: 8, flexWrap: "wrap" }}>
        {[{ c: T.ink, dash: false, l: "Realizado" }, { c: T.inkGhost, dash: true, l: "Projeção" }, { c: T.purple, dash: false, l: "Com simulação" }].map((x, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="14" height="6"><line x1="0" y1="3" x2="14" y2="3" stroke={x.c} strokeWidth="2" strokeDasharray={x.dash ? "4 3" : ""} /></svg>
            <span style={{ ...G, fontSize: isMobile ? 9 : 10, color: T.inkMid }}>{x.l}</span>
          </div>
        ))}
      </div>
    </div>
  );

  /* ── Shared: riscos + impactos + recomendações ── */
  const InsightsContent = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Riscos */}
      <Card style={{ padding: 18 }}>
        <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={14} color={T.amber} /> Riscos identificados
        </div>
        {riscos.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 10, paddingBottom: i < riscos.length - 1 ? 14 : 0, marginBottom: i < riscos.length - 1 ? 14 : 0, borderBottom: i < riscos.length - 1 ? `1px solid ${T.border}` : "none" }}>
            <div style={{ width: 8, height: 8, borderRadius: 9999, background: r.dot, flexShrink: 0, marginTop: 3 }} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ ...G, fontSize: 12, fontWeight: 600, color: T.ink }}>{r.title}</span>
                <Badge color={r.color} bg={`${r.color}18`}>{r.nivel}</Badge>
              </div>
              <div style={{ ...G, fontSize: 11, color: T.inkMid, lineHeight: 1.55 }}>{r.desc}</div>
            </div>
          </div>
        ))}
      </Card>
      {/* Impacto */}
      <Card style={{ padding: 18 }}>
        <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <Target size={14} color={T.blue} /> Impacto por Orçamento
        </div>
        {impactos.map((imp, i) => (
          <div key={i} style={{ marginBottom: i < impactos.length - 1 ? 16 : 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16 }}>{imp.icon}</span>
                <span style={{ ...G, fontSize: 12, fontWeight: 600, color: T.ink }}>{imp.cat}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ ...M_MONO, ...NUM, fontSize: 12, fontWeight: 700, color: imp.pct > 100 ? T.red : T.ink }}>{fmtAbs(imp.val)}</div>
                <div style={{ ...G, fontSize: 10, color: T.inkMid }}>limite {imp.limite > 0 ? fmtAbs(imp.limite) : "sem limite"}</div>
              </div>
            </div>
            <div style={{ height: 6, background: T.border, borderRadius: 99, overflow: "hidden" }}>
              <div style={{ display: "flex", height: "100%" }}>
                <div style={{ width: `${Math.min(100, imp.limite > 0 ? (imp.limite / (imp.limite + imp.val)) * 100 : 0)}%`, background: T.greenBar, borderRadius: "99px 0 0 99px" }} />
                <div style={{ flex: 1, background: T.redBar, borderRadius: "0 99px 99px 0" }} />
              </div>
            </div>
            {imp.pct > 100 && <div style={{ ...G, fontSize: 10, color: T.red, fontWeight: 600, marginTop: 3 }}>+{imp.pct - 100}% acima do limite</div>}
          </div>
        ))}
      </Card>
      {/* Recomendações */}
      <Card style={{ padding: 18 }}>
        <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={14} color={T.purple} /> Recomendações
        </div>
        {recs.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 10, paddingBottom: i < recs.length - 1 ? 14 : 0, marginBottom: i < recs.length - 1 ? 14 : 0, borderBottom: i < recs.length - 1 ? `1px solid ${T.border}` : "none" }}>
            <div style={{ fontSize: 18, flexShrink: 0 }}>{r.emoji}</div>
            <div style={{ ...G, fontSize: 12, color: T.inkMid, lineHeight: 1.6 }}
              dangerouslySetInnerHTML={{ __html: r.txt.replace(/\*\*(.*?)\*\*/g, `<strong style="color:${T.ink};font-weight:700">$1</strong>`) }} />
          </div>
        ))}
      </Card>
    </div>
  );

  return (
    <>
    <ModalNovoCenario open={showModal} onClose={() => { setShowModal(false); setModalTipo(null); }} onCriar={criarCenario} initialTipo={modalTipo} />

    {/* ══════════════════════════════════════════
        MOBILE LAYOUT — Tabbed experience
    ══════════════════════════════════════════ */}
    {isMobile ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 0, minHeight: 0 }}>
        <style>{`@keyframes tabFadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }`}</style>

        {/* ── Mobile page title ── */}
        <div style={{ paddingTop: 4, paddingBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <PageTitle sans="Simulação" serif="de Despesas" />
          <button onClick={() => setShowModal(true)} style={{ ...G, display: "flex", alignItems: "center", gap: 5, background: T.purple, border: "none", borderRadius: 9, padding: "8px 13px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
            <Plus size={13} /> Novo
          </button>
        </div>

        {!cenario ? (
          /* ── Mobile onboarding ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 24 }}>
            <div style={{ background: T.purpleLight, border: `1px solid ${T.purple}22`, borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: T.purple + "22", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FlaskConical size={24} color={T.purple} />
              </div>
              <div style={{ ...G, fontSize: 17, fontWeight: 800, color: T.ink, letterSpacing: "-0.02em" }}>Nenhum cenário ativo</div>
              <div style={{ ...G, fontSize: 12, color: T.inkMid, lineHeight: 1.6, maxWidth: 280 }}>
                Crie um cenário para simular o impacto de despesas, receitas ou mudanças no orçamento — sem afetar seus dados reais.
              </div>
              <button onClick={() => setShowModal(true)} style={{ ...G, display: "flex", alignItems: "center", gap: 7, height: 42, padding: "0 22px", background: T.purple, border: "none", borderRadius: 11, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: `0 4px 14px ${T.purple}44` }}>
                <Plus size={14} /> Criar primeiro cenário
              </button>
            </div>
            {[
              { emoji:"💻", titulo:"Compra grande", desc:"Simule uma compra parcelada e veja o impacto no orçamento." },
              { emoji:"📈", titulo:"Aumento de salário", desc:"Veja como uma receita recorrente melhora sua margem mensal." },
              { emoji:"✂️", titulo:"Corte de gastos", desc:"Simule a redução de uma categoria e descubra quanto sobra." },
            ].map((c, i) => (
              <button key={i} onClick={() => setShowModal(true)}
                style={{ ...G, display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, cursor: "pointer", textAlign: "left", width: "100%", transition: "border-color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = T.purple + "55"}
                onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: T.purpleLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{c.emoji}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{c.titulo}</div>
                  <div style={{ fontSize: 11, color: T.inkMid, marginTop: 2, lineHeight: 1.5 }}>{c.desc}</div>
                </div>
                <ChevronRight size={14} color={T.inkGhost} style={{ marginLeft: "auto", flexShrink: 0 }} />
              </button>
            ))}
          </div>
        ) : (
          <>
          {/* ── Scenario header card ── */}
          <div style={{ background: T.darkBg, borderRadius: 16, padding: "16px 18px", marginBottom: 14, boxShadow: T.dark, position: "relative", overflow: "hidden" }}>
            {/* Purple glow */}
            <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: "50%", background: `${T.purple}22`, pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.darkMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Cenário ativo</div>
                <div style={{ ...S, fontSize: 20, color: T.darkText, lineHeight: 1.2 }}>{cenario.nome}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                {/* Limpar — botão discreto direto no header */}
                <button onClick={() => {
                    setCenarios(cs => cs.filter(c => c.id !== cenarioId));
                    const next = cenarios.find(c => c.id !== cenarioId);
                    setCenarioId(next?.id || null);
                  }}
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  title="Limpar cenário">
                  <Trash2 size={13} color="rgba(255,255,255,0.45)" />
                </button>
                {/* Cenário switcher */}
                <div style={{ position: "relative" }}>
                  <button onClick={() => setShowDropCen(v => !v)}
                    style={{ ...G, display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 600, color: T.darkText, cursor: "pointer" }}>
                    Trocar <ChevronDown size={11} />
                  </button>
                  {showDropCen && (
                    <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, boxShadow: T.lg, zIndex: 50, minWidth: 210, overflow: "hidden" }}>
                      {/* Lista scrollável */}
                      <div style={{ maxHeight: 220, overflowY: "auto" }}>
                        {cenarios.map(c => (
                          <div key={c.id} onClick={() => { setCenarioId(c.id); setShowDropCen(false); }}
                            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", background: c.id === cenarioId ? T.purpleLight : T.surface, transition: "background 0.12s" }}
                            onMouseEnter={e => e.currentTarget.style.background = c.id === cenarioId ? T.purpleLight : T.grayLight}
                            onMouseLeave={e => e.currentTarget.style.background = c.id === cenarioId ? T.purpleLight : T.surface}>
                            <FlaskConical size={12} color={c.id === cenarioId ? T.purple : T.inkLight} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nome}</div>
                              <div style={{ fontSize: 10, color: T.inkMid }}>{c.items.length} itens · {fmtAbs(c.items.reduce((s,i) => s + Math.abs(i.total), 0))}</div>
                            </div>
                            {c.id === cenarioId && <div style={{ width: 6, height: 6, borderRadius: 9999, background: T.purple, flexShrink: 0 }} />}
                          </div>
                        ))}
                      </div>
                      <div style={{ borderTop: `1px solid ${T.border}`, padding: "8px 14px" }}>
                        <button onClick={() => { setShowModal(true); setShowDropCen(false); }} style={{ ...G, display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", fontSize: 11, fontWeight: 600, color: T.purple, cursor: "pointer", padding: "4px 0" }}>
                          <Plus size={11} /> Novo cenário
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Stats row */}
            <div style={{ display: "flex", gap: 20 }}>
              <div>
                <div style={{ ...G, fontSize: 8, fontWeight: 700, color: T.darkMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Total simulado</div>
                <div style={{ ...M_MONO, ...NUM, fontSize: 18, fontWeight: 800, color: projecaoOk ? "#86EFAC" : "#FCA5A5", letterSpacing: "-0.01em" }}>{fmtAbs(total)}</div>
              </div>
              <div>
                <div style={{ ...G, fontSize: 8, fontWeight: 700, color: T.darkMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Margem</div>
                <div style={{ ...M_MONO, ...NUM, fontSize: 18, fontWeight: 800, color: projecaoOk ? "#86EFAC" : "#FCA5A5" }}>{margem >= 0 ? "+" : "−"}{fmtAbs(Math.abs(margem))}</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "flex-end" }}>
                <div style={{ ...G, fontSize: 10, fontWeight: 700, color: projecaoOk ? "#86EFAC" : "#FCA5A5", background: projecaoOk ? "rgba(134,239,172,0.15)" : "rgba(252,165,165,0.15)", padding: "4px 8px", borderRadius: 8 }}>
                  {projecaoOk ? "✓ ok" : "✕ estouro"}
                </div>
              </div>
            </div>
          </div>

          {/* ── Tab pills ── */}
          <div style={{ display: "flex", gap: 2, background: T.grayLight, borderRadius: 11, padding: 3, marginBottom: 14 }}>
            {SIM_TABS.map(t => (
              <button key={t.id} onClick={() => setSimTab(t.id)}
                style={{ ...G, flex: 1, padding: "7px 4px", borderRadius: 9, border: "none", fontSize: 11, fontWeight: simTab === t.id ? 700 : 500, cursor: "pointer", background: simTab === t.id ? T.surface : "transparent", color: simTab === t.id ? T.ink : T.inkMid, boxShadow: simTab === t.id ? T.sm : "none", transition: "all 0.18s", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <span style={{ fontSize: 13 }}>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* ── Tab content ── */}
          <div style={{ animation: "tabFadeIn 0.22s ease-out" }} key={simTab}>

            {/* Tab: Itens */}
            {simTab === "itens" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 80 }}>
                <Card style={{ padding: 16 }}>
                  <ItemsList />
                </Card>
              </div>
            )}

            {/* Tab: Análise */}
            {simTab === "analise" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 24 }}>
                <Card style={{ padding: 16 }}>
                  <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 12 }}>Análise do cenário</div>
                  <KpiGrid />
                </Card>
                <Card style={{ padding: 16 }}>
                  <BudgetEditor />
                </Card>
                {/* Impacto mensal */}
                <Card style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.ink }}>Impacto mensal recorrente</div>
                    <div style={{ ...M_MONO, ...NUM, fontSize: 15, fontWeight: 700, color: T.ink }}>
                      {fmtAbs(totalMes)}<span style={{ ...G, fontSize: 10, fontWeight: 400, color: T.inkMid }}>/mês</span>
                    </div>
                  </div>
                  <div style={{ height: 5, background: T.border, borderRadius: 99, overflow: "hidden", marginBottom: 5 }}>
                    <div style={{ width: "42%", height: "100%", background: T.purpleBar, borderRadius: 99 }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ ...G, fontSize: 10, color: T.inkMid }}>por 12 meses · até mar/27</span>
                    <span style={{ ...G, fontSize: 10, color: T.purple, fontWeight: 700 }}>42% do período restante</span>
                  </div>
                </Card>
                {/* Ponto de equilíbrio */}
                <div style={{ background: T.darkBg, borderRadius: 14, padding: "16px 18px", boxShadow: T.dark }}>
                  <div style={{ ...G, fontSize: 8, fontWeight: 700, color: T.darkMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Ponto de Equilíbrio</div>
                  <div style={{ ...G, fontSize: 20, fontWeight: 800, color: T.darkText, letterSpacing: "-0.02em", marginBottom: 2 }}>Março de 2027</div>
                  <div style={{ ...G, fontSize: 10, color: T.darkMuted, marginBottom: 12 }}>quando o impacto das parcelas se encerra</div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 99, marginBottom: 10, overflow: "hidden" }}>
                    <div style={{ width: "42%", height: "100%", background: T.darkPurple, borderRadius: 99 }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {[{ label:"Comprometido", val: fmtAbs(total) }, { label:"Parcelas", val:"12 meses" }, { label:"Equilíbrio", val:"12 meses" }].map((m, i) => (
                      <div key={i}>
                        <div style={{ ...G, fontSize: 10, color: T.darkMuted, marginBottom: 3 }}>{m.label}</div>
                        <div style={{ ...G, ...NUM, fontSize: 11, fontWeight: 700, color: T.darkText }}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Gráfico */}
            {simTab === "grafico" && (
              <Card style={{ padding: 16, paddingBottom: 20 }}>
                <RhythmChart />
              </Card>
            )}

            {/* Tab: Insights */}
            {simTab === "insights" && (
              <div style={{ paddingBottom: 24 }}>
                <InsightsContent />
              </div>
            )}
          </div>

          {/* ── FAB: Adicionar item ── */}
          <div style={{ position: "fixed", bottom: 24, right: 20, zIndex: 100 }}>
            <button onClick={() => setShowModal(true)}
              style={{ ...G, display: "flex", alignItems: "center", gap: 7, height: 48, padding: "0 20px", background: T.purple, border: "none", borderRadius: 24, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: `0 6px 20px ${T.purple}55`, transition: "transform 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
              <Plus size={16} /> Adicionar
            </button>
          </div>
          </>
        )}
      </div>

    ) : (
    /* ══════════════════════════════════════════
        DESKTOP LAYOUT — original
    ══════════════════════════════════════════ */
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── HEADER ── */}
      <div style={{ paddingTop: 4, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div><Breadcrumb label="Planejar" /><PageTitle sans="Simulação" serif="de Despesas" /></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowDropCen(v => !v)}
              style={{ ...G, display: "flex", alignItems: "center", gap: 8, background: cenario ? T.surface : T.purpleLight, border: `1px solid ${cenario ? T.border : T.purple + "44"}`, borderRadius: 9, padding: "7px 12px", fontSize: 12, fontWeight: 600, color: T.ink, cursor: "pointer", boxShadow: T.sm }}>
              <FlaskConical size={12} color={cenario ? T.inkMid : T.purple} />
              <span>{cenario ? cenario.nome : "Selecionar cenário"}</span>
              <ChevronDown size={11} color={T.inkLight} />
            </button>
            {showDropCen && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, boxShadow: T.lg, zIndex: 50, minWidth: 220, overflow: "hidden" }}>
                {cenarios.map(c => (
                  <div key={c.id} onClick={() => { setCenarioId(c.id); setShowDropCen(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", background: c.id === cenarioId ? T.purpleLight : T.surface, transition: "background 0.12s" }}
                    onMouseEnter={e => e.currentTarget.style.background = c.id === cenarioId ? T.purpleLight : T.grayLight}
                    onMouseLeave={e => e.currentTarget.style.background = c.id === cenarioId ? T.purpleLight : T.surface}>
                    <FlaskConical size={12} color={c.id === cenarioId ? T.purple : T.inkLight} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>{c.nome}</div>
                      <div style={{ fontSize: 10, color: T.inkMid, marginTop: 1 }}>{c.items.length} itens · {fmtAbs(c.items.reduce((s,i) => s + Math.abs(i.total), 0))}</div>
                    </div>
                    {c.id === cenarioId && <div style={{ width: 6, height: 6, borderRadius: 9999, background: T.purple }} />}
                  </div>
                ))}
                <div style={{ borderTop: `1px solid ${T.border}`, padding: "8px 14px" }}>
                  <button onClick={() => { setShowModal(true); setShowDropCen(false); }} style={{ ...G, display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", fontSize: 11, fontWeight: 600, color: T.purple, cursor: "pointer", padding: 0 }}>
                    <Plus size={11} /> Novo cenário
                  </button>
                </div>
              </div>
            )}
          </div>
          <Btn variant="outGray">Salvar cenário</Btn>
          {cenario && <Btn variant="outRed" onClick={() => { setCenarios(cs => cs.filter(c => c.id !== cenarioId)); setCenarioId(cenarios.find(c => c.id !== cenarioId)?.id || null); }}>Limpar</Btn>}
          {!cenario && <Btn variant="primary" onClick={() => setShowModal(true)}><Plus size={12} /> Novo cenário</Btn>}
        </div>
      </div>

      {/* ── ESTADO VAZIO ── */}
      {!cenario ? (
        <SimOnboarding onNovo={(tipo) => { setModalTipo(tipo); setShowModal(true); }} />
      ) : (
        <>
        {/* ── ROW 1 ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "stretch" }}>

          {/* Itens simulados */}
          <Card style={{ padding: 18, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 18 }}>✏️</span>
              <span style={{ ...G, fontSize: 14, fontWeight: 700, color: T.ink }}>{cenario.nome}</span>
              <span style={{ ...G, fontSize: 11, color: T.inkMid }}>{items.length} {items.length === 1 ? "item" : "itens"} · {fmtAbs(total)} total</span>
              <Btn variant="outGray" small style={{ marginLeft: "auto" }}>Renomear</Btn>
            </div>
            <div style={{ ...G, fontSize: 11, fontWeight: 600, color: T.inkMid, marginBottom: 2 }}>Itens simulados</div>
            <div style={{ ...G, fontSize: 10, color: T.inkLight, marginBottom: 12 }}>Hipotéticos — nenhum foi lançado</div>
            <ItemsList />
            {items.length < 3 && (
              <div style={{ border: `1.5px dashed ${T.border}`, borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, padding: "20px 16px", background: T.bg, flex: 1, margin: "12px 0", minHeight: 90 }}>
                <div style={{ fontSize: 20, color: T.inkGhost }}>＋</div>
                <div style={{ ...G, fontSize: 11, fontWeight: 600, color: T.inkLight }}>Adicione mais itens ao cenário</div>
                <div style={{ ...G, fontSize: 10, color: T.inkLight, textAlign: "center" }}>Simule despesas, receitas ou ajustes de categoria</div>
                <button onClick={() => setShowModal(true)} style={{ ...G, background: "none", border: "none", fontSize: 11, fontWeight: 700, color: T.purple, cursor: "pointer", marginTop: 4 }}>+ Adicionar item</button>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, marginTop: "auto", borderTop: `1px solid ${T.border}` }}>
              <Btn variant="outGray" onClick={() => setShowModal(true)}><Plus size={12} /> Adicionar</Btn>
              <div style={{ ...M_MONO, ...NUM, fontSize: 14, fontWeight: 700, color: projecaoOk ? T.green : T.red }}>Total simulado &nbsp; {fmtAbs(total)}</div>
            </div>
          </Card>

          {/* Análise do cenário */}
          <Card style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ ...G, fontSize: 14, fontWeight: 700, color: T.ink }}>Análise do cenário</div>
            <KpiGrid />
            <BudgetEditor />
            {/* Impacto mensal */}
            <div style={{ padding: "12px 14px", background: T.grayLight, borderRadius: 10, border: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.08em" }}>Impacto mensal recorrente</div>
                <div style={{ ...M_MONO, ...NUM, fontSize: 15, fontWeight: 700, color: T.ink }}>
                  {fmtAbs(totalMes)}<span style={{ ...G, fontSize: 10, fontWeight: 400, color: T.inkMid }}>/mês</span>
                </div>
              </div>
              <div style={{ height: 5, background: T.border, borderRadius: 99, overflow: "hidden", marginBottom: 5 }}>
                <div style={{ width: "42%", height: "100%", background: T.purpleBar, borderRadius: 99 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ ...G, fontSize: 10, color: T.inkMid }}>por 12 meses · até mar/27</span>
                <span style={{ ...G, fontSize: 10, color: T.purple, fontWeight: 700 }}>42% do período restante</span>
              </div>
            </div>
            {/* Ponto de equilíbrio */}
            <div style={{ background: T.darkBg, borderRadius: 12, padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", boxShadow: T.dark }}>
              <div style={{ ...G, fontSize: 8, fontWeight: 700, color: T.darkMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>Ponto de Equilíbrio</div>
              <div style={{ ...G, fontSize: 22, fontWeight: 800, color: T.darkText, letterSpacing: "-0.02em", marginBottom: 2 }}>Março de 2027</div>
              <div style={{ ...G, fontSize: 10, color: T.darkMuted, marginBottom: 12 }}>quando o impacto das parcelas se encerra</div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 99, marginBottom: 12, overflow: "hidden" }}>
                <div style={{ width: "42%", height: "100%", background: T.darkPurple, borderRadius: 99 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[{ label: "Comprometido", val: fmtAbs(total) }, { label: "Parcelas", val: "12 meses" }, { label: "Equilíbrio", val: "12 meses" }].map((m, i) => (
                  <div key={i}>
                    <div style={{ ...G, fontSize: 10, color: T.darkMuted, marginBottom: 3 }}>{m.label}</div>
                    <div style={{ ...G, ...NUM, fontSize: 11, fontWeight: 700, color: T.darkText }}>{m.val}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* ── ROW 2: Gráfico ── */}
        <Card style={{ padding: 20 }}>
          <RhythmChart />
        </Card>

        {/* ── ROW 3: Riscos | Impacto | Recomendações ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <InsightsContent />
        </div>
        </>
      )}
    </div>
    )}
    </>
  );
};

/* ─── NOVA TRANSAÇÃO DRAWER ─────────────────────────────── */
/* ─── PARCELA HYBRID (A+B+C) ───────────────────────────────────── */
const ParcelaHybrid = ({ parcelas, valorNum, T, G, NUM }) => {
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


const NovaTransacaoModal = ({ open, onClose, novaRecorrencia = false, preConfig = null, isMobile = false }) => {
  const [tipo,      setTipo]      = useState(preConfig?.tipo || "despesa");
  const [valor,     setValor]     = useState(() => { if (preConfig?.valorInicial) return preConfig.valorInicial.toLocaleString("pt-BR",{minimumFractionDigits:2}); return novaRecorrencia||preConfig ? "" : "187,40"; });
  const [desc,      setDesc]      = useState(preConfig?.desc || (novaRecorrencia ? "" : "Mercado Extra - compras da semana"));
  const [cat,       setCat]       = useState(preConfig?.cat || "Alimentação");
  const [tags,      setTags]      = useState(novaRecorrencia || preConfig ? [] : ["mercado","compras"]);
  const [newTag,    setNewTag]    = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [method,    setMethod]    = useState(preConfig?.method || (novaRecorrencia ? "debito" : "credito"));
  const [parcelas,  setParcelas]  = useState(3);
  const [recorre,   setRecorre]   = useState(novaRecorrencia || !!preConfig?.recorre);
  const [panel,     setPanel]     = useState(novaRecorrencia || preConfig?.recorre ? "recorrencia" : "cartao");
  const [cartao,    setCartao]    = useState(preConfig?.cartaoId || "nubank");
  const [modalidade,setMod]       = useState("parcelado");
  const [freqRec,   setFreqRec]   = useState(preConfig?.freqRec || "mensal");
  const [encRec,    setEncRec]    = useState(preConfig?.encRec || "sem-fim");
  const [valorTipoRec, setValorTipoRec] = useState(preConfig?.valorTipoRec || "fixo");
  const [showImpact,setShowImpact]= useState(false);
  const [review,    setReview]    = useState(false);
  const [reviewDir, setReviewDir] = useState("forward");
  const [success,   setSuccess]   = useState(false);
  // Mobile step state
  const [mStep,     setMStep]     = useState(1);
  // AI suggestion simulation
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiApplied,    setAiApplied]    = useState(false);
  const [descFocused,  setDescFocused]  = useState(false);
  const valorInputRef = useRef(null);
  // Banking-style valor input (integer cents)
  const [centavos,      setCentavos]     = useState(() => novaRecorrencia||preConfig ? 0 : 18740);
  // Parcela calculator
  const [parcelaMode,   setParcelaMode]  = useState(false);
  const [pCalcCents,    setPCalcCents]   = useState(0);
  const [pCalcN,        setPCalcN]       = useState(2);
  const [pCalcCustom,   setPCalcCustom]  = useState(false); // show custom input in calc
  const [pCalcCustomInput, setPCalcCustomInput] = useState(""); // raw text while user types
  const [parcelasCustom,setParcelasCustom]= useState(false); // show custom input in panel
  const [parcelasInput, setParcelasInput] = useState("");    // raw input for custom parcelas
  // Quick-add card inline
  const [addingCartao,  setAddingCartao] = useState(false);
  const [ncNomeMod,     setNcNomeMod]    = useState("");
  const [ncDigMod,      setNcDigMod]     = useState("");

  // Sync tipo from preConfig when modal opens
  useEffect(() => {
    if (open && preConfig?.tipo) {
      setTipo(preConfig.tipo);
    }
  }, [open, preConfig?.tipo]);

  // Global key capture: digits typed anywhere → Valor field
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      // Skip if any input/textarea/select is focused (except our valor field)
      const tag = document.activeElement?.tagName;
      const isOtherInput = (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") &&
                           document.activeElement !== valorInputRef.current;
      if (isOtherInput || descFocused) return;
      // Skip modifier keys and non-digit keys
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= "0" && e.key <= "9") {
        // Focus valor input first, then process
        valorInputRef.current?.focus();
        e.preventDefault();
        const next = Math.min(centavos * 10 + parseInt(e.key), 9999999);
        setCentavos(next);
        setValor(next === 0 ? "" : (next / 100).toLocaleString("pt-BR", { minimumFractionDigits:2 }));
        if (parcelaMode) setParcelaMode(false);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        if (document.activeElement === valorInputRef.current) return; // handled by onKeyDown
        valorInputRef.current?.focus();
        e.preventDefault();
        if (e.key === "Delete") { setCentavos(0); setValor(""); }
        else { const n = Math.floor(centavos / 10); setCentavos(n); setValor(n===0?"": (n/100).toLocaleString("pt-BR",{minimumFractionDigits:2})); }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, centavos, descFocused, parcelaMode]);

  // Banking-style input handler (digit-shift preserves decimal)
  const handleValorKey = (e) => {
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      const next = Math.min(centavos * 10 + parseInt(e.key), 9999999);
      setCentavos(next);
      setValor(next === 0 ? "" : (next / 100).toLocaleString("pt-BR", { minimumFractionDigits:2 }));
      if (parcelaMode) setParcelaMode(false);
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      if (e.key === "Delete") {
        setCentavos(0); setValor("");
      } else {
        const next = Math.floor(centavos / 10);
        setCentavos(next);
        setValor(next === 0 ? "" : (next / 100).toLocaleString("pt-BR", { minimumFractionDigits:2 }));
      }
    }
  };
  const handlePCalcKey = (e) => {
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      setPCalcCents(prev => Math.min(prev * 10 + parseInt(e.key), 9999999));
    } else if (e.key === "Backspace") {
      e.preventDefault();
      setPCalcCents(prev => Math.floor(prev / 10));
    } else if (e.key === "Delete") {
      e.preventDefault();
      setPCalcCents(0);
    }
  };
  const applyParcelaCalc = () => {
    const total = pCalcCents * pCalcN;
    setCentavos(total);
    setValor(total === 0 ? "" : (total / 100).toLocaleString("pt-BR", { minimumFractionDigits:2 }));
    setMethod("credito"); setPanel("cartao"); setMod("parcelado"); setParcelas(pCalcN);
    setParcelaMode(false); setPCalcCents(0);
  };
  const valorNum   = parseFloat(valor.replace(",",".")) || 0;
  const typeColor  = tipo === "despesa" ? T.red : T.green;
  const typeLight  = tipo === "despesa" ? T.redLight : T.greenLight;

  const FREQ_LABELS = { diário:"Diário", semanal:"Semanal", mensal:"Mensal", quinzenal:"Quinzenal", anual:"Anual", custom:"Custom" };
  const ENC_LABELS  = { "sem-fim":"Sem data fim", repeticoes:"Após N repetições", data:"Data específica" };
  const MET_LABELS  = { pix:"Pix", boleto:"Boleto", dinheiro:"Dinheiro", debito:"Débito", credito:"Crédito", transferencia:"Transferência" };

  const cartoes = [
    { id:"nubank", banco:"NUBANK", nome:"Nu Roxinho",   dig:"1177", disp:2400 },
    { id:"itau",   banco:"ITAÚ",   nome:"Personnalité", dig:"0034", disp:8000 },
    { id:"inter",  banco:"INTER",  nome:"Mastercard",   dig:"5521", disp:1200 },
    { id:"novo",   banco:"",       nome:"+ Novo cartão",dig:"",     disp:0,    novo:true },
  ];
  const freqs = ["Diário","Semanal","Mensal","Quinzenal","Anual","Custom"];
  const parcs = [2,3,4,6,8,10,12];

  // Methods by tipo
  const METHODS_DESPESA = [["pix","Pix"],["debito","Débito"],["credito","Crédito"],["dinheiro","Dinheiro"],["boleto","Boleto"]];
  const METHODS_RECEITA = [["pix","Pix"],["dinheiro","Dinheiro"],["transferencia","Transferência"]];
  const methodsList = tipo === "receita" ? METHODS_RECEITA : METHODS_DESPESA;

  // Fix method when tipo changes to receita
  const handleSetTipo = (t) => {
    setTipo(t);
    if (t === "receita" && (method === "credito" || method === "boleto")) setMethod("pix");
  };

  // AI simulation: trigger when desc >= 4 chars
  useEffect(() => {
    if (desc.length < 4) { setAiSuggestion(null); setAiApplied(false); return; }
    const lower = desc.toLowerCase();
    let suggestion = null;
    if (lower.includes("mercado") || lower.includes("supermercado") || lower.includes("extra") || lower.includes("pão de açúcar"))
      suggestion = { cat:"Alimentação", tags:["mercado","compras"] };
    else if (lower.includes("uber") || lower.includes("99") || lower.includes("gasolina") || lower.includes("combustível"))
      suggestion = { cat:"Transporte", tags:["transporte"] };
    else if (lower.includes("netflix") || lower.includes("spotify") || lower.includes("adobe") || lower.includes("amazon"))
      suggestion = { cat:"Assinaturas", tags:["streaming","assinatura"] };
    else if (lower.includes("academia") || lower.includes("smartfit") || lower.includes("farmácia") || lower.includes("remédio"))
      suggestion = { cat:"Saúde", tags:["saúde"] };
    else if (lower.includes("aluguel") || lower.includes("condomínio") || lower.includes("iptu"))
      suggestion = { cat:"Moradia", tags:["moradia","fixo"] };
    else if (lower.includes("salário") || lower.includes("freela") || lower.includes("aporte"))
      suggestion = { cat:"Renda", tags:["receita"] };
    setAiSuggestion(suggestion);
    setAiApplied(false);
  }, [desc]);

  const applyAi = () => {
    if (!aiSuggestion) return;
    setCat(aiSuggestion.cat);
    setTags(aiSuggestion.tags);
    setAiApplied(true);
  };

  // Mobile: dynamic steps flow
  const mStepsFlow = useMemo(() => {
    const f = [1, 2];
    if (tipo === "despesa" && method === "credito") f.push("cartao");
    if (recorre) f.push("recorrencia");
    f.push("review");
    return f;
  }, [tipo, method, recorre]);

  const mCurrentIdx  = mStepsFlow.indexOf(mStep);
  const mTotalSteps  = mStepsFlow.length;
  const mIsLast      = mCurrentIdx === mTotalSteps - 1;
  const mNextStep    = mStepsFlow[mCurrentIdx + 1];
  const mPrevStep    = mCurrentIdx > 0 ? mStepsFlow[mCurrentIdx - 1] : null;

  const mNextLabel = () => {
    if (mNextStep === "review")      return "Revisar →";
    if (mNextStep === "cartao")      return "Cartão →";
    if (mNextStep === "recorrencia") return "Recorrência →";
    return "Continuar →";
  };

  const goNext = () => { if (mNextStep) setMStep(mNextStep); };
  const goPrev = () => { if (mPrevStep !== null) setMStep(mPrevStep); };

  const handleSave = () => {
    setSuccess(true);
    setTimeout(() => { setSuccess(false); onClose(); }, 1200);
  };

  // Desktop-only helpers
  const goReview = () => { setReviewDir("forward"); setReview(true); };
  const goBack   = () => { setReviewDir("back");    setReview(false); };

  const PanelHeader = ({ icon: Icon, title, onCollapse }) => (
    <div style={{ padding:"15px 18px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <Icon size={15} color={T.ink} />
        <span style={{ ...G, fontSize:14, fontWeight:700, color:T.ink }}>{title}</span>
      </div>
      <button onClick={onCollapse} style={{ background:"none", border:"none", cursor:"pointer", padding:4, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center" }}
        onMouseEnter={e => e.currentTarget.style.background = T.bg}
        onMouseLeave={e => e.currentTarget.style.background = "none"}>
        <X size={15} color={T.inkLight} />
      </button>
    </div>
  );

  /* ── MobileImpact — collapsible in review ── */
  const MobileImpact = () => {
    const [open, setOpen] = useState(false);
    return (
      <div style={{ border:`1px solid ${T.amber}33`, borderRadius:12, overflow:"hidden" }}>
        <button onClick={() => setOpen(v => !v)}
          style={{ ...G, width:"100%", display:"flex", alignItems:"center", gap:8, padding:"10px 13px", background:T.amberLight, border:"none", cursor:"pointer" }}>
          <Zap size={13} color={T.amber} fill={T.amber} style={{ flexShrink:0 }} />
          <div style={{ flex:1, textAlign:"left" }}>
            <span style={{ ...G, fontSize:12, fontWeight:700, color:T.ink }}>Impacto financeiro</span>
            <span style={{ ...G, fontSize:11, color:T.amber, marginLeft:8 }}>R$ 5.240 · 62%</span>
          </div>
          <ChevronDown size={14} color={T.amber} style={{ transition:"transform 0.22s", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink:0 }} />
        </button>
        {open && (
          <div style={{ padding:"12px 14px", background:T.surface, borderTop:`1px solid ${T.amber}22`, display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ height:64, margin:"0 -4px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rhythmData.slice(0,25)} margin={{ top:4, right:4, left:-30, bottom:0 }}>
                  <YAxis hide /><XAxis dataKey="day" hide /><Tooltip hide />
                  <ReferenceLine x={TODAY_RIT} stroke={T.inkGhost} strokeWidth={1} />
                  <Line dataKey="real" type="monotone" stroke={T.ink}      strokeWidth={2}   dot={false} connectNulls={false} />
                  <Line dataKey="proj" type="monotone" stroke={T.inkGhost} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
              {[
                { label:"APÓS LANÇAMENTO",  val:"R$ 5.240", sub:"62% do orçamento", color:T.red },
                { label:"PROJEÇÃO FIM MÊS", val:"R$ 7.077", sub:"84% do orçamento", color:T.red },
                { label:"MARGEM RESTANTE",  val:"R$ 1.323", sub:"até o limite",      color:T.ink },
              ].map((k,i) => (
                <div key={i}>
                  <div style={{ ...G, fontSize:7, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>{k.label}</div>
                  <div style={{ ...G, ...NUM, fontSize:13, fontWeight:800, color:k.color }}>{k.val}</div>
                  <div style={{ ...G, fontSize:10, color:T.inkMid, marginTop:1 }}>{k.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:13 }}>🛒</span>
              <span style={{ ...G, fontSize:12, fontWeight:600, color:T.ink }}>Alimentação</span>
              <div style={{ flex:1 }}><ProgBar pct={71} color={T.greenBar} h={4} /></div>
              <div style={{ textAlign:"right" }}>
                <span style={{ ...G, ...NUM, fontSize:10, color:T.inkLight }}>R$ 858 → </span>
                <span style={{ ...G, ...NUM, fontSize:10, fontWeight:700, color:T.red }}>R$ 1.046</span>
                <div style={{ ...G, fontSize:8, color:T.inkLight }}>limite R$ 1.200</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ── ReviewBody (shared desktop + mobile) ── */
  const ReviewBody = ({ mobile = false }) => (
    <div style={mobile ? {} : { animation: reviewDir === "forward" ? "revSlideIn 0.26s ease-out" : "revSlideBack 0.26s ease-out" }}>
      <div style={{ background: typeLight, borderBottom:`1px solid ${typeColor}18`, padding: mobile ? "14px 18px" : "14px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:6 }}>
          <div style={{ width:18, height:18, borderRadius:9999, background:typeColor, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Check size={10} color="#fff" strokeWidth={3} />
          </div>
          <span style={{ ...G, fontSize:10, fontWeight:700, color:typeColor, textTransform:"uppercase", letterSpacing:"0.09em" }}>
            {novaRecorrencia || recorre ? "Recorrência pronta para confirmar" : "Pronto para registrar"}
          </span>
        </div>
        <div style={{ ...G, fontSize:18, fontWeight:800, color:T.ink, letterSpacing:"-0.01em" }}>{desc || "(sem descrição)"}</div>
        <div style={{ display:"flex", alignItems:"baseline", gap:5, marginTop:4 }}>
          <span style={{ ...G, ...NUM, fontSize:28, fontWeight:800, color:typeColor, letterSpacing:"-0.02em" }}>
            {tipo === "despesa" ? "−" : "+"}R$ {valorNum.toLocaleString("pt-BR",{minimumFractionDigits:2})}
          </span>
          {(novaRecorrencia || recorre) && (
            <span style={{ ...G, fontSize:12, color:typeColor, opacity:0.7 }}>
              / {FREQ_LABELS[freqRec]?.toLowerCase() || "mês"}
            </span>
          )}
        </div>
        {(novaRecorrencia || recorre) && (
          <div style={{ ...G, fontSize:11, color:typeColor, opacity:0.65, marginTop:3 }}>
            Todo dia 8 · {FREQ_LABELS[freqRec]} · {ENC_LABELS[encRec]}
          </div>
        )}
      </div>
      <div style={{ padding: mobile ? "14px 18px" : "16px 20px", display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:1, background:T.border, borderRadius:12, overflow:"hidden", border:`1px solid ${T.border}` }}>
          {[
            { label:"TIPO",        val: tipo === "despesa" ? "Despesa" : "Receita", valColor: typeColor },
            { label:"CATEGORIA",   val: cat    },
            { label:"FORMA PAG.",  val: MET_LABELS[method] || method },
            { label:"DATA",        val: "08/03/2026" },
            ...(recorre || novaRecorrencia ? [
              { label:"FREQUÊNCIA",   val: FREQ_LABELS[freqRec] || freqRec },
              { label:"ENCERRAMENTO", val: ENC_LABELS[encRec] || encRec },
              { label:"TIPO DE VALOR", val: valorTipoRec === "estimado" ? "≈ Estimado" : "Fixo" },
            ] : [
              { label:"PARCELAS",  val: method === "credito" ? `${parcelas}× de R$ ${(valorNum/parcelas).toFixed(2)}` : "—" },
              { label:"CARTÃO",    val: method === "credito" ? cartoes.find(c=>c.id===cartao)?.nome || "—" : "—" },
            ]),
          ].map((f,i) => (
            <div key={i} style={{ background:T.surface, padding:"10px 14px" }}>
              <div style={{ ...G, fontSize:8, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>{f.label}</div>
              <div style={{ ...G, fontSize:12, fontWeight:600, color:f.valColor || T.ink }}>{f.val}</div>
            </div>
          ))}
        </div>
        {tags.length > 0 && (
          <div>
            <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>Tags</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {tags.map(tag => (
                <span key={tag} style={{ ...G, fontSize:11, fontWeight:600, color:"#fff", background:T.purple, padding:"4px 10px", borderRadius:9999 }}>+ {tag}</span>
              ))}
            </div>
          </div>
        )}
        {/* Impact — full on desktop, compact on mobile */}
        {!mobile && (
          <div style={{ border:`1px solid ${T.amber}33`, borderRadius:12, overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", gap:7, padding:"11px 14px", background:T.amberLight, borderBottom:`1px solid ${T.amber}22` }}>
              <Zap size={13} color={T.amber} fill={T.amber} />
              <span style={{ ...G, fontSize:12, fontWeight:700, color:T.ink }}>Impacto financeiro</span>
            </div>
            <div style={{ padding:"12px 14px", background:T.surface }}>
              <div style={{ height:72, margin:"0 -4px 12px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rhythmData.slice(0,25)} margin={{ top:4, right:4, left:-30, bottom:0 }}>
                    <YAxis hide /><XAxis dataKey="day" hide /><Tooltip hide />
                    <ReferenceLine x={TODAY_RIT} stroke={T.inkGhost} strokeWidth={1} />
                    <Line dataKey="real" type="monotone" stroke={T.ink}      strokeWidth={2}   dot={false} connectNulls={false} />
                    <Line dataKey="proj" type="monotone" stroke={T.inkGhost} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
                {[
                  { label:"APÓS LANÇAMENTO",  val:"R$ 5.240", sub:"62% do orçamento", color:T.red },
                  { label:"PROJEÇÃO FIM MÊS", val:"R$ 7.077", sub:"84% do orçamento", color:T.red },
                  { label:"MARGEM RESTANTE",  val:"R$ 1.323", sub:"até o limite",      color:T.ink },
                ].map((k,i) => (
                  <div key={i}>
                    <div style={{ ...G, fontSize:8, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>{k.label}</div>
                    <div style={{ ...G, ...NUM, fontSize:14, fontWeight:800, color:k.color }}>{k.val}</div>
                    <div style={{ ...G, fontSize:10, color:T.inkMid, marginTop:2 }}>{k.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:14 }}>🛒</span>
                <span style={{ ...G, fontSize:12, fontWeight:600, color:T.ink }}>Alimentação</span>
                <div style={{ flex:1 }}><ProgBar pct={71} color={T.greenBar} h={4} /></div>
                <div style={{ textAlign:"right" }}>
                  <span style={{ ...G, ...NUM, fontSize:11, color:T.inkLight }}>R$ 858 → </span>
                  <span style={{ ...G, ...NUM, fontSize:11, fontWeight:700, color:T.red }}>R$ 1.046</span>
                  <div style={{ ...G, fontSize:10, color:T.inkMid }}>limite R$ 1.200</div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Mobile impact — collapsible */}
        {mobile && <MobileImpact />}
      </div>
    </div>
  );

  if (!open) return null;

  /* ════════════════════════════════════════════════════════════
     MOBILE — Bottom sheet with dynamic steps
  ════════════════════════════════════════════════════════════ */
  if (isMobile) {
    const CATS = ["Alimentação","Moradia","Transporte","Saúde","Lazer","Educação","Vestuário","Assinaturas","Outros"];
    const CAT_EMOJIS = { Alimentação:"🛒",Moradia:"🏠",Transporte:"🚗",Saúde:"💊",Lazer:"🎮",Educação:"📚",Vestuário:"👕",Assinaturas:"⚡",Outros:"📦",Renda:"💰" };

    const stepLabel = {
      1: "Valor",
      2: "Detalhes",
      cartao: "Cartão",
      recorrencia: "Recorrência",
      review: "Confirmação",
    };

    return (
      <div style={{ position:"fixed", inset:0, zIndex:300, overflow:"hidden", display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
        <style>{`
          @keyframes sheetUp { from { transform:translateY(100%) } to { transform:translateY(0) } }
          @keyframes stepIn  { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }
          @keyframes stepBack{ from { opacity:0; transform:translateX(-20px) } to { opacity:1; transform:translateX(0) } }
        `}</style>
        {/* Backdrop */}
        <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(15,23,35,0.5)" }} />

        {/* Sheet */}
        <div style={{ position:"relative", background:T.surface, borderRadius:"24px 24px 0 0", maxHeight:"94vh", display:"flex", flexDirection:"column", animation:"sheetUp 0.5s cubic-bezier(0.32,0.72,0,1) both", boxShadow:"0 -2px 0 rgba(0,0,0,0.05), 0 -8px 32px rgba(0,0,0,0.14), 0 -24px 80px rgba(0,0,0,0.08)" }}>

          {/* Handle */}
          <div style={{ display:"flex", justifyContent:"center", padding:"10px 0 4px" }}>
            <div style={{ width:36, height:4, borderRadius:99, background:T.inkGhost }} />
          </div>

          {/* Step dots + header */}
          <div style={{ padding:"4px 20px 12px", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
            {/* Progress dots */}
            <div style={{ display:"flex", justifyContent:"center", gap:5, marginBottom:10 }}>
              {mStepsFlow.map((s, i) => (
                <div key={s} style={{ width: s === mStep ? 18 : 6, height:6, borderRadius:99, background: i < mCurrentIdx ? T.inkGhost : s === mStep ? T.ink : T.border, transition:"all 0.25s" }} />
              ))}
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em" }}>
                  Step {mCurrentIdx + 1} de {mTotalSteps}
                </div>
                <div style={{ ...G, fontSize:16, fontWeight:800, color:T.ink, marginTop:1 }}>{stepLabel[mStep]}</div>
              </div>
              <button onClick={onClose} style={{ background:T.grayLight, border:"none", cursor:"pointer", padding:7, borderRadius:9, display:"flex" }}>
                <X size={16} color={T.inkMid} />
              </button>
            </div>
          </div>

          {/* Scrollable step content */}
          <div style={{ flex:1, overflowY:"auto" }}>

            {/* ── STEP 1: Tipo + Valor + Descrição ── */}
            {mStep === 1 && (
              <div style={{ padding:"18px 20px", display:"flex", flexDirection:"column", gap:16, animation:"stepIn 0.22s ease-out" }}>
                {/* Tipo tabs */}
                <div style={{ display:"flex", background:T.grayLight, borderRadius:11, padding:3, gap:2 }}>
                  {[["despesa","↑ Despesa",T.red],["receita","↓ Receita",T.green]].map(([t, label, color]) => (
                    <button key={t} onClick={() => handleSetTipo(t)}
                      style={{ ...G, flex:1, padding:"10px 0", borderRadius:9, border:"none", fontSize:13, fontWeight:700, cursor:"pointer",
                        background: tipo === t ? T.surface : "transparent",
                        color: tipo === t ? color : T.inkMid,
                        boxShadow: tipo === t ? T.sm : "none",
                        transition:"all 0.18s" }}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Valor — hero */}
                <div style={{ textAlign:"center" }}>
                  <div style={{ ...G, fontSize:13, fontWeight:600, color:T.inkLight, marginBottom:4 }}>Valor</div>
                  <div style={{ display:"flex", alignItems:"baseline", justifyContent:"center", gap:6 }}>
                    <span style={{ ...G, fontSize:22, fontWeight:700, color:T.inkLight }}>R$</span>
                    <input value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00"
                      inputMode="decimal"
                      style={{ ...G, ...NUM, fontSize:48, fontWeight:800, color:T.ink, border:"none", outline:"none", background:"transparent", letterSpacing:"-0.02em", width:"100%", maxWidth:240, textAlign:"center" }} />
                  </div>
                  {/* Parcela + saldo — same row, pill style */}
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginTop:6, flexWrap:"wrap" }}>
                    {method === "credito" && modalidade === "parcelado" && parcelas > 1 && valorNum > 0 && (
                      <span style={{ ...G, ...NUM, display:"inline-flex", alignItems:"center",
                        fontSize:13, fontWeight:700, color:T.blue,
                        background:T.blueLight, padding:"3px 10px", borderRadius:99 }}>
                        {parcelas}× R$ {(valorNum/parcelas).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}
                      </span>
                    )}
                    <span style={{ ...G, fontSize:11, color:T.inkLight }}>
                      Saldo: <span style={{ color:T.blue, fontWeight:600 }}>R$ 3.160,00</span>
                    </span>
                  </div>
                </div>

                {/* Descrição */}
                <div>
                  <div style={{ ...G, fontSize:12, fontWeight:600, color:T.inkMid, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                    Descrição
                    <span style={{ ...G, fontSize:10, fontWeight:700, color:T.purple, background:T.purpleLight, padding:"1px 7px", borderRadius:99, display:"flex", alignItems:"center", gap:3 }}>
                      <Star size={8} fill={T.purple} /> IA
                    </span>
                  </div>
                  <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex: Mercado Extra, academia..."
                    style={{ ...G, width:"100%", padding:"13px 14px", borderRadius:12, border:`1px solid ${T.border}`, fontSize:15, color:T.ink, outline:"none", background:T.surface, transition:"border-color 0.15s" }}
                    onFocus={e => e.target.style.borderColor = T.blue}
                    onBlur={e => e.target.style.borderColor = T.border} />

                  {/* AI chip */}
                  {aiSuggestion && !aiApplied && (
                    <button onClick={applyAi}
                      style={{ ...G, marginTop:8, width:"100%", display:"flex", alignItems:"center", gap:8, padding:"10px 14px", background:T.purpleLight, border:`1px solid ${T.purple}33`, borderRadius:10, cursor:"pointer", textAlign:"left" }}>
                      <Star size={12} fill={T.purple} color={T.purple} style={{ flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <span style={{ ...G, fontSize:11, color:T.purple, fontWeight:700 }}>IA identificou: </span>
                        <span style={{ ...G, fontSize:11, color:T.ink }}>{aiSuggestion.cat}</span>
                        <span style={{ ...G, fontSize:11, color:T.inkMid }}> · {aiSuggestion.tags.map(t => `#${t}`).join(" ")}</span>
                      </div>
                      <span style={{ ...G, fontSize:10, fontWeight:700, color:T.purple }}>Aplicar →</span>
                    </button>
                  )}
                  {aiApplied && (
                    <div style={{ ...G, marginTop:8, display:"flex", alignItems:"center", gap:6, padding:"8px 12px", background:T.greenLight, borderRadius:9 }}>
                      <Check size={11} color={T.green} strokeWidth={2.5} />
                      <span style={{ fontSize:11, color:T.green, fontWeight:600 }}>Categoria e tags aplicadas automaticamente</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 2: Categoria + Método + Recorrência ── */}
            {mStep === 2 && (
              <div style={{ padding:"18px 20px", display:"flex", flexDirection:"column", gap:18, animation:"stepIn 0.22s ease-out" }}>

                {/* Categoria */}
                <div>
                  <div style={{ ...G, fontSize:12, fontWeight:600, color:T.inkMid, marginBottom:10 }}>Categoria</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {CATS.map(c => (
                      <button key={c} onClick={() => setCat(c)}
                        style={{ ...G, display:"flex", alignItems:"center", gap:5, padding:"8px 12px", borderRadius:99, border:`1.5px solid ${cat === c ? T.ink : T.border}`, background:cat === c ? T.ink : T.surface, color:cat === c ? "#fff" : T.inkMid, fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.15s" }}>
                        <span style={{ fontSize:13 }}>{CAT_EMOJIS[c] || "📦"}</span> {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Método de pagamento */}
                <div>
                  <div style={{ ...G, fontSize:12, fontWeight:600, color:T.inkMid, marginBottom:10 }}>Forma de pagamento</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {methodsList.map(([id, label]) => (
                      <button key={id} onClick={() => setMethod(id)}
                        style={{ ...G, flex:1, minWidth:70, padding:"10px 8px", borderRadius:10, border:`1.5px solid ${method === id ? T.ink : T.border}`, background:method === id ? T.ink : T.surface, color:method === id ? "#fff" : T.inkMid, fontSize:12, fontWeight:600, cursor:"pointer", textAlign:"center", transition:"all 0.15s" }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recorrência toggle */}
                <div onClick={() => { setRecorre(r => { if (!r) setMod("avista"); return !r; }); }}
                  style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", background:recorre ? T.blueLight : T.bg, borderRadius:12, border:`1px solid ${recorre ? T.blue : T.border}`, cursor:"pointer", transition:"all 0.18s" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <Repeat size={16} color={recorre ? T.blue : T.inkLight} />
                    <div>
                      <div style={{ ...G, fontSize:13, fontWeight:600, color:T.ink }}>Transação recorrente</div>
                      <div style={{ ...G, fontSize:11, color:T.inkLight, marginTop:1 }}>Repetir automaticamente</div>
                    </div>
                  </div>
                  <div style={{ width:42, height:24, borderRadius:12, background:recorre ? T.blue : T.inkGhost, position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                    <div style={{ position:"absolute", top:3, left:recorre ? 21 : 3, width:18, height:18, borderRadius:9999, background:"#fff", transition:"left 0.2s", boxShadow:T.sm }} />
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <div style={{ ...G, fontSize:12, fontWeight:600, color:T.inkMid, marginBottom:10 }}>Tags</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
                    {tags.map(tag => (
                      <span key={tag} onClick={() => setTags(ts => ts.filter(t => t !== tag))}
                        style={{ ...G, fontSize:12, fontWeight:600, color:"#fff", background:T.purple, padding:"5px 11px", borderRadius:9999, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
                        + {tag} <span style={{ opacity:0.7, fontSize:10 }}>✕</span>
                      </span>
                    ))}
                    {addingTag ? (
                      <input autoFocus value={newTag} onChange={e => setNewTag(e.target.value)}
                        onKeyDown={e => { if(e.key==="Enter"&&newTag.trim()){setTags(ts=>[...ts,newTag.trim()]);setNewTag("");setAddingTag(false);} if(e.key==="Escape"){setNewTag("");setAddingTag(false);} }}
                        onBlur={() => { if(newTag.trim())setTags(ts=>[...ts,newTag.trim()]); setNewTag(""); setAddingTag(false); }}
                        style={{ ...G, fontSize:12, color:T.blue, border:`1px dashed ${T.blue}`, padding:"4px 10px", borderRadius:9999, outline:"none", width:90, background:"transparent" }} />
                    ) : (
                      <span onClick={() => setAddingTag(true)} style={{ ...G, fontSize:12, color:T.blue, border:`1px dashed ${T.blue}`, padding:"4px 10px", borderRadius:9999, cursor:"pointer" }}>+ nova</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP CARTÃO ── */}
            {mStep === "cartao" && (
              <div style={{ padding:"18px 20px", display:"flex", flexDirection:"column", gap:16, animation:"stepIn 0.22s ease-out" }}>
                <div>
                  <div style={{ ...G, fontSize:12, fontWeight:600, color:T.inkMid, marginBottom:10 }}>Selecionar cartão</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {cartoes.filter(c => !c.novo).map(c => (
                      <div key={c.id} onClick={() => setCartao(c.id)}
                        style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderRadius:14, border:`2px solid ${cartao === c.id ? T.ink : T.border}`, background:cartao === c.id ? T.ink : T.surface, cursor:"pointer", transition:"all 0.15s" }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ ...G, fontSize:8, fontWeight:700, color:cartao===c.id?"rgba(255,255,255,0.5)":T.inkLight, letterSpacing:"0.08em", marginBottom:2 }}>{c.banco}</div>
                          <div style={{ ...G, fontSize:14, fontWeight:700, color:cartao===c.id?"#fff":T.ink }}>{c.nome}</div>
                          <div style={{ ...G, ...NUM, fontSize:10, color:cartao===c.id?"rgba(255,255,255,0.5)":T.inkLight, marginTop:1 }}>···· {c.dig}</div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ ...G, ...NUM, fontSize:13, fontWeight:700, color:cartao===c.id?"#86efac":T.green }}>R$ {c.disp.toLocaleString("pt-BR")}</div>
                          <div style={{ ...G, fontSize:10, color:cartao===c.id?"rgba(255,255,255,0.4)":T.inkLight }}>disponível</div>
                        </div>
                        {cartao===c.id && <div style={{ width:16, height:16, borderRadius:9999, background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Check size={10} color={T.ink} /></div>}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ ...G, fontSize:12, fontWeight:600, color:T.inkMid, marginBottom:10 }}>Modalidade</div>
                  <div style={{ display:"flex", gap:8 }}>
                    {[["avista","À vista","1× sem juros"],["parcelado","Parcelado","Dividir em parcelas"]].map(([id, label, sub]) => {
                      const disabled = id === "parcelado" && recorre;
                      const selected = modalidade === id;
                      return (
                        <button key={id} onClick={() => !disabled && setMod(id)}
                          style={{ flex:1, padding:"12px", borderRadius:12,
                            border:`1.5px solid ${disabled ? T.border : selected ? T.ink : T.border}`,
                            background: disabled ? T.grayLight : selected ? T.ink : T.surface,
                            cursor: disabled ? "not-allowed" : "pointer",
                            textAlign:"left", transition:"all 0.15s", opacity: disabled ? 0.5 : 1 }}>
                          <div style={{ ...G, fontSize:13, fontWeight:700, color: disabled ? T.inkGhost : selected?"#fff":T.ink }}>{label}</div>
                          <div style={{ ...G, fontSize:10, color: disabled ? T.inkGhost : selected?"rgba(255,255,255,0.5)":T.inkLight, marginTop:2 }}>
                            {disabled ? "Indisponível com recorrência" : sub}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {modalidade === "parcelado" && (
                  <div>
                    <div style={{ ...G, fontSize:12, fontWeight:600, color:T.inkMid, marginBottom:10 }}>Parcelas</div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                      {parcs.map(p => (
                        <button key={p} onClick={() => setParcelas(p)} style={{ padding:"10px 4px", borderRadius:10, border:`1.5px solid ${parcelas===p ? T.ink : T.border}`, background:parcelas===p ? T.ink : T.surface, cursor:"pointer", textAlign:"center", transition:"all 0.15s" }}>
                          <div style={{ ...G, fontSize:13, fontWeight:700, color:parcelas===p?"#fff":T.ink }}>{p}×</div>
                          <div style={{ ...G, ...NUM, fontSize:10, color:parcelas===p?"rgba(255,255,255,0.5)":T.inkLight, marginTop:1 }}>{valorNum > 0 ? `R$${(valorNum/p).toFixed(0)}` : "—"}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Aviso academia */}
                {recorre && modalidade === "avista" && (
                  <div style={{ display:"flex", gap:8, padding:"10px 12px", background:T.amberLight, border:`1px solid ${T.amber}44`, borderRadius:10 }}>
                    <span style={{ fontSize:14, flexShrink:0 }}>⚠️</span>
                    <span style={{ ...G, fontSize:11, color:T.inkMid, lineHeight:1.55 }}>Recorrente + à vista: será cobrado <strong style={{ color:T.ink }}>1× por mês</strong> no cartão selecionado.</span>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP RECORRÊNCIA ── */}
            {mStep === "recorrencia" && (
              <div style={{ padding:"18px 20px", display:"flex", flexDirection:"column", gap:16, animation:"stepIn 0.22s ease-out" }}>
                <div>
                  <div style={{ ...G, fontSize:12, fontWeight:600, color:T.inkMid, marginBottom:10 }}>Frequência</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    {freqs.map(f => {
                      const fid = f.toLowerCase();
                      return (
                        <button key={f} onClick={() => setFreqRec(fid)}
                          style={{ ...G, padding:"12px 10px", borderRadius:10, border:`1.5px solid ${freqRec===fid ? T.ink : T.border}`, background:freqRec===fid ? T.ink : T.surface, color:freqRec===fid ? "#fff" : T.inkMid, fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.15s" }}>
                          {f}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div style={{ ...G, fontSize:12, fontWeight:600, color:T.inkMid, marginBottom:10 }}>Encerramento</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {[
                      { id:"sem-fim",    label:"Sem data fim",      sub:"Até cancelar manualmente" },
                      { id:"repeticoes", label:"Após N repetições", sub:"Ex: 12 meses"             },
                      { id:"data",       label:"Data específica",   sub:"Escolher término"         },
                    ].map(opt => (
                      <div key={opt.id} onClick={() => setEncRec(opt.id)}
                        style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderRadius:12, border:`1.5px solid ${encRec===opt.id ? T.ink : T.border}`, cursor:"pointer", background:encRec===opt.id ? T.bg : T.surface, transition:"all 0.15s" }}>
                        <div style={{ width:16, height:16, borderRadius:9999, border:`2px solid ${encRec===opt.id ? T.ink : T.border}`, background:encRec===opt.id ? T.ink : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          {encRec===opt.id && <div style={{ width:6, height:6, borderRadius:9999, background:"#fff" }} />}
                        </div>
                        <div>
                          <div style={{ ...G, fontSize:13, fontWeight:600, color:T.ink }}>{opt.label}</div>
                          <div style={{ ...G, fontSize:11, color:T.inkLight, marginTop:2 }}>{opt.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Resumo */}
                <div style={{ padding:"12px 14px", background:T.bg, borderRadius:12, border:`1px solid ${T.border}` }}>
                  <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>Resumo</div>
                  <div style={{ ...G, fontSize:14, fontWeight:700, color:T.ink }}>Todo dia 8, {FREQ_LABELS[freqRec]?.toLowerCase()}</div>
                  <div style={{ ...G, fontSize:11, color:T.inkLight, marginTop:2 }}>Próxima: 08/04/2026 · {ENC_LABELS[encRec]?.toLowerCase()}</div>
                </div>
              </div>
            )}

            {/* ── REVIEW ── */}
            {mStep === "review" && <ReviewBody mobile={true} />}

          </div>

          {/* Footer with navigation */}
          <div style={{ padding:"14px 20px", borderTop:`1px solid ${T.border}`, background:T.surface, flexShrink:0 }}>
            {mStep === "review" ? (
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={goPrev} style={{ ...G, display:"flex", alignItems:"center", gap:5, padding:"13px 16px", borderRadius:12, border:`1px solid ${T.border}`, background:T.surface, fontSize:14, fontWeight:600, color:T.inkMid, cursor:"pointer" }}>
                  <ChevronLeft size={16} /> Editar
                </button>
                <button onClick={handleSave}
                  style={{ ...G, flex:1, padding:"13px", borderRadius:12, border:"none", background:success ? T.green : typeColor, fontSize:14, fontWeight:800, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7, transition:"background 0.25s" }}>
                  {success ? <><Check size={16} /> {recorre || novaRecorrencia ? "Recorrência salva!" : "Registrado!"}</> : (recorre || novaRecorrencia ? "Confirmar recorrência" : `Confirmar ${tipo === "despesa" ? "despesa" : "receita"}`)}
                </button>
              </div>
            ) : (
              <div style={{ display:"flex", gap:10 }}>
                {mPrevStep !== null && (
                  <button onClick={goPrev} style={{ ...G, width:48, height:50, borderRadius:12, border:`1px solid ${T.border}`, background:T.surface, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 }}>
                    <ChevronLeft size={18} color={T.inkMid} />
                  </button>
                )}
                <button onClick={goNext} disabled={mStep === 1 && !valorNum}
                  style={{ ...G, flex:1, padding:"13px", borderRadius:12, border:"none", background: (mStep === 1 && !valorNum) ? T.inkGhost : T.ink, fontSize:14, fontWeight:800, color:"#fff", cursor:(mStep===1&&!valorNum)?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7, transition:"background 0.2s" }}>
                  {mNextLabel()}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
     DESKTOP — original drawer (preserved)
  ════════════════════════════════════════════════════════════ */
  return (
    <div style={{ position:"fixed", inset:0, zIndex:200, overflow:"hidden", display:"flex", justifyContent:"flex-end" }}>
      <style>{`
        @keyframes drawerIn    { from { transform:translateX(100%); opacity:0 } to { transform:translateX(0); opacity:1 } }
        @keyframes revSlideIn  { from { transform:translateX(28px); opacity:0 } to { transform:translateX(0); opacity:1 } }
        @keyframes revSlideBack{ from { transform:translateX(-28px); opacity:0 } to { transform:translateX(0); opacity:1 } }
        @keyframes successPop  { 0%{transform:scale(1)} 40%{transform:scale(1.04)} 100%{transform:scale(1)} }
      `}</style>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(15,23,35,0.18)" }} />
      <div style={{ position:"relative", display:"flex", height:"100vh", boxShadow:T.dark, animation:"drawerIn 0.22s ease-out" }}>

        {/* SUB-PANEL: Recorrência */}
        {panel === "recorrencia" && (
          <div style={{ width:250, background:T.surface, borderLeft:`1px solid ${T.border}`, display:"flex", flexDirection:"column", height:"100vh" }}>
            <PanelHeader icon={Repeat} title="Recorrência" onCollapse={() => setPanel(method==="credito" ? "cartao" : null)} />
            <div style={{ flex:1, overflowY:"auto", padding:"16px 18px", display:"flex", flexDirection:"column", gap:18 }}>
              <div>
                <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:10 }}>Frequência</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                  {freqs.map(f => {
                    const fid = f.toLowerCase();
                    return (
                      <button key={f} onClick={() => setFreqRec(fid)} style={{ ...G, padding:"8px 10px", borderRadius:8, border:`1.5px solid ${freqRec===fid ? T.ink : T.border}`, background:freqRec===fid ? T.ink : T.surface, color:freqRec===fid ? "#fff" : T.inkMid, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                        {f}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:10 }}>Encerramento</div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {[
                    { id:"sem-fim",    label:"Sem data fim",      sub:"Até cancelar manualmente" },
                    { id:"repeticoes", label:"Após N repetições", sub:"Ex: 12 meses"             },
                    { id:"data",       label:"Data específica",   sub:"Escolher término"         },
                  ].map(opt => (
                    <div key={opt.id} onClick={() => setEncRec(opt.id)}
                      style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"10px 12px", borderRadius:9, border:`1.5px solid ${encRec===opt.id ? T.ink : T.border}`, cursor:"pointer", background:encRec===opt.id ? T.bg : T.surface }}>
                      <div style={{ width:14, height:14, borderRadius:9999, border:`2px solid ${encRec===opt.id ? T.ink : T.border}`, background:encRec===opt.id ? T.ink : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                        {encRec===opt.id && <div style={{ width:5, height:5, borderRadius:9999, background:"#fff" }} />}
                      </div>
                      <div>
                        <div style={{ ...G, fontSize:12, fontWeight:600, color:T.ink }}>{opt.label}</div>
                        <div style={{ ...G, fontSize:10, color:T.inkLight, marginTop:1 }}>{opt.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding:"12px 14px", background:T.bg, borderRadius:10, border:`1px solid ${T.border}` }}>
                <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Resumo</div>
                <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink }}>Todo dia 8, {FREQ_LABELS[freqRec]?.toLowerCase()}</div>
                <div style={{ ...G, fontSize:11, color:T.inkLight, marginTop:2 }}>Próxima: 08/04/2026 · {ENC_LABELS[encRec]?.toLowerCase()}</div>
              </div>
              {/* Tipo de valor */}
              <div>
                <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>Tipo de valor</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                  {[
                    { id:"fixo",     label:"Valor fixo",      sub:"Mesmo valor todo mês",             icon:"🔒" },
                    { id:"estimado", label:"Valor estimado",   sub:"Varia, mas use como referência",   icon:"≈"  },
                  ].map(opt => (
                    <button key={opt.id} onClick={() => setValorTipoRec(opt.id)}
                      style={{ padding:"10px 12px", borderRadius:9, textAlign:"left", cursor:"pointer",
                        border:`1.5px solid ${valorTipoRec===opt.id ? T.ink : T.border}`,
                        background:valorTipoRec===opt.id ? T.ink : T.surface,
                        transition:"all 0.15s" }}>
                      <div style={{ ...G, fontSize:13, marginBottom:2 }}>{opt.icon}</div>
                      <div style={{ ...G, fontSize:12, fontWeight:700, color:valorTipoRec===opt.id?"#fff":T.ink }}>{opt.label}</div>
                      <div style={{ ...G, fontSize:10, color:valorTipoRec===opt.id?"rgba(255,255,255,0.55)":T.inkLight, marginTop:2, lineHeight:1.4 }}>{opt.sub}</div>
                    </button>
                  ))}
                </div>
                {valorTipoRec==="estimado" && (
                  <div style={{ display:"flex", alignItems:"flex-start", gap:7, background:T.amberLight,
                    border:`1px solid ${T.amber}33`, borderRadius:9, padding:"8px 11px", marginTop:8 }}>
                    <AlertTriangle size={12} color={T.amber} style={{ flexShrink:0, marginTop:1 }} />
                    <span style={{ ...G, fontSize:11, color:T.inkMid, lineHeight:1.55 }}>
                      O valor informado serve como referência nas projeções. Você pode atualizar o valor real a qualquer momento diretamente na tela de Recorrências.
                    </span>
                  </div>
                )}
              </div>
              {!novaRecorrencia && (
                <button onClick={() => setPanel(null)} style={{ ...G, width:"100%", padding:"11px", borderRadius:10, border:"none", background:T.ink, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                  Confirmar recorrência
                </button>
              )}
            </div>
          </div>
        )}

        {/* SUB-PANEL: Cartão */}
        {panel === "cartao" && (
          <div style={{ width:280, background:T.surface, borderLeft:`1px solid ${T.border}`, display:"flex", flexDirection:"column", height:"100vh" }}>
            <PanelHeader icon={CreditCard} title="Cartão de crédito" onCollapse={() => setPanel(null)} />
            <div style={{ flex:1, overflowY:"auto", padding:"16px 18px", display:"flex", flexDirection:"column", gap:16 }}>
              <div>
                <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:10 }}>Selecionar Cartão</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {cartoes.map(c => (
                    <div key={c.id} onClick={() => !c.novo && setCartao(c.id)}
                      style={{ padding:"12px", borderRadius:10, border:`2px solid ${cartao===c.id&&!c.novo ? T.ink : T.border}`, cursor:"pointer", background:c.novo ? T.bg : cartao===c.id ? T.ink : T.surface, transition:"all 0.12s", position:"relative", display:"flex", flexDirection:"column", gap:3, alignItems:c.novo?"center":"flex-start", justifyContent:c.novo?"center":"flex-start", minHeight:72 }}>
                      {c.novo ? (
                        <div onClick={e=>{e.stopPropagation();setAddingCartao(true);}}
                          style={{ ...G, fontSize:11, color:T.blue, display:"flex", alignItems:"center", gap:5,
                            fontWeight:700, cursor:"pointer" }}>
                          <Plus size={12} color={T.blue}/> Novo cartão
                        </div>
                      ) : (
                        <>
                          <div style={{ ...G, fontSize:8, fontWeight:700, color:cartao===c.id?"rgba(255,255,255,0.6)":T.inkLight, letterSpacing:"0.08em" }}>{c.banco}</div>
                          <div style={{ ...G, fontSize:12, fontWeight:700, color:cartao===c.id?"#fff":T.ink }}>{c.nome}</div>
                          <div style={{ ...G, ...NUM, fontSize:10, color:cartao===c.id?"rgba(255,255,255,0.5)":T.inkLight }}>···· {c.dig}</div>
                          <div style={{ ...G, ...NUM, fontSize:10, fontWeight:700, color:cartao===c.id?"#86efac":T.green, marginTop:2 }}>R$ {c.disp.toLocaleString("pt-BR")} disp.</div>
                          {cartao===c.id && <div style={{ position:"absolute", top:7, right:7, width:14, height:14, borderRadius:9999, background:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}><Check size={9} color={T.ink} /></div>}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {addingCartao && (
                <div style={{ background:T.bg, border:`1px solid ${T.blue}33`, borderRadius:10, padding:"12px 14px",
                  animation:"revSlideIn 0.18s ease-out" }}>
                  <div style={{ ...G, fontSize:11, fontWeight:700, color:T.blue, marginBottom:10 }}>
                    Adicionar cartão
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    <input value={ncNomeMod} onChange={e=>setNcNomeMod(e.target.value)}
                      placeholder="Nome (ex: Nubank Roxinho)"
                      style={{ ...G, padding:"8px 10px", borderRadius:8, border:`1px solid ${T.border}`,
                        fontSize:12, color:T.ink, outline:"none", background:T.surface,
                        transition:"border-color 0.15s" }}
                      onFocus={e=>e.target.style.borderColor=T.blue}
                      onBlur={e=>e.target.style.borderColor=T.border}/>
                    <input value={ncDigMod} onChange={e=>setNcDigMod(e.target.value.slice(0,4))}
                      placeholder="4 últimos dígitos" maxLength={4}
                      style={{ ...G, ...NUM, padding:"8px 10px", borderRadius:8, border:`1px solid ${T.border}`,
                        fontSize:12, color:T.ink, outline:"none", background:T.surface,
                        transition:"border-color 0.15s" }}
                      onFocus={e=>e.target.style.borderColor=T.blue}
                      onBlur={e=>e.target.style.borderColor=T.border}/>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={()=>{setAddingCartao(false);setNcNomeMod("");setNcDigMod("");}}
                        style={{ ...G, flex:1, padding:"7px", borderRadius:8, border:`1px solid ${T.border}`,
                          background:T.surface, fontSize:11, fontWeight:600, color:T.inkMid, cursor:"pointer" }}>
                        Cancelar
                      </button>
                      <button
                        disabled={!ncNomeMod||ncDigMod.length<4}
                        onClick={()=>{
                          setAddingCartao(false); setNcNomeMod(""); setNcDigMod("");
                        }}
                        style={{ ...G, flex:1, padding:"7px", borderRadius:8, border:"none",
                          background:ncNomeMod&&ncDigMod.length===4?T.blue:T.inkGhost,
                          fontSize:11, fontWeight:700, color:"#fff",
                          cursor:ncNomeMod&&ncDigMod.length===4?"pointer":"not-allowed", transition:"background 0.15s" }}>
                        Adicionar
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div>
                <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>Modalidade</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                  {[["avista","À vista","1× sem juros"],["parcelado","Parcelado","Dividir em parcelas"]].map(([id,label,sub]) => {
                    const disabled = id === "parcelado" && recorre;
                    const selected = modalidade === id;
                    return (
                      <button key={id} onClick={() => !disabled && setMod(id)}
                        style={{ padding:"10px 12px", borderRadius:9,
                          border:`1.5px solid ${disabled ? T.border : selected ? T.ink : T.border}`,
                          background: disabled ? T.grayLight : selected ? T.ink : T.surface,
                          cursor: disabled ? "not-allowed" : "pointer",
                          textAlign:"left", opacity: disabled ? 0.5 : 1, transition:"all 0.15s" }}>
                        <div style={{ ...G, fontSize:12, fontWeight:700, color: disabled ? T.inkGhost : selected?"#fff":T.ink }}>{label}</div>
                        <div style={{ ...G, fontSize:10, color: disabled ? T.inkGhost : selected?"rgba(255,255,255,0.6)":T.inkLight, marginTop:2 }}>
                          {disabled ? "Indisponível com recorrência" : sub}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {modalidade==="parcelado" && (
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <span style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em" }}>Parcelas</span>
                    <span style={{ ...G, ...NUM, fontSize:11, color:T.inkLight }}>R$ {valorNum.toFixed(2)} total</span>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
                    {parcs.map(p => (
                      <button key={p} onClick={() => setParcelas(p)} style={{ padding:"8px 4px", borderRadius:8, border:`1.5px solid ${parcelas===p ? T.ink : T.border}`, background:parcelas===p ? T.ink : T.surface, cursor:"pointer", textAlign:"center" }}>
                        <div style={{ ...G, fontSize:12, fontWeight:700, color:parcelas===p?"#fff":T.ink }}>{p}×</div>
                        <div style={{ ...G, ...NUM, fontSize:10, color:parcelas===p?"rgba(255,255,255,0.6)":T.inkLight, marginTop:2 }}>{(valorNum/p).toFixed(2)}</div>
                      </button>
                    ))}
                    {parcelasCustom ? (
                      <div style={{ padding:"4px", borderRadius:8, border:`1.5px solid ${T.ink}`,
                        background:T.ink, display:"flex", flexDirection:"column",
                        alignItems:"center", justifyContent:"center", gap:2 }}>
                        <input
                          autoFocus
                          value={parcelasInput}
                          onChange={e => {
                            const raw = e.target.value.replace(/\D/g,"");
                            setParcelasInput(raw);
                            const n = parseInt(raw);
                            if (n >= 1 && n <= 360) setParcelas(n);
                          }}
                          onBlur={() => {
                            if (!parcelasInput || parseInt(parcelasInput) < 1) {
                              setParcelasCustom(false); setParcelasInput("");
                            }
                          }}
                          onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") { setParcelasCustom(false); } }}
                          placeholder="N"
                          maxLength={3}
                          style={{ ...G, ...NUM, width:"100%", background:"transparent", border:"none",
                            outline:"none", textAlign:"center", fontSize:12, fontWeight:700,
                            color:"#fff" }} />
                        <div style={{ ...G, ...NUM, fontSize:10, color:"rgba(255,255,255,0.55)" }}>
                          {parcelasInput && valorNum > 0
                            ? (valorNum/parseInt(parcelasInput||1)).toFixed(2)
                            : "R$/parc"}
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setParcelasCustom(true); setParcelasInput(""); }}
                        style={{ padding:"8px 4px", borderRadius:8,
                          border:`1.5px solid ${!parcs.includes(parcelas)?T.ink:T.border}`,
                          background:!parcs.includes(parcelas)?T.ink:T.surface,
                          cursor:"pointer", textAlign:"center" }}>
                        <div style={{ ...G, fontSize:11, fontWeight:700,
                          color:!parcs.includes(parcelas)?"#fff":T.inkMid }}>
                          {!parcs.includes(parcelas) ? `${parcelas}×` : "outro"}
                        </div>
                        {!parcs.includes(parcelas) && valorNum > 0 && (
                          <div style={{ ...G, ...NUM, fontSize:10, color:"rgba(255,255,255,0.55)", marginTop:2 }}>
                            {(valorNum/parcelas).toFixed(2)}
                          </div>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
              <ParcelaHybrid parcelas={parcelas} valorNum={valorNum} T={T} G={G} NUM={NUM}/>
            </div>
          </div>
        )}
        <div style={{ width:400, background:T.surface, borderLeft:`1px solid ${T.border}`, display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden" }}>
          <div style={{ display:"flex", flexShrink:0, borderBottom:`1px solid ${T.border}` }}>
            {[["despesa","↑ Despesa"],["receita","↓ Receita"]].map(([t,label]) => (
              <button key={t} onClick={() => !review && handleSetTipo(t)} style={{ ...G, flex:1, padding:"15px 16px", border:"none", cursor:review?"default":"pointer", fontSize:13, fontWeight:600, background:tipo===t ? T.surface : T.bg, color:tipo===t ? (t==="despesa" ? T.red : T.green) : T.inkMid, borderBottom:tipo===t ? `2px solid ${t==="despesa" ? T.red : T.green}` : "2px solid transparent", transition:"all 0.12s" }}>
                {label}
              </button>
            ))}
            <button onClick={onClose} style={{ background:"none", border:"none", borderBottom:"2px solid transparent", padding:"0 16px", cursor:"pointer", flexShrink:0 }}>
              <X size={16} color={T.inkLight} />
            </button>
          </div>
          <div style={{ flex:1, overflowY:"auto", overflowX:"hidden" }}>
            {review ? <ReviewBody /> : (
              <div style={{ padding:"18px 20px", display:"flex", flexDirection:"column", gap:16, animation:"revSlideBack 0.26s ease-out", minWidth:0, width:"100%" }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                    <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em" }}>Valor</div>
                    <button onClick={() => { setParcelaMode(m=>!m); if(parcelaMode){ setPCalcCents(0); } }}
                      style={{ ...G, fontSize:10, fontWeight:700, color:parcelaMode?T.purple:T.inkMid,
                        background:parcelaMode?T.purpleLight:"none", border:`1px dashed ${parcelaMode?T.purple:T.border}`,
                        borderRadius:7, padding:"3px 9px", cursor:"pointer", display:"flex", alignItems:"center", gap:5,
                        transition:"all 0.15s" }}>
                      ÷ {parcelaMode ? "Cancelar cálculo" : "Calcular por parcela"}
                    </button>
                  </div>
                  {/* Main valor input — banking style */}
                  <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:6 }}>
                    <span style={{ ...G, fontSize:18, fontWeight:700, color:T.inkLight, flexShrink:0 }}>R$</span>
                    <input
                      ref={valorInputRef}
                      value={valor}
                      onChange={() => {}}
                      onKeyDown={handleValorKey}
                      placeholder="0,00"
                      tabIndex={0}
                      style={{ ...G, ...NUM, flex:1, fontSize:38, fontWeight:800,
                        color: centavos===0 ? T.inkGhost : T.ink,
                        border:"none", outline:"none", background:"transparent",
                        letterSpacing:"-0.02em", caretColor:T.ink, cursor:"text",
                        minWidth:0 }} />
                  </div>
                  {method === "credito" && modalidade === "parcelado" && parcelas > 1 && valorNum > 0 && (
                    <div style={{ display:"flex", alignItems:"baseline", gap:5, marginTop:4 }}>
                      <span style={{ ...G, fontSize:11, color:T.inkGhost, fontWeight:400 }}>em</span>
                      <span style={{ ...G, ...NUM, fontSize:13, fontWeight:700, color:T.inkMid }}>{parcelas}×</span>
                      <span style={{ ...G, ...NUM, fontSize:13, fontWeight:600, color:T.blue, opacity:.8 }}>
                        R$ {(valorNum/parcelas).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}
                      </span>
                    </div>
                  )}
                  {/* Parcela calculator */}
                  {parcelaMode && (
                    <div style={{ background:T.purpleLight, border:`1px solid ${T.purple}22`,
                      borderRadius:10, padding:"12px 14px", marginBottom:8,
                      animation:"successPop 0.18s ease-out",
                      display:"flex", flexDirection:"column", gap:10 }}>
                      <div style={{ ...G, fontSize:10, fontWeight:700, color:T.purple,
                        textTransform:"uppercase", letterSpacing:"0.09em" }}>
                        Calculadora de parcela
                      </div>
                      {/* Row: parcela input × N selector */}
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ display:"flex", alignItems:"baseline", gap:5, flex:"0 0 auto" }}>
                          <span style={{ ...G, fontSize:13, fontWeight:700, color:T.purple, flexShrink:0 }}>R$</span>
                          <input
                            value={pCalcCents===0 ? "" : (pCalcCents/100).toLocaleString("pt-BR",{minimumFractionDigits:2})}
                            onChange={() => {}}
                            onKeyDown={handlePCalcKey}
                            placeholder="0,00"
                            tabIndex={0}
                            autoFocus
                            style={{ ...G, ...NUM, width:100, fontSize:22, fontWeight:800, color:T.purple,
                              border:"none", outline:"none", background:"transparent",
                              letterSpacing:"-0.01em", cursor:"text", caretColor:T.purple }} />
                        </div>
                        <span style={{ ...G, fontSize:15, fontWeight:700, color:T.inkMid, flexShrink:0 }}>×</span>
                        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                          {[2,3,4,6,8,10,12].map(n => (
                            <button key={n} onClick={()=>{setPCalcN(n);setPCalcCustom(false);}}
                              style={{ ...G, ...NUM, width:32, height:32, borderRadius:8,
                                border:`1.5px solid ${pCalcN===n&&!pCalcCustom?T.purple:T.border}`,
                                background:pCalcN===n&&!pCalcCustom?T.purple:T.surface,
                                color:pCalcN===n&&!pCalcCustom?"#fff":T.inkMid,
                                fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.12s" }}>
                              {n}×
                            </button>
                          ))}
                          {pCalcCustom ? (
                            <input
                              autoFocus
                              value={pCalcCustomInput}
                              onChange={e => {
                                const raw = e.target.value.replace(/[^0-9]/g, "");
                                setPCalcCustomInput(raw);
                                const n = parseInt(raw);
                                if (n >= 1 && n <= 360) setPCalcN(n);
                              }}
                              onBlur={() => {
                                if (!pCalcCustomInput || parseInt(pCalcCustomInput) < 1) {
                                  setPCalcCustom(false);
                                  setPCalcCustomInput("");
                                  setPCalcN(2);
                                }
                              }}
                              onKeyDown={e => {
                                if (e.key === "Enter") e.target.blur();
                                if (e.key === "Escape") { setPCalcCustom(false); setPCalcCustomInput(""); setPCalcN(2); }
                              }}
                              placeholder="ex: 18"
                              maxLength={3}
                              style={{ ...G, ...NUM, width:64, height:32, borderRadius:8, textAlign:"center",
                                border:`1.5px solid ${T.purple}`, outline:"none", fontSize:13, fontWeight:700,
                                color:T.purple, background:T.purpleLight }} />
                          ) : (
                            <button onClick={() => { setPCalcCustom(true); setPCalcCustomInput(""); }}
                              style={{ ...G, width:46, height:32, borderRadius:8,
                                border:`1.5px solid ${T.border}`, background:T.surface,
                                color:T.inkMid, fontSize:11, fontWeight:600, cursor:"pointer" }}>
                              +…
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Result row + confirm */}
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                        paddingTop:8, borderTop:`1px solid ${T.purple}22` }}>
                        <div>
                          {pCalcCents > 0 ? (
                            <div style={{ ...G, fontSize:13, color:T.inkMid }}>
                              Total: <strong style={{ color:T.ink, ...NUM, fontSize:14 }}>
                                R${((pCalcCents*pCalcN)/100).toLocaleString("pt-BR",{minimumFractionDigits:2})}
                              </strong>
                            </div>
                          ) : (
                            <div style={{ ...G, fontSize:11, color:T.inkLight }}>
                              Digite o valor de cada parcela
                            </div>
                          )}
                        </div>
                        <button onClick={applyParcelaCalc} disabled={pCalcCents===0}
                          style={{ ...G, fontSize:12, fontWeight:700,
                            color:"#fff",
                            background: pCalcCents>0 ? T.purple : T.inkGhost,
                            border:"none", borderRadius:8, padding:"8px 16px",
                            cursor: pCalcCents>0 ? "pointer" : "not-allowed",
                            transition:"all 0.15s", flexShrink:0 }}>
                          Usar este valor →
                        </button>
                      </div>
                    </div>
                  )}
                  <div style={{ ...G, fontSize:11, color:T.inkLight, marginTop:4 }}>
                    Saldo: <span style={{ color:T.blue, fontWeight:600 }}>R$ 3.160,00</span>
                  </div>
                </div>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:8 }}>
                    <span style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em" }}>Descrição</span>
                    <span style={{ ...G, fontSize:10, fontWeight:600, color:T.purple, background:T.purpleLight, padding:"1px 7px", borderRadius:99, display:"flex", alignItems:"center", gap:3 }}>
                      <Star size={8} fill={T.purple} /> IA
                    </span>
                  </div>
                  <div style={{ position:"relative" }}>
                    <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3}
                      onFocus={() => setDescFocused(true)}
                      onBlur={() => setDescFocused(false)}
                      style={{ ...G, width:"100%", boxSizing:"border-box", padding:"10px 12px 30px", borderRadius:10, border:`1px solid ${T.border}`, fontSize:13, color:T.ink, resize:"none", outline:"none", background:T.surface, lineHeight:1.5 }} />
                    <button style={{ ...G, position:"absolute", bottom:8, right:8, display:"flex", alignItems:"center", gap:4, background:T.purpleLight, border:`1px solid ${T.purple}33`, borderRadius:7, padding:"4px 9px", fontSize:10, fontWeight:600, color:T.purple, cursor:"pointer" }}>
                      <Star size={9} fill={T.purple} /> Sugerir com IA
                    </button>
                  </div>
                  {desc && (
                    <div style={{ background:T.purpleLight, border:`1px solid ${T.purple}22`, borderRadius:9, padding:"9px 12px", marginTop:8 }}>
                      <span style={{ ...G, fontSize:11, color:T.inkMid }}>
                        IA identificou: categoria <strong style={{ color:T.purple }}>Alimentação</strong> com tags <strong style={{ color:T.green }}>mercado</strong> e <strong style={{ color:T.green }}>compras</strong> — aplicados automaticamente.
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div>
                    <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>Categoria</div>
                    <div style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 12px", border:`1.5px solid ${T.blue}`, borderRadius:9, background:"#EFF6FF", cursor:"pointer" }}>
                      <span style={{ fontSize:14 }}>🛒</span>
                      <span style={{ ...G, fontSize:12, fontWeight:600, color:T.ink }}>{cat}</span>
                      <ChevronDown size={11} color={T.inkLight} style={{ marginLeft:"auto" }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>Data</div>
                    <div style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 12px", border:`1px solid ${T.border}`, borderRadius:9, background:T.surface, cursor:"pointer" }}>
                      <Calendar size={12} color={T.inkLight} />
                      <span style={{ ...G, fontSize:12, color:T.ink }}>08/03/2026</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>Tags</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
                    {tags.map(tag => (
                      <span key={tag} onClick={() => setTags(tg => tg.filter(t => t !== tag))}
                        style={{ ...G, fontSize:11, fontWeight:600, color:"#fff", background:T.purple, padding:"4px 9px", borderRadius:9999, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                        + {tag} <span style={{ opacity:0.7, fontSize:10 }}>✕</span>
                      </span>
                    ))}
                    {["semanal","família"].filter(t => !tags.includes(t)).map(t => (
                      <span key={t} onClick={() => setTags(tg => [...tg, t])} style={{ ...G, fontSize:11, color:T.inkMid, background:T.grayLight, padding:"4px 9px", borderRadius:9999, cursor:"pointer" }}>{t}</span>
                    ))}
                    {addingTag ? (
                      <input autoFocus value={newTag} onChange={e => setNewTag(e.target.value)}
                        onKeyDown={e => { if(e.key==="Enter"&&newTag.trim()){setTags(tg=>[...tg,newTag.trim()]);setNewTag("");setAddingTag(false);} if(e.key==="Escape"){setNewTag("");setAddingTag(false);} }}
                        onBlur={() => { if(newTag.trim())setTags(tg=>[...tg,newTag.trim()]); setNewTag(""); setAddingTag(false); }}
                        style={{ ...G, fontSize:11, color:T.blue, border:`1px dashed ${T.blue}`, padding:"3px 9px", borderRadius:9999, outline:"none", width:80, background:"transparent" }} />
                    ) : (
                      <span onClick={() => setAddingTag(true)} style={{ ...G, fontSize:11, color:T.blue, border:`1px dashed ${T.blue}`, padding:"3px 9px", borderRadius:9999, cursor:"pointer" }}>+ nova</span>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:8 }}>Forma de Pagamento</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {methodsList.map(([id, label]) => (
                      <button key={id} onClick={() => { setMethod(id); if(id !== "credito") setPanel(null); else setPanel(p => p==="cartao" ? null : "cartao"); }}
                        style={{ ...G, display:"flex", alignItems:"center", gap:5, padding:"7px 12px", borderRadius:9, border:`1.5px solid ${method===id ? T.ink : T.border}`, background:method===id ? T.ink : T.surface, color:method===id ? "#fff" : T.inkMid, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                        {id === "credito" && <CreditCard size={11} />} {label}
                        {id === "credito" && method==="credito" && <span style={{ width:5, height:5, background:panel==="cartao" ? T.green : T.purple, borderRadius:9999 }} />}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", background:T.bg, borderRadius:10, border:`1px solid ${recorre ? T.blue : T.border}`, cursor:"pointer", transition:"border-color 0.15s" }}
                  onClick={() => { setRecorre(r => { if (!r) setMod("avista"); return !r; }); setPanel(p => !recorre ? "recorrencia" : (method==="credito" ? "cartao" : null)); }}>
                  <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                    <Repeat size={14} color={recorre ? T.blue : T.inkLight} />
                    <div>
                      <div style={{ ...G, fontSize:12, fontWeight:600, color:T.ink }}>Transação recorrente</div>
                      <div style={{ ...G, fontSize:10, color:T.inkLight }}>Repetir automaticamente</div>
                    </div>
                  </div>
                  <div style={{ width:38, height:22, borderRadius:11, background:recorre ? T.blue : T.inkGhost, position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                    <div style={{ position:"absolute", top:3, left:recorre?18:3, width:16, height:16, borderRadius:9999, background:"#fff", transition:"left 0.2s", boxShadow:T.sm }} />
                  </div>
                </div>
                {!novaRecorrencia && (
                  <div style={{ border:`1px solid ${T.border}`, borderRadius:12 }}>
                    <div onClick={() => setShowImpact(s => !s)}
                      style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", cursor:"pointer", userSelect:"none", borderRadius:12, transition:"background 0.12s" }}
                      onMouseEnter={e => e.currentTarget.style.background = T.bg}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                        <Zap size={14} color={T.amber} fill={T.amber} />
                        <span style={{ ...G, fontSize:13, fontWeight:700, color:T.ink }}>Impacto financeiro</span>
                      </div>
                      <span style={{ ...G, display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600, color:T.blue }}>
                        {showImpact ? "Recolher" : "Ver detalhes"} {showImpact ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </span>
                    </div>
                    {showImpact && (
                      <div style={{ padding:"0 16px 16px", borderTop:`1px solid ${T.border}` }}>
                        <div style={{ height:90, margin:"0 -4px 12px" }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={rhythmData.slice(0,25)} margin={{ top:8, right:4, left:-30, bottom:0 }}>
                              <YAxis hide /><XAxis dataKey="day" hide /><Tooltip hide />
                              <ReferenceLine x={TODAY_RIT} stroke={T.inkGhost} strokeWidth={1} />
                              <Line dataKey="real" type="monotone" stroke={T.ink} strokeWidth={2} dot={false} connectNulls={false} />
                              <Line dataKey="proj" type="monotone" stroke={T.inkGhost} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14 }}>
                          {[
                            { label:"APÓS LANÇAMENTO",  val:"R$ 5.240", sub:"62% do orçamento", color:T.red },
                            { label:"PROJEÇÃO FIM MÊS", val:"R$ 7.077", sub:"84% do orçamento", color:T.red },
                            { label:"MARGEM RESTANTE",  val:"R$ 1.323", sub:"até o limite",      color:T.ink },
                          ].map((k,i) => (
                            <div key={i}>
                              <div style={{ ...G, fontSize:8, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>{k.label}</div>
                              <div style={{ ...G, ...NUM, fontSize:14, fontWeight:800, color:k.color }}>{k.val}</div>
                              <div style={{ ...G, fontSize:10, color:T.inkMid, marginTop:2 }}>{k.sub}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:14 }}>🛒</span>
                          <span style={{ ...G, fontSize:12, fontWeight:600, color:T.ink }}>Alimentação</span>
                          <div style={{ flex:1 }}><ProgBar pct={71} color={T.greenBar} h={4} /></div>
                          <div style={{ textAlign:"right" }}>
                            <span style={{ ...G, ...NUM, fontSize:11, color:T.inkLight }}>R$ 858 → </span>
                            <span style={{ ...G, ...NUM, fontSize:11, fontWeight:700, color:T.red }}>R$ 1.046</span>
                            <div style={{ ...G, fontSize:10, color:T.inkMid }}>limite R$ 1.200</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ flexShrink:0, padding:"14px 20px", borderTop:`1px solid ${T.border}`, background:T.surface }}>
            {review ? (
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={goBack}
                  style={{ ...G, display:"flex", alignItems:"center", gap:6, padding:"11px 16px", borderRadius:10, border:`1px solid ${T.border}`, background:T.surface, fontSize:13, fontWeight:600, color:T.inkMid, cursor:"pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = T.bg}
                  onMouseLeave={e => e.currentTarget.style.background = T.surface}>
                  <ChevronLeft size={14} /> Editar
                </button>
                <button onClick={handleSave}
                  style={{ ...G, flex:1, padding:"11px", borderRadius:10, border:"none", background:success ? T.green : typeColor, fontSize:13, fontWeight:700, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6, transition:"background 0.25s", animation:success?"successPop 0.35s ease-out":"none" }}>
                  {success
                    ? <><Check size={14} /> {novaRecorrencia || recorre ? "Recorrência salva!" : "Registrado!"}</>
                    : novaRecorrencia || recorre ? "Confirmar recorrência" : `Confirmar ${tipo === "despesa" ? "despesa" : "receita"}`
                  }
                </button>
              </div>
            ) : (
              <div style={{ display:"flex", gap:8 }}>
                <Btn variant="outGray" onClick={onClose}>Cancelar</Btn>
                {novaRecorrencia || recorre ? (
                  <button onClick={goReview}
                    style={{ ...G, flex:1, padding:"11px", borderRadius:10, border:"none", background:typeColor, fontSize:13, fontWeight:700, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                    Revisar recorrência <ChevronRight size={14} />
                  </button>
                ) : (
                  <button onClick={handleSave}
                    style={{ ...G, flex:1, padding:"11px", borderRadius:10, border:"none", background:success ? T.green : typeColor, fontSize:13, fontWeight:700, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6, transition:"background 0.2s" }}>
                    {success ? <><Check size={14} /> Registrado!</> : `Registrar ${tipo==="despesa" ? "Despesa" : "Receita"}`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

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

const MetasPage = ({ onNav, isMobile = false, onContribuir, autoOpenModal = false, dataMode = "mock", initialMetas }) => {
  const [metas,       setMetas]       = useState(initialMetas !== undefined ? initialMetas : METAS_INIT);
  const [drawer,      setDrawer]      = useState(autoOpenModal);
  const [success,     setSuccess]     = useState(false);
  const [tooltipMeta, setTooltipMeta] = useState(null);
  const [editingMeta, setEditingMeta] = useState(null);

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

  const totalMeta  = metas.reduce((s, m) => s + m.meta,  0);
  const totalAtual = metas.reduce((s, m) => s + m.atual, 0);

  // Empty state when no metas defined yet
  if (metas.length === 0 && !drawer) return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
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

  const handleSave = () => {
    const mN = parseFloat(fMeta.replace(",",".")) || 0;
    if (!fNome || mN === 0) return;
    const corLight = CORES.find(c => c.hex === fCor)?.light || "#EFF6FF";
    setMetas(ms => [...ms, {
      id: fNome.toLowerCase().replace(/\s+/g,"-")+"-"+Date.now(),
      nome:fNome, desc:fDesc, emoji:fEmoji, meta:mN,
      atual: parseFloat(fAtual.replace(",",".")) || 0,
      mensal: parseFloat(fMensal.replace(",",".")) || 0,
      prazo: fPrazo || "Sem prazo", prioridade:fPrio, cor:fCor, corLight,
    }]);
    setSuccess(true);
    setTimeout(() => { setSuccess(false); setDrawer(false); setEditingMeta(null); resetDrawer(); }, 1100);
  };

  const handleEdit = () => {
    if (!editingMeta || !fNome || !fMeta) return;
    const corLight = CORES.find(c => c.hex === fCor)?.light || "#EFF6FF";
    setMetas(ms => ms.map(m => m.id === editingMeta.id ? {
      ...m, nome:fNome, desc:fDesc, emoji:fEmoji,
      meta: parseFloat(fMeta.replace(",",".")) || 0,
      atual: parseFloat(fAtual.replace(",",".")) || 0,
      mensal: parseFloat(fMensal.replace(",",".")) || 0,
      prazo: fPrazo || "Sem prazo", prioridade:fPrio, cor:fCor, corLight,
    } : m));
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
      <div className="finly-card-lift" style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:"20px", display:"flex", flexDirection:"column", gap:14, transition:"box-shadow 0.15s, transform 0.15s" }}
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
              <button onClick={handleSave} disabled={!fNome||!fMeta} style={{ fontFamily:"'Geist',sans-serif", flex:1, padding:"11px", borderRadius:10, border:"none", background:success?T.green:(!fNome||!fMeta)?T.inkGhost:T.ink, fontSize:13, fontWeight:700, color:"#fff", cursor:(!fNome||!fMeta)?"not-allowed":"pointer" }}>
                {success ? "✓ Meta criada!" : "Criar meta"}
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
              <button onClick={handleSave} disabled={!fNome||!fMeta} style={{ fontFamily:"'Geist',sans-serif", flex:1, padding:"11px", borderRadius:10, border:"none", background:success?T.green:(!fNome||!fMeta)?T.inkGhost:T.ink, fontSize:13, fontWeight:700, color:"#fff", cursor:(!fNome||!fMeta)?"not-allowed":"pointer" }}>
                {success ? "✓ Meta criada!" : "Criar meta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
  return (
    <>
    <style>{`@keyframes  @keyframes metaFadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

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
              <button onClick={editingMeta ? handleEdit : handleSave} disabled={!fNome||!fMeta}
                style={{ ...G, width:"100%", padding:"14px", borderRadius:12, border:"none",
                  background:success?T.green:(!fNome||!fMeta)?T.inkGhost:editingMeta?T.blue:T.ink,
                  fontSize:14, fontWeight:700, color:"#fff", cursor:(!fNome||!fMeta)?"not-allowed":"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:7, transition:"background 0.2s" }}>
                {success ? <><Check size={15} /> {editingMeta?"Salvo!":"Meta criada!"}</> : editingMeta?"Salvar alterações":"Criar meta →"}
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
              <button onClick={editingMeta ? handleEdit : handleSave} disabled={!fNome||!fMeta}
                style={{ ...G, flex:1, padding:"11px", borderRadius:10, border:"none",
                  background:success?T.green:(!fNome||!fMeta)?T.inkGhost:editingMeta?T.blue:T.ink,
                  fontSize:13, fontWeight:700, color:"#fff", cursor:(!fNome||!fMeta)?"not-allowed":"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:6, transition:"background 0.2s" }}>
                {success ? <><Check size={14} /> {editingMeta?"Salvo!":"Meta criada!"}</> : editingMeta?"Salvar alterações":"Criar meta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    )}
    </>
  );
};


/* ─── RELATÓRIOS DATA — 12 meses ────────────────────────── */
const REL_MONTHLY = [
  { mes:"Abr'25", receita:7800, gasto:6200, budget:6000, score:72, fixo:3100, disc:3100 },
  { mes:"Mai'25", receita:7900, gasto:5800, budget:6000, score:79, fixo:3100, disc:2700 },
  { mes:"Jun'25", receita:8000, gasto:6800, budget:6000, score:61, fixo:3100, disc:3700 },
  { mes:"Jul'25", receita:8100, gasto:5600, budget:6000, score:83, fixo:3100, disc:2500 },
  { mes:"Ago'25", receita:8100, gasto:6100, budget:6000, score:76, fixo:3200, disc:2900 },
  { mes:"Set'25", receita:8200, gasto:5900, budget:6000, score:81, fixo:3200, disc:2700 },
  { mes:"Out'25", receita:8100, gasto:5100, budget:6000, score:85, fixo:3200, disc:1900 },
  { mes:"Nov'25", receita:8100, gasto:6300, budget:6000, score:68, fixo:3200, disc:3100 },
  { mes:"Dez'25", receita:9400, gasto:7200, budget:6200, score:55, fixo:3200, disc:4000 },
  { mes:"Jan'26", receita:8400, gasto:5800, budget:6500, score:89, fixo:3300, disc:2500 },
  { mes:"Fev'26", receita:8400, gasto:5400, budget:6500, score:92, fixo:3300, disc:2100 },
  { mes:"Mar'26", receita:8600, gasto:4381, budget:6500, score:96, fixo:3300, disc:1081, current:true },
];

const REL_DAILY = Array.from({ length: 13 }, (_, i) => {
  const d = i + 1;
  const ideal = Math.round(6500 / 31 * d);
  const real  = d <= 5  ? Math.round(ideal * 1.35) :
                d <= 10 ? Math.round(ideal * 1.18) : Math.round(ideal * 1.05);
  return { dia: `D${d}`, ideal, real };
});

const REL_DRIFT = [
  { mes:"Abr'25", Moradia:1500, "Alimentação":1100, Transporte:620, "Saúde":400, Lazer:900, Outros:1680 },
  { mes:"Mai'25", Moradia:1500, "Alimentação":980,  Transporte:520, "Saúde":350, Lazer:680, Outros:1770 },
  { mes:"Jun'25", Moradia:1500, "Alimentação":1180, Transporte:480, "Saúde":280, Lazer:1100, Outros:2260 },
  { mes:"Jul'25", Moradia:1500, "Alimentação":960,  Transporte:540, "Saúde":310, Lazer:620, Outros:1670 },
  { mes:"Ago'25", Moradia:1500, "Alimentação":1020, Transporte:510, "Saúde":290, Lazer:780, Outros:2000 },
  { mes:"Set'25", Moradia:1500, "Alimentação":990,  Transporte:490, "Saúde":320, Lazer:720, Outros:1880 },
  { mes:"Out'25", Moradia:1500, "Alimentação":980,  Transporte:520, "Saúde":350, Lazer:680, Outros:1070 },
  { mes:"Nov'25", Moradia:1500, "Alimentação":1120, Transporte:480, "Saúde":200, Lazer:1200, Outros:1800 },
  { mes:"Dez'25", Moradia:1500, "Alimentação":1380, Transporte:420, "Saúde":180, Lazer:1600, Outros:2120 },
  { mes:"Jan'26", Moradia:1500, "Alimentação":1050, Transporte:580, "Saúde":310, Lazer:740, Outros:1620 },
  { mes:"Fev'26", Moradia:1500, "Alimentação":970,  Transporte:540, "Saúde":280, Lazer:620, Outros:1490 },
  { mes:"Mar'26", Moradia:1500, "Alimentação":1046, Transporte:320, "Saúde":180, Lazer:388, Outros:947  },
];

const REL_COMPOSICAO = [
  { name:"Fixo / recorrente", value:3300, color:"#0F0F0D" },
  { name:"Alimentação",       value:1046, color:"#2563EB" },
  { name:"Lazer",             value:388,  color:"#7C3AED" },
  { name:"Transporte",        value:320,  color:"#D97706" },
  { name:"Saúde",             value:180,  color:"#059669" },
  { name:"Outros",            value:947,  color:"#9CA3AF" },
];

const REL_WATERFALL = [
  { nome:"Receita",      val:8600,  tipo:"receita" },
  { nome:"Moradia",      val:-1500, tipo:"despesa" },
  { nome:"Alimentação",  val:-1046, tipo:"despesa" },
  { nome:"Transporte",   val:-320,  tipo:"despesa" },
  { nome:"Saúde",        val:-180,  tipo:"despesa" },
  { nome:"Lazer",        val:-388,  tipo:"despesa" },
  { nome:"Recorrências", val:-867,  tipo:"despesa" },
  { nome:"Saldo",        val:2299,  tipo:"saldo"   },
];

const DRIFT_COLORS = {
  Moradia:"#0F0F0D", "Alimentação":"#2563EB", Transporte:"#D97706",
  "Saúde":"#059669", Lazer:"#7C3AED", Outros:"#9CA3AF"
};

/* ─── RELATÓRIOS PAGE ────────────────────────────────────── */
const RelatoriosPage = ({ onNav, isMobile = false, extraRecs = [], dataMode = "mock" }) => {
  const [periodo,     setPeriodo]     = useState("6m");
  const [relTab,      setRelTab]      = useState("resumo");
  const [selectedCat, setSelectedCat] = useState(null);
  const [activeIdx,   setActive]      = useState(null);
  const [scoreDetail, setScoreDetail] = useState(null);

  const PERIODO_N = { "3m":3, "6m":6, "12m":12 };
  const rec0 = extraRecs && extraRecs[0];
  if (dataMode === "empty") {
    const fmtR = v => "R$ " + Math.abs(v).toLocaleString("pt-BR",{minimumFractionDigits:2});
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
        <PageTitle sans="Relatórios &" serif="Análises"/>
        {rec0 ? (
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:"28px 28px" }}>
            <div style={{ ...G, fontSize:11, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:16 }}>Projeção mensal — baseada na receita registrada</div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)", gap:12, marginBottom:20 }}>
              {[
                { label:"Receita projetada", val:fmtR(rec0.val), color:T.green, sub:`Todo dia ${rec0.dia} · ${rec0.valorTipo==="estimado"?"≈ estimado":"valor fixo"}` },
                { label:"Despesas",          val:"R$ 0,00",       color:T.inkLight, sub:"Nenhuma registrada" },
                { label:"Saldo projetado",   val:fmtR(rec0.val), color:T.green,   sub:"Sem despesas lançadas" },
              ].map((k,i)=>(
                <div key={i} style={{ background:T.bg, borderRadius:12, padding:"14px 16px" }}>
                  <div style={{ ...G, fontSize:11, color:T.inkLight, marginBottom:6 }}>{k.label}</div>
                  <div style={{ ...G, ...NUM, fontSize:22, fontWeight:800, color:k.color }}>{k.val}</div>
                  <div style={{ ...G, fontSize:11, color:T.inkLight, marginTop:4 }}>{k.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ ...G, fontSize:13, color:T.inkMid, lineHeight:1.7, paddingTop:16, borderTop:`1px solid ${T.border}` }}>
              Os gráficos e análises completas aparecem após as primeiras transações. Registre uma despesa para começar.
            </div>
            <button onClick={()=>onNav("_nova_transacao")}
              style={{ ...G, marginTop:14, background:T.ink, color:"#fff", border:"none", borderRadius:11, padding:"10px 20px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              + Registrar primeira transação
            </button>
          </div>
        ) : (
          <EmptyState icon="📈" title="Sem dados para exibir"
            sub="Os relatórios aparecem após as primeiras transações. Registre uma para começar."
            cta="+ Nova transação" onCta={()=>onNav("_nova_transacao")} />
        )}
      </div>
    );
  }
  const activeData  = useMemo(() => REL_MONTHLY.slice(-PERIODO_N[periodo]), [periodo]);
  const activeDrift = useMemo(() => REL_DRIFT.slice(-PERIODO_N[periodo]),   [periodo]);

  const kpis = useMemo(() => {
    const totalR   = activeData.reduce((s,m) => s+m.receita, 0);
    const totalG   = activeData.reduce((s,m) => s+m.gasto,   0);
    const saldo    = totalR - totalG;
    const taxa     = Math.round(saldo / totalR * 100);
    const avgScore = Math.round(activeData.reduce((s,m) => s+m.score,0) / activeData.length);
    const last     = activeData[activeData.length-1];
    const prev     = activeData[activeData.length-2];
    const tendR    = prev ? Math.round((last.receita-prev.receita)/prev.receita*100) : 0;
    const tendG    = prev ? Math.round((last.gasto-prev.gasto)/prev.gasto*100) : 0;
    const bestScore  = Math.max(...activeData.map(m=>m.score));
    const worstScore = Math.min(...activeData.map(m=>m.score));
    return { totalR, totalG, saldo, taxa, avgScore, last, prev, tendR, tendG, bestScore, worstScore };
  }, [activeData]);

  const totalComp = REL_COMPOSICAO.reduce((s,c) => s+c.value, 0);
  const fmtBRL = (v) => "R$\u00a0" + Math.abs(v).toLocaleString("pt-BR",{minimumFractionDigits:0});
  const fmtK   = (v) => Math.abs(v)>=1000 ? (Math.abs(v)/1000).toFixed(1)+"k" : String(Math.abs(v));

  /* ── Reusable UI atoms ───────────────────────────────────── */
  const CustomTip = ({ active, payload, label, fmt=fmtBRL }) => {
    if (!active||!payload?.length) return null;
    return (
      <div style={{ ...G, background:T.ink, borderRadius:10, padding:"8px 12px", boxShadow:T.dark }}>
        <div style={{ fontSize:10, color:"rgba(255,255,255,0.55)", marginBottom:5 }}>{label}</div>
        {payload.map((p,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:i<payload.length-1?3:0 }}>
            <div style={{ width:6, height:6, borderRadius:2, background:p.color||p.stroke, flexShrink:0 }} />
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.7)" }}>{p.name||p.dataKey}</span>
            <span style={{ fontSize:11, fontWeight:700, color:"#fff", marginLeft:"auto", fontVariantNumeric:"tabular-nums" }}>{fmt(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  const PeriodSelector = ({ compact=false }) => (
    <div style={{ display:"flex", background:T.grayLight, borderRadius:10, padding:3, gap:2, flexShrink:0 }}>
      {["3m","6m","12m"].map(p => (
        <button key={p} onClick={() => { setPeriodo(p); setScoreDetail(null); }}
          style={{ ...G, padding:compact?"5px 11px":"6px 14px", borderRadius:7, border:"none",
            background:periodo===p ? T.surface : "transparent",
            color:periodo===p ? T.ink : T.inkMid,
            fontSize:12, fontWeight:700, cursor:"pointer",
            boxShadow:periodo===p ? T.sm : "none", transition:"all 0.15s" }}>
          {p}
        </button>
      ))}
    </div>
  );

  const InsightChip = ({ color=T.blue, icon, text }) => (
    <div style={{ display:"flex", alignItems:"flex-start", gap:8,
      background:color+"18", border:`1px solid ${color}28`, borderRadius:10, padding:"9px 12px" }}>
      <span style={{ fontSize:14, flexShrink:0, marginTop:1 }}>{icon}</span>
      <span style={{ ...G, fontSize:11, color:T.ink, lineHeight:1.6 }}
        dangerouslySetInnerHTML={{ __html:text }} />
    </div>
  );

  const Section = ({ title, serifWord, insight, children }) => (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, overflow:"hidden" }}>
      <div style={{ padding:"16px 20px 14px", borderBottom:`1px solid ${T.border}`, background:T.bg }}>
        <div style={{ ...G, fontSize:15, fontWeight:800, color:T.ink, marginBottom:insight?10:0 }}>
          {title} <span style={{ ...S, fontWeight:400, fontSize:15 }}>{serifWord}</span>
        </div>
        {insight && <InsightChip {...insight} />}
      </div>
      <div style={{ padding:"16px 20px" }}>{children}</div>
    </div>
  );

  /* ── Charts (data-driven, shared mobile+desktop) ─────────── */
  const ReceitaGastoChart = ({ height=200 }) => (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={activeData} margin={{ top:4, right:4, left:-22, bottom:0 }} barGap={2} barCategoryGap="32%">
        <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
        <XAxis dataKey="mes" tick={{ ...G, fontSize:10, fill:T.inkLight }} axisLine={false} tickLine={false} />
        <YAxis tick={{ ...G, fontSize:10, fill:T.inkLight }} axisLine={false} tickLine={false} tickFormatter={v=>fmtK(v)} />
        <Tooltip content={<CustomTip />} />
        <Bar dataKey="receita" name="Receita" fill={T.green} fillOpacity={0.85} radius={[3,3,0,0]} maxBarSize={22} />
        <Bar dataKey="gasto"   name="Gasto"   fill={T.red}   fillOpacity={0.85} radius={[3,3,0,0]} maxBarSize={22} />
      </ReBarChart>
    </ResponsiveContainer>
  );

  const WaterfallChart = ({ compact=false }) => {
    let running = 0;
    const data = REL_WATERFALL.map(item => {
      const base   = item.tipo==="receita" ? 0 : running+item.val;
      const height = Math.abs(item.val);
      if (item.tipo!=="saldo") running += item.val;
      return { ...item, base, height };
    });
    const maxVal=8600, chartH=compact?110:155, barW=compact?28:44, gap=compact?9:16;
    const totalW = data.length*(barW+gap);
    return (
      <svg width="100%" viewBox={`0 0 ${totalW+20} ${chartH+32}`} style={{ overflow:"visible" }}>
        {data.map((d,i) => {
          const x=i*(barW+gap)+10;
          const barH=Math.max(2, Math.round(d.height/maxVal*chartH));
          const y=chartH-Math.round((d.base+d.height)/maxVal*chartH);
          const color=d.tipo==="receita"?T.green:d.tipo==="saldo"?T.blue:T.red;
          return (
            <g key={d.nome}>
              <rect x={x} y={y} width={barW} height={barH} rx={3} fill={color} fillOpacity={0.88} />
              {i<data.length-1&&d.tipo!=="saldo"&&(
                <line x1={x+barW} y1={y+(d.tipo==="receita"?0:barH)} x2={x+barW+gap} y2={y+(d.tipo==="receita"?0:barH)}
                  stroke={T.border} strokeWidth={1} strokeDasharray="3 2"/>
              )}
              <text x={x+barW/2} y={y-4} textAnchor="middle" fontSize={compact?7:8} fontWeight={700}
                fill={color} fontFamily="Geist,sans-serif">
                {d.tipo==="receita"?"+":d.tipo==="saldo"?"":"-"}{fmtK(d.val)}
              </text>
              <text x={x+barW/2} y={chartH+13} textAnchor="middle" fontSize={compact?6:8} fill={T.inkMid}
                fontFamily="Geist,sans-serif">{d.nome}</text>
            </g>
          );
        })}
        <line x1={10} y1={chartH} x2={totalW+10} y2={chartH} stroke={T.border} strokeWidth={1}/>
      </svg>
    );
  };

  const VelocidadeChart = ({ height=170 }) => (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={REL_DAILY} margin={{ top:8, right:4, left:-22, bottom:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
        <XAxis dataKey="dia" tick={{ ...G, fontSize:10, fill:T.inkLight }} axisLine={false} tickLine={false} />
        <YAxis tick={{ ...G, fontSize:10, fill:T.inkLight }} axisLine={false} tickLine={false} tickFormatter={v=>fmtK(v)} />
        <Tooltip content={<CustomTip />} />
        <Area dataKey="ideal" name="Ritmo ideal" type="monotone" fill={T.blueLight} stroke={T.blue}
          strokeWidth={1.5} strokeDasharray="5 3" dot={false} fillOpacity={0.35} />
        <Area dataKey="real"  name="Gasto real"  type="monotone" fill={T.red+"20"}  stroke={T.red}
          strokeWidth={2.5} dot={false} fillOpacity={0.45} />
      </ComposedChart>
    </ResponsiveContainer>
  );

  const DriftChart = ({ height=190 }) => (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={activeDrift} margin={{ top:8, right:4, left:-22, bottom:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
        <XAxis dataKey="mes" tick={{ ...G, fontSize:10, fill:T.inkLight }} axisLine={false} tickLine={false} />
        <YAxis tick={{ ...G, fontSize:10, fill:T.inkLight }} axisLine={false} tickLine={false} tickFormatter={v=>fmtK(v)} />
        <Tooltip content={<CustomTip />} />
        {Object.entries(DRIFT_COLORS).map(([cat,color]) => (
          <Area key={cat} type="monotone" dataKey={cat} stackId="1"
            stroke={selectedCat&&selectedCat!==cat ? "transparent" : color}
            fill={selectedCat ? (selectedCat===cat ? color : T.grayLight) : color}
            fillOpacity={selectedCat ? (selectedCat===cat ? 0.88 : 0.18) : 0.72}
            strokeWidth={selectedCat===cat ? 2 : 0} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );

  const ScoreChart = ({ height=155 }) => (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={activeData} margin={{ top:8, right:4, left:-22, bottom:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
        <XAxis dataKey="mes" tick={{ ...G, fontSize:10, fill:T.inkLight }} axisLine={false} tickLine={false} />
        <YAxis domain={[0,100]} tick={{ ...G, fontSize:10, fill:T.inkLight }} axisLine={false} tickLine={false} tickFormatter={v=>v+"%"} />
        <Tooltip content={<CustomTip fmt={v=>v+"%"} />} />
        <ReferenceLine y={80} stroke={T.green} strokeDasharray="4 3" strokeWidth={1.5} />
        <Bar dataKey="score" name="Score" radius={[4,4,0,0]} maxBarSize={32}
          onClick={(d) => setScoreDetail(scoreDetail?.mes===d.mes ? null : d)}>
          {activeData.map((entry,i) => (
            <Cell key={i}
              fill={entry.score>=80?T.green:entry.score>=65?T.amber:T.red}
              fillOpacity={scoreDetail?.mes===entry.mes ? 1 : entry.current ? 1 : 0.6}
              stroke={scoreDetail?.mes===entry.mes ? T.ink : "none"} strokeWidth={2} />
          ))}
        </Bar>
        <Line dataKey="score" name="Tendência" type="monotone" stroke={T.inkGhost}
          strokeWidth={1.5} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );

  const ComposicaoChart = ({ compact=false }) => (
    <div style={{ display:"grid", gridTemplateColumns:compact?"110px 1fr":"150px 1fr", gap:14, alignItems:"center" }}>
      <ResponsiveContainer width={compact?110:150} height={compact?110:150}>
        <PieChart>
          <Pie data={REL_COMPOSICAO} cx={compact?50:70} cy={compact?50:70}
            innerRadius={compact?30:42} outerRadius={compact?48:65}
            paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
            {REL_COMPOSICAO.map((entry,i) => (
              <Cell key={i} fill={entry.color} fillOpacity={activeIdx===i?1:0.72}
                onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display:"flex", flexDirection:"column", gap:compact?4:5 }}>
        {REL_COMPOSICAO.map((c,i) => (
          <div key={i} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
            style={{ display:"flex", alignItems:"center", gap:7, padding:compact?"4px 6px":"5px 8px",
              borderRadius:8, background:activeIdx===i?T.bg:"transparent", transition:"background 0.12s", cursor:"default" }}>
            <div style={{ width:7, height:7, borderRadius:2, background:c.color, flexShrink:0 }} />
            <span style={{ ...G, fontSize:compact?10:11, color:T.inkMid, flex:1 }}>{c.name}</span>
            <span style={{ ...G, ...NUM, fontSize:compact?10:11, fontWeight:700, color:T.ink }}>{fmtBRL(c.value)}</span>
            <span style={{ ...G, fontSize:10, color:T.inkMid, minWidth:26, textAlign:"right" }}>
              {Math.round(c.value/totalComp*100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  const CatLegend = ({ compact=false }) => (
    <div style={{ display:"flex", gap:compact?5:7, flexWrap:"wrap" }}>
      {Object.entries(DRIFT_COLORS).map(([cat,color]) => (
        <button key={cat} onClick={() => setSelectedCat(selectedCat===cat ? null : cat)}
          style={{ display:"flex", alignItems:"center", gap:5, padding:compact?"4px 9px":"5px 11px",
            borderRadius:20, border:`1.5px solid ${selectedCat===cat ? color : T.border}`,
            background:selectedCat===cat ? color+"18" : T.surface,
            cursor:"pointer", transition:"all 0.15s" }}>
          <div style={{ width:7, height:7, borderRadius:2, background:color, flexShrink:0,
            opacity:selectedCat&&selectedCat!==cat ? 0.3 : 1 }} />
          <span style={{ ...G, fontSize:compact?9:10, fontWeight:selectedCat===cat?700:400,
            color:selectedCat===cat ? color : T.inkMid }}>{cat}</span>
        </button>
      ))}
      {selectedCat && (
        <button onClick={() => setSelectedCat(null)}
          style={{ ...G, fontSize:10, color:T.inkMid, background:"none", border:`1px solid ${T.border}`,
            borderRadius:20, padding:"4px 9px", cursor:"pointer" }}>✕ Limpar</button>
      )}
    </div>
  );

  const ScoreDetailCard = () => {
    if (!scoreDetail) return null;
    const saldo = scoreDetail.receita - scoreDetail.gasto;
    const taxa  = Math.round(saldo/scoreDetail.receita*100);
    const sColor = scoreDetail.score>=80?T.green:scoreDetail.score>=65?T.amber:T.red;
    return (
      <div style={{ background:T.bg, border:`1.5px solid ${sColor}40`, borderRadius:12, padding:"14px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink }}>{scoreDetail.mes}</div>
          <button onClick={() => setScoreDetail(null)} style={{ background:"none", border:"none", cursor:"pointer", padding:2 }}>
            <X size={13} color={T.inkLight} />
          </button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {[
            { label:"Score",    val:scoreDetail.score+"/100", color:sColor },
            { label:"Receita",  val:fmtBRL(scoreDetail.receita), color:T.green },
            { label:"Gasto",    val:fmtBRL(scoreDetail.gasto),   color:T.red },
            { label:"Poupança", val:taxa+"%",                     color:T.blue },
          ].map((k,i) => (
            <div key={i}>
              <div style={{ ...G, fontSize:8, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>{k.label}</div>
              <div style={{ ...G, ...NUM, fontSize:13, fontWeight:800, color:k.color }}>{k.val}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const VelocLegend = () => (
    <div style={{ display:"flex", gap:14, marginTop:8 }}>
      {[["─ ─","Ritmo ideal",T.blue],["───","Gasto real",T.red]].map(([dash,label,color]) => (
        <div key={label} style={{ display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ ...G, fontSize:11, color, fontWeight:700 }}>{dash}</span>
          <span style={{ ...G, fontSize:10, color:T.inkLight }}>{label}</span>
        </div>
      ))}
    </div>
  );

  /* ══════════════════════════════════════════════════════════
     MOBILE — Native app layout
  ══════════════════════════════════════════════════════════ */
  const TABS_REL = [
    { id:"resumo",     icon:"📊", label:"Resumo"     },
    { id:"fluxo",      icon:"💸", label:"Fluxo"      },
    { id:"categorias", icon:"📂", label:"Categorias" },
    { id:"score",      icon:"🎯", label:"Score"      },
    { id:"composicao", icon:"🥧", label:"Composição" },
  ];

  if (isMobile) {
    const saldoPositivo = kpis.saldo >= 0;
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:0, paddingBottom:40 }}>
        <style>{`
          @keyframes relIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
          @keyframes relFade { from{opacity:0} to{opacity:1} }
        `}</style>

        {/* ── Dark hero ── */}
        <div style={{ background:T.darkBg, borderRadius:20, padding:"18px 18px 16px", marginBottom:16, position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:-30, right:-30, width:140, height:140, borderRadius:"50%",
            background: saldoPositivo?"rgba(5,150,105,0.12)":"rgba(220,38,38,0.12)", pointerEvents:"none" }} />
          {/* Title row */}
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16 }}>
            <div>
              <div style={{ ...G, fontSize:10, fontWeight:700, color:T.darkMuted, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:2 }}>Meus</div>
              <div style={{ ...S, fontSize:22, fontStyle:"italic", color:"#fff", lineHeight:1.1 }}>Relatórios</div>
            </div>
            <PeriodSelector compact />
          </div>
          {/* Saldo hero */}
          <div style={{ marginBottom:14 }}>
            <div style={{ ...G, fontSize:10, fontWeight:700, color:T.darkMuted, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:4 }}>
              Saldo acumulado · {periodo}
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:6, flexWrap:"wrap" }}>
              <span style={{ ...M_MONO, ...NUM, fontSize:26, fontWeight:800, letterSpacing:"-0.02em",
                color: saldoPositivo ? "#86EFAC" : "#FCA5A5" }}>
                {saldoPositivo?"+":"−"}{fmtBRL(kpis.saldo)}
              </span>
              <span style={{ ...G, fontSize:12, color:T.darkMuted }}>
                {kpis.taxa}% guardado
              </span>
            </div>
          </div>
          {/* Mini KPI row */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", borderTop:"1px solid rgba(255,255,255,0.07)", paddingTop:12 }}>
            {[
              { label:"Receita",    val:fmtBRL(kpis.totalR), color:"#86EFAC" },
              { label:"Gasto",      val:fmtBRL(kpis.totalG), color:"#FCA5A5" },
              { label:"Score médio",val:`${kpis.avgScore}/100`,
                color:kpis.avgScore>=80?"#86EFAC":kpis.avgScore>=65?"#FCD34D":"#FCA5A5" },
            ].map((k,i) => (
              <div key={i} style={{ paddingLeft:i>0?12:0, borderLeft:i>0?"1px solid rgba(255,255,255,0.07)":"none" }}>
                <div style={{ ...G, fontSize:8, fontWeight:700, color:T.darkMuted, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:2 }}>{k.label}</div>
                <div style={{ ...G, ...NUM, fontSize:12, fontWeight:700, color:k.color }}>{k.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tab strip (horizontally scrollable) ── */}
        <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:6, marginBottom:14, scrollbarWidth:"none" }}>
          {TABS_REL.map(tab => (
            <button key={tab.id} onClick={() => setRelTab(tab.id)}
              style={{ ...G, display:"flex", alignItems:"center", gap:6, padding:"8px 16px",
                borderRadius:22, border:`1.5px solid ${relTab===tab.id ? T.ink : T.border}`,
                background:relTab===tab.id ? T.ink : T.surface,
                color:relTab===tab.id ? "#fff" : T.inkMid,
                fontSize:12, fontWeight:700, cursor:"pointer", flexShrink:0, transition:"all 0.15s" }}>
              <span style={{ fontSize:13 }}>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div key={relTab+periodo} style={{ display:"flex", flexDirection:"column", gap:12, animation:"relIn 0.22s ease-out" }}>

          {/* RESUMO */}
          {relTab==="resumo" && (<>
            <InsightChip
              color={saldoPositivo?T.green:T.red} icon="💡"
              text={`Em ${periodo}, você ${saldoPositivo?"poupou":"gastou mais que recebeu"} <strong>${fmtBRL(Math.abs(kpis.saldo))}</strong> — taxa de poupança de <strong>${kpis.taxa}%</strong>. Score médio: <strong>${kpis.avgScore}/100</strong>.`}
            />
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"16px 16px 12px" }}>
              <div style={{ ...G, fontSize:12, fontWeight:700, color:T.ink, marginBottom:12 }}>Receita vs Gasto</div>
              <ReceitaGastoChart height={170} />
              <div style={{ display:"flex", gap:12, marginTop:8, justifyContent:"center" }}>
                {[["Receita",T.green],["Gasto",T.red]].map(([label,color]) => (
                  <div key={label} style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <div style={{ width:9, height:9, borderRadius:2, background:color }} />
                    <span style={{ ...G, fontSize:10, color:T.inkLight }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"16px 16px 12px" }}>
              <div style={{ ...G, fontSize:12, fontWeight:700, color:T.ink, marginBottom:4 }}>Cascata · Mar'26</div>
              <div style={{ ...G, fontSize:10, color:T.inkLight, marginBottom:12 }}>Breakdown de onde foi cada real</div>
              <WaterfallChart compact />
            </div>
          </>)}

          {/* FLUXO */}
          {relTab==="fluxo" && (<>
            <InsightChip
              color={T.red} icon="⚡"
              text={`Gasto <strong>35% mais rápido que o ideal</strong> nos primeiros 5 dias. Distribuir compras grandes ao longo do mês pode economizar pressão no orçamento.`}
            />
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"16px 16px 12px" }}>
              <div style={{ ...G, fontSize:12, fontWeight:700, color:T.ink, marginBottom:3 }}>Velocidade de gasto · Mar'26</div>
              <div style={{ ...G, fontSize:10, color:T.inkLight, marginBottom:12 }}>Gasto real acumulado vs ritmo ideal diário</div>
              <VelocidadeChart height={155} />
              <VelocLegend />
            </div>
          </>)}

          {/* CATEGORIAS */}
          {relTab==="categorias" && (<>
            <InsightChip
              color={T.purple} icon="📊"
              text={selectedCat
                ? `<strong>${selectedCat}</strong> em destaque. Toque novamente para ver todas.`
                : `Lazer e Outros foram os principais drivers de variação no período. Toque em uma categoria para isolar.`}
            />
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"16px 16px 12px" }}>
              <div style={{ ...G, fontSize:12, fontWeight:700, color:T.ink, marginBottom:12 }}>Evolução por categoria</div>
              <CatLegend compact />
              <div style={{ marginTop:12 }}><DriftChart height={170} /></div>
            </div>
          </>)}

          {/* SCORE */}
          {relTab==="score" && (<>
            <InsightChip
              color={kpis.avgScore>=80?T.green:kpis.avgScore>=65?T.amber:T.red} icon="🏆"
              text={`Score médio em ${periodo}: <strong>${kpis.avgScore}/100</strong>. Melhor mês: <strong>${kpis.bestScore}</strong> · Pior: <strong>${kpis.worstScore}</strong>. Toque em uma barra para detalhar.`}
            />
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"16px 16px 12px" }}>
              <div style={{ ...G, fontSize:12, fontWeight:700, color:T.ink, marginBottom:3 }}>Score de aderência</div>
              <div style={{ ...G, fontSize:10, color:T.inkLight, marginBottom:12 }}>Linha verde = meta 80%</div>
              <ScoreChart height={155} />
              {scoreDetail && <div style={{ marginTop:12 }}><ScoreDetailCard /></div>}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
              {activeData.map(m => {
                const sC = m.score>=80?T.green:m.score>=65?T.amber:T.red;
                return (
                  <button key={m.mes} onClick={() => setScoreDetail(scoreDetail?.mes===m.mes ? null : m)}
                    style={{ background:m.score>=80?T.greenLight:m.score>=65?T.amberLight:T.redLight,
                      borderRadius:10, padding:"9px 10px", textAlign:"left",
                      border:`1.5px solid ${scoreDetail?.mes===m.mes ? sC : "transparent"}`,
                      cursor:"pointer", transition:"border-color 0.15s" }}>
                    <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid }}>{m.mes}</div>
                    <div style={{ ...G, ...NUM, fontSize:16, fontWeight:800, color:sC }}>{m.score}</div>
                  </button>
                );
              })}
            </div>
          </>)}

          {/* COMPOSIÇÃO */}
          {relTab==="composicao" && (<>
            <InsightChip
              color={T.amber} icon="🔒"
              text={`<strong>R$\u00a03.300 (38% da receita)</strong> comprometidos antes de gastar — fixo e recorrências. Margem discricionária real: <strong>R$\u00a01.081</strong> em Março.`}
            />
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"16px 16px 14px" }}>
              <div style={{ ...G, fontSize:12, fontWeight:700, color:T.ink, marginBottom:14 }}>Composição · Mar'26</div>
              <ComposicaoChart compact />
            </div>
          </>)}

        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     DESKTOP — 2-col grid + full-width sections
  ══════════════════════════════════════════════════════════ */
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <PageTitle sans="Meus" serif="Relatórios" />
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <PeriodSelector />
          <button style={{ ...G, display:"flex", alignItems:"center", gap:5, padding:"7px 12px", borderRadius:8,
            border:`1px solid ${T.border}`, background:T.surface, color:T.inkMid, fontSize:11, fontWeight:600, cursor:"pointer" }}>
            <Download size={11} /> Exportar
          </button>
        </div>
      </div>

      {/* KPI strip — computed from active period */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {[
          { label:`Receita · ${periodo}`,    val:fmtBRL(kpis.totalR),
            sub: kpis.tendR>=0 ? `↑ ${kpis.tendR}% vs mês ant.` : `↓ ${Math.abs(kpis.tendR)}% vs mês ant.`, color:T.green },
          { label:`Gasto · ${periodo}`,      val:fmtBRL(kpis.totalG),
            sub:`${Math.round(kpis.totalG/kpis.totalR*100)}% da receita`,                                     color:T.red   },
          { label:`Saldo · ${periodo}`,      val:fmtBRL(kpis.saldo),
            sub:kpis.saldo>=0?"superávit — bom ritmo":"déficit no período",
            color:kpis.saldo>=0?T.blue:T.red },
          { label:"Taxa de poupança",         val:`${kpis.taxa}%`,
            sub:`score médio: ${kpis.avgScore}/100`,                                                           color:T.purple },
        ].map((k,i) => (
          <div key={i} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:6 }}>{k.label}</div>
            <div style={{ ...G, ...NUM, fontSize:20, fontWeight:800, color:k.color, letterSpacing:"-0.01em" }}>{k.val}</div>
            <div style={{ ...G, fontSize:10, color:T.inkLight, marginTop:3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts — 2-col */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

        <Section title="Receita vs" serifWord="Gasto"
          insight={{ color:kpis.saldo>=0?T.green:T.red, icon:"💡",
            text:`Em ${periodo}, ${kpis.saldo>=0?"poupança de":"déficit de"} <strong>${fmtBRL(Math.abs(kpis.saldo))}</strong> — taxa de <strong>${kpis.taxa}%</strong>. ${kpis.tendR>0?`Receita subiu ${kpis.tendR}% no último mês.`:`Receita caiu ${Math.abs(kpis.tendR)}% no último mês.`}` }}>
          <ReceitaGastoChart height={200} />
          <div style={{ display:"flex", gap:12, marginTop:8, justifyContent:"center" }}>
            {[["Receita",T.green],["Gasto",T.red]].map(([l,c]) => (
              <div key={l} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:9, height:9, borderRadius:2, background:c }} />
                <span style={{ ...G, fontSize:10, color:T.inkLight }}>{l}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Cascata de" serifWord="caixa"
          insight={{ color:T.green, icon:"🔍",
            text:`Moradia + Alimentação = <strong>${Math.round((1500+1046)/8600*100)}% da receita</strong> de Março. Lazer e Outros são as maiores alavancas de economia potencial.` }}>
          <WaterfallChart />
        </Section>

        <Section title="Evolução por" serifWord="categoria"
          insight={{ color:T.purple, icon:"📊",
            text:`Clique nas categorias abaixo para isolar. ${selectedCat ? `<strong>${selectedCat}</strong> em destaque.` : "Lazer e Outros variaram +134% em Nov–Dez vs set."}`}}>
          <div style={{ marginBottom:10 }}><CatLegend /></div>
          <DriftChart height={190} />
        </Section>

        <Section title="Score de" serifWord="aderência"
          insight={{ color:kpis.avgScore>=80?T.green:kpis.avgScore>=65?T.amber:T.red, icon:"🏆",
            text:`Score médio em ${periodo}: <strong>${kpis.avgScore}/100</strong>. Melhor: <strong>${kpis.bestScore}</strong> · Pior: <strong>${kpis.worstScore}</strong>. Clique em uma barra para detalhar.` }}>
          <ScoreChart height={155} />
          {scoreDetail && <div style={{ marginTop:12 }}><ScoreDetailCard /></div>}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginTop:12 }}>
            {activeData.map(m => {
              const sC=m.score>=80?T.green:m.score>=65?T.amber:T.red;
              return (
                <button key={m.mes} onClick={() => setScoreDetail(scoreDetail?.mes===m.mes?null:m)}
                  style={{ background:m.score>=80?T.greenLight:m.score>=65?T.amberLight:T.redLight,
                    borderRadius:8, padding:"6px 8px", textAlign:"left",
                    border:`1.5px solid ${scoreDetail?.mes===m.mes?sC:"transparent"}`, cursor:"pointer" }}>
                  <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid }}>{m.mes}</div>
                  <div style={{ ...G, ...NUM, fontSize:14, fontWeight:800, color:sC }}>{m.score}</div>
                </button>
              );
            })}
          </div>
        </Section>

      </div>

      {/* Velocidade — full-width */}
      <Section title="Velocidade de" serifWord="gasto"
        insight={{ color:T.red, icon:"⚡",
          text:`Gastos <strong>35% acima do ritmo ideal</strong> nos primeiros 5 dias de Março. Distribuir compras ao longo do mês melhora o score de aderência.` }}>
        <VelocidadeChart height={155} />
        <VelocLegend />
      </Section>

      {/* Composição — full-width */}
      <Section title="Composição dos" serifWord="gastos"
        insight={{ color:T.amber, icon:"🔒",
          text:`<strong>R$\u00a03.300 (38% da receita)</strong> comprometidos antes do primeiro gasto — fixo e recorrências. Margem discricionária real em Março: <strong>R$\u00a01.081</strong>.` }}>
        <ComposicaoChart />
      </Section>

    </div>
  );

};


/* ─── CARTÕES DATA ───────────────────────────────────────── */
const CARTOES_DATA = [
  {
    id:"nubank", banco:"Nubank", nome:"Nu Roxinho", dig:"1177",
    bandeira:"Mastercard", vencimento:10, fechamento:3,
    limite:4800, disponivel:2960,
    cor1:"#6016A8", cor2:"#8B11D4", corChip:"#A855F7", corText:"#fff",
    faturas: [
      { id:"f1", mes:"Out'25", val:1240, pago:true,  venc:"10/11/2025" },
      { id:"f2", mes:"Nov'25", val:1680, pago:true,  venc:"10/12/2025" },
      { id:"f3", mes:"Dez'25", val:2310, pago:true,  venc:"10/01/2026" },
      { id:"f4", mes:"Jan'26", val:1550, pago:true,  venc:"10/02/2026" },
      { id:"f5", mes:"Fev'26", val:1420, pago:true,  venc:"10/03/2026" },
      { id:"f6", mes:"Mar'26", val:1840, pago:false, venc:"10/04/2026", atual:true },
    ],
    // Category trend data for Análises
    tendencia: [
      { mes:"Out'25", Assinaturas:297, Alimentação:410, Transporte:180, Saúde:110, Eletrônicos:0,   Outros:243 },
      { mes:"Nov'25", Assinaturas:297, Alimentação:520, Transporte:210, Saúde:150, Eletrônicos:350, Outros:153 },
      { mes:"Dez'25", Assinaturas:297, Alimentação:680, Transporte:190, Saúde:200, Eletrônicos:420, Outros:523 },
      { mes:"Jan'26", Assinaturas:297, Alimentação:480, Transporte:220, Saúde:130, Eletrônicos:653, Outros:270 },
      { mes:"Fev'26", Assinaturas:297, Alimentação:390, Transporte:195, Saúde:194, Eletrônicos:0,   Outros:344 },
      { mes:"Mar'26", Assinaturas:297, Alimentação:560, Transporte:225, Saúde:194, Eletrônicos:653, Outros:111 },
    ],
    itens: [
      { id:1,  desc:"Netflix",         cat:"Assinaturas", val:55.90,  data:"01/03", icon:"📺", rec:true,  parcela:null      },
      { id:2,  desc:"Spotify",         cat:"Assinaturas", val:21.90,  data:"01/03", icon:"🎵", rec:true,  parcela:null      },
      { id:3,  desc:"Amazon Prime",    cat:"Assinaturas", val:19.90,  data:"01/03", icon:"📦", rec:true,  parcela:null      },
      { id:4,  desc:"Adobe CC",        cat:"Assinaturas", val:179.90, data:"02/03", icon:"🎨", rec:true,  parcela:null      },
      { id:5,  desc:"iFood +",         cat:"Assinaturas", val:19.90,  data:"01/03", icon:"⭐", rec:true,  parcela:null      },
      { id:6,  desc:"Posto Shell",     cat:"Transporte",  val:180.00, data:"04/03", icon:"⛽", rec:false, parcela:null      },
      { id:7,  desc:"iFood",           cat:"Alimentação", val:89.90,  data:"06/03", icon:"🍔", rec:false, parcela:null      },
      { id:8,  desc:"Smart Fit",       cat:"Saúde",       val:109.90, data:"07/03", icon:"💪", rec:true,  parcela:null      },
      { id:9,  desc:"iPhone 16 Pro",   cat:"Eletrônicos", val:420.00, data:"08/03", icon:"📱", rec:false, parcela:{n:3,t:12}},
      { id:10, desc:"Mercado Extra",   cat:"Alimentação", val:312.50, data:"09/03", icon:"🛒", rec:false, parcela:null      },
      { id:11, desc:"Rappi",           cat:"Alimentação", val:67.80,  data:"11/03", icon:"🛵", rec:false, parcela:null      },
      { id:12, desc:"Monitor LG 27\"", cat:"Eletrônicos", val:233.00, data:"12/03", icon:"🖥️",rec:false, parcela:{n:2,t:6} },
      { id:13, desc:"Uber",            cat:"Transporte",  val:45.20,  data:"13/03", icon:"🚗", rec:false, parcela:null      },
      { id:14, desc:"Farmácia",        cat:"Saúde",       val:84.00,  data:"14/03", icon:"💊", rec:false, parcela:null      },
      { id:15, desc:"Uber Eats",       cat:"Alimentação", val:89.90,  data:"16/03", icon:"🛵", rec:false, parcela:null      },
    ],
    parcelas_ativas: [
      { id:"p1", desc:"iPhone 16 Pro",   cat:"Eletrônicos", vParcela:420.00, pago:3,  total:12, vTotal:5040, icon:"📱" },
      { id:"p2", desc:"Monitor LG 27\"", cat:"Eletrônicos", vParcela:233.00, pago:2,  total:6,  vTotal:1398, icon:"🖥️" },
      { id:"p3", desc:"Notebook Dell",   cat:"Eletrônicos", vParcela:380.00, pago:1,  total:10, vTotal:3800, icon:"💻" },
      { id:"p4", desc:"Curso Alura",     cat:"Educação",    vParcela:89.90,  pago:4,  total:12, vTotal:1079, icon:"📚" },
      { id:"p5", desc:"Airfryer Philco", cat:"Casa",        vParcela:110.00, pago:2,  total:5,  vTotal:550,  icon:"🍳" },
    ],
  },
  {
    id:"itau", banco:"Itaú Unibanco", nome:"Personnalité", dig:"0034",
    bandeira:"Visa Infinite", vencimento:20, fechamento:13,
    limite:15000, disponivel:11800,
    cor1:"#003087", cor2:"#0050C8", corChip:"#60A5FA", corText:"#fff",
    faturas: [
      { id:"g1", mes:"Out'25", val:2800, pago:true,  venc:"20/11/2025" },
      { id:"g2", mes:"Nov'25", val:4100, pago:true,  venc:"20/12/2025" },
      { id:"g3", mes:"Dez'25", val:5600, pago:true,  venc:"20/01/2026" },
      { id:"g4", mes:"Jan'26", val:3100, pago:true,  venc:"20/02/2026" },
      { id:"g5", mes:"Fev'26", val:2900, pago:true,  venc:"20/03/2026" },
      { id:"g6", mes:"Mar'26", val:3200, pago:false, venc:"20/04/2026", atual:true },
    ],
    tendencia: [
      { mes:"Out'25", Moradia:2220, Alimentação:380, Transporte:0, Viagem:0,    Outros:200 },
      { mes:"Nov'25", Moradia:2220, Alimentação:580, Transporte:0, Viagem:0,    Outros:1300},
      { mes:"Dez'25", Moradia:2220, Alimentação:480, Transporte:0, Viagem:1200, Outros:1700},
      { mes:"Jan'26", Moradia:2220, Alimentação:380, Transporte:0, Viagem:0,    Outros:500 },
      { mes:"Fev'26", Moradia:2220, Alimentação:320, Transporte:0, Viagem:0,    Outros:360 },
      { mes:"Mar'26", Moradia:2220, Alimentação:380, Transporte:180, Viagem:420, Outros:0  },
    ],
    itens: [
      { id:20, desc:"Aluguel",          cat:"Moradia",     val:1800.00, data:"05/03", icon:"🏠", rec:true,  parcela:null       },
      { id:21, desc:"Condomínio",       cat:"Moradia",     val:420.00,  data:"05/03", icon:"🏢", rec:true,  parcela:null       },
      { id:22, desc:"IPTU",             cat:"Moradia",     val:180.00,  data:"05/03", icon:"📋", rec:false, parcela:{n:3,t:10} },
      { id:23, desc:"Restaurante Fogo", cat:"Alimentação", val:380.00,  data:"08/03", icon:"🍖", rec:false, parcela:null       },
      { id:24, desc:"Viagem Floripa",   cat:"Viagem",      val:420.00,  data:"10/03", icon:"✈️", rec:false, parcela:{n:1,t:3}  },
    ],
    parcelas_ativas: [
      { id:"p6", desc:"IPTU parcelado",  cat:"Moradia",     vParcela:180.00, pago:3, total:10, vTotal:1800, icon:"📋" },
      { id:"p7", desc:"Viagem Floripa",  cat:"Viagem",      vParcela:420.00, pago:1, total:3,  vTotal:1260, icon:"✈️" },
      { id:"p8", desc:"TV Samsung 65\"", cat:"Eletrônicos", vParcela:350.00, pago:2, total:12, vTotal:4200, icon:"📺" },
    ],
  },
  {
    id:"inter", banco:"Banco Inter", nome:"Mastercard Black", dig:"5521",
    bandeira:"Mastercard Black", vencimento:5, fechamento:28,
    limite:2500, disponivel:1520,
    cor1:"#1C1C1E", cor2:"#3A3A3C", corChip:"#D4AF37", corText:"#fff",
    faturas: [
      { id:"h1", mes:"Out'25", val:720,  pago:true,  venc:"05/11/2025" },
      { id:"h2", mes:"Nov'25", val:1100, pago:true,  venc:"05/12/2025" },
      { id:"h3", mes:"Dez'25", val:1380, pago:true,  venc:"05/01/2026" },
      { id:"h4", mes:"Jan'26", val:850,  pago:true,  venc:"05/02/2026" },
      { id:"h5", mes:"Fev'26", val:760,  pago:true,  venc:"05/03/2026" },
      { id:"h6", mes:"Mar'26", val:980,  pago:false, venc:"05/04/2026", atual:true },
    ],
    tendencia: [
      { mes:"Out'25", Alimentação:320, Transporte:180, Saúde:120, Lazer:0,   Educação:100 },
      { mes:"Nov'25", Alimentação:410, Transporte:190, Saúde:80,  Lazer:200, Educação:220 },
      { mes:"Dez'25", Alimentação:580, Transporte:160, Saúde:80,  Lazer:320, Educação:240 },
      { mes:"Jan'26", Alimentação:360, Transporte:200, Saúde:140, Lazer:0,   Educação:150 },
      { mes:"Fev'26", Alimentação:290, Transporte:180, Saúde:200, Lazer:0,   Educação:90  },
      { mes:"Mar'26", Alimentação:387, Transporte:65,  Saúde:218, Lazer:120, Educação:189 },
    ],
    itens: [
      { id:30, desc:"Padaria São Bento", cat:"Alimentação", val:42.50,  data:"02/03", icon:"🥐", rec:false, parcela:null      },
      { id:31, desc:"99 Táxi",           cat:"Transporte",  val:28.90,  data:"04/03", icon:"🚕", rec:false, parcela:null      },
      { id:32, desc:"Farmácia Popular",  cat:"Saúde",       val:67.40,  data:"06/03", icon:"💊", rec:false, parcela:null      },
      { id:33, desc:"Steam (jogos)",     cat:"Lazer",       val:119.90, data:"08/03", icon:"🎮", rec:false, parcela:null      },
      { id:34, desc:"Livros Amazon",     cat:"Educação",    val:189.00, data:"10/03", icon:"📚", rec:false, parcela:null      },
      { id:35, desc:"Supermercado",      cat:"Alimentação", val:241.30, data:"12/03", icon:"🛒", rec:false, parcela:null      },
      { id:36, desc:"Uber Eats",         cat:"Alimentação", val:54.80,  data:"14/03", icon:"🛵", rec:false, parcela:null      },
      { id:37, desc:"Corrida Uber",      cat:"Transporte",  val:36.20,  data:"14/03", icon:"🚗", rec:false, parcela:null      },
      { id:38, desc:"Tênis Nike",        cat:"Saúde",       val:151.00, data:"17/03", icon:"👟", rec:false, parcela:{n:1,t:3} },
    ],
    parcelas_ativas: [
      { id:"p9", desc:"Tênis Nike", cat:"Saúde", vParcela:151.00, pago:1, total:3, vTotal:453, icon:"👟" },
    ],
  },
];

const CAT_COLORS_CARD = {
  Assinaturas:"#7C3AED", Transporte:"#D97706", Alimentação:"#2563EB",
  Saúde:"#059669",       Eletrônicos:"#0891B2", Educação:"#BE185D",
  Casa:"#64748B",        Moradia:"#374151",     Viagem:"#0D9488",
  Lazer:"#9333EA",       Outros:"#9CA3AF",
};
const safe = (num, den, fallback=0) => (!den || isNaN(num/den)) ? fallback : Math.round(num/den*100);


/* ─── CARTÕES PAGE ───────────────────────────────────────── */
/* ─── CARTÕES PAGE ───────────────────────────────────────── */
/* ─── DRAG SCROLL TABS ──────────────────────────────────────── */
/* Reusable horizontally-scrollable tab strip with:             */
/*   - Touch/mouse drag                                         */
/*   - Bidirectional fade indicators                            */
/*   - Auto-hides fades when not needed                         */
const DragScrollTabs = ({ children, bg = "#F8F7F5" }) => {
  const scrollRef = useRef(null);
  const fadeL     = useRef(null);
  const fadeR     = useRef(null);

  const updateFades = () => {
    const el = scrollRef.current;
    if (!el) return;
    const canScroll = el.scrollWidth > el.clientWidth + 4;
    if (fadeL.current) fadeL.current.style.opacity = el.scrollLeft > 8 ? "1" : "0";
    if (fadeR.current) fadeR.current.style.opacity = (canScroll && el.scrollLeft + el.clientWidth < el.scrollWidth - 8) ? "1" : "0";
  };

  // Init fades after layout
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(updateFades));
    return () => cancelAnimationFrame(id);
  });

  // Mouse drag for desktop — touch is handled natively by the browser
  const handleMouseDown = (e) => {
    const el = scrollRef.current;
    if (!el) return;
    const startX = e.clientX;
    const startL = el.scrollLeft;
    el.style.cursor = "grabbing";
    const onMove = (mv) => { el.scrollLeft = startL - (mv.clientX - startX); };
    const onUp   = () => {
      el.style.cursor = "grab";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  };

  return (
    <div style={{ position:"relative", maxWidth:"100%" }}>
      <div ref={fadeL} style={{
        position:"absolute", left:0, top:0, bottom:0, width:28, zIndex:2,
        background:`linear-gradient(to right, ${bg}, transparent)`,
        pointerEvents:"none", opacity:0, transition:"opacity 0.18s ease",
      }}/>
      <div ref={fadeR} style={{
        position:"absolute", right:0, top:0, bottom:0, width:36, zIndex:2,
        background:`linear-gradient(to left, ${bg}, transparent)`,
        pointerEvents:"none", opacity:0, transition:"opacity 0.18s ease",
      }}/>
      <div
        ref={scrollRef}
        className="dstabs-scroll"
        onScroll={updateFades}
        onMouseDown={handleMouseDown}
        style={{
          display:"flex", gap:6,
          overflowX:"auto",
          paddingBottom:4, paddingTop:2,
          WebkitOverflowScrolling:"touch",
          touchAction:"pan-x",
          cursor:"grab", userSelect:"none",
        }}
      >
        {children}
        <div style={{ flexShrink:0, minWidth:32 }}/>
      </div>
      <style>{`
        .dstabs-scroll::-webkit-scrollbar { display:none !important; height:0 !important; }
        .dstabs-scroll { scrollbar-width:none !important; -ms-overflow-style:none !important; }
      `}</style>
    </div>
  );
};


const CartõesPage = ({ onNav, isMobile = false, onNovaItem, cards: cardsProp, autoOpenAdd = false, dataMode = "mock" }) => {
  const hasSeededCards = cardsProp !== undefined;
  const CARDS = (cardsProp && cardsProp.length > 0) ? cardsProp : (hasSeededCards ? [] : CARTOES_DATA);
  const isEmptyCards = dataMode === "empty" && hasSeededCards && CARDS.length === 0;
  const [showAddCard, setShowAddCard] = useState(autoOpenAdd);
  // When autoOpenAdd prop triggers, open the AddCardSheet
  useEffect(() => { if (showAddCard) { setAddCardSheet(true); setShowAddCard(false); } }, [showAddCard]);
  /* ── State ───────────────────────────────────────────────── */
  const [cardId,        setCardId]        = useState(() => (cardsProp && cardsProp.length > 0 ? cardsProp[0].id : "nubank"));
  const [tab,           setTab]           = useState("fatura");
  const [faturaIdx,     setFaturaIdx]     = useState(5);
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
  const [visibleGroups, setVisibleGroups] = useState(8); // pagination
  // New card form
  const [ncBanco,       setNcBanco]       = useState("");
  const [ncNome,        setNcNome]        = useState("");
  const [ncDig,         setNcDig]         = useState("");
  const [ncBandeira,    setNcBandeira]    = useState("Visa");
  const [ncLimite,      setNcLimite]      = useState("");
  const [ncVenc,        setNcVenc]        = useState("");
  const [ncFecha,       setNcFecha]       = useState("");
  const [ncSaved,       setNcSaved]       = useState(false);

  const handleSaveCard = () => {
    setNcSaved(true);
    setTimeout(()=>{ setNcSaved(false); setAddCardSheet(false); setNcBanco(""); setNcNome(""); setNcDig(""); setNcLimite(""); setNcVenc(""); setNcFecha(""); }, 1100);
  };

  /* ── AddCardSheet ────────────────────────────────────────── */
  const AddCardSheet = () => {
    if (!addCardSheet) return null;
    const canSave = ncBanco&&ncNome&&ncDig&&ncLimite&&ncVenc;
    const FI=({val,set,ph,type="text"})=>(
      <div style={{display:"flex",alignItems:"center",padding:"9px 12px",border:`1px solid ${T.border}`,borderRadius:9,background:T.surface,transition:"border-color 0.15s"}}
        onFocusCapture={e=>e.currentTarget.style.borderColor=T.blue}
        onBlurCapture={e=>e.currentTarget.style.borderColor=T.border}>
        <input value={val} onChange={e=>set(e.target.value)} placeholder={ph} type={type}
          style={{...G,flex:1,border:"none",outline:"none",background:"transparent",fontSize:13,color:T.ink}}/>
      </div>
    );
    const inner=(
      <>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{...G,fontSize:14,fontWeight:800,color:T.ink}}>Adicionar cartão</div>
          <button onClick={()=>setAddCardSheet(false)} style={{background:T.grayLight,border:"none",cursor:"pointer",padding:7,borderRadius:8,display:"flex"}}><X size={14} color={T.inkMid}/></button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column",gap:14}}>
          {/* Preview card stub */}
          <div style={{height:96,borderRadius:14,background:`linear-gradient(135deg,#374151,#6B7280)`,
            display:"flex",flexDirection:"column",justifyContent:"space-between",padding:"14px 18px",
            position:"relative",overflow:"hidden",marginBottom:4}}>
            <div style={{position:"absolute",top:-20,right:-20,width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,0.06)"}}/>
            <div style={{...G,fontSize:10,fontWeight:800,color:"rgba(255,255,255,0.7)",textTransform:"uppercase",letterSpacing:"0.14em"}}>
              {ncBanco||"BANCO"}
            </div>
            <div style={{...M_MONO,...NUM,fontSize:13,color:"rgba(255,255,255,0.6)",letterSpacing:"0.18em"}}>
              ···· ···· ···· {ncDig||"····"}
            </div>
            <div style={{...G,fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.9)"}}>{ncNome||"Nome do cartão"}</div>
          </div>
          <div>
            <div style={{...G,fontSize:10,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:7}}>Banco / Emissor</div>
            <FI val={ncBanco} set={setNcBanco} ph="ex: Nubank, Itaú, Bradesco…"/>
          </div>
          <div>
            <div style={{...G,fontSize:10,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:7}}>Nome do cartão</div>
            <FI val={ncNome} set={setNcNome} ph="ex: Nubank Roxinho, Personnalité…"/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <div style={{...G,fontSize:10,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:7}}>4 últimos dígitos</div>
              <FI val={ncDig} set={setNcDig} ph="1234" type="number"/>
            </div>
            <div>
              <div style={{...G,fontSize:10,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:7}}>Bandeira</div>
              <div style={{display:"flex",flexDirection:"column",position:"relative"}}>
                <select value={ncBandeira} onChange={e=>setNcBandeira(e.target.value)}
                  style={{...G,padding:"9px 12px",border:`1px solid ${T.border}`,borderRadius:9,background:T.surface,fontSize:13,color:T.ink,cursor:"pointer",appearance:"none"}}>
                  {["Visa","Mastercard","Elo","Amex","Hipercard","Visa Infinite","Mastercard Black"].map(b=><option key={b}>{b}</option>)}
                </select>
                <ChevronDown size={13} color={T.inkLight} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}/>
              </div>
            </div>
          </div>
          <div>
            <div style={{...G,fontSize:10,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:7}}>Limite total</div>
            <div style={{display:"flex",alignItems:"center",padding:"9px 12px",border:`1px solid ${T.border}`,borderRadius:9,background:T.surface}}
              onFocusCapture={e=>e.currentTarget.style.borderColor=T.blue}
              onBlurCapture={e=>e.currentTarget.style.borderColor=T.border}>
              <span style={{...G,fontSize:13,fontWeight:700,color:T.inkLight,marginRight:4}}>R$</span>
              <input value={ncLimite} onChange={e=>setNcLimite(e.target.value)} placeholder="0,00" type="text"
                style={{...G,...NUM,flex:1,border:"none",outline:"none",background:"transparent",fontSize:13,color:T.ink}}/>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <div style={{...G,fontSize:10,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:7}}>Dia do vencimento</div>
              <FI val={ncVenc} set={setNcVenc} ph="ex: 10" type="number"/>
            </div>
            <div>
              <div style={{...G,fontSize:10,fontWeight:700,color:T.inkMid,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:7}}>Dia do fechamento</div>
              <FI val={ncFecha} set={setNcFecha} ph="ex: 3" type="number"/>
            </div>
          </div>
          <div style={{background:T.blueLight,border:`1px solid ${T.blue}22`,borderRadius:10,padding:"10px 14px"}}>
            <div style={{...G,fontSize:11,color:T.blue,lineHeight:1.65}}>
              💡 <strong>Dica financeira:</strong> O dia do fechamento define o início do período de compras. Compras feitas logo após o fechamento têm mais prazo para pagamento.
            </div>
          </div>
        </div>
        <div style={{padding:"14px 20px",borderTop:`1px solid ${T.border}`,flexShrink:0}}>
          <button onClick={handleSaveCard} disabled={!canSave}
            style={{...G,width:"100%",padding:"13px",borderRadius:10,border:"none",
              background:ncSaved?T.green:!canSave?T.inkGhost:T.ink,
              color:"#fff",fontSize:13,fontWeight:700,cursor:canSave?"pointer":"not-allowed",
              display:"flex",alignItems:"center",justifyContent:"center",gap:7,transition:"background 0.2s"}}>
            {ncSaved?<><Check size={14}/> Cartão adicionado!</>:"Adicionar cartão"}
          </button>
        </div>
      </>
    );
    const wrap=(ch)=>isMobile?(
      <div style={{position:"fixed",inset:0,zIndex:400,overflow:"hidden",display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
        <div onClick={()=>setAddCardSheet(false)} style={{position:"absolute",inset:0,background:"rgba(15,23,35,0.5)"}}/>
        <div style={{position:"relative",background:T.surface,borderRadius:"24px 24px 0 0",maxHeight:"95vh",display:"flex",flexDirection:"column",animation:"sheetUp 0.5s cubic-bezier(0.32,0.72,0,1) both"}}>
          <div style={{display:"flex",justifyContent:"center",padding:"12px 0 4px"}}><div style={{width:36,height:4,borderRadius:99,background:T.inkGhost}}/></div>
          {ch}
        </div>
      </div>
    ):(
      <div style={{position:"fixed",inset:0,zIndex:400,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div onClick={()=>setAddCardSheet(false)} style={{position:"absolute",inset:0,background:"rgba(15,23,35,0.38)"}}/>
        <div style={{position:"relative",width:460,maxHeight:"88vh",background:T.surface,borderRadius:18,boxShadow:T.dark,display:"flex",flexDirection:"column",overflow:"hidden"}}>{ch}</div>
      </div>
    );
    return wrap(inner);
  };
  // ── Early return when no cards — MUST be after all hooks, before any card.* access ──
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
            <button onClick={() => setAddCardSheet(true)}
              style={{ ...G, background:T.ink, color:"#fff", border:"none", borderRadius:11, padding:"11px 26px", fontSize:13, fontWeight:700, cursor:"pointer", marginTop:4 }}>
              + Adicionar cartão
            </button>
          </div>
        </div>
        {(addCardSheet) && <AddCardSheet/>}
      </>
    );
  }

  const card      = CARDS.find(c => c.id === cardId) || CARDS[0];
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

  const usoPct   = safe(card.limite - card.disponivel, card.limite);
  const usoColor = usoPct >= 90 ? T.red : usoPct >= 70 ? T.amber : T.green;
  const mediaVal = faturas.length > 0 ? Math.round(faturas.reduce((s,f) => s+f.val, 0) / faturas.length) : 0;
  const diffPct  = fatPrev && fatPrev.val > 0
    ? Math.round((((fatura?.val||0)||0) - fatPrev.val) / fatPrev.val * 100)
    : 0;

  const fmtBRL = v => "R$\u00a0" + Math.abs(v).toLocaleString("pt-BR",{minimumFractionDigits:2});
  const fmtK   = v => Math.abs(v)>=1000 ? (Math.abs(v)/1000).toFixed(1)+"k" : String(Math.abs(v));

  const switchCard = (id) => {
    setCardId(id);
    const c = CARDS.find(x => x.id === id) || CARDS[0];
    setFaturaIdx(Math.max(0, (c?.faturas?.length || 1) - 1));
    setSearch(""); setFilterCat(null); setTab("fatura"); setVisibleGroups(8);
  };

  useEffect(() => { setVisibleGroups(8); }, [cardId, filterCat, search, faturaIdx]);

  // Safe aliases — guard against empty onboarding card
  const cardFaturas    = faturas;
  const cardItens      = card?.itens           || [];
  const cardParcelas   = card?.parcelas_ativas || [];
  const cardTendencia  = card?.tendencia       || [];
  const displayItens   = isAtual ? cardItens : [];
  const recItems     = displayItens.filter(i => i.rec);
  const recTotal     = recItems.reduce((s,i) => s+i.val, 0);
  const totalParcelas= cardParcelas.reduce((s,p) => s+p.vParcela*(p.total-p.pago), 0);

  const TODAY_DAY  = 18;
  const projecao   = isAtual && TODAY_DAY > 0 && ((fatura?.val||0)||0) > 0
    ? Math.round(((fatura?.val||0)||0) / TODAY_DAY * (card.vencimento > card.fechamento
      ? card.vencimento - card.fechamento
      : 30 + card.vencimento - card.fechamento))
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
    filtered.forEach(i => { if (!map[i.data]) map[i.data]=[]; map[i.data].push(i); });
    return Object.entries(map).sort((a,b) => {
      const [da,ma]=a[0].split("/").map(Number), [db,mb]=b[0].split("/").map(Number);
      return (mb-ma)||(db-da);
    });
  }, [filtered]);

  const PAGE_GROUPS   = 8;
  const pagedGroups   = grouped.slice(0, visibleGroups);
  const hasMoreGroups = grouped.length > visibleGroups;
  const totalItems    = filtered.length;
  const visibleItems  = pagedGroups.reduce((s,[,items])=>s+items.length, 0);

  const catTotals = useMemo(() => {
    const map = {};
    displayItens.forEach(i => { map[i.cat] = (map[i.cat]||0)+i.val; });
    const total = displayItens.reduce((s,i)=>s+i.val,0);
    return Object.entries(map)
      .sort((a,b) => b[1]-a[1])
      .map(([cat,val]) => ({
        cat, val,
        pct: total > 0 ? Math.round(val/total*100) : 0,
        color: CAT_COLORS_CARD[cat] || T.inkMid,
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

  /* ── Helpers ─────────────────────────────────────────────── */
  const handleMarkPago = () => {
    setMarkingPago(true);
    setTimeout(()=>{ setMarkingPago(false); setMarkedPago(m=>({...m,[fatura?.id]:true})); }, 800);
  };

  const handleRealoc = () => {
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
    const cc        = CAT_COLORS_CARD[item.cat] || T.inkMid;
    const isParcela = item.parcela && item.parcela.n;
    const [expanded, setExpanded] = useState(false);

    return (
      <div style={{ borderBottom:`1px solid ${T.border}` }}>
        {/* ── Main row ── */}
        <div
          onClick={() => setExpanded(e => !e)}
          style={{
            display:"flex", alignItems:"center", gap:0,
            padding:"0 20px", cursor:"pointer",
            background: expanded ? `${cc}06` : "transparent",
            transition:"background 0.12s",
          }}
          onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = T.bg; }}
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
                    {fmtBRL(item.parcela.val)}/mês
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
                  total {fmtBRL(item.parcela.total)}
                </div>
              )}
            </div>
            <ChevronRight size={13} color={expanded ? cc : T.inkGhost}
              style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                transition:"transform 0.18s ease", flexShrink:0 }}/>
          </div>
        </div>

        {/* ── Expanded detail ── */}
        {expanded && (
          <div style={{ padding:"0 20px 14px 71px",
            background:`${cc}06`, animation:"fadeIn 0.15s ease" }}>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {/* Detail chips */}
              {[
                item.method && { label:"Método", val: item.method },
                item.rec     && { label:"Recorrência", val:"Mensal", color:T.purple },
                isParcela    && { label:"Parcela", val:`${item.parcela.n}ª de ${item.parcela.t}` },
                isParcela    && { label:"Valor mensal", val: fmtBRL(item.parcela.val), mono:true },
                isParcela    && { label:"Total compra", val: fmtBRL(item.parcela.total), mono:true },
                isParcela    && { label:"Restante", val: fmtBRL(item.parcela.total - item.parcela.n * item.parcela.val), mono:true, color:T.blue },
              ].filter(Boolean).map((chip, i) => (
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
            {/* Parcela progress bar */}
            {isParcela && (
              <div style={{ marginTop:10 }}>
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
          </div>
        )}
      </div>
    );
  };

  /* ── DateGroup ─────────────────────────────────────────────── */
  const DateGroup = ({ date, items }) => {
    const total    = items.reduce((s,i) => s + i.val, 0);
    const isOpen   = expandedDate === null || expandedDate === date;
    const dayLabel = (() => {
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
                ? `${recItems.length} cobranças automáticas totalizam <strong style="color:${T.ink}">${fmtBRL(recTotal)}</strong>/mês. São ${Math.round(recTotal/(fatura?.val||0)*100)}% da fatura atual.`
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
    const healthScore = Math.max(0, 100 - usoPct - (totalParcelas/card.limite*30));
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
                ? `✅ Ritmo controlado. Projeção de fechamento: <strong>${fmtBRL(projecao)}</strong>.`
                : `🔴 Gasto acelerado. Projeção: <strong style="color:${T.red}">${fmtBRL(projecao)}</strong> — acima do ritmo.`}
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
          <div style={{...G,fontSize:11,color:T.inkMid,marginBottom:12,lineHeight:1.65}}>
            Total comprometido em parcelas futuras · {Math.round(cardParcelas.reduce((s,p)=>s+p.vParcela,0)/card.limite*100)}% do limite mensal · {fmtBRL(cardParcelas.reduce((s,p)=>s+p.vParcela,0))}/mês.
          </div>
          {cardParcelas.map((p,i)=>{
            const exposurePct = safe(p.vParcela, card.limite); // % mensal sobre o limite
            return (
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <span style={{fontSize:15}}>{p.icon}</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{...G,fontSize:12,color:T.ink}}>{p.desc}</span>
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
            { label:"Total comprometido",     val:fmtBRL(totalParcelas),       valSuffix:"",                                                sub:"soma de todas as parcelas futuras", color:T.ink,   icon:"💳" },
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
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
                      <span style={{...G,fontSize:13,fontWeight:600,color:T.ink,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {p.desc}
                      </span>
                      <span style={{...G,fontSize:10,fontWeight:700,color:catColor,
                        background:`${catColor}14`,borderRadius:5,padding:"1px 6px",flexShrink:0}}>
                        {p.cat}
                      </span>
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
    const meses = ["Abr'26","Mai'26","Jun'26","Jul'26","Ago'26","Set'26"];
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
            const ativos=cardParcelas.filter(p=>p.pago+idx+1<=p.total);
            const total=ativos.reduce((s,p)=>s+p.vParcela,0);
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
                      {ativos.length} parcela{ativos.length!==1?"s":""}
                    </div>
                    {ativos.slice(0,3).map(p=>(
                      <div key={p.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 0",borderTop:`1px solid ${T.border}`}}>
                        <span style={{...G,fontSize:11,color:T.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"70%"}}>{p.desc}</span>
                        <span style={{...G,...NUM,fontSize:11,fontWeight:700,color:T.ink,flexShrink:0}}>{fmtBRL(p.vParcela)}</span>
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
    const futuros=["Abr'26","Mai'26","Jun'26","Jul'26"];
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
        @keyframes 
        @keyframes tabIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
      <ParcelaModal/><ExportModal/><AddCardSheet/>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,gap:8}}>
        <PageTitle sans="Meus" serif="Cartões"/>
        <div style={{display:"flex",gap:6,flexShrink:0}}>
          <button onClick={()=>onNovaItem&&onNovaItem(cardId)}
            title="Novo item"
            style={{...G,display:"flex",alignItems:"center",gap:5,background:T.green,border:"none",
              borderRadius:9,padding:"8px 12px",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",flexShrink:0}}>
            <Plus size={13}/> <span>Item</span>
          </button>
          <button onClick={()=>setAddCardSheet(true)}
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
          <div onClick={()=>setAddCardSheet(true)}
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
          <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:20,alignItems:"start"}}>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,display:"flex",alignItems:"center",gap:8,background:T.surface,border:`1px solid ${T.border}`,borderRadius:9,padding:"8px 12px"}}>
                  <Search size={13} color={T.inkLight}/>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar lançamentos..." style={{...G,flex:1,border:"none",outline:"none",background:"transparent",fontSize:13,color:T.ink}}/>
                  {search&&<button onClick={()=>setSearch("")} style={{background:"none",border:"none",cursor:"pointer",padding:2}}><X size={13} color={T.inkLight}/></button>}
                </div>
                <div style={{display:"flex",gap:5}}>
                  {Object.entries(CAT_COLORS_CARD).filter(([c])=>displayItens.some(i=>i.cat===c)).map(([c,color])=>(
                    <button key={c} onClick={()=>setFilterCat(filterCat===c?null:c)} title={c} style={{width:20,height:20,borderRadius:6,background:color,border:`2.5px solid ${filterCat===c?T.ink:"transparent"}`,cursor:"pointer",opacity:filterCat&&filterCat!==c?0.25:1,transition:"all 0.15s"}}/>
                  ))}
                  {filterCat&&<button onClick={()=>setFilterCat(null)} style={{...G,fontSize:10,color:T.inkMid,background:T.grayLight,border:"none",borderRadius:6,padding:"2px 8px",cursor:"pointer"}}>✕</button>}
                </div>
              </div>
              <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"0 20px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0",borderBottom:`1px solid ${T.border}`}}>
                  <span style={{...G,fontSize:12,fontWeight:700,color:T.ink}}>{isAtual?`${filtered.length} de ${displayItens.length} lançamentos`:`Fatura ${fatura?.mes} · ${fatura?.pago?"Paga":"Pendente"}`}</span>
                  {filtered.length>0&&<button onClick={()=>setExpandedDate(expandedDate===null?grouped[0]?.[0]:null)} style={{...G,fontSize:11,color:T.blue,background:"none",border:"none",cursor:"pointer"}}>{expandedDate===null?"Recolher tudo":"Expandir tudo"}</button>}
                </div>
                {isAtual&&grouped.length>0?pagedGroups.map(([date,items])=><DateGroup key={date} date={date} items={items}/>)
                  :isAtual?<div style={{textAlign:"center",padding:"36px 0"}}><div style={{fontSize:26,marginBottom:8}}>🔍</div><div style={{...G,fontSize:13,color:T.inkMid}}>Nenhum resultado</div></div>
                  :<div style={{textAlign:"center",padding:"36px 0"}}><div style={{fontSize:26,marginBottom:8}}>📁</div><div style={{...G,fontSize:13,color:T.inkMid}}>Fatura {fatura?.mes} · {fmtBRL((fatura?.val||0))}</div><div style={{...G,fontSize:11,color:T.inkLight,marginTop:4}}>Detalhes disponíveis apenas na fatura atual</div></div>}
                {isAtual&&filtered.length>0&&(
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 0",borderTop:`1px solid ${T.border}`,marginTop:4}}>
                    <span style={{...G,fontSize:12,color:T.inkMid}}>
                      {visibleItems < totalItems ? `${visibleItems} de ${totalItems} lançamentos` : `${totalItems} lançamentos`}
                    </span>
                    <span style={{...M_MONO,...NUM,fontSize:16,fontWeight:800,color:T.ink}}>{fmtBRL(filtered.reduce((s,i)=>s+i.val,0))}</span>
                  </div>
                )}
                {hasMoreGroups&&isAtual&&(
                  <button onClick={()=>setVisibleGroups(v=>v+PAGE_GROUPS)}
                    style={{...G,width:"calc(100% + 40px)",marginLeft:"-20px",padding:"12px",background:T.bg,
                      border:"none",borderTop:`1px solid ${T.border}`,
                      fontSize:12,fontWeight:700,color:T.inkMid,cursor:"pointer",
                      display:"flex",alignItems:"center",justifyContent:"center",gap:7,transition:"background 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.background=T.grayLight}
                    onMouseLeave={e=>e.currentTarget.style.background=T.bg}>
                    <ChevronDown size={14}/> Mostrar mais {Math.min(PAGE_GROUPS, grouped.length-visibleGroups)} grupos · {grouped.slice(visibleGroups,visibleGroups+PAGE_GROUPS).reduce((s,[,items])=>s+items.length,0)} lançamentos
                  </button>
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
    {showAddCard && (
      <div style={{ position:"fixed", inset:0, zIndex:400, overflow:"hidden", background:"rgba(0,0,0,0.4)", display:"flex", alignItems:isMobile?"flex-end":"center", justifyContent:"center", padding:isMobile?0:24 }}
        onClick={() => setShowAddCard(false)}>
        <div style={{ width:"100%", maxWidth:isMobile?"100%":440, background:T.surface, borderRadius:isMobile?"18px 18px 0 0":18, padding:isMobile?"20px 20px 32px":"26px 26px 22px", boxShadow:"0 -4px 40px rgba(0,0,0,0.15)" }}
          onClick={e => e.stopPropagation()}>
          {isMobile && <div style={{ width:36, height:4, background:T.border, borderRadius:99, margin:"0 auto 18px" }}/>}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ ...G, fontSize:16, fontWeight:800, color:T.ink }}>Adicionar cartão</div>
            {!isMobile && <button onClick={() => setShowAddCard(false)} style={{ background:"none", border:"none", cursor:"pointer", color:T.inkLight, fontSize:22 }}>×</button>}
          </div>
          <div style={{ ...G, fontSize:13, color:T.inkMid, lineHeight:1.65, marginBottom:14 }}>
            Adicione seu cartão de crédito para rastrear faturas, parcelas e assinaturas automaticamente.
          </div>
          <div style={{ ...G, fontSize:13, color:T.inkMid, background:T.grayLight, borderRadius:10, padding:"14px 16px", textAlign:"center", lineHeight:1.7, marginBottom:14 }}>
            🚧 O cadastro de cartão via app estará disponível em breve. Por enquanto, adicione transações de cartão manualmente em <strong>Transações</strong>.
          </div>
          <button onClick={() => setShowAddCard(false)} style={{ ...G, width:"100%", padding:"11px", borderRadius:11, border:`1px solid ${T.border}`, background:"none", color:T.inkMid, fontSize:13, fontWeight:600, cursor:"pointer" }}>Entendido</button>
        </div>
      </div>
    )}
    </>
  );

  // ── Desktop return ───────────────────────────────────────────────────────
  return (
    <>
      <style>{`@keyframes drawerIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
      <ParcelaModal/><ExportModal/><AddCardSheet/>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <PageTitle sans="Meus" serif="Cartões"/>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={()=>onNovaItem&&onNovaItem(cardId)}
            style={{...G,display:"flex",alignItems:"center",gap:6,background:T.green,border:"none",borderRadius:10,padding:"9px 16px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer"}}>
            <Plus size={14}/> Novo item
          </button>
          <button onClick={()=>setAddCardSheet(true)}
            style={{...G,display:"flex",alignItems:"center",gap:6,background:T.ink,border:"none",borderRadius:10,padding:"9px 16px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer"}}>
            <CreditCard size={14}/> + Cartão
          </button>
        </div>
      </div>

      {/* Card carousel */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:"flex", gap:14, overflowX:"auto", paddingBottom:8, paddingTop:6, scrollbarWidth:"none" }}>
          {CARDS.map(c=><CardVisual key={c.id} c={c} selected={c.id===cardId} size="md"/>)}
          <div onClick={()=>setAddCardSheet(true)} style={{ width:200, height:Math.round(200/1.586), borderRadius:16, flexShrink:0, border:`2px dashed ${T.border}`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6, cursor:"pointer", background:T.surface }}>
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
          <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:20,alignItems:"start"}}>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,display:"flex",alignItems:"center",gap:8,background:T.surface,border:`1px solid ${T.border}`,borderRadius:9,padding:"8px 12px"}}>
                  <Search size={13} color={T.inkLight}/>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar lançamentos..." style={{...G,flex:1,border:"none",outline:"none",background:"transparent",fontSize:13,color:T.ink}}/>
                  {search&&<button onClick={()=>setSearch("")} style={{background:"none",border:"none",cursor:"pointer",padding:2}}><X size={13} color={T.inkLight}/></button>}
                </div>
                <div style={{display:"flex",gap:5}}>
                  {Object.entries(CAT_COLORS_CARD).filter(([c])=>displayItens.some(i=>i.cat===c)).map(([c,color])=>(
                    <button key={c} onClick={()=>setFilterCat(filterCat===c?null:c)} title={c} style={{width:20,height:20,borderRadius:6,background:color,border:`2.5px solid ${filterCat===c?T.ink:"transparent"}`,cursor:"pointer",opacity:filterCat&&filterCat!==c?0.25:1,transition:"all 0.15s"}}/>
                  ))}
                </div>
              </div>
              <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden"}}>
                {displayItens.length===0
                  ? <div style={{...G,fontSize:13,color:T.inkLight,textAlign:"center",padding:"40px"}}>Nenhum lançamento{search?" para esta busca":""}</div>
                  : grouped.map(([date,items])=><DateGroup key={date} date={date} items={items}/>)}
                {hasMoreGroups&&isAtual&&(
                  <button onClick={()=>setVisibleGroups(v=>v+PAGE_GROUPS)} style={{...G,width:"calc(100% + 0px)",padding:"12px",borderTop:`1px solid ${T.border}`,background:T.bg,border:"none",fontSize:12,fontWeight:700,color:T.inkMid,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                    <ChevronDown size={14}/> Mostrar mais {Math.min(PAGE_GROUPS, grouped.length-visibleGroups)} grupos · {grouped.slice(visibleGroups,visibleGroups+PAGE_GROUPS).reduce((s,[,items])=>s+items.length,0)} lançamentos
                  </button>
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

/* ─── ORÇAMENTOS DATA ────────────────────────────────────── */
const BUDGET_CONFIG = { total: 6500, modo: "top-down" };

const CATS_ORC_INIT = [
  { id:"alimentacao", nome:"Alimentação",  emoji:"🛒", limite:1200, gasto:1046, membros:["A","M"], envelopes:[
      { id:"mercado",      nome:"Mercado",       limite:800, gasto:720 },
      { id:"restaurantes", nome:"Restaurantes",  limite:400, gasto:326 }]},
  { id:"moradia",    nome:"Moradia",       emoji:"🏠", limite:1500, gasto:1500, membros:["A","M"], envelopes:[] },
  { id:"transporte", nome:"Transporte",    emoji:"🚗", limite:600,  gasto:320,  membros:["A"], envelopes:[
      { id:"combustivel", nome:"Combustível", limite:300, gasto:180 },
      { id:"apps",        nome:"Uber / 99",   limite:200, gasto:120 },
      { id:"manutencao",  nome:"Manutenção",  limite:100, gasto:20  }]},
  { id:"saude",      nome:"Saúde",         emoji:"💊", limite:400,  gasto:180,  membros:["A","M"], envelopes:[] },
  { id:"lazer",      nome:"Lazer",         emoji:"🎮", limite:500,  gasto:388,  membros:["A","M"], envelopes:[
      { id:"streaming", nome:"Streaming", limite:200, gasto:188 },
      { id:"saidas",    nome:"Saídas",    limite:300, gasto:200 }]},
  { id:"educacao",   nome:"Educação",      emoji:"📚", limite:800,  gasto:487,  membros:["A"],     envelopes:[] },
  { id:"vestuario",  nome:"Vestuário",     emoji:"👕", limite:300,  gasto:160,  membros:["M"],     envelopes:[] },
  { id:"outros",     nome:"Outros",        emoji:"📦", limite:200,  gasto:300,  membros:["A","M"], envelopes:[] },
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
const OrcamentosPage = ({ onNav, isMobile = false, autoOpenAdd = false, dataMode = "mock", extraRecs = [], orgTipo = "familia" }) => {
  const [month,    setMonth]    = useState(2);
  const [showAdd,  setShowAdd]  = useState(autoOpenAdd);
  const [addSelId,   setAddSelId]   = useState(null);
  const [addLimStr,  setAddLimStr]  = useState("");
  const resetAddForm = () => { setAddSelId(null); setAddLimStr(""); };

  const [expanded, setExpanded] = useState({});
  const [histOpen, setHistOpen] = useState(true);
  const [cats,     setCats]     = useState(() => dataMode === "empty" ? [] : CATS_ORC_INIT);
  const [budget,   setBudget]   = useState(BUDGET_CONFIG.total);

  const MONTHS_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  const totalGasto  = cats.reduce((s, c) => s + c.gasto, 0);
  const totalDisp   = budget - totalGasto;
  const totalPct    = Math.round(totalGasto / budget * 100);
  const alertCount  = cats.filter(c => c.gasto / c.limite >= 0.85).length;
  const healthLabel = alertCount === 0 ? "Saudável" : alertCount <= 2 ? "Atenção" : "Crítico";
  const healthColor = alertCount === 0 ? T.green : alertCount <= 2 ? T.amber : T.red;

  const pct = (g, l) => Math.min(100, Math.round(g / l * 100));
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
              <div style={{ width:isMobile?30:38, height:isMobile?30:38, borderRadius:isMobile?8:10, background:bLight, display:"flex", alignItems:"center", justifyContent:"center", fontSize:isMobile?15:18, flexShrink:0 }}>{cat.emoji}</div>
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
              <button onClick={e => { e.stopPropagation(); onNav && onNav("transacoes", { filterCat: cat.id }); }}
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
          <button style={{ ...G, fontSize:10, fontWeight:600, color:T.blue, background:"none", border:`1px solid ${T.border}`, borderRadius:7, padding:"4px 10px", cursor:"pointer" }}>Editar total</button>
        </div>
        <div style={{ height:10, background:T.grayLight, borderRadius:99, overflow:"hidden", position:"relative", marginBottom:12 }}>
          {cats.map((c, i) => {
            const w = (c.limite / budget * 100).toFixed(2);
            const seg = <div key={c.id} style={{ position:"absolute", top:0, left:`${offset}%`, width:`${w}%`, height:"100%", background:CAT_COLORS[i], transition:"width 0.4s" }} title={`${c.nome}: ${fmtBRL(c.limite)}`} />;
            offset += parseFloat(w);
            return seg;
          })}
        </div>
        <div style={{ display:isMobile?"grid":"flex", gridTemplateColumns:isMobile?"1fr 1fr":undefined, gap:isMobile?6:10, flexWrap:"wrap" }}>
          {cats.map((c, i) => (
            <div key={c.id} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:8, height:8, borderRadius:2, background:CAT_COLORS[i], flexShrink:0 }} />
              <span style={{ ...G, fontSize:isMobile?9:10, color:T.inkMid }}>{c.nome}</span>
              {!isMobile && <span style={{ ...G, ...NUM, fontSize:10, fontWeight:700, color:T.ink }}>{fmtBRL(c.limite)}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const Historico = () => {
    const maxVal = Math.max(...HIST_ORC.map(h => Math.max(h.spent, h.budget)));
    return (
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden" }}>
        <div onClick={() => setHistOpen(o => !o)}
          style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", cursor:"pointer", userSelect:"none" }}
          onMouseEnter={e => e.currentTarget.style.background = T.bg}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <BarChart2 size={14} color={T.inkMid} />
            <span style={{ ...G, fontSize:13, fontWeight:700, color:T.ink }}>Histórico dos últimos 6 meses</span>
          </div>
          <span style={{ ...G, fontSize:11, fontWeight:600, color:T.blue, display:"flex", alignItems:"center", gap:4 }}>
            {histOpen ? "Recolher" : "Ver histórico"} {histOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </span>
        </div>
        <CollapsibleSection open={histOpen}>
          <div style={{ padding:"0 20px 20px", borderTop:`1px solid ${T.border}` }}>
            <div style={{ display:"flex", alignItems:"flex-end", gap:isMobile?8:16, paddingTop:16 }}>
              {HIST_ORC.map(h => {
                const sh = Math.round(h.spent  / maxVal * 68);
                const bh = Math.round(h.budget / maxVal * 68);
                const over = h.spent > h.budget;
                return (
                  <div key={h.m} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
                    <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:72 }}>
                      <div style={{ width:isMobile?11:14, height:bh, background:T.grayLight, borderRadius:"4px 4px 0 0", flexShrink:0 }} />
                      <div style={{ width:isMobile?11:14, height:sh, background:over?T.red:h.current?T.blue:T.ink, borderRadius:"4px 4px 0 0", flexShrink:0 }} />
                    </div>
                    <div style={{ ...G, fontSize:isMobile?8:9, fontWeight:600, color:h.current?T.blue:T.inkLight }}>{h.m}</div>
                    <div style={{ ...G, ...NUM, fontSize:isMobile?8:9, fontWeight:700, color:over?T.red:T.ink }}>{(h.spent/1000).toFixed(1)}k</div>
                  </div>
                );
              })}
              <div style={{ display:"flex", flexDirection:"column", gap:6, paddingLeft:8, paddingBottom:24 }}>
                {[{bg:T.grayLight,label:"Limite"},{bg:T.ink,label:"Gasto"}].map((x,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <div style={{ width:10, height:10, borderRadius:2, background:x.bg, border:i===0?`1px solid ${T.border}`:undefined }} />
                    <span style={{ ...G, fontSize:10, color:T.inkMid }}>{x.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      </div>
    );
  };



  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <PageTitle sans="Meus" serif="Orçamentos" />
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", border:`1px solid ${T.border}`, borderRadius:10, overflow:"hidden" }}>
            <button onClick={() => setMonth(m => (m+11)%12)} style={{ ...G, background:T.surface, border:"none", padding:"7px 12px", cursor:"pointer", color:T.inkMid, fontSize:14, fontWeight:600 }} onMouseEnter={e => e.currentTarget.style.background=T.grayLight} onMouseLeave={e => e.currentTarget.style.background=T.surface}>‹</button>
            <div style={{ ...G, padding:"7px 14px", fontSize:isMobile?12:13, fontWeight:700, color:T.ink, borderLeft:`1px solid ${T.border}`, borderRight:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>{isMobile?MONTHS_FULL[month].slice(0,3)+"/26":MONTHS_FULL[month]+" 2026"}</div>
            <button onClick={() => setMonth(m => (m+1)%12)} style={{ ...G, background:T.surface, border:"none", padding:"7px 12px", cursor:"pointer", color:T.inkMid, fontSize:14, fontWeight:600 }} onMouseEnter={e => e.currentTarget.style.background=T.grayLight} onMouseLeave={e => e.currentTarget.style.background=T.surface}>›</button>
          </div>
          <button onClick={() => setShowAdd(true)} style={{ ...G, display:"flex", alignItems:"center", gap:6, background:T.ink, border:"none", borderRadius:9, padding:"8px 14px", fontSize:12, fontWeight:700, color:"#fff", cursor:"pointer" }}>
            <Plus size={13} /> {isMobile?"Novo":"Novo Orçamento"}
          </button>
        </div>
      </div>
      {cats.length > 0 && <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:isMobile?10:12 }}>
        {[
          { label:"Total orçado",   val:fmtBRL(budget),     sub:"limite do mês",             color:T.ink },
          { label:"Gasto até hoje", val:fmtBRL(totalGasto), sub:`${totalPct}% do orçamento`, color:T.red },
          { label:"Disponível",     val:fmtBRL(totalDisp),  sub:"projeção fim do mês",        color:totalDisp>=0?T.green:T.red },
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
        const recVal = rec0 ? rec0.val : 0;
        const fmtRec = v => "R$ " + Math.abs(v).toLocaleString("pt-BR",{minimumFractionDigits:0});
        const sugs = recVal > 0 ? [
          { id:"moradia",     emoji:"🏠", nome:"Moradia",     pct:0.30, hint:"30% da renda" },
          { id:"alimentacao", emoji:"🍔", nome:"Alimentação", pct:0.15, hint:"15% da renda" },
          { id:"transporte",  emoji:"🚗", nome:"Transporte",  pct:0.10, hint:"10% da renda" },
        ] : [];
        return (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ textAlign:"center", padding:"8px 0 8px" }}>
              <div style={{ width:52, height:52, background:rec0?T.greenLight:T.grayLight, borderRadius:15, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, margin:"0 auto 13px" }}>📋</div>
              <div style={{ ...G, fontSize:16, fontWeight:800, color:T.ink, marginBottom:6 }}>{rec0 ? "Sugestões prontas para você" : "Nenhum orçamento ainda"}</div>
              <div style={{ ...G, fontSize:13, color:T.inkLight, lineHeight:1.65, maxWidth:340, margin:"0 auto" }}>
                {rec0 ? <span>Baseado na sua receita de <strong style={{ color:T.green }}>{fmtRec(recVal)}/mês</strong>, calculamos limites para as categorias que você selecionou.</span>
                      : "Defina limites por categoria para controlar quanto pode gastar em cada área."}
              </div>
            </div>
            {!rec0 && (
              <div style={{ display:"flex", alignItems:"flex-start", gap:10, background:T.blueLight, border:`1px solid ${T.blue}22`, borderRadius:10, padding:"11px 13px" }}>
                <span style={{ fontSize:16, flexShrink:0 }}>💡</span>
                <div style={{ flex:1 }}>
                  <div style={{ ...G, fontSize:12, fontWeight:700, color:T.ink, marginBottom:2 }}>Registre sua receita primeiro</div>
                  <div style={{ ...G, fontSize:11, color:T.inkMid, lineHeight:1.55 }}>Com o valor da sua renda, sugerimos limites automáticos por categoria (regra 50/30/20).</div>
                </div>
                <button onClick={()=>onNav("recorrencias")} style={{ ...G, fontSize:11, fontWeight:700, color:T.blue, background:"none", border:"none", cursor:"pointer", flexShrink:0 }}>Ir →</button>
              </div>
            )}
            {sugs.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {sugs.map(s=>(
                  <div key={s.id} style={{ display:"flex", alignItems:"center", gap:10, background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 13px" }}>
                    <span style={{ fontSize:20, flexShrink:0 }}>{s.emoji}</span>
                    <div style={{ flex:1 }}><div style={{ ...G, fontSize:12, fontWeight:700, color:T.ink }}>{s.nome}</div><div style={{ ...G, fontSize:10, color:T.inkLight }}>{s.hint}</div></div>
                    <div style={{ ...G, ...NUM, fontSize:12, fontWeight:700, color:T.inkMid, marginRight:8 }}>{fmtRec(Math.round(recVal*s.pct))}</div>
                    <button onClick={()=>{ const f=CATS_ORC_INIT.find(c=>c.id===s.id); if(f) setCats(prev=>[...prev,{...f,gasto:0,limite:Math.round(recVal*s.pct)}]); }} style={{ ...G, background:T.ink, color:"#fff", border:"none", borderRadius:7, padding:"5px 12px", fontSize:11, fontWeight:700, cursor:"pointer" }}>Usar</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display:"flex", gap:10 }}>
              {sugs.length > 0 && (
                <button onClick={()=>sugs.forEach(s=>{ const f=CATS_ORC_INIT.find(c=>c.id===s.id); if(f) setCats(prev=>prev.find(x=>x.id===s.id)?prev:[...prev,{...f,gasto:0,limite:Math.round(recVal*s.pct)}]); })} style={{ ...G, flex:2, padding:"11px", borderRadius:11, border:"none", background:T.ink, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", justifyContent:"center" }}>✓ Aplicar todos</button>
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
      {/* Novo Orçamento modal */}
      {showAdd && (() => {
        const available = CATS_ORC_INIT.filter(c => !cats.find(x => x.id === c.id));
        const selCat    = CATS_ORC_INIT.find(c => c.id === addSelId) || null;
        const limVal    = parseFloat((addLimStr||"0").replace(",",".")) || 0;
        const canSave   = addSelId !== null && limVal > 0;
        const handleSave = () => {
          if (!canSave) return;
          setCats(prev => [...prev, { ...selCat, gasto:0, membros:[], envelopes:[], limite:limVal }]);
          resetAddForm();
          setShowAdd(false);
        };
        const isSheet = isMobile;
        return (
          <div style={{ position:"fixed", inset:0, zIndex:400, overflow:"hidden",
            background:"rgba(0,0,0,0.4)",
            display:"flex",
            alignItems: isSheet ? "flex-end" : "center",
            justifyContent:"center",
            padding: isSheet ? 0 : 24 }}
            onClick={() => { setShowAdd(false); resetAddForm(); }}>
            <div style={{ width:"100%", maxWidth: isSheet ? "100%" : 460,
              background:T.surface,
              borderRadius: isSheet ? "18px 18px 0 0" : 18,
              padding: isSheet ? "20px 20px 32px" : "26px 26px 22px",
              boxShadow:"0 -4px 40px rgba(0,0,0,0.15)" }}
              onClick={e => e.stopPropagation()}>
              {isSheet && <div style={{ width:36, height:4, background:T.border, borderRadius:99, margin:"0 auto 18px" }}/>}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
                <div style={{ ...G, fontSize:16, fontWeight:800, color:T.ink }}>Novo Orçamento</div>
                {!isSheet && (
                  <button onClick={() => { setShowAdd(false); resetAddForm(); }}
                    style={{ background:"none", border:"none", cursor:"pointer", color:T.inkLight, fontSize:22, lineHeight:1 }}>×</button>
                )}
              </div>
              <div style={{ marginBottom:16 }}>
                <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>
                  Selecione a categoria
                </div>
                {available.length === 0 ? (
                  <div style={{ ...G, fontSize:13, color:T.inkMid, padding:"14px 0", textAlign:"center", lineHeight:1.7 }}>
                    Todas as categorias já têm orçamento. Edite os limites diretamente nos cards abaixo.
                  </div>
                ) : (
                  <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap:8 }}>
                    {available.map(c => (
                      <button key={c.id}
                        onClick={() => { setAddSelId(c.id); setAddLimStr(String(c.limite)); }}
                        style={{ ...G, display:"flex", alignItems:"center", gap:9,
                          padding:"11px 13px", borderRadius:11, textAlign:"left",
                          border:`1.5px solid ${addSelId===c.id ? T.ink : T.border}`,
                          background: addSelId===c.id ? T.ink : T.surface,
                          cursor:"pointer", transition:"all 0.12s" }}>
                        <span style={{ fontSize:20, flexShrink:0 }}>{c.emoji}</span>
                        <span style={{ ...G, fontSize:12, fontWeight:700,
                          color: addSelId===c.id ? "#fff" : T.ink }}>{c.nome}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selCat && (
                <div style={{ marginBottom:20 }}>
                  <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>
                    Limite mensal — {selCat.nome}
                  </div>
                  <div style={{ position:"relative", display:"flex", alignItems:"center" }}>
                    <span style={{ ...G, position:"absolute", left:13, fontSize:14, fontWeight:700, color:T.inkLight, pointerEvents:"none" }}>R$</span>
                    <input value={addLimStr} onChange={e => setAddLimStr(e.target.value)}
                      placeholder="0,00" type="text" inputMode="decimal" autoFocus
                      style={{ ...G, ...NUM, width:"100%", padding:"12px 14px 12px 36px", fontSize:15,
                        color:T.ink, background:T.bg, border:`1.5px solid ${T.ink}`, borderRadius:10, outline:"none" }}
                      onKeyDown={e => { if (e.key==="Enter") handleSave(); }}/>
                  </div>
                </div>
              )}
              <div style={{ display:"flex", gap:10, marginTop: selCat ? 0 : 4 }}>
                <button onClick={() => { setShowAdd(false); resetAddForm(); }}
                  style={{ ...G, flex:1, padding:"11px", borderRadius:11, border:`1px solid ${T.border}`,
                    background:"none", color:T.inkMid, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                  Cancelar
                </button>
                {available.length > 0 && (
                  <button onClick={handleSave} disabled={!canSave}
                    style={{ ...G, flex:2, padding:"11px", borderRadius:11, border:"none",
                      background: canSave ? T.ink : T.inkGhost, color:"#fff",
                      fontSize:13, fontWeight:700, cursor: canSave ? "pointer" : "not-allowed",
                      opacity: canSave ? 1 : 0.5, transition:"all 0.15s" }}>
                    Criar orçamento
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
/* ─── CONFIGURAÇÕES PAGE ─────────────────────────────────── */
const ConfiguracoesPage = ({ onNav, isMobile = false, onboardingData = null, dataMode = "mock" }) => {
  const [subPage, setSubPage] = useState("perfil");
  const [senhaOpen, setSenhaOpen] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConf, setSenhaConf] = useState("");
  const [senhaOk, setSenhaOk] = useState(false);
  const [whatsNums, setWhatsNums] = useState([
    { id: 1, num: "+55 11 99999-0001", nome: "Aislan (pessoal)", status: "ativo",    ultimo: "há 2h" },
    { id: 2, num: "+55 11 98888-0002", nome: "Ana (família)",     status: "ativo",    ultimo: "há 1d" },
  ]);
  const [novoNum, setNovoNum] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [addNumOpen, setAddNumOpen] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#2563EB");

  const orgNome  = onboardingData?.orgNome  || "Família Alves";
  const orgTipo  = onboardingData?.orgTipo  || "familia";
  const membros  = onboardingData?.membros?.filter(m => m.trim()) || [];

  const CAT_LIST = [
    { id:"alim",  name:"Alimentação",           color:"#059669", tags:["mercado","restaurante","delivery"] },
    { id:"trans", name:"Transporte",             color:"#2563EB", tags:["combustível","uber","ônibus"] },
    { id:"saude", name:"Saúde",                  color:"#DC2626", tags:["farmácia","médico","plano"] },
    { id:"edu",   name:"Educação",               color:"#7C3AED", tags:["curso","livro"] },
    { id:"lazer", name:"Lazer & Entretenimento", color:"#D97706", tags:["streaming","viagem","bar"] },
    { id:"comp",  name:"Compras Pessoais",        color:"#DC2626", tags:["roupa","eletrônico"] },
    { id:"serv",  name:"Serviços",               color:"#6B7280", tags:[] },
    { id:"assin", name:"Assinaturas & Software",  color:"#0891B2", tags:["saas","app"] },
    { id:"imp",   name:"Impostos & Taxas",        color:"#D97706", tags:["imposto","taxa"] },
    { id:"mor",   name:"Moradia",                color:"#6B7280", tags:["aluguel","energia","água"] },
    { id:"rec",   name:"Receita",                color:"#059669", tags:["salário","freelance"] },
  ];
  const [cats, setCats] = useState(CAT_LIST);
  const [catSearch, setCatSearch] = useState("");
  const [expandedCat, setExpandedCat] = useState(null);
  const [newTagInputs, setNewTagInputs] = useState({});
  const filteredCats = cats.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()));

  const fmtBRL = v => "R$\u00a0" + v.toLocaleString("pt-BR", { minimumFractionDigits:2 });

  // ── Sub-nav structure ──────────────────────────────────────────────────────
  const SUB_NAV = [
    { group: "Conta", items: [
      { id:"perfil",     label:"Meu Perfil",        Icon: Settings },
      { id:"seguranca",  label:"Segurança",          Icon: Lock },
    ]},
    { group: "Workspace", items: [
      { id:"organizacao",label:"Organização",        Icon: Building2 },
      { id:"membros",    label:"Membros",            Icon: Users },
      { id:"categorias", label:"Categorias e Tags",  Icon: Tag },
    ]},
    { group: "Integrações", items: [
      { id:"whatsapp",   label:"Assistente WhatsApp",Icon: MessageCircle },
    ]},
    { group: "Plano", items: [
      { id:"assinatura", label:"Assinatura",         Icon: CreditCard },
    ]},
  ];

  const fmtS = (id) => {
    const titles = {
      perfil:"Meu Perfil", seguranca:"Segurança", organizacao:"Organização",
      membros:"Membros", categorias:"Categorias e Tags",
      whatsapp:"Assistente WhatsApp", assinatura:"Assinatura",
    };
    return titles[id] || id;
  };

  // ── Shared UI helpers ──────────────────────────────────────────────────────
  const SectionCard = ({ children, style={} }) => (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, overflow:"hidden", width:"100%", ...style }}>
      {children}
    </div>
  );
  const SectionHeader = ({ icon, title, sub }) => (
    <div style={{ padding:"20px 24px 14px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:12 }}>
      <div style={{ width:36, height:36, borderRadius:10, background:T.blueLight, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        {icon}
      </div>
      <div>
        <div style={{ ...G, fontSize:16, fontWeight:800, color:T.ink }}>{title}</div>
        {sub && <div style={{ ...G, fontSize:12, color:T.inkMid, marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  );
  const FieldRow = ({ label, value, action }) => (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 24px", borderBottom:`1px solid ${T.border}` }}>
      <div>
        <div style={{ ...G, fontSize:11, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>{label}</div>
        <div style={{ ...G, fontSize:14, color:T.ink }}>{value}</div>
      </div>
      {action}
    </div>
  );
  const BtnPrimary = ({ onClick, children, small }) => (
    <button onClick={onClick} style={{ ...G, background:T.ink, color:"#fff", border:"none", borderRadius:9, padding:small?"7px 14px":"9px 18px", fontSize:small?11:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}>
      {children}
    </button>
  );
  const BtnGhost = ({ onClick, children, danger }) => (
    <button onClick={onClick} style={{ ...G, background:"none", color:danger?T.red:T.inkMid, border:`1px solid ${danger?T.red+"44":T.border}`, borderRadius:9, padding:"7px 14px", fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap" }}>
      {children}
    </button>
  );

  // ── Content renderers ──────────────────────────────────────────────────────
  const renderPerfil = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <SectionCard>
        {/* Banner */}
        <div style={{ height:72, background:`linear-gradient(135deg, #1A1A2E 0%, #2563EB 60%, #7C3AED 100%)`, position:"relative" }}/>
        {/* Avatar + info */}
        <div style={{ padding:"0 24px 20px", position:"relative" }}>
          <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:14 }}>
            <div style={{ width:64, height:64, borderRadius:9999, background:`linear-gradient(135deg, ${T.blue}, ${T.purple})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:800, color:"#fff", border:"3px solid #fff", marginTop:-32, flexShrink:0 }}>AS</div>
            <BtnGhost onClick={() => {}} danger><LogOut size={13}/> Sair da conta</BtnGhost>
          </div>
          <div style={{ ...G, fontSize:18, fontWeight:800, color:T.ink, marginBottom:3 }}>Aislan Santos</div>
          <div style={{ ...G, fontSize:13, color:T.inkMid, marginBottom:10 }}>aislan@email.com</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <span style={{ ...G, fontSize:11, fontWeight:700, background:T.purpleLight, color:T.purple, padding:"3px 10px", borderRadius:99 }}>PREMIUM</span>
            <span style={{ ...G, fontSize:11, fontWeight:600, background:T.grayLight, color:T.inkMid, padding:"3px 10px", borderRadius:99 }}>Administrador</span>
            <span style={{ ...G, fontSize:11, color:T.inkLight, padding:"3px 10px" }}>Membro desde 04/03/2026</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeader icon={<Settings size={16} color={T.blue}/>} title="Informações da conta" sub="Dados pessoais e de acesso"/>
        <FieldRow label="Nome completo" value="Aislan Santos" action={<BtnGhost onClick={()=>{}}>Editar</BtnGhost>}/>
        <FieldRow label="E-mail" value="aislan@email.com" action={<BtnGhost onClick={()=>{}}>Alterar</BtnGhost>}/>
        <FieldRow label="Fuso horário" value="(UTC-3) Brasília" action={<BtnGhost onClick={()=>{}}>Editar</BtnGhost>}/>
        <div style={{ padding:"13px 24px" }}>
          <div style={{ ...G, fontSize:11, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>Idioma</div>
          <div style={{ ...G, fontSize:14, color:T.ink }}>Português (Brasil)</div>
        </div>
      </SectionCard>
    </div>
  );

  const renderSeguranca = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <SectionCard>
        <SectionHeader icon={<Lock size={16} color={T.blue}/>} title="Segurança" sub="Gerencie o acesso à sua conta"/>
        <div style={{ padding:"16px 24px", borderBottom:`1px solid ${T.border}` }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: senhaOpen ? 16 : 0 }}>
            <div>
              <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink, marginBottom:2 }}>Senha</div>
              <div style={{ ...G, fontSize:12, color:T.inkMid }}>Última alteração: nunca</div>
            </div>
            <BtnGhost onClick={() => setSenhaOpen(o => !o)}><Key size={12}/> Alterar Senha</BtnGhost>
          </div>
          {senhaOpen && (
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:16, paddingTop:16, borderTop:`1px solid ${T.border}` }}>
              {[["Senha atual", senhaAtual, setSenhaAtual],["Nova senha", senhaNova, setSenhaNova],["Confirmar nova senha", senhaConf, setSenhaConf]].map(([label, val, set]) => (
                <div key={label}>
                  <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>{label}</div>
                  <input type="password" value={val} onChange={e => set(e.target.value)} placeholder="••••••••"
                    style={{ ...G, width:"100%", padding:"10px 13px", border:`1.5px solid ${T.border}`, borderRadius:9, fontSize:13, color:T.ink, background:T.bg, outline:"none" }}/>
                </div>
              ))}
              <div style={{ display:"flex", gap:10, marginTop:4 }}>
                <BtnGhost onClick={() => { setSenhaOpen(false); setSenhaAtual(""); setSenhaNova(""); setSenhaConf(""); }}>Cancelar</BtnGhost>
                <BtnPrimary onClick={() => { setSenhaOk(true); setSenhaOpen(false); setSenhaAtual(""); setSenhaNova(""); setSenhaConf(""); setTimeout(()=>setSenhaOk(false),3000); }}>
                  {senhaOk ? <><CheckCircle2 size={13}/> Salvo!</> : "Salvar senha"}
                </BtnPrimary>
              </div>
            </div>
          )}
        </div>
        <div style={{ padding:"14px 24px", borderBottom:`1px solid ${T.border}` }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink, marginBottom:2 }}>Autenticação em dois fatores</div>
              <div style={{ ...G, fontSize:12, color:T.inkMid }}>Adicione uma camada extra de proteção</div>
            </div>
            <span style={{ ...G, fontSize:11, fontWeight:700, background:T.amberLight, color:T.amber, padding:"3px 10px", borderRadius:99 }}>Desativado</span>
          </div>
        </div>
        <div style={{ padding:"14px 24px" }}>
          <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink, marginBottom:10 }}>Sessões ativas</div>
          {[
            { device:"Chrome — macOS", ip:"189.6.xxx.xxx", last:"Agora", current:true },
            { device:"Safari — iPhone 15", ip:"189.6.xxx.xxx", last:"há 3h", current:false },
          ].map((s, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom: i===0 ? `1px solid ${T.border}` : "none" }}>
              <div style={{ width:36, height:36, borderRadius:9, background:T.grayLight, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Smartphone size={16} color={T.inkMid}/>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ ...G, fontSize:12, fontWeight:600, color:T.ink }}>{s.device} {s.current && <span style={{ ...G, fontSize:10, fontWeight:700, background:T.greenLight, color:T.green, padding:"1px 7px", borderRadius:99, marginLeft:6 }}>atual</span>}</div>
                <div style={{ ...G, fontSize:11, color:T.inkLight }}>{s.ip} · {s.last}</div>
              </div>
              {!s.current && <BtnGhost danger onClick={()=>{}}>Revogar</BtnGhost>}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );

  const renderOrganizacao = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <SectionCard>
        <SectionHeader icon={<Building2 size={16} color={T.blue}/>} title="Organização" sub="Gerencie seu espaço de trabalho"/>
        <FieldRow label="Nome" value={orgNome} action={<BtnGhost onClick={()=>{}}>Editar</BtnGhost>}/>
        <FieldRow label="Tipo" value={orgTipo === "negocio" ? "Negócio" : orgTipo === "casal" ? "Casal" : orgTipo === "familia" ? "Família" : "Pessoal"} action={null}/>
        <FieldRow label="ID da organização" value={<span style={{ ...G, fontFamily:"'Geist Mono', monospace", fontSize:12, color:T.inkLight }}>finly-{orgNome.toLowerCase().replace(/\s+/g,"-")}-001</span>} action={null}/>
        <div style={{ padding:"13px 24px" }}>
          <div style={{ ...G, fontSize:11, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>Status</div>
          <span style={{ ...G, fontSize:12, fontWeight:700, background:T.greenLight, color:T.green, padding:"3px 10px", borderRadius:99 }}>Ativa</span>
        </div>
      </SectionCard>
      <SectionCard>
        <div style={{ padding:"16px 24px", display:"flex", alignItems:"center", gap:10 }}>
          <AlertTriangle size={16} color={T.red}/>
          <div style={{ flex:1 }}>
            <div style={{ ...G, fontSize:13, fontWeight:700, color:T.red, marginBottom:2 }}>Zona de perigo</div>
            <div style={{ ...G, fontSize:12, color:T.inkMid }}>Ações irreversíveis que afetam toda a organização.</div>
          </div>
          <BtnGhost danger onClick={()=>{}}>Excluir organização</BtnGhost>
        </div>
      </SectionCard>
    </div>
  );

  const renderMembros = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <SectionCard>
        <div style={{ padding:"16px 24px 14px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:T.blueLight, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Users size={16} color={T.blue}/>
            </div>
            <div>
              <div style={{ ...G, fontSize:16, fontWeight:800, color:T.ink }}>Membros</div>
              <div style={{ ...G, fontSize:12, color:T.inkMid }}>Gerencie quem tem acesso à organização</div>
            </div>
          </div>
          <BtnPrimary small onClick={()=>{}}><UserPlus size={12}/> Convidar</BtnPrimary>
        </div>
        {/* Owner */}
        {[
          { initials:"AS", name:"Aislan Santos", email:"aislan@email.com", role:"Administrador", since:"04/03/2026", color:T.purple, self:true },
          ...(membros.length > 0 ? membros.map((m,i) => ({
            initials: m.substring(0,2).toUpperCase(), name:m, email:`${m.toLowerCase().replace(/\s+/g,".")}@email.com`,
            role:"Membro", since:"04/03/2026", color:T.blue, self:false
          })) : [
            { initials:"AS", name:"Ana Souza", email:"ana.souza@email.com", role:"Membro", since:"04/03/2026", color:T.green, self:false }
          ])
        ].map((m, i, arr) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 24px", borderBottom: i < arr.length-1 ? `1px solid ${T.border}` : "none" }}>
            <div style={{ width:38, height:38, borderRadius:9999, background:`linear-gradient(135deg,${m.color},${m.color}99)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:"#fff", flexShrink:0 }}>{m.initials}</div>
            <div style={{ flex:1 }}>
              <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink, display:"flex", alignItems:"center", gap:7 }}>
                {m.name} {m.self && <span style={{ ...G, fontSize:10, fontWeight:700, background:T.grayLight, color:T.inkLight, padding:"1px 7px", borderRadius:99 }}>você</span>}
              </div>
              <div style={{ ...G, fontSize:11, color:T.inkLight }}>{m.email}</div>
            </div>
            <span style={{ ...G, fontSize:11, fontWeight:600, background: m.role==="Administrador" ? T.purpleLight : T.grayLight, color: m.role==="Administrador" ? T.purple : T.inkMid, padding:"3px 10px", borderRadius:99 }}>{m.role}</span>
            {!m.self && <BtnGhost danger onClick={()=>{}}>Remover</BtnGhost>}
          </div>
        ))}
      </SectionCard>
    </div>
  );

  const renderCategorias = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <SectionCard>
        {/* Header */}
        <div style={{ padding: isMobile ? "14px 16px" : "16px 24px 14px",
          borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center",
          justifyContent:"space-between", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
            <div style={{ width:32, height:32, borderRadius:9, background:T.blueLight, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Tag size={14} color={T.blue}/>
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ ...G, fontSize:15, fontWeight:800, color:T.ink }}>Categorias e Tags</div>
              {!isMobile && <div style={{ ...G, fontSize:12, color:T.inkMid }}>Personalize como suas transações são organizadas</div>}
            </div>
          </div>
          <button onClick={() => { setNewCatName(""); setNewCatColor("#2563EB"); setEditCat("new"); }}
            style={{ ...G, flexShrink:0, background:T.ink, color:"#fff", border:"none", borderRadius:9,
              padding: isMobile ? "7px 12px" : "7px 14px", fontSize: isMobile ? 11 : 12,
              fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
            <Plus size={12}/>{isMobile ? "Nova" : "Nova categoria"}
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: isMobile ? "10px 16px" : "12px 24px", borderBottom:`1px solid ${T.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, background:T.bg,
            border:`1px solid ${T.border}`, borderRadius:9, padding:"8px 12px" }}>
            <Search size={13} color={T.inkLight}/>
            <input value={catSearch} onChange={e => setCatSearch(e.target.value)} placeholder="Buscar categoria…"
              style={{ ...G, flex:1, minWidth:0, border:"none", outline:"none",
                background:"transparent", fontSize:13, color:T.ink }}/>
          </div>
        </div>

        {/* New category form */}
        {editCat === "new" && (
          <div style={{ padding: isMobile ? "12px 16px" : "14px 24px",
            borderBottom:`1px solid ${T.border}`, background:T.blueLight }}>
            <div style={{ ...G, fontSize:10, fontWeight:700, color:T.blue,
              textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>Nova categoria</div>
            <div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", gap:8, alignItems: isMobile ? "stretch" : "center" }}>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nome da categoria" autoFocus
                style={{ ...G, flex:1, minWidth:0, padding:"9px 12px", border:`1.5px solid ${T.border}`,
                  borderRadius:9, fontSize:13, color:T.ink, background:T.surface, outline:"none" }}/>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
                <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)}
                  style={{ width:36, height:36, borderRadius:9, border:`1px solid ${T.border}`,
                    cursor:"pointer", padding:2, flexShrink:0 }}/>
                <button onClick={() => {
                  if (!newCatName.trim()) return;
                  setCats(prev => [...prev, { id:Date.now().toString(), name:newCatName.trim(), color:newCatColor, tags:[] }]);
                  setEditCat(null);
                }} style={{ ...G, background:T.ink, color:"#fff", border:"none", borderRadius:9,
                  padding:"8px 14px", fontSize:12, fontWeight:700, cursor:"pointer", flexShrink:0 }}>Salvar</button>
                <button onClick={() => setEditCat(null)}
                  style={{ ...G, background:"none", color:T.inkMid, border:`1px solid ${T.border}`,
                    borderRadius:9, padding:"8px 12px", fontSize:12, fontWeight:600, cursor:"pointer", flexShrink:0 }}>Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* Category + tags list */}
        {filteredCats.map((cat, i) => (
          <div key={cat.id} style={{ borderBottom: i < filteredCats.length-1 ? `1px solid ${T.border}` : "none" }}>

            {/* Category row */}
            <div style={{ display:"flex", alignItems:"center", gap:10,
              padding: isMobile ? "11px 16px" : "11px 24px" }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:cat.color, flexShrink:0 }}/>

              {editCat === cat.id ? (
                <div style={{ flex:1, display:"flex", flexDirection: isMobile ? "column" : "row",
                  gap:8, alignItems: isMobile ? "stretch" : "center", minWidth:0 }}>
                  <input value={newCatName} onChange={e => setNewCatName(e.target.value)} autoFocus
                    style={{ ...G, flex:1, minWidth:0, padding:"6px 10px", border:`1.5px solid ${T.blue}`,
                      borderRadius:8, fontSize:13, color:T.ink, background:T.surface, outline:"none" }}/>
                  <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
                    <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)}
                      style={{ width:30, height:30, borderRadius:7, border:`1px solid ${T.border}`, cursor:"pointer", padding:2 }}/>
                    <button onClick={() => { setCats(prev => prev.map(c => c.id===cat.id ? {...c, name:newCatName, color:newCatColor} : c)); setEditCat(null); }}
                      style={{ ...G, background:T.ink, color:"#fff", border:"none", borderRadius:8,
                        padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}>OK</button>
                    <button onClick={() => setEditCat(null)}
                      style={{ ...G, background:"none", color:T.inkMid, border:`1px solid ${T.border}`,
                        borderRadius:8, padding:"6px 10px", fontSize:12, cursor:"pointer" }}>×</button>
                  </div>
                </div>
              ) : (
                <>
                  <span style={{ ...G, fontSize:13, color:T.ink, flex:1, minWidth:0 }}>{cat.name}</span>
                  <button onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
                    style={{ ...G, display:"flex", alignItems:"center", gap:4, padding:"3px 8px", borderRadius:99,
                      background: expandedCat===cat.id ? `${cat.color}18` : T.grayLight,
                      border:`1px solid ${expandedCat===cat.id ? cat.color+"44" : T.border}`,
                      color: expandedCat===cat.id ? cat.color : T.inkMid,
                      fontSize:11, fontWeight:600, cursor:"pointer", flexShrink:0,
                      transition:"all 0.15s" }}>
                    <Hash size={10}/>
                    {(cat.tags||[]).length}
                  </button>
                  <button onClick={() => { setEditCat(cat.id); setNewCatName(cat.name); setNewCatColor(cat.color); }}
                    style={{ background:"none", border:"none", cursor:"pointer", padding:5, borderRadius:7, display:"flex", flexShrink:0 }}
                    onMouseEnter={e=>e.currentTarget.style.background=T.grayLight}
                    onMouseLeave={e=>e.currentTarget.style.background="none"}>
                    <Pencil size={13} color={T.inkLight}/>
                  </button>
                  <button onClick={() => setCats(prev => prev.filter(c => c.id !== cat.id))}
                    style={{ background:"none", border:"none", cursor:"pointer", padding:5, borderRadius:7, display:"flex", flexShrink:0 }}
                    onMouseEnter={e=>e.currentTarget.style.color=T.red}
                    onMouseLeave={e=>e.currentTarget.style.color=T.red+"66"}>
                    <Trash2 size={13} color={T.red+"66"}/>
                  </button>
                </>
              )}
            </div>

            {/* Tags panel */}
            {expandedCat === cat.id && (
              <div style={{ padding: isMobile ? "10px 16px 14px 36px" : "10px 24px 14px 44px",
                background:`${cat.color}08`, borderTop:`1px solid ${cat.color}22` }}>
                <div style={{ ...G, fontSize:10, fontWeight:700, color:cat.color,
                  textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>
                  Tags de {cat.name}
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                  {(cat.tags||[]).map((tag, ti) => (
                    <span key={ti} style={{ ...G, display:"flex", alignItems:"center", gap:5, fontSize:12,
                      background:T.surface, border:`1px solid ${T.border}`, borderRadius:99,
                      padding:"4px 10px", color:T.inkMid }}>
                      #{tag}
                      <button onClick={() => setCats(prev => prev.map(c =>
                          c.id===cat.id ? {...c, tags:(c.tags||[]).filter((_,j)=>j!==ti)} : c))}
                        style={{ background:"none", border:"none", cursor:"pointer", padding:0, lineHeight:1,
                          color:T.inkGhost, fontSize:14, display:"flex", alignItems:"center" }}>×</button>
                    </span>
                  ))}
                  {(cat.tags||[]).length === 0 && (
                    <span style={{ ...G, fontSize:12, color:T.inkLight, fontStyle:"italic" }}>
                      Nenhuma tag ainda
                    </span>
                  )}
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <div style={{ flex:1, display:"flex", alignItems:"center", gap:6, background:T.surface,
                    border:`1.5px solid ${T.border}`, borderRadius:9, padding:"7px 12px", minWidth:0 }}>
                    <span style={{ ...G, fontSize:12, color:T.inkLight, flexShrink:0 }}>#</span>
                    <input
                      value={newTagInputs[cat.id] || ""}
                      onChange={e => setNewTagInputs(p => ({...p, [cat.id]: e.target.value}))}
                      onKeyDown={e => {
                        if (e.key !== "Enter") return;
                        const tag = (newTagInputs[cat.id]||"").trim().toLowerCase().replace(/\s+/g, "-");
                        if (!tag || (cat.tags||[]).includes(tag)) return;
                        setCats(prev => prev.map(c => c.id===cat.id ? {...c, tags:[...(c.tags||[]), tag]} : c));
                        setNewTagInputs(p => ({...p, [cat.id]: ""}));
                      }}
                      placeholder="nova tag (Enter)"
                      style={{ ...G, flex:1, minWidth:0, border:"none", outline:"none",
                        background:"transparent", fontSize:12, color:T.ink }}/>
                  </div>
                  <button
                    onClick={() => {
                      const tag = (newTagInputs[cat.id]||"").trim().toLowerCase().replace(/\s+/g, "-");
                      if (!tag || (cat.tags||[]).includes(tag)) return;
                      setCats(prev => prev.map(c => c.id===cat.id ? {...c, tags:[...(c.tags||[]), tag]} : c));
                      setNewTagInputs(p => ({...p, [cat.id]: ""}));
                    }}
                    style={{ ...G, flexShrink:0, background:cat.color, color:"#fff", border:"none",
                      borderRadius:9, padding:"8px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                    + Tag
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {filteredCats.length === 0 && (
          <div style={{ ...G, fontSize:13, color:T.inkLight, textAlign:"center", padding:"24px" }}>
            Nenhuma categoria encontrada.
          </div>
        )}
      </SectionCard>
    </div>
  );

  const renderWhatsApp = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {/* Hero informativo */}
      <div style={{ background:"#1A1A2E", borderRadius:16, padding:"20px 24px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-40, right:-40, width:130, height:130, borderRadius:"50%", background:"rgba(37,99,235,0.12)" }}/>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
          <div style={{ width:40, height:40, borderRadius:11, background:"rgba(37,99,235,0.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <MessageCircle size={20} color="#60A5FA"/>
          </div>
          <div>
            <div style={{ ...G, fontSize:15, fontWeight:800, color:"#fff" }}>Assistente WhatsApp</div>
            <div style={{ ...G, fontSize:12, color:"rgba(255,255,255,0.45)" }}>Registre transações por voz ou texto</div>
          </div>
        </div>
        <div style={{ ...G, fontSize:13, color:"rgba(255,255,255,0.6)", lineHeight:1.7 }}>
          Envie uma mensagem para o número do assistente e ele registrará automaticamente a transação na sua conta finly. Os números autorizados abaixo têm acesso.
        </div>
        <div style={{ marginTop:14, display:"flex", alignItems:"center", gap:10, background:"rgba(255,255,255,0.06)", borderRadius:10, padding:"10px 14px" }}>
          <div style={{ ...G, fontSize:11, color:"rgba(255,255,255,0.4)", textTransform:"uppercase", letterSpacing:"0.07em" }}>Número do assistente</div>
          <div style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:14, fontWeight:700, color:"#60A5FA", flex:1 }}>+55 11 9xxxx-xxxx</div>
          <button style={{ ...G, fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.5)", background:"rgba(255,255,255,0.08)", border:"none", borderRadius:7, padding:"5px 10px", cursor:"pointer" }}>Copiar</button>
        </div>
      </div>

      <SectionCard>
        <div style={{ padding:"16px 24px 14px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ ...G, fontSize:15, fontWeight:800, color:T.ink }}>Números autorizados</div>
            <div style={{ ...G, fontSize:12, color:T.inkMid }}>{whatsNums.length} número{whatsNums.length !== 1 ? "s" : ""} com acesso</div>
          </div>
          <BtnPrimary small onClick={() => setAddNumOpen(o => !o)}><Plus size={12}/> Vincular número</BtnPrimary>
        </div>
        {/* Add form */}
        {addNumOpen && (
          <div style={{ padding:"14px 24px", borderBottom:`1px solid ${T.border}`, background:T.greenLight }}>
            <div style={{ ...G, fontSize:11, fontWeight:700, color:T.green, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>Novo número</div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              <input value={novoNum} onChange={e => setNovoNum(e.target.value)} placeholder="+55 11 99999-0000"
                style={{ ...G, flex:"1 1 160px", padding:"9px 12px", border:`1.5px solid ${T.border}`, borderRadius:9, fontSize:13, color:T.ink, background:T.surface, outline:"none" }}/>
              <input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Nome (ex: Ana — pessoal)"
                style={{ ...G, flex:"1 1 180px", padding:"9px 12px", border:`1.5px solid ${T.border}`, borderRadius:9, fontSize:13, color:T.ink, background:T.surface, outline:"none" }}/>
              <BtnPrimary small onClick={() => {
                if (!novoNum.trim()) return;
                setWhatsNums(prev => [...prev, { id:Date.now(), num:novoNum.trim(), nome:novoNome.trim()||novoNum, status:"pendente", ultimo:"nunca" }]);
                setNovoNum(""); setNovoNome(""); setAddNumOpen(false);
              }}>Vincular</BtnPrimary>
              <BtnGhost onClick={() => { setAddNumOpen(false); setNovoNum(""); setNovoNome(""); }}>Cancelar</BtnGhost>
            </div>
            <div style={{ ...G, fontSize:11, color:T.green, marginTop:8 }}>💡 O número receberá um código de verificação via WhatsApp.</div>
          </div>
        )}
        {/* Numbers list */}
        {whatsNums.map((n, i) => (
          <div key={n.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 24px", borderBottom: i < whatsNums.length-1 ? `1px solid ${T.border}` : "none" }}>
            <div style={{ width:38, height:38, borderRadius:9, background: n.status==="ativo" ? T.greenLight : T.amberLight, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Smartphone size={16} color={n.status==="ativo" ? T.green : T.amber}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink, marginBottom:2 }}>{n.nome}</div>
              <div style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:12, color:T.inkMid }}>{n.num}</div>
              <div style={{ ...G, fontSize:11, color:T.inkLight, marginTop:2 }}>Último uso: {n.ultimo}</div>
            </div>
            <span style={{ ...G, fontSize:11, fontWeight:700, background: n.status==="ativo" ? T.greenLight : T.amberLight, color: n.status==="ativo" ? T.green : T.amber, padding:"3px 10px", borderRadius:99 }}>
              {n.status === "ativo" ? "Ativo" : "Pendente"}
            </span>
            <BtnGhost danger onClick={() => setWhatsNums(prev => prev.filter(x => x.id !== n.id))}>Revogar</BtnGhost>
          </div>
        ))}
        {whatsNums.length === 0 && (
          <div style={{ ...G, fontSize:13, color:T.inkLight, textAlign:"center", padding:"28px" }}>Nenhum número vinculado.</div>
        )}
      </SectionCard>
    </div>
  );

  const renderAssinatura = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <SectionCard>
        <SectionHeader icon={<CreditCard size={16} color={T.purple}/>} title="Assinatura" sub="Detalhes do seu plano atual"/>
        <div style={{ padding:"16px 24px", borderBottom:`1px solid ${T.border}` }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <div>
              <div style={{ ...G, fontSize:16, fontWeight:800, color:T.ink, marginBottom:3 }}>Plano Premium</div>
              <div style={{ ...G, fontSize:13, color:T.inkMid }}>Ideal para famílias e pequenos negócios</div>
            </div>
            <span style={{ ...G, fontSize:12, fontWeight:700, background:T.greenLight, color:T.green, padding:"4px 12px", borderRadius:99 }}>Ativo</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[
              { label:"Transações/mês", used:47, limit:500, color:T.green },
              { label:"Organizações",   used:1,  limit:3,   color:T.blue },
              { label:"Membros",        used:2,  limit:10,  color:T.purple },
              { label:"Metas ativas",   used:3,  limit:20,  color:T.amber },
            ].map((k, i) => (
              <div key={i} style={{ background:T.bg, borderRadius:10, padding:"12px 14px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
                  <div style={{ ...G, fontSize:11, color:T.inkMid }}>{k.label}</div>
                  <div style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:12, fontWeight:700, color:T.ink }}>{k.used}<span style={{ color:T.inkLight }}>/{k.limit}</span></div>
                </div>
                <div style={{ height:4, background:T.grayLight, borderRadius:99, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${Math.min(100, k.used/k.limit*100)}%`, background:k.color, borderRadius:99 }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding:"14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ ...G, fontSize:13, color:T.inkMid }}>Próxima cobrança</div>
            <div style={{ ...G, fontSize:14, fontWeight:700, color:T.ink }}>R$ 29,90 em 04/04/2026</div>
          </div>
          <BtnGhost onClick={()=>{}}>Gerenciar assinatura</BtnGhost>
        </div>
      </SectionCard>
      {/* Upgrade card */}
      <div style={{ background:`linear-gradient(135deg, #1A1A2E, #312E81)`, borderRadius:16, padding:"20px 24px" }}>
        <div style={{ ...G, fontSize:14, fontWeight:800, color:"#fff", marginBottom:6 }}>🚀 Em breve — Plano Business</div>
        <div style={{ ...G, fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.65, marginBottom:14 }}>
          Relatórios avançados, IA preditiva, integração bancária automática e suporte prioritário.
        </div>
        <button style={{ ...G, background:"rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.7)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:9, padding:"8px 16px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
          Entrar na lista de espera →
        </button>
      </div>
    </div>
  );

  const RENDERERS = { perfil:renderPerfil, seguranca:renderSeguranca, organizacao:renderOrganizacao, membros:renderMembros, categorias:renderCategorias, whatsapp:renderWhatsApp, assinatura:renderAssinatura };

  return (
    <div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", gap:20, alignItems:"flex-start", width:"100%" }}>
      {/* Sub-nav */}
      {!isMobile && (
        <div style={{ width:200, flexShrink:0, display:"flex", flexDirection:"column", gap:4, position:"sticky", top:0 }}>
          {SUB_NAV.map(({ group, items }) => (
            <div key={group}>
              <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.1em", padding:"10px 10px 4px" }}>{group}</div>
              {items.map(({ id, label, Icon }) => {
                const active = subPage === id;
                return (
                  <button key={id} onClick={() => setSubPage(id)} style={{ ...G, width:"100%", display:"flex", alignItems:"center", gap:8, padding:"8px 10px", borderRadius:9, border:"none", cursor:"pointer", marginBottom:1, transition:"all 0.12s", background: active ? T.ink : "transparent", color: active ? "#fff" : T.inkMid, fontWeight: active ? 600 : 400, fontSize:13, textAlign:"left" }}>
                    <Icon size={13} strokeWidth={active ? 2.5 : 2}/>
                    {label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {/* Mobile sub-nav strip */}
      {isMobile && (
        <DragScrollTabs bg={T.bg}>
          {SUB_NAV.flatMap(g => g.items).map(({ id, label, Icon }) => {
            const active = subPage === id;
            return (
              <button key={id} onClick={() => setSubPage(id)}
                style={{ ...G, display:"flex", alignItems:"center", gap:6,
                  padding:"7px 14px", borderRadius:99,
                  border:`1px solid ${active ? T.ink : T.border}`,
                  background: active ? T.ink : T.surface,
                  color: active ? "#fff" : T.inkMid,
                  fontSize:12, fontWeight: active ? 700 : 400,
                  cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
                <Icon size={12}/>{label}
              </button>
            );
          })}
        </DragScrollTabs>
      )}
      {/* Content */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ ...G, fontSize:22, fontWeight:800, color:T.ink, marginBottom:4 }}>
          {fmtS(subPage)}
        </div>
        <div style={{ ...G, fontSize:13, color:T.inkMid, marginBottom:18 }}>Gerencie suas informações e configurações da conta</div>
        {(RENDERERS[subPage] || (() => null))()}
      </div>
    </div>
  );
};


/* ─── LOGIN PAGE ────────────────────────────────────────────── */
const LoginPage = ({ onLogin }) => {
  const [view,     setView]     = useState("login");   // "login" | "forgot" | "sent"
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleLogin = () => {
    if (!email || !password) { setError("Preencha e-mail e senha."); return; }
    setError(""); setLoading(true);
    setTimeout(() => { setLoading(false); onLogin(); }, 900);
  };

  const handleForgot = () => {
    if (!email) { setError("Informe seu e-mail."); return; }
    setError(""); setLoading(true);
    setTimeout(() => { setLoading(false); setView("sent"); }, 800);
  };

  const maskEmail = (e) => {
    const [u, d] = e.split("@");
    if (!d) return e;
    return u.slice(0,2) + "•".repeat(Math.max(1, u.length-2)) + "@" + d;
  };

  const Input = ({ type="text", value, onChange, placeholder, icon, right }) => (
    <div style={{ position:"relative" }}>
      {icon && (
        <div style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}>
          {icon}
        </div>
      )}
      <input
        type={type} value={value}
        onChange={e => { onChange(e.target.value); setError(""); }}
        placeholder={placeholder}
        onKeyDown={e => e.key === "Enter" && (view === "login" ? handleLogin() : handleForgot())}
        style={{
          ...G, width:"100%", padding: icon ? "13px 14px 13px 42px" : "13px 14px",
          border:`1.5px solid ${error ? T.red+"66" : T.border}`,
          borderRadius:11, fontSize:14, color:T.ink, background:T.surface,
          outline:"none", transition:"border-color 0.15s, box-shadow 0.15s",
          boxSizing:"border-box",
        }}
        onFocus={e => { e.target.style.borderColor = T.blue; e.target.style.boxShadow = `0 0 0 3px ${T.blueLight}`; }}
        onBlur={e  => { e.target.style.borderColor = error ? T.red+"66" : T.border; e.target.style.boxShadow = "none"; }}
      />
      {right && (
        <button onClick={right.action} tabIndex={-1}
          style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:4, color:T.inkMid }}>
          {right.icon}
        </button>
      )}
    </div>
  );

  const BtnPrimary = ({ onClick, children, disabled }) => (
    <button onClick={onClick} disabled={disabled}
      style={{ ...G, width:"100%", padding:"14px", background: disabled ? T.inkGhost : T.ink, color:"#fff", border:"none", borderRadius:11, fontSize:14, fontWeight:700, cursor: disabled ? "not-allowed" : "pointer", transition:"opacity 0.15s, transform 0.12s", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = "0.88"; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
      {children}
    </button>
  );

  // ── Brand panel ────────────────────────────────────────────────────────────
  const BrandPanel = () => (
    <div style={{ background:"#0F0F0D", display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"48px 44px", position:"relative", overflow:"hidden", flex:1, minHeight:"100vh" }}>
      {/* Decorative circles */}
      <div style={{ position:"absolute", top:-80, right:-80, width:300, height:300, borderRadius:"50%", background:"rgba(37,99,235,0.08)" }}/>
      <div style={{ position:"absolute", bottom:-60, left:-60, width:220, height:220, borderRadius:"50%", background:"rgba(124,58,237,0.1)" }}/>
      <div style={{ position:"absolute", top:"40%", right:-20, width:140, height:140, borderRadius:"50%", background:"rgba(37,99,235,0.05)" }}/>

      {/* Logo */}
      <div style={{ display:"flex", alignItems:"center", gap:10, position:"relative", zIndex:1 }}>
        <div style={{ width:34, height:34, borderRadius:9, background:`linear-gradient(135deg, ${T.blue}, ${T.purple})`, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Activity size={17} color="#fff" strokeWidth={2.5}/>
        </div>
        <span style={{ fontFamily:"'Geist',sans-serif", fontSize:17, fontWeight:800, color:"#fff", letterSpacing:"0.02em" }}>FINLY</span>
      </div>

      {/* Central copy */}
      <div style={{ position:"relative", zIndex:1 }}>
        <div style={{ fontFamily:"'Instrument Serif',serif", fontStyle:"italic", fontSize:42, lineHeight:1.15, color:"#fff", marginBottom:20 }}>
          Suas finanças,<br/>
          <span style={{ color:"#86EFAC" }}>finalmente</span><br/>
          sob controle.
        </div>
        <div style={{ fontFamily:"'Geist',sans-serif", fontSize:14, color:"rgba(255,255,255,0.45)", lineHeight:1.7, maxWidth:320 }}>
          Controle gastos, planeje metas e tome decisões financeiras com clareza — tudo em um só lugar.
        </div>
      </div>

      {/* Bottom testimonial */}
      <div style={{ position:"relative", zIndex:1, borderTop:"1px solid rgba(255,255,255,0.08)", paddingTop:24 }}>
        <div style={{ fontFamily:"'Geist',sans-serif", fontSize:13, color:"rgba(255,255,255,0.5)", fontStyle:"italic", lineHeight:1.65, marginBottom:12 }}>
          "O finly mudou minha relação com dinheiro. Finalmente sei para onde vai cada centavo."
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:9999, background:`linear-gradient(135deg,${T.blue},${T.purple})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:"#fff", flexShrink:0 }}>MC</div>
          <div>
            <div style={{ fontFamily:"'Geist',sans-serif", fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.7)" }}>Mariana Costa</div>
            <div style={{ fontFamily:"'Geist',sans-serif", fontSize:11, color:"rgba(255,255,255,0.35)" }}>Designer · São Paulo</div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Form panel ─────────────────────────────────────────────────────────────
  const FormPanel = () => {
    if (view === "sent") return (
      <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", padding:"clamp(24px,5vw,48px) clamp(20px,5vw,44px)", flex:1, overflowY:"auto" }}>
        <div style={{ maxWidth:380, margin:"0 auto", width:"100%", textAlign:"center" }}>
          <div style={{ fontSize:44, marginBottom:20 }}>📬</div>
          <div style={{ ...G, fontSize:24, fontWeight:800, color:T.ink, marginBottom:10 }}>Verifique seu e-mail</div>
          <div style={{ ...G, fontSize:14, color:T.inkMid, lineHeight:1.7, marginBottom:32 }}>
            Enviamos um link de recuperação para<br/>
            <strong style={{ color:T.ink }}>{maskEmail(email)}</strong>.<br/>
            Verifique sua caixa de entrada e spam.
          </div>
          <BtnPrimary onClick={() => { setView("login"); setPassword(""); }}>
            Voltar para o login
          </BtnPrimary>
          <button onClick={() => handleForgot()} style={{ ...G, marginTop:14, width:"100%", background:"none", border:"none", cursor:"pointer", fontSize:13, color:T.inkMid }}>
            Não recebeu? Reenviar e-mail
          </button>
        </div>
      </div>
    );

    if (view === "forgot") return (
      <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", padding:"clamp(24px,5vw,48px) clamp(20px,5vw,44px)", flex:1, overflowY:"auto" }}>
        <div style={{ maxWidth:380, margin:"0 auto", width:"100%" }}>
          <button onClick={() => { setView("login"); setError(""); }}
            style={{ ...G, display:"flex", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", color:T.inkMid, fontSize:13, marginBottom:32, padding:0 }}>
            <ChevronLeft size={15}/> Voltar
          </button>

          <div style={{ ...G, fontSize:26, fontWeight:800, color:T.ink, marginBottom:6 }}>
            Recuperar acesso
          </div>
          <div style={{ ...G, fontSize:14, color:T.inkMid, lineHeight:1.65, marginBottom:32 }}>
            Informe seu e-mail e enviaremos um link para redefinir sua senha.
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <label style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:7 }}>E-mail</label>
              <Input
                type="email" value={email} onChange={setEmail}
                placeholder="seu@email.com"
                icon={<Mail size={15} color={T.inkMid}/>}
              />
            </div>
            {error && <div style={{ ...G, fontSize:12, color:T.red }}>{error}</div>}
            <BtnPrimary onClick={handleForgot} disabled={loading}>
              {loading ? "Enviando…" : "Enviar link de recuperação"}
            </BtnPrimary>
          </div>
        </div>
      </div>
    );

    // Default: login
    return (
      <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", padding:"clamp(24px,5vw,48px) clamp(20px,5vw,44px)", flex:1, overflowY:"auto" }}>
        <div style={{ maxWidth:380, margin:"0 auto", width:"100%" }}>
          <div style={{ marginBottom:36 }}>
            <div style={{ ...G, fontSize:26, fontWeight:800, color:T.ink, marginBottom:6 }}>
              Bom ver você de volta
            </div>
            <div style={{ ...G, fontSize:14, color:T.inkMid }}>
              Acesse sua conta para continuar.
            </div>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div>
              <label style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:7 }}>E-mail</label>
              <Input
                type="email" value={email} onChange={setEmail}
                placeholder="seu@email.com"
                icon={<Mail size={15} color={T.inkMid}/>}
              />
            </div>

            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:7 }}>
                <label style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.07em" }}>Senha</label>
                <button onClick={() => { setView("forgot"); setError(""); }}
                  style={{ ...G, background:"none", border:"none", cursor:"pointer", fontSize:12, color:T.blue, fontWeight:600, padding:0 }}>
                  Esqueci minha senha
                </button>
              </div>
              <Input
                type={showPwd ? "text" : "password"}
                value={password} onChange={setPassword}
                placeholder="••••••••"
                icon={<Lock size={15} color={T.inkMid}/>}
                right={{ icon: showPwd ? <EyeOff size={15}/> : <Eye size={15}/>, action: () => setShowPwd(p => !p) }}
              />
            </div>

            {error && (
              <div style={{ ...G, fontSize:12, color:T.red, display:"flex", alignItems:"center", gap:6 }}>
                <AlertTriangle size={13}/> {error}
              </div>
            )}

            <div style={{ marginTop:4 }}>
              <BtnPrimary onClick={handleLogin} disabled={loading}>
                {loading
                  ? <><RefreshCw size={14} style={{ animation:"spin 0.7s linear infinite" }}/> Entrando…</>
                  : "Entrar na conta"
                }
              </BtnPrimary>
            </div>
          </div>

          <div style={{ marginTop:28, padding:"16px 18px", background:T.blueLight, borderRadius:11, border:`1px solid ${T.blue}22` }}>
            <div style={{ ...G, fontSize:11, fontWeight:700, color:T.blue, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Acesso demo</div>
            <div style={{ ...G, fontSize:12, color:T.inkMid, lineHeight:1.6 }}>
              Use qualquer e-mail e senha para entrar e explorar o finly com dados de demonstração.
            </div>
          </div>

          <div style={{ marginTop:28, textAlign:"center" }}>
            <span style={{ ...G, fontSize:13, color:T.inkMid }}>Não tem uma conta? </span>
            <button style={{ ...G, background:"none", border:"none", cursor:"pointer", fontSize:13, color:T.blue, fontWeight:700, padding:0 }}>
              Solicitar acesso
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display:"flex", height:"100vh", minHeight:"100dvh", background:T.surface, fontFamily:"'Geist',sans-serif", overflow:"hidden" }}>
        {/* Brand panel — hidden on mobile */}
        <div style={{ flex:"0 0 42%", display:"none", minHeight:"100vh" }} id="finly-brand-panel">
          <BrandPanel/>
        </div>
        <style>{`
          @media (min-width: 768px) {
            #finly-brand-panel { display: flex !important; flex-direction: column; }
            #finly-mobile-logo { display: none !important; }
          }
        `}</style>

        {/* Form panel */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflowY:"auto", background:T.surface }}>
          {/* Logo — visible on mobile, hidden on desktop when brand panel shows */}
          <div style={{ padding:"28px 28px 0", display:"flex", alignItems:"center", gap:10 }} id="finly-mobile-logo">
            <div style={{ width:30, height:30, borderRadius:8, background:`linear-gradient(135deg,${T.blue},${T.purple})`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Activity size={15} color="#fff" strokeWidth={2.5}/>
            </div>
            <span style={{ fontFamily:"'Geist',sans-serif", fontSize:15, fontWeight:800, color:T.ink, letterSpacing:"0.02em" }}>FINLY</span>
          </div>
          <FormPanel/>
        </div>
      </div>
    </>
  );
};


/* ─── ERROR BOUNDARY ───────────────────────────────────────── */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e, info) { console.error("finly render error:", e, info); }
  render() {
    if (this.state.error) return (
      <div style={{ padding:24, background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:12, margin:16 }}>
        <div style={{ fontWeight:700, color:"#DC2626", marginBottom:8 }}>Erro ao renderizar esta tela</div>
        <div style={{ fontFamily:"monospace", fontSize:12, color:"#374151" }}>{this.state.error.message}</div>
      </div>
    );
    return this.props.children;
  }
}


/* ─── APP ────────────────────────────────────────────────── */
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [page, setPage]     = useState("dashboard");
  // shared simulation state
  const [cenarios,   setCenarios]  = useState(SIM_CENARIOS_INIT);
  const [cenarioId,  setCenarioId] = useState(SIM_CENARIOS_INIT[0].id);
  const [modal, setModal]       = useState(false);
  const [modalMode, setModalMode] = useState("transacao"); // "transacao" | "recorrencia"
  const [modalPreConfig, setModalPreConfig] = useState(null); // pre-fill for contribuição
  const [panelOpen,          setPanelOpen]          = useState(false);
  const [dataMode,           setDataMode]           = useState("mock"); // "mock" | "empty"
  const [showOnboarding,     setShowOnboarding]     = useState(false);
  const [onboardingData,     setOnboardingData]      = useState(null);
  const [extraRecs,         setExtraRecs]          = useState([]); // recorrências semeadas pelo onboarding
  const [extraCards,        setExtraCards]         = useState([]); // cartões semeados pelo onboarding
  // Synthetic transactions derived from seeded recorrências (shown in Transações when empty)
  const extraTx = extraRecs.map((r, i) => ({
    id: `onb-tx-${i+1}`,
    desc: r.desc,
    cat: r.cat,
    val: r.tipo === "receita" ? +r.val : -r.val,
    date: `${String(r.dia).padStart(2,"0")}/04`,
    icon: r.icone || "💼",
    method: r.metodo || "Pix",
    rec: true,
    status: "agendado",
    valorTipo: r.valorTipo,
  }));
  const [checklistDismissed, setChecklistDismissed]  = useState(false);
  const [completedTx,        setCompletedTx]         = useState(false);
  const [completedBudget,    setCompletedBudget]      = useState(false);
  const [mounted, setMounted]     = useState(false);
  const [day, setDay]             = useState(11);
  const [budgetPct, setBudgetPct] = useState(38);
  const [freePct, setFreePct]     = useState(45);
  const [isMobile, setIsMobile]   = useState(() => window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => { clearTimeout(t); window.removeEventListener("resize", onResize); };
  }, []);

  const moodKey  = useMemo(() => calcMood(day, budgetPct, freePct), [day, budgetPct, freePct]);
  const mood     = MOODS[moodKey];
  const stateCtrl= { day, budgetPct, freePct, mounted, isMobile };

  const [navOpts, setNavOpts] = useState({});
  const navTo = (page, opts = {}) => {
    if (page === "__logout__") { setIsLoggedIn(false); setPage("dashboard"); return; }
    if (opts.cenarioId) setCenarioId(opts.cenarioId);
    setNavOpts(opts);
    setPage(page);
    // limpa opts no próximo tick para não re-disparar ao revisitar a página
    setTimeout(() => setNavOpts({}), 100);
  };
  const pages = {
    dashboard:    <DashboardPage    onNav={navTo} stateCtrl={stateCtrl} dataMode={dataMode} onboardingData={onboardingData} extraRecs={extraRecs} onNewTx={()=>setModal(true)} />,
    ritmo:        dataMode==="empty" ? (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <PageTitle sans="Ritmo de" serif="Gastos"/>
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:16 }}>
          <div style={{ ...G, fontSize:11, fontWeight:700, color:T.ink, marginBottom:10 }}>Projeção · Março 2026</div>
          <div style={{ background:T.bg, borderRadius:10, padding:"10px 10px 0", position:"relative", overflow:"hidden", height:90, marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:70, filter:"blur(2px)", opacity:0.15, pointerEvents:"none" }}>
              {[32,54,41,72,46,63,37,85,53,67,44,78].map((h,i)=>(
                <div key={i} style={{ flex:1, borderRadius:"2px 2px 0 0", background:T.ink, height:`${h}%` }}/>
              ))}
            </div>
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <span style={{ fontSize:18 }}>🔐</span>
              <span style={{ ...G, fontSize:12, fontWeight:700, color:T.inkMid }}>Desbloqueado com a primeira transação</span>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:9, marginBottom:14 }}>
            {[
              { n:"1", text:<><strong>Registre um gasto</strong> — qualquer compra do dia a dia.</> },
              { n:"2", text:<><strong>O gráfico mostra</strong> sua curva real vs. projeção ideal do mês.</> },
              { n:"3", text:<><strong>Receba alertas</strong> quando o ritmo sair do ideal.</> },
            ].map((s,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:9 }}>
                <div style={{ width:20, height:20, borderRadius:"50%", background:T.ink, color:"#fff", fontSize:10, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>{s.n}</div>
                <div style={{ ...G, fontSize:12, color:T.inkMid, lineHeight:1.6 }}>{s.text}</div>
              </div>
            ))}
          </div>
          <button onClick={()=>setModal(true)} style={{ ...G, width:"100%", background:T.redLight, color:T.red, border:"none", borderRadius:9, padding:"10px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
            + Registrar primeira transação
          </button>
        </div>
      </div>
    ) : <RitmoPage        onNav={navTo} isMobile={isMobile} dataMode={dataMode} />,
    transacoes:   dataMode==="empty" ? (
      extraTx.length > 0 ? (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
            <PageTitle sans="Transações" serif=""/>
            <button onClick={()=>setModal(true)} style={{ ...G, background:T.ink, color:"#fff", border:"none", borderRadius:11, padding:"9px 18px", fontSize:12, fontWeight:700, cursor:"pointer" }}>+ Nova transação</button>
          </div>
          <div style={{ ...G, fontSize:12, color:T.inkLight }}>Transações registradas no onboarding</div>
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden" }}>
            {extraTx.map((tx, i) => (
              <div key={tx.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 18px",
                borderBottom: i < extraTx.length-1 ? `1px solid ${T.border}` : "none" }}>
                <div style={{ width:36, height:36, borderRadius:10, background:T.grayLight,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{tx.icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ ...G, fontSize:13, fontWeight:600, color:T.ink }}>{tx.desc}</div>
                  <div style={{ ...G, fontSize:11, color:T.inkLight }}>{tx.cat} · {tx.method} · {tx.date}
                    {tx.rec && <span style={{ ...G, fontSize:10, color:T.blue, background:T.blueLight, borderRadius:99, padding:"1px 7px", marginLeft:6, fontWeight:600 }}>recorrente</span>}
                    {tx.valorTipo==="estimado" && <span style={{ ...G, fontSize:10, color:T.amber, background:T.amberLight, borderRadius:99, padding:"1px 7px", marginLeft:4, fontWeight:600 }}>≈ estimado</span>}
                  </div>
                </div>
                <div style={{ ...G, ...NUM, fontSize:14, fontWeight:700, flexShrink:0,
                  color: tx.val > 0 ? T.green : T.ink }}>
                  {tx.val > 0 ? "+" : "−"}R$ {Math.abs(tx.val).toLocaleString("pt-BR",{minimumFractionDigits:2})}
                </div>
              </div>
            ))}
          </div>
          <div style={{ ...G, fontSize:12, color:T.inkLight, textAlign:"center" }}>
            Registre despesas e mais receitas para acompanhar seu fluxo completo.
          </div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <PageTitle sans="Transações" serif=""/>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"48px 24px", gap:12, textAlign:"center" }}>
            <div style={{ fontSize:28 }}>📭</div>
            <div style={{ ...G, fontSize:16, fontWeight:800, color:T.ink }}>Nenhuma transação ainda</div>
            <div style={{ ...G, fontSize:13, color:T.inkMid, lineHeight:1.7, maxWidth:360 }}>Suas transações aparecerão aqui conforme forem registradas. Registre receitas, despesas e transferências para acompanhar seu fluxo.</div>
            <button onClick={()=>setModal(true)} style={{ ...G, background:T.ink, color:"#fff", border:"none", borderRadius:11, padding:"11px 24px", fontSize:13, fontWeight:700, cursor:"pointer", marginTop:4 }}>+ Nova transação</button>
          </div>
        </div>
      )
    ) : <TransacoesPage
      onNav={navTo}
      isMobile={isMobile}
      dataMode={dataMode}
      onEditTx={(tx) => {
        setModalPreConfig({
          tipo:    tx.val > 0 ? "receita" : "despesa",
          desc:    tx.desc,
          cat:     tx.cat,
          method:  tx.method.toLowerCase().replace("é","e").replace("ã","a").replace("é","e"),
          valorInicial: Math.abs(tx.val),
          recorre: tx.rec,
        });
        setModalMode("transacao");
        setModal(true);
      }}
    />,
    recorrencias: (dataMode==="empty" && extraRecs.length===0) ? (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <PageTitle sans="Recorrências &" serif="Compromissos"/>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ ...G, fontSize:14, color:T.inkMid, lineHeight:1.7 }}>
            Tudo começa com uma recorrência. Salário, aluguel, Spotify — cada item fixo aqui vira uma previsão automática no dashboard.
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
            {[
              { ic:"💰", title:"Receitas fixas",  sub:"Salário, pró-labore, aluguel recebido.", color:T.green,  colorL:T.greenLight,  action:"+ Receita",  mode:"recorrencia", tipo:"receita"  },
              { ic:"📋", title:"Despesas fixas", sub:"Boletos, assinaturas, débito automático.", color:T.red,    colorL:T.redLight,    action:"+ Despesa",  mode:"recorrencia", tipo:"despesa"  },
            ].map((c,i)=>(
              <div key={i} style={{ background:T.surface, border:`1.5px dashed ${T.border}`, borderRadius:13, padding:"18px 16px", textAlign:"center", display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ fontSize:28 }}>{c.ic}</div>
                <div style={{ ...G, fontSize:14, fontWeight:700, color:T.ink }}>{c.title}</div>
                <div style={{ ...G, fontSize:12, color:T.inkLight, lineHeight:1.55 }}>{c.sub}</div>
                <button onClick={()=>{ setModalPreConfig({ novaRecorrencia:true, tipo: c.tipo }); setModalMode("recorrencia"); setModal(true); }} style={{ ...G, background:c.colorL, color:c.color, border:"none", borderRadius:9, padding:"9px", fontSize:12, fontWeight:700, cursor:"pointer" }}>{c.action}</button>
              </div>
            ))}
          </div>
          <div>
            <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Comuns para começar</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {["🏠 Aluguel","⚡ Conta de luz","📱 Plano celular","🎵 Spotify","🏋️ Academia","📺 Netflix"].map(p=>(
                <span key={p} style={{ ...G, fontSize:11, fontWeight:600, background:T.grayLight, color:T.inkMid, borderRadius:99, padding:"4px 12px" }}>{p}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    ) : <RecorrenciasPage onNav={navTo} cenarios={cenarios} isMobile={isMobile} dataMode={dataMode} extraRecs={extraRecs} onNovaRec={() => { setModalMode("recorrencia"); setModal(true); }} onEditar={(rec) => {
              const freqId = rec.freq?.split(" ")[0]?.toLowerCase() || "mensal";
              const encId  = rec.enc === "Sem data fim" ? "sem-fim" : rec.enc === "Após N repetições" ? "repeticoes" : rec.enc === "Data específica" ? "data" : "sem-fim";
              const methodId = rec.metodo === "Pix" ? "pix" : rec.metodo === "Boleto" ? "boleto" : rec.metodo === "Débito auto." ? "debito" : rec.metodo === "Transferência" ? "transferencia" : rec.metodo === "Cartão crédito" ? "credito" : "pix";
              setModalPreConfig({
                tipo: rec.tipo,
                desc: rec.desc,
                cat: rec.cat,
                method: methodId,
                valorInicial: rec.val,
                recorre: true,
                freqRec: freqId,
                encRec: encId,
                valorTipoRec: rec.valorTipo || "fixo",
                isEditRecorrencia: true,
                recId: rec.id,
              });
              setModalMode("transacao");
              setModal(true);
            }} />,
    cartoes:      <CartõesPage    onNav={navTo} isMobile={isMobile} cards={dataMode==="empty" ? extraCards : undefined} autoOpenAdd={!!navOpts.autoOpenAdd} dataMode={dataMode} onNovaItem={(cartaoId) => { setModalPreConfig({ tipo:"despesa", method:"credito", cartaoId }); setModalMode("transacao"); setModal(true); }} />,
    orcamentos:   <OrcamentosPage onNav={navTo} isMobile={isMobile} dataMode={dataMode} autoOpenAdd={!!navOpts.autoOpenAdd} />,
    metas:        <MetasPage        onNav={navTo} isMobile={isMobile} dataMode={dataMode} autoOpenModal={!!navOpts.autoOpenModal} initialMetas={dataMode==="empty" ? [] : undefined} onContribuir={(meta) => { setModalPreConfig({ tipo:"receita", desc:`Aporte — ${meta.nome}`, cat:"Poupança" }); setModalMode("transacao"); setModal(true); }} />,
    perfil:        <ConfiguracoesPage onNav={navTo} isMobile={isMobile} onboardingData={onboardingData} dataMode={dataMode} />,
    relatorios:   <RelatoriosPage onNav={(dest)=>{ if(dest==="_nova_transacao") setModal(true); else navTo(dest); }} isMobile={isMobile} dataMode={dataMode} extraRecs={extraRecs} />,
    simulacao:    <SimulacaoPage    cenarios={cenarios} setCenarios={setCenarios} cenarioId={cenarioId} setCenarioId={setCenarioId} autoOpenModal={!!navOpts.autoOpenModal} autoTipo={navOpts.autoTipo || null} isMobile={isMobile} dataMode={dataMode} />,
  };

  if (showOnboarding) return (
    <OnboardingFlow
      isMobile={isMobile}
      onComplete={(data) => {
        setOnboardingData(data);
        setShowOnboarding(false);
        setChecklistDismissed(false);
        setCompletedTx(false);
        setCompletedBudget(false);
        setDataMode("empty");
        setCenarios([]);        // reset simulation scenarios to empty state
        setCenarioId(null);
        // Seed recorrência from onboarding if user registered one
        if (data.temRec === "sim" && data.recVal) {
          const valNum = parseFloat(data.recVal.replace(",",".")) || 0;
          if (valNum > 0) {
            setExtraRecs([{
              id: "onb-rec-1",
              desc: data.recDesc || "Receita mensal",
              cat: "Renda",
              val: valNum,
              dia: parseInt(data.recDia) || 5,
              ativa: true,
              proximo: `${String(parseInt(data.recDia)||5).padStart(2,"0")}/04/2026`,
              proximoFull: `${String(parseInt(data.recDia)||5).padStart(2,"0")}/04/2026`,
              tipo: "receita",
              metodo: "Pix",
              freq: `Mensal · dia ${data.recDia||5}`,
              inicio: "Abr 2026",
              enc: "Sem data fim",
              pago: false,
              icone: "💼",
              progPct: 0,
              valorTipo: data.recTipo || "fixo",
            }]);
          }
        } else {
          setExtraRecs([]);
        }
        // Seed card from onboarding
        if (data.temCartao === "sim" && data.cardNome) {
          const lim = parseFloat((data.cardLim||"0").replace(",",".")) || 0;
          const venc = parseInt(data.cardVenc) || 10;
          setExtraCards([{
            id: "onb-card-1",
            banco: data.cardNome,
            nome: data.cardNome,
            dig: "••••",
            bandeira: "Mastercard",
            vencimento: venc,
            fechamento: Math.max(1, venc - 7),
            limite: lim,
            disponivel: lim,
            cor1: "#1F2937", cor2: "#374151",
            corChip: "#9CA3AF", corText: "#fff",
            faturas: [], itens: [], parcelas_ativas: [], tendencia: [],
            // minimal fatura placeholder so KPIs don't show NaN
            _empty: true,
          }]);
        } else {
          setExtraCards([]);
        }
        setPage("dashboard");
      }}
    />
  );

  if (!isLoggedIn) return <LoginPage onLogin={() => setIsLoggedIn(true)} />;

  return (
    <>
    <AnimStyles/>
    <div style={{ ...G, display:"flex", height:"100vh", background:T.bg, overflow:"hidden" }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 99px; }
        input[type=range] { -webkit-appearance: none; height: 4px; border-radius: 99px; outline: none; cursor: pointer; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: ${T.ink}; border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
      `}</style>
      <Sidebar
        page={page} onNav={navTo}
        isMobile={isMobile}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <Topbar
          onNew={() => setModal(true)}
          isMobile={isMobile}
          onMenuOpen={() => setSidebarOpen(true)}
          onNav={navTo}
          page={page}
        />

        {/* Mood top border on dashboard */}
        {page === "dashboard" && mood.topBorder !== "transparent" && (
          <div style={{ height:2, background:mood.topBorder, transition:"background 0.18s", flexShrink:0 }} />
        )}

        {/* State control button — dashboard only, hidden on mobile */}
        {page === "dashboard" && !isMobile && (
          <button onClick={() => setPanelOpen(p => !p)} style={{ position:"fixed", top:68, right:16, zIndex:201, width:32, height:32, borderRadius:8, border:`1px solid ${T.border}`, background:panelOpen?T.ink:T.surface, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"all 0.2s", boxShadow:T.sm }}>
            <SlidersHorizontal size={13} color={panelOpen?"#fff":T.inkMid} />
          </button>
        )}

        {!isMobile && <StatePanelV4 open={panelOpen} day={day} setDay={setDay} budgetPct={budgetPct} setBudgetPct={setBudgetPct} freePct={freePct} setFreePct={setFreePct} moodKey={moodKey} onStartOnboarding={() => { setPanelOpen(false); setShowOnboarding(true); }} dataMode={dataMode} onSetDataMode={(mode) => { setDataMode(mode); if (mode === 'empty') { setCenarios([]); setCenarioId(null); } else { setCenarios(SIM_CENARIOS_INIT); setCenarioId(SIM_CENARIOS_INIT[0].id); } }} />}

        <div style={{ flex:1, overflowY:"auto", overflowX:"hidden", padding:isMobile?"14px 14px 40px":"20px 28px 40px" }}>
          {page === "dashboard" && onboardingData && !checklistDismissed && (
            <MiniChecklist
              onboardingData={onboardingData}
              completedTx={completedTx}
              completedBudget={completedBudget}
              onDismiss={() => setChecklistDismissed(true)}
              onNav={(dest) => { if (dest === "_nova_transacao") { setModal(true); } else { navTo(dest); } }}
            />
          )}
          <ErrorBoundary key={page}><PageEnter key={page}>{pages[page] || (
            <div style={{ paddingTop:60, textAlign:"center" }}>
              <div style={{ ...G, fontSize:32, marginBottom:8 }}>🚧</div>
              <div style={{ ...G, fontSize:16, color:T.inkLight }}>Em construção</div>
            </div>
          )}</PageEnter></ErrorBoundary>
        </div>
      </div>
      {modal && <NovaTransacaoModal open={modal} onClose={() => { setModal(false); setModalMode("transacao"); setModalPreConfig(null); }} novaRecorrencia={modalMode === "recorrencia"} preConfig={modalPreConfig} isMobile={isMobile} />}
    </div>
    </>
  );
}
