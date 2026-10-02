import { useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { getAdminOrganization, getAdminOrganizations, getAdminPlans, getAdminUser, getAdminUsers } from "../api/admin";
import { handleApiError } from "../api/client";

const PAGE_SIZE = 20;
const money = (cents) => cents == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const date = (value) => value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value)) : "—";
const displayName = (user) => [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;

export function AdminDirectory({ section }) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setQuery(""); setSubmittedQuery(""); setStatus(""); setOffset(0); setDetail(null); setPage(null);
  }, [section]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    const request = section === "users"
      ? getAdminUsers({ q: submittedQuery || undefined, status: status || undefined, limit: PAGE_SIZE, offset })
      : section === "organizations"
        ? getAdminOrganizations({ q: submittedQuery || undefined, limit: PAGE_SIZE, offset })
        : getAdminPlans();
    request.then((result) => { if (active) setPage(result); })
      .catch((nextError) => { if (active) setError(handleApiError(nextError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [section, submittedQuery, status, offset]);

  async function openDetail(id) {
    setLoading(true); setError("");
    try {
      setDetail(section === "users" ? await getAdminUser(id) : await getAdminOrganization(id));
    } catch (nextError) {
      setError(handleApiError(nextError));
    } finally {
      setLoading(false);
    }
  }

  const title = section === "users" ? "Contas" : section === "organizations" ? "Organizações" : "Planos";
  return <div className="admin-directory">
    <div className="admin-page-number">{section === "users" ? "02" : section === "organizations" ? "03" : "04"} / DIRETÓRIO</div>
    <div className="admin-directory-heading">
      <div>{detail && <button className="admin-back" type="button" onClick={() => setDetail(null)}><ArrowLeft size={16} /> Voltar para {title.toLowerCase()}</button>}
        <h1>{detail ? (section === "users" ? displayName(detail) : detail.name) : title}</h1>
        <p>{detail ? "Dados de acesso e vínculos desta conta." : section === "plans" ? "Catálogo de planos do Fincla." : `Consulte ${title.toLowerCase()} cadastradas no Fincla.`}</p>
      </div>
      {!detail && section !== "plans" && <span className="admin-directory-count">{page?.total ?? 0} registros</span>}
    </div>
    {error && <div className="admin-error" role="alert">{error}</div>}
    {loading && <p role="status">Carregando…</p>}
    {!detail && section !== "plans" && <form className="admin-directory-filters" onSubmit={(event) => { event.preventDefault(); setOffset(0); setSubmittedQuery(query.trim()); }}>
      <label className="admin-search"><Search size={17} aria-hidden="true" /><input aria-label={`Buscar ${title.toLowerCase()}`} placeholder={section === "users" ? "Nome, e-mail ou ID" : "Nome ou ID"} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      {section === "users" && <select aria-label="Filtrar por assinatura" value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0); }}><option value="">Todas as assinaturas</option><option value="active">Ativa</option><option value="past_due">Em atraso</option><option value="cancelled">Cancelada</option><option value="suspended">Suspensa</option></select>}
      <button type="submit">Buscar</button>
    </form>}
    {!detail && !loading && section === "users" && <div className="admin-directory-list">{page?.items.map((user) => <button type="button" className="admin-directory-row" key={user.id} onClick={() => openDetail(user.id)}><span><strong>{displayName(user)}</strong><small>{user.email}</small></span><span>{user.subscription?.plan || "Sem plano"}</span><span className="admin-pill">{user.subscription?.status || "Sem assinatura"}</span><ChevronRight size={18} /></button>)}{!page?.items.length && <p className="admin-empty">Nenhuma conta encontrada.</p>}</div>}
    {!detail && !loading && section === "organizations" && <div className="admin-directory-list">{page?.items.map((org) => <button type="button" className="admin-directory-row" key={org.id} onClick={() => openDetail(org.id)}><span><strong>{org.name}</strong><small>{org.id}</small></span><span>{org.org_type || "—"}</span><span>{date(org.created_at)}</span><ChevronRight size={18} /></button>)}{!page?.items.length && <p className="admin-empty">Nenhuma organização encontrada.</p>}</div>}
    {!detail && !loading && section === "plans" && <div className="admin-plan-grid">{page?.items.map((plan) => <article className="admin-plan-card" key={plan.id}><span className="admin-plan-audience">{plan.audience === "consultant" ? "CONSULTOR" : "PESSOAL"}</span><h2>{plan.name}</h2><p>{plan.id}</p><div><strong>{money(plan.monthly_price_cents)}</strong><small> / mês</small></div><p>Anual: {money(plan.yearly_price_cents)}</p><p>Até {plan.max_organizations} organizações · {plan.max_users_per_org} pessoas por organização</p><span className="admin-pill">{plan.is_active ? "Ativo" : "Inativo"}</span></article>)}</div>}
    {detail && section === "users" && <div className="admin-detail-grid"><section className="admin-detail-card"><h2>Conta</h2><dl><dt>E-mail</dt><dd>{detail.email}</dd><dt>ID</dt><dd>{detail.id}</dd><dt>Criada em</dt><dd>{date(detail.created_at)}</dd><dt>Onboarding</dt><dd>{detail.onboarding_completed ? "Concluído" : "Pendente"}</dd><dt>Senha</dt><dd>{detail.password_pending ? "Aguardando definição" : "Definida"}</dd></dl></section><section className="admin-detail-card"><h2>Assinatura</h2>{detail.subscription ? <dl><dt>Plano</dt><dd>{detail.subscription.plan}</dd><dt>Estado</dt><dd>{detail.subscription.status}</dd><dt>Ciclo</dt><dd>{detail.subscription.billing_cycle}</dd><dt>Provedor</dt><dd>{detail.subscription.gateway_provider}</dd><dt>Período</dt><dd>{date(detail.subscription.current_period_start)} a {date(detail.subscription.current_period_end)}</dd><dt>Cancelamento</dt><dd>{detail.subscription.cancel_at_period_end ? "Ao fim do período" : detail.subscription.cancelled_at ? date(detail.subscription.cancelled_at) : "Não agendado"}</dd></dl> : <p>Sem assinatura.</p>}</section><section className="admin-detail-card"><h2>Organizações</h2>{detail.organizations.length ? detail.organizations.map((org) => <p key={org.id}>{org.name} <span className="admin-pill">{org.role}</span></p>) : <p>Nenhuma organização.</p>}</section><section className="admin-detail-card"><h2>Faturas</h2>{detail.invoices.length ? detail.invoices.map((invoice) => <p key={invoice.id}>{date(invoice.due_date)} · {money(invoice.amount_cents)} · {invoice.status} {invoice.invoice_url && <a href={invoice.invoice_url} target="_blank" rel="noreferrer">Abrir</a>}</p>) : <p>Nenhuma fatura.</p>}</section></div>}
    {detail && section === "organizations" && <div className="admin-detail-grid"><section className="admin-detail-card"><h2>Organização</h2><dl><dt>ID</dt><dd>{detail.id}</dd><dt>Tipo</dt><dd>{detail.org_type || "—"}</dd><dt>Criada em</dt><dd>{date(detail.created_at)}</dd></dl></section><section className="admin-detail-card"><h2>Membros e proprietário</h2>{detail.members.length ? detail.members.map((member) => <p key={member.id}>{displayName(member)} <span className="admin-pill">{member.role}</span><br /><small>{member.email}</small></p>) : <p>Nenhum membro.</p>}</section></div>}
    {!detail && section !== "plans" && !loading && page?.total > PAGE_SIZE && <div className="admin-pagination"><button type="button" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}><ChevronLeft size={16} /> Anterior</button><span>{offset + 1}–{Math.min(offset + PAGE_SIZE, page.total)} de {page.total}</span><button type="button" disabled={offset + PAGE_SIZE >= page.total} onClick={() => setOffset(offset + PAGE_SIZE)}>Próxima <ChevronRight size={16} /></button></div>}
  </div>;
}
