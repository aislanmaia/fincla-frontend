import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { fmtAbs, fmtK } from "../../formatters";
import { M_MONO } from "../moodV4";

/**
 * Gráfico "Gasto mensal dos últimos 6 meses" do card de Orçamentos.
 * Segue o mesmo idioma visual dos demais gráficos do app (RitmoPage,
 * DashboardPage, CartoesTabs): CartesianGrid tracejado só horizontal,
 * eixos sem linha, tooltip escuro próprio, ReferenceLine para a média.
 */
export function BudgetHistoryChart({ historyData, isMobile, shouldUseRealData }) {
  const hasData = historyData.length > 0;

  if (!hasData) {
    return (
      <div style={{ ...G, fontSize: 12, color: T.inkMid, padding: "20px 0", textAlign: "center" }}>
        Ainda não há histórico suficiente para exibir o gráfico.
      </div>
    );
  }

  const hasBudgetData = historyData.some((h) => h.budget != null);
  const currentEntry = historyData.find((h) => h.current) || historyData[historyData.length - 1];
  const maxEntry = historyData.reduce((max, h) => (h.spent > max.spent ? h : max), historyData[0]);
  const avgSpent = historyData.reduce((s, h) => s + h.spent, 0) / historyData.length;
  const anyOver = historyData.some((h) => h.budget && h.spent > h.budget);
  const maxOver = Boolean(maxEntry.budget) && maxEntry.spent > maxEntry.budget;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <StatChip label="Mês atual" sub={currentEntry.m} value={fmtAbs(currentEntry.spent)} color={T.blue} />
        <StatChip label="Maior gasto" sub={maxEntry.m} value={fmtAbs(maxEntry.spent)} color={maxOver ? T.red : T.ink} />
        <StatChip label="Média do período" value={fmtAbs(avgSpent)} color={T.inkMid} />
      </div>

      <div style={{ height: isMobile ? 190 : 232 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={historyData}
            margin={{ top: 8, right: 8, left: isMobile ? -14 : -20, bottom: 0 }}
            barCategoryGap={isMobile ? "22%" : "30%"}
            barGap={4}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
            <XAxis
              dataKey="m"
              tick={{ ...G, fontSize: isMobile ? 11 : 12, fontWeight: 600, fill: T.inkLight }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ ...G, ...NUM, fontSize: 11, fill: T.inkLight }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtK}
            />
            <Tooltip content={<HistoryTooltip />} />
            <ReferenceLine
              y={avgSpent}
              stroke={`${T.blue}66`}
              strokeDasharray="4 3"
              label={
                isMobile
                  ? undefined
                  : {
                      value: `Média ${fmtK(avgSpent)}`,
                      position: "right",
                      fill: T.blue,
                      fontSize: 10,
                      fontWeight: 600,
                      fontFamily: "Geist,sans-serif",
                    }
              }
            />
            {hasBudgetData && <Bar dataKey="budget" fill={T.grayLight} radius={[5, 5, 0, 0]} maxBarSize={26} />}
            <Bar dataKey="spent" radius={[5, 5, 0, 0]} maxBarSize={hasBudgetData ? 26 : 34}>
              {historyData.map((h, i) => {
                const over = h.budget ? h.spent > h.budget : false;
                const fill = over ? T.red : h.current ? T.blue : T.ink;
                return <Cell key={h.m ?? i} fill={fill} fillOpacity={h.current || over ? 1 : 0.55} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
        {[
          !shouldUseRealData ? { bg: T.grayLight, border: true, label: "Limite" } : null,
          { bg: T.ink, opacity: 0.55, label: "Gasto" },
          { bg: T.blue, label: "Mês atual" },
          anyOver ? { bg: T.red, label: "Acima do limite" } : null,
        ]
          .filter(Boolean)
          .map((x, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 2,
                  background: x.bg,
                  opacity: x.opacity ?? 1,
                  border: x.border ? `1px solid ${T.border}` : undefined,
                }}
              />
              <span style={{ ...G, fontSize: 11, color: T.inkMid }}>{x.label}</span>
            </div>
          ))}
      </div>

      {shouldUseRealData && (
        <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 12, lineHeight: 1.5 }}>
          O backend ainda não expõe o limite histórico por mês — por isso mostramos apenas os gastos reais do período.
        </div>
      )}
    </div>
  );
}

function HistoryTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const over = d.budget ? d.spent > d.budget : false;
  return (
    <div style={{ ...G, background: T.ink, borderRadius: 10, padding: "10px 14px", boxShadow: T.dark, minWidth: 150 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "rgba(255,255,255,0.55)",
          marginBottom: 5,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
        {d.current ? " · mês atual" : ""}
      </div>
      <div style={{ ...M_MONO, ...NUM, fontSize: 15, fontWeight: 700, color: "#fff" }}>{fmtAbs(d.spent)}</div>
      {d.budget ? (
        <div style={{ fontSize: 10, color: over ? "#FCA5A5" : "#86efac", marginTop: 4 }}>
          {over ? `${fmtAbs(d.spent - d.budget)} acima do limite` : `${fmtAbs(d.budget - d.spent)} dentro do limite`}
        </div>
      ) : null}
    </div>
  );
}

function StatChip({ label, value, sub, color }) {
  return (
    <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 12px", flex: "1 1 140px", minWidth: 120 }}>
      <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ ...M_MONO, ...NUM, fontSize: 14, fontWeight: 700, color }}>{value}</div>
      {sub ? <div style={{ ...G, fontSize: 10, color: T.inkLight, marginTop: 1 }}>{sub}</div> : null}
    </div>
  );
}
