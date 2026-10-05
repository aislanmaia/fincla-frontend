import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { formatMoney } from "../../money/formatMoney.js";
import { invoiceDashboardPath } from "../../routing/invoiceRoute.js";
import {
  INVOICE_STATUS,
  INVOICE_STATUS_LABEL,
  describeDue,
  describePaidDate,
  monthName,
  monthNameLower,
  parseInvoiceKey,
} from "./hubInvoices.js";

/* Fechada usa âmbar bem distinto de Aberta (azul): já tem valor final, mas ainda não foi paga. */
export const STATUS_STYLE = {
  open: { bg: T.blueLight, fg: T.blue },
  closed: { bg: T.amberLight, fg: "#B45309" },
  paid: { bg: T.greenLight, fg: T.green },
  forecast: { bg: T.grayLight, fg: T.inkLight },
};

export function StatusBadge({ status }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.forecast;
  return (
    <span data-testid="invoice-status" style={{ ...G, fontSize: 11, fontWeight: 700, color: style.fg, background: style.bg, padding: "2px 8px", borderRadius: 9999, whiteSpace: "nowrap" }}>
      {INVOICE_STATUS_LABEL[status]}
    </span>
  );
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Link para o dashboard da fatura. `<a>` de verdade (abre em nova aba, copia
 * link); o clique simples navega pelo router sem recarregar.
 */
export function InvoiceDashboardLink({ cardId, invoice, onNavigate, children, style }) {
  const href = invoiceDashboardPath(cardId, invoice.year, invoice.month);
  return (
    <a href={href} data-testid="invoice-dashboard-link"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        e.stopPropagation();
        onNavigate(href);
      }}
      style={{ ...G, fontSize: 11, color: T.blue, textDecoration: "none", ...style }}>
      {children}
    </a>
  );
}

export function InvoiceCard({ invoice, cardId, currency, selected, width, onSelect, onNavigate, now }) {
  const { status } = invoice;
  const money = (v) => formatMoney(v, currency) ?? "—";
  const isOpenLike = status === INVOICE_STATUS.OPEN || status === INVOICE_STATUS.CLOSED;
  const prev = invoice.prevKey ? parseInvoiceKey(invoice.prevKey) : null;
  const vsColor = invoice.vsPercent > 0 ? T.red : T.green;
  const totalNode = invoice.isEmpty
    ? <div style={{ ...G, fontSize: 14, fontWeight: 700, color: T.inkMid }}>Sem lançamentos ainda</div>
    : <div style={{ ...G, ...NUM, fontSize: isOpenLike ? 24 : 20, fontWeight: 800, color: T.ink }}>{money(invoice.total)}</div>;

  return (
    <div
      role="group"
      aria-label={`Fatura de ${monthNameLower(invoice.month)} de ${invoice.year}, ${INVOICE_STATUS_LABEL[status]}`}
      aria-current={selected ? "true" : undefined}
      data-testid={`invoice-card-${invoice.key}`}
      data-status={status}
      data-selected={selected ? "true" : "false"}
      onClick={() => onSelect(invoice.key)}
      style={{
        width, flexShrink: 0, boxSizing: "border-box", scrollSnapAlign: "center", cursor: "pointer",
        background: T.surface, border: `1px solid ${selected ? T.ink : T.border}`, borderRadius: 14,
        boxShadow: selected ? T.md : T.sm, outline: selected ? `2px solid ${T.ink}` : "none", outlineOffset: 2,
        padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10,
        opacity: status === INVOICE_STATUS.FORECAST && !selected ? 0.8 : 1,
      }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.09em" }}>
            {status === INVOICE_STATUS.OPEN ? "Fatura atual" : status === INVOICE_STATUS.FORECAST ? "Fatura prevista" : "Fatura"}
          </div>
          <div style={{ ...G, ...NUM, fontSize: 15, fontWeight: 800, color: T.ink, marginTop: 2 }}>
            {monthName(invoice.month)} {invoice.year}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      <div>
        {totalNode}
        {invoice.vsPercent !== null && prev && (
          <div style={{ ...G, fontSize: 11, color: invoice.vsPercent === 0 ? T.inkMid : vsColor, marginTop: 2 }}>
            {invoice.vsPercent === 0
              ? `igual a ${monthNameLower(prev.month)}`
              : `${invoice.vsPercent > 0 ? "↑" : "↓"} ${Math.abs(invoice.vsPercent)}% vs ${monthNameLower(prev.month)}`}
          </div>
        )}
      </div>

      {isOpenLike && describeDue(invoice.dueDate, now) && (
        <div style={{ ...G, fontSize: 11, color: T.inkMid }}>🗓 {describeDue(invoice.dueDate, now)}</div>
      )}

      {isOpenLike && invoice.limitUsagePercent !== null && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ ...G, fontSize: 11, color: T.inkMid }}>Limite utilizado</span>
            <span style={{ ...G, ...NUM, fontSize: 11, fontWeight: 700, color: T.inkMid }}>{Math.round(invoice.limitUsagePercent)}%</span>
          </div>
          <div style={{ height: 4, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, invoice.limitUsagePercent))}%`, background: invoice.limitUsagePercent >= 90 ? T.red : invoice.limitUsagePercent >= 70 ? T.amber : T.green, borderRadius: 99 }} />
          </div>
        </div>
      )}

      {isOpenLike && invoice.isEmpty && (
        <div style={{ ...G, fontSize: 11, color: T.inkMid }}>A fatura aberta ainda não recebeu compras.</div>
      )}
      {isOpenLike && !invoice.isEmpty && invoice.itemsCount > 0 && (
        <div style={{ ...G, fontSize: 11, color: T.inkMid }}>
          {plural(invoice.itemsCount, "lançamento", "lançamentos")}
          {invoice.topCategory ? ` · maior categoria: ${invoice.topCategory}` : ""}
        </div>
      )}
      {status === INVOICE_STATUS.PAID && (
        <div style={{ ...G, fontSize: 11, color: T.inkMid }}>
          {[describePaidDate(invoice.paidDate), invoice.itemsCount > 0 ? plural(invoice.itemsCount, "lançamento", "lançamentos") : null].filter(Boolean).join(" · ") || "Fatura paga"}
        </div>
      )}
      {status === INVOICE_STATUS.FORECAST && (
        <div style={{ ...G, fontSize: 11, color: T.inkMid }}>
          {invoice.itemsCount > 0 ? `${plural(invoice.itemsCount, "parcela já garantida", "parcelas já garantidas")}` : "Previsão com base nos compromissos já assumidos"}
        </div>
      )}

      <InvoiceDashboardLink cardId={cardId} invoice={invoice} onNavigate={onNavigate}>
        ver dashboard da fatura →
      </InvoiceDashboardLink>
    </div>
  );
}
