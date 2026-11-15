// Passo "Conferir pagamento de fatura" (fincla-api#512).
//
// O pagamento de uma fatura de cartão no extrato é reconhecido pelo Fincla (valor até R$ 1,00 do
// total, data a até 5 dias do vencimento, cartão pago por esta conta). Ele é um lançamento de
// REFERÊNCIA: já vem decidido, sem "Sim, é esta / Não, adicionar agora / Não registrar", e nunca
// vira transação — as compras da fatura já estão no Fincla. Ao concluir, a fatura fica paga na
// data do banco. A pessoa só confere se é a fatura certa.
//
// Fatura JÁ paga no Fincla (paga pelo app antes de conciliar, G3-3-01): o mesmo cartão, como
// referência "Já paga no Fincla em DD/MM". Nada acontece ao concluir: nenhuma transação, a fatura
// não muda. A diferença de data (Fincla × banco) aparece na conferência de saldo.
import { CheckCircle2, Info } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Badge } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { BankSide, Connector } from "./SuggestedPairsStep.jsx";
import { DifferenceTag, Hl, MATCH_BOX } from "./FinclaMatchBox.jsx";
import { BOX_LABEL, MONTH_NAMES, bankDateLabel, dayMonthLabel } from "./StatementEntryCard.jsx";

/** "Fatura Itaú Visa · outubro": a fatura é o mês em que ela fecha. */
export function invoiceLabel(invoice) {
  return `Fatura ${invoice.card_name} · ${MONTH_NAMES[invoice.month - 1] ?? invoice.month}`;
}

/** O pagamento de uma fatura que já estava paga no Fincla antes da conciliação (só referência). */
export const isAlreadyPaid = (entry) => entry.answer === "invoice_already_paid";

const STATUS_LABEL = { open: "Em aberto", closed: "Fechada" };

const DT = { ...G, fontSize: 11, color: T.inkLight };
const DD = { ...G, fontSize: 13, color: T.ink, margin: 0, minWidth: 0, wordBreak: "break-word" };

export function InvoiceBadge({ children = "Pagamento de fatura" }) {
  return (
    <Badge color={T.purple} bg={T.purpleLight}>
      <CheckCircle2 size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-1px" }} />
      {children}
    </Badge>
  );
}

/** "05/10" no mesmo ano do extrato (o do lançamento do banco); "30/12/2025" num ano diferente. */
export function paidOnLabel(paidYmd, statementYmd) {
  return String(paidYmd ?? "").slice(0, 4) === String(statementYmd ?? "").slice(0, 4)
    ? dayMonthLabel(paidYmd)
    : bankDateLabel(paidYmd);
}

function situation(entry) {
  const { invoice } = entry;
  if (invoice.status !== "paid") return STATUS_LABEL[invoice.status] ?? invoice.status;
  if (!isAlreadyPaid(entry)) return `Paga em ${bankDateLabel(invoice.paid_date)}`;
  const otherDay = invoice.paid_date !== entry.date;
  return (
    <span key="s" style={NUM}>
      Já paga no Fincla em <Hl on={otherDay}>{paidOnLabel(invoice.paid_date, entry.date)}</Hl>
    </span>
  );
}

function InvoiceSide({ entry, accountName }) {
  const { invoice } = entry;
  const amountDiffers = invoice.differences.includes("amount");
  const rows = [
    ["Vencimento", <span key="d" style={NUM}><Hl on={invoice.differences.includes("date")}>{bankDateLabel(invoice.due_date)}</Hl></span>],
    ["Descrição", <b key="n">{invoiceLabel(invoice)}</b>],
    ["Total", <b key="v" style={NUM}><Hl on={amountDiffers}>{formatMoney(-invoice.total, invoice.currency)}</Hl></b>],
    ["Cartão", `${invoice.card_name} · paga pela ${invoice.account_name || accountName || "conta do extrato"}`],
    ["Situação", situation(entry)],
  ];
  const paidLess = invoice.difference > 0;
  return (
    <section data-testid="invoice-side" style={{ ...MATCH_BOX, borderColor: T.purple }}>
      <div style={BOX_LABEL}>
        No Fincla · fatura do cartão <Badge color={T.purple} bg={T.purpleLight}>Fatura</Badge>
      </div>
      <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: "4px 12px", alignItems: "baseline" }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: "contents" }}>
            <dt style={DT}>{label}</dt>
            <dd style={DD}>{value}</dd>
          </div>
        ))}
      </dl>
      {amountDiffers ? (
        <div data-testid="invoice-amount-difference" style={{ ...G, fontSize: 12, color: T.inkMid, marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${T.border}`, lineHeight: 1.5 }}>
          <DifferenceTag>VALOR DIFERENTE</DifferenceTag>{" "}
          <span>
            O banco pagou <b style={NUM}>{formatMoney(Math.abs(invoice.difference), invoice.currency)}</b> a{" "}
            <b>{paidLess ? "menos" : "mais"}</b> que o total da fatura no Fincla. A diferença aparece na <b>conferência de saldo</b>.
          </span>
        </div>
      ) : null}
    </section>
  );
}

/**
 * A fatura mudou depois da leitura: a conclusão será recusada, e a tela já avisa. Um pagamento a
 * fazer encontra a fatura já paga; uma referência "já paga" encontra a fatura desmarcada.
 */
export function invoiceUnavailable(entry) {
  if (!entry.invoice) return true;
  return isAlreadyPaid(entry) ? entry.invoice.status !== "paid" : entry.invoice.status === "paid";
}

function unavailableText(entry) {
  if (!entry.invoice) return "A fatura deste pagamento não existe mais no Fincla.";
  if (isAlreadyPaid(entry)) return `A ${invoiceLabel(entry.invoice)} não está mais paga no Fincla: ela foi desmarcada depois da leitura do extrato.`;
  return `A ${invoiceLabel(entry.invoice)} já foi marcada como paga depois da leitura do extrato.`;
}

function InvoiceUnavailable({ entry }) {
  return (
    <div data-testid="invoice-unavailable" role="note" style={{ ...G, fontSize: 12, color: T.ink, background: T.amberLight, border: `1px solid ${T.amberBorder}`, borderRadius: 10, padding: "8px 12px", margin: "0 14px 12px" }}>
      {unavailableText(entry)} Para conciliar, descarte esta conciliação e envie o extrato de novo.
    </div>
  );
}

/** O que acontece ao concluir; nada promete "fica paga" quando a fatura já está paga ou mudou. */
function Outcome({ entry, unavailable }) {
  const { invoice } = entry;
  if (isAlreadyPaid(entry)) {
    return (
      <span>
        Este lançamento é o pagamento de uma fatura que <b>já está paga no Fincla</b>. Ao concluir, nada muda: nenhuma transação é
        criada e a fatura continua como está.
        {invoice && !unavailable && invoice.paid_date !== entry.date ? (
          <> No Fincla ela foi paga em <b style={NUM}>{bankDateLabel(invoice.paid_date)}</b> e no banco em <b style={NUM}>{bankDateLabel(entry.date)}</b>: a diferença de data aparece na conferência de saldo.</>
        ) : null}
      </span>
    );
  }
  return (
    <span>
      Este lançamento é o pagamento da fatura. Nenhuma transação é criada: as compras dela já estão no Fincla.
      {invoice && !unavailable ? (
        <> Ao concluir a conciliação, a <b>{invoiceLabel(invoice)}</b> fica paga em <b style={NUM}>{bankDateLabel(entry.date)}</b> (data do banco).</>
      ) : null}
    </span>
  );
}

function InvoicePaymentCard({ entry, isMobile, accountName }) {
  const { invoice } = entry;
  const unavailable = invoiceUnavailable(entry);
  const alreadyPaid = isAlreadyPaid(entry);
  return (
    <article
      data-testid="invoice-card"
      aria-label={`Pagamento de fatura de ${bankDateLabel(entry.date)}`}
      style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.sm, overflow: "hidden" }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
        <span style={{ ...G, ...NUM, fontSize: 13, fontWeight: 600, color: T.ink }}>{bankDateLabel(entry.date)}</span>
        <InvoiceBadge />
        {alreadyPaid ? <Badge color={T.green} bg={T.greenLight}>Já paga no Fincla</Badge> : null}
      </header>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 4 : 0, padding: 14, alignItems: "stretch" }}>
        <BankSide entry={entry} dateDiffers={Boolean(invoice?.differences.includes("date"))} />
        <Connector answer="pair" isMobile={isMobile} />
        <div style={{ display: "flex", flex: 1, minWidth: 0 }}>
          {invoice ? (
            <InvoiceSide entry={entry} accountName={accountName} />
          ) : (
            <section style={{ ...MATCH_BOX, background: T.grayLight }}>
              <div style={BOX_LABEL}>No Fincla · fatura do cartão</div>
            </section>
          )}
        </div>
      </div>
      {unavailable ? <InvoiceUnavailable entry={entry} /> : null}
      <footer data-testid="invoice-outcome" style={{ ...G, fontSize: 12, color: T.inkMid, padding: "10px 14px", background: T.bg, borderTop: `1px solid ${T.border}`, display: "flex", gap: 6, alignItems: "flex-start" }}>
        <Info size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
        <Outcome entry={entry} unavailable={unavailable} />
      </footer>
    </article>
  );
}

export function InvoicePaymentStep({ entries, isMobile = false, accountName = "" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {entries.map((entry) => (
        <InvoicePaymentCard key={entry.id} entry={entry} isMobile={isMobile} accountName={accountName} />
      ))}
    </div>
  );
}
