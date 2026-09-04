import { describe, expect, it } from 'vitest';
import { isCanonicalMoney, toAmount, toCurrency, toFiniteNumber } from '../money';
import canonical from '../__fixtures__/money.example.json';

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

/**
 * A forma canônica do backend (fincla-api ADR-0002 / #130): o valor e a moeda no mesmo
 * objeto, `amount` sempre string. A família de saldo já responde assim. Sem tratá-la
 * aqui, `toFiniteNumber` devolveria `null` para todo saldo e a Visão Geral ficaria
 * vazia com a API respondendo 200 — o #76 outra vez, e outra vez sem erro nenhum.
 */
describe('forma canônica {amount, currency}', () => {
  it('extrai o número de cada caso da fixture canônica', () => {
    // A fixture é cópia byte a byte de `fincla-api/docs/contracts/money.example.json`,
    // e um teste do backend quebra se as duas divergirem.
    expect(toFiniteNumber(canonical.com_centavos)).toBe(1000.5);
    expect(toFiniteNumber(canonical.zero)).toBe(0);
    expect(toFiniteNumber(canonical.negativo)).toBe(-42);
  });

  it('extrai a moeda, e devolve null quando o valor não declara nenhuma', () => {
    expect(toCurrency(canonical.negativo)).toBe('USD');
    expect(toCurrency(canonical.zero)).toBe('BRL');
    // Forma antiga: sem moeda declarada. `null`, nunca um "BRL" inventado — chutar a
    // moeda é a mesma classe de erro que somar sem olhar a unidade.
    expect(toCurrency('315.57')).toBeNull();
    expect(toCurrency(42)).toBeNull();
  });

  it('não confunde um objeto qualquer com dinheiro', () => {
    for (const v of [{}, { amount: 1000.5, currency: 'BRL' }, { amount: '10' }, { currency: 'BRL' }, []]) {
      expect([v, isCanonicalMoney(v)]).toEqual([v, false]);
      expect([v, toFiniteNumber(v)]).toEqual([v, null]);
    }
  });

  it('um `amount` numérico é recusado, não aceito por gentileza', () => {
    // `amount` string é o ponto do contrato: number em JSON é IEEE-754 e perde
    // centavo. Aceitar a forma errada aqui apagaria o sinal de que ela existe.
    expect(toFiniteNumber({ amount: 1000.5, currency: 'BRL' })).toBeNull();
  });

  it('soma sem perder centavo entre as duas formas do fio', () => {
    // Durante o expand os dois formatos coexistem: #131-#133 ainda não migraram.
    const itens = [canonical.com_centavos, '250.00', 42];
    expect(itens.reduce((s, i) => s + toAmount(i), 0)).toBe(1292.5);
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
