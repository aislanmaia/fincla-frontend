/**
 * IDs do passo "categorias" do onboarding → `icon_key` Lucide do seed (GET /tags).
 * Fonte única para OnboardingFlow (UI) e onboardingApi (PATCH).
 */

export const ONBOARDING_FLOW_TO_ICON_KEY = {
  moradia: "home",
  alimentacao: "shopping-cart",
  transporte: "car",
  saude: "pill",
  educacao: "book-open",
  lazer: "party-popper",
  assinaturas: "smartphone",
  negocios: null,
};

/** Linhas da UI: id de fluxo, chave Lucide, rótulo PT (apresentação). */
export const ONBOARDING_CATEGORY_ROWS = [
  { id: "moradia", iconKey: "home", labelPt: "Moradia" },
  { id: "alimentacao", iconKey: "shopping-cart", labelPt: "Alimentação" },
  { id: "transporte", iconKey: "car", labelPt: "Transporte" },
  { id: "saude", iconKey: "pill", labelPt: "Saúde" },
  { id: "educacao", iconKey: "book-open", labelPt: "Educação" },
  { id: "lazer", iconKey: "party-popper", labelPt: "Lazer" },
  { id: "negocios", iconKey: null, labelPt: "Negócios" },
  { id: "assinaturas", iconKey: "smartphone", labelPt: "Assinaturas" },
];
