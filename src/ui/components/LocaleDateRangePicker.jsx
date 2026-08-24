import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import { T } from "../tokens";
import { G, NUM } from "../typography";
import { formatYmdToLocaleDisplay, todayLocalYmd } from "../data/transactionsAdapter.js";
import { APP_UI_LOCALE } from "../appLocale.js";
import {
  BR_DATE_INPUT_MASK_PLACEHOLDER,
  maskBrDateInput,
  parseBrDateLooseOnCommit,
  parseBrDateLooseResult,
} from "./localeDateInputParse.js";
import { resolveLocaleDatePickerMessages } from "./LocaleDatePicker.jsx";
import { RangeCalendarGrid } from "./RangeCalendarGrid.jsx";
import { formatCustomPeriodLabel } from "../features/transactions/filters/customPeriodLabel.js";
import {
  normalizeOpenRange,
  parseLocalYmd,
  resolvePeriodDisplayBounds,
  TRANSACTIONS_DATE_MAX,
  TRANSACTIONS_DATE_MIN,
} from "../features/transactions/periodDateBounds.js";

function ymdToDraft(ymd, locale) {
  if (!ymd) return "";
  const formatted = formatYmdToLocaleDisplay(ymd, locale);
  return formatted === "—" ? "" : formatted;
}

function countRangeDays(fromYmd, toYmd) {
  if (!fromYmd || !toYmd) return null;
  const a = parseLocalYmd(fromYmd);
  const b = parseLocalYmd(toYmd);
  if (!a || !b) return null;
  const days = Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1;
  return Number.isFinite(days) && days > 0 ? days : null;
}

function RangeDateInput({
  id,
  label,
  value,
  onChange,
  onClear,
  active,
  onFocus,
  onCalendarClick,
  calendarOpen = false,
  locale,
  min,
  max,
  messages,
  /* Modo de UMA LINHA: o campo perde o rótulo em bloco, a borda e o ícone
     próprios — quem os carrega é a caixa que abriga as duas bordas. É o que
     faz o intervalo caber em 234 px, onde a régua de três colunas não cabia e
     era amputada em silêncio. */
  inline = false,
  onErrorChange,
}) {
  const [draft, setDraft] = useState(() => ymdToDraft(value, locale));
  const [error, setError] = useState(null);
  const errId = useId();

  useEffect(() => {
    setDraft(ymdToDraft(value, locale));
    setError(null);
  }, [value, locale]);

  // No modo inline a mensagem não cabe sob o campo: ela é do INTERVALO, e
  // aparece na linha que já mostra o resumo e a contagem de dias.
  useEffect(() => {
    if (typeof onErrorChange === "function") onErrorChange(error);
  }, [error, onErrorChange]);

  const formatError = (status) => {
    if (status === "invalid_date") return messages.dateInvalid;
    if (status === "out_of_range") return messages.dateOutOfRange;
    if (status === "invalid_format") return messages.dateInvalidFormat;
    return null;
  };

  const commitDraft = (raw, { blur = false } = {}) => {
    const parse = blur ? parseBrDateLooseOnCommit : parseBrDateLooseResult;
    const res = parse(raw, min, max);
    if (res.status === "ok") {
      onChange(res.ymd);
      setDraft(ymdToDraft(res.ymd, locale));
      setError(null);
      return;
    }
    if (res.status === "empty") {
      onClear();
      setDraft("");
      setError(null);
      return;
    }
    if (blur) {
      setDraft(ymdToDraft(value, locale));
      if (res.status === "incomplete") {
        setError(null);
        return;
      }
      const msg = formatError(res.status);
      setError(msg);
    }
  };

  const handleChange = (raw) => {
    const masked = maskBrDateInput(raw);
    setDraft(masked);
    const res = parseBrDateLooseResult(masked, min, max);
    if (res.status === "ok") {
      onChange(res.ymd);
      setError(null);
    } else if (res.status === "empty" || res.status === "incomplete") {
      setError(null);
    } else {
      setError(formatError(res.status));
    }
  };

  const campo = (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={BR_DATE_INPUT_MASK_PLACEHOLDER}
      aria-label={label}
      aria-invalid={error ? "true" : "false"}
      aria-describedby={error && !inline ? errId : undefined}
      value={draft}
      onFocus={onFocus}
      onClick={onFocus}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={(e) => commitDraft(e.target.value, { blur: true })}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        commitDraft(e.target.value, { blur: true });
      }}
      style={{
        ...G,
        ...NUM,
        flex: inline ? "none" : 1,
        width: inline ? 90 : undefined,
        minWidth: 0,
        border: "none",
        outline: "none",
        background: inline && active ? `${T.ink}0A` : "transparent",
        borderRadius: inline ? 6 : undefined,
        padding: inline ? "4px 4px" : undefined,
        fontSize: inline ? 12.5 : 13,
        fontWeight: 600,
        color: T.ink,
        letterSpacing: "0.04em",
      }}
    />
  );

  if (inline) {
    return (
      <>
        <span
          style={{
            ...G,
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 600,
            color: active ? T.ink : T.inkLight,
          }}
        >
          {label.toLowerCase()}
        </span>
        {campo}
      </>
    );
  }

  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          ...G,
          fontSize: 11,
          fontWeight: 700,
          color: active ? T.ink : T.inkMid,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 11px",
          borderRadius: 9,
          border: `1px solid ${error ? T.red : active ? T.ink : T.border}`,
          background: active ? `${T.ink}06` : T.surface,
          boxShadow: active ? T.sm : "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      >
        <button
          type="button"
          onClick={onCalendarClick}
          aria-label={`${calendarOpen ? "Ocultar" : "Abrir"} calendário — ${label}`}
          aria-expanded={calendarOpen}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Calendar size={14} color={active ? T.ink : T.inkMid} aria-hidden />
        </button>
        {campo}
      </div>
      {error ? (
        <div id={errId} role="alert" style={{ ...G, fontSize: 11, color: T.red, marginTop: 4 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Seletor híbrido de intervalo: inputs pt-BR + calendário de range (2 cliques).
 * Suporta intervalo aberto (só De ou só Até).
 */
export function LocaleDateRangePicker({
  period = "custom",
  customFrom = "",
  customTo = "",
  setCustomFrom,
  setCustomTo,
  onCustomPeriod = () => {},
  onClearRange,
  compact = false,
  locale = APP_UI_LOCALE,
}) {
  const messages = useMemo(() => resolveLocaleDatePickerMessages(locale), [locale]);
  const [activeEdge, setActiveEdge] = useState("from");
  // No modo de uma linha a mensagem é do INTERVALO, não de um campo: as duas
  // bordas reportam para cá e a linha de baixo mostra uma de cada vez.
  const [errFrom, setErrFrom] = useState(null);
  const [errTo, setErrTo] = useState(null);
  const rangeError = errFrom || errTo;
  /* O calendário nasce ABERTO. Ele é o controle principal deste filtro —
     escolher "aquela semana" são dois cliques, contra doze dígitos digitados —
     e nascer fechado obrigava a descobrir que tocar no campo o revela, sem
     nenhuma pista de que ele existe. No celular pesa ainda mais: teclado
     numérico cobrindo meia tela contra um campo de 90 px. */
  const [calendarOpen, setCalendarOpen] = useState(true);
  const [hoverYmd, setHoverYmd] = useState(null);

  const { from: displayFrom, to: displayTo } = useMemo(
    () => resolvePeriodDisplayBounds(period, customFrom, customTo),
    [period, customFrom, customTo],
  );

  const anchorYmd = displayFrom || displayTo || todayLocalYmd();
  const anchor = parseLocalYmd(anchorYmd) || new Date();
  const [cursorYear, setCursorYear] = useState(() => anchor.getFullYear());
  const [cursorMonth, setCursorMonth] = useState(() => anchor.getMonth());

  useEffect(() => {
    const src = displayFrom || displayTo;
    const dt = src ? parseLocalYmd(src) : null;
    if (dt) {
      setCursorYear(dt.getFullYear());
      setCursorMonth(dt.getMonth());
    }
  }, [displayFrom, displayTo]);

  const markCustom = useCallback(() => {
    onCustomPeriod();
  }, [onCustomPeriod]);

  const applyFrom = useCallback(
    (ymd) => {
      const fromPreset = period !== "custom";
      if (fromPreset) markCustom();
      const next = normalizeOpenRange(ymd, fromPreset ? "" : customTo);
      setCustomFrom(next.from);
      setCustomTo(next.to);
    },
    [period, customTo, markCustom, setCustomFrom, setCustomTo],
  );

  const applyTo = useCallback(
    (ymd) => {
      const fromPreset = period !== "custom";
      if (fromPreset) markCustom();
      const next = normalizeOpenRange(fromPreset ? "" : customFrom, ymd);
      setCustomFrom(next.from);
      setCustomTo(next.to);
    },
    [period, customFrom, markCustom, setCustomFrom, setCustomTo],
  );

  const handleDayClick = useCallback(
    (ymd) => {
      markCustom();
      if (!displayFrom || (displayFrom && displayTo)) {
        setCustomFrom(ymd);
        setCustomTo("");
        setActiveEdge("to");
        return;
      }
      const clicked = parseLocalYmd(ymd);
      const from = parseLocalYmd(displayFrom);
      if (!clicked || !from) {
        setCustomFrom(ymd);
        setCustomTo("");
        return;
      }
      if (clicked.getTime() < from.getTime()) {
        setCustomFrom(ymd);
        setCustomTo(displayFrom);
      } else {
        setCustomTo(ymd);
      }
      setActiveEdge("from");
    },
    [displayFrom, displayTo, markCustom, setCustomFrom, setCustomTo],
  );

  const openCalendar = (edge) => {
    setActiveEdge(edge);
    setCalendarOpen(true);
  };

  const toggleCalendar = (edge) => {
    if (calendarOpen && activeEdge === edge) {
      setCalendarOpen(false);
      return;
    }
    setActiveEdge(edge);
    setCalendarOpen(true);
  };

  const summaryLabel =
    period === "tudo" && !displayFrom && !displayTo
      ? "Todo período"
      : formatCustomPeriodLabel(displayFrom, displayTo, locale);
  const dayCount = countRangeDays(displayFrom, displayTo);

  const shiftMonth = (delta) => {
    const dt = new Date(cursorYear, cursorMonth + delta, 1);
    setCursorYear(dt.getFullYear());
    setCursorMonth(dt.getMonth());
  };

  const clearRange = () => {
    if (typeof onClearRange === "function") {
      onClearRange();
    } else {
      markCustom();
      setCustomFrom("");
      setCustomTo("");
    }
    setActiveEdge("from");
    setCalendarOpen(false);
  };

  const hintText = calendarOpen
    ? displayFrom && !displayTo
      ? "1 clique no calendário define o fim — ou deixe em aberto."
      : !displayFrom && !displayTo
        ? "2 cliques no calendário ou digite as datas."
        : "Mesmo dia nos 2 cliques = 1 dia."
    : "Digite dd/mm/aaaa ou toque no campo para abrir o calendário.";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 12 }}>
      {compact ? (
        /* UMA LINHA. O intervalo é um objeto só, então ocupa uma caixa só —
           e é o que faz o resumo e a contagem de dias existirem abaixo de
           1600 px de viewport, onde a régua de três colunas não cabia e era
           silenciosamente amputada junto com o segundo mês. */
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: "0 7px",
              height: 44,
              borderRadius: 10,
              border: `1px solid ${rangeError ? T.red : T.border}`,
              background: T.surface,
              minWidth: 0,
            }}
          >
            {/* Sem ícone de calendário aqui: focar qualquer uma das bordas já
                abre o calendário, e o botão custava 17 px que a caixa de
                234 px não tem — era ele que fazia o ano ser cortado. */}
            <RangeDateInput
              id="period-range-from"
              label="De"
              inline
              value={displayFrom}
              active={activeEdge === "from"}
              onFocus={() => openCalendar("from")}
              onCalendarClick={() => toggleCalendar("from")}
              calendarOpen={calendarOpen && activeEdge === "from"}
              onChange={applyFrom}
              onClear={() => { markCustom(); setCustomFrom(""); }}
              onErrorChange={setErrFrom}
              locale={locale}
              min={TRANSACTIONS_DATE_MIN}
              max={TRANSACTIONS_DATE_MAX}
              messages={messages}
            />
            <RangeDateInput
              id="period-range-to"
              label="Até"
              inline
              value={displayTo}
              active={activeEdge === "to"}
              onFocus={() => openCalendar("to")}
              onCalendarClick={() => toggleCalendar("to")}
              calendarOpen={calendarOpen && activeEdge === "to"}
              onChange={applyTo}
              onClear={() => { markCustom(); setCustomTo(""); }}
              onErrorChange={setErrTo}
              locale={locale}
              min={TRANSACTIONS_DATE_MIN}
              max={TRANSACTIONS_DATE_MAX}
              messages={messages}
            />
          </div>
          {/* O resumo e a contagem de dias — o que o compacto perdia por
              inteiro. Some enquanto há erro, para não descrever um intervalo
              que o campo já não mostra. */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
            {rangeError ? (
              <span role="alert" style={{ ...G, fontSize: 11, fontWeight: 600, color: T.red }}>
                {rangeError}
              </span>
            ) : (
              <>
                <span
                  style={{
                    ...G, ...NUM, flexShrink: 0, fontSize: 10.5,
                    color: dayCount != null ? T.blue : T.amber,
                    background: dayCount != null ? T.blueLight : T.amberLight,
                    borderRadius: 99, padding: "2px 8px",
                  }}
                >
                  {dayCount != null
                    ? `${dayCount} dia${dayCount === 1 ? "" : "s"}`
                    : displayFrom || displayTo
                      ? "aberto"
                      : "sem limites"}
                </span>
                <span
                  style={{
                    ...G, fontSize: 11, color: T.inkLight, minWidth: 0,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                >
                  {summaryLabel}
                </span>
              </>
            )}
          </div>
        </>
      ) : (
      /* Régua de três colunas: só onde ela cabe de verdade. */
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr minmax(120px, 0.8fr)",
          gap: 14,
          alignItems: "flex-start",
        }}
      >
        <RangeDateInput
          id="period-range-from"
          label="De"
          value={displayFrom}
          active={activeEdge === "from"}
          onFocus={() => openCalendar("from")}
          onCalendarClick={() => toggleCalendar("from")}
          calendarOpen={calendarOpen && activeEdge === "from"}
          onChange={applyFrom}
          onClear={() => { markCustom(); setCustomFrom(""); }}
          locale={locale}
          min={TRANSACTIONS_DATE_MIN}
          max={TRANSACTIONS_DATE_MAX}
          messages={messages}
        />
        <RangeDateInput
          id="period-range-to"
          label="Até"
          value={displayTo}
          active={activeEdge === "to"}
          onFocus={() => openCalendar("to")}
          onCalendarClick={() => toggleCalendar("to")}
          calendarOpen={calendarOpen && activeEdge === "to"}
          onChange={applyTo}
          onClear={() => { markCustom(); setCustomTo(""); }}
          locale={locale}
          min={TRANSACTIONS_DATE_MIN}
          max={TRANSACTIONS_DATE_MAX}
          messages={messages}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              ...G, fontSize: 11, fontWeight: 700, color: T.inkMid,
              textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
            }}
          >
            Intervalo
          </div>
          <div
            style={{
              ...G, padding: "9px 11px", borderRadius: 9, background: T.bg,
              border: `1px solid ${T.border}`, fontSize: 13, color: T.inkMid,
              lineHeight: 1.35, minHeight: 42, boxSizing: "border-box",
              display: "flex", flexDirection: "column", justifyContent: "center",
            }}
          >
            <span style={{ fontWeight: 700, color: T.ink }}>{summaryLabel}</span>
            {dayCount != null ? (
              <span style={{ fontSize: 11, marginTop: 2 }}>
                {dayCount} dia{dayCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      )}

      {calendarOpen && (
        <RangeCalendarGrid
          cursorYear={cursorYear}
          cursorMonth={cursorMonth}
          monthCount={compact ? 1 : 2}
          fromYmd={displayFrom}
          toYmd={displayTo}
          hoverYmd={hoverYmd}
          minYmd={TRANSACTIONS_DATE_MIN}
          maxYmd={TRANSACTIONS_DATE_MAX}
          locale={locale}
          onDayClick={handleDayClick}
          onDayHover={setHoverYmd}
          onPrevMonth={() => shiftMonth(-1)}
          onNextMonth={() => shiftMonth(1)}
        />
      )}

      {(displayFrom || displayTo) ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={clearRange}
            style={{
              ...G,
              padding: "7px 12px",
              borderRadius: 99,
              border: "none",
              background: T.redLight,
              fontSize: 12,
              fontWeight: 600,
              color: T.red,
              cursor: "pointer",
            }}
          >
            Limpar intervalo
          </button>
          {calendarOpen ? (
            <span style={{ ...G, fontSize: 11, color: T.inkLight, flex: 1, minWidth: 140 }}>
              {hintText}
            </span>
          ) : null}
        </div>
      ) : (
        <span style={{ ...G, fontSize: 11, color: T.inkLight }}>{hintText}</span>
      )}
    </div>
  );
}
