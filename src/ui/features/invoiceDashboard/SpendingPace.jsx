import { useState } from "react";

import { Card } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";

const valueOf = (value) => value == null || value === "" ? null : Number(value);

export function AverageComparison({ detail, currency }) {
  const average = valueOf(detail.six_month_average);
  const count = detail.six_month_average_invoices_count ?? 0;
  const change = valueOf(detail.six_month_average_change);
  return (
    <Card data-testid="six-month-average" style={{ padding: 18, minWidth: 0 }}>
      <h3 style={{ ...G, fontSize: 14, color: T.ink, margin: 0 }}>Comparado à sua média (6 meses)</h3>
      {average === null ? (
        <p style={{ ...G, color: T.inkMid, fontSize: 12 }}>Sem faturas anteriores para comparar.</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, alignItems: "end", height: 110, marginTop: 12 }}>
            {[{ label: "Média", value: average, color: T.grayLight }, { label: "Esta fatura", value: Number(detail.total_amount), color: T.amber }].map((bar) => (
              <div key={bar.label} style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
                <div style={{ ...G, ...NUM, fontSize: 11, fontWeight: 700, color: T.ink }}>{formatMoney(bar.value, currency)}</div>
                <div style={{ height: `${Math.max(3, Math.min(76, bar.value / Math.max(average, Number(detail.total_amount), 1) * 76))}px`, marginTop: 4, background: bar.color, borderRadius: "4px 4px 0 0" }} />
                <div style={{ ...G, fontSize: 10, color: T.inkMid, marginTop: 4 }}>{bar.label}</div>
              </div>
            ))}
          </div>
          <div style={{ ...G, color: T.inkMid, fontSize: 12, marginTop: 8 }}>Baseada em {count} {count === 1 ? "fatura" : "faturas"} com lançamentos</div>
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

export function SpendingPace({ pace, currency }) {
  const [focusDay, setFocusDay] = useState(null);
  const [focusSeries, setFocusSeries] = useState("current");
  const current = pace.current ?? [];
  const previous = pace.previous?.points ?? [];
  const all = [...current, ...previous];
  const days = Math.max(1, ...all.map((point) => point.day));
  const values = all.map((point) => valueOf(point.cumulative)).filter((value) => value !== null);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const x = (day) => 28 + (day / days) * 524;
  const y = (value) => 180 - ((value - min) / (max - min || 1)) * 148;
  const points = (series) => [
    `${x(0)},${y(0)}`,
    ...series.filter((point) => valueOf(point.cumulative) !== null).map((point) => `${x(point.day)},${y(valueOf(point.cumulative))}`),
  ].join(" ");
  const activeDay = focusDay ?? current.at(-1)?.day ?? previous.at(-1)?.day;
  const currentPoint = current.find((point) => point.day === activeDay);
  const previousPoint = previous.find((point) => point.day === activeDay);
  const activeValue = focusSeries === "previous" ? previousPoint ?? currentPoint : currentPoint ?? previousPoint;
  const tooltip = activeValue ? `${currentPoint ? formatMoney(currentPoint.cumulative, currency) : "—"}${pace.previous ? ` / ${previousPoint ? formatMoney(previousPoint.cumulative, currency) : "—"}` : ""}` : "";
  const lastCurrent = current.at(-1);
  const sameDayPrevious = lastCurrent ? previous.find((point) => point.day === lastCurrent.day) : null;
  const hasPaceComparison = lastCurrent?.cumulative != null && sameDayPrevious?.cumulative != null;
  const faster = hasPaceComparison && Number(lastCurrent.cumulative) > Number(sameDayPrevious.cumulative);

  return (
    <Card data-testid="spending-pace" style={{ padding: 18, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h3 style={{ ...G, fontSize: 14, color: T.ink, margin: 0 }}>Velocidade de gasto</h3>
        {hasPaceComparison && <span style={{ ...G, fontSize: 10, fontWeight: 700, color: faster ? T.amber : T.green }}>{faster ? "Acima do ciclo anterior" : "Abaixo do ciclo anterior"}</span>}
      </div>
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
              const day = Math.min(days, Math.max(1, Math.round(((position - 28) / 524) * days)));
              const currentAtDay = current.find((point) => point.day === day);
              const previousAtDay = previous.find((point) => point.day === day);
              const pointerY = ((event.clientY - rect.top) / rect.height) * 220;
              const currentDistance = currentAtDay && valueOf(currentAtDay.cumulative) !== null
                ? Math.abs(pointerY - y(valueOf(currentAtDay.cumulative))) : Infinity;
              const previousDistance = previousAtDay && valueOf(previousAtDay.cumulative) !== null
                ? Math.abs(pointerY - y(valueOf(previousAtDay.cumulative))) : Infinity;
              setFocusDay(day);
              setFocusSeries(previousDistance < currentDistance ? "previous" : "current");
            }}
            viewBox="0 0 580 220" preserveAspectRatio="none" style={{ width: "100%", height: 170, display: "block" }}>
            {[32, 106, 180].map((gridY) => <line key={gridY} x1="28" y1={gridY} x2="552" y2={gridY} stroke={T.grayLight} />)}
            {previous.length > 0 && <polyline points={points(previous)} fill="none" stroke={T.inkGhost} strokeWidth="2.5" strokeDasharray="5 4" strokeLinejoin="round" />}
            {current.length > 0 && <polyline points={points(current)} fill="none" stroke={T.blue} strokeWidth="3" strokeLinejoin="round" />}
          </svg>
          {previous.length > 0 && valueOf(previous.at(-1).cumulative) !== null && <span data-testid="pace-previous-point" aria-hidden="true" style={{ position: "absolute", left: `${x(previous.at(-1).day) / 580 * 100}%`, top: `${y(valueOf(previous.at(-1).cumulative)) / 220 * 100}%`, width: 7, height: 7, borderRadius: "50%", background: T.inkGhost, transform: "translate(-50%, -50%)", pointerEvents: "none" }} />}
          {current.length > 0 && valueOf(current.at(-1).cumulative) !== null && <span data-testid="pace-current-point" aria-hidden="true" style={{ position: "absolute", left: `${x(current.at(-1).day) / 580 * 100}%`, top: `${y(valueOf(current.at(-1).cumulative)) / 220 * 100}%`, width: 9, height: 9, borderRadius: "50%", background: T.blue, transform: "translate(-50%, -50%)", pointerEvents: "none" }} />}
          {activeValue && <div data-testid="pace-tooltip" style={{
            position: "absolute", left: `clamp(0px, ${x(activeDay) / 580 * 100}%, calc(100% - 180px))`,
            top: `clamp(48px, ${y(valueOf(activeValue.cumulative)) / 220 * 100}%, 100%)`,
            transform: "translateY(-100%)", boxSizing: "border-box", maxWidth: "min(180px, 100%)",
            padding: "6px 9px", borderRadius: 7, background: T.ink, color: T.surface,
            boxShadow: T.md, pointerEvents: "none", zIndex: 1,
          }}>
            <div style={{ ...G, fontSize: 11, lineHeight: 1.3 }}>Dia {activeDay} · {focusSeries === "previous" && previousPoint ? "ciclo anterior" : "ciclo atual"}</div>
            <div style={{ ...G, ...NUM, fontSize: 12, fontWeight: 700, lineHeight: 1.3, whiteSpace: "nowrap" }}>{tooltip}</div>
          </div>}
          </div>
          <div aria-hidden="true" style={{ ...G, ...NUM, display: "flex", justifyContent: "space-between", fontSize: 11, color: T.inkMid, padding: "0 4px" }}>
            <span>Início ({formatMoney(0, currency) ?? "0"})</span><span>Dia {Math.ceil(days / 2)}</span><span>Dia {days}</span>
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
    <section aria-label="Velocidade de gasto" style={{ minWidth: 0 }}>
      {detail.spending_pace && <SpendingPace key={detail.month} pace={detail.spending_pace} currency={currency} isMobile={isMobile} />}
    </section>
  );
}
