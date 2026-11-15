import { useEffect, useState } from "react";
import { Ban, ChevronRight, Layers, Lock, Plus } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Badge, Select } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { DetailTagPicker } from "./DetailTagPicker.jsx";

/** "2026-10-02" → "02/10/2026", sem passar por `Date` (que leria em UTC e voltaria um dia). */
export function bankDateLabel(ymd) {
  const [y, m, d] = String(ymd ?? "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
}

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

/** Selo "Não registrar": escuro, com o ícone de proibido. */
export function SkipBadge() {
  return (
    <span style={{ ...G, fontSize: 11, fontWeight: 600, color: T.surface, background: T.inkMid, padding: "2px 7px", borderRadius: 9999, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
      <Ban size={11} aria-hidden="true" />Não registrar
    </span>
  );
}

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

/** "Este lançamento do banco já está no Fincla?" — nos lançamentos novos: adicionar agora ou não registrar. */
function AnswerSegment({ entry, onChange }) {
  const label = "Este lançamento do banco já está no Fincla?";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={{ ...G, fontSize: 12, fontWeight: 600, color: T.ink }}>{label}</span>
      <div role="group" aria-label={label} style={{ display: "inline-flex", border: `1px solid ${T.border}`, borderRadius: 9, overflow: "hidden" }}>
        <button type="button" aria-pressed={entry.answer === "create"} onClick={() => entry.answer !== "create" && onChange(entry.id, { answer: "create" })} style={SEG_BTN(entry.answer === "create", "create")}>
          <Plus size={12} aria-hidden="true" />Não, adicionar agora
        </button>
        <button type="button" aria-pressed={entry.answer === "ignore"} onClick={() => entry.answer !== "ignore" && onChange(entry.id, { answer: "ignore" })} style={{ ...SEG_BTN(entry.answer === "ignore", "ignore"), borderLeft: `1px solid ${T.border}` }}>
          <Ban size={12} aria-hidden="true" />Não registrar
        </button>
      </div>
    </div>
  );
}

function SelectBox({ entry, selected, onSelect }) {
  if (!onSelect) return null;
  return (
    <input
      type="checkbox"
      checked={selected}
      onChange={(e) => onSelect(entry.id, e.target.checked)}
      aria-label={`Marcar lançamento de ${bankDateLabel(entry.date)}`}
      style={{ width: 16, height: 16, margin: 0, cursor: "pointer" }}
    />
  );
}

/**
 * Um lançamento "Não registrar" minimizado (fincla-api#513): continua visível, com selo e fundo
 * próprios, "Alterar" no começo da linha (ou clique em qualquer ponto) e "Desfazer".
 */
export function IgnoredEntryRow({ entry, selected = false, onSelect = null, onExpand, onUndo }) {
  return (
    <div
      data-testid="ignored-entry"
      role="group"
      aria-label={`Lançamento ${entry.bank_description} não registrado`}
      onClick={() => onExpand(entry.id)}
      style={{ ...G, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", borderRadius: 12, border: `1px solid ${T.border}`, background: SKIP_BG }}
    >
      {onSelect ? <span onClick={(e) => e.stopPropagation()}><SelectBox entry={entry} selected={selected} onSelect={onSelect} /></span> : null}
      <button type="button" onClick={(e) => { e.stopPropagation(); onExpand(entry.id); }} style={{ ...G, fontSize: 12, fontWeight: 600, color: T.blue, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "3px 8px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 2 }}>
        <ChevronRight size={12} aria-hidden="true" />Alterar
      </button>
      <span style={{ ...NUM, fontSize: 12, color: T.inkLight, opacity: 0.8 }}>{bankDateLabel(entry.date)}</span>
      <span style={{ fontSize: 13, color: T.ink, opacity: 0.7, flex: "1 1 160px", minWidth: 0, wordBreak: "break-word" }}>{entry.bank_description}</span>
      <span style={{ ...NUM, fontSize: 13, color: T.inkMid, opacity: 0.7 }}>{formatMoney(entry.amount, entry.currency)}</span>
      <SkipBadge />
      <span style={{ fontSize: 12, color: T.inkLight }}>fica fora do Fincla</span>
      <button type="button" onClick={(e) => { e.stopPropagation(); onUndo(entry.id); }} style={{ ...G, fontSize: 12, color: T.inkMid, background: "none", border: "none", textDecoration: "underline", cursor: "pointer", padding: 0 }}>
        Desfazer
      </button>
    </div>
  );
}

/**
 * Um lançamento novo: à esquerda o que o banco registrou, à direita a transação que ele vai
 * virar ao concluir. Data e valor vêm do banco e ficam travados; descrição, tipo, forma de
 * pagamento (sugerida pelo texto do banco), categoria (sugerida pelo histórico) e etiquetas da
 * categoria são da pessoa. A descrição é gravada ao sair do campo. "Não registrar" troca o lado
 * direito por um aviso, com fundo próprio.
 */
export function StatementEntryCard({
  entry, categories, details = [], fallbackLabel, isMobile, onChange,
  selected = false, onSelect = null, onCollapse = null,
}) {
  const [description, setDescription] = useState(entry.description ?? "");
  useEffect(() => setDescription(entry.description ?? ""), [entry.description]);

  const moneyIn = entry.amount > 0;
  const type = entry.transaction_type ?? (moneyIn ? "income" : "expense");
  const options = categoriesForType(categories, type).filter((c) => !c.is_fallback);
  const blank = !description.trim();
  const fieldId = (name) => `entry-${entry.id}-${name}`;
  const ignored = entry.answer === "ignore";
  const chosenCategory = categoryLabel(categories, entry.category_tag_id, fallbackLabel);
  const tags = detailLabels(details, entry.detail_tag_ids);

  const saveDescription = () => {
    if (description !== (entry.description ?? "")) onChange(entry.id, { description });
  };

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
        {onCollapse ? <button type="button" onClick={() => onCollapse(entry.id)} style={{ ...G, fontSize: 12, color: T.inkMid, background: "none", border: `1px solid ${T.border}`, borderRadius: 8, padding: "3px 8px", cursor: "pointer" }}>Minimizar</button> : null}
      </header>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12 }}>
        <section style={{ ...BOX, background: ignored ? SKIP_BG : T.bg }}>
          <div style={BOX_LABEL}>No extrato do banco</div>
          <div style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink, wordBreak: "break-word" }}>{entry.bank_description}</div>
          <div style={{ ...G, ...NUM, fontSize: 12, color: T.inkLight, marginTop: 6 }}>{bankDateLabel(entry.date)}</div>
          <div style={{ ...G, ...NUM, fontSize: 16, fontWeight: 700, marginTop: 6, color: moneyIn ? T.green : T.ink }}>
            {formatMoney(entry.amount, entry.currency)}
          </div>
        </section>

        {ignored ? (
          <section data-testid="entry-not-recorded" style={{ ...BOX, borderStyle: "dashed", borderColor: T.inkFaint }}>
            <div style={BOX_LABEL}>No Fincla <SkipBadge /></div>
            <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: 0 }}>
              Este lançamento não entra no Fincla. O saldo do Fincla vai ficar sem este valor, e a diferença aparece na conferência de saldo.
            </p>
          </section>
        ) : (
          <section style={{ ...BOX, borderColor: T.greenBorder }}>
            <div style={BOX_LABEL}>
              No Fincla · nova transação <Badge color={T.green} bg={T.greenLight}>Entra ao concluir</Badge>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor={fieldId("description")} style={FIELD_LABEL}>Descrição</label>
                <input
                  id={fieldId("description")}
                  value={description}
                  maxLength={255}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={saveDescription}
                  aria-invalid={blank}
                  style={{ ...INPUT, borderColor: blank ? T.red : T.border }}
                />
                {blank
                  ? <span style={{ ...HELP, color: T.red }}>Escreva uma descrição.</span>
                  : <span style={HELP}>Começa com o texto do banco. Pode trocar por um nome seu.</span>}
              </div>

              <div>
                <span style={FIELD_LABEL}>Data</span>
                <LockedValue testId="locked-date" title="Vem do extrato e não pode ser alterada">{bankDateLabel(entry.date)}</LockedValue>
                <span style={HELP}>Vem do banco</span>
              </div>
              <div>
                <span style={FIELD_LABEL}>Valor</span>
                <LockedValue testId="locked-amount" title="Vem do extrato e não pode ser alterado">{formatMoney(entry.amount, entry.currency)}</LockedValue>
                <span style={HELP}>Vem do banco</span>
              </div>

              <div>
                {moneyIn ? (
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
            </div>
          </section>
        )}
      </div>
      <AnswerSegment entry={entry} onChange={onChange} />
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
