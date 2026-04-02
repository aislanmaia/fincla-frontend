import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { T } from "../tokens";
import { G, NUM } from "../typography";
import { formatYmdToLocaleDisplay, todayLocalYmd } from "../data/transactionsAdapter.js";

const UI_FALLBACK_EN = {
  today: "Today",
  close: "Close",
  prevMonthAria: "Previous month",
  nextMonthAria: "Next month",
  calendarAria: "Calendar",
};

/** Textos de ação/A11y por idioma (prefixo BCP 47). Intl não cobre estes rótulos. */
const UI_BY_LANG_PREFIX = {
  pt: {
    today: "Hoje",
    close: "Fechar",
    prevMonthAria: "Mês anterior",
    nextMonthAria: "Próximo mês",
    calendarAria: "Calendário",
  },
  es: {
    today: "Hoy",
    close: "Cerrar",
    prevMonthAria: "Mes anterior",
    nextMonthAria: "Mes siguiente",
    calendarAria: "Calendario",
  },
  en: { ...UI_FALLBACK_EN },
};

/**
 * @param {string} locale BCP 47 (ex.: pt-BR, en-US)
 * @param {Partial<typeof UI_FALLBACK_EN>} [override]
 */
export function resolveLocaleDatePickerMessages(locale, override = {}) {
  const loc = (locale || "en-US").toString();
  const prefix = loc.split(/[-_]/)[0].toLowerCase();
  const fromLang = UI_BY_LANG_PREFIX[prefix] || {};
  return { ...UI_FALLBACK_EN, ...fromLang, ...override };
}

/** Cabeçalhos de coluna: domingo → sábado (alinhado a `Date.getDay()`). */
export function weekdayLabelsShort(locale) {
  try {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    const anchor = new Date(2024, 0, 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + i);
      return fmt.format(d);
    });
  } catch {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  }
}

export function formatMonthYearTitle(year, monthIndex, locale) {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(new Date(year, monthIndex, 1));
  } catch {
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  }
}

function parseYmd(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function ymdFromParts(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function startOfLocalDay(dt) {
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
}

/**
 * Seletor de data com calendário popover; nomes de mês/dia da semana via `Intl` (`locale`).
 * Textos de botões (Hoje, Fechar, aria) vêm de `resolveLocaleDatePickerMessages` + `messages`.
 *
 * @param {object} props
 * @param {string} [props.locale='pt-BR'] BCP 47
 * @param {Partial<{today:string,close:string,prevMonthAria:string,nextMonthAria:string,calendarAria:string}>} [props.messages]
 */
export function LocaleDatePicker({
  id,
  value,
  onChange,
  min = "2000-01-01",
  max = "2100-12-31",
  disabled = false,
  variant = "desktop",
  locale = "pt-BR",
  messages: messagesOverride,
}) {
  const messages = useMemo(
    () => resolveLocaleDatePickerMessages(locale, messagesOverride),
    [locale, messagesOverride],
  );

  const weekdays = useMemo(() => weekdayLabelsShort(locale), [locale]);

  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const popoverRef = useRef(null);
  const buttonRef = useRef(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, width: 280 });

  const minD = useMemo(() => parseYmd(min), [min]);
  const maxD = useMemo(() => parseYmd(max), [max]);

  const selected = parseYmd(value);
  const [cursor, setCursor] = useState(() =>
    selected
      ? new Date(selected.getFullYear(), selected.getMonth(), 1)
      : new Date(),
  );

  useEffect(() => {
    if (!open) return;
    const d = parseYmd(value);
    if (d) setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
  }, [open, value]);

  const updatePopoverPosition = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = variant === "mobile" ? Math.min(r.width, 320) : 280;
    const left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12));
    let top = r.bottom + 6;
    const estHeight = 340;
    if (top + estHeight > window.innerHeight - 8) {
      top = Math.max(8, r.top - estHeight - 6);
    }
    setPopoverPos({ top, left, width: w });
  }, [variant]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePopoverPosition();
  }, [open, updatePopoverPosition]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => updatePopoverPosition();
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, updatePopoverPosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      if (popoverRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  /** Mesma escala do painel de período (preset rows): leitura confortável e Geist explícito. */
  const displayFontSize = variant === "mobile" ? 15 : 14;
  const iconSize = variant === "mobile" ? 18 : 16;
  const pad = variant === "mobile" ? "12px 14px" : "10px 12px";
  const radius = variant === "mobile" ? 12 : 10;

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const monthTitle = useMemo(
    () => formatMonthYearTitle(year, monthIndex, locale),
    [year, monthIndex, locale],
  );

  const firstDow = new Date(year, monthIndex, 1).getDay();
  const nDays = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= nDays; d++) cells.push(d);

  const isDisabledYmd = (ymd) => {
    const dt = parseYmd(ymd);
    if (!dt) return true;
    const t0 = startOfLocalDay(dt);
    if (minD && t0 < startOfLocalDay(minD)) return true;
    if (maxD && t0 > startOfLocalDay(maxD)) return true;
    return false;
  };

  const pick = (day) => {
    if (day == null) return;
    const ymd = ymdFromParts(year, monthIndex + 1, day);
    if (isDisabledYmd(ymd)) return;
    onChange(ymd);
    setOpen(false);
  };

  const shiftMonth = (delta) => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  };

  const todayY = todayLocalYmd();

  const canPrev =
    !minD ||
    new Date(year, monthIndex, 1).getTime() >
      new Date(minD.getFullYear(), minD.getMonth(), 1).getTime();
  const canNext =
    !maxD ||
    new Date(year, monthIndex, 1).getTime() <
      new Date(maxD.getFullYear(), maxD.getMonth(), 1).getTime();

  const goToday = () => {
    const t = todayLocalYmd();
    if (!isDisabledYmd(t)) {
      onChange(t);
      setOpen(false);
    }
  };

  const popover = open && (
    <div
      ref={popoverRef}
      data-fincla-locale-calendar-popover=""
      role="dialog"
      aria-label={messages.calendarAria}
      style={{
        position: "fixed",
        top: popoverPos.top,
        left: popoverPos.left,
        width: popoverPos.width,
        zIndex: 10000,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        boxShadow: T.lg,
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <button
          type="button"
          aria-label={messages.prevMonthAria}
          disabled={!canPrev}
          onClick={() => canPrev && shiftMonth(-1)}
          style={{
            border: "none",
            background: T.bg,
            borderRadius: 8,
            padding: 6,
            cursor: canPrev ? "pointer" : "not-allowed",
            opacity: canPrev ? 1 : 0.35,
            display: "flex",
          }}
        >
          <ChevronLeft size={18} color={T.ink} />
        </button>
        <span style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, textAlign: "center", flex: 1, padding: "0 4px" }}>
          {monthTitle}
        </span>
        <button
          type="button"
          aria-label={messages.nextMonthAria}
          disabled={!canNext}
          onClick={() => canNext && shiftMonth(1)}
          style={{
            border: "none",
            background: T.bg,
            borderRadius: 8,
            padding: 6,
            cursor: canNext ? "pointer" : "not-allowed",
            opacity: canNext ? 1 : 0.35,
            display: "flex",
          }}
        >
          <ChevronRight size={18} color={T.ink} />
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 2,
          marginBottom: 6,
        }}
      >
        {weekdays.map((wd, wi) => (
          <div
            key={`w-${wi}`}
            style={{
              ...G,
              fontSize: 10,
              fontWeight: 700,
              color: T.inkLight,
              textAlign: "center",
              padding: "4px 0",
            }}
          >
            {wd}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
        }}
      >
        {cells.map((day, idx) => {
          if (day == null) return <div key={`e-${idx}`} />;
          const cellYmd = ymdFromParts(year, monthIndex + 1, day);
          const dis = isDisabledYmd(cellYmd);
          const sel = value === cellYmd;
          const isTodayCell = todayY === cellYmd;
          return (
            <button
              key={day}
              type="button"
              disabled={dis}
              onClick={() => pick(day)}
              style={{
                ...G,
                border: "none",
                borderRadius: 8,
                padding: "8px 0",
                fontSize: 12,
                fontWeight: 600,
                cursor: dis ? "not-allowed" : "pointer",
                background: sel ? T.ink : isTodayCell ? T.bg : "transparent",
                color: sel ? "#fff" : dis ? T.inkGhost : T.ink,
                opacity: dis ? 0.35 : 1,
              }}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 10,
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={goToday}
          disabled={isDisabledYmd(todayY)}
          style={{
            ...G,
            flex: 1,
            border: "none",
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 12,
            fontWeight: 600,
            background: T.blueLight,
            color: T.blue,
            cursor: isDisabledYmd(todayY) ? "not-allowed" : "pointer",
            opacity: isDisabledYmd(todayY) ? 0.45 : 1,
          }}
        >
          {messages.today}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            ...G,
            flex: 1,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 12,
            fontWeight: 600,
            background: T.surface,
            color: T.inkMid,
            cursor: "pointer",
          }}
        >
          {messages.close}
        </button>
      </div>
    </div>
  );

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <button
        ref={buttonRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        style={{
          ...G,
          width: "100%",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: variant === "mobile" ? 10 : 8,
          padding: pad,
          border: `1px solid ${T.border}`,
          borderRadius: radius,
          background: T.surface,
          cursor: disabled ? "not-allowed" : "pointer",
          textAlign: "left",
          color: T.ink,
          opacity: disabled ? 0.6 : 1,
          lineHeight: 1.35,
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <Calendar size={iconSize} color={T.inkMid} strokeWidth={2} style={{ flexShrink: 0 }} />
        <span
          style={{
            ...G,
            ...NUM,
            flex: 1,
            minWidth: 0,
            fontSize: displayFontSize,
            fontWeight: 600,
            color: T.ink,
            letterSpacing: "-0.01em",
            lineHeight: 1.35,
          }}
        >
          {formatYmdToLocaleDisplay(value, locale)}
        </span>
      </button>
      {typeof document !== "undefined" && popover
        ? createPortal(popover, document.body)
        : null}
    </div>
  );
}
