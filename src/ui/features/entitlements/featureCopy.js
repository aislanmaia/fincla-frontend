/**
 * Labels amigáveis em PT-BR para as feature keys do backend.
 *
 * Mantém o mapeamento e o agrupamento (Essenciais / Recursos avançados /
 * Inteligência artificial) no frontend para evitar acoplar copy de
 * marketing à API. Quando o backend adicionar uma feature nova, basta
 * adicionar a entrada aqui — sem deploy de tipo.
 */

export const FEATURE_GROUPS = [
  { key: "essentials", label: "Essenciais" },
  { key: "advanced", label: "Recursos avançados" },
  { key: "ai", label: "Inteligência artificial" },
];

export const FEATURE_COPY = {
  manual_transactions: { label: "Transações ilimitadas", group: "essentials" },
  recurring_transactions: { label: "Recorrências e orçamentos", group: "essentials" },
  basic_reports: { label: "Dashboard e ritmo de gastos", group: "essentials" },
  custom_categories: { label: "Categorias personalizadas", group: "essentials" },
  csv_export: { label: "Exportação em CSV", group: "essentials" },
  whatsapp_assistant: { label: "Bot do WhatsApp", group: "essentials" },

  advanced_reports: { label: "Relatórios avançados", group: "advanced" },
  what_if_simulations: { label: "Simulação financeira", group: "advanced" },
  bulk_import: { label: "Importação em lote", group: "advanced" },
  excel_export: { label: "Exportação em Excel", group: "advanced" },
  multi_currency: { label: "Múltiplas moedas", group: "advanced" },
  api_access: { label: "Acesso à API", group: "advanced" },

  ai_categorization: { label: "Categorização automática", group: "ai" },
  ai_insights: { label: "Insights personalizados", group: "ai" },
  ai_anomaly_detection: { label: "Detecção de anomalias", group: "ai" },
  ai_predictive_reports: { label: "Relatórios preditivos", group: "ai" },
  ai_chart_generation: { label: "Gráficos por IA", group: "ai" },
};

export function getFeatureCopy(key) {
  return FEATURE_COPY[key] ?? { label: key, group: null };
}

/**
 * Lista curada usada na tabela comparativa de planos. Cada grupo lista
 * apenas as features que fazem sentido destacar na decisão de compra
 * (omite table-stakes como `basic_reports` e `custom_categories`).
 */
export const PLAN_COMPARISON_FEATURES = {
  essentials: [
    "manual_transactions",
    "recurring_transactions",
    "whatsapp_assistant",
    "csv_export",
  ],
  advanced: ["advanced_reports", "what_if_simulations"],
  ai: [
    "ai_categorization",
    "ai_insights",
    "ai_anomaly_detection",
    "ai_predictive_reports",
  ],
};
