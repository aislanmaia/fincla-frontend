import { beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from '../client';
import { getPlan, listPlans } from '../plans';
import { Plan } from '../types';

vi.mock('../client', () => ({
  default: {
    get: vi.fn(),
  },
}));

const samplePlan: Plan = {
  id: 'essential',
  name: 'Essential',
  description: 'Plano essencial',
  audience: 'standard',
  monthly_price_cents: 3990,
  yearly_price_cents: null,
  max_organizations: 1,
  max_users_per_org: 2,
  features: ['manual_transactions', 'whatsapp_assistant'],
  display_order: 10,
};

describe('plans API client', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('listPlans envia audience=standard por padrão e devolve items', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { items: [samplePlan] },
    });

    const plans = await listPlans();
    expect(plans).toEqual([samplePlan]);
    expect(apiClient.get).toHaveBeenCalledWith('/plans', {
      params: { audience: 'standard' },
    });
  });

  it('listPlans repassa audience consultant', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { items: [] } });

    await listPlans('consultant');
    expect(apiClient.get).toHaveBeenCalledWith('/plans', {
      params: { audience: 'consultant' },
    });
  });

  it('listPlans retorna array vazio quando items ausente', async () => {
    // Defesa contra mudança contratual silenciosa do backend.
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: {} });
    const plans = await listPlans();
    expect(plans).toEqual([]);
  });

  it('getPlan chama /plans/:id', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: samplePlan });
    const plan = await getPlan('essential');
    expect(plan).toEqual(samplePlan);
    expect(apiClient.get).toHaveBeenCalledWith('/plans/essential');
  });
});
