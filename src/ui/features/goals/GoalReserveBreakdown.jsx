import React from "react";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { formatMoney } from "../../money/formatMoney.js";

const fmt = (v, moeda) => formatMoney(Number(v || 0), moeda) ?? "";

/**
 * A divisão do saldo da Visão Geral quando há dinheiro reservado nas metas: o que dá
 * para gastar, o que está prometido e para quais metas — e a sugestão de gastar só o
 * disponível (Owner, 2026-11-05). Sem reserva, nada aparece.
 */
export function GoalReserveBreakdown({ view }) {
  if (!view) return null;
  const { currency, total, reserved, free, goals, goalCount, elsewhere } = view;
  const pctFree = total > 0 ? Math.max(0, Math.min(100, (free / total) * 100)) : 0;
  const metas = goalCount === 1 ? "1 meta" : `${goalCount} metas`;
  return (
    <div data-testid="goal-reserve-breakdown" style={{ ...G, marginTop: 10, maxWidth: 420 }}>
      <div aria-hidden="true" style={{ height: 8, borderRadius: 99, background: T.grayLight, display: "flex", overflow: "hidden", gap: 2 }}>
        <i style={{ display: "block", width: `${pctFree}%`, background: T.green }} />
        <i style={{ display: "block", flex: 1, background: T.amberBar }} />
      </div>
      <div style={{ display: "grid", gap: 4, marginTop: 8, fontSize: 12, ...NUM }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ color: T.inkMid }}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: T.green, marginRight: 7 }} />Disponível</span>
          <span style={{ color: free < 0 ? T.red : T.ink, fontWeight: 600 }}>{fmt(free, currency)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ color: T.inkMid }}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: T.amberBar, marginRight: 7 }} />Reservado em {metas}</span>
          <span style={{ color: T.ink, fontWeight: 600 }}>{fmt(reserved, currency)}</span>
        </div>
        {goals.slice(0, 3).map((g) => (
          <div key={g.goal_id} style={{ display: "flex", justifyContent: "space-between", gap: 12, color: T.inkLight, paddingLeft: 16 }}>
            <span>{g.name}</span>
            <span>{fmt(g.amount, currency)}</span>
          </div>
        ))}
        {goals.length > 3 ? <div style={{ color: T.inkLight, paddingLeft: 16 }}>e mais {goals.length - 3}</div> : null}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: free < 0 ? T.red : T.green }}>
        {free < 0
          ? `Você já está usando ${fmt(-free, currency)} do dinheiro das metas.`
          : `Gaste até ${fmt(free, currency)} sem mexer nas suas metas.`}
      </div>
      {elsewhere.length ? (
        <div style={{ marginTop: 4, fontSize: 11, color: T.inkLight }}>
          Também reservado em outra moeda: {elsewhere.map((e) => fmt(e.amount, e.currency)).join(" · ")}
        </div>
      ) : null}
    </div>
  );
}
