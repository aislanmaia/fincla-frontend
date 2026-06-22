/**
 * Sub-áreas do hub Planejamento. `id` = slug de URL (inglês, como os do Perfil);
 * `label` = texto de UI (PT). `soon` = placeholder (M5/M6/M7).
 * Compartilhado entre o PlanningHub e o roteador (guard + redirect default).
 */
export const PLANNING_NAV = [
  {
    group: "Saúde Financeira",
    items: [
      { id: "capacity", label: "Capacidade de Economia" },
      { id: "health", label: "Painel de Saúde", soon: true },
    ],
  },
  {
    group: "Objetivos",
    items: [
      { id: "goals", label: "Metas" },
      { id: "simulator", label: "Simulador" },
    ],
  },
  {
    group: "Rotina",
    items: [
      { id: "budgets", label: "Orçamentos" },
      { id: "planned", label: "Planejado × Realizado", soon: true },
      { id: "calendar", label: "Calendário", soon: true },
    ],
  },
];

export const DEFAULT_PLANNING_AREA = "capacity";

const ALL_ITEMS = PLANNING_NAV.flatMap((g) => g.items);
export const PLANNING_AREA_IDS = ALL_ITEMS.map((i) => i.id);

export function isPlanningArea(id) {
  return typeof id === "string" && PLANNING_AREA_IDS.includes(id);
}

export function planningAreaItem(id) {
  return ALL_ITEMS.find((i) => i.id === id) || null;
}
