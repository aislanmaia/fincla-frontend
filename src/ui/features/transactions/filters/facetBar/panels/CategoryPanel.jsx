import React, { useState } from "react";
import { T } from "../../../../../tokens";
import { G } from "../../../../../typography";
import { Icon } from "../../shared/Icon.jsx";
import { PanelHeader } from "./PanelHeader.jsx";

/**
 * `categories`: lista de `{ id, label, color, icon }` injetada via props.
 * Substitui o `window.CATS` do protótipo — origem: `useCategoryTagsData`.
 */
export function CategoryPanel({
  cats,
  setCats,
  categories = [],
  onClose,
  compact = false,
}) {
  const [search, setSearch] = useState("");
  const filtered = categories.filter((c) =>
    c.label.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div>
      <PanelHeader
        title="Categoria"
        hint="Selecione uma ou mais para combinar com OU"
        onClose={onClose}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar categoria…"
          aria-label="Buscar categoria"
          style={{
            ...G,
            flex: 1,
            padding: "9px 12px",
            borderRadius: 9,
            border: `1px solid ${T.border}`,
            fontSize: 12.5,
            outline: "none",
            color: T.ink,
          }}
        />
        <button
          type="button"
          onClick={() => setCats([])}
          style={textBtnStyle(T.inkLight)}
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={() => setCats(categories.map((c) => c.id))}
          style={{ ...textBtnStyle(T.ink), fontWeight: 700 }}
        >
          Todas
        </button>
      </div>
      {categories.length === 0 ? (
        <div
          style={{
            ...G,
            padding: 18,
            background: T.bg,
            borderRadius: 10,
            color: T.inkLight,
            fontSize: 12,
            textAlign: "center",
          }}
        >
          Nenhuma categoria disponível.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: compact ? "1fr 1fr" : "repeat(3, 1fr)",
            gap: 8,
          }}
        >
          {filtered.map((c) => {
            const active = cats.includes(c.id);
            return (
              <button
                type="button"
                key={c.id}
                onClick={() =>
                  setCats(active ? cats.filter((x) => x !== c.id) : [...cats, c.id])
                }
                aria-pressed={active}
                aria-label={c.label}
                style={{
                  ...G,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1.5px solid ${active ? c.color : T.border}`,
                  background: active ? `${c.color}10` : T.surface,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    background: `${c.color}1f`,
                    color: c.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    flexShrink: 0,
                  }}
                >
                  {c.icon || "●"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
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
                    {c.label}
                  </div>
                </div>
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    border: `1.5px solid ${active ? c.color : T.border}`,
                    background: active ? c.color : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {active && <Icon name="check" size={10} color="#fff" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function textBtnStyle(color) {
  return {
    ...G,
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 11.5,
    color,
    fontWeight: 600,
  };
}
