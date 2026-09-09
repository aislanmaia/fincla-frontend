import React from "react";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { PageTitle, Card } from "../../components/primitives";
import { useEconomyCapacityData } from "./useEconomyCapacityData.js";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Dinheiro, ou um travessão — nunca um zero de consolo.
 *
 * `Number(null || 0)` devolvia `0`, e a tela mostrava "R$ 0,00" para o valor que o
 * backend deliberadamente NÃO afirmou: quando falta cotação para converter as moedas
 * do cliente, ele manda `null` justamente para não inventar um número. Trazer o zero
 * de volta aqui desfazia isso na última camada, e "R$ 0,00" afirma que a pessoa não
 * tem nada — o oposto de "nós é que não sabemos ler".
 */
function formatBRL(v) {
  return v === null || v === undefined ? "—" : brl.format(Number(v));
}

/** Formata uma moeda qualquer: a quebra vem com a moeda de cada fatia. */
function formatMoney(valor, moeda) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda || "BRL" }).format(
    Number(valor),
  );
}

const TREND = {
  increasing: { label: "↗ crescente", color: T.green, bg: T.greenLight },
  stable: { label: "→ estável", color: T.inkMid, bg: T.grayLight },
  decreasing: { label: "↘ decrescente", color: T.red, bg: T.redLight },
  // "estável" é uma AFIRMAÇÃO sobre a direção do gasto. Quando falta cotação, o
  // backend manda `unknown` justamente para não afirmar — e o `|| TREND.stable` que
  // estava aqui afirmava por ele.
  unknown: { label: "— sem tendência", color: T.inkLight, bg: T.grayLight },
};

const cap = { ...G, fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: T.inkLight };

function TrendChip({ trend }) {
  const t = TREND[trend] || TREND.unknown;
  return (
    <span style={{ ...G, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, borderRadius: 9999, padding: "3px 9px", color: t.color, background: t.bg }}>
      {t.label}
    </span>
  );
}

/**
 * Debaixo do total: a taxa que o produziu, ou — quando ele não existe — o que
 * realmente há, por moeda.
 *
 * O backend manda os dois lados de propósito. Sem este componente, o caso "não deu
 * para converter" chegava à tela como um travessão sozinho, e a pessoa não tinha como
 * saber que os números existem, só não somam.
 */
function BreakdownOrRate({ data }) {
  const recibo = data.consolidation;
  const semTotal = data.avg_expense === null || data.avg_expense === undefined;

  if (!semTotal) {
    const taxas = recibo?.rates ?? [];
    if (taxas.length === 0) return null;
    return (
      <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 4 }}>
        {taxas.map((r) => `1 ${r.base} = ${r.rate} ${r.quote} (${r.quoted_on})`).join(" · ")}
      </div>
    );
  }

  const fatias = data.avg_expense_by_currency ?? [];
  return (
    <div style={{ marginTop: 6 }}>
      {fatias.map((f) => (
        <div key={f.currency} style={{ ...G, ...NUM, fontSize: 15, fontWeight: 700 }}>
          {formatMoney(f.amount, f.currency)}
        </div>
      ))}
      {recibo?.unavailable ? (
        <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 4 }}>
          Não foi possível converter para uma moeda só.
        </div>
      ) : null}
    </div>
  );
}

function MonthBars({ months }) {
  // `p.surplus` pode ser `null` (sem cotação). `Number(null)` é 0, e uma barra de
  // altura zero afirma "este mês fechou no zero" — não "não sabemos ler este mês".
  const maxAbs = months.reduce(
    (m, p) => (p.surplus === null || p.surplus === undefined ? m : Math.max(m, Math.abs(Number(p.surplus)))),
    0,
  ) || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {months.map((p) => {
        // O mês sem cotação não tem número NENHUM: `Number(null || 0)` é 0, e
        // "R$ 0,00" com uma barra desenhada afirma que o mês fechou no zero —
        // quando o que houve foi não conseguir ler o mês. Aqui ele mostra o
        // travessão e a trilha vazia.
        const semNumero = p.surplus === null || p.surplus === undefined;
        const s = semNumero ? null : Number(p.surplus);
        const pct = semNumero ? 0 : Math.max(4, (Math.abs(s) / maxAbs) * 100);
        const color = !semNumero && s >= 0 ? T.green : T.red;
        return (
          <div key={`${p.year}-${p.month}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 12, marginBottom: 6 }}>
              <span style={{ ...G, color: T.inkMid, fontWeight: 600 }}>{p.month_name}</span>
              <span
                style={{ ...G, ...NUM, fontWeight: 700, color: semNumero ? T.inkLight : s >= 0 ? T.ink : T.red }}
                title={semNumero ? "Sem cotação para converter este mês" : undefined}
              >
                {semNumero ? "—" : formatBRL(s)}
              </span>
            </div>
            <div style={{ width: "100%", height: 8, borderRadius: 99, background: T.grayLight, overflow: "hidden" }}>
              {semNumero ? null : (
                <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: color }} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** M3 — Capacidade de Economia (direção A). Vive dentro do hub Planejamento. */
export function CapacityPanel({ organizationId, dataMode = "live", months = 3 }) {
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
              <BreakdownOrRate data={data} />
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
