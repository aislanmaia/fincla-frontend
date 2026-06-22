import { beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from '../client';
import { createAccount, deactivateAccount, listAccounts, updateAccount } from '../accounts';

vi.mock('../client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

describe('accounts API client', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(apiClient.patch).mockReset();
    vi.mocked(apiClient.delete).mockReset();
  });

  it('listAccounts envia organization_id e include_inactive=false por padrão', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] });
    await listAccounts('org-1');
    expect(apiClient.get).toHaveBeenCalledWith('/accounts', {
      params: { organization_id: 'org-1', include_inactive: false },
    });
  });

  it('createAccount manda o body e organization_id como query', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 'a1' } });
    await createAccount('org-1', { name: 'Conta', type: 'checking' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/accounts',
      { name: 'Conta', type: 'checking' },
      { params: { organization_id: 'org-1' } },
    );
  });

  it('updateAccount usa PATCH /accounts/:id', async () => {
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: {} });
    await updateAccount('a1', 'org-1', { name: 'Novo nome' });
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/accounts/a1',
      { name: 'Novo nome' },
      { params: { organization_id: 'org-1' } },
    );
  });

  it('deactivateAccount usa DELETE /accounts/:id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: {} });
    await deactivateAccount('a1', 'org-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/accounts/a1', {
      params: { organization_id: 'org-1' },
    });
  });
});
