import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  Sparkles,
} from "lucide-react";

import { T } from "../../tokens.js";
import { G } from "../../typography.js";
import { useSubscriptionData } from "./useSubscriptionData.js";
import { PlansComparisonModal } from "./PlansComparisonModal.jsx";
import { CancelSubscriptionDialog } from "./CancelSubscriptionDialog.jsx";

const STATUS_TO_STYLE = {
  active: { label: "Ativo", bg: T.greenLight, color: T.green },
  pending_payment: {
    label: "Aguardando pagamento",
    bg: T.amberLight,
    color: T.amber,
  },
  past_due: { label: "Em atraso", bg: T.redLight, color: T.red },
  cancelled: { label: "Cancelado", bg: T.grayLight, color: T.inkLight },
  expired: { label: "Expirado", bg: T.grayLight, color: T.inkLight },
};

const INVOICE_STATUS_LABEL = {
  paid: { label: "Paga", color: T.green },
  pending: { label: "Pendente", color: T.amber },
  overdue: { label: "Em atraso", color: T.red },
  refunded: { label: "Reembolsada", color: T.inkLight },
  cancelled: { label: "Cancelada", color: T.inkLight },
};

function fmtBRL(cents) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function StatusBadge({ status }) {
  const style = STATUS_TO_STYLE[status] ?? STATUS_TO_STYLE.active;
  return (
    <span
      style={{
        ...G,
        fontSize: 12,
        fontWeight: 700,
        background: style.bg,
        color: style.color,
        padding: "4px 12px",
        borderRadius: 99,
      }}
    >
      {style.label}
    </span>
  );
}

function CancelBanner({ effectiveUntil }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderRadius: 10,
        background: T.amberLight,
        border: `1px solid ${T.amber}`,
        marginBottom: 12,
      }}
      role="alert"
    >
      <AlertTriangle size={18} color={T.amber} />
      <div style={{ ...G, fontSize: 13, color: T.ink, flex: 1 }}>
        Sua assinatura termina em <strong>{fmtDate(effectiveUntil)}</strong>.
        Você manterá acesso até essa data.
      </div>
    </div>
  );
}

function FeatureChips({ features }) {
  if (!features || features.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        marginTop: 12,
      }}
    >
      {features.map((feature) => (
        <span
          key={feature}
          style={{
            ...G,
            fontSize: 11,
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: 99,
            background: T.purpleLight,
            color: T.purple,
          }}
        >
          <Sparkles
            size={10}
            color={T.purple}
            style={{ marginRight: 4, verticalAlign: "middle" }}
          />
          {feature}
        </span>
      ))}
    </div>
  );
}

function InvoicesList({ invoices }) {
  if (!invoices.length) {
    return (
      <div
        style={{
          padding: "20px 24px",
          textAlign: "center",
          color: T.inkLight,
          ...G,
          fontSize: 13,
        }}
      >
        Nenhuma fatura emitida ainda.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {invoices.map((inv) => {
        const stat =
          INVOICE_STATUS_LABEL[inv.status] ?? INVOICE_STATUS_LABEL.pending;
        return (
          <div
            key={inv.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 24px",
              borderTop: `1px solid ${T.border}`,
            }}
          >
            <div>
              <div
                style={{
                  ...G,
                  fontSize: 13,
                  fontWeight: 600,
                  color: T.ink,
                }}
              >
                {inv.description || "Fatura"}
              </div>
              <div style={{ ...G, fontSize: 11, color: T.inkLight }}>
                Vencimento {fmtDate(inv.due_date)} ·{" "}
                <span style={{ color: stat.color, fontWeight: 600 }}>
                  {stat.label}
                </span>
              </div>
            </div>
            <div
              style={{ display: "flex", alignItems: "center", gap: 12 }}
            >
              <span
                style={{
                  ...G,
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 13,
                  fontWeight: 700,
                  color: T.ink,
                }}
              >
                {fmtBRL(inv.amount_cents)}
              </span>
              {inv.invoice_url && (
                <a
                  href={inv.invoice_url}
                  target="_blank"
                  rel="noreferrer"
                  title="Abrir fatura"
                  style={{ color: T.blue }}
                >
                  <ExternalLink size={16} />
                </a>
              )}
              {inv.pdf_url && (
                <a
                  href={inv.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  title="Baixar PDF"
                  style={{ color: T.blue }}
                >
                  <Download size={16} />
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * BillingPanel renderiza toda a aba "Assinatura" em /profile/billing.
 *
 * Recebe `SectionCard` e `SectionHeader` por prop para evitar acoplamento
 * com o ConfiguracoesPage (esses componentes são definidos localmente lá
 * e re-uso evita duplicar o estilo). Cancel + change-plan abrem modais
 * locais — quem dispara a navegação pós-checkout é o `BillingReturnPage`.
 */
export function BillingPanel({ SectionCard, SectionHeader, dataMode = "live" }) {
  const enabled = dataMode === "live";
  const { subscription, isLoading, error, refresh } = useSubscriptionData({
    enabled,
  });
  const [comparingPlans, setComparingPlans] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  if (!enabled) {
    return (
      <SectionCard>
        <SectionHeader
          icon={<CreditCard size={16} color={T.purple} />}
          title="Assinatura"
          sub="Disponível apenas com a sessão ativa"
        />
        <div style={{ padding: 24, color: T.inkLight, ...G, fontSize: 13 }}>
          Faça login para ver os detalhes da sua assinatura.
        </div>
      </SectionCard>
    );
  }

  if (isLoading && !subscription) {
    return (
      <SectionCard>
        <SectionHeader
          icon={<CreditCard size={16} color={T.purple} />}
          title="Assinatura"
          sub="Carregando…"
        />
        <div style={{ padding: 24, color: T.inkLight, ...G, fontSize: 13 }}>
          Carregando dados do plano…
        </div>
      </SectionCard>
    );
  }

  if (error || !subscription) {
    return (
      <SectionCard>
        <SectionHeader
          icon={<AlertTriangle size={16} color={T.red} />}
          title="Assinatura"
          sub="Erro ao carregar"
        />
        <div style={{ padding: 24, ...G, fontSize: 13 }}>
          <div style={{ color: T.red, marginBottom: 12 }}>
            {error || "Não foi possível carregar sua assinatura."}
          </div>
          <button
            type="button"
            onClick={refresh}
            style={{
              ...G,
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: T.surface,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Tentar novamente
          </button>
        </div>
      </SectionCard>
    );
  }

  const { plan, status, cancel_at_period_end: cancelling } = subscription;
  const monthlyPrice =
    plan.monthly_price_cents > 0
      ? `${fmtBRL(plan.monthly_price_cents)}/mês`
      : "Plano gratuito";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionCard>
        <SectionHeader
          icon={<CreditCard size={16} color={T.purple} />}
          title="Assinatura"
          sub="Detalhes do seu plano atual"
        />
        <div
          style={{
            padding: "16px 24px",
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          {cancelling && (
            <CancelBanner
              effectiveUntil={subscription.current_period_end}
            />
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div>
              <div
                style={{
                  ...G,
                  fontSize: 16,
                  fontWeight: 800,
                  color: T.ink,
                  marginBottom: 3,
                }}
              >
                {plan.name}
              </div>
              <div style={{ ...G, fontSize: 13, color: T.inkMid }}>
                {plan.description || monthlyPrice}
              </div>
            </div>
            <StatusBadge status={status} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <div
              style={{
                background: T.bg,
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <div style={{ ...G, fontSize: 11, color: T.inkMid }}>
                Organizações
              </div>
              <div
                style={{
                  ...G,
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 16,
                  fontWeight: 700,
                  color: T.ink,
                  marginTop: 4,
                }}
              >
                até {plan.max_organizations}
              </div>
            </div>
            <div
              style={{
                background: T.bg,
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <div style={{ ...G, fontSize: 11, color: T.inkMid }}>
                Membros por organização
              </div>
              <div
                style={{
                  ...G,
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 16,
                  fontWeight: 700,
                  color: T.ink,
                  marginTop: 4,
                }}
              >
                até {plan.max_users_per_org}
              </div>
            </div>
          </div>
          <FeatureChips features={plan.features} />
        </div>

        <div
          style={{
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ ...G, fontSize: 13, color: T.inkMid }}>
              {plan.monthly_price_cents > 0
                ? "Próxima cobrança"
                : "Cobrança"}
            </div>
            <div
              style={{
                ...G,
                fontSize: 14,
                fontWeight: 700,
                color: T.ink,
              }}
            >
              {plan.monthly_price_cents > 0
                ? subscription.current_period_end
                  ? `${fmtBRL(plan.monthly_price_cents)} em ${fmtDate(
                      subscription.current_period_end,
                    )}`
                  : `${fmtBRL(plan.monthly_price_cents)}/mês`
                : monthlyPrice}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setComparingPlans(true)}
              style={{
                ...G,
                padding: "8px 14px",
                borderRadius: 9,
                border: "none",
                background: "linear-gradient(135deg, #7C3AED, #2563EB)",
                color: "white",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Trocar plano
            </button>
            {!cancelling && status !== "cancelled" && (
              <button
                type="button"
                onClick={() => setConfirmingCancel(true)}
                style={{
                  ...G,
                  padding: "8px 14px",
                  borderRadius: 9,
                  border: `1px solid ${T.border}`,
                  background: T.surface,
                  color: T.inkMid,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancelar assinatura
              </button>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeader
          icon={<CheckCircle2 size={16} color={T.green} />}
          title="Últimas faturas"
          sub="Histórico de cobranças"
        />
        <InvoicesList invoices={subscription.recent_invoices ?? []} />
      </SectionCard>

      {comparingPlans && (
        <PlansComparisonModal
          currentPlanId={plan.id}
          onClose={() => setComparingPlans(false)}
        />
      )}
      {confirmingCancel && (
        <CancelSubscriptionDialog
          effectiveUntil={subscription.current_period_end}
          onClose={() => setConfirmingCancel(false)}
          onCancelled={() => {
            setConfirmingCancel(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
