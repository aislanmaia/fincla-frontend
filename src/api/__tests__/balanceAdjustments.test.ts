import { beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from '../client';
import {
  createBalanceAdjustment,
  listBalanceAdjustments,
  listOrgBalanceAdjustments,
  updateBalanceAdjustment,
} from '../balanceAdjustments';

vi.mock('../client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

/**
 * Este módulo devolvia `response.data` cru até a fronteira canônica
 * (fincla-api#130). Os consumidores SOMAM: o extrato e o calendário fazem
 * `s + a.amount`, e `0 + {amount, currency}` em JavaScript vira a string
 * `"0[object Object]"` — sem erro, sem exceção, só um total errado na tela.
 * É o fincla-frontend#88 com outra roupa, e é isto que estes casos guardam.
 */
const canonical = (extra = {}) => ({
  id: 'adj-1',
  account_id: 'a1',
  amount: { amount: '499.50', currency: 'BRL' },
  asserted_balance: { amount: '1500.00', currency: 'BRL' },
  includes_same_day: true,
  date: '2025-01-31T12:00:00',
  reason: 'Conferi o extrato',
  created_by: 'u1',
  created_at: '2025-01-31T12:05:00',
  updated_at: null,
  ...extra,
});

describe('balanceAdjustments: dinheiro na fronteira', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(apiClient.patch).mockReset();
  });

  it('createBalanceAdjustment converte os dois valores', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: canonical() });

    const out = await createBalanceAdjustment('a1', 'org-1', {
      asserted_balance: 1500,
      reason: 'Conferi o extrato',
    });

    expect(out.amount).toBe(499.5);
    expect(out.asserted_balance).toBe(1500);
    expect(typeof out.amount).toBe('number');
  });

  it('listBalanceAdjustments converte cada linha', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [canonical(), canonical({ id: 'adj-2', amount: { amount: '-42.00', currency: 'BRL' } })],
    });

    const out = await listBalanceAdjustments('a1', 'org-1');

    expect(out.map((a) => a.amount)).toEqual([499.5, -42]);
  });

  it('o feed da org soma sem concatenar string', async () => {
    // A asserção que importa: com o objeto cru, este reduce daria
    // "0[object Object][object Object]" e o total do extrato ficaria errado.
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [canonical(), canonical({ id: 'adj-2', amount: { amount: '100.50', currency: 'BRL' } })],
    });

    const out = await listOrgBalanceAdjustments('org-1', '2025-01-01', '2025-01-31');

    expect(out.reduce((s, a) => s + a.amount, 0)).toBe(600);
  });

  it('updateBalanceAdjustment converte a resposta do PATCH', async () => {
    vi.mocked(apiClient.patch).mockResolvedValueOnce({
      data: canonical({ asserted_balance: { amount: '2000.00', currency: 'BRL' } }),
    });

    const out = await updateBalanceAdjustment('adj-1', 'org-1', { asserted_balance: 2000 });

    expect(out.asserted_balance).toBe(2000);
  });

  it('continua lendo a forma antiga — o frontend sobe antes do backend', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [canonical({ amount: '499.50', asserted_balance: '1500.00' })],
    });

    const out = await listBalanceAdjustments('a1', 'org-1');

    expect(out[0].amount).toBe(499.5);
    expect(out[0].asserted_balance).toBe(1500);
  });

  it('uma resposta que não é lista não vira exceção', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: null });

    await expect(listOrgBalanceAdjustments('org-1')).resolves.toEqual([]);
  });
});
