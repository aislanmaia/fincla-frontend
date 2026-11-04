import React from "react";
import { Repeat } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { currencyInfo } from "../../money/currencyRegistry.js";
import { conversionHeadline, formatAmountInput } from "./accountConversion.js";

/**
 * Valor na moeda da conta nova, ao mover um lançamento para uma conta de OUTRA
 * moeda no Editar. A cotação só SUGERE (campo pré-preenchido e editável); sem
 * cotação o campo fica vazio — nunca se assume taxa 1.
 *
 * No nível do módulo, não dentro do modal: um componente definido no corpo do
 * modal remontaria o input a cada render e a pessoa perderia o foco ao digitar.
 */
export function AccountMoveValue({ from, to, quote, loading, value, onChange, originalAmount, onUseSameNumber }) {
  if (!from || !to) return null;
  const toSymbol = currencyInfo(to).symbol;
  const headline = conversionHeadline({ from, to, quote });
  const sameNumber = formatAmountInput(originalAmount);
  return (
    <div
      data-testid="account-move-value"
      style={{ ...G, display: "flex", flexDirection: "column", gap: 8, fontSize: 12, lineHeight: 1.45, color: T.ink, background: T.amberLight, border: `1px solid ${T.amber}33`, borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <Repeat size={14} color={T.amber} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
        <span>
          {loading
            ? "Buscando a cotação…"
            : headline || `Sem cotação agora — informe o valor em ${toSymbol}`}
        </span>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 10, padding: "8px 10px" }}>
        <span style={{ ...G, fontSize: 13, fontWeight: 600, color: T.inkMid }}>{toSymbol}</span>
        <input
          aria-label={`Valor em ${toSymbol}`}
          inputMode="decimal"
          placeholder="0,00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...G, ...NUM, flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: T.ink, border: "none", outline: "none", background: "transparent" }}
        />
      </label>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: T.inkLight }}>Confira com o extrato do banco.</span>
        {sameNumber ? (
          <button
            type="button"
            onClick={onUseSameNumber}
            style={{ ...G, fontSize: 11, fontWeight: 700, color: T.blue, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}
          >
            usar {sameNumber} como {toSymbol}
          </button>
        ) : null}
      </div>
    </div>
  );
}
