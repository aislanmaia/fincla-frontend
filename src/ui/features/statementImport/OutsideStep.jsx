// "Ver o que fica de fora" (fincla-api#516). Nada a responder aqui: mostra o que não entra no
// Fincla e por quê, em seções recolhíveis:
//
// - Já conferidos: vieram de uma importação anterior; não viram nada e não mudam.
// - Antes do início da conta / do último ajuste de saldo: o saldo do Fincla já inclui esses
//   movimentos, então ficam fora por padrão. "Trazer de volta" marca o lançamento para adicionar
//   (o cartão completo aparece, com "Não registrar" e a barra de desfazer para voltar atrás).
// - Valor zero: não move dinheiro, não vira transação.
import { useState } from "react";
import { Check, ChevronRight, Info, Link2 } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Badge, Btn, Card } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { StatementEntryCard, bankDateLabel } from "./StatementEntryCard.jsx";
import { invoiceLabel } from "./InvoicePaymentStep.jsx";

const LINK_BTN = { ...G, fontSize: 13, fontWeight: 600, color: T.blue, background: "none", border: "none", textDecoration: "underline", cursor: "pointer", padding: 0 };
const ROW = { ...G, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface };

/** Os lançamentos do passo, separados pelas seções. */
export function outsideSections(entries) {
  return {
    reconciled: entries.filter((e) => e.classification === "reconciled"),
    beforeStart: entries.filter((e) => e.classification === "before_start"),
    zero: entries.filter((e) => e.classification !== "reconciled" && e.classification !== "before_start"),
  };
}

/** Título e explicação da seção "antes do início", conforme o que o saldo da conta toma por base. */
function beforeStartTexts(leftOut) {
  const day = leftOut ? bankDateLabel(leftOut.before) : "";
  if (leftOut?.reason === "balance_adjustment") {
    return {
      title: "Antes do último ajuste de saldo",
      note: day ? `o saldo da conta conta a partir de ${day}; ficam de fora` : "ficam de fora",
      hint: "O ajuste de saldo que você fez já inclui esses movimentos. Trazer de volta pode fazer o saldo não bater.",
    };
  }
  return {
    title: "Antes do início da conta",
    note: day ? `a conta começa em ${day} no Fincla; ficam de fora` : "ficam de fora",
    hint: "O saldo inicial da conta no Fincla já inclui esses movimentos. Trazer de volta pode fazer o saldo não bater.",
  };
}

function SectionToggle({ expanded, onToggle, title, count, note, tone = "neutral", controls }) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onToggle}
      style={{ ...G, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", width: "100%", textAlign: "left", cursor: "pointer", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 12px" }}
    >
      <ChevronRight size={14} aria-hidden="true" style={{ color: T.inkMid, transform: expanded ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{title}</span>
      {tone === "green" ? <Badge color={T.green} bg={T.greenLight}>{count}</Badge> : <Badge color={T.inkMid} bg={T.grayLight}>{count}</Badge>}
      <span style={{ fontSize: 12, color: T.inkLight, fontWeight: 400 }}>{note}</span>
    </button>
  );
}

function EntryFacts({ entry }) {
  return (
    <>
      <span style={{ ...NUM, fontSize: 12, color: T.inkLight }}>{bankDateLabel(entry.date)}</span>
      <span style={{ fontSize: 13, color: T.ink, flex: "1 1 160px", minWidth: 0, wordBreak: "break-word" }}>{entry.bank_description}</span>
      <span style={{ ...NUM, fontSize: 13, color: entry.amount > 0 ? T.green : T.inkMid }}>{formatMoney(entry.amount, entry.currency)}</span>
    </>
  );
}

/** Com o que o lançamento já foi conferido: a transação, ou a transferência entre contas (fincla-api#511). */
function reconciledWith(entry) {
  if (entry.fincla_transaction) return entry.fincla_transaction.description;
  // Um pagamento de fatura conferido antes (fincla-api#512): a fatura que ele pagou.
  if (entry.invoice) return `o pagamento da ${invoiceLabel(entry.invoice)}`;
  const match = entry.fincla_match;
  if (match?.kind === "transfer") return match.description ? `a transferência “${match.description}”` : "uma transferência entre contas";
  return match?.description || null;
}

function ReconciledRow({ entry }) {
  const withWhat = reconciledWith(entry);
  return (
    <div data-testid="reconciled-entry" style={ROW}>
      <EntryFacts entry={entry} />
      <Badge color={T.green} bg={T.greenLight}>
        <Check size={11} aria-hidden="true" style={{ verticalAlign: "-1px", marginRight: 4 }} />Já conferida
      </Badge>
      <span style={{ fontSize: 12, color: T.inkMid, flexBasis: "100%", display: "flex", alignItems: "center", gap: 4 }}>
        <Link2 size={12} aria-hidden="true" />
        {withWhat ? <>Já conferida com <b style={{ color: T.ink }}>{withWhat}</b></> : "Já conferida numa importação anterior"}
      </span>
    </div>
  );
}

function LeftOutRow({ entry, busy, onBringBack }) {
  return (
    <div data-testid="before-start-entry" role="group" aria-label={`Lançamento ${entry.bank_description} fora do Fincla`} style={{ ...ROW, background: T.surfaceHov }}>
      <EntryFacts entry={entry} />
      <span style={{ fontSize: 12, color: T.inkLight }}>Fica de fora</span>
      <Btn variant="outGray" small disabled={busy} onClick={() => onBringBack(entry)}>Trazer de volta</Btn>
    </div>
  );
}

function BroughtBackBar({ entry, onUndo }) {
  return (
    <div role="status" data-testid="brought-back-bar" style={{ ...G, fontSize: 13, color: T.ink, background: T.greenLight, border: `1px solid ${T.greenBorder}`, borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
      <Check size={14} aria-hidden="true" style={{ color: T.green }} />
      <span style={{ flex: 1 }}>“{entry.bank_description}” trazido de volta: entra no Fincla ao concluir.</span>
      <button type="button" onClick={onUndo} style={LINK_BTN}>Desfazer</button>
    </div>
  );
}

export function OutsideStep({
  entries, leftOut, categories, details, fallbackLabel, isMobile, onChangeEntry,
}) {
  const { reconciled, beforeStart, zero } = outsideSections(entries);
  const [showReconciled, setShowReconciled] = useState(false);
  const [showBefore, setShowBefore] = useState(false);
  // O último "Trazer de volta": a barra desfaz devolvendo o lançamento para fora.
  const [lastBroughtBack, setLastBroughtBack] = useState(null);
  const [busy, setBusy] = useState(false);
  const texts = beforeStartTexts(leftOut);

  const run = async (work) => {
    setBusy(true);
    try { return await work(); } finally { setBusy(false); }
  };
  const bringBack = (entry) => run(async () => {
    // `false` = não gravou (a página mostra o motivo): nada a desfazer.
    if ((await onChangeEntry(entry.id, { answer: "create" })) === false) return;
    setLastBroughtBack({ id: entry.id, bank_description: entry.bank_description, confirmed: entry.confirmed });
  });
  const undoBringBack = () => run(async () => {
    const last = lastBroughtBack;
    setLastBroughtBack(null);
    if (last) await onChangeEntry(last.id, { answer: "ignore", confirmed: last.confirmed });
  });

  if (!entries.length) {
    return (
      <Card style={{ padding: 16 }}>
        <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: 0 }}>Nada fica de fora neste extrato: todos os lançamentos estão nos outros passos.</p>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {reconciled.length ? (
        <section aria-label="Já conferidos" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SectionToggle
            expanded={showReconciled}
            onToggle={() => setShowReconciled((v) => !v)}
            title="Já conferidos"
            count={reconciled.length}
            tone="green"
            note="vieram de uma importação anterior; nada a fazer"
            controls="outside-reconciled"
          />
          {showReconciled ? (
            <div id="outside-reconciled" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {reconciled.map((e) => <ReconciledRow key={e.id} entry={e} />)}
            </div>
          ) : null}
        </section>
      ) : null}

      {beforeStart.length ? (
        <section aria-label={texts.title} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SectionToggle
            expanded={showBefore}
            onToggle={() => setShowBefore((v) => !v)}
            title={texts.title}
            count={beforeStart.length}
            note={texts.note}
            controls="outside-before-start"
          />
          {showBefore ? (
            <div id="outside-before-start" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div role="note" style={{ ...G, fontSize: 12, color: T.ink, background: T.blueLight, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 12px", display: "flex", gap: 6, alignItems: "flex-start" }}>
                <Info size={14} aria-hidden="true" style={{ color: T.blue, flexShrink: 0, marginTop: 1 }} />
                <span>{texts.hint}</span>
              </div>
              {lastBroughtBack ? <BroughtBackBar entry={lastBroughtBack} onUndo={undoBringBack} /> : null}
              {beforeStart.map((entry) => (
                entry.answer === "ignore" ? (
                  <LeftOutRow key={entry.id} entry={entry} busy={busy} onBringBack={bringBack} />
                ) : (
                  <StatementEntryCard
                    key={entry.id}
                    entry={entry}
                    categories={categories}
                    details={details}
                    fallbackLabel={fallbackLabel}
                    isMobile={isMobile}
                    onChange={(id, body) => {
                      // "Não registrar" no cartão devolve o lançamento para fora: a barra perde o sentido.
                      if (body.answer === "ignore") setLastBroughtBack(null);
                      return onChangeEntry(id, body);
                    }}
                  />
                )
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {zero.length ? (
        <Card style={{ padding: 16 }}>
          <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: "0 0 10px" }}>
            {zero.length === 1 ? "Este lançamento não vira transação" : "Estes lançamentos não viram transação"} (valor zero):
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {zero.map((e) => (
              <li key={e.id} data-testid="left-out-entry" style={{ ...G, fontSize: 13, color: T.ink, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <span>{bankDateLabel(e.date)} · {e.bank_description}</span>
                <span style={{ ...NUM, color: T.inkMid }}>{formatMoney(e.amount, e.currency)} · valor zero</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
