import { useCallback, useEffect, useState } from "react";

import { getInvoiceNote, saveInvoiceNote } from "../../../api/creditCards";

/**
 * Anotação POR FATURA, compartilhada pelo cabeçalho e pelo card do rodapé (e pelo modal que
 * os dois abrem). `text: null` = nunca houve anotação; texto vazio é uma anotação existente.
 */
export function useInvoiceNote({ card, organizationId, year, month }) {
  const [note, setNote] = useState({ status: "loading", text: null });
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!card?.id || !organizationId || !year || !month) return undefined;
    let active = true;
    setNote({ status: "loading", text: null });
    getInvoiceNote(card.id, organizationId, year, month)
      .then((found) => { if (active) setNote({ status: "ok", text: found ? found.text : null }); })
      .catch(() => { if (active) setNote({ status: "error", text: null }); });
    return () => { active = false; };
  }, [card?.id, organizationId, year, month]);
  const save = useCallback(async (value) => {
    const saved = await saveInvoiceNote(card.id, organizationId, year, month, value);
    setNote({ status: "ok", text: saved.text });
  }, [card?.id, organizationId, year, month]);
  return { note, open, openEditor: useCallback(() => setOpen(true), []), closeEditor: useCallback(() => setOpen(false), []), save };
}
