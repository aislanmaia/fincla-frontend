import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { canAccess, CONSULTANT_403_KEY } from '../permissions';
import type { User } from '@/types/api';

const consultantUser: User = {
  id: '1',
  email: 'consultant@example.com',
  role: 'consultant',
  first_name: 'Consultant',
  last_name: 'User',
  subscription: { features: [] },
} as User;

const memberUser: User = {
  id: '2',
  email: 'member@example.com',
  role: 'member',
  first_name: 'Member',
  last_name: 'User',
  subscription: { features: [] },
} as User;

describe('canAccess', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'sessionStorage',
      {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      } as Storage
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false for null user', () => {
    expect(canAccess('consultant', null)).toBe(false);
  });

  it('returns false for undefined user', () => {
    expect(canAccess('consultant', undefined)).toBe(false);
  });

  it('returns false for non-consultant user', () => {
    expect(canAccess('consultant', memberUser)).toBe(false);
  });

  it('returns true for consultant user when no 403 flag', () => {
    vi.mocked(sessionStorage.getItem).mockReturnValue(null);
    expect(canAccess('consultant', consultantUser)).toBe(true);
  });

  it('returns false for consultant user when consultant_403 flag is set', () => {
    vi.mocked(sessionStorage.getItem).mockImplementation((key) =>
      key === CONSULTANT_403_KEY ? '1' : null
    );
    expect(canAccess('consultant', consultantUser)).toBe(false);
  });
});
