import { T } from "../../tokens.js";
import { G, NUM } from "../../typography.js";
import { Card } from "../../components/primitives.jsx";
import { formatMoney } from "../../money/formatMoney.js";

const monthLabel = (year, month) => new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "short" });

/** Invoice history is card-wide. It must not be presented as the filtered-list summary. */
export function CardTransactionsHistory({ history, currency, isMobile, error }) {
  const rows = (history?.monthly_data ?? []).filter((row) => row.total_amount !== null && row.total_amount !== undefined && row.total_amount !== "" && Number.isFinite(Number(row.total_amount))).slice(-6);
  const max = Math.max(1, ...rows.map((row) => Math.abs(Number(row.total_amount) || 0)));
  return <Card as="section" aria-label="Histórico de faturas do cartão" style={{ padding: 18, minWidth: 0 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
      <h2 style={{ ...G, fontSize: 15, margin: 0 }}>Histórico de faturas</h2>
      <span style={{ ...G, fontSize: 11, color: T.inkMid }}>Valores do cartão, sem os filtros da lista</span>
    </div>
    {error && <p style={{ ...G, fontSize: 12, color: T.inkMid }}>Não foi possível carregar o histórico.</p>}
    {!error && !history && <p role="status" style={{ ...G, fontSize: 12, color: T.inkMid }}>Carregando histórico…</p>}
    {history && rows.length === 0 && <p style={{ ...G, fontSize: 12, color: T.inkMid }}>Ainda não há faturas com valores para mostrar.</p>}
    {rows.length > 0 && <div role="img" aria-label="Valores das últimas faturas do cartão" style={{ height: isMobile ? 132 : 164, display: "flex", alignItems: "end", gap: isMobile ? 7 : 18, marginTop: 16 }}>
      {rows.map((row) => {
        const value = Math.abs(Number(row.total_amount) || 0);
        const valueCurrency = row.total_amount_currency || currency;
        const display = valueCurrency ? formatMoney(value, valueCurrency) : null;
        return <div key={`${row.year}-${row.month}`} title={`${monthLabel(row.year, row.month)} ${row.year}: ${display ?? "valor indisponível"}`} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "end", alignItems: "center", gap: 5, minWidth: 0 }}>
          {!isMobile && <span style={{ ...G, ...NUM, fontSize: 10, color: T.inkMid }}>{display ?? "—"}</span>}
          <div style={{ width: "100%", maxWidth: 84, height: `${Math.max(2, value / max * (isMobile ? 98 : 118))}px`, borderRadius: "6px 6px 0 0", background: row.status === "paid" ? T.green : row.status === "open" ? T.blue : T.amber }} />
          <span style={{ ...G, ...NUM, fontSize: 10, color: T.inkMid }}>{monthLabel(row.year, row.month)}</span>
        </div>;
      })}
    </div>}
  </Card>;
}
