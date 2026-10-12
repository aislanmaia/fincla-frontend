import { describe, expect, it } from "vitest";
import { buildCsv, buildPdfParts, buildPrintHtml } from "../ledgerExport.js";

describe("extrato imprimível", () => {
  it("escapa HTML vindo de descrições de lançamento", () => {
    const html = buildPrintHtml({ title: "Extrato", subtitle: "2 lançamentos", header: ["Descrição"], lines: [["<img src=x onerror=alert(1)>"], ["A & B"]] });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("A &amp; B");
  });
});

describe("extrato CSV/PDF do ledger", () => {
  const rows = [
    { date: "2026-10-02", description: "Notebook", value: 100, value_currency: "BRL", type: "expense", status: "confirmed", category: "Compras" },
    { date: "2026-10-03", description: "=HYPERLINK(\"x\")", value: 100, value_currency: "BRL", type: "refund", status: "paid", category: "Compras" },
  ];
  it("assina o valor e traz o tipo: compra e estorno de 100 somam zero", () => {
    const lines = buildCsv(rows, "BRL").split("\r\n");
    expect(lines[0]).toContain('"Tipo","Valor"');
    expect(lines[1]).toContain('"Despesa","-100.00"');
    expect(lines[2]).toContain('"Estorno","100.00"');
  });
  it("protege contra fórmula toda coluna de texto, não só duas posições", () => {
    expect(buildCsv(rows, "BRL")).toContain(`"'=HYPERLINK(""x"")"`);
  });
  it("o PDF mostra o sinal junto do valor", () => {
    const { lines } = buildPdfParts(rows, "BRL");
    expect(lines[0].join(" ")).toMatch(/−.*100,00/);
    expect(lines[1].join(" ")).toMatch(/\+.*100,00/);
  });
});
