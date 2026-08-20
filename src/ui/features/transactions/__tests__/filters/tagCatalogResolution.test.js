import { describe, expect, it } from "vitest";
import {
  buildTagOptions,
  isTagFilterBlocked,
  resolveTagFilterStatus,
  tagFilterStatusMessage,
  tagOptionsToDisplayMap,
} from "../../filters/tagCatalogResolution.js";

// fincla-frontend#96 — revisão adversarial da PR #96 (achados 1, 3, 4).
// Estas provas são desenhadas para reprovar a implementação ANTERIOR de cada
// achado: um `Map` nome→id que guarda só a primeira ocorrência (achado 1) e
// uma resolução que colapsa "não resolveu" em "sem filtro" (achado 4).

describe("buildTagOptions — achado 1: tags homônimas sob categorias diferentes", () => {
  const categoryLabelById = new Map([
    ["cat-casa", "Casa"],
    ["cat-trab", "Trabalho"],
  ]);

  it("duas tags 'mensal' (Casa e Trabalho) viram DUAS opções com ids distintos", () => {
    const rows = [
      { id: "tag-mensal-casa", name: "mensal", parent_category_tag_id: "cat-casa" },
      { id: "tag-mensal-trab", name: "mensal", parent_category_tag_id: "cat-trab" },
    ];

    const options = buildTagOptions(rows, categoryLabelById);

    // Prova direta do achado 1: um `Map` "primeiro nome vence" produziria UMA
    // opção só. Aqui têm que sobrar as duas, com ids diferentes.
    expect(options).toHaveLength(2);
    const ids = options.map((o) => o.id).sort();
    expect(ids).toEqual(["tag-mensal-casa", "tag-mensal-trab"].sort());

    // E os rótulos exibidos precisam ser únicos (1:1 com o id) — senão o
    // painel voltaria a oferecer um chip ambíguo.
    const labels = new Set(options.map((o) => o.displayLabel));
    expect(labels.size).toBe(2);
    expect([...labels].some((l) => l.includes("Casa"))).toBe(true);
    expect([...labels].some((l) => l.includes("Trabalho"))).toBe(true);
  });

  it("resolve cada rótulo desambiguado de volta para o id CORRETO (não o outro)", () => {
    const rows = [
      { id: "tag-mensal-casa", name: "mensal", parent_category_tag_id: "cat-casa" },
      { id: "tag-mensal-trab", name: "mensal", parent_category_tag_id: "cat-trab" },
    ];
    const options = buildTagOptions(rows, categoryLabelById);
    const displayToId = tagOptionsToDisplayMap(options);

    const casaLabel = options.find((o) => o.id === "tag-mensal-casa").displayLabel;
    const trabLabel = options.find((o) => o.id === "tag-mensal-trab").displayLabel;

    expect(displayToId.get(casaLabel)).toBe("tag-mensal-casa");
    expect(displayToId.get(trabLabel)).toBe("tag-mensal-trab");
    // As duas resoluções não podem apontar pro mesmo id.
    expect(displayToId.get(casaLabel)).not.toBe(displayToId.get(trabLabel));
  });

  it("nome sem colisão não ganha sufixo — não precisa desambiguar quem já é único", () => {
    const rows = [{ id: "tag-ifood", name: "ifood", parent_category_tag_id: "cat-casa" }];
    const options = buildTagOptions(rows, categoryLabelById);
    expect(options).toEqual([{ id: "tag-ifood", name: "ifood", displayLabel: "ifood" }]);
  });

  it("colisão sem categoria pai resolvível cai em 'sem categoria', não quebra", () => {
    const rows = [
      { id: "tag-a", name: "mensal", parent_category_tag_id: null },
      { id: "tag-b", name: "mensal", parent_category_tag_id: "cat-desconhecida" },
    ];
    const options = buildTagOptions(rows, categoryLabelById);
    expect(options).toHaveLength(2);
    expect(options.every((o) => o.displayLabel.includes("sem categoria"))).toBe(true);
    // Mesmo sem rótulo de categoria bonito, os ids continuam corretos.
    expect(new Set(options.map((o) => o.id)).size).toBe(2);
  });

  it("linhas inválidas (sem id ou nome) são ignoradas sem quebrar as demais", () => {
    const rows = [
      { id: null, name: "x" },
      { id: "ok", name: "" },
      { id: "tag-ifood", name: "ifood", parent_category_tag_id: "cat-casa" },
    ];
    expect(buildTagOptions(rows, categoryLabelById)).toEqual([
      { id: "tag-ifood", name: "ifood", displayLabel: "ifood" },
    ]);
  });
});

describe("resolveTagFilterStatus — achado 4: nunca colapsar 'não resolveu' em 'sem filtro'", () => {
  const displayToId = new Map([["ifood", "tag-ifood"]]);

  it("nenhuma tag selecionada -> 'none' (isso sim é 'sem filtro')", () => {
    expect(
      resolveTagFilterStatus({ selectedLabel: null, loading: false, error: "", displayToId }),
    ).toEqual({ kind: "none" });
    expect(
      resolveTagFilterStatus({ selectedLabel: "", loading: false, error: "", displayToId }),
    ).toEqual({ kind: "none" });
  });

  it("tag selecionada e catálogo carregando -> 'loading', NUNCA 'none'", () => {
    const status = resolveTagFilterStatus({
      selectedLabel: "ifood",
      loading: true,
      error: "",
      displayToId: new Map(), // catálogo ainda vazio (carregando)
    });
    expect(status.kind).toBe("loading");
    expect(status.kind).not.toBe("none");
  });

  it("tag selecionada e catálogo falhou -> 'error', NUNCA 'none'", () => {
    const status = resolveTagFilterStatus({
      selectedLabel: "ifood",
      loading: false,
      error: "network down",
      displayToId: new Map(),
    });
    expect(status.kind).toBe("error");
  });

  it("tag selecionada, catálogo carregado, rótulo não existe mais -> 'unresolved', NUNCA 'none'", () => {
    // Cenário real: view salva com uma tag que foi renomeada ou apagada. A
    // implementação anterior fazia `map.get(nome) ?? [] -> filterCat: "todas"`
    // — ou seja, um filtro que falhou virava a lista inteira. Esta asserção é
    // exatamente o que reprova esse comportamento: o kind tem que ser
    // "unresolved", nunca silenciosamente "none"/"resolved".
    const status = resolveTagFilterStatus({
      selectedLabel: "tag-apagada",
      loading: false,
      error: "",
      displayToId,
    });
    expect(status.kind).toBe("unresolved");
    expect(status).not.toHaveProperty("id");
  });

  it("tag selecionada e encontrada -> 'resolved' com o id certo", () => {
    const status = resolveTagFilterStatus({
      selectedLabel: "ifood",
      loading: false,
      error: "",
      displayToId,
    });
    expect(status).toEqual({ kind: "resolved", id: "tag-ifood", label: "ifood" });
  });
});

describe("isTagFilterBlocked / tagFilterStatusMessage", () => {
  it("bloqueia loading, error e unresolved — nunca deixa a busca rodar sem o filtro esperado", () => {
    expect(isTagFilterBlocked({ kind: "loading" })).toBe(true);
    expect(isTagFilterBlocked({ kind: "error" })).toBe(true);
    expect(isTagFilterBlocked({ kind: "unresolved" })).toBe(true);
  });

  it("não bloqueia 'none' (sem filtro de verdade) nem 'resolved' (filtro pronto)", () => {
    expect(isTagFilterBlocked({ kind: "none" })).toBe(false);
    expect(isTagFilterBlocked({ kind: "resolved", id: "x" })).toBe(false);
  });

  it("cada estado bloqueado tem uma mensagem visível e distinta", () => {
    const loading = tagFilterStatusMessage({ kind: "loading" });
    const error = tagFilterStatusMessage({ kind: "error" });
    const unresolved = tagFilterStatusMessage({ kind: "unresolved", label: "tag-x" });
    expect(loading).toMatch(/carregando/i);
    expect(error).toMatch(/não foi possível/i);
    expect(unresolved).toMatch(/tag-x/);
    expect(new Set([loading, error, unresolved]).size).toBe(3);
  });
});
