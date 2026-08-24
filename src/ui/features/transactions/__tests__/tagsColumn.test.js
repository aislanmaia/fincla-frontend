/**
 * A largura das colunas de categoria e de tags — medida uma vez por página.
 *
 * Por que isto existe: cada `.fincla-row` é uma GRADE INDEPENDENTE. Uma coluna
 * `auto` ou `max-content` significa "cada linha decide a sua", e o resultado
 * medido no app foram onze posições diferentes de tag numa lista de vinte
 * linhas. Alinhar é o ponto de existir uma coluna, então a largura tem de ser
 * calculada para o conjunto e imposta a todas.
 *
 * Mede o texto de verdade em vez de estimar por número de caracteres: a fonte é
 * proporcional, e "ii" e "MM" têm a mesma contagem e larguras muito diferentes.
 */
import { describe, expect, it } from "vitest";
import { larguraColunaTags, larguraColunaCategoria } from "../../../pages/TransacoesPage.jsx";

/* Roda no fallback por caractere de propósito: em node não há canvas, que é
   exatamente o caminho degradado que precisa funcionar. O que se testa é a
   REGRA (teto, colapso, quantas tags entram), não a métrica do navegador — que
   varia com a fonte instalada e tornaria o teste um oráculo do ambiente. */

describe("larguraColunaTags", () => {
  it("colapsa a zero quando ninguém tem tag", () => {
    // Tag é opt-in: numa conta real a maioria das transações não tem nenhuma, e
    // uma coluna fixa cobraria largura de TODAS as linhas para exibir o vazio.
    expect(larguraColunaTags([{ tags: [] }, { tags: undefined }])).toBe(0);
    expect(larguraColunaTags([])).toBe(0);
  });

  it("dimensiona pela linha de maior conteúdo, não pela primeira", () => {
    const curta = larguraColunaTags([{ tags: ["ab"] }]);
    const mista = larguraColunaTags([{ tags: ["ab"] }, { tags: ["abcdefgh"] }]);
    expect(mista).toBeGreaterThan(curta);
  });

  it("conta só as duas primeiras tags, e reserva o '+N'", () => {
    const duas = larguraColunaTags([{ tags: ["aa", "bb"] }]);
    const cinco = larguraColunaTags([{ tags: ["aa", "bb", "cc", "dd", "ee"] }]);
    // As três extras não entram na largura — mas o "+3" entra.
    expect(cinco).toBeGreaterThan(duas);
    expect(cinco).toBeLessThan(duas * 2);
  });

  it("respeita o teto — uma transação não decide a coluna para as outras cem", () => {
    const enorme = larguraColunaTags([{ tags: ["x".repeat(200), "y".repeat(200)] }]);
    expect(enorme).toBeLessThanOrEqual(190);
  });
});

describe("larguraColunaCategoria", () => {
  it("colapsa a zero sem categoria e respeita o teto", () => {
    expect(larguraColunaCategoria([{ cat: "" }])).toBe(0);
    expect(larguraColunaCategoria([{ cat: "z".repeat(200) }])).toBeLessThanOrEqual(168);
  });

  it("é a MESMA para toda a página — é isso que alinha as pílulas", () => {
    const rows = [{ cat: "Casa" }, { cat: "Alimentação fora" }, { cat: "Uber" }];
    const w = larguraColunaCategoria(rows);
    // Qualquer subconjunto que contenha a maior devolve o mesmo número.
    expect(larguraColunaCategoria([rows[1]])).toBe(w);
    // E a menor sozinha devolve menos: a largura vem do conteúdo, não de um
    // valor fixo escolhido no olho.
    expect(larguraColunaCategoria([rows[0]])).toBeLessThan(w);
  });
});
