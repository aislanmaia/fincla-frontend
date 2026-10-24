import { describe, expect, it } from "vitest";

import { plural } from "../plural.js";

describe("plural", () => {
  it("concorda com a contagem", () => {
    expect(plural(1, "parcela", "parcelas")).toBe("1 parcela");
    expect(plural(0, "parcela", "parcelas")).toBe("0 parcelas");
    expect(plural(3, "parcela", "parcelas")).toBe("3 parcelas");
  });
  it("formata milhares em pt-BR e aceita número em texto", () => {
    expect(plural(1234, "lançamento", "lançamentos")).toBe("1.234 lançamentos");
    expect(plural("1", "lançamento", "lançamentos")).toBe("1 lançamento");
  });
});
