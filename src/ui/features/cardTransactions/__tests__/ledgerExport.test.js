import { describe, expect, it } from "vitest";
import { buildPrintHtml } from "../ledgerExport.js";

describe("extrato imprimível", () => {
  it("escapa HTML vindo de descrições de lançamento", () => {
    const html = buildPrintHtml({ title: "Extrato", subtitle: "2 lançamentos", header: ["Descrição"], lines: [["<img src=x onerror=alert(1)>"], ["A & B"]] });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("A &amp; B");
  });
});
