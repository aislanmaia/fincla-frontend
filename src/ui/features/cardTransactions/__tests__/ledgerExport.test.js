import { describe, expect, it } from "vitest";
import { buildCategorySummary, buildCsv, buildPdfParts, buildPrintHtml } from "../ledgerExport.js";

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
  it("data e situação saem como a tela mostra, sem hora zerada nem código da API", () => {
    const dated = [{ date: "2026-10-27T00:00:00", description: "Aluguel", value: 10, value_currency: "BRL", type: "expense", status: "confirmed", category: "Moradia" }];
    expect(buildCsv(dated, "BRL").split("\r\n")[1]).toContain('"2026-10-27"');
    expect(buildCsv(dated, "BRL").split("\r\n")[1]).toContain('"A pagar"');
    const cells = buildPdfParts(dated, "BRL").lines[0];
    expect(cells[0]).toBe("27/10/2026");
    expect(cells.at(-1)).toBe("A pagar");
  });
  it("resume por categoria: compra soma, estorno abate e cada moeda fica separada", () => {
    const mixed = [
      { description: "A", value: 100, value_currency: "BRL", type: "expense", category: "Moradia" },
      { description: "B", value: 30, value_currency: "BRL", type: "refund", category: "Moradia" },
      { description: "C", value: 5, value_currency: "USD", type: "expense", category: "Moradia" },
    ];
    const { lines } = buildCategorySummary(mixed, "BRL");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual(["Moradia", "2", expect.stringMatching(/70,00/)]);
    expect(lines[1][2]).toMatch(/5,00/);
  });
  it("o relatório impresso traz o resumo antes da lista", () => {
    const parts = buildPdfParts(rows, "BRL");
    const html = buildPrintHtml({ title: "T", subtitle: "S", ...parts });
    expect(html.indexOf("Resumo por categoria")).toBeGreaterThan(-1);
    expect(html.indexOf("Resumo por categoria")).toBeLessThan(html.indexOf("<h2>Lançamentos</h2>"));
  });
  it("estorno que zera a compra não vira −0,00; status desconhecido sai com o código; data fora do padrão não vira traço", () => {
    const zero = [
      { description: "A", value: 100.1, value_currency: "BRL", type: "expense", category: "X" },
      { description: "B", value: 100.1, value_currency: "BRL", type: "refund", category: "X" },
    ];
    expect(buildCategorySummary(zero, "BRL").lines[0][2]).not.toContain("−");
    const odd = [{ date: "27/10/2026", description: "Z", value: 1, value_currency: "BRL", type: "expense", status: "overdue", category: "X" }];
    expect(buildCsv(odd, "BRL")).toContain('"overdue"');
    expect(buildPdfParts(odd, "BRL").lines[0][0]).toBe("27/10/2026");
  });
});
