/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildNewView,
  countActiveFiltersInSnapshot,
  describeView,
  isValidView,
  normalizeView,
  shouldShowSavedViewsSection,
  viewSnapshotsEqual,
} from "../../filters/savedViews/savedViewsModel.js";
import {
  readSavedViews,
  writeSavedViews,
  clearSavedViews,
} from "../../filters/savedViews/savedViewsStorage.js";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("savedViewsModel", () => {
  it("isValidView rejeita objetos sem campos obrigatórios", () => {
    expect(isValidView(null)).toBe(false);
    expect(isValidView({})).toBe(false);
    expect(isValidView({ id: "1" })).toBe(false);
    expect(
      isValidView({ id: "v1", label: "x", icon: "bookmark", color: "#000" }),
    ).toBe(true);
  });

  it("isValidView rejeita ícones fora do catálogo aprovado", () => {
    expect(
      isValidView({ id: "v1", label: "x", icon: "lol", color: "#000" }),
    ).toBe(false);
  });

  it("buildNewView produz id determinístico a partir do `now`", () => {
    const v = buildNewView({
      name: "  Teste  ",
      icon: "bookmark",
      color: "#000",
      filters: { period: "mes" },
      now: 1234,
    });
    expect(v).toEqual({
      id: "v1234",
      label: "Teste",
      icon: "bookmark",
      color: "#000",
      filters: { period: "mes" },
      createdAt: 1234,
    });
  });

  it("buildNewView devolve null se nome vazio", () => {
    expect(
      buildNewView({ name: "   ", icon: "bookmark", color: "#000", now: 1 }),
    ).toBeNull();
  });

  it("normalizeView preenche filters/createdAt ausentes", () => {
    const v = normalizeView({
      id: "v1",
      label: "x",
      icon: "tag",
      color: "#000",
    });
    expect(v.filters).toEqual({});
    expect(typeof v.createdAt).toBe("number");
  });

  it("countActiveFiltersInSnapshot ignora defaults", () => {
    expect(countActiveFiltersInSnapshot({ period: "mes", type: "todos" })).toBe(0);
    expect(countActiveFiltersInSnapshot({ searchInput: "mercado" })).toBe(1);
    expect(
      countActiveFiltersInSnapshot({
        period: "hoje",
        type: "despesa",
        cats: ["alim"],
        tags: ["trabalho"],
        cardSel: [],
        rec: "yes",
        valueMin: "100",
      }),
    ).toBe(6);
  });

  it("viewSnapshotsEqual compara busca, sort e facets", () => {
    expect(
      viewSnapshotsEqual(
        { type: "receita", searchInput: "foo" },
        { type: "receita", searchInput: "foo" },
      ),
    ).toBe(true);
    expect(
      viewSnapshotsEqual(
        { type: "receita", searchInput: "foo" },
        { type: "receita", searchInput: "bar" },
      ),
    ).toBe(false);
  });

  it("describeView devolve hint conforme contagem", () => {
    const v = buildNewView({ name: "x", icon: "bookmark", color: "#000", now: 1 });
    expect(describeView(v, 0)).toBe("Sem filtros");
    expect(describeView(v, 1)).toBe("1 filtro");
    expect(describeView(v, 3)).toBe("3 filtros");
  });

  it("shouldShowSavedViewsSection: views salvas ou filtros ativos", () => {
    expect(shouldShowSavedViewsSection(0, false)).toBe(false);
    expect(shouldShowSavedViewsSection(2, false)).toBe(true);
    expect(shouldShowSavedViewsSection(0, true)).toBe(true);
    expect(shouldShowSavedViewsSection(1, true)).toBe(true);
  });
});

describe("savedViewsStorage", () => {
  it("retorna [] quando não há organização", () => {
    expect(readSavedViews(null)).toEqual([]);
    expect(readSavedViews("")).toEqual([]);
  });

  it("escrita + leitura preserva apenas views válidas", () => {
    writeSavedViews("org-1", [
      buildNewView({ name: "A", icon: "bookmark", color: "#000", now: 1 }),
      { lixo: true },
      buildNewView({ name: "B", icon: "card", color: "#111", now: 2 }),
    ]);
    const out = readSavedViews("org-1");
    expect(out.map((v) => v.label)).toEqual(["A", "B"]);
  });

  it("isolamento por organização", () => {
    writeSavedViews("org-1", [
      buildNewView({ name: "A", icon: "bookmark", color: "#000", now: 1 }),
    ]);
    writeSavedViews("org-2", [
      buildNewView({ name: "B", icon: "card", color: "#111", now: 2 }),
    ]);
    expect(readSavedViews("org-1").map((v) => v.label)).toEqual(["A"]);
    expect(readSavedViews("org-2").map((v) => v.label)).toEqual(["B"]);
  });

  it("clearSavedViews zera a coleção", () => {
    writeSavedViews("org-1", [
      buildNewView({ name: "A", icon: "bookmark", color: "#000", now: 1 }),
    ]);
    clearSavedViews("org-1");
    expect(readSavedViews("org-1")).toEqual([]);
  });

  it("tolera JSON malformado no localStorage", () => {
    localStorage.setItem("fincla.transactions.savedViews.v1", "{not json");
    expect(readSavedViews("org-1")).toEqual([]);
  });

  it("ignora versões diferentes da atual", () => {
    localStorage.setItem(
      "fincla.transactions.savedViews.v1",
      JSON.stringify({ version: 99, orgs: { "org-1": [] } }),
    );
    expect(readSavedViews("org-1")).toEqual([]);
  });
});
