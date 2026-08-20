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

describe('handleApiError — validação 422 do FastAPI vira português', () => {
  const validationError = (detail: unknown) =>
    Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { status: 422, data: { detail } },
    });

  it('traduz a restrição de tamanho e nomeia o campo', () => {
    const err = validationError([
      {
        type: 'string_too_short',
        loc: ['body', 'last4'],
        msg: 'String should have at least 4 characters',
        input: '',
        ctx: { min_length: 4 },
      },
    ]);
    expect(handleApiError(err)).toBe(
      'Últimos 4 dígitos: informe pelo menos 4 caracteres',
    );
  });

  it('traduz campo obrigatório', () => {
    const err = validationError([
      { type: 'missing', loc: ['body', 'email'], msg: 'Field required' },
    ]);
    expect(handleApiError(err)).toBe('E-mail: campo obrigatório');
  });

  it('nunca vaza texto em inglês que não sabemos traduzir', () => {
    const err = validationError([
      { type: 'whatever', loc: ['body', 'mystery'], msg: 'Some brand new pydantic wording' },
    ]);
    expect(handleApiError(err)).toBe('Verifique os dados informados e tente novamente.');
  });

  it('preserva a mensagem de validador customizado do domínio', () => {
    const err = validationError([
      {
        type: 'value_error',
        loc: ['body', 'due_day'],
        msg: 'Value error, Dia do vencimento deve estar entre 1 e 31',
      },
    ]);
    expect(handleApiError(err)).toBe(
      'Dia do vencimento: Dia do vencimento deve estar entre 1 e 31',
    );
  });

  it('nao repete a mesma frase quando varios campos falham igual', () => {
    const err = validationError([
      { type: 'missing', loc: ['body', 'x'], msg: 'Some brand new pydantic wording' },
      { type: 'missing', loc: ['body', 'y'], msg: 'Another unknown wording' },
    ]);
    expect(handleApiError(err)).toBe('Verifique os dados informados e tente novamente.');
  });
});
