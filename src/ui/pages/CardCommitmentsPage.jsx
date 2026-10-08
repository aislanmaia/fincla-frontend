import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { getFutureCommitments, getInvoiceHistory, listCreditCards, moveInstallmentToInvoice } from "../../api/creditCards";
import { listRecurringSeries, updateRecurringSeries } from "../../api/recurringSeries";
import { T } from "../tokens";
import { G, NUM } from "../typography";
import { Btn, Card, PageTitle, ProgBar, Select } from "../components/primitives";
import { formatMoney } from "../money/formatMoney";
import { FC } from "../routing/searchContract";
import { cardAllTransactionsPath } from "../routing/invoiceRoute";
import { shouldUseRealData } from "../dataMode";
import { useFocusTrap } from "../features/transactions/useFocusTrap";

const cardStyle = { padding: 18, minWidth: 0 };
const label = { ...G, fontSize: 11, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: ".07em" };
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
      if (!series.has(key)) series.set(key, { ...item, type: "installment", firstYear: row.year, firstMonth: row.month, finish: finishFromDate(exact?.last_due_date), remainingAmount: exact?.remaining_amount ?? null, linkedRefunds: exact?.linked_refunds_amount ?? null });
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
    <span style={{ ...G, fontSize: 11, color: T.inkLight }}>{title}</span>
    <div style={{ display: "inline-flex", flexWrap: "wrap", gap: 2, padding: 3, borderRadius: 9, background: T.grayLight }}>
      {options.map((count) => <Btn key={count} small variant={selected === count ? "dark" : "ghost"} aria-pressed={selected === count} onClick={() => onChange(count)} style={{ padding: "5px 9px", fontSize: 11 }}>
        {count === 0 ? "Sem histórico" : `${count} meses`}
      </Btn>)}
    </div>
  </div>;
}

function SegmentedControl({ title, options, selected, onChange }) {
  return <div role="group" aria-label={title} style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
    <span style={{ ...G, fontSize: 11, color: T.inkLight }}>{title}</span>
    <div style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 9, background: T.grayLight }}>
      {options.map(([value, caption]) => <Btn key={value} small variant={selected === value ? "dark" : "ghost"} aria-pressed={selected === value} onClick={() => onChange(value)} style={{ padding: "5px 9px", fontSize: 11 }}>{caption}</Btn>)}
    </div>
  </div>;
}

function Metric({ title, value, detail, testId, detailTestId, style }) {
  return <Card style={{ ...cardStyle, ...style }}><div style={label}>{title}</div><div data-testid={testId} style={{ ...G, ...NUM, fontSize: 22, fontWeight: 800, marginTop: 5 }}>{value}</div>{detail && <div data-testid={detailTestId} style={{ ...G, fontSize: 12, color: T.inkLight, marginTop: 5 }}>{detail}</div>}</Card>;
}

const progress = (part, whole) => whole > 0 && Number.isFinite(part) ? Math.max(0, Math.min(100, part / whole * 100)) : 0;
function ProgressLine({ value, max, color = T.blue }) {
  return <div aria-hidden="true"><ProgBar pct={progress(value, max)} color={color} h={5} /></div>;
}
function SectionHeading({ children }) { return <h2 style={{ ...G, fontSize: 19, margin: "10px 0 0", fontWeight: 800 }}>{children}</h2>; }

function Inventory({ rows, remainingSeries, currency, groupBy, sortBy, onMove, isMobile, cardId }) {
  const items = useMemo(() => inventorySeries(rows, remainingSeries), [rows, remainingSeries]);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef(null);
  useFocusTrap(sheetRef, sheetOpen);
  useEffect(() => {
    if (!sheetOpen) return undefined;
    sheetRef.current?.querySelector('[aria-label="Fechar detalhes"]')?.focus();
    const onKeyDown = (event) => { if (event.key === "Escape") setSheetOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sheetOpen]);
  const navigate = useNavigate();
  const filtered = useMemo(() => items.filter((item) => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return !query || [item.description, item.category_name, String(item.amount), moneyValue(item.amount, currency)].some((field) => String(field || "").toLocaleLowerCase("pt-BR").includes(query));
  }), [items, search, currency]);
  const grouped = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => sortBy === "value" ? Number(b.amount) - Number(a.amount)
      : sortBy === "progress" ? progress(b.installment_number, b.total_installments) - progress(a.installment_number, a.total_installments)
      : (b.remainingAmount == null ? -Infinity : Number(b.remainingAmount)) - (a.remainingAmount == null ? -Infinity : Number(a.remainingAmount)));
    const groups = new Map();
    for (const item of sorted) {
      const key = groupBy === "category" ? item.category_name || "Sem categoria" : groupBy === "month" ? item.type === "recurring" ? "Recorrências" : item.finish ? `Termina em ${item.finish}` : "Termina após o período consultado" : "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    return [...groups].map(([name, list]) => ({ name, list }));
  }, [filtered, groupBy, sortBy]);
  const selected = filtered.find((item) => `${item.type}:${item.series_id ?? item.transaction_id}` === selectedKey) || filtered[0] || null;
  const remaining = selected?.remainingAmount ?? null;
  const selectedDetail = selected && <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
    <div><h3 style={{ ...G, fontSize: 16, margin: 0 }}>{selected.description}</h3><span style={{ ...G, fontSize: 11, color: T.inkLight }}>{selected.category_name || "Sem categoria"}</span>{Number(selected.linkedRefunds) > 0 && <span style={{ ...G, fontSize: 11, color: T.green, marginLeft: 7 }}>↺ {moneyValue(selected.linkedRefunds, currency)} estornado</span>}</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {[[selected.type === "recurring" ? "Por mês" : "Por parcela", moneyValue(selected.amount, currency)],
        [selected.type === "recurring" ? "Recorrência" : `${Math.max(0, Number(selected.total_installments) - Number(selected.installment_number) + 1)}× restam`, moneyValue(remaining, currency)],
        ["Total original", "—"],
        ["Última parcela", selected.finish || "—"]].map(([heading, value]) => <div key={heading} style={{ padding: 10, border: `1px solid ${T.border}`, borderRadius: 9 }}><div style={label}>{heading}</div><strong style={{ ...G, ...NUM, fontSize: 13 }}>{value}</strong></div>)}
    </div>
    {selected.type === "installment" && <div><div style={label}>{selected.total_installments} parcelas · {Math.max(0, Number(selected.installment_number) - 1)} anteriores</div><div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>{Array.from({ length: Math.min(Number(selected.total_installments), 60) }, (_, index) => <span key={index} style={{ width: 16, height: 16, borderRadius: "50%", background: index === Number(selected.installment_number) - 1 ? T.blueLight : T.grayLight, border: `2px solid ${index === Number(selected.installment_number) - 1 ? T.blue : T.border}` }} />)}</div><div style={{ ...G, fontSize: 10, color: T.inkLight, marginTop: 5 }}>anel azul = parcela deste mês · demais parcelas sem estado de pagamento informado</div></div>}
    <div style={{ display: "grid", gap: 7 }}>
      {selected.type === "installment" && <Btn variant="blue" aria-label={`Mover ${selected.description}`} onClick={() => { setSheetOpen(false); onMove({ item: selected }); }}>↻ Mover para outra fatura</Btn>}
      <Btn variant="outGray" onClick={() => navigate({ to: cardAllTransactionsPath(cardId) })}>↗ Ver em Lançamentos</Btn>
    </div>
  </div>;
  return <section role="region" aria-label="Inventário de compromissos" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <SectionHeading>Inventário de compromissos</SectionHeading>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
      <input type="search" aria-label="Buscar compromissos" placeholder="Buscar parcela, categoria ou valor..." value={search} onChange={(event) => setSearch(event.target.value)} style={{ ...G, width: isMobile ? "100%" : 260, padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 9, background: T.surface }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <SegmentedControl title="Agrupar por" options={[["purchase", "Compra"], ["category", "Categoria"], ["month", "Mês"]]} selected={groupBy} onChange={(value) => onMove({ groupBy: value })} />
        <SegmentedControl title="Ordenar por" options={[["value", "Valor"], ["progress", "Progresso"], ["remaining", "Restante"]]} selected={sortBy} onChange={(value) => onMove({ sortBy: value })} />
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1.3fr) minmax(0,1fr)", alignItems: "start", gap: 14 }}>
      <Card style={{ overflow: "hidden", minWidth: 0 }}><div className="fincla-scroll" style={{ maxHeight: 475, overflowY: "auto", padding: 8 }}>
        {grouped.map(({ name, list }) => <div key={name}>
          {name && <div style={{ ...G, background: T.bg, padding: "8px 10px", fontSize: 11, fontWeight: 700, display: "flex", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 1 }}><span>{name} · {list.length} {list.length === 1 ? "item" : "itens"}</span><span>{moneyValue(sum(list), currency)}</span></div>}
          {list.map((item) => { const key = `${item.type}:${item.series_id ?? item.transaction_id}`; const active = selected === item; return <button key={key} type="button" aria-label={`Detalhar ${item.description}`} aria-pressed={active} onClick={() => { setSelectedKey(key); if (isMobile) setSheetOpen(true); }} style={{ ...G, width: "100%", display: "flex", alignItems: "center", gap: 9, textAlign: "left", background: active ? T.blueLight : T.surface, border: 0, borderRadius: 8, padding: 9, cursor: "pointer" }}>
            <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 8, display: "grid", placeItems: "center", background: T.grayLight, fontWeight: 700 }}>{item.type === "recurring" ? "↻" : "▣"}</span>
            <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}{Number(item.linkedRefunds) > 0 && <span style={{ color: T.green, marginLeft: 4 }}>↺</span>}</span><ProgressLine value={item.installment_number || 0} max={item.total_installments || 1} color={T.blue} /></span>
            <span style={{ textAlign: "right" }}><strong style={{ ...NUM, fontSize: 12, whiteSpace: "nowrap" }}>{moneyValue(item.amount, currency)}</strong><small style={{ display: "block", color: T.inkLight }}>{item.type === "recurring" ? "↻" : `${item.installment_number}/${item.total_installments}`}</small></span>
          </button>; })}
        </div>)}
        {filtered.length === 0 && <p style={{ ...G, fontSize: 12, color: T.inkLight }}>Nenhum compromisso encontrado.</p>}
      </div><div style={{ ...G, fontSize: 11, color: T.inkLight, padding: "9px 14px", borderTop: `1px solid ${T.border}` }}>{items.length} compromissos · role para ver todos</div></Card>
      {!isMobile && <Card style={{ ...cardStyle, position: "sticky", top: 0 }}>{selectedDetail || <p style={{ ...G, fontSize: 12 }}>Selecione um compromisso.</p>}</Card>}
    </div>
    {isMobile && sheetOpen && selected && <div ref={sheetRef} role="dialog" aria-modal="true" aria-label={`Detalhes de ${selected.description}`} style={{ position: "fixed", inset: 0, zIndex: 90, background: "#0008", display: "flex", alignItems: "flex-end" }} onClick={() => setSheetOpen(false)}><Card className="fincla-scroll" style={{ ...cardStyle, width: "100%", maxHeight: "85dvh", overflowY: "auto", borderRadius: "16px 16px 0 0" }} onClick={(event) => event.stopPropagation()}><Btn variant="ghost" onClick={() => setSheetOpen(false)} style={{ float: "right" }} aria-label="Fechar detalhes">✕</Btn>{selectedDetail}</Card></div>}
  </section>;
}

function CommitmentsRay({ isMobile, currency, recurring, recurringMonthly, recurringNextYear, recurringInvoicePercent, seriesById, seriesError, mutationPending, onLowUsage, lowUsageMonthly, largestInstallments, nearestToEnd, reduction, finishing, inventoryReady, bucketDatesKnown, dayBuckets, largestBucket, monthly, periodCategories, categoryPeriodLabel, categoryAverageKnown, periodCount }) {
  const panelHeading = { ...G, fontSize: 14, fontWeight: 750, margin: 0 };
  const row = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12, padding: "5px 0" };
  return <>
    <SectionHeading>Raio-X de parcelas e assinaturas</SectionHeading>
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,minmax(0,1fr))", gap: 12 }}>
      <Card style={cardStyle}>
        <h3 style={panelHeading}>▣ Assinaturas & recorrências</h3>
        <div data-testid="recurring-monthly" style={{ ...G, ...NUM, fontSize: 21, fontWeight: 800, color: T.purple, marginTop: 9 }}>{moneyValue(recurringMonthly, currency)} <span style={{ fontSize: 12, color: T.inkLight }}>/mês</span></div>
        <div style={{ display: "flex", gap: 20, margin: "9px 0 10px" }}>
          <div><div style={label}>Total anual</div><strong style={{ ...G, ...NUM, fontSize: 12 }}>{moneyValue(recurringNextYear, currency)}</strong></div>
          <div><div style={label}>% da fatura atual</div><strong style={{ ...G, ...NUM, fontSize: 12 }}>{recurringInvoicePercent === null ? "—" : `${recurringInvoicePercent}%`}</strong></div>
        </div>
        {seriesError && <p role="alert">Baixo uso indisponível: não foi possível carregar as marcações.</p>}
        <div className="fincla-scroll" style={{ maxHeight: 250, overflowY: "auto" }}>{recurring.map((item, index) => <div key={`${item.series_id}:${item.due_date}:${index}`} style={row}>
          <span aria-hidden="true" style={{ color: T.purple }}>↻</span><span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</span>
          {typeof seriesById.get(item.series_id)?.is_low_usage === "boolean" ? <label style={{ ...G, fontSize: 10, whiteSpace: "nowrap", color: T.inkLight }}><input type="checkbox" aria-label={`Baixo uso: ${item.description}`} checked={seriesById.get(item.series_id).is_low_usage} disabled={mutationPending} onChange={() => onLowUsage(item)} /> baixo uso</label> : null}
          <strong style={{ ...G, ...NUM, fontSize: 11, whiteSpace: "nowrap" }}>{moneyValue(item.amount, currency)}</strong>
        </div>)}</div>
        {recurring.length === 0 && <p style={{ ...G, fontSize: 12, color: T.inkLight }}>{inventoryReady ? "Sem recorrências neste mês." : "Recorrências indisponíveis neste mês."}</p>}
        {lowUsageMonthly > 0 && <div style={{ ...G, fontSize: 11, background: T.amberLight, borderRadius: 8, padding: 9, marginTop: 10 }}>Marcadas como baixo uso somam <b>{moneyValue(lowUsageMonthly, currency)}/mês</b> — revisar pode liberar até <b>{moneyValue(lowUsageMonthly * 12, currency)}/ano</b>.</div>}
      </Card>
      <Card style={cardStyle}><h3 style={panelHeading}>↗ Maiores parcelas ativas</h3><div style={{ marginTop: 8 }}>{largestInstallments.map((item) => <div key={item.series_id ?? item.transaction_id} style={row}><span aria-hidden="true">▣</span><span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</strong><small style={{ color: T.inkLight }}>{Math.max(0, item.total_installments - item.installment_number + 1)}× restam</small></span><strong style={{ ...NUM, whiteSpace: "nowrap" }}>{moneyValue(item.amount, currency)}</strong></div>)}</div>{largestInstallments.length === 0 && <p style={{ fontSize: 12 }}>Sem parcelas ativas no período.</p>}</Card>
      <Card style={{ ...cardStyle, background: T.greenLight }}><h3 style={panelHeading}>✓ Redução na próxima fatura</h3><div style={{ ...G, ...NUM, fontSize: 22, fontWeight: 800, color: T.green, marginTop: 9 }}>{moneyValue(reduction, currency)}</div><p style={{ ...G, fontSize: 11, color: T.inkLight }}>{finishing === null ? "Inventário atual indisponível." : finishing.length ? `${finishing.length} parcela(s) chegam ao fim neste ciclo.` : "Nenhuma parcela termina neste ciclo — as mais próximas do fim estão abaixo."}</p><div style={{ borderTop: `1px solid ${T.border}`, margin: "12px 0" }} /><div style={label}>Parcelas mais próximas do fim</div>{nearestToEnd.map((item) => <div key={item.series_id ?? item.transaction_id} style={{ marginTop: 9 }}><div style={row}><span>{item.description}</span><strong style={{ ...NUM }}>{moneyValue(item.remainingAmount, currency)}</strong></div><ProgressLine value={item.installment_number} max={item.total_installments} color={T.blue} /><small style={{ ...G, fontSize: 10, color: T.inkLight }}>{Math.max(0, item.total_installments - item.installment_number + 1)}× restam</small></div>)}</Card>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,minmax(0,1fr))", gap: 12 }}>
      <Card style={cardStyle}><h3 style={panelHeading}>▦ Onde você mais se compromete no mês</h3>{bucketDatesKnown ? <>
        {dayBuckets.map((bucket) => <div key={bucket.label} style={{ marginTop: 10 }}><div style={row}><span>{bucket.label}</span><strong style={{ ...NUM }}>{moneyValue(bucket.value, currency)} · {bucket.count} itens</strong></div><ProgressLine value={bucket.value} max={Math.max(1, ...dayBuckets.map((entry) => entry.value))} /></div>)}
        {monthly > 0 && largestBucket && <div style={{ ...G, fontSize: 11, background: T.blueLight, color: T.inkMid, borderRadius: 8, padding: 9, marginTop: 12 }}>A maior concentração é <b>{largestBucket.label}</b>, com <b>{Math.round(progress(largestBucket.value, monthly))}%</b> do valor comprometido no mês.</div>}
      </> : <p style={{ ...G, fontSize: 12 }}>Datas indisponíveis neste mês.</p>}</Card>
      <Card style={cardStyle}><h3 style={panelHeading}>▥ Média por categoria — {categoryPeriodLabel}</h3>{periodCategories.map(({ id, name, amount }, index) => <div key={id} style={{ marginTop: 10 }}><div style={row}><span>{name}</span><strong style={{ ...NUM }}>{moneyValue(amount / periodCount, currency)}/mês</strong></div><ProgressLine value={amount} max={periodCategories[0]?.amount} color={[T.purple, T.inkMid, T.blue, T.amber, T.green][index % 5]} /></div>)}{periodCategories.length === 0 && <p style={{ ...G, fontSize: 12 }}>{categoryAverageKnown ? "Sem compromissos no período." : "Média indisponível: faltam dados de um ou mais meses do período."}</p>}</Card>
    </div>
  </>;
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
  const [activeTimelineKey, setActiveTimelineKey] = useState(null);
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
  const detailRows = [...rows].filter((row) => keyOf(row) >= nowKey).sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
  const nextMonthKey = detailRows.find((row) => keyOf(row) > nowKey);
  const monthNow = rows.find((row) => keyOf(row) === nowKey) ?? null;
  const knownRows = rows.filter((row) => inventoryKnown(row, currency));
  const browsableRows = rows.filter((row) => inventoryCurrencyKnown(row, currency));
  const currencyMismatch = rows.some((row) => [...(row.installments || []), ...(row.recurrences || [])]
    .some((item) => item.amount_currency !== currency));
  const allKnown = rows.length > 0 && knownRows.length === rows.length;
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
  const dayBuckets = [
    { label: "Início do mês (dias 1–10)", from: 1, to: 10, value: 0, count: 0 },
    { label: "Meio do mês (dias 11–20)", from: 11, to: 20, value: 0, count: 0 },
    { label: "Fim do mês (dias 21–31)", from: 21, to: 31, value: 0, count: 0 },
  ];
  const bucketDatesKnown = inventoryKnown(monthNow, currency) && [...installments(monthNow), ...monthNow.recurrences]
    .every((item) => /^\d{4}-\d{2}-\d{2}$/.test(String(item.due_date || "")) && Number(item.due_date.slice(8, 10)) >= 1 && Number(item.due_date.slice(8, 10)) <= 31);
  if (bucketDatesKnown) {
    for (const item of [...installments(monthNow), ...recurring]) {
      const day = Number(item.due_date?.slice(8, 10));
      const bucket = dayBuckets.find((entry) => day >= entry.from && day <= entry.to);
      if (bucket) { bucket.value += Number(item.amount); bucket.count += 1; }
    }
  }
  const largestBucket = [...dayBuckets].sort((a, b) => b.value - a.value)[0];
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
    <Btn variant="ghost" onClick={back} style={{ alignSelf: "flex-start", color: T.blue, paddingLeft: 0 }}><ArrowLeft size={14} /> Cartão</Btn>
    {!state.loading && card && <p style={{ margin: 0, fontSize: 12, color: T.inkLight }}>{card.brand} •{card.last4} · {card.description}</p>}
    <PageTitle sans="Parcelas &" serif="Compromissos" />
    {state.loading && <p role="status">Carregando compromissos…</p>}
    {state.error && <p role="alert">{state.error}</p>}
    {!state.loading && future && <>
      <Card style={{ padding: "9px 12px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}><strong style={{ ...G, fontSize: 11 }}>▦ Período</strong>
        <PeriodPicker title="Histórico" options={[0, 3, 6, 12]} selected={historyMonths} onChange={setHistoryMonths} />
        <PeriodPicker title="Projeção" options={[3, 6, 12]} selected={futureMonths} onChange={setFutureMonths} />
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(3, minmax(0, 1fr))", gap }}>
        <Metric title="Parcelas ativas" value={balanceKnown ? `${balance.series.length} itens` : "—"} detail={balanceKnown ? "Compras parceladas com saldo pendente" : "Inventário exato indisponível"} />
        <Metric title="Comprometido em parcelas" value={moneyValue(balanceKnown ? balance.net_amount : null, currency)} testId="committed-total" detail={!currency ? "Moeda do cartão indisponível" : balanceKnown ? `Parcelas pendentes ${moneyValue(balance.gross_amount, currency)} − estornos vinculados ${moneyValue(balance.linked_refunds_amount, currency)}. Recorrências à parte.` : "Saldo exato indisponível; confira a moeda e tente atualizar os dados."} />
        <Metric title="Comprometimento mensal" value={usage === null ? "—" : `${Math.round(usage)}%`} detail={monthly === null ? "Valor mensal indisponível" : card.credit_limit == null ? `${moneyValue(monthly, currency)} · limite não informado` : `${moneyValue(monthly, currency)} de um limite de ${moneyValue(card.credit_limit, currency)}`} detailTestId="monthly-committed" style={isMobile ? { gridColumn: "1 / -1" } : undefined} />
      </div>
      {usage !== null && usage >= 30 && <div role="status" style={{ ...G, fontSize: 12, color: T.inkMid, background: T.amberLight, border: `1px solid ${T.amber}`, borderRadius: 9, padding: 10 }}><b style={{ color: T.amber }}>Comprometimento elevado</b> — {Math.round(usage)}% do limite está comprometido por parcelas e assinaturas neste mês. Considere segurar novas compras parceladas até algumas terminarem.</div>}
      <Card style={cardStyle}><section role="region" aria-label="Linha do tempo do compromisso"><h2 style={{ ...G, margin: "0 0 12px", fontSize: 17 }}>Linha do tempo do compromisso</h2>
        {state.historyError && historyMonths > 0 && <p role="alert" style={{ fontSize: 12 }}>Não foi possível carregar o histórico de compromissos.</p>}
        <div style={{ ...G, display: "inline-block", alignSelf: "flex-start", background: T.ink, color: T.surface, fontSize: 10, borderRadius: 8, padding: "6px 9px", marginBottom: 7 }}>{monthNow ? period(monthNow) : "Mês atual"} · {moneyValue(monthly, currency)} · {balanceKnown ? `${balance.series.length} parcelas` : "parcelas indisponíveis"} + {inventoryKnown(monthNow, currency) ? `${recurring.length} recorrências` : "recorrências indisponíveis"}</div>
        <div className="fincla-scroll" style={{ overflowX: "auto" }}><div style={{ display: "flex", alignItems: "flex-end", gap: 8, minWidth: Math.max(520, timeline.length * 74), height: 155 }}>
          {timeline.map((entry) => <div key={entry.key} data-testid={`timeline-${entry.key}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", textAlign: "center", height: "100%", minWidth: 58 }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", height: 112 }}>
              {entry.value !== null && currency ? <div data-testid={`timeline-bar-${entry.key}`} role="img" aria-label={`${entry.label}: ${moneyValue(entry.value, currency)}`} tabIndex={0} onMouseEnter={() => setActiveTimelineKey(entry.key)} onMouseLeave={() => setActiveTimelineKey(null)} onFocus={() => setActiveTimelineKey(entry.key)} onBlur={() => setActiveTimelineKey(null)} style={{ position: "relative", width: "100%", height: `${entry.value > 0 ? Math.max(5, Math.round(entry.value / largestCommitment * 104)) : 2}px`, borderRadius: "4px 4px 0 0", background: entry.phase === "history" ? T.grayLight : entry.phase === "current" ? T.blue : T.blueBar, outline: entry.phase === "current" ? `1px solid ${T.ink}` : "none" }}>{activeTimelineKey === entry.key && <span role="tooltip" style={{ ...G, ...NUM, position: "absolute", bottom: "calc(100% + 5px)", left: "50%", transform: "translateX(-50%)", zIndex: 2, borderRadius: 6, padding: "4px 6px", background: T.ink, color: T.surface, whiteSpace: "nowrap", fontSize: 10 }}>{moneyValue(entry.value, currency)}</span>}</div> : <span style={{ ...G, fontSize: 10, color: T.inkLight }}>Sem dados</span>}
            </div><span style={{ ...G, fontSize: 10, fontWeight: entry.phase === "current" ? 800 : 500, marginTop: 5 }}>{entry.label}</span>
          </div>)}
        </div></div>
        {isMobile && <small style={{ color: T.inkLight }}>deslize para ver todo o período →</small>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>{[["Histórico", T.grayLight], ["Atual", T.blue], ["Projeção", T.blueBar]].map(([name, color]) => <span key={name} style={{ ...G, fontSize: 10, color: T.inkLight }}><i style={{ display: "inline-block", width: 8, height: 8, background: color, marginRight: 4 }} />{name}</span>)}</div>
      </section></Card>
      <Card style={cardStyle}><section role="region" aria-label="Detalhe por mês"><h2 style={{ ...G, margin: "0 0 12px", fontSize: 17 }}>Detalhe por mês</h2><div className="fincla-scroll" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 5 }}>
        {detailRows.slice(0, futureMonths).map((row) => <div key={keyOf(row)} data-testid={`detail-month-${keyOf(row)}`} style={{ flex: "0 0 180px", border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{period(row)} {nextMonthKey && keyOf(row) === keyOf(nextMonthKey) && <span style={{ color: T.blue, fontSize: 11 }}>Próximo</span>}</strong><strong>{moneyValue(inventoryKnown(row, currency) ? committed(row) : null, currency)}</strong></div>
          {inventoryKnown(row, currency) ? <>
            <div style={{ marginTop: 8, fontSize: 12, color: T.inkLight }}>{installments(row).length} parcelas · {row.recurrences.length} recorrências</div>
            {installments(row).length === 0 ? <p style={{ ...G, fontSize: 11, color: T.inkLight }}>Sem parcelas previstas</p> : [...installments(row)].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 3).map((item) => <div key={item.transaction_id} style={{ display: "flex", justifyContent: "space-between", gap: 7, marginTop: 6, fontSize: 11 }}><span>{item.description}</span><span>{moneyValue(item.amount, currency)}</span></div>)}
            <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 7 }}>+ {moneyValue(sum(row.recurrences), currency)} em assinaturas</div>
          </> : <div style={{ marginTop: 8, fontSize: 12, color: T.inkLight }}>Inventário indisponível</div>}
        </div>)}
      </div>{isMobile && <small style={{ color: T.inkLight }}>deslize para ver todos os meses →</small>}</section></Card>
      <CommitmentsRay isMobile={isMobile} currency={currency} recurring={recurring} recurringMonthly={recurringMonthly} recurringNextYear={recurringNextYear} recurringInvoicePercent={recurringInvoicePercent} seriesById={seriesById} seriesError={state.seriesError} mutationPending={mutation.pending} onLowUsage={toggleLowUsage} lowUsageMonthly={lowUsageMonthly} largestInstallments={largestInstallments} nearestToEnd={nearestToEnd} reduction={reduction} finishing={finishing} inventoryReady={inventoryKnown(monthNow, currency)} bucketDatesKnown={bucketDatesKnown} dayBuckets={dayBuckets} largestBucket={largestBucket} monthly={monthly} periodCategories={periodCategories} categoryPeriodLabel={categoryPeriodLabel} categoryAverageKnown={categoryAverageKnown} periodCount={historyMonths + futureMonths} />
      {currencyMismatch && <p role="alert" style={{ margin: 0, color: T.amber }}>A moeda dos compromissos recebidos não corresponde à moeda do cartão. Valores desses meses estão indisponíveis.</p>}
      {!allKnown && <p role="status" style={{ margin: 0, color: T.amber }}>O inventário de alguns meses está incompleto. Os itens disponíveis continuam listados abaixo.</p>}
      <Inventory rows={browsableRows} remainingSeries={balanceKnown ? balance.series : []} currency={currency} groupBy={groupBy} sortBy={sortBy} onMove={handleInventory} isMobile={isMobile} cardId={cardId} />
      {mutation.error && <p role="alert">{mutation.error}</p>}
      {moveItem && <div ref={moveDialogRef} role="dialog" aria-modal="true" aria-label={`Mover ${moveItem.description}`} style={{ position: "fixed", inset: 0, background: "#0008", zIndex: 100, display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center" }}><Card style={{ ...cardStyle, width: isMobile ? "100%" : 420, display: "flex", flexDirection: "column", gap: 12 }}><h2 style={{ margin: 0, fontSize: 18 }}>Mover {moveItem.description}</h2><p style={{ margin: 0, fontSize: 12 }}>As demais parcelas da compra serão reposicionadas automaticamente.</p><label>Fatura de destino <Select aria-label="Fatura de destino" value={targetMonth} onChange={(event) => setTargetMonth(event.target.value)} style={{ width: "100%" }}><option value="">Selecione o mês</option>{moveOptions.map((row) => <option key={keyOf(row)} value={keyOf(row)}>{period(row)}</option>)}</Select></label><div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><Btn variant="outGray" onClick={() => setMoveItem(null)}>Cancelar</Btn><Btn variant="blue" disabled={!targetMonth || mutation.pending} onClick={confirmMove}>Confirmar mudança</Btn></div></Card></div>}
    </>}
  </div>;
}
