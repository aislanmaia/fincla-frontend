// A área de soltar o extrato (primeira tela aprovada em 2026-11-16): arrastar e soltar, ou clicar
// (Enter/Espaço no teclado) para escolher. O envio começa ao escolher; não há segundo botão.
import { useRef, useState } from "react";
import { CloudUpload } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";

export const ACCEPTED_FILES = ".ofx,.xls,.xlsx,.csv,application/x-ofx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

const FORMATS = "OFX, XLS, XLSX ou CSV · até 5 MB";

/**
 * `compact` (há rascunho aberto): a área fica menor e convida a "outro extrato", sem a dica. `readingName`: o
 * arquivo sendo lido (a área para de aceitar outro até a resposta). `tip`: a dica de onde continuar.
 */
export function StatementDropZone({ compact = false, readingName = "", tip = null, onFile }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const reading = Boolean(readingName);
  const title = compact ? "Ou solte aqui outro extrato" : "Solte aqui o extrato do banco";

  const choose = () => { if (!reading) inputRef.current?.click(); };
  const take = (file) => { if (file && !reading) onFile(file); };

  return (
    <div style={{ flex: "999 1 460px", minWidth: 0, display: "flex" }}>
      <div
        role="button"
        tabIndex={reading ? -1 : 0}
        aria-disabled={reading || undefined}
        aria-label={`${title}. ${compact ? "Ou clique para escolher" : "Ou clique para escolher. A leitura começa na hora"}. ${FORMATS}.`}
        onClick={choose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            choose();
          }
        }}
        onDragOver={(e) => { e.preventDefault(); if (!reading) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          take(e.dataTransfer?.files?.[0] ?? null);
        }}
        style={{
          ...G, flex: 1, minWidth: 0, minHeight: compact ? 240 : 420, boxSizing: "border-box",
          background: dragging ? T.blueLight : T.surface,
          border: `2px dashed ${dragging ? T.blue : "#D1D5DB"}`, borderRadius: 16,
          padding: compact ? "28px 24px" : "40px 24px",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "safe center",
          gap: compact ? 8 : 10, textAlign: "center", cursor: reading ? "progress" : "pointer",
        }}
      >
        <CloudUpload size={compact ? 34 : 46} strokeWidth={1.5} color={T.inkLight} aria-hidden="true" />
        {reading ? (
          <b role="status" style={{ fontSize: compact ? 16 : 20, color: T.ink }}>Lendo {readingName}…</b>
        ) : (
          <>
            <b style={{ fontSize: compact ? 16 : 20, color: T.ink }}>{title}</b>
            {compact ? (
              <span style={{ fontSize: 12, color: T.inkLight }}>ou clique para escolher · {FORMATS}</span>
            ) : (
              <>
                <span style={{ fontSize: 14, color: T.inkMid, maxWidth: 480 }}>ou clique para escolher. A leitura começa na hora.</span>
                {tip ? <span style={{ ...NUM, fontSize: 13, color: T.inkMid, background: T.grayLight, borderRadius: 8, padding: "6px 10px" }}>{tip}</span> : null}
                <span style={{ fontSize: 12, color: T.inkLight }}>{FORMATS}</span>
              </>
            )}
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        aria-label="Arquivo do extrato (OFX, XLS, XLSX ou CSV, até 5 MB)"
        accept={ACCEPTED_FILES}
        tabIndex={-1}
        disabled={reading}
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          // O mesmo arquivo pode ser escolhido de novo (depois de uma recusa, por exemplo).
          e.target.value = "";
          take(file);
        }}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }}
      />
    </div>
  );
}
