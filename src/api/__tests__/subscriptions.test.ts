import { beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from '../client';
import {
  cancelSubscription,
  changePlan,
  getCurrentSubscription,
} from '../subscriptions';
import { Subscription } from '../types';

vi.mock('../client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const sampleSubscription: Subscription = {
  id: 'sub_local_uuid',
  plan: {
    id: 'essential',
    name: 'Essential',
    description: '',
    audience: 'standard',
    monthly_price_cents: 3990,
    yearly_price_cents: null,
    max_organizations: 1,
    max_users_per_org: 2,
    features: [],
    display_order: 10,
  },
  status: 'active',
  billing_cycle: 'monthly',
  gateway_provider: 'manual',
  current_period_start: null,
  current_period_end: null,
  cancel_at_period_end: false,
  cancelled_at: null,
  recent_invoices: [],
};

describe('subscriptions API client', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
  });

  it('getCurrentSubscription chama /subscriptions/me', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: sampleSubscription });
    const sub = await getCurrentSubscription();
    expect(sub).toEqual(sampleSubscription);
    expect(apiClient.get).toHaveBeenCalledWith('/subscriptions/me');
  });

  it('changePlan envia target_plan_id e billing_cycle', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        subscription_id: 'sub_uuid',
        target_plan_id: 'pro',
        status: 'pending_payment',
        checkout_url: 'https://asaas/i/abc',
      },
    });

    const result = await changePlan({
      target_plan_id: 'pro',
      billing_cycle: 'monthly',
    });
    expect(result.checkout_url).toBe('https://asaas/i/abc');
    expect(apiClient.post).toHaveBeenCalledWith('/subscriptions/change-plan', {
      target_plan_id: 'pro',
      billing_cycle: 'monthly',
    });
  });

  it('cancelSubscription chama /subscriptions/cancel sem body', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        subscription_id: 'sub_uuid',
        status: 'active',
        cancel_at_period_end: true,
        effective_until: '2026-07-01T00:00:00',
      },
    });

    const result = await cancelSubscription();
    expect(result.cancel_at_period_end).toBe(true);
    expect(apiClient.post).toHaveBeenCalledWith('/subscriptions/cancel');
  });
});
