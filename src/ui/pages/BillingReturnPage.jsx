import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Loader2 } from "lucide-react";

import { getCurrentSubscription } from "../../api/subscriptions.js";
import { handleApiError } from "../../api/client.ts";
import { T } from "../tokens.js";
import { G } from "../typography.js";

const POLL_INTERVAL_MS = 3000;
const POLL_DEADLINE_MS = 30000;

/**
 * Rota pós-checkout. ASAAS redireciona o usuário aqui depois que ele paga
 * (ou desiste) e a página espera o webhook chegar — fazendo polling no
 * `GET /v1/subscriptions/me`. Quando o status sai de `pending_payment` para
 * `active`, volta para `/profile/billing` com um toast simples.
 *
 * Após `POLL_DEADLINE_MS` (30s) sem confirmação, mostramos a mensagem
 * "estamos processando" — pode acontecer se o webhook ASAAS demorar
 * (ordering, retries) e o usuário não precisa ficar travado na UI.
 */
export function BillingReturnPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("polling"); // polling | activated | timeout | error
  const [error, setError] = useState("");
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    const startedAt = Date.now();
    let timeoutId = null;

    async function tick() {
      if (cancelledRef.current) return;
      try {
        const sub = await getCurrentSubscription();
        if (cancelledRef.current) return;
        if (sub?.status === "active") {
          setPhase("activated");
          // Pequena pausa para o usuário ver a mensagem antes de navegar.
          setTimeout(() => {
            if (!cancelledRef.current) {
              navigate({ to: "/profile/billing", replace: true });
            }
          }, 1200);
          return;
        }
        if (Date.now() - startedAt >= POLL_DEADLINE_MS) {
          setPhase("timeout");
          return;
        }
        timeoutId = setTimeout(tick, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelledRef.current) return;
        setError(handleApiError(err));
        setPhase("error");
      }
    }

    tick();

    return () => {
      cancelledRef.current = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [navigate]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: "100%",
          padding: 28,
          borderRadius: 16,
          background: T.surface,
          border: `1px solid ${T.border}`,
          textAlign: "center",
        }}
      >
        {phase === "polling" && (
          <>
            <Loader2 size={28} color={T.purple} />
            <h2
              style={{
                ...G,
                margin: "12px 0 6px",
                fontSize: 20,
                fontWeight: 800,
              }}
            >
              Confirmando pagamento…
            </h2>
            <p
              style={{
                ...G,
                margin: 0,
                fontSize: 14,
                color: T.inkMid,
                lineHeight: 1.5,
              }}
            >
              Estamos validando seu pagamento junto à ASAAS. Isso
              normalmente leva alguns segundos.
            </p>
          </>
        )}

        {phase === "activated" && (
          <>
            <CheckCircle2 size={28} color={T.green} />
            <h2
              style={{
                ...G,
                margin: "12px 0 6px",
                fontSize: 20,
                fontWeight: 800,
                color: T.green,
              }}
            >
              Plano ativado!
            </h2>
            <p
              style={{
                ...G,
                margin: 0,
                fontSize: 14,
                color: T.inkMid,
              }}
            >
              Tudo pronto. Levando você para a página de Assinatura…
            </p>
          </>
        )}

        {phase === "timeout" && (
          <>
            <h2
              style={{
                ...G,
                margin: "0 0 8px",
                fontSize: 20,
                fontWeight: 800,
              }}
            >
              Pagamento em processamento
            </h2>
            <p
              style={{
                ...G,
                margin: 0,
                fontSize: 14,
                color: T.inkMid,
                lineHeight: 1.55,
              }}
            >
              Ainda não recebemos a confirmação da ASAAS. Você receberá
              um e-mail assim que o pagamento for aprovado e pode
              acompanhar pela aba Assinatura.
            </p>
            <button
              type="button"
              onClick={() =>
                navigate({ to: "/profile/billing", replace: true })
              }
              style={{
                ...G,
                marginTop: 18,
                padding: "10px 16px",
                borderRadius: 9,
                border: "none",
                background: "linear-gradient(135deg, #7C3AED, #2563EB)",
                color: "white",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Voltar para Assinatura
            </button>
          </>
        )}

        {phase === "error" && (
          <>
            <h2
              style={{
                ...G,
                margin: "0 0 8px",
                fontSize: 20,
                fontWeight: 800,
                color: T.red,
              }}
            >
              Erro ao confirmar pagamento
            </h2>
            <p
              style={{
                ...G,
                margin: 0,
                fontSize: 14,
                color: T.inkMid,
              }}
            >
              {error || "Tente novamente em instantes."}
            </p>
            <button
              type="button"
              onClick={() =>
                navigate({ to: "/profile/billing", replace: true })
              }
              style={{
                ...G,
                marginTop: 18,
                padding: "10px 16px",
                borderRadius: 9,
                border: `1px solid ${T.border}`,
                background: T.surface,
                color: T.inkMid,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Voltar para Assinatura
            </button>
          </>
        )}
      </div>
    </div>
  );
}
