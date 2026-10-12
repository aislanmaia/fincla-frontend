import { describe, expect, it } from "vitest";
import { groupCategories } from "../categoryGroups.js";

const row = (category, amount) => ({ category, amount, amount_currency: "BRL" });

describe("groupCategories", () => {
  it("até o limite mostra todas, da maior para a menor", () => {
    const out = groupCategories([row("A", "10"), row("B", "30"), row("C", "20")]);
    expect(out.visible.map((r) => r.category)).toEqual(["B", "C", "A"]);
    expect(out.others).toBeNull();
  });

  it("passando de 5, mostra 4 e junta o resto em Outros com a soma real", () => {
    const rows = [row("A", "100"), row("B", "90"), row("C", "80"), row("D", "70"), row("E", "60"), row("F", "50"), row("G", "-10")];
    const out = groupCategories(rows);
    expect(out.visible).toHaveLength(5);
    expect(out.visible.slice(0, 4).map((r) => r.category)).toEqual(["A", "B", "C", "D"]);
    expect(out.visible[4]).toMatchObject({ category: "Outros", isOthers: true, count: 3, amount: 100, amount_currency: "BRL" });
    expect(out.all).toHaveLength(7);
  });

  it("exatamente 5 categorias não agrupa nada", () => {
    expect(groupCategories(["A", "B", "C", "D", "E"].map((c, i) => row(c, String(50 - i)))).others).toBeNull();
  });
});
