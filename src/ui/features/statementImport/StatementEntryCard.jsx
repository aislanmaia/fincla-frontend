import { memo, useCallback, useEffect, useId, useRef, useState } from "react";
import { Ban, Check, ChevronRight, Layers, Lock, Plus } from "lucide-react";

import { T, TOUCH_TARGET } from "../../tokens";
import { G, NUM } from "../../typography";
import { Badge, Btn, Select, useTouchTarget } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { DetailTagPicker } from "./DetailTagPicker.jsx";
import { ConferidoBadge, InlineFields, ROW_CLICKABLE, isAnswered, openOnRowClick, useCompact } from "./entryQueue.jsx";

/** "2026-10-02" → "02/10/2026", sem passar por `Date` (que leria em UTC e voltaria um dia). */
export function bankDateLabel(ymd) {
  const [y, m, d] = String(ymd ?? "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
}

/** "2026-10-07" → "07/10" (dia e mês), lendo AAAA-MM-DD sem converter fuso. */
export function dayMonthLabel(ymd) {
  const [, m, d] = String(ymd ?? "").split("-");
  return m && d ? `${d}/${m}` : "";
}

/** Os meses por extenso, uma lista só para todos os passos da conciliação. */
export const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export const BOX = { border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, minWidth: 0, flex: 1 };
export const BOX_LABEL = { ...G, fontSize: 11, fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", color: T.inkLight, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 };
export const FIELD_LABEL = { ...G, fontSize: 11, fontWeight: 600, color: T.inkMid, display: "block", marginBottom: 4 };
export const HELP = { ...G, fontSize: 11, color: T.inkLight, marginTop: 4, display: "block" };
export const INPUT = { ...G, width: "100%", boxSizing: "border-box", fontSize: 13, color: T.ink, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px" };
const LOCKED = { ...G, ...NUM, display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.inkMid, background: T.grayLight, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px" };

export const TYPE_LABEL = { income: "Receita", refund: "Estorno", expense: "Despesa" };

/** Só o que passa por conta corrente (o backend recusa o resto); compra no crédito sai na fatura. */
export const STATEMENT_PAYMENT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "boleto", label: "Boleto" },
  { value: "debit_card", label: "Cartão de débito" },
  { value: "bank_transfer", label: "Transferência" },
  { value: "cash", label: "Dinheiro" },
];

/** Categorias que aceitam o tipo. Estorno devolve um gasto: aceita as de despesa também (regra do backend). */
export function categoriesForType(categories, type) {
  return categories.filter((c) => {
    const allowed = c.allowed_transaction_types ?? [];
    return allowed.includes(type) || (type === "refund" && allowed.includes("expense"));
  });
}

export function LockedValue({ children, testId, title }) {
  return (
    <span style={LOCKED} data-testid={testId} title={title}>
      <Lock size={12} aria-hidden="true" />
      {children}
    </span>
  );
}

/** Fundo listrado de "Não registrar" (o mesmo do protótipo): não se confunde com nada adicionado. */
export const SKIP_BG = `repeating-linear-gradient(135deg, ${T.surfaceHov} 0 7px, ${T.border} 7px 8px)`;
/** "Excluir" (Sobrando no Fincla): o mesmo listrado, em vermelho claro (o `.crow.del` do protótipo). */
export const DELETE_BG = `repeating-linear-gradient(135deg, ${T.redLight} 0 7px, color-mix(in srgb, ${T.red} 16%, ${T.surface}) 7px 8px)`;
/** O cartão reaberto de uma transação a excluir (o `.ccard.del` do protótipo): listras mais largas. */
export const DELETE_CARD_BG = `repeating-linear-gradient(135deg, ${T.redLight} 0 9px, color-mix(in srgb, ${T.red} 12%, ${T.surface}) 9px 18px)`;

/** Selo "Não registrar": escuro, com o ícone de proibido. */
export function SkipBadge() {
  return (
    <span style={{ ...G, fontSize: 11, fontWeight: 600, color: T.surface, background: T.inkMid, padding: "2px 7px", borderRadius: 9999, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
      <Ban size={11} aria-hidden="true" />Não registrar
    </span>
  );
}

/**
 * A nota "Fica de fora" no lado do Fincla de um "Não registrar": o lado continua à vista (o item
 * sugerido, as opções ou o formulário, sem poder editar) e diz o que acontece com ele.
 */
export function SkipNote({ children }) {
  return (
    <div data-testid="skip-note" style={{ ...G, fontSize: 12, color: T.inkMid, marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${T.inkFaint}`, display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", lineHeight: 1.5 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: T.inkMid, background: T.surface, border: `1px solid ${T.inkFaint}`, borderRadius: 6, padding: "1px 6px", whiteSpace: "nowrap" }}>Fica de fora</span>
      <span style={{ flex: "1 1 180px", minWidth: 0 }}>{children}</span>
    </div>
  );
}

/**
 * O "Confirmar" que fica ao lado dos botões de resposta (decisão do Owner, fincla-api#507). Só
 * aparece em dois casos: a sugestão do Fincla sem nenhuma mudança ("Confirmar sugestão") e o
 * formulário de adicionar item novo ("Confirmar", desligado enquanto a descrição está vazia). Toda
 * outra resposta já confirma e minimiza no clique. `onMouseDown` não tira o foco do campo antes do
 * clique: o próprio Confirmar grava a descrição.
 *
 * Um clique só vale uma vez: enquanto o `onConfirm` (que pode devolver uma promessa) não termina, o
 * botão fica desligado e novos cliques (duplo clique, Enter repetido) são ignorados, para não sair
 * um segundo PATCH. A nota de bloqueio fica ligada ao botão por `aria-describedby`.
 */
/** `touch` (celular): a altura de um alvo de toque; no computador fica como era. */
export function ConfirmAnswerButton({ label = "Confirmar", disabled = false, blockedNote = "", onConfirm, touch = false }) {
  const noteId = useId();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const showNote = disabled && Boolean(blockedNote);
  const run = async () => {
    if (inFlight.current || disabled) return;
    inFlight.current = true;
    setPending(true);
    try {
      await onConfirm();
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <Btn
        variant="dark"
        small
        disabled={disabled || pending}
        aria-describedby={showNote ? noteId : undefined}
        onMouseDown={(e) => e.preventDefault()}
        onClick={run}
        style={touch ? { minHeight: TOUCH_TARGET } : undefined}
      >
        <Check size={13} aria-hidden="true" />{label}
      </Btn>
      {showNote ? <span id={noteId} style={{ ...G, fontSize: 12, color: T.inkLight }}>{blockedNote}</span> : null}
    </span>
  );
}

/**
 * A descrição sendo digitada no formulário do item novo, com as duas formas de gravá-la: ao sair do
 * campo (`save`) e pelo Confirmar ao lado das respostas (`confirm`, grava e só então minimiza).
 *
 * As duas passam pela mesma trava, marcada antes do primeiro `await`: um duplo clique no Confirmar
 * (o 2º clique cai no botão já desligado e tira o foco do campo, o que dispara o `save` do blur)
 * sai como UM pedido só. O mesmo texto já a caminho não sai de novo; um Confirmar em andamento
 * ignora os seguintes. `onChange` devolve `false` quando não gravou: o cartão fica aberto com o
 * erro da página.
 */
export function useDescriptionDraft(entry, onChange) {
  const [value, setValue] = useState(entry.description ?? "");
  const flight = useRef({ text: null, promise: null, saved: null, confirming: false });
  useEffect(() => {
    setValue(entry.description ?? "");
    flight.current.saved = null;
  }, [entry.description]);
  const latest = useRef({ entry, onChange, value });
  latest.current = { entry, onChange, value };

  const save = useCallback(() => {
    const { entry: current, onChange: change, value: text } = latest.current;
    const f = flight.current;
    if (f.promise && f.text === text) return f.promise;
    if (text === (current.description ?? "") || text === f.saved) return Promise.resolve(true);
    const promise = Promise.resolve(change(current.id, { description: text }))
      .then((ok) => {
        if (ok !== false) f.saved = text;
        return ok;
      })
      .finally(() => {
        if (f.promise === promise) {
          f.promise = null;
          f.text = null;
        }
      });
    f.text = text;
    f.promise = promise;
    return promise;
  }, []);

  const confirm = useCallback(async (onConfirm) => {
    const f = flight.current;
    const { entry: current, value: text } = latest.current;
    if (f.confirming || !text.trim()) return;
    f.confirming = true;
    try {
      if ((await save()) === false) return;
      onConfirm(current);
    } finally {
      f.confirming = false;
    }
  }, [save]);

  return { value, set: setValue, save, confirm };
}

export const CONFIRM_BLOCKED_NOTE = "Escreva a descrição para confirmar.";

export function SummedBadge({ children = "Somada" }) {
  return (
    <Badge color={T.purple} bg={T.purpleLight}>
      <Layers size={11} aria-hidden="true" style={{ verticalAlign: "-1px", marginRight: 4 }} />{children}
    </Badge>
  );
}

/** "Sugerida pelo seu histórico" / "Escolhida por você" / "Sem categoria: vai para Não classificado". */
export function CategoryHelp({ categoryId, suggestedId }) {
  if (categoryId && categoryId === suggestedId) return <span style={{ ...HELP, color: T.blue, fontWeight: 600 }}>Sugerida pelo seu histórico</span>;
  if (categoryId) return <span style={HELP}>Escolhida por você</span>;
  return <span style={{ ...HELP, color: T.amber }}>Sem categoria: vai para Não classificado</span>;
}

export function categoryLabel(categories, id, fallbackLabel) {
  const found = categories.find((c) => c.id === id);
  return found ? found.label || found.name : fallbackLabel;
}

export function detailLabels(details, ids) {
  return (ids ?? []).map((id) => details.find((d) => d.id === id)).filter(Boolean).map((d) => d.label || d.name);
}

/** O que vai acontecer ao concluir, numa linha. */
export function OutcomeLine({ children }) {
  return (
    <div style={{ ...G, fontSize: 12, color: T.inkMid, background: T.surfaceHov, borderTop: `1px solid ${T.border}`, padding: "8px 14px", margin: "0 -14px -14px", borderRadius: "0 0 14px 14px", display: "flex", gap: 6 }}>
      <span aria-hidden="true">→</span>
      <span data-testid="entry-outcome">{children}</span>
    </div>
  );
}

const SEG_BTN = (pressed, tone) => ({
  ...G, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "6px 12px", border: "none",
  background: pressed ? (tone === "ignore" ? T.inkMid : T.green) : "transparent",
  color: pressed ? "#fff" : T.inkMid, display: "inline-flex", alignItems: "center", gap: 5,
});

/**
 * "Este lançamento do banco já está no Fincla?" — nos lançamentos novos: adicionar agora ou não
 * registrar; `onSearch` (fincla-api#511) acrescenta "Está no Fincla com outros dados…".
 * `onConfirm` (cartão de uma lista) liga o Confirmar ao lado das respostas no formulário do item
 * novo, e clicar de novo em "Não registrar" já marcado minimiza o cartão.
 */
function AnswerSegment({ entry, desc, busy = false, onChange, onSearch = null, onConfirm = null }) {
  const label = "Este lançamento do banco já está no Fincla?";
  const blank = !desc.value.trim();
  const touchTarget = useTouchTarget();
  const choose = (answer) => {
    if (busy) return;
    if (entry.answer !== answer) onChange(entry.id, { answer });
    else if (answer === "ignore" && onConfirm) onConfirm(entry);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={{ ...G, fontSize: 12, fontWeight: 600, color: T.ink }}>{label}</span>
      <div role="group" data-answer-row="" aria-label={label} style={{ display: "inline-flex", border: `1px solid ${T.border}`, borderRadius: 9, overflow: "hidden" }}>
        <button type="button" aria-pressed={entry.answer === "create"} disabled={busy} onClick={() => choose("create")} style={{ ...SEG_BTN(entry.answer === "create", "create"), ...touchTarget }}>
          <Plus size={12} aria-hidden="true" />Não, adicionar agora
        </button>
        <button type="button" aria-pressed={entry.answer === "ignore"} disabled={busy} onClick={() => choose("ignore")} style={{ ...SEG_BTN(entry.answer === "ignore", "ignore"), borderLeft: `1px solid ${T.border}`, ...touchTarget }}>
          <Ban size={12} aria-hidden="true" />Não registrar
        </button>
      </div>
      {onConfirm && entry.answer === "create" ? (
        <ConfirmAnswerButton
          disabled={busy || blank}
          blockedNote={blank ? CONFIRM_BLOCKED_NOTE : ""}
          onConfirm={() => desc.confirm(onConfirm)}
        />
      ) : null}
      {onSearch ? (
        <Btn variant="outGray" small disabled={busy} onClick={() => onSearch(entry)} style={{ alignSelf: "flex-start" }}>
          Está no Fincla com outros dados…
        </Btn>
      ) : null}
    </div>
  );
}

function SelectBox({ entry, selected, onSelect }) {
  if (!onSelect) return null;
  return (
    <CheckTarget>
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onSelect(entry.id, e.target.checked)}
        aria-label={`Marcar lançamento de ${bankDateLabel(entry.date)}`}
        style={{ width: 16, height: 16, margin: 0, cursor: "pointer" }}
      />
    </CheckTarget>
  );
}

/**
 * A área de toque de uma caixa de marcar: no celular (`<TouchTargets on>`), um rótulo de 44 px em
 * volta da caixa, que continua do mesmo tamanho; no computador, só a caixa.
 */
export function CheckTarget({ children, style = null }) {
  const touchTarget = useTouchTarget();
  if (!touchTarget) return children;
  return (
    <label style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: TOUCH_TARGET, cursor: "pointer", ...touchTarget, ...style }}>
      {children}
    </label>
  );
}

/**
 * Um lançamento "Não registrar" minimizado (fincla-api#513): continua visível, com selo e fundo
 * próprios, "Alterar" no começo da linha, "Conferido" e "Desfazer escolha" (volta à resposta de
 * antes; sem uma anterior, a "Não, adicionar agora"). Clicar em qualquer ponto livre da linha a
 * reabre (fincla-api#517); a caixa de marcar e os botões fazem só a ação deles. Teclado e leitor
 * de tela chegam a tudo pelos controles. `focus` leva o foco ao "Alterar" quando a linha acaba de
 * aparecer no lugar do cartão.
 */
export const IgnoredEntryRow = memo(function IgnoredEntryRowView({ entry, selected = false, onSelect = null, onExpand, onUndo, busy = false, focus = false, conferred = true, amount = null }) {
  const alterRef = useRef(null);
  const touchTarget = useTouchTarget();
  useEffect(() => { if (focus) alterRef.current?.focus({ preventScroll: true }); }, [focus]);
  return (
    <div
      data-testid="ignored-entry"
      role="group"
      aria-label={`Lançamento ${entry.bank_description} não registrado`}
      onClick={openOnRowClick(() => onExpand(entry.id))}
      style={{ ...ROW_CLICKABLE, ...G, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", borderRadius: 12, border: `1px solid ${T.border}`, background: SKIP_BG }}
    >
      <SelectBox entry={entry} selected={selected} onSelect={onSelect} />
      <button ref={alterRef} type="button" onClick={() => onExpand(entry.id)} style={{ ...G, fontSize: 12, fontWeight: 600, color: T.blue, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "3px 8px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 2, ...touchTarget }}>
        <ChevronRight size={12} aria-hidden="true" />Alterar
      </button>
      <span style={{ ...NUM, fontSize: 12, color: T.inkLight, opacity: 0.8 }}>{bankDateLabel(entry.date)}</span>
      <span style={{ fontSize: 13, color: T.ink, opacity: 0.7, flex: "1 1 160px", minWidth: 0, wordBreak: "break-word" }}>{entry.bank_description}</span>
      <span style={{ ...NUM, fontSize: 13, color: T.inkMid, opacity: 0.7 }}>{amount ?? formatMoney(entry.amount, entry.currency)}</span>
      <SkipBadge />
      <span style={{ fontSize: 12, color: T.inkLight }}>fica fora do Fincla</span>
      {conferred ? <ConferidoBadge /> : null}
      <Btn variant="ghost" small disabled={busy} onClick={() => onUndo(entry.id)}>
        Desfazer escolha
      </Btn>
    </div>
  );
});

/**
 * Um lançamento que vai ser adicionado, minimizado numa linha (fincla-api#517): o que vai virar no
 * Fincla (descrição e categoria) cabe nela. Clicar em qualquer ponto livre a reabre. Respondido
 * nesta visita ("Confirmar" no cartão), mostra "Desfazer escolha" (`onUndo`), como nos outros passos.
 */
export const NewEntryRow = memo(function NewEntryRowView({ entry, categoryText, unclassified, selected = false, onSelect = null, onExpand, onUndo = null, busy = false, focus = false, conferred = undefined, detail = null, amount = null }) {
  const alterRef = useRef(null);
  const touchTarget = useTouchTarget();
  useEffect(() => { if (focus) alterRef.current?.focus({ preventScroll: true }); }, [focus]);
  return (
    <div
      data-testid="entry-row"
      onClick={openOnRowClick(() => onExpand(entry.id))}
      style={{ ...ROW_CLICKABLE, ...G, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface }}
    >
      <SelectBox entry={entry} selected={selected} onSelect={onSelect} />
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
      <span style={{ ...NUM, fontSize: 13, color: entry.amount > 0 ? T.green : T.ink }}>{amount ?? formatMoney(entry.amount, entry.currency)}</span>
      <Badge color={T.green} bg={T.greenLight}><Plus size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: "-1px" }} />Adicionar agora</Badge>
      <span style={{ fontSize: 12, color: T.inkMid, flex: "1 1 160px", minWidth: 0 }}>
        Adicionar ao Fincla: <b>{entry.description || "(sem descrição)"}</b> ·{" "}
        {unclassified ? <Badge color={T.amber} bg={T.amberLight}>{categoryText}</Badge> : categoryText}
        {detail ? <> · {detail}</> : null}
      </span>
      {(conferred ?? isAnswered(entry)) ? <ConferidoBadge /> : null}
      {onUndo ? (
        <Btn variant="ghost" small disabled={busy} onClick={() => onUndo(entry.id)}>
          Desfazer escolha
        </Btn>
      ) : null}
    </div>
  );
});

/**
 * O lado "No Fincla · nova transação": a transação que o lançamento vai virar ao concluir. Data e
 * valor vêm do banco e ficam travados; descrição, tipo, forma de pagamento (sugerida pelo texto do
 * banco), categoria (sugerida pelo histórico) e etiquetas da categoria são da pessoa. A descrição é
 * gravada ao sair do campo (ou pelo Confirmar). `desc` (`useDescriptionDraft`) vem do cartão, que
 * mostra o Confirmar ao lado das respostas; sem ele, o editor guarda o texto sozinho.
 *
 * `skipped` ("Não registrar"): o formulário continua à vista, sem poder editar, com o fundo
 * listrado do lado do banco e a nota "Fica de fora".
 *
 * `invoice` (Conciliar fatura, fincla-api#557): o mesmo formulário para a compra nova no cartão.
 * `{ paymentLabel, extraFields, skipText }`: a forma de pagamento fica travada no texto dado
 * ("Cartão de crédito · <cartão>"), o tipo fica travado no `transaction_type` do lançamento
 * (despesa ou estorno), "vem da fatura" no lugar de "vem do extrato", `extraFields` entra no fim do
 * formulário (as opções da compra parcelada) e `skipText` é a nota do "Não registrar".
 */
function NewTransactionEditor({ entry, categories, details, fallbackLabel, isMobile, onChange, desc: givenDesc, skipped = false, invoice = null }) {
  const ownDesc = useDescriptionDraft(entry, onChange);
  const desc = givenDesc ?? ownDesc;
  const description = desc.value;

  const moneyIn = entry.amount > 0;
  const type = entry.transaction_type ?? (moneyIn ? "income" : "expense");
  const options = categoriesForType(categories, type).filter((c) => !c.is_fallback);
  const blank = !skipped && !description.trim();
  const source = invoice ? "fatura" : "extrato";
  const fieldId = (name) => `entry-${entry.id}-${name}`;
  const chosenCategory = categoryLabel(categories, entry.category_tag_id, fallbackLabel);
  const touchTarget = useTouchTarget();

  return (
    <section
      data-testid={skipped ? "new-side-skipped" : undefined}
      style={{ ...BOX, ...(skipped ? { background: SKIP_BG, borderColor: T.inkFaint } : { borderColor: T.greenBorder }) }}
    >
      <div style={BOX_LABEL}>
        No Fincla · nova transação {skipped ? <SkipBadge /> : <Badge color={T.green} bg={T.greenLight}>Entra ao concluir</Badge>}
      </div>
      <fieldset
        disabled={skipped}
        aria-label={skipped ? "Formulário da nova transação, sem uso: não registrar" : undefined}
        style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, ...(skipped ? { opacity: 0.6 } : null) }}
      >
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor={fieldId("description")} style={FIELD_LABEL}>Descrição</label>
          <input
            id={fieldId("description")}
            value={description}
            maxLength={255}
            onChange={(e) => desc.set(e.target.value)}
            onBlur={() => desc.save()}
            aria-invalid={blank}
            style={{ ...INPUT, borderColor: blank ? T.red : T.border, ...touchTarget }}
          />
          {blank
            ? <span style={{ ...HELP, color: T.red }}>Escreva uma descrição.</span>
            : <span style={HELP}>Começa com o texto do banco. Pode trocar por um nome seu.</span>}
        </div>

        <div>
          <span style={FIELD_LABEL}>Data</span>
          <LockedValue testId="locked-date" title={`Vem do ${source} e não pode ser alterada`}>{bankDateLabel(entry.date)}</LockedValue>
          <span style={HELP}>Vem do banco</span>
        </div>
        <div>
          <span style={FIELD_LABEL}>Valor</span>
          <LockedValue testId="locked-amount" title={`Vem do ${source} e não pode ser alterado`}>{formatMoney(entry.amount, entry.currency)}</LockedValue>
          <span style={HELP}>Vem do banco</span>
        </div>

        <div>
          {invoice ? (
            <>
              <span style={FIELD_LABEL}>Tipo</span>
              <LockedValue testId="locked-type" title="Cobrança vira despesa; crédito vira estorno">{TYPE_LABEL[type] ?? type}</LockedValue>
              <span style={HELP}>{type === "refund" ? "Crédito na fatura: diminui o total" : "Cobrança na fatura"}</span>
            </>
          ) : moneyIn ? (
            <>
              <label htmlFor={fieldId("type")} style={FIELD_LABEL}>Tipo</label>
              <Select id={fieldId("type")} value={type} onChange={(e) => onChange(entry.id, { transaction_type: e.target.value })} style={{ width: "100%" }}>
                <option value="income">{TYPE_LABEL.income}</option>
                <option value="refund">{TYPE_LABEL.refund}</option>
              </Select>
              <span style={HELP}>Entrada: receita ou estorno</span>
            </>
          ) : (
            <>
              <span style={FIELD_LABEL}>Tipo</span>
              <LockedValue testId="locked-type" title="Saída do banco sempre vira despesa">{TYPE_LABEL.expense}</LockedValue>
              <span style={HELP}>Saída do banco</span>
            </>
          )}
        </div>
        {invoice ? (
          <div>
            <span style={FIELD_LABEL}>Forma de pagamento</span>
            <LockedValue testId="locked-payment" title="A compra está na fatura deste cartão">{invoice.paymentLabel}</LockedValue>
            <span style={HELP}>A compra é deste cartão</span>
          </div>
        ) : (
        <div>
          <label htmlFor={fieldId("payment")} style={FIELD_LABEL}>Forma de pagamento</label>
          <Select
            id={fieldId("payment")}
            value={entry.payment_method ?? "bank_transfer"}
            onChange={(e) => onChange(entry.id, { payment_method: e.target.value })}
            style={{ width: "100%" }}
          >
            {STATEMENT_PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
          <span style={HELP}>Sugerida pelo texto do banco</span>
        </div>
        )}
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor={fieldId("category")} style={FIELD_LABEL}>Categoria</label>
          <Select
            id={fieldId("category")}
            value={entry.category_tag_id ?? ""}
            onChange={(e) => onChange(entry.id, { category_tag_id: e.target.value || null })}
            style={{ width: "100%" }}
          >
            <option value="">{fallbackLabel}</option>
            {options.map((c) => <option key={c.id} value={c.id}>{c.label || c.name}</option>)}
          </Select>
          <CategoryHelp categoryId={entry.category_tag_id} suggestedId={entry.suggested_category_tag_id} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <span style={FIELD_LABEL}>Etiquetas</span>
          <DetailTagPicker
            categoryId={entry.category_tag_id}
            categoryLabel={chosenCategory}
            details={details}
            selected={entry.detail_tag_ids}
            onChange={(next) => onChange(entry.id, { detail_tag_ids: next })}
          />
        </div>
        {invoice?.extraFields ? <div style={{ gridColumn: "1 / -1", minWidth: 0 }}>{invoice.extraFields}</div> : null}
      </fieldset>
      {skipped ? (
        <SkipNote>
          {invoice?.skipText ?? "Este lançamento não entra no Fincla: nada é adicionado. O saldo do Fincla fica sem este valor, e a diferença aparece na conferência de saldo."}
        </SkipNote>
      ) : null}
    </section>
  );
}

/**
 * Um lançamento novo: à esquerda o que o banco registrou, à direita a transação que ele vai
 * virar ao concluir (`NewTransactionEditor`). "Não registrar" mantém o lado direito à vista, sem
 * poder editar, com o fundo listrado e a nota "Fica de fora".
 *
 * `onConfirm` (cartão aberto de uma lista): o Confirmar ao lado das respostas grava a descrição e
 * minimiza o cartão; clicar de novo em "Não registrar" já marcado também minimiza.
 *
 * `embedded`: só o lado "No Fincla · nova transação", sem moldura, para o cartão de um par sugerido
 * respondido "Não, adicionar agora" (fincla-api#510), que já mostra o lado do banco. Quem embute
 * passa `desc` (`useDescriptionDraft`) para o Confirmar dele ler e gravar a descrição digitada pela
 * mesma trava do campo; `skipped` o mostra inerte. `invoice` (fincla-api#557): o formulário da
 * compra nova no cartão (ver `NewTransactionEditor`); a fatura embute o editor no cartão dela.
 */
export function StatementEntryCard({
  entry, categories, details = [], fallbackLabel, isMobile, onChange,
  selected = false, onSelect = null, onCollapse = null, embedded = false, onSearch = null,
  onConfirm = null, desc: embeddedDesc, skipped = false, busy = false, invoice = null,
}) {
  const moneyIn = entry.amount > 0;
  const ignored = entry.answer === "ignore";
  const compact = useCompact();
  const ownDesc = useDescriptionDraft(entry, onChange);
  const chosenCategory = categoryLabel(categories, entry.category_tag_id, fallbackLabel);
  const tags = detailLabels(details, entry.detail_tag_ids);
  const touchTarget = useTouchTarget();

  if (embedded) {
    // Só o lado "No Fincla · nova transação", sem moldura: o cartão de um par sugerido respondido
    // "Não, adicionar agora" (fincla-api#510) já mostra o lado do banco e a pergunta.
    return (
      <article data-testid="statement-entry-new-side" aria-label="Nova transação" style={{ display: "flex", minWidth: 0 }}>
        <NewTransactionEditor
          entry={entry} categories={categories} details={details} fallbackLabel={fallbackLabel} isMobile={isMobile} onChange={onChange}
          desc={embeddedDesc} skipped={skipped} invoice={invoice}
        />
      </article>
    );
  }

  return (
    <article
      data-testid="statement-entry"
      aria-label={`Lançamento ${entry.bank_description}`}
      style={{ background: T.surface, border: `1px solid ${ignored ? T.inkFaint : T.border}`, borderRadius: 14, boxShadow: ignored ? "none" : T.sm, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <SelectBox entry={entry} selected={selected} onSelect={onSelect} />
        <span style={{ ...G, ...NUM, fontSize: 13, fontWeight: 600, color: T.ink }}>{bankDateLabel(entry.date)}</span>
        {ignored ? <SkipBadge /> : <Badge color={T.green} bg={T.greenLight}>Adicionar agora</Badge>}
        <span style={{ flex: 1 }} />
        {onCollapse ? <button type="button" onClick={() => onCollapse(entry.id)} style={{ ...G, fontSize: 12, color: T.inkMid, background: "none", border: `1px solid ${T.border}`, borderRadius: 8, padding: "3px 8px", cursor: "pointer", ...touchTarget }}>Minimizar</button> : null}
      </header>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12 }}>
        <section data-testid="bank-side" style={{ ...BOX, background: ignored ? SKIP_BG : T.bg, ...(compact ? { padding: "8px 10px" } : null) }}>
          <div style={{ ...BOX_LABEL, ...(compact ? { marginBottom: 4 } : null) }}>No extrato do banco</div>
          {compact ? (
            <InlineFields
              testId="bank-inline"
              items={[
                ["Data", <span key="d" style={NUM}>{bankDateLabel(entry.date)}</span>],
                ["Descrição", <b key="n">{entry.bank_description}</b>],
                ["Valor", <b key="v" style={{ ...NUM, color: moneyIn ? T.green : T.ink }}>{formatMoney(entry.amount, entry.currency)}</b>],
              ]}
            />
          ) : (
            <>
              <div style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink, wordBreak: "break-word" }}>{entry.bank_description}</div>
              <div style={{ ...G, ...NUM, fontSize: 12, color: T.inkLight, marginTop: 6 }}>{bankDateLabel(entry.date)}</div>
              <div style={{ ...G, ...NUM, fontSize: 16, fontWeight: 700, marginTop: 6, color: moneyIn ? T.green : T.ink }}>
                {formatMoney(entry.amount, entry.currency)}
              </div>
            </>
          )}
        </section>

        <NewTransactionEditor
          entry={entry} categories={categories} details={details} fallbackLabel={fallbackLabel} isMobile={isMobile} onChange={onChange}
          desc={ownDesc} skipped={ignored}
        />
      </div>
      <AnswerSegment entry={entry} desc={ownDesc} busy={busy} onChange={onChange} onSearch={onSearch} onConfirm={onConfirm} />
      <OutcomeLine>
        {ignored ? (
          <>Este lançamento não entra no Fincla. Ele aparece na conferência de saldo.</>
        ) : (
          <>
            Ao concluir a conciliação: será adicionada <b>“{entry.description || "(sem descrição)"}”</b> em <b>{chosenCategory}</b>
            {tags.length ? <> com {tags.join(", ")}</> : null}.
          </>
        )}
      </OutcomeLine>
    </article>
  );
}
