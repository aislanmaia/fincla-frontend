import { beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from '../client';
import { createTransfer, getQuotation, listTransfers } from '../transfers';

vi.mock('../client', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

/**
 * Este módulo devolvia `response.data` cru. Os valores chegam na forma canônica
 * (fincla-api#140) e o extrato SOMA transferências: `0 + {…}` vira a string
 * `"0[object Object]"` sem erro nenhum.
 */
const cruzada = {
  id: 't1',
  organization_id: 'org-1',
  from_account_id: 'eur',
  to_account_id: 'brl',
  amount: { amount: '100.00', currency: 'EUR' },
  to_amount: { amount: '592.30', currency: 'BRL' },
  date: '2026-09-04T12:00:00',
  created_at: '2026-09-04T12:00:00',
  note: null,
};

describe('transfers: dinheiro na fronteira', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
  });

  it('createTransfer converte os DOIS valores', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: cruzada });

    const out = await createTransfer('org-1', {
      from_account_id: 'eur',
      to_account_id: 'brl',
      amount: 100,
      to_amount: 592.3,
    });

    expect(out.amount).toBe(100);
    expect(out.to_amount).toBe(592.3);
  });

  it('cada valor mantém a moeda DELE', async () => {
    // O ponto do ticket: as duas pontas estão em unidades diferentes, e mostrar as
    // duas com o mesmo símbolo é o erro que ele existe para eliminar.
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: cruzada });

    const out = await createTransfer('org-1', {
      from_account_id: 'eur',
      to_account_id: 'brl',
      amount: 100,
      to_amount: 592.3,
    });

    expect(out.from_currency).toBe('EUR');
    expect(out.to_currency).toBe('BRL');
  });

  it('a listagem soma sem concatenar string', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [cruzada, { ...cruzada, id: 't2', amount: { amount: '50.00', currency: 'EUR' } }],
    });

    const out = await listTransfers('org-1');

    // Com o objeto cru isto daria "0[object Object][object Object]".
    expect(out.reduce((s, t) => s + (t.amount ?? 0), 0)).toBe(150);
  });

  it('continua lendo a forma antiga — o backend pode estar atrás', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [{ ...cruzada, amount: '100.00', to_amount: '592.30' }],
    });

    const out = await listTransfers('org-1');

    expect(out[0].amount).toBe(100);
    expect(out[0].to_amount).toBe(592.3);
    // Sem moeda declarada, o padrão do produto — nunca um chute de outra moeda.
    expect(out[0].from_currency).toBe('BRL');
  });

  it('uma resposta que não é lista não vira exceção', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: null });

    await expect(listTransfers('org-1')).resolves.toEqual([]);
  });

  it('getQuotation busca o par e devolve a taxa com a data', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { base: 'EUR', quote: 'BRL', rate: '5.9448', quoted_on: '2026-09-03' },
    });

    const q = await getQuotation('org-1', 'EUR', 'BRL');

    expect(apiClient.get).toHaveBeenCalledWith('/quotations/EUR/BRL', {
      params: { organization_id: 'org-1' },
    });
    // `rate` continua string: taxa tem mais casas que dinheiro, e passar por
    // float perderia dígito justamente onde a precisão importa.
    expect(q.rate).toBe('5.9448');
    expect(typeof q.rate).toBe('string');
    expect(q.quoted_on).toBe('2026-09-03');
  });
});
