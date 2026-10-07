import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { formatMoney } from "../../money/formatMoney.js";
import { mapInvoiceItemToUi } from "../../data/creditCardsAdapter.js";
import { plural } from "./invoiceFormat.js";

const LIMIT = 5;

/** Lançamentos mais recentes da fatura: ordem por data da compra, empate pelo id. */
export function recentItems(items, limit = LIMIT) {
  return (items ?? [])
    .map(mapInvoiceItemToUi)
    .sort((a, b) => (b.dataKey ?? "").localeCompare(a.dataKey ?? "") || Number(b.id) - Number(a.id))
    .slice(0, limit);
}

export function RecentItems({ items, totalCount, currency, isMobile, onViewAll }) {
  const rows = recentItems(items);
  return (
    <section data-testid="recent-items" aria-label="Itens recentes"
      style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.sm, padding: isMobile ? 16 : 20, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <h3 style={{ ...G, margin: 0, fontSize: 14, fontWeight: 800, color: T.ink }}>Itens recentes</h3>
      {rows.length === 0 ? (
        <div style={{ ...G, fontSize: 12, color: T.inkMid }}>Nenhum lançamento nesta fatura.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "0 24px" }}>
          {rows.map((item) => (
            <div key={item.id} data-testid="recent-item"
              style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: `1px solid ${T.border}`, minWidth: 0 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.desc}</div>
                <div style={{ ...G, fontSize: 11, color: T.inkLight }}>
                  {[item.cat, item.parcela ? `${item.parcela.n}/${item.parcela.t}` : null, item.data].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div style={{ ...G, ...NUM, fontSize: 13, fontWeight: 700, color: item.isRefund ? T.green : T.ink, flexShrink: 0 }}>
                {item.isRefund ? "− " : ""}{formatMoney(Math.abs(item.val), currency) ?? "—"}
              </div>
            </div>
          ))}
        </div>
      )}
      {onViewAll && (
        <button type="button" onClick={onViewAll} style={{ ...G, alignSelf: "flex-start", border: 0, background: "none", color: T.blue, fontSize: 12, fontWeight: 700, padding: "6px 0", cursor: "pointer" }}>
          Ver todos os lançamentos →
        </button>
      )}
      {totalCount > rows.length && (
        <div style={{ ...G, fontSize: 11, color: T.inkLight, textAlign: "center", paddingTop: 2 }}>
          mostrando {rows.length} de {plural(totalCount, "lançamento", "lançamentos")}
        </div>
      )}
    </section>
  );
}

/** Fatura prevista: o que já está assumido em parcelas (vem de future-commitments). */
export function ForecastInstallments({ installments, currency, isMobile }) {
  const rows = Array.isArray(installments) ? installments : [];
  if (rows.length === 0) return null;
  return (
    <section data-testid="forecast-installments" aria-label="Parcelas já garantidas"
      style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.sm, padding: isMobile ? 16 : 20, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <h3 style={{ ...G, margin: 0, fontSize: 14, fontWeight: 800, color: T.ink }}>Parcelas já garantidas</h3>
      {rows.map((row, i) => (
        <div key={`${row.description}-${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.description}</div>
            <div style={{ ...G, fontSize: 11, color: T.inkLight }}>
              {[row.category_name, `${row.installment_number}/${row.total_installments}`].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div style={{ ...G, ...NUM, fontSize: 13, fontWeight: 700, color: T.ink, flexShrink: 0 }}>{formatMoney(row.amount, currency) ?? "—"}</div>
        </div>
      ))}
    </section>
  );
}
