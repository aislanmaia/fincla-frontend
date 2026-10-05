import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Building2, CreditCard, Gift, RefreshCw, ShieldAlert, TicketPercent, UserPlus, Users } from "lucide-react";
import { getAdminOverview } from "../api/admin";
import { handleApiError } from "../api/client";

const number = (value) => new Intl.NumberFormat("pt-BR").format(value);
const date = (value) => value ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "—";
const name = (user) => [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;

function StatCard({ icon: Icon, label, value, detail, tone = "default", onClick }) {
  return <button type="button" className={`admin-stat-card admin-stat-${tone}`} onClick={onClick}>
    <span className="admin-stat-icon"><Icon size={18} strokeWidth={1.8} /></span>
    <span className="admin-stat-label">{label}</span>
    <strong>{number(value)}</strong>
    <span className="admin-stat-footer">{detail}<ArrowUpRight size={15} /></span>
  </button>;
}

export function AdminDashboard({ onNavigate }) {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOverview(await getAdminOverview());
    } catch (nextError) {
      setError(handleApiError(nextError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const attention = overview ? [
    { label: "Assinaturas em atraso", count: overview.past_due, description: "Confira as contas que precisam de acompanhamento.", tone: "amber", filter: "past_due" },
    { label: "Mudanças de plano pendentes", count: overview.pending_plan_changes, description: "Solicitações aguardando execução manual.", tone: "amber", filter: "pending_plan_changes" },
    { label: "Reajustes de cupom pendentes", count: overview.coupon_reprice_due, description: "Preço normal ainda não atualizado no provedor.", tone: "amber", filter: "coupon_reprice_due" },
    { label: "Convites sem senha definida", count: overview.password_pending, description: "Pessoas que ainda não ativaram o acesso.", tone: "neutral", filter: "password_pending" },
  ] : [];
  const attentionTotal = attention.reduce((total, item) => total + item.count, 0);

  return <div className="admin-dashboard">
    <div className="admin-dashboard-header">
      <div>
        <span className="admin-kicker">PAINEL DE OPERAÇÃO</span>
        <h1>Visão <em>geral</em></h1>
        <p>Contas, acesso e assinaturas do Fincla em um só lugar.</p>
      </div>
      <div className="admin-dashboard-actions">
        <button type="button" className="admin-quiet-button" onClick={refresh} disabled={loading}><RefreshCw size={16} /> Atualizar</button>
        <button type="button" className="admin-primary-button" onClick={() => onNavigate("users", "create")}><UserPlus size={17} /> Criar conta</button>
      </div>
    </div>

    {error && <div className="admin-error" role="alert">{error}</div>}
    {loading && !overview ? <div className="admin-dashboard-loading" role="status">Carregando indicadores…</div> : overview && <>
      <div className="admin-stat-grid">
        <StatCard icon={Users} label="Contas" value={overview.accounts} detail="Ver diretório" onClick={() => onNavigate("users")} />
        <StatCard icon={Building2} label="Organizações" value={overview.organizations} detail="Ver organizações" onClick={() => onNavigate("organizations")} />
        <StatCard icon={CreditCard} label="Assinaturas pagas ativas" value={overview.paid_active} detail="Ver contas" onClick={() => onNavigate("users")} />
        <StatCard icon={ShieldAlert} label="Em atraso" value={overview.past_due} detail="Ver contas" tone={overview.past_due ? "attention" : "default"} onClick={() => onNavigate("users", "past_due")} />
      </div>

      <div className="admin-dashboard-grid">
        <section className="admin-dashboard-panel admin-attention-panel">
          <div className="admin-panel-heading"><div><span className="admin-kicker">ACOMPANHAMENTO</span><h2>Atenção agora</h2></div><span className={`admin-panel-count ${attentionTotal ? "has-items" : ""}`}>{number(attentionTotal)} pendências</span></div>
          <div className="admin-attention-list">
            {attention.map((item) => <button type="button" key={item.label} className="admin-attention-row" onClick={() => onNavigate("users", item.filter)}>
              <span className={`admin-attention-dot admin-attention-${item.tone}`} />
              <span className="admin-attention-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
              <span className="admin-attention-number">{number(item.count)}</span>
              <ArrowRight size={16} />
            </button>)}
          </div>
        </section>

        <section className="admin-dashboard-panel admin-access-panel">
          <div className="admin-panel-heading"><div><span className="admin-kicker">ACESSO</span><h2>Concessões e estado</h2></div></div>
          <div className="admin-access-summary">
            <div><span className="admin-summary-icon"><Gift size={17} /></span><span>Contas beta</span><strong>{number(overview.beta_active)}</strong></div>
            <div><span className="admin-summary-icon"><Gift size={17} /></span><span>Cortesias ativas</span><strong>{number(overview.courtesy_active)}</strong></div>
            <div><span className="admin-summary-icon"><ShieldAlert size={17} /></span><span>Contas bloqueadas</span><strong>{number(overview.blocked_accounts)}</strong></div>
            <div><span className="admin-summary-icon"><TicketPercent size={17} /></span><span>Cupons ativos</span><strong>{number(overview.coupons_active)}</strong></div>
          </div>
          <button type="button" className="admin-panel-link" onClick={() => onNavigate("coupons")}>Gerenciar cupons <ArrowUpRight size={16} /></button>
        </section>
      </div>

      <section className="admin-dashboard-panel admin-recent-panel">
        <div className="admin-panel-heading"><div><span className="admin-kicker">MOVIMENTAÇÃO</span><h2>Contas recentes</h2></div><button type="button" className="admin-panel-link" onClick={() => onNavigate("users")}>Ver todas <ArrowRight size={16} /></button></div>
        {overview.recent_accounts.length ? <div className="admin-recent-list">
          <div className="admin-recent-head"><span>CONTA</span><span>PLANO</span><span>ACESSO</span><span>CRIADA EM</span></div>
          {overview.recent_accounts.map((user) => <div className="admin-recent-row" key={user.id}>
            <div><strong>{name(user)}</strong><small>{user.email}</small></div>
            <span>{user.subscription?.plan || "Sem plano"}</span>
            <span><span className={`admin-access-badge ${user.blocked_at ? "is-blocked" : ""}`}>{user.blocked_at ? "Bloqueada" : user.password_pending ? "Convite pendente" : "Liberada"}</span></span>
            <span>{date(user.created_at)}</span>
          </div>)}
        </div> : <p className="admin-dashboard-empty">Nenhuma conta cadastrada ainda.</p>}
      </section>
    </>}
  </div>;
}
