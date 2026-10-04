import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { fmtMoneyIn, portfolioExpenseInsightCopy } from "./consultantFormat";

const styles = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 42, paddingHorizontal: 38, color: "#20242c", fontFamily: "Helvetica", fontSize: 9 },
  brand: { color: "#7c3aed", fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 8 },
  subtitle: { color: "#687181", marginTop: 4, marginBottom: 12 },
  section: { marginTop: 16, paddingTop: 9, borderTopWidth: 1, borderTopColor: "#e2e5ec" },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 7 },
  row: { flexDirection: "row", gap: 8 },
  card: { flex: 1, padding: 10, borderWidth: 1, borderColor: "#e2e5ec", borderRadius: 6 },
  label: { color: "#687181", fontSize: 8 },
  value: { fontFamily: "Helvetica-Bold", fontSize: 14, marginTop: 4 },
  note: { color: "#687181", fontSize: 8, lineHeight: 1.4, marginTop: 5 },
  tableHead: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#e2e5ec", color: "#687181", fontFamily: "Helvetica-Bold" },
  tableRow: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f0f1f4" },
  category: { width: "35%" },
  pct: { width: "18%", textAlign: "right" },
  amount: { width: "30%", textAlign: "right" },
  clients: { width: "17%", textAlign: "right" },
  footer: { position: "absolute", left: 38, right: 38, bottom: 22, borderTopWidth: 1, borderTopColor: "#e2e5ec", paddingTop: 5, color: "#687181", fontSize: 7 },
});

const pct = (value) => `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Number(value) || 0)}%`;

function Section({ title, children }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function Metric({ label, value, note }) {
  return <View style={styles.card}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text><Text style={styles.note}>{note}</Text></View>;
}

export function PortfolioExpenseReportPdf({ report, analysis, excluded = [] }) {
  const included = report.clients_converted + report.clients_without_expenses;
  const partial = report.clients_not_converted > 0;
  const top = report.highlights?.top_categories || [];
  const rates = report.conversion_rates || [];
  return <Document title="Fincla — Distribuição de gastos da carteira" author="Fincla">
    <Page size="A4" style={styles.page}>
      <Text style={styles.brand}>FINCLA · CONSULTOR</Text>
      <Text style={styles.title}>Distribuição de gastos da carteira</Text>
      <Text style={styles.subtitle}>Resumo analítico por categoria · {report.period_start} a {report.period_end} · Moeda de leitura: {report.reading_currency}</Text>

      {partial && <Section title="Conversão e cobertura"><Text>{included} de {report.client_count} clientes analisados; {report.clients_not_converted} sem conversão. Valores não convertidos não compõem o total.</Text></Section>}

      <Section title="Indicadores do período">
        <View style={styles.row}>
          <Metric label="Gastos agregados no período" value={report.total_expenses ? fmtMoneyIn(report.total_expenses.amount, report.total_expenses.currency) : "Não disponível"} note={analysis ? analysis.comparison.delta_percentage == null ? "Sem base anterior para variação percentual" : `${Math.abs(Number(report.total_expenses?.amount || 0) - Number(analysis.comparison.current_total.amount)) >= 0.01 ? "Apenas coorte comparável: " : ""}${fmtMoneyIn(analysis.comparison.delta.amount, report.reading_currency)} (${pct(analysis.comparison.delta_percentage)}) vs ${fmtMoneyIn(analysis.comparison.previous_total.amount, report.reading_currency)} no período anterior` : "Total comparável dos clientes incluídos"} />
          {partial && <Metric label="Cobertura da carteira" value={pct(report.client_count ? included / report.client_count * 100 : 0)} note={`${included} de ${report.client_count} clientes analisados`} />}
          {partial && <Metric label="Sem conversão" value={String(report.clients_not_converted)} note="Clientes com valores separados por moeda" />}
        </View>
      </Section>

      {analysis && <Section title="Comparação de períodos"><Text style={styles.note}>Período anterior: {analysis.comparison.period_start} a {analysis.comparison.period_end}. {analysis.comparison.comparable_client_count} clientes comparáveis; {analysis.comparison.excluded_from_comparison} excluídos da comparação. A mesma cotação de leitura foi aplicada aos dois períodos. {Math.abs(Number(report.total_expenses?.amount || 0) - Number(analysis.comparison.current_total.amount)) >= 0.01 ? `A coorte comparável soma ${fmtMoneyIn(analysis.comparison.current_total.amount, report.reading_currency)} no período atual e não corresponde ao total integral exibido.` : ""}</Text></Section>}

      <Section title="Onde a carteira mais gasta">
        <Text style={styles.note}>{report.clients_converted} clientes no agregado. Percentuais sobre o total incluído.</Text>
        <View style={styles.tableHead}><Text style={styles.category}>Categoria</Text><Text style={styles.pct}>Participação</Text><Text style={styles.amount}>Total convertido</Text><Text style={styles.clients}>Clientes</Text></View>
        {(report.categories || []).map((category) => <View key={category.name} style={styles.tableRow} wrap={false}>
          <Text style={styles.category}>{category.name}</Text><Text style={styles.pct}>{pct(category.percentage)}</Text><View style={styles.amount}><Text>{fmtMoneyIn(category.total.amount, category.total.currency)}</Text>{analysis && <Text style={styles.note}>{analysis.categories.find((item) => item.name === category.name)?.delta_percentage == null ? "Sem base anterior" : `${fmtMoneyIn(analysis.categories.find((item) => item.name === category.name)?.delta.amount || 0, report.reading_currency)} vs anterior`}</Text>}</View><Text style={styles.clients}>{category.client_count} de {report.clients_converted}</Text>
        </View>)}
        {!report.categories?.length && <Text style={styles.note}>Nenhum gasto comparável neste período.</Text>}
      </Section>

      {analysis && <Section title="Ritmo mensal da carteira">{analysis.monthly_trend.map((point) => <View key={point.period_end} style={styles.tableRow}><Text style={{ width: "45%" }}>{point.period_start} a {point.period_end}</Text><Text style={{ width: "55%", textAlign: "right" }}>{fmtMoneyIn(point.total.amount, report.reading_currency)}</Text></View>)}</Section>}

      <Section title="Leitura do Copiloto">
        {analysis ? analysis.insights.map((insight, index) => <Text key={`${insight.kind}-${index}`} style={styles.note}>{index + 1}. {insight.title} {portfolioExpenseInsightCopy(insight, analysis.comparison, report.reading_currency)}</Text>) : top.length ? <Text>{top.map((category) => `${category.name}: ${pct(category.percentage)} dos gastos; ${category.client_count} clientes`).join(" · ")}. A distribuição descreve onde estão os gastos, não sua causa.</Text> : <Text>Não há dados suficientes para destaques neste período.</Text>}
      </Section>

      {rates.length > 0 && <Section title="Conversões aplicadas">
        {(report.converted_cohorts || []).map((cohort) => <Text key={cohort.base_currency} style={styles.note}>{cohort.client_count} clientes · {cohort.base_currency} → {cohort.reading_currency}: {fmtMoneyIn(cohort.original_total.amount, cohort.base_currency)} → {fmtMoneyIn(cohort.converted_total.amount, cohort.reading_currency)}</Text>)}
        {rates.map((rate, index) => <Text key={`${rate.base}-${rate.quote}-${index}`} style={styles.note}>1 {rate.base} = {Number(rate.rate).toLocaleString("pt-BR", { maximumFractionDigits: 6 })} {rate.quote} · Cotação de {rate.quoted_on}</Text>)}
      </Section>}

      {excluded.length > 0 && <Section title="Valores fora do agregado">{excluded.map((group) => <Text key={group.currency} style={styles.note}>{group.currency}: {fmtMoneyIn(group.amount, group.currency)} · {group.client_count} {group.client_count === 1 ? "cliente" : "clientes"}. Não somados ao total convertido.</Text>)}</Section>}

      <Section title="Como ler este resumo"><Text>O percentual é calculado sobre os clientes incluídos. Cada linha mostra quantos clientes registraram gastos naquela categoria.</Text></Section>
      <Text style={styles.footer}>Análise de apoio ao consultor; não constitui recomendação de investimento.</Text>
    </Page>
  </Document>;
}
