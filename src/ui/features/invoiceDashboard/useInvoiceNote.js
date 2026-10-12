import { useCallback, useEffect, useState } from "react";

import { getInvoiceNote, saveInvoiceNote } from "../../../api/creditCards";

/**
 * Anotação POR FATURA, compartilhada pelo cabeçalho e pelo card do rodapé (e pelo modal que
 * os dois abrem). `text: null` = nunca houve anotação; texto vazio é uma anotação existente.
 */
export function useInvoiceNote({ card, organizationId, year, month }) {
  const scope = `${card?.id}:${organizationId}:${year}-${month}`;
  const [loaded, setLoaded] = useState({ scope: null, note: { status: "loading", text: null } });
  const setNote = useCallback((value) => setLoaded({ scope, note: value }), [scope]);
  // Nota de OUTRA fatura nunca aparece (nem salva por engano) durante a troca: até o fetch novo, é "carregando".
  const note = loaded.scope === scope ? loaded.note : { status: "loading", text: null };
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [scope]);
  useEffect(() => {
    if (!card?.id || !organizationId || !year || !month) return undefined;
    let active = true;
    getInvoiceNote(card.id, organizationId, year, month)
      .then((found) => { if (active) setNote({ status: "ok", text: found ? found.text : null }); })
      .catch(() => { if (active) setNote({ status: "error", text: null }); });
    return () => { active = false; };
  }, [card?.id, organizationId, year, month, setNote]);
  const save = useCallback(async (value) => {
    const saved = await saveInvoiceNote(card.id, organizationId, year, month, value);
    setNote({ status: "ok", text: saved.text });
  }, [card?.id, organizationId, year, month, setNote]);
  return { note, open, openEditor: useCallback(() => setOpen(true), []), closeEditor: useCallback(() => setOpen(false), []), save };
}
