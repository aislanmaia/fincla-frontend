import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, CircleHelp, CreditCard, FileText, LockKeyhole, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { currentCheckout } from "../../api/checkout";
import { getCurrentSubscription } from "../../api/subscriptions";
import { changePassword } from "../../api/auth";
import { handleApiError } from "../../api/client";
import { T } from "../tokens.js";
import { G, S } from "../typography.js";
import { accessCheckoutPath, accessState, expiringAccess } from "../features/subscription/accessState.js";

const formatDate = (value) => value ? new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : null;
const formatMoney = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);

const COPY = {
  courtesy_ended: { eyebrow: "CORTESIA ENCERRADA", title: "Sua cortesia chegou ao fim.", body: "Entre na assinatura com a mesma conta para continuar de onde parou.", cta: "Escolher um plano" },
  first_purchase: { eyebrow: "PRIMEIRA ASSINATURA", title: "Sua conta está pronta para continuar.", body: "Escolha o plano e confirme o pagamento para liberar o uso do Fincla.", cta: "Escolher um plano" },
  ended: { eyebrow: "ASSINATURA ENCERRADA", title: "Seu período de acesso terminou.", body: "Você pode contratar novamente usando esta conta.", cta: "Reativar assinatura" },
  past_due: { eyebrow: "PAGAMENTO PENDENTE", title: "Vamos regularizar sua assinatura.", body: "Confira a cobrança existente antes de iniciar outro pagamento.", cta: "Abrir fatura" },
  processing: { eyebrow: "PAGAMENTO EM CONFIRMAÇÃO", title: "Estamos verificando seu pagamento.", body: "A confirmação pode levar alguns instantes. Verifique o resultado antes de tentar pagar novamente.", cta: "Verificar novamente" },
  sponsored: { eyebrow: "ACESSO PATROCINADO", title: "Seu acesso está indisponível.", body: "Fale com seu consultor para verificar o vínculo e a capacidade da assinatura.", cta: "Falar com o suporte" },
  unknown: { eyebrow: "ACESSO INDISPONÍVEL", title: "Vamos verificar seu acesso.", body: "Sua conta continua disponível. Atualize a situação ou peça ajuda para continuar.", cta: "Verificar novamente" },
  active: { eyebrow: "ACESSO ATIVO", title: "Seu Fincla está disponível.", body: "Aqui você acompanha as datas e os detalhes da sua assinatura.", cta: "Voltar ao Fincla" },
};

function card(children, style = {}) {
  return <section style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 17, padding: "23px 24px", ...style }}>{children}</section>;
}

export function AccessPage({ session }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("access");
  const [detail, setDetail] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [attemptUnavailable, setAttemptUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [password, setPassword] = useState({ current: "", next: "", repeat: "" });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let nextAttempt = null;
      let attemptFailed = false;
      if (session.user?.subscription?.is_entitled !== true) {
        try {
          nextAttempt = await currentCheckout();
        } catch {
          attemptFailed = true;
        }
      }
      const nextDetail = await getCurrentSubscription();
      setAttempt(nextAttempt);
      setAttemptUnavailable(attemptFailed);
      setDetail(nextDetail);
      if (attemptFailed) setError("Não foi possível verificar a última tentativa de pagamento. Tente novamente antes de pagar.");
      await session.refreshAccess();
    } catch (failure) {
      setError(handleApiError(failure));
    } finally {
      setLoading(false);
    }
  }, [session.refreshAccess, session.user?.subscription?.is_entitled]);

  useEffect(() => { void refresh(); }, [refresh]);
  const user = session.user;
  const embedded = user?.subscription;
  const subscription = detail ? { ...embedded, ...detail, plan: embedded?.plan } : embedded;
  const situation = attemptUnavailable && subscription?.is_entitled !== true ? "unknown" : accessState({ ...user, subscription }, attempt);
  const warning = expiringAccess(subscription);
  const courtesyActive = Boolean(subscription?.courtesy_plan && subscription?.courtesy_until && new Date(subscription.courtesy_until) > new Date() && subscription?.status !== "active");
  const copy = situation === "active" && warning?.kind === "courtesy"
    ? { ...COPY.active, eyebrow: "CORTESIA ATIVA", title: "Sua cortesia está perto do fim.", body: "Continue usando o Fincla até a data indicada. Quando o período terminar, você poderá escolher um plano nesta conta." }
    : situation === "active" && warning?.kind === "cancel_scheduled"
      ? { ...COPY.active, eyebrow: "ENCERRAMENTO AGENDADO", title: "Seu acesso continua até o fim do período.", body: "Sua assinatura não vai renovar automaticamente. Quando o período terminar, você poderá contratar novamente nesta conta." }
      : COPY[situation];
  const canPay = user?.role !== "member" && embedded?.gateway_provider === "asaas" && !embedded?.beta_enabled;
  const outstandingInvoice = detail?.recent_invoices?.find((invoice) => ["overdue", "pending"].includes(invoice.status));
  const invoiceUrl = outstandingInvoice?.invoice_url;
  const checkoutPath = accessCheckoutPath(user);

  function primaryAction() {
    if (situation === "active") { navigate({ to: user?.is_consultant ? "/consultant" : "/dashboard" }); return; }
    if (situation === "processing" || situation === "unknown") { void refresh(); return; }
    if (situation === "past_due") { if (invoiceUrl) window.open(invoiceUrl, "_blank", "noopener,noreferrer"); else setTab("invoices"); return; }
    if (situation === "sponsored") { window.location.href = "mailto:contato@fincla.com"; return; }
    navigate({ to: checkoutPath });
  }

  async function submitPassword(event) {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    if (password.next.length < 8) { setPasswordError("A nova senha deve ter pelo menos 8 caracteres."); return; }
    if (password.next !== password.repeat) { setPasswordError("As novas senhas não coincidem."); return; }
    setPasswordBusy(true);
    try {
      await changePassword(password.current, password.next);
      setPassword({ current: "", next: "", repeat: "" });
      setPasswordMessage("Senha atualizada com sucesso.");
    } catch (failure) {
      setPasswordError(handleApiError(failure));
    } finally {
      setPasswordBusy(false);
    }
  }

  const actionAllowed = canPay || ["active", "processing", "unknown", "sponsored"].includes(situation);
  const actionLabel = situation === "past_due" && !invoiceUrl ? "Ver faturas" : copy.cta;

  return <main className="fincla-scroll" style={{ ...G, height: "100%", overflowY: "auto", background: "#F6F7F3", color: T.ink }}>
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px clamp(20px, 4vw, 54px)", background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 800 }}><img src="/logo.png" alt="" width={27} height={27} /> Fincla <span style={{ color: T.inkGhost, fontWeight: 400 }}> / </span><span style={{ color: T.inkMid, fontWeight: 650 }}>Plano e acesso</span></div>
        <button type="button" onClick={session.signOut} style={{ ...G, display: "inline-flex", alignItems: "center", gap: 7, border: 0, background: "transparent", color: T.inkMid, fontSize: 12, fontWeight: 700, cursor: "pointer" }}><LogOut size={15} /> Sair</button>
      </header>
      <div style={{ width: "min(100% - 40px, 1100px)", margin: "0 auto", padding: "clamp(26px, 5vw, 58px) 0 54px", display: "grid", gap: 21 }}>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 330px), 1fr))", gap: 0, overflow: "hidden", borderRadius: 20, background: "#183858", color: "#fff", boxShadow: "0 20px 50px rgba(24,56,88,.14)" }}>
          <div style={{ padding: "clamp(25px, 4vw, 47px)", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".13em", color: "#BFD8ED" }}>{copy.eyebrow}</span>
            <h1 style={{ ...S, fontSize: "clamp(28px, 3.3vw, 43px)", lineHeight: 1.12, letterSpacing: "-.035em", margin: "15px 0 12px" }}>{copy.title}</h1>
            <p style={{ fontSize: 14, lineHeight: 1.65, color: "#D5E2ED", margin: "0 0 23px", maxWidth: 430 }}>{copy.body}</p>
            {actionAllowed && <button type="button" onClick={primaryAction} disabled={loading && situation === "processing"} style={{ ...G, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 44, padding: "10px 17px", border: 0, borderRadius: 10, background: "#D9F1DE", color: "#173E29", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>{situation === "processing" ? <RefreshCw size={16} /> : null}{actionLabel}<ArrowRight size={16} /></button>}
            {!canPay && situation !== "active" && situation !== "sponsored" && <p style={{ fontSize: 12, lineHeight: 1.55, color: "#D5E2ED", margin: "16px 0 0" }}>Peça ao responsável pela assinatura para regularizar o acesso.</p>}
          </div>
          <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", padding: "32px clamp(25px, 4vw, 45px)", background: "#214565", borderLeft: "1px solid rgba(255,255,255,.1)" }}>
            <ShieldCheck size={24} color="#B8DCBF" aria-hidden="true" />
            <div style={{ marginTop: 27, fontSize: 11, fontWeight: 800, letterSpacing: ".1em", color: "#BFD8ED" }}>CONTA</div>
            <div style={{ fontSize: 17, fontWeight: 750, overflowWrap: "anywhere", marginTop: 5 }}>{user?.email}</div>
            <div style={{ height: 1, background: "rgba(255,255,255,.15)", margin: "22px 0" }} />
            <div style={{ fontSize: 12, color: "#BFD8ED" }}>{warning ? "Acesso até" : subscription?.courtesy_until && situation === "courtesy_ended" ? "Cortesia encerrada em" : subscription?.current_period_end ? "Período até" : "Situação"}</div>
            <div style={{ fontSize: 18, fontWeight: 750, marginTop: 4 }}>{formatDate(warning?.deadline || (situation === "courtesy_ended" ? subscription?.courtesy_until : subscription?.current_period_end)) || (situation === "active" ? "Ativo" : "Aguardando regularização")}</div>
            {(situation === "courtesy_ended" || courtesyActive) && <p style={{ margin: "14px 0 0", fontSize: 12, lineHeight: 1.5, color: "#D5E2ED" }}>A cortesia não gera cobrança automática.</p>}
          </div>
        </section>

        <nav aria-label="Plano e acesso" style={{ display: "flex", gap: 8, flexWrap: "wrap", borderBottom: `1px solid ${T.border}` }}>
          {[["access", CreditCard, "Acesso"], ["invoices", FileText, "Faturas"], ["security", LockKeyhole, "Segurança"]].map(([key, Icon, label]) => <button key={key} type="button" onClick={() => setTab(key)} aria-current={tab === key ? "page" : undefined} style={{ ...G, display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 15px", border: 0, borderBottom: tab === key ? "3px solid #245E41" : "3px solid transparent", background: "transparent", color: tab === key ? "#245E41" : T.inkMid, fontSize: 13, fontWeight: 750, cursor: "pointer" }}><Icon size={16} />{label}</button>)}
        </nav>

        {error && <div role="alert" style={{ padding: "13px 16px", borderRadius: 10, background: "#FFF1E8", color: "#8B422A", fontSize: 13 }}>{error} <button type="button" onClick={refresh} style={{ border: 0, background: "transparent", color: "inherit", fontWeight: 800, textDecoration: "underline", cursor: "pointer" }}>Tentar novamente</button></div>}

        {tab === "access" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 16 }}>
          {card(<><div style={{ fontSize: 11, letterSpacing: ".1em", fontWeight: 800, color: T.inkLight }}>PLANO</div><h2 style={{ fontSize: 20, margin: "9px 0 7px" }}>{detail?.plan?.name || (user?.is_consultant ? "Fincla Consultor" : "Fincla Pessoal")}</h2><p style={{ color: T.inkMid, lineHeight: 1.6, fontSize: 13, margin: "0 0 14px" }}>{subscription?.beta_enabled ? "Acesso beta administrado pelo Fincla." : courtesyActive ? `Cortesia sem cobrança até ${formatDate(subscription.courtesy_until)}. A contratação fica disponível ao término.` : situation === "courtesy_ended" ? "Sua cortesia terminou. Você pode iniciar uma assinatura nesta conta." : situation === "processing" ? "Aguardando confirmação do pagamento." : situation === "past_due" ? "Há uma cobrança a regularizar." : subscription?.cancel_at_period_end ? `Renovação cancelada. Acesso até ${formatDate(subscription.current_period_end)}.` : situation === "active" ? "Sua assinatura está em dia." : "Sua assinatura precisa ser ativada."}</p><button type="button" onClick={refresh} disabled={loading} style={{ ...G, display: "inline-flex", alignItems: "center", gap: 6, padding: 0, border: 0, background: "transparent", color: "#245E41", fontSize: 12, fontWeight: 800, cursor: loading ? "wait" : "pointer" }}><RefreshCw size={14} /> Atualizar situação</button></>)}
          {card(<><CircleHelp size={19} color="#345E84" /><h2 style={{ fontSize: 17, margin: "14px 0 7px" }}>Precisa de ajuda?</h2><p style={{ color: T.inkMid, lineHeight: 1.6, fontSize: 13, margin: "0 0 14px" }}>Informe o e-mail da conta ao falar com a equipe Fincla. Podemos verificar o pagamento e o acesso.</p><a href="mailto:contato@fincla.com" style={{ color: "#245E41", fontWeight: 800, fontSize: 13 }}>Falar com o suporte ↗</a></>)}
        </div>}

        {tab === "invoices" && card(<><h2 style={{ fontSize: 18, margin: "0 0 8px" }}>Histórico de faturas</h2><p style={{ fontSize: 13, color: T.inkMid, margin: "0 0 18px" }}>Cobranças recentes desta conta.</p>{loading && !detail ? <p role="status">Carregando faturas…</p> : !detail?.recent_invoices?.length ? <p style={{ fontSize: 13, color: T.inkMid }}>Nenhuma fatura encontrada.</p> : <div style={{ display: "grid" }}>{detail.recent_invoices.map((invoice) => <div key={invoice.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "15px 0", borderTop: `1px solid ${T.border}` }}><div><strong style={{ fontSize: 14 }}>{formatMoney(invoice.amount_cents)}</strong><div style={{ fontSize: 12, color: T.inkMid, marginTop: 3 }}>{invoice.status === "overdue" ? "Em atraso" : invoice.status === "paid" ? "Paga" : invoice.status === "pending" ? "Pendente" : "Encerrada"} · Vencimento {formatDate(invoice.due_date)}</div></div>{invoice.invoice_url && <a href={invoice.invoice_url} target="_blank" rel="noopener noreferrer" style={{ color: "#245E41", fontWeight: 800, fontSize: 12 }}>Abrir fatura ↗</a>}</div>)}</div>}</>)}

        {tab === "security" && card(<><h2 style={{ fontSize: 18, margin: "0 0 7px" }}>Segurança da conta</h2><p style={{ fontSize: 13, color: T.inkMid, margin: "0 0 20px" }}>{user?.email}</p><form onSubmit={submitPassword} style={{ display: "grid", gap: 13, maxWidth: 420 }}>{[["current", "Senha atual"], ["next", "Nova senha"], ["repeat", "Confirme a nova senha"]].map(([key, label]) => <label key={key} style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 750 }}>{label}<input type="password" value={password[key]} onChange={(event) => setPassword((old) => ({ ...old, [key]: event.target.value }))} required autoComplete={key === "current" ? "current-password" : "new-password"} style={{ ...G, width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 9, border: `1px solid ${T.border}`, background: "#fff", fontSize: 14 }} /></label>)}{passwordError && <p role="alert" style={{ color: T.red, fontSize: 12, margin: 0 }}>{passwordError}</p>}{passwordMessage && <p role="status" style={{ color: T.green, fontSize: 12, margin: 0 }}>{passwordMessage}</p>}<button type="submit" disabled={passwordBusy} style={{ ...G, justifySelf: "start", padding: "10px 15px", border: 0, borderRadius: 9, background: "#183858", color: "#fff", fontSize: 12, fontWeight: 800, cursor: passwordBusy ? "wait" : "pointer" }}>{passwordBusy ? "Salvando…" : "Atualizar senha"}</button></form></>)}
      </div>
    </div>
  </main>;
}
