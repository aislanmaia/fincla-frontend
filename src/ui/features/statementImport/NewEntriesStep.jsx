// "Revisar rendimentos pequenos" e "Adicionar lançamentos novos" (fincla-api#513).
//
// Cada lançamento: adicionar (cartão completo) ou "Não registrar" (minimizado, com Alterar e
// Desfazer). Em lote: categoria, Não registrar e "Somar em um só lançamento", sempre com a barra
// de desfazer. As somas aparecem como cartões próprios, com os lançamentos somados dentro e
// "Tirar da soma" / "Desfazer soma". Tudo é gravado no rascunho; as contagens vêm do backend.
import { useEffect, useState } from "react";
import { Check, Layers, Lock, X } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Btn, Select } from "../../components/primitives";
import { plural } from "../../plural.js";
import { formatMoney } from "../../money/formatMoney.js";
import {
  BOX, FIELD_LABEL, HELP, INPUT, STATEMENT_PAYMENT_METHODS, TYPE_LABEL,
  CategoryHelp, IgnoredEntryRow, OutcomeLine, StatementEntryCard, SummedBadge,
  bankDateLabel, categoriesForType, categoryLabel, detailLabels,
} from "./StatementEntryCard.jsx";
import { DetailTagPicker } from "./DetailTagPicker.jsx";

const LINK_BTN = { ...G, fontSize: 12, color: T.inkMid, background: "none", border: "none", textDecoration: "underline", cursor: "pointer", padding: 0 };

const signed = (amount, currency) => `${amount > 0 ? "+" : ""}${formatMoney(amount, currency)}`;

/** Por que os marcados não podem ser somados; `null` = podem (o backend confere de novo). */
export function sumRefusal(entries) {
  if (entries.length < 2) return "Marque pelo menos 2 lançamentos para somar.";
  if (entries.some((e) => e.amount === 0)) return "Lançamento de valor zero não entra em uma soma.";
  if (new Set(entries.map((e) => e.amount < 0)).size > 1) return "Só dá para somar lançamentos do mesmo tipo: todos entradas ou todos saídas.";
  if (new Set(entries.map((e) => e.date.slice(0, 7))).size > 1) return "Só dá para somar lançamentos do mesmo mês.";
  return null;
}

function UndoBar({ bulk, onUndo }) {
  if (!bulk) return null;
  return (
    <div role="status" data-testid="undo-bar" style={{ ...G, fontSize: 13, color: T.ink, background: T.greenLight, border: `1px solid ${T.greenBorder}`, borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
      <Check size={14} aria-hidden="true" style={{ color: T.green }} />
      <span style={{ flex: 1 }}>{bulk.label}</span>
      <button type="button" onClick={onUndo} style={{ ...LINK_BTN, color: T.blue, fontSize: 13, fontWeight: 600 }}>Desfazer</button>
    </div>
  );
}

function GroupDraft({ count, monthName, onConfirm, onCancel, busy }) {
  const [description, setDescription] = useState("");
  const blank = !description.trim();
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.purple}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <label htmlFor="group-draft-description" style={FIELD_LABEL}>Descrição da transação (obrigatória)</label>
        <input
          id="group-draft-description"
          autoFocus
          value={description}
          maxLength={255}
          placeholder="ex.: Rendimentos da conta"
          onChange={(e) => setDescription(e.target.value)}
          style={INPUT}
        />
        <span style={HELP}>
          Ao concluir a conciliação, vira um lançamento só{monthName ? ` em ${monthName}` : ""}, com a soma dos {count} lançamentos, na data do último. Os lançamentos do banco ficam guardados.
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Btn variant="dark" disabled={blank || busy} onClick={() => onConfirm(description.trim())}>Somar {count} lançamentos</Btn>
        <Btn variant="ghost" onClick={onCancel}>Cancelar</Btn>
        {blank ? <span style={{ ...G, fontSize: 12, color: T.inkLight }}>Escreva a descrição para poder somar.</span> : null}
      </div>
    </div>
  );
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function SelectionBar({ stepKey, selected, categories, busy, onClear, onApplyCategory, onIgnore, onSum }) {
  const [categoryId, setCategoryId] = useState("");
  const [drafting, setDrafting] = useState(false);
  useEffect(() => { if (selected.length < 2) setDrafting(false); }, [selected.length]);
  const total = selected.reduce((sum, e) => sum + e.amount, 0);
  const currency = selected[0]?.currency ?? null;
  const refusal = sumRefusal(selected);
  // Só as categorias que aceitam todos os marcados (o backend recusa o lote inteiro senão).
  // Categoria só vale para quem vai virar transação sozinho: os "Não registrar" marcados ficam de fora.
  const addable = selected.filter((e) => e.answer === "create");
  const types = [...new Set(addable.map((e) => e.transaction_type ?? (e.amount > 0 ? "income" : "expense")))];
  const options = categories.filter((c) => !c.is_fallback && types.every((t) => categoriesForType([c], t).length));
  const month = refusal ? "" : MONTHS[Number(selected[0].date.slice(5, 7)) - 1];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div role="region" aria-label="Lançamentos marcados" style={{ ...G, fontSize: 12, color: T.ink, background: T.purpleLight, border: `1px solid ${T.purple}`, borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Btn variant="ghost" small onClick={onClear} aria-label="Desmarcar todos"><X size={12} aria-hidden="true" />Desmarcar</Btn>
        <span><b>{plural(selected.length, "marcado", "marcados")}</b> · <span style={NUM}>soma {signed(total, currency)}</span></span>
        <span style={{ flex: 1 }} />
        {stepKey === "new" ? (
          <>
            <label htmlFor="bulk-category" style={{ fontSize: 12 }}>Categoria</label>
            <Select id="bulk-category" value={categoryId} disabled={!addable.length} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Escolha…</option>
              {addable.length ? options.map((c) => <option key={c.id} value={c.id}>{c.label || c.name}</option>) : null}
            </Select>
            <Btn variant="purple" small disabled={!addable.length || !categoryId || busy} onClick={() => onApplyCategory(categoryId)}>
              {addable.length === selected.length ? `Aplicar aos ${selected.length} marcados` : `Aplicar aos ${addable.length} a adicionar`}
            </Btn>
          </>
        ) : null}
        <Btn variant="outPurp" small disabled={!!refusal || busy} onClick={() => setDrafting(true)}>
          <Layers size={12} aria-hidden="true" />Somar em um só lançamento
        </Btn>
        <Btn variant="outGray" small disabled={busy} onClick={onIgnore}>Não registrar as marcadas</Btn>
      </div>
      {stepKey === "new" && !addable.length ? (
        <div role="note" data-testid="bulk-category-note" style={{ ...G, fontSize: 12, color: T.inkMid, background: T.grayLight, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 12px" }}>
          Os marcados estão como “Não registrar”: a categoria só vale para lançamentos que vão ser adicionados.
        </div>
      ) : null}
      {refusal && selected.length > 1 ? (
        <div role="note" style={{ ...G, fontSize: 12, color: T.amber, background: T.amberLight, border: `1px solid ${T.amberBorder}`, borderRadius: 10, padding: "8px 12px" }}>{refusal}</div>
      ) : null}
      {drafting && !refusal ? (
        <GroupDraft
          count={selected.length}
          monthName={month}
          busy={busy}
          onCancel={() => setDrafting(false)}
          onConfirm={async (description) => { await onSum(description); setDrafting(false); }}
        />
      ) : null}
    </div>
  );
}

/** Um lançamento somado: vira UMA transação; os lançamentos do banco aparecem dentro dele. */
function GroupCard({ group, entries, categories, details, fallbackLabel, isMobile, onUpdate, onUngroup, onTakeOut }) {
  const [description, setDescription] = useState(group.description);
  useEffect(() => setDescription(group.description), [group.description]);
  const blank = !description.trim();
  const fieldId = (name) => `group-${group.id}-${name}`;
  const moneyIn = group.amount > 0;
  const options = categoriesForType(categories, group.transaction_type).filter((c) => !c.is_fallback);
  const chosen = categoryLabel(categories, group.category_tag_id, fallbackLabel);
  const tags = detailLabels(details, group.detail_tag_ids);
  const save = () => {
    if (!blank && description.trim() !== group.description) onUpdate(group.id, { description: description.trim() });
  };

  return (
    <article data-testid="statement-group" aria-label={`Lançamento somado ${group.description}`} style={{ background: T.surface, border: `1px solid ${T.purple}`, borderRadius: 14, boxShadow: T.sm, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <header style={{ ...G, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <SummedBadge>Lançamento somado</SummedBadge>
        <span style={{ fontSize: 12, color: T.inkLight }}>
          {plural(entries.length, "lançamento", "lançamentos")} do banco · data <span style={NUM}>{bankDateLabel(group.date)}</span>
        </span>
        <span style={{ flex: 1 }} />
        <b style={{ ...NUM, fontSize: 14, color: moneyIn ? T.green : T.ink }}>{signed(group.amount, group.currency)}</b>
        <button type="button" onClick={() => onUngroup(group)} style={LINK_BTN}>Desfazer soma</button>
      </header>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor={fieldId("description")} style={FIELD_LABEL}>Descrição</label>
          <input id={fieldId("description")} value={description} maxLength={255} onChange={(e) => setDescription(e.target.value)} onBlur={save} aria-invalid={blank} style={{ ...INPUT, borderColor: blank ? T.red : T.border }} />
          {blank ? <span style={{ ...HELP, color: T.red }}>Escreva uma descrição.</span> : null}
        </div>
        <div>
          <span style={FIELD_LABEL}>Valor</span>
          <span data-testid="group-amount" style={{ ...G, ...NUM, display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.inkMid, background: T.grayLight, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px" }}>
            <Lock size={12} aria-hidden="true" />{formatMoney(group.amount, group.currency)}
          </span>
          <span style={HELP}>Soma dos lançamentos</span>
        </div>
        <div>
          {moneyIn ? (
            <>
              <label htmlFor={fieldId("type")} style={FIELD_LABEL}>Tipo</label>
              <Select id={fieldId("type")} value={group.transaction_type} onChange={(e) => onUpdate(group.id, { transaction_type: e.target.value })} style={{ width: "100%" }}>
                <option value="income">{TYPE_LABEL.income}</option>
                <option value="refund">{TYPE_LABEL.refund}</option>
              </Select>
            </>
          ) : (
            <>
              <span style={FIELD_LABEL}>Tipo</span>
              <span style={{ ...G, fontSize: 13, color: T.inkMid, display: "block", padding: "8px 0" }}>{TYPE_LABEL.expense}</span>
            </>
          )}
        </div>
        <div>
          <label htmlFor={fieldId("payment")} style={FIELD_LABEL}>Forma de pagamento</label>
          <Select id={fieldId("payment")} value={group.payment_method} onChange={(e) => onUpdate(group.id, { payment_method: e.target.value })} style={{ width: "100%" }}>
            {STATEMENT_PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
        </div>
        <div>
          <label htmlFor={fieldId("category")} style={FIELD_LABEL}>Categoria</label>
          <Select id={fieldId("category")} value={group.category_tag_id ?? ""} onChange={(e) => onUpdate(group.id, { category_tag_id: e.target.value || null })} style={{ width: "100%" }}>
            <option value="">{fallbackLabel}</option>
            {options.map((c) => <option key={c.id} value={c.id}>{c.label || c.name}</option>)}
          </Select>
          <CategoryHelp categoryId={group.category_tag_id} suggestedId={group.suggested_category_tag_id} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <span style={FIELD_LABEL}>Etiquetas</span>
          <DetailTagPicker categoryId={group.category_tag_id} categoryLabel={chosen} details={details} selected={group.detail_tag_ids} onChange={(next) => onUpdate(group.id, { detail_tag_ids: next })} />
        </div>
      </div>
      <ul aria-label="Lançamentos do banco nesta soma" style={{ ...BOX, listStyle: "none", margin: 0, padding: 8, display: "flex", flexDirection: "column", gap: 6, background: T.bg }}>
        {entries.map((e) => (
          <li key={e.id} data-testid="summed-entry" style={{ ...G, fontSize: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ ...NUM, color: T.inkLight }}>{bankDateLabel(e.date)}</span>
            <span style={{ flex: "1 1 140px", color: T.ink, wordBreak: "break-word" }}>{e.bank_description}</span>
            <span style={{ ...NUM, color: T.inkMid }}>{signed(e.amount, e.currency)}</span>
            <Btn variant="outGray" small onClick={() => onTakeOut(e.id)}>Tirar da soma</Btn>
          </li>
        ))}
      </ul>
      <OutcomeLine>
        Ao concluir a conciliação: será adicionado <b>“{group.description}”</b> em <b>{chosen}</b>
        {tags.length ? <> com {tags.join(", ")}</> : null}, {signed(group.amount, group.currency)}, em {bankDateLabel(group.date)}.
      </OutcomeLine>
    </article>
  );
}

export function NewEntriesStep({
  stepKey, entries, groups, categories, details, fallbackLabel, isMobile,
  onChangeEntry, onBatch, onCreateGroup, onUpdateGroup, onDeleteGroup,
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [expanded, setExpanded] = useState(() => new Set());
  const [lastBulk, setLastBulk] = useState(null);
  const [busy, setBusy] = useState(false);
  // O lançamento que acabou de minimizar: o foco vai para o "Alterar" da linha dele, para quem usa
  // teclado ou leitor de tela não perder o lugar na lista.
  const [focusId, setFocusId] = useState(null);

  const byId = new Map(entries.map((e) => [e.id, e]));
  const stepGroups = groups.filter((g) => byId.has(g.entry_ids[0]));
  const free = entries.filter((e) => e.answer !== "group");
  const selected = free.filter((e) => selectedIds.includes(e.id));
  const unclassified = free.filter((e) => e.answer === "create" && !e.category_tag_id);

  const select = (id, on) => setSelectedIds((ids) => (on ? [...new Set([...ids, id])] : ids.filter((x) => x !== id)));
  const setExpandedFor = (id, on) => setExpanded((cur) => { const next = new Set(cur); if (on) next.add(id); else next.delete(id); return next; });

  const run = async (work) => {
    setBusy(true);
    try { return await work(); } finally { setBusy(false); }
  };

  const applyCategory = (categoryId) => run(async () => {
    const targets = selected.filter((e) => e.answer === "create");
    const before = targets.map((e) => ({ id: e.id, category_tag_id: e.category_tag_id, detail_tag_ids: e.detail_tag_ids }));
    const done = await onBatch(targets.map((e) => ({ id: e.id, category_tag_id: categoryId })));
    if (!done) return;
    const label = categoryLabel(categories, categoryId, fallbackLabel);
    setLastBulk({ label: `Categoria ${label} aplicada a ${plural(targets.length, "lançamento", "lançamentos")}`, undo: () => onBatch(before) });
    setSelectedIds([]);
  });

  const ignoreSelected = () => run(async () => {
    // O desfazer devolve a resposta E o "confirmado" que cada um tinha (o backend confirma quem responde).
    const before = selected.map((e) => ({ id: e.id, answer: e.answer, confirmed: e.confirmed }));
    const done = await onBatch(selected.map((e) => ({ id: e.id, answer: "ignore" })));
    if (!done) return;
    setLastBulk({ label: `${plural(selected.length, "lançamento marcado", "lançamentos marcados")} como não registrar`, undo: () => onBatch(before) });
    setSelectedIds([]);
  });

  const sum = (description) => run(async () => {
    const known = new Set(groups.map((g) => g.id));
    const updated = await onCreateGroup(selected.map((e) => e.id), description);
    if (!updated) return;
    const created = updated.groups.find((g) => !known.has(g.id));
    // Desfazer a soma devolve cada lançamento à resposta que tinha antes (o backend guarda).
    setLastBulk({
      label: `${plural(selected.length, "lançamento somado", "lançamentos somados")} em “${description}”`,
      undo: () => (created ? onDeleteGroup(created.id) : null),
    });
    setSelectedIds([]);
  });

  // "Desfazer soma" no cartão: a soma some, mas com barra de desfazer que a refaz com o que a
  // pessoa tinha escolhido para ela (descrição, tipo, forma de pagamento, categoria e etiquetas).
  const ungroup = (group) => run(async () => {
    const kept = {
      entry_ids: [...group.entry_ids],
      description: group.description,
      fields: {
        transaction_type: group.transaction_type,
        payment_method: group.payment_method,
        category_tag_id: group.category_tag_id,
        detail_tag_ids: [...(group.detail_tag_ids ?? [])],
      },
    };
    const done = await onDeleteGroup(group.id);
    if (!done) return;
    setLastBulk({
      label: `Soma “${group.description}” desfeita`,
      undo: async () => {
        const known = new Set(done.groups.map((g) => g.id));
        const updated = await onCreateGroup(kept.entry_ids, kept.description);
        const created = updated?.groups.find((g) => !known.has(g.id));
        if (created) await onUpdateGroup(created.id, kept.fields);
      },
    });
  });

  const undoBulk = () => run(async () => {
    const bulk = lastBulk;
    setLastBulk(null);
    await bulk?.undo();
  });

  const allSelected = free.length > 0 && free.every((e) => selectedIds.includes(e.id));
  const freeTotal = free.reduce((s, e) => s + e.amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {stepGroups.map((group) => (
        <GroupCard
          key={group.id}
          group={group}
          entries={group.entry_ids.map((id) => byId.get(id)).filter(Boolean)}
          categories={categories}
          details={details}
          fallbackLabel={fallbackLabel}
          isMobile={isMobile}
          onUpdate={onUpdateGroup}
          onUngroup={ungroup}
          onTakeOut={(entryId) => onChangeEntry(entryId, { answer: "create" })}
        />
      ))}

      {free.length ? (
        <div style={{ ...G, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Btn variant="outGray" small onClick={() => setSelectedIds(allSelected ? [] : free.map((e) => e.id))}>
            {allSelected ? "Desmarcar todas" : `Marcar todas (${free.length})`}
          </Btn>
          {stepKey === "yield" ? (
            <span style={{ fontSize: 12, color: T.inkLight }}>soma das {free.length}: <span style={NUM}>{signed(freeTotal, free[0]?.currency)}</span></span>
          ) : unclassified.length ? (
            <>
              <Btn variant="outAmber" small onClick={() => setSelectedIds(unclassified.map((e) => e.id))}>
                Marcar as {unclassified.length} sem categoria
              </Btn>
              <span style={{ fontSize: 12, color: T.amber }}>{plural(unclassified.length, "lançamento vai", "lançamentos vão")} para Não classificado</span>
            </>
          ) : (
            <span style={{ fontSize: 12, color: T.green }}>Todos têm categoria</span>
          )}
        </div>
      ) : stepKey === "yield" && stepGroups.length ? (
        <p role="status" style={{ ...G, fontSize: 13, color: T.green, margin: 0 }}>Todos os rendimentos foram somados.</p>
      ) : null}

      <UndoBar bulk={lastBulk} onUndo={undoBulk} />
      {selected.length ? (
        <SelectionBar
          stepKey={stepKey}
          selected={selected}
          categories={categories}
          busy={busy}
          onClear={() => setSelectedIds([])}
          onApplyCategory={applyCategory}
          onIgnore={ignoreSelected}
          onSum={sum}
        />
      ) : null}

      {free.map((entry) => (
        entry.answer === "ignore" && !expanded.has(entry.id) ? (
          <IgnoredEntryRow
            key={entry.id}
            entry={entry}
            focus={focusId === entry.id}
            selected={selectedIds.includes(entry.id)}
            onSelect={select}
            onExpand={(id) => setExpandedFor(id, true)}
            onUndo={(id) => onChangeEntry(id, { answer: "create" })}
          />
        ) : (
          <StatementEntryCard
            key={entry.id}
            entry={entry}
            categories={categories}
            details={details}
            fallbackLabel={fallbackLabel}
            isMobile={isMobile}
            selected={selectedIds.includes(entry.id)}
            onSelect={select}
            onCollapse={entry.answer === "ignore" ? (id) => { setFocusId(id); setExpandedFor(id, false); } : null}
            onChange={(id, body) => {
              // "Não registrar" escolhido no cartão: ele minimiza e continua na lista.
              if (body.answer === "ignore") { setFocusId(id); setExpandedFor(id, false); }
              return onChangeEntry(id, body);
            }}
          />
        )
      ))}
    </div>
  );
}
