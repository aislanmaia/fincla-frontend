/**
 * Testes unitários para o input de valor da Nova Transação.
 *
 * Replica a lógica exata de App.jsx:
 *   - handleValorKey: acumula dígitos em `centavos` e formata `valor`
 *   - valorNum: parseFloat(valor.replace(",","."))
 *
 * O teste que verifica o fluxo "4500" DEVE FALHAR enquanto o bug existir,
 * pois `valorNum` retorna 4.5 em vez de 4500.
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
 * Converte a string exibida no campo para número — linha 702 de App.jsx:
 *   const valorNum = parseFloat(valor.replace(",",".")) || 0;
 *
 * BUGADA para valores >= R$ 1.000, pois o separador de milhar (.)
 * não é removido antes do parseFloat.
 */
function derivarValorNum(valor) {
  return parseFloat(valor.replace(",", ".")) || 0;
}

/** Simula a sequência de dígitos digitados pelo usuário. */
function simularDigitacao(digitos) {
  let centavos = 0;
  for (const d of digitos) {
    centavos = pressDigit(centavos, d);
  }
  const valor = formatValor(centavos);
  const valorNum = derivarValorNum(valor);
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

  describe("BUG — valores >= R$ 1.000 (separador de milhar no formato pt-BR)", () => {
    /**
     * Para digitar R$ 4.500,00 no input bancário, o usuário pressiona
     * as teclas: 4 5 0 0 0 0  (os dois últimos zeros são os centavos).
     *
     * Resultado esperado: valorNum === 4500
     * Resultado atual (bug): valorNum === 4.5
     *
     * Por quê?
     *   centavos = 450000  →  valor = "4.500,00"
     *   "4.500,00".replace(",",".") = "4.500.00"
     *   parseFloat("4.500.00")      = 4.5   ← parseFloat para no segundo ponto
     */
    it("FALHA: digitar 4500 (R$ 4.500,00) — valorNum deve ser 4500, mas retorna 4.5", () => {
      const { centavos, valor, valorNum } = simularDigitacao([4, 5, 0, 0, 0, 0]);

      // Confirma que o estado interno está correto
      expect(centavos).toBe(450000);
      expect(valor).toBe("4.500,00");

      // O painel de confirmação (step 3) e o payload enviado à API usam
      // `valorNum`. Deve ser 4500, mas o bug faz retornar 4.5.
      expect(valorNum).toBe(4500); // ← FALHA enquanto o bug existir
    });

    it("FALHA: digitar 1000 (R$ 1.000,00) — valorNum deve ser 1000, mas retorna 1", () => {
      const { centavos, valor, valorNum } = simularDigitacao([1, 0, 0, 0, 0, 0]);

      expect(centavos).toBe(100000);
      expect(valor).toBe("1.000,00");

      expect(valorNum).toBe(1000); // ← FALHA enquanto o bug existir
    });

    it("FALHA: digitar 12500 (R$ 12.500,00) — valorNum deve ser 12500, mas retorna 12.5", () => {
      const { centavos, valor, valorNum } = simularDigitacao([1, 2, 5, 0, 0, 0, 0]);

      expect(centavos).toBe(1250000);
      expect(valor).toBe("12.500,00");

      expect(valorNum).toBe(12500); // ← FALHA enquanto o bug existir
    });
  });
});
