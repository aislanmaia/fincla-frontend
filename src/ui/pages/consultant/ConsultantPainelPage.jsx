import React from "react";
import { T } from "../../tokens";
import { G, S } from "../../typography";

/**
 * Painel da base do Consultor (A0.1 — placeholder). A implementação real (KPIs,
 * semáforo, "precisam de atenção") chega em S1. Por ora confirma que a área
 * `/consultant` carrega para usuários consultores.
 */
export function ConsultantPainelPage() {
  return (
    <div style={{ ...G, width: "100%", padding: "clamp(18px, 3.5vw, 32px) clamp(16px, 3.5vw, 40px) 48px" }}>
      <h1 style={{ margin: 0, display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ ...G, fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em", color: T.ink }}>Painel da</span>
        <span style={{ ...S, fontSize: 30, color: T.ink }}>base</span>
      </h1>
      <p style={{ ...G, fontSize: 14, color: T.inkLight, marginTop: 10 }}>
        Área do Consultor — em construção.
      </p>
    </div>
  );
}
