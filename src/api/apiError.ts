/**
 * Alinhado a fincla-api/docs/FRONTEND_API_GUIDE.md — envelope de erro
 * sanitizado, legado estruturado e string simples.
 */

import axios from 'axios';

export type SafeErrorCode =
  | 'validation'
  | 'business_rule'
  | 'not_found'
  | 'conflict'
  | 'unauthenticated'
  | 'access_denied'
  | 'rate_limited'
  | 'service_unavailable'
  | 'internal_error';

export interface SafeErrorDetail {
  code: SafeErrorCode;
  message: string;
}

export interface LegacyErrorDetail {
  error: string;
  message: string;
  type: string;
}

export type ApiErrorDetail = SafeErrorDetail | LegacyErrorDetail | string;

export interface ApiErrorBody {
  detail: ApiErrorDetail;
  status?: number;
}

export const isSafeError = (
  detail: unknown,
): detail is SafeErrorDetail =>
  typeof detail === 'object' &&
  detail !== null &&
  'code' in detail &&
  'message' in detail &&
  typeof (detail as SafeErrorDetail).message === 'string';

export const isLegacyError = (
  detail: unknown,
): detail is LegacyErrorDetail =>
  typeof detail === 'object' &&
  detail !== null &&
  'type' in detail &&
  'error' in detail &&
  'message' in detail &&
  typeof (detail as LegacyErrorDetail).message === 'string';

/** Padrão típico de validação FastAPI/Pydantic em inglês — não amigável ao usuário final. */
const SNAKE_FIELD_REQUIRED_EN =
  /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)* is required\.?$/i;

/** "card_id is required for …" e variações. */
const FIELD_REQUIRED_LOOSE_EN = /\b[a-z][a-z0-9_]* is required\b/i;

function looksLikeInternalLeak(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('traceback') ||
    lower.includes('sqlalchemy') ||
    lower.includes('psycopg') ||
    lower.includes('postgresql') ||
    lower.includes('deadlock') ||
    lower.includes('connection refused') ||
    /[0-9a-f]{32}/i.test(text) ||
    text.length > 600
  );
}

/** Mensagem de `Error` nativo: segura para UI ou string vazia se parecer interna. */
export function sanitizeUnknownErrorMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed || looksLikeInternalLeak(trimmed)) {
    return '';
  }
  return trimmed;
}

/**
 * Converte `detail` string bruta em texto seguro para UI.
 * Evita exibir nomes de campos internos ou mensagens de driver.
 */
export function humanizeDetailString(
  raw: string,
  httpStatus: number | undefined,
): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  if (looksLikeInternalLeak(trimmed)) {
    return '';
  }
  if (SNAKE_FIELD_REQUIRED_EN.test(trimmed)) {
    if (httpStatus === 400 || httpStatus === 422) {
      return 'Verifique os dados informados e tente novamente.';
    }
    return 'Não foi possível concluir a operação. Tente novamente.';
  }
  if (FIELD_REQUIRED_LOOSE_EN.test(trimmed)) {
    if (httpStatus === 400 || httpStatus === 422) {
      return 'Verifique os dados informados e tente novamente.';
    }
    return 'Não foi possível concluir a operação. Tente novamente.';
  }
  return trimmed;
}

/**
 * Código sanitizado estável, ou `undefined` quando a resposta é legado / string / sem body.
 */
export const errorCode = (error: unknown): SafeErrorCode | undefined => {
  if (!axios.isAxiosError(error)) return undefined;
  const detail = (error.response?.data as ApiErrorBody | undefined)?.detail;
  return isSafeError(detail) ? detail.code : undefined;
};
