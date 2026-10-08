import { T } from "../../tokens.js";
import { G, NUM } from "../../typography.js";
import { Card } from "../../components/primitives.jsx";
import { formatMoney } from "../../money/formatMoney.js";

const monthLabel = (year, month) => new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "short" });
const validAmount = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));

/** Invoice history is card-wide. Each currency has its own visual scale. */
export function CardTransactionsHistory({ history, isMobile, error }) {
  const rows = (history?.monthly_data ?? []).filter((row) => validAmount(row.total_amount)).slice(-6);
  const groups = new Map();
  for (const row of rows) {
    const code = row.total_amount_currency || null;
    const key = code || "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return <Card as="section" aria-label="Histórico de faturas do cartão" style={{ padding: 18, minWidth: 0 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
      <h2 style={{ ...G, fontSize: 15, margin: 0 }}>Histórico de faturas</h2>
      <span style={{ ...G, fontSize: 11, color: T.inkMid }}>Valores do cartão, sem os filtros da lista</span>
    </div>
    {error && <p style={{ ...G, fontSize: 12, color: T.inkMid }}>Não foi possível carregar o histórico.</p>}
    {!error && !history && <p role="status" style={{ ...G, fontSize: 12, color: T.inkMid }}>Carregando histórico…</p>}
    {history && rows.length === 0 && <p style={{ ...G, fontSize: 12, color: T.inkMid }}>Ainda não há faturas com valores para mostrar.</p>}
    {[...groups].map(([key, series]) => {
      const code = key === "unknown" ? null : key;
      const ceiling = Math.max(1, ...series.map((row) => Math.abs(Number(row.total_amount))));
      return <div key={key} style={{ marginTop: 14 }}>
        {groups.size > 1 && <h3 style={{ ...G, margin: "0 0 8px", fontSize: 11, color: T.inkMid }}>{code || "Moeda não informada"}</h3>}
        {isMobile ? <div role="list" aria-label={`Faturas em ${code || "moeda não informada"}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {series.map((row) => {
            const value = Math.abs(Number(row.total_amount));
            const display = code ? formatMoney(value, code) : "—";
            return <div key={`${row.year}-${row.month}`} role="listitem" style={{ display: "grid", gridTemplateColumns: "45px minmax(0,1fr) auto", gap: 8, alignItems: "center" }}>
              <span style={{ ...G, fontSize: 11, color: T.inkMid }}>{monthLabel(row.year, row.month)}</span>
              <div aria-hidden="true" style={{ background: T.grayLight, height: 10, borderRadius: 99 }}><div style={{ width: `${Math.max(2, value / ceiling * 100)}%`, height: "100%", background: row.status === "paid" ? T.green : row.status === "open" ? T.blue : T.amber, borderRadius: 99 }} /></div>
              <strong style={{ ...G, ...NUM, fontSize: 11, whiteSpace: "nowrap" }}>{display}</strong>
            </div>;
          })}
        </div> : <div role="img" aria-label={`Valores das últimas faturas do cartão em ${code || "moeda não informada"}`} style={{ height: 164, display: "flex", alignItems: "end", gap: 18 }}>
          {series.map((row) => {
            const value = Math.abs(Number(row.total_amount));
            const display = code ? formatMoney(value, code) : "—";
            return <div key={`${row.year}-${row.month}`} title={`${monthLabel(row.year, row.month)} ${row.year}: ${display}`} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "end", alignItems: "center", gap: 5, minWidth: 0 }}>
              <span style={{ ...G, ...NUM, fontSize: 10, color: T.inkMid }}>{display}</span>
              <div style={{ width: "100%", maxWidth: 84, height: `${Math.max(2, value / ceiling * 118)}px`, borderRadius: "6px 6px 0 0", background: row.status === "paid" ? T.green : row.status === "open" ? T.blue : T.amber }} />
              <span style={{ ...G, ...NUM, fontSize: 10, color: T.inkMid }}>{monthLabel(row.year, row.month)}</span>
            </div>;
          })}
        </div>}
      </div>;
    })}
  </Card>;
}
