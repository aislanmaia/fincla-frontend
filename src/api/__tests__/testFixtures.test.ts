import { describe, it, expect, vi, beforeEach } from 'vitest';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      post,
      defaults: { baseURL: '' },
    })),
  },
}));

import { resetTestOrganization, seedTestOrganization } from '../testFixtures';

describe('testFixtures', () => {
  beforeEach(() => {
    post.mockReset();
  });

  it('resetTestOrganization envia POST /test/reset-organization e header X-Test-Reset-Token', async () => {
    post.mockResolvedValueOnce({
      data: {
        organization_id: 'uuid-1',
        provisioned: {
          organization_created: false,
          owner_user_created: false,
          membership_created: false,
        },
        deleted: { transactions: 0 },
        preserved: ['organization'],
      },
    });

    const out = await resetTestOrganization('secret-xyz', { ensure_fixtures: true });
    expect(out.organization_id).toBe('uuid-1');
    expect(post).toHaveBeenCalledWith(
      '/test/reset-organization',
      { ensure_fixtures: true },
      { headers: { 'X-Test-Reset-Token': 'secret-xyz' } },
    );
  });

  it('seedTestOrganization envia POST /test/seed', async () => {
    post.mockResolvedValueOnce({
      data: {
        organization_id: 'uuid-1',
        profile: 'recurring_e2e',
        seeded: { recurring_series: 2 },
      },
    });

    const out = await seedTestOrganization('tok', {
      organization_id: 'uuid-1',
      profile: 'recurring_e2e',
    });
    expect(out.seeded.recurring_series).toBe(2);
    expect(post).toHaveBeenCalledWith(
      '/test/seed',
      { organization_id: 'uuid-1', profile: 'recurring_e2e' },
      { headers: { 'X-Test-Reset-Token': 'tok' } },
    );
  });
});
