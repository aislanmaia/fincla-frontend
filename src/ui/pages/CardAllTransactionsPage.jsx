import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { listCreditCards } from "../../api/creditCards";
import { listTransactions } from "../../api/transactions";
import { Card, PageTitle } from "../components/primitives.jsx";
import { shouldUseRealData } from "../dataMode.js";
import { RecentCardTransactions } from "../features/cardHub/RecentCardTransactions.jsx";
import { FC } from "../routing/searchContract.js";
import { G } from "../typography.js";
import { T } from "../tokens.js";

const PAGE_SIZE = 30;

export function CardAllTransactionsPage({ organizationId = null, dataMode = "live", isMobile = false }) {
  const { cardId } = useParams({ strict: false });
  const navigate = useNavigate();
  const enabled = shouldUseRealData(organizationId, dataMode);
  const [state, setState] = useState({ card: null, rows: [], total: null, page: 0, loading: true, error: false, missing: false });
  const [nextPage, setNextPage] = useState(1);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState({ card: null, rows: [], total: null, page: 0, loading: true, error: false, missing: false });
    setNextPage(1);
    listCreditCards(organizationId).then((cards) => {
      if (!active) return;
      const card = cards.find((entry) => entry.public_id === cardId);
      setState((current) => ({ ...current, card: card ?? null, missing: !card, loading: Boolean(card) }));
    }).catch(() => {
      if (active) setState((current) => ({ ...current, loading: false, error: true }));
    });
    return () => { active = false; };
  }, [enabled, organizationId, cardId]);

  useEffect(() => {
    if (!state.card || nextPage <= state.page) return;
    let active = true;
    const today = new Date();
    const dateEnd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    listTransactions({
      organization_id: organizationId,
      credit_card_id: state.card.id,
      page: nextPage,
      limit: PAGE_SIZE,
      date_end: dateEnd,
      sort_by: "date",
      sort_order: "desc",
    }).then((response) => {
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
  }, [organizationId, state.card, state.page, nextPage, retry]);

  const back = () => navigate({ to: "/cards", search: { [FC.VIEW]: "new", [FC.HUB_CARD]: cardId } });
  const hasMore = state.total != null ? state.rows.length < state.total : state.rows.length > 0 && state.rows.length % PAGE_SIZE === 0;
  return (
    <div style={{ padding: isMobile ? 16 : 28, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <button type="button" onClick={back} style={{ ...G, alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 5, border: 0, background: "none", color: T.blue, fontSize: 12, fontWeight: 700, cursor: "pointer" }}><ArrowLeft size={14} /> Voltar para o cartão</button>
      <div>
        <PageTitle sans="Lançamentos do" serif="cartão" />
        {state.card && <p style={{ ...G, margin: "5px 0 0", color: T.inkMid, fontSize: 12 }}>{state.card.description || state.card.brand} •{state.card.last4}</p>}
      </div>
      {!enabled && <Card role="status">Selecione uma organização para ver os lançamentos.</Card>}
      {state.missing && <Card role="status">Cartão não encontrado ou sem acesso.</Card>}
      {state.card && <RecentCardTransactions transactions={state.rows} cardCurrency={state.card.currency} loading={state.loading && state.page === 0} error={state.error && state.page === 0} title="Lançamentos do cartão" />}
      {state.error && state.card && <Card role="alert">Não foi possível carregar os lançamentos. <button type="button" onClick={() => { setState((current) => ({ ...current, loading: true, error: false })); setRetry((value) => value + 1); }}>Tentar novamente</button></Card>}
      {state.error && !state.card && <Card role="alert">Não foi possível carregar o cartão.</Card>}
      {state.card && hasMore && !state.error && (
        <button type="button" disabled={state.loading} onClick={() => { setState((current) => ({ ...current, loading: true })); setNextPage((page) => page + 1); }}>
          {state.loading ? "Carregando…" : "Carregar mais lançamentos"}
        </button>
      )}
    </div>
  );
}
