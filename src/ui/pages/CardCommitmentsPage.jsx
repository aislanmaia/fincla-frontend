import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { getFutureCommitments, getInvoiceHistory, listCreditCards, moveInstallmentToInvoice } from "../../api/creditCards";
import { listRecurringSeries, updateRecurringSeries } from "../../api/recurringSeries";
import { T } from "../tokens";
import { G, NUM } from "../typography";
import { Card, PageTitle } from "../components/primitives";
import { formatMoney } from "../money/formatMoney";
import { FC } from "../routing/searchContract";
import { shouldUseRealData } from "../dataMode";
import { useFocusTrap } from "../features/transactions/useFocusTrap";

const cardStyle = { padding: 18, minWidth: 0 };
const label = { ...G, fontSize: 11, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: ".07em" };
const buttonStyle = { ...G, border: `1px solid ${T.border}`, background: T.surface, borderRadius: 8, padding: "8px 11px", color: T.ink, cursor: "pointer", fontSize: 12 };
const pendingSnapshots = new Map();
const loadSnapshot = (organizationId, cardId, refresh) => {
  const key = `${organizationId}:${cardId}:${refresh}`;
  if (pendingSnapshots.has(key)) return pendingSnapshots.get(key);
  const request = listCreditCards(organizationId).then(async (cards) => {
    const card = cards.find((item) => item.public_id === cardId);
    if (!card) throw new Error("Cartão não encontrado ou sem acesso.");
    const [future, history, series] = await Promise.allSettled([
      getFutureCommitments(card.id, organizationId, 12, true, true),
      getInvoiceHistory(card.id, organizationId, 13, false, true),
      listRecurringSeries(organizationId),
    ]);
    if (future.status === "rejected") throw future.reason;
    return { loading: false, card, future: future.value, history: history.status === "fulfilled" ? history.value : null,
      historyError: history.status === "rejected", series: series.status === "fulfilled" ? series.value.series || [] : [],
      seriesError: series.status === "rejected", error: "" };
  });
  pendingSnapshots.set(key, request);
  request.finally(() => { if (pendingSnapshots.get(key) === request) pendingSnapshots.delete(key); }).catch(() => {});
  return request;
};
const moneyValue = (value, currency) => currency ? formatMoney(value, currency) ?? "—" : "—";
const keyOf = (row) => `${row.year}-${String(row.month).padStart(2, "0")}`;
const period = (row) => `${row.month_name || new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(row.year, row.month - 1, 1))} ${row.year}`;
const currentKey = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; };
const sum = (items) => items.reduce((total, item) => total + Number(item.amount), 0);
const installments = (row) => (row?.installments || []).filter((item) => Number(item.total_installments) >= 2);
const committed = (row) => sum(installments(row)) + sum(row.recurrences || []);
const inventoryCurrencyKnown = (row, currency) => Boolean(currency)
  && Array.isArray(row?.installments) && Array.isArray(row?.recurrences)
  && [...row.installments, ...row.recurrences].every((item) => item.amount_currency === currency
    && item.amount !== null && item.amount !== undefined && Number.isFinite(Number(item.amount)));
const inventoryKnown = (row, currency) => inventoryCurrencyKnown(row, currency)
  && !row.installments_truncated && !row.recurrences_truncated;
const historyKnown = (row, currency) => Boolean(currency)
  && row?.installments_amount_currency === currency && row?.recurrences_amount_currency === currency
  && row?.installments_amount !== null && row?.installments_amount !== undefined
  && row?.recurrences_amount !== null && row?.recurrences_amount !== undefined
  && Number.isFinite(Number(row.installments_amount)) && Number.isFinite(Number(row.recurrences_amount));
const finishFromDate = (date) => {
  const [year, month] = String(date || "").split("-").map(Number);
  return year > 0 && month >= 1 && month <= 12 ? period({ year, month }) : null;
};
const inventorySeries = (rows, remainingSeries = []) => {
  const series = new Map();
  const exactById = new Map(remainingSeries.map((item) => [item.series_id, item]));
  for (const row of rows) {
    for (const item of installments(row)) {
      const key = `installment:${item.series_id ?? item.transaction_id}`;
      const exact = exactById.get(item.series_id);
      if (!series.has(key)) series.set(key, { ...item, type: "installment", firstYear: row.year, firstMonth: row.month, finish: finishFromDate(exact?.last_due_date), remainingAmount: exact?.remaining_amount ?? null });
      if (item.installment_number === item.total_installments) series.get(key).finish = period(row);
    }
    for (const item of row.recurrences || []) {
      const key = `recurring:${item.series_id}`;
      if (!series.has(key)) series.set(key, { ...item, type: "recurring", firstYear: row.year, firstMonth: row.month, finish: null });
    }
  }
  return [...series.values()];
};
const shiftMonth = (offset) => {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
};

function PeriodPicker({ title, options, selected, onChange }) {
  return <div role="group" aria-label={title} style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
    <span style={label}>{title}</span>
    {options.map((count) => <button key={count} type="button" aria-pressed={selected === count} onClick={() => onChange(count)}
      style={{ ...buttonStyle, background: selected === count ? T.blue : T.surface, color: selected === count ? "white" : T.ink, padding: "6px 9px" }}>
      {count === 0 ? "Sem histórico" : `${count} meses`}
    </button>)}
  </div>;
}

function Metric({ title, value, detail, testId }) {
  return <Card style={cardStyle}><div style={label}>{title}</div><div data-testid={testId} style={{ ...G, ...NUM, fontSize: 22, fontWeight: 800, marginTop: 5 }}>{value}</div>{detail && <div style={{ ...G, fontSize: 12, color: T.inkLight, marginTop: 5 }}>{detail}</div>}</Card>;
}

function Inventory({ rows, remainingSeries, currency, groupBy, sortBy, onMove, isMobile }) {
  const items = useMemo(() => inventorySeries(rows, remainingSeries), [rows, remainingSeries]);
  const grouped = useMemo(() => {
    const sorted = [...items].sort((a, b) => sortBy === "value" ? Number(b.amount) - Number(a.amount) : sortBy === "month" ? `${a.firstYear}-${String(a.firstMonth).padStart(2, "0")}`.localeCompare(`${b.firstYear}-${String(b.firstMonth).padStart(2, "0")}`) : (a.category_name || "Sem categoria").localeCompare(b.category_name || "Sem categoria", "pt-BR"));
    const groups = new Map();
    for (const item of sorted) {
      const key = groupBy === "category" ? item.category_name || "Sem categoria" : groupBy === "month" ? item.type === "recurring" ? "Recorrências" : item.finish ? `Termina em ${item.finish}` : "Termina após o período consultado" : groupBy === "value" ? moneyValue(item.amount, currency) : "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    return [...groups].map(([name, list]) => ({ name, list }));
  }, [items, groupBy, sortBy, currency]);
  return <Card style={cardStyle}><section role="region" aria-label="Inventário de compromissos">
    <h2 style={{ ...G, margin: "0 0 14px", fontSize: 17 }}>Inventário de compromissos</h2>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
      <label style={{ ...G, fontSize: 12 }}>Agrupar por <select aria-label="Agrupar por" value={groupBy} onChange={(event) => onMove({ groupBy: event.target.value })} style={buttonStyle}><option value="purchase">Compra</option><option value="category">Categoria</option><option value="month">Mês</option><option value="value">Valor</option></select></label>
      <label style={{ ...G, fontSize: 12 }}>Ordenar por <select aria-label="Ordenar por" value={sortBy} onChange={(event) => onMove({ sortBy: event.target.value })} style={buttonStyle}><option value="value">Valor</option><option value="category">Categoria</option><option value="month">Mês</option></select></label>
    </div>
    <div className="fincla-scroll" style={{ maxHeight: isMobile ? 420 : 480, overflowY: "auto", minWidth: 0 }}>
      {grouped.map(({ name, list }) => <div key={name} style={{ marginBottom: 12 }}>
        {name && <div style={{ ...G, background: T.grayLight, borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 700, display: "flex", justifyContent: "space-between" }}><span>{name} · {list.length} {list.length === 1 ? "item" : "itens"}</span><span>{moneyValue(sum(list), currency)}</span></div>}
        {list.map((item, index) => <div key={`${item.type}:${item.series_id}:${item.due_date}:${index}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 4px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ minWidth: 0 }}><div style={{ ...G, fontSize: 13, fontWeight: 650 }}>{item.description}</div><div style={{ ...G, fontSize: 11, color: T.inkLight }}>{item.type === "recurring" ? "Recorrência" : `Parcela ${item.installment_number}/${item.total_installments}`} · {item.finish ? `termina em ${item.finish}` : "término fora do período"}{item.category_name ? ` · ${item.category_name}` : ""}{item.remainingAmount !== null && item.remainingAmount !== undefined ? ` · saldo ${moneyValue(item.remainingAmount, currency)}` : ""}</div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><strong style={{ ...G, ...NUM, fontSize: 12, whiteSpace: "nowrap" }}>{moneyValue(item.amount, currency)}</strong>{item.type === "installment" && <button type="button" onClick={() => onMove({ item })} aria-label={`Mover ${item.description}`} style={buttonStyle}>Mover</button>}</div>
        </div>)}
      </div>)}
      {items.length === 0 && <p style={{ ...G, fontSize: 12, color: T.inkLight }}>Nenhum compromisso neste período.</p>}
    </div>
  </section></Card>;
}

export function CardCommitmentsPage({ organizationId, dataMode = "live", isMobile = false }) {
  const { cardId } = useParams({ strict: false });
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, card: null, future: null, history: null, series: [], error: "", seriesError: false, historyError: false });
  const [mutation, setMutation] = useState({ pending: false, error: "" });
  const [groupBy, setGroupBy] = useState("purchase");
  const [sortBy, setSortBy] = useState("value");
  const [moveItem, setMoveItem] = useState(null);
  const [targetMonth, setTargetMonth] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [historyMonths, setHistoryMonths] = useState(3);
  const [futureMonths, setFutureMonths] = useState(6);
  const moveDialogRef = useRef(null);
  useFocusTrap(moveDialogRef, Boolean(moveItem));
  useEffect(() => {
    if (!moveItem) return undefined;
    moveDialogRef.current?.querySelector("select")?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); setMoveItem(null); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [moveItem]);
  const enabled = shouldUseRealData(organizationId, dataMode);

  useEffect(() => {
    if (!enabled) { setState({ loading: false, card: null, future: null, history: null, series: [], error: "Organização indisponível.", seriesError: false, historyError: false }); return; }
    let cancelled = false;
    setState((old) => ({ ...old, loading: true }));
    loadSnapshot(organizationId, cardId, refresh)
      .then((snapshot) => { if (!cancelled) setState(snapshot); })
      .catch(() => { if (!cancelled) setState({ loading: false, card: null, future: null, history: null, series: [], seriesError: false, historyError: false, error: "Não foi possível carregar os compromissos deste cartão." }); });
    return () => { cancelled = true; };
  }, [enabled, organizationId, cardId, refresh]);

  const { card, future, history, series } = state;
  const rows = future?.monthly_breakdown || [];
  const currency = card?.currency || null;
  const nowKey = currentKey();
  const monthNow = rows.find((row) => keyOf(row) === nowKey) ?? null;
  const knownRows = rows.filter((row) => inventoryKnown(row, currency));
  const browsableRows = rows.filter((row) => inventoryCurrencyKnown(row, currency));
  const currencyMismatch = rows.some((row) => [...(row.installments || []), ...(row.recurrences || [])]
    .some((item) => item.amount_currency !== currency));
  const allKnown = rows.length > 0 && knownRows.length === rows.length;
  const total = allKnown ? knownRows.reduce((value, row) => value + committed(row), 0) : null;
  const balance = future?.remaining_balance;
  const balanceKnown = Boolean(currency && balance?.complete === true
    && ["gross_amount", "linked_refunds_amount", "net_amount"].every((field) =>
      balance[field] !== null && balance[field] !== undefined && Number.isFinite(Number(balance[field]))
      && balance[`${field}_currency`] === currency)
    && Array.isArray(balance.series) && balance.series.every((item) =>
      ["remaining_amount", "linked_refunds_amount", "next_amount"].every((field) =>
        item[`${field}_currency`] === currency && Number.isFinite(Number(item[field])))));
  const monthly = inventoryKnown(monthNow, currency) ? committed(monthNow) : null;
  const usage = monthly !== null && card?.credit_limit != null && card.credit_limit > 0 ? monthly / card.credit_limit * 100 : null;
  const finishing = inventoryKnown(monthNow, currency) ? installments(monthNow).filter((item) => item.installment_number === item.total_installments) : null;
  const reduction = finishing ? sum(finishing) : null;
  const recurring = inventoryCurrencyKnown(monthNow, currency) ? monthNow.recurrences : [];
  const activeSeries = inventorySeries(browsableRows, balanceKnown ? balance.series : []).filter((item) => item.type === "installment");
  const largestInstallments = [...activeSeries].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5);
  const nearestToEnd = [...activeSeries].sort((a, b) => (a.total_installments - a.installment_number) - (b.total_installments - b.installment_number)).slice(0, 4);
  const recurringMonthly = inventoryKnown(monthNow, currency) ? sum(recurring) : null;
  const recurringNextYear = rows.length === 12 && allKnown ? rows.reduce((value, row) => value + sum(row.recurrences), 0) : null;
  const currentHistory = (history?.monthly_data || []).find((row) => keyOf(row) === nowKey);
  const recurringInvoicePercent = recurringMonthly !== null && currency && currentHistory?.total_amount_currency === currency
    && Number(currentHistory.total_amount) > 0 ? Math.round(recurringMonthly / Number(currentHistory.total_amount) * 100) : null;
  const lowUsageKnown = recurring.every((item) => typeof series.find((entry) => entry.id === item.series_id)?.is_low_usage === "boolean");
  const lowUsageMonthly = lowUsageKnown && inventoryKnown(monthNow, currency)
    ? sum(recurring.filter((item) => series.find((entry) => entry.id === item.series_id)?.is_low_usage)) : null;
  const categoryTotals = new Map();
  if (inventoryKnown(monthNow, currency)) {
    for (const item of [...installments(monthNow), ...recurring]) {
      const name = item.category_name || "Sem categoria";
      categoryTotals.set(name, (categoryTotals.get(name) || 0) + Number(item.amount));
    }
  }
  const categories = [...categoryTotals].sort((a, b) => b[1] - a[1]);
  const dayBuckets = [
    { label: "Dias 1–10", from: 1, to: 10, value: 0, count: 0 },
    { label: "Dias 11–20", from: 11, to: 20, value: 0, count: 0 },
    { label: "Dias 21–31", from: 21, to: 31, value: 0, count: 0 },
  ];
  if (inventoryKnown(monthNow, currency)) {
    for (const item of [...installments(monthNow), ...recurring]) {
      const day = Number(item.due_date?.slice(8, 10));
      const bucket = dayBuckets.find((entry) => day >= entry.from && day <= entry.to);
      if (bucket) { bucket.value += Number(item.amount); bucket.count += 1; }
    }
  }
  const historyByMonth = new Map((history?.monthly_data || []).map((row) => [keyOf(row), row]));
  const futureByMonth = new Map(rows.map((row) => [keyOf(row), row]));
  const periodHistory = Array.from({ length: historyMonths }, (_, index) =>
    historyByMonth.get(keyOf(shiftMonth(index - historyMonths))));
  const periodFuture = Array.from({ length: futureMonths }, (_, index) =>
    futureByMonth.get(keyOf(shiftMonth(index))));
  const categoryAverageKnown = periodHistory.every((row) => historyKnown(row, currency)
    && Array.isArray(row.commitments_category_breakdown)
    && row.commitments_category_breakdown.every((item) => item.installments_amount_currency === currency
      && item.recurrences_amount_currency === currency
      && Number.isFinite(Number(item.installments_amount)) && Number.isFinite(Number(item.recurrences_amount))))
    && periodFuture.every((row) => inventoryKnown(row, currency));
  const periodCategoryTotals = new Map();
  const addCategory = (id, name, amount) => {
    const key = id || "__uncategorized__";
    const previous = periodCategoryTotals.get(key);
    periodCategoryTotals.set(key, { id: key, name: name || previous?.name || "Sem categoria", amount: (previous?.amount || 0) + amount });
  };
  if (categoryAverageKnown) {
    for (const row of periodHistory) for (const item of row.commitments_category_breakdown) {
      addCategory(item.category_id, item.category_name, Number(item.installments_amount) + Number(item.recurrences_amount));
    }
    for (const row of periodFuture) for (const item of [...installments(row), ...row.recurrences]) {
      addCategory(item.category_id, item.category_name, Number(item.amount));
    }
  }
  const periodCategories = [...periodCategoryTotals.values()].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const categoryPeriodLabel = `${historyMonths ? `${historyMonths}m histórico + ` : ""}${futureMonths}m projeção`;
  const timeline = Array.from({ length: historyMonths + futureMonths }, (_, index) => {
    const offset = index - historyMonths;
    const ref = shiftMonth(offset);
    const row = offset < 0 ? historyByMonth.get(keyOf(ref)) : futureByMonth.get(keyOf(ref));
    const value = offset < 0
      ? historyKnown(row, currency) ? Number(row.installments_amount) + Number(row.recurrences_amount) : null
      : inventoryKnown(row, currency) ? committed(row) : null;
    return { ...ref, key: keyOf(ref), label: period(ref), value, phase: offset < 0 ? "history" : offset === 0 ? "current" : "forecast" };
  });
  const largestCommitment = Math.max(0, ...timeline.map((entry) => entry.value > 0 ? entry.value : 0));
  const seriesById = new Map(series.map((item) => [item.id, item]));
  const back = () => navigate({ to: "/cards", search: { [FC.VIEW]: "new", [FC.HUB_CARD]: cardId } });
  const handleInventory = (change) => {
    if (change.groupBy) setGroupBy(change.groupBy);
    if (change.sortBy) setSortBy(change.sortBy);
    if (change.item) { setMoveItem(change.item); setTargetMonth(""); }
  };
  const toggleLowUsage = async (item) => {
    const old = Boolean(seriesById.get(item.series_id)?.is_low_usage);
    setMutation({ pending: true, error: "" });
    try {
      await updateRecurringSeries(item.series_id, organizationId, { is_low_usage: !old });
      setState((prev) => ({ ...prev, series: prev.series.map((entry) => entry.id === item.series_id ? { ...entry, is_low_usage: !old } : entry) }));
      setMutation({ pending: false, error: "" });
    } catch { setMutation({ pending: false, error: "Não foi possível atualizar a marcação de baixo uso." }); }
  };
  const confirmMove = async () => {
    if (!moveItem || !targetMonth) return;
    const [year, month] = targetMonth.split("-").map(Number);
    setMutation({ pending: true, error: "" });
    try {
      await moveInstallmentToInvoice(card.id, moveItem.transaction_id, organizationId, { target_year: year, target_month: month });
      setMoveItem(null); setMutation({ pending: false, error: "" }); setRefresh((value) => value + 1);
    } catch { setMutation({ pending: false, error: "Não foi possível mover a parcela." }); }
  };
  const moveOptions = rows.filter((row) => keyOf(row) > nowKey && keyOf(row) !== `${moveItem?.firstYear}-${String(moveItem?.firstMonth).padStart(2, "0")}`);
  const gap = isMobile ? 12 : 16;
  return <div style={{ ...G, padding: isMobile ? 16 : 28, display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
    <button type="button" onClick={back} style={{ ...buttonStyle, alignSelf: "flex-start", border: 0, color: T.blue, paddingLeft: 0 }}><ArrowLeft size={14} /> Voltar ao cartão</button>
    <PageTitle sans="Parcelas &" serif="Compromissos" />
    {state.loading && <p role="status">Carregando compromissos…</p>}
    {state.error && <p role="alert">{state.error}</p>}
    {!state.loading && future && <>
      <p style={{ margin: 0, fontSize: 12, color: T.inkLight }}>{card.brand} •{card.last4} · {card.description}</p>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap }}>
        <Metric title="Saldo restante de parcelas" value={moneyValue(balanceKnown ? balance.net_amount : null, currency)} testId="committed-total" detail={!currency ? "Moeda do cartão indisponível" : balanceKnown ? `Parcelas pendentes ${moneyValue(balance.gross_amount, currency)} − estornos vinculados ${moneyValue(balance.linked_refunds_amount, currency)}. Recorrências à parte.` : "Saldo exato indisponível; confira a moeda e tente atualizar os dados."} />
        <Metric title="Comprometimento mensal" value={moneyValue(monthly, currency)} testId="monthly-committed" detail={monthNow ? period(monthNow) : "Sem dados mensais"} />
        <Metric title="Percentual do limite" value={usage === null ? "—" : `${Math.round(usage)}%`} detail={card.credit_limit == null ? "Limite não informado" : `de ${moneyValue(card.credit_limit, currency)} de limite`} />
      </div>
      <p style={{ ...G, fontSize: 12, color: T.inkLight, margin: 0 }}>Projeção de parcelas e recorrências nos próximos 12 meses: {moneyValue(total, currency)}.</p>
      {usage !== null && usage >= 30 && <p role="status" style={{ margin: 0, color: T.amber }}>Comprometimento elevado: {Math.round(usage)}% do limite está comprometido neste mês.</p>}
      <Card style={cardStyle}><section role="region" aria-label="Linha do tempo do compromisso"><h2 style={{ ...G, margin: "0 0 12px", fontSize: 17 }}>Linha do tempo do compromisso</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <PeriodPicker title="Histórico" options={[0, 3, 6, 12]} selected={historyMonths} onChange={setHistoryMonths} />
          <PeriodPicker title="Projeção" options={[3, 6, 12]} selected={futureMonths} onChange={setFutureMonths} />
        </div>
        {state.historyError && historyMonths > 0 && <p role="alert" style={{ fontSize: 12 }}>Não foi possível carregar o histórico de compromissos.</p>}
        <div style={{ display: "flex", gap: 10, overflowX: "auto", minWidth: 0, alignItems: "end" }} className="fincla-scroll">{timeline.map((entry) =>
          <div key={entry.key} data-testid={`timeline-${entry.key}`} style={{ minWidth: 110, padding: 10, background: entry.phase === "current" ? T.blueLight : T.grayLight, borderRadius: 9, border: entry.phase === "current" ? `1px solid ${T.blue}` : "1px solid transparent" }}>
            <div aria-hidden="true" style={{ height: 98, display: "flex", alignItems: "end", justifyContent: "center", marginBottom: 8 }}>
              {entry.value > 0 && largestCommitment > 0 && currency && <div data-testid={`timeline-bar-${entry.key}`}
                style={{ width: 30, height: `${Math.max(4, Math.round(entry.value / largestCommitment * 94))}px`, borderRadius: "5px 5px 0 0", background: entry.phase === "history" ? T.inkFaint : entry.phase === "current" ? T.blue : T.blueBar }} />}
            </div>
            <div style={label}>{entry.label}</div>
            <strong style={{ ...G, ...NUM, fontSize: 13 }}>{entry.value === null || !currency ? "Sem dados" : moneyValue(entry.value, currency)}</strong>
            <div style={{ ...G, fontSize: 10, color: T.inkLight }}>{entry.phase === "history" ? "Histórico" : entry.phase === "current" ? "Atual" : "Projeção"}</div>
          </div>)}</div>
      </section></Card>
      <Card style={cardStyle}><section role="region" aria-label="Detalhe por mês"><h2 style={{ ...G, margin: "0 0 12px", fontSize: 17 }}>Detalhe por mês</h2><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        {timeline.filter((entry) => entry.phase === "history").map((entry) => {
          const row = historyByMonth.get(entry.key);
          return <div key={entry.key} style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{entry.label}</strong><strong>{entry.value === null ? "Sem dados" : moneyValue(entry.value, currency)}</strong></div><div style={{ marginTop: 8, fontSize: 12, color: T.inkLight }}>Histórico · parcelas {moneyValue(historyKnown(row, currency) ? row.installments_amount : null, currency)} · recorrências {moneyValue(historyKnown(row, currency) ? row.recurrences_amount : null, currency)}</div></div>;
        })}
        {rows.slice(0, futureMonths).map((row) => <div key={keyOf(row)} style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{period(row)} {keyOf(row) === nowKey && <span style={{ color: T.blue, fontSize: 11 }}>Próximo</span>}</strong><strong>{moneyValue(inventoryKnown(row, currency) ? committed(row) : null, currency)}</strong></div>
          {inventoryKnown(row, currency) ? <>
            <div style={{ marginTop: 8, fontSize: 12, color: T.inkLight }}>{installments(row).length} parcelas · {row.recurrences.length} recorrências</div>
            {installments(row).length === 0 ? <p style={{ ...G, fontSize: 11, color: T.inkLight }}>Sem parcelas previstas</p> : [...installments(row)].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 3).map((item) => <div key={item.transaction_id} style={{ display: "flex", justifyContent: "space-between", gap: 7, marginTop: 6, fontSize: 11 }}><span>{item.description}</span><span>{moneyValue(item.amount, currency)}</span></div>)}
            <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 7 }}>+ {moneyValue(sum(row.recurrences), currency)} em assinaturas</div>
          </> : <div style={{ marginTop: 8, fontSize: 12, color: T.inkLight }}>Inventário indisponível</div>}
        </div>)}
      </div></section></Card>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap }}>
        <Card style={cardStyle}><h2 style={{ ...G, margin: "0 0 12px", fontSize: 17 }}>Assinaturas & recorrências</h2>
          <div data-testid="recurring-monthly" style={{ ...G, ...NUM, fontSize: 21, fontWeight: 800 }}>{moneyValue(recurringMonthly, currency)} <span style={{ fontSize: 12, color: T.inkLight }}>/mês atual</span></div>
          <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 5 }}>Próximos 12 meses: {moneyValue(recurringNextYear, currency)} · da fatura atual registrada: {recurringInvoicePercent === null ? "—" : `${recurringInvoicePercent}%`}</div>
          {state.seriesError && <p role="alert">Não foi possível carregar as marcações de baixo uso.</p>}{recurring.map((item, index) => <div key={`${item.series_id}:${item.due_date}:${index}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.border}` }}><span>{item.description} · {moneyValue(item.amount, currency)}</span>{typeof seriesById.get(item.series_id)?.is_low_usage === "boolean" ? <label style={{ fontSize: 11 }}><input type="checkbox" aria-label={`Baixo uso: ${item.description}`} checked={seriesById.get(item.series_id).is_low_usage} disabled={mutation.pending} onChange={() => toggleLowUsage(item)} /> baixo uso</label> : <span style={{ fontSize: 11, color: T.inkLight }}>Baixo uso indisponível</span>}</div>)}{recurring.length === 0 && <p style={{ fontSize: 12 }}>{inventoryCurrencyKnown(monthNow, currency) ? "Sem recorrências neste mês." : "Recorrências indisponíveis neste mês."}</p>}
          <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 8 }}>Marcadas como baixo uso neste mês: {moneyValue(lowUsageMonthly, currency)}</div>
        </Card>
        <Card style={cardStyle}><h2 style={{ ...G, margin: "0 0 12px", fontSize: 17 }}>Redução na próxima fatura</h2><div style={{ ...G, ...NUM, fontSize: 24, fontWeight: 800, color: reduction > 0 ? T.green : T.ink }}>{reduction === null || !currency ? "—" : reduction > 0 ? `Redução de ${moneyValue(reduction, currency)}` : "Nenhuma parcela termina neste ciclo"}</div><p style={{ fontSize: 12, color: T.inkLight }}>{finishing === null ? "Inventário atual indisponível." : `${finishing.length} ${finishing.length === 1 ? "parcela termina" : "parcelas terminam"} neste ciclo`}</p></Card>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap }}>
        <Card style={cardStyle}><h2 style={{ ...G, margin: "0 0 10px", fontSize: 16 }}>Maiores parcelas ativas</h2>{largestInstallments.map((item) => <div key={item.series_id ?? item.transaction_id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12 }}><span>{item.description} · {item.total_installments - item.installment_number + 1} restam</span><strong>{moneyValue(item.amount, currency)}</strong></div>)}{largestInstallments.length === 0 && <p style={{ fontSize: 12 }}>Sem parcelas ativas no período.</p>}</Card>
        <Card style={cardStyle}><h2 style={{ ...G, margin: "0 0 10px", fontSize: 16 }}>Parcelas mais próximas do fim</h2>{nearestToEnd.map((item) => <div key={item.series_id ?? item.transaction_id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12 }}><span>{item.description} · {item.total_installments - item.installment_number + 1} restam</span><strong>{moneyValue(item.amount, currency)}</strong></div>)}{nearestToEnd.length === 0 && <p style={{ fontSize: 12 }}>Sem parcelas ativas no período.</p>}</Card>
        <Card style={cardStyle}><h2 style={{ ...G, margin: "0 0 10px", fontSize: 16 }}>Onde você mais se compromete no mês</h2>{categories.map(([name, value]) => <div key={name} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12 }}><span>{name}</span><strong>{moneyValue(value, currency)}</strong></div>)}{categories.length === 0 && <p style={{ fontSize: 12 }}>Sem dados de categorias neste mês.</p>}</Card>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap }}>
        <Card style={cardStyle}><h2 style={{ ...G, margin: "0 0 10px", fontSize: 16 }}>Quando vence o compromisso do mês</h2>{inventoryKnown(monthNow, currency) ? dayBuckets.map((bucket) => <div key={bucket.label} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12 }}><span>{bucket.label} · {bucket.count} itens</span><strong>{moneyValue(bucket.value, currency)}</strong></div>) : <p style={{ fontSize: 12 }}>Datas indisponíveis neste mês.</p>}</Card>
        <Card style={cardStyle}><h2 style={{ ...G, margin: "0 0 10px", fontSize: 16 }}>Média por categoria · {categoryPeriodLabel}</h2>{periodCategories.map(({ id, name, amount }) => <div key={id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12 }}><span>{name}</span><strong>{moneyValue(amount / (historyMonths + futureMonths), currency)}/mês</strong></div>)}{periodCategories.length === 0 && <p style={{ fontSize: 12 }}>{categoryAverageKnown ? "Sem compromissos no período." : "Média indisponível: faltam dados de um ou mais meses do período."}</p>}</Card>
      </div>
      {currencyMismatch && <p role="alert" style={{ margin: 0, color: T.amber }}>A moeda dos compromissos recebidos não corresponde à moeda do cartão. Valores desses meses estão indisponíveis.</p>}
      {!allKnown && <p role="status" style={{ margin: 0, color: T.amber }}>O inventário de alguns meses está incompleto. Os itens disponíveis continuam listados abaixo.</p>}
      <Inventory rows={browsableRows} remainingSeries={balanceKnown ? balance.series : []} currency={currency} groupBy={groupBy} sortBy={sortBy} onMove={handleInventory} isMobile={isMobile} />
      {mutation.error && <p role="alert">{mutation.error}</p>}
      {moveItem && <div ref={moveDialogRef} role="dialog" aria-modal="true" aria-label={`Mover ${moveItem.description}`} style={{ position: "fixed", inset: 0, background: "#0008", zIndex: 100, display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center" }}><Card style={{ ...cardStyle, width: isMobile ? "100%" : 420, display: "flex", flexDirection: "column", gap: 12 }}><h2 style={{ margin: 0, fontSize: 18 }}>Mover {moveItem.description}</h2><p style={{ margin: 0, fontSize: 12 }}>As demais parcelas da compra serão reposicionadas automaticamente.</p><label>Fatura de destino <select aria-label="Fatura de destino" value={targetMonth} onChange={(event) => setTargetMonth(event.target.value)} style={{ ...buttonStyle, width: "100%" }}><option value="">Selecione o mês</option>{moveOptions.map((row) => <option key={keyOf(row)} value={keyOf(row)}>{period(row)}</option>)}</select></label><div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" style={buttonStyle} onClick={() => setMoveItem(null)}>Cancelar</button><button type="button" style={{ ...buttonStyle, background: T.blue, color: "white" }} disabled={!targetMonth || mutation.pending} onClick={confirmMove}>Confirmar mudança</button></div></Card></div>}
    </>}
  </div>;
}
