import { useEffect, useRef, useState } from "react";

import { getInvoiceNote, saveInvoiceNote } from "../../../api/creditCards";
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

export function InvoiceSummaryTiles({ detail, card, organizationId, currency, isMobile, onFilter, year, month }) {
  // Anotação POR FATURA: `null` = nunca houve; texto vazio é uma anotação existente.
  const [note, setNote] = useState({ status: "loading", text: null });
  const [notesOpen, setNotesOpen] = useState(false);
  useEffect(() => {
    if (!card?.id || !organizationId || !year || !month) return undefined;
    let active = true;
    setNote({ status: "loading", text: null });
    getInvoiceNote(card.id, organizationId, year, month)
      .then((found) => { if (active) setNote({ status: "ok", text: found ? found.text : null }); })
      .catch(() => { if (active) setNote({ status: "error", text: null }); });
    return () => { active = false; };
  }, [card?.id, organizationId, year, month]);
  const summary = detail?.commitments_summary ?? null;
  const num = (value) => invoiceMoneyValue(value, currency);
  const money = (value) => currency && value !== null ? formatMoney(value, currency) ?? "—" : "—";
  const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
  const saveNotes = async (value) => {
    const saved = await saveInvoiceNote(card.id, organizationId, year, month, value);
    setNote({ status: "ok", text: saved.text });
  };
  return <>
    <section aria-label="Resumo da fatura" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, minmax(0, 1fr))", gap: isMobile ? 10 : 12 }}>
      <SummaryTile label="🔁 Recorrências" value={summary ? money(num(summary.recurring_total)) : "—"} detail={summary ? (summary.recurring_count ? `${plural(summary.recurring_count, "assinatura", "assinaturas")} nesta fatura` : "Nenhuma recorrência nesta fatura") : "Resumo indisponível nesta fatura"} color={T.purple} />
      <SummaryTile label="🧩 Parcelas" value={summary ? `${plural(summary.installments_count, "compra", "compras")} parcelada${summary.installments_count === 1 ? "" : "s"}` : "—"} detail={!summary ? "Resumo indisponível nesta fatura" : summary.ending_count ? `${plural(summary.ending_count, "termina", "terminam")} neste ciclo · libera ${money(num(summary.ending_released))}/mês` : summary.installments_count ? "Nenhuma termina neste ciclo" : "Nenhuma parcela nesta fatura"} color={T.blue} onOpen={summary?.installments_count ? () => onFilter("installment") : undefined} />
      <SummaryTile label="↺ Estornos" value={summary ? money(num(summary.refunds_total)) : "—"} detail={summary ? `${plural(summary.refunds_count, "estorno", "estornos")} nesta fatura` : "Resumo indisponível nesta fatura"} color={T.green} onOpen={summary?.refunds_count ? () => onFilter("refund") : undefined} />
      <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        <strong style={{ ...G, fontSize: 13, color: T.ink }}>📌 Anotação da fatura</strong>
        <span style={{ ...caption, overflowWrap: "anywhere", flex: 1 }}>{note.status === "loading" ? "Carregando anotação…" : note.status === "error" ? "Não foi possível carregar a anotação." : note.text?.trim() || "Nenhuma anotação nesta fatura."}</span>
        <Btn variant="ghost" small disabled={note.status !== "ok"} onClick={() => setNotesOpen(true)}>Editar anotação</Btn>
      </Card>
    </section>
    {notesOpen && <NotesDialog title="Anotação da fatura" label="Anotação da fatura" initialNotes={note.text ?? ""} isMobile={isMobile} onSave={saveNotes} onClose={() => setNotesOpen(false)} />}
  </>;
}
