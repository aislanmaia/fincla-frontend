import React from "react";
import { useNavigate } from "@tanstack/react-router";
import { T } from "../tokens";
import { G } from "../typography";

/**
 * errorComponent do router: falha de rota/loader sem vazar detalhes sensíveis.
 */
export function FinclaAuthenticatedRouteError() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "60dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: T.bg,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          textAlign: "center",
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          padding: "28px 24px",
          boxShadow: T.sm,
        }}
      >
        <div style={{ ...G, fontSize: 36, marginBottom: 8 }}>⚠️</div>
        <div style={{ ...G, fontSize: 17, fontWeight: 800, color: T.ink, marginBottom: 8 }}>
          Algo correu mal nesta área
        </div>
        <div style={{ ...G, fontSize: 13, color: T.inkMid, lineHeight: 1.65, marginBottom: 22 }}>
          Não foi possível carregar esta parte do app. Tente novamente ou volte ao painel principal.
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              ...G,
              background: T.surface,
              color: T.ink,
              border: `1px solid ${T.border}`,
              borderRadius: 11,
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Recarregar página
          </button>
          <button
            type="button"
            onClick={() => navigate({ to: "/dashboard", replace: true })}
            style={{
              ...G,
              background: T.ink,
              color: "#fff",
              border: "none",
              borderRadius: 11,
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Ir para Visão geral
          </button>
        </div>
      </div>
    </div>
  );
}
