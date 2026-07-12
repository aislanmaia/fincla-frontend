import React from "react";
import { useNavigate } from "@tanstack/react-router";

import { Btn, PageTitle } from "../../components/primitives";
import { T } from "../../tokens";
import { G } from "../../typography";
import { useAddClient } from "../../features/consultant/ConsultantAddClientContext.jsx";
import { useFinclaPages } from "../../routing/finclaPageContext.jsx";
import { getDisplayName } from "../../features/auth/userDisplay.js";
import { ConsultantKpiCards } from "../../features/consultant/ConsultantKpiCards";
import { ConsultantSemaphorePanel } from "../../features/consultant/ConsultantSemaphorePanel";
import { ConsultantAttentionList } from "../../features/consultant/ConsultantAttentionList";
import { ConsultantEvaluationDrawer } from "../../features/consultant/ConsultantEvaluationDrawer.jsx";
import { useEvaluationDrawer } from "../../features/consultant/useEvaluationDrawer.js";
import { useCanEvaluateClientWithAi } from "../../features/consultant/consultantAiAccess.js";
import { ConsultantAiInsightCard } from "../../features/consultant/ConsultantAiInsightCard";
import { ConsultantActivityFeed } from "../../features/consultant/ConsultantActivityFeed";
import { Icon, useIsNarrow } from "../../features/consultant/consultantUi";
import { useConsultantHealthIndex } from "../../features/consultant/useConsultantHealthIndex";
import { useConsultantClientsAtRisk } from "../../features/consultant/useConsultantClientsAtRisk";
import { useConsultantClients } from "../../features/consultant/useConsultantClients";
import { totalPatrimonio } from "../../features/consultant/consultantClientsView";

/** Kicker (sobre-título) do header — pequeno, uppercase, fiel à referência. */
function Kicker({ children }) {
  return (
    <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
      {children}
    </div>
  );
}

/** Saudação pela hora local. */
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/** Botão de ação em estado "em breve" (stub de Trilha B / fatia futura). */
function StubActionButton({ icon, label }) {
  return (
    <button
      type="button"
      disabled
      title="Em breve"
      style={{ ...G, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: `1.5px solid ${T.border}`, background: T.surface, color: T.inkLight, fontSize: 12, fontWeight: 600, cursor: "default", opacity: 0.6, whiteSpace: "nowrap" }}
    >
      <Icon name={icon} size={14} color={T.inkLight} /> {label}
      <span style={{ ...G, fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: T.inkLight, background: T.grayLight, borderRadius: 5, padding: "1px 5px" }}>em breve</span>
    </button>
  );
}

/**
 * Painel da base do Consultor (RF.5) — reimplementado fiel à referência de design
 * (`consultor/cons-painel.jsx`, layout `kpis-top`): header (kicker + título +
 * ações), KPIs consolidados, e grid `1fr 340px` com "Precisam de atenção" +
 * "Semáforo da carteira" (3-vias) à esquerda e os cards de IA/Atividade
 * (**Trilha B → stub "em breve"**) à direita.
 *
 * Dados reais por hook: `/consultant/financial-health-index` (KPIs clientes/saúde
 * + centro do semáforo), `/consultant/clients-at-risk` (lista de atenção),
 * `/consultant/clients` (distribuição 3-vias do semáforo, via saúde por-cliente).
 * Patrimônio/MRR seguem "em breve" (sem fonte). "Adicionar cliente" (S5) e
 * "Relatório com IA" (Trilha B) são stubs.
 */
export function ConsultantPainelPage() {
  const evaluation = useEvaluationDrawer();
  const canEvaluate = useCanEvaluateClientWithAi();
  const navigate = useNavigate();
  const narrow = useIsNarrow(900);
  const { openAddClient } = useAddClient();
  const pages = useFinclaPages();
  const firstName = (getDisplayName(pages?.user) || "").split(" ")[0];

  const { healthIndex, hasLoaded, error } = useConsultantHealthIndex();
  const risk = useConsultantClientsAtRisk({ limit: 5 });
  const wallet = useConsultantClients();
  // `clients-at-risk` não devolve `health`; a carteira sim. Cruzamos por org para
  // que o anel de "Precisam de atenção" mostre o MESMO score canônico do card,
  // em vez de derivar um número do `risk_score` (escala invertida).
  const healthByOrg = React.useMemo(
    () => Object.fromEntries((wallet.clients ?? []).map((c) => [c.organization_id, c.health])),
    [wallet.clients],
  );

  // Banner de erro só em falha total (nada carregado); senão os KPIs degradam a "—".
  const loadError = error && !healthIndex ? error : "";
  const base = healthIndex?.organizations_count ?? null;

  // KPIs alimentados por dados reais das outras cargas do Painel: patrimônio
  // agregado (soma da carteira) e clientes em atenção (endpoint de risco).
  // `loadedOk` distingue "carregado (inclusive 0)" de "ainda buscando / erro".
  const patrimonio = wallet.loadedOk ? totalPatrimonio(wallet.clients) : null;
  const patrimonioLoaded = wallet.loadedOk || Boolean(wallet.error);
  const attention = risk.loadedOk ? risk.total : null;
  const attentionLoaded = risk.loadedOk || Boolean(risk.error);

  const openClient = React.useCallback((orgId) => {
    navigate({ to: "/consultant/clients/$id", params: { id: orgId } });
  }, [navigate]);
  const goToWallet = React.useCallback(() => navigate({ to: "/consultant/clients" }), [navigate]);
  const goToInsights = React.useCallback(() => navigate({ to: "/consultant/insights" }), [navigate]);

  const date = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  const header = (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
      <div>
        <Kicker>{firstName ? `${greeting()}, ${firstName}` : greeting()} · {date}</Kicker>
        <PageTitle sans="Painel" serif="da base" />
      </div>
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
        <Btn variant="outGray" onClick={goToInsights}><Icon name="bar" size={14} color={T.inkMid} /> Insights</Btn>
        <Btn variant="outGray" onClick={openAddClient}><Icon name="plus" size={14} color={T.inkMid} /> Adicionar cliente</Btn>
        <StubActionButton icon="sparkles" label="Relatório com IA" />
      </div>
    </div>
  );

  const leftColumn = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <ConsultantAttentionList
        clients={risk.clients}
        healthByOrg={healthByOrg}
        total={risk.total}
        base={base ?? 0}
        loadedOk={risk.loadedOk}
        error={risk.error}
        onOpenClient={openClient}
        onViewAll={goToWallet}
        onEvaluate={canEvaluate ? evaluation.openFor : undefined}
        evaluateLocked={!canEvaluate}
      />
      <ConsultantSemaphorePanel
        clients={wallet.clients}
        hasLoaded={wallet.hasLoaded}
        healthIndex={healthIndex?.index}
        loading={wallet.isLoading && !wallet.hasLoaded}
      />
    </div>
  );

  const rightColumn = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <ConsultantAiInsightCard />
      <ConsultantActivityFeed />
    </div>
  );

  return (
    <div style={{ ...G, width: "100%", boxSizing: "border-box", padding: "clamp(18px, 3.5vw, 32px) clamp(16px, 3.5vw, 40px) 48px", display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
      {header}
      {loadError && <p style={{ ...G, fontSize: 12.5, color: T.red }}>{loadError}</p>}

      <ConsultantKpiCards
        healthIndex={healthIndex}
        hasLoaded={hasLoaded}
        patrimonio={patrimonio}
        patrimonioLoaded={patrimonioLoaded}
        attention={attention}
        attentionLoaded={attentionLoaded}
      />

      <div style={{ display: "grid", gridTemplateColumns: narrow ? "minmax(0,1fr)" : "minmax(0,1fr) 340px", gap: 16, alignItems: "start" }}>
        {leftColumn}
        {rightColumn}
      </div>

      {evaluation.target && (
        <ConsultantEvaluationDrawer
          open
          organizationId={evaluation.target.organizationId}
          clientName={evaluation.target.clientName}
          onClose={evaluation.close}
        />
      )}
    </div>
  );
}
