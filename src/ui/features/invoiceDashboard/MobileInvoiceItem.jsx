import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { formatMoney } from "../../money/formatMoney.js";
import { INVOICE_STATUS, INVOICE_STATUS_LABEL, monthName, monthNameLower } from "../cardHub/hubInvoices.js";
import { StatusBadge } from "../cardHub/InvoiceCard.jsx";
import { Headline, InvoiceDetailBody } from "./InvoiceDetailBody.jsx";
import { plural } from "./invoiceFormat.js";

/**
 * Item do carrossel do mobile: cada item é o próprio card da fatura. O selecionado
 * traz o detalhe completo; os demais só o resumo que histórico/futuras já entregam
 * (total, status, nº de lançamentos), sem nenhuma chamada extra.
 */
export function MobileInvoiceItem({ invoice, selected, width, onSelect, currency, detailProps }) {
  const emptyForecast = invoice.status === INVOICE_STATUS.FORECAST && invoice.total === 0 && !invoice.itemsCount;
  const summary = invoice.isEmpty || emptyForecast ? "Sem lançamentos" : formatMoney(invoice.total, currency) ?? "—";
  return (
    <div
      role="group"
      aria-label={`Fatura de ${monthNameLower(invoice.month)} de ${invoice.year}, ${INVOICE_STATUS_LABEL[invoice.status]}`}
      aria-current={selected ? "true" : undefined}
      data-testid={`invoice-card-${invoice.key}`}
      data-status={invoice.status}
      data-selected={selected ? "true" : "false"}
      onClick={selected ? undefined : () => onSelect(invoice.key)}
      style={{
        width, flexShrink: 0, boxSizing: "border-box", scrollSnapAlign: "center", alignSelf: "flex-start",
        cursor: selected ? "default" : "pointer", background: T.surface, borderRadius: 14,
        border: `1px solid ${selected ? T.ink : T.border}`, boxShadow: selected ? T.md : T.sm,
        padding: 16, display: "flex", flexDirection: "column", gap: 14,
        opacity: invoice.status === INVOICE_STATUS.FORECAST && !selected ? 0.8 : 1,
      }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.09em" }}>
          {monthName(invoice.month)} {invoice.year}
        </div>
        <StatusBadge status={invoice.status} />
        {selected
          ? <Headline invoice={invoice} detail={detailProps.detail} state={detailProps.state} futureRow={detailProps.futureRow} currency={currency} centered />
          : (
            <>
              <div style={{ ...G, ...NUM, fontSize: 22, fontWeight: 800, color: T.ink }}>{summary}</div>
              {invoice.itemsCount > 0 && (
                <div style={{ ...G, fontSize: 11, color: T.inkMid }}>
                  {plural(invoice.itemsCount, invoice.status === INVOICE_STATUS.FORECAST ? "parcela" : "lançamento", invoice.status === INVOICE_STATUS.FORECAST ? "parcelas" : "lançamentos")}
                </div>
              )}
            </>
          )}
      </div>
      {selected && <InvoiceDetailBody invoice={invoice} currency={currency} centered {...detailProps} />}
    </div>
  );
}
