import { describe, it, expect } from 'vitest';
import apiClient from '../client';
import { API_CONFIG } from '../../config/api';

describe('API Config Integration', () => {
  it('apiClient deve usar API_CONFIG.BASE_URL como fonte única de verdade', () => {
    const clientBaseURL = apiClient.defaults.baseURL;
    const configBaseURL = API_CONFIG.BASE_URL;
    
    expect(clientBaseURL).toBe(configBaseURL);
  });

  it('apiClient deve usar timeout configurado em API_CONFIG', () => {
    const clientTimeout = apiClient.defaults.timeout;
    const configTimeout = API_CONFIG.REQUEST_CONFIG.TIMEOUT;
    
    expect(clientTimeout).toBe(configTimeout);
  });

  it('API_CONFIG.BASE_URL deve conter /v1', () => {
    expect(API_CONFIG.BASE_URL).toContain('/v1');
  });

  it('API_CONFIG.BASE_URL deve terminar com /v1', () => {
    expect(API_CONFIG.BASE_URL).toMatch(/\/v1$/);
  });

  it('API_CONFIG.BASE_URL não deve conter /api/', () => {
    expect(API_CONFIG.BASE_URL).not.toContain('/api/');
  });

  it('API_CONFIG deve exportar configurações de retry', () => {
    expect(API_CONFIG.REQUEST_CONFIG.RETRY_ATTEMPTS).toBeDefined();
    expect(API_CONFIG.REQUEST_CONFIG.RETRY_DELAY).toBeDefined();
  });

  it('API_CONFIG deve exportar todos os endpoints necessários', () => {
    expect(API_CONFIG.ENDPOINTS.AUTH).toBeDefined();
    expect(API_CONFIG.ENDPOINTS.USERS).toBeDefined();
    expect(API_CONFIG.ENDPOINTS.TRANSACTIONS).toBeDefined();
    expect(API_CONFIG.ENDPOINTS.CATEGORIES).toBeDefined();
    expect(API_CONFIG.ENDPOINTS.GOALS).toBeDefined();
    expect(API_CONFIG.ENDPOINTS.REPORTS).toBeDefined();
    expect(API_CONFIG.ENDPOINTS.AI).toBeDefined();
  });

  it('Endpoints em API_CONFIG não devem conter /api ou /v1', () => {
    const allEndpoints = Object.values(API_CONFIG.ENDPOINTS).flatMap((group) =>
      Object.values(group)
    ) as string[];

    allEndpoints.forEach((endpoint) => {
      expect(endpoint).not.toMatch(/^\/api\//);
      expect(endpoint).not.toMatch(/^\/v1\//);
      expect(endpoint).not.toContain('/api/v1');
      expect(endpoint).not.toContain('/v1/api');
    });
  });

  it('buildApiUrl deve construir URLs completas corretamente', async () => {
    const { buildApiUrl } = await import('../../config/api');
    
    const loginUrl = buildApiUrl(API_CONFIG.ENDPOINTS.AUTH.LOGIN);
    expect(loginUrl).toMatch(/\/v1\/auth\/login$/);
    
    const transactionsUrl = buildApiUrl(API_CONFIG.ENDPOINTS.TRANSACTIONS.LIST);
    expect(transactionsUrl).toMatch(/\/v1\/transactions$/);
  });

  it('buildApiUrl deve substituir parâmetros corretamente', async () => {
    const { buildApiUrl } = await import('../../config/api');
    
    const url = buildApiUrl('/transactions/:id', { id: '123' });
    expect(url).toContain('/transactions/123');
    expect(url).not.toContain(':id');
  });
});

