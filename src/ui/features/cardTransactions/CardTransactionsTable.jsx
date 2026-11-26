import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { T } from "../../tokens.js";
import { G, NUM } from "../../typography.js";
import { Badge, Card } from "../../components/primitives.jsx";
import { formatMoneyAbs } from "../../money/formatMoney.js";
import { pickCategoryTagFromApiTransaction } from "../../data/transactionsAdapter.js";
import { dayKey, forecastEnd, groupSubtotal, installmentOf, remainingInstallments, statusInfo } from "./ledgerModel.js";
import { plural } from "../../plural.js";
import { BulkActionsToolbar, RowCheckbox, SelectionCount, bulkButton } from "../selection/BulkSelection.jsx";
import { fmtCount } from "../../formatters.js";
import { QuickAction } from "../transactions/shared/TransactionRow.jsx";

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
const TONES = { green: [T.green, T.greenLight], blue: [T.blue, T.blueLight], amber: [T.amber, T.amberLight], gray: [T.inkMid, T.grayLight] };
function status(row) {
  const { text, tone } = statusInfo(row);
  return { text, color: TONES[tone][0], bg: TONES[tone][1] };
}

/** Cabeçalho do dia: sticky; quando a lista permite, vira botão que recolhe/expande os lançamentos do dia. */
function DayHeader({ label, count, subtotal, collapsible, collapsed, selectedCount, onToggle, isMobile }) {
  const style = { ...G, ...NUM, position: "sticky", top: isMobile ? 0 : COLUMN_HEADER_HEIGHT, zIndex: 2, display: "flex", alignItems: "center", gap: 8, width: "100%", boxSizing: "border-box", minHeight: isMobile ? 44 : 32, margin: 0, background: T.bg, border: 0, borderBottom: `1px solid ${T.border}`, padding: isMobile ? "0 16px" : "0 14px", fontSize: 11, color: T.inkMid, textAlign: "left" };
  const content = <>
    {collapsible && <ChevronDown size={16} aria-hidden="true" style={{ flex: "none", transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform .15s" }} />}
    <span>{label} · {fmtCount(count)} {count === 1 ? "item" : "itens"}</span>
    {collapsed && selectedCount > 0 && <span style={{ color: T.blue, fontWeight: 700 }}>{fmtCount(selectedCount)} selecionado{selectedCount === 1 ? "" : "s"}</span>}
    {subtotal && <strong style={{ marginLeft: "auto", color: T.ink }}>{subtotal}</strong>}
  </>;
  return collapsible
    ? <button type="button" aria-expanded={!collapsed} onClick={onToggle} style={{ ...style, cursor: "pointer" }}>{content}</button>
    : <div style={style}>{content}</div>;
}

// O cabeçalho do dia gruda logo abaixo do cabeçalho de colunas (desktop), senão ele ficaria coberto e sem clique.
const COLUMN_HEADER_HEIGHT = 30;
/* A grade se ajusta à largura MEDIDA da lista (a dock de filtros e o painel de detalhe a estreitam), com uma ordem de
   sacrifício como a de /transactions: Valor e Status nunca saem da tela.
   - Com ações rápidas há o VÃO de /transactions (TransactionRow): uma coluna vazia logo antes do valor, onde o grupo
     aparece no hover ancorado à borda direita dela. Com folga (>= 1050 px) ele tem piso de 156 px e os botões abrem o
     rótulo; abaixo disso o piso cede e fica só o ícone.
   - Abaixo de 820 px saem "Restam" e "Fim previsto" — o painel de detalhe mostra os dois.
   - Descrição e categoria encolhem com reticências (a categoria tem piso de 72 px). */
export const ROOMY_LIST_WIDTH = 1050;
export const COMPACT_LIST_WIDTH = 820;
export function ledgerGrid({ width, actions }) {
  const compact = width < COMPACT_LIST_WIDTH;
  const roomy = width >= ROOMY_LIST_WIDTH;
  const tracks = ["22px", "58px", roomy ? "minmax(140px,2.2fr)" : "minmax(0,2.2fr)", roomy ? "minmax(124px,1fr)" : "minmax(72px,1fr)", "62px",
    ...(compact ? [] : ["96px", "92px"]), ...(actions ? [roomy ? "minmax(156px,1fr)" : "minmax(0,1fr)"] : []), "92px", "86px"];
  return { columns: tracks.join(" "), compact, labels: Boolean(actions) && roomy };
}


export function CardTransactionsTable({ rows, total, cardCurrency, loading, hasMore, error, onMore, selected, onSelected, onExportSelected, selectionSum, onCategorize, onMoveInstallment, inspected, onInspect, onEdit = null, onDelete = null, grouped, density, isMobile, maxHeight, collapsible = false, collapsedKeys, onToggleGroup }) {
  const scrollerRef = useRef(null);
  const sentinelRef = useRef(null);
  const hasActions = Boolean(onEdit || onDelete);
  // A LISTA medida, não a viewport (a dock de filtros a estreita). Sem ResizeObserver (jsdom), cai no limiar de viewport.
  const [listWidth, setListWidth] = useState(() => (typeof window === "undefined" ? 0 : window.innerWidth - 260));
  useEffect(() => {
    const node = scrollerRef.current;
    if (!node || isMobile || typeof ResizeObserver !== "function") return undefined;
    const observer = new ResizeObserver(([entry]) => setListWidth(Math.round(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, [isMobile]);
  const grid = ledgerGrid({ width: listWidth, actions: hasActions });
  const { columns, compact } = grid;
  const showActionLabels = !isMobile && grid.labels;
  const groups = useMemo(() => {
    if (!grouped) return [{ key: "all", rows }];
    const result = [];
    for (const row of rows) {
      const key = dayKey(row);
      if (result.at(-1)?.key !== key) result.push({ key, rows: [] });
      result.at(-1).rows.push(row);
    }
    return result;
  }, [grouped, rows]);
  // Tudo recolhido deixa a lista curta e o sentinela sempre à vista: sem esta pausa a rolagem infinita puxaria todas as páginas sozinha.
  const allCollapsed = Boolean(grouped && collapsible && groups.length > 0 && groups.every((group) => collapsedKeys?.has(group.key)));
  useEffect(() => {
    if (!hasMore || loading || error || allCollapsed || !sentinelRef.current || !scrollerRef.current || typeof IntersectionObserver !== "function") return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) onMore();
    }, { root: scrollerRef.current, rootMargin: "0px 0px 160px 0px" });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, error, allCollapsed, onMore, rows.length]);
  const hiddenSelected = !(grouped && collapsible) ? 0 : groups.reduce((sum, group) => sum + (collapsedKeys?.has(group.key) ? group.rows.filter((row) => selected.includes(row.id)).length : 0), 0);
  const allChecked = rows.length > 0 && rows.every((row) => selected.includes(row.id));
  const rowPadding = density === "compacto" ? "7px 12px" : density === "confortavel" ? "15px 12px" : "10px 12px";
  return <Card as="section" aria-label="Lançamentos do cartão" style={{ minWidth: 0, overflow: "hidden", padding: 0, width: "100%", ...(isMobile ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", border: 0, borderRadius: 0, boxShadow: "none", background: T.surface } : {}) }}>
    <div style={{ ...G, display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px 10px", padding: isMobile ? "11px 16px" : "11px 14px", borderBottom: `1px solid ${T.border}`, borderTop: isMobile ? `1px solid ${T.border}` : undefined, fontSize: isMobile ? 12.5 : 12, fontWeight: 700 }}>
      <RowCheckbox aria-label="Selecionar lançamentos carregados" checked={allChecked} onChange={(event) => onSelected(event.target.checked ? [...new Set([...selected, ...rows.map((row) => row.id)])] : selected.filter((id) => !rows.some((row) => row.id === id)))} />
      <span data-testid="ledger-count">{plural(total == null ? rows.length : total, "lançamento", "lançamentos")}</span>
      <SelectionCount count={selected.length} extra={[selectionSum, hiddenSelected > 0 ? `${fmtCount(hiddenSelected)} em dias recolhidos` : null].filter(Boolean).join(" · ") || null} />
      {selected.length > 0 && <BulkActionsToolbar onClear={() => onSelected([])}>
        {onCategorize && <button type="button" onClick={onCategorize} style={bulkButton}>Categorizar</button>}
        {onMoveInstallment && <button type="button" onClick={onMoveInstallment} style={bulkButton}>Mover parcela</button>}
        <button type="button" onClick={onExportSelected} style={bulkButton}>Exportar seleção</button>
      </BulkActionsToolbar>}
    </div>
    <div ref={scrollerRef} className="fincla-scroll" style={{ ...(isMobile ? { flex: 1, minHeight: 0 } : { maxHeight: maxHeight == null ? 560 : Math.max(100, maxHeight - 82) }), overflowY: "auto", overflowX: "hidden" }}>
      {!isMobile && <div aria-hidden="true" style={{ ...G, display: "grid", gridTemplateColumns: columns, gap: 10, padding: "0 12px", height: COLUMN_HEADER_HEIGHT, boxSizing: "border-box", alignItems: "center", borderBottom: `1px solid ${T.border}`, background: T.bg, fontSize: 11, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 3 }}><span /><span>Data</span><span>Descrição</span><span>Categoria</span><span>Parcela</span>{!compact && <><span>Restam</span><span>Fim previsto</span></>}{hasActions && <span />}<span style={{ textAlign: "right" }}>Valor</span><span>Status</span></div>}
      <div role="list">
        {groups.map((group) => <div key={group.key}>
          {grouped && (() => {
            const sub = groupSubtotal(group.rows, cardCurrency);
            const collapsed = collapsible && Boolean(collapsedKeys?.has(group.key));
            return <DayHeader label={parsedDate(group.key) ? dateLabel(parsedDate(group.key)) : "Sem data"} count={group.rows.length} subtotal={sub ? formatMoneyAbs(sub.amount, sub.currency) : null} collapsible={collapsible} collapsed={collapsed} selectedCount={group.rows.filter((row) => selected.includes(row.id)).length} onToggle={() => onToggleGroup?.(group.key)} isMobile={isMobile} />;
          })()}
          {!(grouped && collapsible && collapsedKeys?.has(group.key)) && group.rows.map((row) => {
            const date = parsedDate(row.date);
            const part = installmentOf(row);
            const info = status(row);
            if (!isMobile) {
              const rest = remainingInstallments(row);
              return <div key={row.id} role="listitem" className={hasActions ? (inspected?.id === row.id ? "fincla-row fincla-row-on" : "fincla-row") : undefined} style={{ display: "grid", gridTemplateColumns: columns, gap: 10, alignItems: "center", padding: rowPadding, borderBottom: `1px solid ${T.border}`, background: inspected?.id === row.id ? T.blueLight : T.surface, minWidth: 0, ...G, fontSize: 11 }}>
                <RowCheckbox aria-label={`Selecionar ${row.description}`} checked={selected.includes(row.id)} onChange={() => onSelected(selected.includes(row.id) ? selected.filter((id) => id !== row.id) : [...selected, row.id])} />
                <div style={{ ...NUM, fontSize: 11, lineHeight: 1.25, color: T.inkMid }}><strong style={{ display: "block", color: T.ink, fontSize: 12, whiteSpace: "nowrap" }}>{date ? dateLabel(date) : "—"}</strong>{date ? weekDate.format(date) : ""}</div>
                <button type="button" onClick={() => onInspect(row)} aria-label={`Ver detalhes de ${row.description}`} style={{ ...G, minWidth: 0, border: 0, background: "none", textAlign: "left", padding: 0, cursor: "pointer" }}>
                  <strong style={{ display: "block", fontSize: 12, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.description}</strong>
                  <span style={{ fontSize: 11, color: T.inkMid }}>{part ? "Crédito parcelado" : row.type === "refund" ? "Estorno" : row.recurring ? "Recorrente" : "Crédito à vista"}</span>
                </button>
                {/* A pílula cabe na coluna (reticências e o nome inteiro no title): transbordando, ela invadia a Parcela. */}
                <span style={{ minWidth: 0 }}><span title={category(row)} style={{ display: "block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Badge bg={T.greenLight} color={T.green}>{category(row)}</Badge></span></span>
                <span style={{ ...NUM, color: T.ink }}>{part ? `${part.installment_number}/${part.total_installments}` : "—"}</span>
                {!compact && <span style={{ ...NUM, color: T.inkMid }}>{rest == null ? "—" : rest === 0 ? "quitada" : `${rest}× ${formatMoneyAbs(part.amount, row.value_currency ?? cardCurrency) ?? ""}`}</span>}
                {!compact && <span style={{ ...NUM, color: T.inkMid }}>{forecastEnd(row) ?? "—"}</span>}
                {/* O vão das ações rápidas, como em /transactions: no hover (ou foco) o grupo aparece colado ao valor. */}
                {hasActions && <span style={{ position: "relative", minWidth: 0, alignSelf: "stretch" }}>
                  <div className="fincla-quick">
                    {onEdit && <QuickAction label={`Editar ${row.description}`} text="Editar" showText={showActionLabels} onClick={(event) => { event.stopPropagation(); onEdit(row); }}>✎</QuickAction>}
                    {onDelete && <QuickAction label={`Excluir ${row.description}`} text="Excluir" tone="red" showText={showActionLabels} onClick={(event) => { event.stopPropagation(); onDelete(row); }}>🗑</QuickAction>}
                  </div>
                </span>}
                <span style={{ ...NUM, textAlign: "right", fontSize: 12, fontWeight: 700, color: row.type === "refund" ? T.green : T.ink }}>{amount(row, cardCurrency)}</span>
                <span style={{ color: info.color, fontWeight: 600, fontSize: 11 }}>{info.text}</span>
              </div>;
            }
            return <div key={row.id} role="listitem" style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 11, padding: rowPadding, borderBottom: `1px solid ${T.border}`, background: inspected?.id === row.id ? T.blueLight : T.surface, minWidth: 0 }}>
              <RowCheckbox aria-label={`Selecionar ${row.description}`} checked={selected.includes(row.id)} onChange={() => onSelected(selected.includes(row.id) ? selected.filter((id) => id !== row.id) : [...selected, row.id])} />
              {!isMobile && <div style={{ ...G, ...NUM, width: 46, flex: "none", fontSize: 11, lineHeight: 1.25, color: T.inkMid, textAlign: "center" }}><strong style={{ display: "block", color: T.ink, fontSize: 12, whiteSpace: "nowrap" }}>{date ? dateLabel(date) : "—"}</strong>{date ? weekDate.format(date) : ""}</div>}
              <div aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 8, background: row.type === "refund" ? T.greenLight : T.blueLight, display: "grid", placeItems: "center", flex: "none", color: row.type === "refund" ? T.green : T.blue, fontSize: 13 }}>{row.type === "refund" ? "↩" : "▤"}</div>
              <button type="button" onClick={() => onInspect(row)} aria-label={`Ver detalhes de ${row.description}`} style={{ ...G, flex: 1, minWidth: 0, border: 0, background: "none", textAlign: "left", padding: 0, cursor: "pointer" }}>
                <strong style={{ display: "block", fontSize: 12, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.description}</strong>
                <span style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", marginTop: 2, fontSize: 11, color: T.inkMid }}><Badge bg={T.greenLight} color={T.green}>{category(row)}</Badge>{part ? `Crédito ${part.installment_number}/${part.total_installments}×` : row.recurring ? "Recorrente" : "Crédito à vista"}{isMobile && date ? ` · ${dateLabel(date)}` : ""}</span>
              </button>
              <div style={{ ...G, ...NUM, textAlign: "right", flex: "none", fontSize: 12, fontWeight: 700, color: row.type === "refund" ? T.green : T.ink }}>{amount(row, cardCurrency)}<span style={{ display: "block", fontSize: 11, fontWeight: 500, color: info.color }}>{info.text}</span></div>
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
      <span data-testid="ledger-footer-count">{total == null ? plural(rows.length, "lançamento carregado", "lançamentos carregados") : `${rows.length} de ${plural(total, "lançamento", "lançamentos")}`}</span>
      {!hasMore && !loading && total != null && total > 1 && rows.length === total && <span style={{ marginLeft: 12 }}>Você viu todos os {plural(total, "lançamento", "lançamentos")}</span>}
      {hasMore && !loading && <button type="button" onClick={onMore} style={{ ...G, marginLeft: 12, border: 0, background: "none", color: T.blue, fontSize: 11, cursor: "pointer" }}>Carregar mais</button>}
    </div>
  </Card>;
}
