import { useState } from "react";
import { listInvoices } from "../../api/invoices";
import { Btn } from "../components/primitives.jsx";
import { T } from "../tokens.js";

const statusLabels = { paid: "Paga", pending: "Pendente", overdue: "Em atraso", refunded: "Reembolsada", cancelled: "Cancelada" };

/** Account recovery remains available while paid application routes are gated. */
export function CheckoutBilling() {
  const [invoices, setInvoices] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    setBusy(true); setError("");
    try { setInvoices((await listInvoices()).items); }
    catch { setError("Não foi possível consultar suas faturas. Tente novamente."); }
    finally { setBusy(false); }
  }
  return <section style={{ margin: "16px 0" }}>
    <Btn disabled={busy} onClick={load}>{busy ? "Consultando faturas…" : "Consultar faturas"}</Btn>
    {error && <p role="alert">{error}</p>}
    {invoices?.length === 0 && <p>Nenhuma fatura disponível. Se o acesso continuar indisponível, entre em contato com o suporte.</p>}
    {invoices?.map(invoice => <div key={invoice.id} style={{ borderTop: `1px solid ${T.border}`, padding: "12px 0" }}>
      <p>{invoice.description || "Fatura da assinatura"} · {statusLabels[invoice.status] || invoice.status}</p>
      <p>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: invoice.currency }).format(invoice.amount_cents / 100)} · Vencimento: {new Date(`${invoice.due_date.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR")}</p>
      {invoice.invoice_url?.startsWith("https://") && <a href={invoice.invoice_url} target="_blank" rel="noreferrer" style={{ color: T.blue }}>Abrir fatura</a>}
    </div>)}
  </section>;
}
