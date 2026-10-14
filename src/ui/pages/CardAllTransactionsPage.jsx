import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useRouter, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Download, Search, Sparkles, X } from "lucide-react";

import { getCurrentCreditCardInvoice, getInvoiceHistory, listCreditCards } from "../../api/creditCards";
import { getTransaction, getTransactionsFacets, getTransactionsSummary, listTransactions } from "../../api/transactions";
import { Btn, Card, PageTitle, Select } from "../components/primitives.jsx";
import { shouldUseRealData } from "../dataMode.js";
import { dayKey, groupSubtotal } from "../features/cardTransactions/ledgerModel.js";
import { assistantInsights } from "../features/cardTransactions/assistantModel.js";
import { CategorizeDialog, ExportDialog, MoveInstallmentDialog, RefundDialog } from "../features/cardTransactions/LedgerDialogs.jsx";
import { AssistantDrawer, LedgerDetail } from "../features/cardTransactions/LedgerPanels.jsx";
import { LedgerAlertStrip, LedgerAppBar, LedgerSearchEmpty, LedgerSummaryRow } from "../features/cardTransactions/LedgerMobileBars.jsx";
import { categorizeRows, createRefund, fetchAllRows, moveRows } from "../features/cardTransactions/ledgerActions.js";
import { buildPdfParts, buildPrintHtml, downloadCsv, printHtml } from "../features/cardTransactions/ledgerExport.js";
import { CardOutflowsChart } from "../features/cardTransactions/CardOutflowsChart.jsx";
import { CardTransactionsSummary } from "../features/cardTransactions/CardTransactionsSummary.jsx";
import { CardTransactionsTable } from "../features/cardTransactions/CardTransactionsTable.jsx";
import { CardTimeScopePanel } from "../features/cardTransactions/CardTimeScopePanel.jsx";
import { buildOutflows } from "../features/cardTransactions/outflowsModel.js";
import { describeLedgerChange, weekEnd } from "../features/cardTransactions/ledgerHistory.js";
import { useFilterHistory } from "../features/transactions/filters/useFilterHistory.js";
import { HistoryButton } from "../features/transactions/TransactionsListHeader.jsx";
import { defaultInvoiceKeys, invoiceChipLabel, invoiceIdsForQuery, invoiceOptions, periodChipLabel, withCurrentInvoice, withLedgerInvoices } from "../features/cardTransactions/invoiceScope.js";
import { formatCustomPeriodLabel } from "../features/transactions/filters/customPeriodLabel.js";
import { readListPrefs, writeListPrefs } from "../features/transactions/listPrefs.js";
import { TransactionsListDisplayControls } from "../features/transactions/TransactionsListDisplayControls.jsx";
import { TransactionsFilterPanel } from "../features/transactions/filters/TransactionsFilterPanel.jsx";
import { TransactionsFilterBar } from "../features/transactions/filters/TransactionsFilterBar.jsx";
import { TransactionsFilterChips } from "../features/transactions/filters/TransactionsFilterChips.jsx";
import { useTransactionsFilterState } from "../features/transactions/filters/useTransactionsFilterState.js";
import { useTransactionsTagCatalog } from "../features/transactions/filters/useTransactionsTagCatalog.js";
import { buildTagOptions, isTagFilterBlocked, resolveTagFilterStatuses, tagFilterStatusMessage, tagOptionsToDisplayMap } from "../features/transactions/filters/tagCatalogResolution.js";
import { useCategoryTagsData } from "../features/tags/useCategoryTagsData.js";
import { useFocusTrap } from "../features/transactions/useFocusTrap.js";
import { resolvePeriodDisplayBounds } from "../features/transactions/periodDateBounds.js";
import { parseMoneyInput } from "../features/onboarding/onboardingValueUtils.js";
import { pickCategoryTagFromApiTransaction, todayLocalYmd } from "../data/transactionsAdapter.js";
import { formatMoneyAbs } from "../money/formatMoney.js";
import { FC, FC_MODAL } from "../routing/searchContract.js";
import { G, NUM } from "../typography.js";
import { T } from "../tokens.js";

const PAGE_SIZE = 30;
// O ledger lê 12 faturas para o seletor de recorte.
const INVOICE_WINDOW = 12;
const FACETS = ["periodo", "categoria", "tag", "cartao", "tipo", "situacao", "valor"];
const FACET_LABELS = { periodo: "Período", categoria: "Categoria", tag: "Etiquetas", cartao: "Cartão", tipo: "Tipo", situacao: "Status", valor: "Valor" };
const pendingCards = new Map();
const pendingPages = new Map();

function sharePending(map, key, request) {
  if (!map.has(key)) map.set(key, request().finally(() => map.delete(key)));
  return map.get(key);
}
const KIND_LABELS = { one_off: "Compras avulsas e estornos", installment: "Parcelas", recurring: "Recorrências", refund: "Estornos" };
const EMPTY_DAYS = new Set();
function cardLabel(card) {
  return `${card.description || card.brand || "Cartão"} •${card.last4 || "••••"}`;
}
export function CardAllTransactionsPage({ organizationId = null, dataMode = "live", isMobile = false, transactionsRefreshToken = 0 }) {
  const { cardId } = useParams({ strict: false });
  const navigate = useNavigate();
  const router = useRouter();
  const enabled = shouldUseRealData(organizationId, dataMode);
  // Deep link (Dashboard da fatura): fatura, categoria, busca e tipo chegam pela URL, lidos uma vez.
  const urlSearch = useSearch({ strict: false });
  const readLink = () => ({ invoice: urlSearch?.[FC.LEDGER_INVOICE] ?? null, category: urlSearch?.[FC.LEDGER_CATEGORY] ?? null, query: urlSearch?.[FC.LEDGER_SEARCH] ?? "", kind: urlSearch?.[FC.LEDGER_KIND] ?? null });
  const [link, setLink] = useState(readLink);
  const [kind, setKind] = useState(link.kind);
  const linkScopeRef = useRef(null);
  const filter = useTransactionsFilterState({ initial: { period: "tudo" }, clearToInitial: true });
  // A URL é a fonte do deep link: aplica na abertura e de novo se ela mudar com a tela montada.
  const linkKey = JSON.stringify(readLink());
  const appliedLinkKey = useRef(null);
  useEffect(() => {
    if (appliedLinkKey.current === linkKey) return;
    const first = appliedLinkKey.current === null;
    appliedLinkKey.current = linkKey;
    const next = readLink();
    if (!first) {
      setLink(next); setKind(next.kind); setWeek(null); setInvoiceKeys(next.invoice ? [next.invoice] : null);
      if (next.invoice) setTimeMode("invoice");
    }
    if (next.category) filter.setCats([next.category]); else if (!first) filter.setCats([]);
    if (next.query) filter.setSearch(next.query); else if (!first) filter.setSearch("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkKey]);
  const categoryCatalog = useCategoryTagsData({ organizationId, enabled });
  const refundCatalog = useCategoryTagsData({ organizationId, transactionType: "refund", enabled });
  const tagCatalog = useTransactionsTagCatalog({ organizationId, enabled });
  const [debouncedSearch, setDebouncedSearch] = useState(link.query);
  const [prefs, setPrefs] = useState(readListPrefs);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeFacet, setActiveFacet] = useState("periodo");
  const [mobileFacetOpen, setMobileFacetOpen] = useState(false);
  const [cardScope, setCardScope] = useState("current");
  // O recorte de tempo é sempre um destes dois: FATURAS do cartão ou um PERÍODO livre.
  const [timeMode, setTimeMode] = useState("invoice");
  const [invoiceKeys, setInvoiceKeys] = useState(() => link.invoice ? [link.invoice] : null);
  // Semana (do gráfico "Saídas por semana") que recorta a lista; vale só para a fatura em que foi marcada.
  const [week, setWeek] = useState(null);
  const [summarySheetOpen, setSummarySheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // No celular a busca aberta ocupa uma entrada do histórico: o voltar do sistema fecha só o campo, como num app nativo.
  const searchEntryRef = useRef(false);
  const openSearch = () => {
    setSearchOpen(true);
    if (isMobile && !searchEntryRef.current) { searchEntryRef.current = true; router.history.push(router.history.location.href); }
  };
  const closeSearch = () => {
    setSearchOpen(false);
    if (searchEntryRef.current) { searchEntryRef.current = false; router.history.back(); }
  };
  useEffect(() => router.history.subscribe(({ action }) => {
    if (action.type === "BACK" && searchEntryRef.current) { searchEntryRef.current = false; setSearchOpen(false); }
  }), [router]);
  const [viewportWidth, setViewportWidth] = useState(() => typeof window === "undefined" ? 1440 : window.innerWidth);
  const [chipsBudget, setChipsBudget] = useState(null);
  const ledgerRef = useRef(null);
  const [ledgerHeight, setLedgerHeight] = useState(560);
  const detailDialogRef = useRef(null);
  const filterDialogRef = useRef(null);
  const summaryDialogRef = useRef(null);
  const detailCloseRef = useRef(null);
  const filterCloseRef = useRef(null);
  const summaryCloseRef = useRef(null);
  const searchInputRef = useRef(null);
  const mobileFacetHeadingRef = useRef(null);
  const mobileFacetButtonRefs = useRef({});
  const wasMobileFacetOpenRef = useRef(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [inspected, setInspected] = useState(null);
  const [historyState, setHistoryState] = useState({ cardId: null, data: null, error: false });
  const [summaryState, setSummaryState] = useState({ key: null, data: null, loading: false, error: false });
  const [facetState, setFacetState] = useState({ key: null, data: null });
  // Faturas vistas no resumo do ledger (inclui as futuras, que o histórico não traz); só do cartão da tela.
  const [ledgerInvoiceRows, setLedgerInvoiceRows] = useState({ cardId: null, rows: [] });
  const rememberInvoices = (ownerId, data) => {
    const rows = (data?.breakdown?.by_invoice ?? []).filter((row) => row.invoice_id != null && row.credit_card_id === ownerId);
    if (rows.length === 0) return;
    setLedgerInvoiceRows((prev) => {
      const byKey = new Map((prev.cardId === ownerId ? prev.rows : []).map((row) => [`${row.year}-${row.month}`, row]));
      rows.forEach((row) => byKey.set(`${row.year}-${row.month}`, { invoice_id: row.invoice_id, year: row.year, month: row.month }));
      return { cardId: ownerId, rows: [...byKey.values()] };
    });
  };
  // Faturas lado a lado: mesma consulta sem o recorte de fatura, para barras de faturas ainda não marcadas.
  const [ladderState, setLadderState] = useState({ key: null, data: null, loading: false, error: false });
  const [retry, setRetry] = useState(0);
  // Depois de uma ação que muda dados (categoria, fatura, estorno) tudo é lido de novo.
  const [reload, setReload] = useState(0);
  // O Painel de Transação (modal global) avisa pelo token quando salva: recarrega a lista e descarta detalhe e seleção, que ficaram velhos.
  const refreshTokenRef = useRef(transactionsRefreshToken);
  useEffect(() => {
    if (refreshTokenRef.current === transactionsRefreshToken) return;
    refreshTokenRef.current = transactionsRefreshToken;
    setInspected(null);
    setSelectedRows([]);
    setReload((value) => value + 1);
  }, [transactionsRefreshToken]);
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState(null);
  const [state, setState] = useState({ card: null, rows: [], total: null, page: 0, queryKey: "", loading: true, error: false, missing: false });
  const [nextPage, setNextPage] = useState(1);
  // O detalhe do desktop é um painel ao lado da tabela (não modal): sem armadilha de foco, só devolve o foco.
  useFocusTrap(detailDialogRef, Boolean(inspected) && isMobile);
  const inspectTriggerRef = useRef(null);
  const wasInspectedRef = useRef(false);
  useFocusTrap(filterDialogRef, filtersOpen && isMobile && !inspected);
  useFocusTrap(summaryDialogRef, summarySheetOpen && isMobile && !inspected && !filtersOpen);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!filtersOpen || isMobile) return undefined;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = ledgerRef.current?.getBoundingClientRect().top;
        if (top == null) return;
        const available = Math.max(180, Math.min(620, window.innerHeight - Math.max(0, top) - 16));
        setLedgerHeight((old) => Math.abs(old - available) < 2 ? old : available);
      });
    };
    // O resumo e o gráfico empurram a tabela para baixo: sem trazê-la para a vista o dock abriria cortado (180px) fora da dobra.
    const top = ledgerRef.current?.getBoundingClientRect().top;
    if (top != null && top > window.innerHeight * 0.4) ledgerRef.current.scrollIntoView?.({ block: "start", behavior: "smooth" });
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [filtersOpen, isMobile]);

  useEffect(() => {
    if (inspected) detailCloseRef.current?.focus();
    else if (filtersOpen && isMobile) {
      if (mobileFacetOpen) mobileFacetHeadingRef.current?.focus();
      else if (wasMobileFacetOpenRef.current) mobileFacetButtonRefs.current[activeFacet]?.focus();
      else filterCloseRef.current?.focus();
      wasMobileFacetOpenRef.current = mobileFacetOpen;
    }
    else if (summarySheetOpen && isMobile) summaryCloseRef.current?.focus();
    if (!filtersOpen) wasMobileFacetOpenRef.current = false;
  }, [inspected, filtersOpen, summarySheetOpen, isMobile, mobileFacetOpen, activeFacet]);

  useEffect(() => {
    if (!filtersOpen && !inspected && !summarySheetOpen) return undefined;
    const onEscape = (event) => {
      if (event.key !== "Escape") return;
      if (inspected) setInspected(null);
      else if (filtersOpen) setFiltersOpen(false);
      else setSummarySheetOpen(false);
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [filtersOpen, inspected, summarySheetOpen]);

  useEffect(() => {
    if (inspected) { wasInspectedRef.current = true; return; }
    if (wasInspectedRef.current && !isMobile) inspectTriggerRef.current?.focus?.();
    wasInspectedRef.current = false;
  }, [inspected, isMobile]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filter.search.trim()), 300);
    return () => clearTimeout(timer);
  }, [filter.search]);

  const categories = useMemo(() => (categoryCatalog.categories ?? []).map((row) => ({ id: String(row.id), label: row.labelPt, apiName: row.apiName, color: row.color })), [categoryCatalog.categories]);
  const categoriesById = useMemo(() => Object.fromEntries(categories.map((row) => [row.id, row])), [categories]);
  const categoryLabels = useMemo(() => new Map(categories.map((row) => [row.id, row.label])), [categories]);
  const tagOptions = useMemo(() => buildTagOptions(tagCatalog.rows, categoryLabels), [tagCatalog.rows, categoryLabels]);
  const tagIdByLabel = useMemo(() => tagOptionsToDisplayMap(tagOptions), [tagOptions]);
  const tagStatus = resolveTagFilterStatuses({ selectedLabels: filter.tags, loading: tagCatalog.loading, error: tagCatalog.error, displayToId: tagIdByLabel });
  const unresolvedCategory = filter.cats.length > 0 && (categoryCatalog.isLoading || categoryCatalog.error || filter.cats.some((id) => !categoriesById[id]?.apiName));
  const catalogBlocked = isTagFilterBlocked(tagStatus) || Boolean(unresolvedCategory);
  const bounds = resolvePeriodDisplayBounds(filter.period, filter.customFrom, filter.customTo);
  const invoiceMode = timeMode === "invoice" && cardScope === "current";
  const invoiceOpts = useMemo(() => {
    const ready = historyState.cardId === state.card?.id;
    const base = withCurrentInvoice(invoiceOptions(ready ? historyState.data : null), ready ? historyState.current : null);
    return withLedgerInvoices(base, ledgerInvoiceRows.cardId === state.card?.id ? ledgerInvoiceRows.rows : null);
  }, [historyState, state.card, ledgerInvoiceRows]);
  const scopeReady = historyState.cardId != null && historyState.cardId === state.card?.id;
  const selectedInvoiceIds = invoiceIdsForQuery(invoiceMode ? "invoice" : "period", invoiceOpts, invoiceKeys ?? []);
  const noInvoice = invoiceMode && scopeReady && selectedInvoiceIds.length === 0;
  const activeWeek = invoiceMode && week && selectedInvoiceIds.length === 1 && (invoiceKeys ?? []).join() === week.invoiceKey && week.scope === `${organizationId}:${cardId}` ? week : null;
  // A lista espera o catálogo, o histórico (que diz qual fatura abrir) e ao menos uma fatura marcada.
  const scopeWaiting = cardScope === "current" && !scopeReady;
  const filterBlocked = catalogBlocked || noInvoice || scopeWaiting;
  const sort = filter.sort[0] ?? { field: "date", dir: "desc" };
  const sortField = { val: "value", desc: "description", cat: "category" }[sort.field] ?? "date";
  const queryFilter = {
    ...(invoiceMode ? { invoice_id: selectedInvoiceIds } : {}),
    ...(!invoiceMode && bounds.from ? { date_start: bounds.from } : {}),
    ...(!invoiceMode && bounds.to ? { date_end: bounds.to } : {}),
    ...(activeWeek ? { date_start: activeWeek.from, date_end: activeWeek.to } : {}),
    ...(debouncedSearch ? { description: debouncedSearch } : {}),
    ...(parseMoneyInput(filter.valueMin) != null ? { value_min: parseMoneyInput(filter.valueMin) } : {}),
    ...(parseMoneyInput(filter.valueMax) != null ? { value_max: parseMoneyInput(filter.valueMax) } : {}),
    ...(filter.valueCurrency && (filter.valueMin || filter.valueMax) ? { value_currency: filter.valueCurrency } : {}),
    ...(kind === "refund" ? { type: "refund" } : filter.type === "despesa" ? { type: "expense" } : filter.type === "receita" ? { type: "income" } : {}),
    ...(kind === "one_off" || kind === "installment" ? { commitment_kind: kind } : kind === "recurring" ? { recurring: true } : {}),
    ...(filter.settlement === "pagas" ? { settled: true } : filter.settlement === "a-pagar" ? { settled: false } : {}),
    ...(filter.cats.length && !unresolvedCategory ? { category: filter.cats.map((id) => categoriesById[id]?.apiName) } : {}),
    ...(tagStatus.kind === "resolved" ? { tag_id: tagStatus.ids, tag_match: filter.tagMode } : {}),
    ...(cardScope === "all" ? { payment_method: "credit_card" } : {}),
    sort_by: sortField,
    sort_order: sort.dir === "asc" ? "asc" : "desc",
  };
  const aggregateFilter = Object.fromEntries(Object.entries(queryFilter).filter(([key]) => key !== "sort_by" && key !== "sort_order"));
  const filterKey = JSON.stringify({ queryFilter, cats: filter.cats, tags: filter.tags, blocked: filterBlocked, cardScope, reload });
  const groupedByDate = prefs.grouped && sortField === "date";
  const collapsible = groupedByDate && !filter.search.trim();
  // Dias recolhidos: guardados com a chave do recorte, então filtro, recarga ou trocar o agrupamento voltam tudo a expandido
  // já na mesma renderização (sem efeito, sem piscar).
  const collapseKey = `${filterKey}|${prefs.grouped}`;
  const [collapsedState, setCollapsedState] = useState({ key: collapseKey, days: new Set() });
  const collapsedDays = collapsedState.key === collapseKey ? collapsedState.days : EMPTY_DAYS;
  const setCollapsedDays = (days) => setCollapsedState({ key: collapseKey, days });
  const toggleDay = (key) => { const next = new Set(collapsedDays); if (!next.delete(key)) next.add(key); setCollapsedDays(next); };
  const dayControls = collapsible ? { onCollapseAll: () => setCollapsedDays(new Set(state.rows.map(dayKey))), onExpandAll: () => setCollapsedDays(new Set()) } : {};
  const summaryKey = `${state.card?.id ?? "none"}:${filterKey}`;
  const facets = filter.buildFacets({ categoriesById });
  const activeFacets = facets.filter((facet) => FACETS.includes(facet.key) && facet.active).filter((facet) => facet.key !== "cartao" && facet.key !== "periodo");
  if (cardScope === "all") activeFacets.push({ key: "cartao", label: "Cartão", value: "Todos os cartões" });
  const hasMore = state.total != null ? state.rows.length < state.total : state.rows.length > 0 && state.rows.length % PAGE_SIZE === 0;
  const setPreference = (patch) => setPrefs((before) => { const next = { ...before, ...patch }; writeListPrefs(next); return next; });

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    setState({ card: null, rows: [], total: null, page: 0, queryKey: filterKey, loading: true, error: false, missing: false });
    setHistoryState({ cardId: null, data: null, error: false });
    // O link da URL vale só para o cartão em que a tela abriu; trocar de organização/cartão volta ao padrão.
    const scope = `${organizationId}:${cardId}`;
    if (linkScopeRef.current === null) linkScopeRef.current = scope;
    setInvoiceKeys(linkScopeRef.current === scope && link.invoice ? [link.invoice] : null);
    setTimeMode("invoice");
    sharePending(pendingCards, organizationId, () => listCreditCards(organizationId)).then((cards) => {
      if (!active) return;
      const card = cards.find((entry) => entry.public_id === cardId);
      setState((current) => ({ ...current, card: card ?? null, missing: !card, loading: Boolean(card) }));
    }).catch(() => {
      if (active) setState((current) => ({ ...current, loading: false, error: true }));
    });
    return () => { active = false; };
  // Query filters should reset the list, not fetch the card catalog again.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, organizationId, cardId]);

  useEffect(() => {
    if (!state.card) return undefined;
    let active = true;
    // A fatura atual é opcional: se falhar, o histórico sozinho ainda monta o seletor.
    const current = getCurrentCreditCardInvoice(state.card.id, organizationId, { emptyAsNull: true }).catch(() => null);
    Promise.all([getInvoiceHistory(state.card.id, organizationId, INVOICE_WINDOW), current]).then(([data, currentInvoice]) => {
      if (active) setHistoryState({ cardId: state.card.id, data, current: currentInvoice, error: false });
    }).catch(() => {
      if (active) setHistoryState({ cardId: state.card.id, data: null, current: null, error: true });
    });
    return () => { active = false; };
  }, [state.card, organizationId, reload]);

  // Primeira abertura: a fatura aberta. Sem fatura selecionável (cartão novo, falha do
  // histórico), o recorte cai para Período livre em vez de deixar a tela vazia.
  useEffect(() => {
    if (!scopeReady || invoiceKeys !== null) return;
    const current = historyState.current;
    const keys = defaultInvoiceKeys(invoiceOpts, current?.month && /^\d{4}-\d{2}$/.test(current.month) ? current.month : null);
    setInvoiceKeys(keys);
    if (keys.length === 0) setTimeMode("period");
  }, [scopeReady, invoiceKeys, invoiceOpts, historyState.current]);
  // Link para uma fatura que o cartão não tem (ou sem id): cai na fatura padrão em vez de uma tela vazia.
  useEffect(() => {
    if (!scopeReady || !link.invoice || (invoiceKeys ?? []).join() !== link.invoice) return;
    if (invoiceOpts.some((option) => option.key === link.invoice && option.invoiceId != null)) return;
    const current = historyState.current;
    setInvoiceKeys(defaultInvoiceKeys(invoiceOpts, current?.month && /^\d{4}-\d{2}$/.test(current.month) ? current.month : null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeReady, invoiceOpts, link.invoice]);

  useEffect(() => {
    if (!state.card || filterBlocked) return undefined;
    let active = true;
    setSummaryState({ key: summaryKey, data: null, loading: true, error: false });
    getTransactionsSummary({
      organization_id: organizationId,
      ...(cardScope === "current" ? { credit_card_id: state.card.id } : {}),
      ...aggregateFilter,
      include_breakdown: true,
      locale: "pt-BR",
    }).then((data) => {
      if (active) { setSummaryState({ key: summaryKey, data, loading: false, error: false }); if (cardScope === "current") rememberInvoices(state.card.id, data); }
    }).catch(() => {
      if (active) setSummaryState({ key: summaryKey, data: null, loading: false, error: true });
    });
    return () => { active = false; };
  // summaryKey carries queryFilter and cardScope.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.card, organizationId, summaryKey, filterBlocked]);

  // Várias faturas: a escada tira o recorte de fatura. Uma semana marcada: tira o recorte de datas, para as outras semanas continuarem no gráfico.
  const needsLadder = invoiceMode && (selectedInvoiceIds.length >= 2 || Boolean(activeWeek));
  const ladderDrop = (selectedInvoiceIds?.length ?? 0) >= 2 ? ["invoice_id"] : ["date_start", "date_end"];
  const ladderFilter = Object.fromEntries(Object.entries(aggregateFilter).filter(([key]) => !ladderDrop.includes(key)));
  const ladderKey = `${state.card?.id ?? "none"}:${JSON.stringify(ladderFilter)}`;
  useEffect(() => {
    if (!state.card || filterBlocked || !needsLadder) return undefined;
    let active = true;
    setLadderState({ key: ladderKey, data: null, loading: true, error: false });
    getTransactionsSummary({ organization_id: organizationId, credit_card_id: state.card.id, ...ladderFilter, include_breakdown: true, locale: "pt-BR" }).then((data) => {
      if (active) { setLadderState({ key: ladderKey, data, loading: false, error: false }); rememberInvoices(state.card.id, data); }
    }).catch(() => {
      if (active) setLadderState({ key: ladderKey, data: null, loading: false, error: true });
    });
    return () => { active = false; };
  // ladderKey carries the filters that matter.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.card, organizationId, ladderKey, filterBlocked, needsLadder]);

  useEffect(() => {
    if (!state.card || filterBlocked || !filtersOpen) return undefined;
    let active = true;
    setFacetState({ key: summaryKey, data: null });
    getTransactionsFacets({
      organization_id: organizationId,
      ...(cardScope === "current" ? { credit_card_id: state.card.id } : {}),
      ...aggregateFilter,
      localize_labels: true,
      locale: "pt-BR",
    }).then((data) => {
      if (active) setFacetState({ key: summaryKey, data });
    }).catch(() => {
      if (active) setFacetState({ key: summaryKey, data: null });
    });
    return () => { active = false; };
  // summaryKey carries queryFilter and cardScope; closed dock needs no facets call.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.card, organizationId, summaryKey, filterBlocked, filtersOpen]);

  useEffect(() => {
    setSelectedRows([]);
    setInspected(null);
    setState((current) => current.queryKey === filterKey ? current : { ...current, rows: [], total: null, page: 0, queryKey: filterKey, loading: scopeWaiting || !filterBlocked, error: false });
    setNextPage(1);
  }, [filterKey, filterBlocked, scopeWaiting]);

  useEffect(() => {
    if (!state.card || filterBlocked || state.queryKey !== filterKey || nextPage <= state.page) return undefined;
    let active = true;
    const query = { organization_id: organizationId, ...(cardScope === "current" ? { credit_card_id: state.card.id } : {}), page: nextPage, limit: PAGE_SIZE, ...queryFilter };
    const key = `${organizationId}:${state.card.id}:${nextPage}:${filterKey}`;
    sharePending(pendingPages, key, () => listTransactions(query)).then((response) => {
      if (!active) return;
      setState((current) => ({ ...current, rows: nextPage === 1 ? response.data ?? [] : [...current.rows, ...(response.data ?? [])], total: response.pagination?.total ?? null, page: nextPage, loading: false, error: false }));
    }).catch(() => {
      if (active) setState((current) => ({ ...current, loading: false, error: true }));
    });
    return () => { active = false; };
  // filterKey carries the complete query; queryFilter is rebuilt each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, state.card, state.page, state.queryKey, nextPage, retry, filterKey, filterBlocked, cardScope]);

  const onMore = useCallback(() => {
    if (state.loading || state.error || !hasMore) return;
    setState((current) => ({ ...current, loading: true }));
    setNextPage((page) => page + 1);
  }, [state.loading, state.error, hasMore]);
  const dirtyRef = useRef(false);
  const selectedRowObjects = state.rows.filter((row) => selectedRows.includes(row.id));
  const rowsByIds = (ids) => state.rows.filter((row) => ids.includes(row.id));
  const insights = useMemo(() => assistantInsights(state.rows), [state.rows]);
  const closeDialog = () => { setDialog(null); if (dirtyRef.current) { dirtyRef.current = false; setReload((value) => value + 1); } };
  const finishAction = (message) => { dirtyRef.current = false; setDialog(null); setSelectedRows([]); setInspected(null); setNotice(message); setReload((value) => value + 1); };
  const outcome = (result, total, message) => {
    if (result.failed.length === 0) { finishAction(message); return null; }
    if (result.done.length > 0) dirtyRef.current = true;
    // Tentar de novo refaz só o que falhou: o que já passou não é reenviado.
    setDialog((current) => current && current.ids ? { ...current, ids: result.failed.map((row) => row.id) } : current);
    return `${result.failed.length} de ${total} não puderam ser alterados${result.done.length ? `; ${result.done.length} já foram` : ""}. Tente novamente.`;
  };
  const submitCategorize = async (categoryId) => {
    const rows = rowsByIds(dialog.ids).filter((row) => row.type !== "refund");
    return outcome(await categorizeRows({ rows, categoryId, organizationId }), rows.length, `${rows.length} lançamento${rows.length === 1 ? "" : "s"} recategorizado${rows.length === 1 ? "" : "s"}.`);
  };
  const submitMove = async ({ rows, year, month }) => outcome(await moveRows({ rows, cardId: state.card.id, organizationId, year, month }), rows.length, `${rows.length} parcela${rows.length === 1 ? "" : "s"} movida${rows.length === 1 ? "" : "s"} de fatura.`);
  const submitRefund = async ({ row, value, description, dateYmd, categoryId }) => {
    try {
      await createRefund({ row, cardId: state.card.id, organizationId, value, description, dateYmd, categoryId });
      finishAction("Estorno lançado e vinculado à compra.");
      return null;
    } catch {
      return "Não foi possível lançar o estorno. Tente novamente.";
    }
  };
  const exportRowsOf = async () => fetchAllRows({ base: { organization_id: organizationId, ...(cardScope === "current" ? { credit_card_id: state.card.id } : {}) }, filter: queryFilter, total: state.total ?? state.rows.length });
  const filterSummary = () => [chipLabel, ...(kind ? [`Tipo: ${KIND_LABELS[kind]}`] : []), ...(weekLabel ? [weekLabel] : []), ...(debouncedSearch ? [`Busca: ${debouncedSearch}`] : []), ...activeFacets.map((facet) => `${facet.label}: ${facet.value}`)];
  const submitExport = async (format) => {
    try {
      const all = await exportRowsOf();
      if (format === "csv") { downloadCsv(all, cardScope === "current" ? state.card.currency : null); return null; }
      printHtml(buildPrintHtml({
        title: `Lançamentos · ${cardScope === "all" ? "Todos os cartões" : cardLabel(state.card)}`,
        subtitle: `${all.length} lançamentos · ${filterSummary().join(" · ")}`,
        ...buildPdfParts(all, cardScope === "current" ? state.card.currency : null),
      }));
      return null;
    } catch {
      return "Não foi possível preparar a exportação. Tente novamente.";
    }
  };
  const openOriginal = async (id) => {
    try { setInspected(await getTransaction(id, organizationId)); } catch { setNotice("Não foi possível abrir o lançamento original."); }
  };
  const selectionSum = (() => { const sub = groupSubtotal(selectedRowObjects, cardScope === "current" ? state.card?.currency : null); return sub ? formatMoneyAbs(sub.amount, sub.currency) : null; })();
  // Sem gatilho de foco: o Painel assume o foco, a linha atrás dele não pode roubá-lo.
  const openTransaction = (row) => { inspectTriggerRef.current = null; setInspected(null); navigate({ search: (prev) => ({ ...prev, [FC.TX]: String(row.id), [FC.MODAL]: FC_MODAL.EDIT_TRANSACTION }) }); };
  const back = () => navigate({ to: "/cards", search: { [FC.VIEW]: "new", [FC.HUB_CARD]: cardId } });
  const closeFilters = () => setFiltersOpen(false);
  const openFacet = (key) => { if (key === "busca") { searchInputRef.current?.focus(); return; } setActiveFacet(key); setMobileFacetOpen(true); setFiltersOpen(true); };
  const card = state.card;
  const clearAll = () => { filter.clearAll(); setCardScope("current"); setKind(null); setWeek(null); };
  const clearFacet = (key) => key === "cartao" ? setCardScope("current") : filter.clearFacet(key);
  const currentSummary = summaryState.key === summaryKey ? summaryState.data : null;
  const currentSummaryLoading = summaryState.key !== summaryKey || summaryState.loading;
  const currentSummaryError = summaryState.key === summaryKey && summaryState.error;
  const currentFacets = facetState.key === summaryKey ? facetState.data : null;
  const facetCounts = {
    counts: currentFacets,
    total: currentFacets?.total ?? null,
    buckets: currentFacets?.value_bucket ?? null,
    optionCount: (facet, value) => {
      const rows = currentFacets?.[facet];
      if (!Array.isArray(rows)) return null;
      return rows.find((row) => row.value === String(value))?.count ?? 0;
    },
    optionCountByLabel: (facet, label) => {
      const rows = currentFacets?.[facet];
      if (!Array.isArray(rows)) return null;
      return rows.find((row) => row.label === label)?.count ?? 0;
    },
    binaryCount: (facet, key) => currentFacets?.[facet]?.[key] ?? null,
  };
  const chipLabel = scopeWaiting ? "Carregando faturas…" : invoiceMode
    ? invoiceChipLabel(invoiceOpts, invoiceKeys ?? [])
    : periodChipLabel({ period: filter.period, customFrom: filter.customFrom, customTo: filter.customTo, customLabel: formatCustomPeriodLabel(filter.customFrom, filter.customTo) });
  const temporalChip = { key: "periodo", label: "Recorte de tempo", value: chipLabel };
  const changeTimeMode = (mode) => {
    setTimeMode(mode);
    if (mode === "invoice" && !(invoiceKeys ?? []).length) setInvoiceKeys(defaultInvoiceKeys(invoiceOpts));
  };
  const toggleInvoice = (key) => setInvoiceKeys((keys) => { const current = keys ?? []; return current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]; });
  const timeScopePanel = <CardTimeScopePanel mode={invoiceMode ? "invoice" : "period"} onMode={changeTimeMode} options={invoiceOpts} selectedKeys={invoiceKeys ?? []} onToggle={toggleInvoice} currency={state.card?.currency} invoiceDisabled={cardScope !== "current"} />;
  const categoryIdByName = (name) => categories.find((row) => row.label === name || row.apiName === name)?.id ?? null;
  const isCategorySelected = (name) => { const id = categoryIdByName(name); return id == null ? null : filter.cats.includes(id); };
  const toggleCategory = (name) => { const id = categoryIdByName(name); if (id != null) filter.setCats(filter.cats.includes(id) ? filter.cats.filter((entry) => entry !== id) : [...filter.cats, id]); };
  // Clicar numa barra de fatura: no modo Fatura marca/desmarca; no modo Período vira "só esta fatura".
  const pickInvoice = (key) => {
    if (!invoiceMode) { setTimeMode("invoice"); setInvoiceKeys([key]); return; }
    toggleInvoice(key);
  };
  // Barra de semana: marca (ou desmarca, se já era a marcada) o recorte de datas dela dentro da fatura.
  const pickWeek = (bar) => setWeek(activeWeek?.from === bar.from ? null : { from: bar.from, to: bar.to, invoiceKey: (invoiceKeys ?? []).join(), scope: `${organizationId}:${cardId}` });
  const outflowsKind = invoiceMode && selectedInvoiceIds.length === 1 ? "weeks" : "invoices";
  const currentLadder = ladderState.key === ladderKey ? ladderState : null;
  const outflowsLoading = needsLadder ? !currentLadder || currentLadder.loading : currentSummaryLoading;
  const outflowsError = needsLadder ? Boolean(currentLadder?.error) : currentSummaryError;
  const outflowsMessage = cardScope === "all" ? "As saídas por fatura valem para um cartão. Volte para “este cartão”." : noInvoice ? "Marque ao menos uma fatura pra ver as saídas." : null;
  const outflows = buildOutflows({ mode: outflowsKind, summary: currentSummary, ladder: needsLadder ? currentLadder?.data : null, selectedKeys: invoiceMode ? invoiceKeys ?? [] : [], selectableKeys: new Set(invoiceOpts.filter((option) => option.invoiceId != null).map((option) => option.key)), selectedWeek: activeWeek?.from ?? null, currency: state.card?.currency });
  const removableChip = (testid, label, onRemove) => <button type="button" data-testid={testid} onClick={onRemove} aria-label={`Remover filtro: ${label}`} style={{ ...G, display: "inline-flex", alignItems: "center", gap: 4, border: `1px solid ${T.border}`, borderRadius: 8, background: T.blueLight, color: T.blue, padding: "8px 10px", fontSize: 11, cursor: "pointer" }}>{label} <X size={12} /></button>;
  const kindChip = kind ? removableChip("kind-chip", KIND_LABELS[kind], () => setKind(null)) : null;
  const weekLabel = activeWeek ? `Semana ${activeWeek.from.slice(8, 10)}/${activeWeek.from.slice(5, 7)}–${activeWeek.to.slice(8, 10)}/${activeWeek.to.slice(5, 7)}` : null;
  const weekChip = activeWeek ? removableChip("week-chip", weekLabel, () => setWeek(null)) : null;
  // Desfazer/refazer como em /transactions: cada mudança de filtro, de recorte ou de cartão é um passo.
  const searchRef = useRef(filter.search);
  searchRef.current = filter.search;
  const { search: _search, ...filterWithoutSearch } = filter.snapshot;
  const ledgerSnapshot = useMemo(() => ({ filter: filterWithoutSearch, kind, timeMode, invoiceKeys, cardScope, week }), [JSON.stringify(filterWithoutSearch), kind, timeMode, invoiceKeys, cardScope, week]);
  const applyLedgerSnapshot = useCallback((snap) => {
    // O texto digitado fica como está: a busca tem o próprio "limpar" e não entra nos passos.
    filter.applySnapshot({ ...snap.filter, search: searchRef.current });
    setKind(snap.kind); setTimeMode(snap.timeMode); setInvoiceKeys(snap.invoiceKeys); setCardScope(snap.cardScope); setWeek(snap.week);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.applySnapshot]);
  const describeLedger = useCallback((destino, atual, verbo) => describeLedgerChange(atual, destino, verbo, { categorias: categoriesById, kindLabels: KIND_LABELS }), [categoriesById]);
  const history = useFilterHistory(ledgerSnapshot, applyLedgerSnapshot, describeLedger);
  // A escolha inicial da fatura (e o link da URL) não é um passo do usuário: o histórico começa quando a tela fica pronta.
  const linkInvoiceUnknown = Boolean(link.invoice) && (invoiceKeys ?? []).join() === link.invoice && !invoiceOpts.some((option) => option.key === link.invoice && option.invoiceId != null);
  const historyReady = scopeReady && invoiceKeys !== null && !linkInvoiceUnknown;
  const resetHistory = history.reset;
  useEffect(() => { resetHistory(); }, [historyReady, cardId, organizationId, resetHistory]);
  const historyButtons = (history.canUndo || history.canRedo) ? <span data-testid="ledger-history" style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
    <HistoryButton dir="undo" enabled={history.canUndo} onClick={history.undo} label={history.undoLabel} />
    <HistoryButton dir="redo" enabled={history.canRedo} onClick={history.redo} label={history.redoLabel} />
  </span> : null;
  const filterChips = <><TransactionsFilterChips facets={activeFacets} searchActive={Boolean(debouncedSearch)} searchLabel={debouncedSearch} onOpenFacet={openFacet} onAbrirAtivos={() => openFacet("ativos")} onClearFacet={clearFacet} onClearAll={clearAll} maxVisible={viewportWidth >= 1600 ? 3 : viewportWidth >= 1366 ? 2 : 1} chipsBudget={chipsBudget} collapsed={viewportWidth < 1200} filtersOpen={filtersOpen} onToggleFilters={() => setFiltersOpen((open) => !open)} pinnedChip={temporalChip} />{kindChip}{weekChip}</>;
  // A tabela do extrato tem colunas demais para ceder espaço: o dock só empurra a partir de 1600px.
  const dockFloating = !isMobile && viewportWidth < 1600;
  const openAssistant = () => setDialog({ kind: "assistant" });
  const assistantButton = <Btn variant="outGray" onClick={openAssistant}><Sparkles size={14} /> Assistente{insights.alertCount > 0 && <span aria-label={`${insights.alertCount} alertas`} style={{ ...NUM, marginLeft: 4, background: T.amber, color: "#fff", borderRadius: 99, padding: "0 6px", fontSize: 10 }}>{insights.alertCount}</span>}</Btn>;
  const alerts = insights.items.filter((item) => item.kind !== "insight");
  const alertsLabel = `${alerts.length} ${alerts.length === 1 ? "alerta" : "alertas"}`;
  const dupGroups = alerts.filter((item) => item.kind === "duplicate").length;
  const otherAlerts = alerts.filter((item) => item.kind !== "duplicate");
  const alertSummary = alerts.length === 1 ? `${alerts[0].title}: ${alerts[0].detail}` : [...(dupGroups ? [`${dupGroups} ${dupGroups === 1 ? "possível duplicata" : "possíveis duplicatas"}`] : []), ...otherAlerts.map((item) => item.title)].join(" · ");
  const cardScopePanel = <CardScopePanel card={card} scope={cardScope} onScope={(value) => { setCardScope(value); setSummarySheetOpen(false); }} />;

  const searchTerm = filter.search.trim();
  const searchEmpty = isMobile && Boolean(searchTerm) && debouncedSearch === searchTerm && !state.loading && !state.error && !noInvoice && !catalogBlocked && state.rows.length === 0;
  const clearSearch = () => { filter.setSearch(""); closeSearch(); };
  const chipPill = { borderRadius: 99, padding: "0 12px", height: 30, boxSizing: "border-box", display: "inline-flex", alignItems: "center", whiteSpace: "nowrap", flex: "none" };
  return <div style={isMobile ? { height: "100%", minHeight: 0, display: "flex", flexDirection: "column", minWidth: 0 } : { padding: 28, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
    {isMobile && <LedgerAppBar subtitle={card ? (cardScope === "all" ? "Todos os cartões" : cardLabel(card)) : null} onBack={back} hasCard={Boolean(card)} searchOpen={searchOpen} onSearchOpen={openSearch} onSearchClose={closeSearch} search={filter.search} onSearchChange={filter.setSearch} facetCount={activeFacets.length} filtersOpen={filtersOpen} onFilters={() => { setMobileFacetOpen(false); setFiltersOpen((open) => !open); }} alertCount={alerts.length} onAssistant={openAssistant} onExport={() => setDialog({ kind: "export" })} exportDisabled={!state.total} />}
    {isMobile && card && alerts.length > 0 && <LedgerAlertStrip label={alertsLabel} summary={alertSummary} onOpen={openAssistant} />}
    {!isMobile && <button type="button" onClick={back} style={{ ...G, alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 5, border: 0, background: "none", color: T.blue, fontSize: 12, fontWeight: 700, cursor: "pointer" }}><ArrowLeft size={14} /> Voltar para o cartão</button>}
    {!isMobile && <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div><PageTitle sans="Lançamentos do" serif="cartão" />{card && <p style={{ ...G, ...NUM, margin: "5px 0 0", color: T.inkMid, fontSize: 12 }}>{cardScope === "all" ? "Todos os cartões" : cardLabel(card)}</p>}</div>
      {card && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Btn variant="outGray" disabled={!state.total} onClick={() => setDialog({ kind: "export" })}><Download size={14} /> Exportar</Btn>
        {!isMobile && assistantButton}
      </div>}
    </header>}
    {!enabled && <Card role="status" style={{ padding: 18 }}>Selecione uma organização para ver os lançamentos.</Card>}
    {state.missing && <Card role="status" style={{ padding: 18 }}>Cartão não encontrado ou sem acesso.</Card>}
    {state.error && !card && <Card role="alert" style={{ padding: 18 }}>Não foi possível carregar o cartão.</Card>}
    {card && <>
      {cardScope === "current" && !isMobile && <div style={{ display: "grid", gridTemplateColumns: "minmax(300px,3fr) minmax(0,7fr)", gap: 12, minWidth: 0 }}>
        <CardTransactionsSummary summary={currentSummary} loading={currentSummaryLoading} error={currentSummaryError} isCategorySelected={isCategorySelected} onToggleCategory={toggleCategory} />
        <CardOutflowsChart outflows={outflows} currency={card.currency} loading={outflowsLoading} error={outflowsError} message={outflowsMessage} onPickInvoice={pickInvoice} onPickWeek={pickWeek} />
      </div>}
      {isMobile && <LedgerSummaryRow summary={currentSummary} loading={currentSummaryLoading} error={currentSummaryError} onOpen={() => setSummarySheetOpen(true)} />}
      {cardScope === "all" && !isMobile && <CardTransactionsSummary summary={currentSummary} loading={currentSummaryLoading} error={currentSummaryError} isCategorySelected={isCategorySelected} onToggleCategory={toggleCategory} />}
      {!isMobile && <TransactionsFilterBar filter={filter} hideSavedViews hideFacets searchInput={filter.search} setSearchInput={filter.setSearch} searchPlaceholder="Buscar por descrição…" searchInputRef={searchInputRef} barChips={filterChips} onChipsBudget={setChipsBudget} barTrailing={<>{historyButtons}<TransactionsListDisplayControls
        density={prefs.density} grouped={groupedByDate} canGroup={sortField === "date"} {...dayControls}
        onDensityChange={(density) => setPreference({ density })}
        onGroupChange={() => setPreference({ grouped: !prefs.grouped })} /></>} />}
      {isMobile && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", flex: "none" }}>
        <div className="fincla-scroll" style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, overflowX: "auto", scrollbarWidth: "none" }}>
          {filter.search && <span style={{ ...chipPill, background: T.ink, color: T.surface, padding: 0, overflow: "hidden" }}>
            <button type="button" onClick={openSearch} aria-label={`Busca: ${filter.search}. Editar.`} style={{ ...G, border: 0, background: "none", color: T.surface, padding: "0 4px 0 12px", height: "100%", fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><Search size={14} aria-hidden="true" />“{filter.search}”</button>
            <button type="button" aria-label="Remover busca" onClick={clearSearch} style={{ ...G, border: 0, background: "none", color: T.surface, padding: "0 12px 0 4px", height: "100%", cursor: "pointer" }}>×</button>
          </span>}
          <button type="button" data-pinned-chip="periodo" onClick={() => openFacet("periodo")} aria-label={`Recorte de tempo: ${chipLabel}. Ajustar.`} style={{ ...G, ...chipPill, border: `1px solid ${T.border}`, background: T.blueLight, color: T.blue, fontSize: 12, cursor: "pointer" }}>{chipLabel}</button>
          {activeFacets.map((facet) => <div key={facet.key} style={{ ...chipPill, padding: 0, border: `1px solid ${T.border}`, background: T.blueLight, overflow: "hidden" }}>
            <button type="button" onClick={() => openFacet(facet.key)} style={{ ...G, border: 0, background: "none", color: T.blue, padding: "0 4px 0 12px", height: "100%", fontSize: 12, cursor: "pointer" }}>{facet.label}: {facet.value}</button>
            <button type="button" aria-label={`Limpar filtro ${facet.label}`} onClick={() => clearFacet(facet.key)} style={{ ...G, border: 0, background: "none", color: T.blue, padding: "0 12px 0 4px", height: "100%", cursor: "pointer" }}>×</button>
          </div>)}
          {kindChip}{weekChip}
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", flex: "none" }}>{historyButtons}<TransactionsListDisplayControls
          density={prefs.density} grouped={groupedByDate} canGroup={sortField === "date"} {...dayControls}
          onDensityChange={(density) => setPreference({ density })}
          onGroupChange={() => setPreference({ grouped: !prefs.grouped })} /></span>
      </div>}
      {noInvoice && <Card role="status" style={{ padding: 12, color: T.inkMid }}>Marque ao menos uma fatura para ver os lançamentos.</Card>}
      {catalogBlocked && <Card role="status" style={{ padding: 12, color: T.amber }}>{isTagFilterBlocked(tagStatus) ? tagFilterStatusMessage(tagStatus) : "Aguardando o catálogo de categorias para aplicar o filtro."}</Card>}
      <div ref={ledgerRef} style={{ display: "flex", alignItems: "stretch", minWidth: 0, position: "relative", gap: filtersOpen && !dockFloating ? 12 : 0, ...(isMobile ? { flex: 1, minHeight: 0 } : {}) }}>
        <div style={{ flex: 1, minWidth: 0, ...(isMobile ? { minHeight: 0, display: "flex", flexDirection: "column" } : {}) }}>
        {searchEmpty ? <LedgerSearchEmpty query={searchTerm} onClear={clearSearch} /> : 
        <CardTransactionsTable rows={state.rows} total={state.total} cardCurrency={cardScope === "current" ? card.currency : null} loading={state.loading} error={state.error} hasMore={hasMore} onMore={onMore} selected={selectedRows} onSelected={setSelectedRows} selectionSum={selectionSum} onCategorize={() => setDialog({ kind: "categorize", ids: selectedRows })} onMoveInstallment={cardScope === "current" ? () => setDialog({ kind: "move", ids: selectedRows }) : undefined} onExportSelected={() => downloadCsv(selectedRowObjects, cardScope === "current" ? card.currency : null)} inspected={inspected} onInspect={(row) => { inspectTriggerRef.current = document.activeElement; setInspected(row); }} grouped={groupedByDate} collapsible={collapsible} collapsedKeys={collapsedDays} onToggleGroup={toggleDay} density={prefs.density} isMobile={isMobile} maxHeight={filtersOpen && !isMobile ? ledgerHeight : undefined} />}
        </div>
        {inspected && !isMobile && <div ref={detailDialogRef} role="dialog" aria-modal="false" aria-label="Detalhes do lançamento" style={{ flex: "none", width: 360, minWidth: 0, marginLeft: 12 }}><Card style={{ height: "100%", padding: 20, overflowY: "auto", boxSizing: "border-box" }}><LedgerDetail row={inspected} currency={cardScope === "current" ? card?.currency : null} closeRef={detailCloseRef} onClose={() => setInspected(null)} onOpen={openTransaction} onMove={cardScope === "current" ? (row) => setDialog({ kind: "move", ids: [row.id] }) : undefined} onRefund={cardScope === "current" ? (row) => setDialog({ kind: "refund", row }) : undefined} onOpenOriginal={openOriginal} /></Card></div>}
        {filtersOpen && !isMobile && !inspected && <div style={{ ...(dockFloating ? { position: "absolute", top: 0, right: 0, zIndex: 5, boxShadow: "-8px 0 24px rgba(15,15,13,.1)" } : { flex: "none" }), width: dockFloating ? Math.min(480, Math.max(400, viewportWidth * .4)) : Math.min(420, Math.max(320, viewportWidth * .28)), maxWidth: "100%", height: ledgerHeight, minWidth: 0 }}><TransactionsFilterPanel filter={filter} facet={activeFacet} onFacetChange={setActiveFacet} categories={categories} allTags={tagOptions.map((tag) => tag.displayLabel)} allTagsLoading={tagCatalog.loading} allTagsError={Boolean(tagCatalog.error)} tagIdByLabel={tagIdByLabel} facetCounts={facetCounts} activeFacets={activeFacets} onClearFacet={clearFacet} onClearAll={clearAll} onApply={closeFilters} onClose={closeFilters} resultCount={state.total ?? 0} resultsLoading={state.loading} visibleFacetKeys={FACETS} defaultPeriod="tudo" cardScopePanel={cardScopePanel} periodScopePanel={timeScopePanel} hidePeriodContent={invoiceMode} selectionOverrides={{ cartao: cardScope === "all" ? 1 : 0, ...(invoiceMode ? { periodo: 0 } : {}) }} /></div>}
      </div>
      {state.error && <Card role="alert" style={{ display: "flex", alignItems: "center", gap: 12, padding: 14 }}>Não foi possível carregar os lançamentos. <Btn variant="outGray" onClick={() => { setState((current) => ({ ...current, loading: true, error: false })); setRetry((value) => value + 1); }}>Tentar novamente</Btn></Card>}
    </>}
    {inspected && isMobile && <div ref={detailDialogRef} role="dialog" aria-modal="true" aria-label="Detalhes do lançamento" style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,15,13,.35)", display: "flex", justifyContent: "flex-end", alignItems: "flex-end" }} onClick={() => setInspected(null)}>
      <Card style={{ width: "100%", maxHeight: "80dvh", borderRadius: "18px 18px 0 0", padding: 20, overflowY: "auto" }} onClick={(event) => event.stopPropagation()}>
        <LedgerDetail row={inspected} currency={cardScope === "current" ? card?.currency : null} closeRef={detailCloseRef} onClose={() => setInspected(null)} onOpen={openTransaction} onMove={cardScope === "current" ? (row) => setDialog({ kind: "move", ids: [row.id] }) : undefined} onRefund={cardScope === "current" ? (row) => setDialog({ kind: "refund", row }) : undefined} onOpenOriginal={openOriginal} />
      </Card>
    </div>}
    {dialog?.kind === "categorize" && <CategorizeDialog rows={rowsByIds(dialog.ids)} categories={categories} onSubmit={submitCategorize} onClose={closeDialog} />}
    {dialog?.kind === "move" && <MoveInstallmentDialog rows={rowsByIds(dialog.ids).length ? rowsByIds(dialog.ids) : inspected ? [inspected] : []} invoiceOptions={invoiceOpts} currentKey={historyState.current?.month ?? null} onSubmit={submitMove} onClose={closeDialog} />}
    {dialog?.kind === "refund" && <RefundDialog row={dialog.row} categories={(refundCatalog.categories ?? []).map((entry) => ({ id: String(entry.id), label: entry.labelPt }))} currency={cardScope === "current" ? card?.currency : null} today={todayLocalYmd()} onSubmit={submitRefund} onClose={closeDialog} />}
    {dialog?.kind === "export" && <ExportDialog total={state.total} filterSummary={filterSummary()} onExport={submitExport} onClose={closeDialog} />}
    {dialog?.kind === "assistant" && <AssistantDrawer insights={insights.items} loadedCount={state.rows.length} onClose={closeDialog} isMobile={isMobile} onSelect={(ids) => { setSelectedRows(ids); setDialog(null); }} onCategorize={(ids) => { setSelectedRows(ids); setDialog({ kind: "categorize", ids }); }} />}
    {notice && <div role="status" style={{ ...G, position: "fixed", left: "50%", bottom: "calc(20px + env(safe-area-inset-bottom, 0px))", transform: "translateX(-50%)", zIndex: 70, background: T.ink, color: "#fff", borderRadius: 10, padding: "10px 14px", fontSize: 12, display: "flex", gap: 12, alignItems: "center" }}>{notice}<button type="button" aria-label="Fechar aviso" onClick={() => setNotice(null)} style={{ border: 0, background: "none", color: T.surface, cursor: "pointer" }}>×</button></div>}
    {summarySheetOpen && isMobile && <div ref={summaryDialogRef} role="dialog" aria-modal="true" aria-label="Resumo e saídas do recorte" style={{ position: "fixed", inset: 0, zIndex: 48, background: "rgba(15,15,13,.35)", display: "flex", alignItems: "flex-end" }} onClick={() => setSummarySheetOpen(false)}>
      <div className="fincla-scroll" style={{ background: T.bg, borderRadius: "18px 18px 0 0", maxHeight: "85dvh", width: "100%", padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }} onClick={(event) => event.stopPropagation()}>
        <button ref={summaryCloseRef} type="button" aria-label="Fechar resumo" onClick={() => setSummarySheetOpen(false)} style={{ alignSelf: "flex-end", border: 0, background: "none", cursor: "pointer" }}><X size={18} /></button>
        <CardTransactionsSummary summary={currentSummary} loading={currentSummaryLoading} error={currentSummaryError} isCategorySelected={isCategorySelected} onToggleCategory={toggleCategory} isMobile />
        {cardScope === "current" && <CardOutflowsChart outflows={outflows} currency={card?.currency} loading={outflowsLoading} error={outflowsError} message={outflowsMessage} onPickInvoice={pickInvoice} onPickWeek={pickWeek} isMobile />}
      </div>
    </div>}
    {filtersOpen && isMobile && <div ref={filterDialogRef} role="dialog" aria-modal="true" aria-label="Filtros dos lançamentos" style={{ position: "fixed", inset: 0, zIndex: 49, background: "rgba(15,15,13,.35)", display: "flex", alignItems: "flex-end" }} onClick={closeFilters}>
      <div style={{ background: T.surface, borderRadius: "18px 18px 0 0", height: "min(100dvh, 760px)", width: "100%", padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 12 }} onClick={(event) => event.stopPropagation()}>
        <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 99, background: T.border, margin: "11px auto 2px" }} />
        <div style={{ ...G, display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700 }}>
          <button type="button" onClick={() => setMobileFacetOpen(false)} style={{ ...G, border: 0, background: "none", color: T.blue, cursor: "pointer" }}>{mobileFacetOpen ? "← Voltar" : "Filtros"}</button>
          <button ref={filterCloseRef} type="button" aria-label="Fechar filtros" onClick={closeFilters} style={{ border: 0, background: "none", cursor: "pointer" }}><X size={18} /></button>
        </div>
        {!mobileFacetOpen && <div className="fincla-scroll" style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", alignContent: "start", gap: 10, overflowY: "auto", flex: 1 }}>
          <label style={{ ...G, gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 11, color: T.inkMid, fontWeight: 700 }}>ORDENAR POR <Select aria-label="Ordenar lançamentos" value={`${sort.field}:${sort.dir}`} onChange={(event) => { const [field, dir] = event.target.value.split(":"); filter.setSort([{ field, dir }]); }}><option value="date:desc">Data ↓</option><option value="date:asc">Data ↑</option><option value="val:desc">Maior valor</option><option value="val:asc">Menor valor</option><option value="desc:asc">Descrição A–Z</option></Select></label>
          {FACETS.map((key) => <button ref={(node) => { mobileFacetButtonRefs.current[key] = node; }} key={key} type="button" onClick={() => { setActiveFacet(key); setMobileFacetOpen(true); }} style={{ ...G, minHeight: 64, border: `1px solid ${T.border}`, borderRadius: 10, background: activeFacets.some((facet) => facet.key === key) ? T.blueLight : T.surface, color: T.ink, textAlign: "left", padding: 12, fontWeight: 700 }}>{FACET_LABELS[key]} {activeFacets.some((facet) => facet.key === key) ? "●" : ""}</button>)}
          <button type="button" onClick={clearAll} style={{ ...G, gridColumn: "1 / -1", border: 0, background: "none", color: T.red, padding: 12 }}>Limpar tudo</button>
        </div>}
        {mobileFacetOpen && <div style={{ minHeight: 0, flex: 1, display: "flex", flexDirection: "column" }}><h2 ref={mobileFacetHeadingRef} tabIndex={-1} style={{ ...G, fontSize: 14, margin: "0 0 8px", color: T.ink }}>{FACET_LABELS[activeFacet] || "Filtros ativos"}</h2><div style={{ minHeight: 0, flex: 1 }}><TransactionsFilterPanel filter={filter} facet={activeFacet} onFacetChange={setActiveFacet} categories={categories} allTags={tagOptions.map((tag) => tag.displayLabel)} allTagsLoading={tagCatalog.loading} allTagsError={Boolean(tagCatalog.error)} tagIdByLabel={tagIdByLabel} facetCounts={facetCounts} activeFacets={activeFacets} onClearFacet={clearFacet} onClearAll={clearAll} onApply={closeFilters} onClose={() => setMobileFacetOpen(false)} resultCount={state.total ?? 0} resultsLoading={state.loading} compact hideRail visibleFacetKeys={FACETS} defaultPeriod="tudo" cardScopePanel={cardScopePanel} periodScopePanel={timeScopePanel} hidePeriodContent={invoiceMode} selectionOverrides={{ cartao: cardScope === "all" ? 1 : 0, ...(invoiceMode ? { periodo: 0 } : {}) }} /></div></div>}
        {!mobileFacetOpen && <Btn variant="dark" onClick={closeFilters} style={{ width: "100%", flex: "none" }}>Ver {state.total ?? "—"} lançamentos</Btn>}
      </div>
    </div>}
  </div>;
}

function CardScopePanel({ card, scope, onScope }) {
  return <div style={{ ...G, display: "flex", flexDirection: "column", gap: 12 }}>
    <h3 style={{ ...G, margin: 0, fontSize: 14 }}>Cartão</h3>
    <p style={{ ...G, margin: 0, color: T.inkMid, fontSize: 11 }}>Escolha quais cartões entram na lista de lançamentos.</p>
    {[["current", card ? cardLabel(card) : "Este cartão"], ["all", "Todos os cartões"]].map(([value, label]) => <button key={value} type="button" aria-pressed={scope === value} onClick={() => onScope(value)} style={{ ...G, minHeight: 44, textAlign: "left", border: `1.5px solid ${scope === value ? T.blue : T.border}`, borderRadius: 10, background: scope === value ? T.blueLight : T.surface, color: T.ink, padding: "10px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>{label}</button>)}
  </div>;
}
