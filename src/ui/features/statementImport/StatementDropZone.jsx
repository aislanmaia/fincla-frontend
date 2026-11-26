// A área de soltar o extrato (primeira tela aprovada em 2026-11-16): arrastar e soltar, ou clicar
// (Enter/Espaço no teclado) para escolher. O envio começa ao escolher; não há segundo botão.
import { useEffect, useRef, useState } from "react";
import { CloudUpload } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";

// O PDF é a fatura do cartão (fincla-api#555): o Fincla percebe pelos bytes e abre a conciliação da fatura.
export const ACCEPTED_FILES = ".ofx,.xls,.xlsx,.csv,.pdf,application/x-ofx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/pdf";

/** As palavras da área: o extrato da conta (padrão, aceita também o PDF da fatura) ou só a fatura do cartão. */
const COPY = {
  statement: {
    formats: "OFX, XLS, XLSX ou CSV · PDF da fatura do cartão · até 5 MB",
    accept: ACCEPTED_FILES,
    what: "o extrato do banco",
    another: "outro extrato",
    input: "Arquivo do extrato (OFX, XLS, XLSX ou CSV, ou o PDF da fatura do cartão, até 5 MB)",
  },
  invoice: {
    formats: "PDF da fatura · até 5 MB",
    accept: ".pdf,application/pdf",
    what: "o PDF da fatura",
    another: "outra fatura",
    input: "PDF da fatura do cartão (até 5 MB)",
  },
};

export const ONE_FILE_AT_A_TIME = "Solte um arquivo por vez.";

/** Só gestos que trazem arquivo: arrastar texto para um campo continua funcionando. */
const carriesFiles = (event) => Array.from(event.dataTransfer?.types ?? []).includes("Files");

/**
 * Enquanto a tela está montada, um arquivo solto FORA da área não faz o navegador abrir o OFX/CSV
 * (e sair do Fincla): o `dragover`/`drop` de arquivo na janela é cancelado. Limpa ao desmontar.
 */
export function usePreventFileDropOutside() {
  useEffect(() => {
    const cancel = (event) => { if (carriesFiles(event)) event.preventDefault(); };
    window.addEventListener("dragover", cancel);
    window.addEventListener("drop", cancel);
    return () => {
      window.removeEventListener("dragover", cancel);
      window.removeEventListener("drop", cancel);
    };
  }, []);
}

const VISUALLY_HIDDEN = { position: "absolute", width: 1, height: 1, margin: -1, padding: 0, border: 0, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" };

/**
 * `compact` (há rascunho aberto): a área fica menor e convida a "outro extrato", sem a dica. `readingName`: o
 * arquivo sendo lido (a área para de aceitar outro até a resposta). `tip`: a dica de onde continuar.
 * `onError`: mais de um arquivo solto de uma vez (nenhum é usado).
 */
export function StatementDropZone({ compact = false, touch = false, readingName = "", tip = null, onFile, onError = null, kind = "statement" }) {
  const copy = COPY[kind] ?? COPY.statement;
  const FORMATS = copy.formats;
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  // Entrar num filho (ícone, textos) dispara `dragleave` na área: conta entradas e saídas, e o
  // destaque só apaga quando o arquivo sai de fato da área.
  const depth = useRef(0);
  const reading = Boolean(readingName);
  // `touch` (celular): não há arrastar nem clicar, só tocar (G4, observação).
  const title = touch
    ? (compact ? `Ou toque para escolher ${copy.another}` : `Toque para escolher ${copy.what}`)
    : (compact ? `Ou solte aqui ${copy.another}` : `Solte aqui ${copy.what}`);
  const hint = touch ? "A leitura começa na hora." : "ou clique para escolher. A leitura começa na hora.";
  const compactHint = touch ? FORMATS : `ou clique para escolher · ${FORMATS}`;
  const label = reading
    ? `Lendo ${readingName}…`
    : touch
      ? `${title}. A leitura começa na hora. ${FORMATS}.`
      : `${title}. ${compact ? "Ou clique para escolher" : "Ou clique para escolher. A leitura começa na hora"}. ${FORMATS}.`;

  const choose = () => { if (!reading) inputRef.current?.click(); };
  const take = (file) => { if (file && !reading) onFile(file); };

  return (
    // Mora numa coluna (UploadArea): base `auto`, nunca fixa — uma base em px viraria ALTURA e a área
    // compacta ficaria do tamanho da grande (G4 BUG-02). Cresce só se a linha esticar a coluna.
    <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", position: "relative" }}>
      <div
        role="button"
        tabIndex={reading ? -1 : 0}
        aria-disabled={reading || undefined}
        aria-label={label}
        data-dragging={dragging || undefined}
        onClick={choose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            choose();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          depth.current += 1;
          if (!reading) setDragging(true);
        }}
        onDragOver={(e) => { e.preventDefault(); if (!reading) setDragging(true); }}
        onDragLeave={() => {
          depth.current = Math.max(0, depth.current - 1);
          if (depth.current === 0) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          depth.current = 0;
          setDragging(false);
          const files = e.dataTransfer?.files ?? [];
          if (files.length > 1) {
            if (!reading) onError?.(ONE_FILE_AT_A_TIME);
            return;
          }
          take(files[0] ?? null);
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
          <b style={{ fontSize: compact ? 16 : 20, color: T.ink }}>Lendo {readingName}…</b>
        ) : (
          <>
            <b style={{ fontSize: compact ? 16 : 20, color: T.ink }}>{title}</b>
            {compact ? (
              <span style={{ fontSize: 12, color: T.inkLight }}>{compactHint}</span>
            ) : (
              <>
                <span style={{ fontSize: 14, color: T.inkMid, maxWidth: 480 }}>{hint}</span>
                {tip ? <span style={{ ...NUM, fontSize: 13, color: T.inkMid, background: T.grayLight, borderRadius: 8, padding: "6px 10px" }}>{tip}</span> : null}
                <span style={{ fontSize: 12, color: T.inkLight }}>{FORMATS}</span>
              </>
            )}
          </>
        )}
      </div>
      {/* Fora do botão (os filhos de um botão não são anunciados): o leitor de tela diz "Lendo …". */}
      <span role="status" aria-live="polite" data-testid="drop-zone-status" style={VISUALLY_HIDDEN}>
        {reading ? `Lendo ${readingName}…` : ""}
      </span>
      <input
        ref={inputRef}
        type="file"
        aria-hidden="true"
        aria-label={copy.input}
        accept={copy.accept}
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
