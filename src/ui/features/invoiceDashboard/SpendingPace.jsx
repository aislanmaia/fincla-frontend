import { useState } from "react";

import { Card } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";

const valueOf = (value) => value == null || value === "" ? null : Number(value);

function Average({ detail, currency }) {
  const average = valueOf(detail.six_month_average);
  const count = detail.six_month_average_invoices_count ?? 0;
  const change = valueOf(detail.six_month_average_change);
  return (
    <Card data-testid="six-month-average" style={{ padding: 18, minWidth: 0 }}>
      <h3 style={{ ...G, fontSize: 14, color: T.ink, margin: 0 }}>Média dos últimos 6 meses</h3>
      {average === null ? (
        <p style={{ ...G, color: T.inkMid, fontSize: 12 }}>Sem faturas anteriores para comparar.</p>
      ) : (
        <>
          <div style={{ ...G, ...NUM, fontSize: 25, fontWeight: 800, color: T.ink, marginTop: 12 }}>{formatMoney(average, currency)}</div>
          <div style={{ ...G, color: T.inkMid, fontSize: 12, marginTop: 4 }}>Baseada em {count} {count === 1 ? "fatura" : "faturas"} com lançamentos</div>
          {change !== null && (
            <div style={{ ...G, ...NUM, fontSize: 12, color: change > 0 ? T.red : change < 0 ? T.green : T.inkMid, marginTop: 10 }}>
              Esta fatura está {Math.abs(change).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% {change > 0 ? "acima" : change < 0 ? "abaixo" : "igual à"} {change === 0 ? "média" : "da média"}.
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function PaceChart({ pace, currency }) {
  const [focusDay, setFocusDay] = useState(null);
  const current = pace.current ?? [];
  const previous = pace.previous?.points ?? [];
  const all = [...current, ...previous];
  const days = Math.max(1, ...all.map((point) => point.day));
  const values = all.map((point) => valueOf(point.cumulative)).filter((value) => value !== null);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const x = (day) => 28 + ((day - 1) / Math.max(1, days - 1)) * 524;
  const y = (value) => 180 - ((value - min) / (max - min || 1)) * 148;
  const points = (series) => series.filter((point) => valueOf(point.cumulative) !== null).map((point) => `${x(point.day)},${y(valueOf(point.cumulative))}`).join(" ");
  const activeDay = focusDay ?? current.at(-1)?.day ?? previous.at(-1)?.day;
  const currentPoint = current.find((point) => point.day === activeDay);
  const previousPoint = previous.find((point) => point.day === activeDay);
  const activeValue = currentPoint ?? previousPoint;
  const tooltip = activeValue ? `${currentPoint ? formatMoney(currentPoint.cumulative, currency) : "—"}${pace.previous ? ` / ${previousPoint ? formatMoney(previousPoint.cumulative, currency) : "—"}` : ""}` : "";

  return (
    <Card data-testid="spending-pace" style={{ padding: 18, minWidth: 0 }}>
      <h3 style={{ ...G, fontSize: 14, color: T.ink, margin: 0 }}>Velocidade de gasto</h3>
      <p style={{ ...G, fontSize: 12, color: T.inkMid, margin: "4px 0 12px" }}>Acumulado por dia do ciclo da fatura</p>
      {all.length === 0 ? <p style={{ ...G, fontSize: 12, color: T.inkMid }}>O ciclo ainda não começou.</p> : (
        <>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", ...G, fontSize: 11, color: T.inkMid }}>
            <span><span style={{ color: T.blue }}>●</span> Ciclo atual</span>
            {pace.previous && <span><span style={{ color: T.inkGhost }}>●</span> Ciclo anterior</span>}
          </div>
          <div style={{ position: "relative", minWidth: 0, marginTop: 8 }}>
          <svg role="img" aria-label="Gráfico de gasto acumulado por dia do ciclo. Use as setas para explorar os valores." tabIndex="0"
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              setFocusDay(Math.min(days, Math.max(1, (activeDay ?? 1) + (event.key === "ArrowRight" ? 1 : -1))));
            }}
            onMouseMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const position = ((event.clientX - rect.left) / rect.width) * 580;
              setFocusDay(Math.min(days, Math.max(1, Math.round(((position - 28) / 524) * (days - 1)) + 1)));
            }}
            viewBox="0 0 580 220" style={{ width: "100%", height: "auto", display: "block" }}>
            <line x1="28" y1="180" x2="552" y2="180" stroke={T.border} />
            {previous.length > 1 && <polyline points={points(previous)} fill="none" stroke={T.inkGhost} strokeWidth="2.5" strokeDasharray="5 4" strokeLinejoin="round" />}
            {current.length > 1 && <polyline points={points(current)} fill="none" stroke={T.blue} strokeWidth="3" strokeLinejoin="round" />}
            {previous.length === 1 && <circle data-testid="pace-previous-point" cx={x(previous[0].day)} cy={y(valueOf(previous[0].cumulative))} r="5" fill={T.inkGhost} />}
            {current.length === 1 && <circle data-testid="pace-current-point" cx={x(current[0].day)} cy={y(valueOf(current[0].cumulative))} r="5" fill={T.blue} />}
            <text x="28" y="207" style={{ ...G, fontSize: 11, fill: T.inkMid }}>Dia 1</text>
            <text x="552" y="207" textAnchor="end" style={{ ...G, fontSize: 11, fill: T.inkMid }}>Dia {days}</text>
          </svg>
          {activeValue && <div data-testid="pace-tooltip" style={{
            position: "absolute", left: `clamp(0px, ${x(activeDay) / 580 * 100}%, calc(100% - 180px))`,
            top: `clamp(48px, ${y(valueOf(activeValue.cumulative)) / 220 * 100}%, 100%)`,
            transform: "translateY(-100%)", boxSizing: "border-box", maxWidth: "min(180px, 100%)",
            padding: "6px 9px", borderRadius: 7, background: T.ink, color: T.surface,
            boxShadow: T.md, pointerEvents: "none", zIndex: 1,
          }}>
            <div style={{ ...G, fontSize: 11, lineHeight: 1.3 }}>Dia {activeDay} · {pace.previous ? "atual / anterior" : "ciclo atual"}</div>
            <div style={{ ...G, ...NUM, fontSize: 12, fontWeight: 700, lineHeight: 1.3, whiteSpace: "nowrap" }}>{tooltip}</div>
          </div>}
          </div>
          {activeDay != null && <div role="status" style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>
            Dia {activeDay}: {currentPoint ? `atual ${formatMoney(currentPoint.cumulative, currency)}` : "atual ainda sem dados"}
            {pace.previous && ` · anterior ${previousPoint ? formatMoney(previousPoint.cumulative, currency) : "sem dados"}`}
          </div>}
        </>
      )}
    </Card>
  );
}

export function InvoiceMetrics({ detail, currency, isMobile }) {
  if (!detail) return null;
  return (
    <section aria-label="Média e velocidade de gasto" style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 0.75fr) minmax(0, 1.25fr)", gap: 16, minWidth: 0 }}>
      <Average detail={detail} currency={currency} />
      {detail.spending_pace && <PaceChart key={detail.month} pace={detail.spending_pace} currency={currency} />}
    </section>
  );
}
