import React from "react";
import { T } from "../../../../tokens";
import { G } from "../../../../typography";
import { FacetCard } from "./FacetCard.jsx";

const saveLinkStyle = (compact, footer = false) => ({
  ...G,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  padding: compact || footer ? "8px 12px" : "0 12px",
  borderRadius: compact || footer ? 9 : 9,
  border: compact || footer ? `1px solid ${T.border}` : "none",
  background: compact || footer ? T.surface : "transparent",
  fontSize: compact ? 12.5 : 12,
  fontWeight: 700,
  color: T.blue,
  cursor: "pointer",
  width: compact ? "100%" : undefined,
  flex: compact ? 1 : undefined,
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const clearButtonStyle = (compact, hasAnyActive) => ({
  ...G,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: compact ? "11px 12px" : "8px 12px",
  borderRadius: compact ? 10 : 9,
  border: compact || hasAnyActive ? `1px solid ${hasAnyActive ? T.redLight : T.border}` : "none",
  background: compact && hasAnyActive ? T.redLight : "transparent",
  fontSize: compact ? 12.5 : 12,
  fontWeight: 700,
  color: hasAnyActive ? T.red : T.inkGhost,
  cursor: hasAnyActive ? "pointer" : "not-allowed",
  opacity: hasAnyActive ? 1 : compact ? 0.55 : 0.6,
  width: compact ? "100%" : undefined,
  flexShrink: 0,
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
    saveActions.push(
      <button
        key="update"
        type="button"
        onClick={onSaveViewUpdate}
        aria-label={`Salvar alterações na visualização ${saveViewUpdateLabel}`}
        style={saveLinkStyle(compact, !compact)}
      >
        Salvar alterações
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
        style={saveLinkStyle(compact, !compact)}
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
          gap: compact ? 8 : 8,
          alignItems: compact ? "stretch" : "center",
          flexShrink: 0,
          minWidth: 0,
        }}
      >
        {saveActions}
      </div>
    ) : null;

  const clearButton = (
    <button
      type="button"
      onClick={onClearAll}
      disabled={!hasAnyActive}
      aria-label="Limpar todos os filtros"
      style={clearButtonStyle(compact, hasAnyActive)}
    >
      Limpar tudo
    </button>
  );

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
          {clearButton}
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
        flexDirection: "column",
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        boxShadow: T.sm,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: 6,
          alignItems: "stretch",
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
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "6px 10px 8px",
          borderTop: `1px solid ${T.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
          {saveButtons}
        </div>
        {clearButton}
      </div>
    </div>
  );
}
