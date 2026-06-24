import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { T } from "../tokens";
import { G, NUM } from "../typography";
import { PageTitle, PageEnter, Card } from "../components/primitives";
import { useCalendarData } from "../features/calendar/useCalendarData.js";
import {
  monthMatrix,
  weekMatrix,
  monthLabel,
  monthTotals,
  dayLongLabel,
  todayParts,
  WEEKDAYS,
} from "../features/calendar/calendarModel.js";
import { shouldUseRealData } from "../dataMode.js";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (v) => brl.format(Number(v || 0));
const fmtShort = (v) => `${v < 0 ? "−" : "+"}${Math.round(Math.abs(Number(v || 0))).toLocaleString("pt-BR")}`;
const ghost = { ...G, fontSize: 11, color: T.inkGhost };

const PAY_LABELS = { pix: "Pix", credit: "Cartão de crédito", credit_card: "Cartão de crédito", debit: "Débito", debit_card: "Débito", cash: "Dinheiro", boleto: "Boleto", transfer: "Transferência" };
const payLabel = (m) => PAY_LABELS[m] || (m ? m.charAt(0).toUpperCase() + m.slice(1) : "Outros");

function useIsWide(bp = 1024) {
  const [wide, setWide] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= bp : true));
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= bp);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [bp]);
  return wide;
}

const KIND = {
  income: { color: T.green, bg: T.greenLight, border: T.greenBorder, dot: T.green },
  refund: { color: T.green, bg: T.greenLight, border: T.greenBorder, dot: T.green },
  expense: { color: T.red, bg: T.redLight, border: T.redBorder || "#FECACA", dot: T.red },
  invoice: { color: T.amber, bg: T.amberLight, border: T.amberBorder || "#FDE68A", dot: T.amber },
};
function evColors(e) {
  const base = KIND[e.kind] || KIND.expense;
  if (e.kind === "expense" && !e.paid) return { color: T.inkLight, bg: "transparent", border: T.border, dot: T.inkGhost };
  return base;
}

function mockByDay() {
  const { year, month } = todayParts();
  const d = (day) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return {
    [d(5)]: [{ id: "m1", kind: "income", type: "income", desc: "Salário", value: 7500, paid: true, paymentMethod: "pix" }],
    [d(10)]: [
      { id: "m2", kind: "expense", type: "expense", desc: "Mercado", value: -380, paid: true, paymentMethod: "credit" },
      { id: "m3", kind: "expense", type: "expense", desc: "Internet", value: -150, paid: true, paymentMethod: "pix" },
      { id: "m4", kind: "expense", type: "expense", desc: "Pet shop", value: -130, paid: true, paymentMethod: "debit" },
    ],
    [d(12)]: [{ id: null, kind: "invoice", type: "expense", desc: "Fatura Nubank", value: -2340, paid: false, paymentMethod: "credit" }],
    [d(20)]: [{ id: "m5", kind: "expense", type: "expense", desc: "Academia", value: -120, paid: true, paymentMethod: "debit" }],
  };
}

function filterByDay(byDay, filters) {
  const out = {};
  for (const [day, evs] of Object.entries(byDay)) {
    const kept = evs.filter((e) => {
      const typeOk = e.value >= 0 ? filters.income : filters.expense;
      const m = e.paymentMethod || "outros";
      const methodOk = filters.methods[m] !== false;
      return typeOk && methodOk;
    });
    if (kept.length) out[day] = kept;
  }
  return out;
}

/** Calendário Financeiro v2 — workspace (rail + KPIs + Semana/Mês). */
export function CalendarPage({ organizationId = null, dataMode = "live", isMobile = false, onEditTransaction, onNewTransaction, onCalendarDateChange }) {
  const live = shouldUseRealData(organizationId, dataMode);
  const today = useMemo(() => todayParts(), []);
  const [cursor, setCursor] = useState({ year: today.year, month: today.month });
  const [selected, setSelected] = useState(today.ymd);
  const [view, setView] = useState("month");
  const isWide = useIsWide(1024);

  const liveData = useCalendarData({ organizationId, year: cursor.year, month: cursor.month, enabled: live });
  const mock = useMemo(() => (dataMode === "mock" ? mockByDay() : {}), [dataMode]);
  const rawByDay = live ? liveData.byDay : mock;

  // Métodos de pagamento presentes no mês (para os filtros).
  const payMethods = useMemo(() => {
    const set = new Set();
    for (const evs of Object.values(rawByDay)) for (const e of evs) set.add(e.paymentMethod || "outros");
    return [...set];
  }, [rawByDay]);

  const [filters, setFilters] = useState({ income: true, expense: true, methods: {} });
  const byDay = useMemo(() => filterByDay(rawByDay, filters), [rawByDay, filters]);
  const totals = useMemo(() => monthTotals(rawByDay), [rawByDay]);

  const grid = useMemo(
    () => (view === "week" ? weekMatrix(selected, cursor.year, cursor.month) : monthMatrix(cursor.year, cursor.month)),
    [view, selected, cursor],
  );
  const selectedEvents = byDay[selected] || [];

  const shiftMonth = useCallback((delta) => {
    setCursor((c) => {
      const m = c.month + delta;
      if (m < 1) return { year: c.year - 1, month: 12 };
      if (m > 12) return { year: c.year + 1, month: 1 };
      return { year: c.year, month: m };
    });
  }, []);
  function goToday() {
    setCursor({ year: today.year, month: today.month });
    setSelected(today.ymd);
  }
  function pick(ymdStr) {
    setSelected(ymdStr);
  }
  const editEvent = useCallback((e, ev) => {
    ev?.stopPropagation();
    if (e?.id && onEditTransaction) onEditTransaction(e.id);
  }, [onEditTransaction]);

  // Reporta o dia selecionado ao App (topbar "Nova transação" herda a data) + limpa ao sair.
  useEffect(() => { onCalendarDateChange?.(selected); }, [selected, onCalendarDateChange]);
  useEffect(() => () => onCalendarDateChange?.(null), [onCalendarDateChange]);

  // Scroll do mouse sobre a grade troca o mês (modo Mês).
  const gridRef = useRef(null);
  useEffect(() => {
    const el = gridRef.current;
    if (!el || view !== "month") return undefined;
    let last = 0;
    const onWheel = (ev) => {
      if (Math.abs(ev.deltaY) < 6) return;
      ev.preventDefault();
      const now = Date.now();
      if (now - last < 280) return;
      last = now;
      shiftMonth(ev.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [view, shiftMonth]);

  const navBtn = { ...G, width: 32, height: 32, borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, cursor: "pointer", fontSize: 15, color: T.inkMid, display: "inline-grid", placeItems: "center" };

  return (
    <PageEnter>
      <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 6 }}>Planejamento · Rotina</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <PageTitle sans="Calendário" serif="Financeiro" />
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <button style={{ ...navBtn, width: "auto", padding: "0 12px", fontSize: 13, fontWeight: 600 }} onClick={goToday}>Hoje</button>
          <button style={navBtn} onClick={() => shiftMonth(-1)} aria-label="Mês anterior">‹</button>
          <span style={{ ...G, fontWeight: 700, fontSize: 15, minWidth: 120, textAlign: "center" }}>{monthLabel(cursor.year, cursor.month)}</span>
          <button style={navBtn} onClick={() => shiftMonth(1)} aria-label="Próximo mês">›</button>
          <Segmented value={view} onChange={setView} />
        </div>
      </div>

      {live && liveData.error ? (
        <div style={{ ...G, fontSize: 12, color: T.red, background: T.redLight, borderRadius: 9, padding: "9px 12px", marginBottom: 12 }}>{liveData.error}</div>
      ) : null}

      <KpiCards totals={totals} />

      {isWide ? (
        <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0, 1fr)", gap: 20, marginTop: 16, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <MiniCalendar year={cursor.year} month={cursor.month} todayYmd={today.ymd} selected={selected} onPick={pick} onShift={shiftMonth} />
            <Filters filters={filters} setFilters={setFilters} payMethods={payMethods} />
            <DayList selected={selected} events={selectedEvents} onEdit={editEvent} onNew={onNewTransaction} />
          </div>
          <div ref={gridRef}>
            <Grid grid={grid} byDay={byDay} todayYmd={today.ymd} selected={selected} onPick={pick} onEdit={editEvent} week={view === "week"} />
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginTop: 14 }}>
            <Grid grid={grid} byDay={byDay} todayYmd={today.ymd} selected={selected} onPick={pick} onEdit={editEvent} week={view === "week"} compact />
          </div>
          <div style={{ marginTop: 14 }}>
            <DayList selected={selected} events={selectedEvents} onEdit={editEvent} onNew={onNewTransaction} />
          </div>
        </>
      )}
    </PageEnter>
  );
}

function Segmented({ value, onChange }) {
  const opt = (v, label) => (
    <button
      onClick={() => onChange(v)}
      style={{ ...G, border: "none", background: value === v ? T.ink : "transparent", color: value === v ? "#fff" : T.inkMid, fontSize: 13, fontWeight: 600, padding: "7px 16px", cursor: "pointer" }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: "inline-flex", border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden", background: T.surface }}>
      {opt("week", "Semana")}
      {opt("month", "Mês")}
    </div>
  );
}

function KpiCards({ totals }) {
  const cards = [
    { l: "Entradas", v: totals.income, sub: `${totals.incomeCount} ${totals.incomeCount === 1 ? "lançamento" : "lançamentos"}`, grad: "linear-gradient(135deg,#059669,#10B981)", ic: "↑" },
    { l: "Saídas", v: totals.expense, sub: `${totals.expenseCount} ${totals.expenseCount === 1 ? "lançamento" : "lançamentos"}`, grad: "linear-gradient(135deg,#DC2626,#EF4444)", ic: "↓" },
    { l: "Saldo do mês", v: totals.net, sub: totals.net >= 0 ? "superávit" : "déficit", grad: "linear-gradient(135deg,#0F0F0D,#374151)", ic: "≈" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
      {cards.map((c) => (
        <div key={c.l} style={{ borderRadius: 14, padding: "16px 18px", color: "#fff", background: c.grad, position: "relative", overflow: "hidden", boxShadow: T.md }}>
          <span style={{ position: "absolute", right: 14, top: 12, fontSize: 22, opacity: 0.85 }}>{c.ic}</span>
          <div style={{ ...G, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.92 }}>{c.l}</div>
          <div style={{ ...G, ...NUM, fontSize: 27, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 5 }}>{fmt(c.v)}</div>
          <div style={{ ...G, fontSize: 12, opacity: 0.9, marginTop: 2 }}>{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

function MiniCalendar({ year, month, todayYmd, selected, onPick, onShift }) {
  const weeks = useMemo(() => monthMatrix(year, month), [year, month]);
  const miniBtn = { ...G, width: 22, height: 22, borderRadius: 7, border: `1px solid ${T.border}`, background: T.surface, cursor: "pointer", fontSize: 12, color: T.inkMid };
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ ...G, fontSize: 13, fontWeight: 700 }}>{monthLabel(year, month)}</span>
        <span style={{ display: "flex", gap: 5 }}>
          <button style={miniBtn} onClick={() => onShift(-1)} aria-label="Mês anterior">‹</button>
          <button style={miniBtn} onClick={() => onShift(1)} aria-label="Próximo mês">›</button>
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {["D", "S", "T", "Q", "Q", "S", "S"].map((w, i) => (
          <span key={i} style={{ ...G, fontSize: 9, fontWeight: 700, color: T.inkGhost, textAlign: "center", padding: "2px 0" }}>{w}</span>
        ))}
        {weeks.flat().map((cell, i) => {
          if (!cell) return <span key={i} />;
          const isToday = cell.ymd === todayYmd;
          const isSel = cell.ymd === selected;
          return (
            <button
              key={i}
              onClick={() => onPick(cell.ymd)}
              style={{
                ...G, ...NUM, fontSize: 11, textAlign: "center", padding: "5px 0", borderRadius: 7, border: isSel ? `1.5px solid ${T.blue}` : "1px solid transparent",
                background: isToday ? T.blue : "transparent", color: isToday ? "#fff" : T.inkMid, fontWeight: isToday || isSel ? 700 : 500, cursor: "pointer",
              }}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function Filters({ filters, setFilters, payMethods }) {
  const flt = { ...G, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.inkLight, margin: "2px 0 8px" };
  const row = { ...G, display: "flex", alignItems: "center", gap: 9, padding: "5px 2px", fontSize: 13, color: T.inkMid, cursor: "pointer" };
  const Box = ({ on }) => (
    <span style={{ width: 16, height: 16, borderRadius: 5, border: `1.5px solid ${on ? T.ink : T.border}`, background: on ? T.ink : "transparent", display: "grid", placeItems: "center", fontSize: 11, color: "#fff", flexShrink: 0 }}>{on ? "✓" : ""}</span>
  );
  const Leg = ({ c }) => <span style={{ width: 9, height: 9, borderRadius: 9999, background: c, flexShrink: 0 }} />;
  const toggleType = (k) => setFilters((f) => ({ ...f, [k]: !f[k] }));
  const toggleMethod = (m) => setFilters((f) => ({ ...f, methods: { ...f.methods, [m]: f.methods[m] === false } }));
  return (
    <Card style={{ padding: 14 }}>
      <div style={flt}>Exibir</div>
      <label style={row} onClick={() => toggleType("income")}><Box on={filters.income} /><Leg c={T.greenBar} />Entradas</label>
      <label style={row} onClick={() => toggleType("expense")}><Box on={filters.expense} /><Leg c={T.redBar} />Saídas</label>
      {payMethods.length ? (
        <>
          <div style={{ ...flt, marginTop: 12 }}>Forma de pagamento</div>
          {payMethods.map((m) => (
            <label key={m} style={row} onClick={() => toggleMethod(m)}><Box on={filters.methods[m] !== false} />{payLabel(m)}</label>
          ))}
        </>
      ) : null}
    </Card>
  );
}

function DayList({ selected, events, onEdit, onNew }) {
  const total = events.reduce((s, e) => s + e.value, 0);
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div style={{ ...G, fontWeight: 800, fontSize: 14 }}>{dayLongLabel(selected) || "Selecione um dia"}</div>
        {events.length ? <div style={{ ...G, ...NUM, ...ghost }}>{fmt(total)}</div> : null}
      </div>
      {events.length ? (
        events.map((e, i) => {
          const c = evColors(e);
          const clickable = Boolean(e.id);
          return (
            <div
              key={e.id || i}
              onClick={clickable ? (ev) => onEdit(e, ev) : undefined}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderRadius: 10, cursor: clickable ? "pointer" : "default" }}
              onMouseEnter={(ev) => { if (clickable) ev.currentTarget.style.background = T.grayLight; }}
              onMouseLeave={(ev) => { ev.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ width: 9, height: 9, borderRadius: 9999, flexShrink: 0, background: c.dot }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...G, fontSize: 13.5, fontWeight: 600 }}>{e.desc}</div>
                <div style={{ ...G, fontSize: 11, color: T.inkLight }}>{[payLabel(e.paymentMethod), e.kind === "invoice" ? "fatura" : null].filter(Boolean).join(" · ")}</div>
              </div>
              <span style={{ ...G, ...NUM, fontSize: 13.5, fontWeight: 700, color: c.dot }}>{fmtShort(e.value)}</span>
            </div>
          );
        })
      ) : (
        <div style={{ ...G, fontSize: 12.5, color: T.inkLight, marginTop: 8 }}>Nenhum lançamento neste dia.</div>
      )}
      {onNew ? (
        <button
          onClick={() => onNew(selected)}
          style={{ ...G, marginTop: 8, width: "100%", borderRadius: 9, border: `1.5px dashed ${T.border}`, background: "transparent", color: T.inkMid, fontSize: 12.5, fontWeight: 600, padding: "8px 0", cursor: "pointer" }}
        >
          + Nova transação neste dia
        </button>
      ) : null}
    </Card>
  );
}

function Grid({ grid, byDay, todayYmd, selected, onPick, onEdit, week, compact }) {
  const cells = grid.flat();
  const minH = week ? 320 : compact ? 64 : 118;
  const maxEv = week ? 8 : 3;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 7, marginBottom: 7 }}>
        {WEEKDAYS.map((w) => (
          <span key={w} style={{ ...G, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: T.inkGhost, textAlign: "center" }}>{w}</span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 7 }}>
        {cells.map((cell, i) => {
          if (!cell || (cell.inMonth === false && !week)) return <div key={i} />;
          const evs = byDay[cell.ymd] || [];
          const isToday = cell.ymd === todayYmd;
          const isSel = cell.ymd === selected;
          const dim = cell.inMonth === false;
          return (
            <div
              key={i}
              onClick={() => onPick(cell.ymd)}
              style={{
                background: dim ? "transparent" : T.surface, borderRadius: 11, minHeight: minH, padding: 8, cursor: "pointer",
                display: "flex", flexDirection: "column", gap: 4, opacity: dim ? 0.55 : 1,
                border: isSel ? `2px solid ${T.blue}` : isToday ? `1px solid ${T.ink}` : `1px solid ${T.border}`,
                outline: isSel ? "none" : undefined,
              }}
            >
              <span style={{ ...G, fontSize: compact ? 12 : 13.5, fontWeight: isToday ? 800 : 600, color: isToday ? T.ink : T.inkMid }}>{cell.day}{isToday ? " ·hoje" : ""}</span>
              {evs.slice(0, maxEv).map((e, j) => {
                const c = evColors(e);
                const clickable = Boolean(e.id);
                return (
                  <span
                    key={e.id || j}
                    onClick={clickable ? (ev) => onEdit(e, ev) : undefined}
                    style={{ ...G, ...NUM, fontSize: 12, fontWeight: 600, borderRadius: 6, padding: "2px 7px", color: c.color, background: c.bg, border: `1px solid ${c.border}`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: clickable ? "pointer" : "default" }}
                  >
                    {fmtShort(e.value)} {e.desc}
                  </span>
                );
              })}
              {evs.length > maxEv ? <span style={{ ...ghost, fontSize: 11 }}>+{evs.length - maxEv}</span> : null}
            </div>
          );
        })}
      </div>
      {!week ? <div style={{ ...ghost, fontSize: 11, marginTop: 8 }}>🖱️ role o mouse sobre a grade para trocar de mês</div> : null}
    </div>
  );
}
