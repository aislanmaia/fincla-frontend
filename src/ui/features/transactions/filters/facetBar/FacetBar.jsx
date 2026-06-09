import React from "react";
import { T } from "../../../../tokens";
import { G } from "../../../../typography";
import { FacetCard } from "./FacetCard.jsx";

function truncateLabel(text, max = 22) {
  const s = String(text || "").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

const saveLinkStyle = (compact) => ({
  ...G,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  padding: compact ? "11px 12px" : "0 12px",
  borderRadius: compact ? 10 : 9,
  border: compact ? `1px solid ${T.border}` : "none",
  background: compact ? T.surface : "transparent",
  fontSize: compact ? 12.5 : 11.5,
  fontWeight: 700,
  color: T.blue,
  cursor: "pointer",
  width: compact ? "100%" : undefined,
  flex: compact ? 1 : undefined,
  minWidth: 0,
  whiteSpace: compact ? "normal" : "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

/**
 * Barra/grade de facets. Estado `expanded` indica qual facet está aberta —
 * apenas uma por vez. O painel é renderizado fora da barra, inline abaixo
 * (responsabilidade do componente pai).
 */
export function FacetBar({
  facets,
  expanded,
  onToggle,
  onClearAll,
  onSaveViewCreate,
  onSaveViewUpdate,
  saveViewUpdateLabel = "",
  hasAnyActive = false,
  compact = false,
}) {
  const saveActions = [];

  if (typeof onSaveViewUpdate === "function") {
    const short = truncateLabel(saveViewUpdateLabel);
    saveActions.push(
      <button
        key="update"
        type="button"
        onClick={onSaveViewUpdate}
        aria-label={`Salvar alterações na visualização ${saveViewUpdateLabel}`}
        style={saveLinkStyle(compact)}
      >
        {compact ? "Salvar alterações" : `Atualizar “${short}”`}
      </button>,
    );
  }

  if (typeof onSaveViewCreate === "function") {
    saveActions.push(
      <button
        key="create"
        type="button"
        onClick={onSaveViewCreate}
        aria-label="Salvar como nova visualização"
        style={saveLinkStyle(compact)}
      >
        Salvar como nova visualização
      </button>,
    );
  }

  const saveButtons =
    saveActions.length > 0 ? (
      <div
        style={{
          display: "flex",
          flexDirection: compact ? "column" : "row",
          gap: compact ? 8 : 4,
          alignItems: compact ? "stretch" : "center",
          flexShrink: 0,
        }}
      >
        {saveActions}
      </div>
    ) : null;

  if (compact) {
    return (
      <div
        role="toolbar"
        aria-label="Filtros de transações"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: 10,
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          boxShadow: T.sm,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          {facets.map((f) => (
            <FacetCard
              key={f.key}
              facet={f}
              expanded={expanded === f.key}
              onClick={() => onToggle(f.key)}
              compact
            />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexDirection: "column",
          }}
        >
          {saveButtons}
          <button
            type="button"
            onClick={onClearAll}
            disabled={!hasAnyActive}
            aria-label="Limpar todos os filtros"
            style={{
              ...G,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "11px 12px",
              borderRadius: 10,
              border: `1px solid ${hasAnyActive ? T.redLight : T.border}`,
              background: hasAnyActive ? T.redLight : "transparent",
              fontSize: 12.5,
              fontWeight: 700,
              color: hasAnyActive ? T.red : T.inkGhost,
              cursor: hasAnyActive ? "pointer" : "not-allowed",
              opacity: hasAnyActive ? 1 : 0.55,
              width: "100%",
            }}
          >
            Limpar tudo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="toolbar"
      aria-label="Filtros de transações"
      style={{
        display: "flex",
        gap: 8,
        padding: 6,
        alignItems: "stretch",
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        boxShadow: T.sm,
        position: "relative",
        flexWrap: "wrap",
      }}
    >
      {facets.map((f) => (
        <FacetCard
          key={f.key}
          facet={f}
          expanded={expanded === f.key}
          onClick={() => onToggle(f.key)}
        />
      ))}
      <div style={{ flex: 1 }} />
      <div style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {saveButtons}
        <button
          type="button"
          onClick={onClearAll}
          disabled={!hasAnyActive}
          aria-label="Limpar todos os filtros"
          style={{
            ...G,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "0 12px",
            borderRadius: 9,
            border: "none",
            background: "transparent",
            fontSize: 11.5,
            fontWeight: 700,
            color: hasAnyActive ? T.red : T.inkGhost,
            cursor: hasAnyActive ? "pointer" : "not-allowed",
            opacity: hasAnyActive ? 1 : 0.6,
          }}
        >
          Limpar tudo
        </button>
      </div>
    </div>
  );
}
