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

/**
 * A fronteira de normalização é nova (fincla-api#130) e é a única coisa entre o
 * objeto `{amount, currency}` do fio e o `Number(account.initial_balance)` que o
 * `AdjustBalanceModal` faz. Sem estes casos, remover o `.map(normalizeAccount)`
 * deixa a suíte verde e a tela mostrando "R$ NaN" no saldo de abertura.
 */
describe('accounts API client: dinheiro na fronteira', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(apiClient.patch).mockReset();
    vi.mocked(apiClient.delete).mockReset();
  });

  const canonical = (extra = {}) => ({
    id: 'a1',
    organization_id: 'org-1',
    name: 'Conta',
    type: 'checking',
    currency: 'BRL',
    initial_balance: { amount: '1000.50', currency: 'BRL' },
    initial_date: '2025-01-01',
    is_active: true,
    include_in_total: true,
    created_at: '2025-01-01T09:00:00',
    ...extra,
  });

  it('listAccounts converte o saldo de abertura de cada conta', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [canonical()] });

    const out = await listAccounts('org-1');

    expect(out[0].initial_balance).toBe(1000.5);
    expect(typeof out[0].initial_balance).toBe('number');
  });

  it('createAccount, updateAccount e deactivateAccount convertem igual', async () => {
    // Os quatro caminhos devolvem a mesma entidade; um deles esquecer a conversão
    // seria "só o cadastro mostra NaN", que é pior de achar que quebrar sempre.
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: canonical() });
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: canonical() });
    vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: canonical() });

    expect((await createAccount('org-1', { name: 'Conta', type: 'checking' })).initial_balance).toBe(1000.5);
    expect((await updateAccount('a1', 'org-1', { name: 'X' })).initial_balance).toBe(1000.5);
    expect((await deactivateAccount('a1', 'org-1')).initial_balance).toBe(1000.5);
  });

  it('continua lendo a forma antiga — o frontend sobe antes do backend', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [canonical({ initial_balance: '1000.50' }), canonical({ id: 'a2', initial_balance: 250 })],
    });

    const out = await listAccounts('org-1');

    expect(out[0].initial_balance).toBe(1000.5);
    expect(out[1].initial_balance).toBe(250);
  });

  it('saldo de abertura ausente é zero, não NaN', async () => {
    // Piso em zero aqui não é chute: `initial_balance` é `Decimal("0")` por padrão
    // no backend, então zero é o que o campo significa quando não vem.
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [canonical({ initial_balance: null })],
    });

    const out = await listAccounts('org-1');

    expect(out[0].initial_balance).toBe(0);
  });

  it('uma resposta que não é lista não vira exceção', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: null });

    await expect(listAccounts('org-1')).resolves.toEqual([]);
  });
});
