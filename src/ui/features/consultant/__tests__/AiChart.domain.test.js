import { describe, expect, it } from "vitest";

import { isTrendChart, trendYDomain } from "../AiChart.jsx";

// O eixo Y dos gráficos de TENDÊNCIA (linha/área) não pode ancorar no zero, senão
// uma série de pouca variação (despesas 4.730–4.970) vira uma reta colada no topo.
// Barra/pizza continuam no zero (comprimento = magnitude).

const lineSeries = [{ key: "expenses", name: "Despesas", kind: "line", color: "red" }];
const cashflow = [
  { label: "mai/26", expenses: 4970 },
  { label: "jun/26", expenses: 4850 },
  { label: "jul/26", expenses: 4730 },
];

describe("isTrendChart", () => {
  it("line, area e composed só-de-linha/área são tendência", () => {
    expect(isTrendChart("line", lineSeries)).toBe(true);
    expect(isTrendChart("area", lineSeries)).toBe(true);
    expect(isTrendChart("composed", [{ kind: "line" }, { kind: "area" }])).toBe(true);
  });

  it("barra, pizza e composed-com-barra NÃO são tendência (magnitude parte do zero)", () => {
    expect(isTrendChart("bar", [{ kind: "bar" }])).toBe(false);
    expect(isTrendChart("donut", [{ kind: "bar" }])).toBe(false);
    expect(isTrendChart("composed", [{ kind: "line" }, { kind: "bar" }])).toBe(false);
  });
});

describe("trendYDomain", () => {
  it("dá zoom fora do zero para revelar a inclinação de uma série de pouca variação", () => {
    const [lo, hi] = trendYDomain(lineSeries, cashflow);
    expect(lo).toBeGreaterThan(0); // não colado no zero
    expect(lo).toBeLessThan(4730); // abaixo do menor ponto
    expect(hi).toBeGreaterThan(4970); // acima do maior ponto
  });

  it("devolve undefined para série plana ou de um ponto (nada a revelar)", () => {
    expect(trendYDomain(lineSeries, [{ expenses: 100 }, { expenses: 100 }])).toBeUndefined();
    expect(trendYDomain(lineSeries, [{ expenses: 100 }])).toBeUndefined();
  });

  it("ancora no zero quando a folga cruzaria o zero (valores perto de zero)", () => {
    const [lo] = trendYDomain(lineSeries, [{ expenses: 2 }, { expenses: 100 }]);
    expect(lo).toBe(0);
  });
});
