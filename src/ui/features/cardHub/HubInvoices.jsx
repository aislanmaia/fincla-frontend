import { useState } from "react";
import { T } from "../../tokens";
import { Btn, Card, ProgBar } from "../../components/primitives.jsx";
import { G, NUM } from "../../typography";
import { formatMoney } from "../../money/formatMoney.js";
import { InvoiceDashboardLink, StatusBadge } from "./InvoiceCard.jsx";
import { INVOICE_STATUS, describeDue, describePaidDate, monthName, monthShort } from "./hubInvoices.js";

const panel = { padding: 16, minWidth: 0 };
const dateKey = (date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export function HubInvoices({ invoices, currentKey, cardId, currency, isMobile, now, onNavigate, onMarkPaid }) {
  const [expanded, setExpanded] = useState(false);
  const [paidDate, setPaidDate] = useState(() => dateKey(now));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const current = invoices.find((invoice) => invoice.key === currentKey) ?? null;
  const past = invoices.filter((invoice) => invoice.key < currentKey).reverse();
  const future = invoices.filter((invoice) => invoice.key > currentKey);
  const others = [...past, ...future];
  const initial = [...past.slice(0, 2), ...future.slice(0, 2)];
  for (const invoice of others) {
    if (initial.length >= 4) break;
    if (!initial.includes(invoice)) initial.push(invoice);
  }
  const visible = expanded ? others : initial;
  const payable = current && !current.isEmpty && current.total !== null
    && (current.status === INVOICE_STATUS.OPEN || current.status === INVOICE_STATUS.CLOSED);
  const money = (invoice) => invoice.isEmpty ? "Sem lançamentos" : formatMoney(invoice.total, currency) ?? "—";

  const pay = async () => {
    setSaving(true);
    setError("");
    try {
      await onMarkPaid(current, paidDate);
    } catch {
      setError("Não foi possível marcar a fatura como paga. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(280px, 340px) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
      {current && <Card data-testid="hub-current-invoice" data-status={current.status} style={{ ...panel, borderColor: T.blue, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
          <div><div style={{ ...G, color: T.inkLight, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Fatura atual</div>
            <strong style={{ ...G, ...NUM, fontSize: 15 }}>{monthName(current.month)} {current.year}</strong></div>
          <StatusBadge status={current.status} />
        </div>
        <InvoiceDashboardLink cardId={cardId} invoice={current} onNavigate={onNavigate} style={{ color: T.ink, ...NUM, fontSize: 26, fontWeight: 800 }}>
          {money(current)}
        </InvoiceDashboardLink>
        {current.vsPercent !== null && current.vsPercent !== undefined && <span style={{ ...G, ...NUM, fontSize: 11, color: current.vsPercent > 0 ? T.red : T.green }}>
          {current.vsPercent > 0 ? "↑" : current.vsPercent < 0 ? "↓" : "="} {Math.abs(current.vsPercent)}% vs mês anterior
        </span>}
        {(current.status === INVOICE_STATUS.OPEN || current.status === INVOICE_STATUS.CLOSED) && describeDue(current.dueDate, now) &&
          <span style={{ ...G, fontSize: 11, color: T.inkMid }}>🗓 {describeDue(current.dueDate, now)}</span>}
        {current.status === INVOICE_STATUS.PAID && describePaidDate(current.paidDate) &&
          <span style={{ ...G, fontSize: 11, color: T.inkMid }}>{describePaidDate(current.paidDate)}</span>}
        {current.limitUsagePercent !== null && current.limitUsagePercent !== undefined && <div>
          <div style={{ ...G, display: "flex", justifyContent: "space-between", fontSize: 11, color: T.inkMid, marginBottom: 5 }}><span>Limite utilizado</span><strong style={NUM}>{Math.round(current.limitUsagePercent)}%</strong></div>
          <ProgBar pct={current.limitUsagePercent} h={4} color={current.limitUsagePercent >= 90 ? T.red : current.limitUsagePercent >= 70 ? T.amber : T.green} />
        </div>}
        {current.itemsCount > 0 && <span style={{ ...G, ...NUM, fontSize: 11, color: T.inkMid }}>{current.itemsCount} lançamentos{current.topCategory ? ` · maior categoria: ${current.topCategory}` : ""}</span>}
        {payable && <>
          <label style={{ ...G, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: T.inkMid }}>
            Paga em <input type="date" aria-label="Data do pagamento" value={paidDate} max={dateKey(now)} onChange={(event) => setPaidDate(event.target.value)} style={{ ...G, border: `1px solid ${T.border}`, borderRadius: 8, padding: 6, color: T.ink }} />
          </label>
          <Btn variant="green" disabled={saving || !paidDate} onClick={pay}>{saving ? "Salvando…" : "✓ Marcar como paga"}</Btn>
        </>}
        {error && <div role="alert" style={{ ...G, fontSize: 11, color: T.red }}>{error}</div>}
        <InvoiceDashboardLink cardId={cardId} invoice={current} onNavigate={onNavigate}>Abrir dashboard da fatura →</InvoiceDashboardLink>
      </Card>}
      {!isMobile && <Card role="region" aria-label="Outras faturas" style={{ ...panel, padding: 8 }}>
        {visible.length === 0 && <div style={{ ...G, padding: 10, color: T.inkMid, fontSize: 12 }}>Nenhuma outra fatura.</div>}
        <div data-testid="hub-other-invoices" style={{ maxHeight: isMobile ? undefined : 330, overflowY: "auto" }} className="fincla-scroll">
          {visible.map((invoice) => <InvoiceDashboardLink key={invoice.key} cardId={cardId} invoice={invoice} onNavigate={onNavigate}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderBottom: `1px solid ${T.border}`, color: T.ink }}>
            <span style={{ ...NUM, width: 38, flexShrink: 0, textAlign: "center", fontWeight: 800 }}>{monthShort(invoice.month)}<small style={{ display: "block", fontWeight: 400 }}>{invoice.year}</small></span>
            <StatusBadge status={invoice.status} />
            <span style={{ ...NUM, flex: 1, minWidth: 0, color: T.inkMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {invoice.status === INVOICE_STATUS.PAID ? describePaidDate(invoice.paidDate) : null}
              {invoice.itemsCount > 0 ? `${invoice.paidDate ? " · " : ""}${invoice.itemsCount} ${invoice.status === INVOICE_STATUS.FORECAST ? "parcelas" : "lanç."}` : ""}
            </span>
            <strong style={{ ...NUM, whiteSpace: "nowrap", fontSize: 13 }}>{money(invoice)}</strong>
            <span style={{ color: T.blue }}>→</span>
          </InvoiceDashboardLink>)}
        </div>
        {others.length > 4 && <Btn variant="ghost" full aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}
          style={{ ...NUM, color: T.blue }}>
          {expanded ? "Mostrar menos" : `+ ${others.length - 4} outras faturas`}
        </Btn>}
      </Card>}
    </div>
  );
}
