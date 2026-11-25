import { useEffect, useState } from "react";
import { createAdminAccount, getAdminPlans } from "../api/admin";
import { handleApiError } from "../api/client";
import { AdminSelect } from "./AdminSelect";

const MAX_COURTESY_DAYS = 365;

function courtesyEndLabel(days) {
  const count = Number(days);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COURTESY_DAYS) return null;
  const end = new Date(Date.now() + count * 24 * 60 * 60 * 1000);
  return end.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * A trial is a free period by definition, so it never starts without one: the
 * courtesy is switched on for it, and switched back off if the admin returns to
 * a ready account before changing the access by hand.
 */
function switchSetup(current, setup) {
  if (setup === "self_onboarding" && current.initial_access === "none") {
    return { ...current, setup, initial_access: "courtesy", autoCourtesy: true };
  }
  if (setup === "ready" && current.autoCourtesy) {
    return { ...current, setup, initial_access: "none", autoCourtesy: false };
  }
  return { ...current, setup };
}

export function AdminCreateAccount({ onCreated, onCancel }) {
  const [form, setForm] = useState({ setup: "ready", email: "", first_name: "", last_name: "", organization_name: "", organization_type: "", monthly_income: "", initial_access: "none", courtesy_plan: "", courtesy_days: "14" });
  const [plans, setPlans] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminPlans().then((result) => {
      const available = result.items.filter((plan) => plan.is_active && plan.id !== "beta");
      setPlans(available);
      // A single plan leaves nothing to choose: start with it selected.
      if (available.length === 1) setForm((current) => (current.courtesy_plan ? current : { ...current, courtesy_plan: available[0].id }));
    })
      .catch((nextError) => setError(handleApiError(nextError)));
  }, []);

  function change(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const trial = form.setup === "self_onboarding";
      const result = await createAdminAccount({
        setup: form.setup,
        email: form.email.trim(), first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || undefined,
        // A trial leaves the organization to the person's own onboarding.
        ...(trial ? {} : {
          organization_name: form.organization_name.trim(),
          organization_type: form.organization_type || undefined,
          monthly_income: form.monthly_income || undefined,
        }),
        initial_access: form.initial_access,
        ...(form.initial_access === "courtesy" ? {
          courtesy_plan: form.courtesy_plan,
          courtesy_days: Number(form.courtesy_days),
        } : {}),
      });
      onCreated(result);
    } catch (nextError) {
      setError(handleApiError(nextError));
    } finally {
      setBusy(false);
    }
  }

  return <form className="admin-create-form" onSubmit={submit}>
    <h2>Criar conta</h2>
    <p>A pessoa receberá um link de uso único para definir sua senha.</p>
    <div className="admin-create-fields">
      <label>Como a conta começa<AdminSelect ariaLabel="Como a conta começa" value={form.setup} onChange={(value) => setForm((current) => switchSetup(current, value))} options={[{ value: "ready", label: "Conta pronta: eu configuro" }, { value: "self_onboarding", label: "Conta de teste: a pessoa configura" }]} /></label>
    </div>
    <p className="admin-create-access-note">{form.setup === "self_onboarding"
      ? "Você informa só a pessoa e o acesso. No primeiro acesso ela faz o onboarding completo: nome da organização, moeda, renda, cartão e categorias."
      : "Você cria a organização agora e a pessoa entra direto no app, sem onboarding."}</p>
    <div className="admin-create-fields">
      <label>Nome<input name="first_name" value={form.first_name} onChange={change} maxLength={100} required /></label>
      <label>Sobrenome <small>opcional</small><input name="last_name" value={form.last_name} onChange={change} maxLength={100} /></label>
      <label>E-mail<input name="email" type="email" value={form.email} onChange={change} maxLength={255} required /></label>
      {form.setup === "ready" && <>
      <label>Organização<input name="organization_name" value={form.organization_name} onChange={change} maxLength={255} required /></label>
      <label>Tipo de organização <small>opcional</small><AdminSelect name="organization_type" ariaLabel="Tipo de organização" value={form.organization_type} onChange={(value) => setForm((current) => ({ ...current, organization_type: value }))} options={[{ value: "", label: "Selecionar" }, { value: "family", label: "Família" }, { value: "individual", label: "Individual" }, { value: "business", label: "Empresa" }]} /></label>
      <label>Renda mensal estimada <small>opcional</small><input name="monthly_income" type="number" min="0" step="0.01" value={form.monthly_income} onChange={change} /></label>
      </>}
    </div>
    <div className="admin-create-access">
      <div><h3>Acesso inicial</h3><p>Defina o acesso junto com a criação da conta.</p></div>
      <div className="admin-create-fields">
        <label>Tipo de acesso<AdminSelect ariaLabel="Tipo de acesso inicial" value={form.initial_access} onChange={(value) => setForm((current) => (value === current.initial_access ? current : { ...current, initial_access: value, autoCourtesy: false }))} options={[...(form.setup === "ready" ? [{ value: "none", label: "Sem acesso gratuito" }] : []), { value: "courtesy", label: "Cortesia com prazo" }, { value: "beta", label: "Beta sem prazo" }]} /></label>
        {form.initial_access === "courtesy" && <>
          <label>Plano liberado<AdminSelect ariaLabel="Plano da cortesia" value={form.courtesy_plan} onChange={(value) => setForm((current) => ({ ...current, courtesy_plan: value }))} required options={[{ value: "", label: "Selecione um plano" }, ...plans.map((plan) => ({ value: plan.id, label: plan.name }))]} /></label>
          <label>Dias gratuitos<input type="number" inputMode="numeric" min="1" max={MAX_COURTESY_DAYS} step="1" value={form.courtesy_days} onChange={(event) => setForm((current) => ({ ...current, courtesy_days: event.target.value }))} required /></label>
        </>}
      </div>
      {form.initial_access === "courtesy" && <p className="admin-create-access-note">{courtesyEndLabel(form.courtesy_days)
        ? <>Acesso gratuito por {Number(form.courtesy_days)} {Number(form.courtesy_days) === 1 ? "dia" : "dias"}, até {courtesyEndLabel(form.courtesy_days)}. A pessoa pode assinar a qualquer momento: o plano passa a contar do dia do pagamento. Se não assinar, o acesso termina sem gerar cobrança.</>
        : <>Informe de 1 a {MAX_COURTESY_DAYS} dias.</>}</p>}
      {form.initial_access === "beta" && <p className="admin-create-access-note">Acesso completo sem prazo. Só o admin poderá encerrá-lo ou alterar o plano.</p>}
    </div>
    {error && <div className="admin-error" role="alert">{error}</div>}
    <div className="admin-create-actions"><button type="button" onClick={onCancel}>Cancelar</button><button type="submit" disabled={busy || (form.initial_access === "courtesy" && !form.courtesy_plan)}>{busy ? "Criando…" : "Criar e enviar convite"}</button></div>
  </form>;
}
