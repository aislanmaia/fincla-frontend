import { describe, expect, it } from "vitest";
import { plural } from "../plural.js";

describe("plural", () => {
  it("usa o singular só para 1", () => {
    expect(plural(1, "item", "itens")).toBe("1 item");
    expect(plural(0, "item", "itens")).toBe("0 itens");
    expect(plural(2, "lançamento", "lançamentos")).toBe("2 lançamentos");
  });
});

describe("plural — entradas vindas da API", () => {
  it("trata '1' em texto como 1", () => {
    expect(plural("1", "lançamento", "lançamentos")).toBe("1 lançamento");
  });
});
