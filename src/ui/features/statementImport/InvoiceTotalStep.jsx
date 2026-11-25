// Conciliar fatura, passo 7 "Conferir o total" (fincla-api#560): o total dos lançamentos lidos do
// banco × o total da fatura no Fincla com as respostas aplicadas (estorno subtrai), a diferença e, se
// ela não for zero, "O que explica a diferença", cada causa com "Ir para o passo". O resumo do PDF fica
// à vista como referência (o pagamento e o total anterior são conferidos na conciliação da conta
// corrente; o saldo financiado é só referência, decisão 6). `null` = "não sabemos", nunca R$ 0,00.
// Nada a responder aqui: o backend calcula tudo; a tela só mostra.
import { AlertTriangle, Check } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Btn, Card } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { bankDateLabel } from "./StatementEntryCard.jsx";
import { INVOICE_STEPS } from "./invoiceSteps.js";

/** Banco − Fincla com sinal; zero sem sinal. `null` = não sabemos (nunca R$ 0,00). */
export function signedMoney(money) {
  if (!money) return "não sabemos";
  const { amount, currency } = money;
  if (Math.abs(amount) < 0.005) return formatMoney(0, currency);
  return (amount > 0 ? "+" : "−") + formatMoney(Math.abs(amount), currency);
}

const plainMoney = (money) => (money ? formatMoney(money.amount, money.currency) : "não sabemos");

const CAUSE_LABEL = {
  unanswered: "Falta responder",
  ignored: "Não registrado",
  fincla_value_kept: "Fatura paga: fica o valor do Fincla",
  kept_leftover: "Mantido no Fincla sem cobrança do banco",
  undecided_leftover: "Sobrando no Fincla, falta decidir",
};

const stepTitle = (key) => INVOICE_STEPS.find((s) => s.key === key)?.title ?? null;

function Line({ label, value, note = null, testId }) {
  return (
    <div data-testid={testId} style={{ ...G, display: "flex", gap: 10, alignItems: "baseline", fontSize: 13, color: T.inkMid, flexWrap: "wrap" }}>
      <span style={{ flex: "1 1 180px" }}>{label}{note ? <span style={{ fontSize: 12, color: T.inkLight }}> · {note}</span> : null}</span>
      <b style={{ ...NUM, color: T.ink }}>{value}</b>
    </div>
  );
}

/** O resumo da página 1 do PDF. */
function BankSummary({ summary }) {
  const payment = summary.payment;
  return (
    <Card data-testid="total-bank-summary" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      <h3 style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>O resumo da fatura no PDF</h3>
      <Line testId="total-previous" label="Total da fatura anterior" value={plainMoney(summary.previous_total)} note="só referência" />
      <Line
        testId="total-payment"
        label={`Pagamento${payment?.date ? ` em ${bankDateLabel(payment.date)}` : ""}`}
        value={plainMoney(payment?.amount ?? null)}
        note="conferido na conciliação da conta corrente"
      />
      <Line testId="total-financed" label="Saldo financiado" value={plainMoney(summary.financed_balance)} note="só referência" />
      <Line testId="total-charges" label="Encargos" value={plainMoney(summary.charges)} />
      <Line testId="total-current" label="Lançamentos atuais" value={plainMoney(summary.current_entries)} />
      <Line testId="total-pdf" label="Total desta fatura" value={plainMoney(summary.total)} />
    </Card>
  );
}

function CauseRow({ cause, touch, onGoToStep }) {
  const where = stepTitle(cause.step);
  return (
    <div data-testid="total-cause" data-code={cause.code} style={{ ...G, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 12, background: T.surface }}>
      <div style={{ flex: "1 1 220px", minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <b style={{ fontSize: 13, color: T.ink, wordBreak: "break-word" }}>{cause.description ?? "—"}</b>
        <span style={{ ...NUM, fontSize: 12, color: T.inkLight }}>
          {cause.date ? `${bankDateLabel(cause.date)} · ` : ""}{CAUSE_LABEL[cause.code] ?? cause.code}
          {cause.amount ? ` · ${plainMoney(cause.amount)}` : ""}
        </span>
      </div>
      <span data-testid="total-cause-effect" style={{ ...NUM, fontSize: 13, fontWeight: 700, color: cause.effect ? T.red : T.amber, whiteSpace: "nowrap" }}>
        {cause.effect ? `${signedMoney(cause.effect)} na diferença` : "falta responder"}
      </span>
      {where ? (
        <Btn variant="outGray" small={!touch} onClick={() => onGoToStep(cause.step)} aria-label={`Ir para o passo ${where}`}>
          Ir para o passo
        </Btn>
      ) : null}
    </div>
  );
}

export function InvoiceTotalStep({ check, loading, error, touch = false, onGoToStep }) {
  if (!check) {
    if (error) return null;
    return <p style={{ ...G, fontSize: 13, color: T.inkLight, margin: 0 }}>{loading ? "Conferindo o total…" : null}</p>;
  }
  const off = check.difference !== null && !check.matches;
  return (
    <div data-testid="total-step" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Card data-testid="total-bank" style={{ padding: "12px 16px", flex: "1 1 200px" }}>
          <div style={{ ...G, fontSize: 12, color: T.inkMid }}>Lançamentos lidos do banco</div>
          <div style={{ ...G, ...NUM, fontSize: 20, fontWeight: 800, color: T.ink }}>{plainMoney(check.bank)}</div>
        </Card>
        <Card data-testid="total-fincla" style={{ padding: "12px 16px", flex: "1 1 200px" }}>
          <div style={{ ...G, fontSize: 12, color: T.inkMid }}>Fatura no Fincla, com as suas respostas</div>
          <div style={{ ...G, ...NUM, fontSize: 20, fontWeight: 800, color: T.ink }}>{plainMoney(check.fincla)}</div>
          <div style={{ ...G, fontSize: 11, color: T.inkLight }}>Estornos diminuem o total.</div>
        </Card>
        <Card data-testid="total-difference" data-state={check.difference === null ? "unknown" : check.matches ? "ok" : "off"} style={{ padding: "12px 16px", flex: "1 1 200px", ...(off ? { background: T.redLight, borderColor: T.red } : null) }}>
          <div style={{ ...G, fontSize: 12, color: T.inkMid }}>Diferença (banco − Fincla)</div>
          <div style={{ ...G, ...NUM, fontSize: 20, fontWeight: 800, color: check.difference === null ? T.inkMid : off ? T.red : T.green }}>{signedMoney(check.difference)}</div>
        </Card>
      </div>
      {check.matches ? (
        <p data-testid="total-matches" role="status" style={{ ...G, fontSize: 13, color: T.green, background: T.greenLight, border: `1px solid ${T.greenBorder}`, borderRadius: 10, padding: "10px 12px", margin: 0, display: "flex", gap: 8, alignItems: "center" }}>
          <Check size={14} aria-hidden="true" /> A fatura bate com o banco. Pode seguir para Revisar e concluir.
        </p>
      ) : null}
      {check.difference === null ? (
        <p data-testid="total-unknown" role="note" style={{ ...G, fontSize: 13, color: T.inkMid, margin: 0 }}>
          Não sabemos a diferença agora: falta algum valor para comparar o banco com o Fincla.
        </p>
      ) : null}
      {!check.matches && check.causes.length ? (
        <section data-testid="total-causes" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h3 style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, margin: 0, display: "flex", gap: 6, alignItems: "center" }}>
            <AlertTriangle size={14} aria-hidden="true" style={{ color: T.amber }} /> O que explica a diferença
          </h3>
          {check.causes.map((cause, i) => (
            <CauseRow key={`${cause.code}-${cause.entry_id ?? cause.transaction_id ?? cause.charge_group_id ?? i}`} cause={cause} touch={touch} onGoToStep={onGoToStep} />
          ))}
        </section>
      ) : null}
      <BankSummary summary={check.bank_summary} />
    </div>
  );
}
