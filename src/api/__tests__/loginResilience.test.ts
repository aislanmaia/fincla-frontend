import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LOGIN_RESILIENCE,
  isTransientLoginFailure,
  withTransientRetries,
} from '../loginResilience';

function networkError(): axios.AxiosError {
  const e = new axios.AxiosError('Network Error');
  e.code = 'ERR_NETWORK';
  return e;
}

function httpError(
  status: number,
  data?: { detail?: unknown },
): axios.AxiosError {
  const e = new axios.AxiosError('fail');
  e.response = {
    status,
    statusText: '',
    data: data ?? {},
    headers: {},
    config: {} as any,
  };
  return e;
}

describe('isTransientLoginFailure', () => {
  it('considera falha de rede sem response', () => {
    expect(isTransientLoginFailure(networkError())).toBe(true);
  });

  it('não considera 401 (credenciais)', () => {
    expect(isTransientLoginFailure(httpError(401))).toBe(false);
  });

  it('não considera 400', () => {
    expect(isTransientLoginFailure(httpError(400))).toBe(false);
  });

  it('considera 503', () => {
    expect(isTransientLoginFailure(httpError(503))).toBe(true);
  });

  it('considera envelope service_unavailable', () => {
    expect(
      isTransientLoginFailure(
        httpError(422, {
          detail: {
            code: 'service_unavailable',
            message: 'Indisponível',
          },
        }),
      ),
    ).toBe(true);
  });
});

describe('withTransientRetries', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('respeita maxAttempts em falhas persistentes', async () => {
    const op = vi.fn().mockRejectedValue(networkError());
    const p = withTransientRetries(op, () => true);
    await Promise.all([
      expect(p).rejects.toMatchObject({ code: 'ERR_NETWORK' }),
      vi.runAllTimersAsync(),
    ]);
    expect(op).toHaveBeenCalledTimes(LOGIN_RESILIENCE.maxAttempts);
  });

  it('resolve na segunda tentativa após backoff', async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(networkError())
      .mockResolvedValueOnce('ok');

    const p = withTransientRetries(op, () => true);
    await Promise.all([expect(p).resolves.toBe('ok'), vi.runAllTimersAsync()]);
    expect(op).toHaveBeenCalledTimes(2);
  });

  it('não retenta quando a falha não é transitória', async () => {
    const op = vi.fn().mockRejectedValue(httpError(401));
    const p = withTransientRetries(op, isTransientLoginFailure);
    await expect(p).rejects.toBeDefined();
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('para se o orçamento de tempo não cobre o próximo backoff', async () => {
    const op = vi.fn().mockRejectedValue(networkError());
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValue(LOGIN_RESILIENCE.totalWallClockMs + 1);

    const p = withTransientRetries(op, () => true);
    await expect(p).rejects.toBeDefined();
    expect(op).toHaveBeenCalledTimes(1);
  });
});
