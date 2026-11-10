import React from "react";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { formatMoney } from "../../money/formatMoney.js";
import { freeShare } from "./goalReserve.js";

const fmt = (v, moeda) => formatMoney(Number(v || 0), moeda) ?? "";

/**
 * A divisão do saldo da Visão Geral quando há dinheiro reservado nas metas: o que dá
 * para gastar, o que está prometido e para quais metas — e a sugestão de gastar só o
 * disponível (Owner, 2026-11-05). Sem reserva, nada aparece.
 */
/** A barra livre × reservado — a mesma no modal de aporte e na Visão Geral. */
export function ReserveBar({ total, free }) {
  return (
    <div aria-hidden="true" style={{ height: 8, borderRadius: 99, background: T.grayLight, display: "flex", overflow: "hidden", gap: 2 }}>
      <i style={{ display: "block", width: `${freeShare(total, free)}%`, background: T.green }} />
      <i style={{ display: "block", flex: 1, background: T.amberBar }} />
    </div>
  );
}

/**
 * The line under the breakdown. The goals' money is at most what is reserved: when the
 * total itself is already negative, all of it is spent and the rest is the account in
 * the red — never "using R$ 2.155 of the goals" with R$ 150 reserved.
 */
function overdraftMessage({ currency, total, reserved, free }) {
  if (free >= 0) return `Gaste até ${fmt(free, currency)} sem mexer nas suas metas.`;
  if (total < 0) {
    return `Você já usou todo o dinheiro das metas (${fmt(reserved, currency)}) e está ${fmt(-total, currency)} no negativo.`;
  }
  return `Você já está usando ${fmt(-free, currency)} do dinheiro das metas.`;
}

export function GoalReserveBreakdown({ view }) {
  if (!view) return null;
  const { currency, total, reserved, free, goals, goalCount } = view;
  const metas = goalCount === 1 ? "1 meta" : `${goalCount} metas`;
  return (
    <div data-testid="goal-reserve-breakdown" style={{ ...G, marginTop: 10, maxWidth: 420 }}>
      <ReserveBar total={total} free={free} />
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
            <span>{fmt(g.amount, g.currency)}</span>
          </div>
        ))}
        {goals.length > 3 ? <div style={{ color: T.inkLight, paddingLeft: 16 }}>e mais {goals.length - 3}</div> : null}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: free < 0 ? T.red : T.green }}>
        {overdraftMessage(view)}
      </div>
    </div>
  );
}
