import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { listCreditCards } from "../../api/creditCards";
import { listTransactions } from "../../api/transactions";
import { Btn, Card, PageTitle } from "../components/primitives.jsx";
import { shouldUseRealData } from "../dataMode.js";
import { RecentCardTransactions } from "../features/cardHub/RecentCardTransactions.jsx";
import { DENSITIES, readListPrefs, writeListPrefs } from "../features/transactions/listPrefs.js";
import { TransactionsFilterBar } from "../features/transactions/filters/TransactionsFilterBar.jsx";
import { useTransactionsFilterState } from "../features/transactions/filters/useTransactionsFilterState.js";
import { resolvePeriodDisplayBounds } from "../features/transactions/periodDateBounds.js";
import { parseMoneyInput } from "../features/onboarding/onboardingValueUtils.js";
import { FC } from "../routing/searchContract.js";
import { G, NUM } from "../typography.js";
import { T } from "../tokens.js";

const PAGE_SIZE = 30;
const pendingCards = new Map();
const pendingPages = new Map();

function sharePending(map, key, request) {
  if (!map.has(key)) map.set(key, request().finally(() => map.delete(key)));
  return map.get(key);
}

export function CardAllTransactionsPage({ organizationId = null, dataMode = "live", isMobile = false }) {
  const { cardId } = useParams({ strict: false });
  const navigate = useNavigate();
  const enabled = shouldUseRealData(organizationId, dataMode);
  const filter = useTransactionsFilterState({ initial: { period: "tudo" }, clearToInitial: true });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filter.search.trim()), 300);
    return () => clearTimeout(timer);
  }, [filter.search]);
  const [prefs, setPrefs] = useState(readListPrefs);
  const bounds = resolvePeriodDisplayBounds(filter.period, filter.customFrom, filter.customTo);
  const sort = filter.sort[0] ?? { field: "date", dir: "desc" };
  const sortField = { val: "value", desc: "description", cat: "category" }[sort.field] ?? "date";
  const queryFilter = {
    ...(bounds.from ? { date_start: bounds.from } : {}),
    ...(bounds.to ? { date_end: bounds.to } : {}),
    ...(debouncedSearch ? { description: debouncedSearch } : {}),
    ...(parseMoneyInput(filter.valueMin) != null ? { value_min: parseMoneyInput(filter.valueMin) } : {}),
    ...(parseMoneyInput(filter.valueMax) != null ? { value_max: parseMoneyInput(filter.valueMax) } : {}),
    ...(filter.valueCurrency && (filter.valueMin || filter.valueMax) ? { value_currency: filter.valueCurrency } : {}),
    sort_by: sortField,
    sort_order: sort.dir === "asc" ? "asc" : "desc",
  };
  const filterKey = JSON.stringify(queryFilter);
  const [state, setState] = useState({ card: null, rows: [], total: null, page: 0, queryKey: filterKey, loading: true, error: false, missing: false });
  const [nextPage, setNextPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const setPreference = (patch) => setPrefs((before) => { const next = { ...before, ...patch }; writeListPrefs(next); return next; });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState({ card: null, rows: [], total: null, page: 0, queryKey: filterKey, loading: true, error: false, missing: false });
    setNextPage(1);
    sharePending(pendingCards, organizationId, () => listCreditCards(organizationId)).then((cards) => {
      if (!active) return;
      const card = cards.find((entry) => entry.public_id === cardId);
      setState((current) => ({ ...current, card: card ?? null, missing: !card, loading: Boolean(card) }));
    }).catch(() => {
      if (active) setState((current) => ({ ...current, loading: false, error: true }));
    });
    return () => { active = false; };
  }, [enabled, organizationId, cardId]);

  useEffect(() => {
    setState((current) => current.queryKey === filterKey ? current : { ...current, rows: [], total: null, page: 0, queryKey: filterKey, loading: true, error: false });
    setNextPage(1);
  }, [filterKey]);

  useEffect(() => {
    if (!state.card || state.queryKey !== filterKey || nextPage <= state.page) return;
    let active = true;
    const query = {
      organization_id: organizationId,
      credit_card_id: state.card.id,
      page: nextPage,
      limit: PAGE_SIZE,
      ...queryFilter,
    };
    const key = `${organizationId}:${state.card.id}:${nextPage}:${filterKey}`;
    sharePending(pendingPages, key, () => listTransactions(query)).then((response) => {
      if (!active) return;
      setState((current) => ({
        ...current,
        rows: nextPage === 1 ? response.data ?? [] : [...current.rows, ...(response.data ?? [])],
        total: response.pagination?.total ?? null,
        page: nextPage,
        loading: false,
        error: false,
      }));
    }).catch(() => {
      if (active) setState((current) => ({ ...current, loading: false, error: true }));
    });
    return () => { active = false; };
  }, [organizationId, state.card, state.page, state.queryKey, nextPage, retry, filterKey]);

  const back = () => navigate({ to: "/cards", search: { [FC.VIEW]: "new", [FC.HUB_CARD]: cardId } });
  const hasMore = state.total != null ? state.rows.length < state.total : state.rows.length > 0 && state.rows.length % PAGE_SIZE === 0;
  return (
    <div style={{ padding: isMobile ? 16 : 28, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <button type="button" onClick={back} style={{ ...G, alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 5, border: 0, background: "none", color: T.blue, fontSize: 12, fontWeight: 700, cursor: "pointer" }}><ArrowLeft size={14} /> Voltar para o cartão</button>
      <div>
        <PageTitle sans="Lançamentos do" serif="cartão" />
        {state.card && <p style={{ ...G, ...NUM, margin: "5px 0 0", color: T.inkMid, fontSize: 12 }}>{state.card.description || state.card.brand} •{state.card.last4}</p>}
      </div>
      {!enabled && <Card role="status">Selecione uma organização para ver os lançamentos.</Card>}
      {state.missing && <Card role="status">Cartão não encontrado ou sem acesso.</Card>}
      {state.card && <Card style={{ display: "flex", flexDirection: "column", gap: 12, padding: 18 }}>
        <label style={{ ...G, display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: T.inkMid }}>Buscar descrição
          <input aria-label="Buscar descrição" value={filter.search} onChange={(event) => filter.setSearch(event.target.value)} style={{ ...G, minHeight: 38, border: `1px solid ${T.border}`, borderRadius: 9, padding: "7px 10px" }} />
        </label>
        <TransactionsFilterBar filter={filter} hideSearch visibleFacetKeys={["periodo", "valor"]} visibleSortFields={["date", "val", "desc", "cat"]}
          compact={isMobile} filteredCount={state.total ?? 0} resultsLoading={state.loading}
          filterToolbarActive={Boolean(filter.search || filter.period !== "tudo" || filter.valueMin || filter.valueMax)} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <label style={{ ...G, fontSize: 11, color: T.inkMid }}>Densidade <select aria-label="Densidade da lista" value={prefs.density} onChange={(event) => setPreference({ density: event.target.value })}>{Object.entries(DENSITIES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
          <label style={{ ...G, fontSize: 11, color: T.inkMid }}><input type="checkbox" checked={prefs.grouped && sortField === "date"} disabled={sortField !== "date"} onChange={(event) => setPreference({ grouped: event.target.checked })} /> Agrupar por data</label>
        </div>
      </Card>}
      {state.card && <RecentCardTransactions transactions={state.rows} cardCurrency={state.card.currency} loading={state.loading && state.page === 0} error={state.error && state.page === 0} title="Lançamentos do cartão" grouped={prefs.grouped && sortField === "date"} density={prefs.density} />}
      {state.error && state.card && <Card role="alert" style={{ display: "flex", alignItems: "center", gap: 12 }}>Não foi possível carregar os lançamentos. <Btn variant="outGray" onClick={() => { setState((current) => ({ ...current, loading: true, error: false })); setRetry((value) => value + 1); }}>Tentar novamente</Btn></Card>}
      {state.error && !state.card && <Card role="alert">Não foi possível carregar o cartão.</Card>}
      {state.card && hasMore && !state.error && (
        <Btn variant="outGray" disabled={state.loading} style={{ alignSelf: "center" }} onClick={() => { setState((current) => ({ ...current, loading: true })); setNextPage((page) => page + 1); }}>
          {state.loading ? "Carregando…" : "Carregar mais lançamentos"}
        </Btn>
      )}
    </div>
  );
}
