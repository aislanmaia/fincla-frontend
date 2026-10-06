import { Card } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";

const changeLabels = {
  new: "Novo compromisso",
  removed: "Saiu da fatura",
  changed_value: "Valor alterado",
};

function signedMoney(value, currency) {
  if (value == null) return "—";
  return `${Number(value) > 0 ? "+" : ""}${formatMoney(value, currency)}`;
}

function ItemChange({ item, currency }) {
  const amount = item.change_type === "removed" ? item.previous_amount : item.current_amount;
  return (
    <li style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, padding: "10px 0", borderTop: `1px solid ${T.border}` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...G, fontSize: 12, fontWeight: 700, color: T.ink, overflowWrap: "anywhere" }}>{item.description}</div>
        <div style={{ ...G, fontSize: 11, color: T.inkMid, marginTop: 3 }}>
          {changeLabels[item.change_type]}
          {item.commitment_type === "installment" && item.installment_number != null && item.total_installments != null
            ? ` · parcela ${item.installment_number}/${item.total_installments}` : ""}
        </div>
      </div>
      <div style={{ ...G, ...NUM, textAlign: "right", fontSize: 12, fontWeight: 700, color: T.ink, whiteSpace: "nowrap" }}>
        {item.change_type === "changed_value"
          ? `${formatMoney(item.previous_amount, currency)} → ${formatMoney(item.current_amount, currency)}`
          : formatMoney(amount, currency) ?? "—"}
        {item.change_type === "changed_value" && <div style={{ fontSize: 11, color: Number(item.change_amount) > 0 ? T.red : T.green }}>
          {signedMoney(item.change_amount, currency)}
        </div>}
      </div>
    </li>
  );
}

function CategoryChange({ category, items, currency }) {
  const delta = Number(category.change);
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: "50%", background: category.category_color || T.inkGhost, flexShrink: 0 }} />
          <h4 style={{ ...G, fontSize: 13, fontWeight: 800, color: T.ink, margin: 0, overflowWrap: "anywhere" }}>{category.category_name}</h4>
        </div>
        <div style={{ ...G, ...NUM, textAlign: "right", whiteSpace: "nowrap", fontSize: 12, fontWeight: 700, color: delta > 0 ? T.red : delta < 0 ? T.green : T.inkMid }}>
          {signedMoney(category.change, currency)}
        </div>
      </div>
      <div style={{ ...G, ...NUM, fontSize: 11, color: T.inkMid, marginTop: 5 }}>
        {formatMoney(category.previous_total, currency)} → {formatMoney(category.current_total, currency)}
      </div>
      {items.length > 0 && <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
        {items.map((item) => <ItemChange key={`${item.change_type}:${item.series_id}`} item={item} currency={currency} />)}
      </ul>}
    </div>
  );
}

export function InvoiceChanges({ changes, currency, isMobile = false }) {
  if (!changes?.previous_available) return null;
  const categories = changes.categories ?? [];
  const items = changes.items ?? [];
  const groups = categories.map((category) => ({
    category,
    items: items.filter((item) => item.category_id === category.category_id),
  }));
  const unmatched = items.filter((item) => !categories.some((category) => category.category_id === item.category_id));
  const unmatchedGroups = unmatched.reduce((groupsByCategory, item) => {
    const key = item.category_id ?? `name:${item.category_name ?? ""}`;
    const group = groupsByCategory.get(key) ?? [];
    group.push(item);
    groupsByCategory.set(key, group);
    return groupsByCategory;
  }, new Map());
  const oneOff = changes.one_off;
  const oneOffChanged = oneOff && (oneOff.current_count !== oneOff.previous_count || Number(oneOff.current_total) !== Number(oneOff.previous_total));

  return (
    <Card role="region" aria-label="O que mudou" data-testid="invoice-changes" style={{ padding: isMobile ? 16 : 20, minWidth: 0 }}>
      <h3 style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink, margin: 0 }}>O que mudou</h3>
      <p style={{ ...G, fontSize: 12, color: T.inkMid, margin: "5px 0 16px" }}>Comparação com a fatura anterior</p>
      {groups.length === 0 && unmatched.length === 0 && !oneOffChanged ? (
        <p style={{ ...G, fontSize: 12, color: T.inkMid, margin: 0 }}>Sem mudanças nos compromissos, compras avulsas e categorias.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 20 }}>
          {groups.map(({ category, items: groupItems }) => <CategoryChange key={category.category_id ?? category.category_name} category={category} items={groupItems} currency={currency} />)}
          {[...unmatchedGroups].map(([key, groupItems]) => <div key={key}>
            <h4 style={{ ...G, fontSize: 13, color: T.ink, margin: 0 }}>{groupItems[0].category_name || "Sem categoria"}</h4>
            <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
              {groupItems.map((item) => <ItemChange key={`${item.change_type}:${item.series_id}`} item={item} currency={currency} />)}
            </ul>
          </div>)}
          {oneOffChanged && <div style={{ ...G, fontSize: 12, color: T.inkMid }}>
            <h4 style={{ fontSize: 13, color: T.ink, margin: "0 0 5px" }}>Compras avulsas e estornos</h4>
            <div style={NUM}>{formatMoney(oneOff.previous_total, currency)} → {formatMoney(oneOff.current_total, currency)}</div>
            <div>{oneOff.previous_count} → {oneOff.current_count} lançamentos</div>
          </div>}
        </div>
      )}
    </Card>
  );
}
