import { useEffect, useRef } from "react";
import { ArrowLeft, ChevronRight, Download, Filter, PieChart, Search, Sparkles, X } from "lucide-react";

import { formatMoneyAbs } from "../../money/formatMoney.js";
import { T } from "../../tokens.js";
import { G, NUM } from "../../typography.js";

const iconButton = { width: 44, height: 44, flex: "none", border: 0, padding: 0, borderRadius: 12, background: "none", color: T.ink, display: "grid", placeItems: "center", cursor: "pointer", position: "relative" };
const barStyle = { ...G, height: 56, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 2, padding: "0 8px 0 4px", background: T.surface, borderBottom: `1px solid ${T.border}` };

function Count({ children, color = T.amber }) {
  return <span aria-hidden="true" style={{ ...NUM, position: "absolute", top: 5, right: 4, minWidth: 18, height: 18, boxSizing: "border-box", padding: "0 4px", display: "grid", placeItems: "center", background: color, color: "#fff", border: "2px solid #fff", borderRadius: 99, fontSize: 10, fontWeight: 700 }}>{children}</span>;
}

/** Barra de app da tela de Lançamentos no celular: voltar, título e ações em ícones; a busca ocupa a barra inteira. */
export function LedgerAppBar({ subtitle, onBack, hasCard, searchOpen, onSearchOpen, onSearchClose, search, onSearchChange, facetCount, onFilters, filtersOpen, alertCount, onAssistant, onExport, exportDisabled }) {
  const inputRef = useRef(null);
  useEffect(() => { if (searchOpen) inputRef.current?.focus(); }, [searchOpen]);
  if (searchOpen) {
    return <div style={barStyle}>
      <button type="button" aria-label="Fechar busca" onClick={onSearchClose} style={iconButton}><ArrowLeft size={20} /></button>
      <label style={{ flex: 1, minWidth: 0, height: 40, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 8, marginRight: 8, padding: "0 6px 0 12px", background: T.surface, border: `1px solid ${T.blue}`, boxShadow: `0 0 0 3px ${T.blueLight}`, borderRadius: 12 }}>
        <Search size={16} color={T.blue} aria-hidden="true" />
        <input ref={inputRef} aria-label="Buscar lançamentos" placeholder="Buscar por descrição…" enterKeyHint="search" value={search} onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") { event.preventDefault(); onSearchClose(); } }}
          style={{ ...G, flex: 1, minWidth: 0, border: 0, outline: "none", background: "transparent", fontSize: 16 }} />
        {search && <button type="button" aria-label="Limpar busca" onClick={() => { onSearchChange(""); inputRef.current?.focus(); }} style={{ ...iconButton, width: 32, height: 32, borderRadius: 99 }}><X size={16} /></button>}
      </label>
    </div>;
  }
  const searching = Boolean(search);
  return <div style={barStyle}>
    <button type="button" aria-label="Voltar para o cartão" onClick={onBack} style={iconButton}><ArrowLeft size={20} /></button>
    <div style={{ flex: 1, minWidth: 0 }}>
      <h1 style={{ ...G, margin: 0, fontSize: 17, lineHeight: 1.2, fontWeight: 700, letterSpacing: "-.2px" }}>Lançamentos</h1>
      {subtitle && <span style={{ ...G, ...NUM, display: "block", fontSize: 11, color: T.inkGhost, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</span>}
    </div>
    {hasCard && <>
      <button type="button" aria-label={searching ? "Buscar lançamentos, busca ativa" : "Buscar lançamentos"} onClick={onSearchOpen} style={{ ...iconButton, background: searching ? T.ink : "none", color: searching ? "#fff" : T.ink }}><Search size={20} />{searching && <span aria-hidden="true" style={{ position: "absolute", top: 8, right: 8, width: 9, height: 9, borderRadius: 99, background: T.blueBar, border: `2px solid ${T.ink}` }} />}</button>
      <button type="button" aria-label={`Filtros${facetCount ? ` (${facetCount})` : ""}`} aria-pressed={filtersOpen} onClick={onFilters} style={iconButton}><Filter size={20} />{facetCount > 0 && <Count color={T.blue}>{facetCount}</Count>}</button>
      <button type="button" aria-label={alertCount ? `Assistente, ${alertCount} ${alertCount === 1 ? "alerta" : "alertas"}` : "Assistente"} onClick={onAssistant} style={iconButton}><Sparkles size={20} />{alertCount > 0 && <Count>{alertCount}</Count>}</button>
      <button type="button" aria-label="Exportar" disabled={exportDisabled} onClick={onExport} style={{ ...iconButton, opacity: exportDisabled ? 0.4 : 1, cursor: exportDisabled ? "default" : "pointer" }}><Download size={20} /></button>
    </>}
  </div>;
}

/** Faixa fina, só quando há alerta: diz o que é e leva ao Assistente. */
export function LedgerAlertStrip({ label, summary, onOpen }) {
  return <button type="button" onClick={onOpen} aria-label={`${label} para revisar`} style={{ ...G, display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 40, boxSizing: "border-box", padding: "0 16px", border: 0, borderBottom: `1px solid ${T.amberBorder}`, background: T.amberLight, color: T.ink, textAlign: "left", cursor: "pointer", fontSize: 12.5 }}>
    <Sparkles size={16} color={T.amber} style={{ flex: "none" }} aria-hidden="true" />
    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><strong>{label}</strong> · {summary}</span>
    <span style={{ flex: "none", display: "inline-flex", alignItems: "center", color: T.amber, fontWeight: 700 }}>Revisar <ChevronRight size={16} aria-hidden="true" /></span>
  </button>;
}

/** Resumo do recorte em uma linha; toca para abrir o sheet com gráficos. */
export function LedgerSummaryRow({ summary, loading, error, onOpen }) {
  const totals = (summary?.by_currency ?? []).filter((row) => row?.currency && row.amount != null && row.amount !== "" && Number.isFinite(Number(row.amount)));
  const count = summary ? `${summary.total_transactions} lançamento${summary.total_transactions === 1 ? "" : "s"}` : null;
  const headline = totals.length === 1 ? formatMoneyAbs(totals[0].amount, totals[0].currency) : count;
  const sub = totals.length === 1 ? count : loading ? "Carregando resumo…" : error ? "Resumo indisponível" : totals.length > 1 ? "mais de uma moeda" : null;
  return <button type="button" onClick={onOpen} aria-label="Resumo e saídas do recorte" style={{ ...G, display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 56, boxSizing: "border-box", padding: "0 16px", border: 0, borderBottom: `1px solid ${T.border}`, background: T.surface, color: T.ink, textAlign: "left", cursor: "pointer" }}>
    <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 99, background: T.blueLight, color: T.blue, display: "grid", placeItems: "center", flex: "none" }}><PieChart size={18} /></span>
    <span style={{ flex: 1, minWidth: 0 }}>
      <strong style={{ ...NUM, display: "block", fontSize: 16 }}>{headline ?? "Resumo do recorte"}</strong>
      {sub && <span style={{ display: "block", fontSize: 11, color: T.inkGhost }}>{sub}</span>}
    </span>
    <span style={{ flex: "none", display: "inline-flex", alignItems: "center", color: T.blue, fontWeight: 600, fontSize: 12.5 }}>Gráficos <ChevronRight size={16} aria-hidden="true" /></span>
  </button>;
}

/** Busca sem resultado: diz o que foi buscado e oferece limpar. */
export function LedgerSearchEmpty({ query, onClear }) {
  return <div role="status" style={{ ...G, padding: "48px 32px", textAlign: "center", background: T.surface, borderTop: `1px solid ${T.border}` }}>
    <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: 99, background: T.grayLight, color: T.inkGhost, display: "inline-grid", placeItems: "center", marginBottom: 14 }}><Search size={26} /></span>
    <strong style={{ display: "block", fontSize: 16 }}>Nada com “{query}”</strong>
    <p style={{ margin: "6px 0 18px", fontSize: 13, color: T.inkGhost }}>Nenhum lançamento deste recorte tem esse texto.</p>
    <button type="button" onClick={onClear} style={{ ...G, height: 40, padding: "0 18px", border: `1px solid ${T.ink}`, borderRadius: 99, background: T.surface, color: T.ink, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Limpar busca</button>
  </div>;
}
