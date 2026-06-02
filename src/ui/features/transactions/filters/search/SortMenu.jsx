import React from "react";
import { T } from "../../../../tokens";
import { G } from "../../../../typography";
import { Icon } from "../shared/Icon.jsx";
import {
  DEFAULT_DIR,
  DEFAULT_SORT,
  SORT_FIELDS,
  addRule,
  availableFields,
  isDefaultSort,
  moveRule,
  removeRule,
  toggleDir,
} from "./sortModel.js";

/**
 * Popover de edição da ordenação multi-nível.
 * `sort` é o array de regras `[{ field, dir }]` controlado externamente.
 */
export function SortMenu({ sort, setSort, onClose, compact = false }) {
  const inactive = availableFields(sort);
  const isDefault = isDefaultSort(sort);

  const resetDefault = () => setSort(DEFAULT_SORT);

  const popoverStyle = compact
    ? {
        position: "relative",
        width: "100%",
        marginTop: 8,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        boxShadow: T.md,
        padding: 8,
        animation: "fadeInDown 0.14s ease",
      }
    : {
        position: "absolute",
        top: "calc(100% + 6px)",
        right: 0,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        boxShadow: T.lg,
        width: 384,
        padding: 6,
        zIndex: 80,
        animation: "fadeInDown 0.14s ease",
      };

  return (
    <div
      role="dialog"
      aria-label="Editor de ordenação"
      onClick={(e) => e.stopPropagation()}
      style={popoverStyle}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 8px 8px",
        }}
      >
        <div
          style={{
            ...G,
            fontSize: 10,
            fontWeight: 700,
            color: T.inkMid,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Icon name="arrow-up-down" size={11} />
          Ordenar por
          <span
            style={{
              ...G,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 16,
              height: 16,
              padding: "0 5px",
              borderRadius: 99,
              background: T.bg,
              color: T.inkMid,
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: 0,
            }}
          >
            {sort.length === 0
              ? "Nenhum"
              : sort.length === 1
              ? "1 nível"
              : `${sort.length} níveis`}
          </span>
        </div>
        {!isDefault && (
          <button
            type="button"
            onClick={resetDefault}
            title="Restaurar ordenação padrão"
            style={{
              ...G,
              padding: "3px 7px",
              borderRadius: 6,
              border: "none",
              background: "transparent",
              fontSize: 10.5,
              fontWeight: 600,
              color: T.inkLight,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Resetar
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 2px 2px" }}>
        {sort.map((rule, i) => {
          const f = SORT_FIELDS[rule.field];
          if (!f) return null;
          return (
            <div
              key={rule.field}
              data-testid={`sort-rule-${rule.field}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 6px 6px 8px",
                borderRadius: 8,
                background: T.bg,
                border: `1px solid ${T.border}`,
              }}
            >
              <div
                style={{
                  ...G,
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  background: T.ink,
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
                aria-label={i === 0 ? "Critério principal" : `Critério ${i + 1}`}
              >
                {i + 1}
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <Icon name={f.icon} size={12} color={T.inkMid} />
                <span
                  style={{
                    ...G,
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: T.ink,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {f.label}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSort(toggleDir(sort, i))}
                aria-label={`Inverter direção de ${f.label}`}
                title="Inverter direção"
                style={{
                  ...G,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: `1px solid ${T.border}`,
                  background: T.surface,
                  color: T.inkMid,
                  fontSize: 10.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  letterSpacing: "0.01em",
                  whiteSpace: "nowrap",
                }}
              >
                {f.dirLabels[rule.dir]}
                <span style={{ fontWeight: 800, color: T.ink, marginLeft: 1 }}>
                  {rule.dir === "asc" ? "↑" : "↓"}
                </span>
              </button>

              {sort.length > 1 && (
                <div style={{ display: "inline-flex", flexDirection: "column", gap: 0 }}>
                  <button
                    type="button"
                    onClick={() => setSort(moveRule(sort, i, -1))}
                    disabled={i === 0}
                    aria-label={`Subir prioridade de ${f.label}`}
                    style={moveBtnStyle(i === 0)}
                  >
                    <svg width="9" height="6" viewBox="0 0 12 8" fill="none" aria-hidden="true">
                      <path
                        d="M2 6 L6 2 L10 6"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSort(moveRule(sort, i, +1))}
                    disabled={i === sort.length - 1}
                    aria-label={`Descer prioridade de ${f.label}`}
                    style={moveBtnStyle(i === sort.length - 1)}
                  >
                    <svg width="9" height="6" viewBox="0 0 12 8" fill="none" aria-hidden="true">
                      <path
                        d="M2 2 L6 6 L10 2"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setSort(removeRule(sort, i))}
                aria-label={`Remover ${f.label}`}
                style={{
                  ...G,
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: "none",
                  background: "transparent",
                  color: T.inkLight,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="x" size={11} />
              </button>
            </div>
          );
        })}

        {sort.length > 0 && inactive.length > 0 && (
          <div
            style={{
              ...G,
              fontSize: 9.5,
              fontWeight: 600,
              color: T.inkLight,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              padding: "8px 8px 2px",
            }}
          >
            Disponíveis · clique para adicionar
          </div>
        )}

        {inactive.map((field) => {
          const f = SORT_FIELDS[field];
          const defaultDir = DEFAULT_DIR[field];
          return (
            <button
              type="button"
              key={field}
              onClick={() => setSort(addRule(sort, field))}
              aria-label={`Adicionar ${f.label}`}
              style={{
                ...G,
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 6px 6px 8px",
                borderRadius: 8,
                background: "transparent",
                border: `1px dashed ${T.border}`,
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.12s, border-color 0.12s",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  color: T.inkLight,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name="plus" size={10} />
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <Icon name={f.icon} size={12} color={T.inkLight} />
                <span
                  style={{
                    ...G,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: T.inkMid,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {f.label}
                </span>
              </div>
              <span
                style={{
                  ...G,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 8px",
                  borderRadius: 6,
                  fontSize: 10.5,
                  fontWeight: 500,
                  color: T.inkLight,
                  fontStyle: "italic",
                  whiteSpace: "nowrap",
                }}
              >
                {f.dirLabels[defaultDir]}
                <span style={{ fontWeight: 700, marginLeft: 1, fontStyle: "normal" }}>
                  {defaultDir === "asc" ? "↑" : "↓"}
                </span>
              </span>
            </button>
          );
        })}

        {sort.length === 0 && inactive.length === 0 && (
          <div
            style={{
              ...G,
              fontSize: 11.5,
              color: T.inkGhost,
              padding: "16px 12px",
              textAlign: "center",
              fontStyle: "italic",
            }}
          >
            Sem campos disponíveis.
          </div>
        )}
      </div>
    </div>
  );
}

function moveBtnStyle(disabled) {
  return {
    width: 14,
    height: 11,
    padding: 0,
    border: "none",
    background: "transparent",
    color: disabled ? "#9CA3AF" : "#4B5563",
    cursor: disabled ? "default" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
