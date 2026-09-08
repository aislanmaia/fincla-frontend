import { describe, expect, it } from "vitest";

import { fmtMoney } from "../consultantFormat.js";
import { totalPatrimonio } from "../consultantClientsView.js";

/**
 * O backend se recusa a dar um total parcial da carteira: o consultor decidiria
 * sobre ele sem saber que falta gente dentro (fincla-api#144). Se a tela coagir
 * `null` para zero, a garantia morre no último metro — e "R$ 0" é pior que "—",
 * porque afirma que o cliente não tem patrimônio.
 */
describe("patrimônio ausente não vira zero", () => {
  it("fmtMoney mostra ausência como ausência", () => {
    expect(fmtMoney(null)).toBe("—");
    expect(fmtMoney(undefined)).toBe("—");
    expect(fmtMoney("")).toBe("—");
  });

  it("zero de verdade continua sendo zero", () => {
    // Distinguir "não sei" de "é zero" é o ponto inteiro.
    expect(fmtMoney(0)).not.toBe("—");
    expect(fmtMoney("0")).not.toBe("—");
  });

  it("valor normal segue formatado, com sinal só quando negativo", () => {
    expect(fmtMoney(1234)).toContain("1.234");
    expect(fmtMoney(-50)).toContain("−");
  });

  it("um cliente sem patrimônio apaga o total da carteira", () => {
    const clientes = [{ patrimonio: "700" }, { patrimonio: null }, { patrimonio: "300" }];

    // 1000 esconderia que um cliente não entrou na conta.
    expect(totalPatrimonio(clientes)).toBeNull();
  });

  it("carteira inteira consolidada soma normalmente", () => {
    expect(totalPatrimonio([{ patrimonio: "700" }, { patrimonio: "300" }])).toBe(1000);
  });

  it("carteira vazia é zero, não ausência", () => {
    // Nenhum cliente é uma resposta conhecida; um cliente ilegível não é.
    expect(totalPatrimonio([])).toBe(0);
    expect(totalPatrimonio(null)).toBe(0);
  });
});
