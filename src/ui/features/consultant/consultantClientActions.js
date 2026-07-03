/**
 * Catálogo de ações da linha de cliente na carteira (A2.3). Ids em inglês
 * (estado/handler), labels PT-BR na UI. `soon: true` = recurso da Trilha B
 * (IA/mensageria) ainda não disponível — renderiza desabilitado com selo "em breve".
 *
 * "Abrir relatório" é a única ação ativa hoje; o alvo (rota do relatório do cliente,
 * S3) ainda é stub, então o handler é injetado pela página/coluna.
 */
export const CLIENT_ROW_ACTIONS = [
  { id: "open", label: "Abrir relatório", soon: false },
  { id: "evaluate", label: "Avaliar com IA", soon: true },
  { id: "message", label: "Enviar mensagem", soon: true },
];
