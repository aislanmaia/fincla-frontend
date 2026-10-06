import { useMemo, useState } from "react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Card } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { monthShort } from "./hubInvoices.js";
import { categoryTrend, historyPoints } from "./hubCharts.js";

const PALETTE = [T.green, T.blue, T.amber, T.purple, T.red, T.inkMid];
const LABEL = { paid: "Paga", closed: "Fechada", open: "Atual", forecast: "Prevista" };

function ChartEmpty({ children }) {
  return <div role="status" style={{ ...G, color: T.inkLight, fontSize: 12, padding: "26px 0" }}>{children}</div>;
}

function LegendItem({ color, label, dashed = false }) {
  return <span style={{ ...G, display: "inline-flex", alignItems: "center", gap: 5, color: T.inkMid, fontSize: 11 }}>
    <span style={{ width: 10, height: dashed ? 2 : 8, background: dashed ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)` : color, borderRadius: 2 }} />
    {label}
  </span>;
}

function ChartTooltip({ title, children, bottom, open = false, style }) {
  return <span className={`hub-chart-tooltip${open ? " hub-chart-tooltip-open" : ""}`} role="tooltip" style={{ bottom, ...style }}>
    <strong style={{ display: "block", fontSize: 11, color: T.ink, marginBottom: 3 }}>{title}</strong>
    <span style={{ display: "block", fontSize: 12, color: T.inkMid }}>{children}</span>
  </span>;
}

function HistoryBars({ points, currency, onPick }) {
  const max = Math.max(...points.map((point) => Math.max(point.total ?? 0, 0)), 0);
  return <div style={{ display: "flex", alignItems: "end", gap: 8, height: 130, paddingTop: 8 }}>
    {points.map((point) => {
      const height = point.total === null ? 0 : Math.max(2, Math.round((Math.max(0, point.total) / (max || 1)) * 100));
      const color = point.status === "forecast" ? T.blueBar : point.current ? T.blue : point.status === "closed" ? T.amber : T.grayLight;
      return <button key={point.key} type="button" onClick={() => onPick(point.key)}
        onMouseEnter={(event) => { event.currentTarget.removeAttribute("data-dismissed"); onPick(point.key); }}
        onFocus={(event) => { event.currentTarget.removeAttribute("data-dismissed"); onPick(point.key); }}
        onMouseLeave={() => onPick(null)} onBlur={() => onPick(null)}
        onKeyDown={(event) => { if (event.key === "Escape") { onPick(null); event.currentTarget.dataset.dismissed = "true"; } }}
        aria-label={`${monthShort(point.month)} ${point.key.slice(0, 4)}: ${point.total === null ? "sem fatura" : formatMoney(point.total, currency)}`}
        className="hub-chart-point"
        style={{ ...G, position: "relative", flex: 1, minWidth: 0, height: "100%", padding: 0, border: 0, background: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "end", gap: 5, cursor: "pointer" }}>
        {point.total === null
          ? <span style={{ ...G, color: T.inkLight, fontSize: 10, borderBottom: `1px dashed ${T.border}`, width: "min(100%, 54px)", paddingBottom: 3 }}>Sem dados</span>
          : <span style={{ width: "100%", maxWidth: 50, height, background: color, opacity: point.status === "forecast" ? 0.7 : 1, borderRadius: "4px 4px 0 0" }} />}
        <span style={{ ...NUM, color: point.current ? T.ink : T.inkLight, fontSize: 10, fontWeight: point.current ? 800 : 500 }}>{monthShort(point.month)}</span>
        <ChartTooltip title={`${monthShort(point.month)} ${point.key.slice(0, 4)}${point.status ? ` · ${LABEL[point.status] ?? "Fatura"}` : ""}`} bottom={Math.min(height, 100) + 22}>
          {point.total === null ? "Sem fatura registrada" : formatMoney(point.total, currency)}
        </ChartTooltip>
      </button>;
    })}
  </div>;
}

function HistoryLines({ points, currency, activeKey, onPick }) {
  const known = points.map((point, index) => ({ ...point, index })).filter((point) => point.total !== null);
  const max = Math.max(...known.map((point) => point.total), 0);
  const min = Math.min(...known.map((point) => point.total), 0);
  const y = (amount) => 115 - ((amount - min) / (max - min || 1)) * 90;
  const x = (index) => 20 + (index / Math.max(1, points.length - 1)) * 360;
  const segments = [];
  for (let i = 1; i < known.length; i += 1) {
    if (known[i].index !== known[i - 1].index + 1) continue;
    segments.push({ from: known[i - 1], to: known[i] });
  }
  const active = known.find((point) => point.key === activeKey);
  return <>
    <div style={{ position: "relative" }} onMouseLeave={() => onPick(null)}>
    <svg role="img" aria-label="Evolução das faturas" viewBox="0 0 400 140" style={{ width: "100%", height: 140, overflow: "visible" }}>
      {segments.map(({ from, to }) => <line key={`${from.key}-${to.key}`} x1={x(from.index)} y1={y(from.total)} x2={x(to.index)} y2={y(to.total)}
        stroke={T.blue} strokeWidth="2.5" strokeDasharray={to.status === "forecast" ? "5 4" : undefined} />)}
      {known.map((point) => <g key={point.key} role="button" tabIndex={0}
        aria-label={`${monthShort(point.month)} ${point.key.slice(0, 4)}: ${formatMoney(point.total, currency)}`}
        onMouseEnter={() => onPick(point.key)} onFocus={() => onPick(point.key)} onBlur={() => onPick(null)}
        onClick={() => onPick(point.key)} onKeyDown={(event) => {
          if (event.key === "Escape") onPick(null);
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onPick(point.key); }
        }}
        style={{ cursor: "pointer" }}>
        <circle cx={x(point.index)} cy={y(point.total)} r="12" fill="transparent" />
        <circle cx={x(point.index)} cy={y(point.total)} r={point.key === activeKey ? 6 : 4} fill={point.key === activeKey ? T.blue : T.surface} stroke={T.blue} strokeWidth="2" />
      </g>)}
    </svg>
    {active && <ChartTooltip open title={`${monthShort(active.month)} ${active.key.slice(0, 4)} · ${LABEL[active.status] ?? "Fatura"}`}
      style={{ left: `${x(active.index) / 400 * 100}%`, top: `${y(active.total) / 140 * 100}%`, bottom: "auto", transform: "translate(-50%, -105%)" }}>
      {formatMoney(active.total, currency)}
    </ChartTooltip>}
    </div>
    <div style={{ display: "flex", justifyContent: "space-between" }}>{points.map((point) => <span key={point.key} style={{ ...NUM, fontSize: 9, color: point.current ? T.ink : T.inkLight, fontWeight: point.current ? 800 : 500 }}>{monthShort(point.month)}</span>)}</div>
  </>;
}

export function InvoiceHistoryChart({ invoices, anchorKey, currency, isMobile, onTimeline }) {
  const [mode, setMode] = useState("bars");
  const [activeKey, setActiveKey] = useState(null);
  const points = useMemo(() => historyPoints(invoices, anchorKey, isMobile && mode === "bars"), [invoices, anchorKey, isMobile, mode]);
  const hasData = points.some((point) => point.total !== null);
  return <Card style={{ padding: isMobile ? 14 : 18, minWidth: 0 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
      <h2 style={{ ...G, margin: 0, fontSize: 15, color: T.ink }}>Histórico de faturas</h2>
      <div role="group" aria-label="Tipo de gráfico" style={{ display: "flex", background: T.grayLight, padding: 3, borderRadius: 8 }}>
        {["bars", "lines"].map((value) => <button key={value} type="button" onClick={() => { setMode(value); setActiveKey(null); }} aria-pressed={mode === value}
          style={{ ...G, border: 0, borderRadius: 6, background: mode === value ? T.surface : "transparent", color: T.ink, padding: "5px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          {value === "bars" ? "Barras" : "Linhas"}
        </button>)}
      </div>
    </div>
    {!isMobile && <p style={{ ...G, color: T.inkLight, fontSize: 11, margin: "7px 0 0" }}>
      {points.length > 0 ? `Faturas disponíveis desde ${monthShort(points[0].month)} ${points[0].key.slice(0, 4)}` : "Sem faturas registradas no período"}
    </p>}
    {onTimeline && <button type="button" onClick={onTimeline} style={{ ...G, display: "block", color: T.blue, background: T.blueLight, border: 0, borderRadius: 99, fontSize: 11, fontWeight: 700, padding: "6px 9px", marginTop: 10, cursor: "pointer" }}>Ver linha do tempo completa de parcelas →</button>}
    {!hasData ? <ChartEmpty>Sem valores de faturas neste período.</ChartEmpty> : mode === "bars"
      ? <HistoryBars points={points} currency={currency} onPick={setActiveKey} />
      : <HistoryLines points={points} currency={currency} activeKey={activeKey} onPick={setActiveKey} />}
    {hasData && <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
      {mode === "lines" ? <>
        <LegendItem color={T.blue} label="Realizado" />
        <LegendItem color={T.blue} label="Comprometido" dashed />
      </> : <>
        <LegendItem color={T.grayLight} label="Paga" />
        <LegendItem color={T.amber} label="Fechada" />
        <LegendItem color={T.blue} label="Atual" />
        <LegendItem color={T.blueBar} label="Comprometido" />
      </>}
    </div>}
  </Card>;
}

export function CategoryTrendChart({ history, anchorKey, currency, isMobile }) {
  const trend = useMemo(() => categoryTrend(history, anchorKey), [history, anchorKey]);
  const max = trend ? Math.max(...trend.months.map((month) => Object.values(month.values).reduce((sum, amount) => sum + Math.max(amount, 0), 0)), 0) : 0;
  const [activeKey, setActiveKey] = useState(null);
  return <Card style={{ padding: isMobile ? 14 : 18, minWidth: 0 }}>
    <h2 style={{ ...G, margin: 0, fontSize: 15, color: T.ink }}>Tendência por categoria</h2>
    <p style={{ ...G, color: T.inkLight, fontSize: 11, margin: "6px 0 0" }}>
      {trend?.months.length ? `Gastos classificados desde ${monthShort(trend.months[0].month)} ${trend.months[0].key.slice(0, 4)}` : "Evolução dos gastos por categoria"}
    </p>
    {!trend ? <ChartEmpty>Dados por categoria indisponíveis para este cartão.</ChartEmpty>
      : trend.categories.length === 0 ? <ChartEmpty>Sem gastos classificados neste período.</ChartEmpty>
        : <>
          <div style={{ display: "flex", alignItems: "end", gap: isMobile ? 8 : 14, height: 130, marginTop: 8 }}>
            {trend.months.map((month) => {
              const entries = Object.entries(month.values);
              const positiveTotal = entries.reduce((sum, [, amount]) => sum + Math.max(amount, 0), 0);
              const netTotal = entries.reduce((sum, [, amount]) => sum + amount, 0);
              const stackHeight = positiveTotal / (max || 1) * 105;
              const detail = entries.length
                ? entries.map(([category, amount]) => `${category} ${formatMoney(amount, currency)}`).join("; ")
                : month.available ? "Sem gasto classificado" : "Sem fatura registrada";
              return <button key={month.key} type="button" onClick={() => setActiveKey(month.key)}
                onMouseEnter={(event) => { event.currentTarget.removeAttribute("data-dismissed"); setActiveKey(month.key); }}
                onFocus={(event) => { event.currentTarget.removeAttribute("data-dismissed"); setActiveKey(month.key); }}
                onMouseLeave={() => setActiveKey(null)} onBlur={() => setActiveKey(null)}
                onKeyDown={(event) => { if (event.key === "Escape") { setActiveKey(null); event.currentTarget.dataset.dismissed = "true"; } }}
                data-open={activeKey === month.key}
                aria-label={`${monthShort(month.month)} ${month.key.slice(0, 4)}: ${detail}`}
                className="hub-chart-point"
                style={{ ...G, position: "relative", border: 0, background: "none", flex: 1, minWidth: 0, padding: 0, height: "100%", display: "flex", flexDirection: "column", justifyContent: "end", alignItems: "center", gap: 5, cursor: "pointer" }}>
                <span style={{ width: "100%", maxWidth: 90, height: 105, display: "flex", flexDirection: "column-reverse", justifyContent: "flex-start" }}>
                  {trend.categories.map((category, index) => {
                    const amount = Math.max(month.values[category] ?? 0, 0);
                    return amount > 0 && <span key={category} style={{ display: "block", flexShrink: 0, background: PALETTE[index % PALETTE.length], height: Math.max(2, amount / (max || 1) * 105) }} />;
                  })}
                </span>
                <span style={{ ...NUM, fontSize: 10, color: T.inkLight }}>{monthShort(month.month)}{entries.some(([, amount]) => amount < 0) ? <span style={{ color: T.red }} aria-hidden="true"> ↺</span> : null}</span>
                <ChartTooltip title={`${monthShort(month.month)} ${month.key.slice(0, 4)}`} bottom={Math.min(stackHeight, 105) + 22}>
                  {entries.length ? <>{entries.map(([category, amount]) => <span key={category} style={{ display: "block" }}>{category}: {formatMoney(amount, currency)}</span>)}
                    <strong style={{ display: "block", borderTop: `1px solid ${T.border}`, marginTop: 5, paddingTop: 5 }}>Líquido: {formatMoney(netTotal, currency)}</strong></> : detail}
                </ChartTooltip>
              </button>;
            })}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
            {trend.categories.map((category, index) => <LegendItem key={category} color={PALETTE[index % PALETTE.length]} label={category} />)}
          </div>
          {trend.months.some((month) => Object.values(month.values).some((amount) => amount < 0)) && <p style={{ ...G, fontSize: 11, color: T.inkLight, margin: "8px 0 0" }}>Valores negativos por estorno aparecem ao selecionar o mês.</p>}
        </>}
  </Card>;
}
