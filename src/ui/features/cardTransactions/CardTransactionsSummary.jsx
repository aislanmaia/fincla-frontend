import { Card } from "../../components/primitives.jsx";
import { formatMoney } from "../../money/formatMoney.js";
import { T } from "../../tokens.js";
import { G, NUM } from "../../typography.js";

const COLORS = [T.green, T.blue, T.amber, T.purple, T.red];
const validAmount = (row) => row.amount != null && Number.isFinite(Number(row.amount)) && row.amount_currency;

/** Aggregate values come from the backend over the full filtered result, not the loaded page. */
export function CardTransactionsSummary({ summary, loading, error }) {
  const categories = (summary?.breakdown?.by_category ?? []).filter(validAmount);
  const currencies = [...new Set(categories.map((row) => row.amount_currency))];
  return <Card as="section" aria-label="Resumo dos lançamentos filtrados" style={{ padding: 18, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
    <div><h2 style={{ ...G, fontSize: 15, margin: "0 0 4px" }}>Resumo do recorte</h2><p style={{ ...G, fontSize: 11, color: T.inkMid, margin: 0 }}>Todos os lançamentos que correspondem aos filtros · dados da API</p></div>
    {loading && <p role="status" style={{ ...G, fontSize: 12, color: T.inkMid }}>Carregando resumo…</p>}
    {error && <p role="alert" style={{ ...G, fontSize: 12, color: T.inkMid }}>Não foi possível carregar o resumo.</p>}
    {summary && <strong style={{ ...G, ...NUM, fontSize: 22 }}>{summary.total_transactions} lançamento{summary.total_transactions === 1 ? "" : "s"}</strong>}
    {summary && currencies.length === 0 && <p style={{ ...G, fontSize: 12, color: T.inkMid }}>Sem gastos por categoria neste recorte.</p>}
    {currencies.map((currency) => {
      const rows = categories.filter((row) => row.amount_currency === currency);
      const max = Math.max(1, ...rows.map((row) => Math.abs(Number(row.amount))));
      return <div key={currency} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {currencies.length > 1 && <h3 style={{ ...G, margin: 0, fontSize: 11, color: T.inkMid }}>{currency}</h3>}
        {rows.map((row, index) => <div key={`${row.category}-${index}`} style={{ display: "grid", gridTemplateColumns: "minmax(80px,1fr) minmax(45px,2fr) auto", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ ...G, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.category}>{row.category}</span>
          <div aria-hidden="true" style={{ height: 9, borderRadius: 99, background: T.grayLight }}><div style={{ height: "100%", width: `${Math.max(2, Math.abs(Number(row.amount)) / max * 100)}%`, borderRadius: 99, background: COLORS[index % COLORS.length] }} /></div>
          <strong style={{ ...G, ...NUM, fontSize: 11, whiteSpace: "nowrap" }}>{formatMoney(row.amount, currency) ?? "—"}</strong>
        </div>)}
      </div>;
    })}
  </Card>;
}
