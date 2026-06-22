import React from "react";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { PageTitle, Card } from "../../components/primitives";
import { useEconomyCapacityData } from "./useEconomyCapacityData.js";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function formatBRL(v) {
  return brl.format(Number(v || 0));
}

const TREND = {
  increasing: { label: "↗ crescente", color: T.green, bg: T.greenLight },
  stable: { label: "→ estável", color: T.inkMid, bg: T.grayLight },
  decreasing: { label: "↘ decrescente", color: T.red, bg: T.redLight },
};

const cap = { ...G, fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: T.inkLight };

function TrendChip({ trend }) {
  const t = TREND[trend] || TREND.stable;
  return (
    <span style={{ ...G, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, borderRadius: 9999, padding: "3px 9px", color: t.color, background: t.bg }}>
      {t.label}
    </span>
  );
}

function MonthBars({ months }) {
  const maxAbs = months.reduce((m, p) => Math.max(m, Math.abs(Number(p.surplus || 0))), 0) || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {months.map((p) => {
        const s = Number(p.surplus || 0);
        const pct = Math.max(4, (Math.abs(s) / maxAbs) * 100);
        const color = s >= 0 ? T.green : T.red;
        return (
          <div key={`${p.year}-${p.month}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 12, marginBottom: 6 }}>
              <span style={{ ...G, color: T.inkMid, fontWeight: 600 }}>{p.month_name}</span>
              <span style={{ ...G, ...NUM, fontWeight: 700, color: s >= 0 ? T.ink : T.red }}>{formatBRL(s)}</span>
            </div>
            <div style={{ width: "100%", height: 8, borderRadius: 99, background: T.grayLight, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** M3 — Capacidade de Economia (direção A). Vive dentro do hub Planejamento. */
export function CapacidadePanel({ organizationId, dataMode = "live", months = 3 }) {
  const enabled = !!organizationId && dataMode === "live";
  const { isLoading, error, data, hasLoaded } = useEconomyCapacityData({ organizationId, months, enabled });

  const surplusColor = data && Number(data.avg_surplus) < 0 ? T.red : T.green;
  const windowCopy = data
    ? data.months_with_data < data.window_months
      ? `média de ${data.months_with_data} ${data.months_with_data === 1 ? "mês" : "meses"} com movimento (competência)`
      : `média dos últimos ${data.window_months} meses (competência)`
    : "";

  return (
    <div>
      <div style={{ ...G, fontSize: 11, fontWeight: 500, letterSpacing: "0.02em", color: T.inkLight, marginBottom: 6 }}>
        Planejamento · Saúde Financeira
      </div>
      <PageTitle sans="Capacidade de" serif="Economia" />

      {error ? (
        <div style={{ ...G, fontSize: 12, color: T.red, background: T.redLight, borderRadius: 9, padding: "9px 12px", marginTop: 14 }}>{error}</div>
      ) : null}

      {isLoading && !hasLoaded ? (
        <div style={{ ...G, fontSize: 13, color: T.inkLight, padding: "24px 4px" }}>Carregando capacidade…</div>
      ) : null}

      {data ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginTop: 16 }}>
            <Card style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={cap}>Sobra média mensal</span>
                <TrendChip trend={data.trend} />
              </div>
              <div style={{ ...G, ...NUM, fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", color: surplusColor, marginTop: 8 }}>
                {formatBRL(data.avg_surplus)}
              </div>
              <div style={{ ...G, fontSize: 12, color: T.inkLight, marginTop: 4 }}>{windowCopy}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
                <div>
                  <div style={cap}>Receita média</div>
                  <div style={{ ...G, ...NUM, fontSize: 18, fontWeight: 700, marginTop: 4 }}>{formatBRL(data.avg_income)}</div>
                </div>
                <div>
                  <div style={cap}>Despesa média</div>
                  <div style={{ ...G, ...NUM, fontSize: 18, fontWeight: 700, marginTop: 4 }}>{formatBRL(data.avg_expense)}</div>
                </div>
              </div>
            </Card>

            <Card style={{ padding: 20 }}>
              <div style={{ ...cap, marginBottom: 14 }}>Sobra por mês</div>
              {data.months.length ? (
                <MonthBars months={data.months} />
              ) : (
                <div style={{ ...G, fontSize: 13, color: T.inkLight }}>Sem meses completos ainda.</div>
              )}
            </Card>
          </div>

          {data.current_month ? (
            <Card style={{ marginTop: 14, padding: "16px 20px", borderStyle: "dashed", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <span style={cap}>{data.current_month.month_name} · em andamento</span>
                <div style={{ ...G, fontSize: 11, color: T.inkGhost, marginTop: 3 }}>
                  receita {formatBRL(data.current_month.income)} · despesa {formatBRL(data.current_month.expense)}
                </div>
              </div>
              <span style={{ ...G, ...NUM, fontSize: 22, fontWeight: 800, color: Number(data.current_month.surplus) < 0 ? T.red : T.green }}>
                {formatBRL(data.current_month.surplus)}
              </span>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
