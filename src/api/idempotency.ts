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
// criar nada.
//
// ORDEM DE DEPLOY. Mandar o header contra um backend que não o conhece é
// inofensivo — ele ignora o que não entende. O que NÃO é inofensivo é o retry
// automático que essa chave destrava: contra um backend sem idempotência, três
// POSTs de um `ERR_NETWORK` viram três transações. Por isso o suporte é
// OBSERVADO em tempo de execução (`Idempotent-Replay` na resposta, ou um erro
// de idempotência no corpo) e o retry fica desligado até haver prova. Sem a
// API no ar, o comportamento é exatamente o de hoje: uma requisição, sem
// repetição.

/** Nome do header. Constante porque ele aparece no cliente e nos testes. */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

/** Header de resposta: `true` quando o backend devolveu a resposta original. */
export const IDEMPOTENT_REPLAY_HEADER = 'Idempotent-Replay';

/** Alfabeto e comprimento aceitos pelo backend. Chave fora disso vira 400. */
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,255}$/;

export function isValidIdempotencyKey(value: unknown): value is string {
  return typeof value === 'string' && IDEMPOTENCY_KEY_PATTERN.test(value);
}

/**
 * Lê um header de uma resposta do axios. `response.headers` é um
 * `AxiosHeaders` (case-insensitive via `.get`) em produção, mas objeto cru em
 * teste e em adapters customizados — as duas formas passam por aqui.
 */
export function readResponseHeader(headers: unknown, name: string): string | null {
  if (!headers || typeof headers !== 'object') return null;
  const bag = headers as Record<string, unknown> & { get?: (n: string) => unknown };
  const raw =
    typeof bag.get === 'function'
      ? bag.get(name)
      : (bag[name] ?? bag[name.toLowerCase()] ?? bag[name.toUpperCase()]);
  if (raw == null) return null;
  return String(raw);
}

// Suporte OBSERVADO do servidor a `Idempotency-Key`. Em memória de propósito:
// persistir em storage carregaria um "sim" para depois de um rollback do
// backend, que é justamente quando repetir volta a duplicar. O custo é que a
// PRIMEIRA criação depois de cada carregamento de página não tem retry
// automático — preço barato por nunca duplicar por otimismo.
let supportObserved = false;

/** Marca suporte a partir dos headers de uma resposta de criação. */
export function noteIdempotencySupportFromHeaders(headers: unknown): void {
  if (readResponseHeader(headers, IDEMPOTENT_REPLAY_HEADER) != null) {
    supportObserved = true;
  }
}

/**
 * Marca suporte por evidência que não vem do header — um erro de idempotência
 * no corpo (409/422/400) só existe num backend que implementa a feature.
 */
export function noteIdempotencySupport(): void {
  supportObserved = true;
}

export function hasObservedIdempotencySupport(): boolean {
  return supportObserved;
}

/** Só para testes: volta ao estado "nunca vi o servidor confirmar suporte". */
export function resetIdempotencySupportObservation(): void {
  supportObserved = false;
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
