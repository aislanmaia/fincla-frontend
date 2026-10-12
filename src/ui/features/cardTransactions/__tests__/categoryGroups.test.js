import { describe, expect, it } from "vitest";
import { groupCategories } from "../categoryGroups.js";

const row = (category, amount) => ({ category, amount, amount_currency: "BRL" });

describe("groupCategories", () => {
  it("até o limite mostra todas, da maior para a menor", () => {
    const out = groupCategories([row("A", "10"), row("B", "30"), row("C", "20")]);
    expect(out.visible.map((r) => r.category)).toEqual(["B", "C", "A"]);
    expect(out.hidden).toBe(0);
  });

  it("passando de 5, mostra as 5 maiores e conta as demais, sem criar categoria nova", () => {
    const rows = [row("A", "100"), row("B", "90"), row("C", "80"), row("D", "70"), row("E", "60"), row("F", "50"), row("G", "-10")];
    const out = groupCategories(rows);
    expect(out.visible.map((r) => r.category)).toEqual(["A", "B", "C", "D", "E"]);
    expect(out.hidden).toBe(2);
    expect(out.all).toHaveLength(7);
  });

  it("exatamente 5 categorias não esconde nada", () => {
    expect(groupCategories(["A", "B", "C", "D", "E"].map((c, i) => row(c, String(50 - i)))).hidden).toBe(0);
  });
});
