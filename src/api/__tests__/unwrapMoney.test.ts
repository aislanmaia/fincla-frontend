import { describe, expect, it } from 'vitest';

import { unwrapMoney } from '../money';

/**
 * Os três lotes de contrato migraram ~95 campos em respostas aninhadas. Um campo
 * esquecido num normalizador escrito à mão vira "R$ NaN" na tela, ou uma soma que
 * concatena string. Este caminhar não pode falhar por omissão — é o ponto dele.
 */
describe('unwrapMoney', () => {
  it('desembrulha um valor no topo', () => {
    expect(unwrapMoney({ value: { amount: '123.45', currency: 'BRL' } })).toEqual({ value: 123.45 });
  });

  it('desembrulha em qualquer profundidade', () => {
    const cru = {
      summary: { total: { amount: '1000.50', currency: 'BRL' } },
      by_category: [
        { name: 'Casa', total: { amount: '300.00', currency: 'BRL' } },
        { name: 'Lazer', total: { amount: '-42.00', currency: 'EUR' } },
      ],
      months: [{ projection: { balance: { amount: '0.00', currency: 'BRL' } } }],
    };

    expect(unwrapMoney(cru)).toEqual({
      summary: { total: 1000.5 },
      by_category: [
        { name: 'Casa', total: 300 },
        { name: 'Lazer', total: -42 },
      ],
      months: [{ projection: { balance: 0 } }],
    });
  });

  it('não toca no que não é dinheiro canônico', () => {
    const cru = {
      id: 'abc',
      count: 7,
      ativo: true,
      nada: null,
      quase: { amount: '10.00' },            // sem currency
      tambem: { amount: 10, currency: 'BRL' }, // amount numérico: não é canônico
      data: '2026-09-05',
      lista: ['a', 1, null],
    };

    expect(unwrapMoney(cru)).toEqual(cru);
  });

  it('ausência continua ausência, nunca zero', () => {
    // `total: null` do saldo consolidado significa "não deu para converter".
    // Virar 0 afirmaria que a pessoa não tem dinheiro.
    expect(unwrapMoney({ total: null })).toEqual({ total: null });
    expect(unwrapMoney({ total: undefined })).toEqual({ total: undefined });
  });

  it('sobrevive a array na raiz e a resposta vazia', () => {
    expect(unwrapMoney([{ v: { amount: '1.00', currency: 'BRL' } }])).toEqual([{ v: 1 }]);
    expect(unwrapMoney(null)).toBeNull();
    expect(unwrapMoney([])).toEqual([]);
  });

  it('o resultado soma sem concatenar string', () => {
    const linhas = unwrapMoney([
      { total: { amount: '100.50', currency: 'BRL' } },
      { total: { amount: '49.50', currency: 'BRL' } },
    ]);

    expect(linhas.reduce((s, l) => s + l.total, 0)).toBe(150);
  });
});

describe("a quebra por moeda não é colapsada (#170)", () => {
  it("mantém a lista `*_by_currency` inteira, com o código de cada fatia", () => {
    const resposta = unwrapMoney({
      avg_expense: { amount: "4300.00", currency: "BRL" },
      avg_expense_by_currency: [
        { amount: "300.00", currency: "USD" },
        { amount: "4000.00", currency: "BRL" },
      ],
    });

    // O total continua virando número: é ele que a tela soma e compara.
    expect(resposta.avg_expense).toBe(4300);
    // A quebra, não: sem o código, `300` seria desenhado como trezentos REAIS.
    expect(resposta.avg_expense_by_currency).toEqual([
      { amount: "300.00", currency: "USD" },
      { amount: "4000.00", currency: "BRL" },
    ]);
  });

  it("uma lista de dinheiro em OUTRA chave continua virando números", () => {
    const resposta = unwrapMoney({
      monthly_totals: [{ amount: "10.00", currency: "BRL" }],
    });

    expect(resposta.monthly_totals).toEqual([10]);
  });

  it("uma chave `by_currency` que não é lista de dinheiro segue o caminho normal", () => {
    // A evolução mensal manda `{currency, total_income, total_expenses}` — três
    // campos, não dinheiro canônico. Ali o valor de dentro precisa virar número.
    const resposta = unwrapMoney({
      by_currency: [
        { currency: "BRL", total_income: { amount: "100.00", currency: "BRL" } },
      ],
    });

    expect(resposta.by_currency).toEqual([{ currency: "BRL", total_income: 100 }]);
  });
});
