# Guia da API para Frontend React

Este documento fornece uma referência completa da API REST para desenvolvedores React/TypeScript.

## 📋 Índice

1. [Configuração Base](#configuração-base)
2. [Autenticação](#autenticação)
3. [Tipos TypeScript](#tipos-typescript)
4. [Endpoints de Autenticação](#endpoints-de-autenticação)
5. [Endpoints de Usuários](#endpoints-de-usuários)
6. [Endpoints de Organizações](#endpoints-de-organizações)
7. [Endpoints de Memberships](#endpoints-de-memberships)
8. [Endpoints de Tag Types](#endpoints-de-tag-types)
9. [Endpoints de Tags](#endpoints-de-tags)
10. [Endpoints de Transações](#endpoints-de-transações)
    11. [Endpoints de Cartões de Crédito](#endpoints-de-cartões-de-crédito)
    12. [Endpoints de Metas (Goals)](#endpoints-de-metas-goals)
    13. [Endpoints de Simulação Financeira](#endpoints-de-simulação-financeira)
    14. [Endpoints de Chat/AI](#endpoints-de-chatai)
    15. [Endpoints de WhatsApp Connections](#endpoints-de-whatsapp-connections)
    16. [Tratamento de Erros](#tratamento-de-erros)
    17. [Exemplos de Uso](#exemplos-de-uso)

---

## 🔧 Configuração Base

### Base URL

```typescript
const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  'https://api.fincla.com/v1';
```

> **⚠️ Importante:** Todos os endpoints da API utilizam o prefixo `/v1` para versionamento.
> 
> - **Produção:** `https://api.fincla.com/v1`
> - **Desenvolvimento local:** `http://localhost:8000/v1`
> 
> Se você definir a variável de ambiente `REACT_APP_API_URL`, certifique-se de incluir o `/v1` ao final:
> ```bash
> # .env.local (para desenvolvimento)
> REACT_APP_API_URL=http://localhost:8000/v1
> ```

### Headers Padrão

Todos os endpoints (exceto login e registro público) requerem o header de autenticação:

```typescript
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`,
};
```

### Cliente HTTP Recomendado

```typescript
// api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
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
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado ou inválido
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

### 📌 Versionamento da API

Todos os endpoints da API utilizam o prefixo `/v1` para versionamento. Isso permite:

- **Estabilidade:** Futuras mudanças na API (v2, v3) não quebrarão clientes existentes
- **Clareza:** Sempre sabemos qual versão da API estamos consumindo
- **Migração gradual:** Novas versões podem coexistir com versões antigas

**Exemplos de URLs completas:**
```
https://api.fincla.com/v1/auth/login
https://api.fincla.com/v1/users/me
https://api.fincla.com/v1/transactions
https://api.fincla.com/v1/organizations
```

**Exceções:** Endpoints de monitoramento não são versionados:
```
https://api.fincla.com/health
https://api.fincla.com/ping
```

---

## 🔐 Autenticação

### Armazenamento do Token

Após o login bem-sucedido, armazene o token:

```typescript
// Após login
localStorage.setItem('auth_token', response.data.token);
```

### Verificação de Autenticação

```typescript
const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('auth_token');
};
```

---

## 📝 Tipos TypeScript

Crie um arquivo `types/api.ts` com todos os tipos:

```typescript
// types/api.ts

// ===== AUTENTICAÇÃO =====
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user_id: string;
  email: string;
  role: 'owner' | 'member';
  subscription: {
    plan: 'free' | 'beta' | 'premium';
    max_organizations: number;
    max_users_per_org: number;
    status: 'active' | 'inactive';
  };
}

export interface User {
  id: string;
  email: string;
  role: 'owner' | 'member';
  created_at: string;
  subscription?: {
    plan: 'free' | 'beta' | 'premium';
    status: 'active' | 'inactive';
    max_organizations: number;
    max_users_per_org: number;
    features: string[];
  };
}

// ===== ORGANIZAÇÕES =====
export interface CreateOrganizationRequest {
  name: string;
  description?: string | null;
}

export interface Organization {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface CreateOrganizationResponse {
  organization: Organization;
  membership: {
    id: string;
    user_id: string;
    organization_id: string;
    role: 'owner' | 'member';
    created_at: string;
  };
}

export interface OrganizationWithMembership {
  organization: Organization;
  membership: {
    id: string;
    role: 'owner' | 'member';
    created_at: string;
  };
}

export interface MyOrganizationsResponse {
  total: number;
  organizations: OrganizationWithMembership[];
}

// ===== MEMBERSHIPS =====
export interface Membership {
  membership_id: string;
  user_id: string;
  role: 'owner' | 'member';
  created_at: string;
}

export interface OrganizationMembersResponse {
  organization: {
    id: string;
    name: string;
  };
  total_members: number;
  members: Membership[];
}

// ===== WHATSAPP CONNECTIONS =====
export interface WhatsAppConnection {
  id: string;
  user_id: string;
  organization_id: string;
  phone_number: string;
  is_active: boolean;
  connected_at: string;
}

export interface CreateWhatsAppConnectionRequest {
  organization_id: string;
  phone_number: string;
}

export interface ListWhatsAppConnectionsResponse {
  total: number;
  connections: WhatsAppConnection[];
}

// ===== USUÁRIOS =====
export interface RegisterOwnerRequest {
  email: string;
  password: string;
  plan?: 'free' | 'beta' | 'premium';
}

export interface RegisterOwnerResponse {
  id: string;
  email: string;
  role: 'owner';
  created_at: string;
  subscription: {
    plan: 'free' | 'beta' | 'premium';
    status: 'active';
    max_organizations: number;
    max_users_per_org: number;
  };
}

export interface RegisterMemberRequest {
  email: string;
  password: string;
  organization_id: string;
}

export interface RegisterMemberResponse {
  user: {
    id: string;
    email: string;
    role: 'member';
    created_at: string;
  };
  membership: {
    id: string;
    organization_id: string;
    role: 'member';
    created_at: string;
  };
}

// ===== TAG TYPES =====
export interface TagType {
  id: string;
  name: string;
  description: string | null;
  is_required: boolean;
  max_per_transaction: number | null;
}

export interface TagTypesResponse {
  tag_types: TagType[];
}

// ===== TAGS =====
export interface TagTypeInfo {
  id: string;
  name: string;
  description: string | null;
  is_required: boolean;
  max_per_transaction: number | null;
}

export interface Tag {
  id: string;
  name: string;
  tag_type: TagTypeInfo;
  color: string | null;
  is_default: boolean;
  is_active: boolean;
  organization_id: string;
}

export interface CreateTagRequest {
  name: string;
  tag_type_id: string;
  color?: string | null;
}

export interface UpdateTagRequest {
  name: string;
  tag_type_id: string;
  color?: string | null;
}

export interface TagsResponse {
  tags: Tag[];
}

// ===== TRANSAÇÕES =====
export interface CreateTransactionRequest {
  organization_id: string;
  type: 'income' | 'expense';
  description: string;
  tag_ids: string[]; // Lista de UUIDs das tags (pelo menos uma tag do tipo 'categoria' é obrigatória)
  value: number; // Decimal como number
  payment_method: string;
  date: string; // ISO datetime string (YYYY-MM-DDTHH:MM or YYYY-MM-DDTHH:MM:SS) - REQUIRED, supports minute granularity
  // Campos opcionais para cartão de crédito
  card_last4?: string | null;
  modality?: 'cash' | 'installment' | null;
  installments_count?: number | null;
  // Campo legado - mantido para compatibilidade durante migração
  category?: string | null;
}

export interface Transaction {
  id: number;
  organization_id: string;
  type: 'income' | 'expense';
  description: string;
  tags: Record<string, Tag[]>; // Tags agrupadas por nome do tipo (ex: { "categoria": [Tag], "projeto": [Tag] })
  value: number;
  payment_method: string;
  date: string; // ISO datetime string (YYYY-MM-DDTHH:MM:SS) - supports minute granularity
  recurring: boolean; // Whether this is a recurring transaction
  created_at: string; // ISO datetime string - timestamp when transaction was created
  updated_at: string; // ISO datetime string - timestamp when transaction was last updated
  credit_card_charge?: CreditCardChargeInfo | null; // Only present if payment_method is "credit_card"
  // Campo legado - mantido para compatibilidade durante migração
  category?: string | null;
}

export interface ListTransactionsQuery {
  organization_id: string; // Required
  type?: 'income' | 'expense';
  category?: string;
  payment_method?: string;
  description?: string;
  date_start?: string; // ISO date string (YYYY-MM-DD)
  date_end?: string; // ISO date string (YYYY-MM-DD)
  value_min?: number;
  value_max?: number;
  page?: number; // Page number (1-indexed, default: 1)
  limit?: number; // Items per page (default: 20, max: 100)
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaginatedTransactionsResponse {
  data: Transaction[];
  pagination: PaginationMetadata;
}

export interface TransactionsSummaryQuery {
  organization_id: string; // Required
  type?: 'income' | 'expense';
  category?: string;
  payment_method?: string;
  description?: string;
  date_start?: string; // ISO date string (YYYY-MM-DD)
  date_end?: string; // ISO date string (YYYY-MM-DD)
  value_min?: number;
  value_max?: number;
}

export interface PeriodInfo {
  start_date: string | null; // ISO date string (YYYY-MM-DD)
  end_date: string | null; // ISO date string (YYYY-MM-DD)
}

export interface FiltersInfo {
  organization_id: string;
  type: string | null;
  category: string | null;
  payment_method: string | null;
  date_start: string | null; // ISO date string (YYYY-MM-DD)
  date_end: string | null; // ISO date string (YYYY-MM-DD)
}

export interface TransactionsSummaryResponse {
  total_transactions: number;
  total_value: number;
  total_income: number;
  total_expenses: number;
  balance: number;
  average_transaction: number;
  period: PeriodInfo;
  filters_applied: FiltersInfo;
}

// ===== CARTÕES DE CRÉDITO =====
export interface CreateCreditCardRequest {
  organization_id: string;
  last4: string; // 4 dígitos
  brand: string; // Ex: "Visa", "Mastercard"
  due_day: number; // 1-31
  description?: string | null;
}

export interface CreditCard {
  id: number;
  organization_id: string;
  last4: string;
  brand: string;
  due_day: number;
  description: string | null;
}

export interface InvoiceItemResponse {
  id: number;
  charge_id: number;
  transaction_date: string;
  description: string;
  amount: number;
  installment_number: number;
  total_installments: number;
  tags: Record<string, Tag[]>;
}

export interface InvoiceResponse {
  month: string;
  due_date: string;
  total_amount: number;
  status: string;
  items: InvoiceItemResponse[];
}

// ===== METAS =====
export interface CreateGoalRequest {
  organization_id: string;
  name: string;
  target_amount: number;
  deadline: string; // ISO date string (YYYY-MM-DD)
  description?: string | null;
}

export interface UpdateGoalRequest {
  name?: string;
  target_amount?: number;
  current_amount?: number;
  deadline?: string;
  status?: 'active' | 'completed' | 'cancelled';
  description?: string | null;
}

export interface Goal {
  id: string;
  organization_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
  status: 'active' | 'completed' | 'cancelled';
  description: string | null;
  created_at: string;
  updated_at: string | null;
  progress: number; // Porcentagem 0-100
}

// ===== CHAT/AI =====
export interface ChatRequest {
  message: string;
  session_id?: string | null;
}

export interface TransactionDetails {
  type: string;
  description: string;
  value: number;
  category: string;
  payment_method: string;
  date: string;
  transaction_id?: number | null;
}

export interface TransactionCreatedResult {
  action: 'transaction_created';
  message: string;
  details: TransactionDetails;
  transaction_id: number;
}

export interface GeneralChatResult {
  action: 'general_response';
  message: string;
  content: string;
}

export type ChatResult = TransactionCreatedResult | GeneralChatResult;

export interface ChatResponse {
  result: ChatResult;
  confidence: number; // 0.0 - 1.0
  processing_time: number; // segundos
}

// ===== SIMULAÇÃO FINANCEIRA =====
export interface NewCardCommitment {
  card_last4: string;
  value: number;
  installments_count: number;
  description: string;
}

export interface SavingsGoal {
  target_amount: number;
  current_amount: number;
  target_date: string; // ISO date string (YYYY-MM-DD)
}

export interface SimulateFinancialImpactRequest {
  organization_id: string;
  new_card_commitments?: NewCardCommitment[];
  savings_goals?: SavingsGoal[];
  simulation_months?: number; // 1-60 (até 5 anos), default: 6
}

export interface MonthlyProjection {
  month: string; // Format: "YYYY-MM"
  projected_income: number;
  base_expenses: number;
  card_commitments: number;
  savings_goal: number;
  total_expenses: number;
  balance: number;
  status: "success" | "warning" | "danger";
}

export interface SimulateFinancialImpactResponse {
  months: MonthlyProjection[];
  global_verdict: "viable" | "caution" | "high-risk";
  summary: {
    income: number;
    base_expenses: number;
    card_commitments: number;
    savings_goal: number;
  };
}

// ===== ERROS =====
export interface ApiError {
  detail: string;
  status?: number;
}
```

---

## 🔑 Endpoints de Autenticação

### POST `/v1/auth/login`

Autentica um usuário e retorna o token JWT.

**Request:**
```typescript
const login = async (email: string, password: string): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>('/v1/auth/login', {
    email,
    password,
  });
  
  // Armazenar token
  localStorage.setItem('auth_token', response.data.token);
  
  return response.data;
};
```

**Response (200):**
```typescript
{
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  user_id: "123e4567-e89b-12d3-a456-426614174000",
  email: "owner@example.com",
  role: "owner",
  subscription: {
    plan: "beta",
    max_organizations: 5,
    max_users_per_org: 10,
    status: "active"
  }
}
```

**Erros:**
- `401`: Email ou senha inválidos

---

### GET `/v1/auth/me`

Retorna informações do usuário autenticado.

**Request:**
```typescript
const getCurrentUser = async (): Promise<User> => {
  const response = await apiClient.get<User>('/v1/auth/me');
  return response.data;
};
```

**Response (200):**
```typescript
{
  id: "123e4567-e89b-12d3-a456-426614174000",
  email: "owner@example.com",
  role: "owner",
  created_at: "2025-01-09T10:00:00",
  subscription: {
    plan: "beta",
    status: "active",
    max_organizations: 5,
    max_users_per_org: 10,
    features: ["multi_org", "custom_categories", "advanced_reports"]
  }
}
```

**Erros:**
- `401`: Token inválido ou expirado

---

## 👥 Endpoints de Usuários

### POST `/v1/users/register/owner`

Registra um novo usuário owner (público, não requer autenticação).

**Request:**
```typescript
const registerOwner = async (
  email: string,
  password: string,
  plan: 'free' | 'beta' | 'premium' = 'free'
): Promise<RegisterOwnerResponse> => {
  const response = await apiClient.post<RegisterOwnerResponse>(
    '/v1/users/register/owner',
    { email, password, plan }
  );
  return response.data;
};
```

**Response (201):**
```typescript
{
  id: "123e4567-e89b-12d3-a456-426614174000",
  email: "owner@example.com",
  role: "owner",
  created_at: "2025-01-09T10:00:00",
  subscription: {
    plan: "beta",
    status: "active",
    max_organizations: 5,
    max_users_per_org: 10
  }
}
```

**Erros:**
- `400`: Email já existe ou dados inválidos

---

### POST `/v1/users/register/member`

Registra um novo membro em uma organização (apenas owners).

**Request:**
```typescript
const registerMember = async (
  email: string,
  password: string,
  organizationId: string
): Promise<RegisterMemberResponse> => {
  const response = await apiClient.post<RegisterMemberResponse>(
    '/v1/users/register/member',
    {
      email,
      password,
      organization_id: organizationId,
    }
  );
  return response.data;
};
```

**Response (201):**
```typescript
{
  user: {
    id: "123e4567-e89b-12d3-a456-426614174000",
    email: "member@example.com",
    role: "member",
    created_at: "2025-01-09T10:00:00"
  },
  membership: {
    id: "456e7890-e89b-12d3-a456-426614174000",
    organization_id: "789e0123-e89b-12d3-a456-426614174000",
    role: "member",
    created_at: "2025-01-09T10:00:00"
  }
}
```

**Erros:**
- `400`: Email já existe, organização não encontrada, ou limite de usuários excedido
- `403`: Usuário não é owner

---

### GET `/v1/users/me`

Retorna o perfil do usuário autenticado (mesmo que `/v1/auth/me`).

**Request:**
```typescript
const getMyProfile = async (): Promise<User> => {
  const response = await apiClient.get<User>('/v1/users/me');
  return response.data;
};
```

---

### PUT `/v1/users/me/password`

Atualiza a senha do usuário autenticado. Requer a senha atual e uma nova senha que atenda aos critérios de segurança.

**Request:**
```typescript
interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<ChangePasswordResponse> => {
  const response = await apiClient.put<ChangePasswordResponse>(
    '/v1/users/me/password',
    {
      current_password: currentPassword,
      new_password: newPassword,
    }
  );
  return response.data;
};
```

**Response (200):**
```typescript
{
  message: "Senha atualizada com sucesso",
  user_id: "123e4567-e89b-12d3-a456-426614174000"
}
```

**Validações da Nova Senha:**
- Mínimo de 8 caracteres
- Pelo menos uma letra maiúscula (A-Z)
- Pelo menos uma letra minúscula (a-z)
- Pelo menos um número (0-9)
- Pelo menos um caractere especial (!@#$%^&*(),.?":{}|<>)
- Deve ser diferente da senha atual

**Exemplos de Uso:**
```typescript
// Mudança de senha bem-sucedida
await changePassword("MinhaSenhaAtual123!", "NovaSenhaSegura456!");

// Após mudança, fazer login com nova senha
const loginResponse = await login("user@example.com", "NovaSenhaSegura456!");
```

**Erros:**
- `400 Bad Request`: 
  - Senha atual incorreta
  - Nova senha não atende aos critérios de segurança
  - Nova senha é igual à senha atual
- `401 Unauthorized`: Não autenticado ou token inválido
- `422 Unprocessable Entity`: Dados de entrada inválidos (campos faltando)

**Notas Importantes:**
- A senha atual deve ser fornecida e estar correta
- A nova senha deve atender a todos os critérios de segurança
- Após a mudança, o usuário precisará fazer login novamente com a nova senha
- Tokens JWT existentes continuam válidos até expirarem

---

## 🏢 Endpoints de Organizações

### POST `/v1/organizations`

Cria uma nova organização (apenas owners).

**Request:**
```typescript
const createOrganization = async (
  name: string,
  description?: string
): Promise<CreateOrganizationResponse> => {
  const response = await apiClient.post<CreateOrganizationResponse>(
    '/v1/organizations',
    { name, description }
  );
  return response.data;
};
```

**Response (201):**
```typescript
{
  organization: {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Minha Empresa",
    description: "Descrição da empresa",
    created_at: "2025-01-09T10:00:00"
  },
  membership: {
    id: "456e7890-e89b-12d3-a456-426614174000",
    user_id: "789e0123-e89b-12d3-a456-426614174000",
    organization_id: "123e4567-e89b-12d3-a456-426614174000",
    role: "owner",
    created_at: "2025-01-09T10:00:00"
  }
}
```

**Erros:**
- `400`: Dados inválidos ou limite de organizações excedido
- `403`: Usuário não é owner

---

## 👥 Endpoints de Memberships

### GET `/v1/memberships/my-organizations`

Lista todas as organizações onde o usuário tem membership.

**Request:**
```typescript
const getMyOrganizations = async (): Promise<MyOrganizationsResponse> => {
  const response = await apiClient.get<MyOrganizationsResponse>(
    '/v1/memberships/my-organizations'
  );
  return response.data;
};
```

**Response (200):**
```typescript
{
  total: 2,
  organizations: [
    {
      organization: {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Minha Empresa",
        created_at: "2025-01-09T10:00:00"
      },
      membership: {
        id: "456e7890-e89b-12d3-a456-426614174000",
        role: "owner",
        created_at: "2025-01-09T10:00:00"
      }
    }
  ]
}
```

---

### GET `/v1/memberships/organizations/{org_id}/members`

Lista todos os membros de uma organização.

**Request:**
```typescript
const getOrganizationMembers = async (
  organizationId: string
): Promise<OrganizationMembersResponse> => {
  const response = await apiClient.get<OrganizationMembersResponse>(
    `/v1/memberships/organizations/${organizationId}/members`
  );
  return response.data;
};
```

**Response (200):**
```typescript
{
  organization: {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Minha Empresa"
  },
  total_members: 3,
  members: [
    {
      membership_id: "456e7890-e89b-12d3-a456-426614174000",
      user_id: "789e0123-e89b-12d3-a456-426614174000",
      role: "owner",
      created_at: "2025-01-09T10:00:00"
    }
  ]
}
```

**Erros:**
- `403`: Usuário não tem acesso à organização
- `404`: Organização não encontrada

---

### DELETE `/v1/memberships/organizations/{org_id}/members/{user_id}`

Remove um membro de uma organização (apenas owners).

**Request:**
```typescript
const removeMember = async (
  organizationId: string,
  userId: string
): Promise<void> => {
  await apiClient.delete(
    `/v1/memberships/organizations/${organizationId}/members/${userId}`
  );
};
```

**Response (204):** Sem conteúdo

**Erros:**
- `400`: Tentativa de remover a si mesmo
- `403`: Usuário não é owner
- `404`: Membro ou organização não encontrado

---

## 🏷️ Endpoints de Tag Types

### GET `/v1/tag-types`

Lista todos os tipos de tags disponíveis no sistema com seus metadados.

**Request:**
```typescript
const listTagTypes = async (): Promise<TagTypesResponse> => {
  const response = await apiClient.get<TagTypesResponse>('/v1/tag-types');
  return response.data;
};
```

**Response (200):**
```typescript
{
  tag_types: [
    {
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "categoria",
      description: "Categoria da transação",
      is_required: true,
      max_per_transaction: 1
    },
    {
      id: "456e7890-e89b-12d3-a456-426614174000",
      name: "projeto",
      description: "Projeto relacionado",
      is_required: false,
      max_per_transaction: null
    }
  ]
}
```

**Notas:**
- `is_required`: Indica se pelo menos uma tag deste tipo é obrigatória em cada transação
- `max_per_transaction`: Limite máximo de tags deste tipo por transação (null = sem limite)
- Tipos de tags comuns: "categoria", "projeto", "cliente", etc.

**Erros:**
- `500`: Erro interno do servidor

---

## 🏷️ Endpoints de Tags

### GET `/v1/tags`

Lista todas as tags de uma organização, opcionalmente filtradas por tipo de tag.

**Request:**
```typescript
const listTags = async (
  organizationId: string,
  tagType?: string
): Promise<TagsResponse> => {
  const response = await apiClient.get<TagsResponse>('/v1/tags', {
    params: {
      organization_id: organizationId,
      tag_type: tagType, // Opcional: nome do tipo de tag (ex: "categoria")
    },
  });
  return response.data;
};
```

**Exemplos de Uso:**
```typescript
// Listar todas as tags da organização
await listTags("123e4567-e89b-12d3-a456-426614174000");

// Filtrar apenas tags do tipo "categoria"
await listTags("123e4567-e89b-12d3-a456-426614174000", "categoria");
```

**Response (200):**
```typescript
{
  tags: [
    {
      id: "789e0123-e89b-12d3-a456-426614174000",
      name: "Alimentação",
      tag_type: {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "categoria",
        description: "Categoria da transação",
        is_required: true,
        max_per_transaction: 1
      },
      color: "#FF5733",
      is_default: true,
      is_active: true,
      organization_id: "123e4567-e89b-12d3-a456-426614174000"
    }
  ]
}
```

**Erros:**
- `400`: Tipo de tag não encontrado (quando usando filtro tag_type)
- `403`: Usuário não tem acesso à organização
- `500`: Erro interno do servidor

---

### POST `/v1/tags`

Cria uma nova tag personalizada para uma organização.

**Request:**
```typescript
const createTag = async (
  organizationId: string,
  tag: CreateTagRequest
): Promise<Tag> => {
  const response = await apiClient.post<Tag>(
    '/v1/tags',
    tag,
    {
      params: {
        organization_id: organizationId,
      },
    }
  );
  return response.data;
};
```

**Exemplo:**
```typescript
await createTag("123e4567-e89b-12d3-a456-426614174000", {
  name: "Marketing Digital",
  tag_type_id: "123e4567-e89b-12d3-a456-426614174000", // ID do tipo "categoria"
  color: "#9B59B6", // Opcional: cor em hexadecimal
});
```

**Response (201):**
```typescript
{
  id: "789e0123-e89b-12d3-a456-426614174000",
  name: "Marketing Digital",
  tag_type: {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "categoria",
    description: "Categoria da transação",
    is_required: true,
    max_per_transaction: 1
  },
  color: "#9B59B6",
  is_default: false,
  is_active: true,
  organization_id: "123e4567-e89b-12d3-a456-426614174000"
}
```

**Erros:**
- `400`: Dados inválidos, tag duplicada ou regra de negócio violada
- `403`: Usuário não tem acesso à organização

---

### PATCH `/v1/tags/{tag_id}`

Atualiza uma tag existente.

**Request:**
```typescript
const updateTag = async (
  tagId: string,
  tag: UpdateTagRequest
): Promise<Tag> => {
  const response = await apiClient.patch<Tag>(
    `/v1/tags/${tagId}`,
    tag
  );
  return response.data;
};
```

**Exemplo:**
```typescript
await updateTag("789e0123-e89b-12d3-a456-426614174000", {
  name: "Marketing e Publicidade",
  tag_type_id: "123e4567-e89b-12d3-a456-426614174000",
  color: "#8E44AD",
});
```

**Response (200):**
```typescript
{
  id: "789e0123-e89b-12d3-a456-426614174000",
  name: "Marketing e Publicidade",
  tag_type: {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "categoria",
    description: "Categoria da transação",
    is_required: true,
    max_per_transaction: 1
  },
  color: "#8E44AD",
  is_default: false,
  is_active: true,
  organization_id: "123e4567-e89b-12d3-a456-426614174000"
}
```

**Erros:**
- `400`: Dados inválidos ou regra de negócio violada
- `404`: Tag não encontrada

---

### DELETE `/v1/tags/{tag_id}`

Remove uma tag (soft delete - define `is_active=false`).

**Request:**
```typescript
const deleteTag = async (tagId: string): Promise<void> => {
  await apiClient.delete(`/v1/tags/${tagId}`);
};
```

**Response (204):** Sem conteúdo

**Notas:**
- A tag não é removida fisicamente, apenas marcada como inativa (`is_active=false`)
- Tags inativas não aparecem nas listagens, mas podem ser reativadas atualizando a tag

**Erros:**
- `400`: Erro ao deletar tag
- `404`: Tag não encontrada

---

## 💰 Endpoints de Transações

### POST `/v1/transactions`

Cria uma nova transação.

**Request:**
```typescript
const createTransaction = async (
  transaction: CreateTransactionRequest
): Promise<Transaction> => {
  const response = await apiClient.post<Transaction>(
    '/v1/transactions',
    transaction
  );
  return response.data;
};
```

**Exemplo - Transação Simples com Tags:**
```typescript
await createTransaction({
  organization_id: "123e4567-e89b-12d3-a456-426614174000",
  type: "expense",
  description: "Compra no supermercado",
  tag_ids: [
    "789e0123-e89b-12d3-a456-426614174000", // Tag "Alimentação" (tipo: categoria)
    "abc12345-e89b-12d3-a456-426614174000", // Tag "Projeto X" (tipo: projeto)
  ],
  value: 150.50,
  payment_method: "PIX",
  date: "2025-01-15T14:30", // datetime com hora (granularidade de minutos)
  // category: "Alimentação", // Campo legado - opcional durante migração
});
```

**Exemplo - Transação com Cartão à Vista:**
```typescript
await createTransaction({
  organization_id: "123e4567-e89b-12d3-a456-426614174000",
  type: "expense",
  description: "Compra na loja",
  tag_ids: [
    "def45678-e89b-12d3-a456-426614174000", // Tag "Compras" (tipo: categoria)
  ],
  value: 500.00,
  payment_method: "Cartão de Crédito",
  date: "2025-01-15T15:45", // datetime com hora
  card_last4: "1234",
  modality: "cash",
});
```

**Exemplo - Transação Parcelada:**
```typescript
await createTransaction({
  organization_id: "123e4567-e89b-12d3-a456-426614174000",
  type: "expense",
  description: "Compra parcelada",
  tag_ids: [
    "ghi78901-e89b-12d3-a456-426614174000", // Tag "Eletrônicos" (tipo: categoria)
  ],
  value: 2000.00,
  payment_method: "Cartão de Crédito",
  date: "2025-01-15T10:00", // datetime com hora
  card_last4: "1234",
  modality: "installment",
  installments_count: 10,
});
```

**Nota sobre o campo `date`:**
- O campo `date` agora aceita **datetime com granularidade de minutos**
- Formatos aceitos:
  - `YYYY-MM-DDTHH:MM` (ex: `"2025-01-15T14:30"`)
  - `YYYY-MM-DDTHH:MM:SS` (ex: `"2025-01-15T14:30:00"`)
  - `YYYY-MM-DD` (ex: `"2025-01-15"`) - será convertido para `2025-01-15T00:00:00`
- Recomenda-se sempre enviar com hora para maior precisão

**Notas Importantes:**
- `tag_ids` é **obrigatório** e deve conter pelo menos uma tag do tipo "categoria" (ou outro tipo marcado como `is_required: true`)
- Cada tipo de tag tem um limite máximo por transação (`max_per_transaction`)
- O campo `category` é legado e opcional durante a migração, mas será removido no futuro

**Response (201):**
```typescript
{
  id: 1,
  organization_id: "123e4567-e89b-12d3-a456-426614174000",
  type: "expense",
  description: "Compra no supermercado",
  tags: {
    "categoria": [
      {
        id: "789e0123-e89b-12d3-a456-426614174000",
        name: "Alimentação",
        tag_type: {
          id: "123e4567-e89b-12d3-a456-426614174000",
          name: "categoria",
          description: "Categoria da transação",
          is_required: true,
          max_per_transaction: 1
        },
        color: "#FF5733",
        is_default: true,
        is_active: true,
        organization_id: "123e4567-e89b-12d3-a456-426614174000"
      }
    ],
    "projeto": [
      {
        id: "abc12345-e89b-12d3-a456-426614174000",
        name: "Projeto X",
        tag_type: {
          id: "456e7890-e89b-12d3-a456-426614174000",
          name: "projeto",
          description: "Projeto relacionado",
          is_required: false,
          max_per_transaction: null
        },
        color: "#3498DB",
        is_default: false,
        is_active: true,
        organization_id: "123e4567-e89b-12d3-a456-426614174000"
      }
    ]
  },
  value: 150.50,
  payment_method: "PIX",
  date: "2025-01-15T14:30:00", // datetime com hora
  recurring: false,
  category: "Alimentação" // Campo legado - mantido para compatibilidade
}
```

**Erros:**
- `400`: Dados inválidos ou cartão não encontrado
- `403`: Usuário não tem acesso à organização
- `404`: Cartão de crédito não encontrado (quando usando cartão)
- `422`: Erro de validação ou regra de negócio

---

### GET `/v1/transactions`

Lista transações com filtros opcionais e paginação. Retorna transações paginadas da organização especificada.

**⚠️ Breaking Change:** A estrutura de resposta mudou de `Transaction[]` para `{ data: Transaction[], pagination: {...} }`. O frontend precisa atualizar para acessar `response.data` em vez de `response` diretamente.

**Request:**
```typescript
const listTransactions = async (
  filters: ListTransactionsQuery
): Promise<PaginatedTransactionsResponse> => {
  const response = await apiClient.get<PaginatedTransactionsResponse>(
    '/v1/transactions',
    { params: filters }
  );
  return response.data;
};
```

**Parâmetros:**
- `organization_id` (obrigatório): UUID da organização
- `type` (opcional): 'income' | 'expense'
- `category` (opcional): Nome da categoria
- `payment_method` (opcional): Método de pagamento
- `description` (opcional): Busca parcial na descrição
- `date_start` (opcional): Data inicial (YYYY-MM-DD)
- `date_end` (opcional): Data final (YYYY-MM-DD)
- `value_min` (opcional): Valor mínimo
- `value_max` (opcional): Valor máximo
- `page` (opcional): Número da página (padrão: 1, mínimo: 1)
- `limit` (opcional): Itens por página (padrão: 20, mínimo: 1, máximo: 100)

**Exemplos de Uso:**
```typescript
// Listar primeira página de transações
const result = await listTransactions({
  organization_id: "123e4567-e89b-12d3-a456-426614174000",
  page: 1,
  limit: 20
});
console.log(result.data); // Array de transações
console.log(result.pagination.total); // Total de transações

// Filtrar por tipo com paginação
const expenses = await listTransactions({
  organization_id: orgId,
  type: 'expense',
  page: 1,
  limit: 10
});

// Filtrar por período
const january = await listTransactions({
  organization_id: orgId,
  date_start: '2025-01-01',
  date_end: '2025-01-31',
  page: 1,
  limit: 20
});

// Múltiplos filtros com paginação
const filtered = await listTransactions({
  organization_id: orgId,
  type: 'expense',
  category: 'Alimentação',
  date_start: '2025-01-01',
  date_end: '2025-01-31',
  value_min: 50,
  page: 2,
  limit: 10
});

// Navegar para próxima página
if (result.pagination.has_next) {
  const nextPage = await listTransactions({
    organization_id: orgId,
    page: result.pagination.page + 1,
    limit: result.pagination.limit
  });
}
```

**Response (200) - Estrutura Completa:**
```typescript
{
  data: [
    {
      id: 1,
      organization_id: "123e4567-e89b-12d3-a456-426614174000",
      type: "expense",
      description: "Compra no supermercado",
      tags: {
        "categoria": [
          {
            id: "789e0123-e89b-12d3-a456-426614174000",
            name: "Alimentação",
            tag_type: {
              id: "123e4567-e89b-12d3-a456-426614174000",
              name: "categoria",
              description: "Categoria da transação",
              is_required: true,
              max_per_transaction: 1
            },
            color: "#FF5733",
            is_default: true,
            is_active: true,
            organization_id: "123e4567-e89b-12d3-a456-426614174000"
          }
        ]
      },
      value: 150.50,
      payment_method: "PIX",
      date: "2025-01-15T14:30:00",
      category: "Alimentação", // Campo legado - mantido para compatibilidade
      recurring: false,
      created_at: "2025-01-15T14:30:00",
      updated_at: "2025-01-15T14:30:00"
    }
  ],
  pagination: {
    page: 1,
    limit: 20,
    total: 150,
    pages: 8,
    has_next: true,
    has_prev: false
  }
}
```

---

**Response (200) - Estrutura Completa:**
```typescript
{
  data: Transaction[],
  pagination: {
    page: 1,
    limit: 20,
    total: 150,
    pages: 8,
    has_next: true,
    has_prev: false
  }
}
```

**Campos de Paginação:**
- `page`: Página atual (1-indexed)
- `limit`: Itens por página
- `total`: Total de transações que atendem aos filtros
- `pages`: Total de páginas (calculado como `ceil(total / limit)`)
- `has_next`: `true` se existe próxima página
- `has_prev`: `true` se existe página anterior

**Erros:**
- `422`: Parâmetros inválidos (page < 1, limit < 1 ou limit > 100)
- `403`: Acesso negado à organização
- `401`: Não autenticado

---

### GET `/v1/transactions/summary`

Obtém estatísticas agregadas das transações que atendem aos filtros especificados. Útil para calcular KPIs sem precisar buscar todas as transações.

**Request:**
```typescript
const getTransactionsSummary = async (
  filters: TransactionsSummaryQuery
): Promise<TransactionsSummaryResponse> => {
  const response = await apiClient.get<TransactionsSummaryResponse>(
    '/v1/transactions/summary',
    { params: filters }
  );
  return response.data;
};
```

**Parâmetros:**
- `organization_id` (obrigatório): UUID da organização
- `type` (opcional): 'income' | 'expense'
- `category` (opcional): Nome da categoria
- `payment_method` (opcional): Método de pagamento
- `description` (opcional): Busca parcial na descrição
- `date_start` (opcional): Data inicial (YYYY-MM-DD)
- `date_end` (opcional): Data final (YYYY-MM-DD)
- `value_min` (opcional): Valor mínimo
- `value_max` (opcional): Valor máximo

**Exemplos de Uso:**
```typescript
// Obter resumo de todas as transações
const summary = await getTransactionsSummary({
  organization_id: "123e4567-e89b-12d3-a456-426614174000"
});
console.log(`Total: ${summary.total_transactions}`);
console.log(`Balanço: ${summary.balance}`);

// Resumo de despesas em janeiro
const januaryExpenses = await getTransactionsSummary({
  organization_id: orgId,
  type: 'expense',
  date_start: '2025-01-01',
  date_end: '2025-01-31'
});
console.log(`Total de despesas: ${januaryExpenses.total_expenses}`);

// Resumo por categoria
const foodSummary = await getTransactionsSummary({
  organization_id: orgId,
  category: 'Alimentação',
  date_start: '2025-01-01',
  date_end: '2025-01-31'
});
```

**Response (200):**
```typescript
{
  total_transactions: 45,
  total_value: 12500.50,        // Soma dos valores absolutos
  total_income: 10000.00,       // Soma de receitas
  total_expenses: 2500.50,      // Soma de despesas (valor absoluto)
  balance: 7499.50,             // total_income - total_expenses
  average_transaction: 277.79,  // total_value / total_transactions
  period: {
    start_date: "2025-01-01",   // ISO date string ou null
    end_date: "2025-01-31"      // ISO date string ou null
  },
  filters_applied: {
    organization_id: "123e4567-e89b-12d3-a456-426614174000",
    type: "expense",
    category: "Alimentação",
    payment_method: null,
    date_start: "2025-01-01",
    date_end: "2025-01-31"
  }
}
```

**Campos de Resposta:**
- `total_transactions`: Número total de transações que atendem aos filtros
- `total_value`: Soma dos valores absolutos de todas as transações
- `total_income`: Soma dos valores das transações de receita
- `total_expenses`: Soma dos valores absolutos das transações de despesa
- `balance`: Diferença entre receitas e despesas (total_income - total_expenses)
- `average_transaction`: Valor médio por transação (total_value / total_transactions)
- `period`: Informações sobre o período filtrado
- `filters_applied`: Filtros que foram aplicados na consulta

**Notas:**
- Se não houver transações que atendem aos filtros, todos os valores numéricos serão `0`
- `total_value` é a soma dos valores absolutos (sem considerar sinal)
- `balance` pode ser negativo se as despesas forem maiores que as receitas
- `average_transaction` será `0` se não houver transações

**Erros:**
- `403`: Acesso negado à organização
- `401`: Não autenticado

---

### GET `/v1/transactions/{transaction_id}`

Obtém uma transação específica por ID.

**Request:**
```typescript
const getTransaction = async (
  transactionId: number,
  organizationId: string
): Promise<Transaction> => {
  const response = await apiClient.get<Transaction>(
    `/v1/transactions/${transactionId}?organization_id=${organizationId}`
  );
  return response.data;
};
```

**Exemplo de Uso:**
```typescript
const transaction = await getTransaction(123, "123e4567-e89b-12d3-a456-426614174000");
console.log(transaction.description); // "Compra no supermercado"
```

**Response (200):**
```typescript
{
  id: 123,
  organization_id: "123e4567-e89b-12d3-a456-426614174000",
  type: "expense",
  description: "Compra no supermercado",
  tags: {
    "categoria": [
      {
        id: "789e0123-e89b-12d3-a456-426614174000",
        name: "Alimentação",
        tag_type: {
          id: "123e4567-e89b-12d3-a456-426614174000",
          name: "categoria",
          description: "Categoria da transação",
          is_required: true,
          max_per_transaction: 1
        },
        color: "#FF5733",
        is_default: true,
        is_active: true,
        organization_id: "123e4567-e89b-12d3-a456-426614174000"
      }
    ]
  },
  value: 150.50,
  payment_method: "PIX",
  date: "2025-01-15T14:30:00", // datetime com hora
  recurring: false,
  created_at: "2025-01-15T14:30:00", // timestamp de criação
  updated_at: "2025-01-15T14:30:00", // timestamp de última atualização
  category: "Alimentação", // Campo legado
  credit_card_charge: null // null se payment_method não for "credit_card"
}
```

**Exemplo - Transação com Cartão de Crédito:**
```typescript
// Se a transação foi criada com payment_method="credit_card",
// o campo credit_card_charge será preenchido:
{
  id: 456,
  organization_id: "123e4567-e89b-12d3-a456-426614174000",
  type: "expense",
  description: "Compra na loja",
  tags: {
    "categoria": [
      {
        id: "789e0123-e89b-12d3-a456-426614174000",
        name: "Compras",
        tag_type: { /* ... */ },
        color: "#FF5733",
        is_default: true,
        is_active: true,
        organization_id: "123e4567-e89b-12d3-a456-426614174000"
      }
    ]
  },
  value: 500.00,
  payment_method: "credit_card",
  date: "2025-01-15T15:45:00", // datetime com hora
  recurring: false,
  created_at: "2025-01-15T15:45:00", // timestamp de criação
  updated_at: "2025-01-15T15:45:00", // timestamp de última atualização
  category: "Compras",
  credit_card_charge: {
    charge: {
      id: 789,
      organization_id: "123e4567-e89b-12d3-a456-426614174000",
      card_id: 1,
      transaction_id: 456,
      total_amount: 500.00,
      installments_count: 1,
      modality: "cash", // ou "installment"
      purchase_date: "2025-01-15"
    },
    card: {
      id: 1,
      organization_id: "123e4567-e89b-12d3-a456-426614174000",
      last4: "1234",
      brand: "Visa",
      due_day: 10,
      description: "Cartão Principal"
    }
  }
}
```

**Notas:**
- O campo `credit_card_charge` só é preenchido quando `payment_method` é `"credit_card"`
- Quando a transação não é de cartão de crédito, `credit_card_charge` será `null`
- O objeto `charge` contém informações sobre a compra (modalidade, parcelas, valor total)
- Os campos `created_at` e `updated_at` estão disponíveis em todas as respostas de transações e podem ser usados para ordenação de listas no frontend
- O objeto `card` contém informações sobre o cartão usado (últimos 4 dígitos, bandeira, dia de vencimento)

**Erros:**
- `404`: Transação não encontrada
- `403`: Acesso negado à organização
- `500`: Erro interno do servidor

---

### PUT `/v1/transactions/{transaction_id}`

Atualiza uma transação existente. Todos os campos são opcionais - apenas os campos fornecidos serão atualizados.

**Request:**
```typescript
interface UpdateTransactionRequest {
  type?: 'income' | 'expense';
  description?: string;
  tag_ids?: string[]; // Lista de tag UUIDs para substituir as tags existentes
  value?: number;
  payment_method?: string;
  date: string; // ISO datetime string (YYYY-MM-DDTHH:MM or YYYY-MM-DDTHH:MM:SS) - REQUIRED, supports minute granularity
  recurring?: boolean;
  category?: string; // Campo legado - opcional
  // Campos de cartão de crédito (opcional - apenas se payment_method for "Cartão de Crédito")
  card_id?: number; // ID do cartão (prioridade sobre card_last4)
  card_last4?: string; // Últimos 4 dígitos do cartão (fallback se card_id não for fornecido)
  modality?: 'cash' | 'installment'; // Modalidade de pagamento
  installments_count?: number; // Número de parcelas (obrigatório se modality for 'installment')
}

const updateTransaction = async (
  transactionId: number,
  organizationId: string,
  updates: UpdateTransactionRequest
): Promise<Transaction> => {
  const response = await apiClient.put<Transaction>(
    `/v1/transactions/${transactionId}?organization_id=${organizationId}`,
    updates
  );
  return response.data;
};
```

**Exemplos de Uso:**
```typescript
// Atualizar apenas a descrição (date é obrigatório)
await updateTransaction(123, orgId, {
  description: "Nova descrição",
  date: "2025-01-20T14:30" // datetime com hora (obrigatório)
});

// Atualizar valor e data
await updateTransaction(123, orgId, {
  value: 200.00,
  date: "2025-01-20T15:45" // datetime com hora
});

// Atualizar tags (substitui todas as tags existentes)
await updateTransaction(123, orgId, {
  tag_ids: [
    "new-tag-id-1",
    "new-tag-id-2"
  ]
});

// Atualizar múltiplos campos
await updateTransaction(123, orgId, {
  description: "Descrição atualizada",
  value: 250.00,
  payment_method: "Cartão de Crédito",
  recurring: true
});

// Atualizar transação com cartão de crédito - alterar cartão
await updateTransaction(123, orgId, {
  card_id: 456, // ID do novo cartão
  date: "2025-01-20T15:45"
});

// Atualizar modalidade para à vista (remove parcelas)
await updateTransaction(123, orgId, {
  modality: "cash",
  date: "2025-01-20T15:45"
});

// Atualizar para parcelado (cria novas parcelas)
await updateTransaction(123, orgId, {
  modality: "installment",
  installments_count: 3, // 3 parcelas
  date: "2025-01-20T15:45"
});

// Atualizar valor + parcelas (recalcula parcelas com novo valor)
await updateTransaction(123, orgId, {
  value: 300.00, // Novo valor total
  modality: "installment",
  installments_count: 5, // 5 parcelas de 60.00 cada
  date: "2025-01-20T15:45"
});
```

**Response (200):**
```typescript
{
  id: 123,
  organization_id: "123e4567-e89b-12d3-a456-426614174000",
  type: "expense",
  description: "Nova descrição",
  tags: {
    "categoria": [
      {
        id: "789e0123-e89b-12d3-a456-426614174000",
        name: "Alimentação",
        // ... tag details
      }
    ]
  },
  value: 200.00,
  payment_method: "PIX",
  date: "2025-01-20T14:30:00", // datetime com hora
  recurring: false,
  category: "Alimentação"
}
```

**Notas Importantes:**
- Se `tag_ids` for fornecido, **todas as tags existentes serão substituídas** pelas novas tags
- Se `tag_ids` não for fornecido, as tags existentes serão mantidas
- Pelo menos uma tag do tipo "categoria" (ou outro tipo obrigatório) deve estar presente se `tag_ids` for fornecido
- Campos não fornecidos mantêm seus valores originais

**Campos de Cartão de Crédito:**
- Os campos `card_id`, `card_last4`, `modality` e `installments_count` só devem ser enviados quando `payment_method` for "Cartão de Crédito"
- Se `card_id` for fornecido, ele terá prioridade sobre `card_last4`
- Se `card_last4` for fornecido mas `card_id` não, o sistema buscará o cartão correspondente na organização
- Ao alterar `modality` de "installment" para "cash", as parcelas existentes serão removidas
- Ao alterar `modality` de "cash" para "installment", novas parcelas serão criadas baseado no `value` atual
- Ao alterar `installments_count` mantendo "installment", as parcelas antigas são removidas e novas são criadas
- Se `value` for alterado junto com campos de cartão, o `total_amount` do charge será atualizado e as parcelas recalculadas

**Erros:**
- `404`: Transação não encontrada
- `403`: Acesso negado à organização
- `422`: Erro de validação ou regra de negócio (ex: tag obrigatória ausente, cartão não encontrado, modalidade inválida)
- `500`: Erro interno do servidor

**Erros de Cartão de Crédito:**
- `422`: Cartão não encontrado (se `card_id` ou `card_last4` inválido)
- `422`: `installments_count` obrigatório quando `modality` é "installment"
- `422`: `modality` deve ser "cash" ou "installment"
- `422`: Campos de cartão só podem ser usados com `payment_method: "Cartão de Crédito"`

---

### DELETE `/v1/transactions/{transaction_id}`

Exclui uma transação específica.

**Request:**
```typescript
const deleteTransaction = async (
  transactionId: number,
  organizationId: string
): Promise<void> => {
  await apiClient.delete(
    `/v1/transactions/${transactionId}?organization_id=${organizationId}`
  );
};
```

**Exemplo de Uso:**
```typescript
// Excluir uma transação
await deleteTransaction(123, "123e4567-e89b-12d3-a456-426614174000");

// Com tratamento de erro
try {
  await deleteTransaction(123, orgId);
  console.log("Transação excluída com sucesso");
} catch (error) {
  if (error.response?.status === 404) {
    console.error("Transação não encontrada");
  } else {
    console.error("Erro ao excluir transação:", error);
  }
}
```

**Response (204):** Sem conteúdo (No Content)

**Erros:**
- `404`: Transação não encontrada
- `403`: Acesso negado à organização
- `500`: Erro interno do servidor

---

## 💳 Endpoints de Cartões de Crédito

### Tipos TypeScript para Cartões de Crédito

```typescript
// Types for Credit Cards
interface CreditCard {
  id: number;
  organization_id: string;
  last4: string;
  brand: string;
  due_day: number;
  description: string | null;
  // New fields
  credit_limit: number | null;
  closing_day: number | null;
  color: string | null; // Hex color like #FF5733
  // Calculated fields (read-only)
  available_limit: number | null;
  used_limit: number;
  limit_usage_percent: number | null;
}

interface CreateCreditCardRequest {
  organization_id: string;
  last4: string;
  brand: string; // "visa" | "mastercard" | "elo" | "amex" | "hipercard" | "other"
  due_day: number; // 1-31
  description?: string;
  credit_limit?: number;
  closing_day?: number; // 1-31
  color?: string; // Hex color pattern: ^#[0-9A-Fa-f]{6}$
}

interface CategoryBreakdown {
  category_id: string | null;
  category_name: string;
  category_color: string;
  total: number;
  percentage: number;
  transaction_count: number;
}

interface InvoiceResponse {
  month: string;
  due_date: string;
  total_amount: number;
  status: "open" | "closed" | "paid";
  items: InvoiceItem[];
  // New fields
  closing_date: string | null;
  days_until_due: number;
  is_overdue: boolean;
  paid_date: string | null;
  previous_month_total: number | null;
  month_over_month_change: number | null; // Can be negative (spent less)
  limit_usage_percent: number | null;
  items_count: number;
  category_breakdown: CategoryBreakdown[];
}

interface InvoiceHistoryItem {
  year: number;
  month: number;
  month_name: string;
  total_amount: number;
  status: string;
  items_count: number;
  top_category: string | null;
}

interface InvoiceHistorySummary {
  total_spent: number;
  average_monthly: number;
  highest_month: { month: string; amount: number } | null;
  lowest_month: { month: string; amount: number } | null;
}

interface InvoiceHistoryResponse {
  card_id: number;
  card_name: string;
  period_start: string;
  period_end: string;
  summary: InvoiceHistorySummary;
  monthly_data: InvoiceHistoryItem[];
}

interface MarkInvoicePaidRequest {
  paid_date?: string; // ISO date, defaults to today
}

interface InvoiceMarkPaidResponse {
  card_id: number;
  year: number;
  month: number;
  status: string;
  paid_date: string | null;
}
```

---

### POST `/v1/credit-cards`

Cria um novo cartão de crédito.

**Request:**
```typescript
const createCreditCard = async (
  card: CreateCreditCardRequest
): Promise<CreditCard> => {
  const response = await apiClient.post<CreditCard>(
    '/v1/credit-cards',
    card
  );
  return response.data;
};
```

**Exemplo:**
```typescript
await createCreditCard({
  organization_id: "123e4567-e89b-12d3-a456-426614174000",
  last4: "1234",
  brand: "mastercard",
  due_day: 10,
  description: "Nubank",
  credit_limit: 5000.00,
  closing_day: 3,
  color: "#8B5CF6",
});
```

**Response (201):**
```typescript
{
  id: 1,
  organization_id: "123e4567-e89b-12d3-a456-426614174000",
  last4: "1234",
  brand: "mastercard",
  due_day: 10,
  description: "Nubank",
  credit_limit: 5000.00,
  closing_day: 3,
  color: "#8B5CF6",
  available_limit: null, // Not calculated on create
  used_limit: 0,
  limit_usage_percent: null
}
```

**Erros:**
- `400`: Invalid data (e.g., invalid color format, closing_day out of range)
- `403`: User does not have access to the organization
- `422`: Duplicate card (same last4 and brand in the same organization)

---

### GET `/v1/credit-cards`

Lista todos os cartões de uma organização com limites calculados.

**Request:**
```typescript
const listCreditCards = async (
  organizationId: string
): Promise<CreditCard[]> => {
  const response = await apiClient.get<CreditCard[]>('/v1/credit-cards', {
    params: { organization_id: organizationId },
  });
  return response.data;
};
```

**Response (200):**
```typescript
[
  {
    id: 1,
    organization_id: "123e4567-e89b-12d3-a456-426614174000",
    last4: "1234",
    brand: "mastercard",
    due_day: 10,
    description: "Nubank",
    credit_limit: 5000.00,
    closing_day: 3,
    color: "#8B5CF6",
    // Calculated fields
    available_limit: 3200.00,
    used_limit: 1800.00,
    limit_usage_percent: 36.0
  }
]
```

**Notes:**
- `available_limit`: `null` if `credit_limit` is 0 or not set
- `used_limit`: Sum of future installments (status = scheduled/pending)
- `limit_usage_percent`: `null` if `credit_limit` is 0 or not set

---

### GET `/v1/credit-cards/{card_id}`

Obtém um cartão específico com limites calculados.

**Request:**
```typescript
const getCreditCard = async (
  cardId: number,
  organizationId: string
): Promise<CreditCard> => {
  const response = await apiClient.get<CreditCard>(
    `/v1/credit-cards/${cardId}`,
    {
      params: { organization_id: organizationId },
    }
  );
  return response.data;
};
```

**Response (200):**
```typescript
{
  id: 1,
  organization_id: "123e4567-e89b-12d3-a456-426614174000",
  last4: "1234",
  brand: "mastercard",
  due_day: 10,
  description: "Nubank",
  credit_limit: 5000.00,
  closing_day: 3,
  color: "#8B5CF6",
  available_limit: 3200.00,
  used_limit: 1800.00,
  limit_usage_percent: 36.0
}
```

**Erros:**
- `403`: User does not have access to the organization
- `404`: Credit card not found

---

### PATCH `/v1/credit-cards/{card_id}`

Atualiza um cartão de crédito (atualização parcial).

Apenas os campos enviados no request serão atualizados. Os demais campos permanecem inalterados.

**Request:**
```typescript
const updateCreditCard = async (
  cardId: number,
  organizationId: string,
  updates: Partial<UpdateCreditCardRequest>
): Promise<CreditCard> => {
  const response = await apiClient.patch<CreditCard>(
    `/v1/credit-cards/${cardId}`,
    updates,
    {
      params: { organization_id: organizationId },
    }
  );
  return response.data;
};
```

**Request Body (todos os campos são opcionais):**
```typescript
interface UpdateCreditCardRequest {
  last4?: string; // 4 dígitos
  brand?: string; // "visa" | "mastercard" | "elo" | "amex" | "hipercard" | "other"
  due_day?: number; // 1-31
  description?: string;
  credit_limit?: number; // >= 0
  closing_day?: number; // 1-31
  color?: string; // Hex color pattern: ^#[0-9A-Fa-f]{6}$
}
```

**Exemplo:**
```typescript
// Atualizar apenas o limite e a cor
await updateCreditCard(cardId, organizationId, {
  credit_limit: 6000.0,
  color: "#FF5733",
});

// Atualizar apenas a descrição
await updateCreditCard(cardId, organizationId, {
  description: "Cartão principal atualizado",
});
```

**Response (200):**
```typescript
{
  id: 1,
  organization_id: "123e4567-e89b-12d3-a456-426614174000",
  last4: "1234",
  brand: "mastercard",
  due_day: 10,
  description: "Cartão principal atualizado",
  credit_limit: 6000.00,
  closing_day: 3,
  color: "#FF5733",
  available_limit: 4200.00, // Recalculado
  used_limit: 1800.00,
  limit_usage_percent: 30.0 // Recalculado
}
```

**Erros:**
- `400`: Invalid data (e.g., invalid color format, closing_day out of range)
- `403`: User does not have access to the organization
- `404`: Credit card not found

---

### DELETE `/v1/credit-cards/{card_id}`

Deleta um cartão de crédito.

**Request:**
```typescript
const deleteCreditCard = async (
  cardId: number,
  organizationId: string
): Promise<void> => {
  await apiClient.delete(`/v1/credit-cards/${cardId}`, {
    params: { organization_id: organizationId },
  });
};
```

**Response (204):** Sem conteúdo

**Erros:**
- `403`: Usuário não tem acesso à organização
- `404`: Cartão não encontrado

---

### GET `/v1/credit-cards/{card_id}/invoices/{year}/{month}`

Obtém a fatura de um cartão de crédito para um mês específico com campos calculados.

**Request:**
```typescript
const getCreditCardInvoice = async (
  cardId: number,
  year: number,
  month: number,
  organizationId: string
): Promise<InvoiceResponse> => {
  const response = await apiClient.get<InvoiceResponse>(
    `/v1/credit-cards/${cardId}/invoices/${year}/${month}`,
    {
      params: { organization_id: organizationId },
    }
  );
  return response.data;
};
```

**Response (200):**
```typescript
{
  month: "2025-01",
  due_date: "2025-01-10",
  total_amount: 2450.00,
  status: "open", // "open" | "closed" | "paid"
  closing_date: "2025-01-03",
  paid_date: null,
  days_until_due: 7, // Negative if overdue
  is_overdue: false,
  previous_month_total: 2180.00,
  month_over_month_change: 12.4, // % change vs previous month (can be negative)
  limit_usage_percent: 49.0,
  items_count: 32,
  category_breakdown: [
    {
      category_id: "uuid-here",
      category_name: "Alimentação",
      category_color: "#22C55E",
      total: 1102.50,
      percentage: 45.0,
      transaction_count: 15
    },
    {
      category_id: null,
      category_name: "Sem Categoria",
      category_color: "#6B7280",
      total: 368.40,
      percentage: 15.0,
      transaction_count: 4
    }
  ],
  items: [
    {
      id: 123,
      charge_id: 456,
      transaction_date: "2025-01-05",
      description: "Compra Parcelada",
      amount: 100.00,
      installment_number: 1,
      total_installments: 10,
      tags: {
        "categoria": [
          {
            id: "uuid-here",
            name: "Eletrônicos",
            color: "#3B82F6",
            is_default: false,
            is_active: true
          }
        ]
      }
    }
  ]
}
```

**Erros:**
- `403`: User does not have access to the organization
- `404`: Credit card not found or invoice not found for the specified card/month

**Notas Importantes:**
- O endpoint retorna `404` quando a fatura não existe para o mês/cartão solicitado (sem itens/parcelas)
- O endpoint retorna `200` apenas quando a fatura existe e possui itens
- Diferencie os casos de `404`:
  - **Cartão não encontrado**: `{"detail": "Credit card {id} not found"}`
  - **Fatura não encontrada**: `{"detail": "Invoice not found for the specified card/month"}`
- `month_over_month_change` pode ser **negativo** (gastou menos que o mês anterior)
- `category_breakdown` é ordenado por `total` decrescente

---

### GET `/v1/credit-cards/{card_id}/invoices/history`

Obtém o histórico de faturas de um cartão para gráficos de evolução.

**Request:**
```typescript
const getInvoiceHistory = async (
  cardId: number,
  organizationId: string,
  months: number = 6
): Promise<InvoiceHistoryResponse> => {
  const response = await apiClient.get<InvoiceHistoryResponse>(
    `/v1/credit-cards/${cardId}/invoices/history`,
    {
      params: { organization_id: organizationId, months },
    }
  );
  return response.data;
};
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `months` | number | 6 | Number of months to retrieve (1-24) |

**Response (200):**
```typescript
{
  card_id: 1,
  card_name: "Nubank",
  period_start: "2024-08-01",
  period_end: "2025-01-31",
  summary: {
    total_spent: 28540.00,
    average_monthly: 2378.33,
    highest_month: {
      month: "dezembro 2024",
      amount: 4520.00
    },
    lowest_month: {
      month: "agosto 2024",
      amount: 1250.00
    }
  },
  monthly_data: [
    {
      year: 2024,
      month: 8,
      month_name: "agosto 2024",
      total_amount: 1250.00,
      status: "paid",
      items_count: 18,
      top_category: "Alimentação"
    },
    // ... more months
  ]
}
```

**Erros:**
- `403`: User does not have access to the organization
- `404`: Credit card not found

---

### PATCH `/v1/credit-cards/{card_id}/invoices/{year}/{month}/mark-paid`

Marca uma fatura como paga (controle manual do usuário).

> **Nota:** Este endpoint NÃO realiza pagamento real. Apenas atualiza o status da fatura 
> para que o usuário possa acompanhar quais faturas já foram pagas no app do banco.

**Request:**
```typescript
const markInvoicePaid = async (
  cardId: number,
  year: number,
  month: number,
  organizationId: string,
  paidDate?: string // ISO date, defaults to today
): Promise<InvoiceMarkPaidResponse> => {
  const response = await apiClient.patch<InvoiceMarkPaidResponse>(
    `/v1/credit-cards/${cardId}/invoices/${year}/${month}/mark-paid`,
    { paid_date: paidDate },
    { params: { organization_id: organizationId } }
  );
  return response.data;
};
```

**Request Body (optional):**
```typescript
{
  paid_date?: "2025-01-08" // ISO date, defaults to today if not provided
}
```

**Response (200):**
```typescript
{
  card_id: 1,
  year: 2025,
  month: 1,
  status: "paid",
  paid_date: "2025-01-08"
}
```

**Erros:**
- `400`: Invoice is already paid or paid_date is in the future
- `403`: User does not have access to the organization
- `404`: Credit card not found

---

### PATCH `/v1/credit-cards/{card_id}/invoices/{year}/{month}/unmark-paid`

Desfaz a marcação de pagamento de uma fatura (caso tenha marcado por engano).

**Request:**
```typescript
const unmarkInvoicePaid = async (
  cardId: number,
  year: number,
  month: number,
  organizationId: string
): Promise<InvoiceMarkPaidResponse> => {
  const response = await apiClient.patch<InvoiceMarkPaidResponse>(
    `/v1/credit-cards/${cardId}/invoices/${year}/${month}/unmark-paid`,
    {},
    { params: { organization_id: organizationId } }
  );
  return response.data;
};
```

**Response (200):**
```typescript
{
  card_id: 1,
  year: 2025,
  month: 1,
  status: "open", // or "closed" based on closing_date
  paid_date: null
}
```

**Erros:**
- `400`: Invoice is not marked as paid
- `403`: User does not have access to the organization
- `404`: Credit card or invoice not found

**Exemplo de Tratamento de Erros:**
```typescript
try {
  const invoice = await getCreditCardInvoice(cardId, year, month, organizationId);
  // Fatura existe e possui itens
  console.log(`Fatura com ${invoice.items.length} itens`);
} catch (error) {
    if (error.response?.status === 404) {
      const detail = error.response.data.detail;
      if (detail.includes("Invoice not found")) {
        // Fatura não existe para este mês/cartão
        console.log("Fatura não encontrada - desabilitar navegação");
      } else if (detail.includes("Credit card") && detail.includes("not found")) {
        // Cartão não existe
        console.log("Cartão não encontrado");
      }
    } else if (error.response?.status === 403) {
    // Acesso negado
    console.log("Acesso negado à organização");
  }
}
```

---

### Como Obter `charge_id` e `installment_id`

Para usar o endpoint `move_installment_to_invoice`, você precisa dos seguintes IDs:
- `card_id`: ID do cartão de crédito (já disponível ao listar cartões)
- `charge_id`: ID da compra (charge) associada à parcela
- `installment_id`: ID da parcela específica que você quer mover

#### Opção 1: Através da Transação (Recomendado)

Quando você obtém uma transação de cartão de crédito, o `charge_id` está disponível no campo `credit_card_charge.charge.id`:

```typescript
// Obter transação
const transaction = await getTransaction(transactionId, organizationId);

if (transaction.credit_card_charge) {
  const chargeId = transaction.credit_card_charge.charge.id;
  const cardId = transaction.credit_card_charge.card.id;
  
  // Para obter o installment_id, você precisa buscar as parcelas da fatura
  // ou usar o id do item da fatura (veja Opção 2)
}
```

#### Opção 2: Através da Fatura (Recomendado para visualização de faturas)

Quando você obtém uma fatura de cartão de crédito, cada item (`InvoiceItemResponse`) possui **todos os IDs necessários**:
- `id`: Este é o `installment_id` da parcela
- `charge_id`: ID da compra (charge) associada à parcela ✅ **Agora disponível diretamente!**
- `installment_number`: Número da parcela (1, 2, 3, etc.)
- `total_installments`: Total de parcelas da compra

**Exemplo Prático:**

```typescript
// 1. Obter fatura do cartão
const invoice = await getCreditCardInvoice(cardId, year, month, organizationId);

// 2. Para cada item da fatura, você já tem tudo que precisa:
invoice.items.forEach((item) => {
  const installmentId = item.id;        // installment_id
  const chargeId = item.charge_id;       // charge_id - agora disponível diretamente!
  const cardId = /* já conhecido */;
  
  // 3. Pronto para usar no endpoint de mover parcela
  await moveInstallmentToInvoice(
    cardId,
    chargeId,
    installmentId,
    organizationId,
    {
      target_year: 2025,
      target_month: 12,
    }
  );
});
```

---

### PATCH `/v1/credit-cards/{card_id}/charges/{charge_id}/installments/{installment_id}/invoice`

Move uma parcela específica para uma fatura diferente (mês/ano) e recalcula todas as outras parcelas da mesma compra mantendo intervalo de 1 mês entre elas.

> **Nota:** Este endpoint permite ajuste manual de parcelas para sincronizar com o app do banco. Ao mover uma parcela para um mês/ano específico, todas as outras parcelas da mesma compra são recalculadas automaticamente para manter o intervalo de 1 mês entre elas.

**Request:**
```typescript
interface MoveInstallmentRequest {
  target_year: number;  // Ano da fatura de destino (1900-2100)
  target_month: number; // Mês da fatura de destino (1-12)
}

const moveInstallmentToInvoice = async (
  cardId: number,
  chargeId: number,
  installmentId: number,
  organizationId: string,
  target: MoveInstallmentRequest
): Promise<void> => {
  await apiClient.patch(
    `/v1/credit-cards/${cardId}/charges/${chargeId}/installments/${installmentId}/invoice`,
    target,
    {
      params: { organization_id: organizationId },
    }
  );
};
```

**Exemplo:**
```typescript
// Mover a parcela 3 de uma compra de 5 parcelas para dezembro de 2025
// Todas as outras parcelas serão recalculadas:
// - Parcela 1: outubro 2025 (dezembro - 2 meses)
// - Parcela 2: novembro 2025 (dezembro - 1 mês)
// - Parcela 3: dezembro 2025 (destino)
// - Parcela 4: janeiro 2026 (dezembro + 1 mês)
// - Parcela 5: fevereiro 2026 (dezembro + 2 meses)
await moveInstallmentToInvoice(
  cardId,
  chargeId,
  installmentId,
  organizationId,
  {
    target_year: 2025,
    target_month: 12,
  }
);
```

**Response (200):**
```typescript
{
  success: true,
  message: "Installment moved to invoice 2025-12 and all related installments recalculated"
}
```

**Erros:**
- `400`: Invalid year/month (out of range) or invalid installment position
- `403`: User does not have access to the organization
- `404`: Installment, charge, or card not found
- `422`: Installment does not belong to the specified organization

**Exemplo de Tratamento de Erros:**
```typescript
try {
  await moveInstallmentToInvoice(
    cardId,
    chargeId,
    installmentId,
    organizationId,
    { target_year: 2025, target_month: 12 }
  );
  // Sucesso - todas as parcelas foram recalculadas
  console.log("Parcela movida com sucesso");
} catch (error) {
  if (error.response?.status === 404) {
    console.log("Parcela, compra ou cartão não encontrado");
  } else if (error.response?.status === 403) {
    console.log("Acesso negado à organização");
  } else if (error.response?.status === 400) {
    console.log("Ano/mês inválido ou posição de parcela inválida");
  }
}
```

**Notas Importantes:**
- A data de vencimento (`due_date`) é calculada automaticamente com base no `due_day` do cartão e no mês/ano da fatura de destino
- Todas as parcelas da mesma compra são recalculadas para manter intervalo de 1 mês
- O sistema usa uma fórmula de "mês absoluto" para garantir cálculos corretos mesmo com mudanças de ano
- A parcela movida serve como "âncora" e as outras são posicionadas relativamente a ela

---

## 🎯 Endpoints de Metas (Goals)

### POST `/v1/goals`

Cria uma nova meta financeira.

**Request:**
```typescript
const createGoal = async (
  goal: CreateGoalRequest
): Promise<Goal> => {
  const response = await apiClient.post<Goal>(
    '/v1/goals',
    goal
  );
  return response.data;
};
```

**Exemplo:**
```typescript
await createGoal({
  organization_id: "123e4567-e89b-12d3-a456-426614174000",
  name: "Reserva de Emergência",
  target_amount: 15000.00,
  deadline: "2025-12-31",
  description: "Fundo para imprevistos"
});
```

**Response (201):**
```typescript
{
  id: "goal-uuid",
  organization_id: "org-uuid",
  name: "Reserva de Emergência",
  target_amount: 15000.00,
  current_amount: 0.00,
  deadline: "2025-12-31",
  status: "active",
  description: "Fundo para imprevistos",
  created_at: "2025-01-15T10:00:00",
  progress: 0.0
}
```

---

### GET `/v1/goals`

Lista todas as metas de uma organização.

**Request:**
```typescript
const listGoals = async (
  organizationId: string
): Promise<Goal[]> => {
  const response = await apiClient.get<Goal[]>('/v1/goals', {
    params: { organization_id: organizationId }
  });
  return response.data;
};
```

**Response (200):**
```typescript
[
  {
    id: "goal-uuid",
    name: "Reserva de Emergência",
    target_amount: 15000.00,
    current_amount: 2250.00,
    deadline: "2025-12-31",
    status: "active",
    progress: 15.0,
    // ...
  }
]
```

---

### GET `/v1/goals/{goal_id}`

Obtém detalhes de uma meta específica.

**Request:**
```typescript
const getGoal = async (
  goalId: string,
  organizationId: string
): Promise<Goal> => {
  const response = await apiClient.get<Goal>(
    `/v1/goals/${goalId}`,
    {
      params: { organization_id: organizationId }
    }
  );
  return response.data;
};
```

---

### PUT `/v1/goals/{goal_id}`

Atualiza uma meta existente.

**Request:**
```typescript
const updateGoal = async (
  goalId: string,
  organizationId: string,
  data: UpdateGoalRequest
): Promise<Goal> => {
  const response = await apiClient.put<Goal>(
    `/v1/goals/${goalId}`,
    data,
    {
      params: { organization_id: organizationId }
    }
  );
  return response.data;
};
```

**Exemplo:**
```typescript
await updateGoal("goal-uuid", "org-uuid", {
  current_amount: 3000.00,
  status: "active"
});
```

---

## 📊 Endpoints de Simulação Financeira

### POST `/v1/financial-impact/simulate`

Simula o impacto financeiro de novos compromissos de cartão de crédito e metas de economia.

Calcula projeções mês a mês baseado em:
- **Fonte A:** Receita projetada (transações de receita recorrentes)
- **Fonte B:** Despesas base (média de despesas recorrentes, excluindo faturas de cartão)
- **Fonte C:** Compromissos de cartão existentes (parcelas futuras)
- **Fonte D:** Novos compromissos de cartão (cenário de simulação)
- **Metas de economia:** Contribuições mensais para metas

Retorna análise mês a mês com status (success/warning/danger) e veredito global (viable/caution/high-risk).

**Request:**
```typescript
interface NewCardCommitment {
  card_last4: string; // Últimos 4 dígitos do cartão
  value: number; // Valor total da compra (decimal)
  installments_count: number; // Número de parcelas (1-120)
  description: string; // Descrição da compra (1-255 caracteres)
}

interface SavingsGoal {
  target_amount: number; // Valor alvo da meta (decimal)
  current_amount: number; // Valor já economizado (decimal, >= 0)
  target_date: string; // Data alvo no formato YYYY-MM-DD
}

interface SimulateFinancialImpactRequest {
  organization_id: string; // UUID da organização
  new_card_commitments?: NewCardCommitment[]; // Novos compromissos de cartão (opcional)
  savings_goals?: SavingsGoal[]; // Metas de economia (opcional)
  simulation_months?: number; // Número de meses para simular (1-60, até 5 anos, padrão: 6)
}

const simulateFinancialImpact = async (
  request: SimulateFinancialImpactRequest
): Promise<SimulateFinancialImpactResponse> => {
  const response = await apiClient.post<SimulateFinancialImpactResponse>(
    '/v1/financial-impact/simulate',
    request
  );
  return response.data;
};
```

**Exemplos de Uso:**

```typescript
// Simulação simples - apenas verificar situação atual
await simulateFinancialImpact({
  organization_id: "123e4567-e89b-12d3-a456-426614174000",
  simulation_months: 6
});

// Simular nova compra parcelada
await simulateFinancialImpact({
  organization_id: "123e4567-e89b-12d3-a456-426614174000",
  new_card_commitments: [
    {
      card_last4: "1234",
      value: 2000.00,
      installments_count: 10,
      description: "Notebook novo"
    }
  ],
  simulation_months: 10
});

// Simular múltiplas compras
await simulateFinancialImpact({
  organization_id: "123e4567-e89b-12d3-a456-426614174000",
  new_card_commitments: [
    {
      card_last4: "1234",
      value: 1500.00,
      installments_count: 6,
      description: "Móveis"
    },
    {
      card_last4: "5678",
      value: 800.00,
      installments_count: 3,
      description: "Eletrodomésticos"
    }
  ],
  simulation_months: 6
});

// Simular com metas de economia
await simulateFinancialImpact({
  organization_id: "123e4567-e89b-12d3-a456-426614174000",
  new_card_commitments: [
    {
      card_last4: "1234",
      value: 3000.00,
      installments_count: 12,
      description: "Viagem"
    }
  ],
  savings_goals: [
    {
      target_amount: 10000.00,
      current_amount: 2000.00,
      target_date: "2025-12-31"
    }
  ],
  simulation_months: 12
});
```

**Response (200):**
```typescript
interface MonthlyProjection {
  month: string; // Formato: "YYYY-MM" (ex: "2025-01")
  projected_income: number; // Receita projetada do mês
  base_expenses: number; // Despesas base (excluindo cartões)
  card_commitments: number; // Compromissos de cartão do mês
  savings_goal: number; // Contribuição para metas de economia
  total_expenses: number; // Total de despesas (base + cartões + metas)
  balance: number; // Saldo (receita - despesas)
  status: "success" | "warning" | "danger"; // Status do mês
}

interface SimulateFinancialImpactResponse {
  months: MonthlyProjection[]; // Projeções mês a mês
  global_verdict: "viable" | "caution" | "high-risk"; // Veredito global
  summary: {
    income: number; // Total de receita no período
    base_expenses: number; // Total de despesas base
    card_commitments: number; // Total de compromissos de cartão
    savings_goal: number; // Total de contribuições para metas
  };
}
```

**Exemplo de Response:**
```typescript
{
  months: [
    {
      month: "2025-01",
      projected_income: 5000.00,
      base_expenses: 3000.00,
      card_commitments: 200.00, // Parcela do novo compromisso
      savings_goal: 500.00,
      total_expenses: 3700.00,
      balance: 1300.00,
      status: "success"
    },
    {
      month: "2025-02",
      projected_income: 5000.00,
      base_expenses: 3000.00,
      card_commitments: 200.00,
      savings_goal: 500.00,
      total_expenses: 3700.00,
      balance: 1300.00,
      status: "success"
    },
    // ... mais meses
  ],
  global_verdict: "viable",
  summary: {
    income: 30000.00,
    base_expenses: 18000.00,
    card_commitments: 2000.00,
    savings_goal: 3000.00
  }
}
```

**Status dos Meses:**
- `"success"`: Saldo positivo, situação confortável
- `"warning"`: Saldo baixo ou próximo de zero, atenção necessária
- `"danger"`: Saldo negativo, situação crítica

**Veredito Global:**
- `"viable"`: Simulação viável, situação financeira estável
- `"caution"`: Cuidado necessário, alguns meses podem ser apertados
- `"high-risk"`: Alto risco, situação financeira comprometida

**Validações:**
- `card_last4`: Deve corresponder a um cartão existente na organização
- `value`: Deve ser maior que 0
- `installments_count`: Deve estar entre 1 e 120
- `description`: Deve ter entre 1 e 255 caracteres
- `target_amount`: Deve ser maior que 0
- `current_amount`: Deve ser >= 0
- `target_date`: Deve ser uma data válida no futuro
- `simulation_months`: Deve estar entre 1 e 60 (até 5 anos)

**Notas Importantes:**
- O endpoint calcula automaticamente as parcelas dos novos compromissos baseado no valor total e número de parcelas
- As parcelas são distribuídas mensalmente a partir do próximo mês
- Compromissos existentes de cartão são automaticamente incluídos na simulação
- Metas de economia são calculadas automaticamente baseado no valor alvo, valor atual e data alvo
- A receita projetada é calculada a partir de transações de receita marcadas como recorrentes
- As despesas base são calculadas como média dos últimos 3 meses, excluindo pagamentos de faturas de cartão

**Erros:**
- `400`: Dados inválidos (valores negativos, datas inválidas, etc.)
- `401`: Não autenticado (token inválido ou ausente)
- `403`: Acesso negado à organização
- `422`: Erro de validação ou regra de negócio (cartão não encontrado, etc.)
- `500`: Erro interno do servidor

**Exemplo de Hook React:**
```typescript
// hooks/useFinancialSimulation.ts
import { useState } from 'react';
import { simulateFinancialImpact, SimulateFinancialImpactRequest, SimulateFinancialImpactResponse } from '../api/financialSimulation';
import { handleApiError } from '../utils/errorHandler';

export const useFinancialSimulation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulateFinancialImpactResponse | null>(null);

  const simulate = async (request: SimulateFinancialImpactRequest) => {
    try {
      setLoading(true);
      setError(null);
      const response = await simulateFinancialImpact(request);
      setResult(response);
      return response;
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return { simulate, loading, error, result };
};
```

---

## 🤖 Endpoints de Chat/AI

### POST `/v1/ai/chat`

Envia uma mensagem para o assistente financeiro de IA.

**Request:**
```typescript
const sendChatMessage = async (
  message: string,
  sessionId?: string
): Promise<ChatResponse> => {
  const response = await apiClient.post<ChatResponse>(
    '/v1/ai/chat',
    {
      message,
      session_id: sessionId,
    }
  );
  return response.data;
};
```

**Exemplo:**
```typescript
const response = await sendChatMessage(
  "Registre uma despesa de R$ 50,00 em Alimentação hoje",
  "session-123"
);

// Verificar tipo de resposta
if (response.result.action === 'transaction_created') {
  console.log('Transação criada:', response.result.transaction_id);
  console.log('Detalhes:', response.result.details);
} else if (response.result.action === 'general_response') {
  console.log('Resposta geral:', response.result.content);
}
```

**Response (200):**
```typescript
{
  result: {
    action: "transaction_created",
    message: "Transação registrada com sucesso",
    details: {
      type: "expense",
      description: "Compra no supermercado",
      value: 50.00,
      category: "Alimentação",
      payment_method: "PIX",
      date: "2025-01-15T14:30:00", // datetime com hora
      transaction_id: 123
    },
    transaction_id: 123
  },
  confidence: 0.95,
  processing_time: 1.2
}
```

**Erros:**
- `502`: Erro do provedor de IA
- `500`: Erro interno do servidor

---

## 📱 Endpoints de WhatsApp Connections

Permite vincular números de WhatsApp a organizações para receber mensagens do assistente financeiro via WhatsApp. Apenas o **owner** da organização pode vincular ou desvincular números.

### POST `/v1/whatsapp-connections`

Vincula um número de WhatsApp à organização. O número deve estar no formato E.164 (ex: `+5511999999999`).

**Request:**
```typescript
const linkWhatsAppPhone = async (
  organizationId: string,
  phoneNumber: string
): Promise<WhatsAppConnection> => {
  const response = await apiClient.post<WhatsAppConnection>(
    '/v1/whatsapp-connections',
    {
      organization_id: organizationId,
      phone_number: phoneNumber,
    }
  );
  return response.data;
};
```

**Response (201):**
```typescript
{
  id: string;
  user_id: string;
  organization_id: string;
  phone_number: string;
  is_active: boolean;
  connected_at: string;  // ISO 8601
}
```

**Erros:**
- `400`: Formato de telefone inválido (use E.164: +5511999999999)
- `403`: Acesso negado (apenas owner pode vincular)
- `409`: Número já vinculado a outra organização

---

### GET `/v1/whatsapp-connections`

Lista as conexões WhatsApp de uma organização. Owner ou member podem listar.

**Request:**
```typescript
const listWhatsAppConnections = async (
  organizationId: string
): Promise<ListWhatsAppConnectionsResponse> => {
  const response = await apiClient.get<ListWhatsAppConnectionsResponse>(
    `/v1/whatsapp-connections?organization_id=${organizationId}`
  );
  return response.data;
};
```

**Response (200):**
```typescript
{
  total: number;
  connections: WhatsAppConnection[];
}
```

**Erros:**
- `400`: organization_id obrigatório
- `403`: Acesso negado à organização

---

### DELETE `/v1/whatsapp-connections/{connection_id}`

Desvincula (desativa) uma conexão WhatsApp. Apenas owner pode desvincular.

**Request:**
```typescript
const unlinkWhatsAppPhone = async (
  connectionId: string
): Promise<void> => {
  await apiClient.delete(`/v1/whatsapp-connections/${connectionId}`);
};
```

**Response (204):** Sem conteúdo

**Erros:**
- `403`: Acesso negado (apenas owner pode desvincular)
- `404`: Conexão não encontrada

---

### Webhook WhatsApp (referência para configuração)

O backend recebe mensagens via webhook da Evolution API. Configure a URL no painel da Evolution API:

```
https://seu-backend.com/v1/webhooks/whatsapp?token=SEU_WEBHOOK_TOKEN
```

- **Token:** Configure `WEBHOOK_TOKEN` no `.env` e use o mesmo valor na URL
- **Método:** POST (Evolution API envia eventos)
- **Resposta:** O backend retorna 200 imediatamente e processa em background

---

## ⚠️ Tratamento de Erros

### Estrutura de Erro Padrão

Todos os erros seguem este formato:

```typescript
{
  detail: "Mensagem de erro descritiva"
}
```

### Códigos de Status HTTP

- `200`: Sucesso
- `201`: Criado com sucesso
- `204`: Sucesso sem conteúdo
- `400`: Requisição inválida (dados inválidos, validação)
- `401`: Não autenticado (token inválido ou ausente)
- `403`: Não autorizado (sem permissão)
- `404`: Recurso não encontrado
- `422`: Erro de validação ou regra de negócio
- `500`: Erro interno do servidor
- `502`: Erro do provedor de IA

### Função de Tratamento de Erros

```typescript
// utils/errorHandler.ts
import { AxiosError } from 'axios';
import { ApiError } from '../types/api';

export const handleApiError = (error: unknown): string => {
  if (error instanceof AxiosError) {
    const apiError = error.response?.data as ApiError;
    return apiError?.detail || error.message || 'Erro desconhecido';
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'Erro desconhecido';
};

// Uso em componentes
try {
  await createTransaction(data);
} catch (error) {
  const errorMessage = handleApiError(error);
  setError(errorMessage);
}
```

---

## 📚 Exemplos de Uso

### Funções de API para Tags

```typescript
// api/tags.ts
import apiClient from './client';
import { TagTypesResponse, TagsResponse, Tag, CreateTagRequest, UpdateTagRequest } from '../types/api';

export const listTagTypes = async (): Promise<TagTypesResponse> => {
  const response = await apiClient.get<TagTypesResponse>('/v1/tag-types');
  return response.data;
};

export const listTags = async (
  organizationId: string,
  tagType?: string
): Promise<TagsResponse> => {
  const response = await apiClient.get<TagsResponse>('/v1/tags', {
    params: {
      organization_id: organizationId,
      tag_type: tagType,
    },
  });
  return response.data;
};

export const createTag = async (
  organizationId: string,
  tag: CreateTagRequest
): Promise<Tag> => {
  const response = await apiClient.post<Tag>(
    '/v1/tags',
    tag,
    {
      params: {
        organization_id: organizationId,
      },
    }
  );
  return response.data;
};

export const updateTag = async (
  tagId: string,
  tag: UpdateTagRequest
): Promise<Tag> => {
  const response = await apiClient.patch<Tag>(
    `/v1/tags/${tagId}`,
    tag
  );
  return response.data;
};

export const deleteTag = async (tagId: string): Promise<void> => {
  await apiClient.delete(`/v1/tags/${tagId}`);
};
```

### Funções de API para Cartões de Crédito

```typescript
// api/creditCards.ts
import apiClient from './client';
import { CreditCard, CreateCreditCardRequest, InvoiceResponse } from '../types/api';

export const listCreditCards = async (
  organizationId: string
): Promise<CreditCard[]> => {
  const response = await apiClient.get<CreditCard[]>('/v1/credit-cards', {
    params: { organization_id: organizationId },
  });
  return response.data;
};

export const createCreditCard = async (
  card: CreateCreditCardRequest
): Promise<CreditCard> => {
  const response = await apiClient.post<CreditCard>(
    '/v1/credit-cards',
    card
  );
  return response.data;
};

export const getCreditCardInvoice = async (
  cardId: number,
  year: number,
  month: number,
  organizationId: string
): Promise<InvoiceResponse> => {
  const response = await apiClient.get<InvoiceResponse>(
    `/v1/credit-cards/${cardId}/invoices/${year}/${month}`,
    {
      params: { organization_id: organizationId },
    }
  );
  return response.data;
};
```

### Funções de API para WhatsApp Connections

```typescript
// api/whatsappConnections.ts
import apiClient from './client';
import {
  WhatsAppConnection,
  CreateWhatsAppConnectionRequest,
  ListWhatsAppConnectionsResponse,
} from '../types/api';

export const linkWhatsAppPhone = async (
  data: CreateWhatsAppConnectionRequest
): Promise<WhatsAppConnection> => {
  const response = await apiClient.post<WhatsAppConnection>(
    '/v1/whatsapp-connections',
    data
  );
  return response.data;
};

export const listWhatsAppConnections = async (
  organizationId: string
): Promise<ListWhatsAppConnectionsResponse> => {
  const response = await apiClient.get<ListWhatsAppConnectionsResponse>(
    '/v1/whatsapp-connections',
    { params: { organization_id: organizationId } }
  );
  return response.data;
};

export const unlinkWhatsAppPhone = async (
  connectionId: string
): Promise<void> => {
  await apiClient.delete(`/v1/whatsapp-connections/${connectionId}`);
};
```

### Hook Customizado para Autenticação

```typescript
// hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { login, getCurrentUser, LoginResponse, User } from '../auth';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        // Não autenticado
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const signIn = async (email: string, password: string) => {
    const response = await login(email, password);
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    return response;
  };

  const signOut = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  return {
    user,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!user,
  };
};
```

### Hook para Organizações

```typescript
// hooks/useOrganizations.ts
import { useState, useEffect } from 'react';
import { getMyOrganizations, MyOrganizationsResponse } from '../organizations';

export const useOrganizations = () => {
  const [organizations, setOrganizations] = useState<MyOrganizationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        setLoading(true);
        const data = await getMyOrganizations();
        setOrganizations(data);
        setError(null);
      } catch (err) {
        setError(handleApiError(err));
      } finally {
        setLoading(false);
      }
    };

    loadOrganizations();
  }, []);

  return { organizations, loading, error };
};
```

### Hook para Metas (Goals)

```typescript
// hooks/useGoals.ts
import { useState, useEffect } from 'react';
import { listGoals, createGoal, updateGoal, Goal, CreateGoalRequest, UpdateGoalRequest } from '../api/goals';
import { handleApiError } from '../utils/errorHandler';

export const useGoals = (organizationId: string) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const data = await listGoals(organizationId);
      setGoals(data);
      setError(null);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchGoals();
    }
  }, [organizationId]);

  const addGoal = async (data: CreateGoalRequest) => {
    try {
      const newGoal = await createGoal(data);
      setGoals((prev) => [...prev, newGoal]);
      return newGoal;
    } catch (err) {
      throw new Error(handleApiError(err));
    }
  };

  const editGoal = async (goalId: string, data: UpdateGoalRequest) => {
    try {
      const updatedGoal = await updateGoal(goalId, organizationId, data);
      setGoals((prev) => prev.map((g) => (g.id === goalId ? updatedGoal : g)));
      return updatedGoal;
    } catch (err) {
      throw new Error(handleApiError(err));
    }
  };

  return { goals, loading, error, fetchGoals, addGoal, editGoal };
};
```

### Componente de Listagem de Transações

```typescript
// components/TransactionList.tsx
import { useState, useEffect } from 'react';
import { listTransactions, Transaction } from '../api/transactions';
import { handleApiError } from '../utils/errorHandler';

interface TransactionListProps {
  organizationId: string;
}

export const TransactionList: React.FC<TransactionListProps> = ({ organizationId }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    type: undefined as 'income' | 'expense' | undefined,
    category: undefined as string | undefined,
  });

  useEffect(() => {
    const loadTransactions = async () => {
      try {
        setLoading(true);
        // Buscar transações paginadas da organização
        const result = await listTransactions({
          organization_id: organizationId,
          ...filters,
          page: 1,
          limit: 20
        });
        setTransactions(result.data);
        setError(null);
      } catch (err) {
        setError(handleApiError(err));
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [organizationId, filters]);

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error}</div>;

  return (
    <div>
      <h2>Transações</h2>
      <div>
        <select
          value={filters.type || ''}
          onChange={(e) =>
            setFilters({ ...filters, type: e.target.value as 'income' | 'expense' | undefined })
          }
        >
          <option value="">Todos os tipos</option>
          <option value="income">Receita</option>
          <option value="expense">Despesa</option>
        </select>
      </div>
      <ul>
        {transactions.map((tx) => (
          <li key={tx.id}>
            {tx.description} - R$ {tx.value.toFixed(2)} ({tx.category})
          </li>
        ))}
      </ul>
    </div>
  );
};
```

### Componente de Criação de Transação com Tags

```typescript
// components/CreateTransactionForm.tsx
import { useState, useEffect } from 'react';
import { createTransaction, CreateTransactionRequest } from '../api/transactions';
import { listTags, listTagTypes, Tag, TagType } from '../api/tags';
import { handleApiError } from '../utils/errorHandler';

interface CreateTransactionFormProps {
  organizationId: string;
  onSuccess?: () => void;
}

export const CreateTransactionForm: React.FC<CreateTransactionFormProps> = ({
  organizationId,
  onSuccess,
}) => {
  const [tagTypes, setTagTypes] = useState<TagType[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar tipos de tags e tags disponíveis
  useEffect(() => {
    const loadData = async () => {
      try {
        const [tagTypesRes, tagsRes] = await Promise.all([
          listTagTypes(),
          listTags(organizationId),
        ]);
        setTagTypes(tagTypesRes.tag_types);
        setTags(tagsRes.tags);
      } catch (err) {
        setError(handleApiError(err));
      }
    };
    loadData();
  }, [organizationId]);

  // Agrupar tags por tipo
  const tagsByType = tagTypes.reduce((acc, tagType) => {
    acc[tagType.id] = tags.filter((tag) => tag.tag_type.id === tagType.id);
    return acc;
  }, {} as Record<string, Tag[]>);

  // Validar tags selecionadas
  const validateTags = (): boolean => {
    // Verificar se todos os tipos obrigatórios estão presentes
    const requiredTypes = tagTypes.filter((tt) => tt.is_required);
    for (const requiredType of requiredTypes) {
      const hasTagOfType = selectedTagIds.some((tagId) => {
        const tag = tags.find((t) => t.id === tagId);
        return tag?.tag_type.id === requiredType.id;
      });
      if (!hasTagOfType) {
        setError(`É obrigatório selecionar pelo menos uma tag do tipo "${requiredType.name}"`);
        return false;
      }
    }

    // Verificar limites por tipo
    for (const tagType of tagTypes) {
      if (tagType.max_per_transaction !== null) {
        const count = selectedTagIds.filter((tagId) => {
          const tag = tags.find((t) => t.id === tagId);
          return tag?.tag_type.id === tagType.id;
        }).length;
        if (count > tagType.max_per_transaction) {
          setError(
            `Você pode selecionar no máximo ${tagType.max_per_transaction} tag(s) do tipo "${tagType.name}"`
          );
          return false;
        }
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!validateTags()) {
      return;
    }

    const formData = new FormData(e.currentTarget);
    const transactionData: CreateTransactionRequest = {
      organization_id: organizationId,
      type: formData.get('type') as 'income' | 'expense',
      description: formData.get('description') as string,
      tag_ids: selectedTagIds,
      value: parseFloat(formData.get('value') as string),
      payment_method: formData.get('payment_method') as string,
      date: formData.get('date') as string,
    };

    try {
      setLoading(true);
      await createTransaction(transactionData);
      onSuccess?.();
      // Reset form
      e.currentTarget.reset();
      setSelectedTagIds([]);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Criar Transação</h2>
      {error && <div style={{ color: 'red' }}>{error}</div>}

      <div>
        <label>Tipo:</label>
        <select name="type" required>
          <option value="expense">Despesa</option>
          <option value="income">Receita</option>
        </select>
      </div>

      <div>
        <label>Descrição:</label>
        <input type="text" name="description" required />
      </div>

      <div>
        <label>Valor:</label>
        <input type="number" step="0.01" name="value" required />
      </div>

      <div>
        <label>Método de Pagamento:</label>
        <input type="text" name="payment_method" required />
      </div>

      <div>
        <label>Data e Hora:</label>
        <input type="datetime-local" name="date" required step="60" />
        <small>Formato: YYYY-MM-DDTHH:MM (granularidade de minutos)</small>
      </div>

      {/* Seleção de Tags por Tipo */}
      {tagTypes.map((tagType) => (
        <div key={tagType.id}>
          <label>
            {tagType.name}
            {tagType.is_required && <span style={{ color: 'red' }}> *</span>}
            {tagType.max_per_transaction && (
              <span> (máx. {tagType.max_per_transaction})</span>
            )}
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {tagsByType[tagType.id]?.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  style={{
                    padding: '4px 12px',
                    border: `2px solid ${isSelected ? tag.color || '#007bff' : '#ccc'}`,
                    backgroundColor: isSelected ? tag.color || '#007bff' : 'white',
                    color: isSelected ? 'white' : 'black',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <button type="submit" disabled={loading}>
        {loading ? 'Criando...' : 'Criar Transação'}
      </button>
    </form>
  );
};
```

### Hook para Tags

```typescript
// hooks/useTags.ts
import { useState, useEffect } from 'react';
import { listTags, listTagTypes, Tag, TagType } from '../api/tags';
import { handleApiError } from '../utils/errorHandler';

export const useTags = (organizationId: string) => {
  const [tagTypes, setTagTypes] = useState<TagType[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTags = async () => {
      try {
        setLoading(true);
        const [tagTypesRes, tagsRes] = await Promise.all([
          listTagTypes(),
          listTags(organizationId),
        ]);
        setTagTypes(tagTypesRes.tag_types);
        setTags(tagsRes.tags);
        setError(null);
      } catch (err) {
        setError(handleApiError(err));
      } finally {
        setLoading(false);
      }
    };

    if (organizationId) {
      loadTags();
    }
  }, [organizationId]);

  // Agrupar tags por tipo
  const tagsByType = tagTypes.reduce((acc, tagType) => {
    acc[tagType.name] = tags.filter((tag) => tag.tag_type.name === tagType.name);
    return acc;
  }, {} as Record<string, Tag[]>);

  return {
    tagTypes,
    tags,
    tagsByType,
    loading,
    error,
  };
};
```

---

## 🔮 Planejamento Futuro (Credit Cards)

### GET `/v1/credit-cards/{card_id}/future-commitments`

Retorna uma visão consolidada dos compromissos futuros de um cartão específico.

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `organization_id` | UUID | Sim | - | ID da organização |
| `months` | integer | Não | 6 | Número de meses futuros (1-12) |

**Request:**

```typescript
const getFutureCommitments = async (
  cardId: number,
  organizationId: string,
  months: number = 6
): Promise<FutureCommitmentsResponse> => {
  const response = await apiClient.get<FutureCommitmentsResponse>(
    `/v1/credit-cards/${cardId}/future-commitments`,
    {
      params: { organization_id: organizationId, months }
    }
  );
  return response.data;
};
```

**Response (200):**

```typescript
interface FutureCommitmentsResponse {
  card_id: number;
  card_name: string;
  card_last4: string;
  credit_limit: number | null;
  current_available_limit: number | null;
  
  summary: {
    total_committed: number;
    average_monthly: number;
    lowest_month: MonthSummary | null;
    highest_month: MonthSummary | null;
  };
  
  monthly_breakdown: MonthlyBreakdown[];
  ending_soon: EndingInstallment[];
  insights: Insight[];
}

interface MonthSummary {
  year: number;
  month: number;
  month_name: string;  // "janeiro", "fevereiro", etc.
  amount: number;
}

interface MonthlyBreakdown {
  year: number;
  month: number;
  month_name: string;
  total_amount: number;
  limit_usage_percent: number | null;
  installments_count: number;
  top_installments: InstallmentItem[];
}

interface InstallmentItem {
  description: string;
  amount: number;
  installment_number: number;
  total_installments: number;
  category_name: string | null;
  category_color: string | null;
}

interface EndingInstallment {
  description: string;
  purchase_date: string;  // YYYY-MM-DD
  total_value: number;
  monthly_amount: number;
  total_installments: number;
  remaining_installments: number;
  last_installment_date: string;  // YYYY-MM-DD
  last_installment_month: string;  // "abril 2026"
  category_name: string | null;
}

interface Insight {
  type: "ending_commitment" | "best_month" | "limit_warning" | "decreasing_trend" | "no_commitments";
  icon: string;  // Material icon name
  message: string;
}
```

**Campos Calculados:**

| Campo | Descrição |
|-------|-----------|
| `summary.total_committed` | Soma de `total_amount` de todos os meses |
| `summary.average_monthly` | `total_committed / months` |
| `limit_usage_percent` | `(total_amount / credit_limit) * 100` |
| `remaining_installments` | Parcelas restantes a partir do mês atual |
| `ending_soon` | Compras que terminam nos próximos 6 meses (máx. 5 itens) |

**Erros:**

- `403`: Usuário não tem acesso à organização
- `404`: Cartão não encontrado

---

### GET `/v1/credit-cards/consolidated-commitments`

Retorna uma visão consolidada de TODOS os cartões da organização.

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `organization_id` | UUID | Sim | - | ID da organização |
| `months` | integer | Não | 6 | Número de meses futuros (1-12) |

**Request:**

```typescript
const getConsolidatedCommitments = async (
  organizationId: string,
  months: number = 6
): Promise<ConsolidatedCommitmentsResponse> => {
  const response = await apiClient.get<ConsolidatedCommitmentsResponse>(
    `/v1/credit-cards/consolidated-commitments`,
    {
      params: { organization_id: organizationId, months }
    }
  );
  return response.data;
};
```

**Response (200):**

```typescript
interface ConsolidatedCommitmentsResponse {
  organization_id: string;
  total_cards: number;
  total_credit_limit: number;
  total_available_limit: number;
  
  summary: {
    total_committed_all_cards: number;
    average_monthly_all_cards: number;
    lowest_month: MonthSummary | null;
    highest_month: MonthSummary | null;
  };
  
  by_card: CardCommitmentSummary[];
  monthly_total: MonthlyTotal[];
  ending_soon_all_cards: EndingInstallmentAllCards[];
  global_insights: Insight[];
}

interface CardCommitmentSummary {
  card_id: number;
  card_name: string;
  card_last4: string;
  credit_limit: number | null;
  total_committed: number;
  percentage_of_total: number;  // % do total de todos os cartões
}

interface MonthlyTotal {
  year: number;
  month: number;
  month_name: string;
  total_amount: number;
  by_card: { card_id: number; card_name: string; amount: number }[];
}

interface EndingInstallmentAllCards {
  card_id: number;
  card_name: string;
  description: string;
  monthly_amount: number;
  remaining_installments: number;
  last_installment_month: string;
}
```

**Campos Calculados:**

| Campo | Descrição |
|-------|-----------|
| `total_credit_limit` | Soma de `credit_limit` de todos os cartões |
| `total_available_limit` | Soma de `available_limit` de todos os cartões |
| `percentage_of_total` | `(card_total / total_committed_all_cards) * 100` |

**Erros:**

- `403`: Usuário não tem acesso à organização

**Tipos de Insights Gerados:**

| Tipo | Ícone | Quando aparece |
|------|-------|----------------|
| `ending_commitment` | `trending_down` | Parcela termina nos próximos 3 meses |
| `best_month` | `lightbulb` | Sempre (mês com menor compromisso) |
| `no_commitments` | `check_circle` | Algum mês sem compromissos |
| `limit_warning` | `warning` | Uso do limite > 50% em algum mês |
| `decreasing_trend` | `trending_down` | Compromissos diminuem ao longo dos meses |
| `card_distribution` | `pie_chart` | Mostra distribuição de compromissos por cartão |
| `total_reduction` | `trending_down` | Redução nos compromissos totais |
| `best_card_for_purchase` | `credit_card` | Cartão com mais limite disponível |

---

## 🔗 Links Úteis

- **Swagger/OpenAPI**: Acesse `http://localhost:8000/docs` ou `https://api.fincla.com/docs` para documentação interativa
- **Health Check**: `GET /health` - Verifica se a API está online (não versionado)
- **Ping**: `GET /ping` - Endpoint simples de teste (não versionado)

---

## 📝 Notas Importantes

1. **Versionamento**: Todos os endpoints da API utilizam o prefixo `/v1`. A base URL completa é `https://api.fincla.com/v1`
2. **Multi-tenancy**: Todos os endpoints (exceto auth e registro público) requerem `organization_id` explícito
3. **Autenticação**: Token JWT deve ser incluído em todos os headers (exceto login/registro)
4. **Validação**: A API valida automaticamente os dados e retorna erros descritivos
5. **Datas**: Use formato ISO datetime (YYYY-MM-DDTHH:MM ou YYYY-MM-DDTHH:MM:SS) para campos de data/hora. 
   - O campo `date` das transações suporta granularidade de minutos
   - Exemplos: `"2025-12-09T14:30"` ou `"2025-12-09T14:30:00"`
   - Para apenas data (sem hora), use `"2025-12-09"` (será convertido para `2025-12-09T00:00:00`)
6. **Valores**: Use números (não strings) para valores monetários
7. **UUIDs**: Todos os IDs de organização e usuário são UUIDs (strings)
8. **Sistema de Tags**:
   - Todas as transações **devem** ter pelo menos uma tag do tipo obrigatório (geralmente "categoria")
   - Cada tipo de tag pode ter um limite máximo por transação (`max_per_transaction`)
   - Tags são agrupadas por tipo na resposta de transações (`tags: { "categoria": [...], "projeto": [...] }`)
   - Tags podem ser criadas, atualizadas e removidas (soft delete) por organização
   - O campo `category` nas transações é legado e será removido no futuro - use `tag_ids` em vez disso

---

**Última atualização**: Janeiro 2026 (v1 API)

