import React from "react";

import { Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G } from "../../typography";
import { Icon } from "./consultantUi";

/**
 * "Resumo da base por IA" (Painel da base) — **Trilha B (IA)**. Preserva o layout
 * da referência (`AiInsightCard` de `cons-painel.jsx`: card roxo com cabeçalho +
 * CTA), mas é **stub "em breve"**: não inventa números/insights. O conteúdo real
 * (leitura da carteira por IA + relatório) entra na trilha de IA.
 */
export function ConsultantAiInsightCard() {
  return (
    <Card style={{ padding: 18, background: `linear-gradient(160deg, ${T.purpleLight}, ${T.surface} 65%)`, borderColor: "#E6DEFB" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: T.purple, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name="sparkles" size={15} color="#fff" />
        </div>
        <div style={{ ...G, fontSize: 13, fontWeight: 800, color: T.ink }}>Resumo da base por IA</div>
        <span style={{ ...G, fontSize: 9, fontWeight: 700, color: T.purple, background: "#fff", border: "1px solid #E6DEFB", borderRadius: 99, padding: "2px 7px", marginLeft: "auto" }}>EM BREVE</span>
      </div>
      <div style={{ ...G, fontSize: 12.5, color: T.inkMid, lineHeight: 1.65, marginBottom: 14 }}>
        Em breve a IA vai ler os números de toda a sua carteira e escrever um resumo executivo — quem precisa de atenção,
        quem está pronto para evoluir — e gerar um relatório completo para você revisar.
      </div>
      <button
        type="button"
        disabled
        title="Em breve"
        style={{ ...G, width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "none", background: T.purple, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "default", opacity: 0.55 }}
      >
        <Icon name="sparkles" size={13} color="#fff" /> Gerar relatório da base
        <span style={{ ...G, fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", background: "rgba(255,255,255,0.2)", borderRadius: 5, padding: "1px 5px" }}>em breve</span>
      </button>
    </Card>
  );
}
