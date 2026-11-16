// O lado "No Fincla" de um par (fincla-api#510/#511): a transação OU a transferência que pode ser o
// mesmo lançamento do banco, como está hoje. Mesma anatomia para a sugestão, as opções de uma
// dúvida e os resultados da busca. As diferenças vêm do backend (`differences`) e aparecem com
// destaque e com o que acontece ao concluir: VALOR DIFERENTE (vale o do banco), DATAS DIFERENTES
// (fica paga na data do banco) e OUTRA CONTA (a transação é movida para a conta do extrato).
import { useId } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Badge, Btn } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { bankDateLabel } from "./StatementEntryCard.jsx";
import { InlineFields, useCompact } from "./entryQueue.jsx";

export const MATCH_BOX = { border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, minWidth: 0, flex: 1 };
const BOX_LABEL = { ...G, fontSize: 11, fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", color: T.inkLight, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 };
const DT = { ...G, fontSize: 11, color: T.inkLight };
const DD = { ...G, fontSize: 13, color: T.ink, margin: 0, minWidth: 0, wordBreak: "break-word" };
const KIND_LABEL = { income: "Receita", refund: "Estorno", expense: "Despesa", transfer: "Transferência" };

/** O dia como a tela mostra: os 10 primeiros caracteres, sem passar por `Date`. */
export const dayOf = (value) => String(value ?? "").slice(0, 10);
export const paidWord = (entry) => (entry.amount < 0 ? "fica paga" : "fica recebida");

/** Valor com o sentido do lançamento: saída com "−", entrada com "+". */
export const signedMoney = (entry, value, currency) => formatMoney(entry.amount < 0 ? -value : value, currency);

/** O nome que a pessoa reconhece: a descrição, ou "Transferência para/de <conta>". */
export function matchTitle(entry, match) {
  if (match.kind !== "transfer") return match.description;
  if (match.description) return match.description;
  return entry.amount < 0 ? `Transferência para ${match.to_account_name ?? "outra conta"}` : `Transferência de ${match.from_account_name ?? "outra conta"}`;
}

const has = (match, difference) => (match?.differences ?? []).includes(difference);
/** Há algo a dizer sobre o que acontece ao concluir (VALOR DIFERENTE, DATAS DIFERENTES, OUTRA CONTA). */
const hasConsequences = (match) => ["amount", "date", "account"].some((d) => has(match, d));

/** Destaque de uma informação que difere do banco. */
export function Hl({ on, children }) {
  if (!on) return children;
  return <span data-testid="match-highlight" style={{ background: T.amberLight, color: T.ink, fontWeight: 700, borderRadius: 4, padding: "0 3px" }}>{children}</span>;
}

/** Selo de uma diferença (texto em maiúsculas, como no protótipo). */
export function DifferenceTag({ children }) {
  return <Badge color={T.amber} bg={T.amberLight}>{children}</Badge>;
}

export function SuggestedBadge() {
  return (
    <Badge color={T.blue} bg={T.blueLight}>
      <Sparkles size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-1px" }} />
      Sugerido pelo Fincla
    </Badge>
  );
}

/**
 * O que cada diferença faz ao concluir. `ifChosen` acrescenta "(se for esta)" quando a pessoa ainda
 * está escolhendo (opções e busca).
 */
export function MatchConsequences({ entry, match, accountName, ifChosen = false, id = undefined }) {
  const when = <>Ao <b>concluir a conciliação</b>{ifChosen ? " (se for esta)" : ""}</>;
  const lines = [];
  if (has(match, "amount")) {
    const diff = Math.abs(Math.abs(entry.amount) - match.value);
    lines.push(
      <div key="amount" data-testid="consequence-amount">
        <DifferenceTag>VALOR DIFERENTE</DifferenceTag>{" "}
        <span>
          Diferença de <b style={NUM}>{formatMoney(diff, match.currency)}</b>. {when}, o valor no Fincla muda:{" "}
          <s style={{ ...NUM, color: T.inkLight }}>{signedMoney(entry, match.value, match.currency)}</s>{" "}
          <ArrowRight size={12} aria-label="para" style={{ verticalAlign: "-2px" }} />{" "}
          <b style={NUM}>{formatMoney(entry.amount, entry.currency)}</b> <span style={{ color: T.inkLight }}>(vale o do banco)</span>
        </span>
      </div>,
    );
  }
  if (has(match, "date")) {
    lines.push(
      <div key="date" data-testid="consequence-date">
        <DifferenceTag>DATAS DIFERENTES</DifferenceTag>{" "}
        {match.kind === "transfer" ? (
          <span>
            {when}, a transferência continua em <b style={NUM}>{bankDateLabel(match.day)}</b>: a conciliação não muda transferências.
          </span>
        ) : (
          <span>
            {when}, {paidWord(entry)} em <b style={NUM}>{bankDateLabel(entry.date)}</b> (data do banco). A data da transação,{" "}
            <b style={NUM}>{bankDateLabel(dayOf(match.date))}</b>, continua.
          </span>
        )}
      </div>,
    );
  }
  if (has(match, "account")) {
    lines.push(
      <div key="account" data-testid="consequence-account">
        <DifferenceTag>OUTRA CONTA</DifferenceTag>{" "}
        <span>
          {when}, a transação é movida: <b>{match.account_name ?? "outra conta"}</b>{" "}
          <ArrowRight size={12} aria-label="para" style={{ verticalAlign: "-2px" }} /> <b>{accountName || "esta conta"}</b>
        </span>
      </div>,
    );
  }
  if (!lines.length) return null;
  return (
    <div id={id} style={{ ...G, fontSize: 12, color: T.inkMid, marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${T.border}`, display: "flex", flexDirection: "column", gap: 6, lineHeight: 1.5 }}>
      {lines}
    </div>
  );
}

/** As linhas do "No Fincla": data, descrição, valor, conta, categoria, etiquetas e situação. */
function MatchRows({ entry, match, highlight }) {
  const compact = useCompact();
  const transfer = match.kind === "transfer";
  const rows = [
    ["Data", <span key="d" style={NUM}><Hl on={highlight && has(match, "date")}>{bankDateLabel(dayOf(match.date))}</Hl></span>],
    ["Descrição", <b key="n">{matchTitle(entry, match)}</b>],
    ["Valor", <b key="v" style={NUM}><Hl on={highlight && has(match, "amount")}>{signedMoney(entry, match.value, match.currency)}</Hl></b>],
  ];
  if (transfer) {
    rows.push(["Contas", <span key="c">{match.from_account_name} → {match.to_account_name}</span>]);
  } else {
    if (match.account_name) rows.push(["Conta", <Hl key="c" on={highlight && has(match, "account")}>{match.account_name}</Hl>]);
    rows.push(["Categoria", match.category_name ?? "Sem categoria"]);
    if (match.tag_names?.length) rows.push(["Etiquetas", match.tag_names.join(", ")]);
    rows.push(["Situação", match.paid_at ? `${match.type === "expense" ? "Paga" : "Recebida"} em ${bankDateLabel(dayOf(match.paid_at))}` : "Em aberto"]);
  }
  if (compact) {
    // Compacta (fincla-api#517): data, descrição e valor numa linha; o resto na segunda.
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <InlineFields testId="match-inline" items={rows.slice(0, 3)} />
        <InlineFields items={rows.slice(3)} />
      </div>
    );
  }
  return (
    <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: "4px 12px", alignItems: "baseline" }}>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: "contents" }}>
          <dt style={DT}>{label}</dt>
          <dd style={DD}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Uma transação/transferência do Fincla. `onPick` a torna uma opção clicável (`aria-pressed` =
 * `pressed`); `takenBy` a mostra desativada, com o lançamento que já a usa e "Desfazer lá".
 */
export function FinclaMatchBox({
  entry, match, accountName, suggested = false, pressed = false, onPick = null,
  takenBy = null, onUndoThere = null, ifChosen = false, consequences = true, testId = "fincla-side", onConfirm = null,
}) {
  const pad = useCompact() ? { padding: "8px 10px" } : null;
  const consequencesId = useId();
  const label = (
    <div style={BOX_LABEL}>
      No Fincla <Badge>{KIND_LABEL[match.type] ?? match.type}</Badge>
      {suggested ? <SuggestedBadge /> : null}
    </div>
  );
  if (takenBy) {
    return (
      <div data-testid="match-taken" aria-disabled="true" style={{ ...MATCH_BOX, ...pad, background: T.grayLight, opacity: 0.85 }}>
        {label}
        <MatchRows entry={entry} match={match} highlight={false} />
        <p style={{ ...G, fontSize: 12, color: T.inkMid, margin: "8px 0 0" }}>
          Você já disse que esta é o lançamento do banco de <b style={NUM}>{bankDateLabel(takenBy.date)}</b> ({takenBy.bank_description}).{" "}
          {onUndoThere ? (
            <Btn variant="outGray" small onClick={() => onUndoThere(takenBy)}>Desfazer lá</Btn>
          ) : null}
        </p>
      </div>
    );
  }
  const showConsequences = consequences && hasConsequences(match);
  const body = (
    <>
      {label}
      <MatchRows entry={entry} match={match} highlight />
      {consequences ? (
        <MatchConsequences entry={entry} match={match} accountName={accountName} ifChosen={ifChosen} id={consequencesId} />
      ) : null}
    </>
  );
  if (onPick) {
    // A opção inteira é clicável, mas o botão não embrulha a lista de dados (HTML válido): ele cobre a
    // caixa por cima, com o nome curto, e o leitor de tela ouve as consequências pela descrição.
    return (
      <div
        data-testid="match-option"
        data-pressed={pressed ? "true" : "false"}
        style={{ ...MATCH_BOX, ...pad, position: "relative", background: pressed ? T.blueLight : T.surface, borderColor: pressed ? T.blue : T.border, borderWidth: pressed ? 2 : 1 }}
      >
        {body}
        <button
          type="button"
          aria-pressed={pressed}
          aria-label={`${matchTitle(entry, match)}, ${bankDateLabel(dayOf(match.date))}, ${signedMoney(entry, match.value, match.currency)}`}
          aria-describedby={showConsequences ? consequencesId : undefined}
          onClick={() => onPick(match)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", margin: 0, padding: 0, border: 0, borderRadius: "inherit", background: "transparent", cursor: "pointer" }}
        />
      </div>
    );
  }
  // `onConfirm`: a única transação sugerida, já marcada "Sim, é esta". Clicar nela confirma, como o
  // botão; o botão invisível cobre a caixa sem embrulhar a lista de dados (HTML válido).
  return (
    <section data-testid={testId} style={{ ...MATCH_BOX, ...pad, borderColor: entry.answer === "pair" ? T.blue : T.border, ...(onConfirm ? { position: "relative" } : null) }}>
      {body}
      {onConfirm ? (
        <button
          type="button"
          aria-label={`Confirmar que é ${matchTitle(entry, match)}, ${bankDateLabel(dayOf(match.date ?? match.day))}, ${signedMoney(entry, match.value, match.currency)}`}
          aria-describedby={showConsequences ? consequencesId : undefined}
          onClick={onConfirm}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", margin: 0, padding: 0, border: 0, borderRadius: "inherit", background: "transparent", cursor: "pointer" }}
        />
      ) : null}
    </section>
  );
}
