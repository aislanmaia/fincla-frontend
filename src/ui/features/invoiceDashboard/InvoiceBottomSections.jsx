import { useEffect, useRef, useState } from "react";

import { updateCreditCard } from "../../../api/creditCards";
import { listBudgets } from "../../../api/budgets";
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

function getBudgetOnce(organizationId) {
  if (!budgetRequests.has(organizationId)) {
    const request = listBudgets(organizationId, "monthly", true).finally(() => budgetRequests.delete(organizationId));
    budgetRequests.set(organizationId, request);
  }
  return budgetRequests.get(organizationId);
}

export function useInvoiceBudgetContext(organizationId, enabled) {
  const [state, setState] = useState({ organizationId: null, status: "idle", budgets: [] });
  const loaded = useRef(new Map());
  useEffect(() => {
    if (!enabled || !organizationId) return;
    if (loaded.current.has(organizationId)) {
      setState({ organizationId, status: "ok", budgets: loaded.current.get(organizationId) });
      return;
    }
    let active = true;
    setState({ organizationId, status: "loading", budgets: [] });
    getBudgetOnce(organizationId).then((result) => {
      if (active) {
        const budgets = result.budgets ?? [];
        loaded.current.set(organizationId, budgets);
        setState({ organizationId, status: "ok", budgets });
      }
    }).catch(() => {
      if (active) setState({ organizationId, status: "error", budgets: [] });
    });
    return () => { active = false; };
  }, [organizationId, enabled]);
  return state;
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
  const categories = detail?.category_breakdown ?? [];
  const rows = categories.map((category) => ({ category, budget: byTag.get(category.category_id) ?? null }));
  const format = (value, code) => formatMoney(value, code) ?? "—";
  const col = isMobile ? "1fr" : "minmax(120px,1.2fr) repeat(4,minmax(90px,1fr))";
  return <section aria-label="Orçamentos atuais da organização" data-testid="invoice-budget" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <h3 style={title}>Orçamentos atuais da organização · {month}</h3>
    <p style={{ ...caption, margin: 0 }}>O orçamento considera o mês civil. O gasto desta fatura considera {cycleLabel}; os períodos podem ser diferentes e os valores não são subtraídos entre si.</p>
    {!current ? <Card style={{ padding: isMobile ? 16 : 20 }}><p style={{ ...caption, margin: 0 }}>O saldo dos orçamentos atuais não representa esta fatura histórica ou prevista. A API ainda não oferece um retrato do orçamento daquele período.</p></Card>
      : budget.status === "loading" || budget.status === "idle" ? <Card style={{ padding: isMobile ? 16 : 20, ...caption }}>Carregando orçamentos atuais…</Card>
        : budget.status === "error" ? <Card role="alert" style={{ padding: isMobile ? 16 : 20, ...caption }}>Não foi possível carregar os orçamentos atuais.</Card>
          : activeBudgets.length === 0 ? <Card style={{ padding: isMobile ? 16 : 20, ...caption }}>Nenhum orçamento mensal ativo nesta organização.</Card>
            : rows.length === 0 ? <Card style={{ padding: isMobile ? 16 : 20, ...caption }}>Esta fatura ainda não tem gastos por categoria para comparar ao contexto dos orçamentos atuais.</Card>
              : <Card style={{ padding: isMobile ? 4 : 0, overflow: "hidden" }}>
                {!isMobile && <div style={{ display: "grid", gridTemplateColumns: col, gap: 12, padding: "12px 16px", borderBottom: `2px solid ${T.ink}`, ...G, fontSize: 10, fontWeight: 800, color: T.inkMid, textTransform: "uppercase" }}>
                  <span>Categoria</span><span>Teto org.</span><span>Gasto org.</span><span>Sobra org.</span><span>Gasto na fatura</span>
                </div>}
                {rows.map(({ category, budget: row }, index) => {
                  const knownBudgetCurrency = Boolean(row?.currency);
                  const amount = knownBudgetCurrency ? format(row.amount, row.currency) : row ? "Moeda indisponível" : "Sem teto";
                  const spent = knownBudgetCurrency ? format(row.spent_amount, row.currency) : "—";
                  const remaining = knownBudgetCurrency ? format(row.remaining_amount, row.currency) : "—";
                  return <div key={category.category_id ?? `${category.category_name}:${index}`} style={{ display: "grid", gridTemplateColumns: col, gap: isMobile ? 5 : 12, padding: isMobile ? "12px" : "14px 16px", borderBottom: index < rows.length - 1 ? `1px solid ${T.border}` : "none", alignItems: "center", ...G, fontSize: 12 }}>
                    <strong style={{ color: T.ink }}>{categoryLabelPtForTag({ name: category.category_name })}</strong>
                    <span style={NUM}>{isMobile ? `Teto org.: ${amount}` : amount}</span>
                    <span style={NUM}>{isMobile ? `Gasto org.: ${spent}` : spent}</span>
                    <span style={{ ...NUM, color: knownBudgetCurrency && Number(row.remaining_amount) < 0 ? T.red : T.green }}>{isMobile ? `Sobra org.: ${remaining}` : remaining}</span>
                    <span style={{ ...NUM, fontWeight: 700 }}>{isMobile ? `Gasto nesta fatura: ${format(category.total, currency)}` : format(category.total, currency)}</span>
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
    {onOpen && <button type="button" onClick={onOpen} style={{ ...G, border: 0, background: "none", color: T.blue, padding: "4px 0", textAlign: "left", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>ver {label.toLowerCase().replace(/^[^a-zà-ú]+/i, "")} →</button>}
  </Card>;
}

export function InvoiceSummaryTiles({ detail, card, organizationId, currency, isMobile, onFilter }) {
  const [notes, setNotes] = useState(card?.notes ?? "");
  const [notesOpen, setNotesOpen] = useState(false);
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
