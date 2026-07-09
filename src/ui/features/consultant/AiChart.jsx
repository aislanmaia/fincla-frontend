import React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";

/**
 * Paleta default das séries, na ordem. O `ChartSpec` pode fixar `series[].color`;
 * quando não fixa, caímos aqui — assim dois gráficos da mesma avaliação não saem
 * com cores conflitantes.
 */
const SERIES_PALETTE = [T.purple, T.blue, T.green, T.amber, T.red, T.purpleBar];

const colorFor = (series, index) => series.color || SERIES_PALETTE[index % SERIES_PALETTE.length];

const AXIS_TICK = { ...G, fontSize: 10, fill: T.inkLight };

/** Tooltip no mesmo visual dos gráficos do Insights (superfície + sombra). */
function AiTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 9,
        padding: "9px 11px",
        boxShadow: "0 8px 24px rgba(15,23,35,0.12)",
      }}
    >
      {label !== undefined && (
        <div style={{ ...G, fontSize: 11, fontWeight: 800, color: T.ink, marginBottom: 6 }}>{label}</div>
      )}
      {payload.map((p) => (
        <div key={p.dataKey ?? p.name} style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
          <span style={{ ...G, fontSize: 11, color: T.inkLight }}>{p.name}</span>
          <span style={{ ...G, ...NUM, fontSize: 11.5, fontWeight: 700, color: p.color || T.ink }}>
            {typeof p.value === "number" ? p.value.toLocaleString("pt-BR") : String(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Renderiza um `ChartSpec` produzido pela IA (Consultor IA — A1).
 *
 * O modelo **nunca gera imagens**: ele emite uma spec JSON (validada e
 * "grounded" no backend, via a tool `build_chart`) e o front desenha com
 * recharts, a mesma lib do resto do app. Por isso este componente é
 * deliberadamente burro — não interpreta números, não deriva séries, não
 * recombina linhas. Qualquer inteligência aqui seria lógica de negócio no
 * frontend, e sairia do alcance do grounding validator do backend.
 *
 * Spec malformada não quebra o drawer: cai num aviso discreto.
 */
export function AiChart({ spec, height = 220 }) {
  const invalid =
    !spec ||
    !spec.type ||
    !spec.x?.key ||
    !Array.isArray(spec.series) ||
    spec.series.length === 0 ||
    !Array.isArray(spec.data) ||
    spec.data.length === 0;

  if (invalid) {
    return (
      <div style={{ ...G, fontSize: 12, color: T.inkLight, padding: "12px 0" }}>
        Gráfico indisponível.
      </div>
    );
  }

  const { type, title, x, series, data } = spec;
  const multi = series.length > 1;

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
      <XAxis dataKey={x.key} tick={AXIS_TICK} axisLine={false} tickLine={false} />
      <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={54} />
      <Tooltip content={<AiTooltip />} cursor={{ fill: `${T.ink}08` }} />
      {multi && <Legend wrapperStyle={{ ...G, fontSize: 11 }} iconType="circle" iconSize={7} />}
    </>
  );

  const margin = { top: 6, right: 6, left: -8, bottom: 0 };

  let chart;
  if (type === "pie") {
    // Pizza usa uma série só; cada fatia recebe a cor pelo índice da linha.
    const valueKey = series[0].key;
    chart = (
      <PieChart margin={margin}>
        <Tooltip content={<AiTooltip />} />
        <Pie data={data} dataKey={valueKey} nameKey={x.key} innerRadius="55%" outerRadius="80%" paddingAngle={2}>
          {data.map((row, i) => (
            <Cell key={row[x.key] ?? i} fill={SERIES_PALETTE[i % SERIES_PALETTE.length]} />
          ))}
        </Pie>
        <Legend wrapperStyle={{ ...G, fontSize: 11 }} iconType="circle" iconSize={7} />
      </PieChart>
    );
  } else if (type === "line") {
    chart = (
      <LineChart data={data} margin={margin}>
        {axes}
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label || s.key}
            stroke={colorFor(s, i)} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    );
  } else if (type === "area") {
    chart = (
      <AreaChart data={data} margin={margin}>
        {axes}
        {series.map((s, i) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.label || s.key}
            stroke={colorFor(s, i)} fill={colorFor(s, i)} fillOpacity={0.15} strokeWidth={2} />
        ))}
      </AreaChart>
    );
  } else {
    chart = (
      <BarChart data={data} margin={margin}>
        {axes}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label || s.key}
            fill={colorFor(s, i)} radius={[3, 3, 0, 0]} maxBarSize={22} />
        ))}
      </BarChart>
    );
  }

  return (
    <div>
      {title && (
        <div style={{ ...G, fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 10 }}>{title}</div>
      )}
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer>
      </div>
    </div>
  );
}
