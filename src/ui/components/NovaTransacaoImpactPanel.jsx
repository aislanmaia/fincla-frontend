import React from "react";
import { Info } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { T } from "../tokens";
import { G, NUM } from "../typography";
import { ProgBar } from "./primitives";
import { CategoryLucideIcon } from "./CategoryLucideIcon.jsx";

const TOOLTIP_SHORT = {
  real: "Salvo (mês)",
  proj: "Projeção",
};

/**
 * Tooltip compacto: o padrão do Recharts com nomes longos nas séries estica a caixa
 * e cobre o gráfico inteiro; aqui limitamos largura e usamos rótulos curtos.
 */
function ImpactLineChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter(
    (p) => p.value != null && typeof p.value === "number",
  );
  if (rows.length === 0) return null;
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.97)",
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: "5px 8px 6px",
        fontSize: 10,
        lineHeight: 1.35,
        boxShadow: "0 2px 10px rgba(15,23,42,0.08)",
        maxWidth: 172,
        width: "max-content",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          ...G,
          fontWeight: 700,
          fontSize: 9,
          color: T.inkMid,
          marginBottom: 4,
          letterSpacing: "0.02em",
        }}
      >
        Dia {label}
      </div>
      {rows.map((p, i) => {
        const key = p.dataKey ?? p.name;
        const short =
          (typeof key === "string" && TOOLTIP_SHORT[key]) || p.name || key;
        return (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "7px 1fr auto",
              alignItems: "center",
              gap: "4px 6px",
              marginTop: i === 0 ? 0 : 3,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 99,
                background: p.color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                ...G,
                color: T.inkMid,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {short}
            </span>
            <span style={{ ...G, ...NUM, fontWeight: 700, color: T.ink }}>
              {`R$ ${p.value.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Bloco “Impacto financeiro” alimentado por GET spending-by-day + POST preview-transaction.
 */
export function NovaTransacaoImpactPanel({
  impactLive,
  financialImpact,
  impactKpis,
  valorNum,
  modalCategoryChoices,
  cat,
  chartHeight = 72,
  marginBottom = 12,
  kpiValSize = 14,
  kpiTitleSize = 8,
  categoryNumSize = 11,
}) {
  const {
    chartData,
    refLineDay,
    showProjLine,
    previewLoading,
    previewError,
    spendingLoading,
    spendingError,
  } = financialImpact;

  if (!impactLive) {
    return (
      <div style={{ padding: "8px 0" }}>
        <p
          style={{
            ...G,
            fontSize: 11,
            color: T.inkLight,
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          Orçamento e ritmo diário vêm da API ao usar dados reais da organização, em
          transação única (sem recorrência neste lançamento).
        </p>
      </div>
    );
  }

  const iconKey =
    impactKpis.catIconKey ??
    modalCategoryChoices.find((r) => r.labelPt === cat)?.iconKey;

  const kpiColor = (label) => {
    if (label === "MARGEM RESTANTE") return T.ink;
    return T.red;
  };

  const loadKpi = previewLoading && valorNum > 0;
  const kpis = [
    {
      label: "APÓS LANÇAMENTO",
      val: loadKpi ? "…" : impactKpis.afterVal,
      sub: loadKpi ? "…" : impactKpis.afterSub,
      key: "after",
    },
    {
      label: "PROJEÇÃO FIM MÊS",
      val: loadKpi ? "…" : impactKpis.projVal,
      sub: loadKpi ? "…" : impactKpis.projSub,
      explain: loadKpi ? "" : impactKpis.projExplain,
      key: "proj",
    },
    {
      label: "MARGEM RESTANTE",
      val: loadKpi ? "…" : impactKpis.marginVal,
      sub: loadKpi ? "…" : impactKpis.marginSub,
      key: "margin",
    },
  ];

  return (
    <>
      {spendingLoading && chartData.length === 0 ? (
        <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 8 }}>
          Carregando ritmo do mês…
        </div>
      ) : chartData.length === 0 ? (
        <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 8 }}>
          Sem dados de ritmo neste período.
        </div>
      ) : (
        <div style={{ height: chartHeight, margin: "0 0 12px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 6, right: 8, left: 4, bottom: 2 }}
            >
              <XAxis
                dataKey="day"
                type="number"
                domain={[
                  1,
                  chartData.length
                    ? chartData[chartData.length - 1].day
                    : 1,
                ]}
                hide
              />
              <YAxis hide domain={[0, "auto"]} />
              <Tooltip
                offset={10}
                wrapperStyle={{ maxWidth: 180, outline: "none" }}
                cursor={{
                  stroke: T.inkGhost,
                  strokeWidth: 1,
                  strokeDasharray: "4 3",
                }}
                content={ImpactLineChartTooltip}
              />
              {refLineDay != null &&
                chartData.some((r) => r.day >= refLineDay) && (
                  <ReferenceLine
                    x={refLineDay}
                    stroke={T.inkGhost}
                    strokeWidth={1}
                  />
                )}
              <Line
                type="monotone"
                dataKey="real"
                name="Já gasto no mês (salvo)"
                stroke={T.ink}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
              {showProjLine && (
                <Line
                  type="monotone"
                  dataKey="proj"
                  name="Ritmo até fim do mês (estim.)"
                  stroke={T.inkGhost}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {chartData.length > 0 ? (
        <div style={{ ...G, fontSize: 9, color: T.inkLight, margin: "-8px 0 10px", lineHeight: 1.45 }}>
          <strong style={{ fontWeight: 700, color: T.inkMid }}>Linha escura:</strong> só soma de transações{" "}
          <strong>já registradas</strong> no mês — o valor do rascunho não entra aqui. Os cards abaixo sim
          incluem o preview.
          {showProjLine ? (
            <>
              {" "}
              <strong style={{ fontWeight: 700, color: T.inkMid }}>Tracejado:</strong> reta até a projeção
              fim de mês (ritmo da categoria), não é o lançamento “copiado” para cada dia.
            </>
          ) : null}
        </div>
      ) : null}
      {spendingError ? (
        <div style={{ ...G, fontSize: 10, color: T.red, marginBottom: 8 }}>{spendingError}</div>
      ) : null}
      {previewError ? (
        <div style={{ ...G, fontSize: 10, color: T.red, marginBottom: 8 }}>{previewError}</div>
      ) : null}
      {!(valorNum > 0) && !previewLoading ? (
        <div style={{ ...G, fontSize: 10, color: T.inkLight, marginBottom: 8 }}>
          Informe um valor &gt; 0 para calcular o preview de orçamento.
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          marginBottom,
        }}
      >
        {kpis.map((k) => (
          <div key={k.key}>
            <div
              style={{
                ...G,
                fontSize: kpiTitleSize,
                fontWeight: 700,
                color: T.inkLight,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: 3,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span style={{ lineHeight: 1.2 }}>{k.label}</span>
              {k.explain ? (
                <span
                  role="img"
                  aria-label={k.explain}
                  title={k.explain}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    cursor: "help",
                    flexShrink: 0,
                  }}
                >
                  <Info size={Math.max(11, kpiTitleSize + 1)} color={T.inkLight} strokeWidth={2.2} />
                </span>
              ) : null}
            </div>
            <div
              style={{
                ...G,
                ...NUM,
                fontSize: kpiValSize,
                fontWeight: 800,
                color: kpiColor(k.label),
              }}
            >
              {k.val}
            </div>
            <div style={{ ...G, fontSize: 10, color: T.inkMid, marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {loadKpi ? (
          <span style={{ ...G, fontSize: 11, color: T.inkLight }}>Categoria…</span>
        ) : (
          <>
            <CategoryLucideIcon
              iconKey={iconKey}
              labelPt={impactKpis.displayCat || cat || ""}
              size={categoryNumSize >= 12 ? 14 : 13}
              color={T.ink}
            />
            <span
              style={{
                ...G,
                fontSize: categoryNumSize >= 12 ? 12 : 12,
                fontWeight: 600,
                color: T.ink,
              }}
            >
              {impactKpis.displayCat || cat || "—"}
            </span>
            <div style={{ flex: 1 }}>
              {impactKpis.catHasBudget ? (
                <ProgBar
                  pct={impactKpis.catPct}
                  color={impactKpis.catOverBudget ? T.redBar : T.greenBar}
                  h={4}
                />
              ) : (
                <div style={{ ...G, fontSize: 10, color: T.inkLight }}>
                  Sem orçamento para esta categoria
                </div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ ...G, ...NUM, fontSize: categoryNumSize, color: T.inkLight }}>
                {fmtCat(impactKpis.catBefore)} →{" "}
              </span>
              <span
                style={{
                  ...G,
                  ...NUM,
                  fontSize: categoryNumSize,
                  fontWeight: 700,
                  color: impactKpis.catOverBudget ? T.red : T.ink,
                }}
              >
                {fmtCat(impactKpis.catAfter)}
              </span>
              <div style={{ ...G, fontSize: categoryNumSize - 1, color: T.inkMid }}>
                {impactKpis.catLimit != null
                  ? `limite ${fmtCat(impactKpis.catLimit)}`
                  : ""}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function fmtCat(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
