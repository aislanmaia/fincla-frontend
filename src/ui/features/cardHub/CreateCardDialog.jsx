import { useState } from "react";

import { buildCreateCreditCardPayload, formatCreditCardsApiError } from "../../data/creditCardsAdapter.js";
import { CardFormSheet } from "../creditCards/CardFormSheet.jsx";

export function CreateCardDialog({ organizationId, isMobile, onCreate, onClose }) {
  const [issuer, setIssuer] = useState("");
  const [name, setName] = useState("");
  const [last4, setLast4] = useState("");
  const [brand, setBrand] = useState("Visa");
  const [limit, setLimit] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [closingDay, setClosingDay] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await onCreate(buildCreateCreditCardPayload({
        organizationId,
        brand: brand || issuer,
        displayName: name || issuer,
        last4Digits: last4,
        limitInput: limit,
        dueDay,
        closingDay,
      }));
      onClose();
    } catch (cause) {
      setError(formatCreditCardsApiError(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <CardFormSheet
      open
      isMobile={isMobile}
      isEdit={false}
      draftIssuer={issuer}
      setDraftIssuer={setIssuer}
      draftName={name}
      setDraftName={setName}
      draftLast4={last4}
      setDraftLast4={setLast4}
      draftBrand={brand}
      setDraftBrand={setBrand}
      draftLimit={limit}
      setDraftLimit={setLimit}
      draftDueDay={dueDay}
      setDraftDueDay={setDueDay}
      draftClosingDay={closingDay}
      setDraftClosingDay={setClosingDay}
      draftSuccess={false}
      saving={saving}
      error={error}
      onSave={save}
      onCancel={onClose}
    />
  );
}
