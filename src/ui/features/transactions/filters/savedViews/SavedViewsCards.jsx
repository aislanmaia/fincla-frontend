import React, { useState } from "react";
import { T } from "../../../../tokens";
import { G } from "../../../../typography";
import { Icon } from "../shared/Icon.jsx";
import { PopoverShell } from "../shared/PopoverShell.jsx";
import { DeleteViewControl, DeleteViewStyles } from "./DeleteViewControl.jsx";
import { NewViewForm } from "./NewViewForm.jsx";

/**
 * Tira de saved views como cards + botão "+ Nova" que abre o NewViewForm.
 *
 * Modo `compact`: cards stackeiam verticalmente (1 por linha), o botão Nova
 * ocupa a largura toda e o popover do NewViewForm renderiza inline abaixo
 * (não absoluto). Visual de app nativo num bottom sheet.
 */
export function SavedViewsCards({
  items,
  active,
  onActivate,
  onDelete,
  onCreate,
  activeFacets = [],
  compact = false,
}) {
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div>
      <DeleteViewStyles />
      <div
        style={{
          ...G,
          fontSize: 10,
          fontWeight: 700,
          color: T.inkMid,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Icon name="bookmark" size={11} />
        Visualizações salvas
      </div>
      <div
        role="list"
        aria-label="Visualizações salvas"
        style={{
          display: compact ? "grid" : "flex",
          gridTemplateColumns: compact ? "1fr" : undefined,
          gap: 8,
          overflowX: "visible",
          paddingBottom: 4,
          flexWrap: compact ? undefined : "wrap",
        }}
      >
        {items.map((v) => {
          const isActive = active === v.id;
          const onSelect = () => onActivate(isActive ? null : v.id);
          return (
            <div
              key={v.id}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              aria-label={v.label}
              className="saved-view-card"
              onClick={onSelect}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect();
                }
              }}
              style={{
                ...G,
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: compact ? "12px 14px 12px 12px" : "10px 14px 10px 12px",
                borderRadius: 11,
                border: `1px solid ${isActive ? T.ink : T.border}`,
                background: isActive ? T.ink : T.surface,
                cursor: "pointer",
                textAlign: "left",
                flexShrink: 0,
                width: compact ? "100%" : undefined,
                boxSizing: "border-box",
                transition: "all 0.15s",
                boxShadow: isActive ? T.md : T.sm,
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: isActive ? "rgba(255,255,255,0.12)" : `${v.color}15`,
                  color: isActive ? "#fff" : v.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name={v.icon} size={13} color={isActive ? "#fff" : v.color} />
              </div>
              <div style={{ flex: compact ? 1 : undefined, minWidth: 0 }}>
                <div
                  style={{
                    ...G,
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: isActive ? "#fff" : T.ink,
                    lineHeight: 1.2,
                    whiteSpace: compact ? "nowrap" : undefined,
                    overflow: compact ? "hidden" : undefined,
                    textOverflow: compact ? "ellipsis" : undefined,
                  }}
                >
                  {v.label}
                </div>
                <div
                  style={{
                    ...G,
                    fontSize: 10.5,
                    color: isActive ? "rgba(255,255,255,0.65)" : T.inkLight,
                    marginTop: 2,
                  }}
                >
                  {v.hint || ""}
                </div>
              </div>
              <DeleteViewControl
                view={v}
                onDelete={onDelete}
                variant="corner"
                cardActive={isActive}
                compact={compact}
              />
            </div>
          );
        })}
        <div
          style={{
            position: "relative",
            flexShrink: 0,
            width: compact ? "100%" : undefined,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setNewOpen((o) => !o)}
            aria-haspopup="dialog"
            aria-expanded={newOpen}
            style={{
              ...G,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              padding: compact ? "13px 14px" : "10px 14px",
              borderRadius: 11,
              border: `1px dashed ${newOpen ? T.ink : T.border}`,
              background: newOpen ? T.surface : "transparent",
              color: newOpen ? T.ink : T.inkLight,
              fontSize: compact ? 13 : 12,
              fontWeight: 600,
              cursor: "pointer",
              height: compact ? undefined : "100%",
              width: compact ? "100%" : undefined,
            }}
          >
            <Icon name="plus" size={12} />
            Nova
          </button>
          {newOpen && (
            <PopoverShell
              minWidth={340}
              maxWidth={380}
              compact={compact}
            >
              <NewViewForm
                activeFacets={activeFacets}
                onCancel={() => setNewOpen(false)}
                compact={compact}
                onSave={(draft) => {
                  onCreate(draft);
                  setNewOpen(false);
                }}
              />
            </PopoverShell>
          )}
        </div>
      </div>
    </div>
  );
}
