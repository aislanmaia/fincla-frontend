import { useEffect, useState } from "react";
import { ArrowRight, LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import { getAdminMe } from "../api/admin";
import { login, logout } from "../api/auth";
import { handleApiError } from "../api/client";
import { AdminDirectory } from "./AdminDirectory";
import { AdminCoupons } from "./AdminCoupons";
import "./admin.css";

const ACCESS_DENIED = "Esta conta não tem acesso ao painel administrativo.";

function accessError(error) {
  if (error?.response?.status === 403) return ACCESS_DENIED;
  return handleApiError(error);
}

export function AdminApp() {
  const [identity, setIdentity] = useState(null);
  const [checking, setChecking] = useState(Boolean(localStorage.getItem("auth_token")));
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [section, setSection] = useState("home");

  useEffect(() => {
    if (!localStorage.getItem("auth_token")) return;
    let active = true;
    getAdminMe()
      .then((admin) => { if (active) setIdentity(admin); })
      .catch((nextError) => {
        if (!active) return;
        logout();
        setError(accessError(nextError));
      })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email.trim(), password);
      const admin = await getAdminMe();
      setIdentity(admin);
      setPassword("");
    } catch (nextError) {
      logout();
      setError(accessError(nextError));
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    logout();
    setIdentity(null);
    setPassword("");
    setError("");
    setSection("home");
  }

  if (checking) {
    return <main className="admin-loading" role="status">Verificando acesso administrativo…</main>;
  }

  if (!identity) {
    return (
      <main className="admin-login">
        <section className="admin-login-story" aria-label="Fincla Administração">
          <div className="admin-brand"><img src="/logo.png" alt="" /><span>fincla<span className="admin-brand-dot">.</span></span><small>ADMIN</small></div>
          <div className="admin-login-story-copy">
            <span className="admin-eyebrow">ESPAÇO DE OPERAÇÃO</span>
            <h1>O cuidado com cada conta começa aqui.</h1>
            <p>Uma visão central para acompanhar pessoas, organizações e acesso ao Fincla.</p>
          </div>
          <div className="admin-login-story-foot"><ShieldCheck size={18} aria-hidden="true" /> Acesso reservado à administração Fincla</div>
        </section>
        <section className="admin-login-form-area">
          <div className="admin-login-form-wrap">
            <div className="admin-login-mark"><LockKeyhole size={21} aria-hidden="true" /></div>
            <span className="admin-eyebrow admin-eyebrow-dark">PAINEL ADMINISTRATIVO</span>
            <h2>Entrar no painel</h2>
            <p>Use suas credenciais do Fincla para continuar.</p>
            <form onSubmit={submit}>
              <label htmlFor="admin-email">E-mail</label>
              <input id="admin-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <label htmlFor="admin-password">Senha</label>
              <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              {error && <div className="admin-error" role="alert">{error}</div>}
              <button type="submit" disabled={busy}>{busy ? "Verificando…" : "Entrar no painel"}<ArrowRight size={17} aria-hidden="true" /></button>
            </form>
            <div className="admin-login-foot">Acesso protegido pela sua conta Fincla.</div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand"><img src="/logo.png" alt="" /><span>fincla<span className="admin-brand-dot">.</span></span><small>ADMIN</small></div>
        <div className="admin-sidebar-section">ESPAÇO DE TRABALHO</div>
        <nav className="admin-sidebar-nav" aria-label="Administração">
          {[["home", "Visão geral"], ["users", "Contas"], ["organizations", "Organizações"], ["plans", "Planos"], ["coupons", "Cupons"]].map(([key, label]) => <button key={key} type="button" className={section === key ? "admin-sidebar-current" : ""} onClick={() => setSection(key)}>{section === key && <span className="admin-sidebar-current-mark" />}{label}</button>)}
        </nav>
        <div className="admin-sidebar-bottom"><span>ADMINISTRADOR FINCLA</span><strong>{identity.email}</strong><button type="button" onClick={signOut}><LogOut size={16} aria-hidden="true" /> Sair</button></div>
      </aside>
      <section className="admin-content">
        <header className="admin-topbar"><span>Administração <span className="admin-breadcrumb-slash">/</span> {section === "home" ? "Visão geral" : section === "users" ? "Contas" : section === "organizations" ? "Organizações" : section === "coupons" ? "Cupons" : "Planos"}</span><span className="admin-topbar-secure"><ShieldCheck size={16} aria-hidden="true" /> Sessão protegida</span><button type="button" className="admin-mobile-signout" onClick={signOut}><LogOut size={16} aria-hidden="true" /> Sair</button></header>
        <div className="admin-mobile-nav"><button type="button" onClick={() => setSection("home")}>Início</button><button type="button" onClick={() => setSection("users")}>Contas</button><button type="button" onClick={() => setSection("organizations")}>Organizações</button><button type="button" onClick={() => setSection("plans")}>Planos</button><button type="button" onClick={() => setSection("coupons")}>Cupons</button></div>
        {section === "home" ? <div className="admin-content-inner">
          <div className="admin-page-number">01 / VISÃO GERAL</div>
          <h1>Boas-vindas ao <em>controle</em> do Fincla.</h1>
          <p className="admin-intro">Seu acesso administrativo está confirmado. Consulte contas, organizações e planos no menu.</p>
          <div className="admin-status-card"><div className="admin-status-icon"><ShieldCheck size={26} aria-hidden="true" /></div><div><span className="admin-status-eyebrow">PERMISSÃO CONFIRMADA</span><h2>Acesso administrativo ativo</h2><p>{identity.email}</p></div><span className="admin-status-indicator" aria-label="Ativo" /></div>
        </div> : section === "coupons" ? <AdminCoupons /> : <AdminDirectory section={section} />}
      </section>
    </main>
  );
}
