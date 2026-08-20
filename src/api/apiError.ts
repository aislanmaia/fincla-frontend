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
 * Rótulos PT-BR para os campos que aparecem em erro de validação de tela.
 * Só precisa cobrir o que o usuário realmente digita — o resto cai no
 * texto genérico, que já é português.
 */
const FIELD_LABELS_PT: Record<string, string> = {
  last4: 'Últimos 4 dígitos',
  brand: 'Bandeira',
  due_day: 'Dia do vencimento',
  closing_day: 'Dia de fechamento',
  credit_limit: 'Limite',
  organization_id: 'Organização',
  email: 'E-mail',
  password: 'Senha',
  new_password: 'Nova senha',
  current_password: 'Senha atual',
  name: 'Nome',
  description: 'Descrição',
  value: 'Valor',
  date: 'Data',
  start_date: 'Data de início',
  day_of_month: 'Dia do mês',
  frequency: 'Frequência',
  payment_method: 'Forma de pagamento',
  phone: 'Telefone',
};

/** Texto genérico e seguro para qualquer validação que não saibamos traduzir. */
export const GENERIC_VALIDATION_PT = 'Verifique os dados informados e tente novamente.';

/**
 * Traduz as mensagens que o Pydantic gera (sempre em inglês) para PT-BR.
 *
 * O backend responde 422 com o `detail` cru do FastAPI — foi assim que um
 * "String should have at least 4 characters" chegou à tela de onboarding em
 * produção. A API é neutra de idioma (e vai ficar mais, com a
 * internacionalização); quem fala com o usuário é esta camada.
 */
function translatePydanticMessage(raw: string): string | null {
  const msg = raw.trim();
  if (!msg) return null;

  // Validador customizado do domínio: o texto depois do prefixo já vem
  // escrito para humano (e normalmente em português).
  const valueError = /^Value error,\s*(.+)$/i.exec(msg);
  if (valueError) return valueError[1].trim();

  if (/^Field required$/i.test(msg)) return 'campo obrigatório';

  let m = /^String should have at least (\d+) characters?$/i.exec(msg);
  if (m) return `informe pelo menos ${m[1]} caracteres`;

  m = /^String should have at most (\d+) characters?$/i.exec(msg);
  if (m) return `informe no máximo ${m[1]} caracteres`;

  m = /^Input should be greater than or equal to (-?[\d.]+)$/i.exec(msg);
  if (m) return `informe um valor maior ou igual a ${m[1]}`;

  m = /^Input should be greater than (-?[\d.]+)$/i.exec(msg);
  if (m) return `informe um valor maior que ${m[1]}`;

  m = /^Input should be less than or equal to (-?[\d.]+)$/i.exec(msg);
  if (m) return `informe um valor menor ou igual a ${m[1]}`;

  m = /^Input should be less than (-?[\d.]+)$/i.exec(msg);
  if (m) return `informe um valor menor que ${m[1]}`;

  if (/^Input should be a valid integer/i.test(msg)) return 'informe um número inteiro';
  if (/^Input should be a valid number/i.test(msg)) return 'informe um número válido';
  if (/^Input should be a valid date/i.test(msg)) return 'informe uma data válida';
  if (/^Input should be a valid (datetime|time)/i.test(msg)) return 'informe uma data e hora válidas';
  if (/^Input should be a valid boolean/i.test(msg)) return 'informe sim ou não';
  if (/^Input should be a valid UUID/i.test(msg)) return 'identificador inválido';
  if (/^Input should be a valid (string|list|array|dictionary)/i.test(msg)) return 'formato inválido';
  if (/^String should match pattern/i.test(msg)) return 'formato inválido';
  if (/^Input should be /i.test(msg)) return 'valor não permitido';
  if (/^value is not a valid email address/i.test(msg)) return 'informe um e-mail válido';

  return null;
}

/** Último segmento textual do `loc` do Pydantic (`["body","last4"] → "last4"`). */
function fieldLabelFromLoc(loc: unknown): string | null {
  if (!Array.isArray(loc)) return null;
  const segments = loc.filter((part): part is string => typeof part === 'string');
  const field = segments.at(-1);
  if (!field || field === 'body' || field === 'query' || field === 'path') return null;
  return FIELD_LABELS_PT[field] ?? null;
}

/**
 * Uma entrada do array `detail` do FastAPI → frase em português.
 * Nunca devolve o texto original em inglês: o que não sabemos traduzir vira
 * a mensagem genérica.
 */
export function humanizePydanticDetailEntry(entry: unknown): string {
  // Entrada em texto puro não é validação do Pydantic (que sempre manda
  // objeto com `msg`/`loc`): trata como `detail` string comum.
  if (typeof entry === 'string') {
    return humanizeDetailString(entry, 422) || GENERIC_VALIDATION_PT;
  }
  if (typeof entry !== 'object' || entry === null) {
    return GENERIC_VALIDATION_PT;
  }
  const raw = 'msg' in entry ? entry.msg : 'message' in entry ? entry.message : '';
  const translated = translatePydanticMessage(String(raw ?? ''));
  if (!translated || looksLikeInternalLeak(translated)) {
    return GENERIC_VALIDATION_PT;
  }
  const label = fieldLabelFromLoc((entry as { loc?: unknown }).loc);
  const sentence = label ? `${label}: ${translated}` : translated;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/**
 * Código sanitizado estável, ou `undefined` quando a resposta é legado / string / sem body.
 */
export const errorCode = (error: unknown): SafeErrorCode | undefined => {
  if (!axios.isAxiosError(error)) return undefined;
  const detail = (error.response?.data as ApiErrorBody | undefined)?.detail;
  return isSafeError(detail) ? detail.code : undefined;
};
