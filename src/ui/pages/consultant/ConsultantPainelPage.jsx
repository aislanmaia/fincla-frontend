import React from "react";
import { PageTitle } from "../../components/primitives";
import { T } from "../../tokens";
import { G } from "../../typography";
import { ConsultantKpiCards } from "../../features/consultant/ConsultantKpiCards";
import { useConsultantHealthIndex } from "../../features/consultant/useConsultantHealthIndex";

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
 * Semáforo e "precisam de atenção" chegam em A1.3.
 */
export function ConsultantPainelPage() {
  const { healthIndex, hasLoaded, error } = useConsultantHealthIndex();

  // Banner de erro só em falha total (nada carregado); caso contrário os KPIs
  // degradam individualmente para "—".
  const loadError = error && !healthIndex ? error : "";

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
    </div>
  );
}
