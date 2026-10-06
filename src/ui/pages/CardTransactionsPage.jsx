import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { getCreditCardInvoice, listCreditCards } from "../../api/creditCards";
import { T } from "../tokens";
import { G, NUM } from "../typography";
import { formatMoney } from "../money/formatMoney.js";
import { shouldUseRealData } from "../dataMode.js";
import { invoiceDashboardPath, isValidInvoiceParams } from "../routing/invoiceRoute.js";
import { CategoryBreakdown } from "../features/invoiceDashboard/CategoryBreakdown.jsx";
import { DENSITIES, readListPrefs, writeListPrefs } from "../features/transactions/listPrefs.js";
import { TransactionsFilterBar } from "../features/transactions/filters/TransactionsFilterBar.jsx";
import { useTransactionsFilterState } from "../features/transactions/filters/useTransactionsFilterState.js";
import { resolvePeriodDisplayBounds } from "../features/transactions/periodDateBounds.js";
import { categoryOptions, invoiceRows, tagOptions, weeklySpending } from "../features/cardTransactions/cardTransactionsModel.js";

const panel = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.sm, padding: 18, minWidth: 0 };
const input = { ...G, minHeight: 38, border: `1px solid ${T.border}`, borderRadius: 9, background: T.surface, color: T.ink, padding: "7px 10px" };
const INVOICE_FILTER_INITIAL = { period: "tudo" };
const INVOICE_FACETS = ["periodo", "categoria", "tag", "valor"];
const INVOICE_SORT_FIELDS = ["date", "val", "desc", "cat"];

function Notice({ children }) {
  return <div role="status" style={{ ...panel, ...G, color: T.inkMid, fontSize: 13 }}>{children}</div>;
}

function WeeklyChart({ rows, currency }) {
  const hasData = rows.some((row) => row.hasData);
  const ceiling = Math.max(1, ...rows.map((row) => Math.abs(row.amount)));
  return (
    <section aria-label="Saídas por semana" style={{ ...panel, display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 style={{ ...G, fontSize: 15, margin: 0 }}>Saídas por semana</h2>
      <span style={{ ...G, fontSize: 11, color: T.inkLight }}>Semanas com datas de cobrança observadas nesta fatura</span>
      {!hasData ? <span style={{ ...G, fontSize: 12, color: T.inkMid }}>Sem lançamentos com data nesta fatura.</span> : (
        <div style={{ display: "flex", alignItems: "end", gap: 12, height: 126 }}>
          {rows.map((row) => (
            <div key={row.label} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "end", alignItems: "center", gap: 5 }}>
              {row.hasData && <span style={{ ...G, ...NUM, fontSize: 10, color: T.inkMid }}>{formatMoney(row.amount, currency) ?? "—"}</span>}
              {!row.hasData && <span style={{ ...G, fontSize: 10, color: T.inkGhost }}>sem dados</span>}
              <div role="img" aria-label={`Semana de ${row.label}: ${row.hasData ? formatMoney(row.amount, currency) ?? "valor indisponível" : "sem dados registrados"}`}
                style={{ width: "100%", maxWidth: 58, minHeight: row.hasData ? 3 : 0, height: row.hasData ? `${Math.max(3, Math.abs(row.amount) / ceiling * 76)}px` : 0, background: row.amount < 0 ? T.green : T.blue, borderRadius: "5px 5px 0 0" }} />
              <span style={{ ...G, fontSize: 10, color: T.inkLight }}>{row.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TransactionList({ rows, grouped, density, isMobile, currency }) {
  let lastDate = null;
  const rowHeight = DENSITIES[density]?.[isMobile ? "mobile" : "desktop"] ?? 48;
  return (
    <section aria-label="Lançamentos da fatura" style={panel}>
      <h2 style={{ ...G, fontSize: 15, margin: "0 0 10px" }}>Lançamentos</h2>
      {rows.length === 0 && <p style={{ ...G, color: T.inkMid, fontSize: 12 }}>Nenhum lançamento corresponde aos filtros.</p>}
      {rows.map((row) => {
        const heading = grouped && row.transactionDate !== lastDate;
        lastDate = row.transactionDate;
        return (
          <div key={row.id}>
            {heading && <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkLight, padding: "12px 0 4px" }}>{row.transactionDate ? new Date(`${row.transactionDate}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) : "Sem data"}</div>}
            <div style={{ display: "flex", alignItems: "center", minHeight: rowHeight, gap: 10, borderBottom: `1px solid ${T.border}` }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.desc}</div>
                <div style={{ ...G, fontSize: 11, color: T.inkLight }}>{[row.cat, row.parcela ? `${row.parcela.n}/${row.parcela.t}` : null, grouped ? null : row.date].filter(Boolean).join(" · ")}</div>
              </div>
              <span style={{ ...G, ...NUM, fontSize: 13, fontWeight: 700, color: row.isRefund ? T.green : T.ink, whiteSpace: "nowrap" }}>{row.isRefund ? "− " : ""}{formatMoney(Math.abs(row.val), currency) ?? "—"}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function CardTransactionsPage({ isMobile = false, organizationId = null, dataMode = "live", transactionsRefreshToken = 0 }) {
  const navigate = useNavigate();
  const { cardId, year: yearRaw, month: monthRaw } = useParams({ strict: false });
  const valid = isValidInvoiceParams({ cardId, year: yearRaw, month: monthRaw });
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const [state, setState] = useState({ status: "loading", card: null, detail: null });
  const inFlight = useRef(new Map());
  const filter = useTransactionsFilterState({ initial: INVOICE_FILTER_INITIAL, clearToInitial: true });
  const [modality, setModality] = useState("all");
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
      } catch (error) {
        return { status: error?.response?.status === 404 ? "empty" : "error", card, detail: null };
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
  })), [detail, filter, modality, bounds.from, bounds.to]);
  const weeks = useMemo(() => weeklySpending(detail?.items), [detail]);
  const setPreference = (patch) => setPrefs((before) => { const next = { ...before, ...patch }; writeListPrefs(next); return next; });
  const goBack = () => navigate({ to: invoiceDashboardPath(cardId, year, month) });
  const currency = state.card?.currency;

  return (
    <div style={{ padding: isMobile ? 16 : 28, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <button type="button" onClick={goBack} style={{ ...G, alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 5, border: 0, background: "none", color: T.blue, fontSize: 12, fontWeight: 700, cursor: "pointer" }}><ArrowLeft size={14} /> Voltar para a fatura</button>
      <div>
        <h1 style={{ ...G, margin: 0, fontSize: isMobile ? 23 : 29 }}>Lançamentos da fatura</h1>
        {state.card && <p style={{ ...G, margin: "5px 0 0", color: T.inkMid, fontSize: 12 }}>{state.card.description || state.card.brand} •{state.card.last4} · {new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>}
      </div>
      {!enabled && <Notice>Selecione uma organização para ver os lançamentos.</Notice>}
      {enabled && state.status === "loading" && <Notice>Carregando lançamentos…</Notice>}
      {enabled && state.status === "missing" && <Notice>Cartão não encontrado ou sem acesso.</Notice>}
      {enabled && state.status === "error" && <Notice>Não foi possível carregar a fatura.</Notice>}
      {enabled && state.status === "empty" && <Notice>Esta fatura ainda não tem lançamentos.</Notice>}
      {enabled && state.status === "ok" && detail && <>
        <div style={{ ...panel, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ ...G, color: T.inkMid, fontSize: 12 }}>Total da fatura · {detail.items_count} lançamentos</span>
          <strong style={{ ...G, ...NUM, fontSize: 22 }}>{formatMoney(detail.total_amount, currency) ?? "—"}</strong>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "repeat(2,minmax(0,1fr))", gap: 14 }}>
          <CategoryBreakdown breakdown={detail.category_breakdown} total={detail.total_amount} currency={currency} isMobile={isMobile} />
          <WeeklyChart rows={weeks} currency={currency} />
        </div>
        <div style={{ ...panel, display: "flex", flexDirection: "column", gap: 12 }}>
          <TransactionsFilterBar filter={filter} categories={categories.map((row) => ({ id: row.id, label: row.name, color: row.color }))}
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
        </div>
        <div style={{ ...G, fontSize: 11, color: T.inkLight }}>Exibindo {rows.length} de {detail.items_count} lançamentos. Os filtros não alteram o resumo da fatura.</div>
        <TransactionList rows={rows} grouped={prefs.grouped && filter.sort[0]?.field === "date"} density={prefs.density} isMobile={isMobile} currency={currency} />
      </>}
    </div>
  );
}
