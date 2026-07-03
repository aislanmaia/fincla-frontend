import React from "react";
import { useNavigate, useParams } from "@tanstack/react-router";

import { Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G } from "../../typography";
import { useConsultantClients } from "../../features/consultant/useConsultantClients";
import { useFinancialHealthData } from "../../features/health/useFinancialHealthData";
import { ConsultantClientReportHeader } from "../../features/consultant/ConsultantClientReportHeader";
import { ConsultantClientReportTabs } from "../../features/consultant/ConsultantClientReportTabs";
import { ConsultantClientOverviewTab } from "../../features/consultant/ConsultantClientOverviewTab";
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
 * Relatório do cliente (A3.1/A3.2, S3) — rota `/consultant/clients/$id` ($id = org
 * do cliente). O "Abrir" da carteira leva aqui. Entrega o cabeçalho (nome/saúde/
 * patrimônio, via a carteira) + as abas; a aba "Visão geral" (A3.2a) consome o read
 * por-org `/financial-health/score` com `organization_id` = org do cliente.
 * Transações/Cartões/Categorias chegam em A3.3–A3.5.
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
  // Só busca a saúde do cliente quando o cliente é de fato da carteira (status ready):
  // evita um read por-org para um id inválido/fora da carteira.
  const health = useFinancialHealthData({ organizationId: id, enabled: status === "ready" });

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
    <div style={{ ...G, width: "100%", padding: "clamp(18px, 3.5vw, 32px) clamp(16px, 3.5vw, 40px) 48px", display: "flex", flexDirection: "column", gap: 18 }}>
      {status === "ready" && (
        <>
          <ConsultantClientReportHeader client={client} onBack={goToWallet} />
          <ConsultantClientReportTabs active={tab} onSelect={setTab} />
          {tab === "overview" && (
            <ConsultantClientOverviewTab
              data={health.data}
              loading={health.loading}
              error={health.error}
              hasLoaded={health.hasLoaded}
            />
          )}
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
