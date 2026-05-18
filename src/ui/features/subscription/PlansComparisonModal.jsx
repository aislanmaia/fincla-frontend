import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";

import { handleApiError } from "../../../api/client";
import { listPlans } from "../../../api/plans";
import { changePlan } from "../../../api/subscriptions";
import { T } from "../../tokens.js";
import { G } from "../../typography.js";

function fmtBRL(cents) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Modal de comparação de planos. Catálogo é dinâmico — vem de
 * ``GET /v1/plans?audience=standard``, então adicionar/remover planos no
 * backend não exige deploy do frontend.
 *
 * Ao clicar em "Selecionar":
 *   * chamamos `changePlan({ target_plan_id, billing_cycle: "monthly" })`;
 *   * se vier `checkout_url`, redirecionamos para a URL hosted do ASAAS
 *     (mais seguro que iframe);
 *   * se vier `null`, a mudança já foi aplicada (update do gateway) — o
 *     modal fecha e o BillingPanel chama refresh() ao montar o próximo
 *     render.
 */
export function PlansComparisonModal({ currentPlanId, onClose }) {
  const [plans, setPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectingPlanId, setSelectingPlanId] = useState(null);
  const [changeError, setChangeError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const data = await listPlans("standard");
        if (!cancelled) setPlans(data);
      } catch (err) {
        if (!cancelled) setError(handleApiError(err));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSelect(planId) {
    setSelectingPlanId(planId);
    setChangeError("");
    try {
      const result = await changePlan({
        target_plan_id: planId,
        billing_cycle: "monthly",
      });
      if (result.checkout_url) {
        // Hosted checkout — leave the SPA and let ASAAS handle the rest.
        window.location.href = result.checkout_url;
        return;
      }
      // No checkout (update path) → close modal so the caller refreshes.
      onClose?.();
    } catch (err) {
      setChangeError(handleApiError(err));
    } finally {
      setSelectingPlanId(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Comparar planos"
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
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        style={{
          background: T.surface,
          borderRadius: 16,
          padding: 24,
          maxWidth: 920,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: T.inkLight,
          }}
        >
          <X size={20} />
        </button>
        <h2
          style={{
            ...G,
            margin: "0 0 6px",
            fontSize: 22,
            fontWeight: 800,
            color: T.ink,
          }}
        >
          Compare os planos
        </h2>
        <p
          style={{
            ...G,
            margin: "0 0 20px",
            fontSize: 14,
            color: T.inkMid,
          }}
        >
          Escolha o plano que melhor atende ao seu momento. Você pode
          mudar quando quiser.
        </p>

        {isLoading && (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: T.inkLight,
            }}
          >
            <Loader2 size={20} className="fincla-spin" />
            <div style={{ ...G, fontSize: 13, marginTop: 8 }}>
              Carregando planos…
            </div>
          </div>
        )}

        {error && (
          <div style={{ ...G, color: T.red, fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {changeError && (
          <div
            style={{
              ...G,
              color: T.red,
              fontSize: 13,
              marginBottom: 12,
              padding: 12,
              background: T.redLight,
              borderRadius: 10,
            }}
            role="alert"
          >
            {changeError}
          </div>
        )}

        {!isLoading && !error && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(plans.length, 3)}, 1fr)`,
              gap: 16,
            }}
          >
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlanId;
              const isSelecting = selectingPlanId === plan.id;
              return (
                <div
                  key={plan.id}
                  style={{
                    border: isCurrent
                      ? `2px solid ${T.purple}`
                      : `1px solid ${T.border}`,
                    borderRadius: 14,
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    background: isCurrent ? T.purpleLight : T.surface,
                  }}
                >
                  <div
                    style={{
                      ...G,
                      fontSize: 16,
                      fontWeight: 800,
                      color: T.ink,
                    }}
                  >
                    {plan.name}
                  </div>
                  <div
                    style={{
                      ...G,
                      fontSize: 12,
                      color: T.inkMid,
                      minHeight: 36,
                    }}
                  >
                    {plan.description}
                  </div>
                  <div
                    style={{
                      ...G,
                      fontSize: 22,
                      fontWeight: 800,
                      color: T.ink,
                    }}
                  >
                    {plan.monthly_price_cents > 0
                      ? fmtBRL(plan.monthly_price_cents)
                      : "Grátis"}
                    {plan.monthly_price_cents > 0 && (
                      <span
                        style={{
                          ...G,
                          fontSize: 12,
                          color: T.inkLight,
                          fontWeight: 600,
                        }}
                      >
                        {" "}/mês
                      </span>
                    )}
                  </div>
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: "8px 0 0",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      flex: 1,
                    }}
                  >
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        style={{
                          ...G,
                          fontSize: 12,
                          color: T.inkMid,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Check size={14} color={T.green} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => handleSelect(plan.id)}
                    disabled={isCurrent || isSelecting}
                    style={{
                      ...G,
                      marginTop: 12,
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "none",
                      background: isCurrent
                        ? T.grayLight
                        : "linear-gradient(135deg, #7C3AED, #2563EB)",
                      color: isCurrent ? T.inkLight : "white",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: isCurrent ? "default" : "pointer",
                      opacity: isSelecting ? 0.7 : 1,
                    }}
                  >
                    {isCurrent
                      ? "Plano atual"
                      : isSelecting
                        ? "Processando…"
                        : "Selecionar"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
