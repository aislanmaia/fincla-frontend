// Conciliar fatura: a compra nova (fincla-api#557). O formulário é o do item novo do extrato
// (`StatementEntryCard`/`NewTransactionEditor`, #513: descrição pré-preenchida, categoria pelo
// histórico, etiquetas da categoria), com o que é da fatura: a forma de pagamento travada em
// "Cartão de crédito · <cartão>", o tipo travado (despesa ou estorno) e, numa compra parcelada
// "NN/MM", as duas opções da decisão 5 do Owner:
// - Compra inteira (parcelas 01 a MM), marcada por padrão: as parcelas 01..N−1 entram nas faturas
//   anteriores com o valor da parcela N, inclusive em fatura já paga, onde entram já pagas;
// - Só daqui em diante (parcelas NN a MM): as anteriores ficam de fora.
// Nas duas, de N a M valem os valores que o banco informou. Quem usa: o passo 1 ("Não, adicionar
// agora") e o passo 5 ("Compras novas").
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { useTouchTarget } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { plural } from "../../plural.js";
import { FIELD_LABEL, HELP, categoryLabel, detailLabels } from "./StatementEntryCard.jsx";
import { createdInstallments, invoiceMonthLabel, pad2 } from "./invoiceSteps.js";

/** "Cartão de crédito · Itaú Visa": a forma de pagamento travada da compra nova. */
export const cardPaymentLabel = (cardName) => (cardName ? `Cartão de crédito · ${cardName}` : "Cartão de crédito");

const monthOf = (installment) => invoiceMonthLabel({ year: installment.invoice_year, month: installment.invoice_month });

/** "a", "a e b", "a, b e c"; mais de 3: "de a a z". */
function listOfMonths(installments) {
  const months = installments.map(monthOf);
  if (months.length <= 3) return months.length > 1 ? `${months.slice(0, -1).join(", ")} e ${months.at(-1)}` : months[0];
  return `${months[0]} a ${months.at(-1)}`;
}

/** "01 e 02", "01, 02 e 03", "01 a 12". */
function listOfNumbers(numbers) {
  const labels = numbers.map(pad2);
  if (labels.length <= 3) return labels.length > 1 ? `${labels.slice(0, -1).join(", ")} e ${labels.at(-1)}` : labels[0];
  return `${labels[0]} a ${labels.at(-1)}`;
}

/**
 * As notas das duas opções, como o spec (fincla-api#554, passo 5) as escreve. `before` são as
 * parcelas 1..N−1; `after`, as N+1..M.
 */
function scopeNotes(entry) {
  const { number: n, count: m } = entry.installment;
  const all = entry.new_purchase.installments;
  const before = all.filter((i) => i.number < n);
  const after = all.filter((i) => i.number > n);
  const beforeNumbers = before.map((i) => i.number);
  const paid = before.filter((i) => i.invoice_paid);
  const estimatedAfter = after.filter((i) => !i.from_bank);
  const nextPart = after.length
    ? estimatedAfter.length
      ? `; as próximas até a ${pad2(m)}/${pad2(m)} com os valores que o banco já informou (as que ele não listou levam o valor da ${pad2(n)}: valor estimado)`
      : `; as próximas até a ${pad2(m)}/${pad2(m)} com os valores que o banco já informou`
    : "";
  const full = (
    <>
      Cria a compra em {plural(m, "parcela", "parcelas")}: {listOfNumbers(beforeNumbers)} {before.length === 1 ? "na fatura" : "nas faturas"} de{" "}
      {listOfMonths(before)}, com o valor da {pad2(n)}; {pad2(n)}/{pad2(m)} nesta fatura{nextPart}.
      {paid.length ? (
        <>
          {" "}
          <b>
            {paid.length === 1 ? `A fatura de ${monthOf(paid[0])} já foi paga: a parcela ${pad2(paid[0].number)} entra nela já paga.` : `As faturas de ${listOfMonths(paid)} já foram pagas: as parcelas ${listOfNumbers(paid.map((i) => i.number))} entram nelas já pagas.`}
          </b>
        </>
      ) : null}
    </>
  );
  const fromCurrent = (
    <>
      {before.length === 1 ? `A parcela ${pad2(beforeNumbers[0])} fica` : `As parcelas ${listOfNumbers(beforeNumbers)} ficam`} de fora. Cria{" "}
      {plural(m - n + 1, "parcela", "parcelas")}: {pad2(n)}/{pad2(m)} nesta fatura{nextPart}.
    </>
  );
  return { full, fromCurrent };
}

/** As parcelas que serão criadas, cada uma na sua fatura: valor estimado e fatura paga marcados. */
function InstallmentList({ entry }) {
  const created = createdInstallments(entry);
  const current = entry.installment.number;
  return (
    <ul aria-label="Parcelas que serão criadas" data-testid="new-purchase-installments" style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "flex", flexWrap: "wrap", gap: 6 }}>
      {created.map((i) => (
        <li
          key={i.number}
          data-testid="new-purchase-installment"
          style={{ ...G, fontSize: 12, color: T.inkMid, background: i.number === current ? T.blueLight : T.surface, border: `1px solid ${i.number === current ? T.blue : T.border}`, borderRadius: 8, padding: "3px 8px", display: "inline-flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}
        >
          <b style={{ ...NUM, color: T.ink }}>{pad2(i.number)}/{pad2(entry.installment.count)}</b>
          <span>{i.number === current ? "nesta fatura" : monthOf(i)}</span>
          <span style={NUM}>{formatMoney(i.amount, i.currency)}</span>
          {!i.from_bank ? <span style={{ color: T.amber }}>valor estimado</span> : null}
          {i.invoice_paid ? <span style={{ color: T.green, fontWeight: 600 }}>fatura já paga: entra paga</span> : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * As duas opções da compra parcelada nova (decisão 5): a escolhida vai para o rascunho na hora
 * (`installments_scope`), sem minimizar o cartão (o Confirmar do formulário é que confirma). Dentro
 * do `<fieldset>` do formulário: no "Não registrar" fica à vista e desligada.
 */
export function InstallmentScopeChoice({ entry, onChange }) {
  const touchTarget = useTouchTarget();
  if (!entry.installment || !entry.new_purchase || entry.installment.number <= 1) return null;
  const { number: n, count: m } = entry.installment;
  const scope = entry.installments_scope ?? "full";
  const notes = scopeNotes(entry);
  const name = `scope-${entry.id}`;
  const options = [
    { value: "full", label: `Compra inteira (parcelas 01 a ${pad2(m)})`, note: notes.full },
    { value: "from_current", label: `Só daqui em diante (parcelas ${pad2(n)} a ${pad2(m)})`, note: notes.fromCurrent },
  ];
  const total = entry.new_purchase.total_amount;
  return (
    <div data-testid="installments-scope">
      <span id={`${name}-label`} style={FIELD_LABEL}>Compra parcelada · {pad2(n)}/{pad2(m)}</span>
      <div role="radiogroup" aria-labelledby={`${name}-label`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {options.map((option) => {
          const checked = scope === option.value;
          return (
            <label
              key={option.value}
              style={{ ...G, display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer", border: `1px solid ${checked ? T.blue : T.border}`, background: checked ? T.blueLight : T.surface, borderRadius: 10, padding: "8px 10px", ...touchTarget }}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(entry.id, { installments_scope: option.value })}
                style={{ margin: "2px 0 0", width: 16, height: 16, flexShrink: 0, cursor: "pointer" }}
              />
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <b style={{ fontSize: 13, color: T.ink }}>{option.label}</b>
                <span data-testid={`scope-note-${option.value}`} style={{ fontSize: 12, color: T.inkMid, lineHeight: 1.5 }}>{option.note}</span>
              </span>
            </label>
          );
        })}
      </div>
      <InstallmentList entry={entry} />
      <span style={HELP}>
        As etiquetas valem para todas as parcelas.
        {total ? <> Total da compra: <b style={NUM}>{formatMoney(total.amount, total.currency)}</b>, nas duas opções.</> : null}
      </span>
    </div>
  );
}

/**
 * O `invoice` do formulário do item novo (`StatementEntryCard`): a forma de pagamento travada, as
 * opções da parcelada e a nota do "Não registrar".
 */
export function invoiceNewPurchaseForm(entry, cardName, onChange) {
  return {
    paymentLabel: cardPaymentLabel(cardName),
    extraFields: <InstallmentScopeChoice entry={entry} onChange={onChange} />,
    skipText: "Esta compra não entra no Fincla: nada é adicionado. A diferença aparece em Conferir o total.",
  };
}

/** O que a compra nova vira ao concluir, numa frase (a linha "→" do cartão). */
export function newPurchaseOutcome(entry, { categories, details, fallbackLabel, invoiceMonth }) {
  const description = entry.description?.trim() ? `“${entry.description.trim()}”` : "(sem descrição)";
  const category = categoryLabel(categories, entry.category_tag_id, fallbackLabel);
  const tags = detailLabels(details, entry.detail_tag_ids);
  const withTags = tags.length ? <> com {tags.join(", ")}</> : null;
  if (entry.transaction_type === "refund") {
    return <>Ao concluir: entra o estorno <b>{description}</b> em <b>{category}</b>{withTags}, no cartão, na fatura de {invoiceMonth}: diminui o total da fatura.</>;
  }
  const created = createdInstallments(entry);
  if (created.length) {
    const first = created[0].number;
    const last = created.at(-1).number;
    return (
      <>
        Ao concluir: entra a compra <b>{description}</b> em <b>{category}</b>{withTags}, no cartão, em {plural(created.length, "parcela", "parcelas")} ({pad2(first)} a {pad2(last)}), cada uma na sua fatura.
      </>
    );
  }
  return <>Ao concluir: entra a compra <b>{description}</b> em <b>{category}</b>{withTags}, no cartão, na fatura de {invoiceMonth}, na data do banco.</>;
}
