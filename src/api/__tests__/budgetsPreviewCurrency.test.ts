import { beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from '../client';
import { previewTransactionImpact } from '../budgets';

vi.mock('../client', () => ({ default: { post: vi.fn() } }));

/**
 * #315 — o desembrulho apagava a moeda do preview de impacto, e o painel escrevia
 * "R$" chapado. A moeda declarada nos valores (a base da organização) é carimbada.
 */
describe('previewTransactionImpact', () => {
  beforeEach(() => vi.mocked(apiClient.post).mockReset());

  it('carimba a moeda declarada nos valores e desembrulha os números', async () => {
    const m = (amount: string) => ({ amount, currency: 'USD' });
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        category: { tag_id: 't', tag_name: 'Food', budget_amount: m('500.00'), spent_before: m('90.00'), spent_after: m('100.00'),
          usage_percent_before: 18, usage_percent_after: 20, remaining_before: m('410.00'), remaining_after: m('400.00') },
        budgets_summary: { total_budgeted: m('500.00'), total_spent_before: m('90.00'), total_spent_after: m('100.00'),
          total_remaining_after: m('400.00'), percent_of_total_budget_after: 20 },
        month_projection: null,
      },
    });
    const res = await previewTransactionImpact({ organization_id: 'o', type: 'expense', value: 10, tag_id: 't', date: '2026-11-13' });
    expect(res.currency).toBe('USD');
    expect(res.category.spent_after).toBe(100);
  });

  it('carimba a moeda do RASCUNHO (fincla-api#503) e envia a conta', async () => {
    const m = (amount: string, currency = 'BRL') => ({ amount, currency });
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        category: { tag_id: 't', tag_name: 'Food', budget_amount: m('500.00'), spent_before: m('90.00'), spent_after: m('90.00'),
          usage_percent_before: 18, usage_percent_after: 18, remaining_before: m('410.00'), remaining_after: m('410.00') },
        budgets_summary: { total_budgeted: m('500.00'), total_spent_before: m('90.00'), total_spent_after: m('90.00'),
          total_remaining_after: m('410.00'), percent_of_total_budget_after: 18 },
        month_projection: null,
        draft_amount: m('100.00', 'USD'),
      },
    });
    const body = { organization_id: 'o', type: 'expense' as const, value: 100, tag_id: 't', date: '2026-11-13', account_id: 'acc-usd' };
    const res = await previewTransactionImpact(body);
    expect(vi.mocked(apiClient.post).mock.calls[0][1]).toMatchObject({ account_id: 'acc-usd' });
    expect(res.currency).toBe('BRL');
    expect(res.draft_currency).toBe('USD');
    expect(res.draft_amount).toBe(100);
  });

  it('sem moeda declarada (forma antiga): null, nunca um chute', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { category: { spent_before: '1.00', spent_after: '2.00' }, budgets_summary: { total_spent_after: '2.00' }, month_projection: null },
    });
    const res = await previewTransactionImpact({ organization_id: 'o', type: 'expense', value: 1, tag_id: null, date: '2026-11-13' });
    expect(res.currency).toBeNull();
  });
});
