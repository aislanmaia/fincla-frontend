import { describe, expect, it } from "vitest";
import { facetSentenceLabel } from "../../filters/facetSentenceLabel.js";

describe("facetSentenceLabel", () => {
  /* O defeito relatado: «O filtro "Tags: 3 tags (E)" é o que mais restringe».
     O valor já se nomeia porque precisa fazer sentido sozinho no chip da barra;
     prefixá-lo repete a palavra. */
  it("não prefixa um valor que já nomeia a faceta", () => {
    expect(facetSentenceLabel("Tags", "3 tags (E)")).toBe("3 tags (E)");
    expect(facetSentenceLabel("Tags", "2 tags (OU)")).toBe("2 tags (OU)");
    expect(facetSentenceLabel("Categoria", "3 categorias")).toBe("3 categorias");
  });

  it("prefixa quando o valor sozinho não diz de que faceta é", () => {
    expect(facetSentenceLabel("Categoria", "Transporte")).toBe("Categoria: Transporte");
    expect(facetSentenceLabel("Tags", "#médico")).toBe("Tags: #médico");
    expect(facetSentenceLabel("Situação", "A pagar")).toBe("Situação: A pagar");
    expect(facetSentenceLabel("Forma de pagamento", "Pix")).toBe("Forma de pagamento: Pix");
  });

  /* A raiz é a primeira palavra sem acento e sem plural. "Recorrência" não pode
     casar com "Apenas rec." — seriam duas coisas diferentes lidas como uma. */
  it("a raiz não casa por acidente", () => {
    expect(facetSentenceLabel("Recorrência", "Apenas rec.")).toBe("Recorrência: Apenas rec.");
    expect(facetSentenceLabel("Valor", "acima de R$ 100")).toBe("Valor: acima de R$ 100");
  });

  it("acento não impede o casamento", () => {
    // "Situação" → raiz "situacao"; um valor que a nomeie não deve ser prefixado.
    expect(facetSentenceLabel("Situação", "situação: paga")).toBe("situação: paga");
  });

  it("valor ausente não quebra a frase", () => {
    expect(facetSentenceLabel("Tags", null)).toBe("Tags: ");
    expect(facetSentenceLabel("Tags", undefined)).toBe("Tags: ");
  });
});
