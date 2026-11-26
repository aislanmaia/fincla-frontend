// Conciliar fatura, passo 4: o "Repasse de IOF" somado em vários lançamentos do Fincla (fincla-api#574).
//
// O banco cobra o IOF das compras internacionais numa linha só; muita gente lança o IOF de cada
// compra à parte. Quando a soma de transações desta fatura bate, ao centavo, com a linha do banco, o
// backend manda `split_pair` e a sugestão `pair_split` (sem confirmar). O cartão mostra, no lado do
// Fincla, as transações e a soma ("A soma bate"); as respostas são "Sim, somados no Fincla"
// (`pair_split`) · "Não, adicionar agora" (`create`, abre o formulário) · "Não registrar" (`ignore`,
// a lista fica à vista, cinza listrada). Só a sugestão intacta tem "Confirmar sugestão".
import { memo, useEffect, useRef } from "react";
import { ChevronRight, Sigma, Sparkles } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Badge, Btn, useTouchTarget } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { plural } from "../../plural.js";
import { BOX, BOX_LABEL, SKIP_BG, SkipBadge, bankDateLabel } from "./StatementEntryCard.jsx";
import { ConferidoBadge, ROW_CLICKABLE, openOnRowClick } from "./entryQueue.jsx";

/** As respostas de um lançamento somado em vários do Fincla. */
export const SPLIT_PAIR_ANSWERS = [
  { value: "pair_split", label: "Sim, somados no Fincla", tone: T.blue },
  { value: "create", label: "Não, adicionar agora", tone: T.green },
  { value: "ignore", label: "Não registrar", tone: T.inkLight },
];

export const SPLIT_PAIR_QUESTION = "Já está no Fincla, somado?";

/** A sugestão sem nenhuma mudança: só aí aparece o "Confirmar sugestão". */
export const untouchedSplitPair = (entry) => entry.answer === "pair_split" && !entry.confirmed && Boolean(entry.split_pair);

const splitCount = (entry) => entry.split_pair?.transactions.length ?? 0;

/** "Somado em 6 lançamentos do Fincla". */
export const splitPairSummary = (entry) => `Somado em ${plural(splitCount(entry), "lançamento", "lançamentos")} do Fincla`;

/** O selo do lançamento somado. */
export function SplitPairBadge({ entry }) {
  return (
    <Badge color={T.blue} bg={T.blueLight}>
      <Sigma size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-1px" }} />
      Já está no Fincla, somado{entry.answerable && !entry.confirmed ? " · falta confirmar" : ""}
    </Badge>
  );
}

const sumOf = (split) => (split.total ? Math.abs(split.total.amount) : split.transactions.reduce((sum, t) => sum + Math.abs(t.value), 0));

/** O lado "No Fincla": as transações somadas e a soma; cinza listrado no "Não registrar". */
export function SplitPairFinclaSide({ entry }) {
  const split = entry.split_pair;
  const skipped = entry.answer === "ignore";
  const currency = split.total?.currency ?? split.transactions[0]?.currency ?? entry.currency;
  return (
    <section data-testid={skipped ? "split-pair-side-skipped" : "split-pair-side"} style={{ ...BOX, background: skipped ? SKIP_BG : T.surface }}>
      <div style={BOX_LABEL}>
        No Fincla
        {skipped ? <SkipBadge /> : (
          <span data-testid="sum-matches">
            <Badge color={T.blue} bg={T.blueLight}><Sparkles size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-1px" }} />A soma bate</Badge>
          </span>
        )}
      </div>
      <p style={{ ...G, fontSize: 13, color: T.ink, margin: "0 0 8px" }}>
        Somados no Fincla: <b>{plural(split.transactions.length, "lançamento", "lançamentos")}</b> ·{" "}
        <b style={NUM}>{formatMoney(sumOf(split), currency)}</b>
      </p>
      <ul aria-label="Transações do Fincla somadas" style={{ listStyle: "none", margin: 0, padding: 8, display: "flex", flexDirection: "column", gap: 6, background: T.bg, opacity: skipped ? 0.7 : 1 }}>
        {split.transactions.map((t) => (
          <li key={t.id} data-testid="split-pair-transaction" style={{ ...G, fontSize: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ ...NUM, color: T.inkLight }}>{bankDateLabel(String(t.purchase_date ?? t.date ?? "").slice(0, 10))}</span>
            <span style={{ flex: "1 1 140px", color: T.ink, wordBreak: "break-word" }}>{t.description}</span>
            <span style={{ ...NUM, color: T.inkMid }}>{formatMoney(Math.abs(t.value), t.currency ?? currency)}</span>
          </li>
        ))}
        <li data-testid="split-pair-total" style={{ ...G, fontSize: 12, display: "flex", gap: 10, borderTop: `1px solid ${T.border}`, paddingTop: 6, fontWeight: 700, color: T.ink }}>
          <span style={{ flex: 1 }}>Soma</span>
          <span style={NUM}>{formatMoney(sumOf(split), currency)}</span>
        </li>
      </ul>
      <p style={{ ...G, fontSize: 12, color: T.inkMid, margin: "8px 0 0" }}>
        {skipped
          ? "Este lançamento do banco não entra no Fincla. Os lançamentos acima continuam como estão, e a diferença aparece em Conferir o total."
          : `A soma bate com o lançamento do banco. Se for isso, nada novo é criado: ${split.transactions.length === 1 ? "ele fica ligado" : "eles ficam ligados"} a este lançamento.`}
      </p>
    </section>
  );
}

/** O que acontece ao concluir com "Sim, somados no Fincla". */
export const splitPairOutcome = (entry) => (
  <>Ao concluir: o lançamento fica ligado {splitCount(entry) === 1 ? "à transação somada" : `às ${splitCount(entry)} transações somadas`}. Nada muda nelas.</>
);

/**
 * A linha recolhida de um lançamento sem resposta ou somado ("Somado em 6 lançamentos do Fincla").
 * Clicar em qualquer ponto livre a reabre.
 */
export const InvoiceEntryRow = memo(function InvoiceEntryRowView({ entry, amount, focus = false, conferred = false, onExpand, onUndo = null, busy = false }) {
  const alterRef = useRef(null);
  const touchTarget = useTouchTarget();
  useEffect(() => { if (focus) alterRef.current?.focus({ preventScroll: true }); }, [focus]);
  const split = entry.answer === "pair_split";
  return (
    <div
      data-testid={split ? "split-pair-row" : "unanswered-entry-row"}
      onClick={openOnRowClick(() => onExpand(entry.id))}
      style={{ ...ROW_CLICKABLE, ...G, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface }}
    >
      <button
        ref={alterRef}
        type="button"
        onClick={() => onExpand(entry.id)}
        aria-label={`Alterar o lançamento de ${bankDateLabel(entry.date)}: ${entry.bank_description}`}
        style={{ ...G, fontSize: 12, fontWeight: 600, color: T.blue, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "3px 8px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 2, ...touchTarget }}
      >
        <ChevronRight size={12} aria-hidden="true" />Alterar
      </button>
      <span style={{ ...NUM, fontSize: 12, color: T.inkLight }}>{bankDateLabel(entry.date)}</span>
      <span style={{ fontSize: 13, color: T.ink, fontWeight: 600, flex: "1 1 160px", minWidth: 0, wordBreak: "break-word" }}>{entry.bank_description}</span>
      <span style={{ ...NUM, fontSize: 13 }}>{amount}</span>
      {split ? <SplitPairBadge entry={entry} /> : <Badge color={T.amber} bg={T.amberLight}>Falta responder</Badge>}
      <span style={{ fontSize: 12, color: split ? T.inkMid : T.amber, flex: "1 1 160px", minWidth: 0 }}>
        {split ? splitPairSummary(entry) : "Falta escolher o que fazer com este lançamento"}
      </span>
      {conferred ? <ConferidoBadge /> : null}
      {onUndo ? (
        <Btn variant="ghost" small disabled={busy} onClick={() => onUndo(entry.id)}>
          Desfazer escolha
        </Btn>
      ) : null}
    </div>
  );
});
