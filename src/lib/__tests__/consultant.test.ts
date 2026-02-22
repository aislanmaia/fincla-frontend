import { describe, it, expect } from 'vitest';
import { isConsultant } from '../consultant';
import type { User } from '@/types/api';

describe('isConsultant', () => {
  it('returns false when user is null', () => {
    expect(isConsultant(null)).toBe(false);
  });

  it('returns false when user has no subscription', () => {
    expect(
      isConsultant({
        id: '1',
        email: 'a@b.com',
        role: 'owner',
        created_at: '',
      } as User)
    ).toBe(false);
  });

  it('returns true when user has multi_org_dashboard', () => {
    const user: User = {
      id: '1',
      email: 'a@b.com',
      role: 'owner',
      created_at: '',
      subscription: {
        plan: 'premium',
        status: 'active',
        max_organizations: 10,
        max_users_per_org: 5,
        features: ['multi_org_dashboard'],
      },
    };
    expect(isConsultant(user)).toBe(true);
  });

  it('returns false when user has no consultant features', () => {
    const user: User = {
      id: '1',
      email: 'a@b.com',
      role: 'owner',
      created_at: '',
      subscription: {
        plan: 'free',
        status: 'active',
        max_organizations: 1,
        max_users_per_org: 1,
        features: [],
      },
    };
    expect(isConsultant(user)).toBe(false);
  });

  it('returns false for demo user even with consultant features', () => {
    const user: User = {
      id: '1',
      email: 'demo@fincla.com.app',
      role: 'owner',
      created_at: '',
      subscription: {
        plan: 'premium',
        status: 'active',
        max_organizations: 10,
        max_users_per_org: 5,
        features: ['multi_org_dashboard'],
      },
    };
    expect(isConsultant(user)).toBe(false);
  });
});
