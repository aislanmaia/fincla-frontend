import { RotateCcw, Search, X } from "lucide-react";
import { T } from "../../tokens";
import { G } from "../../typography";

const fmtBrl = (v) =>
  "R$ " +
  Math.abs(Number(v) || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * Bloco "🔗 Linkar à compra estornada" — renderizado logo após o toggle
 * "↺ Isto é um estorno?" tanto no drawer mobile quanto desktop.
 * Mostra: card da compra linkada (se houver), botão de abrir picker, ou picker aberto.
 *
 * Só aparece quando `isEstorno && tipo === "despesa"` — caller já filtra.
 */
export function RefundLinkPanel({
  variant = "desktop",
  refundLinkedTx,
  refundPickerOpen,
  refundPickerQuery,
  refundPickerCandidates,
  refundPickerLoading,
  onOpenPicker,
  onCloseAndReset,
  onQueryChange,
  onLink,
  onUnlink,
}) {
  const fsLg = variant === "mobile" ? 13 : 12;
  const fsSm = variant === "mobile" ? 11 : 10;
  const pad = variant === "mobile" ? "12px 14px" : "10px 12px";

  if (refundLinkedTx) {
    return (
      <div style={{
        background: T.greenLight, border: `1px solid ${T.green}44`, borderRadius: 10,
        padding: pad, display: "flex", alignItems: "center", gap: 10,
      }}>
        <RotateCcw size={14} color={T.green} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...G, fontSize: fsSm, fontWeight: 700, color: T.green, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
            Estornando a compra
          </div>
          <div style={{ ...G, fontSize: fsLg, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {refundLinkedTx.desc}
          </div>
          <div style={{ ...G, fontSize: fsSm, color: T.inkMid, marginTop: 2 }}>
            {refundLinkedTx.dateLabel} · <span style={{ fontFamily: "'Geist Mono',monospace", fontWeight: 700 }}>{fmtBrl(refundLinkedTx.val)}</span>
            {refundLinkedTx.cat ? ` · ${refundLinkedTx.cat}` : ""}
          </div>
        </div>
        <button type="button" onClick={onUnlink}
          style={{ ...G, background: "transparent", border: `1px solid ${T.green}66`, color: T.green, borderRadius: 8, padding: "5px 9px", fontSize: fsSm, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
          Desvincular
        </button>
      </div>
    );
  }

  if (!refundPickerOpen) {
    return (
      <button type="button" onClick={onOpenPicker}
        style={{ ...G, display: "flex", alignItems: "center", gap: 8, padding: pad, borderRadius: 10, border: `1px dashed ${T.green}66`, background: "transparent", cursor: "pointer", textAlign: "left", color: T.green, fontSize: fsLg, fontWeight: 600 }}>
        🔗 <span>Qual a compra estornada? (opcional)</span>
      </button>
    );
  }

  return (
    <div style={{ border: `1px solid ${T.green}44`, borderRadius: 10, padding: pad, display: "flex", flexDirection: "column", gap: 8, background: T.surface }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Search size={13} color={T.inkLight} />
        <input
          autoFocus
          value={refundPickerQuery}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Buscar compra original (descrição)…"
          style={{ ...G, flex: 1, border: "none", outline: "none", background: "transparent", fontSize: fsLg, color: T.ink }}
        />
        <button type="button" onClick={onCloseAndReset}
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, color: T.inkMid }}>
          <X size={13} />
        </button>
      </div>
      {refundPickerLoading ? (
        <div style={{ ...G, fontSize: fsSm, color: T.inkLight, padding: "8px 4px" }}>Buscando…</div>
      ) : refundPickerCandidates.length === 0 ? (
        <div style={{ ...G, fontSize: fsSm, color: T.inkLight, padding: "8px 4px" }}>
          {refundPickerQuery ? "Nenhuma compra encontrada nos últimos 365 dias." : "Digite parte da descrição da compra original."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" }}>
          {refundPickerCandidates.map((c) => (
            <button key={c.id} type="button" onClick={() => onLink(c)}
              style={{ ...G, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, cursor: "pointer", textAlign: "left" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...G, fontSize: fsLg, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.desc}</div>
                <div style={{ ...G, fontSize: fsSm, color: T.inkMid, marginTop: 1 }}>
                  {c.date}{c.cat ? ` · ${c.cat}` : ""}{c.method ? ` · ${c.method}` : ""}
                </div>
              </div>
              <span style={{ ...G, fontFamily: "'Geist Mono',monospace", fontSize: fsLg, fontWeight: 700, color: T.ink, flexShrink: 0 }}>
                {fmtBrl(c.val)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
