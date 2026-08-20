import React from "react";
import { T } from "../../../../tokens";

const MONO = { fontFamily: "'Geist Mono', ui-monospace, monospace" };

export function CountChip({ n, dark = false }) {
  return (
    <span
      style={{
        ...MONO,
        background: dark ? T.ink : "rgba(255,255,255,0.85)",
        color: dark ? "#fff" : T.ink,
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 700,
        padding: "0 5px",
        // era `13px` fixo calibrado para fontSize:9 (proporção 1.44); com o
        // piso de 11px isso apertava a pílula (1.18). Unitless escala com o
        // fontSize por definição — não quebra de novo se o tamanho mudar.
        lineHeight: 1.3,
      }}
    >
      {n}
    </span>
  );
}
