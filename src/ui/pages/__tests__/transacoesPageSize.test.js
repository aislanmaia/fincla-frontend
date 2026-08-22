import { describe, expect, it } from "vitest";

import { TX_PAGE_MAX, TX_PAGE_MIN, TX_ROW_HEIGHT, computePageSize } from "../TransacoesPage.jsx";

describe("computePageSize", () => {
  it("nunca pede menos que o piso, mesmo numa janela minúscula", () => {
    expect(computePageSize(120)).toBe(TX_PAGE_MIN);
    expect(computePageSize(0)).toBe(TX_PAGE_MIN);
  });

  it("nunca passa do limite que a API aceita", () => {
    expect(computePageSize(100_000)).toBe(TX_PAGE_MAX);
  });

  it("cobre a tela com folga em vez de deixar a rolagem infinita disparar de cara", () => {
    // 1366x768: a lista fica com ~411 px depois do PR do breakpoint por altura.
    // 411/101 = 5 linhas; o piso ainda ganha, e é esse o ponto do piso.
    expect(computePageSize(411)).toBe(TX_PAGE_MIN);
    // Uma janela bem alta (~2000 px de lista) passa do piso: 20 linhas + folga.
    expect(computePageSize(2000)).toBe(Math.ceil(2000 / TX_ROW_HEIGHT) + 5);
    // E o piso vence sempre que a conta dá menos que ele.
    expect(computePageSize(1200)).toBe(TX_PAGE_MIN);
  });

  it("uma linha mais densa cabe mais vezes na mesma altura", () => {
    const comfortable = computePageSize(1600, 101);
    const dense = computePageSize(1600, 48);
    expect(dense).toBeGreaterThan(comfortable);
  });

  it("o teto é o limit máximo que a API aceita — acima disso ela responde 422", () => {
    // `visible` É o `limit` da requisição, e "carregar mais" soma PAGE_SIZE a
    // ele. Sem o teto, uma janela alta chegava a 120 e a lista travava num 422
    // que o "Tentar novamente" só reenviava.
    expect(TX_PAGE_MAX).toBe(100);
    expect(computePageSize(5000, 36)).toBeLessThanOrEqual(TX_PAGE_MAX);
  });

  it("degrada para o piso com entrada inválida em vez de quebrar a página", () => {
    expect(computePageSize(Number.NaN)).toBe(TX_PAGE_MIN);
    expect(computePageSize(500, 0)).toBe(TX_PAGE_MIN);
    expect(computePageSize(undefined)).toBe(TX_PAGE_MIN);
  });
});
