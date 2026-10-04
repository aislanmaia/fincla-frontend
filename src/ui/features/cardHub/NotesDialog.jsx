import { useState } from "react";

import { T } from "../../tokens";
import { G } from "../../typography";
import { handleApiError } from "../../../api/client";
import { HubDialog } from "./HubDialog.jsx";

export const NOTES_MAX_LENGTH = 2000;

/**
 * Anotação livre do cartão. Falha ao salvar mostra o erro e preserva o texto
 * digitado: o rascunho só é descartado ao salvar com sucesso ou cancelar.
 */
export function NotesDialog({ initialNotes, isMobile, onSave, onClose }) {
  const [draft, setDraft] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave(draft);
      onClose();
    } catch (e) {
      setError(handleApiError(e) || "Não foi possível salvar a anotação.");
      setSaving(false);
    }
  };

  const footer = (
    <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
      <button type="button" onClick={onClose}
        style={{ ...G, padding: "9px 16px", borderRadius: 9, border: `1.5px solid ${T.border}`, background: "transparent", color: T.inkMid, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
        Cancelar
      </button>
      <button type="button" onClick={submit} disabled={saving} data-testid="card-notes-save"
        style={{ ...G, padding: "9px 16px", borderRadius: 9, border: "none", background: saving ? T.inkFaint : T.ink, color: "#fff", fontSize: 12, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
        {saving ? "Salvando…" : "Salvar"}
      </button>
    </div>
  );

  return (
    <HubDialog title="Anotações do cartão" isMobile={isMobile} onClose={onClose} footer={footer} width={420}>
      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea
          data-testid="card-notes-textarea"
          aria-label="Anotação do cartão"
          value={draft}
          maxLength={NOTES_MAX_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ex.: pedir aumento de limite em dezembro."
          style={{ ...G, width: "100%", boxSizing: "border-box", minHeight: 120, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 13, color: T.ink, resize: "vertical" }}
        />
        <div style={{ ...G, fontSize: 11, color: T.inkGhost, textAlign: "right" }}>{draft.length}/{NOTES_MAX_LENGTH}</div>
        {error && (
          <div role="alert" data-testid="card-notes-error"
            style={{ ...G, fontSize: 12, color: T.red, background: T.redLight, border: `1px solid ${T.red}22`, borderRadius: 10, padding: "10px 12px", lineHeight: 1.5 }}>
            {error}
          </div>
        )}
      </div>
    </HubDialog>
  );
}
