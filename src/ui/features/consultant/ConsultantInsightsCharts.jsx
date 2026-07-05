import React from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { fmtBRL0 } from "./consultantFormat";

/** Cabeçalho compartilhado dos cards de gráfico do Insights. */
function ChartHeader({ title, subtitle }) {
  return (
    <>
      <div style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink, marginBottom: 4 }}>{title}</div>
      {subtitle && <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 16 }}>{subtitle}</div>}
    </>
  );
}

function EmptyChart({ text }) {
  return <div style={{ ...G, fontSize: 12, color: T.inkLight, padding: "12px 0" }}>{text}</div>;
}

function CashFlowTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const row = (name, value, color) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
      <span style={{ ...G, fontSize: 11, color: T.inkLight }}>{name}</span>
      <span style={{ ...G, ...NUM, fontSize: 11.5, fontWeight: 700, color }}>{fmtBRL0(value)}</span>
    </div>
  );
  const byKey = Object.fromEntries(payload.map((p) => [p.dataKey, p.value]));
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, padding: "9px 11px", boxShadow: "0 8px 24px rgba(15,23,35,0.12)" }}>
      <div style={{ ...G, fontSize: 11, fontWeight: 800, color: T.ink, marginBottom: 6 }}>{label}</div>
      {row("Receita", byKey.income ?? 0, T.green)}
      {row("Despesa", byKey.expenses ?? 0, T.red)}
      {row("Saldo", byKey.balance ?? 0, byKey.balance >= 0 ? T.ink : T.red)}
    </div>
  );
}

/**
 * "Fluxo da base" — receita (barra verde) × despesa (barra vermelha) + saldo
 * (linha) mês a mês de toda a carteira. Consome a série pura de
 * `selectCashFlowSeries` (`/consultant/cash-flow`). Recharts (mesma lib do app).
 */
export function CashFlowChart({ data, loading }) {
  return (
    <Card style={{ padding: 18 }}>
      <ChartHeader title="Fluxo da base" subtitle="Receita × despesa e saldo, mês a mês (toda a carteira)" />
      {data.length ? (
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
              <XAxis dataKey="month" tick={{ ...G, fontSize: 10, fill: T.inkLight }} axisLine={false} tickLine={false} />
              <YAxis tick={{ ...G, fontSize: 10, fill: T.inkLight }} axisLine={false} tickLine={false} width={54} tickFormatter={(v) => fmtBRL0(v)} />
              <Tooltip content={<CashFlowTooltip />} cursor={{ fill: `${T.ink}08` }} />
              <Bar dataKey="income" name="Receita" fill={T.green} radius={[3, 3, 0, 0]} maxBarSize={22} />
              <Bar dataKey="expenses" name="Despesa" fill={T.red} radius={[3, 3, 0, 0]} maxBarSize={22} />
              <Line dataKey="balance" name="Saldo" type="monotone" stroke={T.ink} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyChart text={loading ? "Carregando fluxo…" : "Sem fluxo agregado no período."} />
      )}
    </Card>
  );
}

function CommitmentTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 11px", boxShadow: "0 8px 24px rgba(15,23,35,0.12)" }}>
      <div style={{ ...G, fontSize: 11, fontWeight: 800, color: T.ink, marginBottom: 3 }}>{label}</div>
      <span style={{ ...G, ...NUM, fontSize: 11.5, fontWeight: 700, color: T.purple }}>{payload[0].value}% da renda</span>
    </div>
  );
}

/**
 * "Comprometimento de renda" — % da renda da base comprometido com faturas de
 * cartão, mês a mês. Consome a série pura de `selectIncomeCommitmentSeries`
 * (`/consultant/income-commitment`).
 */
export function IncomeCommitmentChart({ data, loading }) {
  return (
    <Card style={{ padding: 18 }}>
      <ChartHeader title="Comprometimento de renda" subtitle="% da renda da base comprometido com cartões" />
      {data.length ? (
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
              <XAxis dataKey="month" tick={{ ...G, fontSize: 10, fill: T.inkLight }} axisLine={false} tickLine={false} />
              <YAxis tick={{ ...G, fontSize: 10, fill: T.inkLight }} axisLine={false} tickLine={false} width={38} domain={[0, (dataMax) => Math.max(100, Math.ceil(dataMax))]} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<CommitmentTooltip />} cursor={{ stroke: T.border }} />
              <Line dataKey="pct" name="Comprometimento" type="monotone" stroke={T.purple} strokeWidth={2.5} dot={{ r: 2.5, fill: T.purple }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyChart text={loading ? "Carregando…" : "Sem dado de comprometimento no período."} />
      )}
    </Card>
  );
}
