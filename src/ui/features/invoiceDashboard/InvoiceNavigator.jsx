import { ChevronLeft, ChevronRight } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { formatMoney } from "../../money/formatMoney.js";
import { INVOICE_STATUS_LABEL, monthName } from "../cardHub/hubInvoices.js";

const ARROW = {
  width: 30, height: 30, borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface,
  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, color: T.ink,
};

export function optionLabel(invoice, currency) {
  const total = invoice.isEmpty ? "sem lançamentos" : invoice.total !== null ? formatMoney(invoice.total, currency) : null;
  return [`${monthName(invoice.month)} ${invoice.year}`, INVOICE_STATUS_LABEL[invoice.status], total].filter(Boolean).join(" · ");
}

/** Desktop: ‹ mês ano ▾ › — o seletor é um `<select>` nativo (acessível) sob o título. */
export function InvoiceNavigator({ invoices, selectedKey, onSelect, currency }) {
  const index = invoices.findIndex((i) => i.key === selectedKey);
  const current = invoices[index] ?? null;
  const prev = index > 0 ? invoices[index - 1] : null;
  const next = index >= 0 && index < invoices.length - 1 ? invoices[index + 1] : null;
  const ordered = [...invoices].reverse();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button type="button" aria-label="Fatura anterior" disabled={!prev} onClick={() => prev && onSelect(prev.key)}
        data-testid="invoice-prev" style={{ ...ARROW, opacity: prev ? 1 : 0.4, cursor: prev ? "pointer" : "not-allowed" }}>
        <ChevronLeft size={16} />
      </button>
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
        <h2 data-testid="invoice-title" style={{ ...G, margin: 0, fontSize: 24, fontWeight: 800, color: T.ink, letterSpacing: "-0.02em" }}>
          {current ? `${monthName(current.month)} ${current.year}` : "Fatura"}
        </h2>
        <span aria-hidden="true" style={{ fontSize: 12, color: T.inkGhost }}>▾</span>
        <select aria-label="Selecionar fatura" data-testid="invoice-select" value={selectedKey}
          onChange={(e) => onSelect(e.target.value)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", ...NUM }}>
          {ordered.map((invoice) => (
            <option key={invoice.key} value={invoice.key}>{optionLabel(invoice, currency)}</option>
          ))}
        </select>
      </div>
      <button type="button" aria-label="Próxima fatura" disabled={!next} onClick={() => next && onSelect(next.key)}
        data-testid="invoice-next" style={{ ...ARROW, opacity: next ? 1 : 0.4, cursor: next ? "pointer" : "not-allowed" }}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
