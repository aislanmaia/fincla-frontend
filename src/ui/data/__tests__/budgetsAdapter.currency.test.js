import { describe, expect, it } from "vitest";

import { mapBudgetToUi, mapBudgetsResponseToUi } from "../budgetsAdapter.js";

/**
 * A moeda do orçamento, e o gasto que ele NÃO mede.
 *
 * Um orçamento tem a sua moeda, e o consumo é medido nela (fincla-api#141). Um
 * gasto da mesma categoria em outra moeda não é orçamento estourado — é outra
 * conversa. Mas ele também não pode sumir: um gasto que a pessoa fez e não vê em
 * lugar nenhum é pior que um número errado, porque ela nem sabe que existe para
 * procurar.
 */

const base = {
  id: "b1",
  tag_id: "t1",
  amount: "800.00",
  spent_amount: "300.00",
  currency: "EUR",
};

describe("a moeda do orçamento chega à tela", () => {
  it("é carregada do backend, não assumida", () => {
    expect(mapBudgetToUi(base).moeda).toBe("EUR");
  });

  it("ausente vira `null` — e não 'BRL' inventado", () => {
    // Chutar a moeda é a mesma classe de erro que somar sem olhar a unidade, só
    // que silenciosa. Quem formata decide o padrão; o adapter não inventa.
    expect(mapBudgetToUi({ ...base, currency: undefined }).moeda).toBeNull();
  });
});

describe("o gasto fora do orçamento", () => {
  it("chega com valor E moeda, um por moeda", () => {
    const ui = mapBudgetToUi({
      ...base,
      spent_outside_budget_currency: [
        { amount: "150.00", currency: "BRL" },
        { amount: "20.00", currency: "USD" },
      ],
    });

    expect(ui.foraDoOrcamento).toEqual([
      { valor: 150, moeda: "BRL" },
      { valor: 20, moeda: "USD" },
    ]);
  });

  it("NÃO entra no gasto nem muda o percentual", () => {
    // Somar ali inventaria uma conversão que ninguém pediu — e faria um orçamento
    // de € 800 parecer estourado por causa de R$ 150.
    const ui = mapBudgetToUi({
      ...base,
      spent_outside_budget_currency: [{ amount: "5000.00", currency: "BRL" }],
    });

    expect(ui.gasto).toBe(300);
    expect(ui.limite).toBe(800);
  });

  it("vazio quando não há gasto de fora", () => {
    expect(mapBudgetToUi(base).foraDoOrcamento).toEqual([]);
    expect(mapBudgetToUi({ ...base, spent_outside_budget_currency: [] }).foraDoOrcamento).toEqual([]);
  });

  it("descarta entrada sem moeda ou com valor zero", () => {
    // Uma linha sem moeda não é desenhável, e uma de zero não é um gasto.
    const ui = mapBudgetToUi({
      ...base,
      spent_outside_budget_currency: [
        { amount: "10.00", currency: null },
        { amount: "0.00", currency: "BRL" },
        { amount: "7.00", currency: "USD" },
      ],
    });

    expect(ui.foraDoOrcamento).toEqual([{ valor: 7, moeda: "USD" }]);
  });
});

describe("o resumo do topo soma DENTRO de cada moeda", () => {
  /**
   * **Por que este bloco existe.** Escrevi primeiro o teste da tela, que mocka o
   * hook — e então mutei `umaMoedaSo` para `true`, fazendo o resumo voltar a
   * empilhar moedas. **Verde.** O `reduce` que soma € 800 com R$ 500 e publica
   * 1.300 vive AQUI, no adapter, e a tela nunca o executa nos testes dela.
   */
  const orcamento = (extra) => ({
    id: "b", tag_id: "t", amount: "800.00", spent_amount: "300.00",
    remaining_amount: "500.00", is_active: true, period_type: "monthly",
    status: "ok", currency: "EUR", ...extra,
  });

  it("uma moeda só: os totais são os de sempre", () => {
    const ui = mapBudgetsResponseToUi({
      budgets: [orcamento({ id: "b1" }), orcamento({ id: "b2", amount: "200.00", spent_amount: "50.00", remaining_amount: "150.00" })],
    });

    expect(ui.budget).toBe(1000);
    expect(ui.totalGasto).toBe(350);
    expect(ui.moeda).toBe("EUR");
    expect(ui.porMoeda).toEqual([]);
    expect(ui.totalPct).toBe(35);
  });

  it("moedas diferentes: o total é `null`, nunca a soma nominal", () => {
    const ui = mapBudgetsResponseToUi({
      budgets: [
        orcamento({ id: "b1", currency: "EUR" }),
        orcamento({ id: "b2", currency: "BRL", amount: "500.00", spent_amount: "200.00", remaining_amount: "300.00" }),
      ],
    });

    // 800 + 500 = 1.300 seria um número de moeda nenhuma.
    expect(ui.budget).toBeNull();
    expect(ui.totalGasto).toBeNull();
    expect(ui.totalDisp).toBeNull();
    expect(ui.moeda).toBeNull();
    // E o percentual some junto: 300 euros sobre 500 reais não é fração de nada.
    expect(ui.totalPct).toBeNull();
  });

  it("moedas diferentes: a quebra responde no lugar do total", () => {
    const ui = mapBudgetsResponseToUi({
      budgets: [
        orcamento({ id: "b1", currency: "EUR" }),
        orcamento({ id: "b2", currency: "BRL", amount: "500.00", spent_amount: "200.00", remaining_amount: "300.00" }),
      ],
    });

    expect(ui.porMoeda).toEqual([
      { moeda: "BRL", valor: 500 },
      { moeda: "EUR", valor: 800 },
    ]);
    expect(ui.gastoPorMoeda).toEqual([
      { moeda: "BRL", valor: 200 },
      { moeda: "EUR", valor: 300 },
    ]);
  });
});
