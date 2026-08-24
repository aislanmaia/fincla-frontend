import React from "react";
import { T } from "../../tokens";
import { G } from "../../typography";

/**
 * A pergunta defensiva de uma ação que muda dado — excluir ou liquidar.
 *
 * O conteúdo é o MESMO nas duas superfícies; o que muda é a moldura. No
 * desktop ela vai num modal, porque a linha tem 48 px e a pergunta não cabe
 * ali sem espremer o valor e a situação. No mobile ela toma o lugar do
 * conteúdo da sanfona, que já está aberta e já é o foco da tela — abrir um
 * modal por cima de uma camada seria uma camada a mais para ler e para sair.
 *
 * Fechar a sanfona CANCELA: quem sai de onde perguntou não respondeu.
 */
export const CONFIRM_COPY = {
  delete: {
    title: (desc) => `Excluir “${desc}”?`,
    detail: "O lançamento sai da lista e do saldo. Não dá para desfazer.",
    confirm: "🗑 Excluir",
    danger: true,
  },
  settle: {
    title: (desc) => `Marcar “${desc}” como pago?`,
    detail: "O valor passa a contar no saldo da conta a partir de hoje.",
    confirm: "✓ Marcar como pago",
    danger: false,
  },
  unsettle: {
    title: (desc) => `Desfazer o pagamento de “${desc}”?`,
    detail: "O lançamento volta a ser um compromisso e sai do saldo.",
    confirm: "↺ Desfazer pagamento",
    danger: false,
  },
};

export function ConfirmActionInline({ kind, desc, busy = false, onConfirm, onCancel }) {
  const copy = CONFIRM_COPY[kind];
  if (!copy) return null;
  const tone = copy.danger ? T.red : T.ink;

  return (
    <div
      role="alertdialog"
      aria-label={copy.title(desc)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "14px 16px",
        background: copy.danger ? T.redLight : T.bg,
        borderRadius: 12,
      }}
    >
      <div style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink }}>
        {copy.title(desc)}
      </div>
      <div style={{ ...G, fontSize: 12, color: T.inkMid, lineHeight: 1.45 }}>{copy.detail}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCancel?.();
          }}
          style={{
            ...G,
            height: 38,
            padding: "0 14px",
            borderRadius: 9,
            border: `1px solid ${T.border}`,
            background: T.surface,
            color: T.inkMid,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            onConfirm?.();
          }}
          style={{
            ...G,
            height: 38,
            padding: "0 14px",
            borderRadius: 9,
            border: `1px solid ${tone}`,
            background: copy.danger ? T.surface : tone,
            color: copy.danger ? tone : "#fff",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "…" : copy.confirm}
        </button>
      </div>
    </div>
  );
}

/**
 * A mesma pergunta, num modal — a moldura do DESKTOP.
 *
 * Por que modal e não a sanfona: no desktop a ação rápida vive na linha, e a
 * linha tem 48 px. Abrir a sanfona só para perguntar move a lista inteira sob
 * o cursor e esconde a resposta atrás de uma animação de expansão. O modal
 * pergunta onde o olho já está.
 *
 * Esc cancela e o foco começa no CANCELAR, não no confirmar: quem abriu por
 * engano sai apertando Enter, e o caminho mais provável não pode ser o
 * destrutivo.
 */
export function ConfirmActionModal({ kind, desc, busy = false, onConfirm, onCancel }) {
  const copy = CONFIRM_COPY[kind];
  const cancelarRef = React.useRef(null);

  React.useEffect(() => {
    cancelarRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel?.();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  if (!copy) return null;
  const tone = copy.danger ? T.red : T.ink;

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 900,
        background: "rgba(15,23,42,.34)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={copy.title(desc)}
        onClick={(e) => e.stopPropagation()}
        style={{
          ...G,
          width: "min(420px, 100%)",
          background: T.surface,
          borderRadius: 16,
          boxShadow: "0 24px 64px rgba(15,23,42,.22)",
          padding: "20px 22px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ ...G, fontSize: 16, fontWeight: 800, color: T.ink, lineHeight: 1.3 }}>
          {copy.title(desc)}
        </div>
        <div style={{ ...G, fontSize: 13, color: T.inkMid, lineHeight: 1.5 }}>{copy.detail}</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
          <button
            ref={cancelarRef}
            type="button"
            onClick={onCancel}
            style={{
              ...G, height: 38, padding: "0 16px", borderRadius: 9,
              border: `1px solid ${T.border}`, background: T.surface, color: T.inkMid,
              fontSize: 12.5, fontWeight: 700, cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            style={{
              ...G, height: 38, padding: "0 16px", borderRadius: 9,
              border: `1px solid ${tone}`,
              background: copy.danger ? tone : T.ink,
              color: "#fff", fontSize: 12.5, fontWeight: 700,
              cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "…" : copy.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
