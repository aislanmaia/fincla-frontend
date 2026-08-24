import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
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
  /* O dia sob o cursor no calendário mexeria ESTE campo. Sem o realce, passar o
     mouse pelos dias não diz nada sobre o que vai mudar e a pessoa só descobre
     depois de clicar — o §14 chama isso de "a borda que ele mexeria acende no
     campo". Verde porque é a mesma cor da ponta pega no calendário: o mesmo
     significado nas duas pontas do gesto. */
  hovered = false,
  hoverValue = null,
}) {
  const [draft, setDraft] = useState(() => ymdToDraft(value, locale));
  /* Com o cursor sobre um dia, o campo mostra a data QUE FICARIA — não a atual.
     É a diferença entre "esta ponta vai mudar" e "esta ponta vai virar 12/08". */
  const previa = hovered && hoverValue ? ymdToDraft(hoverValue, locale) : null;
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
      /* A prévia é SÓ leitura: sem isto o input do DOM passava a conter a data
         apontada, e o `handleChange` lia esse mesmo valor — digitar uma tecla
         com o mouse parado sobre um dia comitava uma data que ninguém clicou. */
      value={previa ?? draft}
      readOnly={Boolean(previa)}
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
        background: inline && hovered
          ? "#ECFDF5"
          : inline && active
            ? `${T.ink}0A`
            : "transparent",
        boxShadow: inline && hovered ? "inset 0 0 0 1.5px #0F8A5F" : undefined,
        borderRadius: inline ? 6 : undefined,
        padding: inline ? "4px 4px" : undefined,
        fontSize: inline ? 12.5 : 13,
        fontWeight: 600,
        color: T.ink,
        letterSpacing: "0.04em",
        transition: "background .1s, box-shadow .1s",
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
            color: hovered ? "#0F8A5F" : active ? T.ink : T.inkLight,
            fontWeight: hovered ? 700 : 600,
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
  /* Toque: células de 44 px, sem hover e sem arrasto.
     `undefined` (o padrão) = detectar. NÃO derive isto de `compact`: compacto
     quer dizer ESTREITO, e o dock do desktop é estreito abaixo de 1600 px — ali
     as células viravam 44 px para um cursor que acerta 26. Quem decide é o tipo
     de ponteiro, não a largura. */
  touch: touchProp,
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
  /* A ponta "pega": arrastada no mouse, tocada no toque. Ela ganha anel verde
     porque, sem hover, seria a única mudança de estado invisível da tela. */
  const [grabbedEdge, setGrabbedEdge] = useState(null);
  const dragRef = useRef(null);
  /* O estado do React não chega a tempo: no toque, o `click` dispara no mesmo
     gesto do `pointerdown`, e lia `grabbedEdge` ainda nulo — o toque na ponta
     recomeçava o intervalo em vez de pegá-la. A ref é escrita de forma síncrona
     no pointerdown e é ela que o click consulta. */
  const grabRef = useRef(null);
  /* No toque, o `click` do MESMO gesto que pegou a ponta consumia a pega na
     hora, movendo-a para onde ela já estava — um toque que não fazia nada.
     A guarda é pelo DIA pego, e não por "ignore o próximo clique": medindo o
     gesto real, o primeiro toque às vezes nem gera `click` (a re-renderização
     troca o alvo no meio), e a flag ficava presa engolindo o toque seguinte.
     Comparar o dia não tem esse estado pendurado: clique no mesmo dia não move,
     clique em outro dia move. */
  const pegarPonta = useCallback((edge, ymdPego = null) => {
    grabRef.current = { edge, ymdPego };
    setGrabbedEdge(edge);
  }, []);
  const soltarPonta = useCallback(() => {
    grabRef.current = null;
    setGrabbedEdge(null);
  }, []);

  /* O intervalo desenhado pelo arrasto, ainda não gravado no filtro. */
  const [arrasto, setArrasto] = useState(null);

  const [coarsePointer, setCoarsePointer] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(hover: none)");
    const sync = () => setCoarsePointer(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);
  const touch = touchProp ?? coarsePointer;

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

  /* Duplo clique num dia: o período vira aquele dia só.
     Sem isto, "só hoje" custa dois cliques no MESMO dia — o gesto que ninguém
     tenta, porque o primeiro clique já parece ter feito alguma coisa. */
  const handleDayDoubleClick = useCallback(
    (ymd) => {
      markCustom();
      setCustomFrom(ymd);
      setCustomTo(ymd);
      setActiveEdge("from");
    },
    [markCustom, setCustomFrom, setCustomTo],
  );

  const handleDayClick = useCallback(
    (ymd) => {
      /* Ponta pega no toque: este clique move ELA, não recomeça o intervalo.
         É o caminho de dois toques que substitui o arrasto no mobile.

         O `markCustom()` vem DEPOIS destas guardas de propósito: ele troca o
         período para "custom", e com um preset ativo os campos custom estão
         vazios — chamá-lo antes apagava o intervalo inteiro no primeiro toque,
         justamente o que a pessoa estava tentando ajustar. */
      const pega = grabRef.current;
      if (pega && pega.ymdPego === ymd) {
        /* O PRIMEIRO toque no dia pego não move nada — é o click do próprio
           gesto que pegou. Do segundo em diante, SOLTA: sem isto um toque
           perdido numa ponta (fácil numa célula de 44 px dentro de um sheet que
           rola) prendia o seletor em modo mover-ponta para sempre, e todo toque
           seguinte movia essa ponta em vez de começar um intervalo novo. */
        if (pega.confirmado) soltarPonta();
        else grabRef.current = { ...pega, confirmado: true };
        return;
      }
      if (pega && (!displayFrom || !displayTo)) {
        // Pega órfã: sem as duas pontas não há o que mover. Soltar evita que ela
        // fique presa e sequestre os toques seguintes.
        soltarPonta();
      }
      markCustom();
      if (pega && displayFrom && displayTo) {
        const outro = pega.edge === "from" ? displayTo : displayFrom;
        const alvo = parseLocalYmd(ymd);
        const ref = parseLocalYmd(outro);
        soltarPonta();
        if (alvo && ref) {
          if (alvo.getTime() <= ref.getTime()) {
            setCustomFrom(ymd);
            setCustomTo(outro);
          } else {
            setCustomFrom(outro);
            setCustomTo(ymd);
          }
          return;
        }
      }
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
    [displayFrom, displayTo, soltarPonta, markCustom, setCustomFrom, setCustomTo],
  );

  /* Arrastar uma ponta. Só no mouse: no toque isto disputaria o gesto com a
     rolagem do sheet — o mesmo conflito que já quebrou a rolagem da lista uma
     vez. Lá o caminho é tocar a ponta (que fica "pega") e tocar o dia novo, com
     o mesmo resultado e sem sequestrar a rolagem.

     Ao arrastar uma ponta ALÉM da outra, as duas trocam de papel no meio do
     gesto: é o que a pessoa espera ao ver o intervalo acompanhar o cursor, em
     vez de o intervalo colapsar em zero e travar. */
  const handleDayPointerDown = useCallback(
    (ymd, e) => {
      if (touch) {
        /* Toque: a ponta fica pega no primeiro toque, o segundo define o par.
           Se o intervalo vem de um PRESET, semeamos os campos custom com os
           limites dele antes de pegar: sem isso, o `markCustom` do toque
           seguinte encontraria os campos vazios e o intervalo sumiria. */
        const ehPonta = ymd === displayFrom || ymd === displayTo;
        if (!ehPonta || !displayFrom || !displayTo) return;
        if (period !== "custom") {
          markCustom();
          setCustomFrom(displayFrom);
          setCustomTo(displayTo);
        }
        pegarPonta(ymd === displayFrom ? "from" : "to", ymd);
        return;
      }
      const isEdge = ymd === displayFrom || ymd === displayTo;
      if (!isEdge || !displayFrom || !displayTo) return;
      if (period !== "custom") {
        markCustom();
        setCustomFrom(displayFrom);
        setCustomTo(displayTo);
      }
      const edge = ymd === displayFrom ? "from" : "to";
      pegarPonta(edge);
      dragRef.current = { edge, moved: false, other: edge === "from" ? displayTo : displayFrom };
      if (e && e.currentTarget && e.pointerId != null) {
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      }
    },
    [touch, period, displayFrom, displayTo, pegarPonta, markCustom, setCustomFrom, setCustomTo],
  );

  /* O arrasto vive no hover: o dia sob o cursor vira a nova posição da ponta
     pega. Fica aqui, e não num listener de `pointermove` na grade, porque a
     grade já reporta o dia — um segundo caminho de coordenadas para px
     divergiria dela nas bordas da célula. */
  const handleDayHoverDrag = useCallback(
    (ymd) => {
      setHoverYmd(ymd);
      const drag = dragRef.current;
      if (!drag || !ymd) return;
      drag.moved = true;
      const alvo = parseLocalYmd(ymd);
      const outro = parseLocalYmd(drag.other);
      if (!alvo || !outro) return;
      /* O intervalo do arrasto fica LOCAL até soltar. `setCustomFrom/To`
         alimentam o filtro, e a busca da lista não tem debounce: arrastar uma
         ponta por um mês inteiro eram ~30 idas ao backend (lista + summary) e a
         lista re-renderizando sob o cursor, para um gesto com um só estado
         final. */
      if (alvo.getTime() <= outro.getTime()) {
        setArrasto({ from: ymd, to: drag.other });
        pegarPonta("from");
      } else {
        setArrasto({ from: drag.other, to: ymd });
        pegarPonta("to");
      }
    },
    [pegarPonta],
  );

  useEffect(() => {
    if (touch) return undefined;
    const solta = () => {
      const arrastando = Boolean(dragRef.current);
      dragRef.current = null;
      soltarPonta();
      if (!arrastando) return;
      // Grava UMA vez, no fim do gesto.
      setArrasto((faixa) => {
        if (faixa) {
          markCustom();
          setCustomFrom(faixa.from);
          setCustomTo(faixa.to);
        }
        return null;
      });
    };
    window.addEventListener("pointerup", solta);
    window.addEventListener("pointercancel", solta);
    return () => {
      window.removeEventListener("pointerup", solta);
      window.removeEventListener("pointercancel", solta);
    };
  }, [touch, soltarPonta, markCustom, setCustomFrom, setCustomTo]);

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

  /* Qual ponta o dia sob o cursor mexeria — é ela que acende no campo.
     Sem isto o hover no calendário não diz NADA sobre o que vai mudar, e a
     pessoa descobre só depois de clicar. Com o intervalo fechado, a ponta é a
     mais próxima; com ele aberto, é sempre o fim. */
  const pontaSobHover = useMemo(() => {
    if (touch || !hoverYmd) return null;
    if (grabbedEdge) return grabbedEdge;
    /* Espelha `handleDayClick` LINHA A LINHA, e não a ponta mais próxima.
       Com o intervalo fechado, um clique RECOMEÇA em "de" — mas a heurística de
       proximidade acendia "até" e prometia uma coisa enquanto o clique fazia
       outra. Um realce que mente é pior que realce nenhum. */
    if (!displayFrom || (displayFrom && displayTo)) return "from";
    const h = parseLocalYmd(hoverYmd);
    const f = parseLocalYmd(displayFrom);
    if (!h || !f) return null;
    return h.getTime() < f.getTime() ? "from" : "to";
  }, [touch, hoverYmd, grabbedEdge, displayFrom, displayTo]);

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

  const hintText = grabbedEdge
    ? grabbedEdge === "from"
      ? "Toque o novo início."
      : "Toque o novo fim."
    : calendarOpen
    ? displayFrom && !displayTo
      ? "1 clique no calendário define o fim — ou deixe em aberto."
      : !displayFrom && !displayTo
        ? "2 cliques no calendário ou digite as datas."
        : "Mesmo dia nos 2 cliques = 1 dia."
    : "Digite dd/mm/aaaa ou toque no campo para abrir o calendário.";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 12 }}>
      {/* UMA CAIXA, em toda largura.
          A régua de três colunas (De | Até | Intervalo) morava aqui para telas
          largas e era o problema que o §14 existe para resolver: ela só cabia
          com 698 px de pane — ou seja, viewport ≥ 1600 —, e abaixo disso era
          amputada em silêncio, levando junto o resumo e a contagem de dias.
          Duas caixas com borda para um intervalo também dizem "dois campos"
          quando a coisa é UMA: o intervalo cabe numa linha só. */}
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
              hovered={pontaSobHover === "from"}
              hoverValue={pontaSobHover === "from" ? hoverYmd : null}
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
              hovered={pontaSobHover === "to"}
              hoverValue={pontaSobHover === "to" ? hoverYmd : null}
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

      {calendarOpen && (
        <RangeCalendarGrid
          cursorYear={cursorYear}
          cursorMonth={cursorMonth}
          monthCount={compact ? 1 : 2}
          fromYmd={arrasto ? arrasto.from : displayFrom}
          toYmd={arrasto ? arrasto.to : displayTo}
          /* No toque não há hover, então não há prévia: passar `hoverYmd` ali
             pintaria um caminho que ninguém está apontando. */
          hoverYmd={touch || arrasto ? null : hoverYmd}
          minYmd={TRANSACTIONS_DATE_MIN}
          maxYmd={TRANSACTIONS_DATE_MAX}
          locale={locale}
          onDayClick={handleDayClick}
          onDayDoubleClick={handleDayDoubleClick}
          onDayHover={handleDayHoverDrag}
          onDayPointerDown={handleDayPointerDown}
          onPrevMonth={() => shiftMonth(-1)}
          onNextMonth={() => shiftMonth(1)}
          touch={touch}
          grabbedEdge={grabbedEdge}
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
