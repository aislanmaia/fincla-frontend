import { describe, expect, it } from "vitest";
import {
  DEFAULT_SORT,
  addRule,
  availableFields,
  compareByField,
  decodeSort,
  encodeSort,
  isDefaultSort,
  moveRule,
  removeRule,
  sortItems,
  toggleDir,
} from "../../filters/search/sortModel.js";

const ITEMS = [
  { id: 1, date: "22/05", desc: "Salário", val: 12500, cat: "receita" },
  { id: 2, date: "21/05", desc: "iFood", val: -54.9, cat: "alim" },
  { id: 3, date: "21/05", desc: "Uber", val: -82.4, cat: "trans" },
  { id: 4, date: "20/05", desc: "Spotify", val: -34.9, cat: "ass" },
  { id: 5, date: "21/05", desc: "iFood", val: -120, cat: "alim" },
];

describe("sortModel", () => {
  it("DEFAULT_SORT é [date desc]", () => {
    expect(DEFAULT_SORT).toEqual([{ field: "date", dir: "desc" }]);
    expect(isDefaultSort([{ field: "date", dir: "desc" }])).toBe(true);
    expect(isDefaultSort([{ field: "val", dir: "desc" }])).toBe(false);
    expect(isDefaultSort([])).toBe(false);
  });

  it("sortItems retorna nova cópia sem mutar o original", () => {
    const input = ITEMS.slice();
    const result = sortItems(input, DEFAULT_SORT);
    expect(result).not.toBe(input);
    expect(input.map((t) => t.id)).toEqual([1, 2, 3, 4, 5]);
    expect(result.map((t) => t.id)).toEqual([1, 2, 3, 5, 4]);
  });

  it("compareByField avalia cada campo", () => {
    expect(compareByField({ val: 10 }, { val: 5 }, "val")).toBeGreaterThan(0);
    expect(compareByField({ val: -10 }, { val: 5 }, "tipo")).toBeLessThan(0);
    expect(compareByField({ desc: "abacate" }, { desc: "banana" }, "desc")).toBeLessThan(0);
    expect(compareByField({ date: "21/05" }, { date: "22/05" }, "date")).toBeLessThan(0);
  });

  it("aplica a cascata de prioridades: data desc, valor asc desempata", () => {
    const result = sortItems(ITEMS, [
      { field: "date", dir: "desc" },
      { field: "val", dir: "asc" },
    ]);
    // 22/05 primeiro, depois 21/05 (com val crescente: -120, -82.4, -54.9), depois 20/05
    expect(result.map((t) => t.id)).toEqual([1, 5, 3, 2, 4]);
  });

  it("aceita 3 critérios encadeados e respeita o terceiro só nos empates", () => {
    const result = sortItems(ITEMS, [
      { field: "date", dir: "desc" },
      { field: "cat", dir: "asc" },
      { field: "desc", dir: "asc" },
    ]);
    // 22/05 → id1; 21/05 cats: alim, alim, trans → entre os dois 'alim' usa desc asc
    //   alim(iFood id2 val -54.9, iFood id5 val -120) ambos desc='iFood' empata, ids 2 e 5 mantêm ordem estável
    // 20/05 → id4
    expect(result.slice(0, 1).map((t) => t.id)).toEqual([1]);
    expect(result[result.length - 1].id).toBe(4);
    const middle = result.slice(1, 4);
    // categoria asc: alim, alim, trans
    expect(middle.map((t) => t.cat)).toEqual(["alim", "alim", "trans"]);
  });

  it("sortItems sem regras devolve cópia na ordem de entrada", () => {
    const result = sortItems(ITEMS, []);
    expect(result).not.toBe(ITEMS);
    expect(result.map((t) => t.id)).toEqual(ITEMS.map((t) => t.id));
  });

  describe("manipulação imutável", () => {
    it("addRule adiciona campo no fim com dir default e ignora duplicatas", () => {
      const a = addRule(DEFAULT_SORT, "val");
      expect(a).toEqual([
        { field: "date", dir: "desc" },
        { field: "val", dir: "desc" },
      ]);
      // duplicata
      expect(addRule(a, "val")).toEqual(a);
      // campo inválido
      expect(addRule(a, "lol")).toEqual(a);
    });

    it("removeRule remove pelo índice", () => {
      const r = removeRule(
        [
          { field: "date", dir: "desc" },
          { field: "val", dir: "asc" },
        ],
        0,
      );
      expect(r).toEqual([{ field: "val", dir: "asc" }]);
    });

    it("toggleDir inverte a direção", () => {
      const t = toggleDir([{ field: "date", dir: "desc" }], 0);
      expect(t).toEqual([{ field: "date", dir: "asc" }]);
    });

    it("moveRule desloca dentro do array, ignora extremos", () => {
      const r = [
        { field: "date", dir: "desc" },
        { field: "val", dir: "asc" },
        { field: "cat", dir: "asc" },
      ];
      expect(moveRule(r, 0, -1)).toBe(r); // já no topo
      expect(moveRule(r, 2, +1)).toBe(r); // já no fim
      expect(moveRule(r, 0, +1).map((x) => x.field)).toEqual(["val", "date", "cat"]);
      expect(moveRule(r, 2, -1).map((x) => x.field)).toEqual(["date", "cat", "val"]);
    });

    it("availableFields lista o que não está em uso", () => {
      expect(availableFields([{ field: "date", dir: "desc" }])).toEqual([
        "val",
        "tipo",
        "desc",
        "cat",
      ]);
      expect(availableFields([]).length).toBe(5);
    });
  });

  describe("encode/decode", () => {
    it("encode produz a forma `field:dir,field:dir`", () => {
      expect(
        encodeSort([
          { field: "date", dir: "desc" },
          { field: "val", dir: "asc" },
        ]),
      ).toBe("date:desc,val:asc");
    });

    it("decode tolera campos desconhecidos", () => {
      expect(decodeSort("date:desc,foo:asc,val:asc")).toEqual([
        { field: "date", dir: "desc" },
        { field: "val", dir: "asc" },
      ]);
      expect(decodeSort("")).toEqual([]);
    });

    it("encode/decode é roundtrip", () => {
      const r = [
        { field: "date", dir: "desc" },
        { field: "val", dir: "asc" },
        { field: "cat", dir: "desc" },
      ];
      expect(decodeSort(encodeSort(r))).toEqual(r);
    });
  });
});
