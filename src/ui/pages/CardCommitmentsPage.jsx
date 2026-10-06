import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { getFutureCommitments, listCreditCards, moveInstallmentToInvoice } from "../../api/creditCards";
import { listRecurringSeries, updateRecurringSeries } from "../../api/recurringSeries";
import { T } from "../tokens";
import { G, NUM } from "../typography";
import { Card, PageTitle } from "../components/primitives";
import { formatMoney } from "../money/formatMoney";
import { FC } from "../routing/searchContract";
import { shouldUseRealData } from "../dataMode";

const cardStyle = { padding: 18, minWidth: 0 };
const label = { ...G, fontSize: 11, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: ".07em" };
const buttonStyle = { ...G, border: `1px solid ${T.border}`, background: T.surface, borderRadius: 8, padding: "8px 11px", color: T.ink, cursor: "pointer", fontSize: 12 };
const moneyValue = (value, currency) => currency ? formatMoney(value, currency) ?? "—" : "—";
const keyOf = (row) => `${row.year}-${String(row.month).padStart(2, "0")}`;
const period = (row) => `${row.month_name || new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(row.year, row.month - 1, 1))} ${row.year}`;
const currentKey = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; };
const sum = (items) => items.reduce((total, item) => total + Number(item.amount), 0);
const installments = (row) => (row?.installments || []).filter((item) => Number(item.total_installments) >= 2);
const committed = (row) => sum(installments(row)) + sum(row.recurrences || []);
const inventoryKnown = (row) => Array.isArray(row?.installments) && Array.isArray(row?.recurrences)
  && [...row.installments, ...row.recurrences].every((item) => item.amount !== null && item.amount !== undefined && Number.isFinite(Number(item.amount)))
  && !row.installments_truncated && !row.recurrences_truncated;

function Metric({ title, value, detail, testId }) {
  return <Card style={cardStyle}><div style={label}>{title}</div><div data-testid={testId} style={{ ...G, ...NUM, fontSize: 22, fontWeight: 800, marginTop: 5 }}>{value}</div>{detail && <div style={{ ...G, fontSize: 12, color: T.inkLight, marginTop: 5 }}>{detail}</div>}</Card>;
}

function Inventory({ rows, currency, groupBy, sortBy, onMove, isMobile }) {
  const items = useMemo(() => rows.flatMap((row) => [
    ...installments(row).map((item) => ({ ...item, type: "installment", month: period(row), year: row.year, invoiceMonth: row.month })),
    ...(row.recurrences || []).map((item) => ({ ...item, type: "recurring", month: period(row), year: row.year, invoiceMonth: row.month })),
  ]), [rows]);
  const grouped = useMemo(() => {
    const sorted = [...items].sort((a, b) => sortBy === "value" ? Number(b.amount) - Number(a.amount) : sortBy === "month" ? `${a.year}-${String(a.invoiceMonth).padStart(2, "0")}`.localeCompare(`${b.year}-${String(b.invoiceMonth).padStart(2, "0")}`) : (a.category_name || "Sem categoria").localeCompare(b.category_name || "Sem categoria", "pt-BR"));
    const groups = new Map();
    for (const item of sorted) {
      const key = groupBy === "category" ? item.category_name || "Sem categoria" : groupBy === "month" ? item.month : groupBy === "value" ? moneyValue(item.amount, currency) : item.description;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    return [...groups].map(([name, list]) => ({ name, list }));
  }, [items, groupBy, sortBy, currency]);
  return <Card style={cardStyle}>
    <h2 style={{ ...G, margin: "0 0 14px", fontSize: 17 }}>Inventário de compromissos</h2>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
      <label style={{ ...G, fontSize: 12 }}>Agrupar por <select aria-label="Agrupar por" value={groupBy} onChange={(event) => onMove({ groupBy: event.target.value })} style={buttonStyle}><option value="purchase">Compra</option><option value="category">Categoria</option><option value="month">Mês</option><option value="value">Valor</option></select></label>
      <label style={{ ...G, fontSize: 12 }}>Ordenar por <select aria-label="Ordenar por" value={sortBy} onChange={(event) => onMove({ sortBy: event.target.value })} style={buttonStyle}><option value="value">Valor</option><option value="category">Categoria</option><option value="month">Mês</option></select></label>
    </div>
    <div className="fincla-scroll" style={{ maxHeight: isMobile ? 420 : 480, overflowY: "auto", minWidth: 0 }}>
      {grouped.map(({ name, list }) => <section key={name} style={{ marginBottom: 12 }}>
        <div style={{ ...G, background: T.grayLight, borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 700, display: "flex", justifyContent: "space-between" }}><span>{name} · {list.length} {list.length === 1 ? "item" : "itens"}</span><span>{moneyValue(sum(list), currency)}</span></div>
        {list.map((item, index) => <div key={`${item.type}:${item.series_id}:${item.due_date}:${index}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 4px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ minWidth: 0 }}><div style={{ ...G, fontSize: 13, fontWeight: 650 }}>{item.description}</div><div style={{ ...G, fontSize: 11, color: T.inkLight }}>{item.type === "recurring" ? "Recorrência" : `Parcela ${item.installment_number}/${item.total_installments}`} · {item.month}{item.category_name ? ` · ${item.category_name}` : ""}</div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><strong style={{ ...G, ...NUM, fontSize: 12, whiteSpace: "nowrap" }}>{moneyValue(item.amount, currency)}</strong>{item.type === "installment" && <button type="button" onClick={() => onMove({ item })} aria-label={`Mover ${item.description}`} style={buttonStyle}>Mover</button>}</div>
        </div>)}
      </section>)}
      {items.length === 0 && <p style={{ ...G, fontSize: 12, color: T.inkLight }}>Nenhum compromisso neste período.</p>}
    </div>
  </Card>;
}

export function CardCommitmentsPage({ organizationId, dataMode = "live", isMobile = false }) {
  const { cardId } = useParams({ strict: false });
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, card: null, future: null, series: [], error: "", seriesError: false });
  const [mutation, setMutation] = useState({ pending: false, error: "" });
  const [groupBy, setGroupBy] = useState("purchase");
  const [sortBy, setSortBy] = useState("value");
  const [moveItem, setMoveItem] = useState(null);
  const [targetMonth, setTargetMonth] = useState("");
  const [refresh, setRefresh] = useState(0);
  const enabled = shouldUseRealData(organizationId, dataMode);

  useEffect(() => {
    if (!enabled) { setState({ loading: false, card: null, future: null, series: [], error: "Organização indisponível.", seriesError: false }); return; }
    let cancelled = false;
    setState((old) => ({ ...old, loading: true }));
    listCreditCards(organizationId).then(async (cards) => {
      const card = cards.find((item) => item.public_id === cardId);
      if (!card) throw new Error("Cartão não encontrado ou sem acesso.");
      const [future, series] = await Promise.allSettled([getFutureCommitments(card.id, organizationId, 12, true), listRecurringSeries(organizationId)]);
      if (future.status === "rejected") throw future.reason;
      if (!cancelled) setState({ loading: false, card, future: future.value, series: series.status === "fulfilled" ? series.value.series || [] : [], seriesError: series.status === "rejected", error: "" });
    }).catch(() => { if (!cancelled) setState({ loading: false, card: null, future: null, series: [], seriesError: false, error: "Não foi possível carregar os compromissos deste cartão." }); });
    return () => { cancelled = true; };
  }, [enabled, organizationId, cardId, refresh]);

  const { card, future, series } = state;
  const rows = future?.monthly_breakdown || [];
  const currency = card?.currency || null;
  const nowKey = currentKey();
  const monthNow = rows.find((row) => keyOf(row) === nowKey) ?? rows[0] ?? null;
  const knownRows = rows.filter(inventoryKnown);
  const browsableRows = rows.filter((row) => Array.isArray(row.installments) && Array.isArray(row.recurrences));
  const allKnown = rows.length > 0 && knownRows.length === rows.length;
  const total = allKnown ? knownRows.reduce((value, row) => value + committed(row), 0) : null;
  const monthly = inventoryKnown(monthNow) ? committed(monthNow) : null;
  const usage = monthly !== null && card?.credit_limit != null && card.credit_limit > 0 ? monthly / card.credit_limit * 100 : null;
  const nextRow = rows.find((row) => keyOf(row) > keyOf(monthNow || { year: 9999, month: 12 })) ?? null;
  const nextTotal = inventoryKnown(nextRow) ? committed(nextRow) : null;
  const reduction = monthly !== null && nextTotal !== null ? monthly - nextTotal : null;
  const recurring = monthNow?.recurrences || [];
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
  const moveOptions = rows.filter((row) => keyOf(row) > nowKey && keyOf(row) !== `${moveItem?.year}-${String(moveItem?.invoiceMonth).padStart(2, "0")}`);
  const gap = isMobile ? 12 : 16;
  return <div style={{ ...G, padding: isMobile ? 16 : 28, display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
    <button type="button" onClick={back} style={{ ...buttonStyle, alignSelf: "flex-start", border: 0, color: T.blue, paddingLeft: 0 }}><ArrowLeft size={14} /> Voltar ao cartão</button>
    <PageTitle sans="Parcelas &" serif="Compromissos" />
    {state.loading && <p role="status">Carregando compromissos…</p>}
    {state.error && <p role="alert">{state.error}</p>}
    {!state.loading && future && <>
      <p style={{ margin: 0, fontSize: 12, color: T.inkLight }}>{card.brand} •{card.last4} · {card.description}</p>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap }}>
        <Metric title="Total comprometido no período" value={moneyValue(total, currency)} testId="committed-total" detail={!currency ? "Moeda do cartão indisponível" : allKnown ? `${rows.length} meses consultados` : "Inventário incompleto; total indisponível"} />
        <Metric title="Comprometimento mensal" value={moneyValue(monthly, currency)} testId="monthly-committed" detail={monthNow ? period(monthNow) : "Sem dados mensais"} />
        <Metric title="Percentual do limite" value={usage === null ? "—" : `${Math.round(usage)}%`} detail={card.credit_limit == null ? "Limite não informado" : `de ${moneyValue(card.credit_limit, currency)} de limite`} />
      </div>
      {usage !== null && usage >= 30 && <p role="status" style={{ margin: 0, color: T.amber }}>Comprometimento elevado: {Math.round(usage)}% do limite está comprometido neste mês.</p>}
      <Card style={cardStyle}><h2 style={{ ...G, margin: "0 0 12px", fontSize: 17 }}>Linha do tempo do compromisso</h2><div style={{ display: "flex", gap: 10, overflowX: "auto", minWidth: 0 }} className="fincla-scroll">{rows.map((row) => {
        const value = inventoryKnown(row) ? committed(row) : null;
        return <div key={keyOf(row)} style={{ minWidth: 110, padding: 10, background: keyOf(row) === nowKey ? T.blueLight : T.grayLight, borderRadius: 9 }}><div style={label}>{period(row)}</div><strong style={{ ...G, ...NUM, fontSize: 13 }}>{moneyValue(value, currency)}</strong></div>;
      })}</div></Card>
      <Card style={cardStyle}><h2 style={{ ...G, margin: "0 0 12px", fontSize: 17 }}>Detalhe por mês</h2><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        {rows.map((row) => <div key={keyOf(row)} style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{period(row)}</strong><strong>{moneyValue(inventoryKnown(row) ? committed(row) : null, currency)}</strong></div>{inventoryKnown(row) ? <div style={{ marginTop: 8, fontSize: 12, color: T.inkLight }}>{installments(row).length} parcelas · {row.recurrences.length} recorrências</div> : <div style={{ marginTop: 8, fontSize: 12, color: T.inkLight }}>Inventário indisponível</div>}</div>)}
      </div></Card>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap }}>
        <Card style={cardStyle}><h2 style={{ ...G, margin: "0 0 12px", fontSize: 17 }}>Assinaturas & recorrências</h2>{state.seriesError && <p role="alert">Não foi possível carregar as marcações de baixo uso.</p>}{recurring.map((item, index) => <div key={`${item.series_id}:${item.due_date}:${index}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.border}` }}><span>{item.description} · {moneyValue(item.amount, currency)}</span>{typeof seriesById.get(item.series_id)?.is_low_usage === "boolean" ? <label style={{ fontSize: 11 }}><input type="checkbox" aria-label={`Baixo uso: ${item.description}`} checked={seriesById.get(item.series_id).is_low_usage} disabled={mutation.pending} onChange={() => toggleLowUsage(item)} /> baixo uso</label> : <span style={{ fontSize: 11, color: T.inkLight }}>Baixo uso indisponível</span>}</div>)}{recurring.length === 0 && <p style={{ fontSize: 12 }}>Sem recorrências neste mês.</p>}</Card>
        <Card style={cardStyle}><h2 style={{ ...G, margin: "0 0 12px", fontSize: 17 }}>Variação na próxima fatura</h2><div style={{ ...G, ...NUM, fontSize: 24, fontWeight: 800, color: reduction > 0 ? T.green : reduction < 0 ? T.amber : T.ink }}>{reduction === null || !currency ? "—" : reduction > 0 ? `Redução de ${moneyValue(reduction, currency)}` : reduction < 0 ? `Aumento de ${moneyValue(-reduction, currency)}` : "Sem variação prevista"}</div><p style={{ fontSize: 12, color: T.inkLight }}>{nextRow ? `Comparação com ${period(nextRow)} para as parcelas e recorrências conhecidas.` : "Ainda não há um próximo mês para comparar."}</p></Card>
      </div>
      {!allKnown && <p role="status" style={{ margin: 0, color: T.amber }}>O inventário de alguns meses está incompleto. Os itens disponíveis continuam listados abaixo.</p>}
      <Inventory rows={browsableRows} currency={currency} groupBy={groupBy} sortBy={sortBy} onMove={handleInventory} isMobile={isMobile} />
      {mutation.error && <p role="alert">{mutation.error}</p>}
      {moveItem && <div role="dialog" aria-modal="true" aria-label={`Mover ${moveItem.description}`} style={{ position: "fixed", inset: 0, background: "#0008", zIndex: 100, display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center" }}><Card style={{ ...cardStyle, width: isMobile ? "100%" : 420, display: "flex", flexDirection: "column", gap: 12 }}><h2 style={{ margin: 0, fontSize: 18 }}>Mover {moveItem.description}</h2><p style={{ margin: 0, fontSize: 12 }}>As demais parcelas da compra serão reposicionadas automaticamente.</p><label>Fatura de destino <select aria-label="Fatura de destino" value={targetMonth} onChange={(event) => setTargetMonth(event.target.value)} style={{ ...buttonStyle, width: "100%" }}><option value="">Selecione o mês</option>{moveOptions.map((row) => <option key={keyOf(row)} value={keyOf(row)}>{period(row)}</option>)}</select></label><div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" style={buttonStyle} onClick={() => setMoveItem(null)}>Cancelar</button><button type="button" style={{ ...buttonStyle, background: T.blue, color: "white" }} disabled={!targetMonth || mutation.pending} onClick={confirmMove}>Confirmar mudança</button></div></Card></div>}
    </>}
  </div>;
}
