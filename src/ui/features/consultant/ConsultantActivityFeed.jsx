import React from "react";

import { Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G } from "../../typography";
import { Icon } from "./consultantUi";

/**
 * "Atividade da base" (Painel da base) — preserva o layout da referência
 * (`ActivityFeed` de `cons-painel.jsx`), mas é **stub "em breve"**: não há
 * endpoint de atividade/eventos no backend (A1.4 deferida). O feed real (alertas,
 * metas, transações, mensagens por cliente) precisa de um endpoint novo — Trilha B.
 */
export function ConsultantActivityFeed() {
  return (
    <Card style={{ padding: 0 }}>
      <div style={{ padding: "14px 17px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ ...G, fontSize: 13, fontWeight: 800, color: T.ink }}>Atividade da base</div>
        <span style={{ ...G, fontSize: 9, fontWeight: 700, color: T.inkLight, background: T.grayLight, borderRadius: 99, padding: "2px 7px" }}>EM BREVE</span>
      </div>
      <div style={{ height: 1, background: T.border }} />
      <div style={{ padding: "28px 20px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: T.grayLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="trending" size={18} color={T.inkGhost} />
        </div>
        <div style={{ ...G, fontSize: 12.5, color: T.inkLight, lineHeight: 1.6, maxWidth: 300 }}>
          Em breve: os eventos da sua carteira em tempo real — alertas de risco, metas atingidas, transações e mensagens
          de cada cliente.
        </div>
      </div>
    </Card>
  );
}
