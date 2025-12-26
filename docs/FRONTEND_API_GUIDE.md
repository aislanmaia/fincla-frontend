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
    13. [Endpoints de Chat/AI](#endpoints-de-chatai)
    14. [Tratamento de Erros](#tratamento-de-erros)
    15. [Exemplos de Uso](#exemplos-de-uso)

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
  type?: 'income' | 'expense';
  category?: string;
  payment_method?: string;
  description?: string;
  date_start?: string; // ISO date string
  date_end?: string; // ISO date string
  value_min?: number;
  value_max?: number;
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

Lista transações com filtros opcionais. Retorna todas as transações das organizações onde o usuário tem membership.

**Nota**: Atualmente, o endpoint retorna transações de todas as organizações do usuário. Para filtrar por organização específica, use os filtros de categoria, tipo, etc. ou filtre no frontend.

**Request:**
```typescript
const listTransactions = async (
  filters?: {
    type?: 'income' | 'expense';
    category?: string;
    payment_method?: string;
    description?: string;
    date_start?: string; // ISO date string (YYYY-MM-DD)
    date_end?: string; // ISO date string (YYYY-MM-DD)
    value_min?: number;
    value_max?: number;
  }
): Promise<Transaction[]> => {
  const response = await apiClient.get<Transaction[]>(
    '/v1/transactions',
    { params: filters }
  );
  return response.data;
};
```

**Exemplos de Uso:**
```typescript
// Listar todas as transações do usuário (todas as organizações)
await listTransactions();

// Filtrar por tipo
await listTransactions({ type: 'expense' });

// Filtrar por categoria
await listTransactions({ category: 'Alimentação' });

// Filtrar por período
await listTransactions({
  date_start: '2025-01-01',
  date_end: '2025-01-31',
});

// Filtrar por valor
await listTransactions({
  value_min: 100,
  value_max: 1000,
});

// Múltiplos filtros
await listTransactions({
  type: 'expense',
  category: 'Alimentação',
  date_start: '2025-01-01',
  date_end: '2025-01-31',
  value_min: 50,
});

// Filtrar no frontend por organização específica
const allTransactions = await listTransactions();
const orgTransactions = allTransactions.filter(
  (tx) => tx.organization_id === organizationId
);
```

**Response (200):**
```typescript
[
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
    date: "2025-01-15",
    category: "Alimentação" // Campo legado - mantido para compatibilidade
  }
]
```

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
  brand: "Visa",
  due_day: 10,
  description: "Cartão principal",
});
```

**Response (201):**
```typescript
{
  id: 1,
  organization_id: "123e4567-e89b-12d3-a456-426614174000",
  last4: "1234",
  brand: "Visa",
  due_day: 10,
  description: "Cartão principal"
}
```

**Erros:**
- `400`: Dados inválidos
- `403`: Usuário não tem acesso à organização
- `422`: Cartão duplicado (mesmo last4 e brand na mesma organização)

---

### GET `/v1/credit-cards`

Lista todos os cartões de uma organização.

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
    brand: "Visa",
    due_day: 10,
    description: "Cartão principal"
  }
]
```

---

### GET `/v1/credit-cards/{card_id}`

Obtém um cartão específico.

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

**Erros:**
- `403`: Usuário não tem acesso à organização
- `404`: Cartão não encontrado

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

Obtém a fatura de um cartão de crédito para um mês específico.

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
  month: "Janeiro",
  due_date: "2025-01-10",
  total_amount: 1500.00,
  status: "open",
  items: [
    {
      id: 123,
      transaction_date: "2025-01-05",
      description: "Compra Parcelada",
      amount: 100.00,
      installment_number: 1,
      total_installments: 10,
      tags: {
        "categoria": [
          {
            id: "...",
            name: "Eletrônicos",
            // ...
          }
        ]
      }
    }
  ]
}
```

**Erros:**
- `403`: Usuário não tem acesso à organização
- `404`: Cartão não encontrado

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
        // Buscar todas as transações e filtrar por organização no frontend
        const allTransactions = await listTransactions(filters);
        const orgTransactions = allTransactions.filter(
          (tx) => tx.organization_id === organizationId
        );
        setTransactions(orgTransactions);
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

**Última atualização**: Dezembro 2025 (v1 API)

