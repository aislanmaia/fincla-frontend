import { useEffect, useState } from "react";
import { cancelAdminRenewal, getAdminPlanRequests, getAdminPlans, requestAdminPlanChange, withdrawAdminPlanChange } from "../api/admin";
import { handleApiError } from "../api/client";

const date = (value) => value ? new Intl.DateTimeFormat("pt-BR").format(new Date(value)) : "—";

export function AdminBillingActions({ userId, subscription, onChanged }) {
  const [requests, setRequests] = useState([]);
  const [plans, setPlans] = useState([]);
  const [action, setAction] = useState("");
  const [targetPlan, setTargetPlan] = useState("");
  const [targetCycle, setTargetCycle] = useState("monthly");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAdminPlanRequests(userId).then((result) => setRequests(result.items)).catch((nextError) => setError(handleApiError(nextError)));
    getAdminPlans().then((result) => setPlans(result.items.filter((plan) => plan.is_active && plan.is_public))).catch((nextError) => setError(handleApiError(nextError)));
  }, [userId]);

  const paid = subscription?.gateway_provider === "asaas" && subscription?.status === "active" && !!subscription?.gateway_subscription_id;
  const activeRequest = requests.find((request) => request.state === "pending_manual");
  const audience = subscription?.plan?.startsWith("consultant_") ? "consultant" : "standard";

  async function submit(event) {
    event.preventDefault();
    if (reason.trim().length < 3) return;
    setBusy(true); setError("");
    try {
      if (action === "cancel") await cancelAdminRenewal(userId, reason.trim());
      if (action === "change") await requestAdminPlanChange(userId, targetPlan, targetCycle, reason.trim());
      if (action === "withdraw") await withdrawAdminPlanChange(userId, activeRequest.id, reason.trim());
      setRequests((await getAdminPlanRequests(userId)).items);
      await onChanged();
      setAction(""); setReason(""); setTargetPlan("");
    } catch (nextError) {
      setError(handleApiError(nextError));
    } finally {
      setBusy(false);
    }
  }

  return <section className="admin-detail-card admin-billing-card">
    <h2>Assinatura paga</h2>
    {!paid && <p>Não há assinatura paga ativa vinculada ao provedor.</p>}
    {paid && <><p>Plano atual: <strong>{subscription.plan}</strong> · {subscription.billing_cycle === "yearly" ? "anual" : "mensal"}. O período pago termina em {date(subscription.current_period_end)}.</p><p>{subscription.cancel_at_period_end ? "Renovação cancelada; o acesso permanece até o fim do período." : "Renovação ativa."}</p><div className="admin-grant-buttons"><button type="button" disabled={subscription.cancel_at_period_end || !subscription.current_period_end} onClick={() => setAction("cancel")}>Cancelar renovação</button><button type="button" disabled={!!activeRequest} onClick={() => setAction("change")}>Solicitar mudança de plano</button></div></>}
    {activeRequest && <div className="admin-billing-pending"><strong>Mudança pendente de execução</strong><p>{activeRequest.current_plan} → {activeRequest.target_plan} ({activeRequest.target_cycle === "yearly" ? "anual" : "mensal"}). O plano atual continua ativo. É necessária execução e confirmação no provedor antes de marcar a mudança como efetivada.</p><button type="button" onClick={() => setAction("withdraw")}>Retirar solicitação</button></div>}
    {requests.filter((request) => request.state !== "pending_manual").slice(0, 4).map((request) => <p key={request.id}>{date(request.created_at)} · {request.current_plan} → {request.target_plan} · {request.state === "withdrawn" ? "Retirada" : request.state}</p>)}
    {error && <div className="admin-error" role="alert">{error}</div>}
    {action && <form className="admin-access-form" onSubmit={submit}><strong>{action === "cancel" ? "Confirmar cancelamento da renovação" : action === "change" ? "Solicitar mudança" : "Retirar solicitação"}</strong>{action === "change" && <><p>A solicitação ficará pendente de execução manual. O plano cobrado permanece igual até confirmação do provedor.</p><label htmlFor="admin-target-plan">Plano de destino</label><select id="admin-target-plan" value={targetPlan} onChange={(event) => setTargetPlan(event.target.value)} required><option value="">Selecione</option>{plans.filter((plan) => plan.audience === audience && plan.id !== subscription.plan).map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select><label htmlFor="admin-target-cycle">Ciclo</label><select id="admin-target-cycle" value={targetCycle} onChange={(event) => setTargetCycle(event.target.value)}><option value="monthly">Mensal</option><option value="yearly">Anual</option></select></>}{action === "cancel" && <p>O acesso pago permanece até {date(subscription.current_period_end)}.</p>}<label htmlFor="admin-billing-reason">Motivo</label><textarea id="admin-billing-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={2000} required /><div><button type="button" onClick={() => setAction("")}>Cancelar</button><button type="submit" disabled={busy || reason.trim().length < 3 || (action === "change" && !targetPlan)}>{busy ? "Salvando…" : "Confirmar"}</button></div></form>}
  </section>;
}
