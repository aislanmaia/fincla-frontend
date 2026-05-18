import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck, X } from "lucide-react";

import { T } from "../../tokens.js";
import { G } from "../../typography.js";

/**
 * Dialog que coleta CPF (ou CNPJ) quando o usuário tenta contratar pela
 * primeira vez e o backend sinaliza ``code: "cpf_required"``.
 *
 * Não persistimos o documento localmente — fica só na requisição. A cópia
 * cita o gateway de pagamento (ASAAS) para deixar claro o destino do
 * dado, alinhado com LGPD.
 *
 * O input aceita CPF (11 dígitos) ou CNPJ (14), com máscara automática.
 * Validação leve: só conta dígitos, não conferimos DV — o gateway faz.
 */
export function CpfInputDialog({
  isSubmitting = false,
  errorMessage = "",
  onSubmit,
  onClose,
}) {
  const [raw, setRaw] = useState("");
  const [touched, setTouched] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const digits = raw.replace(/\D/g, "").slice(0, 14);
  const formatted = formatDocument(digits);
  const isValid = digits.length === 11 || digits.length === 14;
  const showValidationError = touched && !isValid && digits.length > 0;

  function handleSubmit(event) {
    event.preventDefault();
    setTouched(true);
    if (!isValid || isSubmitting) return;
    onSubmit?.(digits);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Informe seu CPF ou CNPJ"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 15, 13, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose?.();
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: T.surface,
          borderRadius: 16,
          padding: 28,
          maxWidth: 440,
          width: "100%",
          position: "relative",
          boxShadow: T.lg,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          disabled={isSubmitting}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "transparent",
            border: "none",
            cursor: isSubmitting ? "default" : "pointer",
            color: T.inkLight,
            opacity: isSubmitting ? 0.5 : 1,
          }}
        >
          <X size={20} />
        </button>

        <h2
          style={{
            ...G,
            margin: "0 0 8px",
            fontSize: 20,
            fontWeight: 800,
            color: T.ink,
          }}
        >
          Antes de continuar
        </h2>
        <p
          style={{
            ...G,
            margin: "0 0 20px",
            fontSize: 13,
            color: T.inkMid,
            lineHeight: 1.5,
          }}
        >
          Precisamos do seu CPF ou CNPJ para criar a cobrança no nosso
          parceiro de pagamento. O dado é enviado direto para o gateway —
          não armazenamos no Fincla.
        </p>

        <label
          htmlFor="cpf-cnpj-input"
          style={{
            ...G,
            display: "block",
            fontSize: 12,
            fontWeight: 600,
            color: T.inkMid,
            marginBottom: 6,
          }}
        >
          CPF ou CNPJ
        </label>
        <input
          id="cpf-cnpj-input"
          ref={inputRef}
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          value={formatted}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={() => setTouched(true)}
          disabled={isSubmitting}
          aria-invalid={showValidationError ? "true" : "false"}
          style={{
            ...G,
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${showValidationError ? T.red : T.border}`,
            fontSize: 14,
            fontFamily: "'Geist Mono', monospace",
            color: T.ink,
            background: isSubmitting ? T.bg : T.surface,
            outline: "none",
          }}
        />
        {showValidationError && (
          <div
            style={{
              ...G,
              fontSize: 12,
              color: T.red,
              marginTop: 6,
            }}
          >
            Informe 11 dígitos (CPF) ou 14 dígitos (CNPJ).
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            style={{
              ...G,
              fontSize: 13,
              color: T.red,
              background: T.redLight,
              padding: "10px 12px",
              borderRadius: 10,
              marginTop: 12,
            }}
          >
            {errorMessage}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 16,
            color: T.inkLight,
            ...G,
            fontSize: 11,
          }}
        >
          <ShieldCheck size={14} color={T.green} />
          Seu CPF/CNPJ é tratado pelo gateway parceiro conforme a LGPD.
        </div>

        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          data-testid="cpf-dialog-submit"
          style={{
            ...G,
            marginTop: 20,
            padding: "12px 14px",
            borderRadius: 10,
            border: "none",
            background:
              !isValid || isSubmitting
                ? T.bg
                : "linear-gradient(135deg, #7C3AED, #2563EB)",
            color: !isValid || isSubmitting ? T.inkLight : "white",
            fontSize: 14,
            fontWeight: 700,
            width: "100%",
            cursor: !isValid || isSubmitting ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={14} className="fincla-spin" /> Processando…
            </>
          ) : (
            <>Continuar para o pagamento</>
          )}
        </button>
      </form>
    </div>
  );
}

function formatDocument(digits) {
  if (digits.length <= 11) {
    // CPF mask: 000.000.000-00
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  // CNPJ mask: 00.000.000/0000-00
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}
