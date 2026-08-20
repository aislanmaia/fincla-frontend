// api/idempotency.ts
//
// Chave de idempotência para writes que NÃO são naturalmente idempotentes
// (hoje: `POST /transactions`).
//
// Contrato do backend (fincla-api): header `Idempotency-Key`, **opcional**,
// string opaca de 8 a 255 chars em `[A-Za-z0-9._:-]`, UUID v4 recomendado,
// janela de 24h. Chave nova responde `201` + `Idempotent-Replay: false`;
// chave repetida com o MESMO payload responde `201` + `Idempotent-Replay:
// true` devolvendo a resposta original (mesmo `id`, mesmo `series_id`), sem
// criar nada. Sem o header, o backend se comporta como sempre se comportou —
// por isso subir este frontend antes da API é inofensivo: o header extra é
// simplesmente ignorado por quem não o conhece.

/** Nome do header. Constante porque ele aparece no cliente e nos testes. */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

/** Header de resposta: `true` quando o backend devolveu a resposta original. */
export const IDEMPOTENT_REPLAY_HEADER = 'Idempotent-Replay';

/** Alfabeto e comprimento aceitos pelo backend. Chave fora disso vira 400. */
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,255}$/;

export function isValidIdempotencyKey(value: unknown): value is string {
  return typeof value === 'string' && IDEMPOTENCY_KEY_PATTERN.test(value);
}

const HEX = '0123456789abcdef';

/**
 * UUID v4 aleatório. `crypto.randomUUID` cobre todo browser que suportamos e
 * o Node dos testes; o fallback existe porque `randomUUID` só é exposto em
 * contexto seguro (https/localhost) — num preview servido por http puro ele
 * some, e ficar sem chave justamente ali derrubaria a proteção inteira.
 */
export function newIdempotencyKey(): string {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof webCrypto?.getRandomValues === 'function') {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  // Marca versão (4) e variante (10xx), como manda o RFC 4122.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    if (i === 4 || i === 6 || i === 8 || i === 10) out += '-';
    out += HEX[bytes[i] >> 4] + HEX[bytes[i] & 0x0f];
  }
  return out;
}
