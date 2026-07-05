import React from "react";
import { useNavigate } from "@tanstack/react-router";

import { Card, PageTitle, ProgBar } from "../../components/primitives";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Avatar, Icon } from "../../features/consultant/consultantUi";
import { fmtMoney } from "../../features/consultant/consultantFormat";
import { countClientsByBand, totalPatrimonio } from "../../features/consultant/consultantClientsView";
import {
  buildConsolidatedCsv,
  selectCashFlowSeries,
  selectExpenseRows,
  selectGoalsProgressRows,
  selectIncomeCommitmentSeries,
  selectMovers,
} from "../../features/consultant/consultantInsights";
import { CashFlowChart, IncomeCommitmentChart } from "../../features/consultant/ConsultantInsightsCharts.jsx";
import { ConsultantExportModal } from "../../features/consultant/ConsultantExportModal.jsx";
import { useConsultantHealthIndex } from "../../features/consultant/useConsultantHealthIndex";
import { useConsultantClients } from "../../features/consultant/useConsultantClients";
import { useConsultantExpensesByCategory } from "../../features/consultant/useConsultantExpensesByCategory";
import { useConsultantCashFlow } from "../../features/consultant/useConsultantCashFlow";
import { useConsultantIncomeCommitment } from "../../features/consultant/useConsultantIncomeCommitment";
import { useConsultantGoalsProgress } from "../../features/consultant/useConsultantGoalsProgress";
import { useConsultantTotalCardDebt } from "../../features/consultant/useConsultantTotalCardDebt";
import { getConsultantConsolidatedReport } from "../../../api/consultant";
import { getDisplayName } from "../../features/auth/userDisplay.js";
import { useFinclaPages } from "../../routing/finclaPageContext.jsx";

function Kicker({ children }) {
  return <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{children}</div>;
}

function StubActionButton({ icon, label, dark }) {
  return (
    <button type="button" disabled title="Em breve"
      style={{ ...G, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: `1.5px solid ${dark ? T.ink : T.border}`, background: dark ? T.ink : T.surface, color: dark ? "#fff" : T.inkLight, fontSize: 12, fontWeight: 600, cursor: "default", opacity: 0.6, whiteSpace: "nowrap" }}>
      <Icon name={icon} size={14} color={dark ? "#fff" : T.inkLight} /> {label}
      <span style={{ ...G, fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: dark ? "#fff" : T.inkLight, background: dark ? "rgba(255,255,255,0.2)" : T.grayLight, borderRadius: 5, padding: "1px 5px" }}>em breve</span>
    </button>
  );
}

/** Dispara o download de um Blob no navegador (CSV/PDF). */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Botão de ação real (habilitado) — mesmo visual do stub, sem o selo "em breve". */
function ActionButton({ icon, label, dark, onClick, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ ...G, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: `1.5px solid ${dark ? T.ink : T.border}`, background: dark ? T.ink : T.surface, color: dark ? "#fff" : T.inkMid, fontSize: 12, fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1, whiteSpace: "nowrap" }}>
      <Icon name={icon} size={14} color={dark ? "#fff" : T.inkMid} /> {label}
    </button>
  );
}

function KpiCard({ label, value, sub, color = T.ink, soon }) {
  return (
    <Card style={{ padding: "15px 17px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: T.ink }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7 }}>{label}</div>
          <div style={{ ...G, ...NUM, fontSize: 22, fontWeight: 800, color: soon ? T.inkGhost : color, letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
          <div style={{ ...G, fontSize: 10.5, color: T.inkLight, marginTop: 7 }}>{sub}</div>
        </div>
        {soon && <span style={{ ...G, fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: T.inkLight, background: T.grayLight, borderRadius: 5, padding: "2px 6px" }}>em breve</span>}
      </div>
    </Card>
  );
}

function HBars({ rows, max, fmt }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, gap: 8 }}>
            <span style={{ ...G, fontSize: 12.5, color: T.inkMid, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
            <span style={{ ...G, ...NUM, fontSize: 12.5, fontWeight: 700, color: T.ink, whiteSpace: "nowrap" }}>{fmt(r.value)}</span>
          </div>
          <ProgBar pct={max > 0 ? (r.value / max) * 100 : 0} color={r.color} h={8} />
        </div>
      ))}
    </div>
  );
}

function SoonPanel({ title, subtitle, text }) {
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink }}>{title}</div>
        <span style={{ ...G, fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: T.inkLight, background: T.grayLight, borderRadius: 5, padding: "2px 6px" }}>em breve</span>
      </div>
      {subtitle && <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 14 }}>{subtitle}</div>}
      <div style={{ ...G, fontSize: 12, color: T.inkLight, lineHeight: 1.6 }}>{text}</div>
    </Card>
  );
}

function MoverRow({ client, dir, onOpen }) {
  const up = dir === "up";
  const color = up ? T.green : T.red;
  return (
    <div onClick={() => onOpen(client.organization_id)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      <Avatar name={client.client_name} seed={client.organization_id} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...G, fontSize: 12.5, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client.client_name}</div>
        <div style={{ ...G, fontSize: 10.5, color: T.inkLight }}>saúde {Math.round(Number(client.health) || 0)}</div>
      </div>
      <span style={{ ...G, fontSize: 11.5, fontWeight: 700, color, display: "inline-flex", alignItems: "center", gap: 3 }}>
        <Icon name={up ? "up" : "down"} size={12} color={color} />{up ? "Em alta" : "Em queda"}
      </span>
    </div>
  );
}

function MoversCard({ title, icon, iconColor, clients, dir, onOpen, emptyText }) {
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
        <Icon name={icon} size={15} color={iconColor} />
        <span style={{ ...G, fontSize: 13.5, fontWeight: 800, color: T.ink }}>{title}</span>
      </div>
      {clients.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {clients.map((c) => <MoverRow key={c.organization_id} client={c} dir={dir} onOpen={onOpen} />)}
        </div>
      ) : (
        <div style={{ ...G, fontSize: 12, color: T.inkLight }}>{emptyText}</div>
      )}
    </Card>
  );
}

/**
 * Insights da carteira (S4). Consome os agregados reais do consultor:
 * - gasto por categoria (`/consultant/expenses-by-category` → "Onde a base gasta");
 * - saúde média (`/financial-health-index`); patrimônio/tendência/bandas (`/consultant/clients`);
 * - fluxo mensal receita×despesa×saldo (`/consultant/cash-flow` → "Fluxo da base");
 * - comprometimento de renda mês a mês (`/consultant/income-commitment`);
 * - dívida de cartão da base (`/consultant/total-credit-card-debt` → KPI);
 * - progresso de metas por tipo (`/consultant/goals-progress-by-type`).
 * "Exportar" abre um modal de formato — **PDF** (default, relatório apresentável,
 * via `@react-pdf/renderer` carregado sob demanda) ou **CSV** — do consolidado
 * (`/consultant/reports/consolidated`); o PDF cruza os agregados já em tela.
 *
 * Único stub restante = **"Tendências detectadas pela IA"** (Trilha B) e o botão
 * "Relatório com IA". A "taxa de retenção" saiu (é métrica comercial do consultor,
 * outro produto — como honorários).
 */
export function ConsultantInsightsPage() {
  const navigate = useNavigate();
  const pages = useFinclaPages();
  const { healthIndex } = useConsultantHealthIndex();
  const wallet = useConsultantClients();
  const expenses = useConsultantExpensesByCategory();
  const cashFlow = useConsultantCashFlow();
  const commitment = useConsultantIncomeCommitment();
  const goals = useConsultantGoalsProgress();
  const cardDebt = useConsultantTotalCardDebt();

  const clients = wallet.clients;
  const counts = countClientsByBand(clients);
  const patrimonio = totalPatrimonio(clients);
  const { rows: expenseRows, max: expenseMax } = selectExpenseRows(expenses.categories);
  const { gainers, decliners } = selectMovers(clients);
  const cashFlowSeries = selectCashFlowSeries(cashFlow.monthly);
  const commitmentSeries = selectIncomeCommitmentSeries(commitment.monthly);
  const goalsRows = selectGoalsProgressRows(goals.byType).map((r) => ({
    ...r,
    label: r.count ? `${r.label} · ${r.count}` : r.label,
  }));

  const bandRows = [
    { label: "Saudável", value: counts.healthy, color: T.green },
    { label: "Atenção", value: counts.attention, color: T.amber },
    { label: "Em risco", value: counts.risk, color: T.red },
  ];

  const openClient = React.useCallback((orgId) => navigate({ to: "/consultant/clients/$id", params: { id: orgId } }), [navigate]);

  // Exportar: modal de formato (PDF default / CSV). Ambos baixam o consolidado
  // (`/reports/consolidated`); o PDF ainda cruza os agregados já em tela.
  const [exportOpen, setExportOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  // Dados do relatório mantidos num ref (atualizado a cada render) para o handler
  // ler o valor corrente sem recriar o callback a cada mudança de agregado.
  const reportRef = React.useRef({});
  reportRef.current = {
    consultantName: getDisplayName(pages?.user) || "",
    patrimonio,
    health: healthIndex?.index ?? null,
    risk: counts.risk,
    totalClients: counts.all,
    cardDebt: cardDebt.totalDebt,
    cashFlow: cashFlowSeries,
    expenses: expenseRows,
    goals: goalsRows,
    commitment: commitmentSeries,
  };

  const onExport = React.useCallback(async (format) => {
    setExporting(true);
    try {
      const summary = await getConsultantConsolidatedReport();
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === "pdf") {
        const [{ pdf }, { ConsultantReportDoc }] = await Promise.all([
          import("@react-pdf/renderer"),
          import("../../features/consultant/ConsultantReportPdf.jsx"),
        ]);
        const generatedAt = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
        const blob = await pdf(<ConsultantReportDoc data={{ ...reportRef.current, summary, generatedAt }} />).toBlob();
        downloadBlob(blob, `fincla-consultor-consolidado-${stamp}.pdf`);
      } else {
        const csv = buildConsolidatedCsv(summary);
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
        downloadBlob(blob, `fincla-consultor-consolidado-${stamp}.csv`);
      }
      setExportOpen(false);
    } catch {
      /* silencioso por ora; futuro: toast de erro */
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <div style={{ ...G, width: "100%", boxSizing: "border-box", padding: "clamp(18px, 3.5vw, 32px) clamp(16px, 3.5vw, 40px) 48px", display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <Kicker>Visão consolidada da carteira</Kicker>
          <PageTitle sans="Insights" serif="da carteira" />
        </div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <ActionButton icon="download" label="Exportar" onClick={() => setExportOpen(true)} />
          <StubActionButton icon="sparkles" label="Relatório com IA" dark />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <KpiCard label="Patrimônio total" value={fmtMoney(patrimonio)} sub="sob acompanhamento" />
        <KpiCard label="Saúde média" value={healthIndex?.index != null ? `${Math.round(healthIndex.index)}/100` : "—"} sub="da base" color={T.green} />
        <KpiCard label="Clientes em risco" value={counts.risk} sub={`de ${counts.all} na carteira`} color={T.red} />
        <KpiCard label="Dívida de cartão" value={cardDebt.totalDebt != null ? fmtMoney(cardDebt.totalDebt) : "—"} sub="faturas em aberto" color={T.red} />
      </div>

      <CashFlowChart data={cashFlowSeries} loading={cashFlow.loading && !cashFlow.hasLoaded} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, alignItems: "start" }}>
        <Card style={{ padding: 18 }}>
          <div style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink, marginBottom: 4 }}>Onde a base gasta</div>
          <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 16 }}>Categorias somadas de todos os clientes</div>
          {expenseRows.length ? (
            <HBars rows={expenseRows} max={expenseMax} fmt={fmtMoney} />
          ) : (
            <div style={{ ...G, fontSize: 12, color: T.inkLight, padding: "12px 0" }}>
              {expenses.loading && !expenses.hasLoaded ? "Carregando gastos…" : "Sem gastos agregados no período."}
            </div>
          )}
        </Card>
        <IncomeCommitmentChart data={commitmentSeries} loading={commitment.loading && !commitment.hasLoaded} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, alignItems: "start" }}>
        <Card style={{ padding: 18 }}>
          <div style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink, marginBottom: 4 }}>Progresso de metas por tipo</div>
          <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 16 }}>Progresso médio das metas da base, por tipo</div>
          {goalsRows.length ? (
            <HBars rows={goalsRows} max={100} fmt={(v) => `${v}%`} />
          ) : (
            <div style={{ ...G, fontSize: 12, color: T.inkLight, padding: "12px 0" }}>
              {goals.loading && !goals.hasLoaded ? "Carregando metas…" : "Nenhuma meta ativa na base."}
            </div>
          )}
        </Card>
        <Card style={{ padding: 18 }}>
          <div style={{ ...G, fontSize: 13.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>Composição da base</div>
          <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 16 }}>Por nível de saúde</div>
          <HBars rows={bandRows} max={counts.all} fmt={(v) => String(v)} />
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, alignItems: "start" }}>
        <MoversCard title="Maiores evoluções" icon="up" iconColor={T.green} clients={gainers} dir="up" onOpen={openClient} emptyText="Nenhum cliente em alta no momento." />
        <MoversCard title="Precisam de atenção" icon="down" iconColor={T.red} clients={decliners} dir="down" onOpen={openClient} emptyText="Nenhum cliente em queda no momento." />
      </div>

      <SoonPanel
        title="Tendências detectadas pela IA"
        text="Em breve: a IA vai cruzar os números de toda a carteira e apontar padrões — concentração de risco, janelas para investimento, categorias que corroem a base — com ações sugeridas."
      />

      <ConsultantExportModal open={exportOpen} exporting={exporting} onExport={onExport} onClose={() => setExportOpen(false)} />
    </div>
  );
}
