// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DAY_HEADER_HEIGHT,
  DEFAULT_DENSITY,
  DENSITIES,
  densityRowHeight,
  groupingAllowed,
  readListPrefs,
  rowCost,
  writeListPrefs,
} from "../listPrefs.js";

describe("listPrefs", () => {
  beforeEach(() => localStorage.clear());

  it("o piso do mobile é 48, não 36 — alvo de toque vem antes de densidade", () => {
    expect(densityRowHeight("compacto", true)).toBe(48);
    expect(densityRowHeight("compacto", false)).toBe(36);
    for (const key of Object.keys(DENSITIES)) {
      expect(densityRowHeight(key, true)).toBeGreaterThanOrEqual(44);
    }
  });

  it("agrupar custa o cabeçalho de dia por transação", () => {
    expect(rowCost("padrao", false, false)).toBe(48);
    expect(rowCost("padrao", false, true)).toBe(48 + DAY_HEADER_HEIGHT);
  });

  it("densidade desconhecida cai no padrão em vez de quebrar o layout", () => {
    expect(densityRowHeight("inexistente", false)).toBe(DENSITIES[DEFAULT_DENSITY].desktop);
    localStorage.setItem("fincla:transactions:list-prefs", JSON.stringify({ density: "xpto" }));
    expect(readListPrefs().density).toBe(DEFAULT_DENSITY);
  });

  it("persiste e relê a preferência", () => {
    writeListPrefs({ density: "compacto", grouped: true });
    expect(readListPrefs()).toEqual({ density: "compacto", grouped: true });
  });

  it("JSON corrompido não derruba a tela", () => {
    localStorage.setItem("fincla:transactions:list-prefs", "{nao é json");
    expect(readListPrefs()).toEqual({ density: DEFAULT_DENSITY, grouped: false });
  });

  it("localStorage que lança (janela privativa) degrada para o padrão", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(readListPrefs()).toEqual({ density: DEFAULT_DENSITY, grouped: false });
    spy.mockRestore();
  });

  it("agrupar por data só vale ordenando por data", () => {
    expect(groupingAllowed("date")).toBe(true);
    expect(groupingAllowed(undefined)).toBe(true);
    expect(groupingAllowed("value")).toBe(false);
    expect(groupingAllowed("category")).toBe(false);
  });
});
