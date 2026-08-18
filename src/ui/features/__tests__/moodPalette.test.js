import { describe, expect, it } from "vitest";
import { MOODS } from "../moodV4.jsx";

/**
 * A escala de humor tinha CINCO faixas e TRÊS cores.
 *
 * `healthy` e `watchful` usavam o mesmo hex (`#D97706`) — "Saudável" e "Atenção"
 * eram indistinguíveis, e a fronteira entre "está tudo bem" e "olha o ritmo" era a
 * única que precisava ser óbvia. `tense` e `alert` ficavam a ΔE 1,3, praticamente a
 * mesma cor também. Estes testes existem para que nenhuma dessas colisões volte por
 * descuido de refatoração.
 *
 * O contraste é verificado aqui e não a olho porque o acento cru reprova como texto:
 * amarelo #EAB308 sobre branco dá 1,92:1 e verde claro #22C55E dá 2,28:1. O `kicker`
 * usava o acento em texto de 10px — 3,19:1, abaixo do mínimo de 4,5:1 do WCAG AA.
 */
const ORDEM = ["serene", "healthy", "watchful", "tense", "alert"];

const canal = (hex) =>
  [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

const luminancia = (hex) => {
  const [r, g, b] = canal(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contraste = (a, b) => {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
};

describe("paleta de humor — cinco faixas, cinco cores", () => {
  it("nenhuma faixa repete o acento de outra", () => {
    const acentos = ORDEM.map((k) => [k, MOODS[k].accent]);
    const vistos = new Map();
    const colisoes = [];
    for (const [faixa, acento] of acentos) {
      if (vistos.has(acento)) colisoes.push(`${vistos.get(acento)} e ${faixa} = ${acento}`);
      vistos.set(acento, faixa);
    }
    expect(colisoes).toEqual([]);
  });

  it("faixas vizinhas não repetem o fundo do selo", () => {
    for (let i = 0; i < ORDEM.length - 1; i += 1) {
      const a = MOODS[ORDEM[i]];
      const b = MOODS[ORDEM[i + 1]];
      expect([ORDEM[i], a.badgeBg]).not.toEqual([ORDEM[i], b.badgeBg]);
    }
  });

  it("o número grande passa no contraste sobre o card branco (texto grande, mín. 3:1)", () => {
    for (const faixa of ORDEM) {
      const razao = contraste(MOODS[faixa].headlineColor, "#FFFFFF");
      expect([faixa, razao >= 3]).toEqual([faixa, true]);
    }
  });

  it("o texto do selo passa sobre o fundo do selo (texto pequeno, mín. 4,5:1)", () => {
    for (const faixa of ORDEM) {
      const { badgeColor, badgeBg } = MOODS[faixa];
      const razao = contraste(badgeColor, badgeBg);
      expect([faixa, razao >= 4.5]).toEqual([faixa, true]);
    }
  });

  it("o kicker passa sobre o fundo do insight — ele é usado em 10px", () => {
    // Era `accent` e reprovava. Precisa continuar sendo um tom escuro da faixa.
    for (const faixa of ORDEM) {
      const { kicker, insightBg } = MOODS[faixa];
      const razao = contraste(kicker, insightBg);
      expect([faixa, Number(razao.toFixed(2)), razao >= 4.5]).toEqual([
        faixa,
        Number(razao.toFixed(2)),
        true,
      ]);
    }
  });
});
