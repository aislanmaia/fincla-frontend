import { useEffect, useMemo, useRef, useState } from "react";
import { T } from "../../tokens.js";
import { G, NUM } from "../../typography.js";
import { Badge, Card } from "../../components/primitives.jsx";
import { formatMoneyAbs } from "../../money/formatMoney.js";
import { pickCategoryTagFromApiTransaction } from "../../data/transactionsAdapter.js";

const dayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" });

function dateLabel(value) {
  const date = new Date(`${String(value || "").slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "Sem data" : dayFormatter.format(date);
}
function category(row) {
  const tag = pickCategoryTagFromApiTransaction(row);
  return tag?.label || tag?.name || row.category || "Sem categoria";
}
function installment(row) {
  const first = Array.isArray(row.installment_info) && row.installment_info.length === 1 ? row.installment_info[0] : null;
  return first && first.total_installments > 1 ? first : null;
}
function amount(row, currency) {
  const code = row.value_currency ?? currency;
  return code ? formatMoneyAbs(row.value, code) ?? "—" : "—";
}
function status(row) {
  if (row.type === "refund") return { text: "Estorno", color: T.green, bg: T.greenLight };
  if (row.status === "paid") return { text: "Paga", color: T.green, bg: T.greenLight };
  if (row.status === "confirmed") return { text: "A pagar", color: T.blue, bg: T.blueLight };
  return { text: "Pendente", color: T.amber, bg: T.amberLight };
}

export function CardTransactionsTable({ rows, total, cardCurrency, loading, hasMore, error, onMore, selected, onSelected, onExportSelected, inspected, onInspect, grouped, density, isMobile }) {
  const scrollerRef = useRef(null);
  const sentinelRef = useRef(null);
  const [focusedId, setFocusedId] = useState(null);
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
  const padding = density === "compacto" ? 6 : density === "confortavel" ? 15 : 10;
  return (
    <Card as="section" aria-label="Lançamentos do cartão" style={{ minWidth: 0, overflow: "hidden", padding: 0 }}>
      {selected.length > 0 && <div style={{ ...G, padding: "10px 14px", background: T.blueLight, color: T.blue, fontSize: 12, fontWeight: 700 }}>
        {selected.length} selecionado{selected.length === 1 ? "" : "s"} <button type="button" onClick={onExportSelected} style={{ ...G, border: 0, background: "none", color: T.blue, cursor: "pointer", textDecoration: "underline" }}>Exportar seleção CSV</button> <button type="button" onClick={() => onSelected([])} style={{ ...G, border: 0, background: "none", color: T.blue, cursor: "pointer", textDecoration: "underline" }}>Limpar seleção</button>
      </div>}
      <div ref={scrollerRef} className="fincla-scroll" style={{ maxHeight: isMobile ? "min(60dvh, 680px)" : 560, overflowY: "auto", overflowX: "auto" }}>
        {!isMobile && <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
          <thead><tr style={{ background: T.surface, position: "sticky", top: 0, zIndex: 3 }}>
            <th style={thStyle}><input type="checkbox" aria-label="Selecionar lançamentos carregados" checked={allChecked} onChange={(event) => onSelected(event.target.checked ? [...new Set([...selected, ...rows.map((row) => row.id)])] : selected.filter((id) => !rows.some((row) => row.id === id)))} /></th>
            {["Data", "Descrição", "Categoria", "Parcela", "Restam", "Fim previsto", "Valor", "Status"].map((label) => <th key={label} style={thStyle}>{label}</th>)}
          </tr></thead>
          <tbody>{groups.map((group) => <FragmentGroup key={group.key} group={group} grouped={grouped} currency={cardCurrency} selected={selected} onSelected={onSelected} onInspect={onInspect} inspected={inspected} padding={padding} focusedId={focusedId} onFocused={setFocusedId} />)}</tbody>
        </table>}
        {isMobile && <div role="list" style={{ display: "flex", flexDirection: "column" }}>
          {groups.map((group) => <div key={group.key}>
            {grouped && <GroupHeader group={group} />}
            {group.rows.map((row) => {
              const part = installment(row);
              const info = status(row);
              return <div key={row.id} role="listitem" style={{ borderBottom: `1px solid ${T.border}`, background: inspected?.id === row.id ? T.blueLight : T.surface, padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" aria-label={`Selecionar ${row.description}`} checked={selected.includes(row.id)} onChange={() => onSelected(selected.includes(row.id) ? selected.filter((id) => id !== row.id) : [...selected, row.id])} />
                <button type="button" onClick={() => onInspect(row)} style={{ ...G, border: 0, background: "none", textAlign: "left", flex: 1, minWidth: 0, padding: 0, cursor: "pointer" }}>
                  <strong style={{ display: "block", fontSize: 13, color: T.ink, overflowWrap: "anywhere" }}>{row.description}</strong>
                  <span style={{ fontSize: 11, color: T.inkMid }}>{category(row)} · {dateLabel(row.date)}{part ? ` · ${part.installment_number}/${part.total_installments}` : ""}</span>
                </button>
                <div style={{ ...G, ...NUM, textAlign: "right", whiteSpace: "nowrap" }}><strong style={{ fontSize: 12, color: row.type === "refund" ? T.green : T.ink }}>{amount(row, cardCurrency)}</strong><div style={{ fontSize: 10, color: info.color }}>{info.text}</div></div>
              </div>;
            })}
          </div>)}
        </div>}
        {rows.length === 0 && !loading && !error && <p style={{ ...G, color: T.inkMid, padding: 20, margin: 0 }}>Nenhum lançamento corresponde aos filtros.</p>}
        {loading && <p role="status" style={{ ...G, color: T.inkMid, padding: 20, margin: 0 }}>Carregando lançamentos…</p>}
        {hasMore && !loading && !error && <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />}
      </div>
      <div style={{ ...G, ...NUM, borderTop: `1px solid ${T.border}`, padding: "8px 14px", fontSize: 11, color: T.inkMid }}>
        {total == null ? `${rows.length} lançamentos carregados` : `${rows.length} de ${total} lançamentos`}
        {hasMore && !loading && <button type="button" onClick={onMore} style={{ ...G, marginLeft: 12, border: 0, background: "none", color: T.blue, fontSize: 11, cursor: "pointer" }}>Carregar mais</button>}
      </div>
    </Card>
  );
}
const thStyle = { ...G, borderBottom: `1px solid ${T.ink}`, color: T.inkMid, padding: "10px 8px", textAlign: "left", textTransform: "uppercase", fontSize: 10, letterSpacing: ".05em", whiteSpace: "nowrap" };
function GroupHeader({ group }) {
  return <div style={{ ...G, ...NUM, position: "sticky", top: 34, zIndex: 2, background: T.bg, borderBottom: `1px solid ${T.border}`, padding: "8px 14px", display: "flex", justifyContent: "space-between", fontSize: 11, color: T.inkMid }}><span>{dateLabel(group.key)}</span><span>{group.rows.length} itens carregados</span></div>;
}
function FragmentGroup({ group, grouped, currency, selected, onSelected, onInspect, inspected, padding, focusedId, onFocused }) {
  return <>
    {grouped && <tr><td colSpan={9} style={{ padding: 0 }}><GroupHeader group={group} /></td></tr>}
    {group.rows.map((row) => {
      const part = installment(row);
      const info = status(row);
      return <tr key={row.id} role="button" tabIndex={0} aria-label={`Ver detalhes de ${row.description}`} style={{ background: inspected?.id === row.id ? T.blueLight : T.surface, cursor: "pointer", outline: focusedId === row.id ? `2px solid ${T.blue}` : "none", outlineOffset: -2 }} onFocus={() => onFocused(row.id)} onBlur={() => onFocused(null)} onClick={(event) => { event.currentTarget.focus(); onInspect(row); }} onKeyDown={(event) => { if (event.target !== event.currentTarget || !["Enter", " "].includes(event.key)) return; event.preventDefault(); onInspect(row); }}>
        <td style={{ ...tdStyle, padding }} onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Selecionar ${row.description}`} checked={selected.includes(row.id)} onChange={() => onSelected(selected.includes(row.id) ? selected.filter((id) => id !== row.id) : [...selected, row.id])} /></td>
        <td style={{ ...tdStyle, padding, ...NUM, whiteSpace: "nowrap" }}>{dateLabel(row.date)}</td>
        <td style={{ ...tdStyle, padding, fontWeight: 600 }}>{row.description}</td>
        <td style={{ ...tdStyle, padding }}><Badge bg={T.grayLight} color={T.inkMid}>{category(row)}</Badge></td>
        <td style={{ ...tdStyle, padding, ...NUM }}>{part ? `${part.installment_number}/${part.total_installments}` : row.recurring ? "recorrente" : "à vista"}</td>
        <td style={{ ...tdStyle, padding, ...NUM }}>{part ? `${part.total_installments - part.installment_number}×` : "—"}</td>
        <td style={{ ...tdStyle, padding, ...NUM }}>—</td>
        <td style={{ ...tdStyle, padding, ...NUM, fontWeight: 700, whiteSpace: "nowrap" }}>{amount(row, currency)}</td>
        <td style={{ ...tdStyle, padding }}><Badge bg={info.bg} color={info.color}>{info.text}</Badge></td>
      </tr>;
    })}
  </>;
}
const tdStyle = { ...G, fontSize: 12, color: T.ink, borderBottom: `1px solid ${T.border}` };
