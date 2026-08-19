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

/**
 * O backend manda dinheiro como STRING.
 *
 * `total_available` é `Decimal` no Pydantic v2, que serializa para `"315.57"` em
 * JSON — nunca `315.57`. O tipo declarava `number` e nenhum teste jamais alimentou
 * o formato real: todos os mocks, aqui e no RTL do dashboard, usavam número. A
 * suíte ficava verde enquanto produção exibia "Dados indisponíveis" com a API
 * respondendo 200, porque a Visão Geral passou a checar `typeof === "number"` para
 * separar "sem saldo" de "saldo zero".
 *
 * Estes testes usam o payload como ele chega de verdade.
 */
describe('balances API client — dinheiro chega como string', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('getBalanceSummary converte os totais para número', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        as_of: '2026-08-19T12:00:00',
        total_available: '315.57',
        total_all: '315.57',
        account_count: 1,
        by_type: [{ type: 'checking', balance: '315.57', account_count: 1 }],
      },
    });
    const out = await getBalanceSummary('org-1');
    expect(out.total_available).toBe(315.57);
    expect(typeof out.total_available).toBe('number');
    expect(out.total_all).toBe(315.57);
    expect(out.by_type[0].balance).toBe(315.57);
  });

  it('preserva o zero e o negativo — zero é saldo legítimo', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { as_of: 'x', total_available: '0.00', total_all: '-1500.00', account_count: 2, by_type: [] },
    });
    const out = await getBalanceSummary('org-1');
    expect(out.total_available).toBe(0);
    expect(out.total_all).toBe(-1500);
  });

  it('vira null quando não é número finito — nunca zero inventado', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { as_of: 'x', total_available: null, total_all: 'abc', account_count: 0, by_type: [] },
    });
    const out = await getBalanceSummary('org-1');
    expect(out.total_available).toBeNull();
    expect(out.total_all).toBeNull();
  });

  it('aceita número também — o dia em que o backend parar de mandar string', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { as_of: 'x', total_available: 42.5, total_all: 42.5, account_count: 1, by_type: [] },
    });
    const out = await getBalanceSummary('org-1');
    expect(out.total_available).toBe(42.5);
  });

  it('getOrgBalances converte o total e o saldo de cada conta', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        as_of: 'x',
        total: '1000.50',
        accounts: [{ account_id: 'a1', name: 'Conta', type: 'checking', currency: 'BRL', initial_balance: 0, balance: '1000.50', include_in_total: true }],
      },
    });
    const out = await getOrgBalances('org-1');
    expect(out.total).toBe(1000.5);
    expect(out.accounts[0].balance).toBe(1000.5);
  });
});
