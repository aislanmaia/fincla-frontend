import { useEffect, useRef, useState } from "react";

import { updateCreditCard } from "../../../api/creditCards";
import { BUDGETS_CHANGED_EVENT, listBudgets } from "../../../api/budgets";
import { Card, Btn } from "../../components/primitives";
import { categoryLabelPtForTag } from "../../data/categoryLabels.js";
import { formatMoney } from "../../money/formatMoney.js";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { NotesDialog } from "../cardHub/NotesDialog.jsx";
import { invoiceMoneyValue } from "./invoiceMoney.js";

const title = { ...G, fontSize: 18, fontWeight: 800, margin: 0, color: T.ink };
const caption = { ...G, fontSize: 12, color: T.inkMid };
const budgetRequests = new Map();

function getBudgetOnce(organizationId, requestKey) {
  if (!budgetRequests.has(requestKey)) {
    const request = listBudgets(organizationId, "monthly", true).finally(() => budgetRequests.delete(requestKey));
    budgetRequests.set(requestKey, request);
  }
  return budgetRequests.get(requestKey);
}

export function useInvoiceBudgetContext(organizationId, enabled, now, refreshToken = 0) {
  const [state, setState] = useState({ requestKey: null, status: "idle", budgets: [] });
  const [revision, setRevision] = useState(0);
  const loaded = useRef(new Map());
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const requestKey = `${organizationId}:${monthKey}:${refreshToken}:${revision}`;
  useEffect(() => {
    const invalidate = () => { loaded.current.clear(); setRevision((value) => value + 1); };
    window.addEventListener(BUDGETS_CHANGED_EVENT, invalidate);
    return () => window.removeEventListener(BUDGETS_CHANGED_EVENT, invalidate);
  }, []);
  useEffect(() => {
    if (!enabled || !organizationId) return;
    if (loaded.current.has(requestKey)) {
      setState({ requestKey, status: "ok", budgets: loaded.current.get(requestKey) });
      return;
    }
    let active = true;
    setState({ requestKey, status: "loading", budgets: [] });
    getBudgetOnce(organizationId, requestKey).then((result) => {
      if (active) {
        const budgets = result.budgets ?? [];
        loaded.current.set(requestKey, budgets);
        setState({ requestKey, status: "ok", budgets });
      }
    }).catch(() => {
      if (active) setState({ requestKey, status: "error", budgets: [] });
    });
    return () => { active = false; };
  }, [organizationId, enabled, requestKey]);
  return state.requestKey === requestKey ? state : { requestKey, status: "idle", budgets: [] };
}

export function InvoiceBudgetContext({ detail, invoice, budget, currency, isMobile, now }) {
  const current = invoice?.status === "open";
  const month = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const cycleStart = detail?.spending_pace?.cycle_start;
  const cycleEnd = detail?.spending_pace?.cycle_end;
  const cycleLabel = cycleStart && cycleEnd
    ? `${new Date(`${cycleStart}T12:00:00`).toLocaleDateString("pt-BR")}–${new Date(`${cycleEnd}T12:00:00`).toLocaleDateString("pt-BR")}`
    : "ciclo desta fatura";
  const activeBudgets = budget.budgets.filter((row) => row.period_type === "monthly" && row.is_active);
  const byTag = new Map(activeBudgets.map((row) => [row.tag_id, row]));
  const categories = Array.isArray(detail?.category_breakdown) ? detail.category_breakdown : [];
  const breakdownComplete = Array.isArray(detail?.category_breakdown) || invoice?.isEmpty === true;
  const categoriesIdentified = categories.every((category) => category.category_id != null);
  const categoryById = new Map(categories.filter((category) => category.category_id).map((category) => [category.category_id, category]));
  const rows = [
    ...activeBudgets.map((row) => ({ category: categoryById.get(row.tag_id) ?? null, budget: row })),
    ...categories.filter((category) => !byTag.has(category.category_id)).map((category) => ({ category, budget: null })),
  ];
  const format = (value, code) => code ? formatMoney(value, code) ?? "—" : "—";
  const col = isMobile ? "1fr" : "minmax(120px,1.2fr) repeat(4,minmax(90px,1fr))";
  return <section aria-label="Orçamentos atuais da organização" data-testid="invoice-budget" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <h3 style={title}>Orçamentos atuais da organização · {month}</h3>
    <p style={{ ...caption, margin: 0 }}>O orçamento considera o mês civil. O gasto desta fatura considera {cycleLabel}; os períodos podem ser diferentes e os valores não são subtraídos entre si.</p>
    {!current ? <Card style={{ padding: isMobile ? 16 : 20 }}><p style={{ ...caption, margin: 0 }}>O saldo dos orçamentos atuais não representa esta fatura histórica ou prevista. A API ainda não oferece um retrato do orçamento daquele período.</p></Card>
      : budget.status === "loading" || budget.status === "idle" ? <Card style={{ padding: isMobile ? 16 : 20, ...caption }}>Carregando orçamentos atuais…</Card>
        : budget.status === "error" ? <Card role="alert" style={{ padding: isMobile ? 16 : 20, ...caption }}>Não foi possível carregar os orçamentos atuais.</Card>
          : rows.length === 0 ? <Card style={{ padding: isMobile ? 16 : 20, ...caption }}>Nenhum orçamento mensal ativo nem gasto por categoria nesta fatura.</Card>
              : <Card style={{ padding: isMobile ? 4 : 0, overflow: "hidden" }}>
                {!isMobile && <div style={{ display: "grid", gridTemplateColumns: col, gap: 12, padding: "12px 16px", borderBottom: `2px solid ${T.ink}`, ...G, fontSize: 10, fontWeight: 800, color: T.inkMid, textTransform: "uppercase" }}>
                  <span>Categoria</span><span>Teto org.</span><span>Gasto org.</span><span>Sobra org.</span><span>Gasto na fatura</span>
                </div>}
                {rows.map(({ category, budget: row }, index) => {
                  const knownBudgetCurrency = Boolean(row?.currency);
                  const amount = knownBudgetCurrency ? format(row.amount, row.currency) : row ? "Moeda indisponível" : "Sem teto";
                  const spent = knownBudgetCurrency ? format(row.spent_amount, row.currency) : "—";
                  const remaining = knownBudgetCurrency ? format(row.remaining_amount, row.currency) : "—";
                  const invoiceSpend = category
                    ? format(category.total, currency)
                    : row?.currency && row.currency === currency && breakdownComplete && categoriesIdentified ? format(0, currency) : "—";
                  const categoryName = category?.category_name ?? row?.tag_name ?? "Sem categoria";
                  return <div key={row?.id ?? category?.category_id ?? `${categoryName}:${index}`} style={{ display: "grid", gridTemplateColumns: col, gap: isMobile ? 5 : 12, padding: isMobile ? "12px" : "14px 16px", borderBottom: index < rows.length - 1 ? `1px solid ${T.border}` : "none", alignItems: "center", ...G, fontSize: 12 }}>
                    <strong style={{ color: T.ink }}>{categoryLabelPtForTag({ name: categoryName })}</strong>
                    <span style={NUM}>{isMobile ? `Teto org.: ${amount}` : amount}</span>
                    <span style={NUM}>{isMobile ? `Gasto org.: ${spent}` : spent}</span>
                    <span style={{ ...NUM, color: knownBudgetCurrency && Number(row.remaining_amount) < 0 ? T.red : T.green }}>{isMobile ? `Sobra org.: ${remaining}` : remaining}</span>
                    <span style={{ ...NUM, fontWeight: 700 }}>{isMobile ? `Gasto nesta fatura: ${invoiceSpend}` : invoiceSpend}</span>
                    {knownBudgetCurrency && Number.isFinite(Number(row.usage_percent)) && <div style={{ gridColumn: "1 / -1", height: 4, background: T.grayLight, borderRadius: 99 }}><div style={{ width: `${Math.min(100, Math.max(0, Number(row.usage_percent)))}%`, height: "100%", background: Number(row.usage_percent) >= 100 ? T.red : Number(row.usage_percent) >= 80 ? T.amber : T.green, borderRadius: 99 }} /></div>}
                  </div>;
                })}
              </Card>}
  </section>;
}

function SummaryTile({ label, value, detail, color, onOpen }) {
  return <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
    <strong style={{ ...G, fontSize: 13, color: T.ink }}>{label}</strong>
    <span style={{ ...G, ...NUM, fontSize: 17, fontWeight: 800, color }}>{value}</span>
    <span style={caption}>{detail}</span>
    {onOpen && <Btn variant="ghost" small onClick={onOpen} style={{ alignSelf: "flex-start", padding: "4px 0", fontSize: 11, color: T.blue }}>ver {label.toLowerCase().replace(/^[^a-zà-ú]+/i, "")} →</Btn>}
  </Card>;
}

export function InvoiceSummaryTiles({ detail, card, organizationId, currency, isMobile, onFilter }) {
  const [notes, setNotes] = useState(card?.notes ?? "");
  const [notesOpen, setNotesOpen] = useState(false);
  useEffect(() => { setNotes(card?.notes ?? ""); }, [card?.notes]);
  const items = detail?.items ?? [];
  const installments = items.filter((item) => item.modality === "installment");
  const refunds = items.filter((item) => item.modality === "refund");
  const refundAmounts = refunds.map((item) => invoiceMoneyValue(item.amount, currency));
  const refundTotal = refundAmounts.every((amount) => amount !== null) ? refundAmounts.reduce((sum, amount) => sum + Math.abs(amount), 0) : null;
  const money = (value) => currency ? formatMoney(value, currency) ?? "—" : "—";
  const saveNotes = async (value) => {
    await updateCreditCard(card.id, { organization_id: organizationId, notes: value });
    setNotes(value);
  };
  return <>
    <section aria-label="Resumo da fatura" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, minmax(0, 1fr))", gap: isMobile ? 10 : 12 }}>
      <SummaryTile label="🔁 Recorrências" value="—" detail="Resumo de recorrências indisponível nesta fatura" color={T.purple} />
      <SummaryTile label="🧩 Parcelas" value={`${installments.length} nesta fatura`} detail={installments.length ? "Ver os lançamentos parcelados" : "Nenhuma parcela nesta fatura"} color={T.blue} onOpen={() => onFilter("installment")} />
      <SummaryTile label="↺ Estornos" value={refundTotal === null ? "—" : money(refundTotal)} detail={`${refunds.length} ${refunds.length === 1 ? "estorno" : "estornos"} nesta fatura`} color={T.green} onOpen={() => onFilter("refund")} />
      <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        <strong style={{ ...G, fontSize: 13, color: T.ink }}>📌 Anotação do cartão</strong>
        <span style={{ ...caption, overflowWrap: "anywhere", flex: 1 }}>{notes?.trim() || "Nenhuma anotação neste cartão."}</span>
        <Btn variant="ghost" small onClick={() => setNotesOpen(true)}>Editar anotação</Btn>
      </Card>
    </section>
    {notesOpen && <NotesDialog initialNotes={notes} isMobile={isMobile} onSave={saveNotes} onClose={() => setNotesOpen(false)} />}
  </>;
}
