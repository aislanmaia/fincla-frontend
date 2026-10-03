import { useState } from "react";
import { createAdminAccount } from "../api/admin";
import { handleApiError } from "../api/client";
import { AdminSelect } from "./AdminSelect";

export function AdminCreateAccount({ onCreated, onCancel }) {
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "", organization_name: "", organization_type: "", monthly_income: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    {error && <div className="admin-error" role="alert">{error}</div>}
    <div className="admin-create-actions"><button type="button" onClick={onCancel}>Cancelar</button><button type="submit" disabled={busy}>{busy ? "Criando…" : "Criar e enviar convite"}</button></div>
  </form>;
}
