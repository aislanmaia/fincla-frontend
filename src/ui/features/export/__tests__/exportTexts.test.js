import { describe, expect, it } from "vitest";

import { exportTexts } from "../exportTexts.js";

/** O catálogo de textos do painel e da prévia de exportação (fincla-api#520; QA BUG-01, BUG-03, BUG-04). */
const t = exportTexts("pt-BR");

describe("exportTexts — contagens concordam com o número (BUG-03)", () => {
  it.each([
    [0, "0 lançamentos"],
    [1, "1 lançamento"],
    [2, "2 lançamentos"],
    [1234, "1.234 lançamentos"],
  ])("recorte de %i → %s", (n, expected) => {
    expect(t.entries(n)).toBe(expected);
  });

  it.each([
    [1, "1 lançamento selecionado"],
    [3, "3 lançamentos selecionados"],
  ])("seleção de %i → %s", (n, expected) => {
    expect(t.selected(n)).toBe(expected);
  });

  it.each([
    [1, "1 pendente (incluído nos totais)"],
    [0, "0 pendentes (incluídos nos totais)"],
    [2, "2 pendentes (incluídos nos totais)"],
  ])("%i pendente(s) no passo 3 → %s", (n, expected) => {
    expect(t.pendingIncluded(n)).toBe(expected);
  });

  it.each([
    [1, 1, "LANÇAMENTOS: 1 (1 pendente, incluído nos totais)"],
    [2, 1, "LANÇAMENTOS: 2 (1 pendente, incluído nos totais)"],
    [2, 0, "LANÇAMENTOS: 2 (0 pendentes, incluídos nos totais)"],
    [1429, 3, "LANÇAMENTOS: 1429 (3 pendentes, incluídos nos totais)"],
  ])("linha do arquivo com %i e %i pendentes → %s (igual ao servidor)", (count, pending, expected) => {
    expect(t.fileCountLine(count, pending)).toBe(expected);
  });

  it("um idioma sem tradução cai no pt-BR", () => {
    expect(exportTexts("xx-YY").entries(1)).toBe("1 lançamento");
  });
});

describe("exportTexts — período em datas absolutas, com ano (BUG-04)", () => {
  it.each([
    ["2026-10-01", "2026-10-31", "Período: 01/10/2026 a 31/10/2026"],
    ["2026-11-02", "2026-11-02", "Período: 02/11/2026"],
    ["2025-12-15", "2026-01-14", "Período: 15/12/2025 a 14/01/2026"],
    ["2026-10-01", "", "Período: a partir de 01/10/2026"],
    ["", "2026-10-31", "Período: até 31/10/2026"],
    ["", "", "Período: todo o histórico"],
  ])("%s a %s → %s", (from, to, expected) => {
    expect(t.period(from, to)).toBe(expected);
  });
});

describe("exportTexts — etiquetas com o modo (BUG-01)", () => {
  it("duas ou mais etiquetas dizem o modo com o texto do painel de Tags", () => {
    expect(t.tags(["Farmácia", "Combustível"], "Todas juntas (E)")).toBe("Tags · Todas juntas (E): #Farmácia, #Combustível");
    expect(t.tags(["Farmácia", "Combustível"], "Qualquer uma (OU)")).toBe("Tags · Qualquer uma (OU): #Farmácia, #Combustível");
  });

  it("uma etiqueta só não tem modo a dizer", () => {
    expect(t.tags(["Farmácia"], "Todas juntas (E)")).toBe("Tags: #Farmácia");
  });

  it("sem etiqueta, nenhuma linha", () => {
    expect(t.tags([], "Todas juntas (E)")).toBeNull();
  });
});
