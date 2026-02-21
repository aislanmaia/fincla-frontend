// api/client.ts
import axios, { AxiosError } from 'axios';
import { API_CONFIG } from '../config/api';

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
      // Token expirado ou inválido
      localStorage.removeItem('auth_token');
      // Redirecionar para login apenas se não estiver já na página de login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Mapeamento de mensagens da API para português (idioma da aplicação)
const API_MESSAGE_TRANSLATIONS: Record<string, string> = {
  'Phone already linked': 'Este número já está vinculado para esta ou outra conta.',
  'phone already linked': 'Este número já está vinculado para esta ou outra conta.',
  'PHONE_ALREADY_LINKED': 'Este número já está vinculado para esta ou outra conta.',
};

function translateApiMessage(message: string, errorCode?: string): string {
  const trimmed = message.trim();
  return (
    API_MESSAGE_TRANSLATIONS[trimmed] ??
    (errorCode ? API_MESSAGE_TRANSLATIONS[errorCode] : null) ??
    trimmed
  );
}

// Função auxiliar para tratar erros da API
export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    // Tratar erros de CORS especificamente
    if (!error.response && error.code === 'ERR_NETWORK') {
      // Verificar se é um erro de CORS
      if (error.message?.includes('CORS') || error.message?.includes('Network Error')) {
        return 'Erro de CORS: O servidor não está permitindo requisições deste domínio. Verifique a configuração do backend.';
      }
      return 'Erro de conexão: Não foi possível conectar ao servidor. Verifique sua conexão e se o servidor está rodando.';
    }
    
    const responseData = error.response?.data;
    
    // Se for um objeto ApiError com detail (string, array ou objeto aninhado)
    if (responseData && typeof responseData === 'object' && 'detail' in responseData) {
      const detail = (responseData as { detail: unknown }).detail;
      if (typeof detail === 'string') {
        return detail;
      }
      if (Array.isArray(detail)) {
        const msgs = detail
          .map((d) => (typeof d === 'object' && d && 'msg' in d ? (d as { msg?: string }).msg : typeof d === 'object' && d && 'message' in d ? (d as { message?: string }).message : String(d)))
          .filter(Boolean);
        return msgs.length > 0 ? msgs.join('. ') : 'Erro de validação. Verifique os dados.';
      }
      // detail como objeto: { error, message, type } (ex: PHONE_ALREADY_LINKED)
      if (detail && typeof detail === 'object' && 'message' in detail) {
        const msg = (detail as { message?: string }).message;
        if (typeof msg === 'string' && msg.trim()) {
          return translateApiMessage(msg, (detail as { error?: string }).error);
        }
      }
    }
    
    // Se for um array de erros de validação do Pydantic
    if (Array.isArray(responseData)) {
      const errors = responseData
        .map((err: any) => {
          if (typeof err === 'object' && err.msg) {
            return err.msg;
          }
          return String(err);
        })
        .filter(Boolean);
      return errors.length > 0 ? errors.join(', ') : 'Erro de validação';
    }
    
    // Se for um objeto de erro de validação do Pydantic
    if (responseData && typeof responseData === 'object') {
      // Tentar extrair mensagens de erro
      const errorObj = responseData as any;
      if (errorObj.msg && typeof errorObj.msg === 'string') {
        return errorObj.msg;
      }
      if (errorObj.message && typeof errorObj.message === 'string') {
        return errorObj.message;
      }
    }
    
    // Tratar erros HTTP específicos com mensagens amigáveis (sempre em português)
    const status = error.response?.status;
    const statusMessages: Record<number, string> = {
      400: 'Dados inválidos. Verifique as informações e tente novamente.',
      403: 'Acesso negado. Verifique suas permissões.',
      404: 'Recurso não encontrado.',
      409: 'Este número já está vinculado para esta ou outra conta.',
      422: 'Dados inválidos. Verifique as informações e tente novamente.',
      500: 'Erro interno do servidor. Tente novamente mais tarde.',
      502: 'Serviço temporariamente indisponível. Tente novamente em instantes.',
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
    return error.message;
  }
  
  // Se for um objeto genérico, converter para string
  if (typeof error === 'object' && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return 'Erro desconhecido';
    }
  }
  
  return String(error || 'Erro desconhecido');
};

export default apiClient;

