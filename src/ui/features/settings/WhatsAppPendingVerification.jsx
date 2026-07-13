import React, { useCallback, useEffect, useState } from "react";
import { MessageCircle, Copy, Check, RefreshCw } from "lucide-react";
import { T } from "../../tokens";
import { G } from "../../typography";

/**
 * Pending-verification card for the WhatsApp OTP flow.
 *
 * The link is not active yet: the user must send this code to the bot FROM the
 * number being verified. We show the code big, count down to its expiry, offer a
 * one-tap "open WhatsApp" deep link (code pre-filled) and a "regenerate" button.
 *
 * Purely presentational — the parent owns the pending state, the polling that
 * watches for activation, and the regenerate call.
 */
function secondsLeft(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 1000));
}

function formatCountdown(total) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function WhatsAppPendingVerification({
  code,
  phoneNumber,
  expiresAt,
  waMeUrl,
  onRegenerate,
  regenerating = false,
}) {
  const [remaining, setRemaining] = useState(() => secondsLeft(expiresAt));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setRemaining(secondsLeft(expiresAt));
    const id = setInterval(() => setRemaining(secondsLeft(expiresAt)), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  // Reset the "copied" hint without leaking a timer if the card unmounts (the
  // poll can drop the card mid-window once the number verifies).
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(id);
  }, [copied]);

  const expired = remaining <= 0;

  const handleCopy = useCallback(async () => {
    if (!navigator.clipboard) return; // no clipboard → the code is on screen
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      /* permission denied — the code is on screen to copy by hand */
    }
  }, [code]);

  return (
    <div
      style={{
        padding: "18px 24px",
        borderBottom: `1px solid ${T.border}`,
        background: T.blueLight,
      }}
      data-testid="whatsapp-pending-verification"
    >
      <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.blue, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
        Verificação pendente
      </div>
      <div style={{ ...G, fontSize: 13, color: T.inkMid, lineHeight: 1.6, marginBottom: 14 }}>
        {expired ? (
          <>Este código expirou. Gere um novo para continuar a verificação.</>
        ) : (
          <>
            Envie o código abaixo para o assistente pelo WhatsApp,{" "}
            <strong style={{ color: T.ink }}>a partir do número {phoneNumber}</strong>. Assim que
            recebermos o código, o número é verificado e ativado.
          </>
        )}
      </div>

      {/* The code */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div
          style={{
            ...G,
            fontFamily: "'Geist Mono',monospace",
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: "0.28em",
            color: expired ? T.inkGhost : T.ink,
            background: T.surface,
            border: `1.5px solid ${T.border}`,
            borderRadius: 11,
            padding: "10px 18px",
          }}
          // Space the digits so a screen reader reads "1 2 3 4 5 6", not a single
          // large number — and so the value is announced at all (a bare label
          // would replace the content).
          aria-label={`Código de verificação: ${code.split("").join(" ")}`}
        >
          {code}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          disabled={expired}
          aria-label="Copiar código"
          style={{
            ...G,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 700,
            color: copied ? T.green : T.inkMid,
            background: copied ? T.greenLight : T.surface,
            border: `1.5px solid ${copied ? T.greenBorder : T.border}`,
            borderRadius: 9,
            padding: "9px 12px",
            cursor: expired ? "default" : "pointer",
            opacity: expired ? 0.5 : 1,
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copiado" : "Copiar"}
        </button>
        {/* role="timer" alone; NO aria-live on the per-second tick or a screen
            reader would announce every second. */}
        <div
          style={{ ...G, fontSize: 12, fontWeight: 700, color: expired ? T.red : T.inkLight }}
          role="timer"
        >
          {expired ? "Código expirado" : `Expira em ${formatCountdown(remaining)}`}
        </div>
        {/* One-shot announcements for state changes, kept out of the ticking region. */}
        <span aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          {copied ? "Código copiado" : expired ? "Código expirado" : ""}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {!expired && (
          <a
            href={waMeUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...G,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              background: T.green,
              border: "none",
              borderRadius: 9,
              padding: "10px 16px",
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            <MessageCircle size={15} /> Abrir no WhatsApp
          </a>
        )}
        <button
          type="button"
          onClick={onRegenerate}
          disabled={regenerating}
          style={{
            ...G,
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontSize: 13,
            fontWeight: 700,
            color: T.inkMid,
            background: T.surface,
            border: `1.5px solid ${T.border}`,
            borderRadius: 9,
            padding: "10px 14px",
            cursor: regenerating ? "default" : "pointer",
            opacity: regenerating ? 0.6 : 1,
          }}
        >
          <RefreshCw size={14} /> {regenerating ? "Gerando…" : "Gerar novo código"}
        </button>
      </div>
    </div>
  );
}

export default WhatsAppPendingVerification;
