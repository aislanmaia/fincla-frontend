import { describe, it, expect, beforeEach, vi } from 'vitest';
import apiClient from '../client';

describe('API Client Configuration', () => {
  beforeEach(() => {
    // Limpar mocks entre testes
    vi.clearAllMocks();
  });

  it('deve incluir /v1 na baseURL quando VITE_API_BASE_URL está definido', () => {
    const baseURL = apiClient.defaults.baseURL;
    expect(baseURL).toBeDefined();
    expect(baseURL).toContain('/v1');
  });

  it('deve construir URLs corretas para endpoints de autenticação', () => {
    const baseURL = apiClient.defaults.baseURL;
    const loginEndpoint = '/auth/login';
    const expectedURL = `${baseURL}${loginEndpoint}`;
    
    // Verifica que a URL final contém /v1/auth/login
    expect(expectedURL).toMatch(/\/v1\/auth\/login$/);
  });

  it('deve construir URLs corretas para endpoints de transações', () => {
    const baseURL = apiClient.defaults.baseURL;
    const transactionsEndpoint = '/transactions';
    const expectedURL = `${baseURL}${transactionsEndpoint}`;
    
    // Verifica que a URL final contém /v1/transactions
    expect(expectedURL).toMatch(/\/v1\/transactions$/);
  });

  it('não deve ter /api duplicado na URL', () => {
    const baseURL = apiClient.defaults.baseURL;
    expect(baseURL).not.toContain('/api/v1');
    expect(baseURL).not.toContain('/v1/api');
  });

  it('não deve ter /v1 duplicado na URL', () => {
    const baseURL = apiClient.defaults.baseURL;
    const v1Count = (baseURL?.match(/\/v1/g) || []).length;
    expect(v1Count).toBe(1);
  });

  it('deve ter Content-Type application/json como header padrão', () => {
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
  });
});

