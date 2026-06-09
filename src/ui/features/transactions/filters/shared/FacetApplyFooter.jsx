import React from "react";
import { T } from "../../../../tokens";
import { G } from "../../../../typography";

/**
 * CTA sticky no rodapé dos painéis inline de facet (apply & dismiss).
 * Espelha o "Ver N transações" do bottom sheet mobile.
 */
export function FacetApplyFooter({ count = 0, onApply, compact = false, loading = false }) {
  const label =
    count === 1
      ? "Ver 1 transação"
      : `Ver ${count.toLocaleString("pt-BR")} transações`;

  return (
    <div
      style={{
        marginTop: compact ? 14 : 16,
        paddingTop: compact ? 12 : 14,
        borderTop: `1px solid ${T.border}`,
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={onApply}
        disabled={loading}
        aria-label={label}
        style={{
          ...G,
          width: "100%",
          background: T.ink,
          color: "#fff",
          border: "none",
          borderRadius: compact ? 12 : 10,
          padding: compact ? "14px 16px" : "12px 16px",
          fontSize: compact ? 15 : 14,
          fontWeight: 800,
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {loading ? "Atualizando…" : label}
      </button>
    </div>
  );
}
