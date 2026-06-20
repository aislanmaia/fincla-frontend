import { beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from '../client';
import { createTransfer, deleteTransfer, listTransfers } from '../transfers';

vi.mock('../client', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

describe('transfers API client', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(apiClient.delete).mockReset();
  });

  it('createTransfer manda body + organization_id como query', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 't1' } });
    const body = { from_account_id: 'a1', to_account_id: 'a2', amount: 300 };
    await createTransfer('org-1', body);
    expect(apiClient.post).toHaveBeenCalledWith('/transfers', body, {
      params: { organization_id: 'org-1' },
    });
  });

  it('listTransfers repassa account_id opcional', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] });
    await listTransfers('org-1', 'a1');
    expect(apiClient.get).toHaveBeenCalledWith('/transfers', {
      params: { organization_id: 'org-1', account_id: 'a1' },
    });
  });

  it('deleteTransfer usa DELETE /transfers/:id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: undefined });
    await deleteTransfer('t1', 'org-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/transfers/t1', {
      params: { organization_id: 'org-1' },
    });
  });
});
