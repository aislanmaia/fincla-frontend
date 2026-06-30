import React from "react";
import { T } from "../../tokens";
import { G, S } from "../../typography";

/**
 * Placeholder genérico das sub-rotas do Consultor ainda não construídas
 * (`/consultant/clients` → S2, `/consultant/insights` → S4, `/consultant/profile`
 * → S6). Existe para a A0.3 deixar o shell navegável; cada microetapa substitui
 * o conteúdo real.
 */
export function ConsultantPlaceholderPage({ title, lead, soon }) {
  return (
    <div style={{ ...G, width: "100%", padding: "clamp(18px, 3.5vw, 32px) clamp(16px, 3.5vw, 40px) 48px" }}>
      <h1 style={{ margin: 0, display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ ...G, fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em", color: T.ink }}>{title}</span>
        {soon && <span style={{ ...S, fontSize: 30, color: T.ink }}>{soon}</span>}
      </h1>
      <p style={{ ...G, fontSize: 14, color: T.inkLight, marginTop: 10 }}>
        {lead ?? "Área do Consultor — em construção."}
      </p>
    </div>
  );
}
