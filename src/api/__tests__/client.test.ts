import axios from 'axios';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import apiClient, { errorCode, handleApiError } from '../client';

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

describe('handleApiError — envelope seguro e UX', () => {
  it('usa message do envelope sanitizado (safe-errors)', () => {
    const err = new axios.AxiosError('fail');
    err.response = {
      status: 404,
      data: {
        detail: {
          code: 'not_found',
          message: 'Cartão não encontrado na sua conta.',
        },
      },
    } as typeof err.response;
    expect(handleApiError(err)).toBe('Cartão não encontrado na sua conta.');
    expect(errorCode(err)).toBe('not_found');
  });

  it('usa message do formato legado { error, message, type }', () => {
    const err = new axios.AxiosError('fail');
    err.response = {
      status: 403,
      data: {
        detail: {
          error: 'ACCESS_DENIED',
          message: 'Você não tem acesso',
          type: 'authorization_error',
        },
      },
    } as typeof err.response;
    expect(handleApiError(err)).toBe('Você não tem acesso');
    expect(errorCode(err)).toBeUndefined();
  });

  it('humaniza string estilo "field is required" em 422', () => {
    const err = new axios.AxiosError('fail');
    err.response = {
      status: 422,
      data: { detail: 'card_id is required for credit card expenses' },
    } as typeof err.response;
    expect(handleApiError(err)).toContain('Verifique os dados');
  });

  it('não vaza JSON de objeto genérico para erros não-Axios', () => {
    expect(handleApiError({ foo: 'bar' })).toBe(
      'Algo deu errado. Tente novamente mais tarde.',
    );
  });

  it('fallback 503 amigável quando body não traz mensagem útil', () => {
    const err = new axios.AxiosError('fail');
    err.response = { status: 503, data: {} } as typeof err.response;
    expect(handleApiError(err)).toBe(
      'Serviço temporariamente indisponível. Tente novamente em instantes.',
    );
  });
});

