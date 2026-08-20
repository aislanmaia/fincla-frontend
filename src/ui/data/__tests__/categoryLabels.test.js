import { describe, expect, it, vi } from "vitest";
import {
  categoryLabelPtForTag,
  detailLabelPtForTag,
  resolveCategoryColorForTag,
  resolveCategoryIconKey,
} from "../categoryLabels.js";

describe("categoryLabels", () => {
  it("traduz pelo nome canônico do seed mesmo com icon_key presente", () => {
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

  // Regressão do review adversarial da PR #97: nome é a chave primária;
  // icon_key nunca sobrepõe um nome que já não bate mais com o canônico.
  it("categoria renomeada pelo usuário NÃO volta a mostrar a tradução antiga (nome é a chave primária)", () => {
    expect(
      categoryLabelPtForTag({ name: "Mercado do Zé", icon_key: "shopping-cart" }),
    ).toBe("Mercado do Zé");
  });

  it("renomear pra um nome PT canônico continua idempotente (não quebra ao salvar de volta)", () => {
    expect(categoryLabelPtForTag({ name: "Alimentação", icon_key: "shopping-cart" })).toBe(
      "Alimentação",
    );
  });

  it("icon_key só resolve quando não há nome nenhum (desempate, não chave alternativa)", () => {
    expect(categoryLabelPtForTag({ name: null, icon_key: "shopping-cart" })).toBe("Alimentação");
    expect(categoryLabelPtForTag({ name: "", icon_key: "car" })).toBe("Transporte");
  });
});

describe("detailLabelPtForTag", () => {
  // Nomes reais do seed `CANONICAL_CATEGORY_SEED` (fincla-api/seed_default_tags.py) —
  // toda organização nova recebe essas ~25 tags "detalhe" automaticamente, sempre
  // com `is_default: true`. Só traduzimos quando a tag É de fato essa linha do seed.
  it("traduz os nomes das tags-filha do seed quando is_default é true", () => {
    expect(detailLabelPtForTag({ name: "grocery", is_default: true })).toBe("mercado");
    expect(detailLabelPtForTag({ name: "restaurant", is_default: true })).toBe("restaurante");
    expect(detailLabelPtForTag({ name: "fuel", is_default: true })).toBe("combustível");
    expect(detailLabelPtForTag({ name: "health_plan", is_default: true })).toBe("plano de saúde");
    expect(detailLabelPtForTag({ name: "salary", is_default: true })).toBe("salário");
  });

  it("é case/acento-insensível e tolera variações de grafia", () => {
    expect(detailLabelPtForTag({ name: "Health_Plan", is_default: true })).toBe("plano de saúde");
    expect(detailLabelPtForTag({ name: "Health Plan", is_default: true })).toBe("plano de saúde");
  });

  it("deixa passar tag já em PT criada pelo usuário (is_default: false)", () => {
    expect(detailLabelPtForTag({ name: "pix-solidário", is_default: false })).toBe(
      "pix-solidário",
    );
    expect(detailLabelPtForTag({ name: "presente especial", is_default: false })).toBe(
      "presente especial",
    );
  });

  // Regressão do review adversarial da PR #97: tag do usuário com o MESMO texto
  // de um nome do seed não pode ser sequestrada pelo mapa — ela não é a linha
  // do seed, só coincide o nome, e o usuário precisa continuar achando a própria tag.
  it("NÃO traduz tag do usuário só porque o texto coincide com um nome do seed (is_default: false)", () => {
    expect(detailLabelPtForTag({ name: "App", is_default: false })).toBe("App");
    expect(detailLabelPtForTag({ name: "Book", is_default: false })).toBe("Book");
    expect(detailLabelPtForTag({ name: "Bar", is_default: false })).toBe("Bar");
  });

  it("sem is_default no payload (shape antigo/desconhecido) não traduz — mais seguro que sequestrar", () => {
    expect(detailLabelPtForTag({ name: "grocery" })).toBe("grocery");
  });

  it("nunca mostra slug cru com underscore fora do mapa: humaniza e registra (is_default: true)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(detailLabelPtForTag({ name: "some_unmapped_tag", is_default: true })).toBe(
      "some unmapped tag",
    );
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  // Regressão: slug de uma palavra só (sem "_") também precisa avisar quando
  // is_default é true e não está no mapa — antes vazava cru e calado.
  it("slug de palavra única sem tradução também avisa quando is_default é true", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(detailLabelPtForTag({ name: "gym", is_default: true })).toBe("gym");
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("avisa só uma vez por nome não mapeado, não a cada chamada", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    detailLabelPtForTag({ name: "totally_unmapped_xyz", is_default: true });
    detailLabelPtForTag({ name: "totally_unmapped_xyz", is_default: true });
    detailLabelPtForTag({ name: "totally_unmapped_xyz", is_default: true });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("aceita o shape de tag do endpoint de transações (name + is_default)", () => {
    expect(
      detailLabelPtForTag({
        id: "t1",
        name: "uber",
        parent_category_tag_id: "c1",
        is_default: true,
      }),
    ).toBe("uber");
  });

  it("string vazia/tag nula não quebra", () => {
    expect(detailLabelPtForTag(null)).toBe("");
    expect(detailLabelPtForTag({ name: "", is_default: true })).toBe("");
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
