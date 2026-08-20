// api/client.ts
import axios, { AxiosError } from 'axios';
import {
  ApiErrorBody,
  GENERIC_VALIDATION_PT,
  humanizeDetailString,
  humanizePydanticDetailEntry,
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
// carga sem mascarar erros de produto. Só GET/HEAD são repetidos — são
// seguros por DEFINIÇÃO (não alteram estado; repetir nunca duplica nada),
// então qualquer um dos códigos abaixo é repetível para eles.
//
// Writes (POST/PUT/PATCH/DELETE) NUNCA são repetidos aqui, nem em
// ERR_NETWORK/ECONNRESET. A ideia antiga era "esses códigos provam que a
// conexão caiu antes de qualquer byte trafegar, logo é seguro" — isso é
// FALSO em geral. `ECONNRESET` é um RST de TCP, que tipicamente chega
// DEPOIS de bytes trocados (ex.: o servidor terminou de escrever o `201`
// e a conexão caiu antes do cliente terminar de ler a resposta).
// `ERR_NETWORK` no adapter XHR do axios vem do mesmo `onerror` tanto para
// "recusou antes de enviar" quanto para "caiu depois do 201, antes dos
// headers chegarem" — não dá pra distinguir do lado do cliente. Sem uma
// forma de provar que o servidor não processou, repetir um write arrisca
// duplicar (ver issue #102, que documentou essa lacuna).
//
// `Idempotency-Key` (issue #103) já existe no produto, mas NÃO relaxa esta
// regra: quem manda a chave é o cliente de cada operação, e hoje só
// `createTransactionForUi` (`src/ui/data/transactionsAdapter.js`) manda. Um
// retry genérico aqui repetiria também os writes SEM chave — justamente os
// que ainda podem duplicar. Este interceptor segue recusando todo write; o
// retry seguro mora junto de quem gera a chave.
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
  // Só GET/HEAD: idempotentes por definição, nunca escrevem. Qualquer write
  // (POST/PUT/PATCH/DELETE) fica de fora, sempre — ver comentário acima.
  return method === 'get' || method === 'head';
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

/**
 * `detail` em array é a forma de validação do FastAPI, e o texto vem sempre
 * em inglês. Traduzimos aqui (ver `humanizePydanticDetailEntry`) em vez de
 * repassar cru — foi um "String should have at least 4 characters" que
 * apareceu para um usuário real no onboarding.
 */
function messagesFromPydanticDetailArray(
  detail: unknown[],
  _httpStatus: number | undefined,
): string {
  const seen = new Set<string>();
  const msgs: string[] = [];
  for (const entry of detail) {
    const msg = humanizePydanticDetailEntry(entry);
    if (msg && !seen.has(msg)) {
      seen.add(msg);
      msgs.push(msg);
    }
  }
  return msgs.length > 0 ? msgs.join(' ') : GENERIC_VALIDATION_PT;
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
        // `humanizeDetailString` cobre padrões em inglês por REGEX (ex.: o
        // "Card with brand '…' … already exists" do cadastro de cartão
        // duplicado, "At least one tag … is required") — sem isso, esse
        // formato {error,message,type} só batia no dicionário de tradução
        // exata (`translateApiMessage`), que não cobre mensagem com valores
        // interpolados, e a frase em inglês vazava pra tela.
        //
        // Quando `humanizeDetailString` REPROVA (retorna vazio — mensagem
        // vazia ou parece vazamento interno, ex.: stack trace de driver
        // dentro de um ConsultantServiceError num 500), NÃO cai pra
        // `detail.message` cru: isso jogaria fora o próprio veredito do
        // sanitizador. Sem `return` aqui, a execução cai pro fallback
        // genérico por status mais abaixo — mesmo padrão que o branch
        // irmão (mensagem solta em `detail.message` sem `type`/`error`),
        // logo depois, já usa.
        const human = humanizeDetailString(detail.message, status);
        if (human) {
          return translateApiMessage(human, detail.error);
        }
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
