import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

import { handleApiError } from "../../../api/client";
import { cancelSubscription } from "../../../api/subscriptions";
import { T } from "../../tokens.js";
import { G } from "../../typography.js";

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR");
}

/**
 * Diálogo de confirmação dupla para cancelamento. A intenção da segunda
 * confirmação é evitar cliques acidentais — cancelar não apaga dados, mas
 * a UX é menos surpreendente quando o usuário lê o "vai continuar até X"
 * antes de o efeito acontecer.
 */
export function CancelSubscriptionDialog({
  effectiveUntil,
  onClose,
  onCancelled,
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setIsSubmitting(true);
    setError("");
    try {
      const result = await cancelSubscription();
      onCancelled?.(result);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  const dateLabel = fmtDate(effectiveUntil);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar cancelamento"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 15, 13, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose?.();
      }}
    >
      <div
        style={{
          background: T.surface,
          borderRadius: 14,
          padding: 24,
          maxWidth: 440,
          width: "100%",
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          disabled={isSubmitting}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "transparent",
            border: "none",
            cursor: isSubmitting ? "default" : "pointer",
            color: T.inkLight,
          }}
        >
          <X size={18} />
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <AlertTriangle size={22} color={T.red} />
          <h2 style={{ ...G, margin: 0, fontSize: 18, fontWeight: 800 }}>
            Cancelar assinatura
          </h2>
        </div>
        <p style={{ ...G, fontSize: 14, color: T.inkMid, lineHeight: 1.55 }}>
          {dateLabel
            ? `Sua assinatura permanecerá ativa até ${dateLabel}. Após essa data você perderá acesso aos recursos pagos.`
            : "Sua assinatura será encerrada imediatamente e você perderá acesso aos recursos pagos."}
        </p>
        <p
          style={{
            ...G,
            fontSize: 12,
            color: T.inkLight,
            marginTop: 8,
          }}
        >
          Você pode reativar a qualquer momento escolhendo um plano novamente.
        </p>

        {error && (
          <div
            role="alert"
            style={{
              ...G,
              color: T.red,
              fontSize: 13,
              marginTop: 12,
              padding: 10,
              background: T.redLight,
              borderRadius: 8,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 18,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              ...G,
              padding: "9px 16px",
              borderRadius: 9,
              border: `1px solid ${T.border}`,
              background: T.surface,
              color: T.inkMid,
              fontSize: 13,
              fontWeight: 600,
              cursor: isSubmitting ? "default" : "pointer",
            }}
          >
            Manter assinatura
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            style={{
              ...G,
              padding: "9px 16px",
              borderRadius: 9,
              border: "none",
              background: T.red,
              color: "white",
              fontSize: 13,
              fontWeight: 700,
              cursor: isSubmitting ? "default" : "pointer",
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? "Cancelando…" : "Confirmar cancelamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
