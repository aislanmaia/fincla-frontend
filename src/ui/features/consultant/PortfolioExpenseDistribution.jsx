import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getConsultantPortfolioExpenseAnalysis, getConsultantPortfolioCategoryContributors } from "../../../api/consultant.ts";
import { DashboardPeriodSelector } from "../../features/dashboard/DashboardPeriodSelector.jsx";
import { normalizeCustomRange, rangeForDashboardPreset } from "../../features/dashboard/dashboardDateRange.js";
import { useIsNarrow } from "./consultantUi";
import { fmtMoneyIn, portfolioExpenseInsightCopy } from "./consultantFormat";

const formatPercent = (value) => `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(value) || 0)}%`;
const categoryColors = ["#8266dc", "#4d8cdb", "#2ca583", "#d4a01d", "#cd6581", "#9b75cf", "#708191"];
const currencyDisplayNames = new Intl.DisplayNames(["pt-BR"], { type: "currency" });
const currencyLabel = (currency) => `${currency} · ${currencyDisplayNames.of(currency) || currency}`;

const datePt = (value) => {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR");
};

function previousPeriod(start, end) {
  const startUtc = Date.parse(`${start}T00:00:00Z`);
  const endUtc = Date.parse(`${end}T00:00:00Z`);
  const length = endUtc - startUtc + 86_400_000;
  if (!Number.isFinite(length) || length <= 0) return null;
  return {
    start: new Date(startUtc - length).toISOString().slice(0, 10),
    end: new Date(startUtc - 86_400_000).toISOString().slice(0, 10),
  };
}

function excludedCurrencyGroups(slices) {
  const groups = new Map();
  for (const slice of slices || []) {
    if (slice.included_in_converted_total) continue;
    const { amount, currency } = slice.amount || {};
    if (!currency || !Number.isFinite(Number(amount))) continue;
    const group = groups.get(currency) || { currency, amount: 0, clients: new Set(), categories: new Map() };
    const value = Number(amount);
    group.amount += value;
    group.clients.add(slice.organization_id);
    group.categories.set(slice.category_name, (group.categories.get(slice.category_name) || 0) + value);
    groups.set(currency, group);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, categories: [...group.categories.entries()].sort((a, b) => b[1] - a[1]) }))
    .sort((a, b) => b.clients.size - a.clients.size || a.currency.localeCompare(b.currency));
}

function CoverageSummary({ block }) {
  const analyzedClients = block.clients_converted + block.clients_without_expenses;
  const converted = (block.converted_cohorts || []).filter((cohort) => cohort.base_currency !== cohort.reading_currency);
  const convertedCopy = converted.map((cohort) => `${cohort.client_count} ${cohort.client_count === 1 ? "cliente" : "clientes"} em ${cohort.base_currency} ${cohort.client_count === 1 ? "foi convertido" : "foram convertidos"}`).join("; ");
  const excludedCurrencies = [...new Set((block.original_currency_slices || []).filter((slice) => !slice.included_in_converted_total).map((slice) => slice.amount?.currency).filter(Boolean))];
  return (
    <div className="portfolio-expense__coverage portfolio-expense__coverage--partial">
      <span className="portfolio-expense__coverage-icon" aria-hidden="true">!</span>
      <div className="portfolio-expense__coverage-copy">
        <strong>Conversão aplicada com cobertura parcial</strong>
        <span>
          {analyzedClients} de {block.client_count} clientes foram incluídos no agregado em {block.reading_currency}. {convertedCopy ? `${convertedCopy}; ` : ""}{block.clients_not_converted} {block.clients_not_converted === 1 ? "cliente ficou" : "clientes ficaram"} {excludedCurrencies.length ? `em ${excludedCurrencies.join(", ")} ` : ""}{block.clients_not_converted === 1 ? "separado" : "separados"} por falta de cotação.
          {block.clients_without_expenses > 0 && ` · ${block.clients_without_expenses} sem gastos no período`}
        </span>
      </div>
    </div>
  );
}

function PortfolioExpenseHighlights({ highlights, includedClients, onFollowUp, analysis, readingCurrency }) {
  if (analysis) {
    const hasGrowth = analysis.comparison.delta_percentage != null && analysis.comparison.delta_percentage > 0;
    const leader = analysis.categories[0]?.name || "gastos";
    const second = analysis.categories[1]?.name;
    const followUps = [
      hasGrowth
        ? ["Por que esses gastos subiram?", `Compare os gastos de ${leader}${second ? ` e ${second}` : ""} entre o período atual e o anterior. Quais evidências mostram a variação? Não atribua causa sem dados suficientes.`]
        : ["O que explica esta distribuição?", `Descreva o alcance e a concentração de ${leader} no período. Não presuma alta nem atribua causa sem dados suficientes.`],
      [hasGrowth ? "Alta espalhada ou concentrada?" : "Gastos espalhados ou concentrados?", `A concentração de ${leader} vem de muitos clientes ou de poucos?`],
      ["Comparar mesma coorte", "Compare as principais categorias com o período anterior usando a mesma coorte"],
    ];
    return <section className="portfolio-expense__panel portfolio-expense__highlights" aria-labelledby="portfolio-expense-highlights">
    <h3 id="portfolio-expense-highlights" className="portfolio-expense__ai-kicker"><span aria-hidden="true">✣</span><strong>Leitura do Copiloto</strong></h3>
    <h4>O que merece atenção</h4>
    {analysis.insights.length ? analysis.insights.map((insight, index) => <div className="portfolio-expense__insight" key={`${insight.kind}-${index}`}><strong>{index + 1}. {insight.title}</strong><p>{portfolioExpenseInsightCopy(insight, analysis.comparison, readingCurrency)}</p></div>) : <p className="portfolio-expense__empty">Ainda não há dados suficientes para uma leitura comparativa.</p>}
    <p className="portfolio-expense__highlight-boundary">Essas são observações dos dados. A IA não atribui causa sem analisar transações e o contexto de cada cliente.</p>
    {onFollowUp && <div className="portfolio-expense__followups"><strong>EXPLORE A ANÁLISE</strong>{followUps.map(([label, prompt]) => <button type="button" key={label} onClick={() => onFollowUp(prompt)}>{label} <span aria-hidden="true">↗</span></button>)}<small>Clique para enviar ao chat, mantendo escopo, período e coorte comparável.</small></div>}
  </section>;
  }
  const topCategories = highlights?.top_categories || [];
  if (!topCategories.length) {
    return (
      <section className="portfolio-expense__panel" aria-labelledby="portfolio-expense-highlights">
        <div className="portfolio-expense__panel-heading">
          <div><h3 id="portfolio-expense-highlights">Leitura do Copiloto</h3><p>Síntese dos gastos agregados</p></div>
        </div>
        <p className="portfolio-expense__empty">Ainda não há gastos suficientes para gerar destaques neste período.</p>
      </section>
    );
  }

  const first = topCategories[0];
  const second = topCategories[1];
  const lead = second
    ? <><strong>{first.name}</strong> e <strong>{second.name}</strong> concentram <strong>{formatPercent(highlights.combined_percentage)}</strong> dos gastos do período.</>
    : <><strong>{first.name}</strong> representa <strong>{formatPercent(first.percentage)}</strong> dos gastos do período.</>;

  return (
    <section className="portfolio-expense__panel portfolio-expense__highlights" aria-labelledby="portfolio-expense-highlights">
      <h3 id="portfolio-expense-highlights" className="portfolio-expense__ai-kicker"><span aria-hidden="true">✣</span><strong>Leitura do Copiloto</strong></h3>
      <p className="portfolio-expense__highlight-lead">{lead}</p>
      <p className="portfolio-expense__highlight-summary">{first.name} aparece em {first.client_count} de {includedClients} clientes{second ? `; ${second.name} aparece em ${second.client_count}.` : "."} Esta distribuição não explica, por si só, a causa dos gastos.</p>
      <p className="portfolio-expense__highlight-boundary">Leitura baseada na participação e no número de clientes por categoria. Isso descreve a distribuição observada — não a causa dos gastos nem a uniformidade entre clientes.</p>
      {onFollowUp && <div className="portfolio-expense__followups">
        <strong>EXPLORE A ANÁLISE</strong>
        {[
          ["Comparar com período anterior", "Compare as principais categorias com o período anterior"],
          ["Muitos clientes ou poucos?", "A concentração dessas categorias vem de muitos clientes ou de poucos?"],
          ["Contribuição por cliente", `Quais clientes mais contribuíram para ${first.name}?`],
        ].map(([label, prompt]) => <button type="button" key={label} onClick={() => onFollowUp(prompt)}>{label} <span aria-hidden="true">↗</span></button>)}
        <small>Clique para enviar a pergunta no chat.</small>
      </div>}
    </section>
  );
}

function PortfolioExpenseLoadingSkeleton() {
  return (
    <div className="portfolio-expense__loading" role="status" aria-label="Atualizando relatório agregado" aria-live="polite" aria-busy="true">
      <span className="portfolio-expense__loading-label">Atualizando análise para o período selecionado…</span>
      <div className="portfolio-expense__summary portfolio-expense__summary--skeleton" aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <div className="portfolio-expense__metric" key={item}>
            <span className="portfolio-expense__skeleton-line portfolio-expense__skeleton-line--label" />
            <span className="portfolio-expense__skeleton-line portfolio-expense__skeleton-line--value" />
            <span className="portfolio-expense__skeleton-line portfolio-expense__skeleton-line--copy" />
          </div>
        ))}
      </div>
      <div className="portfolio-expense__content portfolio-expense__content--skeleton" aria-hidden="true">
        <section className="portfolio-expense__panel">
          <div className="portfolio-expense__skeleton-heading">
            <span className="portfolio-expense__skeleton-line portfolio-expense__skeleton-line--heading" />
            <span className="portfolio-expense__skeleton-line portfolio-expense__skeleton-line--copy" />
          </div>
          {[0, 1, 2, 3, 4].map((item) => (
            <div className="portfolio-expense__skeleton-row" key={item}>
              <span className="portfolio-expense__skeleton-line portfolio-expense__skeleton-line--category" />
              <span className="portfolio-expense__skeleton-line portfolio-expense__skeleton-line--bar" />
              <span className="portfolio-expense__skeleton-line portfolio-expense__skeleton-line--amount" />
            </div>
          ))}
        </section>
        <aside className="portfolio-expense__side">
          <section className="portfolio-expense__panel">
            <div className="portfolio-expense__skeleton-heading">
              <span className="portfolio-expense__skeleton-line portfolio-expense__skeleton-line--heading" />
              <span className="portfolio-expense__skeleton-line portfolio-expense__skeleton-line--copy" />
            </div>
            <span className="portfolio-expense__skeleton-line portfolio-expense__skeleton-line--insight" />
            <span className="portfolio-expense__skeleton-line portfolio-expense__skeleton-line--insight" />
          </section>
          <section className="portfolio-expense__panel portfolio-expense__skeleton-secondary">
            <span className="portfolio-expense__skeleton-line portfolio-expense__skeleton-line--heading" />
            <span className="portfolio-expense__skeleton-line portfolio-expense__skeleton-line--copy" />
          </section>
        </aside>
      </div>
    </div>
  );
}

export function PortfolioExpenseDistribution({ block, clients = [], onFollowUp }) {
  const [showConversionDetails, setShowConversionDetails] = useState(false);
  const [activeCurrency, setActiveCurrency] = useState("");
  useEffect(() => {
    if (!showConversionDetails && !activeCurrency) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setShowConversionDetails(false);
      setActiveCurrency("");
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [activeCurrency, showConversionDetails]);
  const narrow = useIsNarrow(760);
  const initialRange = useMemo(() => ({ start: block.period_start, end: block.period_end }), [block.period_end, block.period_start]);
  const [report, setReport] = useState(block);
  const [analysis, setAnalysis] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [contributors, setContributors] = useState(null);
  const [contributorsError, setContributorsError] = useState("");
  const [contributorsRequest, setContributorsRequest] = useState(0);
  const [contributorsPageLoading, setContributorsPageLoading] = useState(false);
  const [periodPreset, setPeriodPreset] = useState("personalizado");
  const [customStart, setCustomStart] = useState(initialRange.start);
  const [customEnd, setCustomEnd] = useState(initialRange.end);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const requestId = useRef(0);
  const initialPeriodKey = `${initialRange.start}|${initialRange.end}`;
  const lastRequestedPeriod = useRef(initialPeriodKey);
  const period = useMemo(() => periodPreset === "personalizado"
    ? normalizeCustomRange(customStart, customEnd)
    : rangeForDashboardPreset(periodPreset), [customEnd, customStart, periodPreset]);
  const changeCustomDates = useCallback(({ start, end }) => {
    setCustomStart(start);
    setCustomEnd(end);
  }, []);

  useEffect(() => {
    requestId.current += 1;
    setReport(block);
    setAnalysis(null);
    setPeriodPreset("personalizado");
    setCustomStart(block.period_start);
    setCustomEnd(block.period_end);
    lastRequestedPeriod.current = `${block.period_start}|${block.period_end}`;
    setLoading(false);
    setError("");
  // Copiloto rebuilds block objects while rendering chat messages. Reset only
  // when the report identity changes, not on each new object reference.
  }, [initialPeriodKey, block.total_expenses?.amount, block.categories.length]);

  const loadPeriod = useCallback(async (range) => {
    const thisRequest = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const result = await getConsultantPortfolioExpenseAnalysis({ date_start: range.start, date_end: range.end });
      if (thisRequest !== requestId.current) return;
      setReport({ type: "portfolio_expense_distribution", version: 1, ...result.report });
      setAnalysis(result);
      lastRequestedPeriod.current = `${range.start}|${range.end}`;
    } catch {
      if (thisRequest === requestId.current) setError("Não foi possível atualizar este relatório. Tente novamente.");
    } finally {
      if (thisRequest === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const key = period && `${period.start}|${period.end}`;
    if (!period || !key || key === lastRequestedPeriod.current) return;
    lastRequestedPeriod.current = key;
    void loadPeriod(period);
  }, [loadPeriod, period]);

  useEffect(() => {
    if (analysis || loading || error) return;
    void loadPeriod({ start: block.period_start, end: block.period_end });
  }, [analysis, block.period_end, block.period_start, error, loadPeriod, loading]);

  useEffect(() => {
    if (!selectedCategory) return undefined;
    let active = true;
    setContributors(null);
    setContributorsError("");
    getConsultantPortfolioCategoryContributors({ category_name: selectedCategory, date_start: report.period_start, date_end: report.period_end, limit: 10, offset: 0 })
      .then((value) => { if (active) setContributors(value); })
      .catch(() => { if (active) setContributorsError("Não foi possível carregar as contribuições. Tente novamente."); });
    return () => { active = false; };
  }, [selectedCategory, report.period_start, report.period_end, contributorsRequest]);

  useEffect(() => {
    if (!selectedCategory) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setSelectedCategory(""); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedCategory]);

  const loadMoreContributors = async () => {
    if (!contributors || !contributors.truncated || contributorsPageLoading) return;
    setContributorsPageLoading(true);
    setContributorsError("");
    try {
      const next = await getConsultantPortfolioCategoryContributors({ category_name: selectedCategory, date_start: report.period_start, date_end: report.period_end, limit: 10, offset: contributors.clients.length });
      setContributors({ ...next, clients: [...contributors.clients, ...next.clients] });
    } catch {
      setContributorsError("Não foi possível carregar mais clientes. Tente novamente.");
    } finally {
      setContributorsPageLoading(false);
    }
  };

  const retry = () => {
    if (period) void loadPeriod(period);
  };
  const excluded = useMemo(() => excludedCurrencyGroups(report.original_currency_slices), [report.original_currency_slices]);
  const maximum = Math.max(0, ...report.categories.map((category) => Number(category.total.amount) || 0));
  const total = report.total_expenses;
  const comparisonCoversDisplayedTotal = !analysis || Math.abs(Number(total?.amount || 0) - Number(analysis.comparison.current_total.amount)) < 0.01;
  const clientNameById = useMemo(() => new Map(clients.map((client) => [client.organization_id, client.client_name])), [clients]);
  const hasPartialCoverage = report.clients_not_converted > 0 && report.client_count > 0;
  const analyzedClients = report.clients_converted + report.clients_without_expenses;
  const showCoverageMetric = hasPartialCoverage;
  const showUnconvertedMetric = report.clients_not_converted > 0;
  const coveragePercentage = report.client_count ? (analyzedClients / report.client_count) * 100 : 0;
  const metricCount = 1 + Number(showCoverageMetric) + Number(showUnconvertedMetric);
  const displayedPeriod = loading && period
    ? period
    : { start: report.period_start, end: report.period_end };
  const followUp = onFollowUp && ((prompt) => {
    const current = `${report.period_start} a ${report.period_end}`;
    if (prompt.startsWith("Compare ")) {
      const previous = analysis?.comparison
        ? { start: analysis.comparison.period_start, end: analysis.comparison.period_end }
        : previousPeriod(report.period_start, report.period_end);
      onFollowUp(`${prompt.replace(/[.!?]\s*$/, "")}. Período atual: ${current}. Período anterior comparável: ${previous.start} a ${previous.end}. Consulte os dois intervalos separadamente; não use outros períodos da conversa nem compare janelas sobrepostas.`);
      return;
    }
    onFollowUp(`${prompt} no período de ${current}.`);
  });
  const exportPdf = async () => {
    if (exporting || loading || error) return;
    setExportError("");
    setExporting(true);
    try {
      const [{ pdf }, { PortfolioExpenseReportPdf }] = await Promise.all([
        import("@react-pdf/renderer"), import("./PortfolioExpenseReportPdf.jsx"),
      ]);
      const blob = await pdf(<PortfolioExpenseReportPdf report={report} analysis={analysis} excluded={excluded.map((group) => ({ ...group, client_count: group.clients.size }))} />).toBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `fincla-gastos-carteira-${report.period_start}-${report.period_end}.pdf`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setExportError("Não foi possível exportar o PDF.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="portfolio-expense" aria-label="Distribuição agregada de gastos da carteira">
      <header className="portfolio-expense__header">
        <div>
          <h2>Distribuição de gastos da carteira</h2>
          <p>Evolução, alcance e concentração — detalhe individual somente ao explorar</p>
        </div>
        <div className="portfolio-expense__header-actions">
          <span className="portfolio-expense__status" data-state={error ? "error" : loading ? "loading" : "complete"}><i aria-hidden="true" />{error ? "Atualização pendente" : loading ? "Atualizando análise" : "Análise concluída"}</span>
          <button type="button" onClick={exportPdf} disabled={exporting || loading || Boolean(error)}>{exporting ? "Exportando…" : "↓ Exportar"}</button>
        </div>
      </header>
      {exportError && <div className="portfolio-expense__export-error" role="alert">{exportError} <button type="button" onClick={exportPdf}>Tentar novamente</button></div>}
      <div className="portfolio-expense__context">
        <strong>PERÍODO</strong>
        <div className="portfolio-expense__period-control">
          <DashboardPeriodSelector
            isMobile={narrow}
            presetId={periodPreset}
            onPresetChange={setPeriodPreset}
            customStart={customStart}
            customEnd={customEnd}
            onCustomDatesChange={changeCustomDates}
          />
        </div>
        <span>{datePt(displayedPeriod.start)} – {datePt(displayedPeriod.end)}</span>
        {analysis && <><i aria-hidden="true" /><strong>COMPARAÇÃO</strong><span className="portfolio-expense__context-chip">{datePt(analysis.comparison.period_start)} – {datePt(analysis.comparison.period_end)}</span></>}
        <i aria-hidden="true" />
        <strong>MOEDA DE LEITURA</strong><span className="portfolio-expense__context-chip">{currencyLabel(report.reading_currency)}</span>
      </div>

      {loading ? (
        <PortfolioExpenseLoadingSkeleton />
      ) : error ? (
        <div className="portfolio-expense__refresh-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={retry}>Tentar novamente</button>
        </div>
      ) : (
        <>

      {hasPartialCoverage && <div className="portfolio-expense__coverage-wrap"><CoverageSummary block={report} /><button type="button" onClick={() => setShowConversionDetails(true)}>Ver conversões e cobertura</button></div>}

      {analysis && <div className="portfolio-expense__compare-note"><strong>Comparação válida:</strong> os mesmos {analysis.comparison.comparable_client_count} clientes entram nos dois períodos{analysis.comparison.excluded_from_comparison > 0 ? `; ${analysis.comparison.excluded_from_comparison} sem cotação ${analysis.comparison.excluded_from_comparison === 1 ? "ficou fora" : "ficaram fora"} de ambos` : ""}. A mesma cotação de leitura foi aplicada aos dois intervalos. {!comparisonCoversDisplayedTotal && <>A variação usa apenas a coorte comparável ({fmtMoneyIn(analysis.comparison.current_total.amount, report.reading_currency)} no período atual), não o total da carteira exibido abaixo. </>}{report.conversion_rates.length > 0 && <button type="button" onClick={() => setShowConversionDetails(true)}>Como foi calculado →</button>}</div>}

      <div className="portfolio-expense__content">
        <div className="portfolio-expense__primary">
      <div className="portfolio-expense__summary" data-metric-count={metricCount}>
        <article className="portfolio-expense__metric portfolio-expense__metric--primary">
          <span>Gastos no período <span title="Inclui apenas os clientes com valores comparáveis" aria-label="Inclui apenas os clientes com valores comparáveis">ⓘ</span></span>
          <strong>{total ? fmtMoneyIn(total.amount, total.currency) : "Não disponível"}</strong>
          <small>{analysis
            ? analysis.comparison.delta_percentage == null
              ? "Sem gastos no período anterior para calcular variação percentual."
              : `${comparisonCoversDisplayedTotal ? "" : "Coorte comparável: "}${Number(analysis.comparison.delta.amount) >= 0 ? "+" : ""}${fmtMoneyIn(analysis.comparison.delta.amount, report.reading_currency)} (${Number(analysis.comparison.delta_percentage) >= 0 ? "+" : ""}${formatPercent(analysis.comparison.delta_percentage)}) vs ${fmtMoneyIn(analysis.comparison.previous_total.amount, report.reading_currency)} no período anterior.`
            : total
            ? showUnconvertedMetric
              ? "Inclui apenas clientes com valores comparáveis; os demais estão separados abaixo."
              : "Soma dos gastos registrados pelos clientes da carteira."
            : "Não há total comparável disponível; os valores sem conversão aparecem separados abaixo."}</small>
        </article>
        {showCoverageMetric && (
          <article className="portfolio-expense__metric">
            <span>Cobertura da carteira</span>
            <strong>{formatPercent(report.client_count ? (analyzedClients / report.client_count) * 100 : 0)}</strong>
            <small><b>{analyzedClients} de {report.client_count}</b> clientes no agregado</small>
            <div className="portfolio-expense__metric-progress" role="progressbar" aria-label="Cobertura da carteira" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(coveragePercentage)}><span style={{ width: `${coveragePercentage}%` }} /></div>
          </article>
        )}
        {showUnconvertedMetric && (
          <article className="portfolio-expense__metric">
            <span>Sem conversão</span>
            <strong>{report.clients_not_converted} <small>{report.clients_not_converted === 1 ? "cliente" : "clientes"}</small></strong>
            <small>Agrupados separadamente em {excluded.map((group) => group.currency).join(", ") || "moeda original"}</small>
          </article>
        )}
      </div>

        <section className="portfolio-expense__panel" aria-labelledby="portfolio-expense-categories">
          <div className="portfolio-expense__panel-heading">
            <div><h3 id="portfolio-expense-categories">Onde a carteira mais gasta</h3><p>Participação, evolução e alcance por categoria</p></div>
            <span className="portfolio-expense__count-badge">{report.clients_converted} clientes · clique para explorar</span>
          </div>
          {report.categories.length ? (
            <div className="portfolio-expense__categories" role="table" aria-label="Gastos agregados por categoria">
              <div className="portfolio-expense__category-head" role="row"><span role="columnheader">Categoria</span><span role="columnheader">Participação</span><span role="columnheader">Total · vs anterior</span><span role="columnheader">Alcance</span></div>
              {report.categories.map((category, index) => (
                <div role="row" key={category.name}><button className="portfolio-expense__category-row" type="button" onClick={() => setSelectedCategory(category.name)} aria-label={`Detalhar ${category.name}`}>
                  <strong role="cell"><i aria-hidden="true" className="portfolio-expense__category-marker" style={{ backgroundColor: categoryColors[index % categoryColors.length] }} />{category.name}</strong>
                  <div role="cell" className="portfolio-expense__bar-cell"><span>{formatPercent(category.percentage)}</span><div className="portfolio-expense__bar"><span style={{ width: `${maximum ? Math.max(0, Math.min(100, (Number(category.total.amount) / maximum) * 100)) : 0}%` }} /></div></div>
                  <span role="cell" className="portfolio-expense__category-total">{fmtMoneyIn(category.total.amount, category.total.currency)}{analysis?.categories.find((item) => item.name === category.name) && <small data-direction={(() => { const item = analysis.categories.find((entry) => entry.name === category.name); return item.delta_percentage == null ? "none" : item.delta_percentage >= 0 ? "up" : "down"; })()}>{(() => { const item = analysis.categories.find((entry) => entry.name === category.name); return item.delta_percentage == null ? "Sem base anterior" : `${item.delta_percentage >= 0 ? "↑" : "↓"} ${formatPercent(Math.abs(item.delta_percentage))}`; })()}</small>}</span>
                  <span role="cell" className="portfolio-expense__client-count">{category.client_count} de {report.clients_converted} <span aria-hidden="true">↗</span></span>
                </button></div>
              ))}
            </div>
          ) : (
            <p className="portfolio-expense__empty">
              {report.client_count === 0
                ? "Nenhum cliente está vinculado à carteira neste momento."
                : report.clients_with_expenses === 0
                  ? "Nenhum cliente teve gastos no período selecionado."
                  : "Não há gastos convertidos para exibir neste período."}
            </p>
          )}
          {analysis && <p className="portfolio-expense__table-foot">Variação de {datePt(analysis.comparison.period_start)} a {datePt(analysis.comparison.period_end)}, na mesma coorte de {analysis.comparison.comparable_client_count} clientes. Clique em uma categoria para ver tendência, alcance e concentração.{report.categories.some((category) => category.name === "Não classificado") && " “Não classificado” permanece separado."}</p>}
        </section>

          {analysis && <section className="portfolio-expense__panel portfolio-expense__trend" aria-labelledby="portfolio-expense-trend"><div className="portfolio-expense__panel-heading"><div><h3 id="portfolio-expense-trend">Ritmo mensal da carteira</h3><p>Gastos agregados da coorte comparável no período</p></div>{analysis.comparison.delta_percentage != null && <span className="portfolio-expense__count-badge">{analysis.comparison.delta_percentage >= 0 ? "↑" : "↓"} {formatPercent(Math.abs(analysis.comparison.delta_percentage))} vs período anterior</span>}</div><div className="portfolio-expense__trend-bars" role="img" aria-label={`Tendência mensal: ${analysis.monthly_trend.map((point) => `${datePt(point.period_end)} ${fmtMoneyIn(point.total.amount, report.reading_currency)}`).join(", ")}`}>{analysis.monthly_trend.map((point) => <div className="portfolio-expense__trend-point" key={point.period_end}><strong>{fmtMoneyIn(point.total.amount, report.reading_currency)}</strong><span style={{ height: `${Math.max(3, Number(point.total.amount) / Math.max(1, ...analysis.monthly_trend.map((item) => Number(item.total.amount))) * 90)}px` }} /><small>{new Date(`${point.period_end}T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}</small></div>)}</div><p className="portfolio-expense__trend-foot">A série ajuda a distinguir evolução contínua de um pico isolado. Clique em uma categoria para inspecionar sua própria tendência.</p></section>}

          {excluded.length > 0 && (
            <section className="portfolio-expense__excluded" aria-labelledby="portfolio-expense-excluded">
              <div className="portfolio-expense__excluded-heading">
                <span aria-hidden="true">!</span>
                <div><h3 id="portfolio-expense-excluded">{report.clients_not_converted} {report.clients_not_converted === 1 ? "cliente ficou" : "clientes ficaram"} fora do agregado</h3><p>Não houve cotação disponível; estes valores não foram somados.</p></div>
              </div>
              {excluded.map((group) => <div className="portfolio-expense__currency-group" key={group.currency}>
                <div className="portfolio-expense__currency-line"><strong>Gastos identificados em {group.currency}</strong><span>{fmtMoneyIn(group.amount, group.currency)}</span></div>
                <small>{group.clients.size} {group.clients.size === 1 ? "cliente" : "clientes"} · {group.categories.length} {group.categories.length === 1 ? "categoria" : "categorias"}</small>
                <button className="portfolio-expense__cohort-button" type="button" onClick={() => setActiveCurrency(group.currency)}>Analisar em {group.currency} →</button>
              </div>)}
            </section>
          )}
        </div>

        <aside className="portfolio-expense__side">
          <PortfolioExpenseHighlights highlights={report.highlights} includedClients={report.clients_converted} onFollowUp={followUp} analysis={analysis} readingCurrency={report.reading_currency} />
          {report.conversion_rates.length > 0 && <section className="portfolio-expense__panel">
            <div className="portfolio-expense__panel-heading">
              <div><h3>Conversões aplicadas</h3><p>Taxas usadas para consolidar os valores</p></div>
              {report.conversion_rates.length > 0 && <button type="button" onClick={() => setShowConversionDetails((value) => !value)} aria-expanded={showConversionDetails}>{showConversionDetails ? "Ocultar" : "Detalhes"}</button>}
            </div>
            {report.conversion_rates.length ? (
              <div className="portfolio-expense__rates">
                {(report.converted_cohorts || []).map((cohort) => <div className="portfolio-expense__rate" key={cohort.base_currency}>
                  <strong>{cohort.base_currency} <span>→</span> {cohort.reading_currency} <small>{cohort.client_count} {cohort.client_count === 1 ? "cliente" : "clientes"}</small></strong>
                  <span>{cohort.base_currency === cohort.reading_currency ? "sem conversão" : `${fmtMoneyIn(cohort.original_total.amount, cohort.base_currency)} → ${fmtMoneyIn(cohort.converted_total.amount, cohort.reading_currency)}`}</span>
                </div>)}
                <p className="portfolio-expense__rate-foot">{report.conversion_rates.map((rate) => `1 ${rate.base} = ${Number(rate.rate).toLocaleString("pt-BR", { maximumFractionDigits: 6 })} ${rate.quote} · cotação de ${datePt(rate.quoted_on)}`).join("; ")}. A mesma cotação de leitura é usada nos dois períodos.</p>
              </div>
            ) : <p className="portfolio-expense__empty">Não foi necessária conversão cambial.</p>}
          </section>}

          <section className="portfolio-expense__panel portfolio-expense__reading-guide">
            <h3>Como ler este resumo</h3>
            <p>Participação mostra o peso da categoria no total. Alcance mostra quantos clientes registraram gastos; a concentração do maior cliente aparece no detalhe. A comparação usa a mesma cotação de leitura nos dois períodos.</p>
            {hasPartialCoverage && <button type="button" onClick={() => setShowConversionDetails(true)}>Entender a cobertura →</button>}
          </section>
        </aside>
      </div>

      <footer className="portfolio-expense__footnote">
        {total
          ? `Percentuais calculados sobre ${fmtMoneyIn(total.amount, total.currency)} dos ${report.clients_converted} clientes incluídos.`
          : "Não há total comparável para calcular percentuais neste período."}
        {report.clients_not_converted > 0 && " Os clientes sem conversão aparecem separados por moeda."}
        {report.categories.some((category) => category.name === "Não classificado") && " “Não classificado” permanece visível como categoria própria."}
      </footer>
        </>
      )}
      {showConversionDetails && <div className="portfolio-expense__drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowConversionDetails(false); }}>
        <section className="portfolio-expense__drawer" role="dialog" aria-modal="true" aria-label="Como a moeda foi tratada">
          <header><div><h2>Como a moeda foi tratada</h2><p>Base consultada: {report.client_count} clientes · {datePt(report.period_start)} – {datePt(report.period_end)}</p></div><button type="button" aria-label="Fechar detalhes" onClick={() => setShowConversionDetails(false)}>×</button></header>
          <p>O relatório tenta converter os gastos para {report.reading_currency}. Somente valores com conversão disponível entram no total principal; os demais permanecem separados na moeda original.</p>
          <h3>Incluídos no agregado · {report.clients_converted} clientes</h3>
          {(report.converted_cohorts || []).map((cohort) => <div className="portfolio-expense__drawer-line" key={cohort.base_currency}>
            <strong>{cohort.client_count} {cohort.client_count === 1 ? "cliente" : "clientes"} · {cohort.base_currency} → {cohort.reading_currency}</strong>
            <span>{cohort.base_currency === cohort.reading_currency
              ? fmtMoneyIn(cohort.converted_total.amount, cohort.reading_currency)
              : `${fmtMoneyIn(cohort.original_total.amount, cohort.base_currency)} → ${fmtMoneyIn(cohort.converted_total.amount, cohort.reading_currency)}`}
              <small>{cohort.base_currency === cohort.reading_currency ? "Mesma moeda de leitura; sem câmbio aplicado." : "Valor convertido incluído no agregado."}</small>
            </span>
          </div>)}
          {report.conversion_rates.length ? report.conversion_rates.map((rate, index) => <div className="portfolio-expense__drawer-line" key={`${rate.base}-${rate.quote}-${index}`}><strong>{rate.base} → {rate.quote}</strong><span>1 {rate.base} = {Number(rate.rate).toLocaleString("pt-BR", { maximumFractionDigits: 6 })} {rate.quote}<small>Cotação de {datePt(rate.quoted_on)}</small></span></div>) : <p>Não foi necessária conversão cambial para os clientes incluídos.</p>}
          {excluded.length > 0 && <><h3>Sem cotação disponível · {report.clients_not_converted} clientes</h3>{excluded.map((group) => <div className="portfolio-expense__drawer-cohort" key={group.currency}>
            <div className="portfolio-expense__drawer-line"><strong>{group.currency}</strong><span>{fmtMoneyIn(group.amount, group.currency)}<small>{group.clients.size} clientes · fora do total convertido</small></span></div>
            <div className="portfolio-expense__drawer-clients">{[...group.clients].map((id) => <span key={id}>{clientNameById.get(id) || "Cliente da carteira"}</span>)}</div>
            <button type="button" className="portfolio-expense__drawer-cohort-action" onClick={() => { setShowConversionDetails(false); setActiveCurrency(group.currency); }}>Analisar este grupo em {group.currency} →</button>
          </div>)}</>}
        </section>
      </div>}
      {activeCurrency && excluded.some((group) => group.currency === activeCurrency) && <div className="portfolio-expense__drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveCurrency(""); }}>
        <section className="portfolio-expense__drawer" role="dialog" aria-modal="true" aria-label={`Análise em ${activeCurrency}`}>
          <header><div><h2>Análise em {activeCurrency}</h2><p>Clientes sem conversão · {datePt(report.period_start)} – {datePt(report.period_end)}</p></div><button type="button" aria-label="Fechar análise por moeda" onClick={() => setActiveCurrency("")}>×</button></header>
          <button type="button" className="portfolio-expense__text-button" onClick={() => { setActiveCurrency(""); setShowConversionDetails(true); }}>← Voltar ao resumo da carteira</button>
          {excluded.filter((group) => group.currency === activeCurrency).map((group) => <div key={group.currency}>
            <p>Estes valores estão na moeda original e não foram somados ao agregado em {report.reading_currency}.</p>
            <h3>Gastos identificados · {group.clients.size} clientes</h3>
            <strong className="portfolio-expense__cohort-total">{fmtMoneyIn(group.amount, group.currency)}</strong>
            <h3>Distribuição por categoria</h3>
            {group.categories.map(([name, amount]) => <div className="portfolio-expense__drawer-line" key={name}><strong>{name}</strong><span>{fmtMoneyIn(amount, group.currency)}</span></div>)}
            <h3>Clientes neste grupo</h3>
            <p>{[...group.clients].map((id) => clientNameById.get(id)).filter(Boolean).join(", ") || `${group.clients.size} clientes da carteira`}</p>
          </div>)}
        </section>
      </div>}
      {selectedCategory && <div className="portfolio-expense__drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedCategory(""); }}>
        <section className="portfolio-expense__drawer" role="dialog" aria-modal="true" aria-label={`Detalhes de ${selectedCategory}`}>
          <header><div><h2>{selectedCategory}</h2><p>Explore a categoria · {datePt(report.period_start)} – {datePt(report.period_end)} · mesma coorte comparável</p></div><button type="button" aria-label="Fechar detalhes da categoria" onClick={() => setSelectedCategory("")}>×</button></header>
          {analysis?.categories.find((item) => item.name === selectedCategory) && <>{(() => { const item = analysis.categories.find((entry) => entry.name === selectedCategory); return <><div className="portfolio-expense__drawer-metrics"><div><small>Gastos no período</small><strong>{fmtMoneyIn(item.current_total.amount, report.reading_currency)}</strong></div><div><small>Variação vs anterior</small><strong>{item.delta_percentage == null ? "Sem base anterior" : `${Number(item.delta.amount) >= 0 ? "+" : ""}${fmtMoneyIn(item.delta.amount, report.reading_currency)}`}</strong></div></div><p className="portfolio-expense__drawer-callout"><strong>{item.client_count} de {report.clients_converted} clientes</strong> tiveram gastos nesta categoria. O maior contribuidor responde por <strong>{formatPercent(item.top_client_share)}</strong> do total — alcance e concentração são medidas diferentes.</p></>; })()}</>}
          <h3>Tendência da categoria</h3>
          {analysis && <div className="portfolio-expense__trend-bars portfolio-expense__drawer-chart" role="img" aria-label={`Gastos mensais de ${selectedCategory}`}>{analysis.monthly_trend.map((point) => <div className="portfolio-expense__trend-point" key={point.period_end}><strong>{fmtMoneyIn(point.categories[selectedCategory]?.amount || 0, report.reading_currency)}</strong><span style={{ height: `${Math.max(3, Number(point.categories[selectedCategory]?.amount || 0) / Math.max(1, ...analysis.monthly_trend.map((entry) => Number(entry.categories[selectedCategory]?.amount || 0))) * 82)}px` }} /><small>{new Date(`${point.period_end}T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}</small></div>)}</div>}
          <h3>Principais contribuições</h3>
          {!contributors && !contributorsError && <p role="status">Carregando contribuições…</p>}
          {contributorsError && <p role="alert">{contributorsError} <button type="button" onClick={contributors ? loadMoreContributors : () => setContributorsRequest((value) => value + 1)}>Tentar novamente</button></p>}
          {contributors?.clients.map((client) => <div className="portfolio-expense__drawer-line" key={client.organization_id}><strong>{client.client_name}</strong><span>{fmtMoneyIn(client.total.amount, client.total.currency)}<small>{formatPercent(client.percentage_of_category)} da categoria</small></span></div>)}
          {contributors?.truncated && <button type="button" className="portfolio-expense__drawer-more" disabled={contributorsPageLoading} onClick={loadMoreContributors}>{contributorsPageLoading ? "Carregando…" : `Ver mais clientes (${contributors.clients.length} de ${contributors.client_count})`}</button>}
          <p className="portfolio-expense__drawer-callout">Este detalhamento mostra contribuições observadas. Não atribui causas aos gastos.</p>
        </section>
      </div>}
    </section>
  );
}
