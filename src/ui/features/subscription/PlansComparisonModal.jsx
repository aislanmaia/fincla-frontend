import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Star, X } from "lucide-react";

import { getApiErrorCode, handleApiError } from "../../../api/client";
import { listPlans } from "../../../api/plans";
import { changePlan } from "../../../api/subscriptions";
import {
  FEATURE_GROUPS,
  PLAN_COMPARISON_FEATURES,
  getFeatureCopy,
} from "../entitlements/featureCopy.js";
import { T } from "../../tokens.js";
import { G } from "../../typography.js";
import { CpfInputDialog } from "./CpfInputDialog.jsx";

const RECOMMENDED_PLAN_ID = "pro";

function fmtBRL(cents) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function yearlyDiscountPercent(monthlyCents, yearlyCents) {
  if (!monthlyCents || !yearlyCents) return null;
  const fullYear = monthlyCents * 12;
  if (fullYear <= 0) return null;
  return Math.round(((fullYear - yearlyCents) / fullYear) * 100);
}

/**
 * Modal de comparação de planos. Catálogo é dinâmico — vem de
 * ``GET /v1/plans?audience=standard``, então adicionar/remover planos no
 * backend não exige deploy do frontend.
 *
 * Ao clicar em "Selecionar":
 *   * chamamos `changePlan({ target_plan_id, billing_cycle })`;
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
  const [billingCycle, setBillingCycle] = useState("monthly");
  // CPF flow: opens when the backend returns ``code: "cpf_required"`` —
  // the user is finishing their first upgrade and ASAAS doesn't have
  // their document yet.
  const [pendingCpfPlanId, setPendingCpfPlanId] = useState(null);
  const [cpfError, setCpfError] = useState("");

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

  const maxYearlyDiscount = useMemo(() => {
    const discounts = plans
      .map((p) => yearlyDiscountPercent(p.monthly_price_cents, p.yearly_price_cents))
      .filter((d) => d !== null);
    return discounts.length ? Math.max(...discounts) : null;
  }, [plans]);

  async function submitChange(planId, cpfCnpj) {
    setSelectingPlanId(planId);
    setChangeError("");
    setCpfError("");
    try {
      const payload = {
        target_plan_id: planId,
        billing_cycle: billingCycle,
      };
      if (cpfCnpj) {
        payload.cpf_cnpj = cpfCnpj;
      }
      const result = await changePlan(payload);
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
        return;
      }
      // Update path (no checkout): clear pending state and close.
      setPendingCpfPlanId(null);
      onClose?.();
    } catch (err) {
      if (getApiErrorCode(err) === "cpf_required") {
        setPendingCpfPlanId(planId);
        // Only surface the API message inside the CPF dialog if we were
        // already in the CPF flow (i.e., user typed an invalid one).
        if (cpfCnpj) {
          setCpfError(handleApiError(err));
        }
        return;
      }
      setChangeError(handleApiError(err));
    } finally {
      setSelectingPlanId(null);
    }
  }

  function handleSelect(planId) {
    return submitChange(planId);
  }

  function handleCpfSubmit(cpfDigits) {
    if (!pendingCpfPlanId) return;
    return submitChange(pendingCpfPlanId, cpfDigits);
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
          padding: 28,
          maxWidth: 920,
          width: "100%",
          maxHeight: "90dvh",
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
          Escolha seu plano
        </h2>
        <p
          style={{
            ...G,
            margin: "0 0 20px",
            fontSize: 13,
            color: T.inkMid,
          }}
        >
          Você pode mudar a qualquer momento.
        </p>

        <BillingCycleToggle
          value={billingCycle}
          onChange={setBillingCycle}
          yearlyDiscountPercentValue={maxYearlyDiscount}
        />

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

        {!isLoading && !error && plans.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(plans.length, 2)}, 1fr)`,
              gap: 16,
              marginTop: 20,
            }}
          >
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                billingCycle={billingCycle}
                isCurrent={plan.id === currentPlanId}
                isRecommended={plan.id === RECOMMENDED_PLAN_ID}
                isSelecting={selectingPlanId === plan.id}
                onSelect={() => handleSelect(plan.id)}
              />
            ))}
          </div>
        )}
      </div>
      {pendingCpfPlanId && (
        <CpfInputDialog
          isSubmitting={selectingPlanId === pendingCpfPlanId}
          errorMessage={cpfError}
          onSubmit={handleCpfSubmit}
          onClose={() => {
            setPendingCpfPlanId(null);
            setCpfError("");
          }}
        />
      )}
    </div>
  );
}

function BillingCycleToggle({ value, onChange, yearlyDiscountPercentValue }) {
  return (
    <div
      role="tablist"
      aria-label="Ciclo de cobrança"
      style={{
        display: "inline-flex",
        background: T.bg,
        borderRadius: 999,
        padding: 4,
        gap: 4,
        margin: "0 auto",
        position: "relative",
        left: "50%",
        transform: "translateX(-50%)",
      }}
    >
      <CycleButton
        active={value === "monthly"}
        onClick={() => onChange("monthly")}
        label="Mensal"
      />
      <CycleButton
        active={value === "yearly"}
        onClick={() => onChange("yearly")}
        label={
          yearlyDiscountPercentValue
            ? `Anual -${yearlyDiscountPercentValue}%`
            : "Anual"
        }
      />
    </div>
  );
}

function CycleButton({ active, onClick, label }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        ...G,
        padding: "8px 18px",
        borderRadius: 999,
        border: "none",
        background: active ? T.surface : "transparent",
        color: active ? T.ink : T.inkMid,
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

function PlanCard({
  plan,
  billingCycle,
  isCurrent,
  isRecommended,
  isSelecting,
  onSelect,
}) {
  const showYearly =
    billingCycle === "yearly" && plan.yearly_price_cents != null;
  const priceCents = showYearly
    ? plan.yearly_price_cents
    : plan.monthly_price_cents;
  const discount = yearlyDiscountPercent(
    plan.monthly_price_cents,
    plan.yearly_price_cents,
  );

  return (
    <div
      style={{
        border: isRecommended
          ? `2px solid ${T.purple}`
          : `1px solid ${T.border}`,
        borderRadius: 14,
        padding: 22,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        background: T.surface,
        position: "relative",
      }}
    >
      {isRecommended && (
        <span
          style={{
            ...G,
            position: "absolute",
            top: -12,
            right: 16,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 10px",
            borderRadius: 999,
            background: "linear-gradient(135deg, #7C3AED, #2563EB)",
            color: "white",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          <Star size={10} fill="white" />
          Popular
        </span>
      )}

      <div>
        <div
          style={{
            ...G,
            fontSize: 18,
            fontWeight: 800,
            color: T.ink,
            marginBottom: 4,
          }}
        >
          {plan.name}
        </div>
        <div
          style={{
            ...G,
            fontSize: 12,
            color: T.inkMid,
            minHeight: 32,
            lineHeight: 1.4,
          }}
        >
          {plan.description}
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${T.border}` }} />

      <PriceBlock
        priceCents={priceCents}
        billingCycle={billingCycle}
        yearlyCents={plan.yearly_price_cents}
        monthlyCents={plan.monthly_price_cents}
        discount={discount}
        showYearly={showYearly}
      />

      <button
        type="button"
        onClick={onSelect}
        disabled={isCurrent || isSelecting}
        data-testid={`plan-select-${plan.id}`}
        style={{
          ...G,
          padding: "12px 14px",
          borderRadius: 10,
          border: "none",
          background: isCurrent
            ? T.bg
            : isRecommended
              ? "linear-gradient(135deg, #7C3AED, #2563EB)"
              : T.ink,
          color: isCurrent ? T.inkMid : "white",
          fontSize: 13,
          fontWeight: 700,
          cursor: isCurrent ? "default" : "pointer",
          opacity: isSelecting ? 0.7 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        {isCurrent ? (
          <>
            Plano atual <Check size={14} />
          </>
        ) : isSelecting ? (
          <>
            <Loader2 size={14} className="fincla-spin" />
            Processando…
          </>
        ) : (
          <>
            {isRecommended ? "Fazer upgrade" : "Selecionar plano"}
            <span aria-hidden>→</span>
          </>
        )}
      </button>

      <FeatureGroups plan={plan} />

      <div style={{ borderTop: `1px solid ${T.border}` }} />
      <div style={{ ...G, fontSize: 12, color: T.inkMid }}>
        {plan.max_organizations === 1
          ? "1 organização"
          : `${plan.max_organizations} organizações`}{" "}
        ·{" "}
        {plan.max_users_per_org === 1
          ? "1 membro"
          : `até ${plan.max_users_per_org} membros`}
      </div>
    </div>
  );
}

function PriceBlock({
  priceCents,
  billingCycle,
  yearlyCents,
  monthlyCents,
  discount,
  showYearly,
}) {
  if (priceCents === 0) {
    return (
      <div
        style={{
          ...G,
          fontSize: 24,
          fontWeight: 800,
          color: T.ink,
        }}
      >
        Grátis
      </div>
    );
  }

  // Yearly mode com preço anual conhecido: destaque o /mês equivalente
  // ("menos por mais"). O total anual e a economia em valor absoluto
  // ficam como subtexto para o usuário não confundir com cobrança mensal.
  if (showYearly && yearlyCents != null) {
    const monthlyEquivalent = Math.round(yearlyCents / 12);
    const annualSavings = monthlyCents * 12 - yearlyCents;
    return (
      <div>
        <div style={{ ...G, fontSize: 26, fontWeight: 800, color: T.ink }}>
          {fmtBRL(monthlyEquivalent)}
          <span
            style={{
              ...G,
              fontSize: 13,
              color: T.inkLight,
              fontWeight: 600,
              marginLeft: 4,
            }}
          >
            /mês
          </span>
        </div>
        <div
          style={{
            ...G,
            fontSize: 12,
            color: T.inkMid,
            marginTop: 4,
            lineHeight: 1.5,
          }}
        >
          Cobrado {fmtBRL(yearlyCents)} anualmente
          {annualSavings > 0 && (
            <>
              {" · "}
              <span style={{ color: T.green, fontWeight: 600 }}>
                economia de {fmtBRL(annualSavings)}
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  // Monthly mode (default) ou yearly sem plano anual definido
  return (
    <div>
      <div style={{ ...G, fontSize: 26, fontWeight: 800, color: T.ink }}>
        {fmtBRL(priceCents)}
        <span
          style={{
            ...G,
            fontSize: 13,
            color: T.inkLight,
            fontWeight: 600,
            marginLeft: 4,
          }}
        >
          /mês
        </span>
      </div>
      {billingCycle === "monthly" && yearlyCents != null && (
        <div
          style={{
            ...G,
            fontSize: 12,
            color: T.inkMid,
            marginTop: 4,
          }}
        >
          ou {fmtBRL(yearlyCents)}/ano{" "}
          {discount ? `(-${discount}%)` : null}
        </div>
      )}
      {billingCycle === "yearly" && yearlyCents == null && monthlyCents > 0 && (
        <div
          style={{
            ...G,
            fontSize: 12,
            color: T.inkMid,
            marginTop: 4,
          }}
        >
          (cobrança mensal — sem plano anual)
        </div>
      )}
    </div>
  );
}

function FeatureGroups({ plan }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {FEATURE_GROUPS.map((group) => (
        <FeatureGroupBlock key={group.key} group={group} plan={plan} />
      ))}
    </div>
  );
}

function FeatureGroupBlock({ group, plan }) {
  const keys = PLAN_COMPARISON_FEATURES[group.key] ?? [];
  if (keys.length === 0) return null;

  return (
    <div>
      <div
        style={{
          ...G,
          fontSize: 10,
          fontWeight: 700,
          color: T.inkLight,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 6,
        }}
      >
        {group.label}
      </div>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {keys.map((key) => {
          const has = plan.features.includes(key);
          return (
            <li
              key={key}
              style={{
                ...G,
                fontSize: 13,
                color: has ? T.inkMid : T.inkGhost,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {has ? (
                <Check size={14} color={T.green} aria-label="incluído" />
              ) : (
                <X size={14} color={T.inkGhost} aria-label="não incluído" />
              )}
              <span
                style={{
                  textDecoration: has ? "none" : "line-through",
                  textDecorationColor: T.inkGhost,
                }}
              >
                {getFeatureCopy(key).label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
