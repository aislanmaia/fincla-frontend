import React from "react";
import { T } from "../../../../tokens";

const MONO = { fontFamily: "'Geist Mono', ui-monospace, monospace" };

/**
 * Quantas transações uma opção do painel de filtro traria — «se eu marcar
 * esta, quantas linhas sobram», com os OUTROS filtros já aplicados.
 *
 * `n === null` significa "ainda não sei" (não busquei, ou a busca falhou) e
 * renderiza NADA. Um `0` nesse caso seria uma afirmação falsa: diria "esta
 * opção não traz nada" quando o certo é não dizer coisa alguma.
 *
 * O zero de verdade continua aparecendo, apagado — é informação útil, avisa
 * antes do clique que a opção levaria a uma lista vazia.
 */
export function FacetCount({ n, active = false }) {
  if (n == null) return null;
  return (
    <span
      aria-label={`${n} ${n === 1 ? "transação" : "transações"}`}
      style={{
        ...MONO,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.3,
        color: active ? T.ink : n === 0 ? T.inkLight : T.inkMid,
        opacity: n === 0 ? 0.55 : 1,
        flexShrink: 0,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {n}
    </span>
  );
}
