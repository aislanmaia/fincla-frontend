import { useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { changeAdminUserAccess, getAdminOrganization, getAdminOrganizations, getAdminPlans, getAdminUser, getAdminUserAudit, getAdminUsers, retryAdminCouponReprice, sendAdminPasswordReset } from "../api/admin";
import { handleApiError } from "../api/client";
import { AdminCreateAccount } from "./AdminCreateAccount";
import { AdminGrants } from "./AdminGrants";
import { AdminBillingActions } from "./AdminBillingActions";
import { AdminSelect } from "./AdminSelect";

const PAGE_SIZE = 20;
const money = (cents) => cents == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const date = (value) => value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value)) : "—";
const courtesyDate = (value) => value ? value.slice(0, 10).split("-").reverse().join("/") : "—";
const displayName = (user) => [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
const auditLabels = { block: "Bloqueio", unblock: "Desbloqueio", password_reset_email: "E-mail de senha", create_account: "Criação assistida", beta_enable: "Beta ativado", beta_end: "Beta encerrado", courtesy_grant: "Cortesia concedida", courtesy_end: "Cortesia encerrada", cancel_renewal: "Renovação cancelada", plan_change_requested: "Mudança solicitada", plan_change_withdrawn: "Solicitação retirada", coupon_reprice_retry: "Reajuste de cupom" };

export function AdminDirectory({ section, initialAction = "" }) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [status, setStatus] = useState("");
  const [flag, setFlag] = useState("");
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [accessAction, setAccessAction] = useState(null);
  const [accessReason, setAccessReason] = useState("");
  const [audit, setAudit] = useState([]);
  const [savingAccess, setSavingAccess] = useState(false);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetReason, setResetReason] = useState("");
  const [savingReset, setSavingReset] = useState(false);
  const [repriceReason, setRepriceReason] = useState("");
  const [savingReprice, setSavingReprice] = useState(false);

  useEffect(() => {
    setQuery(""); setSubmittedQuery(""); setStatus(initialAction === "past_due" ? "past_due" : ""); setFlag(["password_pending", "pending_plan_changes", "coupon_reprice_due", "blocked", "beta", "courtesy"].includes(initialAction) ? initialAction : ""); setOffset(0); setDetail(null); setPage(null); setAudit([]); setCreating(initialAction === "create"); setNotice(""); setResetOpen(false);
  }, [section, initialAction]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    const request = section === "users"
      ? getAdminUsers({ q: submittedQuery || undefined, status: status || undefined, flag: flag || undefined, limit: PAGE_SIZE, offset })
      : section === "organizations"
        ? getAdminOrganizations({ q: submittedQuery || undefined, limit: PAGE_SIZE, offset })
        : getAdminPlans();
    request.then((result) => { if (active) setPage(result); })
      .catch((nextError) => { if (active) setError(handleApiError(nextError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [section, submittedQuery, status, flag, offset, reload]);

  async function openDetail(id) {
    const content = document.querySelector(".admin-content");
    if (content) content.scrollTop = 0;
    setLoading(true); setError("");
    try {
      setDetail(section === "users" ? await getAdminUser(id) : await getAdminOrganization(id));
      if (section === "users") setAudit((await getAdminUserAudit(id)).items);
    } catch (nextError) {
      setError(handleApiError(nextError));
    } finally {
      setLoading(false);
    }
  }

  async function changeAccess(event) {
    event.preventDefault();
    if (!accessAction || accessReason.trim().length < 3) return;
    setSavingAccess(true); setError("");
    try {
      await changeAdminUserAccess(detail.id, accessAction, accessReason.trim());
      setDetail(await getAdminUser(detail.id));
      setAudit((await getAdminUserAudit(detail.id)).items);
      setAccessAction(null); setAccessReason("");
    } catch (nextError) {
      setError(handleApiError(nextError));
    } finally {
      setSavingAccess(false);
    }
  }

  async function createdAccount(result) {
    setCreating(false);
    const access = result.initial_access === "courtesy" && result.courtesy_until
      ? ` Cortesia ativa até ${courtesyDate(result.courtesy_until)}.`
      : result.initial_access === "beta" ? " Acesso beta ativo." : "";
    setNotice(result.email_sent
      ? `Conta criada e convite enviado por e-mail.${access}`
      : `Conta criada, mas o e-mail do convite não foi enviado. Envie um novo link pelo detalhe da conta.${access}`);
    setReload((value) => value + 1);
    await openDetail(result.user_id);
  }

  async function requestPasswordReset(event) {
    event.preventDefault();
    if (resetReason.trim().length < 3) return;
    setSavingReset(true); setError("");
    try {
      await sendAdminPasswordReset(detail.id, resetReason.trim());
      setAudit((await getAdminUserAudit(detail.id)).items);
      setResetOpen(false); setResetReason("");
      setNotice(`Link de redefinição enviado para ${detail.email}.`);
    } catch (nextError) {
      setError(handleApiError(nextError));
      setAudit((await getAdminUserAudit(detail.id)).items);
    } finally {
      setSavingReset(false);
    }
  }

  async function retryCouponReprice(event) {
    event.preventDefault();
    if (repriceReason.trim().length < 3) return;
    setSavingReprice(true); setError("");
    try {
      await retryAdminCouponReprice(detail.id, repriceReason.trim());
      setDetail(await getAdminUser(detail.id));
      setAudit((await getAdminUserAudit(detail.id)).items);
      setRepriceReason(""); setNotice("Preço normal atualizado no provedor.");
    } catch (nextError) {
      setError(handleApiError(nextError));
      setAudit((await getAdminUserAudit(detail.id)).items);
    } finally { setSavingReprice(false); }
  }

  const title = section === "users" ? "Contas" : section === "organizations" ? "Organizações" : "Planos";
  return <div className="admin-directory">
    <div className="admin-page-number">{section === "users" ? "02" : section === "organizations" ? "03" : "04"} / DIRETÓRIO</div>
    <div className="admin-directory-heading">
      <div>{(detail || creating) && <button className="admin-back" type="button" onClick={() => { setDetail(null); setCreating(false); }}><ArrowLeft size={16} /> Voltar para {title.toLowerCase()}</button>}
        <h1>{creating ? "Nova conta" : detail ? (section === "users" ? displayName(detail) : detail.name) : title}</h1>
        <p>{creating ? "Crie a conta, a organização e o acesso inicial em uma etapa." : detail ? "Dados de acesso e vínculos desta conta." : section === "plans" ? "Catálogo de planos do Fincla." : `Consulte ${title.toLowerCase()} cadastradas no Fincla.`}</p>
      </div>
      {!detail && !creating && section === "users" && <button className="admin-create-trigger" type="button" onClick={() => { setCreating(true); setNotice(""); }}>Criar conta</button>}
      {!detail && !creating && section === "organizations" && <span className="admin-directory-count">{page?.total ?? 0} registros</span>}
    </div>
    {error && <div className="admin-error" role="alert">{error}</div>}
    {notice && <div className="admin-notice" role="status">{notice}</div>}
    {creating && <AdminCreateAccount onCreated={createdAccount} onCancel={() => setCreating(false)} />}
    {loading && <p role="status">Carregando…</p>}
    {!detail && !creating && section !== "plans" && <form className="admin-directory-filters" onSubmit={(event) => { event.preventDefault(); setOffset(0); setSubmittedQuery(query.trim()); }}>
      <label className="admin-search"><Search size={17} aria-hidden="true" /><input aria-label={`Buscar ${title.toLowerCase()}`} placeholder={section === "users" ? "Nome, e-mail ou ID" : "Nome ou ID"} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      {section === "users" && <AdminSelect ariaLabel="Filtrar por assinatura" value={status} onChange={(nextStatus) => { setStatus(nextStatus); setOffset(0); }} options={[{ value: "", label: "Todas as assinaturas" }, { value: "active", label: "Ativa" }, { value: "past_due", label: "Em atraso" }, { value: "cancelled", label: "Cancelada" }, { value: "suspended", label: "Suspensa" }]} />}
      {section === "users" && <AdminSelect ariaLabel="Filtrar por atenção" value={flag} onChange={(nextFlag) => { setFlag(nextFlag); setOffset(0); }} options={[{ value: "", label: "Todas as contas" }, { value: "password_pending", label: "Convite pendente" }, { value: "pending_plan_changes", label: "Mudança de plano" }, { value: "coupon_reprice_due", label: "Reajuste de cupom" }, { value: "blocked", label: "Bloqueadas" }, { value: "beta", label: "Beta" }, { value: "courtesy", label: "Cortesia" }]} />}
      <button type="submit">Buscar</button>
    </form>}
    {!detail && !creating && !loading && section === "users" && <div className="admin-directory-list">{page?.items.map((user) => <button type="button" className="admin-directory-row" key={user.id} onClick={() => openDetail(user.id)}><span><strong>{displayName(user)}</strong><small>{user.email}</small></span><span>{user.subscription?.plan || "Sem plano"}</span><span className="admin-pill">{user.subscription?.status || "Sem assinatura"}</span><ChevronRight size={18} /></button>)}{!page?.items.length && <p className="admin-empty">Nenhuma conta encontrada.</p>}</div>}
    {!detail && !creating && !loading && section === "organizations" && <div className="admin-directory-list">{page?.items.map((org) => <button type="button" className="admin-directory-row" key={org.id} onClick={() => openDetail(org.id)}><span><strong>{org.name}</strong><small>{org.id}</small></span><span>{org.org_type || "—"}</span><span>{date(org.created_at)}</span><ChevronRight size={18} /></button>)}{!page?.items.length && <p className="admin-empty">Nenhuma organização encontrada.</p>}</div>}
    {!detail && !creating && !loading && section === "plans" && <div className="admin-plan-grid">{page?.items.map((plan) => <article className="admin-plan-card" key={plan.id}><span className="admin-plan-audience">{plan.audience === "consultant" ? "CONSULTOR" : "PESSOAL"}</span><h2>{plan.name}</h2><p>{plan.id}</p><div><strong>{money(plan.monthly_price_cents)}</strong><small> / mês</small></div><p>Anual: {money(plan.yearly_price_cents)}</p><p>Até {plan.max_organizations} organizações · {plan.max_users_per_org} pessoas por organização</p><span className="admin-pill">{plan.is_active ? "Ativo" : "Inativo"}</span></article>)}</div>}
    {detail && section === "users" && <div className="admin-detail-grid"><section className="admin-detail-card"><h2>Conta</h2><dl><dt>E-mail</dt><dd>{detail.email}</dd><dt>ID</dt><dd>{detail.id}</dd><dt>Criada em</dt><dd>{date(detail.created_at)}</dd><dt>Onboarding</dt><dd>{detail.onboarding_completed ? "Concluído" : "Pendente"}</dd><dt>Senha</dt><dd>{detail.password_pending ? "Aguardando definição" : "Definida"}</dd><dt>Acesso</dt><dd>{detail.blocked_at ? `Bloqueado em ${date(detail.blocked_at)}` : "Liberado"}</dd></dl><div className="admin-access-controls"><button type="button" onClick={() => { setAccessAction(detail.blocked_at ? "unblock" : "block"); setAccessReason(""); }}>{detail.blocked_at ? "Desbloquear conta" : "Bloquear conta"}</button></div>{accessAction && <form className="admin-access-form" onSubmit={changeAccess}><strong>Confirmar {accessAction === "block" ? "bloqueio" : "desbloqueio"}</strong><p>Esta ação altera imediatamente o acesso ao aplicativo e será registrada no histórico.</p><label htmlFor="admin-access-reason">Motivo</label><textarea id="admin-access-reason" value={accessReason} onChange={(event) => setAccessReason(event.target.value)} minLength={3} maxLength={2000} required /><div><button type="button" onClick={() => setAccessAction(null)}>Cancelar</button><button type="submit" disabled={savingAccess || accessReason.trim().length < 3}>{savingAccess ? "Salvando…" : "Confirmar"}</button></div></form>}</section><section className="admin-detail-card"><h2>Assinatura</h2>{detail.subscription ? <dl><dt>Plano</dt><dd>{detail.subscription.plan}</dd><dt>Estado</dt><dd>{detail.subscription.status}</dd><dt>Ciclo</dt><dd>{detail.subscription.billing_cycle}</dd><dt>Provedor</dt><dd>{detail.subscription.gateway_provider}</dd><dt>Período</dt><dd>{date(detail.subscription.current_period_start)} a {date(detail.subscription.current_period_end)}</dd><dt>Cancelamento</dt><dd>{detail.subscription.cancel_at_period_end ? "Ao fim do período" : detail.subscription.cancelled_at ? date(detail.subscription.cancelled_at) : "Não agendado"}</dd></dl> : <p>Sem assinatura.</p>}</section><section className="admin-detail-card"><h2>Organizações</h2>{detail.organizations.length ? detail.organizations.map((org) => <p key={org.id}>{org.name} <span className="admin-pill">{org.role}</span></p>) : <p>Nenhuma organização.</p>}</section><section className="admin-detail-card"><h2>Faturas</h2>{detail.invoices.length ? detail.invoices.map((invoice) => <p key={invoice.id}>{date(invoice.due_date)} · {money(invoice.amount_cents)} · {invoice.status} {invoice.invoice_url && <a href={invoice.invoice_url} target="_blank" rel="noreferrer">Abrir</a>}</p>) : <p>Nenhuma fatura.</p>}</section><section className="admin-detail-card"><h2>Histórico de acesso</h2>{audit.length ? audit.map((event) => <p key={event.id}>{date(event.created_at)} · {auditLabels[event.action] || event.action} · {event.reason} {event.result === "failed" ? "(falhou)" : ""}</p>) : <p>Nenhuma ação registrada.</p>}</section></div>}
    {detail?.subscription?.coupon_reprice_due && <section className="admin-detail-card admin-billing-card"><h2>Atualização de preço pendente</h2><p>O desconto terminou, mas o preço normal ainda não foi confirmado no provedor. Tente novamente antes da próxima cobrança.</p><form className="admin-access-form" onSubmit={retryCouponReprice}><label htmlFor="admin-reprice-reason">Motivo</label><textarea id="admin-reprice-reason" value={repriceReason} onChange={(event) => setRepriceReason(event.target.value)} minLength={3} maxLength={2000} required /><div><button type="submit" disabled={savingReprice || repriceReason.trim().length < 3}>{savingReprice ? "Atualizando…" : "Atualizar preço normal"}</button></div></form></section>}
    {detail && section === "users" && <section className="admin-detail-card admin-reset-card"><h2>Ajuda com a senha</h2><p>Envie um link de uso único para o e-mail cadastrado. A senha atual não será exibida nem alterada aqui.</p><button type="button" className="admin-create-trigger" onClick={() => { setResetOpen(true); setResetReason(""); }}>Enviar link de redefinição</button>{resetOpen && <form className="admin-access-form" onSubmit={requestPasswordReset}><strong>Confirmar envio para {detail.email}</strong><label htmlFor="admin-reset-reason">Motivo</label><textarea id="admin-reset-reason" value={resetReason} onChange={(event) => setResetReason(event.target.value)} minLength={3} maxLength={2000} required /><div><button type="button" onClick={() => setResetOpen(false)}>Cancelar</button><button type="submit" disabled={savingReset || resetReason.trim().length < 3}>{savingReset ? "Enviando…" : "Confirmar envio"}</button></div></form>}</section>}
    {detail && section === "users" && <AdminGrants userId={detail.id} subscription={detail.subscription} onChanged={async () => { setDetail(await getAdminUser(detail.id)); setAudit((await getAdminUserAudit(detail.id)).items); }} />}
    {detail && section === "users" && <AdminBillingActions userId={detail.id} subscription={detail.subscription} onChanged={async () => { setDetail(await getAdminUser(detail.id)); setAudit((await getAdminUserAudit(detail.id)).items); }} />}
    {detail && section === "organizations" && <div className="admin-detail-grid"><section className="admin-detail-card"><h2>Organização</h2><dl><dt>ID</dt><dd>{detail.id}</dd><dt>Tipo</dt><dd>{detail.org_type || "—"}</dd><dt>Criada em</dt><dd>{date(detail.created_at)}</dd></dl></section><section className="admin-detail-card"><h2>Membros e proprietário</h2>{detail.members.length ? detail.members.map((member) => <p key={member.id}>{displayName(member)} <span className="admin-pill">{member.role}</span><br /><small>{member.email}</small></p>) : <p>Nenhum membro.</p>}</section></div>}
    {!detail && !creating && section !== "plans" && !loading && page?.total > PAGE_SIZE && <div className="admin-pagination"><button type="button" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}><ChevronLeft size={16} /> Anterior</button><span>{offset + 1}–{Math.min(offset + PAGE_SIZE, page.total)} de {page.total}</span><button type="button" disabled={offset + PAGE_SIZE >= page.total} onClick={() => setOffset(offset + PAGE_SIZE)}>Próxima <ChevronRight size={16} /></button></div>}
  </div>;
}
