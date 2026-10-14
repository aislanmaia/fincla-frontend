import { X } from "lucide-react";

import { Badge, Btn } from "../../components/primitives.jsx";
import { formatYmdToBrDisplay, pickCategoryTagFromApiTransaction } from "../../data/transactionsAdapter.js";
import { formatMoneyAbs } from "../../money/formatMoney.js";
import { T } from "../../tokens.js";
import { G, NUM } from "../../typography.js";
import { LedgerModal } from "./LedgerDialogs.jsx";
import { forecastEnd, installmentOf, remainingInstallments } from "./ledgerModel.js";

const statusText = (row) => row.type === "refund" ? "Estorno" : row.status === "paid" ? "Paga" : row.status === "confirmed" ? "A pagar" : "Pendente";
const line = { ...G, display: "flex", justifyContent: "space-between", gap: 10, borderBottom: `1px solid ${T.border}`, padding: "10px 0", fontSize: 12 };

function Rows({ entries }) {
  return entries.map(([label, value]) => <div key={label} style={line}><span style={{ color: T.inkMid }}>{label}</span><strong style={NUM}>{value}</strong></div>);
}

/** Detalhe do lançamento: dados, cronograma da parcela, mudança de fatura e estorno. */
export function LedgerDetail({ row, currency, closeRef, onClose, onMove, onRefund, onOpenOriginal }) {
  // Mover fatura e estornar valem para o cartão da tela: em "todos os cartões" a página não passa as ações.
  const code = row.value_currency || currency;
  const money = (value) => code ? formatMoneyAbs(value, code) : "—";
  const part = installmentOf(row);
  const rest = remainingInstallments(row);
  const hasRefund = (row.refunds_summary?.count ?? 0) > 0;
  const category = pickCategoryTagFromApiTransaction(row)?.label || row.category || "—";
  return <>
    <button ref={closeRef} type="button" aria-label="Fechar detalhes" onClick={onClose} style={{ float: "right", border: 0, background: "none", cursor: "pointer" }}><X size={18} /></button>
    <h2 style={{ ...G, margin: "0 0 6px", fontSize: 18 }}>{row.description}</h2>
    <div style={{ marginBottom: 14 }}><Badge bg={T.greenLight} color={T.green}>{category}</Badge></div>
    <Rows entries={[["Data", formatYmdToBrDisplay(String(row.date).slice(0, 10)) || row.date], ["Valor", money(row.value)], ["Situação", statusText(row)]]} />
    {part && <>
      <h3 style={{ ...G, fontSize: 14, margin: "18px 0 4px" }}>Parcela</h3>
      <Rows entries={[
        ["Parcela atual", `${part.installment_number}/${part.total_installments}`],
        ["Por parcela", money(part.amount)],
        ["Restam", rest === 0 ? "quitada" : `${rest}× · ${money(part.amount * rest)}`],
        ["Total original", money(part.amount * part.total_installments)],
        ["Última parcela (prevista)", forecastEnd(row) ?? "—"],
        ["Vencimento desta parcela", formatYmdToBrDisplay(part.due_date) || "—"],
      ]} />
      <p style={{ ...G, fontSize: 11, color: T.inkMid }}>Cronograma regular: total e última parcela somam o valor desta parcela; centavos de arredondamento podem diferir do banco.</p>
      {onMove && <Btn variant="outGray" onClick={() => onMove(row)} style={{ width: "100%" }}>↻ Mover para outra fatura</Btn>}
    </>}
    <div style={{ marginTop: 16 }}>
      {row.type === "refund"
        ? (row.refund_of_transaction_id ? <Btn variant="outGray" onClick={() => onOpenOriginal(row.refund_of_transaction_id)} style={{ width: "100%" }}>↗ Ver lançamento original</Btn> : null)
        : hasRefund
          ? <p role="status" style={{ ...G, margin: 0, fontSize: 12, color: T.green, fontWeight: 700 }}>✓ Esta compra possui estorno relacionado</p>
          : !onRefund ? null : <button type="button" onClick={() => onRefund(row)} style={{ ...G, width: "100%", minHeight: 40, border: `1.5px dashed ${T.green}`, borderRadius: 10, background: T.greenLight, color: T.green, fontWeight: 700, cursor: "pointer" }}>↺ Lançar estorno desta compra</button>}
    </div>
  </>;
}

const ICONS = { uncategorized: "🏷", duplicate: "⚠️", insight: "💡" };

/** Drawer do Assistente (bottom sheet no celular): observações sobre as linhas carregadas, cada uma com a ação possível. */
export function AssistantDrawer({ insights, loadedCount, onClose, onSelect, onCategorize, isMobile = false }) {
  return <LedgerModal title="Assistente" side={!isMobile} sheet={isMobile} onClose={onClose}>
    <p style={{ ...G, margin: 0, fontSize: 11, color: T.inkMid }}>Observações sobre os {loadedCount} lançamentos carregados na tela.</p>
    {insights.length === 0 && <p role="status" style={{ ...G, margin: 0, fontSize: 12, color: T.inkMid }}>Nada fora do comum nos lançamentos carregados.</p>}
    {insights.map((item, index) => <section key={`${item.kind}-${index}`} aria-label={item.title} style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
      <strong style={{ ...G, fontSize: 12 }}><span aria-hidden="true">{ICONS[item.kind]} </span>{item.title}</strong>
      <span style={{ ...G, fontSize: 11, color: T.inkMid }}>{item.detail}</span>
      {item.kind === "uncategorized" && <Btn variant="outGray" small onClick={() => onCategorize(item.rowIds)}>Categorizar</Btn>}
      {item.kind === "duplicate" && <Btn variant="outGray" small onClick={() => onSelect(item.rowIds)}>Revisar</Btn>}
    </section>)}
  </LedgerModal>;
}
