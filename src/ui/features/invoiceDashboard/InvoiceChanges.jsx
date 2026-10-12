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

/** Dinheiro só na moeda da fatura; ausência ou moeda diferente vira "—", nunca "null" nem zero. */
function moneyOrDash(value, currency) {
  const amount = invoiceMoneyValue(value, currency);
  return amount === null ? "—" : formatMoney(amount, currency) ?? "—";
}

function signedMoney(value, currency) {
  const amount = invoiceMoneyValue(value, currency);
  if (amount === null) return "—";
  return `${amount > 0 ? "+" : ""}${formatMoney(amount, currency)}`;
}

const LINK_BUTTON = { background: "none", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline", textDecorationColor: T.border, textUnderlineOffset: 3 };

/** Texto das ocorrências de uma recorrência: nunca "—" sozinho; ausência vira palavra. */
function occurrencesText(item, notYetCharged) {
  const previous = item.occurrences_previous;
  const current = item.occurrences_current;
  const count = (value) => `${value} ${value === 1 ? "cobrança" : "cobranças"}`;
  if (previous != null && current == null) return notYetCharged ? `Fatura anterior: ${count(previous)} · nesta, ainda nenhuma` : `Fatura anterior: ${count(previous)} · nesta, nenhuma`;
  if (previous == null && current != null) return `Fatura anterior: nenhuma · nesta: ${count(current)}`;
  if (previous != null && current != null) return `Fatura anterior: ${count(previous)} · nesta: ${count(current)}`;
  return "Cobranças não informadas";
}

/** Pílula que vira botão (com foco e rótulo) quando há destino; sem destino segue só informativa. */
function Chip({ onOpen, label, style, children }) {
  if (!onOpen) return <span style={style}>{children}</span>;
  return <button type="button" onClick={onOpen} aria-label={label} title={label} style={{ ...style, border: 0, cursor: "pointer" }}>{children}</button>;
}

function ItemChange({ item, currency, invoiceOpen, onOpenLedger }) {
  const amount = item.change_type === "removed" ? item.previous_amount : item.current_amount;
  const hasOccurrences = item.commitment_type === "recurring" && (item.occurrences_previous != null || item.occurrences_current != null);
  // Numa fatura ainda aberta, uma RECORRÊNCIA que "não apareceu" ainda não foi cobrada neste ciclo; parcela ou compra que saiu, saiu.
  const notYetCharged = item.change_type === "removed" && invoiceOpen && item.commitment_type === "recurring";
  const statusText = item.change_type === "removed" ? (notYetCharged ? "Ainda não cobrado neste ciclo" : changeLabels.removed) : changeLabels[item.change_type];
  return (
    <li style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, padding: "10px 0", borderTop: `1px solid ${T.border}` }}>
      <div style={{ minWidth: 0 }}>
        {onOpenLedger
          ? <button type="button" onClick={() => onOpenLedger({ query: item.description, previous: item.change_type === "removed" })} title="Ver estes lançamentos" style={{ ...G, ...LINK_BUTTON, fontSize: 12, fontWeight: 700, color: T.ink, textAlign: "left", overflowWrap: "anywhere" }}>{item.description}</button>
          : <div style={{ ...G, fontSize: 12, fontWeight: 700, color: T.ink, overflowWrap: "anywhere" }}>{item.description}</div>}
        <div style={{ ...G, fontSize: 11, color: T.inkMid, marginTop: 3 }}>
          {item.category_name ? `${categoryLabelPtForTag({ name: item.category_name })} · ` : ""}{statusText}
          {item.commitment_type === "installment" && item.installment_number != null && item.total_installments != null
            ? ` · parcela ${item.installment_number}/${item.total_installments}` : ""}
        </div>
        {hasOccurrences && <div style={{ ...G, fontSize: 11, color: T.inkMid, marginTop: 3 }}>
          {occurrencesText(item, notYetCharged)}
        </div>}
      </div>
      <div style={{ ...G, ...NUM, minWidth: 0, textAlign: "right", fontSize: 12, fontWeight: 700, color: T.ink, overflowWrap: "anywhere" }}>
        {item.change_type === "changed_value"
          ? `${moneyOrDash(item.previous_amount, currency)} → ${moneyOrDash(item.current_amount, currency)}`
          : formatMoney(amount, currency) ?? "—"}
        {item.change_type === "changed_value" && <div style={{ fontSize: 11, color: (invoiceMoneyValue(item.change_amount, currency) ?? 0) > 0 ? T.red : T.green }}>
          {signedMoney(item.change_amount, currency)} por ocorrência
        </div>}
      </div>
    </li>
  );
}

export function InvoiceChanges({ changes, currency, isMobile = false, invoiceOpen = false, onOpenLedger }) {
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
            {entries.length ? <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>{entries.map((item, index) => <ItemChange key={`${item.change_type}:${item.series_id ?? index}:${index}`} item={item} currency={currency} invoiceOpen={invoiceOpen} onOpenLedger={onOpenLedger} />)}</ul>
              : <p style={{ ...G, fontSize: 12, color: T.inkMid, margin: "14px 0 0" }}>Nenhum item neste grupo.</p>}
          </Card>;
        })}
      </div>}
      {categoryDeltas.length > 0 && <Card style={{ padding: isMobile ? 16 : 20, display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "start" : "center", gap: 10 }}>
        <span style={{ ...G, fontSize: 11, color: T.inkLight }}>por categoria</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{categoryDeltas.map((category, index) => <Chip key={`${category.category_id ?? category.category_name}:${index}`} onOpen={onOpenLedger && category.category_id ? () => onOpenLedger({ categoryId: category.category_id }) : undefined} label={`Ver lançamentos de ${categoryLabelPtForTag({ name: category.category_name })} nesta fatura`} style={{ ...G, ...NUM, fontSize: 11, fontWeight: 700, color: invoiceMoneyValue(category.change, currency) > 0 ? T.red : T.green, background: invoiceMoneyValue(category.change, currency) > 0 ? T.redLight : T.greenLight, borderRadius: 99, padding: "5px 8px" }}>
          {invoiceMoneyValue(category.change, currency) > 0 ? "↑" : "↓"} {categoryLabelPtForTag({ name: category.category_name })} {invoiceMoneyValue(category.previous_total, currency) > 0
            ? `${Math.abs(invoiceMoneyValue(category.change, currency) / invoiceMoneyValue(category.previous_total, currency) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
            : signedMoney(category.change, currency)}
        </Chip>)}</div>
      </Card>}
      {oneOffChanged && <Card style={{ padding: isMobile ? 16 : 20, ...G, fontSize: 12, color: T.inkMid }}>
        <strong style={{ color: T.ink }}>Compras avulsas e estornos</strong>: <span style={NUM}>{moneyOrDash(oneOff.previous_total, currency)} → {moneyOrDash(oneOff.current_total, currency)}</span> · {oneOff.previous_count} → {oneOff.current_count} lançamentos
        {onOpenLedger && <> · <button type="button" onClick={() => onOpenLedger({ kind: "one_off" })} style={{ ...G, ...LINK_BUTTON, fontSize: 12, fontWeight: 700, color: T.blue }}>ver lançamentos →</button></>}
      </Card>}
    </section>
  );
}
