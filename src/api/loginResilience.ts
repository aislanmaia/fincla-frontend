import axios from 'axios';

import { errorCode } from './apiError';

/**
 * Limites para login em ambientes com cold start (ex.: Fly.io free).
 * Evita loop infinito com teto de tentativas + orçamento de tempo total.
 */
export const LOGIN_RESILIENCE = {
  /** Tentativas incluindo a primeira (ex.: 5 => até 4 esperas entre falhas). */
  maxAttempts: 5,
  initialDelayMs: 700,
  maxDelayMs: 7000,
  /** Para de tentar após este tempo desde a primeira requisição. */
  totalWallClockMs: 45000,
} as const;

function backoffAfterFailureMs(failureIndex: number): number {
  const { initialDelayMs, maxDelayMs } = LOGIN_RESILIENCE;
  const exp = initialDelayMs * 2 ** Math.max(0, failureIndex - 1);
  const capped = Math.min(exp, maxDelayMs);
  const jitter = Math.floor(Math.random() * 400);
  return capped + jitter;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Falhas típicas ao acordar o backend: rede, timeout, 502/503/504, rate limit leve.
 * Não inclui credenciais inválidas (401/400) nem erros de validação.
 */
export function isTransientLoginFailure(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  if (!error.response) {
    const code = error.code;
    return (
      code === 'ERR_NETWORK' ||
      code === 'ECONNABORTED' ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNRESET' ||
      code === 'ECONNREFUSED' ||
      code === 'EAI_AGAIN'
    );
  }

  const status = error.response.status;
  if (
    status === 408 ||
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return true;
  }

  const safe = errorCode(error);
  return safe === 'service_unavailable' || safe === 'rate_limited';
}

/**
 * Executa `operation` com retries apenas quando `isTransient` for true,
 * respeitando `maxAttempts` e `totalWallClockMs`.
 */
export async function withTransientRetries<T>(
  operation: () => Promise<T>,
  isTransient: (error: unknown) => boolean,
): Promise<T> {
  const { maxAttempts, totalWallClockMs } = LOGIN_RESILIENCE;
  const started = Date.now();
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt >= maxAttempts;
      if (isLastAttempt || !isTransient(error)) {
        throw error;
      }
      const elapsed = Date.now() - started;
      const remaining = totalWallClockMs - elapsed;
      const waitMs = backoffAfterFailureMs(attempt);
      if (waitMs > remaining) {
        throw error;
      }
      await sleep(waitMs);
    }
  }

  throw lastError;
}
