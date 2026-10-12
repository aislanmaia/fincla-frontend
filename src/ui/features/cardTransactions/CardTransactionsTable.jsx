import { useEffect, useMemo, useRef } from "react";
import { ChevronRight } from "lucide-react";
import { T } from "../../tokens.js";
import { G, NUM } from "../../typography.js";
import { Badge, Card } from "../../components/primitives.jsx";
import { formatMoneyAbs } from "../../money/formatMoney.js";
import { pickCategoryTagFromApiTransaction } from "../../data/transactionsAdapter.js";
import { forecastEnd, groupSubtotal, installmentOf, remainingInstallments } from "./ledgerModel.js";

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
const weekDate = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });
function parsedDate(value) {
  const date = new Date(`${String(value || "").slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
const dateLabel = (date) => shortDate.format(date).replace(" de ", " ");
function category(row) {
  const tag = pickCategoryTagFromApiTransaction(row);
  return tag?.label || tag?.name || row.category || "Sem categoria";
}
function amount(row, currency) {
  const code = row.value_currency ?? currency;
  const formatted = code ? formatMoneyAbs(row.value, code) : null;
  return formatted ? `${row.type === "refund" || row.type === "income" ? "+" : "−"}${formatted}` : "—";
}
function status(row) {
  if (row.type === "refund") return { text: "Estorno", color: T.green, bg: T.greenLight };
  if (row.status === "paid") return { text: "Paga", color: T.green, bg: T.greenLight };
  if (row.status === "confirmed") return { text: "A pagar", color: T.blue, bg: T.blueLight };
  if (row.status === "pending") return { text: "Pendente", color: T.amber, bg: T.amberLight };
  if (row.status === "cancelled") return { text: "Cancelada", color: T.inkMid, bg: T.grayLight };
  return { text: "Situação indisponível", color: T.inkMid, bg: T.grayLight };
}

const bulkButton = { ...G, border: 0, background: "none", color: T.blue, cursor: "pointer", textDecoration: "underline", fontSize: 11 };
const COLUMNS = "22px 58px minmax(140px,2.2fr) minmax(96px,1fr) 62px 96px 70px 92px 86px";

export function CardTransactionsTable({ rows, total, cardCurrency, loading, hasMore, error, onMore, selected, onSelected, onExportSelected, selectionSum, onCategorize, onMoveInstallment, inspected, onInspect, grouped, density, isMobile, maxHeight }) {
  const scrollerRef = useRef(null);
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!hasMore || loading || error || !sentinelRef.current || !scrollerRef.current || typeof IntersectionObserver !== "function") return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) onMore();
    }, { root: scrollerRef.current, rootMargin: "0px 0px 160px 0px" });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, error, onMore, rows.length]);
  const allChecked = rows.length > 0 && rows.every((row) => selected.includes(row.id));
  const groups = useMemo(() => {
    if (!grouped) return [{ key: "all", rows }];
    const result = [];
    for (const row of rows) {
      const key = String(row.date || "").slice(0, 10) || "undated";
      if (result.at(-1)?.key !== key) result.push({ key, rows: [] });
      result.at(-1).rows.push(row);
    }
    return result;
  }, [grouped, rows]);
  const rowPadding = density === "compacto" ? "7px 12px" : density === "confortavel" ? "15px 12px" : "10px 12px";
  return <Card as="section" aria-label="Lançamentos do cartão" style={{ minWidth: 0, overflow: "hidden", padding: 0, width: "100%" }}>
    <div style={{ ...G, display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 700 }}>
      <input type="checkbox" aria-label="Selecionar lançamentos carregados" checked={allChecked} onChange={(event) => onSelected(event.target.checked ? [...new Set([...selected, ...rows.map((row) => row.id)])] : selected.filter((id) => !rows.some((row) => row.id === id)))} />
      <span>{total == null ? `${rows.length} lançamentos` : `${total} lançamentos`}</span>
      {selected.length > 0 && <span style={{ color: T.blue }}>{selected.length} selecionado{selected.length === 1 ? "" : "s"}{selectionSum ? ` · ${selectionSum}` : ""}</span>}
      {selected.length > 0 && <span role="toolbar" aria-label="Ações em lote" style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
        {onCategorize && <button type="button" onClick={onCategorize} style={bulkButton}>Categorizar</button>}
        {onMoveInstallment && <button type="button" onClick={onMoveInstallment} style={bulkButton}>Mover parcela</button>}
        <button type="button" onClick={onExportSelected} style={bulkButton}>Exportar seleção CSV</button>
      </span>}
      {selected.length > 0 && <button type="button" onClick={() => onSelected([])} style={{ ...G, border: 0, background: "none", color: T.blue, cursor: "pointer", textDecoration: "underline", fontSize: 11 }}>Limpar seleção</button>}
    </div>
    <div ref={scrollerRef} className="fincla-scroll" style={{ maxHeight: isMobile ? "min(60dvh, 680px)" : maxHeight == null ? 560 : Math.max(100, maxHeight - 82), overflowY: "auto", overflowX: "hidden" }}>
      {!isMobile && <div aria-hidden="true" style={{ ...G, display: "grid", gridTemplateColumns: COLUMNS, gap: 10, padding: "7px 12px", borderBottom: `1px solid ${T.border}`, background: T.bg, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", position: "sticky", top: 0, zIndex: 3 }}><span /><span>Data</span><span>Descrição</span><span>Categoria</span><span>Parcela</span><span>Restam</span><span>Fim previsto</span><span style={{ textAlign: "right" }}>Valor</span><span>Status</span></div>}
      <div role="list">
        {groups.map((group) => <div key={group.key}>
          {grouped && <div style={{ ...G, ...NUM, position: "sticky", top: 0, zIndex: 2, background: T.bg, borderBottom: `1px solid ${T.border}`, padding: "7px 14px", fontSize: 11, color: T.inkMid }}>{parsedDate(group.key) ? dateLabel(parsedDate(group.key)) : "Sem data"} · {group.rows.length} {group.rows.length === 1 ? "item" : "itens"}{(() => { const sub = groupSubtotal(group.rows, cardCurrency); return sub ? <strong style={{ float: "right", color: T.ink }}>{formatMoneyAbs(sub.amount, sub.currency)}</strong> : null; })()}</div>}
          {group.rows.map((row) => {
            const date = parsedDate(row.date);
            const part = installmentOf(row);
            const info = status(row);
            if (!isMobile) {
              const rest = remainingInstallments(row);
              return <div key={row.id} role="listitem" style={{ display: "grid", gridTemplateColumns: COLUMNS, gap: 10, alignItems: "center", padding: rowPadding, borderBottom: `1px solid ${T.border}`, background: inspected?.id === row.id ? T.blueLight : T.surface, minWidth: 0, ...G, fontSize: 11 }}>
                <input type="checkbox" aria-label={`Selecionar ${row.description}`} checked={selected.includes(row.id)} onChange={() => onSelected(selected.includes(row.id) ? selected.filter((id) => id !== row.id) : [...selected, row.id])} />
                <div style={{ ...NUM, fontSize: 10, lineHeight: 1.25, color: T.inkMid }}><strong style={{ display: "block", color: T.ink, fontSize: 12, whiteSpace: "nowrap" }}>{date ? dateLabel(date) : "—"}</strong>{date ? weekDate.format(date) : ""}</div>
                <button type="button" onClick={() => onInspect(row)} aria-label={`Ver detalhes de ${row.description}`} style={{ ...G, minWidth: 0, border: 0, background: "none", textAlign: "left", padding: 0, cursor: "pointer" }}>
                  <strong style={{ display: "block", fontSize: 12, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.description}</strong>
                  <span style={{ fontSize: 10, color: T.inkMid }}>{part ? "Crédito parcelado" : row.type === "refund" ? "Estorno" : row.recurring ? "Recorrente" : "Crédito à vista"}</span>
                </button>
                <span style={{ minWidth: 0 }}><Badge bg={T.greenLight} color={T.green}>{category(row)}</Badge></span>
                <span style={{ ...NUM, color: T.ink }}>{part ? `${part.installment_number}/${part.total_installments}` : "—"}</span>
                <span style={{ ...NUM, color: T.inkMid }}>{rest == null ? "—" : rest === 0 ? "quitada" : `${rest}× ${formatMoneyAbs(part.amount, row.value_currency ?? cardCurrency) ?? ""}`}</span>
                <span style={{ ...NUM, color: T.inkMid }}>{forecastEnd(row) ?? "—"}</span>
                <span style={{ ...NUM, textAlign: "right", fontSize: 12, fontWeight: 700, color: row.type === "refund" ? T.green : T.ink }}>{amount(row, cardCurrency)}</span>
                <span style={{ color: info.color, fontWeight: 600, fontSize: 10 }}>{info.text}</span>
              </div>;
            }
            return <div key={row.id} role="listitem" style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 11, padding: rowPadding, borderBottom: `1px solid ${T.border}`, background: inspected?.id === row.id ? T.blueLight : T.surface, minWidth: 0 }}>
              <input type="checkbox" aria-label={`Selecionar ${row.description}`} checked={selected.includes(row.id)} onChange={() => onSelected(selected.includes(row.id) ? selected.filter((id) => id !== row.id) : [...selected, row.id])} />
              {!isMobile && <div style={{ ...G, ...NUM, width: 46, flex: "none", fontSize: 10, lineHeight: 1.25, color: T.inkMid, textAlign: "center" }}><strong style={{ display: "block", color: T.ink, fontSize: 12, whiteSpace: "nowrap" }}>{date ? dateLabel(date) : "—"}</strong>{date ? weekDate.format(date) : ""}</div>}
              <div aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 8, background: row.type === "refund" ? T.greenLight : T.blueLight, display: "grid", placeItems: "center", flex: "none", color: row.type === "refund" ? T.green : T.blue, fontSize: 13 }}>{row.type === "refund" ? "↩" : "▤"}</div>
              <button type="button" onClick={() => onInspect(row)} aria-label={`Ver detalhes de ${row.description}`} style={{ ...G, flex: 1, minWidth: 0, border: 0, background: "none", textAlign: "left", padding: 0, cursor: "pointer" }}>
                <strong style={{ display: "block", fontSize: 12, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.description}</strong>
                <span style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", marginTop: 2, fontSize: 10, color: T.inkMid }}><Badge bg={T.greenLight} color={T.green}>{category(row)}</Badge>{part ? `Crédito ${part.installment_number}/${part.total_installments}×` : row.recurring ? "Recorrente" : "Crédito à vista"}{isMobile && date ? ` · ${dateLabel(date)}` : ""}</span>
              </button>
              <div style={{ ...G, ...NUM, textAlign: "right", flex: "none", fontSize: 12, fontWeight: 700, color: row.type === "refund" ? T.green : T.ink }}>{amount(row, cardCurrency)}<span style={{ display: "block", fontSize: 10, fontWeight: 500, color: info.color }}>{info.text}</span></div>
              <ChevronRight size={14} color={T.inkMid} aria-hidden="true" />
            </div>;
          })}
        </div>)}
      </div>
      {rows.length === 0 && !loading && !error && <p style={{ ...G, color: T.inkMid, padding: 20, margin: 0 }}>Nenhum lançamento corresponde aos filtros.</p>}
      {loading && <p role="status" style={{ ...G, color: T.inkMid, padding: 20, margin: 0 }}>Carregando lançamentos…</p>}
      {hasMore && !loading && !error && <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />}
    </div>
    <div style={{ ...G, ...NUM, borderTop: `1px solid ${T.border}`, padding: "8px 14px", fontSize: 11, color: T.inkMid }}>
      {total == null ? `${rows.length} lançamentos carregados` : `${rows.length} de ${total} lançamentos`}
      {!hasMore && !loading && total != null && total > 0 && rows.length === total && <span style={{ marginLeft: 12 }}>Você viu todos os {total} lançamentos</span>}
      {hasMore && !loading && <button type="button" onClick={onMore} style={{ ...G, marginLeft: 12, border: 0, background: "none", color: T.blue, fontSize: 11, cursor: "pointer" }}>Carregar mais</button>}
    </div>
  </Card>;
}
