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

// Interceptor para adicionar token automaticamente
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar erros de autenticação
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.dispatchEvent(new CustomEvent('fincla:auth-expired'));
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
