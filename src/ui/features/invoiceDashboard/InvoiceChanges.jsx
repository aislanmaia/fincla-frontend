import { Card } from "../../components/primitives";
import { categoryLabelPtForTag } from "../../data/categoryLabels.js";
import { formatMoney } from "../../money/formatMoney.js";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { invoiceMoneyValue } from "./invoiceMoney.js";

const changeLabels = {
  new: "Novo compromisso",
  removed: "Saiu da fatura",
  changed_value: "Valor alterado",
};

function signedMoney(value, currency) {
  const amount = invoiceMoneyValue(value, currency);
  if (amount === null) return "—";
  return `${amount > 0 ? "+" : ""}${formatMoney(amount, currency)}`;
}

function ItemChange({ item, currency }) {
  const amount = item.change_type === "removed" ? item.previous_amount : item.current_amount;
  const hasOccurrences = item.commitment_type === "recurring" && (item.occurrences_previous != null || item.occurrences_current != null);
  return (
    <li style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, padding: "10px 0", borderTop: `1px solid ${T.border}` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...G, fontSize: 12, fontWeight: 700, color: T.ink, overflowWrap: "anywhere" }}>{item.description}</div>
        <div style={{ ...G, fontSize: 11, color: T.inkMid, marginTop: 3 }}>
          {item.category_name ? `${categoryLabelPtForTag({ name: item.category_name })} · ` : ""}{changeLabels[item.change_type]}
          {item.commitment_type === "installment" && item.installment_number != null && item.total_installments != null
            ? ` · parcela ${item.installment_number}/${item.total_installments}` : ""}
        </div>
        {hasOccurrences && <div style={{ ...G, fontSize: 11, color: T.inkMid, marginTop: 3 }}>
          Ocorrências: {item.occurrences_previous ?? "—"} → {item.occurrences_current ?? "—"}
        </div>}
      </div>
      <div style={{ ...G, ...NUM, minWidth: 0, textAlign: "right", fontSize: 12, fontWeight: 700, color: T.ink, overflowWrap: "anywhere" }}>
        {item.change_type === "changed_value"
          ? `${formatMoney(item.previous_amount, currency)} → ${formatMoney(item.current_amount, currency)}`
          : formatMoney(amount, currency) ?? "—"}
        {item.change_type === "changed_value" && <div style={{ fontSize: 11, color: (invoiceMoneyValue(item.change_amount, currency) ?? 0) > 0 ? T.red : T.green }}>
          {signedMoney(item.change_amount, currency)} por ocorrência
        </div>}
      </div>
    </li>
  );
}

export function InvoiceChanges({ changes, currency, isMobile = false }) {
  if (!changes?.previous_available) return null;
  const categories = changes.categories ?? [];
  const items = changes.items ?? [];
  const groups = [
    { type: "new", label: "Novo", color: T.green, background: T.greenLight, hint: "não estava na fatura anterior" },
    { type: "removed", label: "Não apareceu mais", color: T.red, background: T.redLight, hint: "estava na fatura anterior" },
    { type: "changed_value", label: "Mudou de valor", color: T.amber, background: T.amberLight, hint: "mesmo compromisso, valor diferente" },
  ];
  const oneOff = changes.one_off;
  const oneOffChanged = oneOff && (oneOff.current_count !== oneOff.previous_count || Number(oneOff.current_total) !== Number(oneOff.previous_total));
  const categoryDeltas = categories.filter((category) => invoiceMoneyValue(category.change, currency) !== null && invoiceMoneyValue(category.change, currency) !== 0)
    .sort((a, b) => Math.abs(invoiceMoneyValue(b.change, currency)) - Math.abs(invoiceMoneyValue(a.change, currency))).slice(0, 3);
  const noChanges = items.length === 0 && categoryDeltas.length === 0 && !oneOffChanged;

  return (
    <section role="region" aria-label="O que mudou" data-testid="invoice-changes" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <h3 style={{ ...G, fontSize: isMobile ? 16 : 18, fontWeight: 800, color: T.ink, margin: 0 }}>O que mudou desde a fatura anterior</h3>
      <p style={{ ...G, fontSize: 12, color: T.inkMid, margin: 0 }}>Comparação item a item com a fatura anterior.</p>
      {noChanges ? <Card style={{ padding: isMobile ? 16 : 20, ...G, fontSize: 12, color: T.inkMid }}>Sem mudanças identificadas nesta comparação.</Card> : <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 16 }}>
        {groups.map((group) => {
          const entries = items.filter((item) => item.change_type === group.type);
          return <Card key={group.type} style={{ padding: isMobile ? 16 : 20, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ ...G, fontSize: 11, fontWeight: 700, color: group.color, background: group.background, borderRadius: 99, padding: "4px 8px" }}>{group.label}</span>
              <span style={{ ...G, fontSize: 11, color: T.inkMid }}>{group.hint}</span>
            </div>
            {entries.length ? <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>{entries.map((item, index) => <ItemChange key={`${item.change_type}:${item.series_id ?? index}:${index}`} item={item} currency={currency} />)}</ul>
              : <p style={{ ...G, fontSize: 12, color: T.inkMid, margin: "14px 0 0" }}>Nenhum item neste grupo.</p>}
          </Card>;
        })}
      </div>}
      {categoryDeltas.length > 0 && <Card style={{ padding: isMobile ? 16 : 20, display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "start" : "center", gap: 10 }}>
        <span style={{ ...G, fontSize: 11, color: T.inkLight }}>por categoria</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{categoryDeltas.map((category, index) => <span key={`${category.category_id ?? category.category_name}:${index}`} style={{ ...G, ...NUM, fontSize: 11, fontWeight: 700, color: invoiceMoneyValue(category.change, currency) > 0 ? T.red : T.green, background: invoiceMoneyValue(category.change, currency) > 0 ? T.redLight : T.greenLight, borderRadius: 99, padding: "5px 8px" }}>
          {invoiceMoneyValue(category.change, currency) > 0 ? "↑" : "↓"} {categoryLabelPtForTag({ name: category.category_name })} {invoiceMoneyValue(category.previous_total, currency) > 0
            ? `${Math.abs(invoiceMoneyValue(category.change, currency) / invoiceMoneyValue(category.previous_total, currency) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
            : signedMoney(category.change, currency)}
        </span>)}</div>
      </Card>}
      {oneOffChanged && <Card style={{ padding: isMobile ? 16 : 20, ...G, fontSize: 12, color: T.inkMid }}>
        <strong style={{ color: T.ink }}>Compras avulsas e estornos</strong>: <span style={NUM}>{formatMoney(oneOff.previous_total, currency)} → {formatMoney(oneOff.current_total, currency)}</span> · {oneOff.previous_count} → {oneOff.current_count} lançamentos
      </Card>}
    </section>
  );
}
