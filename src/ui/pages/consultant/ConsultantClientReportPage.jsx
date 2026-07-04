import React from "react";
import { useNavigate, useParams } from "@tanstack/react-router";

import { Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G } from "../../typography";
import { useConsultantClients } from "../../features/consultant/useConsultantClients";
import { useFinancialHealthData } from "../../features/health/useFinancialHealthData";
import { useClientCategories } from "../../features/consultant/useClientCategories";
import { useClientTransactions } from "../../features/consultant/useClientTransactions";
import { useClientCreditCards } from "../../features/consultant/useClientCreditCards";
import { useGoalsData } from "../../features/goals/useGoalsData";
import { ConsultantClientReportHeader } from "../../features/consultant/ConsultantClientReportHeader";
import { ConsultantClientReportTabs } from "../../features/consultant/ConsultantClientReportTabs";
import { ConsultantClientOverviewTab } from "../../features/consultant/ConsultantClientOverviewTab";
import { ConsultantClientTransactionsTab } from "../../features/consultant/ConsultantClientTransactionsTab";
import { ConsultantClientCardsTab } from "../../features/consultant/ConsultantClientCardsTab";
import { ConsultantClientCategoriesTab } from "../../features/consultant/ConsultantClientCategoriesTab";
import { Icon } from "../../features/consultant/consultantUi";
import { resolveClientReportState } from "../../features/consultant/consultantClientReport";
import { DEFAULT_CLIENT_REPORT_TAB } from "../../features/consultant/consultantReportTabs";

function EmptyState({ title, text, action }) {
  return (
    <Card style={{ padding: "40px 24px", textAlign: "center" }}>
      <div style={{ ...G, fontSize: 15, fontWeight: 800, color: T.ink, marginBottom: 6 }}>{title}</div>
      <div style={{ ...G, fontSize: 12.5, color: T.inkLight, lineHeight: 1.6, maxWidth: 380, margin: "0 auto" }}>{text}</div>
      {action}
    </Card>
  );
}

/**
 * Relatório do cliente (RF.1b, S3) — rota `/consultant/clients/$id` ($id = org do
 * cliente). O "Abrir" da carteira leva aqui. Entrega o cabeçalho (avatar/anel/
 * saúde/ações), as abas e a aba "Visão geral" fiel à referência de design, que
 * consome os reads por-org com `organization_id` = org do cliente:
 * `/financial-health/score` (KPIs+diagnóstico+metas), `/analytics/by-category`
 * (donut + aba Categorias) e `/goals` (metas). Todas as abas ativas: Visão geral
 * (RF.1b), Transações (RF.2), Cartões (RF.3), Categorias (RF.4).
 *
 * Estados: cliente na carteira → relatório; ainda carregando → "carregando";
 * erro sem lista → "erro"; carregou e o id não é cliente do consultor →
 * "não encontrado" (protege deep-links inválidos e ids fora da carteira).
 */
export function ConsultantClientReportPage() {
  const { id } = useParams({ strict: false });
  const navigate = useNavigate();
  const { clients, hasLoaded, isLoading, error } = useConsultantClients();

  const { status, client } = resolveClientReportState({ clients, id, hasLoaded, isLoading, error });

  const [tab, setTab] = React.useState(DEFAULT_CLIENT_REPORT_TAB);
  // Os reads por-org só disparam quando o cliente é de fato da carteira (status
  // ready): evita buscas para um id inválido/fora da carteira.
  const ready = status === "ready";
  const health = useFinancialHealthData({ organizationId: id, enabled: ready });
  const categories = useClientCategories({ organizationId: id, enabled: ready });
  const goals = useGoalsData({ organizationId: id, enabled: ready });
  // Transações só carregam ao abrir a aba (evita um fetch pesado no Overview).
  const transactions = useClientTransactions({ organizationId: id, enabled: ready && tab === "transactions" });
  // Cartões só carregam ao abrir a aba (a resolução de fatura corrente é pesada).
  const cards = useClientCreditCards({ organizationId: id, enabled: ready && tab === "cards" });

  const goToWallet = React.useCallback(() => {
    navigate({ to: "/consultant/clients" });
  }, [navigate]);

  const backLink = (
    <button
      type="button"
      onClick={goToWallet}
      style={{ ...G, marginTop: 16, background: "none", border: "none", color: T.blue, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
    >
      ← Voltar para a carteira
    </button>
  );

  return (
    <div style={{ ...G, width: "100%", boxSizing: "border-box", padding: "clamp(18px, 3.5vw, 32px) clamp(16px, 3.5vw, 40px) 48px", display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      {status === "ready" && (
        <>
          <button
            type="button"
            onClick={goToWallet}
            style={{ ...G, display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: T.inkLight, fontSize: 12.5, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start", padding: 0 }}
          >
            <Icon name="chevron-left" size={15} color="currentColor" /> Clientes
          </button>
          <ConsultantClientReportHeader client={client} />
          <ConsultantClientReportTabs active={tab} onSelect={setTab} />
          {tab === "overview" && (
            <ConsultantClientOverviewTab client={client} health={health} categories={categories} goals={goals} />
          )}
          {tab === "transactions" && <ConsultantClientTransactionsTab transactions={transactions} />}
          {tab === "cards" && <ConsultantClientCardsTab cards={cards} clientName={client?.client_name} />}
          {tab === "categories" && <ConsultantClientCategoriesTab categories={categories} />}
        </>
      )}

      {status === "loading" && <EmptyState title="Carregando…" text="Buscando os dados do cliente." />}
      {status === "error" && (
        <EmptyState
          title="Não foi possível carregar"
          text="Houve um erro ao buscar a sua carteira de clientes. Tente atualizar em instantes."
          action={backLink}
        />
      )}
      {status === "not_found" && (
        <EmptyState
          title="Cliente não encontrado"
          text="Este cliente não está na sua carteira, ou o endereço está incorreto."
          action={backLink}
        />
      )}
    </div>
  );
}
