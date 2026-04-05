/**
 * Testes unitários para o input de valor da Nova Transação.
 *
 * Replica a lógica de App.jsx:
 *   - handleValorKey: acumula dígitos em `centavos` e formata `valor`
 *   - valorNum: centavos / 100  (corrigido — antes usava parseFloat bugado)
 *
 * Bug original (linha 702): parseFloat(valor.replace(",","."))
 *   → para "4.500,00" produzia 4.5 em vez de 4500, pois o separador de
 *     milhar pt-BR (.) não era removido antes do parseFloat.
 */

import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Funções extraídas de App.jsx (lógica pura, sem React)
// ---------------------------------------------------------------------------

/** Acumula um dígito no estilo bancário (sem ponto decimal explícito). */
function pressDigit(centavos, digit) {
  return Math.min(centavos * 10 + digit, 9_999_999);
}

/** Formata centavos como string pt-BR, igual ao setValor de App.jsx. */
function formatValor(centavos) {
  return centavos === 0
    ? ""
    : (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

/**
 * Converte centavos para número — linha 702 de App.jsx (corrigida):
 *   const valorNum = centavos / 100;
 */
function derivarValorNum(centavos) {
  return centavos / 100;
}

/** Simula a sequência de dígitos digitados pelo usuário. */
function simularDigitacao(digitos) {
  let centavos = 0;
  for (const d of digitos) {
    centavos = pressDigit(centavos, d);
  }
  const valor = formatValor(centavos);
  const valorNum = derivarValorNum(centavos);
  return { centavos, valor, valorNum };
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("NovaTransacao — input de valor (estilo bancário)", () => {
  describe("valores abaixo de R$ 1.000 (sem separador de milhar)", () => {
    it("digitar 4, 5, 0 → R$ 4,50", () => {
      const { centavos, valor, valorNum } = simularDigitacao([4, 5, 0]);
      expect(centavos).toBe(450);
      expect(valor).toBe("4,50");
      expect(valorNum).toBe(4.5);
    });

    it("digitar 9, 9, 9 → R$ 9,99", () => {
      const { centavos, valor, valorNum } = simularDigitacao([9, 9, 9]);
      expect(centavos).toBe(999);
      expect(valor).toBe("9,99");
      expect(valorNum).toBe(9.99);
    });

    it("digitar 1, 0, 0 → R$ 1,00", () => {
      const { centavos, valor, valorNum } = simularDigitacao([1, 0, 0]);
      expect(centavos).toBe(100);
      expect(valor).toBe("1,00");
      expect(valorNum).toBe(1);
    });
  });

  describe("valores >= R$ 1.000 (separador de milhar no formato pt-BR)", () => {
    /**
     * Para digitar R$ 4.500,00 no input bancário, o usuário pressiona
     * as teclas: 4 5 0 0 0 0  (os dois últimos zeros são os centavos).
     *
     * Bug antigo: "4.500,00".replace(",",".") → "4.500.00" → parseFloat = 4.5
     * Correção:   centavos / 100 → 450000 / 100 = 4500 ✓
     */
    it("digitar 4500 (R$ 4.500,00) — valorNum deve ser 4500", () => {
      const { centavos, valor, valorNum } = simularDigitacao([4, 5, 0, 0, 0, 0]);

      expect(centavos).toBe(450000);
      expect(valor).toBe("4.500,00");
      expect(valorNum).toBe(4500);
    });

    it("digitar 1000 (R$ 1.000,00) — valorNum deve ser 1000", () => {
      const { centavos, valor, valorNum } = simularDigitacao([1, 0, 0, 0, 0, 0]);

      expect(centavos).toBe(100000);
      expect(valor).toBe("1.000,00");
      expect(valorNum).toBe(1000);
    });

    it("digitar 12500 (R$ 12.500,00) — valorNum deve ser 12500", () => {
      const { centavos, valor, valorNum } = simularDigitacao([1, 2, 5, 0, 0, 0, 0]);

      expect(centavos).toBe(1250000);
      expect(valor).toBe("12.500,00");
      expect(valorNum).toBe(12500);
    });
  });
});
