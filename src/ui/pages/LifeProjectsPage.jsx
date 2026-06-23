import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { X } from "lucide-react";
import { FC } from "../routing/searchContract.js";
import { T } from "../tokens";
import { G, NUM } from "../typography";
import { PageTitle, Card, Btn, PageEnter } from "../components/primitives";
import { useGoalsData } from "../features/goals/useGoalsData.js";
import { useEconomyCapacityData } from "../features/financialHealth/useEconomyCapacityData.js";
import {
  buildCreateGoalPayload,
  buildUpdateGoalPayload,
  deadlineToMonthInput,
  rateToPercentInput,
} from "../data/goalsAdapter.js";
import {
  GOAL_TYPES,
  goalTypeMeta,
  typeSupportsReturn,
  TERMS,
  termMeta,
  PRIORITIES,
  priorityMeta,
} from "../features/goals/goalMeta.js";
import { resolveLocalData, shouldUseRealData } from "../dataMode.js";
import { GoalProjectionModal } from "../features/goals/GoalProjectionModal.jsx";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (v) => brl.format(Number(v || 0));
const fmtPct = (rate) => `${Number(Number(rate) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% a.a.`;

const LIFE_PROJECTS_MOCK = [
  { id: "m1", nome: "Reserva de emergência", desc: "", type: "emergency_fund", meta: 30000, atual: 18500, progress: 62, monthly_target: 1000, annual_return_rate: null, deadline: "2026-12-01", prazo: "Dez 2026", term: "short", prioridade: "alta" },
  { id: "m2", nome: "Viagem Europa", desc: "", type: "travel", meta: 18000, atual: 5200, progress: 29, monthly_target: 600, annual_return_rate: null, deadline: "2027-07-01", prazo: "Jul 2027", term: "medium", prioridade: "media" },
  { id: "m3", nome: "Entrada do apê", desc: "", type: "home", meta: 80000, atual: 22000, progress: 27, monthly_target: 1500, annual_return_rate: null, deadline: "2029-01-01", prazo: "Jan 2029", term: "long", prioridade: "alta" },
  { id: "m4", nome: "Aposentadoria", desc: "", type: "retirement", meta: 500000, atual: 64000, progress: 13, monthly_target: 1200, annual_return_rate: 0.105, deadline: "2045-01-01", prazo: "Jan 2045", term: "long", prioridade: "media" },
];

function useIsWide(bp = 1100) {
  const [wide, setWide] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= bp : true));
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= bp);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [bp]);
  return wide;
}

const cap = { ...G, fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: T.inkLight };
const ghost = { ...G, fontSize: 11, color: T.inkGhost };

function Pill({ children, color, bg }) {
  return (
    <span style={{ ...G, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, borderRadius: 9999, padding: "2px 8px", color: color || T.inkMid, background: bg || T.grayLight }}>
      {children}
    </span>
  );
}

function ProjectCard({ g, onEdit, onContribuir, onProjection }) {
  const tm = goalTypeMeta(g.type);
  const pm = priorityMeta(g.prioridade);
  return (
    <Card style={{ padding: 13, cursor: "pointer" }} onClick={() => onEdit(g)}>
      <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
        <div style={{ width: 34, height: 34, flex: "0 0 34px", borderRadius: 11, display: "grid", placeItems: "center", fontSize: 17, background: tm.tint }}>{tm.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...G, fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{g.nome}</div>
          <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
            <Pill>{tm.label}</Pill>
            <Pill color={pm.color} bg={pm.tint}>{pm.label.toLowerCase()}</Pill>
            {typeSupportsReturn(g.type) && g.annual_return_rate ? <Pill color={T.green} bg={T.greenLight}>{fmtPct(g.annual_return_rate)}</Pill> : null}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 11 }}>
        <span style={{ ...G, ...NUM, fontSize: 12, color: T.inkLight }}>{Math.round(g.progress)}%</span>
        <span style={{ ...G, ...NUM, fontSize: 12, color: T.inkLight }}>{fmt(g.meta)}</span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: T.grayLight, overflow: "hidden", marginTop: 6 }}>
        <div style={{ width: `${Math.max(2, Math.min(100, g.progress))}%`, height: "100%", borderRadius: 99, background: tm.bar }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <span style={ghost}>{g.monthly_target ? `${fmt(g.monthly_target)}/mês` : "sem aporte"} · {g.prazo}</span>
        {onContribuir ? (
          <button onClick={(e) => { e.stopPropagation(); onContribuir(g); }} style={{ ...G, fontSize: 11, fontWeight: 700, color: T.green, background: "none", border: "none", cursor: "pointer", padding: 0 }}>+ Aportar</button>
        ) : null}
      </div>
      {g.projection && g.projection.monthsToTarget != null ? (
        <div onClick={(e) => { e.stopPropagation(); onProjection && onProjection(g); }} style={{ marginTop: 8, borderTop: `1px solid ${T.border}`, paddingTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer" }}>
          <span style={{ ...G, fontSize: 11, color: T.inkLight, display: "inline-flex", alignItems: "center", gap: 5 }}>📈 No ritmo: <b style={{ color: T.ink }}>{g.projection.completionLabel}</b></span>
          {g.projection.onTrack === false ? (
            <span style={{ ...G, fontSize: 10, fontWeight: 700, borderRadius: 9999, padding: "2px 8px", color: T.amber, background: T.amberLight }}>✕ +{g.projection.monthsVsDeadline}m</span>
          ) : g.projection.onTrack === true ? (
            <span style={{ ...G, fontSize: 10, fontWeight: 700, borderRadius: 9999, padding: "2px 8px", color: T.green, background: T.greenLight }}>✓ no prazo</span>
          ) : (
            <span style={{ ...G, fontSize: 10, fontWeight: 700, borderRadius: 9999, padding: "2px 8px", color: T.inkLight, background: T.grayLight }}>estimado</span>
          )}
        </div>
      ) : null}
    </Card>
  );
}

function EmptyLane({ term, onCreate }) {
  const tm = termMeta(term);
  return (
    <div style={{ border: `1.5px dashed ${T.border}`, borderRadius: 12, background: "rgba(255,255,255,0.5)", padding: "16px 12px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, flex: 1, justifyContent: "center" }}>
      <div style={{ ...G, fontSize: 12, fontWeight: 700 }}>{tm.label}</div>
      <div style={{ ...G, fontSize: 11, color: T.inkLight, lineHeight: 1.4 }}>{tm.hint}. {tm.examples}</div>
      <Btn variant="outGray" small onClick={() => onCreate(term)}>+ Criar projeto</Btn>
    </div>
  );
}

function laneSubtotal(items) {
  const saved = items.reduce((s, g) => s + Number(g.atual || 0), 0);
  const target = items.reduce((s, g) => s + Number(g.meta || 0), 0);
  return `${fmt(saved)} / ${fmt(target)}`;
}

const EMPTY_FORM = { nome: "", desc: "", type: "emergency_fund", meta: "", deadline: "", prioridade: "media", monthly_target: "", annual_return_rate: "", term: "", status: "active" };

/** M1 — Projetos de Vida. Vive dentro do hub Planejamento (área "goals"). */
export function LifeProjectsPage({ organizationId = null, dataMode = "live", isMobile = false, onContribuir, initialMetas }) {
  const navigate = useNavigate();
  const urlSearch = useSearch({ strict: false });
  const live = shouldUseRealData(organizationId, dataMode);
  const goalsData = useGoalsData({ organizationId, enabled: live });
  const capacity = useEconomyCapacityData({ organizationId, months: 3, enabled: live });
  const isWide = useIsWide(1100);

  const [localGoals, setLocalGoals] = useState(() =>
    resolveLocalData({ dataMode, mockData: initialMetas !== undefined ? initialMetas : LIFE_PROJECTS_MOCK, emptyData: initialMetas ?? [] }),
  );
  const goals = live ? goalsData.goals : localGoals;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [projGoal, setProjGoal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function openCreate(term = "") {
    setEditing(null);
    setForm({ ...EMPTY_FORM, term });
    setModalOpen(true);
  }
  function openEdit(g) {
    setEditing(g);
    setForm({
      nome: g.nome, desc: g.desc || "", type: g.type || "other", meta: String(g.meta || ""),
      deadline: deadlineToMonthInput(g.deadline), prioridade: g.prioridade || "media",
      monthly_target: g.monthly_target ? String(g.monthly_target) : "",
      annual_return_rate: rateToPercentInput(g.annual_return_rate), term: g.termExplicit || "", status: g.status || "active",
    });
    setModalOpen(true);
  }

  // deep-link: ?add=1 abre o form
  useEffect(() => {
    if (urlSearch[FC.ADD] !== "1") return;
    openCreate();
    navigate({ replace: true, search: (prev) => { const n = { ...prev }; delete n[FC.ADD]; return n; } });
  }, [urlSearch[FC.ADD], navigate]);

  async function submit() {
    if (!form.nome.trim()) return;
    if (live) {
      try {
        if (editing) await goalsData.updateGoal(editing.id, buildUpdateGoalPayload(form));
        else await goalsData.createGoal({ ...buildCreateGoalPayload(form), organization_id: organizationId });
        setModalOpen(false);
      } catch { /* erro em goalsData.error */ }
    } else {
      // modo mock/empty: atualiza estado local
      const meta = Number(String(form.meta).replace(/\./g, "").replace(",", ".")) || 0;
      const next = {
        id: editing?.id || `local-${Date.now()}`, nome: form.nome, desc: form.desc, type: form.type,
        meta, atual: editing?.atual || 0, progress: editing ? editing.progress : 0,
        monthly_target: form.monthly_target ? Number(String(form.monthly_target).replace(/\./g, "").replace(",", ".")) : null,
        annual_return_rate: form.annual_return_rate ? Number(String(form.annual_return_rate).replace(",", ".")) / 100 : null,
        deadline: form.deadline ? `${form.deadline}-01` : null,
        prazo: form.deadline ? form.deadline.split("-").reverse().join("/") : "Sem prazo",
        term: form.term || "none", prioridade: form.prioridade,
      };
      setLocalGoals((cur) => (editing ? cur.map((g) => (g.id === editing.id ? next : g)) : [...cur, next]));
      setModalOpen(false);
    }
  }

  // hero
  const totalSaved = goals.reduce((s, g) => s + Number(g.atual || 0), 0);
  const totalTarget = goals.reduce((s, g) => s + Number(g.meta || 0), 0);
  const overallPct = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0;
  const totalMonthly = goals.reduce((s, g) => s + Number(g.monthly_target || 0), 0);
  const avgSurplus = live && capacity.data ? Number(capacity.data.avg_surplus) : null;
  const hasCap = avgSurplus != null && avgSurplus > 0 && totalMonthly > 0;
  const fits = hasCap ? totalMonthly <= avgSurplus : null;
  const usagePct = hasCap ? Math.min(100, (totalMonthly / avgSurplus) * 100) : 0;
  const diff = hasCap ? Math.abs(avgSurplus - totalMonthly) : 0;

  const byTerm = useMemo(() => {
    const groups = { short: [], medium: [], long: [], none: [] };
    for (const g of goals) (groups[g.term] || groups.none).push(g);
    for (const k of Object.keys(groups)) groups[k].sort((a, b) => priorityMeta(b.prioridade).n - priorityMeta(a.prioridade).n);
    return groups;
  }, [goals]);

  const isEmpty = goals.length === 0 && (!live || goalsData.hasLoaded);
  const verdictColor = fits === false ? T.amber : T.green;
  const verdictTint = fits === false ? T.amberLight : T.greenLight;

  return (
    <PageEnter>
      <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 6 }}>Planejamento · Objetivos</div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <PageTitle sans="Projetos de" serif="Vida" />
        <Btn variant="dark" onClick={() => openCreate()} small={isMobile}>+ Novo projeto</Btn>
      </div>

      {live && goalsData.error ? (
        <div style={{ ...G, fontSize: 12, color: T.red, background: T.redLight, borderRadius: 9, padding: "9px 12px", marginTop: 12 }}>{goalsData.error}</div>
      ) : null}

      {/* HERO — 2 cards */}
      <div style={{ display: "grid", gridTemplateColumns: isWide ? "1.1fr 1fr" : "1fr", gap: 14, marginTop: 14 }}>
        <Card style={{ background: T.ink, borderColor: T.ink, padding: 18, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ ...cap, color: "rgba(255,255,255,0.55)" }}>{isEmpty ? "Comece seus projetos de vida" : "Guardado no total"}</div>
          {isEmpty ? (
            <>
              <div style={{ ...G, fontSize: 15, fontWeight: 600, color: "#fff", marginTop: 6, lineHeight: 1.5 }}>Defina objetivos — reserva, viagem, casa, aposentadoria — e acompanhe o progresso mês a mês.</div>
              <button onClick={() => openCreate()} style={{ ...G, marginTop: 14, alignSelf: "flex-start", background: "#fff", color: T.ink, border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Criar primeiro projeto</button>
            </>
          ) : (
            <>
              <div style={{ ...G, ...NUM, fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff", marginTop: 4 }}>{fmt(totalSaved)}</div>
              <div style={{ ...G, fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 3 }}>de {fmt(totalTarget)} · {Math.round(overallPct)}% do objetivo</div>
              <div style={{ height: 8, borderRadius: 99, background: "rgba(255,255,255,0.15)", overflow: "hidden", marginTop: 12 }}><div style={{ width: `${overallPct}%`, height: "100%", borderRadius: 99, background: T.greenBar }} /></div>
            </>
          )}
        </Card>

        <Card style={{ padding: 18, display: "flex", flexDirection: "column", justifyContent: "center", background: hasCap ? verdictTint : T.surface, borderColor: hasCap ? (fits === false ? T.amberBorder : T.greenBorder) : T.border }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, display: "grid", placeItems: "center", fontSize: 16, background: hasCap ? "#fff" : T.grayLight, color: hasCap ? verdictColor : T.inkLight }}>{hasCap ? (fits === false ? "⚠" : "✓") : "ℹ️"}</div>
            <div>
              <div style={cap}>Aportes × Capacidade</div>
              <div style={{ ...G, fontSize: 11, fontWeight: 600, color: hasCap ? verdictColor : T.inkLight }}>{hasCap ? (fits === false ? "Aperta na sua sobra" : "Cabe na sua sobra") : "Aguardando dados"}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 24, marginTop: 11 }}>
            <div><div style={ghost}>Aporte planejado</div><div style={{ ...G, ...NUM, fontSize: 18, fontWeight: 800, marginTop: 2 }}>{totalMonthly ? `${fmt(totalMonthly)}` : "—"}</div></div>
            <div><div style={ghost}>Sobra média (M3)</div><div style={{ ...G, ...NUM, fontSize: 18, fontWeight: 800, marginTop: 2, color: avgSurplus != null ? verdictColor : T.inkGhost }}>{avgSurplus != null ? fmt(avgSurplus) : "—"}</div></div>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: hasCap ? "rgba(0,0,0,0.06)" : T.grayLight, overflow: "hidden", marginTop: 12 }}><div style={{ width: `${usagePct}%`, height: "100%", borderRadius: 99, background: hasCap ? verdictColor : T.greenBar }} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={ghost}>{hasCap ? (fits === false ? `excede ${fmt(diff)}/mês` : `folga ${fmt(diff)}/mês`) : "Defina lançamentos para comparar"}</span>
            {hasCap ? <span style={ghost}>usa {Math.round((totalMonthly / avgSurplus) * 100)}%</span> : null}
          </div>
        </Card>
      </div>

      {/* BOARD por prazo */}
      {isWide ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 16 }}>
          {TERMS.map((tm) => {
            const items = byTerm[tm.id];
            return (
              <div key={tm.id} style={{ background: T.grayLight, border: `1px solid ${T.border}`, borderRadius: 14, padding: 10, display: "flex", flexDirection: "column", gap: 9, minHeight: 150 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 4px 2px" }}>
                  <span style={{ width: 14, height: 3, borderRadius: 99, background: tm.color }} />
                  <span style={{ ...G, fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: tm.color }}>{tm.short}</span>
                  {items.length ? <span style={{ ...ghost, marginLeft: "auto" }}>{laneSubtotal(items)}</span> : null}
                </div>
                {items.length ? items.map((g) => <ProjectCard key={g.id} g={g} onEdit={openEdit} onContribuir={onContribuir} onProjection={setProjGoal} />) : <EmptyLane term={tm.id} onCreate={openCreate} />}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          {TERMS.map((tm) => {
            const items = byTerm[tm.id];
            return (
              <div key={tm.id} style={{ marginTop: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                  <span style={{ width: 16, height: 2, borderRadius: 99, background: tm.color }} />
                  <span style={{ ...G, fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: tm.color }}>{tm.label}</span>
                  <span style={{ ...ghost, marginLeft: "auto" }}>{items.length ? laneSubtotal(items) : "0"}</span>
                </div>
                {items.length ? <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>{items.map((g) => <ProjectCard key={g.id} g={g} onEdit={openEdit} onContribuir={onContribuir} onProjection={setProjGoal} />)}</div> : <EmptyLane term={tm.id} onCreate={openCreate} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Sem prazo */}
      {byTerm.none.length ? (
        <Card style={{ marginTop: 14, padding: "12px 14px" }}>
          <div style={{ ...G, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>🗓️ Sem prazo definido · {byTerm.none.length}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>{byTerm.none.map((g) => <ProjectCard key={g.id} g={g} onEdit={openEdit} onContribuir={onContribuir} onProjection={setProjGoal} />)}</div>
        </Card>
      ) : null}

      {modalOpen ? (
        <ProjectFormModal editing={editing} form={form} setF={setF} onClose={() => setModalOpen(false)} onSubmit={submit} isSaving={live && goalsData.isSaving} />
      ) : null}

      {projGoal ? (
        <GoalProjectionModal goal={projGoal} organizationId={organizationId} onClose={() => setProjGoal(null)} />
      ) : null}
    </PageEnter>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={{ ...G, fontSize: 11, fontWeight: 600, color: T.inkMid, display: "block", marginBottom: 5 }}>{label}</span>
      {children}
    </label>
  );
}
const inputStyle = { ...G, width: "100%", fontSize: 14, color: T.ink, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 9, padding: "9px 11px", outline: "none", boxSizing: "border-box" };

function ProjectFormModal({ editing, form, setF, onClose, onSubmit, isSaving }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: "100%", background: T.surface, borderRadius: 14, boxShadow: T.lg, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <PageTitle sans={editing ? "Editar" : "Novo"} serif="projeto" />
          <button onClick={onClose} aria-label="Fechar" style={{ border: "none", background: "none", cursor: "pointer", color: T.inkLight }}><X size={18} /></button>
        </div>

        <Field label="Nome"><input style={inputStyle} value={form.nome} onChange={(e) => setF("nome", e.target.value)} placeholder="ex: Reserva de emergência" /></Field>

        <Field label="Tipo">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {GOAL_TYPES.map((t) => {
              const on = form.type === t.id;
              return (
                <button key={t.id} onClick={() => setF("type", t.id)} style={{ ...G, fontSize: 12, fontWeight: 600, border: `1.5px solid ${on ? T.ink : T.border}`, background: on ? T.ink : "transparent", color: on ? "#fff" : T.inkMid, borderRadius: 9, padding: "6px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>{t.emoji} {t.label}</button>
              );
            })}
          </div>
        </Field>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}><Field label="Valor da meta (R$)"><input style={inputStyle} value={form.meta} onChange={(e) => setF("meta", e.target.value)} placeholder="30.000,00" inputMode="decimal" /></Field></div>
          <div style={{ flex: 1 }}><Field label="Prazo (mês/ano)"><input type="month" style={inputStyle} value={form.deadline} onChange={(e) => setF("deadline", e.target.value)} /></Field></div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}><Field label="Aporte mensal alvo (R$)"><input style={inputStyle} value={form.monthly_target} onChange={(e) => setF("monthly_target", e.target.value)} placeholder="1.000,00" inputMode="decimal" /></Field></div>
          {typeSupportsReturn(form.type) ? (
            <div style={{ flex: 1 }}><Field label="Rendimento esperado (% a.a.)"><input style={inputStyle} value={form.annual_return_rate} onChange={(e) => setF("annual_return_rate", e.target.value)} placeholder="10,5" inputMode="decimal" /></Field></div>
          ) : null}
        </div>

        <Field label="Prioridade">
          <div style={{ display: "flex", gap: 6 }}>
            {PRIORITIES.map((p) => {
              const on = form.prioridade === p.id;
              return (
                <button key={p.id} onClick={() => setF("prioridade", p.id)} style={{ ...G, flex: 1, fontSize: 12, fontWeight: 600, border: `1.5px solid ${on ? p.color : T.border}`, background: on ? p.tint : "transparent", color: on ? p.color : T.inkMid, borderRadius: 9, padding: "7px 8px", cursor: "pointer" }}>{p.label}</button>
              );
            })}
          </div>
        </Field>

        <Field label="Descrição (opcional)"><input style={inputStyle} value={form.desc} onChange={(e) => setF("desc", e.target.value)} placeholder="Detalhes do projeto" /></Field>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 6 }}>
          <Btn variant="outGray" onClick={onClose}>Cancelar</Btn>
          <Btn variant="dark" onClick={onSubmit}>{isSaving ? "Salvando…" : editing ? "Salvar" : "Criar projeto"}</Btn>
        </div>
      </div>
    </div>
  );
}
