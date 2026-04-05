import { describe, it, expect } from 'vitest';
import apiClient from '../client';

describe('API Endpoints URL Construction', () => {
  const baseURL = apiClient.defaults.baseURL || '';

  describe('Authentication Endpoints', () => {
    it('Login endpoint deve resultar em /v1/auth/login', () => {
      const endpoint = '/auth/login';
      const fullURL = `${baseURL}${endpoint}`;
      expect(fullURL).toMatch(/\/v1\/auth\/login$/);
    });

    it('Forgot password deve resultar em /v1/auth/forgot-password', () => {
      const endpoint = '/auth/forgot-password';
      expect(`${baseURL}${endpoint}`).toMatch(/\/v1\/auth\/forgot-password$/);
    });

    it('Reset password deve resultar em /v1/auth/reset-password', () => {
      const endpoint = '/auth/reset-password';
      expect(`${baseURL}${endpoint}`).toMatch(/\/v1\/auth\/reset-password$/);
    });

    it('Register endpoint deve resultar em /v1/auth/register', () => {
      const endpoint = '/auth/register';
      const fullURL = `${baseURL}${endpoint}`;
      expect(fullURL).toMatch(/\/v1\/auth\/register$/);
    });

    it('Get current user endpoint deve resultar em /v1/auth/me', () => {
      const endpoint = '/auth/me';
      const fullURL = `${baseURL}${endpoint}`;
      expect(fullURL).toMatch(/\/v1\/auth\/me$/);
    });
  });

  describe('Organization Endpoints', () => {
    it('Create organization endpoint deve resultar em /v1/organizations', () => {
      const endpoint = '/organizations';
      const fullURL = `${baseURL}${endpoint}`;
      expect(fullURL).toMatch(/\/v1\/organizations$/);
    });

    it('Create invitations deve resultar em /v1/organizations/{id}/invitations', () => {
      const endpoint = '/organizations/org-1/invitations';
      expect(`${baseURL}${endpoint}`).toMatch(
        /\/v1\/organizations\/org-1\/invitations$/,
      );
    });

    it('List invitations deve resultar em /v1/organizations/{id}/invitations', () => {
      const endpoint = '/organizations/org-1/invitations';
      expect(`${baseURL}${endpoint}`).toMatch(
        /\/v1\/organizations\/org-1\/invitations$/,
      );
    });

    it('My organizations endpoint deve resultar em /v1/memberships/my-organizations', () => {
      const endpoint = '/memberships/my-organizations';
      const fullURL = `${baseURL}${endpoint}`;
      expect(fullURL).toMatch(/\/v1\/memberships\/my-organizations$/);
    });
  });

  describe('Invitations (aceite público)', () => {
    it('Accept invitation deve resultar em /v1/invitations/accept', () => {
      const endpoint = '/invitations/accept';
      expect(`${baseURL}${endpoint}`).toMatch(/\/v1\/invitations\/accept$/);
    });
  });

  describe('Transaction Endpoints', () => {
    it('List transactions endpoint deve resultar em /v1/transactions', () => {
      const endpoint = '/transactions';
      const fullURL = `${baseURL}${endpoint}`;
      expect(fullURL).toMatch(/\/v1\/transactions$/);
    });

    it('Create transaction endpoint deve resultar em /v1/transactions', () => {
      const endpoint = '/transactions';
      const fullURL = `${baseURL}${endpoint}`;
      expect(fullURL).toMatch(/\/v1\/transactions$/);
    });
  });

  describe('Tags Endpoints', () => {
    it('List tag types endpoint deve resultar em /v1/tag-types', () => {
      const endpoint = '/tag-types';
      const fullURL = `${baseURL}${endpoint}`;
      expect(fullURL).toMatch(/\/v1\/tag-types$/);
    });

    it('List tags endpoint deve resultar em /v1/tags', () => {
      const endpoint = '/tags';
      const fullURL = `${baseURL}${endpoint}`;
      expect(fullURL).toMatch(/\/v1\/tags$/);
    });
  });

  describe('Credit Cards Endpoints', () => {
    it('List credit cards endpoint deve resultar em /v1/credit-cards', () => {
      const endpoint = '/credit-cards';
      const fullURL = `${baseURL}${endpoint}`;
      expect(fullURL).toMatch(/\/v1\/credit-cards$/);
    });

    it('Get invoice endpoint deve resultar em /v1/credit-cards/{id}/invoices/{year}/{month}', () => {
      const endpoint = '/credit-cards/1/invoices/2025/1';
      const fullURL = `${baseURL}${endpoint}`;
      expect(fullURL).toMatch(/\/v1\/credit-cards\/1\/invoices\/2025\/1$/);
    });
  });

  describe('Goals, budgets, analytics, notifications, chat', () => {
    it.each([
      ['/goals', /\/v1\/goals$/],
      ['/budgets', /\/v1\/budgets$/],
      ['/recurring-series', /\/v1\/recurring-series$/],
      ['/recurring-transactions', /\/v1\/recurring-transactions$/],
      ['/test/reset-organization', /\/v1\/test\/reset-organization$/],
      ['/test/seed', /\/v1\/test\/seed$/],
      ['/analytics/monthly-evolution', /\/v1\/analytics\/monthly-evolution$/],
      ['/notifications', /\/v1\/notifications$/],
      ['/ai/chat', /\/v1\/ai\/chat$/],
      ['/financial-impact/simulate', /\/v1\/financial-impact\/simulate$/],
    ])('%s → %s', (path, pattern) => {
      expect(`${baseURL}${path}`).toMatch(pattern);
    });
  });

  describe('URL Pattern Validation', () => {
    it('Base URL não deve conter /api/', () => {
      expect(baseURL).not.toContain('/api/');
    });

    it('Base URL não deve conter /v1/api', () => {
      expect(baseURL).not.toContain('/v1/api');
    });

    it('Base URL não deve conter /api/v1', () => {
      expect(baseURL).not.toContain('/api/v1');
    });

    it('Base URL deve terminar com /v1', () => {
      expect(baseURL).toMatch(/\/v1$/);
    });
  });
});

