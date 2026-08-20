import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENT_REPLAY_HEADER,
  hasObservedIdempotencySupport,
  isValidIdempotencyKey,
  newIdempotencyKey,
  noteIdempotencySupport,
  noteIdempotencySupportFromHeaders,
  readResponseHeader,
  resetIdempotencySupportObservation,
} from '../idempotency';

afterEach(() => {
  resetIdempotencySupportObservation();
});

// O backend rejeita com 400 `INVALID_IDEMPOTENCY_KEY` qualquer chave fora de
// 8–255 chars em [A-Za-z0-9._:-]. Aqui a regra é conferida no formato exato do
// contrato, não numa aproximação.
const CONTRACT_PATTERN = /^[A-Za-z0-9._:-]{8,255}$/;

describe('newIdempotencyKey', () => {
  it('gera chave dentro do contrato do backend, e diferente a cada chamada', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const key = newIdempotencyKey();
      expect(key).toMatch(CONTRACT_PATTERN);
      keys.add(key);
    }
    expect(keys.size).toBe(200);
  });

  it('sem `crypto.randomUUID` (contexto não-seguro), o fallback ainda entrega UUID v4 válido', () => {
    // Sem esse fallback um preview servido por http puro ficaria SEM chave —
    // exatamente onde a proteção contra duplicata mais importa.
    const original = globalThis.crypto;
    try {
      vi.stubGlobal('crypto', { getRandomValues: original.getRandomValues.bind(original) });
      const key = newIdempotencyKey();
      expect(key).toMatch(CONTRACT_PATTERN);
      expect(key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('sem `crypto` nenhum, ainda gera chave válida em vez de explodir', () => {
    try {
      vi.stubGlobal('crypto', undefined);
      expect(newIdempotencyKey()).toMatch(CONTRACT_PATTERN);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('isValidIdempotencyKey', () => {
  it('aceita o alfabeto e o intervalo do contrato', () => {
    expect(isValidIdempotencyKey(newIdempotencyKey())).toBe(true);
    expect(isValidIdempotencyKey('a'.repeat(8))).toBe(true);
    expect(isValidIdempotencyKey('a'.repeat(255))).toBe(true);
    expect(isValidIdempotencyKey('tx:2026-08-20.abc-1')).toBe(true);
  });

  it('recusa curta demais, longa demais, char fora do alfabeto e não-string', () => {
    expect(isValidIdempotencyKey('a'.repeat(7))).toBe(false);
    expect(isValidIdempotencyKey('a'.repeat(256))).toBe(false);
    expect(isValidIdempotencyKey('chave com espaço')).toBe(false);
    expect(isValidIdempotencyKey('chave/com/barra')).toBe(false);
    expect(isValidIdempotencyKey(undefined)).toBe(false);
    expect(isValidIdempotencyKey(12345678)).toBe(false);
  });
});

describe('IDEMPOTENCY_KEY_HEADER', () => {
  it('é exatamente o nome que o backend lê', () => {
    expect(IDEMPOTENCY_KEY_HEADER).toBe('Idempotency-Key');
  });
});

describe('observação de suporte do servidor', () => {
  it('começa em `false`: sem prova, o cliente não repete nada', () => {
    expect(hasObservedIdempotencySupport()).toBe(false);
  });

  it('`Idempotent-Replay` na resposta marca suporte — inclusive quando vale "false"', () => {
    // O que prova suporte é a PRESENÇA do header, não o valor: `false` só diz
    // "esta foi a primeira vez que vi essa chave".
    noteIdempotencySupportFromHeaders({ 'idempotent-replay': 'false' });
    expect(hasObservedIdempotencySupport()).toBe(true);
  });

  it('resposta sem o header (backend antigo) NÃO marca suporte', () => {
    noteIdempotencySupportFromHeaders({ 'content-type': 'application/json' });
    expect(hasObservedIdempotencySupport()).toBe(false);
    noteIdempotencySupportFromHeaders(undefined);
    expect(hasObservedIdempotencySupport()).toBe(false);
  });

  it('um erro de idempotência também serve de prova (via `noteIdempotencySupport`)', () => {
    noteIdempotencySupport();
    expect(hasObservedIdempotencySupport()).toBe(true);
  });
});

describe('readResponseHeader', () => {
  it('lê tanto de objeto cru quanto de `AxiosHeaders` (case-insensitive via `.get`)', () => {
    expect(readResponseHeader({ 'retry-after': '2' }, 'Retry-After')).toBe('2');
    expect(readResponseHeader({ 'Retry-After': '2' }, 'Retry-After')).toBe('2');
    expect(readResponseHeader({ get: (n: string) => (n === 'Retry-After' ? 2 : null) }, 'Retry-After')).toBe('2');
    expect(readResponseHeader({}, IDEMPOTENT_REPLAY_HEADER)).toBeNull();
    expect(readResponseHeader(null, 'Retry-After')).toBeNull();
  });
});
