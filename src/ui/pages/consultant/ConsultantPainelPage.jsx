import React from "react";
import { PageTitle } from "../../components/primitives";
import { T } from "../../tokens";
import { G } from "../../typography";
import { ConsultantKpiCards } from "../../features/consultant/ConsultantKpiCards";
import { ConsultantSemaphorePanel } from "../../features/consultant/ConsultantSemaphorePanel";
import { ConsultantAttentionList } from "../../features/consultant/ConsultantAttentionList";
import { useConsultantHealthIndex } from "../../features/consultant/useConsultantHealthIndex";
import { useConsultantClientsAtRisk } from "../../features/consultant/useConsultantClientsAtRisk";

/**
 * Painel da base do Consultor (S1). A0.x entregou o shell; A1.2 traz os KPIs
 * consolidados da carteira (clientes ativos e saúde média com dado real;
 * patrimônio e honorários/MRR marcados "em breve" até haver fonte no backend).
 *
 * Uma só chamada agregada (`/consultant/financial-health-index`) cobre os dois
 * KPIs reais — ela já devolve `organizations_count` além do `index`. O
 * `useConsultantSummary` (A1.1) fica disponível para quando um campo exclusivo
 * do summary (receita/saldo/nº de transações do período) for exibido.
 *
 * A1.3 acrescenta o semáforo da carteira e a lista "Precisam de atenção"
 * (`/clients-at-risk`). O clique em "Abrir" ainda é stub — a rota de relatório
 * do cliente (S3) não existe.
 */
export function ConsultantPainelPage() {
  const { healthIndex, hasLoaded, error } = useConsultantHealthIndex();
  const risk = useConsultantClientsAtRisk({ limit: 5 });

  // Banner de erro só em falha total (nada carregado); caso contrário os KPIs
  // degradam individualmente para "—".
  const loadError = error && !healthIndex ? error : "";

  // Base (nº de clientes) só é conhecida quando o health-index carregou.
  const base = healthIndex?.organizations_count ?? null;
  // At-risk só é confiável quando /clients-at-risk teve sucesso ao menos uma
  // vez (total=0 default é ambíguo). null = ainda não confiável.
  const atRiskTotal = risk.loadedOk ? risk.total : null;
  // Semáforo carregando enquanto qualquer um dos dois recursos não assentou.
  const semaphoreLoading =
    (base == null && !error) || (!risk.loadedOk && !risk.error);

  return (
    <div style={{ ...G, width: "100%", padding: "clamp(18px, 3.5vw, 32px) clamp(16px, 3.5vw, 40px) 48px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <PageTitle sans="Painel" serif="da base" />
        <p style={{ ...G, fontSize: 13, color: T.inkLight, marginTop: 8 }}>
          Visão consolidada de toda a sua carteira de clientes.
        </p>
      </div>

      {loadError && (
        <p style={{ ...G, fontSize: 12.5, color: T.red }}>{loadError}</p>
      )}

      <ConsultantKpiCards healthIndex={healthIndex} hasLoaded={hasLoaded} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, alignItems: "start" }}>
        <ConsultantAttentionList
          clients={risk.clients}
          total={risk.total}
          base={base ?? 0}
          loadedOk={risk.loadedOk}
          error={risk.error}
        />
        <ConsultantSemaphorePanel
          atRiskTotal={atRiskTotal}
          organizationsCount={base}
          healthIndex={healthIndex?.index}
          hasLoaded={hasLoaded}
          loading={semaphoreLoading}
        />
      </div>
    </div>
  );
}
