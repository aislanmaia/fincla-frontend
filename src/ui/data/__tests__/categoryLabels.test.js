import { describe, expect, it, vi } from "vitest";
import {
  categoryLabelPtForTag,
  detailLabelPtForTag,
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

describe("detailLabelPtForTag", () => {
  // Nomes reais do seed `CANONICAL_CATEGORY_SEED` (fincla-api/seed_default_tags.py) —
  // toda organização nova recebe essas ~25 tags "detalhe" automaticamente.
  it("traduz os nomes das tags-filha do seed (categoria = detalhe)", () => {
    expect(detailLabelPtForTag({ name: "grocery" })).toBe("mercado");
    expect(detailLabelPtForTag({ name: "restaurant" })).toBe("restaurante");
    expect(detailLabelPtForTag({ name: "fuel" })).toBe("combustível");
    expect(detailLabelPtForTag({ name: "health_plan" })).toBe("plano de saúde");
    expect(detailLabelPtForTag({ name: "salary" })).toBe("salário");
  });

  it("é case/acento-insensível e tolera variações de grafia", () => {
    expect(detailLabelPtForTag({ name: "Health_Plan" })).toBe("plano de saúde");
    expect(detailLabelPtForTag({ name: "Health Plan" })).toBe("plano de saúde");
  });

  it("deixa passar tag já em PT criada pelo usuário", () => {
    expect(detailLabelPtForTag({ name: "pix-solidário" })).toBe("pix-solidário");
    expect(detailLabelPtForTag({ name: "presente especial" })).toBe("presente especial");
  });

  it("nunca mostra slug cru com underscore fora do mapa: humaniza e registra", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(detailLabelPtForTag({ name: "some_unmapped_tag" })).toBe("some unmapped tag");
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("aceita o shape de tag do endpoint de transações (name puro)", () => {
    expect(detailLabelPtForTag({ id: "t1", name: "uber", parent_category_tag_id: "c1" })).toBe(
      "uber",
    );
  });

  it("string vazia/tag nula não quebra", () => {
    expect(detailLabelPtForTag(null)).toBe("");
    expect(detailLabelPtForTag({ name: "" })).toBe("");
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
