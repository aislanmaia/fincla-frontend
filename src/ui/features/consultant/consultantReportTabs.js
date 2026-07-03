/**
 * Catálogo das abas do relatório do cliente (S3). Ids em inglês (estado/URL futura),
 * labels PT-BR na UI. `soon: true` = aba ainda não implementada (renderiza
 * desabilitada com selo "em breve"). Só "Visão geral" está ativa nesta fatia (A3.2a);
 * Transações/Cartões/Categorias chegam em A3.3–A3.5.
 */
export const CLIENT_REPORT_TABS = [
  { id: "overview", label: "Visão geral", soon: false },
  { id: "transactions", label: "Transações", soon: true },
  { id: "cards", label: "Cartões", soon: true },
  { id: "categories", label: "Categorias", soon: true },
];

/** A aba padrão (primeira ativa). */
export const DEFAULT_CLIENT_REPORT_TAB = "overview";
