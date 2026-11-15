// Passo "Confirmar lançamentos encontrados" (fincla-api#510).
//
// Cada lançamento do banco que o Fincla achou já registrado vem como um par: à esquerda o banco,
// à direita a transação do Fincla com o selo "Sugerido pelo Fincla", ligados por uma linha. A
// sugestão já vem respondida "Sim, é esta" e falta a pessoa confirmar. Responder (ou "Confirmar
// os N de uma vez") minimiza o cartão numa linha que continua visível, com "Alterar" e "Desfazer
// escolha": nada some sem um jeito de voltar. Nada muda no Fincla antes de concluir.
import { Ban, Check, ChevronRight, Link2, Plus, Sparkles } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Badge, Btn } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { plural } from "../../plural.js";
import { StatementEntryCard, bankDateLabel } from "./StatementEntryCard.jsx";
import { unconfirmedSuggestions } from "./reconciliationSteps.js";
import { LINK } from "./StatementImportNotes.jsx";

const BOX = { border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, minWidth: 0, flex: 1 };
const BOX_LABEL = { ...G, fontSize: 11, fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", color: T.inkLight, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 };
const DT = { ...G, fontSize: 11, color: T.inkLight };
const DD = { ...G, fontSize: 13, color: T.ink, margin: 0, minWidth: 0, wordBreak: "break-word" };
const TYPE_LABEL = { income: "Receita", refund: "Estorno", expense: "Despesa" };

const ANSWERS = [
  { value: "pair", label: "Sim, é esta", tone: T.blue },
  { value: "create", label: "Não, adicionar agora", tone: T.green },
  { value: "ignore", label: "Não registrar", tone: T.inkLight },
];

/** O dia como a tela mostra: os 10 primeiros caracteres, sem passar por `Date`. */
const dayOf = (value) => String(value ?? "").slice(0, 10);
const paidWord = (entry) => (entry.amount < 0 ? "fica paga" : "fica recebida");

function BankSide({ entry, dateDiffers }) {
  const moneyIn = entry.amount > 0;
  return (
    <section style={{ ...BOX, background: T.bg }}>
      <div style={BOX_LABEL}>No extrato do banco</div>
      <div style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink, wordBreak: "break-word" }}>{entry.bank_description}</div>
      <div style={{ ...G, ...NUM, fontSize: 12, color: dateDiffers ? T.amber : T.inkLight, fontWeight: dateDiffers ? 700 : 400, marginTop: 6 }}>
        {bankDateLabel(entry.date)}
      </div>
      <div style={{ ...G, ...NUM, fontSize: 16, fontWeight: 700, marginTop: 6, color: moneyIn ? T.green : T.ink }}>
        {formatMoney(entry.amount, entry.currency)}
      </div>
    </section>
  );
}

/** A linha entre o banco e o Fincla: ligados (par), nova transação, ou nada. */
function Connector({ answer, isMobile }) {
  const look = {
    pair: { color: T.blue, line: "solid", Icon: Link2, label: "ligado" },
    create: { color: T.green, line: "dashed", Icon: Plus, label: "nova transação" },
    ignore: { color: T.inkFaint, line: "none", Icon: Ban, label: "não registrar" },
  }[answer] ?? { color: T.amber, line: "dotted", Icon: Link2, label: "sem resposta" };
  const { Icon } = look;
  return (
    <div
      data-testid="pair-connector"
      data-link={answer ?? "none"}
      aria-hidden="true"
      style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "stretch", minWidth: isMobile ? 0 : 36, minHeight: 32 }}
    >
      <span style={isMobile
        ? { position: "absolute", top: 4, bottom: 4, left: "50%", borderLeft: look.line === "none" ? "none" : `2px ${look.line} ${look.color}` }
        : { position: "absolute", left: 2, right: 2, top: "50%", borderTop: look.line === "none" ? "none" : `2px ${look.line} ${look.color}` }}
      />
      <span style={{ position: "relative", width: 28, height: 28, borderRadius: 9999, display: "grid", placeItems: "center", background: T.surface, border: `1.5px solid ${look.color}`, color: look.color }}>
        <Icon size={14} />
      </span>
    </div>
  );
}

function SuggestedBadge() {
  return (
    <Badge color={T.blue} bg={T.blueLight}>
      <Sparkles size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-1px" }} />
      Sugerido pelo Fincla
    </Badge>
  );
}

/** A transação do Fincla como ela está hoje, com o selo e o que muda ao concluir. */
function FinclaSide({ entry, dateDiffers }) {
  const tx = entry.fincla_transaction;
  if (!tx) {
    return (
      <section style={{ ...BOX, background: T.grayLight }}>
        <div style={BOX_LABEL}>No Fincla</div>
        <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: 0 }}>
          A transação sugerida não existe mais no Fincla. Escolha “Não, adicionar agora” ou “Não registrar”.
        </p>
      </section>
    );
  }
  const rows = [
    ["Data", <span key="d" style={{ ...NUM, color: dateDiffers ? T.amber : T.ink, fontWeight: dateDiffers ? 700 : 400 }}>{bankDateLabel(dayOf(tx.date))}</span>],
    ["Descrição", <b key="n">{tx.description}</b>],
    ["Valor", <b key="v" style={NUM}>{formatMoney(tx.type === "expense" ? -tx.value : tx.value, tx.currency)}</b>],
    ["Categoria", tx.category_name ?? "Sem categoria"],
  ];
  if (tx.tag_names.length) rows.push(["Etiquetas", tx.tag_names.join(", ")]);
  rows.push(["Situação", tx.paid_at ? `${tx.type === "expense" ? "Paga" : "Recebida"} em ${bankDateLabel(dayOf(tx.paid_at))}` : "Em aberto"]);
  return (
    <section data-testid="fincla-side" style={{ ...BOX, borderColor: entry.answer === "pair" ? T.blue : T.border }}>
      <div style={BOX_LABEL}>
        No Fincla <Badge>{TYPE_LABEL[tx.type] ?? tx.type}</Badge>
        {tx.id === entry.suggested_transaction_id ? <SuggestedBadge /> : null}
      </div>
      <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: "4px 12px", alignItems: "baseline" }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: "contents" }}>
            <dt style={DT}>{label}</dt>
            <dd style={DD}>{value}</dd>
          </div>
        ))}
      </dl>
      {dateDiffers ? (
        <div style={{ ...G, fontSize: 12, color: T.inkMid, marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${T.border}`, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
          <Badge color={T.amber} bg={T.amberLight}>DATAS DIFERENTES</Badge>
          <span style={{ flex: 1, minWidth: 200 }}>
            Ao concluir a conciliação, {paidWord(entry)} em <b style={NUM}>{bankDateLabel(entry.date)}</b> (data do banco). A data da
            transação, <b style={NUM}>{bankDateLabel(dayOf(tx.date))}</b>, continua.
          </span>
        </div>
      ) : null}
    </section>
  );
}

function IgnoredSide() {
  return (
    <section style={{ ...BOX, background: T.grayLight }}>
      <div style={BOX_LABEL}>
        No Fincla <Badge><Ban size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-1px" }} />Não registrar</Badge>
      </div>
      <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: 0 }}>
        Este lançamento não entra no Fincla. O saldo do Fincla fica sem este valor, e a diferença aparece na conferência de saldo.
      </p>
    </section>
  );
}

/** Em uma linha, o que acontece ao concluir a conciliação. */
function outcomeText(entry) {
  const tx = entry.fincla_transaction;
  if (entry.answer === "pair" && tx) {
    return <>Ao concluir a conciliação: <b>{tx.description}</b> {paidWord(entry)} em <b style={NUM}>{bankDateLabel(entry.date)}</b> (data do banco). Descrição, data, categoria e etiquetas continuam como estão.</>;
  }
  if (entry.answer === "create") {
    return <>Ao concluir a conciliação: será adicionada <b>“{entry.description || "(sem descrição)"}”</b>, paga na data do banco. A transação sugerida fica como está.</>;
  }
  if (entry.answer === "ignore") return <>Este lançamento não entra no Fincla. Ele aparece na conferência de saldo.</>;
  return null;
}

function StatusBadge({ entry }) {
  if (entry.answer === "pair" && !entry.confirmed) {
    return <Badge color={T.blue} bg={T.blueLight}><Sparkles size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-1px" }} />Sugerido · falta confirmar</Badge>;
  }
  if (entry.answer === "pair") return <Badge color={T.blue} bg={T.blueLight}><Link2 size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-1px" }} />Sim, já está no Fincla</Badge>;
  if (entry.answer === "create") return <Badge color={T.green} bg={T.greenLight}><Plus size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-1px" }} />Adicionar agora</Badge>;
  return <Badge><Ban size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-1px" }} />Não registrar</Badge>;
}

function AnswerButtons({ entry, busy, onAnswer }) {
  const label = "Este lançamento do banco já está no Fincla?";
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink }}>{label}</span>
      <div role="group" aria-label={label} style={{ display: "inline-flex", flexWrap: "wrap", border: `1px solid ${T.border}`, borderRadius: 9, overflow: "hidden" }}>
        {ANSWERS.map((a, index) => {
          const pressed = entry.answer === a.value;
          const unavailable = a.value === "pair" && !entry.fincla_transaction;
          return (
            <button
              key={a.value}
              type="button"
              aria-pressed={pressed}
              disabled={busy || unavailable}
              onClick={() => onAnswer(entry, a.value)}
              style={{
                ...G, minHeight: 32, padding: "0 12px", fontSize: 12, fontWeight: 600, cursor: busy || unavailable ? "not-allowed" : "pointer",
                border: 0, borderRight: index < ANSWERS.length - 1 ? `1px solid ${T.border}` : 0,
                background: pressed ? a.tone : "transparent", color: pressed ? "#fff" : T.inkLight,
              }}
            >
              {a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UndoChoiceButton({ entry, onUndoChoice }) {
  return (
    <button type="button" onClick={() => onUndoChoice(entry)} style={{ ...LINK, fontSize: 12, color: T.inkMid }}>
      Desfazer escolha
    </button>
  );
}

/** O cartão aberto de um par sugerido. */
function PairCard({ entry, isMobile, busy, canUndo, categories, details, fallbackLabel, onAnswer, onChange, onUndoChoice, onMinimize }) {
  const tx = entry.fincla_transaction;
  const dateDiffers = Boolean(tx) && entry.answer === "pair" && dayOf(tx.paid_at ?? tx.date) !== entry.date;
  const outcome = outcomeText(entry);
  let right;
  if (entry.answer === "create") {
    right = <StatementEntryCard entry={entry} categories={categories} details={details} fallbackLabel={fallbackLabel} isMobile={isMobile} onChange={onChange} embedded />;
  } else if (entry.answer === "ignore") {
    right = <IgnoredSide />;
  } else {
    right = <FinclaSide entry={entry} dateDiffers={dateDiffers} />;
  }
  return (
    <article
      data-testid="pair-card"
      aria-label={`Lançamento de ${bankDateLabel(entry.date)}: ${entry.bank_description}`}
      style={{ background: T.surface, border: `1px solid ${entry.answer === "pair" && !entry.confirmed ? T.blue : T.border}`, borderRadius: 14, boxShadow: T.sm, overflow: "hidden" }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
        <span style={{ ...G, ...NUM, fontSize: 13, fontWeight: 600, color: T.ink }}>{bankDateLabel(entry.date)}</span>
        <StatusBadge entry={entry} />
        <span style={{ flex: 1 }} />
        {canUndo ? <UndoChoiceButton entry={entry} onUndoChoice={onUndoChoice} /> : null}
        {entry.confirmed ? <Btn variant="outGray" small onClick={() => onMinimize(entry)}>Minimizar</Btn> : null}
      </header>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 4 : 0, padding: 14, alignItems: "stretch" }}>
        <BankSide entry={entry} dateDiffers={dateDiffers} />
        <Connector answer={entry.answer} isMobile={isMobile} />
        <div style={{ display: "flex", flex: 1, minWidth: 0 }}>{right}</div>
      </div>
      <footer style={{ padding: "10px 14px", background: T.bg, borderTop: `1px solid ${T.border}` }}>
        <AnswerButtons entry={entry} busy={busy} onAnswer={onAnswer} />
      </footer>
      {outcome ? (
        <p data-testid="pair-outcome" style={{ ...G, fontSize: 12, color: T.inkMid, margin: 0, padding: "8px 14px", borderTop: `1px solid ${T.border}` }}>
          <span aria-hidden="true" style={{ marginRight: 6 }}>→</span>{outcome}
        </p>
      ) : null}
    </article>
  );
}

function rowSummary(entry) {
  const tx = entry.fincla_transaction;
  if (entry.answer === "pair" && tx) return <>Sim, é <b>{tx.description}</b> · {bankDateLabel(dayOf(tx.date))} · {paidWord(entry)} em {bankDateLabel(entry.date)}</>;
  if (entry.answer === "create") return <>Adicionar ao Fincla: <b>{entry.description || "(sem descrição)"}</b></>;
  return <span style={{ color: T.inkLight }}>Fica fora do Fincla</span>;
}

/** Um par já decidido, minimizado numa linha que continua visível e pode ser reaberta. */
function PairRow({ entry, canUndo, onOpen, onUndoChoice }) {
  return (
    <div data-testid="pair-row" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", borderBottom: `1px solid ${T.border}`, ...G, fontSize: 12, color: T.inkMid }}>
      <button
        type="button"
        onClick={() => onOpen(entry)}
        aria-label={`Alterar o lançamento de ${bankDateLabel(entry.date)}: ${entry.bank_description}`}
        style={{ ...LINK, fontSize: 12, color: T.blue, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 2 }}
      >
        <ChevronRight size={13} aria-hidden="true" />Alterar
      </button>
      <span style={{ ...NUM, color: T.inkLight }}>{bankDateLabel(entry.date)}</span>
      <span style={{ color: T.ink, fontWeight: 600, minWidth: 0, wordBreak: "break-word" }}>{entry.bank_description}</span>
      <span style={{ ...NUM, color: entry.amount > 0 ? T.green : T.ink }}>{formatMoney(entry.amount, entry.currency)}</span>
      <StatusBadge entry={entry} />
      <span style={{ flex: 1, minWidth: 160 }}>{rowSummary(entry)}</span>
      {canUndo ? <UndoChoiceButton entry={entry} onUndoChoice={onUndoChoice} /> : null}
    </div>
  );
}

/**
 * O passo inteiro. `opened` são os cartões que a pessoa reabriu; `history` guarda, por lançamento,
 * as respostas anteriores para "Desfazer escolha"; `lastBulk` é a última confirmação em lote, com
 * a sua barra de desfazer.
 */
export function SuggestedPairsStep({
  entries,
  isMobile,
  busy,
  categories,
  details = [],
  fallbackLabel,
  opened,
  history,
  lastBulk,
  onAnswer,
  onChange,
  onUndoChoice,
  onOpen,
  onMinimize,
  onConfirmAll,
  onUndoConfirmAll,
}) {
  const unconfirmed = unconfirmedSuggestions(entries);
  const isOpen = (e) => !e.confirmed || opened.has(e.id);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ ...G, ...NUM, fontSize: 13, color: T.inkMid }}>{plural(entries.length, "lançamento encontrado", "lançamentos encontrados")}</span>
        {unconfirmed.length ? (
          <Btn variant="dark" small disabled={busy} onClick={() => onConfirmAll(unconfirmed.map((e) => e.id))}>
            <Check size={13} aria-hidden="true" /> Confirmar os {unconfirmed.length} de uma vez
          </Btn>
        ) : (
          <span style={{ ...G, fontSize: 12, color: T.green, fontWeight: 600 }}>Todos conferidos</span>
        )}
      </div>
      {lastBulk ? (
        <div role="status" style={{ ...G, fontSize: 13, color: T.ink, background: T.greenLight, border: `1px solid ${T.greenBorder}`, borderRadius: 10, padding: "8px 12px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Check size={14} aria-hidden="true" style={{ color: T.green }} />
          <span style={{ flex: 1 }}>{plural(lastBulk.length, "lançamento confirmado", "lançamentos confirmados")}</span>
          <button type="button" onClick={onUndoConfirmAll} disabled={busy} style={{ ...LINK, color: T.ink }}>Desfazer</button>
        </div>
      ) : null}
      {entries.map((entry) => (isOpen(entry) ? (
        <PairCard
          key={entry.id}
          entry={entry}
          isMobile={isMobile}
          busy={busy}
          canUndo={Boolean(history[entry.id]?.length)}
          categories={categories}
          details={details}
          fallbackLabel={fallbackLabel}
          onAnswer={onAnswer}
          onChange={onChange}
          onUndoChoice={onUndoChoice}
          onMinimize={onMinimize}
        />
      ) : (
        <div key={entry.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
          <PairRow entry={entry} canUndo={Boolean(history[entry.id]?.length)} onOpen={onOpen} onUndoChoice={onUndoChoice} />
        </div>
      )))}
    </div>
  );
}
