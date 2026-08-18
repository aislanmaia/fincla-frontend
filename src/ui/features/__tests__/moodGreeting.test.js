import { describe, expect, it } from "vitest";
import { calcMood, moodGreeting, moodInsightBody, moodRatio } from "../moodV4.jsx";

/**
 * O invariante que a issue #67 pede: para o mesmo par (gasto, dia), o humor e a
 * frase "à frente / acima" não podem discordar de sinal.
 *
 * A tela decide "à frente" com `spendPct <= timePct`, e `timePct` é ARREDONDADO
 * (`DashboardPage.jsx`). Reproduzimos essa expressão exatamente — derivar o teste
 * de um ratio cru esconderia a fresta em que as duas frases voltam a discordar.
 */
const timePctAsRendered = (day, dim) => Math.round((day / Math.max(dim, 1)) * 100);
const isAheadOfPace = (spendPct, day, dim) => spendPct <= timePctAsRendered(day, dim);

describe("moodGreeting — não contradiz o 'à frente do ritmo' (#67)", () => {
  it("o caso real da issue: dia 16/31, 49,24% do envelope", () => {
    const day = 16;
    const dim = 31;
    const spendPct = 49.24;
    const freePct = 50.8;

    // Com o corte em 1,00 este caso deixou de ser alarme: 49,24% do envelope com
    // 51,6% do mês decorrido é gasto ABAIXO do ritmo, e a faixa passa a dizer isso.
    expect(moodRatio(day, spendPct, dim)).toBeCloseTo(0.954, 3);
    expect(calcMood(day, spendPct, freePct, dim)).toBe("healthy");
    expect(isAheadOfPace(spendPct, day, dim)).toBe(true);
    // A guarda da #67 continua valendo para quem de fato cair em watchful.
    const greeting = moodGreeting("watchful", isAheadOfPace(spendPct, day, dim));
    expect(greeting).not.toMatch(/acelerando/i);
    expect(greeting).toMatch(/Ritmo apertado/i);
  });

  it("varredura exaustiva: nenhum par (dia, gasto) pode dizer 'acelerando' estando à frente", () => {
    const offenders = [];
    for (const dim of [28, 29, 30, 31]) {
      for (let day = 1; day <= dim; day += 1) {
        // centésimos de ponto percentual cobrem a fresta do arredondamento:
        // `timePct` arredonda para cima e um ratio cru não, então existe uma faixa
        // `exato < spendPct <= round(exato)` onde a tela diz "à frente ✓" e um
        // ratio > 1 ainda diria "acelerando". O review enumerou 37 casos assim.
        for (let pct = 0; pct <= 250; pct += 1) {
          const spendPct = pct / 2;
          const ahead = isAheadOfPace(spendPct, day, dim);
          if (!ahead) continue;
          const mood = calcMood(day, spendPct, 50, dim);
          const greeting = moodGreeting(mood, ahead);
          if (/acelerando/i.test(greeting)) {
            offenders.push({ dim, day, spendPct, ratio: moodRatio(day, spendPct, dim) });
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("acima do ritmo continua dizendo que está acelerando", () => {
    const day = 16;
    const dim = 31;
    const spendPct = timePctAsRendered(day, dim) * 1.05; // 5% acima
    expect(calcMood(day, spendPct, 50, dim)).toBe("watchful");
    expect(moodGreeting("watchful", isAheadOfPace(spendPct, day, dim))).toMatch(/acelerando/i);
  });

  it("não mexe nas outras faixas", () => {
    expect(moodGreeting("serene", true)).toMatch(/respiram bem/i);
    expect(moodGreeting("healthy", true)).toMatch(/equilibrado/i);
    expect(moodGreeting("tense", false)).toMatch(/pressionado/i);
    expect(moodGreeting("alert", false)).toMatch(/crítica/i);
  });

  it("fala em 'período', não em 'mês' — o intervalo é escolhido pelo usuário", () => {
    // O resto da tela diz "do período" (KPIs, "Sobra do período"); dizer "do mês"
    // numa faixa custom de 90 dias contradiz o próprio card.
    expect(moodGreeting("watchful", true)).not.toMatch(/do mês/i);
    expect(moodGreeting("watchful", true)).toMatch(/do período/i);
  });
});

describe("moodInsightBody — o conselho não contradiz o número acima dele", () => {
  const base = { dailyBudgetLabel: "R$ 120,00", daysLeft: 15, periodPhrase: "este mês" };

  it("estando à frente, não manda reduzir", () => {
    const body = moodInsightBody("watchful", { ...base, aheadOfPace: true });
    expect(body).not.toMatch(/reduza/i);
    expect(body).toMatch(/à frente/i);
  });

  it("estando acima, manda reduzir", () => {
    const body = moodInsightBody("watchful", { ...base, aheadOfPace: false });
    expect(body).toMatch(/reduza/i);
  });

  it("usa o orçamento diário do usuário, não uma constante mágica", () => {
    // Era "Reduza cerca de R$ 80/dia" — número fixo, sem relação com os dados.
    for (const ahead of [true, false]) {
      const body = moodInsightBody("watchful", { ...base, aheadOfPace: ahead });
      expect(body).toContain("R$ 120,00");
      expect(body).not.toContain("R$ 80");
    }
  });

  it("as outras faixas seguem iguais", () => {
    expect(moodInsightBody("serene", { ...base, aheadOfPace: true })).toMatch(/com folga/i);
    expect(moodInsightBody("healthy", { ...base, aheadOfPace: true })).toMatch(/equilibrado/i);
    expect(moodInsightBody("tense", { ...base, aheadOfPace: false })).toMatch(/Limite gastos/i);
    expect(moodInsightBody("alert", { ...base, aheadOfPace: false })).toMatch(/Evite novas despesas/i);
  });
});

describe("calcMood — a régua depois da decisão do Owner", () => {
  it("fixa os limiares novos: 'Atenção' só começa DEPOIS do ritmo", () => {
    // O corte de watchful saiu de 0,95 para 1,00. Antes, gastar exatamente no
    // ritmo do mês já caía em "Atenção" — a faixa alarmava antes de haver o que
    // alarmar. Este teste existe para que mexer nisso de novo seja uma decisão,
    // não um efeito colateral.
    const dim = 31;
    const day = 16;
    const timePct = (day / dim) * 100;
    expect(calcMood(day, timePct * 0.7, 50, dim)).toBe("serene");
    expect(calcMood(day, timePct * 0.9, 50, dim)).toBe("healthy");
    expect(calcMood(day, timePct * 0.99, 50, dim)).toBe("healthy");
    expect(calcMood(day, timePct * 1.0, 50, dim)).toBe("healthy");
    expect(calcMood(day, timePct * 1.05, 50, dim)).toBe("watchful");
    expect(calcMood(day, timePct * 1.2, 50, dim)).toBe("tense");
    expect(calcMood(day, timePct * 1.4, 50, dim)).toBe("alert");
  });

  it("gastar no ritmo nunca é alarme, em nenhum dia de nenhum mês", () => {
    // Generaliza o caso da ASM: se o gasto está em cima ou abaixo do ritmo, a
    // faixa não pode ser watchful ou pior (a não ser por freePct, testado abaixo).
    for (const dim of [28, 29, 30, 31]) {
      for (let day = 1; day <= dim; day += 1) {
        const timePct = (day / dim) * 100;
        const mood = calcMood(day, timePct, 50, dim);
        expect([mood, day, dim]).toEqual([expect.stringMatching(/serene|healthy/), day, dim]);
      }
    }
  });

  it("freePct baixo continua mandando, independente do ritmo", () => {
    expect(calcMood(16, 10, 5, 31)).toBe("alert");
    expect(calcMood(16, 10, 15, 31)).toBe("watchful");
  });
});
