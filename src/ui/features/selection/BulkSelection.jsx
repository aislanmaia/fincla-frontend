import React from "react";
import { T } from "../../tokens.js";
import { G } from "../../typography.js";

/**
 * Peças da seleção em lote — UMA mecânica para o app (decisão do Owner, #281): os
 * Lançamentos do cartão e as Transações usam as mesmas caixas, o mesmo "N
 * selecionados" e a mesma barra de ações. Nada de padrão visual novo por tela.
 */

/** Botão de ação em lote: texto azul sublinhado, sem moldura. */
export const bulkButton = { ...G, border: 0, background: "none", color: T.blue, cursor: "pointer", textDecoration: "underline", fontSize: 11 };

/**
 * A caixa nativa (13 px) é pequena demais para o dedo: o rótulo estende a área de
 * toque para 28 px (WCAG 2.2, 2.5.8) sem mudar o desenho nem ocupar espaço (a margem
 * negativa devolve o excesso).
 */
export function RowCheckbox(props) {
  return (
    <label style={{ display: "grid", placeItems: "center", width: 28, height: 28, margin: -7, flex: "none", cursor: "pointer" }}>
      <input type="checkbox" style={{ margin: 0 }} {...props} />
    </label>
  );
}

/** "3 selecionados · <extra>" — o contador azul ao lado do total. */
export function SelectionCount({ count, extra = null }) {
  if (count <= 0) return null;
  return (
    <span style={{ color: T.blue }}>
      {count} selecionado{count === 1 ? "" : "s"}
      {extra ? ` · ${extra}` : ""}
    </span>
  );
}

/** A barra de ações em lote; `onClear` vira o "Limpar seleção" de sempre, no fim. */
export function BulkActionsToolbar({ children, onClear }) {
  return (
    <span role="toolbar" aria-label="Ações em lote" style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", gap: "4px 10px", alignItems: "center", minWidth: 0 }}>
      {children}
      <button type="button" onClick={onClear} style={bulkButton}>Limpar seleção</button>
    </span>
  );
}
