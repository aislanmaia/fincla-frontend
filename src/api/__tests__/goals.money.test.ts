import { beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from '../client';
import { getGoal, listGoals } from '../goals';

vi.mock('../client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

/**
 * A meta foi o último campo monetário a migrar (fincla-api#134). Sem a fronteira,
 * `Number({amount, currency}) || 0` no `goalsAdapter` transforma a meta em ZERO —
 * número errado em silêncio, que é pior que a tela quebrar: ninguém confere uma
 * meta que "só" está zerada.
 */
const meta = {
  id: 'g1',
  organization_id: 'org-1',
  name: 'Viagem',
  currency: 'BRL',
  target_amount: { amount: '10000.50', currency: 'BRL' },
  current_amount: { amount: '250.00', currency: 'BRL' },
  monthly_target: { amount: '800.00', currency: 'BRL' },
  progress: 2.5,
  status: 'active',
};

describe('goals: dinheiro na fronteira', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('converte os três valores da meta', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: meta });

    const out = await getGoal('g1', 'org-1');

    expect(out.target_amount).toBe(10000.5);
    expect(out.current_amount).toBe(250);
    expect(out.monthly_target).toBe(800);
  });

  it('o progresso continua percentual, não vira objeto nem some', async () => {
    // `progress` não é dinheiro; o caminhar não pode tocá-lo.
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: meta });

    expect((await getGoal('g1', 'org-1')).progress).toBe(2.5);
  });

  it('a listagem converte cada meta', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { goals: [meta, { ...meta, id: 'g2', target_amount: { amount: '500.00', currency: 'BRL' } }] },
    });

    const out = await listGoals('org-1');
    const metas = Array.isArray(out) ? out : out.goals;

    // Com o objeto cru isto daria "0[object Object][object Object]".
    expect(metas.reduce((s, g) => s + g.target_amount, 0)).toBe(10500.5);
  });

  it('meta sem alvo mensal continua sem alvo mensal', async () => {
    // `null` é ausência declarada, não zero — a meta simplesmente não tem aporte
    // mensal planejado.
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { ...meta, monthly_target: null } });

    expect((await getGoal('g1', 'org-1')).monthly_target).toBeNull();
  });

  it('continua lendo a forma antiga — o frontend sobe antes do backend', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { ...meta, target_amount: '10000.50', current_amount: 250 },
    });

    const out = await getGoal('g1', 'org-1');

    expect(out.target_amount).toBe('10000.50');
    expect(out.current_amount).toBe(250);
  });
});
