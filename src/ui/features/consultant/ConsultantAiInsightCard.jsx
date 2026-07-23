import React from "react";

import { Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G } from "../../typography";
import { useCanSummarizePortfolioWithAi } from "./consultantAiAccess.js";
import { Icon } from "./consultantUi";

/**
 * "Resumo da base por IA" (Painel da base) — Consultor IA **A2**.
 *
 * Porte do `AiInsightCard` da referência (`cons-painel.jsx`): card roxo com
 * cabeçalho `sparkles` + CTA. O conteúdo de IA **não carrega junto com o Painel**:
 * cada relatório é pago e a cota é mensal, e ~40% das runs falham — auto-disparar
 * a cada visita queimaria a cota em poucas navegações. Então o card é um CTA
 * **on-demand**: clicar abre o drawer (`ConsultantBaseSummaryDrawer`), que é onde
 * a run acontece. Mostrar o resumo inline no card exigiria auto-fire e fica para
 * depois (junto do Copiloto, A4).
 *
 * Gateado por `consultant_ai` (mesma feature da avaliação individual): sem o
 * recurso o botão fica esmaecido e vira convite de upgrade, em vez de gastar um
 * round-trip até o `403`. O gate que importa continua sendo o do servidor.
 */
export function ConsultantAiInsightCard({ onOpen }) {
  const canSummarize = useCanSummarizePortfolioWithAi();
  const enabled = canSummarize && typeof onOpen === "function";

  return (
    <Card style={{ padding: 18, background: `linear-gradient(160deg, ${T.purpleLight}, ${T.surface} 65%)`, borderColor: "#E6DEFB" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: T.purple, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name="sparkles" size={15} color="#fff" />
        </div>
        <div style={{ ...G, fontSize: 13, fontWeight: 800, color: T.ink }}>Resumo da base por IA</div>
        {!canSummarize && (
          <span style={{ ...G, fontSize: 9, fontWeight: 700, color: T.purple, background: "#fff", border: "1px solid #E6DEFB", borderRadius: 99, padding: "2px 7px", marginLeft: "auto" }}>PRO</span>
        )}
      </div>
      <div style={{ ...G, fontSize: 12.5, color: T.inkMid, lineHeight: 1.65, marginBottom: 14 }}>
        A IA lê os números de toda a sua carteira e escreve um resumo executivo — quem precisa de
        atenção, quem está pronto para evoluir — com um relatório completo para você revisar.
      </div>
      <button
        type="button"
        disabled={!enabled}
        onClick={enabled ? onOpen : undefined}
        title={canSummarize ? "Gerar relatório da base" : "Resumo da base por IA — disponível no plano Pro"}
        style={{ ...G, width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "none", background: T.purple, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: enabled ? "pointer" : "default", opacity: enabled ? 1 : 0.55 }}
      >
        <Icon name="sparkles" size={13} color="#fff" /> Gerar relatório da base
      </button>
    </Card>
  );
}
