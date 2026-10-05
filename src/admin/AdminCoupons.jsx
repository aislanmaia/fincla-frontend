import { useEffect, useState } from "react";
import { createAdminCoupon, disableAdminCoupon, getAdminCoupons } from "../api/admin";
import { handleApiError } from "../api/client";

const formatDate = (value) => value ? new Date(`${value}Z`).toLocaleString("pt-BR") : "Sem prazo";
const localDateTime = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export function AdminCoupons() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", percent_off: 10, eligible_plans: ["pro"], eligible_cycles: ["monthly"], valid_from: localDateTime(), valid_until: "", max_uses: "", discounted_charges: 1, reason: "" });

  async function reload() {
    const response = await getAdminCoupons();
    setItems(response.items);
  }

  useEffect(() => {
    let active = true;
    getAdminCoupons().then((response) => { if (active) setItems(response.items); })
      .catch((nextError) => { if (active) setError(handleApiError(nextError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function toggle(key, value) {
    setForm((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value] }));
  }

  async function create(event) {
    event.preventDefault();
    setError(""); setNotice(""); setBusy(true);
    try {
      await createAdminCoupon({
        code: form.code.trim(), percent_off: Number(form.percent_off),
        eligible_plans: form.eligible_plans, eligible_cycles: form.eligible_cycles,
        valid_from: new Date(form.valid_from).toISOString(),
        valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        discounted_charges: Number(form.discounted_charges), reason: form.reason.trim(),
      });
      await reload(); setShowForm(false); setNotice("Cupom criado.");
    } catch (nextError) { setError(handleApiError(nextError)); }
    finally { setBusy(false); }
  }

  async function disable(item) {
    const reason = window.prompt(`Motivo para desativar o cupom ${item.code}:`);
    if (reason === null) return;
    if (reason.trim().length < 3) { setError("Informe um motivo com pelo menos 3 caracteres."); return; }
    setError(""); setNotice(""); setBusy(true);
    try { await disableAdminCoupon(item.id, reason.trim()); await reload(); setNotice(`Cupom ${item.code} desativado.`); }
    catch (nextError) { setError(handleApiError(nextError)); }
    finally { setBusy(false); }
  }

  return <div className="admin-directory">
    <div className="admin-page-number">05 / PROMOÇÕES</div>
    <div className="admin-directory-heading"><div><h1>Cupons</h1><p>Descontos com validade, limite de usos e duração em cobranças.</p></div><button className="admin-create-trigger" onClick={() => setShowForm((value) => !value)}>{showForm ? "Fechar" : "Criar cupom"}</button></div>
    {error && <div className="admin-error" role="alert">{error}</div>}
    {notice && <div className="admin-notice" role="status">{notice}</div>}
    {showForm && <form className="admin-create-form" onSubmit={create}>
      <h2>Novo cupom</h2><p>O desconto será aplicado ao preço base da oferta antes das taxas de parcelamento.</p>
      <div className="admin-create-fields">
        <label>Código<input required minLength={3} maxLength={40} pattern="[A-Za-z0-9_-]+" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} /></label>
        <label>Desconto (%)<input required type="number" min="1" max="99" value={form.percent_off} onChange={(event) => setForm({ ...form, percent_off: event.target.value })} /></label>
        <fieldset><legend>Planos elegíveis</legend>{[["pro", "Pessoal"], ["consultant_pro", "Consultor"]].map(([value, label]) => <label key={value}><input type="checkbox" checked={form.eligible_plans.includes(value)} onChange={() => toggle("eligible_plans", value)} /> {label}</label>)}</fieldset>
        <fieldset><legend>Ciclos elegíveis</legend>{[["monthly", "Mensal"], ["yearly", "Anual"]].map(([value, label]) => <label key={value}><input type="checkbox" checked={form.eligible_cycles.includes(value)} onChange={() => toggle("eligible_cycles", value)} /> {label}</label>)}</fieldset>
        <label>Válido a partir de<input required type="datetime-local" value={form.valid_from} onChange={(event) => setForm({ ...form, valid_from: event.target.value })} /></label>
        <label>Válido até (opcional)<input type="datetime-local" value={form.valid_until} onChange={(event) => setForm({ ...form, valid_until: event.target.value })} /></label>
        <label>Máximo de usos (opcional)<input type="number" min="1" value={form.max_uses} onChange={(event) => setForm({ ...form, max_uses: event.target.value })} /></label>
        <label>Cobranças com desconto<input required type="number" min="1" max="120" value={form.discounted_charges} onChange={(event) => setForm({ ...form, discounted_charges: event.target.value })} /></label>
        <label className="admin-coupon-reason">Motivo<input required minLength={3} maxLength={2000} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
      </div>
      <div className="admin-create-actions"><button type="button" onClick={() => setShowForm(false)}>Cancelar</button><button type="submit" disabled={busy || !form.eligible_plans.length || !form.eligible_cycles.length}>{busy ? "Salvando…" : "Criar cupom"}</button></div>
    </form>}
    {loading ? <p role="status">Carregando cupons…</p> : <div className="admin-coupon-grid">{items.length ? items.map((item) => <article className="admin-plan-card" key={item.id}>
      <span className="admin-plan-audience">{item.is_active ? "ATIVO" : "DESATIVADO"}</span><h2>{item.code}</h2>
      <strong>{item.percent_off}% de desconto</strong>
      <p>{item.eligible_plans.map((value) => value === "pro" ? "Pessoal" : "Consultor").join(" e ")} · {item.eligible_cycles.map((value) => value === "monthly" ? "mensal" : "anual").join(" e ")}</p>
      <p>{item.discounted_charges} {item.discounted_charges === 1 ? "cobrança" : "cobranças"} com desconto · {item.uses} de {item.max_uses ?? "∞"} usos</p>
      <p>De {formatDate(item.valid_from)} até {formatDate(item.valid_until)}</p>
      {item.is_active && <button className="admin-coupon-disable" type="button" disabled={busy} onClick={() => disable(item)}>Desativar</button>}
    </article>) : <div className="admin-empty">Nenhum cupom criado.</div>}</div>}
  </div>;
}
