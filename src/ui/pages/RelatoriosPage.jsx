import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell,
  Line,
} from "recharts";
import { T } from "../tokens";
import { G, S, NUM } from "../typography";
import { PageTitle } from "../components/primitives";
import {
  downloadReportsCsvForUi,
  buildReportKpis,
  velocityPressureVsIdealAtDay,
} from "../data/reportsAdapter.js";
import { M_MONO } from "../features/moodV4";
import { useReportsData } from "../features/reports/useReportsData.js";
import { EmptyState } from "../features/shellExtras";
import { shouldUseRealData as shouldUseRealDataForMode } from "../dataMode.js";

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
  { nome:"Saldo",        val:4299,  tipo:"saldo"   },
];

const DRIFT_COLORS = {
  Moradia:"#0F0F0D", "Alimentação":"#2563EB", Transporte:"#D97706",
  "Saúde":"#059669", Lazer:"#7C3AED", Outros:"#9CA3AF"
};

/** Layout desktop: altura baseada na largura da coluna (não na viewport height) + colunas responsivas. */
function getDesktopLayout() {
  if (typeof window === "undefined") return { h: 240, cols: 2 };
  const w = window.innerWidth;
  const cols = w >= 1600 ? 3 : 2;
  const contentW = w - 195 - 56; // sidebar (195) + padding lateral (28×2)
  const colW = (contentW - (cols - 1) * 16) / cols;
  const h = Math.max(200, Math.min(300, Math.round(colW * 0.35)));
  return { h, cols };
}

function truncateWaterfallCategory(nome, maxLen) {
  const s = nome == null ? "" : String(nome);
  if (s.length <= maxLen) return s;
  if (maxLen <= 1) return "…";
  return `${s.slice(0, maxLen - 1)}…`;
}

function layoutWaterfallBars(innerW, n, compact) {
  const minBar = compact ? 14 : 20;
  const maxBar = compact ? 44 : 92;
  const minGap = 4;
  if (n <= 0) return { barW: 0, gap: 0, totalW: 0 };
  if (n === 1) {
    const barW = Math.min(maxBar, Math.max(minBar, innerW));
    return { barW, gap: 0, totalW: barW };
  }
  let gap = Math.min(18, Math.max(minGap, Math.round(innerW / (n * 4.5))));
  let barW = (innerW - (n - 1) * gap) / n;
  barW = Math.min(maxBar, Math.max(minBar, barW));
  gap = (innerW - n * barW) / (n - 1);
  if (gap < minGap) {
    gap = minGap;
    barW = (innerW - (n - 1) * minGap) / n;
    barW = Math.max(minBar, barW);
    gap = (innerW - n * barW) / (n - 1);
    gap = Math.max(minGap, gap);
  }
  const totalW = n * barW + (n - 1) * gap;
  return { barW, gap, totalW };
}

/**
 * Cascata: largura das barras derivada do container (ResizeObserver) + rótulos truncados com tooltip nativo (<title>).
 */
function WaterfallChart({ compact = false, plotHeight, rows, fmtK }) {
  const wrapRef = useRef(null);
  const [containerW, setContainerW] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setContainerW(Math.max(0, Math.floor(r.width)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!rows?.length) {
    return (
      <div style={{ ...G, fontSize:12, color:T.inkLight, padding:"20px 8px", textAlign:"center" }}>
        Sem dados de cascata para o mês de referência.
      </div>
    );
  }

  let running = 0;
  const data = rows.map((item) => {
    let base;
    let height;
    if (item.tipo === "receita") {
      base = 0;
      height = Math.abs(item.val);
    } else if (item.tipo === "saldo") {
      base = 0;
      height = Math.max(0, running);
    } else {
      base = running + item.val;
      height = Math.abs(item.val);
    }
    if (item.tipo !== "saldo") running += item.val;
    return { ...item, base, height };
  });

  const chartH = compact ? 110 : (plotHeight != null ? plotHeight : 155);
  const maxVal = Math.max(1, ...data.map((d) => d.base + d.height));
  const valSize = compact ? 8 : 10;
  const gapAboveBar = 5;
  const labelClearance = gapAboveBar + Math.ceil(valSize * 0.82) + 3;
  const marginTop = compact ? 14 : Math.max(20, labelClearance);
  const padBottom = compact ? 22 : 28;
  const baseY = marginTop + chartH;
  const nomeFs = compact ? 7 : 10;

  const sidePad = 10;
  const fallbackInner = compact ? 280 : 360;
  const innerW = Math.max(160, (containerW > 0 ? containerW : fallbackInner) - sidePad * 2);
  const n = data.length;
  let { barW, gap, totalW } = layoutWaterfallBars(innerW, n, compact);
  const slack = innerW - totalW;
  if (slack > 0.5 && n > 0) {
    barW += slack / n;
    totalW = innerW;
  }
  const vbW = totalW + sidePad * 2;
  const vbH = marginTop + chartH + padBottom;

  const charUnit = nomeFs * 0.52;
  const maxChars = Math.max(3, Math.floor(barW / charUnit));

  return (
    <div ref={wrapRef} style={{ width: "100%", minWidth: 0 }}>
      <svg
        width="100%"
        height={vbH}
        viewBox={`0 0 ${vbW} ${vbH}`}
        preserveAspectRatio="none"
        style={{ overflow: "hidden", display: "block", maxWidth: "100%" }}
      >
        {data.map((d, i) => {
          const x = sidePad + i * (barW + gap);
          const barH = Math.max(2, Math.round((d.height / maxVal) * chartH));
          const y = baseY - Math.round(((d.base + d.height) / maxVal) * chartH);
          const color = d.tipo === "receita" ? T.green : d.tipo === "saldo" ? T.blue : T.red;
          const labelBaseline = y - gapAboveBar;
          const shortNome = truncateWaterfallCategory(d.nome, maxChars);
          return (
            <g key={`${d.nome}-${i}`}>
              <title>{d.nome}</title>
              <rect x={x} y={y} width={barW} height={barH} rx={3} fill={color} fillOpacity={0.88} />
              {i < data.length - 1 && d.tipo !== "saldo" && (
                <line
                  x1={x + barW}
                  y1={y + (d.tipo === "receita" ? 0 : barH)}
                  x2={x + barW + gap}
                  y2={y + (d.tipo === "receita" ? 0 : barH)}
                  stroke={T.border}
                  strokeWidth={1}
                  strokeDasharray="3 2"
                />
              )}
              <text
                x={x + barW / 2}
                y={labelBaseline}
                textAnchor="middle"
                fontSize={valSize}
                fontWeight={700}
                fill={color}
                fontFamily="Geist,sans-serif"
              >
                {d.tipo === "receita" ? "+" : d.tipo === "saldo" ? "" : "-"}
                {fmtK(d.tipo === "saldo" ? d.height : d.val)}
              </text>
              <text
                x={x + barW / 2}
                y={baseY + (compact ? 12 : 16)}
                textAnchor="middle"
                fontSize={nomeFs}
                fill={T.inkMid}
                fontFamily="Geist,sans-serif"
              >
                {shortNome}
              </text>
            </g>
          );
        })}
        <line x1={sidePad} y1={baseY} x2={sidePad + totalW} y2={baseY} stroke={T.border} strokeWidth={1} />
      </svg>
    </div>
  );
}

/** Hover do donut isolado aqui — evita re-render da página inteira ao passar o mouse. */
function ComposicaoDonutSection({ compositionData, compact = false, fmtBRL, desktopPieSize }) {
  const [activeIdx, setActive] = useState(null);
  const size = compact ? 110 : (desktopPieSize ?? 150);
  const ir = compact ? 30 : Math.round(42 * (size / 150));
  const or = compact ? 48 : Math.round(65 * (size / 150));
  const totalComp = compositionData.reduce((s, c) => s + (Number(c.value) || 0), 0);
  return (
    <div style={{ display:"grid", gridTemplateColumns:`${size}px 1fr`, gap:14, alignItems:"center" }}>
      <div style={{ width:size, height:size, flexShrink:0 }}>
        <PieChart width={size} height={size}>
          <Pie data={compositionData} cx="50%" cy="50%"
            innerRadius={ir} outerRadius={or}
            paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}
            isAnimationActive={false}>
            {compositionData.map((entry,i) => (
              <Cell key={i} fill={entry.color} fillOpacity={activeIdx===i?1:0.72}
                onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} />
            ))}
          </Pie>
        </PieChart>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:compact?4:5 }}>
        {compositionData.map((c,i) => (
          <div key={i} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
            style={{ display:"flex", alignItems:"center", gap:7, padding:compact?"4px 6px":"5px 8px",
              borderRadius:8, background:activeIdx===i?T.bg:"transparent", transition:"background 0.12s", cursor:"default" }}>
            <div style={{ width:7, height:7, borderRadius:2, background:c.color, flexShrink:0 }} />
            <span style={{ ...G, fontSize:compact?10:11, color:T.inkMid, flex:1 }}>{c.name}</span>
            <span style={{ ...G, ...NUM, fontSize:compact?10:11, fontWeight:700, color:T.ink }}>{fmtBRL(c.value)}</span>
            <span style={{ ...G, fontSize:10, color:T.inkMid, minWidth:26, textAlign:"right" }}>
              {totalComp > 0 ? Math.round((Number(c.value) || 0)/totalComp*100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── RELATÓRIOS PAGE ────────────────────────────────────── */
export function RelatoriosPage({
  onNav,
  isMobile = false,
  extraRecs = [],
  dataMode = "live",
  organizationId = null,
}) {
  const [periodo,     setPeriodo]     = useState("6m");
  const [relTab,      setRelTab]      = useState("resumo");
  const [selectedCat, setSelectedCat] = useState(null);
  const [scoreDetail, setScoreDetail] = useState(null);
  const [desktopChartH, setDesktopChartH] = useState(240);
  const [desktopCols,   setDesktopCols]   = useState(2);

  const PERIODO_N = { "3m":3, "6m":6, "12m":12 };
  const mockScoreData = useMemo(() => REL_MONTHLY.slice(-PERIODO_N[periodo]), [periodo]);
  const shouldUseRealData = shouldUseRealDataForMode(organizationId, dataMode);
  const reportsData = useReportsData({
    organizationId,
    periodo,
    enabled: shouldUseRealData,
  });
  const activeData = shouldUseRealData ? reportsData.monthlyData : (dataMode === "mock" ? mockScoreData : []);
  const scoreData = activeData;
  const activeDrift = shouldUseRealData
    ? reportsData.driftData
    : (dataMode === "mock" ? REL_DRIFT.slice(-PERIODO_N[periodo]) : []);
  const driftColors = shouldUseRealData
    ? reportsData.driftColors
    : (dataMode === "mock" ? DRIFT_COLORS : {});
  const compositionData = shouldUseRealData
    ? reportsData.compositionData
    : (dataMode === "mock" ? REL_COMPOSICAO : []);
  const compositionWindowLabel = shouldUseRealData
    ? reportsData.compositionWindowLabel
    : (dataMode === "mock" ? "Mar'26" : "");
  const waterfallRows = shouldUseRealData
    ? reportsData.waterfallRows
    : (dataMode === "mock" ? REL_WATERFALL : []);
  const velocityDaily = shouldUseRealData
    ? reportsData.velocityDaily
    : (dataMode === "mock" ? REL_DAILY : []);

  useEffect(() => {
    if (isMobile) return;
    const sync = () => {
      const { h, cols } = getDesktopLayout();
      setDesktopChartH(h);
      setDesktopCols(cols);
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [isMobile]);

  const financialKpis = useMemo(() => buildReportKpis(activeData), [activeData]);
  const scoreKpis = useMemo(() => {
    if (scoreData.length === 0) {
      return { avgScore: 0, bestScore: 0, worstScore: 0 };
    }
    const scores = scoreData.map((m) =>
      typeof m.score === "number" && Number.isFinite(m.score) ? m.score : 0,
    );
    const avgScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    const bestScore = Math.max(...scores);
    const worstScore = Math.min(...scores);
    return { avgScore, bestScore, worstScore };
  }, [scoreData]);
  const kpis = { ...financialKpis, ...scoreKpis };
  const kpiRefLabel = compositionWindowLabel || kpis.last?.mes || periodo;
  const expensePctOfIncome = kpis.totalR > 0
    ? Math.round(kpis.totalG / kpis.totalR * 100)
    : 0;

  const velocityInsightPct = useMemo(
    () => (shouldUseRealData ? velocityPressureVsIdealAtDay(velocityDaily) : null),
    [shouldUseRealData, velocityDaily],
  );

  const cascadeTopShare = useMemo(() => {
    if (!waterfallRows.length) return null;
    const rec = waterfallRows.find((r) => r.tipo === "receita");
    const inc = Number(rec?.val) || 0;
    if (inc <= 0) return null;
    const top2 = waterfallRows.filter((r) => r.tipo === "despesa").slice(0, 2);
    if (!top2.length) return null;
    const sum = top2.reduce((s, r) => s + Math.abs(Number(r.val) || 0), 0);
    return {
      pct: Math.round((sum / inc) * 100),
      names: top2.map((r) => r.nome).join(" + "),
    };
  }, [waterfallRows]);

  const velocityInsightHtml = useMemo(() => {
    if (shouldUseRealData && velocityInsightPct != null) {
      const abs = Math.abs(velocityInsightPct);
      const cmp =
        velocityInsightPct > 0
          ? `${abs}% acima do ritmo ideal`
          : velocityInsightPct < 0
            ? `${abs}% abaixo do ritmo ideal`
            : "alinhado ao ritmo ideal";
      return `Nos primeiros dias do mês, o gasto acumulado ficou <strong>${cmp}</strong> em relação a um ritmo linear até o total de despesas do mês. Distribuir compras ao longo do período ajuda na aderência ao orçamento.`;
    }
    return `Gasto <strong>35% mais rápido que o ideal</strong> nos primeiros 5 dias. Distribuir compras grandes ao longo do mês pode economizar pressão no orçamento.`;
  }, [shouldUseRealData, velocityInsightPct]);

  const cascadeInsightHtml = useMemo(() => {
    if (shouldUseRealData && cascadeTopShare) {
      return `<strong>${cascadeTopShare.names}</strong> ≈ <strong>${cascadeTopShare.pct}% da receita</strong> no mês de referência. Ajuste categorias com maior peso para melhorar o saldo final.`;
    }
    return `Moradia + Alimentação = <strong>${Math.round((1500 + 1046) / 8600 * 100)}% da receita</strong> de Março. Lazer e Outros são as maiores alavancas de economia potencial.`;
  }, [shouldUseRealData, cascadeTopShare]);

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

  if (shouldUseRealData && reportsData.isLoading && !reportsData.hasRealData) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
        <PageTitle sans="Meus" serif="Relatórios" />
        <div style={{ ...G, fontSize:14, color:T.inkMid, background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:"28px 24px" }}>
          Carregando relatórios...
        </div>
      </div>
    );
  }

  if (shouldUseRealData && reportsData.error && !reportsData.hasRealData) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
        <PageTitle sans="Meus" serif="Relatórios" />
        <div style={{ ...G, fontSize:14, color:T.red, background:T.redLight, border:`1px solid ${T.red}22`, borderRadius:16, padding:"28px 24px" }}>
          {reportsData.error}
        </div>
      </div>
    );
  }

  if (shouldUseRealData && !reportsData.hasRealData) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
        <PageTitle sans="Relatórios &" serif="Análises"/>
        <EmptyState icon="📈" title="Sem dados para exibir"
          sub="Os relatórios aparecem após as primeiras transações. Registre uma para começar."
          cta="+ Nova transação" onCta={()=>onNav("_nova_transacao")} />
      </div>
    );
  }

  const fmtBRL = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "R$\u00a0—";
    return "R$\u00a0" + Math.abs(n).toLocaleString("pt-BR",{minimumFractionDigits:0});
  };
  const fmtK = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "0";
    const a = Math.abs(n);
    return a >= 1000 ? (a / 1000).toFixed(1) + "k" : String(a);
  };

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

  const Section = ({ title, serifWord, insight, children, style }) => (
    <div style={{
      background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, overflow:"hidden",
      display:"flex", flexDirection:"column", height:"100%", minHeight:0,
      ...style,
    }}>
      <div style={{ padding:"16px 20px 14px", borderBottom:`1px solid ${T.border}`, background:T.bg, flexShrink:0 }}>
        <div style={{ ...G, fontSize:15, fontWeight:800, color:T.ink, marginBottom:insight?10:0 }}>
          {title} <span style={{ ...S, fontWeight:400, fontSize:15 }}>{serifWord}</span>
        </div>
        {insight && <InsightChip {...insight} />}
      </div>
      <div style={{
        padding:"16px 20px", flex:1, display:"flex", flexDirection:"column", minHeight:0, gap:0,
      }}>
        {children}
      </div>
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

  const VelocidadeChart = ({ height=170, data: velocitySeries }) => {
    const series = velocitySeries?.length ? velocitySeries : [];
    if (!series.length) {
      return (
        <div style={{ ...G, fontSize:12, color:T.inkLight, padding:"20px 8px", textAlign:"center", minHeight:height }}>
          Sem série diária de gastos para o mês (ou ainda a carregar).
        </div>
      );
    }
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={series} margin={{ top:8, right:4, left:-22, bottom:0 }}>
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
  };

  const DriftChart = ({ height=190 }) => (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={activeDrift} margin={{ top:8, right:4, left:-22, bottom:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
        <XAxis dataKey="mes" tick={{ ...G, fontSize:10, fill:T.inkLight }} axisLine={false} tickLine={false} />
        <YAxis tick={{ ...G, fontSize:10, fill:T.inkLight }} axisLine={false} tickLine={false} tickFormatter={v=>fmtK(v)} />
        <Tooltip content={<CustomTip />} />
        {Object.entries(driftColors).map(([cat,color]) => (
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
      <ComposedChart data={scoreData} margin={{ top:8, right:4, left:-22, bottom:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
        <XAxis dataKey="mes" tick={{ ...G, fontSize:10, fill:T.inkLight }} axisLine={false} tickLine={false} />
        <YAxis domain={[0,100]} tick={{ ...G, fontSize:10, fill:T.inkLight }} axisLine={false} tickLine={false} tickFormatter={v=>v+"%"} />
        <Tooltip content={<CustomTip fmt={v=>v+"%"} />} />
        <ReferenceLine y={80} stroke={T.green} strokeDasharray="4 3" strokeWidth={1.5} />
        <Bar dataKey="score" name="Score" radius={[4,4,0,0]} maxBarSize={32}
          onClick={(d) => setScoreDetail(scoreDetail?.mes===d.mes ? null : d)}>
          {scoreData.map((entry,i) => (
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

  const CatLegend = ({ compact=false }) => (
    <div style={{ display:"flex", gap:compact?5:7, flexWrap:"wrap" }}>
      {Object.entries(driftColors).map(([cat,color]) => (
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
    const taxa  = scoreDetail.receita > 0 ? Math.round(saldo/scoreDetail.receita*100) : 0;
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
              Saldo · {kpiRefLabel}
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
              text={`Último mês (<strong>${kpiRefLabel}</strong>): ${saldoPositivo?"saldo positivo":"saldo negativo"} <strong>${fmtBRL(Math.abs(kpis.saldo))}</strong> (${kpis.taxa}% da receita). Acumulado em <strong>${periodo}</strong>: <strong>${fmtBRL(Math.abs(kpis.periodSaldo))}</strong> (${kpis.periodTaxa}% da receita do período). Score médio: <strong>${kpis.avgScore}/100</strong>.`}
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
              <div style={{ ...G, fontSize:12, fontWeight:700, color:T.ink, marginBottom:4 }}>
                Cascata{compositionWindowLabel ? ` · ${compositionWindowLabel}` : ""}
              </div>
              <div style={{ ...G, fontSize:10, color:T.inkLight, marginBottom:12 }}>Breakdown de onde foi cada real</div>
              <WaterfallChart compact rows={waterfallRows} fmtK={fmtK} />
            </div>
          </>)}

          {/* FLUXO */}
          {relTab==="fluxo" && (<>
            <InsightChip color={T.red} icon="⚡" text={velocityInsightHtml} />
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"16px 16px 12px" }}>
              <div style={{ ...G, fontSize:12, fontWeight:700, color:T.ink, marginBottom:3 }}>
                Velocidade de gasto{compositionWindowLabel ? ` · ${compositionWindowLabel}` : ""}
              </div>
              <div style={{ ...G, fontSize:10, color:T.inkLight, marginBottom:12 }}>Gasto real acumulado vs ritmo ideal diário</div>
              <VelocidadeChart height={155} data={velocityDaily} />
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
              {scoreData.map(m => {
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
              <div style={{ ...G, fontSize:12, fontWeight:700, color:T.ink, marginBottom:14 }}>
                Composição{compositionWindowLabel ? ` · ${compositionWindowLabel}` : ""}
              </div>
              <div style={{ ...G, fontSize:10, color:T.inkLight, marginBottom:12 }}>{compositionWindowLabel}</div>
              <ComposicaoDonutSection compact compositionData={compositionData} fmtBRL={fmtBRL} />
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
          <button
            onClick={() => {
              if (shouldUseRealData && organizationId) {
                downloadReportsCsvForUi(organizationId, periodo).catch(() => {});
              }
            }}
            style={{ ...G, display:"flex", alignItems:"center", gap:5, padding:"7px 12px", borderRadius:8,
            border:`1px solid ${T.border}`, background:T.surface, color:T.inkMid, fontSize:11, fontWeight:600, cursor:"pointer" }}>
            <Download size={11} /> Exportar
          </button>
        </div>
      </div>

      {/* KPI strip — último mês da série (alinhado a cascata / composição / velocidade); totais do período em insights */}
      {shouldUseRealData && reportsData.error && (
        <div style={{ ...G, fontSize:13, color:T.red, background:T.redLight, border:`1px solid ${T.red}22`, borderRadius:12, padding:"12px 14px" }}>
          {reportsData.error}
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {[
          { label:`Receita · ${kpiRefLabel}`, val:fmtBRL(kpis.totalR),
            sub: kpis.tendR>=0 ? `↑ ${kpis.tendR}% vs mês ant.` : `↓ ${Math.abs(kpis.tendR)}% vs mês ant.`, color:T.green },
          { label:`Gasto · ${kpiRefLabel}`,   val:fmtBRL(kpis.totalG),
            sub:`${expensePctOfIncome}% da receita do mês`,                                                    color:T.red   },
          { label:`Saldo · ${kpiRefLabel}`,   val:fmtBRL(kpis.saldo),
            sub:kpis.saldo>=0?"superávit no mês":"déficit no mês",
            color:kpis.saldo>=0?T.blue:T.red },
          { label:`Taxa · ${kpiRefLabel}`,    val:`${kpis.taxa}%`,
            sub:`acum. ${periodo}: ${kpis.periodTaxa}% · score médio ${kpis.avgScore}/100`,                   color:T.purple },
        ].map((k,i) => (
          <div key={i} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:6 }}>{k.label}</div>
            <div style={{ ...G, ...NUM, fontSize:20, fontWeight:800, color:k.color, letterSpacing:"-0.01em" }}>{k.val}</div>
            <div style={{ ...G, fontSize:10, color:T.inkLight, marginTop:3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts — grid responsivo: 2-col < 1600px, 3-col ≥ 1600px (full-width, sem max-width) */}
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${desktopCols},1fr)`, gap:16, alignItems:"stretch" }}>

        {/* col1 row1 — auto em ambos os modos */}
        <Section title="Receita vs" serifWord="Gasto"
          insight={{ color:kpis.saldo>=0?T.green:T.red, icon:"💡",
            text:`Último mês (<strong>${kpiRefLabel}</strong>): saldo <strong>${fmtBRL(kpis.saldo)}</strong> (${kpis.taxa}% da receita). Acumulado em <strong>${periodo}</strong>: <strong>${fmtBRL(kpis.periodSaldo)}</strong> (${kpis.periodTaxa}% da receita). ${kpis.tendR>0?`Receita subiu ${kpis.tendR}% vs o mês anterior.`:`Receita caiu ${Math.abs(kpis.tendR)}% vs o mês anterior.`}` }}>
          <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", minHeight:0 }}>
            <ReceitaGastoChart height={desktopChartH} />
          </div>
          <div style={{ display:"flex", gap:12, marginTop:10, justifyContent:"center", flexShrink:0 }}>
            {[["Receita",T.green],["Gasto",T.red]].map(([l,c]) => (
              <div key={l} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:9, height:9, borderRadius:2, background:c }} />
                <span style={{ ...G, fontSize:10, color:T.inkLight }}>{l}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* col2 row1 — auto em ambos os modos */}
        <Section title="Cascata de" serifWord="caixa"
          insight={{ color:T.green, icon:"🔍", text: cascadeInsightHtml }}>
          <div style={{ flex:1, minHeight:0, width:"100%", overflow:"hidden", display:"flex", flexDirection:"column" }}>
            <div style={{ flex:1, minHeight:0, width:"100%" }}>
              <WaterfallChart plotHeight={desktopChartH} rows={waterfallRows} fmtK={fmtK} />
            </div>
          </div>
        </Section>

        {/* 3-col: col3 row1 explícito | 2-col: col2 row2 auto */}
        <Section title="Score de" serifWord="aderência"
          style={desktopCols===3 ? { gridColumn:3, gridRow:1 } : undefined}
          insight={{ color:kpis.avgScore>=80?T.green:kpis.avgScore>=65?T.amber:T.red, icon:"🏆",
            text:`Score médio em ${periodo}: <strong>${kpis.avgScore}/100</strong>. Melhor: <strong>${kpis.bestScore}</strong> · Pior: <strong>${kpis.worstScore}</strong>. Clique em uma barra para detalhar.` }}>
          <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", minHeight:0 }}>
            <ScoreChart height={desktopChartH} />
          </div>
          {scoreDetail && <div style={{ marginTop:12, flexShrink:0 }}><ScoreDetailCard /></div>}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginTop:12, flexShrink:0 }}>
            {scoreData.map(m => {
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

        {/* 3-col: col1-2 row2 (span 2) | 2-col: col1 row2 auto */}
        <Section title="Evolução por" serifWord="categoria"
          style={desktopCols===3 ? { gridColumn:"1 / span 2", gridRow:2 } : undefined}
          insight={{ color:T.purple, icon:"📊",
            text:`Clique nas categorias abaixo para isolar. ${selectedCat ? `<strong>${selectedCat}</strong> em destaque.` : "Lazer e Outros variaram +134% em Nov–Dez vs set."}`}}>
          <div style={{ marginBottom:10, flexShrink:0 }}><CatLegend /></div>
          <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", minHeight:0 }}>
            <DriftChart height={desktopChartH} />
          </div>
        </Section>

        {/* 3-col: col3 row2 | 2-col: full-width (span 2) */}
        <Section title="Composição dos" serifWord="gastos"
          style={desktopCols===3 ? { gridColumn:3, gridRow:2 } : { gridColumn:"1 / -1" }}
          insight={{ color:T.amber, icon:"🔒",
            text:`<strong>R$\u00a03.300 (38% da receita)</strong> comprometidos antes do primeiro gasto — fixo e recorrências. Margem discricionária real em Março: <strong>R$\u00a01.081</strong>.` }}>
          <div style={{ ...G, fontSize:10, color:T.inkLight, marginBottom:12 }}>{compositionWindowLabel}</div>
          <ComposicaoDonutSection
            compositionData={compositionData}
            fmtBRL={fmtBRL}
            desktopPieSize={Math.min(210, Math.max(150, Math.round(desktopChartH * 0.78)))}
          />
        </Section>

        {/* 3-col: span 3 row3 | 2-col: full-width (span 2) */}
        <Section title="Velocidade de" serifWord="gasto"
          style={{ gridColumn: desktopCols===3 ? "1 / span 3" : "1 / -1", gridRow: desktopCols===3 ? 3 : undefined }}
          insight={{ color:T.red, icon:"⚡", text: velocityInsightHtml }}>
          <VelocidadeChart height={desktopChartH} data={velocityDaily} />
          <div style={{ marginTop:8 }}><VelocLegend /></div>
        </Section>

      </div>

    </div>
  );

}
