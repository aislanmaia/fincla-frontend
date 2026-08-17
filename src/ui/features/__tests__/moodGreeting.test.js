import { describe, expect, it } from "vitest";
import { calcMood, moodGreeting, moodRatio } from "../moodV4.jsx";

/**
 * O invariante que a issue #67 pede: para o mesmo par (gasto, dia), o humor e a
 * frase "à frente / acima" não podem discordar de sinal.
 *
 * `ratio < 1` = gastou mais devagar do que o mês passou = a tela mostra
 * "R$ X à frente do ritmo esperado ✓". Nesse caso nenhuma saudação pode afirmar
 * que o usuário está acelerando.
 */
const isAheadOfPace = (spendPct, timePct) => spendPct <= timePct;

describe("moodGreeting — não contradiz o 'à frente do ritmo' (#67)", () => {
  it("o caso real da issue: dia 16/31, 49,24% do envelope", () => {
    const day = 16;
    const dim = 31;
    const spendPct = 49.24;
    const freePct = 50.8;

    // A faixa continua sendo watchful — o limiar 0.95 NÃO foi mexido.
    expect(calcMood(day, spendPct, freePct, dim)).toBe("watchful");
    // ...mas a frase para de afirmar aceleração.
    const greeting = moodGreeting("watchful", moodRatio(day, spendPct, dim));
    expect(greeting).not.toMatch(/acelerando/i);
    expect(greeting).toMatch(/Ritmo apertado/i);
  });

  it("varre a faixa 0,95–1,0: abaixo do ritmo nunca diz 'acelerando'", () => {
    const dim = 31;
    for (let day = 1; day <= dim; day += 1) {
      const timePct = (day / dim) * 100;
      // ratio de 0,955 a 1,0 — a metade de baixo da faixa watchful
      for (const target of [0.955, 0.97, 0.99, 1.0]) {
        const spendPct = timePct * target;
        if (!isAheadOfPace(spendPct, timePct)) continue;
        const mood = calcMood(day, spendPct, 50, dim);
        const greeting = moodGreeting(mood, moodRatio(day, spendPct, dim));
        expect(
          greeting,
          `dia ${day}, ratio ${target}: gasto abaixo do ritmo não pode dizer "acelerando"`,
        ).not.toMatch(/acelerando/i);
      }
    }
  });

  it("acima do ritmo continua dizendo que está acelerando", () => {
    const day = 16;
    const dim = 31;
    const timePct = (day / dim) * 100;
    const spendPct = timePct * 1.05; // 5% acima
    expect(calcMood(day, spendPct, 50, dim)).toBe("watchful");
    expect(moodGreeting("watchful", moodRatio(day, spendPct, dim))).toMatch(/acelerando/i);
  });

  it("não mexe nas outras faixas", () => {
    expect(moodGreeting("serene", 0.5)).toMatch(/respiram bem/i);
    expect(moodGreeting("healthy", 0.9)).toMatch(/equilibrado/i);
    expect(moodGreeting("tense", 1.2)).toMatch(/pressionado/i);
    expect(moodGreeting("alert", 1.5)).toMatch(/crítica/i);
  });

  it("ratio inválido (envelope zero) cai na saudação padrão, sem quebrar", () => {
    expect(moodGreeting("watchful", Number.NaN)).toMatch(/acelerando/i);
    expect(moodGreeting("watchful", Number.POSITIVE_INFINITY)).toMatch(/acelerando/i);
  });
});

describe("calcMood — a régua NÃO mudou nesta correção", () => {
  it("mantém os mesmos limiares de antes", () => {
    // Guarda contra alguém "consertar" a #67 mexendo no limiar sem decisão de produto:
    // isso mudaria a régua de humor de todos os usuários.
    const dim = 31;
    const day = 16;
    const timePct = (day / dim) * 100;
    expect(calcMood(day, timePct * 0.7, 50, dim)).toBe("serene");
    expect(calcMood(day, timePct * 0.9, 50, dim)).toBe("healthy");
    expect(calcMood(day, timePct * 1.0, 50, dim)).toBe("watchful");
    expect(calcMood(day, timePct * 1.2, 50, dim)).toBe("tense");
    expect(calcMood(day, timePct * 1.4, 50, dim)).toBe("alert");
  });

  it("freePct baixo continua mandando, independente do ritmo", () => {
    expect(calcMood(16, 10, 5, 31)).toBe("alert");
    expect(calcMood(16, 10, 15, 31)).toBe("watchful");
  });
});
