import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { formatMoney } from "../../money/formatMoney.js";
import { invoiceDashboardPath } from "../../routing/invoiceRoute.js";
import { HubDialog } from "./HubDialog.jsx";
import { StatusBadge } from "./InvoiceCard.jsx";
import { INVOICE_STATUS, describePaidDate, monthShort, summarizeInvoiceCounts } from "./hubInvoices.js";

/** Lista completa de faturas, da mais recente para a mais antiga. */
export function AllInvoicesDialog({ invoices, cardId, currency, isMobile, onNavigate, onClose }) {
  const ordered = [...invoices].reverse();
  return (
    <HubDialog title="Todas as faturas" isMobile={isMobile} onClose={onClose} width={520}>
      <div style={{ ...G, fontSize: 11, color: T.inkLight, padding: "10px 20px 0" }}>{summarizeInvoiceCounts(invoices)}</div>
      <div data-testid="all-invoices-list" style={{ padding: "8px 12px 16px", display: "flex", flexDirection: "column", gap: 2 }}>
        {ordered.map((invoice) => {
          const href = invoiceDashboardPath(cardId, invoice.year, invoice.month);
          return (
            <a key={invoice.key} href={href} data-testid={`all-invoices-row-${invoice.key}`} data-status={invoice.status}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
                event.preventDefault();
                onNavigate(href);
              }} style={{ ...G, color: T.ink, textDecoration: "none", display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderRadius: 10, opacity: invoice.status === INVOICE_STATUS.FORECAST ? 0.8 : 1 }}>
                <span style={{ width: 38, textAlign: "center", flexShrink: 0 }}>
                  <span style={{ ...G, ...NUM, display: "block", fontSize: 12, fontWeight: 800, color: T.ink }}>{monthShort(invoice.month)}</span>
                  <span style={{ ...G, display: "block", fontSize: 11, color: T.inkLight }}>{invoice.year}</span>
                </span>
                <StatusBadge status={invoice.status} />
                <span style={{ ...G, fontSize: 11, color: T.inkMid, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {invoice.status === INVOICE_STATUS.PAID ? describePaidDate(invoice.paidDate) ?? "" : ""}
                  {invoice.itemsCount > 0 ? `${invoice.status === INVOICE_STATUS.PAID && invoice.paidDate ? " · " : ""}${invoice.itemsCount} ${invoice.status === INVOICE_STATUS.FORECAST ? "parcelas" : "lanç."}` : ""}
                </span>
                <span style={{ ...G, ...NUM, fontSize: 14, fontWeight: 800, color: T.ink, textAlign: "right" }}>
                  {invoice.isEmpty ? "Sem lançamentos" : (formatMoney(invoice.total, currency) ?? "—")}
                </span>
                <span style={{ fontSize: 11, color: T.blue, flexShrink: 0 }}>Abrir →</span>
            </a>
          );
        })}
      </div>
    </HubDialog>
  );
}
