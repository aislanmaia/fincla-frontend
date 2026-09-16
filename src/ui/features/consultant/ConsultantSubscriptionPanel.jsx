import { useEffect, useState } from "react";
import { currentCheckout } from "../../../api/checkout";
import { Card, Btn } from "../../components/primitives.jsx";
import { CheckoutBilling } from "../../pages/CheckoutBilling.jsx";
import { CancelSubscriptionDialog } from "../subscription/CancelSubscriptionDialog.jsx";
import { useSubscriptionData } from "../subscription/useSubscriptionData.js";
import { AnnualSettlementPreview } from "../subscription/AnnualSettlementPreview.jsx";
import { T } from "../../tokens.js";
import { NUM } from "../../typography.js";

/** Contract totals come from the accepted quote, never the legacy plan defaults. */
export function ConsultantSubscriptionPanel() {
  const { subscription, isLoading, error, refresh } = useSubscriptionData();
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  useEffect(() => {
    let alive = true;
    currentCheckout().then(attempt => {
      if (!alive) return;
      if (attempt?.quote) setQuote(attempt.quote);
      else setQuoteError("O resumo da contratação está indisponível. Entre em contato com o suporte.");
    }).catch(() => { if (alive) setQuoteError("Não foi possível carregar o resumo da contratação."); });
    return () => { alive = false; };
  }, []);
  return <Card style={{ padding: 24 }}>
    <h2 style={{ marginTop: 0 }}>Sua assinatura</h2>
    {quote && <>
      <p style={{ ...NUM }}>{subscription?.max_organizations ?? quote.capacity} vagas contratadas · {quote.selection.mode === "package" ? `Pacote de ${quote.selection.package_size}` : "Preço progressivo"}</p>
      <p style={{ ...NUM, fontSize: 24, fontWeight: 700 }}>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(quote.total_cents / 100)} · {quote.selection.billing_cycle === "yearly" ? "anual" : "mensal"}</p>
      <p style={{ color: T.inkMid }}>Valor da oferta aceita na contratação.</p>
    </>}
    {quoteError && <p role="alert">{quoteError}</p>}
    <AnnualSettlementPreview selection={quote?.selection} />
    {isLoading && <p role="status">Consultando a assinatura…</p>}
    {error && <div role="alert"><p>{error}</p><Btn onClick={refresh}>Atualizar assinatura</Btn></div>}
    {subscription?.cancel_at_period_end ? <p role="status" style={{ ...NUM }}>Renovação cancelada.{subscription.current_period_end && ` Você mantém acesso até ${new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}.`}</p> : subscription?.status === "cancelled" ? <p>Assinatura cancelada.</p> : subscription && !isLoading && <Btn onClick={() => setShowCancel(true)}>Cancelar renovação</Btn>}
    <CheckoutBilling />
    {showCancel && <CancelSubscriptionDialog effectiveUntil={subscription.current_period_end} reactivationHint="Para uma nova contratação após cancelar, entre em contato com o suporte." onClose={() => setShowCancel(false)} onCancelled={() => { setShowCancel(false); refresh(); }} />}
  </Card>;
}
