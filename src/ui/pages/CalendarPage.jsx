import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearch } from "@tanstack/react-router";
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
  pad2,
  ymd,
  WEEKDAYS,
} from "../features/calendar/calendarModel.js";

const MONTHS_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function weekLabel(ymdStr) {
  const base = new Date(`${ymdStr}T00:00:00`);
  if (Number.isNaN(base.getTime())) return "";
  const start = new Date(base);
  start.setDate(base.getDate() - base.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const sm = MONTHS_ABBR[start.getMonth()];
  const em = MONTHS_ABBR[end.getMonth()];
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()}–${end.getDate()} ${sm}`
    : `${start.getDate()} ${sm} – ${end.getDate()} ${em}`;
}
import { shouldUseRealData } from "../dataMode.js";
import { FC, FC_MODAL } from "../routing/searchContract.js";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (v) => brl.format(Number(v || 0));
const fmtShort = (v) => `${v < 0 ? "−" : "+"}${Math.round(Math.abs(Number(v || 0))).toLocaleString("pt-BR")}`;
const ghost = { ...G, fontSize: 11, color: T.inkGhost };

const PAY_LABELS = { pix: "Pix", credit: "Cartão de crédito", credit_card: "Cartão de crédito", debit: "Débito", debit_card: "Débito", cash: "Dinheiro", boleto: "Boleto", transfer: "Transferência", bank_transfer: "Transferência bancária", money: "Dinheiro" };
const payLabel = (m) => {
  if (!m) return "Outros";
  const key = String(m).toLowerCase();
  return PAY_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
};

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
  const d = (day) => `${year}-${pad2(month)}-${pad2(day)}`;
  const exp = (id, desc, value, cat, pm) => ({ id, kind: "expense", type: "expense", desc, value, paid: true, paymentMethod: pm, category: cat });
  return {
    [d(5)]: [{ id: "m1", kind: "income", type: "income", desc: "Salário", value: 7500, paid: true, paymentMethod: "pix", category: "Salário" }],
    [d(10)]: [
      exp("m2", "iFood", -68, "Alimentação", "credit"),
      exp("m3", "Padaria", -24, "Alimentação", "pix"),
      exp("m4", "Mercado", -380, "Mercado", "credit"),
      exp("m5", "Internet", -150, "Casa", "pix"),
      exp("m6", "Uber", -32, "Transporte", "debit"),
      exp("m7", "Pet shop", -130, "Pets", "debit"),
    ],
    [d(12)]: [{ id: null, kind: "invoice", type: "expense", desc: "Fatura Nubank", value: -2340, paid: false, paymentMethod: "credit", category: "Fatura de cartão" }],
  };
}

function filterByDay(byDay, filters) {
  const out = {};
  for (const [day, evs] of Object.entries(byDay)) {
    const kept = evs.filter((e) => {
      const typeOk = e.value >= 0 ? filters.income : filters.expense;
      const m = e.paymentMethod || "outros";
      return typeOk && !filters.hiddenPays.has(m);
    });
    if (kept.length) out[day] = kept;
  }
  return out;
}

function groupByCategory(events) {
  const map = new Map();
  for (const e of events) {
    const k = e.category || "Sem categoria";
    if (!map.has(k)) map.set(k, { name: k, items: [], total: 0 });
    const g = map.get(k);
    g.items.push(e);
    g.total += e.value;
  }
  return [...map.values()].sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
}

/** Calendário Financeiro v2 — workspace, estado no URL (deep-linkável). */
export function CalendarPage({ organizationId = null, dataMode = "live", isMobile = false, onNewTransaction }) {
  const live = shouldUseRealData(organizationId, dataMode);
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const today = useMemo(() => todayParts(), []);
  const isWide = useIsWide(1024);

  // Estado derivado do URL (fonte de verdade).
  const cursor = useMemo(() => {
    const m = search?.[FC.CAL_MONTH];
    if (m && /^\d{4}-\d{2}$/.test(m)) {
      const [y, mo] = m.split("-").map(Number);
      return { year: y, month: mo };
    }
    return { year: today.year, month: today.month };
  }, [search, today]);
  const selected = search?.[FC.CAL_DAY] && /^\d{4}-\d{2}-\d{2}$/.test(search[FC.CAL_DAY]) ? search[FC.CAL_DAY] : today.ymd;
  const view = search?.[FC.CAL_VIEW] === "week" ? "week" : "month";
  const hiddenTypes = useMemo(() => new Set((search?.[FC.CAL_HIDE] || "").split(",").filter(Boolean)), [search]);
  const hiddenPays = useMemo(() => new Set((search?.[FC.CAL_PAY] || "").split(",").filter(Boolean)), [search]);
  const filters = useMemo(
    () => ({ income: !hiddenTypes.has("income"), expense: !hiddenTypes.has("expense"), hiddenPays }),
    [hiddenTypes, hiddenPays],
  );

  const patch = useCallback((p) => navigate({ search: (prev) => ({ ...prev, ...p }), replace: true }), [navigate]);
  const shiftMonth = useCallback(
    (delta) => {
      let { year, month } = cursor;
      month += delta;
      if (month < 1) { year -= 1; month = 12; }
      if (month > 12) { year += 1; month = 1; }
      patch({ [FC.CAL_MONTH]: `${year}-${pad2(month)}` });
    },
    [cursor, patch],
  );
  const shiftWeek = useCallback(
    (delta) => {
      const d = new Date(`${selected}T00:00:00`);
      d.setDate(d.getDate() + delta * 7);
      const y = d.getFullYear();
      const mo = d.getMonth() + 1;
      patch({ [FC.CAL_DAY]: ymd(y, mo, d.getDate()), [FC.CAL_MONTH]: `${y}-${pad2(mo)}` });
    },
    [selected, patch],
  );
  const shiftPeriod = useCallback((delta) => (view === "week" ? shiftWeek(delta) : shiftMonth(delta)), [view, shiftWeek, shiftMonth]);
  const pick = useCallback((ymdStr) => patch({ [FC.CAL_DAY]: ymdStr }), [patch]);
  const setView = useCallback((v) => patch({ [FC.CAL_VIEW]: v === "week" ? "week" : undefined }), [patch]);
  const goToday = useCallback(() => patch({ [FC.CAL_MONTH]: `${today.year}-${pad2(today.month)}`, [FC.CAL_DAY]: today.ymd }), [patch, today]);
  const toggleType = useCallback(
    (k) => {
      const next = new Set(hiddenTypes);
      next.has(k) ? next.delete(k) : next.add(k);
      patch({ [FC.CAL_HIDE]: [...next].join(",") || undefined });
    },
    [hiddenTypes, patch],
  );
  const toggleMethod = useCallback(
    (m) => {
      const next = new Set(hiddenPays);
      next.has(m) ? next.delete(m) : next.add(m);
      patch({ [FC.CAL_PAY]: [...next].join(",") || undefined });
    },
    [hiddenPays, patch],
  );
  const openEdit = useCallback(
    (e, ev) => {
      ev?.stopPropagation();
      if (!e?.id) return;
      navigate({ search: (prev) => ({ ...prev, [FC.TX]: String(e.id), [FC.MODAL]: FC_MODAL.NEW_TRANSACTION }) });
    },
    [navigate],
  );
  const seeExtrato = useCallback(() => navigate({ to: "/transactions", search: { [FC.DATE]: selected } }), [navigate, selected]);

  // Popover do dia ancorado à célula (desktop). Fecha ao trocar período.
  const [popover, setPopover] = useState(null);
  const pickCell = useCallback((ymdStr, rect) => { pick(ymdStr); setPopover(rect ? { rect } : null); }, [pick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPopover(null); }, [view, cursor.year, cursor.month]);

  const liveData = useCalendarData({ organizationId, year: cursor.year, month: cursor.month, enabled: live });
  const mock = useMemo(() => (dataMode === "mock" ? mockByDay() : {}), [dataMode]);
  const rawByDay = live ? liveData.byDay : mock;

  const payMethods = useMemo(() => {
    const set = new Set();
    for (const evs of Object.values(rawByDay)) for (const e of evs) set.add(e.paymentMethod || "outros");
    return [...set];
  }, [rawByDay]);

  const byDay = useMemo(() => filterByDay(rawByDay, filters), [rawByDay, filters]);
  const totals = useMemo(() => monthTotals(rawByDay), [rawByDay]);
  const grid = useMemo(
    () => (view === "week" ? weekMatrix(selected, cursor.year, cursor.month) : monthMatrix(cursor.year, cursor.month)),
    [view, selected, cursor],
  );
  const selectedEvents = byDay[selected] || [];

  // Scroll do mouse sobre a grade troca o mês (modo Mês).
  const gridRef = useRef(null);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return undefined;
    let last = 0;
    const onWheel = (ev) => {
      if (Math.abs(ev.deltaY) < 6) return;
      ev.preventDefault();
      const now = Date.now();
      if (now - last < 280) return;
      last = now;
      shiftPeriod(ev.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [shiftPeriod]);

  const navBtn = { ...G, width: 32, height: 32, borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, cursor: "pointer", fontSize: 15, color: T.inkMid, display: "inline-grid", placeItems: "center" };

  return (
    <PageEnter>
      <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 6 }}>Planejamento · Rotina</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <PageTitle sans="Calendário" serif="Financeiro" />
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <button style={{ ...navBtn, width: "auto", padding: "0 12px", fontSize: 13, fontWeight: 600 }} onClick={goToday}>Hoje</button>
          <button style={navBtn} onClick={() => shiftPeriod(-1)} aria-label={view === "week" ? "Semana anterior" : "Mês anterior"}>‹</button>
          <span style={{ ...G, fontWeight: 700, fontSize: 15, minWidth: 130, textAlign: "center" }}>{view === "week" ? weekLabel(selected) : monthLabel(cursor.year, cursor.month)}</span>
          <button style={navBtn} onClick={() => shiftPeriod(1)} aria-label={view === "week" ? "Próxima semana" : "Próximo mês"}>›</button>
          <Segmented value={view} onChange={setView} />
        </div>
      </div>

      {live && liveData.error ? (
        <div style={{ ...G, fontSize: 12, color: T.red, background: T.redLight, borderRadius: 9, padding: "9px 12px", marginBottom: 12 }}>{liveData.error}</div>
      ) : null}

      <KpiCards totals={totals} />

      {isWide ? (
        <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: 20, marginTop: 16, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <MiniCalendar year={cursor.year} month={cursor.month} todayYmd={today.ymd} selected={selected} onPick={pick} onShift={shiftMonth} />
            <Filters filters={filters} hiddenTypes={hiddenTypes} onToggleType={toggleType} onToggleMethod={toggleMethod} payMethods={payMethods} />
            <DayList selected={selected} events={selectedEvents} onEdit={openEdit} onNew={onNewTransaction} onSeeExtrato={seeExtrato} />
          </div>
          <div ref={gridRef}>
            <Grid grid={grid} byDay={byDay} todayYmd={today.ymd} selected={selected} onPick={pick} onPickCell={pickCell} onEdit={openEdit} week={view === "week"} />
          </div>
          {popover ? (
            <DayPopover anchor={popover.rect} onClose={() => setPopover(null)}>
              <DayList
                selected={selected}
                events={selectedEvents}
                onEdit={(e, ev) => { setPopover(null); openEdit(e, ev); }}
                onNew={onNewTransaction ? (d) => { setPopover(null); onNewTransaction(d); } : undefined}
                onSeeExtrato={() => { setPopover(null); seeExtrato(); }}
              />
            </DayPopover>
          ) : null}
        </div>
      ) : (
        <>
          <div style={{ marginTop: 14 }}>
            <Grid grid={grid} byDay={byDay} todayYmd={today.ymd} selected={selected} onPick={pick} onEdit={openEdit} week={view === "week"} compact />
          </div>
          <div style={{ marginTop: 14 }}>
            <DayList selected={selected} events={selectedEvents} onEdit={openEdit} onNew={onNewTransaction} onSeeExtrato={seeExtrato} />
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

function Filters({ filters, onToggleType, onToggleMethod, payMethods }) {
  const flt = { ...G, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.inkLight, margin: "2px 0 8px" };
  const row = { ...G, display: "flex", alignItems: "center", gap: 9, padding: "5px 2px", fontSize: 13, color: T.inkMid, cursor: "pointer" };
  const Box = ({ on }) => (
    <span style={{ width: 16, height: 16, borderRadius: 5, border: `1.5px solid ${on ? T.ink : T.border}`, background: on ? T.ink : "transparent", display: "grid", placeItems: "center", fontSize: 11, color: "#fff", flexShrink: 0 }}>{on ? "✓" : ""}</span>
  );
  const Leg = ({ c }) => <span style={{ width: 9, height: 9, borderRadius: 9999, background: c, flexShrink: 0 }} />;
  return (
    <Card style={{ padding: 14 }}>
      <div style={flt}>Exibir</div>
      <label style={row} onClick={() => onToggleType("income")}><Box on={filters.income} /><Leg c={T.greenBar} />Entradas</label>
      <label style={row} onClick={() => onToggleType("expense")}><Box on={filters.expense} /><Leg c={T.redBar} />Saídas</label>
      {payMethods.length ? (
        <>
          <div style={{ ...flt, marginTop: 12 }}>Forma de pagamento</div>
          {payMethods.map((m) => (
            <label key={m} style={row} onClick={() => onToggleMethod(m)}><Box on={!filters.hiddenPays.has(m)} />{payLabel(m)}</label>
          ))}
        </>
      ) : null}
    </Card>
  );
}

const CAP = 50; // máximo de itens renderizados na lista do dia (o resto vai pro extrato)

function MoreRow({ n, onSeeExtrato }) {
  return (
    <button
      onClick={onSeeExtrato}
      style={{ ...G, width: "100%", textAlign: "left", border: "none", background: "transparent", color: T.blue, fontSize: 12, fontWeight: 600, padding: "9px 4px", cursor: "pointer", borderTop: `1px solid ${T.border}` }}
    >
      + {n} {n === 1 ? "outro" : "outros"} — ver no extrato →
    </button>
  );
}

function DayList({ selected, events, onEdit, onNew, onSeeExtrato }) {
  const [mode, setMode] = useState("category"); // category | list
  const [open, setOpen] = useState({});
  const income = events.filter((e) => e.value >= 0).reduce((s, e) => s + e.value, 0);
  const expense = events.filter((e) => e.value < 0).reduce((s, e) => s + -e.value, 0);
  const groups = useMemo(() => groupByCategory(events), [events]);
  const dense = events.length > 6;
  const useGroups = mode === "category" && groups.length > 1;

  const Item = ({ e, indent }) => {
    const c = evColors(e);
    const clickable = Boolean(e.id);
    return (
      <div
        onClick={clickable ? (ev) => onEdit(e, ev) : undefined}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: indent ? "8px 4px 8px 24px" : "9px 6px", borderRadius: 9, cursor: clickable ? "pointer" : "default" }}
        onMouseEnter={(ev) => { if (clickable) ev.currentTarget.style.background = T.grayLight; }}
        onMouseLeave={(ev) => { ev.currentTarget.style.background = "transparent"; }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 9999, flexShrink: 0, background: c.dot }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...G, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.desc}</div>
          <div style={{ ...G, fontSize: 10.5, color: T.inkLight }}>{[payLabel(e.paymentMethod), mode === "list" ? e.category : null].filter(Boolean).join(" · ")}</div>
        </div>
        <span style={{ ...G, ...NUM, fontSize: 13, fontWeight: 700, color: c.dot }}>{fmtShort(e.value)}</span>
      </div>
    );
  };

  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div style={{ ...G, fontWeight: 800, fontSize: 14 }}>{dayLongLabel(selected) || "Selecione um dia"}</div>
        <div style={{ ...G, ...ghost }}>{events.length} {events.length === 1 ? "lançamento" : "lançamentos"}</div>
      </div>
      {events.length ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, margin: "11px 0" }}>
            {[{ l: "Entradas", v: income, c: T.green }, { l: "Saídas", v: expense, c: T.red }, { l: "Saldo", v: income - expense, c: income - expense < 0 ? T.red : T.ink }].map((s) => (
              <div key={s.l} style={{ border: `1px solid ${T.border}`, borderRadius: 9, padding: "7px 9px" }}>
                <div style={{ ...G, fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: T.inkLight }}>{s.l}</div>
                <div style={{ ...G, ...NUM, fontSize: 13, fontWeight: 800, color: s.c }}>{fmt(s.v)}</div>
              </div>
            ))}
          </div>
          {dense ? (
            <div style={{ display: "inline-flex", border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 4 }}>
              {["category", "list"].map((m) => (
                <button key={m} onClick={() => setMode(m)} style={{ ...G, border: "none", background: mode === m ? T.ink : "transparent", color: mode === m ? "#fff" : T.inkMid, fontSize: 11, fontWeight: 600, padding: "5px 11px", cursor: "pointer" }}>{m === "category" ? "Por categoria" : "Lista"}</button>
              ))}
            </div>
          ) : null}
          <div style={{ maxHeight: 300, overflowY: "auto", margin: "0 -4px", padding: "0 4px" }}>
            {useGroups
              ? groups.map((g) => {
                  const isOpen = open[g.name] ?? !dense;
                  const extra = g.items.length - CAP;
                  return (
                    <div key={g.name} style={{ borderTop: `1px solid ${T.border}` }}>
                      <div onClick={() => setOpen((o) => ({ ...o, [g.name]: !isOpen }))} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 4px", cursor: "pointer" }}>
                        <span style={{ ...ghost, width: 12, fontSize: 10 }}>{isOpen ? "▾" : "▸"}</span>
                        <span style={{ ...G, flex: 1, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</span>
                        <span style={{ ...ghost, fontSize: 11 }}>{g.items.length}</span>
                        <span style={{ ...G, ...NUM, fontSize: 13, fontWeight: 700, color: g.total < 0 ? T.red : T.green }}>{fmtShort(g.total)}</span>
                      </div>
                      {isOpen ? g.items.slice(0, CAP).map((e, i) => <Item key={e.id || i} e={e} indent />) : null}
                      {isOpen && extra > 0 ? <MoreRow n={extra} onSeeExtrato={onSeeExtrato} /> : null}
                    </div>
                  );
                })
              : (
                <>
                  {events.slice(0, CAP).map((e, i) => <div key={e.id || i} style={{ borderTop: `1px solid ${T.border}` }}><Item e={e} /></div>)}
                  {events.length > CAP ? <MoreRow n={events.length - CAP} onSeeExtrato={onSeeExtrato} /> : null}
                </>
              )}
          </div>
        </>
      ) : (
        <div style={{ ...G, fontSize: 12.5, color: T.inkLight, marginTop: 8 }}>Nenhum lançamento neste dia.</div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {onNew ? (
          <button onClick={() => onNew(selected)} style={{ ...G, flex: 1, borderRadius: 9, border: `1.5px dashed ${T.border}`, background: "transparent", color: T.inkMid, fontSize: 12, fontWeight: 600, padding: "8px 0", cursor: "pointer" }}>+ Nova neste dia</button>
        ) : null}
        <button onClick={onSeeExtrato} style={{ ...G, flex: 1, borderRadius: 9, border: "none", background: "transparent", color: T.blue, fontSize: 12.5, fontWeight: 600, padding: "8px 0", cursor: "pointer" }}>
          {events.length ? `Ver ${events.length} no extrato →` : "Ver no extrato →"}
        </button>
      </div>
    </Card>
  );
}

/** Popover do dia ancorado à célula, com flip quando não há espaço lateral. */
function DayPopover({ anchor, onClose, children }) {
  const ref = useRef(null);
  const WIDTH = 330;
  const [pos, setPos] = useState({ left: anchor.right + 8, top: anchor.top, ready: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ph = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 8;
    let left = anchor.right + gap; // tenta à direita
    if (left + WIDTH > vw - gap) {
      left = anchor.left - WIDTH - gap; // flip para a esquerda
      if (left < gap) left = Math.min(Math.max(anchor.left, gap), vw - WIDTH - gap); // sem espaço lateral → clampa
    }
    const top = Math.min(Math.max(anchor.top, gap), Math.max(gap, vh - ph - gap));
    setPos({ left, top, ready: true });
  }, [anchor]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown, true);
    };
  }, [onClose]);

  return createPortal(
    <div ref={ref} style={{ position: "fixed", left: pos.left, top: pos.top, width: WIDTH, zIndex: 1000, borderRadius: 14, boxShadow: T.lg, visibility: pos.ready ? "visible" : "hidden" }}>
      {children}
    </div>,
    document.body,
  );
}

function Grid({ grid, byDay, todayYmd, selected, onPick, onPickCell, onEdit, week, compact }) {
  const cells = grid.flat();
  const minH = week ? 320 : compact ? 64 : 118;
  const maxEv = week ? 10 : 2;
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
          const dayTotal = evs.reduce((s, e) => s + e.value, 0);
          const overflow = evs.length - maxEv;
          return (
            <div
              key={i}
              onClick={(e) => (onPickCell ? onPickCell(cell.ymd, e.currentTarget.getBoundingClientRect()) : onPick(cell.ymd))}
              style={{
                background: dim ? "transparent" : T.surface, borderRadius: 11, minHeight: minH, padding: 8, cursor: "pointer",
                display: "flex", flexDirection: "column", gap: 4, opacity: dim ? 0.55 : 1,
                border: isSel ? `2px solid ${T.blue}` : isToday ? `1px solid ${T.ink}` : `1px solid ${T.border}`,
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
              {overflow > 0 ? (
                <span style={{ ...G, ...NUM, marginTop: "auto", fontSize: 11, fontWeight: 700, color: T.inkMid, background: T.grayLight, borderRadius: 6, padding: "2px 7px" }}>
                  +{overflow} · {fmtShort(dayTotal)}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      {!week ? <div style={{ ...ghost, fontSize: 11, marginTop: 8 }}>🖱️ role o mouse sobre a grade para trocar de mês</div> : null}
    </div>
  );
}
