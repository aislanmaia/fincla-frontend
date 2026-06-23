import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Btn } from "../../components/primitives";
import { getGoalProjection } from "../../../api/goals";
import { goalTypeMeta } from "./goalMeta.js";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (v) => brl.format(Number(v || 0));
const cap = { ...G, fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: T.inkLight };
const ghost = { ...G, fontSize: 11, color: T.inkGhost };

function monthsUntil(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  return Math.max(0, (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth()));
}

function Chart({ series, target, monthsToDeadline, color }) {
  if (!series || series.length < 2) return null;
  const W = 300;
  const H = 86;
  const pad = 6;
  const n = series.length - 1;
  const maxY = Math.max(target, series[series.length - 1], 1);
  const pts = series.map((v, idx) => `${((idx / n) * W).toFixed(1)},${(H - (v / maxY) * (H - pad)).toFixed(1)}`).join(" ");
  const targetY = (H - (target / maxY) * (H - pad)).toFixed(1);
  const dlX = monthsToDeadline != null && monthsToDeadline <= n ? ((monthsToDeadline / n) * W).toFixed(1) : null;
  const last = pts.split(" ").pop().split(",");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="86" preserveAspectRatio="none" style={{ display: "block" }}>
      <line x1="0" y1={targetY} x2={W} y2={targetY} stroke={T.inkGhost} strokeWidth="1" strokeDasharray="4 4" />
      {dlX != null ? <line x1={dlX} y1="4" x2={dlX} y2={H - 2} stroke={T.amber} strokeWidth="1" strokeDasharray="3 3" /> : null}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill={color} />
    </svg>
  );
}

/** M4 — modal de projeção de conclusão de uma meta (grátis). */
export function GoalProjectionModal({ goal, organizationId, onClose }) {
  const [state, setState] = useState({ loading: true, error: "", data: null });

  useEffect(() => {
    if (!goal || !organizationId) return undefined;
    let cancelled = false;
    setState({ loading: true, error: "", data: null });
    getGoalProjection(organizationId, goal.id)
      .then((res) => {
        if (!cancelled) setState({ loading: false, error: "", data: res });
      })
      .catch((e) => {
        if (!cancelled) setState({ loading: false, error: e?.message || "Erro ao projetar.", data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [goal, organizationId]);

  if (!goal) return null;
  const meta = goalTypeMeta(goal.type);
  const data = state.data;
  const sum = data?.summary;
  const late = sum && sum.on_track === false;
  const reached = sum && sum.months_to_target != null;
  const verdictColor = late ? T.amber : T.green;
  const monthsToDeadline = monthsUntil(goal.deadline);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: "100%", background: T.surface, borderRadius: 16, boxShadow: T.lg, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", fontSize: 19, background: meta.tint }}>{meta.emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...G, fontWeight: 800, fontSize: 16 }}>{goal.nome}</div>
            <div style={ghost}>Projeção · {Math.round(goal.progress)}% · {fmt(goal.atual)} / {fmt(goal.meta)}{goal.prazo && goal.prazo !== "Sem prazo" ? ` · prazo ${goal.prazo}` : ""}</div>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ border: "none", background: "none", cursor: "pointer", color: T.inkLight }}><X size={18} /></button>
        </div>

        {state.loading ? (
          <div style={{ ...G, fontSize: 13, color: T.inkLight, padding: "28px 4px", textAlign: "center" }}>Calculando projeção…</div>
        ) : state.error ? (
          <div style={{ ...G, fontSize: 12, color: T.red, background: T.redLight, borderRadius: 9, padding: "9px 12px", marginTop: 14 }}>{state.error}</div>
        ) : data ? (
          <>
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 11, padding: "12px 13px", marginTop: 13 }}>
              <Chart series={data.series} target={goal.meta} monthsToDeadline={monthsToDeadline} color={verdictColor} />
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 6, ...ghost }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 16, borderTop: `2px solid ${verdictColor}` }} />ritmo atual</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 16, borderTop: `2px dashed ${T.inkGhost}` }} />meta</span>
                {monthsToDeadline != null ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 16, borderTop: `2px dashed ${T.amber}` }} />prazo</span> : null}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 13, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 180px", border: `1px solid ${T.border}`, borderRadius: 11, padding: "12px 13px" }}>
                <div style={cap}>No ritmo atual</div>
                <div style={{ ...G, ...NUM, fontWeight: 800, fontSize: 18, marginTop: 2 }}>{reached ? sum.completion_date && new Date(`${sum.completion_date}T00:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }) : "não atinge"}</div>
                {reached && sum.on_track != null ? (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ ...G, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, borderRadius: 9999, padding: "2px 8px", color: verdictColor, background: late ? T.amberLight : T.greenLight }}>
                      {late ? `✕ ${sum.months_vs_deadline} meses após o prazo` : "✓ dentro do prazo"}
                    </span>
                  </div>
                ) : null}
                <div style={{ ...ghost, marginTop: 6 }}>{fmt(data.monthly_contribution)}/mês{data.annual_return_rate ? ` · ${(data.annual_return_rate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% a.a.` : " · sem rendimento"}</div>
              </div>

              {data.required_monthly != null && goal.deadline ? (
                <div style={{ flex: "1 1 180px", border: "1px solid #A7F3D0", background: T.greenLight, borderRadius: 11, padding: "12px 13px" }}>
                  <div style={cap}>Para bater {goal.prazo}</div>
                  <div style={{ ...G, ...NUM, fontWeight: 800, fontSize: 18, marginTop: 2, color: T.green }}>{fmt(data.required_monthly)}/mês</div>
                  {data.required_monthly > data.monthly_contribution ? (
                    <div style={{ ...ghost, marginTop: 6, color: T.green }}>+{fmt(data.required_monthly - data.monthly_contribution)}/mês a mais</div>
                  ) : (
                    <div style={{ ...ghost, marginTop: 6, color: T.green }}>seu aporte já é suficiente</div>
                  )}
                </div>
              ) : null}
            </div>

            <div style={{ ...ghost, marginTop: 12 }}>Projeção estimada; aportes e rendimento podem variar.</div>
          </>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <Btn variant="dark" onClick={onClose}>Fechar</Btn>
        </div>
      </div>
    </div>
  );
}
