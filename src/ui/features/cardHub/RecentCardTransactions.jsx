import { T } from "../../tokens";
import { G } from "../../typography";
import { formatMoneyAbs } from "../../money/formatMoney.js";
import { pickCategoryTagFromApiTransaction } from "../../data/transactionsAdapter.js";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });

function categoryOf(row) {
  const tag = pickCategoryTagFromApiTransaction(row);
  return tag?.label?.trim() || tag?.name?.trim() || "Sem categoria";
}

function dateOf(row) {
  const day = typeof row.date === "string" ? row.date.slice(0, 10) : "";
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "Data indisponível" : dateFormat.format(date);
}

export function RecentCardTransactions({ transactions, cardCurrency, loading, error, onViewAll }) {
  return (
    <section aria-label="Lançamentos recentes" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.sm, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <h3 style={{ ...G, margin: 0, fontSize: 13, fontWeight: 700, color: T.ink }}>🧾 Lançamentos recentes</h3>
      {loading && <p role="status" style={{ ...G, margin: 0, fontSize: 12, color: T.inkMid }}>Carregando lançamentos…</p>}
      {error && <p role="alert" style={{ ...G, margin: 0, fontSize: 12, color: T.red }}>Não foi possível carregar os lançamentos deste cartão.</p>}
      {!loading && !error && transactions.length === 0 && <p style={{ ...G, margin: 0, fontSize: 12, color: T.inkMid }}>Este cartão ainda não tem lançamentos.</p>}
      {!loading && transactions.map((row) => (
        <div key={row.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: `1px solid ${T.border}`, minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...G, fontSize: 12, fontWeight: 600, color: T.ink, overflowWrap: "anywhere" }}>{row.description}</div>
            <div style={{ ...G, fontSize: 11, color: T.inkMid }}>{row.type === "refund" ? "Estorno · " : ""}{categoryOf(row)} · {dateOf(row)}</div>
          </div>
          <div style={{ ...G, fontSize: 12, fontWeight: 700, color: row.type === "refund" ? T.green : T.ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {row.type === "refund" ? "+" : ""}{formatMoneyAbs(row.value, row.value_currency ?? cardCurrency) ?? "—"}
          </div>
        </div>
      ))}
      <button type="button" onClick={onViewAll} style={{ ...G, alignSelf: "flex-start", marginTop: "auto", padding: "6px 0 0", border: 0, background: "none", color: T.blue, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
        Ver todas as transações →
      </button>
    </section>
  );
}
