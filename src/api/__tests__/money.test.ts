import { describe, expect, it } from 'vitest';
import { toAmount, toFiniteNumber } from '../money';

/**
 * Dois bugs de produção nasceram de dinheiro chegar como string do backend
 * (`Decimal` no Pydantic v2 serializa para `"315.57"`): o saldo em conta sumiu da
 * Visão Geral (#76) e o total de "Próximos Débitos" virou NaN (#88). Os dois com a
 * API respondendo 200, e os dois invisíveis para a suíte, porque todos os mocks
 * usavam número — a suíte encodava um contrato que a API nunca cumpriu.
 */
describe('toFiniteNumber', () => {
  it('converte a string que o backend manda', () => {
    expect(toFiniteNumber('315.57')).toBe(315.57);
    expect(toFiniteNumber('0.00')).toBe(0);
    expect(toFiniteNumber('-1500.00')).toBe(-1500);
  });

  it('aceita número — nem todo schema do backend usa Decimal', () => {
    expect(toFiniteNumber(42.5)).toBe(42.5);
    expect(toFiniteNumber(0)).toBe(0);
    expect(toFiniteNumber(-7)).toBe(-7);
  });

  it('devolve null, nunca zero, para o que não é número', () => {
    // Zero inventado num saldo é pior que ausência: afirma que a pessoa não tem
    // dinheiro. É o erro que a versão ingênua (`Number(value)` sem guardas) comete.
    for (const v of [null, undefined, '', '   ', 'abc', false, true, [], {}, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect([v, toFiniteNumber(v)]).toEqual([v, null]);
    }
  });
});

describe('toAmount', () => {
  it('soma sem propagar NaN quando um item falta', () => {
    const itens = [{ v: '120.00' }, { v: null }, { v: '310.50' }];
    expect(itens.reduce((s, i) => s + toAmount(i.v), 0)).toBe(430.5);
  });

  it('não herda as coerções frouxas do `Number` — a versão ingênua difere aqui', () => {
    // `Number(true) || 0` dá 1; `Number('') || 0` dá 0 por acidente, não por regra.
    // Sem estas asserções, trocar o corpo por `Number(v) || 0` passa despercebido.
    expect(toAmount(true)).toBe(0);
    expect(toAmount([])).toBe(0);
    expect(toAmount([5])).toBe(0);
    expect(toAmount('  ')).toBe(0);
    expect(toAmount('12.5')).toBe(12.5);
  });
});
