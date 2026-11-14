import { useEffect, useState } from "react";
import { Lock } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Badge, Select } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";

/** "2026-10-02" → "02/10/2026", sem passar por `Date` (que leria em UTC e voltaria um dia). */
export function bankDateLabel(ymd) {
  const [y, m, d] = String(ymd ?? "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
}

const BOX = { border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, minWidth: 0, flex: 1 };
const BOX_LABEL = { ...G, fontSize: 10, fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", color: T.inkLight, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 };
const FIELD_LABEL = { ...G, fontSize: 11, fontWeight: 600, color: T.inkMid, display: "block", marginBottom: 4 };
const HELP = { ...G, fontSize: 11, color: T.inkLight, marginTop: 4, display: "block" };
const INPUT = { ...G, width: "100%", boxSizing: "border-box", fontSize: 13, color: T.ink, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px" };
const LOCKED = { ...G, ...NUM, display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.inkMid, background: T.grayLight, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px" };

const TYPE_LABEL = { income: "Receita", refund: "Estorno", expense: "Despesa" };

/** Categorias que aceitam o tipo. Estorno devolve um gasto: aceita as de despesa também (regra do backend). */
export function categoriesForType(categories, type) {
  return categories.filter((c) => {
    const allowed = c.allowed_transaction_types ?? [];
    return allowed.includes(type) || (type === "refund" && allowed.includes("expense"));
  });
}

function LockedValue({ children, testId, title }) {
  return (
    <span style={LOCKED} data-testid={testId} title={title}>
      <Lock size={12} aria-hidden="true" />
      {children}
    </span>
  );
}

/**
 * Um lançamento novo: à esquerda o que o banco registrou, à direita a transação que ele vai
 * virar ao concluir. Data e valor vêm do banco e ficam travados; descrição, tipo e categoria
 * são da pessoa. A descrição é gravada ao sair do campo.
 */
export function StatementEntryCard({ entry, categories, fallbackLabel, isMobile, onChange }) {
  const [description, setDescription] = useState(entry.description ?? "");
  useEffect(() => setDescription(entry.description ?? ""), [entry.description]);

  const moneyIn = entry.amount > 0;
  const type = entry.transaction_type ?? (moneyIn ? "income" : "expense");
  const options = categoriesForType(categories, type).filter((c) => !c.is_fallback);
  const blank = !description.trim();
  const fieldId = (name) => `entry-${entry.id}-${name}`;

  const saveDescription = () => {
    if (description !== (entry.description ?? "")) onChange(entry.id, { description });
  };

  return (
    <article
      data-testid="statement-entry"
      aria-label={`Lançamento ${entry.bank_description}`}
      style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.sm, padding: 14, display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12 }}
    >
      <section style={{ ...BOX, background: T.bg }}>
        <div style={BOX_LABEL}>No extrato do banco</div>
        <div style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink, wordBreak: "break-word" }}>{entry.bank_description}</div>
        <div style={{ ...G, ...NUM, fontSize: 12, color: T.inkLight, marginTop: 6 }}>{bankDateLabel(entry.date)}</div>
        <div style={{ ...G, ...NUM, fontSize: 16, fontWeight: 700, marginTop: 6, color: moneyIn ? T.green : T.ink }}>
          {formatMoney(entry.amount, entry.currency)}
        </div>
      </section>

      <section style={{ ...BOX, borderColor: T.greenBorder }}>
        <div style={BOX_LABEL}>
          No Fincla · nova transação <Badge color={T.green} bg={T.greenLight}>Entra ao concluir</Badge>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label htmlFor={fieldId("description")} style={FIELD_LABEL}>Descrição</label>
            <input
              id={fieldId("description")}
              value={description}
              maxLength={255}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveDescription}
              aria-invalid={blank}
              style={{ ...INPUT, borderColor: blank ? T.red : T.border }}
            />
            {blank
              ? <span style={{ ...HELP, color: T.red }}>Escreva uma descrição.</span>
              : <span style={HELP}>Começa com o texto do banco. Pode trocar por um nome seu.</span>}
          </div>

          <div>
            <span style={FIELD_LABEL}>Data</span>
            <LockedValue testId="locked-date" title="Vem do extrato e não pode ser alterada">{bankDateLabel(entry.date)}</LockedValue>
            <span style={HELP}>Vem do banco</span>
          </div>
          <div>
            <span style={FIELD_LABEL}>Valor</span>
            <LockedValue testId="locked-amount" title="Vem do extrato e não pode ser alterado">{formatMoney(entry.amount, entry.currency)}</LockedValue>
            <span style={HELP}>Vem do banco</span>
          </div>

          <div>
            {moneyIn ? (
              <>
                <label htmlFor={fieldId("type")} style={FIELD_LABEL}>Tipo</label>
                <Select id={fieldId("type")} value={type} onChange={(e) => onChange(entry.id, { transaction_type: e.target.value })} style={{ width: "100%" }}>
                  <option value="income">{TYPE_LABEL.income}</option>
                  <option value="refund">{TYPE_LABEL.refund}</option>
                </Select>
                <span style={HELP}>Entrada: receita ou estorno</span>
              </>
            ) : (
              <>
                <span style={FIELD_LABEL}>Tipo</span>
                <LockedValue testId="locked-type" title="Saída do banco sempre vira despesa">{TYPE_LABEL.expense}</LockedValue>
                <span style={HELP}>Saída do banco</span>
              </>
            )}
          </div>
          <div>
            <label htmlFor={fieldId("category")} style={FIELD_LABEL}>Categoria</label>
            <Select
              id={fieldId("category")}
              value={entry.category_tag_id ?? ""}
              onChange={(e) => onChange(entry.id, { category_tag_id: e.target.value || null })}
              style={{ width: "100%" }}
            >
              <option value="">{fallbackLabel}</option>
              {options.map((c) => <option key={c.id} value={c.id}>{c.label || c.name}</option>)}
            </Select>
            {entry.category_tag_id
              ? <span style={HELP}>Escolhida por você</span>
              : <span style={{ ...HELP, color: T.amber }}>Sem categoria: vai para Não classificado</span>}
          </div>
        </div>
      </section>
    </article>
  );
}
