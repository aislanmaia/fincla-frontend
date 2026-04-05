import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '../client';
import { listRecurringSeries } from '../recurringSeries';

vi.mock('../client', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('listRecurringSeries (client)', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { series: [], summary: { total_monthly_income: 0, total_monthly_expense: 0, active_count: 0, paused_count: 0 } },
    });
  });

  it('envia organization_id e is_active', async () => {
    await listRecurringSeries('org-a', { isActive: true });
    expect(apiClient.get).toHaveBeenCalledWith('/recurring-series', {
      params: { organization_id: 'org-a', is_active: true },
    });
  });

  it('envia date_start e date_end quando período completo', async () => {
    await listRecurringSeries('org-b', {
      isActive: true,
      dateStart: '2025-06-01',
      dateEnd: '2025-06-30',
    });
    expect(apiClient.get).toHaveBeenCalledWith('/recurring-series', {
      params: {
        organization_id: 'org-b',
        is_active: true,
        date_start: '2025-06-01',
        date_end: '2025-06-30',
      },
    });
  });

  it('omite datas quando só uma está definida (evita 422 no backend)', async () => {
    await listRecurringSeries('org-c', { isActive: false, dateStart: '2025-01-01' });
    expect(apiClient.get).toHaveBeenCalledWith('/recurring-series', {
      params: { organization_id: 'org-c', is_active: false },
    });
  });

  it('aceita chamada só com organization_id', async () => {
    await listRecurringSeries('org-d');
    expect(apiClient.get).toHaveBeenCalledWith('/recurring-series', {
      params: { organization_id: 'org-d' },
    });
  });
});
