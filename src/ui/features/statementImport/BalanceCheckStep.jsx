// "Conferir o saldo" e o painel de diferença do "Revisar e concluir" (fincla-api#514).
//
// O backend calcula tudo (a mesma regra do saldo da conta, com as respostas projetadas): esta tela
// só mostra. O painel diz se os saldos batem e o PRIMEIRO dia em que se separam; a lista mostra as
// transações do Fincla sem par no extrato, com Abrir / Mudar data / Excluir / Está certa assim
// (uma por vez, no mecanismo de lista da #517, ou várias marcadas). Excluir e mudar data só valem ao
// concluir: o item continua à vista (riscado, ou data antiga → nova) com "Desfazer". As
// transferências sem par (G3-3-10) entram na mesma lista, só para ver: a conciliação nunca altera
// transferência, então elas têm "Abrir" e nada mais.
import { memo, useState } from "react";
import { AlertTriangle, Check, Info, Link2, X } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Badge, Btn, Card } from "../../components/primitives";
import { plural } from "../../plural.js";
import { formatMoney, formatMoneySigned } from "../../money/formatMoney.js";

/** Com sinal (−/+), e zero sem sinal: "R$ 0,00". */
const signed = (value, currency) => (value === 0 ? formatMoney(0, currency) : formatMoneySigned(value, currency));
import { todayLocalYmd } from "../../data/transactionsAdapter.js";
import { MONTH_NAMES, bankDateLabel, dayMonthLabel } from "./StatementEntryCard.jsx";
import { invoiceLabel, invoiceUnavailable, invoiceUnavailableText, isPaidNow } from "./InvoicePaymentStep.jsx";
import { LINK } from "./StatementImportNotes.jsx";
import { CurrentEntryFrame, EntryQueueHeader, ROW_CLICKABLE, TRANSACTION_NOUN, openOnRowClick } from "./entryQueue.jsx";

/** "7 de outubro" (o dia por extenso, sem converter fuso: lê AAAA-MM-DD). */
export function longDateLabel(ymd) {
  const [, m, d] = String(ymd ?? "").split("-");
  return m && d ? `${Number(d)} de ${MONTH_NAMES[Number(m) - 1]}` : "";
}

/** O mês do último saldo, para "Diferença de saldo que fica no fim de outubro". */
export function monthOf(ymd) {
  const [, m] = String(ymd ?? "").split("-");
  return m ? MONTH_NAMES[Number(m) - 1] : "";
}

/** O id que a lista (#517) usa para cada transação. */
export const unmatchedItemId = (u) => `tx-${u.transaction_id}`;
/** "Respondida" na lista = a pessoa já disse algo dela. */
export const isCheckAnswered = (item) => item.check !== null && item.check !== undefined;

const HINT = { ...G, fontSize: 13, color: T.ink, borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8, alignItems: "flex-start" };
const AMBER = { ...HINT, background: T.amberLight, border: `1px solid ${T.amberBorder}` };
const BLUE = { ...HINT, background: T.blueLight, border: `1px solid ${T.blue}` };
const SECTION = { ...G, fontSize: 11, fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", margin: "8px 0 0", display: "flex", gap: 8, alignItems: "center" };
const ROW = { ...G, display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 12, background: T.surface };

// --------------------------------------------------------------------------------------------
// O painel
// --------------------------------------------------------------------------------------------

function differenceTitle(check) {
  if (check.final_difference === null) return "O arquivo não informa saldo";
  if (check.final_difference === 0) return check.first_divergent_date ? "Os saldos batem no fim do extrato" : "Os saldos batem";
  return `Diferença de ${signed(check.final_difference, check.currency)}`;
}

function DifferenceText({ check }) {
  const { points, first_divergent_date: first } = check;
  if (!points.length) {
    return <>Sem saldo no arquivo não dá para comparar. Nenhuma diferença fica registrada ao concluir.</>;
  }
  const last = points[points.length - 1];
  if (!first) return <>Banco e Fincla terminam {dayMonthLabel(last.date)} com <b style={NUM}>{formatMoney(last.bank, last.currency)}</b>.</>;
  const index = points.findIndex((p) => p.date === first);
  if (index > 0) {
    return (
      <>Os saldos estavam iguais até <b style={NUM}>{bankDateLabel(points[index - 1].date)}</b>. A partir de <b>{longDateLabel(first)}</b> eles se separam.</>
    );
  }
  return <>Já no primeiro saldo do extrato, em <b>{longDateLabel(first)}</b>, eles estão diferentes.</>;
}

/** Os dias em que o banco informa saldo: verde bate, vermelho diferente; o primeiro diferente marcado. */
function DayStrip({ check }) {
  if (check.points.length < 2) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <ol aria-label="Saldos do extrato por dia" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 4 }}>
        {check.points.map((p) => {
          const ok = p.difference === 0;
          const first = p.date === check.first_divergent_date;
          const label = ok
            ? `${bankDateLabel(p.date)}: bate`
            : `${bankDateLabel(p.date)}: diferença de ${signed(p.difference, p.currency)}`;
          return (
            <li
              key={p.date}
              data-testid="balance-day"
              data-state={ok ? "ok" : "off"}
              title={label}
              aria-label={first ? `${label} (primeiro dia diferente)` : label}
              style={{
                ...G, ...NUM, fontSize: 11, fontWeight: 600, minWidth: 40, textAlign: "center", padding: "3px 4px", borderRadius: 6,
                color: ok ? T.green : T.red, background: ok ? T.greenLight : T.redLight,
                border: `${first ? 2 : 1}px solid ${ok ? T.greenBorder : T.red}`,
              }}
            >
              {dayMonthLabel(p.date)}
            </li>
          );
        })}
      </ol>
      <span style={{ ...G, fontSize: 11, color: T.inkLight }}>verde: bate · vermelho: diferente · borda grossa: primeiro dia diferente</span>
    </div>
  );
}

/** "Diferença de R$ X" ou "Os saldos batem", com o primeiro dia em que se separam (topo do passo). */
export function BalanceDifferencePanel({ check }) {
  const last = check.points[check.points.length - 1];
  const off = check.final_difference !== null && check.final_difference !== 0;
  return (
    <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div data-testid="balance-panel" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <h3 data-testid="balance-title" style={{ ...G, ...NUM, fontSize: 20, fontWeight: 800, margin: 0, color: off ? T.red : T.ink }}>
            {differenceTitle(check)}
          </h3>
          <p data-testid="balance-first-day" style={{ ...G, fontSize: 13, color: T.inkMid, margin: "6px 0 0" }}>
            <DifferenceText check={check} />
          </p>
        </div>
        {last ? (
          <div style={{ ...G, ...NUM, fontSize: 12, color: T.inkMid, textAlign: "right" }}>
            Banco em {bankDateLabel(last.date)}: <b>{formatMoney(last.bank, last.currency)}</b>
            <br />
            Fincla em {bankDateLabel(last.date)}: <b>{formatMoney(last.fincla, last.currency)}</b>
          </div>
        ) : null}
      </div>
      <DayStrip check={check} />
    </Card>
  );
}

/**
 * "Diferença de saldo agora", no topo de todos os passos (história 24): banco × Fincla no último saldo
 * do arquivo, já com as respostas. `point` = `balance_now` do rascunho (ou o último ponto da conferência
 * aberta); `null` = o arquivo não informa saldo: "—", nunca zero.
 */
export function BalanceNowPanel({ point, compact = false }) {
  const known = Boolean(point);
  const ok = known && point.difference === 0;
  const tone = !known ? { border: T.border, bg: T.surface, ink: T.inkMid } : ok
    ? { border: T.greenBorder, bg: T.greenLight, ink: T.green }
    : { border: T.red, bg: T.redLight, ink: T.red };
  const state = !known ? "unknown" : ok ? "ok" : "off";
  if (compact) {
    // Celular: uma linha só (rótulo curto + valor), para o painel fixo não tomar a tela.
    return (
      <div
        data-testid="balance-now"
        data-state={state}
        data-compact="true"
        role="status"
        aria-live="polite"
        aria-label={known ? undefined : "Diferença de saldo agora: o arquivo não informa saldo"}
        style={{ ...G, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minWidth: 0, border: `1px solid ${tone.border}`, background: tone.bg, borderRadius: 12, padding: "8px 14px", boxShadow: T.sm }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", color: T.inkMid }}>Diferença agora</span>
        <span data-testid="balance-now-value" style={{ ...NUM, fontSize: 16, fontWeight: 800, color: tone.ink, whiteSpace: "nowrap" }}>
          {known ? signed(point.difference, point.currency) : "—"}
        </span>
      </div>
    );
  }
  let sub;
  if (!known) sub = "O arquivo não informa saldo";
  else if (ok) sub = <>Banco e Fincla batem em {dayMonthLabel(point.date)}</>;
  else sub = <>Banco <b style={NUM}>{formatMoney(point.bank, point.currency)}</b> · Fincla <b style={NUM}>{formatMoney(point.fincla, point.currency)}</b> em {dayMonthLabel(point.date)}</>;
  return (
    <div
      data-testid="balance-now"
      data-state={state}
      role="status"
      aria-live="polite"
      style={{ ...G, minWidth: 0, flex: "1 1 240px", border: `1px solid ${tone.border}`, background: tone.bg, borderRadius: 14, padding: "12px 16px", boxShadow: T.sm }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", color: T.inkMid }}>Diferença de saldo agora</div>
      <div data-testid="balance-now-value" style={{ ...NUM, fontSize: 22, fontWeight: 800, color: tone.ink, marginTop: 2 }}>
        {known ? signed(point.difference, point.currency) : "—"}
      </div>
      <div style={{ fontSize: 12, color: T.inkMid, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

/** O ponto do topo: o da conferência aberta (mais novo depois de uma resposta dela), senão o do rascunho. */
export function balanceNowOf(statementImport, check) {
  if (check?.points?.length) return check.points[check.points.length - 1];
  return statementImport?.balance_now ?? null;
}

/** "Você pode concluir mesmo assim": a diferença fica registrada, sem ajuste de saldo. */
export function ConcludeWithDifferenceNote({ check }) {
  if (!check || check.final_difference === null || check.final_difference === 0) return null;
  return (
    <div data-testid="conclude-with-difference" role="note" style={AMBER}>
      <AlertTriangle size={15} aria-hidden="true" style={{ color: T.amber, flexShrink: 0, marginTop: 2 }} />
      <span>
        Você pode concluir mesmo assim. A diferença de <b style={NUM}>{signed(check.final_difference, check.currency)}</b> fica
        registrada nesta conciliação, para você ver depois. O Fincla não cria nenhum ajuste de saldo.
      </span>
    </div>
  );
}

// --------------------------------------------------------------------------------------------
// A lista de transações sem par
// --------------------------------------------------------------------------------------------

const REFUSAL_TEXT = {
  goal: "Ligada a um aporte de meta: desfaça o aporte na meta para poder excluir.",
  refunded: "Tem um estorno ligado a ela: cuide do estorno em Lançamentos para poder excluir.",
};

function CheckState({ item, periodEnd, onUndo, busy }) {
  if (item.check === "delete") {
    return (
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <Badge color={T.red} bg={T.redLight}>Será excluída ao concluir</Badge>
        <button type="button" disabled={busy} onClick={onUndo} style={{ ...LINK, fontSize: 12, color: T.blue }}>Desfazer exclusão</button>
      </span>
    );
  }
  if (item.check === "change_date") {
    const out = periodEnd && item.new_date > periodEnd;
    return (
      <span data-testid="date-change" style={{ ...G, display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
        <Badge color={T.blue} bg={T.blueLight}>Data muda ao concluir</Badge>
        <span style={NUM}>
          <s style={{ color: T.inkLight }}>{bankDateLabel(item.day)}</s> → <b>{bankDateLabel(item.new_date)}</b>
          {out ? " · sai desta conferência" : ""}
        </span>
        <button type="button" disabled={busy} onClick={onUndo} style={{ ...LINK, fontSize: 12, color: T.blue }}>Desfazer</button>
      </span>
    );
  }
  if (item.check === "keep") {
    return (
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <Badge color={T.green} bg={T.greenLight}>Você disse que está certa</Badge>
        <button type="button" disabled={busy} onClick={onUndo} style={{ ...LINK, fontSize: 12, color: T.blue }}>Desfazer</button>
      </span>
    );
  }
  return null;
}

const TYPE_LABEL = { income: "receita", expense: "despesa", refund: "estorno" };

function UnmatchedSummary({ item, selected, onSelect, busy }) {
  const struck = item.check === "delete";
  return (
    <>
      <input
        type="checkbox"
        aria-label={`Marcar ${item.description}`}
        checked={selected}
        disabled={busy}
        onChange={() => onSelect(item)}
        style={{ marginTop: 3 }}
      />
      <div style={{ flex: "1 1 220px", minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <b style={{ fontSize: 13, color: T.ink, textDecoration: struck ? "line-through" : "none", wordBreak: "break-word" }}>{item.description}</b>
          <Badge>{TYPE_LABEL[item.type] ?? item.type}</Badge>
          {item.recurring ? <Badge color={T.purple} bg={T.purpleLight}>recorrência</Badge> : null}
        </span>
        <span style={{ ...NUM, fontSize: 12, color: T.inkLight, textDecoration: struck ? "line-through" : "none" }}>
          {bankDateLabel(item.day)}{item.category_name ? ` · ${item.category_name}` : ""} · está no Fincla e não aparece no extrato
        </span>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <span style={{ ...NUM, fontSize: 13, fontWeight: 600, color: item.amount > 0 ? T.green : T.ink, textDecoration: struck ? "line-through" : "none" }}>
          {signed(item.amount, item.currency)}
        </span>
        <div style={{ ...NUM, fontSize: 11, color: T.inkLight }}>entra no saldo com {signed(item.weight, item.currency)}</div>
      </div>
    </>
  );
}

function HintNote({ item, entry, busy, onPairHint }) {
  if (!entry || item.check === "delete") return null;
  return (
    <div data-testid="pair-hint" style={AMBER}>
      <Link2 size={14} aria-hidden="true" style={{ color: T.amber, flexShrink: 0, marginTop: 2 }} />
      <span>
        Parece o lançamento do banco de <b style={NUM}>{bankDateLabel(entry.date)}</b> “{entry.bank_description}” (
        <span style={NUM}>{signed(entry.amount, entry.currency)}</span>), que está marcado para adicionar ao Fincla.{" "}
        <button type="button" disabled={busy} onClick={() => onPairHint(item, entry)} style={{ ...LINK, fontSize: 13, color: T.blue }}>
          É este lançamento do banco
        </button>
      </span>
    </div>
  );
}

function ChangeDateForm({ item, periodEnd, busy, onApply, onCancel }) {
  const [day, setDay] = useState(item.new_date ?? item.day);
  const today = todayLocalYmd();
  const valid = Boolean(day) && day <= today && day !== item.day;
  return (
    <div data-testid="change-date-form" style={{ ...G, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
      <label htmlFor={`new-date-${item.transaction_id}`} style={{ color: T.inkMid }}>Nova data</label>
      <input
        id={`new-date-${item.transaction_id}`}
        type="date"
        value={day}
        max={today}
        onChange={(e) => setDay(e.target.value)}
        style={{ ...G, fontSize: 13, padding: "4px 8px", border: `1px solid ${T.border}`, borderRadius: 8 }}
      />
      <Btn variant="dark" small disabled={!valid || busy} onClick={() => onApply(item, day)}>Mudar para esta data</Btn>
      <Btn variant="outGray" small onClick={onCancel}>Cancelar</Btn>
      {periodEnd ? <span style={{ color: T.inkLight }}>Datas depois de {bankDateLabel(periodEnd)} saem desta conferência.</span> : null}
    </div>
  );
}

function TransactionDetails({ item }) {
  return (
    <div data-testid="transaction-details" style={{ ...BLUE, flexDirection: "column", gap: 2, fontSize: 12 }}>
      <span><b>{item.description}</b> · {TYPE_LABEL[item.type] ?? item.type}</span>
      <span style={NUM}>Data {bankDateLabel(String(item.date).slice(0, 10))} · dinheiro mexeu em {bankDateLabel(item.day)}</span>
      <span>Categoria: {item.category_name ?? "Não classificado"}{item.tag_names.length ? ` · Etiquetas: ${item.tag_names.join(", ")}` : ""}</span>
      {item.recurring ? <span>Faz parte de uma recorrência: excluir apaga só esta ocorrência.</span> : null}
      <span style={{ color: T.inkLight }}>Para editar outros dados, abra a transação em Lançamentos depois de concluir.</span>
    </div>
  );
}

/** O cartão aberto: as ações da transação. */
function UnmatchedCard({ item, hintEntry, periodEnd, selected, busy, onSelect, onAnswer, onUndo, onPairHint, onMinimize }) {
  const [details, setDetails] = useState(false);
  const [dating, setDating] = useState(false);
  const deleted = item.check === "delete";
  const refusal = REFUSAL_TEXT[item.delete_refusal] ?? null;
  return (
    <div data-testid="unmatched-transaction" data-current="true" style={{ ...ROW, flexDirection: "column", alignItems: "stretch", borderColor: T.blue }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <UnmatchedSummary item={item} selected={selected} onSelect={onSelect} busy={busy} />
      </div>
      {deleted ? (
        <CheckState item={item} periodEnd={periodEnd} onUndo={() => onUndo(item)} busy={busy} />
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Btn variant="outGray" small onClick={() => setDetails((v) => !v)} aria-expanded={details}>Abrir</Btn>
            <Btn variant="outGray" small onClick={() => setDating((v) => !v)} aria-expanded={dating}>Mudar data</Btn>
            <Btn variant="outRed" small disabled={busy || Boolean(refusal)} onClick={() => onAnswer(item, "delete")}>Excluir</Btn>
            <Btn
              variant={item.check === "keep" ? "green" : "outGray"}
              small
              disabled={busy}
              aria-pressed={item.check === "keep"}
              onClick={() => (item.check === "keep" ? onMinimize(item) : onAnswer(item, "keep"))}
            >
              {item.check === "keep" ? <Check size={12} aria-hidden="true" style={{ marginRight: 4 }} /> : null}
              Está certa assim
            </Btn>
          </div>
          {refusal ? <span style={{ ...G, fontSize: 12, color: T.inkLight }}>{refusal}</span> : null}
          {item.check ? <CheckState item={item} periodEnd={periodEnd} onUndo={() => onUndo(item)} busy={busy} /> : null}
          {dating ? (
            <ChangeDateForm
              item={item}
              periodEnd={periodEnd}
              busy={busy}
              onApply={(it, day) => { setDating(false); onAnswer(it, "change_date", day); }}
              onCancel={() => setDating(false)}
            />
          ) : null}
          {details ? <TransactionDetails item={item} /> : null}
          <HintNote item={item} entry={hintEntry} busy={busy} onPairHint={onPairHint} />
        </>
      )}
    </div>
  );
}

/** A linha minimizada: o estado da resposta e "Alterar"; clique em qualquer ponto reabre. */
const UnmatchedRow = memo(function UnmatchedRowView({ item, periodEnd, selected, busy, onSelect, onOpen, onUndo }) {
  return (
    <div data-testid="unmatched-transaction" onClick={openOnRowClick(() => onOpen(item))} style={{ ...ROW, ...ROW_CLICKABLE, flexDirection: "column", alignItems: "stretch" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <button type="button" onClick={() => onOpen(item)} style={{ ...LINK, fontSize: 12, color: T.blue, marginTop: 2 }}>Alterar</button>
        <UnmatchedSummary item={item} selected={selected} onSelect={onSelect} busy={busy} />
      </div>
      <CheckState item={item} periodEnd={periodEnd} onUndo={() => onUndo(item)} busy={busy} />
    </div>
  );
});

/**
 * Uma transferência do Fincla sem par no extrato (G3-3-10): entra na diferença, mas a conciliação
 * nunca altera transferência — só "Abrir", sem Excluir nem Mudar data.
 */
function UnmatchedTransferRow({ transfer }) {
  const [open, setOpen] = useState(false);
  const route = [transfer.from_account_name, transfer.to_account_name].filter(Boolean).join(" → ");
  return (
    <div data-testid="unmatched-transfer" style={{ ...ROW, flexDirection: "column", alignItems: "stretch" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 220px", minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <b style={{ fontSize: 13, color: T.ink, wordBreak: "break-word" }}>{transfer.description || "Transferência"}</b>
            <Badge color={T.blue} bg={T.blueLight}>transferência</Badge>
          </span>
          <span style={{ ...NUM, fontSize: 12, color: T.inkLight }}>
            {bankDateLabel(transfer.day)}{route ? ` · ${route}` : ""} · está no Fincla e não aparece no extrato
          </span>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <span style={{ ...NUM, fontSize: 13, fontWeight: 600, color: transfer.amount > 0 ? T.green : T.ink }}>{signed(transfer.amount, transfer.currency)}</span>
          <div style={{ ...NUM, fontSize: 11, color: T.inkLight }}>entra no saldo com {signed(transfer.amount, transfer.currency)}</div>
        </div>
      </div>
      <div>
        <Btn variant="outGray" small onClick={() => setOpen((v) => !v)} aria-expanded={open}>Abrir</Btn>
      </div>
      {open ? (
        <div data-testid="transfer-details" style={{ ...BLUE, flexDirection: "column", gap: 2, fontSize: 12 }}>
          <span><b>{transfer.description || "Transferência"}</b> · transferência{route ? ` de ${route.replace(" → ", " para ")}` : ""}</span>
          <span style={NUM}>Data {bankDateLabel(transfer.day)}</span>
          <span style={{ color: T.inkLight }}>A conciliação não altera transferências. Se ela não aconteceu, ajuste em Lançamentos depois de concluir.</span>
        </div>
      ) : null}
    </div>
  );
}

/** Uma transação que a pessoa disse ser um lançamento do banco ("É este lançamento do banco"), com desfazer. */
function LinkedRow({ link, busy, onUndo }) {
  return (
    <div data-testid="linked-transaction" style={ROW}>
      <div style={{ flex: "1 1 220px", minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <b style={{ fontSize: 13, color: T.ink }}>{link.description}</b>
          <Badge color={T.blue} bg={T.blueLight}>Ligada ao lançamento do banco de {bankDateLabel(link.entryDate)}</Badge>
        </span>
        <span style={{ fontSize: 12, color: T.inkLight }}>
          Você disse que é o lançamento “{link.bankDescription}”. Não entra mais na diferença.{" "}
          <button type="button" disabled={busy} onClick={() => onUndo(link)} style={{ ...LINK, fontSize: 12, color: T.blue }}>Desfazer</button>
        </span>
      </div>
      <span style={{ ...NUM, fontSize: 13, color: T.inkMid }}>{signed(link.amount, link.currency)}</span>
    </div>
  );
}

function SelectionBar({ items, busy, onClear, onBatch }) {
  const sum = items.reduce((acc, i) => acc + i.amount, 0);
  const deletable = items.filter((i) => !i.delete_refusal);
  const currency = items[0]?.currency;
  return (
    <div data-testid="balance-selection" role="region" aria-label="Transações marcadas" style={{ ...G, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "8px 12px", borderRadius: 12, background: T.ink, color: "#fff" }}>
      <button type="button" onClick={onClear} aria-label="Desmarcar todas" style={{ ...LINK, color: "#fff", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
        <X size={12} aria-hidden="true" />Desmarcar
      </button>
      <b style={{ fontSize: 13 }}>{plural(items.length, "marcada", "marcadas")}</b>
      <span style={{ ...NUM, fontSize: 12 }}>soma {signed(sum, currency)}</span>
      <span style={{ flex: 1 }} />
      <Btn variant="green" small disabled={busy} onClick={() => onBatch(items, "keep")}>Está certa assim (todas)</Btn>
      <Btn variant="outRed" small disabled={busy || !deletable.length} onClick={() => onBatch(deletable, "delete")} style={{ background: "#fff" }}>
        {deletable.length === items.length ? "Excluir as marcadas" : `Excluir ${plural(deletable.length, "das marcadas", "das marcadas")}`}
      </Btn>
      {deletable.length < items.length ? (
        <span style={{ fontSize: 11 }}>{plural(items.length - deletable.length, "não pode ser excluída", "não podem ser excluídas")} (aporte de meta ou estorno).</span>
      ) : null}
    </div>
  );
}

function batchLabel(count, action) {
  if (action === "delete") return `${plural(count, "transação marcada", "transações marcadas")} para excluir ao concluir`;
  return `${plural(count, "transação marcada", "transações marcadas")} como certa${count === 1 ? "" : "s"}`;
}

function PendingNotes({ check, onGoToPending }) {
  return (
    <>
      {check.unanswered_entries ? (
        <div data-testid="pending-entries" role="note" style={AMBER}>
          <AlertTriangle size={15} aria-hidden="true" style={{ color: T.amber, flexShrink: 0, marginTop: 2 }} />
          <span>
            {plural(check.unanswered_entries, "lançamento do banco ainda está", "lançamentos do banco ainda estão")} sem decisão. Eles
            também entram na diferença até você decidir.{" "}
            <button type="button" onClick={onGoToPending} style={{ ...LINK, fontSize: 13, color: T.blue }}>Ir para eles</button>
          </span>
        </div>
      ) : null}
      {check.waiting_transactions ? (
        <div data-testid="waiting-transactions" role="note" style={AMBER}>
          <Info size={15} aria-hidden="true" style={{ color: T.amber, flexShrink: 0, marginTop: 2 }} />
          <span>
            <WaitingText check={check} />{" "}
            <button type="button" onClick={onGoToPending} style={{ ...LINK, fontSize: 13, color: T.blue }}>Responder agora</button>
          </span>
        </div>
      ) : null}
    </>
  );
}

/**
 * "1 transação e 1 transferência do Fincla ainda podem ser o par de algum dos 2 lançamentos sem
 * resposta": transferência é chamada pelo nome (OBS-06), com singular e plural em cada parte.
 */
function WaitingText({ check }) {
  const transfers = check.waiting_transfers ?? 0;
  const transactions = check.waiting_transactions - transfers;
  const parts = [
    transactions ? plural(transactions, "transação", "transações") : null,
    transfers ? plural(transfers, "transferência", "transferências") : null,
  ].filter(Boolean);
  const one = check.waiting_transactions === 1;
  const ofEntries = check.unanswered_entries === 1
    ? <>do <b>lançamento sem resposta</b></>
    : <>de algum dos <b>{plural(check.unanswered_entries, "lançamento sem resposta", "lançamentos sem resposta")}</b></>;
  return (
    <>
      <b>{parts.join(" e ")} do Fincla</b> ainda {one ? "pode" : "podem"} ser o par {ofEntries}.{" "}
      {one ? "Ela não aparece" : "Elas não aparecem"} nesta lista até você responder.
    </>
  );
}

/**
 * O estado de AGORA manda (BUG-02): com o lançamento à mão, "já paga" é a mesma decisão do cartão
 * (`isPaidNow`) e uma fatura que mudou depois da leitura mostra o mesmo aviso; sem ele, a resposta.
 */
function paidInvoiceState(i, entry) {
  if (!entry) return { alreadyPaid: i.already_paid, unavailable: null };
  const unavailable = invoiceUnavailable(entry) ? invoiceUnavailableText(entry) : null;
  return { alreadyPaid: isPaidNow(entry), unavailable };
}

function PaidInvoiceText({ invoice: i, alreadyPaid, unavailable }) {
  if (unavailable) return unavailable;
  const amount = i.difference !== 0
    ? <>O banco pagou <b style={NUM}>{formatMoney(Math.abs(i.difference), i.currency)}</b> a {i.difference > 0 ? "menos" : "mais"} que o total da fatura no Fincla. </>
    : null;
  if (alreadyPaid) {
    // Sem o dia do Fincla, a frase não sai: nunca uma data vazia.
    const otherDay = Boolean(i.fincla_paid_on) && i.fincla_paid_on !== i.paid_on;
    return (
      <>
        A fatura já estava paga no Fincla e nada muda nela. {amount}
        {otherDay ? <>As compras dela saíram do saldo do Fincla em <b style={NUM}>{bankDateLabel(i.fincla_paid_on)}</b> e do banco em <b style={NUM}>{bankDateLabel(i.paid_on)}</b>: nesses dias os saldos ficam diferentes. </> : null}
        {amount ? "Essa diferença de valor entra na diferença de saldo." : null}
      </>
    );
  }
  return (
    <>
      No Fincla a fatura é paga pelo total ({formatMoney(i.total, i.currency)}); o banco pagou {formatMoney(i.paid, i.currency)}. {amount}Essa diferença
      entra na diferença de saldo.
    </>
  );
}

function PaidInvoices({ invoices, entriesById }) {
  if (!invoices.length) return null;
  return (
    <>
      <h3 style={{ ...SECTION, color: T.purple }}>Faturas pagas neste extrato <Badge color={T.purple} bg={T.purpleLight}>{invoices.length}</Badge></h3>
      {invoices.map((i) => {
        const { alreadyPaid, unavailable } = paidInvoiceState(i, entriesById.get(i.entry_id));
        return (
          <div key={i.entry_id} data-testid="paid-invoice" style={ROW}>
            <div style={{ flex: "1 1 220px", minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <b style={{ fontSize: 13, color: T.ink }}>{invoiceLabel(i)} de {i.year}</b>
                {alreadyPaid ? <Badge color={T.green} bg={T.greenLight}>Já paga no Fincla</Badge> : null}
              </span>
              <span style={{ ...NUM, fontSize: 12, color: T.inkMid }}>
                Total no Fincla {formatMoney(i.total, i.currency)}
                {alreadyPaid && i.fincla_paid_on ? ` · paga no Fincla em ${bankDateLabel(i.fincla_paid_on)}` : ""} · pago pelo banco em {bankDateLabel(i.paid_on)}: {formatMoney(i.paid, i.currency)}
              </span>
              <span data-testid="paid-invoice-text" style={{ fontSize: 12, color: T.inkLight }}>
                <PaidInvoiceText invoice={i} alreadyPaid={alreadyPaid} unavailable={unavailable} />
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ ...NUM, fontSize: 13, fontWeight: 600 }}>{signed(i.difference, i.currency)}</span>
              <div style={{ fontSize: 11, color: T.inkLight }}>diferença de valor</div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function LeftOutEntries({ entries, onRedecide }) {
  if (!entries.length) return null;
  return (
    <>
      <h3 style={{ ...SECTION, color: T.inkMid }}>Lançamentos do extrato que você não registrou <Badge>{entries.length}</Badge></h3>
      {entries.map((e) => (
        <div key={e.entry_id} data-testid="not-recorded-entry" style={ROW}>
          <div style={{ flex: "1 1 220px", minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, color: T.ink, wordBreak: "break-word" }}>{e.bank_description}</span>
            <span style={{ ...NUM, fontSize: 12, color: T.inkLight }}>
              {bankDateLabel(e.date)} · {e.kind === "brought_back" ? "anterior ao início, mas você trouxe de volta" : "aconteceu no banco e não vai para o Fincla"}
            </span>
            <button type="button" onClick={() => onRedecide(e)} style={{ ...LINK, fontSize: 12, color: T.blue, alignSelf: "flex-start" }}>Voltar a decidir</button>
          </div>
          <span style={{ ...NUM, fontSize: 13, color: e.amount > 0 ? T.green : T.inkMid }}>{signed(e.amount, e.currency)}</span>
        </div>
      ))}
    </>
  );
}

/**
 * O passo inteiro. `items` = as transações sem par com o id da lista (`unmatchedItemId`); `queue`
 * = `useEntryQueue("balance", items, { answered: isCheckAnswered })`. `onAnswer(changes)` grava
 * no rascunho e devolve se deu certo; `onPairHint(item, entry)` pareia pelo atalho da dica.
 */
export function BalanceCheckStep({
  check,
  items,
  entries,
  periodEnd,
  linked,
  busy,
  queue,
  view,
  onViewChange,
  onAnswer,
  onPairHint,
  onUndoLink,
  onGoToPending,
  onRedecide,
}) {
  const [selected, setSelected] = useState(() => new Set());
  const [itemHistory, setItemHistory] = useState({});
  const [lastBatch, setLastBatch] = useState(null);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const live = items.filter((i) => i.check !== "delete" && i.weight !== 0);
  const transfers = check.unmatched_transfers ?? [];
  const chosen = items.filter((i) => selected.has(i.transaction_id));

  const remember = (list) => setItemHistory((prev) => {
    const next = { ...prev };
    list.forEach((i) => { next[i.transaction_id] = [...(prev[i.transaction_id] ?? []), { action: i.check, new_date: i.new_date }]; });
    return next;
  });

  const answer = async (item, action, newDate = null) => {
    remember([item]);
    setLastBatch(null);
    const ok = await onAnswer([{ transaction_id: item.transaction_id, action, new_date: action === "change_date" ? newDate : null }]);
    if (ok && action !== "change_date") queue.advanceFrom(item.id);
  };

  const undo = async (item) => {
    const previous = itemHistory[item.transaction_id]?.at(-1) ?? { action: null, new_date: null };
    // Desfazer devolve a resposta anterior; sem anterior, esquece a resposta.
    const back = previous.action === item.check ? { action: null, new_date: null } : previous;
    const ok = await onAnswer([{ transaction_id: item.transaction_id, ...back }]);
    if (ok) setItemHistory((prev) => ({ ...prev, [item.transaction_id]: (prev[item.transaction_id] ?? []).slice(0, -1) }));
  };

  const batch = async (list, action) => {
    const before = list.map((i) => ({ transaction_id: i.transaction_id, action: i.check, new_date: i.new_date }));
    const ok = await onAnswer(list.map((i) => ({ transaction_id: i.transaction_id, action, new_date: null })));
    if (ok) {
      setLastBatch({ label: batchLabel(list.length, action), before });
      setSelected(new Set());
      queue.close(null);
    }
  };

  const undoBatch = async () => {
    if (!lastBatch) return;
    if (await onAnswer(lastBatch.before)) setLastBatch(null);
  };

  const toggle = (item) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(item.transaction_id)) next.delete(item.transaction_id);
    else next.add(item.transaction_id);
    return next;
  });
  const allOn = items.length > 0 && chosen.length === items.length;

  return (
    <div data-testid="balance-step" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <BalanceDifferencePanel check={check} />
      <PendingNotes check={check} onGoToPending={onGoToPending} />

      <h3 style={{ ...SECTION, color: T.red }}>
        Transações do Fincla sem par no extrato <Badge color={T.red} bg={T.redLight}>{live.length + transfers.length}</Badge>
      </h3>
      {linked.map((link) => <LinkedRow key={link.transactionId} link={link} busy={busy} onUndo={onUndoLink} />)}
      {!items.length && !transfers.length ? (
        <p style={{ ...G, fontSize: 13, color: T.inkLight, margin: 0 }}>Nenhuma. Tudo o que está no Fincla nesta conta apareceu no extrato.</p>
      ) : null}
      {items.length ? (
        <>
          <EntryQueueHeader queue={queue} view={view} onViewChange={onViewChange} shortcutKeys={[]} noun={TRANSACTION_NOUN}>
            {items.length > 1 ? (
              <Btn variant="outGray" small onClick={() => setSelected(allOn ? new Set() : new Set(items.map((i) => i.transaction_id)))}>
                {allOn ? "Desmarcar todas" : `Marcar todas (${items.length.toLocaleString("pt-BR")})`}
              </Btn>
            ) : null}
          </EntryQueueHeader>
          {lastBatch ? (
            <div data-testid="balance-batch-undo" role="status" style={{ ...G, display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "8px 12px", borderRadius: 12, background: T.greenLight, border: `1px solid ${T.greenBorder}` }}>
              <Check size={14} aria-hidden="true" style={{ color: T.green }} />
              <span style={{ flex: 1 }}>{lastBatch.label}</span>
              <button type="button" disabled={busy} onClick={undoBatch} style={{ ...LINK, fontSize: 13, color: T.blue }}>Desfazer</button>
            </div>
          ) : null}
          {chosen.length ? <SelectionBar items={chosen} busy={busy} onClear={() => setSelected(new Set())} onBatch={batch} /> : null}
          {items.filter(queue.shown).map((item) => (item.id === queue.currentId ? (
            <CurrentEntryFrame key={item.id} queue={queue} entry={item} noun={TRANSACTION_NOUN}>
              <UnmatchedCard
                item={item}
                hintEntry={item.hint_entry_id ? byId.get(item.hint_entry_id) : null}
                periodEnd={periodEnd}
                selected={selected.has(item.transaction_id)}
                busy={busy}
                onSelect={toggle}
                onAnswer={answer}
                onUndo={undo}
                onPairHint={onPairHint}
                onMinimize={(i) => queue.close(i.id)}
              />
            </CurrentEntryFrame>
          ) : (
            <UnmatchedRow
              key={item.id}
              item={item}
              periodEnd={periodEnd}
              selected={selected.has(item.transaction_id)}
              busy={busy}
              onSelect={toggle}
              onOpen={(i) => queue.open(i.id)}
              onUndo={undo}
            />
          )))}
        </>
      ) : null}
      {transfers.map((t) => <UnmatchedTransferRow key={t.transfer_id} transfer={t} />)}

      <PaidInvoices invoices={check.paid_invoices} entriesById={byId} />
      <LeftOutEntries entries={check.left_out_entries} onRedecide={onRedecide} />
      <ConcludeWithDifferenceNote check={check} />
    </div>
  );
}

// --------------------------------------------------------------------------------------------
// Revisar e concluir: o que mais acontece ao concluir
// --------------------------------------------------------------------------------------------

const EFFECT_TONE = {
  amber: { color: T.amber, bg: T.amberLight },
  purple: { color: T.purple, bg: T.purpleLight },
  blue: { color: T.blue, bg: T.blueLight },
  red: { color: T.red, bg: T.redLight },
};

/**
 * Os selos do resumo: VALOR MUDA, CONTA MUDA, FATURA PAGA (e FATURA JÁ PAGA, que não muda nada),
 * EXCLUSÃO, DATA MUDA. Valores, contas e faturas vêm dos lançamentos (o que o rascunho diz agora);
 * exclusões e datas, da conferência.
 */
export function summaryEffects(entries, check) {
  const pairs = entries.filter((e) => e.answer === "pair" && e.fincla_match);
  const newValue = pairs.filter((e) => e.fincla_match.differences.includes("amount")).length;
  const moved = pairs.filter((e) => e.fincla_match.differences.includes("account")).length;
  const invoices = entries.filter((e) => e.answer === "invoice_payment");
  const deletions = check?.effects.deletions ?? 0;
  const dates = check?.effects.date_changes ?? 0;
  return [
    newValue ? { tone: "amber", tag: "Valor muda", text: <><b>{plural(newValue, "transação passa", "transações passam")} a ter o valor do banco</b> (valor diferente no Fincla).</> } : null,
    moved ? { tone: "purple", tag: "Conta muda", text: <><b>{plural(moved, "transação é movida", "transações são movidas")} para esta conta</b> (estavam em outra conta).</> } : null,
    // A fatura que mudou depois da leitura (BUG-02) não promete nada: o mesmo aviso do cartão.
    ...invoices.filter((e) => !invoiceUnavailable(e)).map((e) => ({
      key: `invoice-${e.id}`,
      testId: "summary-invoices-paid",
      tone: "blue",
      tag: "Fatura paga",
      text: <>A <b>{invoiceLabel(e.invoice)}</b> fica paga em <b style={NUM}>{bankDateLabel(e.date)}</b> (data do banco). Nenhuma transação é criada.</>,
    })),
    ...entries.filter(isPaidNow).map((e) => ({
      key: `invoice-already-paid-${e.id}`,
      testId: "summary-invoices-already-paid",
      tone: "blue",
      tag: "Fatura já paga",
      text: <>A <b>{invoiceLabel(e.invoice)}</b> já está paga no Fincla: nada muda nela e nenhuma transação é criada.</>,
    })),
    ...entries.filter((e) => (e.answer === "invoice_payment" || e.answer === "invoice_already_paid") && invoiceUnavailable(e)).map((e) => ({
      key: `invoice-unavailable-${e.id}`,
      testId: "summary-invoice-unavailable",
      tone: "amber",
      tag: "Fatura mudou",
      text: invoiceUnavailableText(e),
    })),
    deletions ? { tone: "red", tag: "Exclusão", text: <><b>{plural(deletions, "transação do Fincla é excluída", "transações do Fincla são excluídas")}</b>.</> } : null,
    dates ? { tone: "blue", tag: "Data muda", text: <><b>{plural(dates, "transação muda de data", "transações mudam de data")}</b>.</> } : null,
  ].filter(Boolean);
}

export function SummaryEffects({ entries, check }) {
  const effects = summaryEffects(entries, check);
  if (!effects.length) return null;
  return (
    <div data-testid="summary-pair-changes" style={{ ...G, fontSize: 12, color: T.ink, margin: "12px 0 0", display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", color: T.inkLight }}>Também vai acontecer ao concluir</span>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {effects.map((e) => (
          <li key={e.key ?? e.tag} data-testid={e.testId ?? "summary-effect"} style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
            <span style={{ ...G, fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 6, color: EFFECT_TONE[e.tone].color, background: EFFECT_TONE[e.tone].bg }}>
              {e.tag}
            </span>
            <span>{e.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** O destaque do topo de "Revisar e concluir": a diferença de saldo que fica (registrada ao concluir). */
export function SummaryDifference({ check, loading, error }) {
  if (error) return <p role="alert" style={{ ...G, fontSize: 13, color: T.red, margin: 0 }}>{error}</p>;
  if (!check) {
    return loading ? <p style={{ ...G, fontSize: 13, color: T.inkLight, margin: 0 }}>Calculando a diferença de saldo…</p> : null;
  }
  const last = check.points[check.points.length - 1];
  const off = check.final_difference !== null && check.final_difference !== 0;
  let sub;
  if (!last) sub = "O arquivo não informa saldo: nenhuma diferença fica registrada.";
  else if (off) sub = <>Banco <b style={NUM}>{formatMoney(last.bank, last.currency)}</b> · Fincla <b style={NUM}>{formatMoney(last.fincla, last.currency)}</b> em {bankDateLabel(last.date)}. Ela fica <b>registrada</b> nesta conciliação.</>;
  else sub = <>Banco e Fincla <b>batem</b> em {bankDateLabel(last.date)}.</>;
  return (
    <Card style={{ padding: 16, borderColor: off ? T.red : T.greenBorder, background: off ? T.redLight : T.greenLight }}>
      <div data-testid="summary-difference" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <div style={{ ...G, fontSize: 11, fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", color: T.inkMid }}>
            {last ? `Diferença de saldo que fica no fim de ${monthOf(last.date)}` : "Diferença de saldo"}
          </div>
          <div style={{ ...G, fontSize: 12.5, color: T.inkMid, marginTop: 4 }}>{sub}</div>
        </div>
        <span style={{ ...G, ...NUM, fontSize: 26, fontWeight: 800, color: off ? T.red : T.green }}>
          {check.final_difference === null ? "—" : signed(check.final_difference, check.currency)}
        </span>
      </div>
    </Card>
  );
}
