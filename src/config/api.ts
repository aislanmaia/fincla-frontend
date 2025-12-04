// Configuração das APIs externas
export const API_CONFIG = {
  // URL base da API backend
  BASE_URL: `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/v1`,
  
  // Endpoints da API
  ENDPOINTS: {
    // Autenticação
    AUTH: {
      LOGIN: '/auth/login',
      REGISTER: '/auth/register',
      LOGOUT: '/auth/logout',
      REFRESH: '/auth/refresh',
    },
    
    // Usuários
    USERS: {
      PROFILE: '/users/profile',
      UPDATE: '/users/update',
    },
    
    // Transações
    TRANSACTIONS: {
      LIST: '/transactions',
      CREATE: '/transactions',
      UPDATE: '/transactions/:id',
      DELETE: '/transactions/:id',
      SUMMARY: '/transactions/summary',
    },
    
    // Categorias
    CATEGORIES: {
      LIST: '/categories',
      CREATE: '/categories',
      UPDATE: '/categories/:id',
      DELETE: '/categories/:id',
    },
    
    // Metas financeiras
    GOALS: {
      LIST: '/goals',
      CREATE: '/goals',
      UPDATE: '/goals/:id',
      DELETE: '/goals/:id',
    },
    
    // Relatórios
    REPORTS: {
      MONTHLY: '/reports/monthly',
      CATEGORIES: '/reports/categories',
      TRENDS: '/reports/trends',
      MONEY_FLOW: '/reports/money-flow',
      WEEKLY_HEATMAP: '/reports/weekly-heatmap',
      DAILY_TRANSACTIONS: '/reports/daily-transactions',
    },
    
    // Chat IA
    AI: {
      CHAT: '/ai/chat',
      PROCESS_TRANSACTION: '/ai/process-transaction',
    },
  },
  
  // Configurações de requisição
  REQUEST_CONFIG: {
    TIMEOUT: 10000, // 10 segundos
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000, // 1 segundo
  },
};

// Função para construir URLs completas
export const buildApiUrl = (endpoint: string, params?: Record<string, string>): string => {
  let url = `${API_CONFIG.BASE_URL}${endpoint}`;
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, value);
    });
  }
  
  return url;
};

// Headers padrão para requisições
export const getDefaultHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Adicionar token de autenticação se disponível
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}; 