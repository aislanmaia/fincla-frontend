import React, { useState } from "react";
import { T } from "../../../../tokens";
import { G } from "../../../../typography";
import { Icon, FILTER_ICONS } from "../shared/Icon.jsx";
import { FormLabel } from "../shared/FormLabel.jsx";

const COLORS = [T.ink, T.blue, T.green, T.amber, T.red, T.purple];

/**
 * Formulário de criação de uma nova saved view (renderizado dentro de PopoverShell).
 *
 * Props:
 *  - activeFacets: lista `{ label, value, icon, color }` para preview em chips.
 *  - onCancel(): fecha sem salvar.
 *  - onSave({ name, icon, color }): cria.
 */
export function NewViewForm({ activeFacets = [], onCancel, onSave, compact = false }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(T.blue);
  const [icon, setIcon] = useState("bookmark");

  const canSave = name.trim().length > 0;
  const handleSave = () => {
    if (!canSave) return;
    onSave({ name: name.trim(), color, icon });
  };

  return (
    <div style={{ width: compact ? "100%" : 340, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, letterSpacing: "-0.01em" }}>
          Nova visualização
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Fechar"
          style={{
            ...G,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: 6,
            border: "none",
            background: "transparent",
            color: T.inkLight,
            cursor: "pointer",
          }}
        >
          <Icon name="x" size={12} />
        </button>
      </div>

      {/* Preview do chip resultante */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "9px 11px",
          borderRadius: 10,
          border: `1px dashed ${T.border}`,
          background: T.bg,
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: `${color}18`,
            color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={13} color={color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              ...G,
              fontSize: 12.5,
              fontWeight: 700,
              color: name.trim() ? T.ink : T.inkGhost,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name.trim() || "Nome da visualização"}
          </div>
          <div style={{ ...G, fontSize: 10.5, color: T.inkLight, marginTop: 2 }}>
            {activeFacets.length === 0
              ? "Sem filtros"
              : `${activeFacets.length} ${activeFacets.length === 1 ? "filtro" : "filtros"}`}
          </div>
        </div>
      </div>

      <div>
        <FormLabel>Nome</FormLabel>
        <input
          aria-label="Nome da visualização"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Ex.: Mercados do mês"
          style={{
            ...G,
            width: "100%",
            padding: "8px 11px",
            borderRadius: 8,
            border: `1px solid ${T.border}`,
            background: T.surface,
            fontSize: 13,
            color: T.ink,
            outline: "none",
            boxSizing: "border-box",
          }}
          onFocus={(e) => (e.target.style.borderColor = T.ink)}
          onBlur={(e) => (e.target.style.borderColor = T.border)}
        />
      </div>

      <div>
        <FormLabel>Ícone</FormLabel>
        <div
          role="radiogroup"
          aria-label="Ícone"
          style={{
            display: "grid",
            gridTemplateColumns: compact ? "repeat(6, 1fr)" : "repeat(10, 1fr)",
            gap: compact ? 6 : 4,
          }}
        >
          {FILTER_ICONS.map((i) => {
            const active = i === icon;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`Ícone ${i}`}
                onClick={() => setIcon(i)}
                style={{
                  ...G,
                  width: "100%",
                  aspectRatio: "1 / 1",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 7,
                  border: `1px solid ${active ? color : T.border}`,
                  background: active ? `${color}15` : T.surface,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <Icon name={i} size={12} color={active ? color : T.inkMid} />
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <FormLabel>Cor</FormLabel>
        <div role="radiogroup" aria-label="Cor" style={{ display: "flex", gap: 6 }}>
          {COLORS.map((c) => {
            const active = c === color;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`Cor ${c}`}
                onClick={() => setColor(c)}
                style={{
                  ...G,
                  width: compact ? 32 : 24,
                  height: compact ? 32 : 24,
                  borderRadius: 99,
                  background: c,
                  cursor: "pointer",
                  padding: 0,
                  border: `2px solid ${active ? T.surface : "transparent"}`,
                  boxShadow: active ? `0 0 0 2px ${c}` : "none",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {active && <Icon name="check" size={11} color="#fff" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <FormLabel>Filtros aplicados</FormLabel>
        {activeFacets.length === 0 ? (
          <div
            style={{
              ...G,
              fontSize: 11.5,
              color: T.inkGhost,
              padding: "9px 11px",
              borderRadius: 8,
              background: T.bg,
              border: `1px dashed ${T.border}`,
              fontStyle: "italic",
            }}
          >
            Nenhum filtro ativo — será uma visualização vazia.
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {activeFacets.map((f) => (
              <span
                key={f.label}
                style={{
                  ...G,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 9px",
                  borderRadius: 99,
                  background: T.bg,
                  border: `1px solid ${T.border}`,
                  fontSize: 11,
                  color: T.inkMid,
                }}
              >
                <Icon name={f.icon} size={10} color={f.color} />
                <span style={{ color: T.inkLight }}>{f.label}:</span>
                <span style={{ color: T.ink, fontWeight: 600 }}>{f.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            ...G,
            padding: compact ? "12px 16px" : "9px 14px",
            borderRadius: 9,
            border: `1px solid ${T.border}`,
            background: T.surface,
            color: T.inkMid,
            fontSize: compact ? 13 : 12.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          style={{
            ...G,
            flex: 1,
            padding: compact ? "12px 16px" : "9px 14px",
            borderRadius: 8,
            border: `1px solid ${canSave ? T.ink : T.border}`,
            background: canSave ? T.ink : T.grayLight,
            color: canSave ? "#fff" : T.inkGhost,
            fontSize: compact ? 13 : 12.5,
            fontWeight: 700,
            cursor: canSave ? "pointer" : "not-allowed",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Icon name="save" size={12} color={canSave ? "#fff" : T.inkGhost} />
          Salvar visualização
        </button>
      </div>
    </div>
  );
}
