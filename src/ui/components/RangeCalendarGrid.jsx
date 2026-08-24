import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { T } from "../tokens";
import { G } from "../typography";
import { weekdayLabelsShort, formatCalendarNavMonth } from "./finclaCalendarI18n.js";
import {
  finclaCalendarWeekdayCellStyle,
  finclaCalNavButtonBase,
  finclaCalMonthTitleStyle,
} from "./finclaCalendarStyles.js";
import { todayLocalYmd } from "../data/transactionsAdapter.js";
import { parseLocalYmd, ymdFromDate } from "../features/transactions/periodDateBounds.js";

/* Os tons do §14: o intervalo fechado é mais forte que a prévia porque um é
   fato e o outro é proposta. `T.blueLight` é a mesma cor do desenho; a prévia é
   o único valor sem token, e fica declarada aqui com o porquê em vez de virar
   um token novo para um uso só. */
const RANGE_MID = T.blueLight;
const RANGE_PREVIEW = "#F1F5FF";
/* Verde da ponta PEGA. Não é o `T.green` (#059669) de propósito: aquele é o
   verde de receita e apareceria como "isto é dinheiro entrando" num anel que só
   quer dizer "esta ponta está na sua mão". */
const GRAB_RING = "#0F8A5F";

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
  onDayDoubleClick,
  onDayHover,
  onDayPointerDown,
  /* Célula de 44 px no toque, 26 no mouse — os números do §14. Trinta e poucos
     servem para o cursor e não para o dedo: com 314 px de largura, 44 dá uma
     célula quadrada o bastante para acertar sem ampliar. */
  touch = false,
  /* Qual ponta está "pega" (arrastada no mouse, ou tocada no mobile). Ela ganha
     anel verde: sem hover, seria a única mudança de estado invisível da tela. */
  grabbedEdge = null,
  /* Com UM mês, quem nomeia o mês é a barra de navegação — o título aqui
     dentro repetia a mesma palavra duas vezes, uma sob a outra. Com dois, a
     barra fica só com as setas e cada grade precisa dizer qual mês é. */
  showTitle = true,
}) {
  const weekdays = useMemo(() => weekdayLabelsShort(locale), [locale]);
  const cellH = touch ? 44 : 30;
  const dayFont = touch ? 12.5 : 12;
  const firstDow = new Date(year, monthIndex, 1).getDay();
  const nDays = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let d = 1; d <= nDays; d += 1) cells.push(d);

  const todayY = todayLocalYmd();

  return (
    <div style={{ minWidth: 0 }}>
      {showTitle ? (
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
      ) : null}
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
          // Prévia: com só uma ponta posta, o caminho até o cursor é sombreado
          // mais claro que o intervalo fechado — um é proposta, o outro é fato.
          const hovPreview = inRange && !toYmd;
          const grabbed =
            (grabbedEdge === "from" && isFrom) || (grabbedEdge === "to" && isTo);
          const edgeCommitted =
            (Boolean(fromYmd) && ymd === fromYmd) || (Boolean(toYmd) && ymd === toYmd);

          return (
            <div
              key={ymd}
              role="button"
              tabIndex={disabled ? -1 : 0}
              /* O `aria-label` substitui o conteúdo no cálculo do nome, então o
                 rótulo "de"/"até"/"só" e o anel verde seriam puramente visuais.
                 Aqui o nome carrega o papel do dia, e `aria-pressed` diz se ele
                 está dentro do intervalo — que é a informação que a faixa azul
                 dá a quem enxerga. */
              aria-label={
                grabbed
                  ? `${ymd} — ponta selecionada, toque outro dia para movê-la`
                  : isFrom && isTo && edgeCommitted
                    ? `${ymd} — dia único`
                    : edgeCommitted && isFrom
                      ? `${ymd} — início`
                      : edgeCommitted && isTo
                        ? `${ymd} — fim`
                        : ymd
              }
              aria-pressed={inRange || edgeCommitted}
              aria-disabled={disabled}
              onClick={() => !disabled && onDayClick(ymd)}
              onDoubleClick={() => {
                // Duplo clique = aquele dia sozinho. Sem isto, "só hoje" custa
                // dois cliques no MESMO dia, que é o gesto que ninguém tenta.
                if (!disabled && typeof onDayDoubleClick === "function") onDayDoubleClick(ymd);
              }}
              onPointerDown={(e) => {
                if (disabled || typeof onDayPointerDown !== "function") return;
                onDayPointerDown(ymd, e);
              }}
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
                /* O miolo do intervalo pinta a CÉLULA inteira, sem raio: é o que
                   faz a faixa parecer contínua entre as pontas. Antes o fundo
                   ficava numa bolinha de 28 px e a faixa aparecia furada. */
                background: inRange ? RANGE_MID : hovPreview ? RANGE_PREVIEW : "transparent",
                borderRadius: 0,
                opacity: disabled ? 0.35 : 1,
                userSelect: "none",
                touchAction: touch ? "manipulation" : undefined,
              }}
            >
              <div
                style={{
                  height: cellH,
                  borderRadius: 6,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1.05,
                  background: edge ? T.ink : "transparent",
                  boxShadow: grabbed
                    ? `inset 0 0 0 1.5px ${GRAB_RING}`
                    : hov && !edge
                      ? `inset 0 0 0 1.5px ${T.blue}`
                      : "none",
                  border: isToday && !edge ? `1.5px solid ${T.ink}` : "none",
                  boxSizing: "border-box",
                  transition: "background 0.1s, box-shadow 0.1s",
                }}
              >
                <span
                  style={{
                    ...G,
                    fontFamily: "'Geist Mono', ui-monospace, monospace",
                    fontSize: dayFont,
                    fontWeight: edge || isToday ? 700 : 500,
                    color: edge ? "#fff" : isToday ? T.ink : T.inkMid,
                  }}
                >
                  {day}
                </span>
                {/* O rótulo na célula é o marcador PERMANENTE. No toque não há
                    hover nem balão, então ele é o único que diz qual ponta é
                    qual — e no mouse ele evita ter que inferir pela ordem. */}
                {/* Só em ponta de verdade. `isTo` cai no `hoverYmd` quando o
                    intervalo está aberto, então cada dia por onde o cursor
                    passava ganhava um "até" com cara de definitivo — e o
                    próprio dia inicial virava "só" sem nada ter sido escolhido. */}
                {edgeCommitted && (
                  <em
                    style={{
                      ...G,
                      fontStyle: "normal",
                      fontSize: touch ? 8.5 : 7.5,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      color: "#fff",
                      opacity: 0.85,
                    }}
                  >
                    {isFrom && isTo ? "só" : isFrom ? "de" : "até"}
                  </em>
                )}
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
  onDayDoubleClick,
  onDayHover,
  onDayPointerDown,
  onPrevMonth,
  onNextMonth,
  touch = false,
  grabbedEdge = null,
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
      onMouseLeave={touch ? undefined : () => onDayHover(null)}
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
            onDayDoubleClick={onDayDoubleClick}
            onDayHover={onDayHover}
            onDayPointerDown={onDayPointerDown}
            touch={touch}
            grabbedEdge={grabbedEdge}
            showTitle={monthCount > 1}
          />
        ))}
      </div>
    </div>
  );
}

function compactPadding(monthCount) {
  return monthCount > 1 ? "12px 14px 14px" : "12px 12px 14px";
}
