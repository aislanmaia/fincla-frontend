// api/client.ts
import axios, { AxiosError } from 'axios';
import { ApiError } from '../types/api';
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

// Função auxiliar para tratar erros da API
export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    
    // Se for um objeto ApiError com detail
    if (responseData && typeof responseData === 'object' && 'detail' in responseData) {
      const apiError = responseData as ApiError;
      if (typeof apiError.detail === 'string') {
        return apiError.detail;
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
    
    return error.message || 'Erro desconhecido';
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

