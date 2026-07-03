import React from "react";

import { KebabMenu } from "../../components/KebabMenu";
import { CLIENT_ROW_ACTIONS } from "./consultantClientActions";

/**
 * Menu de ações da linha de cliente (A2.3). Mapeia o catálogo `CLIENT_ROW_ACTIONS`
 * para os itens do `KebabMenu` (⋮ em portal): "Abrir relatório" chama
 * `onOpen(organizationId)` (stub até a rota S3); "Avaliar com IA" e "Enviar mensagem"
 * ficam desabilitadas com selo "em breve" (Trilha B). `soon` é a fonte única do estado
 * desabilitado (= sem handler ativo).
 */
export function ConsultantClientActionsMenu({ organizationId, onOpen, clientName }) {
  const items = CLIENT_ROW_ACTIONS.map((action) => ({
    key: action.id,
    label: action.label,
    disabled: action.soon,
    badge: action.soon ? "em breve" : undefined,
    onSelect: action.id === "open" ? () => onOpen?.(organizationId) : undefined,
  }));

  return <KebabMenu ariaLabel={clientName ? `Ações de ${clientName}` : "Ações do cliente"} items={items} />;
}
