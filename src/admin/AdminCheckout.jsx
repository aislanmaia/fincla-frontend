import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, RefreshCw } from "lucide-react";
import { getAdminCheckoutEvents, getAdminStuckCheckoutAccounts, getAdminUserCheckoutEvents } from "../api/admin";
import { handleApiError } from "../api/client";
import { AdminSelect } from "./AdminSelect";

// The diary went live with API v298 in production: accounts created before it have no
// entries. Admin runs only against production, so the cutoff is that deploy's instant.
const DIARY_STARTED_AT = "2026-11-01T02:51:10Z";

const EVENT_LABELS = {
  account_created: "Conta criada",
  account_resumed: "Retomou o checkout",
  registration_refused: "Cadastro recusado",
  registration_failed: "Cadastro falhou",
  customer_provisioning_failed: "Cliente não criado no Asaas",
  checkout_login_failed: "Login recusado",
  payment_rejected: "Pagamento barrado antes do Asaas",
  charge_declined: "Cobrança recusada",
  charge_uncertain: "Cobrança sem confirmação",
  charge_sent: "Cobrança enviada",
  sign_in_throttled: "Tentativas de senha bloqueadas",
};

const REASON_LABELS = {
  password_mismatch: "Senha diferente da cadastrada",
  account_blocked: "Conta bloqueada",
  no_subscription: "Conta sem assinatura",
  persona_mismatch: "Plano de outro perfil (pessoal × consultor)",
  invalid_offer: "Oferta inválida",
  email_lookup_failed: "Erro ao consultar o e-mail",
  account_not_created: "Erro ao criar a conta",
  subscription_lookup_failed: "Erro ao consultar a assinatura",
  asaas_customer_rejected: "Asaas recusou os dados do cliente",
  asaas_customer_unavailable: "Asaas indisponível ao criar o cliente",
  invalid_credentials: "Senha incorreta",
  login_error: "Erro interno no login",
  terms_outdated: "Termos de uso desatualizados",
  card_not_numeric: "Dados do cartão com caracteres inválidos",
  subscription_past_due: "Assinatura em atraso",
  already_entitled: "Conta já tem acesso",
  offer_changed: "A oferta mudou durante o pagamento",
  offer_rejected: "Oferta recusada",
  subscription_changed: "A assinatura mudou durante o pagamento",
  coupon_unavailable: "Cupom indisponível",
  asaas_card_declined: "Cartão recusado pelo Asaas",
  asaas_field_rejected: "Asaas recusou um campo",
  gateway_uncertain: "Asaas não confirmou a cobrança",
  too_many_attempts_email_from_address: "Muitas senhas erradas para este e-mail, vindas da mesma conexão",
  too_many_attempts_email: "Muitas senhas erradas para este e-mail, de várias conexões",
  too_many_attempts_address: "Muitas senhas erradas vindas da mesma conexão, em vários e-mails",
};

const STATUS_LABELS = { pending_payment: "aguardando pagamento", active: "ativa", past_due: "em atraso", cancelled: "cancelada", expired: "expirada" };
const PROVIDER_REASONS = { manual: "Assinatura gerida manualmente, fora do Asaas", sponsored: "Acesso cedido (cortesia), sem cobrança" };
const LIST_LIMIT = 100;
const CYCLE_LABELS = { monthly: "Mensal", yearly: "Anual" };

// A block on one connection guessing many emails names no account and no email:
// the email that happened to be guessed when the limit hit is not the attacker.
// It is checked first so a stray email on such an event is never shown as its subject.
const THROTTLED_ROUTES = { login: "no login", checkout_register: "no cadastro do checkout" };

function problemHeading(event) {
  if (event.reason === "too_many_attempts_address") {
    const route = THROTTLED_ROUTES[event.details?.route];
    return { subject: "Vários e-mails", context: route ? `Sem conta ligada · ${route}` : "Sem conta ligada" };
  }
  return {
    subject: event.email || "E-mail não informado",
    context: event.user_id ? "Conta criada" : "Antes de criar a conta",
  };
}

export function eventLabel(eventType) {
  return EVENT_LABELS[eventType] || eventType;
}

export function reasonLabel(reason) {
  if (!reason) return null;
  if (REASON_LABELS[reason]) return REASON_LABELS[reason];
  if (reason.startsWith("subscription_")) {
    const status = reason.slice("subscription_".length);
    return `Assinatura ${STATUS_LABELS[status] || status}`;
  }
  if (reason.startsWith("gateway_")) {
    const provider = reason.slice("gateway_".length);
    return PROVIDER_REASONS[provider] || `Assinatura fora do Asaas (${provider})`;
  }
  return reason;
}

// The API sends UTC timestamps without an offset.
const asUtc = (value) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
const validDate = (value) => {
  if (!value) return null;
  const parsed = asUtc(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const dateTime = (value) => { const parsed = validDate(value); return parsed ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(parsed) : "—"; };
const dateOnly = (value) => { const parsed = validDate(value); return parsed ? new Intl.DateTimeFormat("pt-BR").format(parsed) : "—"; };
const accountName = (account) => account.first_name || account.email || "Sem e-mail";
const createdBeforeDiary = (account) => { const created = validDate(account.account_created_at); return Boolean(created) && created < new Date(DIARY_STARTED_AT); };
export const noEventsLabel = (account) => createdBeforeDiary(account)
  ? `Criada antes do diário (${dateTime(DIARY_STARTED_AT)})`
  : "Nenhum passo registrado no diário";

function EventSummary({ event, empty }) {
  if (!event) return <span className="admin-checkout-muted">{empty}</span>;
  const reason = reasonLabel(event.reason);
  return <span className="admin-checkout-summary">
    <strong>{eventLabel(event.event_type)}</strong>
    <small>{reason ? `${reason} · ` : ""}{dateTime(event.created_at)}</small>
  </span>;
}

function Timeline({ events, account }) {
  if (!events.length) {
    return <p className="admin-empty">{createdBeforeDiary(account)
      ? `Esta conta foi criada antes do diário existir (${dateTime(DIARY_STARTED_AT)}). O que aconteceu antes disso não aparece aqui.`
      : "Nenhum evento registrado para esta conta."}</p>;
  }
  return <ol className="admin-checkout-timeline" aria-label="Linha do tempo do checkout">
    {events.map((event) => {
      const reason = reasonLabel(event.reason);
      const hasDetails = event.details && Object.keys(event.details).length > 0;
      return <li key={event.id} className={`admin-checkout-event is-${event.severity}`}>
        <span className="admin-checkout-event-dot" aria-hidden="true" />
        <div className="admin-checkout-event-body">
          <div className="admin-checkout-event-head">
            <strong>{eventLabel(event.event_type)}</strong>
            <span className={`admin-checkout-severity is-${event.severity}`}>{event.severity === "problem" ? "Problema" : "Registro"}</span>
            <time dateTime={validDate(event.created_at)?.toISOString()}>{dateTime(event.created_at)}</time>
          </div>
          {reason && <p className="admin-checkout-reason">{reason} <code>{event.reason}</code></p>}
          {hasDetails && <details className="admin-checkout-details" open={event.severity === "problem"}>
            <summary>Trecho técnico</summary>
            <pre>{JSON.stringify(event.details, null, 2)}</pre>
          </details>}
        </div>
      </li>;
    })}
  </ol>;
}

export function AdminCheckout() {
  const [view, setView] = useState("stuck");
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [account, setAccount] = useState(null);
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  // Only the latest timeline request may fill the screen.
  const timelineRequest = useRef(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    const request = view === "stuck"
      ? getAdminStuckCheckoutAccounts({ only_problems: onlyProblems || undefined, limit: LIST_LIMIT })
      : getAdminCheckoutEvents({ severity: "problem", limit: LIST_LIMIT });
    request.then((result) => { if (active) setItems(result.items); })
      .catch((nextError) => { if (active) setError(handleApiError(nextError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [view, onlyProblems, reload]);

  async function openAccount(nextAccount) {
    const content = document.querySelector(".admin-content");
    if (content) content.scrollTop = 0;
    const request = ++timelineRequest.current;
    setAccount(nextAccount); setEvents([]); setError(""); setLoadingEvents(true);
    try {
      const result = await getAdminUserCheckoutEvents(nextAccount.user_id);
      if (request === timelineRequest.current) setEvents(result.items);
    } catch (nextError) {
      if (request === timelineRequest.current) setError(handleApiError(nextError));
    } finally {
      if (request === timelineRequest.current) setLoadingEvents(false);
    }
  }

  function closeAccount() {
    timelineRequest.current += 1;
    setAccount(null); setEvents([]); setError(""); setLoadingEvents(false);
  }

  function changeView(nextView) {
    if (nextView === view) return;
    // Each view has its own row shape; never render one with the other's rows.
    setItems([]);
    setLoading(true);
    closeAccount();
    setView(nextView);
  }

  if (account) {
    return <div className="admin-directory">
      <div className="admin-page-number">06 / CHECKOUT</div>
      <div className="admin-directory-heading">
        <div>
          <button className="admin-back" type="button" onClick={closeAccount}><ArrowLeft size={16} /> Voltar para o checkout</button>
          <h1>{accountName(account)}</h1>
          <p>O que aconteceu com esta conta no caminho até o pagamento, do mais recente ao mais antigo.</p>
        </div>
        <button type="button" className="admin-quiet-button" onClick={() => openAccount(account)} disabled={loadingEvents}><RefreshCw size={16} /> Atualizar</button>
      </div>
      {error && <div className="admin-error" role="alert">{error}</div>}
      <div className="admin-checkout-detail">
        <section className="admin-detail-card">
          <h2>Conta</h2>
          <dl>
            <dt>E-mail</dt><dd>{account.email || "—"}</dd>
            <dt>ID</dt><dd>{account.user_id}</dd>
            {account.account_created_at && <><dt>Criada em</dt><dd>{dateTime(account.account_created_at)}</dd></>}
            {account.subscription_status && <><dt>Assinatura</dt><dd>{STATUS_LABELS[account.subscription_status] || account.subscription_status}</dd></>}
            {account.billing_cycle && <><dt>Ciclo</dt><dd>{CYCLE_LABELS[account.billing_cycle] || account.billing_cycle}</dd></>}
            {"gateway_customer_id" in account && <><dt>Cliente Asaas</dt><dd>{account.gateway_customer_id || "Ainda não criado"}</dd></>}
          </dl>
        </section>
        <section className="admin-detail-card">
          <h2>Linha do tempo</h2>
          {loadingEvents ? <p role="status">Carregando eventos…</p> : <Timeline events={events} account={account} />}
        </section>
      </div>
    </div>;
  }

  return <div className="admin-directory">
    <div className="admin-page-number">06 / CHECKOUT</div>
    <div className="admin-directory-heading">
      <div>
        <h1>Checkout</h1>
        <p>Contas criadas no checkout que ainda não pagaram, e o que deu errado no caminho.</p>
      </div>
      <button type="button" className="admin-quiet-button" onClick={() => setReload((value) => value + 1)} disabled={loading}><RefreshCw size={16} /> Atualizar</button>
    </div>
    <div className="admin-checkout-tabs" role="tablist" aria-label="Visões do checkout">
      <button type="button" role="tab" aria-selected={view === "stuck"} onClick={() => changeView("stuck")}>Contas sem pagamento</button>
      <button type="button" role="tab" aria-selected={view === "problems"} onClick={() => changeView("problems")}>Problemas recentes</button>
    </div>
    {view === "stuck" && <div className="admin-directory-filters">
      <AdminSelect ariaLabel="Filtrar contas sem pagamento" value={onlyProblems ? "problems" : ""} onChange={(value) => setOnlyProblems(value === "problems")} options={[{ value: "", label: "Todas as contas" }, { value: "problems", label: "Só com problema" }]} />
    </div>}
    {error && <div className="admin-error" role="alert">{error}</div>}
    {loading ? <p role="status">Carregando…</p> : view === "stuck"
      ? <div className="admin-directory-list">
        {items.map((item) => <button type="button" className="admin-directory-row admin-checkout-row" key={item.user_id} onClick={() => openAccount(item)}>
          <span><strong>{accountName(item)}</strong><small>{item.email ? `${item.email} · ` : ""}criada em {dateOnly(item.account_created_at)}</small></span>
          <EventSummary event={item.last_problem || item.last_event} empty={noEventsLabel(item)} />
          <span className={`admin-pill ${item.problem_count ? "admin-checkout-pill-problem" : ""}`}>{item.problem_count ? `${item.problem_count} ${item.problem_count === 1 ? "problema" : "problemas"}` : "Sem problemas"}</span>
          <ChevronRight size={18} />
        </button>)}
        {!items.length && <p className="admin-empty">{onlyProblems ? "Nenhuma conta sem pagamento com problema registrado." : "Nenhuma conta aguardando o primeiro pagamento."}</p>}
      </div>
      : <div className="admin-directory-list">
        {items.map((item) => {
          const heading = problemHeading(item);
          const row = <>
            <span><strong>{heading.subject}</strong><small>{heading.context}</small></span>
            <EventSummary event={item} empty="" />
            <span className="admin-pill admin-checkout-pill-problem">Problema</span>
          </>;
          return item.user_id
            ? <button type="button" className="admin-directory-row admin-checkout-row" key={item.id} onClick={() => openAccount({ user_id: item.user_id, email: item.email, first_name: null })}>{row}<ChevronRight size={18} /></button>
            : <div className="admin-directory-row admin-checkout-row is-static" key={item.id}>{row}<span /></div>;
        })}
        {!items.length && <p className="admin-empty">Nenhum problema registrado no checkout.</p>}
      </div>}
    {!loading && items.length >= LIST_LIMIT && <p className="admin-checkout-limit" role="note">Mostrando só os {LIST_LIMIT} mais recentes; os mais antigos não aparecem nesta lista.</p>}
  </div>;
}
