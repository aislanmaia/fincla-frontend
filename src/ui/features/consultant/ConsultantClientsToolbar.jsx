import React from "react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Icon } from "./consultantUi";
import { RISK_FILTERS, SORT_OPTIONS } from "./consultantClientsView";

/** Cor/fundo/ponto de cada filtro de risco (fiel à referência). */
const FILTER_TONE = {
  all: { color: T.ink, bg: T.ink, dot: null, activeText: "#fff" },
  healthy: { color: T.green, bg: T.greenLight, dot: T.green, activeText: T.green },
  attention: { color: T.amber, bg: T.amberLight, dot: T.amber, activeText: T.amber },
  risk: { color: T.red, bg: T.redLight, dot: T.red, activeText: T.red },
  // Sem score: neutro. Nem verde nem vermelho — não há diagnóstico.
  none: { color: T.inkGhost, bg: T.grayLight, dot: T.inkGhost, activeText: T.inkMid },
};

function FilterPill({ id, label, count, active, onClick }) {
  const tone = FILTER_TONE[id] || FILTER_TONE.all;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        ...G, display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999,
        border: `1.5px solid ${active ? tone.color : T.border}`,
        background: active ? tone.bg : T.surface,
        color: active ? tone.activeText : T.inkMid,
        fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
      }}
    >
      {tone.dot && <span style={{ width: 7, height: 7, borderRadius: 99, background: tone.dot }} />}
      {label} <span style={{ ...NUM, opacity: 0.65 }}>{count}</span>
    </button>
  );
}

const SORT_BTN = (active) => ({
  ...G, fontSize: 12, fontWeight: active ? 700 : 500, color: active ? T.ink : T.inkLight,
  background: active ? T.grayLight : "transparent", border: "none", borderRadius: 7, padding: "5px 9px", cursor: "pointer",
});

/**
 * Controles da carteira (RF.6, fiel à referência `cons-clientes.jsx`): busca por
 * nome, **pills de filtro coloridas com contadores** por faixa de risco, ordenação
 * inline (chave + direção) e alternância cartões/tabela. Puramente controlado —
 * estado na `ConsultantClientsPage`; `counts` por faixa vem da página.
 */
export function ConsultantClientsToolbar({
  query, onQueryChange,
  riskFilter, onRiskFilterChange,
  sortKey, onSortKeyChange,
  sortDir, onSortDirChange,
  view, onViewChange,
  counts = { all: 0, healthy: 0, attention: 0, risk: 0, none: 0 },
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 12px", flex: "1 1 220px", minWidth: 160 }}>
        <Icon name="search" size={14} color={T.inkMid} />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Buscar cliente…"
          aria-label="Buscar cliente"
          style={{ ...G, border: "none", outline: "none", fontSize: 13, color: T.ink, background: "transparent", flex: 1, minWidth: 0 }}
        />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }} role="group" aria-label="Filtrar por faixa de saúde">
        {RISK_FILTERS
          // "Sem score" é um estado transitório (o backend preenche o snapshot nas
          // próximas visitas): só aparece quando há alguém nele, ou quando está ativo.
          .filter((f) => f.id !== "none" || (counts.none ?? 0) > 0 || riskFilter === "none")
          .map((f) => (
            <FilterPill
              key={f.id}
              id={f.id}
              label={f.label}
              count={counts[f.id] ?? 0}
              active={riskFilter === f.id}
              onClick={() => onRiskFilterChange(f.id)}
            />
          ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
        <span style={{ ...G, fontSize: 11, color: T.inkLight }}>Ordenar:</span>
        {SORT_OPTIONS.map((o) => (
          <button key={o.id} type="button" onClick={() => onSortKeyChange(o.id)} style={SORT_BTN(sortKey === o.id)}>{o.label}</button>
        ))}
        <button
          type="button"
          onClick={() => onSortDirChange(sortDir === "asc" ? "desc" : "asc")}
          aria-label={sortDir === "asc" ? "Ordem crescente" : "Ordem decrescente"}
          title={sortDir === "asc" ? "Crescente" : "Decrescente"}
          style={{ ...G, ...NUM, fontSize: 13, fontWeight: 800, color: T.inkMid, background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: 9, padding: "6px 10px", cursor: "pointer" }}
        >
          {sortDir === "asc" ? "↑" : "↓"}
        </button>

        <div style={{ display: "inline-flex", border: `1.5px solid ${T.border}`, borderRadius: 9, overflow: "hidden" }} role="group" aria-label="Modo de visualização">
          {[
            { id: "card", label: "Cartões", glyph: "▦" },
            { id: "table", label: "Tabela", glyph: "☰" },
          ].map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onViewChange(v.id)}
              aria-pressed={view === v.id}
              aria-label={v.label}
              title={v.label}
              style={{ ...G, padding: "8px 11px", border: "none", background: view === v.id ? T.ink : "#fff", color: view === v.id ? "#fff" : T.inkMid, fontSize: 13, cursor: "pointer" }}
            >
              {v.glyph}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
