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

  // Regressão do review adversarial da PR #97 (rodada 1): nome é a chave
  // primária; sem `is_default` no payload (shape do endpoint de agregação do
  // consultor, que nunca manda esse campo), icon_key nunca sobrepõe um nome
  // que não bate com o canônico.
  it("categoria renomeada pelo usuário NÃO volta a mostrar a tradução antiga (sem is_default no payload)", () => {
    expect(
      categoryLabelPtForTag({ name: "Mercado do Zé", icon_key: "shopping-cart" }),
    ).toBe("Mercado do Zé");
  });

  it("renomear pra um nome PT canônico continua idempotente (não quebra ao salvar de volta)", () => {
    expect(categoryLabelPtForTag({ name: "Alimentação", icon_key: "shopping-cart" })).toBe(
      "Alimentação",
    );
  });

  // Regressão do review adversarial da PR #97 (rodada 2, prioridade 2): o
  // primeiro gate ignorava `is_default` por completo — uma categoria CRIADA
  // PELO USUÁRIO com o mesmo texto de um nome canônico do seed
  // ("Health", "Services", "Transport", "Renda", "Outros"...) era sequestrada
  // pelo mapa. `is_default: false` é o único sinal confiável de "isto não é
  // a linha do seed" e bloqueia a tradução pelo nome.
  it("NÃO traduz categoria do usuário só porque o texto coincide com um nome canônico (is_default: false)", () => {
    expect(categoryLabelPtForTag({ name: "Health", is_default: false })).toBe("Health");
    expect(categoryLabelPtForTag({ name: "Services", is_default: false })).toBe("Services");
    expect(categoryLabelPtForTag({ name: "Transport", is_default: false })).toBe("Transport");
    expect(categoryLabelPtForTag({ name: "Renda", is_default: false })).toBe("Renda");
    expect(categoryLabelPtForTag({ name: "Outros", is_default: false })).toBe("Outros");
  });

  // Prioridade 3 do review (rodada 2): a rede de segurança do icon_key volta
  // a existir, mas só para uma linha CONFIRMADAMENTE do seed (`is_default:
  // true`) cujo nome não bate com o mapa (ex.: dado legado de uma migração
  // de categoria antiga). Sem `icon_key` nem `tag_id` nos dois endpoints de
  // agregação do consultor, essa rede nunca entra em jogo lá.
  it("icon_key é rede de segurança só quando is_default é true e o nome não bate com o mapa", () => {
    expect(
      categoryLabelPtForTag({ name: "Categoria Legada X", icon_key: "home", is_default: true }),
    ).toBe("Moradia");
  });

  it("icon_key sem nome nenhum também exige is_default true (payload de agregação nunca manda icon_key)", () => {
    expect(categoryLabelPtForTag({ name: null, icon_key: "shopping-cart", is_default: true })).toBe(
      "Alimentação",
    );
    expect(categoryLabelPtForTag({ name: "", icon_key: "car" })).toBe("Categoria");
  });

  // Trade-off conhecido e intencional da prioridade 3 (documentado, não é
  // bug): como o backend nunca reseta `is_default` ao renomear uma
  // categoria do seed, uma categoria renomeada que ainda tem `is_default:
  // true` volta a cair na rede de segurança do icon_key. A prioridade 1
  // (handleUpdateCat) garante que o PATCH em si nunca reescreve o nome sem
  // necessidade — este é só o caso em que o usuário renomeia de propósito
  // para um texto que não é nenhum nome canônico.
  it("[trade-off conhecido] categoria com is_default:true renomeada pro usuário ainda cai no icon_key", () => {
    expect(
      categoryLabelPtForTag({ name: "Mercado do Zé", icon_key: "shopping-cart", is_default: true }),
    ).toBe("Alimentação");
  });

  // Shape real dos endpoints de agregação do consultor (`tag_name` sem
  // `is_default` nem `icon_key`) — precisa continuar traduzindo.
  it("traduz normalmente o shape do endpoint de agregação do consultor (sem is_default/icon_key)", () => {
    expect(categoryLabelPtForTag({ tag_name: "Housing" })).toBe("Moradia");
    expect(categoryLabelPtForTag({ name: "Health" })).toBe("Saúde");
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

  it("nunca mostra slug cru com underscore fora do mapa: humaniza (is_default: true)", () => {
    expect(detailLabelPtForTag({ name: "some_unmapped_tag", is_default: true })).toBe(
      "some unmapped tag",
    );
  });

  // Regressão #100 (achado 2): o backend nunca reseta `is_default` ao
  // renomear uma tag semeada, então "is_default: true + nome fora do mapa"
  // cobre tanto dado legado quanto uma tag semeada renomeada de propósito
  // (o caso comum, ex.: "restaurant" → "chopp"). Sem sinal pra distinguir os
  // dois, o fallback é silencioso — igual ao de `categoryLabelPtForTag` —
  // pra nunca acusar no console um nome legítimo escolhido pela pessoa.
  it("renomear a tag semeada pra fora do mapa não dispara console.warn (regressão #100)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(detailLabelPtForTag({ name: "some_unmapped_tag", is_default: true })).toBe(
      "some unmapped tag",
    );
    // Slug de palavra única (sem "_") também precisa cair no mesmo fallback
    // silencioso — antes só esse caso específico avisava.
    expect(detailLabelPtForTag({ name: "gym", is_default: true })).toBe("gym");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("mesmo nome não mapeado repetido continua consistente entre chamadas (sem estado de módulo)", () => {
    expect(detailLabelPtForTag({ name: "totally_unmapped_xyz", is_default: true })).toBe(
      "totally unmapped xyz",
    );
    expect(detailLabelPtForTag({ name: "totally_unmapped_xyz", is_default: true })).toBe(
      "totally unmapped xyz",
    );
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
