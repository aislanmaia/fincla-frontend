import React from "react";

import { Badge, Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { healthTone } from "./consultantFormat";
import { formatOverviewKpi, selectClientOverview } from "./consultantClientOverview";

function StateCard({ title, text }) {
  return (
    <Card style={{ padding: "32px 24px", textAlign: "center" }}>
      <div style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink, marginBottom: 6 }}>{title}</div>
      <div style={{ ...G, fontSize: 12.5, color: T.inkLight, lineHeight: 1.6, maxWidth: 420, margin: "0 auto" }}>{text}</div>
    </Card>
  );
}

function Kpi({ label, value, bad }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...G, fontSize: 10.5, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ ...G, ...NUM, fontSize: 15, fontWeight: 700, color: bad ? T.red : T.ink, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {value}
      </div>
    </div>
  );
}

/**
 * Aba "Visão geral" do relatório do cliente (A3.2a). Presentational — recebe o
 * estado do hook `useFinancialHealthData({ organizationId: orgDoCliente })`:
 * diagnóstico (score + faixa de risco), grade de KPIs e resumo de metas.
 * Estados: carregando / erro / sem dados / conteúdo.
 */
export function ConsultantClientOverviewTab({ data, loading, error, hasLoaded }) {
  if (loading && !data) return <StateCard title="Carregando…" text="Buscando a saúde financeira do cliente." />;
  if (error && !data) {
    return <StateCard title="Não foi possível carregar" text="Houve um erro ao buscar a saúde financeira. Tente novamente em instantes." />;
  }
  const vm = selectClientOverview(data);
  if (!vm) {
    return <StateCard title="Sem dados suficientes" text={hasLoaded ? "Ainda não há movimentações suficientes para calcular a saúde financeira deste cliente." : "…"} />;
  }

  const scoreTone = healthTone(vm.score);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ ...G, ...NUM, width: 60, height: 60, borderRadius: 16, background: scoreTone.bg, color: scoreTone.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, flexShrink: 0 }}>
          {vm.score}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...G, fontSize: 11, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.04em" }}>Saúde financeira</div>
          <div style={{ ...G, fontSize: 16, fontWeight: 800, color: T.ink, marginTop: 2 }}>{scoreTone.label}</div>
          <div style={{ marginTop: 6 }}>
            <Badge color={scoreTone.color} bg={scoreTone.bg}>{vm.risk.label}</Badge>
          </div>
        </div>
      </Card>

      <Card style={{ padding: 20 }}>
        <div style={{ ...G, fontSize: 12, fontWeight: 800, color: T.ink, marginBottom: 14 }}>Indicadores do cliente</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "16px 18px" }}>
          {vm.kpis.map((kpi) => (
            <Kpi key={kpi.key} label={kpi.label} value={formatOverviewKpi(kpi)} bad={kpi.bad} />
          ))}
        </div>
      </Card>

      <Card style={{ padding: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ ...G, fontSize: 12, fontWeight: 800, color: T.ink }}>Metas no prazo</div>
          <div style={{ ...G, fontSize: 12, color: T.inkLight, marginTop: 3 }}>Progresso médio das metas do cliente</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ ...G, ...NUM, fontSize: 18, fontWeight: 800, color: T.ink }}>{vm.goals.onTrack} de {vm.goals.total}</div>
          <div style={{ ...G, ...NUM, fontSize: 12, color: T.inkLight, marginTop: 2 }}>progresso médio {vm.goals.progress}%</div>
        </div>
      </Card>
    </div>
  );
}
