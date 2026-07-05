import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { fmtBRL0 } from "./consultantFormat";

/**
 * Documento PDF do consolidado da carteira (relatório apresentável ao cliente).
 * Módulo **pesado** (`@react-pdf/renderer`) — importado dinamicamente só no
 * momento do export, para não entrar no bundle inicial. Recebe o `data` já
 * agregado pela `ConsultantInsightsPage` (KPIs + séries + consolidado do período)
 * — nenhum endpoint novo.
 */

const C = {
  ink: "#0F0F0D",
  mid: "#4B5563",
  light: "#9CA3AF",
  border: "#E5E7EB",
  bg: "#F9FAFB",
  green: "#059669",
  red: "#DC2626",
  purple: "#7C3AED",
};

const st = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, fontSize: 10, color: C.ink, fontFamily: "Helvetica" },
  brand: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.purple, letterSpacing: 1, textTransform: "uppercase" },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", marginTop: 4 },
  sub: { fontSize: 10, color: C.mid, marginTop: 3 },
  headerRule: { borderBottomWidth: 1, borderBottomColor: C.border, marginTop: 12, marginBottom: 16 },
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  kpi: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 10 },
  kpiLabel: { fontSize: 7.5, color: C.light, textTransform: "uppercase", letterSpacing: 0.5 },
  kpiValue: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 5 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 8 },
  row: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.border },
  th: { fontSize: 8, color: C.light, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Helvetica-Bold" },
  cell: { fontSize: 9.5 },
  empty: { fontSize: 9.5, color: C.light, paddingVertical: 6 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: C.light, textAlign: "center", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 },
});

function Kpi({ label, value, color }) {
  return (
    <View style={st.kpi}>
      <Text style={st.kpiLabel}>{label}</Text>
      <Text style={[st.kpiValue, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

function Row({ cells, widths, header }) {
  return (
    <View style={st.row}>
      {cells.map((c, i) => (
        <Text key={i} style={[header ? st.th : st.cell, { width: widths[i], textAlign: i === 0 ? "left" : "right" }, c.color ? { color: c.color } : {}]}>
          {c.text}
        </Text>
      ))}
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View wrap={false}>
      <Text style={st.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const cell = (text, color) => ({ text, color });

export function ConsultantReportDoc({ data }) {
  const {
    consultantName = "",
    generatedAt = "",
    summary = {},
    patrimonio = 0,
    health = null,
    risk = 0,
    totalClients = 0,
    cardDebt = null,
    cashFlow = [],
    expenses = [],
    goals = [],
    commitment = [],
  } = data || {};

  const lastCommitment = commitment.length ? commitment[commitment.length - 1] : null;

  return (
    <Document title="Fincla — Consolidado da carteira" author="Fincla">
      <Page size="A4" style={st.page}>
        <View>
          <Text style={st.brand}>Fincla · Consultor</Text>
          <Text style={st.title}>Consolidado da carteira</Text>
          <Text style={st.sub}>
            {consultantName ? `${consultantName} · ` : ""}Gerado em {generatedAt}
          </Text>
        </View>
        <View style={st.headerRule} />

        <View style={st.kpiRow}>
          <Kpi label="Patrimônio" value={fmtBRL0(patrimonio)} />
          <Kpi label="Saúde média" value={health != null ? `${Math.round(health)}/100` : "—"} color={C.green} />
          <Kpi label="Clientes em risco" value={`${risk} de ${totalClients}`} color={C.red} />
          <Kpi label="Dívida de cartão" value={cardDebt != null ? fmtBRL0(cardDebt) : "—"} color={C.red} />
        </View>

        <Section title="Consolidado do período">
          <Row header widths={["70%", "30%"]} cells={[cell("Métrica"), cell("Valor")]} />
          <Row widths={["70%", "30%"]} cells={[cell("Receita total"), cell(fmtBRL0(summary.total_income || 0), C.green)]} />
          <Row widths={["70%", "30%"]} cells={[cell("Despesa total"), cell(fmtBRL0(summary.total_expenses || 0), C.red)]} />
          <Row widths={["70%", "30%"]} cells={[cell("Saldo"), cell(fmtBRL0(summary.balance || 0))]} />
          <Row widths={["70%", "30%"]} cells={[cell("Transações"), cell(String(summary.total_transactions ?? 0))]} />
          <Row widths={["70%", "30%"]} cells={[cell("Organizações (clientes)"), cell(String(summary.organizations_count ?? 0))]} />
        </Section>

        <Section title="Fluxo mês a mês">
          <Row header widths={["28%", "24%", "24%", "24%"]} cells={[cell("Mês"), cell("Receita"), cell("Despesa"), cell("Saldo")]} />
          {cashFlow.length ? (
            cashFlow.map((m, i) => (
              <Row key={i} widths={["28%", "24%", "24%", "24%"]} cells={[
                cell(m.month),
                cell(fmtBRL0(m.income), C.green),
                cell(fmtBRL0(m.expenses), C.red),
                cell(fmtBRL0(m.balance)),
              ]} />
            ))
          ) : (
            <Text style={st.empty}>Sem fluxo agregado no período.</Text>
          )}
        </Section>

        <Section title="Onde a base gasta">
          {expenses.length ? (
            expenses.map((e, i) => (
              <Row key={i} widths={["70%", "30%"]} cells={[cell(e.label), cell(fmtBRL0(e.value))]} />
            ))
          ) : (
            <Text style={st.empty}>Sem gastos agregados no período.</Text>
          )}
        </Section>

        <Section title="Progresso de metas por tipo">
          {goals.length ? (
            goals.map((g, i) => (
              <Row key={i} widths={["70%", "30%"]} cells={[cell(g.label), cell(`${g.value}%`)]} />
            ))
          ) : (
            <Text style={st.empty}>Nenhuma meta ativa na base.</Text>
          )}
        </Section>

        {lastCommitment && (
          <Section title="Comprometimento de renda">
            <Row widths={["70%", "30%"]} cells={[cell(`Último mês (${lastCommitment.month})`), cell(`${lastCommitment.pct}% da renda`, C.purple)]} />
          </Section>
        )}

        <Text style={st.footer} fixed>Fincla · Relatório consolidado da carteira · {generatedAt}</Text>
      </Page>
    </Document>
  );
}
