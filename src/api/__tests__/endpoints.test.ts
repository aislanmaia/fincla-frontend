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

    it('My organizations endpoint deve resultar em /v1/memberships/my-organizations', () => {
      const endpoint = '/memberships/my-organizations';
      const fullURL = `${baseURL}${endpoint}`;
      expect(fullURL).toMatch(/\/v1\/memberships\/my-organizations$/);
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

