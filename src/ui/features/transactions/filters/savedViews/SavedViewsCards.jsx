import React, { useState } from "react";
import { T } from "../../../../tokens";
import { G } from "../../../../typography";
import { Icon } from "../shared/Icon.jsx";
import { PopoverShell } from "../shared/PopoverShell.jsx";
import { DeleteViewControl, DeleteViewStyles } from "./DeleteViewControl.jsx";
import { NewViewForm } from "./NewViewForm.jsx";

/**
 * Tira de saved views como cards + botão "+ Nova" que abre o formulário unificado.
 * Create: popover abaixo de "+ Nova". Update: popover abaixo do card ativo.
 */
export function SavedViewsCards({
  items,
  active,
  onActivate,
  onDelete,
  onOpenSaveForm,
  onSaveView,
  activeFacets = [],
  compact = false,
  saveFormMode = "create",
  saveFormInitialName = "",
  saveFormInitialIcon = "bookmark",
  saveFormInitialColor,
  updateViewLabel = "",
  newFormOpen: newFormOpenProp,
  onNewFormOpenChange,
}) {
  const [newOpenInternal, setNewOpenInternal] = useState(false);
  const newOpen = newFormOpenProp !== undefined ? newFormOpenProp : newOpenInternal;
  const setNewOpen = onNewFormOpenChange ?? setNewOpenInternal;

  const isUpdateMode = saveFormMode === "update";
  const showCreateForm = newOpen && !isUpdateMode;
  const showUpdateForm = newOpen && isUpdateMode;

  const openCreateForm = () => {
    if (typeof onOpenSaveForm === "function") onOpenSaveForm("create");
    setNewOpen(true);
  };

  const closeForm = () => setNewOpen(false);

  const saveForm = (
    <PopoverShell minWidth={340} maxWidth={380} compact={compact} dashed>
      <NewViewForm
        key={`${saveFormMode}-${updateViewLabel}-${saveFormInitialName}`}
        mode={saveFormMode}
        initialName={saveFormInitialName}
        initialIcon={saveFormInitialIcon}
        initialColor={saveFormInitialColor}
        updateViewLabel={updateViewLabel}
        activeFacets={activeFacets}
        onCancel={closeForm}
        compact={compact}
        onSave={(draft) => {
          onSaveView({ mode: saveFormMode, ...draft });
          closeForm();
        }}
      />
    </PopoverShell>
  );

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
          alignItems: compact ? undefined : "flex-start",
        }}
      >
        {items.map((v) => {
          const isActive = active === v.id;
          const onSelect = () => onActivate(v.id);
          const anchorUpdateForm = showUpdateForm && isActive;

          return (
            <div
              key={v.id}
              style={{
                position: "relative",
                flexShrink: 0,
                width: compact ? "100%" : undefined,
              }}
            >
              <div
                role="button"
                tabIndex={0}
                aria-pressed={isActive}
                aria-label={v.modified ? `${v.label} — filtros alterados` : v.label}
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
                  {v.modified ? (
                    <div
                      style={{
                        ...G,
                        fontSize: 10.5,
                        fontStyle: "italic",
                        color: isActive ? "rgba(255,255,255,0.75)" : T.amber,
                        marginTop: 2,
                      }}
                    >
                      Filtros alterados
                    </div>
                  ) : (
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
                  )}
                </div>
                <DeleteViewControl
                  view={v}
                  onDelete={onDelete}
                  variant="corner"
                  cardActive={isActive}
                  compact={compact}
                />
              </div>
              {anchorUpdateForm ? saveForm : null}
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
            onClick={openCreateForm}
            aria-haspopup="dialog"
            aria-expanded={showCreateForm}
            style={{
              ...G,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              padding: compact ? "13px 14px" : "10px 14px",
              borderRadius: 11,
              border: `1px dashed ${showCreateForm ? T.ink : T.border}`,
              background: showCreateForm ? T.surface : "transparent",
              color: showCreateForm ? T.ink : T.inkLight,
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
          {showCreateForm ? saveForm : null}
        </div>
      </div>
    </div>
  );
}
