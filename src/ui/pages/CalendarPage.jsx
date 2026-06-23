import React, { useEffect, useMemo, useState } from "react";
import { T } from "../tokens";
import { G, NUM } from "../typography";
import { PageTitle, Card, PageEnter } from "../components/primitives";
import { useCalendarData } from "../features/calendar/useCalendarData.js";
import { monthMatrix, monthLabel, monthSummary, dayLongLabel, todayParts, WEEKDAYS } from "../features/calendar/calendarModel.js";
import { shouldUseRealData } from "../dataMode.js";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (v) => brl.format(Number(v || 0));
const fmtShort = (v) => {
  const n = Math.round(Math.abs(Number(v || 0)));
  const s = n.toLocaleString("pt-BR");
  return `${v < 0 ? "−" : "+"}${s}`;
};
const ghost = { ...G, fontSize: 11, color: T.inkGhost };

function useIsWide(bp = 900) {
  const [wide, setWide] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= bp : true));
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= bp);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [bp]);
  return wide;
}

const KIND = {
  income: { color: T.green, bg: T.greenLight, dot: T.green },
  refund: { color: T.green, bg: T.greenLight, dot: T.green },
  expense: { color: T.red, bg: T.redLight, dot: T.red },
  invoice: { color: T.amber, bg: T.amberLight, dot: T.amber },
};
function evColors(e) {
  const base = KIND[e.kind] || KIND.expense;
  if (e.kind === "expense" && !e.paid) return { color: T.inkLight, bg: "transparent", border: `1px dashed ${T.border}`, dot: T.inkGhost };
  return { color: base.color, bg: base.bg, border: "none", dot: base.dot };
}
function evTag(e) {
  if (e.kind === "invoice") return "vence";
  if (e.paid) return "pago";
  return "agendado";
}

function mockByDay() {
  const { year, month } = todayParts();
  const d = (day) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return {
    [d(5)]: [{ kind: "income", desc: "Salário", value: 5000, paid: true }],
    [d(10)]: [{ kind: "expense", desc: "Aluguel", value: -1800, paid: false }],
    [d(12)]: [{ kind: "invoice", desc: "Fatura Nubank", value: -2340, paid: false }, { kind: "expense", desc: "Internet", value: -110, paid: false }],
    [d(15)]: [{ kind: "expense", desc: "Mercado", value: -420, paid: true }],
    [d(20)]: [{ kind: "expense", desc: "Academia", value: -120, paid: true }],
    [d(25)]: [{ kind: "invoice", desc: "Fatura Itaú", value: -1910, paid: false }],
  };
}

/** M6 — Calendário Financeiro. Sub-área "calendar" do hub Planejamento. */
export function CalendarPage({ organizationId = null, dataMode = "live", isMobile = false }) {
  const live = shouldUseRealData(organizationId, dataMode);
  const today = useMemo(() => todayParts(), []);
  const [cursor, setCursor] = useState({ year: today.year, month: today.month });
  const [selected, setSelected] = useState(today.ymd);
  const isWide = useIsWide(900);

  const liveData = useCalendarData({ organizationId, year: cursor.year, month: cursor.month, enabled: live });
  const mock = useMemo(() => (dataMode === "mock" ? mockByDay() : {}), [dataMode]);
  const byDay = live ? liveData.byDay : mock;
  const summary = live ? liveData.summary : monthSummary(mock);

  const weeks = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);
  const selectedEvents = byDay[selected] || [];

  function shiftMonth(delta) {
    setCursor((c) => {
      const m = c.month + delta;
      if (m < 1) return { year: c.year - 1, month: 12 };
      if (m > 12) return { year: c.year + 1, month: 1 };
      return { year: c.year, month: m };
    });
  }
  function goToday() {
    setCursor({ year: today.year, month: today.month });
    setSelected(today.ymd);
  }

  const chips = [
    { l: "Recebido", v: fmt(summary.received), c: T.green },
    { l: "Gasto", v: fmt(summary.spent), c: T.red },
    { l: "A pagar (mês)", v: fmt(summary.toPay), c: T.amber },
    { l: "Saldo do mês", v: fmt(summary.net), c: summary.net < 0 ? T.red : T.ink },
  ];

  const navBtn = { ...G, width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, cursor: "pointer", fontSize: 15, color: T.inkMid };

  return (
    <PageEnter>
      <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 6 }}>Planejamento · Rotina</div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <PageTitle sans="Calendário" serif="Financeiro" />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button style={navBtn} onClick={() => shiftMonth(-1)} aria-label="Mês anterior">‹</button>
          <span style={{ ...G, fontWeight: 700, fontSize: 14, minWidth: 110, textAlign: "center" }}>{monthLabel(cursor.year, cursor.month)}</span>
          <button style={navBtn} onClick={() => shiftMonth(1)} aria-label="Próximo mês">›</button>
          <button style={{ ...navBtn, width: "auto", padding: "0 10px", fontSize: 12, fontWeight: 600 }} onClick={goToday}>Hoje</button>
        </div>
      </div>

      {live && liveData.error ? (
        <div style={{ ...G, fontSize: 12, color: T.red, background: T.redLight, borderRadius: 9, padding: "9px 12px", marginTop: 12 }}>{liveData.error}</div>
      ) : null}

      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        {chips.map((c) => (
          <div key={c.l} style={{ flex: isWide ? "0 0 auto" : "1 1 0", border: `1px solid ${T.border}`, borderRadius: 10, padding: "7px 11px", background: T.surface }}>
            <div style={{ ...G, fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: T.inkLight }}>{c.l}</div>
            <div style={{ ...G, ...NUM, fontWeight: 800, fontSize: 14, color: c.c }}>{c.v}</div>
          </div>
        ))}
      </div>

      {isWide ? (
        <DesktopGrid weeks={weeks} byDay={byDay} todayYmd={today.ymd} selected={selected} onSelect={setSelected} />
      ) : (
        <MobileGrid weeks={weeks} byDay={byDay} todayYmd={today.ymd} selected={selected} onSelect={setSelected} />
      )}

      <Legend />

      <Card style={{ marginTop: 16, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
          <div style={{ ...G, fontWeight: 800, fontSize: 15 }}>{dayLongLabel(selected) || "Selecione um dia"}</div>
          {selectedEvents.length ? <div style={{ ...G, ...NUM, ...ghost }}>saldo do dia {fmt(selectedEvents.reduce((s, e) => s + e.value, 0))}</div> : null}
        </div>
        {selectedEvents.length ? (
          selectedEvents.map((e, i) => {
            const c = evColors(e);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${T.border}` }}>
                <span style={{ width: 8, height: 8, borderRadius: 9999, flexShrink: 0, background: c.dot }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...G, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {e.desc}
                    <span style={{ ...G, fontSize: 9, fontWeight: 700, borderRadius: 9999, padding: "1px 7px", background: T.grayLight, color: T.inkMid }}>{evTag(e)}</span>
                  </div>
                </div>
                <span style={{ ...G, ...NUM, fontWeight: 700, color: c.dot }}>{fmt(e.value)}</span>
              </div>
            );
          })
        ) : (
          <div style={{ ...G, fontSize: 12.5, color: T.inkLight, marginTop: 8 }}>Nenhum lançamento neste dia.</div>
        )}
      </Card>
    </PageEnter>
  );
}

function DowHeader() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
      {WEEKDAYS.map((w) => (
        <span key={w} style={{ ...G, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: T.inkGhost, textAlign: "center" }}>{w}</span>
      ))}
    </div>
  );
}

function DesktopGrid({ weeks, byDay, todayYmd, selected, onSelect }) {
  return (
    <div style={{ marginTop: 16 }}>
      <DowHeader />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {weeks.flat().map((cell, i) => {
          if (!cell) return <div key={i} />;
          const evs = byDay[cell.ymd] || [];
          const isToday = cell.ymd === todayYmd;
          const isSel = cell.ymd === selected;
          return (
            <div
              key={i}
              onClick={() => onSelect(cell.ymd)}
              style={{
                background: T.surface, borderRadius: 10, minHeight: 78, padding: "6px 7px", cursor: "pointer",
                display: "flex", flexDirection: "column", gap: 3,
                border: isSel ? `1.5px solid ${T.blue}` : isToday ? `1.5px solid ${T.ink}` : `1px solid ${T.border}`,
              }}
            >
              <span style={{ ...G, fontSize: 12, fontWeight: isToday ? 800 : 600, color: isToday ? T.ink : T.inkMid }}>{cell.day}{isToday ? " ·hoje" : ""}</span>
              {evs.slice(0, 2).map((e, j) => {
                const c = evColors(e);
                return <span key={j} style={{ ...G, ...NUM, fontSize: 10, fontWeight: 600, borderRadius: 5, padding: "1px 5px", color: c.color, background: c.bg, border: c.border, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fmtShort(e.value)} {e.desc}</span>;
              })}
              {evs.length > 2 ? <span style={{ ...ghost, fontSize: 10 }}>+{evs.length - 2}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MobileGrid({ weeks, byDay, todayYmd, selected, onSelect }) {
  return (
    <div style={{ marginTop: 14 }}>
      <DowHeader />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {weeks.flat().map((cell, i) => {
          if (!cell) return <div key={i} />;
          const evs = byDay[cell.ymd] || [];
          const isToday = cell.ymd === todayYmd;
          const isSel = cell.ymd === selected;
          return (
            <button
              key={i}
              onClick={() => onSelect(cell.ymd)}
              style={{
                aspectRatio: "1", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                ...G, fontSize: 11, fontWeight: 600, cursor: "pointer",
                background: isSel ? T.ink : T.surface, color: isSel ? "#fff" : T.inkMid,
                border: isSel ? `1px solid ${T.ink}` : isToday ? `1px solid ${T.ink}` : `1px solid ${T.border}`,
              }}
            >
              {cell.day}
              <span style={{ display: "flex", gap: 2, height: 4 }}>
                {evs.slice(0, 3).map((e, j) => <span key={j} style={{ width: 4, height: 4, borderRadius: 9999, background: isSel ? "#fff" : evColors(e).dot }} />)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Legend() {
  const items = [
    { l: "receita", c: T.green },
    { l: "despesa paga", c: T.red },
    { l: "fatura", c: T.amber },
    { l: "previsto", c: T.inkGhost },
  ];
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12 }}>
      {items.map((it) => (
        <span key={it.l} style={{ ...G, fontSize: 11, color: T.inkLight, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: it.c }} />{it.l}
        </span>
      ))}
    </div>
  );
}
