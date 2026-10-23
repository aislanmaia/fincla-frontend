import { beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from '../client';
import { cancelScheduledCycleChange } from '../creditCards';

vi.mock('../client', () => ({
  default: {
    delete: vi.fn(),
  },
}));

describe('cancelScheduledCycleChange', () => {
  beforeEach(() => {
    vi.mocked(apiClient.delete).mockReset();
  });

  it('chama DELETE /credit-cards/:id/scheduled-cycle com a organização e devolve o cartão', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({
      data: { id: 7, due_day: 10, closing_day: 3, cycle_rules: [] },
    });

    const card = await cancelScheduledCycleChange(7, 'org-1');

    expect(apiClient.delete).toHaveBeenCalledWith('/credit-cards/7/scheduled-cycle', {
      params: { organization_id: 'org-1' },
    });
    expect(card.id).toBe(7);
    expect(card.cycle_rules).toEqual([]);
  });

  it('propaga o 409 do backend', async () => {
    const refusal = { response: { status: 409 } };
    vi.mocked(apiClient.delete).mockRejectedValueOnce(refusal);

    await expect(cancelScheduledCycleChange(7, 'org-1')).rejects.toBe(refusal);
  });
});
