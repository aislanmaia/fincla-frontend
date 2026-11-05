import React from "react";

import { fmtMoneyIn } from "./consultantFormat";

export const DENSE_TREND_THRESHOLD = 6;

export function fmtCompactAmount(amount) {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(Number(amount) || 0);
}

export function fmtShortMonth(dateIso) {
  const date = new Date(`${dateIso}T12:00:00`);
  const month = date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${month}/${String(date.getFullYear()).slice(-2)}`;
}

function currencySymbol(currency) {
  const part = new Intl.NumberFormat("pt-BR", { style: "currency", currency }).formatToParts(0).find((item) => item.type === "currency");
  return part?.value || currency;
}

const fmtLongMonth = (dateIso) => new Date(`${dateIso}T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

function SeriesSheet({ title, points, currency, peak, onClose }) {
  const ref = React.useRef(null);
  React.useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="portfolio-expense__sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section
        ref={ref}
        tabIndex={-1}
        className="portfolio-expense__sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}
      >
        <div className="portfolio-expense__sheet-grip" aria-hidden="true" />
        <header>
          <h3>{title}</h3>
          <button type="button" aria-label="Fechar série mensal" onClick={onClose}>×</button>
        </header>
        <ul className="portfolio-expense__sheet-list fincla-scroll">
          {points.map((point) => (
            <li key={point.key}>
              <span>{fmtLongMonth(point.periodEnd)}</span>
              <i aria-hidden="true"><b style={{ width: `${Math.max(2, (point.amount / peak) * 100)}%` }} /></i>
              <strong>{fmtMoneyIn(point.amount, currency)}</strong>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/**
 * Monthly bars that stay readable at any width:
 * - up to 6 months: full labels;
 * - more months on wide screens: columns shrink with compact labels;
 * - more months on narrow screens: only the 6 most recent, plus a bottom sheet with the whole series.
 */
export function MonthlySeries({ points, currency, narrow, ariaLabel, sheetTitle, height = 90, className = "" }) {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const peak = Math.max(1, ...points.map((point) => point.amount));
  const long = points.length > DENSE_TREND_THRESHOLD;
  const collapsed = long && narrow;
  const visible = collapsed ? points.slice(-DENSE_TREND_THRESHOLD) : points;
  const compact = long;
  const modifier = collapsed ? " portfolio-expense__trend-bars--collapsed" : long ? " portfolio-expense__trend-bars--dense" : "";
  return (
    <>
      <div className={`portfolio-expense__trend-bars${modifier} ${className}`.trim()} role="img" aria-label={ariaLabel}>
        {visible.map((point) => {
          const label = fmtLongMonth(point.periodEnd);
          return (
            <div className="portfolio-expense__trend-point" key={point.key} role="group" aria-label={`${label}, ${fmtMoneyIn(point.amount, currency)}`}>
              <strong>{compact ? fmtCompactAmount(point.amount) : fmtMoneyIn(point.amount, currency)}</strong>
              <span style={{ height: `${Math.max(3, (point.amount / peak) * height)}px` }} />
              <small>{compact ? fmtShortMonth(point.periodEnd) : label}</small>
            </div>
          );
        })}
      </div>
      {compact && <small className="portfolio-expense__series-unit">Valores em {currencySymbol(currency)} (mil = milhares)</small>}
      {collapsed && <button type="button" className="portfolio-expense__series-more" onClick={() => setSheetOpen(true)}>Ver os {points.length} meses</button>}
      {sheetOpen && <SeriesSheet title={sheetTitle} points={points} currency={currency} peak={peak} onClose={() => setSheetOpen(false)} />}
    </>
  );
}
