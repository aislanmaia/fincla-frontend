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
    expect(fmtMoney(null, "BRL")).toBe("—");
    expect(fmtMoney(undefined, "BRL")).toBe("—");
    expect(fmtMoney("", "BRL")).toBe("—");
  });

  it("zero de verdade continua sendo zero", () => {
    // Distinguir "não sei" de "é zero" é o ponto inteiro.
    expect(fmtMoney(0, "BRL")).not.toBe("—");
    expect(fmtMoney("0", "BRL")).not.toBe("—");
  });

  it("valor normal segue formatado, com sinal só quando negativo", () => {
    expect(fmtMoney(1234, "BRL")).toContain("1.234");
    expect(fmtMoney(-50, "BRL")).toContain("−");
  });

  it("um cliente sem patrimônio apaga o total da carteira", () => {
    const clientes = [{ patrimonio: "700", currency: "BRL" }, { patrimonio: null, currency: "BRL" }, { patrimonio: "300", currency: "BRL" }];

    // 1000 esconderia que um cliente não entrou na conta.
    expect(totalPatrimonio(clientes)).toBeNull();
  });

  it("carteira inteira consolidada soma normalmente", () => {
    expect(totalPatrimonio([{ patrimonio: "700", currency: "BRL" }, { patrimonio: "300", currency: "BRL" }]))
      .toEqual([{ currency: "BRL", amount: 1000 }]);
  });

  it("carteira mista soma POR MOEDA, nunca sob um símbolo só (#314)", () => {
    const clientes = [
      { patrimonio: "700", currency: "USD" }, { patrimonio: "300", currency: "BRL" }, { patrimonio: "50", currency: "USD" },
    ];
    expect(totalPatrimonio(clientes)).toEqual([{ currency: "BRL", amount: 300 }, { currency: "USD", amount: 750 }]);
  });

  it("cliente sem moeda conhecida apaga o total: não há pilha onde pô-lo", () => {
    expect(totalPatrimonio([{ patrimonio: "700", currency: "BRL" }, { patrimonio: "300", currency: null }])).toBeNull();
  });

  it("carteira vazia é zero, não ausência", () => {
    // Nenhum cliente é uma resposta conhecida; um cliente ilegível não é.
    expect(totalPatrimonio([])).toEqual([]);
    expect(totalPatrimonio(null)).toEqual([]);
  });
});
