import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { Btn, Select } from "../../components/primitives.jsx";
import { formatMoneyAbs } from "../../money/formatMoney.js";
import { T } from "../../tokens.js";
import { G, NUM } from "../../typography.js";
import { useFocusTrap } from "../transactions/useFocusTrap.js";
import { pickCategoryTagFromApiTransaction } from "../../data/transactionsAdapter.js";
import { parseMoneyInput } from "../onboarding/onboardingValueUtils.js";
import { installmentOf } from "./ledgerModel.js";

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const inputStyle = { ...G, border: `1px solid ${T.border}`, borderRadius: 9, background: T.surface, color: T.ink, padding: "8px 10px", fontSize: 12, width: "100%", boxSizing: "border-box" };

/** Casca comum: dialog modal com foco preso, Escape e clique no fundo para fechar. */
export function LedgerModal({ title, onClose, children, side = false, width = 420 }) {
  const ref = useRef(null);
  const closeRef = useRef(null);
  useFocusTrap(ref, true);
  useEffect(() => { closeRef.current?.focus(); }, []);
  return <div ref={ref} role="dialog" aria-modal="true" aria-label={title} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}
    style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,15,13,.35)", display: "flex", justifyContent: side ? "flex-end" : "center", alignItems: side ? "stretch" : "center" }} onClick={onClose}>
    <div style={{ ...G, background: T.surface, width: side ? Math.min(width, 380) : "min(92vw, " + width + "px)", maxHeight: side ? "100%" : "88dvh", borderRadius: side ? 0 : 14, padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }} onClick={(event) => event.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <h2 style={{ ...G, margin: 0, fontSize: 16 }}>{title}</h2>
        <button ref={closeRef} type="button" aria-label="Fechar" onClick={onClose} style={{ border: 0, background: "none", cursor: "pointer" }}><X size={18} /></button>
      </div>
      {children}
    </div>
  </div>;
}

function Outcome({ error, notice }) {
  return <>
    {error && <p role="alert" style={{ ...G, margin: 0, fontSize: 12, color: T.red }}>{error}</p>}
    {notice && <p role="status" style={{ ...G, margin: 0, fontSize: 12, color: T.inkMid }}>{notice}</p>}
  </>;
}

export function CategorizeDialog({ rows: selection, categories, onSubmit, onClose }) {
  // Estorno tem catálogo de categorias próprio: a categoria de despesa não vale para ele.
  const rows = selection.filter((row) => row.type !== "refund");
  const ignored = selection.length - rows.length;
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async () => {
    setBusy(true); setError(null);
    const failed = await onSubmit(categoryId);
    setBusy(false);
    if (failed) setError(failed);
  };
  return <LedgerModal title="Categorizar lançamentos" onClose={onClose}>
    <p style={{ ...G, margin: 0, fontSize: 12, color: T.inkMid }}>{rows.length} lançamento{rows.length === 1 ? "" : "s"} selecionado{rows.length === 1 ? "" : "s"}. As etiquetas de cada um são mantidas.{ignored > 0 ? ` ${ignored} estorno${ignored === 1 ? " fica" : "s ficam"} de fora: estorno mantém a categoria de estorno.` : ""}</p>
    <label style={{ ...G, display: "flex", flexDirection: "column", gap: 6, fontSize: 11, fontWeight: 700, color: T.inkMid }}>Nova categoria
      <Select aria-label="Nova categoria" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
        <option value="">Escolha…</option>
        {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
      </Select>
    </label>
    <Outcome error={error} />
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Btn variant="outGray" onClick={onClose}>Cancelar</Btn><Btn variant="blue" disabled={!categoryId || busy || rows.length === 0} onClick={submit}>{busy ? "Aplicando…" : "Aplicar categoria"}</Btn></div>
  </LedgerModal>;
}

/**
 * Destinos: faturas ainda editáveis. Parte da fatura ATUAL do backend (ou do mês do relógio, sem ela)
 * e vai 12 meses à frente; do histórico entram só as que não estão paga/fechada.
 */
function targetMonths(options, currentKey, now) {
  const match = /^(\d{4})-(\d{2})$/.exec(currentKey ?? "");
  const base = match ? { year: Number(match[1]), month: Number(match[2]) } : { year: now.getFullYear(), month: now.getMonth() + 1 };
  const known = options.filter((option) => option.status !== "paid" && option.status !== "closed" && (option.year * 12 + option.month) >= (base.year * 12 + base.month)).map((option) => ({ year: option.year, month: option.month }));
  const ahead = Array.from({ length: 12 }, (_, index) => { const date = new Date(base.year, base.month - 1 + index, 1); return { year: date.getFullYear(), month: date.getMonth() + 1 }; });
  const seen = new Set();
  return [...known, ...ahead].filter((entry) => { const key = `${entry.year}-${entry.month}`; if (seen.has(key)) return false; seen.add(key); return true; }).sort((a, b) => (a.year - b.year) || (a.month - b.month));
}

export function MoveInstallmentDialog({ rows, invoiceOptions, currentKey = null, onSubmit, onClose, now = new Date() }) {
  const movable = rows.filter((row) => installmentOf(row));
  const months = targetMonths(invoiceOptions, currentKey, now);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async () => {
    const [year, month] = target.split("-").map(Number);
    setBusy(true); setError(null);
    const failed = await onSubmit({ rows: movable, year, month });
    setBusy(false);
    if (failed) setError(failed);
  };
  return <LedgerModal title="Mover parcela de fatura" onClose={onClose}>
    {movable.length === 0
      ? <p role="status" style={{ ...G, margin: 0, fontSize: 12, color: T.inkMid }}>Só parcelas de compras parceladas podem mudar de fatura. Nenhum item selecionado é parcelado.</p>
      : <>
        <p style={{ ...G, margin: 0, fontSize: 12, color: T.inkMid }}>{movable.length} parcela{movable.length === 1 ? "" : "s"}{movable.length < rows.length ? ` (${rows.length - movable.length} item(ns) à vista foram ignorados)` : ""}. As demais parcelas da mesma compra são reposicionadas, um mês de intervalo entre elas.</p>
        <label style={{ ...G, display: "flex", flexDirection: "column", gap: 6, fontSize: 11, fontWeight: 700, color: T.inkMid }}>Fatura de destino
          <Select aria-label="Fatura de destino" value={target} onChange={(event) => setTarget(event.target.value)}>
            <option value="">Escolha…</option>
            {months.map((entry) => <option key={`${entry.year}-${entry.month}`} value={`${entry.year}-${entry.month}`}>{`${MONTH_NAMES[entry.month - 1]} ${entry.year}`}</option>)}
          </Select>
        </label>
      </>}
    <Outcome error={error} />
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Btn variant="outGray" onClick={onClose}>Cancelar</Btn>{movable.length > 0 && <Btn variant="blue" disabled={!target || busy} onClick={submit}>{busy ? "Movendo…" : "Mover parcela"}</Btn>}</div>
  </LedgerModal>;
}

export function RefundDialog({ row, currency, categories, onSubmit, onClose, today }) {
  const original = Math.abs(Number(row.value) || 0);
  const code = row.value_currency ?? currency;
  // pt-BR: vírgula decimal (o parser tira o ponto como separador de milhar).
  const [value, setValue] = useState(original.toFixed(2).replace(".", ","));
  const [description, setDescription] = useState(`Estorno · ${row.description}`);
  const [date, setDate] = useState(today);
  // Mesma categoria da compra quando o catálogo de estorno a tem; senão a primeira disponível.
  const originalLabel = pickCategoryTagFromApiTransaction(row)?.label;
  const [pickedCategory, setPickedCategory] = useState("");
  // O catálogo de estorno pode chegar depois de o diálogo abrir: o padrão é calculado a cada render.
  const categoryId = pickedCategory || (categories.find((entry) => entry.label === originalLabel) ?? categories[0])?.id || "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const amount = parseMoneyInput(value) ?? Number.NaN;
  const valid = Number.isFinite(amount) && amount > 0 && amount <= original && description.trim() && date && categoryId;
  const submit = async () => {
    setBusy(true); setError(null);
    const failed = await onSubmit({ row, value: amount, description: description.trim(), dateYmd: date, categoryId });
    setBusy(false);
    if (failed) setError(failed);
  };
  return <LedgerModal title="Lançar estorno" onClose={onClose}>
    <div style={{ background: T.greenLight, border: `1px solid ${T.green}`, borderRadius: 10, padding: 12, fontSize: 12 }}>
      <strong style={{ color: T.green }}>Estornando a compra</strong>
      <div style={{ marginTop: 4 }}>{row.description} · <span style={NUM}>{code ? formatMoneyAbs(original, code) : original}</span></div>
    </div>
    <label style={{ ...G, display: "flex", flexDirection: "column", gap: 6, fontSize: 11, fontWeight: 700, color: T.inkMid }}>Valor do estorno
      <input aria-label="Valor do estorno" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} style={inputStyle} />
    </label>
    <label style={{ ...G, display: "flex", flexDirection: "column", gap: 6, fontSize: 11, fontWeight: 700, color: T.inkMid }}>Descrição
      <input aria-label="Descrição do estorno" value={description} onChange={(event) => setDescription(event.target.value)} style={inputStyle} />
    </label>
    <label style={{ ...G, display: "flex", flexDirection: "column", gap: 6, fontSize: 11, fontWeight: 700, color: T.inkMid }}>Data
      <input aria-label="Data do estorno" type="date" value={date} onChange={(event) => setDate(event.target.value)} style={inputStyle} />
    </label>
    {categories.length > 1 && <label style={{ ...G, display: "flex", flexDirection: "column", gap: 6, fontSize: 11, fontWeight: 700, color: T.inkMid }}>Categoria do estorno
      <Select aria-label="Categoria do estorno" value={categoryId} onChange={(event) => setPickedCategory(event.target.value)}>{categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</Select>
    </label>}
    {categories.length === 0 && <p role="alert" style={{ ...G, margin: 0, fontSize: 12, color: T.red }}>Nenhuma categoria de estorno disponível.</p>}
    {Number.isFinite(amount) && amount > original && <p role="alert" style={{ ...G, margin: 0, fontSize: 12, color: T.red }}>O estorno não pode passar do valor da compra.</p>}
    <Outcome error={error} />
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Btn variant="outGray" onClick={onClose}>Cancelar</Btn><Btn variant="green" disabled={!valid || busy} onClick={submit}>{busy ? "Lançando…" : "Lançar estorno"}</Btn></div>
  </LedgerModal>;
}

export function ExportDialog({ total, filterSummary, onExport, onClose }) {
  const [format, setFormat] = useState("csv");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async () => {
    setBusy(true); setError(null);
    const failed = await onExport(format);
    setBusy(false);
    if (failed) setError(failed); else onClose();
  };
  return <LedgerModal title="Exportar lançamentos" onClose={onClose}>
    <p style={{ ...G, margin: 0, fontSize: 12, color: T.inkMid }}>Sai o conjunto inteiro do recorte atual{total != null ? `: ${total} lançamento${total === 1 ? "" : "s"}` : ""}, não só o que está carregado na tela.</p>
    {filterSummary.length > 0 && <ul style={{ ...G, margin: 0, paddingLeft: 18, fontSize: 11, color: T.inkMid }}>{filterSummary.map((line) => <li key={line}>{line}</li>)}</ul>}
    <div role="group" aria-label="Formato" style={{ display: "flex", gap: 8 }}>
      {[["csv", "CSV"], ["pdf", "PDF"]].map(([value, label]) => <button key={value} type="button" aria-pressed={format === value} onClick={() => setFormat(value)} style={{ ...G, flex: 1, minHeight: 40, border: `1.5px solid ${format === value ? T.blue : T.border}`, borderRadius: 9, background: format === value ? T.blueLight : T.surface, color: format === value ? T.blue : T.ink, fontWeight: 700, cursor: "pointer" }}>{label}</button>)}
    </div>
    <Outcome error={error} />
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Btn variant="outGray" onClick={onClose}>Cancelar</Btn><Btn variant="dark" disabled={busy || !total} onClick={submit}>{busy ? "Preparando…" : `Exportar ${format.toUpperCase()}`}</Btn></div>
  </LedgerModal>;
}
