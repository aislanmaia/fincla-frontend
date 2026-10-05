import { useEffect, useState } from "react";
import { createAdminAccount, getAdminPlans } from "../api/admin";
import { handleApiError } from "../api/client";
import { AdminSelect } from "./AdminSelect";

export function AdminCreateAccount({ onCreated, onCancel }) {
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "", organization_name: "", organization_type: "", monthly_income: "", initial_access: "none", courtesy_plan: "", courtesy_months: "1" });
  const [plans, setPlans] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminPlans().then((result) => setPlans(result.items.filter((plan) => plan.is_active && plan.id !== "beta")))
      .catch((nextError) => setError(handleApiError(nextError)));
  }, []);

  function change(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const result = await createAdminAccount({
        email: form.email.trim(), first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || undefined,
        organization_name: form.organization_name.trim(),
        organization_type: form.organization_type || undefined,
        monthly_income: form.monthly_income || undefined,
        initial_access: form.initial_access,
        ...(form.initial_access === "courtesy" ? {
          courtesy_plan: form.courtesy_plan,
          courtesy_months: Number(form.courtesy_months),
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
    <h2>Criar conta e organização</h2>
    <p>Preencha os dados essenciais. A pessoa receberá um link de uso único para definir sua senha.</p>
    <div className="admin-create-fields">
      <label>Nome<input name="first_name" value={form.first_name} onChange={change} maxLength={100} required /></label>
      <label>Sobrenome <small>opcional</small><input name="last_name" value={form.last_name} onChange={change} maxLength={100} /></label>
      <label>E-mail<input name="email" type="email" value={form.email} onChange={change} maxLength={255} required /></label>
      <label>Organização<input name="organization_name" value={form.organization_name} onChange={change} maxLength={255} required /></label>
      <label>Tipo de organização <small>opcional</small><AdminSelect name="organization_type" ariaLabel="Tipo de organização" value={form.organization_type} onChange={(value) => setForm((current) => ({ ...current, organization_type: value }))} options={[{ value: "", label: "Selecionar" }, { value: "family", label: "Família" }, { value: "individual", label: "Individual" }, { value: "business", label: "Empresa" }]} /></label>
      <label>Renda mensal estimada <small>opcional</small><input name="monthly_income" type="number" min="0" step="0.01" value={form.monthly_income} onChange={change} /></label>
    </div>
    <div className="admin-create-access">
      <div><h3>Acesso inicial</h3><p>Defina o acesso junto com a criação da conta e organização.</p></div>
      <div className="admin-create-fields">
        <label>Tipo de acesso<AdminSelect ariaLabel="Tipo de acesso inicial" value={form.initial_access} onChange={(value) => setForm((current) => ({ ...current, initial_access: value }))} options={[{ value: "none", label: "Sem acesso gratuito" }, { value: "courtesy", label: "Cortesia com prazo" }, { value: "beta", label: "Beta sem prazo" }]} /></label>
        {form.initial_access === "courtesy" && <>
          <label>Plano liberado<AdminSelect ariaLabel="Plano da cortesia" value={form.courtesy_plan} onChange={(value) => setForm((current) => ({ ...current, courtesy_plan: value }))} required options={[{ value: "", label: "Selecione um plano" }, ...plans.map((plan) => ({ value: plan.id, label: plan.name }))]} /></label>
          <label>Meses gratuitos<input type="number" min="1" max="12" step="1" value={form.courtesy_months} onChange={(event) => setForm((current) => ({ ...current, courtesy_months: event.target.value }))} required /></label>
        </>}
      </div>
      {form.initial_access === "courtesy" && <p className="admin-create-access-note">Acesso gratuito por {form.courtesy_months || "—"} {Number(form.courtesy_months) === 1 ? "mês" : "meses"}, a partir da criação. Termina automaticamente, sem gerar cobrança.</p>}
      {form.initial_access === "beta" && <p className="admin-create-access-note">Acesso completo sem prazo. Só o admin poderá encerrá-lo ou alterar o plano.</p>}
    </div>
    {error && <div className="admin-error" role="alert">{error}</div>}
    <div className="admin-create-actions"><button type="button" onClick={onCancel}>Cancelar</button><button type="submit" disabled={busy || (form.initial_access === "courtesy" && !form.courtesy_plan)}>{busy ? "Criando…" : "Criar e enviar convite"}</button></div>
  </form>;
}
