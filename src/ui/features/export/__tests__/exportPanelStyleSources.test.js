/**
 * G3-2-10: o painel e as prévias seguem o DESIGN.md — cores e sombras só pelos tokens de `src/ui/tokens.js`
 * (objeto `T`) e números de dinheiro só pelos formatadores de `src/ui/money/`. Um hex, um `rgba(` ou um
 * `toLocaleString` próprio no arquivo é exatamente o desvio que a revisão achou.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(fileURLToPath(new URL("../ExportPanel.jsx", import.meta.url)), "utf8");
// Comentários podem citar cores e funções; o que conta é o código.
const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("ExportPanel.jsx: só tokens e formatadores existentes", () => {
  it("nenhuma cor ou sombra literal", () => {
    expect(code.match(/["'`]#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(code.match(/rgba?\(/g) ?? []).toEqual([]);
  });

  it("nenhum formatador de número próprio", () => {
    expect(code.match(/toLocaleString|Intl\.NumberFormat/g) ?? []).toEqual([]);
  });
});
