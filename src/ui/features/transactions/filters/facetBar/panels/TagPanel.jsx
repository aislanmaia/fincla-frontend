import React, { useState } from "react";
import { T } from "../../../../../tokens";
import { G } from "../../../../../typography";
import { Icon } from "../../shared/Icon.jsx";
import { PanelHeader } from "./PanelHeader.jsx";

export function TagPanel({ tags, setTags, allTags = [], onClose }) {
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const visible = allTags.filter((tg) => tg.toLowerCase().includes(term));

  return (
    <div>
      <PanelHeader
        title="Tags"
        hint="Filtra transações que tenham todas as tags marcadas"
        onClose={onClose}
      />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar tag…"
        aria-label="Buscar tag"
        style={{
          ...G,
          width: "100%",
          padding: "10px 13px",
          borderRadius: 9,
          border: `1px solid ${T.border}`,
          fontSize: 12.5,
          outline: "none",
          color: T.ink,
          marginBottom: 14,
          boxSizing: "border-box",
        }}
      />
      {visible.length === 0 ? (
        <div
          style={{
            ...G,
            padding: 16,
            background: T.bg,
            borderRadius: 10,
            color: T.inkLight,
            fontSize: 12,
            textAlign: "center",
          }}
        >
          {allTags.length === 0 ? "Nenhuma tag cadastrada." : "Nenhuma tag encontrada."}
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {visible.map((tg) => {
            const active = tags.includes(tg);
            return (
              <button
                type="button"
                key={tg}
                onClick={() =>
                  setTags(active ? tags.filter((x) => x !== tg) : [...tags, tg])
                }
                aria-pressed={active}
                aria-label={`Tag ${tg}`}
                style={{
                  ...G,
                  padding: "6px 11px",
                  borderRadius: 99,
                  border: `1.5px solid ${active ? T.ink : T.border}`,
                  background: active ? T.ink : T.surface,
                  color: active ? "#fff" : T.inkMid,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                {active && <Icon name="check" size={10} color="#fff" />}
                #{tg}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
