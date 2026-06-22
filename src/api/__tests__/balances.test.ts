import { beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from '../client';
import { getAccountBalance, getBalanceSummary, getOrgBalances } from '../balances';

vi.mock('../client', () => ({ default: { get: vi.fn() } }));

describe('balances API client', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('getOrgBalances envia organization_id (at_date opcional)', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { as_of: 'x', total: 0, accounts: [] } });
    await getOrgBalances('org-1');
    expect(apiClient.get).toHaveBeenCalledWith('/balances', {
      params: { organization_id: 'org-1', at_date: undefined },
    });
  });

  it('getOrgBalances repassa at_date', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { as_of: 'x', total: 0, accounts: [] } });
    await getOrgBalances('org-1', '2026-06-01');
    expect(apiClient.get).toHaveBeenCalledWith('/balances', {
      params: { organization_id: 'org-1', at_date: '2026-06-01' },
    });
  });

  it('getBalanceSummary usa /balances/summary', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { as_of: 'x', total_available: 0, total_all: 0, account_count: 0, by_type: [] } });
    await getBalanceSummary('org-1');
    expect(apiClient.get).toHaveBeenCalledWith('/balances/summary', {
      params: { organization_id: 'org-1', at_date: undefined },
    });
  });

  it('getAccountBalance usa /balances/:id', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: {} });
    await getAccountBalance('a1', 'org-1');
    expect(apiClient.get).toHaveBeenCalledWith('/balances/a1', {
      params: { organization_id: 'org-1', at_date: undefined },
    });
  });
});
