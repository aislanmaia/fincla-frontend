import React, { useState } from "react";
import { T } from "../../../../tokens";
import { G } from "../../../../typography";
import { Icon } from "../shared/Icon.jsx";
import { PopoverShell } from "../shared/PopoverShell.jsx";
import { DeleteViewControl, DeleteViewStyles } from "./DeleteViewControl.jsx";
import { NewViewForm } from "./NewViewForm.jsx";

/**
 * Tira horizontal de saved views como cards + botão "+ Nova" no fim que abre
 * o popover do NewViewForm.
 */
export function SavedViewsCards({
  items,
  active,
  onActivate,
  onDelete,
  onCreate,
  activeFacets = [],
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
        style={{ display: "flex", gap: 8, overflowX: "visible", paddingBottom: 4, flexWrap: "wrap" }}
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
                padding: "10px 14px 10px 12px",
                borderRadius: 11,
                border: `1px solid ${isActive ? T.ink : T.border}`,
                background: isActive ? T.ink : T.surface,
                cursor: "pointer",
                textAlign: "left",
                flexShrink: 0,
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
              <div>
                <div
                  style={{
                    ...G,
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: isActive ? "#fff" : T.ink,
                    lineHeight: 1.2,
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
              />
            </div>
          );
        })}
        <div
          style={{ position: "relative", flexShrink: 0 }}
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
              padding: "10px 14px",
              borderRadius: 11,
              border: `1px dashed ${newOpen ? T.ink : T.border}`,
              background: newOpen ? T.surface : "transparent",
              color: newOpen ? T.ink : T.inkLight,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              height: "100%",
            }}
          >
            <Icon name="plus" size={12} />
            Nova
          </button>
          {newOpen && (
            <PopoverShell minWidth={340} maxWidth={380}>
              <NewViewForm
                activeFacets={activeFacets}
                onCancel={() => setNewOpen(false)}
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
