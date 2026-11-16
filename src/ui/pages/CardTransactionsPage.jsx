import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Download } from "lucide-react";

import { getCreditCardInvoice, listCreditCards } from "../../api/creditCards";
import { T } from "../tokens";
import { plural } from "../plural.js";
import { G, NUM } from "../typography";
import { formatMoney } from "../money/formatMoney.js";
import { Btn, Card, PageTitle } from "../components/primitives.jsx";
import { shouldUseRealData } from "../dataMode.js";
import { invoiceDashboardPath, isValidInvoiceParams } from "../routing/invoiceRoute.js";
import { FC } from "../routing/searchContract.js";
import { CategoryBreakdown } from "../features/invoiceDashboard/CategoryBreakdown.jsx";
import { DENSITIES, readListPrefs, writeListPrefs } from "../features/transactions/listPrefs.js";
import { TxRow } from "../features/transactions/shared/TransactionRow.jsx";
import { shortDateLabel } from "../features/transactions/shared/transactionFormat.js";
import { TransactionsFilterBar } from "../features/transactions/filters/TransactionsFilterBar.jsx";
import { useTransactionsFilterState } from "../features/transactions/filters/useTransactionsFilterState.js";
import { resolvePeriodDisplayBounds } from "../features/transactions/periodDateBounds.js";
import { categoryOptions, invoiceExportFilter, invoiceRows, tagOptions, weeklySpending } from "../features/cardTransactions/cardTransactionsModel.js";
import { ExportPanel } from "../features/export/ExportPanel.jsx";
import { invoiceExportNames } from "../features/export/invoiceExport.js";
import { exportTexts } from "../features/export/exportTexts.js";
import { useExportSummary } from "../features/export/useExportSummary.js";
import { TAG_MODE_LABELS } from "../features/transactions/filters/tagModeLabels.js";

const panel = { padding: 18, minWidth: 0 };
const input = { ...G, minHeight: 38, border: `1px solid ${T.border}`, borderRadius: 9, background: T.surface, color: T.ink, padding: "7px 10px" };
const INVOICE_FILTER_INITIAL = { period: "tudo" };
const INVOICE_FACETS = ["periodo", "categoria", "tag", "valor"];
const INVOICE_SORT_FIELDS = ["date", "val", "desc", "cat"];
const money = (value, currency) => currency ? formatMoney(value, currency) : null;
const MODALITY_LABELS = { cash: "À vista", installment: "Parcelada", refund: "Estorno" };

function Notice({ children }) {
  return <Card role="status" style={{ ...panel, ...G, color: T.inkMid, fontSize: 13 }}>{children}</Card>;
}

function WeeklyChart({ rows, currency }) {
  const hasData = rows.some((row) => row.hasData);
  const ceiling = Math.max(1, ...rows.map((row) => Math.abs(row.amount)));
  return (
    <Card as="section" aria-label="Saídas por semana" style={{ ...panel, display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 style={{ ...G, fontSize: 15, margin: 0 }}>Saídas por semana</h2>
      <span style={{ ...G, fontSize: 11, color: T.inkLight }}>Semanas com datas de cobrança observadas nesta fatura</span>
      {!hasData ? <span style={{ ...G, fontSize: 12, color: T.inkMid }}>Sem lançamentos com data nesta fatura.</span> : (
        <div style={{ display: "flex", alignItems: "end", gap: 12, height: 126 }}>
          {rows.map((row) => (
            <div key={row.label} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "end", alignItems: "center", gap: 5 }}>
              {row.hasData && <span style={{ ...G, ...NUM, fontSize: 11, color: T.inkMid }}>{money(row.amount, currency) ?? "—"}</span>}
              {!row.hasData && <span style={{ ...G, fontSize: 11, color: T.inkGhost }}>sem dados</span>}
              <div role="img" aria-label={`Semana de ${row.label}: ${row.hasData ? money(row.amount, currency) ?? "valor indisponível" : "sem dados registrados"}`}
                style={{ width: "100%", maxWidth: 58, minHeight: row.hasData ? 3 : 0, height: row.hasData ? `${Math.max(3, Math.abs(row.amount) / ceiling * 76)}px` : 0, background: row.amount < 0 ? T.green : T.blue, borderRadius: "5px 5px 0 0" }} />
              <span style={{ ...G, fontSize: 11, color: T.inkLight }}>{row.label}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function TransactionList({ rows, grouped, density, isMobile, currency }) {
  let lastDate = null;
  const rowHeight = DENSITIES[density]?.[isMobile ? "mobile" : "desktop"] ?? 48;
  return (
    <Card as="section" aria-label="Lançamentos da fatura" style={panel}>
      <h2 style={{ ...G, fontSize: 15, margin: "0 0 10px" }}>Lançamentos</h2>
      {rows.length === 0 && <p style={{ ...G, color: T.inkMid, fontSize: 12 }}>Nenhum lançamento corresponde aos filtros.</p>}
      <div role="list">
      {rows.map((row) => {
        const heading = grouped && row.transactionDate !== lastDate;
        lastDate = row.transactionDate;
        const tx = {
          ...row,
          type: row.isRefund ? "refund" : "expense",
          method: "Crédito",
          paymentMethodKey: "credito",
          parcela: row.parcela ? { atual: row.parcela.n, total: row.parcela.t, valParcela: row.parcela.val } : null,
          refundsSummary: null,
        };
        return (
          <div key={row.id}>
            {heading && <div style={{ ...G, ...NUM, fontSize: 11, fontWeight: 700, color: T.inkLight, padding: "12px 0 4px" }}>{row.transactionDate ? new Date(`${row.transactionDate}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) : "Sem data"}</div>}
            <TxRow tx={tx} readOnly displayValue={money(row.val == null ? null : Math.abs(row.val), currency) ?? "—"}
              isMobile={isMobile} rowHeight={rowHeight} showDate={!grouped} dateLabel={shortDateLabel(row.date)} />
          </div>
        );
      })}
      </div>
    </Card>
  );
}

export function CardTransactionsPage({ isMobile = false, organizationId = null, dataMode = "live", transactionsRefreshToken = 0 }) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const { cardId, year: yearRaw, month: monthRaw } = useParams({ strict: false });
  const valid = isValidInvoiceParams({ cardId, year: yearRaw, month: monthRaw });
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const [state, setState] = useState({ status: "loading", card: null, detail: null });
  const inFlight = useRef(new Map());
  const filter = useTransactionsFilterState({ initial: INVOICE_FILTER_INITIAL, clearToInitial: true });
  const [modality, setModality] = useState(search[FC.INVOICE_MODALITY] || "all");
  useEffect(() => { setModality(search[FC.INVOICE_MODALITY] || "all"); }, [search[FC.INVOICE_MODALITY]]);
  const [prefs, setPrefs] = useState(readListPrefs);
  const enabled = valid && shouldUseRealData(organizationId, dataMode);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState({ status: "loading", card: null, detail: null });
    const key = `${organizationId}:${cardId}:${year}-${month}:${transactionsRefreshToken}`;
    let request = inFlight.current.get(key);
    if (!request) {
      request = listCreditCards(organizationId).then(async (cards) => {
      const card = cards.find((entry) => entry.public_id === cardId);
      if (!card) return { status: "missing", card: null, detail: null };
      try {
        const detail = await getCreditCardInvoice(card.id, year, month, organizationId);
        return { status: "ok", card, detail };
      } catch {
        return { status: "error", card, detail: null };
      }
      }).catch(() => ({ status: "error", card: null, detail: null }))
        .finally(() => inFlight.current.delete(key));
      inFlight.current.set(key, request);
    }
    request.then((result) => { if (active) setState(result); });
    return () => { active = false; };
  }, [enabled, organizationId, cardId, year, month, transactionsRefreshToken]);

  const detail = state.detail;
  const categories = useMemo(() => categoryOptions(detail?.category_breakdown), [detail]);
  const tags = useMemo(() => tagOptions(detail?.items), [detail]);
  const bounds = resolvePeriodDisplayBounds(filter.period, filter.customFrom, filter.customTo);
  const rows = useMemo(() => filter.sortItems(invoiceRows(detail?.items, {
    search: filter.search, cats: filter.cats, tags: filter.tags, tagMode: filter.tagMode,
    modality, from: bounds.from, to: bounds.to, valueMin: filter.valueMin, valueMax: filter.valueMax,
    // Faixa lida na moeda da fatura/cartão (#284): em US$, "1,500" é 1500.
    valueCurrency: detail?.currency || state.card?.currency || null,
  })), [detail, filter, modality, bounds.from, bounds.to, state.card?.currency]);
  const weeks = useMemo(() => weeklySpending(detail?.items), [detail]);
  const setPreference = (patch) => setPrefs((before) => { const next = { ...before, ...patch }; writeListPrefs(next); return next; });
  const goBack = () => navigate({ to: invoiceDashboardPath(cardId, year, month) });
  const currency = detail?.currency || state.card?.currency || null;
  const [exportOpen, setExportOpen] = useState(false);
  // O recorte da tela como parâmetros da API (#525): o arquivo e os totais do painel saem do servidor com eles.
  const exportFilter = state.card && detail ? invoiceExportFilter({
    organizationId, cardId: state.card.id, invoiceId: detail.invoice_id ?? null, items: detail.items, categories,
    search: filter.search, cats: filter.cats, tags: filter.tags, tagMode: filter.tagMode, modality,
    from: bounds.from, to: bounds.to, valueMin: filter.valueMin, valueMax: filter.valueMax, valueCurrency: currency,
  }) : { params: null, blocked: null };
  const exportSummary = useExportSummary(exportOpen ? exportFilter.params : null);
  const exportNames = state.card ? invoiceExportNames(state.card, year, month) : null;
  const exportFiltersText = () => {
    const texts = exportTexts("pt-BR");
    const byId = new Map(categories.map((row) => [row.id, row.name]));
    const catNames = filter.cats.map((id) => byId.get(id)).filter(Boolean);
    const valueFacet = filter.buildFacets({ valueCurrency: currency }).find((facet) => facet.key === "valor" && facet.active);
    return [
      exportNames.invoiceLine,
      ...(bounds.from || bounds.to ? [texts.period(bounds.from, bounds.to)] : []),
      ...(filter.search.trim() ? [`Busca: ${filter.search.trim()}`] : []),
      ...(catNames.length ? [`${catNames.length === 1 ? "Categoria" : "Categorias"}: ${catNames.join(", ")}`] : []),
      texts.tags(filter.tags, TAG_MODE_LABELS[filter.tagMode] ?? TAG_MODE_LABELS.any),
      ...(MODALITY_LABELS[modality] ? [`Modalidade: ${MODALITY_LABELS[modality]}`] : []),
      ...(valueFacet ? [`${valueFacet.label}: ${valueFacet.value}`] : []),
    ].filter(Boolean);
  };

  return (
    <div style={{ padding: isMobile ? 16 : 28, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <button type="button" onClick={goBack} style={{ ...G, alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 5, border: 0, background: "none", color: T.blue, fontSize: 12, fontWeight: 700, cursor: "pointer" }}><ArrowLeft size={14} /> Voltar para a fatura</button>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div>
        <PageTitle sans="Lançamentos da" serif="fatura" />
        {state.card && <p style={{ ...G, ...NUM, margin: "5px 0 0", color: T.inkMid, fontSize: 12 }}>{state.card.description || state.card.brand} •{state.card.last4} · {new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>}
      </div>
      {enabled && state.status === "ok" && detail && <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, maxWidth: 320 }}>
        <Btn variant="outGray" disabled={rows.length === 0 || Boolean(exportFilter.blocked)} onClick={() => setExportOpen(true)} data-testid="export-invoice-transactions"><Download size={14} /> Exportar</Btn>
        {rows.length > 0 && exportFilter.blocked && <span role="status" style={{ ...G, fontSize: 11, color: T.inkMid, textAlign: "right" }}>{exportFilter.blocked}</span>}
      </div>}
      </div>
      {!enabled && <Notice>Selecione uma organização para ver os lançamentos.</Notice>}
      {enabled && state.status === "loading" && <Notice>Carregando lançamentos…</Notice>}
      {enabled && state.status === "missing" && <Notice>Cartão não encontrado ou sem acesso.</Notice>}
      {enabled && state.status === "error" && <Notice>Não foi possível carregar a fatura.</Notice>}
      {enabled && state.status === "ok" && detail && <>
        <Card style={{ ...panel, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ ...G, color: T.inkMid, fontSize: 12 }}>Total da fatura · {plural(detail.items_count, "lançamento", "lançamentos")}</span>
          <strong style={{ ...G, ...NUM, fontSize: 22 }}>{money(detail.total_amount, currency) ?? "—"}</strong>
        </Card>
        {!currency && <Notice>Moeda da fatura indisponível; os valores não podem ser exibidos com segurança.</Notice>}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "repeat(2,minmax(0,1fr))", gap: 14 }}>
          {currency && <CategoryBreakdown breakdown={detail.category_breakdown} total={detail.total_amount} currency={currency} isMobile={isMobile} />}
          <WeeklyChart rows={weeks} currency={currency} />
        </div>
        <Card style={{ ...panel, display: "flex", flexDirection: "column", gap: 12 }}>
          <TransactionsFilterBar valueReadCurrency={detail?.currency || state.card?.currency || null} filter={filter} categories={categories.map((row) => ({ id: row.id, label: row.name, color: row.color }))}
            allTags={tags} visibleFacetKeys={INVOICE_FACETS} visibleSortFields={INVOICE_SORT_FIELDS} compact={isMobile} filteredCount={rows.length}
            filterToolbarActive={Boolean(filter.search || filter.period !== "tudo" || filter.cats.length || filter.tags.length || filter.valueMin || filter.valueMax || modality !== "all")}
            onClearAll={() => setModality("all")} />
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: 10 }}>
          <label style={{ ...G, display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: T.inkMid }}>Modalidade
            <select aria-label="Filtrar modalidade" value={modality} onChange={(event) => setModality(event.target.value)} style={input}><option value="all">Todas</option><option value="cash">À vista</option><option value="installment">Parcelada</option><option value="refund">Estorno</option></select>
          </label>
          <label style={{ ...G, display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: T.inkMid }}>Densidade
            <select aria-label="Densidade da lista" value={prefs.density} onChange={(event) => setPreference({ density: event.target.value })} style={input}>{Object.entries(DENSITIES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select>
          </label>
          <label style={{ ...G, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.inkMid, minHeight: 38 }}><input type="checkbox" checked={prefs.grouped && filter.sort[0]?.field === "date"} disabled={filter.sort[0]?.field !== "date"} onChange={(event) => setPreference({ grouped: event.target.checked })} /> Agrupar por data</label>
          </div>
        </Card>
        <div style={{ ...G, ...NUM, fontSize: 11, color: T.inkLight }}>Exibindo {rows.length} de {plural(detail.items_count, "lançamento", "lançamentos")}. Os filtros não alteram o resumo da fatura.</div>
        <TransactionList rows={rows} grouped={prefs.grouped && filter.sort[0]?.field === "date"} density={prefs.density} isMobile={isMobile} currency={currency} />
      </>}
      {exportOpen && exportFilter.params && <ExportPanel title={`Lançamentos da fatura · ${exportNames.title}`} filePrefix={exportNames.filePrefix} filtersText={exportFiltersText()} filterParams={exportFilter.params} count={rows.length} summary={exportSummary.data} summaryError={exportSummary.error} onClose={() => setExportOpen(false)} />}
    </div>
  );
}
