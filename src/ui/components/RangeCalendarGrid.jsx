import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { T } from "../tokens";
import { G } from "../typography";
import { weekdayLabelsShort, formatCalendarNavMonth } from "./finclaCalendarI18n.js";
import {
  FINCLA_CAL_DAY_PX,
  finclaCalendarWeekdayCellStyle,
  finclaCalNavButtonBase,
  finclaCalMonthTitleStyle,
} from "./finclaCalendarStyles.js";
import { todayLocalYmd } from "../data/transactionsAdapter.js";
import { parseLocalYmd, ymdFromDate } from "../features/transactions/periodDateBounds.js";

function startOfDay(dt) {
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
}

function isYmdDisabled(ymd, minYmd, maxYmd) {
  const dt = parseLocalYmd(ymd);
  if (!dt) return true;
  const t = startOfDay(dt);
  const min = minYmd ? parseLocalYmd(minYmd) : null;
  const max = maxYmd ? parseLocalYmd(maxYmd) : null;
  if (min && t < startOfDay(min)) return true;
  if (max && t > startOfDay(max)) return true;
  return false;
}

function rangeEndYmd(fromYmd, toYmd, hoverYmd) {
  if (toYmd) return toYmd;
  if (fromYmd && hoverYmd && !toYmd) return hoverYmd;
  return null;
}

function dayState(ymd, fromYmd, toYmd, hoverYmd) {
  const endYmd = rangeEndYmd(fromYmd, toYmd, hoverYmd);
  const isFrom = Boolean(fromYmd && ymd === fromYmd);
  const isTo = Boolean(endYmd && ymd === endYmd);
  const edge = isFrom || isTo;

  let inRange = false;
  if (fromYmd && endYmd) {
    const from = parseLocalYmd(fromYmd);
    const end = parseLocalYmd(endYmd);
    const cur = parseLocalYmd(ymd);
    if (from && end && cur) {
      const lo = from <= end ? from : end;
      const hi = from <= end ? end : from;
      inRange = cur > lo && cur < hi;
    }
  }

  return { edge, isFrom, isTo, inRange };
}

function MonthGrid({
  year,
  monthIndex,
  fromYmd,
  toYmd,
  hoverYmd,
  minYmd,
  maxYmd,
  locale,
  onDayClick,
  onDayHover,
}) {
  const weekdays = useMemo(() => weekdayLabelsShort(locale), [locale]);
  const firstDow = new Date(year, monthIndex, 1).getDay();
  const nDays = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let d = 1; d <= nDays; d += 1) cells.push(d);

  const todayY = todayLocalYmd();

  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          ...G,
          ...finclaCalMonthTitleStyle,
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        {formatCalendarNavMonth(year, monthIndex, locale)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
        {weekdays.map((label, i) => (
          <div key={i} style={{ ...G, ...finclaCalendarWeekdayCellStyle }}>
            {label}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px 0" }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />;
          const ymd = ymdFromDate(new Date(year, monthIndex, day));
          const disabled = isYmdDisabled(ymd, minYmd, maxYmd);
          const { edge, isFrom, isTo, inRange } = dayState(ymd, fromYmd, toYmd, hoverYmd);
          const isToday = ymd === todayY;
          const hov = hoverYmd === ymd;

          return (
            <div
              key={ymd}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={ymd}
              aria-disabled={disabled}
              onClick={() => !disabled && onDayClick(ymd)}
              onKeyDown={(e) => {
                if (disabled) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onDayClick(ymd);
                }
              }}
              onMouseEnter={() => !disabled && onDayHover(ymd)}
              style={{
                textAlign: "center",
                cursor: disabled ? "not-allowed" : "pointer",
                padding: "1px 0",
                background: inRange ? `${T.blue}18` : "transparent",
                borderRadius: isFrom && isTo ? 8 : isFrom ? "8px 0 0 8px" : isTo ? "0 8px 8px 0" : "none",
                opacity: disabled ? 0.35 : 1,
              }}
            >
              <div
                style={{
                  width: FINCLA_CAL_DAY_PX,
                  height: FINCLA_CAL_DAY_PX,
                  borderRadius: "50%",
                  margin: "0 auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: edge ? T.ink : hov ? T.bg : "transparent",
                  border: isToday && !edge ? `1.5px solid ${T.ink}` : "none",
                  boxSizing: "border-box",
                  transition: "background 0.1s",
                }}
              >
                <span
                  style={{
                    ...G,
                    fontSize: 12,
                    fontWeight: edge || isToday ? 700 : 500,
                    color: edge ? "#fff" : isToday ? T.ink : T.inkMid,
                  }}
                >
                  {day}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Calendário de intervalo — um ou dois meses, seleção em 2 cliques com preview.
 */
export function RangeCalendarGrid({
  cursorYear,
  cursorMonth,
  monthCount = 2,
  fromYmd = "",
  toYmd = "",
  hoverYmd = null,
  minYmd,
  maxYmd,
  locale = "pt-BR",
  onDayClick,
  onDayHover,
  onPrevMonth,
  onNextMonth,
}) {
  const months = useMemo(() => {
    const list = [];
    for (let i = 0; i < monthCount; i += 1) {
      const dt = new Date(cursorYear, cursorMonth + i, 1);
      list.push({ year: dt.getFullYear(), monthIndex: dt.getMonth() });
    }
    return list;
  }, [cursorYear, cursorMonth, monthCount]);

  const navBase = finclaCalNavButtonBase();

  const minD = minYmd ? parseLocalYmd(minYmd) : null;
  const maxD = maxYmd ? parseLocalYmd(maxYmd) : null;
  const firstShown = new Date(cursorYear, cursorMonth, 1);
  const lastShown = new Date(cursorYear, cursorMonth + monthCount - 1, 1);

  const canPrev =
    !minD ||
    firstShown.getTime() > new Date(minD.getFullYear(), minD.getMonth(), 1).getTime();
  const canNext =
    !maxD ||
    lastShown.getTime() < new Date(maxD.getFullYear(), maxD.getMonth(), 1).getTime();

  return (
    <div
      onMouseLeave={() => onDayHover(null)}
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: compactPadding(monthCount),
        background: T.surface,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          gap: 8,
        }}
      >
        <button
          type="button"
          aria-label="Mês anterior"
          disabled={!canPrev}
          onClick={() => canPrev && onPrevMonth()}
          style={{
            ...navBase,
            cursor: canPrev ? "pointer" : "not-allowed",
            opacity: canPrev ? 1 : 0.35,
          }}
        >
          <ChevronLeft size={15} />
        </button>
        {monthCount === 1 ? (
          <div style={{ ...G, ...finclaCalMonthTitleStyle }}>
            {formatCalendarNavMonth(cursorYear, cursorMonth, locale)}
          </div>
        ) : (
          <div style={{ flex: 1 }} />
        )}
        <button
          type="button"
          aria-label="Próximo mês"
          disabled={!canNext}
          onClick={() => canNext && onNextMonth()}
          style={{
            ...navBase,
            cursor: canNext ? "pointer" : "not-allowed",
            opacity: canNext ? 1 : 0.35,
          }}
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: monthCount > 1 ? "1fr 1fr" : "1fr",
          gap: monthCount > 1 ? 16 : 0,
        }}
      >
        {months.map(({ year, monthIndex }) => (
          <MonthGrid
            key={`${year}-${monthIndex}`}
            year={year}
            monthIndex={monthIndex}
            fromYmd={fromYmd}
            toYmd={toYmd}
            hoverYmd={hoverYmd}
            minYmd={minYmd}
            maxYmd={maxYmd}
            locale={locale}
            onDayClick={onDayClick}
            onDayHover={onDayHover}
          />
        ))}
      </div>
    </div>
  );
}

function compactPadding(monthCount) {
  return monthCount > 1 ? "12px 14px 14px" : "12px 12px 14px";
}
