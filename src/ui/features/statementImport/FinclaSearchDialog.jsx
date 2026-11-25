// "Está no Fincla com outros dados…" (fincla-api#511): procurar a transação do lançamento em todas
// as contas ativas da mesma moeda. Diálogo na própria página (nunca `window.confirm`); a busca não
// muda nada, e escolher uma transação só responde o lançamento ("Sim, é esta") — uma de outra
// conta é movida para esta conta só ao concluir.
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Btn, useTouchTarget } from "../../components/primitives";
import { handleApiError } from "../../../api/client";
import { searchFinclaForEntry } from "../../../api/statementImports";
import { formatMoney } from "../../money/formatMoney.js";
import { bankDateLabel, INPUT } from "./StatementEntryCard.jsx";
import { FinclaMatchBox } from "./FinclaMatchBox.jsx";
import { ErrorNote } from "./StatementImportNotes.jsx";

/** Espera a pessoa parar de digitar antes de buscar. */
const SEARCH_DELAY_MS = 250;

export function FinclaSearchDialog({
  organizationId, accountId, importId, entry, entries, accountName, busy, onPick, onUndoThere, onClose,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const touchTarget = useTouchTarget();

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      searchFinclaForEntry(accountId, organizationId, importId, entry.id, query)
        .then((found) => { if (alive) { setResults(found); setError(""); } })
        .catch((err) => { if (alive) setError(handleApiError(err)); });
    }, SEARCH_DELAY_MS);
    return () => { alive = false; clearTimeout(timer); };
  }, [accountId, organizationId, importId, entry.id, query]);

  const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };

  return (
    <div
      onKeyDown={onKeyDown}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(15,15,13,.35)", display: "flex", alignItems: "safe center", justifyContent: "center", padding: 16, zIndex: 50, overflowY: "auto" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fincla-search-title"
        style={{ ...G, background: T.surface, borderRadius: 14, boxShadow: T.lg, width: "min(640px, 100%)", maxHeight: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}
      >
        <header style={{ padding: 16, borderBottom: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <b id="fincla-search-title" style={{ fontSize: 15, color: T.ink, flex: 1 }}>Procurar a transação no Fincla</b>
            <Btn variant="ghost" small onClick={onClose} aria-label="Fechar"><X size={14} aria-hidden="true" /></Btn>
          </div>
          <div style={{ fontSize: 13, color: T.inkMid, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 10px" }}>
            No extrato do banco: <span style={NUM}>{bankDateLabel(entry.date)}</span> · <b>{entry.bank_description}</b> ·{" "}
            <b style={NUM}>{formatMoney(entry.amount, entry.currency)}</b>
          </div>
          <label htmlFor="fincla-search-input" style={{ fontSize: 12, fontWeight: 600, color: T.inkMid }}>Buscar por descrição, conta, valor ou data</label>
          <input
            id="fincla-search-input"
            ref={inputRef}
            value={query}
            maxLength={100}
            placeholder="Ex.: farmácia, Nubank, 47,20 ou 09/10"
            onChange={(e) => setQuery(e.target.value)}
            style={{ ...INPUT, ...touchTarget }}
          />
        </header>
        <div className="fincla-scroll" style={{ padding: 16, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <ErrorNote>{error}</ErrorNote>
          {results === null && !error ? <p style={{ fontSize: 13, color: T.inkLight, margin: 0 }}>Procurando…</p> : null}
          {results && !results.length ? <p style={{ fontSize: 13, color: T.inkMid, margin: 0 }}>Nada encontrado.</p> : null}
          {(results ?? []).map((match) => {
            // Lido das respostas de agora (não da busca): depois de um "Desfazer lá" a opção libera na hora.
            const taken = entries.find((e) => e.id !== entry.id && e.answer === "pair" && (
              match.kind === "transfer" ? e.paired_transfer_id === match.transfer_id : e.paired_transaction_id === match.transaction_id
            )) ?? null;
            return (
              <FinclaMatchBox
                key={`${match.kind}-${match.transaction_id ?? match.transfer_id}`}
                entry={entry}
                match={match}
                accountName={accountName}
                ifChosen
                takenBy={taken}
                onUndoThere={onUndoThere}
                onPick={busy || taken ? null : onPick}
              />
            );
          })}
          <p style={{ fontSize: 12, color: T.inkLight, margin: 0 }}>
            Mostra transações de todas as suas contas na moeda deste extrato, no mesmo sentido do lançamento. Contas em outra moeda não aparecem.
          </p>
        </div>
        <footer style={{ padding: 12, borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "flex-end" }}>
          <Btn variant="outGray" onClick={onClose}>Cancelar</Btn>
        </footer>
      </div>
    </div>
  );
}
