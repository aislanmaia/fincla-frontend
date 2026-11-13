// Prévia de troca BRL → USD no formato de fincla-api#474 (BaseCurrencyChangePreviewResponse).
const m = (amount, currency) => ({ amount, currency });

export const ORG = "4f0c0000-0000-4000-8000-000000000001";

export const item = (over) => ({
  entity_id: over.key,
  field: "amount",
  can_skip: false,
  locked_reason: null,
  ...over,
});

export function impactPreview(over = {}) {
  return {
    organization_id: ORG,
    from_currency: "BRL",
    to_currency: "USD",
    quote: { base: "BRL", quote: "USD", rate: "0.1834000000", quoted_on: "2026-11-05" },
    quote_unavailable_reason: null,
    fingerprint: "fp-1",
    groups: [
      { group: "income", count: 1, locked_count: 0, undisclosed_count: 0, items: [
        item({ key: "organization:x:monthly_income", label: "Renda mensal declarada",
          current: m("5000.00", "BRL"), kept: m("5000.00", "USD"), converted: m("917.00", "USD") }),
      ] },
      { group: "budgets", count: 2, locked_count: 0, undisclosed_count: 0, items: [
        item({ key: "budget:b1:amount", label: "Mercado", can_skip: true,
          current: m("800.00", "BRL"), kept: m("800.00", "USD"), converted: m("146.72", "USD") }),
        item({ key: "budget:b2:amount", label: "Lazer", can_skip: true,
          current: m("300.00", "BRL"), kept: m("300.00", "USD"), converted: m("55.02", "USD") }),
      ] },
      { group: "goals", count: 3, locked_count: 1, undisclosed_count: 0, items: [
        item({ key: "goal:g1:target_amount", entity_id: "g1", label: "Viagem — valor-alvo", can_skip: true, warning: "contributions_currency",
          current: m("10000.00", "BRL"), kept: m("10000.00", "USD"), converted: m("1834.00", "USD") }),
        item({ key: "goal:g1:monthly_target", entity_id: "g1", label: "Viagem — aporte mensal", can_skip: true,
          current: m("500.00", "BRL"), kept: m("500.00", "USD"), converted: m("91.70", "USD") }),
        item({ key: "goal:g2:target_amount", entity_id: "g2", label: "Reserva — valor-alvo", can_skip: true, locked_reason: "has_contributions",
          current: m("20000.00", "BRL"), kept: m("20000.00", "USD"), converted: m("3668.00", "USD") }),
      ] },
      { group: "consultant_income", count: 2, locked_count: 0, undisclosed_count: 1, items: [
        item({ key: "consultant_profile:c1:estimated_income", label: "Renda estimada (seu perfil)",
          current: m("7000.00", "BRL"), kept: m("7000.00", "USD"), converted: m("1283.80", "USD") }),
      ] },
    ],
    ...over,
  };
}

export function emptyPreview(over = {}) {
  return { ...impactPreview(), groups: [], ...over };
}

export const CURRENCIES = [
  { code: "BRL", name: "Real brasileiro", symbol: "R$", decimal_places: 2, is_active: true },
  { code: "USD", name: "Dólar americano", symbol: "US$", decimal_places: 2, is_active: true },
  { code: "EUR", name: "Euro", symbol: "€", decimal_places: 2, is_active: false },
];
