import React from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
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
import { fmtBRL0, fmtPct } from "./consultantFormat";

/**
 * Renderiza um `ChartSpec` produzido pela IA (Consultor IA — A1).
 *
 * O modelo **nunca gera imagens**: ele emite uma spec JSON (validada e
 * "grounded" no backend, via a tool `build_chart`) e o front desenha com
 * recharts. Por isso este componente é deliberadamente burro — não interpreta
 * números, não deriva séries, não recombina linhas. Qualquer inteligência aqui
 * seria lógica de negócio no frontend, fora do alcance do grounding validator.
 *
 * **A forma da spec é ditada por `fincla-api/src/application/ai/contracts.py`**
 * (`ChartSpec`), não pelo que seria conveniente aqui:
 *   type         line | bar | composed | donut   (conjunto fechado)
 *   series[]     { key, name, kind, color }      (`kind` só importa em `composed`)
 *   color        token do design system, nunca hex
 *   value_format brl0 | pct | int                (o FE é quem formata)
 *
 * Spec malformada não derruba o drawer: cai num aviso discreto.
 */

/** O modelo emite tokens; o mapa os traduz para a paleta ativa. */
const COLOR_TOKENS = {
  green: T.green,
  red: T.red,
  ink: T.ink,
  purple: T.purple,
  amber: T.amber,
  blue: T.blue,
};

/** Ordem de fallback das fatias do donut (uma série, N linhas). */
const DONUT_PALETTE = [T.purple, T.blue, T.green, T.amber, T.red, T.purpleBar];

const colorOf = (series) => COLOR_TOKENS[series?.color] ?? T.purple;

const FORMATTERS = {
  brl0: (v) => fmtBRL0(v),
  pct: (v) => fmtPct(v),
  int: (v) => (typeof v === "number" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : String(v)),
};

const formatterFor = (valueFormat) => FORMATTERS[valueFormat] ?? FORMATTERS.int;

const AXIS_TICK = { ...G, fontSize: 10, fill: T.inkLight };
const MARGIN = { top: 6, right: 6, left: -8, bottom: 0 };

/**
 * Gráfico de TENDÊNCIA? (linha/área — não barra/pizza).
 *
 * Barra e pizza codificam MAGNITUDE: o comprimento/ângulo é o dado, então têm de
 * partir do zero. Linha e área codificam a VARIAÇÃO ao longo do eixo x, e aí forçar
 * o zero achata a tendência (despesas de 4.730 a 4.970 viram uma reta colada no
 * topo). Um `composed` só conta como tendência se NENHUMA série é barra.
 */
export const isTrendChart = (type, series) =>
  type === "line" ||
  type === "area" ||
  (type === "composed" && series.every((s) => s.kind === "line" || s.kind === "area"));

/**
 * Janela do eixo Y para um gráfico de tendência: [min, max] das séries com folga,
 * revelando a inclinação em vez de esmagá-la contra o zero.
 *
 * Isto é escala de EXIBIÇÃO, não dado: os valores plotados não mudam, então nada
 * aqui escapa do grounding — só a moldura do eixo. `undefined` = deixa o default do
 * recharts (ancorado no zero), usado quando não há o que "dar zoom".
 */
export function trendYDomain(series, data) {
  const values = [];
  for (const row of data) {
    for (const s of series) {
      const v = row?.[s.key];
      if (typeof v === "number" && Number.isFinite(v)) values.push(v);
    }
  }
  if (values.length < 2) return undefined;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return undefined; // série plana: nada a revelar
  const pad = (max - min) * 0.18;
  const lo = min - pad;
  // Não cruza o zero à toa: se o dado é todo positivo e a folga furaria o zero,
  // ancora no zero — aí a magnitude volta a fazer sentido.
  return [lo < 0 && min >= 0 ? 0 : lo, max + pad];
}

function AiTooltip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null;
  const fmt = formatterFor(format);
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, padding: "9px 11px", boxShadow: "0 8px 24px rgba(15,23,35,0.12)" }}>
      {label !== undefined && (
        <div style={{ ...G, fontSize: 11, fontWeight: 800, color: T.ink, marginBottom: 6 }}>{label}</div>
      )}
      {payload.map((p) => (
        <div key={p.dataKey ?? p.name} style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
          <span style={{ ...G, fontSize: 11, color: T.inkLight }}>{p.name}</span>
          <span style={{ ...G, ...NUM, fontSize: 11.5, fontWeight: 700, color: p.color || T.ink }}>
            {typeof p.value === "number" ? fmt(p.value) : String(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

const isValidSpec = (spec) =>
  !!spec &&
  typeof spec.type === "string" &&
  !!spec.x?.key &&
  Array.isArray(spec.series) &&
  spec.series.length > 0 &&
  Array.isArray(spec.data) &&
  spec.data.length > 0;

export function AiChart({ spec, height = 220 }) {
  if (!isValidSpec(spec)) {
    return (
      <div style={{ ...G, fontSize: 12, color: T.inkLight, padding: "12px 0" }}>Gráfico indisponível.</div>
    );
  }

  const { type, title, x, series, data, value_format: valueFormat } = spec;
  const fmt = formatterFor(valueFormat);
  const tooltip = <Tooltip content={<AiTooltip format={valueFormat} />} cursor={{ fill: `${T.ink}08` }} />;
  const legend = <Legend wrapperStyle={{ ...G, fontSize: 11 }} iconType="circle" iconSize={7} />;

  // Só gráficos de tendência ganham janela [min,max]; barra/composed-com-barra
  // ficam no default (zero). `undefined` → recharts usa o default (ancorado no zero).
  const yDomain = isTrendChart(type, series) ? trendYDomain(series, data) : undefined;

  const cartesianAxes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
      <XAxis dataKey={x.key} tick={AXIS_TICK} axisLine={false} tickLine={false} />
      <YAxis domain={yDomain} tick={AXIS_TICK} axisLine={false} tickLine={false} width={54} tickFormatter={fmt} />
      {tooltip}
      {series.length > 1 && legend}
    </>
  );

  /** Uma série vira Bar/Line/Area conforme `kind` — o que dá sentido ao `composed`. */
  // `key` vai direto no JSX, nunca no spread: espalhá-la faz o React avisar e
  // não a trata como chave de reconciliação.
  const renderSeries = (s) => {
    const common = { dataKey: s.key, name: s.name || s.key };
    if (s.kind === "line") {
      return <Line key={s.key} {...common} type="monotone" stroke={colorOf(s)} strokeWidth={2} dot={false} />;
    }
    if (s.kind === "area") {
      return (
        <Area key={s.key} {...common} type="monotone" stroke={colorOf(s)}
          fill={colorOf(s)} fillOpacity={0.15} strokeWidth={2} />
      );
    }
    return <Bar key={s.key} {...common} fill={colorOf(s)} radius={[3, 3, 0, 0]} maxBarSize={22} />;
  };

  let chart;
  if (type === "donut") {
    // Donut usa uma série só; cada fatia recebe a cor pelo índice da linha.
    const valueKey = series[0].key;
    chart = (
      <PieChart margin={MARGIN}>
        <Tooltip content={<AiTooltip format={valueFormat} />} />
        <Pie data={data} dataKey={valueKey} nameKey={x.key} innerRadius="55%" outerRadius="80%" paddingAngle={2}>
          {data.map((row, i) => (
            <Cell key={row[x.key] ?? i} fill={DONUT_PALETTE[i % DONUT_PALETTE.length]} />
          ))}
        </Pie>
        {legend}
      </PieChart>
    );
  } else if (type === "line") {
    chart = (
      <LineChart data={data} margin={MARGIN}>
        {cartesianAxes}
        {series.map((s) => renderSeries({ ...s, kind: "line" }))}
      </LineChart>
    );
  } else if (type === "bar") {
    chart = (
      <ComposedChart data={data} margin={MARGIN}>
        {cartesianAxes}
        {series.map((s) => renderSeries({ ...s, kind: "bar" }))}
      </ComposedChart>
    );
  } else {
    // `composed` (e qualquer tipo futuro desconhecido): cada série honra seu `kind`.
    chart = (
      <ComposedChart data={data} margin={MARGIN}>
        {cartesianAxes}
        {series.map(renderSeries)}
      </ComposedChart>
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
