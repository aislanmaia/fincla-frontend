import { useEffect, useState } from "react";
import { changeAdminBeta, endAdminCourtesy, getAdminPlans, grantAdminCourtesy } from "../api/admin";
import { handleApiError } from "../api/client";
import { AdminSelect } from "./AdminSelect";

const formattedDate = (value) => value ? new Intl.DateTimeFormat("pt-BR").format(new Date(value)) : "—";

export function AdminGrants({ userId, subscription, onChanged }) {
  const [plans, setPlans] = useState([]);
  const [action, setAction] = useState("");
  const [reason, setReason] = useState("");
  const [plan, setPlan] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAdminPlans().then((result) => setPlans(result.items.filter((item) => item.is_active && item.id !== "beta")))
      .catch((nextError) => setError(handleApiError(nextError)));
  }, []);

  const paidActive = subscription?.gateway_provider === "asaas" && subscription?.status === "active" && (!subscription.current_period_end || new Date(subscription.current_period_end) > new Date());
  const courtesyActive = subscription?.courtesy_plan && subscription?.courtesy_until && new Date(subscription.courtesy_until) > new Date();

  async function submit(event) {
    event.preventDefault();
    if (reason.trim().length < 3 || (action === "courtesy-grant" && !plan)) return;
    setBusy(true); setError("");
    try {
      if (action === "beta-enable") await changeAdminBeta(userId, true, reason.trim());
      if (action === "beta-end") await changeAdminBeta(userId, false, reason.trim());
      if (action === "courtesy-grant") await grantAdminCourtesy(userId, plan, new Date(`${expiresAt}T23:59:59`).toISOString(), reason.trim());
      if (action === "courtesy-end") await endAdminCourtesy(userId, reason.trim());
      setAction(""); setReason(""); setPlan(""); setExpiresAt("");
      await onChanged();
    } catch (nextError) {
      setError(handleApiError(nextError));
    } finally {
      setBusy(false);
    }
  }

  return <section className="admin-detail-card admin-grants-card">
    <h2>Beta e cortesias</h2>
    <div className="admin-grant-states"><p><strong>Beta</strong><span className="admin-pill">{subscription?.beta_enabled ? "Ativo sem prazo" : "Inativo"}</span></p><p><strong>Cortesia</strong><span>{courtesyActive ? `${subscription.courtesy_plan} até ${formattedDate(subscription.courtesy_until)}` : subscription?.courtesy_plan ? "Vencida" : "Nenhuma"}</span></p></div>
    {paidActive && <p>Há uma assinatura paga ativa. Resolva a cobrança antes de conceder novo acesso.</p>}
    <div className="admin-grant-buttons"><button type="button" disabled={paidActive && !subscription?.beta_enabled} onClick={() => setAction(subscription?.beta_enabled ? "beta-end" : "beta-enable")}>{subscription?.beta_enabled ? "Encerrar beta" : "Ativar beta"}</button><button type="button" disabled={paidActive} onClick={() => setAction("courtesy-grant")}>{courtesyActive ? "Alterar cortesia" : "Conceder cortesia"}</button>{subscription?.courtesy_plan && <button type="button" onClick={() => setAction("courtesy-end")}>Encerrar cortesia</button>}</div>
    {error && <div className="admin-error" role="alert">{error}</div>}
    {action && <form className="admin-access-form" onSubmit={submit}><strong>{action === "beta-enable" ? "Ativar beta" : action === "beta-end" ? "Encerrar beta" : action === "courtesy-grant" ? "Conceder cortesia" : "Encerrar cortesia"}</strong>{action === "courtesy-grant" && <><label htmlFor="admin-courtesy-plan">Plano</label><AdminSelect id="admin-courtesy-plan" value={plan} onChange={setPlan} required options={[{ value: "", label: "Selecione o plano" }, ...plans.map((item) => ({ value: item.id, label: item.name }))]} /><label htmlFor="admin-courtesy-until">Data final</label><input id="admin-courtesy-until" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} required /></>}<label htmlFor="admin-grant-reason">Motivo</label><textarea id="admin-grant-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={2000} required /><div><button type="button" onClick={() => setAction("")}>Cancelar</button><button type="submit" disabled={busy || reason.trim().length < 3 || (action === "courtesy-grant" && !plan)}>{busy ? "Salvando…" : "Confirmar"}</button></div></form>}
  </section>;
}
