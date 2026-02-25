import { describe, it, expect } from 'vitest';
import { isConsultant } from '../consultant';
import type { User } from '@/types/api';

describe('isConsultant', () => {
  it('returns false when user is null', () => {
    expect(isConsultant(null)).toBe(false);
  });

  it('returns false when user is undefined', () => {
    expect(isConsultant(undefined)).toBe(false);
  });

  it('returns false when user has role owner', () => {
    const user: User = {
      id: '1',
      email: 'owner@example.com',
      role: 'owner',
      created_at: '',
      subscription: { plan: 'free', status: 'active', max_organizations: 1, max_users_per_org: 1, features: [] },
    };
    expect(isConsultant(user)).toBe(false);
  });

  it('returns false when user has role member', () => {
    const user: User = {
      id: '1',
      email: 'member@example.com',
      role: 'member',
      created_at: '',
      subscription: { plan: 'free', status: 'active', max_organizations: 1, max_users_per_org: 1, features: [] },
    };
    expect(isConsultant(user)).toBe(false);
  });

  it('returns false when user has role owner even with consultant features', () => {
    const user: User = {
      id: '1',
      email: 'demo@financeiro.app',
      role: 'owner',
      created_at: '',
      subscription: {
        plan: 'premium',
        status: 'active',
        max_organizations: 10,
        max_users_per_org: 5,
        features: ['client_list'],
      },
    };
    expect(isConsultant(user)).toBe(false);
  });

  it('returns true only when user has role consultant', () => {
    const user: User = {
      id: '1',
      email: 'consultant@example.com',
      role: 'consultant',
      created_at: '',
      subscription: {
        plan: 'premium',
        status: 'active',
        max_organizations: 10,
        max_users_per_org: 5,
        features: [],
      },
    };
    expect(isConsultant(user)).toBe(true);
  });
});
