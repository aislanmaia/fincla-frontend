import React, { useEffect, useRef } from "react";
import { T } from "../../tokens";
import { G } from "../../typography";

/** Quanto tempo a torrada fica. Curto demais e o desfazer não é alcançável. */
const DEFAULT_TTL_MS = 6000;

/**
 * Confirmação com desfazer para uma ação que acabou de acontecer na lista.
 *
 * Só aparece para ações REVERSÍVEIS. Liquidar tem volta pela própria API
 * (`unsettle`), então "desfazer" aqui é uma promessa que dá para cumprir.
 * Excluir não tem — e é por isso que a exclusão continua atrás de uma
 * confirmação em vez de ganhar uma torrada que mentiria sobre poder voltar.
 *
 * `role="status"` com `aria-live="polite"`: a mudança já aconteceu, então o
 * anúncio não deve interromper o que a pessoa está fazendo. O botão fica
 * dentro da região anunciada para ser alcançável logo depois dela.
 */
export function UndoToast({ toast, onUndo, onDismiss, ttlMs = DEFAULT_TTL_MS }) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => onDismissRef.current?.(), ttlMs);
    return () => clearTimeout(t);
    // Reinicia a contagem a cada torrada NOVA (o `id` muda). Sem depender de
    // `onDismiss`, que é recriado a cada render da página e reiniciaria o
    // relógio para sempre — a torrada nunca sumiria sozinha.
  }, [toast?.id, toast?.label, ttlMs]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fincla-toast"
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        // Acima da barra inferior do mobile, e longe do polegar em repouso.
        bottom: "max(20px, env(safe-area-inset-bottom, 0px) + 20px)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        gap: 14,
        maxWidth: "min(92vw, 460px)",
        padding: "10px 12px 10px 16px",
        borderRadius: 12,
        background: T.ink,
        color: "#fff",
        boxShadow: "0 8px 28px rgba(15,25,40,.28)",
      }}
    >
      <span
        style={{
          ...G,
          fontSize: 12.5,
          fontWeight: 600,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {toast.label}
      </span>
      <button
        type="button"
        onClick={onUndo}
        style={{
          ...G,
          flexShrink: 0,
          padding: "5px 12px",
          borderRadius: 8,
          border: "none",
          background: "rgba(255,255,255,0.16)",
          color: "#fff",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Desfazer
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fechar aviso"
        style={{
          flexShrink: 0,
          width: 24,
          height: 24,
          borderRadius: "50%",
          border: "none",
          background: "none",
          color: "rgba(255,255,255,0.65)",
          cursor: "pointer",
          fontSize: 14,
          lineHeight: 1,
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
