/**
 * Catálogo das abas do relatório do cliente (S3), fiel à referência de design.
 * Ids em inglês (estado/URL futura), labels PT-BR, ícone por aba. `soon: true` =
 * aba ainda não implementada (desabilitada com selo "em breve"). Ativas: "Visão
 * geral" (RF.1b), "Transações" (RF.2) e "Cartões" (RF.3). Categorias chega em RF.4.
 */
export const CLIENT_REPORT_TABS = [
  { id: "overview", label: "Visão geral", icon: "layout", soon: false },
  { id: "transactions", label: "Transações", icon: "repeat", soon: false },
  { id: "cards", label: "Cartões", icon: "card", soon: false },
  { id: "categories", label: "Categorias", icon: "bar", soon: true },
];

/** A aba padrão (primeira ativa). */
export const DEFAULT_CLIENT_REPORT_TAB = "overview";
