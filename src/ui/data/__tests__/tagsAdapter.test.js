import { describe, expect, it } from "vitest";
import { mapCategoryTagsForUi, mapCategoryTagsToOptions } from "../tagsAdapter.js";

describe("tagsAdapter", () => {
  it("mapeia tags de categoria para opções únicas ordenadas por sort_order e nome", () => {
    expect(mapCategoryTagsToOptions([
      { id: "1", name: "Transporte", sort_order: 2 },
      { id: "2", name: "Alimentação", sort_order: 0 },
      { id: "3", name: "Transporte", sort_order: 2 },
      { id: "4", name: "Saúde", sort_order: 1 },
    ])).toEqual(["Alimentação", "Saúde", "Transporte"]);
  });

  it("mapCategoryTagsForUi expõe id, labelPt e icon_key", () => {
    const rows = mapCategoryTagsForUi([
      {
        id: "u1",
        name: "Food & Groceries",
        icon_key: "shopping-cart",
        color: "#059669",
        sort_order: 0,
      },
    ]);
    expect(rows).toEqual([
      expect.objectContaining({
        id: "u1",
        apiName: "Food & Groceries",
        labelPt: "Alimentação",
        iconKey: "shopping-cart",
        color: "#059669",
      }),
    ]);
  });
});
