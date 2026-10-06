import { useState } from "react";

import { T } from "../../tokens";
import { G } from "../../typography";
import { currencyInfo } from "../../money/currencyRegistry.js";
import {
  buildUpdateCreditCardPayload,
  formatCreditCardsApiError,
  formatLimitInputFromNumber,
} from "../../data/creditCardsAdapter.js";
import { HubDialog } from "./HubDialog.jsx";

const field = { ...G, width: "100%", boxSizing: "border-box", border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px 12px", fontSize: 13, color: T.ink, background: T.surface };
const label = { ...G, display: "block", marginBottom: 5, fontSize: 11, fontWeight: 700, color: T.inkMid };
const validDay = (value) => /^\d{1,2}$/.test(value) && Number(value) >= 1 && Number(value) <= 31;
const validLimit = (value) => !value || /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(value);

/** Edits the fields supported by PATCH /credit-cards/{id}; the settling account is immutable here. */
export function EditCardDialog({ card, organizationId, isMobile, onSave, onClose }) {
  const [brand, setBrand] = useState(card.brand ?? "");
  const [name, setName] = useState(card.description ?? "");
  const [last4, setLast4] = useState(card.last4 ?? "");
  const [limit, setLimit] = useState(formatLimitInputFromNumber(card.credit_limit));
  const [dueDay, setDueDay] = useState(String(card.due_day ?? ""));
  const [closingDay, setClosingDay] = useState(card.closing_day == null ? "" : String(card.closing_day));
  const [color, setColor] = useState(card.color ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSave = brand.trim().length >= 2 && brand.trim().length <= 50 && name.trim().length > 0
    && /^\d{4}$/.test(last4) && validDay(dueDay)
    && (!closingDay || validDay(closingDay)) && validLimit(limit.trim())
    && (!color || /^#[0-9a-fA-F]{6}$/.test(color));

  async function submit(event) {
    event.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave(buildUpdateCreditCardPayload({
        organizationId,
        brand: brand.trim(),
        displayName: name.trim(),
        last4Digits: last4,
        limitInput: limit.trim(),
        dueDay,
        closingDay,
        color: color || undefined,
      }));
      onClose();
    } catch (cause) {
      setError(formatCreditCardsApiError(cause));
    } finally {
      setSaving(false);
    }
  }

  const formId = `edit-card-${card.id}`;
  const input = (title, value, setValue, extra = {}) => <label style={{ minWidth: 0 }}>
    <span style={label}>{title}</span>
    <input value={value} onChange={(event) => setValue(event.target.value)} style={field} {...extra} />
  </label>;

  return <HubDialog title="Editar cartão" isMobile={isMobile} onClose={onClose} footer={
    <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
      <button type="button" onClick={onClose} disabled={saving} style={{ ...field, width: "auto", cursor: "pointer" }}>Cancelar</button>
      <button type="submit" form={formId} disabled={!canSave || saving}
        style={{ ...G, border: 0, borderRadius: 9, background: T.green, color: "#fff", padding: "10px 16px", fontSize: 12, fontWeight: 700, opacity: !canSave || saving ? 0.5 : 1, cursor: !canSave || saving ? "not-allowed" : "pointer" }}>
        {saving ? "Salvando…" : "Salvar alterações"}
      </button>
    </div>
  }>
    <form id={formId} onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14, padding: "18px 20px" }}>
      {input("Banco ou bandeira", brand, setBrand, { maxLength: 50, required: true })}
      {input("Nome do cartão", name, setName, { maxLength: 255 })}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        {input("4 últimos dígitos", last4, (value) => setLast4(value.replace(/\D/g, "").slice(0, 4)), { inputMode: "numeric", maxLength: 4, required: true })}
        <label><span style={label}>Limite total ({currencyInfo(card.currency).symbol})</span>
          <input value={limit} onChange={(event) => setLimit(event.target.value)} inputMode="decimal" placeholder="Não cadastrado" style={field} />
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        {input("Dia do vencimento", dueDay, setDueDay, { inputMode: "numeric", maxLength: 2, required: true })}
        {input("Dia do fechamento", closingDay, setClosingDay, { inputMode: "numeric", maxLength: 2, placeholder: "Não informado" })}
      </div>
      {input("Cor do cartão (opcional)", color, setColor, { placeholder: "#RRGGBB", maxLength: 7 })}
      {error && <div role="alert" style={{ ...G, color: T.red, fontSize: 12 }}>{error}</div>}
      <p style={{ ...G, margin: 0, fontSize: 11, lineHeight: 1.5, color: T.inkLight }}>
        Deixe o limite vazio para manter o valor atual. O dia de fechamento vazio também mantém a configuração atual.
      </p>
    </form>
  </HubDialog>;
}
