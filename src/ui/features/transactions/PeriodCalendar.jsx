import React, { useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { T } from "../../tokens";
import { G } from "../../typography";

export function PeriodCalendar({
  period,
  setPeriod,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
  setVisible,
  PAGE_SIZE,
  onClose,
}) {
  const [calYear, setCalYear] = useState(2026);
  const [calMonth, setCalMonth] = useState(2);
  const [hoverDay, setHoverDay] = useState(null);

  const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const fromDate = customFrom ? new Date(customFrom + "T00:00:00") : null;
  const toDate = customTo ? new Date(customTo + "T00:00:00") : null;

  const prevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  const padNum = (n) => String(n).padStart(2, "0");
  const toStr = (d) => `${d.getFullYear()}-${padNum(d.getMonth() + 1)}-${padNum(d.getDate())}`;

  const dayClick = (day) => {
    const clicked = new Date(calYear, calMonth, day);
    const str = toStr(clicked);
    if (!fromDate || (fromDate && toDate)) {
      setCustomFrom(str);
      setCustomTo("");
      setPeriod("custom");
      setVisible(PAGE_SIZE);
    } else {
      if (clicked < fromDate) {
        setCustomFrom(str);
        setCustomTo(toStr(fromDate));
      } else {
        setCustomTo(str);
      }
      setPeriod("custom");
      setVisible(PAGE_SIZE);
    }
  };

  const isFrom = (d) =>
    fromDate &&
    fromDate.getDate() === d &&
    fromDate.getMonth() === calMonth &&
    fromDate.getFullYear() === calYear;
  const isTo = (d) =>
    toDate &&
    toDate.getDate() === d &&
    toDate.getMonth() === calMonth &&
    toDate.getFullYear() === calYear;
  const inRange = (d) => {
    const cur = new Date(calYear, calMonth, d);
    const end = toDate || (hoverDay && fromDate && !toDate ? new Date(calYear, calMonth, hoverDay) : null);
    if (!fromDate || !end) return false;
    const lo = fromDate < end ? fromDate : end;
    const hi = fromDate < end ? end : fromDate;
    return cur > lo && cur < hi;
  };
  const isEdge = (d) => isFrom(d) || isTo(d);
  const isToday = (d) => {
    const t = new Date(2026, 2, 20);
    return t.getDate() === d && t.getMonth() === calMonth && t.getFullYear() === calYear;
  };

  const cells = [];
  for (let i = 0; i < firstDay; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  return (
    <div style={{ padding: "12px 14px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 8, display: "flex", alignItems: "center", color: T.inkMid }} onMouseEnter={(e) => { e.currentTarget.style.background = T.bg; }} onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}>
          <ChevronLeft size={15} />
        </button>
        <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink }}>
          {MONTHS[calMonth]} {calYear}
        </div>
        <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 8, display: "flex", alignItems: "center", color: T.inkMid }} onMouseEnter={(e) => { e.currentTarget.style.background = T.bg; }} onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}>
          <ChevronRight size={15} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 4 }}>
        {DAYS.map((d, i) => (
          <div key={i} style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkGhost, textAlign: "center", padding: "2px 0" }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "2px 0" }} onMouseLeave={() => setHoverDay(null)}>
        {cells.map((day, idx) => {
          if (!day) return <div key={`e${idx}`} />;
          const edge = isEdge(day);
          const from = isFrom(day);
          const to = isTo(day);
          const range = inRange(day);
          const today = isToday(day);
          const hov = hoverDay === day;
          return (
            <div key={day} onClick={() => dayClick(day)} onMouseEnter={() => setHoverDay(day)} style={{ textAlign: "center", cursor: "pointer", padding: "1px 0", background: range ? `${T.blue}18` : "transparent", borderRadius: from && to ? 8 : from ? "8px 0 0 8px" : to ? "0 8px 8px 0" : "none" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: edge ? T.ink : hov ? T.bg : "transparent", border: today && !edge ? `1.5px solid ${T.ink}` : "none", transition: "background 0.1s" }}>
                <span style={{ ...G, fontSize: 12, fontWeight: edge || today ? 700 : 400, color: edge ? "#fff" : today ? T.ink : T.inkMid }}>
                  {day}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {(fromDate || toDate) && (
        <div style={{ marginTop: 10, padding: "8px 10px", background: T.bg, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ ...G, fontSize: 11, color: T.inkMid }}>De</div>
            <div style={{ ...G, fontSize: 12, fontWeight: 700, color: T.ink }}>
              {fromDate ? fromDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—"}
            </div>
          </div>
          <div style={{ width: 20, height: 1, background: T.border }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ ...G, fontSize: 11, color: T.inkMid }}>Até</div>
            <div style={{ ...G, fontSize: 12, fontWeight: 700, color: T.ink }}>
              {toDate ? toDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—"}
            </div>
          </div>
          <button onClick={() => { setCustomFrom(""); setCustomTo(""); setPeriod("tudo"); setVisible(PAGE_SIZE); }} style={{ ...G, background: "none", border: "none", cursor: "pointer", fontSize: 11, color: T.red, fontWeight: 600, padding: "2px 6px", borderRadius: 6 }}>
            Limpar
          </button>
        </div>
      )}

      {fromDate && toDate && (
        <button onClick={onClose} style={{ ...G, width: "100%", marginTop: 8, background: T.ink, color: "#fff", border: "none", borderRadius: 9, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Check size={13} /> Aplicar intervalo
        </button>
      )}
    </div>
  );
}
