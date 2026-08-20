import axios, { AxiosError } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('preserva detail em array de strings (nao e validacao do pydantic)', () => {
    const err = validationError(['Organização já possui um cartão com esses dígitos']);
    expect(handleApiError(err)).toBe('Organização já possui um cartão com esses dígitos');
  });

  it('nao repete a mesma frase quando varios campos falham igual', () => {
    const err = validationError([
      { type: 'missing', loc: ['body', 'x'], msg: 'Some brand new pydantic wording' },
      { type: 'missing', loc: ['body', 'y'], msg: 'Another unknown wording' },
    ]);
    expect(handleApiError(err)).toBe('Verifique os dados informados e tente novamente.');
  });
});

describe('interceptor de retry — só GET/HEAD, nunca writes', () => {
  // Writes (POST/PUT/PATCH/DELETE) NÃO são idempotentes: repetir cegamente
  // pode duplicar o que a chamada original já tiver feito no servidor.
  // ERR_NETWORK/ECONNRESET não provam que o servidor não recebeu o request —
  // ver o raciocínio completo no comentário acima de `isSafeToRetry` em
  // `../client.ts`. Por isso só GET/HEAD (idempotentes por definição, nunca
  // escrevem) são repetidos aqui.
  //
  // Mede requisições HTTP REAIS via `apiClient.defaults.adapter` — os
  // interceptores de verdade rodam por cima. Mockar `apiClient.get/post`
  // diretamente removeria o próprio interceptor sendo testado da equação.

  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  });

  const originalAdapter = apiClient.defaults.adapter;

  function respondWithStatus(config: any, status: number, data: unknown = {}) {
    const response = { status, statusText: '', data, headers: {}, config };
    if (status >= 200 && status < 300) return response;
    throw new AxiosError(`Request failed with status code ${status}`, undefined, config, undefined, response as any);
  }

  function networkFailure(config: any, code = 'ERR_NETWORK') {
    throw new AxiosError('Network Error', code, config);
  }

  function scriptAdapter(steps: Array<(config: any) => any>) {
    let calls = 0;
    const fn = vi.fn(async (config: any) => {
      calls += 1;
      const step = steps[Math.min(calls, steps.length) - 1];
      return step(config);
    });
    // `Object.assign` avaliaria o getter UMA VEZ e copiaria o valor (0) —
    // precisa de `defineProperty` pra manter o acessor vivo entre chamadas.
    Object.defineProperty(fn, 'callCount', { get: () => calls });
    return fn;
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    apiClient.defaults.adapter = originalAdapter;
  });

  it('GET com ERR_NETWORK transiente: repete e conclui com sucesso (idempotente, seguro)', async () => {
    const adapter = scriptAdapter([
      (config) => networkFailure(config),
      (config) => respondWithStatus(config, 200, { ok: true }),
    ]);
    apiClient.defaults.adapter = adapter as any;

    const promise = apiClient.get('/ping');
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.data).toEqual({ ok: true });
    expect(adapter.callCount).toBe(2);
  });

  it('GET com ERR_NETWORK persistente: para em 3 tentativas (1 inicial + 2 retries)', async () => {
    const adapter = scriptAdapter([
      (config) => networkFailure(config),
      (config) => networkFailure(config),
      (config) => networkFailure(config),
      (config) => networkFailure(config),
    ]);
    apiClient.defaults.adapter = adapter as any;

    const promise = apiClient.get('/ping');
    promise.catch(() => {});
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toMatchObject({ code: 'ERR_NETWORK' });
    expect(adapter.callCount).toBe(3);
  });

  it.each(['post', 'put', 'patch', 'delete'] as const)(
    '%s com ERR_NETWORK: NUNCA repete — exatamente 1 requisição física',
    async (method) => {
      const adapter = scriptAdapter([
        (config) => networkFailure(config),
        (config) => respondWithStatus(config, 200, { ok: true }),
      ]);
      apiClient.defaults.adapter = adapter as any;

      const promise = (apiClient as any)[method]('/transactions', method === 'delete' ? undefined : {});
      promise.catch(() => {});
      await vi.runAllTimersAsync();
      await expect(promise).rejects.toMatchObject({ code: 'ERR_NETWORK' });
      expect(adapter.callCount).toBe(1);
    },
  );

  it('POST com ECONNRESET: NUNCA repete — exatamente 1 requisição física', async () => {
    const adapter = scriptAdapter([
      (config) => networkFailure(config, 'ECONNRESET'),
      (config) => respondWithStatus(config, 200, { ok: true }),
    ]);
    apiClient.defaults.adapter = adapter as any;

    const promise = apiClient.post('/transactions', {});
    promise.catch(() => {});
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toMatchObject({ code: 'ECONNRESET' });
    expect(adapter.callCount).toBe(1);
  });

  it('HEAD com ERR_NETWORK transiente: repete como GET (idempotente, seguro)', async () => {
    const adapter = scriptAdapter([
      (config) => networkFailure(config),
      (config) => respondWithStatus(config, 200, {}),
    ]);
    apiClient.defaults.adapter = adapter as any;

    const promise = apiClient.head('/ping');
    await vi.runAllTimersAsync();
    await promise;
    expect(adapter.callCount).toBe(2);
  });
});

describe('handleApiError — formato legado {error,message,type} humanizado (revisão da PR #95, 3ª rodada)', () => {
  const legacyError = (
    status: number,
    detail: { error: string; message: string; type: string },
  ) =>
    Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { status, data: { detail } },
    });

  it('traduz "at least one tag is required" (create_transaction.py) sem virar o genérico "verifique os dados"', () => {
    const err = legacyError(422, {
      error: 'BUSINESS_LOGIC_ERROR',
      message: 'At least one tag is required',
      type: 'business_logic',
    });
    expect(handleApiError(err)).toBe('Selecione ao menos uma tag para a transação.');
  });

  it('traduz "at least one tag of type X is required" preservando o tipo (mesmo caso de uso da mensagem acima, registro diferente)', () => {
    const err = legacyError(422, {
      error: 'BUSINESS_LOGIC_ERROR',
      message: "At least one tag of type 'Categoria' is required",
      type: 'business_logic',
    });
    expect(handleApiError(err)).toBe(
      'Selecione ao menos uma tag do tipo "Categoria" para a transação.',
    );
  });

  it('traduz "paid_date is required when status is paid" (mark-invoice-paid)', () => {
    const err = legacyError(400, {
      error: 'INVALID_INVOICE',
      message: "paid_date is required when status is 'paid'",
      type: 'domain_validation',
    });
    expect(handleApiError(err)).toBe(
      'Informe a data de pagamento para marcar a fatura como paga.',
    );
  });

  it('nao vaza mensagem legada marcada como vazamento interno — cai no fallback por status, nao no texto cru', () => {
    const err = legacyError(500, {
      error: 'CONSULTANT_SERVICE_ERROR',
      message:
        'Failed to fetch memberships: (psycopg2.OperationalError) connection refused',
      type: 'internal_error',
    });
    const message = handleApiError(err);
    expect(message).toBe('Erro interno do servidor. Tente novamente mais tarde.');
    expect(message).not.toContain('psycopg2');
  });
});

describe('handleApiError — código de erro vindo da rede não pode indexar o protótipo', () => {
  // `detail.error` chega da API e era usado para indexar um objeto literal de
  // traduções. Com `"__proto__"` isso devolvia `Object.prototype`, e o React
  // derrubava a tela inteira com "Objects are not valid as a React child";
  // `"hasOwnProperty"` devolvia uma função. A tabela virou `Map` por isso.
  const legacyError = (
    status: number,
    detail: { error: string; message: string; type: string },
  ) =>
    Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { status, data: { detail } },
    });

  it.each(['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty'])(
    'detail.error = "%s" continua devolvendo string exibível',
    (code) => {
      const err = legacyError(422, {
        error: code,
        message: 'At least one tag is required',
        type: 'business_logic',
      });
      const message = handleApiError(err);
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    },
  );

  it('a tradução legítima por código segue funcionando', () => {
    const err = legacyError(409, {
      error: 'PHONE_ALREADY_LINKED',
      message: 'Phone already linked',
      type: 'business_logic',
    });
    expect(handleApiError(err)).toBe(
      'Este número já está vinculado para esta ou outra conta.',
    );
  });
});
