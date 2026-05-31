// api/client.ts
import axios, { AxiosError } from 'axios';
import {
  ApiErrorBody,
  humanizeDetailString,
  isLegacyError,
  isSafeError,
  sanitizeUnknownErrorMessage,
} from './apiError';
import { API_CONFIG } from './config';

const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.REQUEST_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Timeout padrão (10s) cobre GETs simples. Writes (POST/PATCH/PUT/DELETE)
// frequentemente fazem materialização em cascata no backend (séries
// recorrentes geram N transações; estornos abatem parcelas, etc.) — sob
// carga ou via tunnel residencial isso passa de 10s rotineiramente, sem
// que seja um problema real. 30s é mais alinhado com a realidade de
// escrita do produto e evita "request abortado" no meio do POST.
const WRITE_TIMEOUT_MS = 30_000;
const WRITE_METHODS = new Set(['post', 'put', 'patch', 'delete']);

// Interceptor para adicionar token automaticamente + ajustar timeout em writes.
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const method = (config.method || 'get').toLowerCase();
  if (config.timeout === API_CONFIG.REQUEST_CONFIG.TIMEOUT && WRITE_METHODS.has(method)) {
    config.timeout = WRITE_TIMEOUT_MS;
  }
  return config;
});

// Retry leve em erros de rede transientes (conexão derrubada antes do
// servidor responder). Cobre dropouts do tunnel residencial / proxy sob
// carga sem mascarar erros de produto. GETs são sempre seguros para
// retry; writes (POST/PATCH/PUT/DELETE) só retentam se `error.response`
// estiver ausente — o servidor garantidamente não recebeu o request,
// então não há risco de duplicação. Timeout de servidor (ETIMEDOUT após
// envio bem-sucedido) NÃO retenta para writes — pode duplicar.
const RETRYABLE_NETWORK_CODES = new Set([
  'ERR_NETWORK',
  'ECONNRESET',
  'ECONNABORTED',
  'ETIMEDOUT',
]);
const MAX_RETRY_ATTEMPTS = 2;
const RETRY_BASE_DELAY_MS = 350;

type RetryableConfig = AxiosError['config'] & { __retryCount?: number };

function isSafeToRetry(error: AxiosError): boolean {
  // Resposta HTTP recebida → servidor processou (mesmo que 5xx). Não retenta.
  if (error.response) return false;
  if (!error.code || !RETRYABLE_NETWORK_CODES.has(error.code)) return false;
  const cfg = error.config as RetryableConfig | undefined;
  if (!cfg) return false;
  const method = (cfg.method || 'get').toLowerCase();
  if (method === 'get') return true;
  // Para writes: só ERR_NETWORK / ECONNRESET (conexão derrubada antes
  // de qualquer byte ser enviado) é seguro. ECONNABORTED / ETIMEDOUT
  // significa que o cliente desistiu, mas o servidor pode ter processado.
  return error.code === 'ERR_NETWORK' || error.code === 'ECONNRESET';
}

// Interceptor para tratar erros de autenticação + retry transiente.
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.dispatchEvent(new CustomEvent('fincla:auth-expired'));
      return Promise.reject(error);
    }

    if (isSafeToRetry(error)) {
      const cfg = error.config as RetryableConfig;
      cfg.__retryCount = (cfg.__retryCount ?? 0) + 1;
      if (cfg.__retryCount <= MAX_RETRY_ATTEMPTS) {
        const delay = RETRY_BASE_DELAY_MS * 2 ** (cfg.__retryCount - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return apiClient.request(cfg);
      }
    }

    return Promise.reject(error);
  }
);

// Mapeamento de mensagens da API para português (idioma da aplicação)
const API_MESSAGE_TRANSLATIONS: Record<string, string> = {
  'Phone already linked': 'Este número já está vinculado para esta ou outra conta.',
  'phone already linked': 'Este número já está vinculado para esta ou outra conta.',
  PHONE_ALREADY_LINKED: 'Este número já está vinculado para esta ou outra conta.',
};

function translateApiMessage(message: string, errorCode?: string): string {
  const trimmed = message.trim();
  return (
    API_MESSAGE_TRANSLATIONS[trimmed] ??
    (errorCode ? API_MESSAGE_TRANSLATIONS[errorCode] : null) ??
    trimmed
  );
}

function messagesFromPydanticDetailArray(
  detail: unknown[],
  httpStatus: number | undefined,
): string {
  const msgs = detail
    .map((d) => {
      if (typeof d === 'object' && d !== null && 'msg' in d) {
        const raw = String((d as { msg?: unknown }).msg ?? '');
        return humanizeDetailString(raw, httpStatus);
      }
      if (typeof d === 'object' && d !== null && 'message' in d) {
        const raw = String((d as { message?: unknown }).message ?? '');
        return humanizeDetailString(raw, httpStatus);
      }
      return humanizeDetailString(String(d), httpStatus);
    })
    .filter((s): s is string => Boolean(s && s.length > 0));
  return msgs.length > 0
    ? msgs.join('. ')
    : 'Verifique os dados informados e tente novamente.';
}

/**
 * Extrai texto seguro para exibição, cobrindo envelope sanitizado,
 * legado e string — nunca retorna objetos serializados ou stack interno.
 */
export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    // Sem resposta HTTP (rede, timeout, CORS bloqueado no browser)
    if (!error.response && error.code === 'ERR_NETWORK') {
      return 'Não foi possível conectar ao servidor. Verifique sua conexão.';
    }

    const status = error.response?.status;
    const responseData = error.response?.data;

    if (responseData && typeof responseData === 'object' && 'detail' in responseData) {
      const detail = (responseData as ApiErrorBody).detail;

      if (isSafeError(detail)) {
        return translateApiMessage(detail.message);
      }
      if (isLegacyError(detail)) {
        return translateApiMessage(detail.message, detail.error);
      }
      if (typeof detail === 'string') {
        const human = humanizeDetailString(detail, status);
        if (human) {
          return translateApiMessage(human);
        }
      }
      if (Array.isArray(detail)) {
        return messagesFromPydanticDetailArray(detail, status);
      }
      if (
        detail &&
        typeof detail === 'object' &&
        'message' in detail &&
        typeof (detail as { message?: unknown }).message === 'string'
      ) {
        const raw = (detail as { message: string }).message;
        const human = humanizeDetailString(raw, status);
        if (human) {
          const code =
            'error' in detail && typeof (detail as { error?: unknown }).error === 'string'
              ? (detail as { error: string }).error
              : undefined;
          return translateApiMessage(human, code);
        }
      }
    }

    if (Array.isArray(responseData)) {
      return messagesFromPydanticDetailArray(responseData, status);
    }

    if (responseData && typeof responseData === 'object') {
      const errorObj = responseData as { msg?: unknown; message?: unknown };
      if (typeof errorObj.msg === 'string') {
        const human = humanizeDetailString(errorObj.msg, status);
        if (human) return human;
      }
      if (typeof errorObj.message === 'string') {
        const human = humanizeDetailString(errorObj.message, status);
        if (human) return human;
      }
    }

    const statusMessages: Record<number, string> = {
      400: 'Dados inválidos. Verifique as informações e tente novamente.',
      401: 'Sua sessão expirou ou o acesso não foi autorizado. Faça login novamente.',
      403: 'Acesso negado. Verifique suas permissões.',
      404: 'Recurso não encontrado.',
      409: 'Esta ação entra em conflito com o estado atual. Verifique e tente novamente.',
      410: 'Este link expirou ou não é mais válido.',
      422: 'Não foi possível concluir a operação. Verifique os dados e tente novamente.',
      429: 'Muitas tentativas. Aguarde um momento e tente novamente.',
      500: 'Erro interno do servidor. Tente novamente mais tarde.',
      502: 'Serviço temporariamente indisponível. Tente novamente em instantes.',
      503: 'Serviço temporariamente indisponível. Tente novamente em instantes.',
      504: 'Tempo esgotado ao contatar o servidor. Tente novamente.',
    };
    if (status && statusMessages[status]) {
      return statusMessages[status];
    }
    if (status && status >= 400) {
      return 'Algo deu errado. Tente novamente mais tarde.';
    }
    return 'Erro desconhecido. Tente novamente.';
  }

  if (error instanceof Error) {
    const safe = sanitizeUnknownErrorMessage(error.message);
    if (safe) {
      return safe;
    }
    return 'Algo deu errado. Tente novamente mais tarde.';
  }

  // Nunca expor objetos genéricos via JSON (vazamento de estrutura / detalhes)
  return 'Algo deu errado. Tente novamente mais tarde.';
};

/**
 * Returns the structured ``code`` field from a backend error response when
 * the API replies with ``detail = { code, message }``. Returns ``null``
 * otherwise (legacy string detail, network failure, validation array).
 *
 * Use this to branch UI behaviour on a known error condition (e.g., open
 * the CPF dialog on ``cpf_required``) without coupling to message text.
 */
export const getApiErrorCode = (error: unknown): string | null => {
  if (!axios.isAxiosError(error)) return null;
  const detail = (error.response?.data as ApiErrorBody | undefined)?.detail;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const code = (detail as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return code;
    }
  }
  return null;
};

export { errorCode, isLegacyError, isSafeError } from './apiError';
export type {
  ApiErrorBody,
  ApiErrorDetail,
  LegacyErrorDetail,
  SafeErrorCode,
  SafeErrorDetail,
} from './apiError';

export default apiClient;
