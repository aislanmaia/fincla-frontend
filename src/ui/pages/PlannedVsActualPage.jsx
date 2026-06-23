import React, { useEffect, useMemo, useState } from "react";
import { T } from "../tokens";
import { G, NUM } from "../typography";
import { PageTitle, Card, Btn, PageEnter } from "../components/primitives";
import { useMonthlyPlanData } from "../features/monthlyPlan/useMonthlyPlanData.js";
import { shouldUseRealData } from "../dataMode.js";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (v) => brl.format(Number(v || 0));
const parseBRL = (s) => Number(String(s ?? "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".")) || 0;
const ghost = { ...G, fontSize: 11, color: T.inkGhost };
const cap = { ...G, fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: T.inkLight };
const itemKey = (i) => `${i.kind}:${i.tag_id ?? "none"}`;

const MOCK = {
  year: new Date().getFullYear(), month: new Date().getMonth() + 1, has_plan: true, status: "active", notes: "",
  planned_income: 7000, planned_expense: 4500, actual_income: 7500, actual_expense: 5230,
  items: [
    { tag_id: "t1", tag_name: "Alimentação", kind: "expense", planned: 1200, actual: 1560, variance: 360, in_plan: true },
    { tag_id: "t2", tag_name: "Moradia", kind: "expense", planned: 1800, actual: 1800, variance: 0, in_plan: true },
    { tag_id: "t3", tag_name: "Transporte", kind: "expense", planned: 600, actual: 480, variance: -120, in_plan: true },
    { tag_id: "t4", tag_name: "Assinaturas", kind: "expense", planned: 0, actual: 120, variance: 120, in_plan: false },
    { tag_id: "t5", tag_name: "Salário", kind: "income", planned: 7000, actual: 7500, variance: 500, in_plan: true },
  ],
};

/** Cor da variação conforme a direção (despesa: acima=ruim; receita: acima=bom). */
function varColor(kind, variance) {
  if (variance === 0) return T.green;
  if (kind === "expense") return variance > 0 ? T.red : T.green;
  return variance >= 0 ? T.green : T.amber;
}
function barColor(kind, planned, actual) {
  if (kind === "expense") return actual > planned ? T.redBar : T.greenBar;
  return actual >= planned ? T.greenBar : T.amberBar;
}

function CompareCard({ title, planned, actual, kind }) {
  const variance = actual - planned;
  const pct = planned > 0 ? Math.min(100, (actual / planned) * 100) : actual > 0 ? 100 : 0;
  const vc = varColor(kind, variance);
  const label = kind === "expense"
    ? variance > 0 ? `+${fmt(variance)} acima` : variance < 0 ? `${fmt(variance)}` : "no alvo"
    : variance > 0 ? `+${fmt(variance)}` : variance < 0 ? `${fmt(variance)}` : "no alvo";
  const valColor = kind === "income" ? T.green : kind === "expense" ? T.red : T.ink;
  return (
    <div style={{ flex: 1, minWidth: 200, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, background: T.surface }}>
      <div style={cap}>{title}</div>
      <div style={{ ...G, ...NUM, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: valColor, marginTop: 4 }}>{fmt(actual)} <span style={{ fontSize: 12, color: T.inkLight, fontWeight: 600 }}>real</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
        <span style={{ ...G, fontSize: 12, color: T.inkLight }}>planejado {fmt(planned)}</span>
        <span style={{ ...G, fontSize: 10, fontWeight: 700, borderRadius: 9999, padding: "2px 8px", color: vc, background: vc === T.red ? T.redLight : vc === T.amber ? T.amberLight : T.greenLight }}>{label}</span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: T.grayLight, overflow: "hidden", marginTop: 8 }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: barColor(kind, planned, actual) }} />
      </div>
    </div>
  );
}

/** M5 — Planejado × Realizado. Sub-área "planned" do hub. */
export function PlannedVsActualPage({ organizationId = null, dataMode = "live", isMobile = false }) {
  const live = shouldUseRealData(organizationId, dataMode);
  const now = useMemo(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }), []);
  const [cursor, setCursor] = useState(now);
  const { data: liveData, loading, error, saving, save } = useMonthlyPlanData({ organizationId, year: cursor.year, month: cursor.month, enabled: live });
  const data = live ? liveData : MOCK;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ planned_income: "", planned_expense: "", notes: "", items: {} });

  function shiftMonth(delta) {
    setEditing(false);
    setCursor((c) => {
      const m = c.month + delta;
      if (m < 1) return { year: c.year - 1, month: 12 };
      if (m > 12) return { year: c.year + 1, month: 1 };
      return { year: c.year, month: m };
    });
  }
  function startEdit() {
    if (!data) return;
    const itemsMap = {};
    for (const i of data.items) itemsMap[itemKey(i)] = i.planned ? String(i.planned).replace(".", ",") : "";
    setForm({
      planned_income: data.planned_income ? String(data.planned_income).replace(".", ",") : "",
      planned_expense: data.planned_expense ? String(data.planned_expense).replace(".", ",") : "",
      notes: data.notes || "",
      items: itemsMap,
    });
    setEditing(true);
  }
  async function submit() {
    const items = (data?.items || [])
      .map((i) => ({ tag_id: i.tag_id, kind: i.kind, planned_amount: parseBRL(form.items[itemKey(i)]) }))
      .filter((i) => i.planned_amount > 0);
    const body = { planned_income: parseBRL(form.planned_income), planned_expense: parseBRL(form.planned_expense), notes: form.notes || null, status: "active", items };
    if (live) {
      try { await save(body); setEditing(false); } catch { /* erro em error */ }
    } else {
      setEditing(false);
    }
  }

  const expenses = (data?.items || []).filter((i) => i.kind === "expense");
  const incomes = (data?.items || []).filter((i) => i.kind === "income");
  const netPlanned = (data?.planned_income || 0) - (data?.planned_expense || 0);
  const netActual = (data?.actual_income || 0) - (data?.actual_expense || 0);
  const navBtn = { ...G, width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, cursor: "pointer", fontSize: 15, color: T.inkMid };
  const inputStyle = { ...G, ...NUM, width: "100%", fontSize: 13, color: T.ink, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 8, padding: "6px 9px", outline: "none", boxSizing: "border-box", textAlign: "right" };

  return (
    <PageEnter>
      <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 6 }}>Planejamento · Rotina</div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <PageTitle sans="Planejado ×" serif="Realizado" />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button style={navBtn} onClick={() => shiftMonth(-1)} aria-label="Mês anterior">‹</button>
          <span style={{ ...G, fontWeight: 700, fontSize: 14, minWidth: 110, textAlign: "center" }}>{MONTHS[cursor.month - 1]} {cursor.year}</span>
          <button style={navBtn} onClick={() => shiftMonth(1)} aria-label="Próximo mês">›</button>
          {editing ? (
            <>
              <Btn variant="outGray" onClick={() => setEditing(false)} small={isMobile}>Cancelar</Btn>
              <Btn variant="dark" onClick={submit} small={isMobile}>{saving ? "Salvando…" : "Salvar"}</Btn>
            </>
          ) : (
            <Btn variant="dark" onClick={startEdit} small={isMobile}>Editar plano</Btn>
          )}
        </div>
      </div>

      {live && error ? (
        <div style={{ ...G, fontSize: 12, color: T.red, background: T.redLight, borderRadius: 9, padding: "9px 12px", marginTop: 12 }}>{error}</div>
      ) : null}
      {live && loading && !data ? (
        <div style={{ ...G, fontSize: 13, color: T.inkLight, padding: "24px 4px" }}>Carregando plano…</div>
      ) : null}

      {data ? (
        <>
          {editing ? (
            <Card style={{ marginTop: 14, padding: 16, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <label style={{ flex: 1, minWidth: 160 }}><span style={cap}>Receita planejada</span><input style={{ ...inputStyle, marginTop: 5 }} value={form.planned_income} onChange={(e) => setForm((f) => ({ ...f, planned_income: e.target.value }))} placeholder={fmt(data.actual_income)} inputMode="decimal" /></label>
              <label style={{ flex: 1, minWidth: 160 }}><span style={cap}>Despesa planejada</span><input style={{ ...inputStyle, marginTop: 5 }} value={form.planned_expense} onChange={(e) => setForm((f) => ({ ...f, planned_expense: e.target.value }))} placeholder={fmt(data.actual_expense)} inputMode="decimal" /></label>
              <label style={{ flex: 2, minWidth: 200 }}><span style={cap}>Notas</span><input style={{ ...inputStyle, textAlign: "left", marginTop: 5 }} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="opcional" /></label>
            </Card>
          ) : (
            <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
              <CompareCard title="Receita" planned={data.planned_income} actual={data.actual_income} kind="income" />
              <CompareCard title="Despesa" planned={data.planned_expense} actual={data.actual_expense} kind="expense" />
              <CompareCard title="Saldo do mês" planned={netPlanned} actual={netActual} kind="net" />
            </div>
          )}

          <Section title="Despesas por categoria" items={expenses} editing={editing} form={form} setForm={setForm} inputStyle={inputStyle} />
          {incomes.length ? <Section title="Receitas por categoria" items={incomes} editing={editing} form={form} setForm={setForm} inputStyle={inputStyle} /> : null}

          {!editing ? (
            <div style={{ ...ghost, marginTop: 12 }}>Categorias sem alvo aparecem como "fora do plano". Em "Editar plano", o realizado vem como sugestão (placeholder).</div>
          ) : null}
        </>
      ) : null}
    </PageEnter>
  );
}

function Section({ title, items, editing, form, setForm, inputStyle }) {
  if (!items.length) return null;
  return (
    <Card style={{ marginTop: 14, padding: "4px 16px 12px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr 0.9fr", gap: 10, alignItems: "center", padding: "10px 0 6px", ...G, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: T.inkGhost }}>
        <span>{title}</span><span style={{ textAlign: "right" }}>Planejado</span><span style={{ textAlign: "right" }}>Realizado</span><span>Uso</span><span style={{ textAlign: "right" }}>Variação</span>
      </div>
      {items.map((i) => {
        const vc = varColor(i.kind, i.variance);
        const pct = i.planned > 0 ? Math.min(100, (i.actual / i.planned) * 100) : i.actual > 0 ? 100 : 0;
        const k = itemKey(i);
        return (
          <div key={k} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr 0.9fr", gap: 10, alignItems: "center", padding: "11px 0", borderTop: `1px solid ${T.border}` }}>
            <span style={{ ...G, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              {i.tag_name || "—"}
              {!i.in_plan ? <span style={{ ...G, fontSize: 9, fontWeight: 700, borderRadius: 9999, padding: "1px 7px", background: T.grayLight, color: T.inkMid }}>fora do plano</span> : null}
            </span>
            {editing ? (
              <input style={inputStyle} value={form.items[k] ?? ""} onChange={(e) => setForm((f) => ({ ...f, items: { ...f.items, [k]: e.target.value } }))} placeholder={String(Math.round(i.actual))} inputMode="decimal" />
            ) : (
              <span style={{ ...G, ...NUM, fontSize: 12, color: T.inkLight, textAlign: "right" }}>{i.planned ? fmt(i.planned) : "—"}</span>
            )}
            <span style={{ ...G, ...NUM, fontSize: 12, fontWeight: 700, textAlign: "right" }}>{fmt(i.actual)}</span>
            <span style={{ height: 8, borderRadius: 99, background: T.grayLight, overflow: "hidden" }}><span style={{ display: "block", width: `${pct}%`, height: "100%", borderRadius: 99, background: barColor(i.kind, i.planned, i.actual) }} /></span>
            <span style={{ ...G, ...NUM, fontSize: 12, textAlign: "right", color: vc }}>{i.variance === 0 ? "no alvo" : `${i.variance > 0 ? "+" : ""}${fmt(i.variance)}`}</span>
          </div>
        );
      })}
    </Card>
  );
}
