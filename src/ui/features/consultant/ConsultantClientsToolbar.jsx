import React from "react";

import { T } from "../../tokens";
import { G } from "../../typography";
import { RISK_FILTERS, SORT_OPTIONS } from "./consultantClientsView";

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        ...G,
        padding: "6px 12px",
        borderRadius: 999,
        border: `1.5px solid ${active ? T.ink : T.border}`,
        background: active ? T.ink : "transparent",
        color: active ? "#fff" : T.inkMid,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

const SELECT = {
  ...G,
  padding: "8px 10px",
  borderRadius: 9,
  border: `1.5px solid ${T.border}`,
  background: "#fff",
  color: T.ink,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

/**
 * Controles da carteira de clientes (A2.2): busca por nome, chips de filtro por
 * faixa de risco, ordenação (chave + direção) e alternância card/tabela. Puramente
 * controlado — estado mora na `ConsultantClientsPage`.
 */
export function ConsultantClientsToolbar({
  query,
  onQueryChange,
  riskFilter,
  onRiskFilterChange,
  sortKey,
  onSortKeyChange,
  sortDir,
  onSortDirChange,
  view,
  onViewChange,
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
      <input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Buscar cliente…"
        aria-label="Buscar cliente"
        style={{
          ...G,
          flex: "1 1 220px",
          minWidth: 160,
          padding: "9px 12px",
          borderRadius: 9,
          border: `1.5px solid ${T.border}`,
          background: "#fff",
          fontSize: 13,
          color: T.ink,
        }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} role="group" aria-label="Filtrar por risco">
        {RISK_FILTERS.map((f) => (
          <Chip key={f.id} active={riskFilter === f.id} onClick={() => onRiskFilterChange(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
        <label style={{ ...G, fontSize: 11.5, color: T.inkLight }} htmlFor="clients-sort">Ordenar</label>
        <select id="clients-sort" value={sortKey} onChange={(e) => onSortKeyChange(e.target.value)} aria-label="Ordenar por" style={SELECT}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onSortDirChange(sortDir === "asc" ? "desc" : "asc")}
          aria-label={sortDir === "asc" ? "Ordem crescente" : "Ordem decrescente"}
          title={sortDir === "asc" ? "Crescente" : "Decrescente"}
          style={{ ...SELECT, padding: "8px 11px", fontWeight: 800 }}
        >
          {sortDir === "asc" ? "↑" : "↓"}
        </button>

        <div style={{ display: "inline-flex", border: `1.5px solid ${T.border}`, borderRadius: 9, overflow: "hidden" }} role="group" aria-label="Modo de visualização">
          {[
            { id: "card", label: "Cards", glyph: "▦" },
            { id: "table", label: "Tabela", glyph: "☰" },
          ].map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onViewChange(v.id)}
              aria-pressed={view === v.id}
              aria-label={v.label}
              title={v.label}
              style={{
                ...G,
                padding: "8px 11px",
                border: "none",
                background: view === v.id ? T.ink : "#fff",
                color: view === v.id ? "#fff" : T.inkMid,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {v.glyph}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
