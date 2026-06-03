import { describe, expect, it } from "vitest";
import {
  categoryLabelPtForTag,
  resolveCategoryColorForTag,
  resolveCategoryIconKey,
} from "../categoryLabels.js";

describe("categoryLabels", () => {
  it("prioriza icon_key para rótulo PT", () => {
    expect(
      categoryLabelPtForTag({ name: "Food & Groceries", icon_key: "shopping-cart" }),
    ).toBe("Alimentação");
  });

  it("usa mapa EN por nome quando não há icon_key", () => {
    expect(categoryLabelPtForTag({ name: "Income", icon_key: null })).toBe("Receita");
  });

  it("fallback para name quando fora do dicionário", () => {
    expect(categoryLabelPtForTag({ name: "Custom PT", icon_key: null })).toBe("Custom PT");
  });

  it("normaliza nomes PT sem acento/caixa baixa", () => {
    expect(categoryLabelPtForTag({ name: "alimentacao", icon_key: null })).toBe("Alimentação");
  });
});

describe("resolveCategoryIconKey", () => {
  it("prioriza icon_key vindo da API", () => {
    expect(resolveCategoryIconKey("car", "Qualquer")).toBe("car");
  });

  it("resolve pelo rótulo PT canônico do seed", () => {
    expect(resolveCategoryIconKey(null, "Moradia")).toBe("home");
  });

  it("atalhos do mock (protótipo)", () => {
    expect(resolveCategoryIconKey(null, "Lazer")).toBe("party-popper");
    expect(resolveCategoryIconKey(null, "Outros")).toBe(null);
  });
});

describe("resolveCategoryColorForTag", () => {
  it("prioriza a cor explícita da API", () => {
    expect(resolveCategoryColorForTag({ name: "Alimentação", color: "#123456" })).toBe("#123456");
  });

  it("usa a cor canônica quando a API não envia cor", () => {
    expect(resolveCategoryColorForTag({ name: "alimentacao" })).toBe("#059669");
  });

  it("nunca cai no cinza neutro para nomes conhecidos e sem cor", () => {
    expect(resolveCategoryColorForTag({ name: "Transporte" })).not.toBe("#6B7280");
  });
});
