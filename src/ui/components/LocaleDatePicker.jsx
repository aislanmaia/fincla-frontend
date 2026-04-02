import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { T } from "../tokens";
import { G, NUM } from "../typography";
import { formatYmdToLocaleDisplay, todayLocalYmd } from "../data/transactionsAdapter.js";
import { weekdayLabelsShort, formatCalendarNavMonth } from "./finclaCalendarI18n.js";
import {
  FINCLA_CALENDAR_SHADOW,
  FINCLA_CALENDAR_SURFACE_RADIUS,
  FINCLA_CAL_DAY_PX,
  finclaCalendarWeekdayCellStyle,
  finclaCalNavButtonBase,
  finclaCalMonthTitleStyle,
} from "./finclaCalendarStyles.js";
import { parseBrDateLooseResult } from "./localeDateInputParse.js";

const UI_FALLBACK_EN = {
  today: "Today",
  close: "Close",
  prevMonthAria: "Previous month",
  nextMonthAria: "Next month",
  calendarAria: "Calendar",
  dateInvalid: "Invalid date.",
  dateOutOfRange: "Date is outside the allowed range.",
  dateInvalidFormat: "Use dd/mm/yyyy or 6/8 digits.",
};

const UI_BY_LANG_PREFIX = {
  pt: {
    today: "Hoje",
    close: "Fechar",
    prevMonthAria: "Mês anterior",
    nextMonthAria: "Próximo mês",
    calendarAria: "Calendário",
    dateInvalid: "Data inválida.",
    dateOutOfRange: "Data fora do intervalo permitido.",
    dateInvalidFormat: "Use dd/mm/aaaa ou só números (6 ou 8 dígitos).",
  },
  es: {
    today: "Hoy",
    close: "Cerrar",
    prevMonthAria: "Mes anterior",
    nextMonthAria: "Mes siguiente",
    calendarAria: "Calendario",
    dateInvalid: "Fecha no válida.",
    dateOutOfRange: "Fecha fuera del rango permitido.",
    dateInvalidFormat: "Use dd/mm/aaaa o solo números (6 u 8 dígitos).",
  },
  en: { ...UI_FALLBACK_EN },
};

export function resolveLocaleDatePickerMessages(locale, override = {}) {
  const loc = (locale || "en-US").toString();
  const prefix = loc.split(/[-_]/)[0].toLowerCase();
  const fromLang = UI_BY_LANG_PREFIX[prefix] || {};
  return { ...UI_FALLBACK_EN, ...fromLang, ...override };
}

export { weekdayLabelsShort, formatCalendarNavMonth, formatMonthYearTitle } from "./finclaCalendarI18n.js";

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
 * @param {object} props
 * @param {'portal'|'expand'} [props.popoverMode='portal'] — `expand`: input + calendário no mesmo bloco (ex.: seletor de período).
 * @param {string} [props.locale='pt-BR']
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
  popoverMode = "portal",
}) {
  const messages = useMemo(
    () => resolveLocaleDatePickerMessages(locale, messagesOverride),
    [locale, messagesOverride],
  );

  const weekdays = useMemo(() => weekdayLabelsShort(locale), [locale]);

  const [open, setOpen] = useState(false);
  const [hoverDay, setHoverDay] = useState(null);
  const wrapRef = useRef(null);
  const popoverRef = useRef(null);
  const buttonRef = useRef(null);
  const inputRef = useRef(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, width: 280 });
  const [draft, setDraft] = useState(() => formatYmdToLocaleDisplay(value, locale));
  const [draftError, setDraftError] = useState(null);
  const dateErrId = useId();

  const minD = useMemo(() => parseYmd(min), [min]);
  const maxD = useMemo(() => parseYmd(max), [max]);

  const selected = parseYmd(value);
  const [cursor, setCursor] = useState(() =>
    selected
      ? new Date(selected.getFullYear(), selected.getMonth(), 1)
      : new Date(),
  );

  useEffect(() => {
    setDraft(formatYmdToLocaleDisplay(value, locale));
    setDraftError(null);
  }, [value, locale]);

  const formatParseError = useCallback((status) => {
    if (status === "invalid_date") return messages.dateInvalid;
    if (status === "out_of_range") return messages.dateOutOfRange;
    if (status === "invalid_format") return messages.dateInvalidFormat;
    return null;
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const d = parseYmd(value);
    if (d) setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
  }, [open, value]);

  const updatePopoverPosition = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = variant === "mobile" ? Math.min(r.width, 320) : 300;
    const left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12));
    let top = r.bottom + 6;
    const estHeight = 360;
    if (top + estHeight > window.innerHeight - 8) {
      top = Math.max(8, r.top - estHeight - 6);
    }
    setPopoverPos({ top, left, width: w });
  }, [variant]);

  useLayoutEffect(() => {
    if (!open || popoverMode !== "portal") return;
    updatePopoverPosition();
  }, [open, popoverMode, updatePopoverPosition]);

  useEffect(() => {
    if (!open || popoverMode !== "portal") return;
    const onScroll = () => updatePopoverPosition();
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, popoverMode, updatePopoverPosition]);

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

  useEffect(() => {
    if (!open || popoverMode !== "expand") return;
    const onEsc = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
      inputRef.current?.blur();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, popoverMode]);

  const displayFontSize = variant === "mobile" ? 15 : 14;
  const iconSize = variant === "mobile" ? 18 : 16;
  const pad = variant === "mobile" ? "12px 14px" : "10px 12px";
  const radius = variant === "mobile" ? 12 : 10;

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const monthTitle = useMemo(
    () => formatCalendarNavMonth(year, monthIndex, locale),
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

  const navBase = finclaCalNavButtonBase();

  const handleDraftChange = (e) => {
    const v = e.target.value;
    setDraft(v);
    const res = parseBrDateLooseResult(v, min, max);
    if (res.status === "ok") {
      onChange(res.ymd);
      setDraftError(null);
      return;
    }
    if (res.status === "empty" || res.status === "incomplete") {
      setDraftError(null);
      return;
    }
    const msg = formatParseError(res.status);
    if (msg) setDraftError(msg);
  };

  const handleDraftBlur = (e) => {
    const res = parseBrDateLooseResult(draft, min, max);
    if (res.status === "ok") {
      setDraft(formatYmdToLocaleDisplay(res.ymd, locale));
      setDraftError(null);
    } else {
      setDraft(formatYmdToLocaleDisplay(value, locale));
      if (res.status === "invalid_date" || res.status === "out_of_range" || res.status === "invalid_format") {
        setDraftError(formatParseError(res.status));
      } else {
        setDraftError(null);
      }
    }
    const next = e.relatedTarget;
    if (
      popoverMode === "expand" &&
      wrapRef.current &&
      (!next || !wrapRef.current.contains(next))
    ) {
      setOpen(false);
    }
  };

  /** Seleciona o texto inteiro após pintar (foco + calendário aberto). */
  const selectAllInInput = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.select();
      });
    });
  }, []);

  useEffect(() => {
    if (!open || popoverMode !== "expand") return;
    const el = inputRef.current;
    if (!el || document.activeElement !== el) return;
    selectAllInInput();
  }, [open, popoverMode, selectAllInInput]);

  const handleExpandInputFocus = () => {
    if (disabled) return;
    setOpen(true);
    selectAllInInput();
  };

  /** Enter confirma data válida e fecha o painel. */
  const handleExpandInputKeyDown = (e) => {
    if (popoverMode !== "expand") return;
    if (e.key !== "Enter") return;
    e.preventDefault();
    const raw = inputRef.current?.value ?? draft;
    const res = parseBrDateLooseResult(raw, min, max);
    if (res.status === "ok") {
      onChange(res.ymd);
      setDraft(formatYmdToLocaleDisplay(res.ymd, locale));
      setDraftError(null);
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (res.status === "empty" || res.status === "incomplete") {
      setDraftError(null);
      return;
    }
    const msg = formatParseError(res.status);
    if (msg) setDraftError(msg);
  };

  const calendarInner = (
    <>
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
            ...navBase,
            cursor: canPrev ? "pointer" : "not-allowed",
            opacity: canPrev ? 1 : 0.35,
          }}
          onMouseEnter={(e) => {
            if (canPrev) e.currentTarget.style.background = T.bg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none";
          }}
        >
          <ChevronLeft size={15} color={T.inkMid} />
        </button>
        <span style={{ ...G, ...finclaCalMonthTitleStyle }}>{monthTitle}</span>
        <button
          type="button"
          aria-label={messages.nextMonthAria}
          disabled={!canNext}
          onClick={() => canNext && shiftMonth(1)}
          style={{
            ...navBase,
            cursor: canNext ? "pointer" : "not-allowed",
            opacity: canNext ? 1 : 0.35,
          }}
          onMouseEnter={(e) => {
            if (canNext) e.currentTarget.style.background = T.bg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none";
          }}
        >
          <ChevronRight size={15} color={T.inkMid} />
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          marginBottom: 4,
        }}
      >
        {weekdays.map((wd, wi) => (
          <div key={`w-${wi}`} style={{ ...G, ...finclaCalendarWeekdayCellStyle }}>
            {wd}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "2px 0",
        }}
        onMouseLeave={() => setHoverDay(null)}
      >
        {cells.map((day, idx) => {
          if (day == null) return <div key={`e-${idx}`} />;
          const cellYmd = ymdFromParts(year, monthIndex + 1, day);
          const dis = isDisabledYmd(cellYmd);
          const sel = value === cellYmd;
          const isTodayCell = todayY === cellYmd;
          const hov = hoverDay === day && !dis;
          return (
            <div
              key={day}
              role="button"
              tabIndex={dis ? -1 : 0}
              onClick={() => !dis && pick(day)}
              onKeyDown={(e) => {
                if (dis) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  pick(day);
                }
              }}
              onMouseEnter={() => !dis && setHoverDay(day)}
              style={{
                textAlign: "center",
                cursor: dis ? "not-allowed" : "pointer",
                padding: "1px 0",
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
                  background: sel ? T.ink : hov ? T.bg : "transparent",
                  border: isTodayCell && !sel ? `1.5px solid ${T.ink}` : "none",
                  boxSizing: "border-box",
                  transition: "background 0.1s",
                  opacity: dis ? 0.35 : 1,
                }}
              >
                <span
                  style={{
                    ...G,
                    fontSize: 12,
                    fontWeight: sel || isTodayCell ? 700 : 500,
                    color: sel ? "#fff" : isTodayCell ? T.ink : T.inkMid,
                  }}
                >
                  {day}
                </span>
              </div>
            </div>
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
            borderRadius: 9,
            padding: "9px 10px",
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
            borderRadius: 9,
            padding: "9px 10px",
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
    </>
  );

  const portalPopover =
    open &&
    popoverMode === "portal" && (
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
          borderRadius: FINCLA_CALENDAR_SURFACE_RADIUS,
          boxShadow: FINCLA_CALENDAR_SHADOW,
          padding: "12px 14px 14px",
        }}
      >
        {calendarInner}
      </div>
    );

  if (popoverMode === "expand") {
    return (
      <div
        ref={wrapRef}
        style={{
          position: "relative",
          width: "100%",
          border: `1px solid ${draftError ? T.red : open ? T.inkMid : T.border}`,
          borderRadius: radius,
          background: T.surface,
          boxShadow: open ? T.sm : "none",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: variant === "mobile" ? 10 : 8,
            padding: pad,
          }}
        >
          <Calendar size={iconSize} color={T.inkMid} strokeWidth={2} style={{ flexShrink: 0 }} aria-hidden />
          <input
            ref={inputRef}
            id={id}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="dd/mm/aaaa"
            disabled={disabled}
            value={draft}
            onChange={handleDraftChange}
            onBlur={handleDraftBlur}
            onFocus={handleExpandInputFocus}
            onKeyDown={handleExpandInputKeyDown}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-invalid={draftError ? "true" : "false"}
            aria-describedby={draftError ? dateErrId : undefined}
            style={{
              ...G,
              ...NUM,
              flex: 1,
              minWidth: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: displayFontSize,
              fontWeight: 600,
              color: T.ink,
              letterSpacing: "-0.01em",
              lineHeight: 1.35,
            }}
          />
        </div>
        {draftError ? (
          <div
            id={dateErrId}
            role="alert"
            style={{
              ...G,
              padding: variant === "mobile" ? "0 14px 10px" : "0 12px 8px",
              fontSize: variant === "mobile" ? 12 : 11,
              fontWeight: 600,
              color: T.red,
              lineHeight: 1.4,
            }}
          >
            {draftError}
          </div>
        ) : null}
        <div
          ref={popoverRef}
          data-fincla-locale-calendar-popover=""
          role="region"
          aria-label={messages.calendarAria}
          onMouseDown={(e) => e.preventDefault()}
          style={{
            maxHeight: open ? 380 : 0,
            opacity: open ? 1 : 0,
            overflow: "hidden",
            transition: "max-height 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease",
            borderTop: open ? `1px solid ${T.border}` : "1px solid transparent",
            paddingLeft: 12,
            paddingRight: 12,
            paddingBottom: open ? 12 : 0,
            paddingTop: open ? 10 : 0,
            pointerEvents: open ? "auto" : "none",
          }}
        >
          {calendarInner}
        </div>
      </div>
    );
  }

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
      {typeof document !== "undefined" && portalPopover ? createPortal(portalPopover, document.body) : null}
    </div>
  );
}
