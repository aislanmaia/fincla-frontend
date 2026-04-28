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
13. [Endpoints de Orçamentos (Budgets)](#endpoints-de-orçamentos-budgets)
14. [Endpoints de Transações Recorrentes (Legado)](#endpoints-de-transações-recorrentes)
15. [Endpoints de Séries Recorrentes (Novo)](#endpoints-de-séries-recorrentes-novo-modelo)
16. [Endpoints de Analytics](#endpoints-de-analytics)
16. [Endpoints de Notificações](#endpoints-de-notificações)
17. [Endpoints da Área do Consultor](#endpoints-da-área-do-consultor)
18. [Endpoints de Simulação Financeira](#endpoints-de-simulação-financeira)
19. [Endpoints de Chat/AI](#endpoints-de-chatai)
20. [Endpoints de WhatsApp Connections](#endpoints-de-whatsapp-connections)
21. [Ferramentas de teste E2E](#ferramentas-de-teste-e2e)
22. [Tratamento de Erros](#tratamento-de-erros)
23. [Exemplos de Uso](#exemplos-de-uso)

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
  role: 'owner' | 'member' | 'consultant';  // consultant = plan consultant_basic/pro/premium
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;         // URL da foto de perfil
  phone: string | null;              // Telefone do usuário
  onboarding_completed: boolean;     // Se o onboarding foi concluído
  created_at: string;
  subscription?: {
    plan: 'free' | 'beta' | 'premium';
    status: 'active' | 'inactive';
    max_organizations: number;
    max_users_per_org: number;
    features: string[];
  };
}

export interface UpdateProfileRequest {
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  onboarding_completed?: boolean | null;
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
  org_type: string | null;           // Tipo da organização (ex: "personal", "business")
  monthly_income: number | null;     // Renda mensal declarada
  avatar_url: string | null;         // URL da foto/logo da organização
  created_at: string;
  updated_at: string | null;
}

export interface UpdateOrganizationRequest {
  name?: string | null;
  description?: string | null;
  org_type?: string | null;
  monthly_income?: number | null;
  avatar_url?: string | null;
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

// ===== CONSULTANT DASHBOARD =====
export interface ConsultantConsolidatedSummaryResponse {
  total_income: number;
  total_expenses: number;
  balance: number;
  total_transactions: number;
  organizations_count: number;
  period_start: string | null;
  period_end: string | null;
}

export interface ConsultantClient {
  organization_id: string;
  organization_name: string;
  role: 'owner' | 'member';
  membership_created_at: string;
}

export interface ListConsultantClientsResponse {
  total: number;
  clients: ConsultantClient[];
}

export interface FinancialHealthIndexResponse {
  index: number;
  balance_score: number;
  debt_score: number;
  reserve_score: number;
  total_income: number;
  total_expenses: number;
  balance: number;
  total_debt: number;
  organizations_count: number;
  period_start: string;
  period_end: string;
  formula_info: string;
}

export interface ActiveGoalsCountResponse {
  active_goals_count: number;
  organizations_count: number;
  as_of_date: string;
}

export interface TotalCreditCardDebtResponse {
  total_debt: number;
  organizations_count: number;
  as_of_date: string;
}

export interface MonthlyCashFlowItem {
  month: string;
  year: number;
  month_number: number;
  total_income: number;
  total_expenses: number;
  balance: number;
}

export interface CashFlowResponse {
  monthly_data: MonthlyCashFlowItem[];
  period_start: string;
  period_end: string;
}

export interface CategoryExpenseItem {
  name: string;
  total: number;
  percentage: number;
}

export interface ExpensesByCategoryResponse {
  categories: CategoryExpenseItem[];
  total_expenses: number;
  period_start: string;
  period_end: string;
}

export interface MonthlyIncomeCommitmentItem {
  month: string;
  year: number;
  month_number: number;
  income_commitment_percent: number;
  total_income: number;
  total_card_bills: number;
}

export interface IncomeCommitmentResponse {
  monthly_data: MonthlyIncomeCommitmentItem[];
  period_start: string;
  period_end: string;
}

export interface GoalProgressByTypeItem {
  goal_name: string;
  avg_progress: number;
  count: number;
}

export interface GoalsProgressByTypeResponse {
  by_type: GoalProgressByTypeItem[];
  organizations_count: number;
  as_of_date: string;
}

export interface ClientAtRiskItem {
  organization_id: string;
  organization_name: string;
  client_name: string;  // Owner name for display - use in Cliente column
  main_situation: string;
  current_balance: number;
  last_invoice_status: string;
  risk_score: number;
}

export interface ClientsAtRiskResponse {
  clients: ClientAtRiskItem[];
  total: number;
  as_of_date: string;
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
  sort_order: number;
  is_onboarding_highlight: boolean;
  icon_key: string | null;
  parent_category_tag_id: string | null;
}

export interface CreateTagRequest {
  name: string;
  tag_type_id: string;
  color?: string | null;
  sort_order?: number;
  is_onboarding_highlight?: boolean;
  icon_key?: string | null;
  parent_category_tag_id?: string | null;
}

export interface UpdateTagRequest {
  name: string;
  tag_type_id: string;
  color?: string | null;
  sort_order?: number;
  is_onboarding_highlight?: boolean;
  icon_key?: string | null;
  parent_category_tag_id?: string | null;
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
  status: 'pending' | 'completed' | 'cancelled'; // Status da transação
  recurring: boolean; // Whether this is a recurring transaction
  created_at: string; // ISO datetime string - timestamp when transaction was created
  updated_at: string; // ISO datetime string - timestamp when transaction was last updated
  credit_card_charge?: CreditCardChargeInfo | null; // Only present if payment_method is "credit_card"
  /** Parcelas no range de data (quando a transação aparece por causa do vencimento da parcela) */
  installment_info?: InstallmentInfo[] | null;
  // Campo legado - mantido para compatibilidade durante migração
  category?: string | null;
}

/** Info de parcela quando a transação aparece na lista por causa do vencimento no range */
export interface InstallmentInfo {
  installment_number: number;
  total_installments: number;
  due_date: string; // YYYY-MM-DD
  amount: number;
}

export type SortByField = 'date' | 'value' | 'type' | 'payment_method' | 'description' | 'category';
export type SortOrder = 'asc' | 'desc';

export interface ListTransactionsQuery {
  organization_id: string; // Required
  type?: 'income' | 'expense';
  category?: string;
  payment_method?: string;
  description?: string;
  status?: 'pending' | 'completed' | 'cancelled'; // Filtrar por status
  tag_id?: string; // Filtrar por tag UUID específica
  date_start?: string; // ISO date string (YYYY-MM-DD)
  date_end?: string; // ISO date string (YYYY-MM-DD)
  value_min?: number;
  value_max?: number;
  page?: number; // Page number (1-indexed, default: 1)
  limit?: number; // Items per page (default: 20, max: 100)
  sort_by?: SortByField; // Sort field (default: 'date'). For date with period filter, uses due_date when installment_info exists
  sort_order?: SortOrder; // Sort direction (default: 'desc')
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
  recurring?: boolean; // true = only recurring txs, false = only non-recurring
  /** Same semantics as GET /v1/transactions: filter by tag link (transaction_tags). */
  tag_id?: string;
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
  recurring: boolean | null;
  tag_id: string | null;
}

/** Projected recurring totals in the same window as date_start/date_end (active series only; not realized txs). */
export interface RecurringInPeriod {
  total_expense: number;
  total_income: number;
  period: {
    start_date: string; // YYYY-MM-DD
    end_date: string; // YYYY-MM-DD — may be capped to 24 months after start_date
  };
  series_count_expense?: number;
  series_count_income?: number;
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
  /** Present only when both date_start and date_end are sent and date_start <= date_end. Omitted when absent. */
  recurring_in_period?: RecurringInPeriod;
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

// ===== ORÇAMENTOS (BUDGETS) =====
export interface CreateBudgetRequest {
  tag_id: string;           // UUID da tag (categoria) associada ao orçamento
  amount: number;           // Valor limite do orçamento
  period_type?: string;     // "monthly" (padrão), "weekly", "yearly" ou "custom"
  start_date?: string | null; // YYYY-MM-DD (obrigatório se period_type="custom")
  end_date?: string | null;   // YYYY-MM-DD (obrigatório se period_type="custom")
}

export interface UpdateBudgetRequest {
  amount?: number | null;
  period_type?: string | null;
  is_active?: boolean | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface Budget {
  id: string;
  organization_id: string;
  tag_id: string;
  tag_name: string;
  tag_color: string | null;
  amount: number;
  period_type: string;
  is_active: boolean;
  spent_amount: number;        // Calculado: total gasto no período
  remaining_amount: number;    // Calculado: amount - spent_amount
  usage_percent: number;       // Porcentagem usada (0-100+)
  status: 'ok' | 'warning' | 'exceeded'; // ok < 80%, warning 80-100%, exceeded > 100%
  created_at: string;
  updated_at: string;
  start_date: string | null;
  end_date: string | null;
}

export interface BudgetsSummary {
  total_budgeted: number;
  total_spent: number;
  total_remaining: number;
  budgets_exceeded: number;
  budgets_warning: number;
  budgets_ok: number;
}

export interface BudgetListResponse {
  budgets: Budget[];
  summary: BudgetsSummary;
}

// ===== TRANSAÇÕES RECORRENTES =====
export interface CreateRecurringTransactionRequest {
  type: 'income' | 'expense';
  description: string;
  value: number;
  payment_method: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  start_date: string;          // YYYY-MM-DD
  tag_ids?: string[];
  day_of_month?: number | null; // 1-31 (para frequency="monthly")
  day_of_week?: number | null;  // 0=segunda, 6=domingo (para frequency="weekly")
  end_date?: string | null;     // YYYY-MM-DD
  credit_card_id?: number | null;
  notes?: string | null;
}

export interface UpdateRecurringTransactionRequest {
  description?: string | null;
  value?: number | null;
  payment_method?: string | null;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  day_of_month?: number | null;
  day_of_week?: number | null;
  end_date?: string | null;
  credit_card_id?: number | null;
  notes?: string | null;
  tag_ids?: string[] | null;
}

export interface RecurringTransaction {
  id: string;
  organization_id: string;
  type: 'income' | 'expense';
  description: string;
  value: number;
  payment_method: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  start_date: string;       // YYYY-MM-DD
  next_occurrence: string;  // YYYY-MM-DD - próxima data de geração
  is_active: boolean;
  tags: Array<{
    id: string;
    name: string;
    color: string | null;
    is_default: boolean;
    is_active: boolean;
    organization_id: string;
    tag_type: { id: string; name: string } | null;
  }>;
  day_of_month: number | null;
  day_of_week: number | null;
  end_date: string | null;
  credit_card_id: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringTransactionsSummary {
  total_monthly_income: number;
  total_monthly_expense: number;
  active_count: number;
  paused_count: number;
}

export interface RecurringTransactionListResponse {
  recurring_transactions: RecurringTransaction[];
  summary: RecurringTransactionsSummary;
}

export interface GenerateFromRecurringRequest {
  occurrence_date: string;     // YYYY-MM-DD - data em que a transação será gerada
  value_override?: number | null; // Substituir valor padrão nesta geração
}

export interface GenerateFromRecurringResponse {
  next_occurrence: string; // YYYY-MM-DD - nova próxima ocorrência após geração
}

// ===== ANALYTICS =====
export interface MonthDataPoint {
  year: number;
  month: number;
  month_name: string; // "janeiro", "fevereiro", etc.
  total_income: number;
  total_expenses: number;
  balance: number;
}

export interface MonthlyEvolutionResponse {
  months: MonthDataPoint[];
  period_start: string; // YYYY-MM-DD
  period_end: string;   // YYYY-MM-DD
}

export interface CategoryDataPoint {
  tag_id: string;
  tag_name: string;
  total: number;
  percentage: number;
  transaction_count: number;
  tag_color: string | null;
}

export interface ByCategoryResponse {
  categories: CategoryDataPoint[];
  total_amount: number;
  period_start: string;
  period_end: string;
}

export interface SpendingRhythmCategory {
  tag_id: string;
  tag_name: string;
  monthly_totals: number[];  // Um valor por mês, na mesma ordem de `months`
  average: number;
  trend: 'up' | 'down' | 'stable';
  tag_color: string | null;
}

export interface SpendingRhythmResponse {
  months: string[];                    // Nomes dos meses (ex: ["jan/2026", "fev/2026"])
  categories: SpendingRhythmCategory[];
  monthly_totals: number[];            // Total de gastos por mês
}

export interface PeriodSummary {
  start: string;
  end: string;
  total_income: number;
  total_expenses: number;
  balance: number;
}

export interface PeriodChanges {
  income_change_pct: number | null;   // null se período A não tem receita
  expenses_change_pct: number | null;
  balance_change_pct: number | null;
}

export interface PeriodComparisonResponse {
  period_a: PeriodSummary;
  period_b: PeriodSummary;
  changes: PeriodChanges;
}

// ===== NOTIFICAÇÕES =====
export interface Notification {
  id: string;
  type: string;           // ex: "goal_progress", "budget_exceeded", "recurring_generated"
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  organization_id: string | null;
  data: Record<string, unknown> | null; // Dados extras específicos por tipo
  read_at: string | null;
}

export interface NotificationListResponse {
  notifications: Notification[];
  unread_count: number;
  page: number;
  limit: number;
  total: number;
  pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// ===== CONTRIBUIÇÕES DE METAS =====
export interface CreateGoalContributionRequest {
  amount: number;              // Valor da contribuição (> 0)
  contributed_at?: string | null; // YYYY-MM-DD (default: hoje)
  note?: string | null;
}

export interface GoalContribution {
  id: string;
  goal_id: string;
  amount: number;
  contributed_at: string; // YYYY-MM-DD
  created_at: string;
  note: string | null;
}

export interface GoalContributionListResponse {
  contributions: GoalContribution[];
  total_contributed: number;
  page: number;
  limit: number;
  total: number;
  pages: number;
  has_next: boolean;
  has_prev: boolean;
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

### POST `/v1/auth/forgot-password`

Solicita envio do link de recuperação. A resposta é sempre a mesma para não vazar se o e-mail existe ou não.

**Request:**
```typescript
const forgotPassword = async (email: string): Promise<{ message: string }> => {
  const response = await apiClient.post<{ message: string }>('/v1/auth/forgot-password', {
    email,
  });
  return response.data;
};
```

**Response (200):**
```typescript
{
  message: "Se o e-mail existir, enviaremos um link de recuperação."
}
```

**Link no e-mail:** O backend monta o `href` apontando para a origem do app (`FRONTEND_BASE_URL` no servidor), com query na raiz: `?reset_token=<token>` (ex.: `https://app.exemplo.com/?reset_token=...`). O app lê esse parâmetro e chama `POST /v1/auth/reset-password` com o mesmo valor no campo `token`. Formatos alternativos aceitos pelo app ao interpretar a URL estão em [`docs/FRONTEND_AUTH_INVITE_LINKS.md`](FRONTEND_AUTH_INVITE_LINKS.md).

---

### POST `/v1/auth/reset-password`

Redefine a senha usando o token recebido por e-mail.

**Request:**
```typescript
const resetPassword = async (
  token: string,
  newPassword: string
): Promise<{ message: string }> => {
  const response = await apiClient.post<{ message: string }>('/v1/auth/reset-password', {
    token,
    new_password: newPassword,
  });
  return response.data;
};
```

**Response (200):**
```typescript
{
  message: "Senha redefinida com sucesso."
}
```

**Erros:**
- `400`: Nova senha não atende aos critérios de segurança
- `404`: Token inválido ou já utilizado
- `410`: Token expirado

---

### GET `/v1/auth/me`

Retorna informações do usuário autenticado.

**Campo `role`:** `"owner"` | `"member"` | `"consultant"`. Usuários com plano de consultoria (consultant_basic, consultant_pro, etc.) retornam `"consultant"` em vez de owner/member.

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
  first_name: "João" | null,
  last_name: "Silva" | null,
  avatar_url: string | null,
  phone: string | null,
  onboarding_completed: boolean,
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

Retorna o perfil do usuário autenticado (mesmo payload que `GET /v1/auth/me`). O campo `role` retorna `"consultant"` para usuários com plano de consultoria.

**Request:**
```typescript
const getMyProfile = async (): Promise<User> => {
  const response = await apiClient.get<User>('/v1/users/me');
  return response.data;
};
```

**Response (200):**
```typescript
{
  id: "123e4567-e89b-12d3-a456-426614174000",
  email: "joao@example.com",
  role: "owner" | "member" | "consultant",
  first_name: "João" | null,
  last_name: "Silva" | null,
  avatar_url: string | null,
  phone: string | null,
  onboarding_completed: boolean,
  created_at: "2025-01-09T10:00:00",
  subscription?: {
    plan: string;
    status: "active" | "inactive";
    max_organizations: number;
    max_users_per_org: number;
    features: string[];
  };
}
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

### PATCH `/v1/users/me`

Atualiza campos do perfil do usuário autenticado (partial update — envie apenas os campos a alterar).

**Request:**
```typescript
const updateMyProfile = async (
  data: UpdateProfileRequest
): Promise<User> => {
  const response = await apiClient.patch<User>('/v1/users/me', data);
  return response.data;
};
```

**Exemplo:**
```typescript
await updateMyProfile({
  first_name: "João",
  last_name: "Silva",
  avatar_url: "https://storage.example.com/avatars/user123.jpg",
  phone: "+5511999999999",
  onboarding_completed: true,
});
```

**Response (200):**
```typescript
{
  id: "123e4567-e89b-12d3-a456-426614174000",
  email: "joao@example.com",
  role: "owner",
  first_name: "João",
  last_name: "Silva",
  avatar_url: "https://storage.example.com/avatars/user123.jpg",
  phone: "+5511999999999",
  onboarding_completed: true
}
```

**Erros:**
- `400`: Dados inválidos
- `401`: Não autenticado

---

## 🏢 Endpoints de Organizações

**Contrato `org_type` (estável):** o backend **persiste e devolve sempre** um destes valores em inglês: `personal` | `couple` | `family` | `business`. No **POST** e **PATCH** também são aceitos **aliases em português** (ex.: `casal` → `couple`, `negocio` / `negócio` → `business`, `familia` / `família` → `family`, `pessoal` → `personal`). Valores legados `outro` / `other` são normalizados para `personal` (documentado para compatibilidade com onboarding antigo). Respostas de API trazem sempre o valor canônico.

### POST `/v1/organizations`

Cria uma nova organização (apenas owners). Opcionalmente define perfil (`org_type`, `monthly_income`, `avatar_url`) já na criação.

**Request:**
```typescript
type OrgTypeCanonical = "personal" | "couple" | "family" | "business";

interface CreateOrganizationBody {
  name: string;
  description?: string | null;
  org_type?: OrgTypeCanonical | string; // pode enviar alias PT; resposta vem canônica
  monthly_income?: number | string | null;
  avatar_url?: string | null;
}

const createOrganization = async (
  body: CreateOrganizationBody
): Promise<CreateOrganizationResponse> => {
  const response = await apiClient.post<CreateOrganizationResponse>(
    '/v1/organizations',
    body
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
    created_at: "2025-01-09T10:00:00",
    org_type: "couple",
    monthly_income: 5000.0,
    avatar_url: null,
    updated_at: "2025-01-09T10:00:00"
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

### GET `/v1/organizations/{org_id}`

Obtém os detalhes de uma organização.

**Request:**
```typescript
const getOrganization = async (orgId: string): Promise<Organization> => {
  const response = await apiClient.get<Organization>(`/v1/organizations/${orgId}`);
  return response.data;
};
```

**Response (200):**
```typescript
{
  id: "123e4567-e89b-12d3-a456-426614174000",
  name: "Minha Empresa",
  description: "Descrição da empresa",
  org_type: "business",
  monthly_income: 15000.00,
  avatar_url: "https://storage.example.com/logos/org123.jpg",
  created_at: "2025-01-09T10:00:00",
  updated_at: "2026-03-01T08:30:00"
}
```

**Erros:**
- `404`: Organização não encontrada

---

### PATCH `/v1/organizations/{org_id}`

Atualiza campos de uma organização (partial update — envie apenas os campos a alterar).

**Request:**
```typescript
const updateOrganization = async (
  orgId: string,
  data: UpdateOrganizationRequest
): Promise<Organization> => {
  const response = await apiClient.patch<Organization>(
    `/v1/organizations/${orgId}`,
    data
  );
  return response.data;
};
```

**Exemplo:**
```typescript
await updateOrganization("org-uuid", {
  name: "Nova Razão Social",
  org_type: "personal",
  monthly_income: 8000.00,
  avatar_url: "https://storage.example.com/logos/org_new.jpg",
});
```

**Response (200):**
```typescript
{
  id: "123e4567-e89b-12d3-a456-426614174000",
  name: "Nova Razão Social",
  description: "Descrição da empresa",
  org_type: "personal",
  monthly_income: 8000.00,
  avatar_url: "https://storage.example.com/logos/org_new.jpg",
  created_at: "2025-01-09T10:00:00",
  updated_at: "2026-03-22T14:00:00"
}
```

**Erros:**
- `400`: Dados inválidos
- `404`: Organização não encontrada

---

### POST `/v1/organizations/{org_id}/invitations`

Cria convites por e-mail para entrada na organização. Apenas owners da organização podem usar.

**Request:**
```typescript
const createOrganizationInvitations = async (
  organizationId: string,
  emails: string[]
): Promise<{ invitations: OrganizationInvitation[] }> => {
  const response = await apiClient.post<{ invitations: OrganizationInvitation[] }>(
    `/v1/organizations/${organizationId}/invitations`,
    { emails }
  );
  return response.data;
};
```

**Response (201):**
```typescript
interface OrganizationInvitation {
  id: string;
  email: string;
  organization_id: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  cancelled_at: string | null;
  last_sent_at: string | null;
}
```

**Erros:**
- `403`: Usuário não é owner da organização
- `404`: Organização não encontrada
- `409`: Já existe convite pendente para o e-mail

**Link no e-mail:** O `href` do convite (criação e reenvio) usa a origem do app (`FRONTEND_BASE_URL`) com `?invite_token=<token>` na raiz. O app extrai o token e chama `POST /v1/invitations/accept`. Outros formatos de URL aceitos pelo app estão em [`docs/FRONTEND_AUTH_INVITE_LINKS.md`](FRONTEND_AUTH_INVITE_LINKS.md).

---

### GET `/v1/organizations/{org_id}/invitations`

Lista os convites da organização para exibir pendentes, aceitos, cancelados ou expirados.

**Request:**
```typescript
const listOrganizationInvitations = async (
  organizationId: string
): Promise<{ total: number; invitations: OrganizationInvitation[] }> => {
  const response = await apiClient.get<{ total: number; invitations: OrganizationInvitation[] }>(
    `/v1/organizations/${organizationId}/invitations`
  );
  return response.data;
};
```

**Erros:**
- `403`: Usuário não é owner da organização
- `404`: Organização não encontrada

---

### POST `/v1/organizations/{org_id}/invitations/{invitation_id}/resend`

Reenvia um convite existente gerando novo token e nova expiração.

**Request:**
```typescript
const resendOrganizationInvitation = async (
  organizationId: string,
  invitationId: string
): Promise<{ invitation: OrganizationInvitation }> => {
  const response = await apiClient.post<{ invitation: OrganizationInvitation }>(
    `/v1/organizations/${organizationId}/invitations/${invitationId}/resend`
  );
  return response.data;
};
```

**Erros:**
- `403`: Usuário não é owner da organização
- `404`: Convite não encontrado
- `409`: Convite já aceito

---

### DELETE `/v1/organizations/{org_id}/invitations/{invitation_id}`

Cancela um convite pendente.

**Request:**
```typescript
const cancelOrganizationInvitation = async (
  organizationId: string,
  invitationId: string
): Promise<void> => {
  await apiClient.delete(
    `/v1/organizations/${organizationId}/invitations/${invitationId}`
  );
};
```

**Response (204):** Sem conteúdo

**Erros:**
- `403`: Usuário não é owner da organização
- `404`: Convite não encontrado
- `409`: Convite já aceito

---

### POST `/v1/invitations/accept`

Aceita um convite via token. Se o e-mail ainda não existe, o backend cria o usuário com plano `free`. Se já existir, apenas adiciona a membership na organização.

**Request:**
```typescript
const acceptInvitation = async (payload: {
  token: string;
  first_name?: string | null;
  last_name?: string | null;
  password: string;
}): Promise<{
  user: {
    id: string;
    email: string;
    role: string;
    first_name: string | null;
    last_name: string | null;
  };
  membership: {
    id: string;
    user_id: string;
    organization_id: string;
    role: "member";
    created_at: string;
  };
  invitation: OrganizationInvitation;
}> => {
  const response = await apiClient.post('/v1/invitations/accept', payload);
  return response.data;
};
```

**Erros:**
- `404`: Convite não encontrado
- `409`: Convite cancelado, já aceito ou usuário já pertence à organização
- `410`: Convite expirado

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

**Response (200):** O objeto `organization` usa o **mesmo formato** que `GET /v1/organizations/{org_id}` (inclui `description`, `org_type`, `monthly_income`, `avatar_url`, `updated_at`).

```typescript
{
  total: 2,
  organizations: [
    {
      organization: {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Minha Empresa",
        description: "Descrição da empresa",
        org_type: "business",
        monthly_income: 15000.0,
        avatar_url: "https://storage.example.com/logos/org123.jpg",
        created_at: "2025-01-09T10:00:00",
        updated_at: "2026-03-01T08:30:00"
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
      name: "Food & Groceries",
      tag_type: {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "categoria",
        description: "Categoria da transação",
        is_required: true,
        max_per_transaction: 1
      },
      color: "#059669",
      is_default: true,
      is_active: true,
      organization_id: "123e4567-e89b-12d3-a456-426614174000",
      sort_order: 0,
      is_onboarding_highlight: true,
      icon_key: "shopping-cart",
      parent_category_tag_id: null
    }
  ]
}
```

**Notas:**
- `sort_order`: inteiro não negativo; menor valor aparece primeiro na lista (empate: ordem alfabética por `name`).
- `is_onboarding_highlight`: indica destaque sugerido no onboarding (ex.: categorias iniciais).
- `icon_key`: identificador Lucide em kebab-case (ex.: `shopping-cart`); `null` para tags sem ícone ou para tipo `detalhe` sem ícone.
- `parent_category_tag_id`: para tags do tipo `detalhe`, UUID da categoria pai (tipo `categoria`); `null` para categorias e demais tipos.
- Ao criar uma organização, a API semeia **11 categorias canônicas em inglês** (ex.: `Food & Groceries`, `Transport`, `Income`) e filhos `detalhe` (ex.: `restaurant`, `fuel`). Esses nomes são **estáveis** no banco para o app combinar com ícones (`icon_key`) e com chaves de tradução.
- **i18n:** o backend **não** traduz `name` por `Accept-Language`. O valor de `name` é o que está persistido (inglês nas canônicas semeadas; tags criadas pelo usuário ou certos `detalhe` podem estar em PT ou outro idioma). Para UI localizada, mapeie no frontend — por exemplo usando `icon_key`, o `id` da tag, ou um dicionário indexado pelo nome canônico em inglês — e exiba o rótulo no idioma do app.
- **Dados legados / migração no servidor:** orgs antigas podem ter sido normalizadas fora da API (categorias legadas → canônicas EN; receitas antigas como `detalhe` sob `Income`). **Não** dependa de listas fixas de nomes em português no bundle do frontend; use **`GET /v1/tags`** e os UUIDs retornados nas transações/orçamentos como fonte da verdade.

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
  sort_order: 10, // Opcional; padrão 0
  is_onboarding_highlight: false, // Opcional; padrão false
  icon_key: "megaphone", // Opcional; kebab-case Lucide; omitir ou null para sem ícone
  parent_category_tag_id: null, // Obrigatório para tipo "detalhe": UUID da categoria pai
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
  organization_id: "123e4567-e89b-12d3-a456-426614174000",
  sort_order: 10,
  is_onboarding_highlight: false,
  icon_key: "megaphone",
  parent_category_tag_id: null
}
```

**Erros:**
- `400`: Dados inválidos, tag duplicada, `icon_key` inválido (não kebab-case), `parent_category_tag_id` inválido (pai inexistente, tipo errado, ou categoria com pai), ou regra de negócio violada
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
  sort_order: 3, // Opcional: omitir para manter o valor atual
  is_onboarding_highlight: true, // Opcional: omitir para manter o valor atual
  icon_key: "megaphone", // Opcional
  parent_category_tag_id: null, // Opcional; para detalhe, UUID do pai
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
  organization_id: "123e4567-e89b-12d3-a456-426614174000",
  sort_order: 3,
  is_onboarding_highlight: true,
  icon_key: "megaphone",
  parent_category_tag_id: null
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

**Comportamento com filtro de data (`date_start`/`date_end`):**
- **Transações normais** (pix, débito, etc.): filtradas por `transaction.date` (data da compra)
- **Transações de cartão de crédito**: incluídas quando **ao menos uma parcela** tem `due_date` no range. A transação original é retornada com `installment_info` contendo as parcelas cujo vencimento está no período. Use `installment_info[].amount` para exibir o valor da parcela e `installment_info[].due_date` para ordenação/exibição.

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
- `tag_id` (opcional): UUID da tag — retorna apenas transações vinculadas a essa tag (`transaction_tags`), em qualquer tipo (categoria, detalhe, etc.). Envie como query string (ex.: `?tag_id=uuid`).
- `payment_method` (opcional): Método de pagamento (valores canônicos: `credit_card`, `debit_card`, `pix`, `cash`, `bank_transfer`, `boleto`). A API aceita variações e normaliza.
- `description` (opcional): Busca parcial na descrição
- `date_start` (opcional): Data inicial (YYYY-MM-DD)
- `date_end` (opcional): Data final (YYYY-MM-DD)
- `value_min` (opcional): Valor mínimo
- `value_max` (opcional): Valor máximo
- `page` (opcional): Número da página (padrão: 1, mínimo: 1)
- `limit` (opcional): Itens por página (padrão: 20, mínimo: 1, máximo: 100)
- `sort_by` (opcional): Campo de ordenação. Valores: `date`, `value`, `type`, `payment_method`, `description`, `category`. Padrão: `date`. Quando `date` e há filtro de período com transações de cartão, usa `due_date` das parcelas automaticamente.
- `sort_order` (opcional): Direção da ordenação. Valores: `asc` | `desc`. Padrão: `desc`

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

// Ordenar por valor (maiores primeiro)
const byValue = await listTransactions({
  organization_id: orgId,
  sort_by: 'value',
  sort_order: 'desc',
  limit: 20
});

// Ordenar por data (mais antigas primeiro)
const byDateAsc = await listTransactions({
  organization_id: orgId,
  sort_by: 'date',
  sort_order: 'asc',
  limit: 20
});

// Ordenar por descrição (alfabético)
const byDescription = await listTransactions({
  organization_id: orgId,
  sort_by: 'description',
  sort_order: 'asc',
  limit: 20
});
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
      credit_card_charge: null,
      installment_info: null,
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

**Exemplo de transação com `installment_info` (cartão parcelado no range):**
```typescript
{
  id: 351,
  description: "Supermercado Assaí - compra do mês",
  value: 300.00,
  payment_method: "credit_card",
  date: "2026-01-10T13:05:00",
  credit_card_charge: { charge: {...}, card: {...} },
  installment_info: [
    { installment_number: 1, total_installments: 3, due_date: "2026-02-10", amount: 100.00 }
  ]
}
```

**Uso no frontend:**
```typescript
function displayTransaction(tx: Transaction) {
  const amount = tx.installment_info?.length
    ? tx.installment_info.reduce((s, i) => s + i.amount, 0)
    : tx.value;
  const label = tx.installment_info?.length
    ? `Parcela(s) ${tx.installment_info.map(i => `${i.installment_number}/${i.total_installments}`).join(", ")} • vence(m) ${tx.installment_info.map(i => i.due_date).join(", ")}`
    : formatDate(tx.date);
  return { amount, label };
}
// Editar: sempre usar tx.id (transação original)
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
- `payment_method` (opcional): Método de pagamento (valores canônicos: `credit_card`, `debit_card`, `pix`, `cash`, `bank_transfer`, `boleto`). A API aceita variações e normaliza.
- `description` (opcional): Busca parcial na descrição
- `date_start` (opcional): Data inicial (YYYY-MM-DD)
- `date_end` (opcional): Data final (YYYY-MM-DD)
- `value_min` (opcional): Valor mínimo
- `value_max` (opcional): Valor máximo
- `recurring` (opcional): `true` = só transações recorrentes; `false` = só não recorrentes
- `tag_id` (opcional): UUID da tag — mesma semântica de `GET /v1/transactions`: apenas transações vinculadas a essa tag em `transaction_tags`

**`recurring_in_period`:** quando **`date_start` e `date_end` estão presentes** e `date_start <= date_end`, a resposta inclui `recurring_in_period` com a **projeção** de receitas/despesas recorrentes (séries ativas) no mesmo intervalo — valor × número de ocorrências esperadas no calendário. Não é soma de linhas em `transactions`. Se apenas uma das datas for enviada, o campo **não** vem na resposta.

| Campo na raiz | Significado |
|---------------|-------------|
| `total_income` | Receitas **realizadas** (transações) no período filtrado |
| `total_expenses` | Despesas **realizadas** no período |
| `recurring_in_period.total_income` | **Projeção** de receitas recorrentes no intervalo |
| `recurring_in_period.total_expense` | **Projeção** de despesas recorrentes (“comprometido” no período) |

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
    date_end: "2025-01-31",
    recurring: null,
    tag_id: null
  },
  // Somente quando date_start e date_end válidos (inclusivos); omitido caso contrário
  recurring_in_period: {
    total_expense: 320.00,
    total_income: 0,
    period: { start_date: "2025-01-01", end_date: "2025-01-31" },
    series_count_expense: 2,
    series_count_income: 0
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
- `recurring_in_period` (opcional): projeção de recorrências no intervalo; ver tabela acima

**Notas:**
- Se não houver transações que atendem aos filtros, todos os valores numéricos serão `0`
- `total_value` é a soma dos valores absolutos (sem considerar sinal)
- `balance` pode ser negativo se as despesas forem maiores que as receitas
- `average_transaction` será `0` se não houver transações
- **Com filtros de data (`date_start` e/ou `date_end`):** transações de cartão de crédito são incluídas com base no **vencimento das parcelas** (`due_date`), não na data da compra. Cada parcela que vence no período conta como uma entrada separada no resumo.
- **`date_start` > `date_end`:** `422` com mensagem `date_start must be on or before date_end`.

**Erros:**
- `422`: Intervalo de datas inválido (`date_start` depois de `date_end`)
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

**Valores canônicos de `payment_method` (banco de dados):**
- `credit_card` - Cartão de crédito
- `debit_card` - Cartão de débito
- `pix` - PIX
- `cash` - Dinheiro
- `bank_transfer` - Transferência bancária (TED, DOC, etc.)
- `boleto` - Boleto bancário

A API aceita variações (ex: "PIX", "Cartão de Crédito", "Dinheiro") e normaliza para os valores canônicos.

**Campos de Cartão de Crédito:**
- Os campos `card_id`, `card_last4`, `modality` e `installments_count` só devem ser enviados quando `payment_method` for `credit_card` (ou "Cartão de Crédito")
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
- `422`: Campos de cartão só podem ser usados com `payment_method: "credit_card"` (ou "Cartão de Crédito")

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

### DELETE `/v1/goals/{goal_id}`

Remove uma meta financeira.

**Request:**
```typescript
const deleteGoal = async (
  goalId: string,
  organizationId: string
): Promise<void> => {
  await apiClient.delete(`/v1/goals/${goalId}`, {
    params: { organization_id: organizationId }
  });
};
```

**Response (204):** Sem conteúdo

**Erros:**
- `403`: Sem acesso à organização
- `404`: Meta não encontrada

---

### POST `/v1/goals/{goal_id}/contributions`

Registra uma contribuição para uma meta. O campo `current_amount` da meta é incrementado automaticamente.

**Request:**
```typescript
const contributeToGoal = async (
  goalId: string,
  organizationId: string,
  data: CreateGoalContributionRequest
): Promise<GoalContribution> => {
  const response = await apiClient.post<GoalContribution>(
    `/v1/goals/${goalId}/contributions`,
    data,
    { params: { organization_id: organizationId } }
  );
  return response.data;
};
```

**Exemplo:**
```typescript
await contributeToGoal("goal-uuid", "org-uuid", {
  amount: 500.00,
  contributed_at: "2026-03-22",
  note: "Salário de março"
});
```

**Response (201):**
```typescript
{
  id: "contrib-uuid",
  goal_id: "goal-uuid",
  amount: 500.00,
  contributed_at: "2026-03-22",
  created_at: "2026-03-22T10:00:00",
  note: "Salário de março"
}
```

**Erros:**
- `400`: Valor inválido, meta não ativa ou acesso negado
- `404`: Meta não encontrada

---

### GET `/v1/goals/{goal_id}/contributions`

Lista o histórico de contribuições de uma meta com paginação.

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `organization_id` | UUID | Sim | - | ID da organização |
| `page` | integer | Não | 1 | Página |
| `limit` | integer | Não | 20 | Itens por página |

**Request:**
```typescript
const listGoalContributions = async (
  goalId: string,
  organizationId: string,
  page = 1,
  limit = 20
): Promise<GoalContributionListResponse> => {
  const response = await apiClient.get<GoalContributionListResponse>(
    `/v1/goals/${goalId}/contributions`,
    { params: { organization_id: organizationId, page, limit } }
  );
  return response.data;
};
```

**Response (200):**
```typescript
{
  contributions: [
    {
      id: "contrib-uuid",
      goal_id: "goal-uuid",
      amount: 500.00,
      contributed_at: "2026-03-22",
      created_at: "2026-03-22T10:00:00",
      note: "Salário de março"
    }
  ],
  total_contributed: 3000.00,
  page: 1,
  limit: 20,
  total: 6,
  pages: 1,
  has_next: false,
  has_prev: false
}
```

---

## 💰 Endpoints de Orçamentos (Budgets)

Gerencie limites de gastos por categoria/tag e período. O sistema calcula automaticamente quanto foi gasto em relação ao orçamento definido.

### POST `/v1/budgets`

Cria um novo orçamento para uma tag/categoria.

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `organization_id` | UUID | Sim | ID da organização |

**Request:**
```typescript
const createBudget = async (
  organizationId: string,
  data: CreateBudgetRequest
): Promise<Budget> => {
  const response = await apiClient.post<Budget>('/v1/budgets', data, {
    params: { organization_id: organizationId }
  });
  return response.data;
};
```

**Exemplo:**
```typescript
await createBudget("org-uuid", {
  tag_id: "tag-uuid-alimentacao",
  amount: 1500.00,
  period_type: "monthly",
});
```

**Response (201):**
```typescript
{
  id: "budget-uuid",
  organization_id: "org-uuid",
  tag_id: "tag-uuid-alimentacao",
  tag_name: "Alimentação",
  tag_color: "#FF5722",
  amount: 1500.00,
  period_type: "monthly",
  is_active: true,
  spent_amount: 350.00,
  remaining_amount: 1150.00,
  usage_percent: 23.33,
  status: "ok",
  created_at: "2026-03-01T00:00:00",
  updated_at: "2026-03-01T00:00:00",
  start_date: null,
  end_date: null
}
```

**Erros:**
- `400`: Dados inválidos ou já existe orçamento ativo para essa tag

---

### POST `/v1/budgets/preview-transaction`

Preview do **impacto em orçamentos** para um rascunho de transação (sem persistir). Usar com **debounce** (ex.: 300–400 ms) ao mudar valor, categoria ou data no modal Nova transação.

**Request body:**
```typescript
interface PreviewTransactionRequest {
  organization_id: string;
  type: 'expense' | 'income';
  value: number; // > 0
  tag_id: string | null;
  date: string; // YYYY-MM-DD — define o mês/ano do orçamento mensal de referência
  payment_method?: string | null;
  installments_count?: number | null;
  card_id?: number | null; // reservado; v1 não altera cálculo
}

interface PreviewTransactionResponse {
  category: {
    tag_id: string | null;
    tag_name: string | null;
    budget_amount: string | null;
    spent_before: string;
    spent_after: string;
    usage_percent_before: number | null;
    usage_percent_after: number | null;
    remaining_before: string | null;
    remaining_after: string | null;
  };
  budgets_summary: {
    total_budgeted: string;
    total_spent_before: string;
    total_spent_after: string;
    total_remaining_after: string;
    percent_of_total_budget_after: number | null;
  };
  month_projection: {
    projected_total_expenses_end_of_month: string;
    projected_percent_of_budget: number | null;
    label_context: string; // ex.: "monthly_budget"
  } | null;
}

const previewTransactionImpact = async (
  body: PreviewTransactionRequest
): Promise<PreviewTransactionResponse> => {
  const response = await apiClient.post<PreviewTransactionResponse>(
    '/v1/budgets/preview-transaction',
    body
  );
  return response.data;
};
```

**Comportamento resumido:**
- `category`: gasto na tag no período do orçamento (`monthly`/`yearly`) que contém `date`; `spent_after` inclui o valor hipotético se `type === 'expense'`.
- `budgets_summary`: mesma ideia do `GET /v1/budgets` → `total_spent_after` só aumenta se houver orçamento ativo para `tag_id` e a transação for despesa.
- `month_projection`: apenas para `expense`; projeção linear do mês de `date` + despesa hipotética se `date` cai no intervalo já decorrido até hoje; `null` se o mês de referência ainda não começou (`month_start > today`) ou se `type === 'income'`.

**Erros:**
- `400`: corpo inválido (`value` ≤ 0, tipo inválido)
- `403`: Sem acesso à organização

---

### GET `/v1/budgets`

Lista todos os orçamentos da organização com resumo consolidado.

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `organization_id` | UUID | Sim | - | ID da organização |
| `period_type` | string | Não | - | Filtrar por tipo ("monthly", "custom", etc.) |
| `is_active` | boolean | Não | - | Filtrar por status ativo/inativo |

**Request:**
```typescript
const listBudgets = async (
  organizationId: string,
  periodType?: string,
  isActive?: boolean
): Promise<BudgetListResponse> => {
  const response = await apiClient.get<BudgetListResponse>('/v1/budgets', {
    params: {
      organization_id: organizationId,
      period_type: periodType,
      is_active: isActive,
    }
  });
  return response.data;
};
```

**Response (200):**
```typescript
{
  budgets: [
    {
      id: "budget-uuid",
      tag_name: "Alimentação",
      tag_color: "#FF5722",
      amount: 1500.00,
      spent_amount: 1245.80,
      remaining_amount: 254.20,
      usage_percent: 83.05,
      status: "warning",
      // ...
    }
  ],
  summary: {
    total_budgeted: 5000.00,
    total_spent: 3200.00,
    total_remaining: 1800.00,
    budgets_exceeded: 0,
    budgets_warning: 2,
    budgets_ok: 3
  }
}
```

---

### GET `/v1/budgets/{budget_id}`

Obtém detalhes de um orçamento específico.

**Request:**
```typescript
const getBudget = async (
  budgetId: string,
  organizationId: string
): Promise<Budget> => {
  const response = await apiClient.get<Budget>(`/v1/budgets/${budgetId}`, {
    params: { organization_id: organizationId }
  });
  return response.data;
};
```

**Erros:**
- `403`: Sem acesso à organização
- `404`: Orçamento não encontrado

---

### PATCH `/v1/budgets/{budget_id}`

Atualiza campos de um orçamento (partial update).

**Request:**
```typescript
const updateBudget = async (
  budgetId: string,
  organizationId: string,
  data: UpdateBudgetRequest
): Promise<Budget> => {
  const response = await apiClient.patch<Budget>(
    `/v1/budgets/${budgetId}`,
    data,
    { params: { organization_id: organizationId } }
  );
  return response.data;
};
```

**Exemplo:**
```typescript
// Aumentar limite
await updateBudget("budget-uuid", "org-uuid", { amount: 2000.00 });

// Desativar orçamento
await updateBudget("budget-uuid", "org-uuid", { is_active: false });
```

**Erros:**
- `400`: Dados inválidos
- `404`: Orçamento não encontrado

---

### DELETE `/v1/budgets/{budget_id}`

Remove um orçamento.

**Request:**
```typescript
const deleteBudget = async (
  budgetId: string,
  organizationId: string
): Promise<void> => {
  await apiClient.delete(`/v1/budgets/${budgetId}`, {
    params: { organization_id: organizationId }
  });
};
```

**Response (204):** Sem conteúdo

**Erros:**
- `403`: Sem acesso à organização
- `404`: Orçamento não encontrado

---

## 🔄 Endpoints de Transações Recorrentes

Gerencie receitas e despesas recorrentes. O sistema rastreia a próxima data de ocorrência e permite gerar transações reais a partir de um template recorrente.

### POST `/v1/recurring-transactions`

Cria uma nova transação recorrente.

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `organization_id` | UUID | Sim | ID da organização |

**Request:**
```typescript
const createRecurringTransaction = async (
  organizationId: string,
  data: CreateRecurringTransactionRequest
): Promise<RecurringTransaction> => {
  const response = await apiClient.post<RecurringTransaction>(
    '/v1/recurring-transactions',
    data,
    { params: { organization_id: organizationId } }
  );
  return response.data;
};
```

**Exemplo:**
```typescript
await createRecurringTransaction("org-uuid", {
  type: "expense",
  description: "Aluguel",
  value: 2500.00,
  payment_method: "bank_transfer",
  frequency: "monthly",
  start_date: "2026-01-01",
  day_of_month: 5,
  tag_ids: ["tag-uuid-moradia"],
  notes: "Pagamento até dia 5"
});
```

**Response (201):**
```typescript
{
  id: "rt-uuid",
  organization_id: "org-uuid",
  type: "expense",
  description: "Aluguel",
  value: 2500.00,
  payment_method: "bank_transfer",
  frequency: "monthly",
  start_date: "2026-01-01",
  next_occurrence: "2026-04-05",
  is_active: true,
  day_of_month: 5,
  day_of_week: null,
  end_date: null,
  credit_card_id: null,
  notes: "Pagamento até dia 5",
  tags: [{ id: "tag-uuid", name: "Moradia", color: "#795548", ... }],
  created_at: "2026-03-22T10:00:00",
  updated_at: "2026-03-22T10:00:00"
}
```

**Erros:**
- `400`: Dados inválidos (frequência, valor, método de pagamento)

---

### GET `/v1/recurring-transactions`

Lista todas as transações recorrentes da organização com resumo.

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `organization_id` | UUID | Sim | - | ID da organização |
| `is_active` | boolean | Não | - | Filtrar por status ativo/pausado |

**Request:**
```typescript
const listRecurringTransactions = async (
  organizationId: string,
  isActive?: boolean
): Promise<RecurringTransactionListResponse> => {
  const response = await apiClient.get<RecurringTransactionListResponse>(
    '/v1/recurring-transactions',
    { params: { organization_id: organizationId, is_active: isActive } }
  );
  return response.data;
};
```

**Response (200):**
```typescript
{
  recurring_transactions: [ /* lista de RecurringTransaction */ ],
  summary: {
    total_monthly_income: 5000.00,
    total_monthly_expense: 3800.00,
    active_count: 8,
    paused_count: 2
  }
}
```

---

### GET `/v1/recurring-transactions/{rt_id}`

Obtém detalhes de uma transação recorrente específica.

**Request:**
```typescript
const getRecurringTransaction = async (
  rtId: string,
  organizationId: string
): Promise<RecurringTransaction> => {
  const response = await apiClient.get<RecurringTransaction>(
    `/v1/recurring-transactions/${rtId}`,
    { params: { organization_id: organizationId } }
  );
  return response.data;
};
```

**Erros:**
- `403`: Sem acesso
- `404`: Não encontrada

---

### PATCH `/v1/recurring-transactions/{rt_id}`

Atualiza campos de uma transação recorrente (partial update). A `next_occurrence` é recalculada automaticamente se a frequência ou o dia for alterado.

**Request:**
```typescript
const updateRecurringTransaction = async (
  rtId: string,
  organizationId: string,
  data: UpdateRecurringTransactionRequest
): Promise<RecurringTransaction> => {
  const response = await apiClient.patch<RecurringTransaction>(
    `/v1/recurring-transactions/${rtId}`,
    data,
    { params: { organization_id: organizationId } }
  );
  return response.data;
};
```

**Erros:**
- `400`: Dados inválidos
- `404`: Não encontrada

---

### DELETE `/v1/recurring-transactions/{rt_id}`

Remove uma transação recorrente.

**Request:**
```typescript
const deleteRecurringTransaction = async (
  rtId: string,
  organizationId: string
): Promise<void> => {
  await apiClient.delete(`/v1/recurring-transactions/${rtId}`, {
    params: { organization_id: organizationId }
  });
};
```

**Response (204):** Sem conteúdo

---

### POST `/v1/recurring-transactions/{rt_id}/toggle`

Ativa ou pausa uma transação recorrente (alterna `is_active`).

**Request:**
```typescript
const toggleRecurringTransaction = async (
  rtId: string,
  organizationId: string
): Promise<RecurringTransaction> => {
  const response = await apiClient.post<RecurringTransaction>(
    `/v1/recurring-transactions/${rtId}/toggle`,
    null,
    { params: { organization_id: organizationId } }
  );
  return response.data;
};
```

**Response (200):** Retorna o objeto `RecurringTransaction` atualizado com o novo `is_active`.

---

### POST `/v1/recurring-transactions/{rt_id}/generate`

Gera uma transação real a partir do template recorrente para uma data específica. Avança `next_occurrence` para a próxima data após a geração.

**Request:**
```typescript
const generateFromRecurring = async (
  rtId: string,
  organizationId: string,
  data: GenerateFromRecurringRequest
): Promise<GenerateFromRecurringResponse> => {
  const response = await apiClient.post<GenerateFromRecurringResponse>(
    `/v1/recurring-transactions/${rtId}/generate`,
    data,
    { params: { organization_id: organizationId } }
  );
  return response.data;
};
```

**Exemplo:**
```typescript
await generateFromRecurring("rt-uuid", "org-uuid", {
  occurrence_date: "2026-04-05",
  value_override: 2600.00, // Opcional: substituir valor nesta geração
});
```

**Response (200):**
```typescript
{
  next_occurrence: "2026-05-05" // Nova próxima ocorrência após geração
}
```

**Erros:**
- `400`: Transação recorrente inativa ou data inválida
- `404`: Não encontrada

---

## 🔁 Endpoints de Séries Recorrentes (Novo Modelo)

Este é o novo modelo de transações recorrentes que substitui o `/v1/recurring-transactions`.

### Conceitos Fundamentais

- **Série Recorrente**: uma regra que define como e quando uma transação se repete (ex: Netflix todo dia 5 do mês).
- **Materialização Lazy**: o backend gera as transações automaticamente na primeira vez que um período é consultado. O frontend **não precisa** chamar nenhum endpoint especial para "gerar" transações.
- **Versionamento de Série**: quando um valor muda (ex: Netflix subiu de preço), a série atual é "fechada" e uma nova versão é criada com o valor atualizado. Ambas compartilham o mesmo `logical_series_id`.
- **Projeção Futura**: Para ver o futuro, consulte simplesmente as transações com datas futuras — o backend retornará projeções automáticas.

### Tipos TypeScript

```typescript
interface RecurringSeries {
  id: string; // UUID
  organization_id: string;
  logical_series_id: string; // Identifica a "mesma" série mesmo após mudança de valor
  type: 'income' | 'expense';
  description: string;
  value: number;
  value_kind: 'exact' | 'approximate';
  category: string;
  payment_method: string;
  frequency: 'monthly' | 'weekly' | 'biweekly' | 'yearly';
  start_date: string; // YYYY-MM-DD
  next_occurrence: string; // YYYY-MM-DD — próxima ocorrência a materializar
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tags: SeriesTag[];
  day_of_month?: number | null;
  day_of_week?: number | null; // 0=Dom..6=Sab
  end_date?: string | null; // null = indefinido
  credit_card_id?: number | null;
  notes?: string | null;
  replaces_series_id?: string | null; // UUID da versão anterior (se mudança de valor)
}

interface RecurringSummary {
  total_monthly_income: number;
  total_monthly_expense: number;
  active_count: number;
  paused_count: number;
}

/** Same semantics as GET /v1/transactions/summary → recurring_in_period (active series only). */
interface RecurringSeriesSummaryForPeriod {
  total_expense: number;
  total_income: number;
  period: { start_date: string; end_date: string };
  series_count_expense?: number;
  series_count_income?: number;
}

interface RecurringSeriesListResponse {
  series: RecurringSeries[];
  summary: RecurringSummary;
  /** Present when both date_start and date_end query params are set and valid. */
  summary_for_period?: RecurringSeriesSummaryForPeriod;
}

interface ChangeSeriesValueResponse {
  closed_series: RecurringSeries;
  new_series: RecurringSeries;
}
```

### POST `/v1/recurring-series`

Cria uma nova série recorrente.

**Query params:**
- `organization_id` (UUID, obrigatório)

**Request:**
```typescript
interface CreateRecurringSeriesRequest {
  type: 'income' | 'expense';
  description: string;
  value: number;
  payment_method: string;
  frequency: 'monthly' | 'weekly' | 'biweekly' | 'yearly';
  start_date: string; // YYYY-MM-DD
  tag_ids?: string[];
  value_kind?: 'exact' | 'approximate'; // default: 'exact'
  category?: string;
  day_of_month?: number | null;
  day_of_week?: number | null;
  end_date?: string | null; // null = indefinido
  credit_card_id?: number | null;
  notes?: string | null;
}
```

**Response (201):** `RecurringSeries`

**Erros:**
- `400`: Dados inválidos (type, frequency, payment_method, value)
- `403`: Acesso negado

```typescript
const createRecurringSeries = async (
  organizationId: string,
  data: CreateRecurringSeriesRequest
): Promise<RecurringSeries> => {
  const response = await apiClient.post<RecurringSeries>(
    `/v1/recurring-series?organization_id=${organizationId}`,
    data
  );
  return response.data;
};
```

---

### GET `/v1/recurring-series`

Lista todas as séries de uma organização, com resumo financeiro.

**Query params:**
- `organization_id` (UUID, obrigatório)
- `is_active` (boolean, opcional) — filtra por ativas/pausadas
- `date_start` (opcional, YYYY-MM-DD) — junto com `date_end`, habilita `summary_for_period`
- `date_end` (opcional, YYYY-MM-DD) — deve ser >= `date_start`; caso contrário `422`

**Response (200):** `RecurringSeriesListResponse` — o campo `summary` continua sendo o **equivalente mensal** agregado (`total_monthly_*`). Com `date_start` + `date_end` válidos, `summary_for_period` traz a **projeção no intervalo** (mesma regra do bloco `recurring_in_period` do summary de transações).

**Erros:**
- `422`: `date_start` posterior a `date_end`

```typescript
const listRecurringSeries = async (
  organizationId: string,
  options?: { isActive?: boolean; dateStart?: string; dateEnd?: string }
): Promise<RecurringSeriesListResponse> => {
  const params = new URLSearchParams({ organization_id: organizationId });
  if (options?.isActive !== undefined) params.append('is_active', String(options.isActive));
  if (options?.dateStart) params.append('date_start', options.dateStart);
  if (options?.dateEnd) params.append('date_end', options.dateEnd);
  const response = await apiClient.get<RecurringSeriesListResponse>(
    `/v1/recurring-series?${params}`
  );
  return response.data;
};
```

---

### GET `/v1/recurring-series/{series_id}`

Retorna uma série recorrente pelo ID.

**Query params:**
- `organization_id` (UUID, obrigatório)

**Response (200):** `RecurringSeries`

**Erros:**
- `404`: Série não encontrada

---

### PATCH `/v1/recurring-series/{series_id}`

Atualiza campos simples de uma série (descrição, notas, tags, etc.).
Para mudança de valor com histórico, use `POST /{series_id}/change-value`.

**Query params:**
- `organization_id` (UUID, obrigatório)

**Request:**
```typescript
interface UpdateRecurringSeriesRequest {
  description?: string;
  value?: number;
  value_kind?: 'exact' | 'approximate';
  category?: string;
  payment_method?: string;
  frequency?: 'monthly' | 'weekly' | 'biweekly' | 'yearly';
  day_of_month?: number | null;
  day_of_week?: number | null;
  end_date?: string | null;
  credit_card_id?: number | null;
  notes?: string | null;
  tag_ids?: string[] | null;
}
```

**Response (200):** `RecurringSeries`

---

### DELETE `/v1/recurring-series/{series_id}`

Exclui uma série recorrente permanentemente.

**Query params:**
- `organization_id` (UUID, obrigatório)

**Response (204):** Sem body

**Erros:**
- `404`: Série não encontrada

---

### PATCH `/v1/recurring-series/{series_id}/toggle`

Pausa ou retoma uma série recorrente.

**Query params:**
- `organization_id` (UUID, obrigatório)

**Request:**
```typescript
{ is_active: boolean }
```

**Response (200):** `RecurringSeries`

```typescript
const toggleRecurringSeries = async (
  organizationId: string,
  seriesId: string,
  isActive: boolean
): Promise<RecurringSeries> => {
  const response = await apiClient.patch<RecurringSeries>(
    `/v1/recurring-series/${seriesId}/toggle?organization_id=${organizationId}`,
    { is_active: isActive }
  );
  return response.data;
};
```

---

### POST `/v1/recurring-series/{series_id}/change-value`

Altera o valor de uma série com histórico (versionamento).

Este endpoint **fecha** a versão atual da série (setando `end_date`) e **cria uma nova versão** a partir de `effective_start_date` com o novo valor. Ambas as versões compartilham o mesmo `logical_series_id`.

**Quando usar**: quando o valor de uma assinatura/compromisso mudou e você quer manter o histórico correto.

**Query params:**
- `organization_id` (UUID, obrigatório)

**Request:**
```typescript
interface ChangeSeriesValueRequest {
  new_value: number;
  effective_start_date: string; // YYYY-MM-DD — a partir de quando o novo valor vale
  value_kind?: 'exact' | 'approximate'; // default: 'exact'
  notes?: string | null;
}
```

**Response (200):** `ChangeSeriesValueResponse`

```typescript
// Exemplo: Netflix subiu de R$39,90 para R$49,90 a partir de Junho/2026
const changeSeriesValue = async (
  organizationId: string,
  seriesId: string
): Promise<ChangeSeriesValueResponse> => {
  const response = await apiClient.post<ChangeSeriesValueResponse>(
    `/v1/recurring-series/${seriesId}/change-value?organization_id=${organizationId}`,
    {
      new_value: 49.90,
      effective_start_date: '2026-06-01',
      value_kind: 'exact',
    }
  );
  return response.data;
  // response.data.closed_series = Netflix antigo (R$39,90, end_date=2026-05-31)
  // response.data.new_series = Netflix novo (R$49,90, start_date=2026-06-01)
};
```

**Erros:**
- `400`: `effective_start_date` anterior ao `start_date` da série, ou valor inválido
- `404`: Série não encontrada

---

### Como o frontend deve tratar ocorrências (Materialização Automática)

**Não há necessidade de chamar nenhum endpoint especial!**

O backend materializa automaticamente as ocorrências quando você faz qualquer consulta de transações:

```typescript
// Simplesmente busque as transações do período — as ocorrências de séries
// recorrentes já estarão incluídas automaticamente
const transactions = await apiClient.get(
  `/v1/transactions?organization_id=${orgId}&date_start=2026-04-01&date_end=2026-04-30`
);

// As transações materializadas de séries recorrentes terão:
// - recurring: true
// - recurring_series_id: UUID da série que as gerou
```

---

## 📊 Endpoints de Analytics

Análises e relatórios financeiros avançados. Todos os endpoints retornam dados calculados em tempo real com base nas transações da organização.

### GET `/v1/analytics/monthly-evolution`

Evolução mensal de receitas, despesas e saldo ao longo dos últimos N meses.

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `organization_id` | UUID | Sim | - | ID da organização |
| `months` | integer | Não | 6 | Número de meses (1-24) |

**Request:**
```typescript
const getMonthlyEvolution = async (
  organizationId: string,
  months = 6
): Promise<MonthlyEvolutionResponse> => {
  const response = await apiClient.get<MonthlyEvolutionResponse>(
    '/v1/analytics/monthly-evolution',
    { params: { organization_id: organizationId, months } }
  );
  return response.data;
};
```

**Response (200):**
```typescript
{
  months: [
    {
      year: 2025,
      month: 10,
      month_name: "outubro",
      total_income: 8000.00,
      total_expenses: 5200.00,
      balance: 2800.00
    },
    // ... meses seguintes
  ],
  period_start: "2025-10-01",
  period_end: "2026-03-31"
}
```

---

### GET `/v1/analytics/by-category`

Distribuição de gastos (ou receitas) por categoria/tag para um período.

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `organization_id` | UUID | Sim | - | ID da organização |
| `date_start` | date | Não | - | YYYY-MM-DD |
| `date_end` | date | Não | - | YYYY-MM-DD |
| `transaction_type` | string | Não | `"expense"` | `"expense"` ou `"income"` |

**Request:**
```typescript
const getByCategory = async (
  organizationId: string,
  options?: {
    dateStart?: string;
    dateEnd?: string;
    transactionType?: 'expense' | 'income';
  }
): Promise<ByCategoryResponse> => {
  const response = await apiClient.get<ByCategoryResponse>(
    '/v1/analytics/by-category',
    {
      params: {
        organization_id: organizationId,
        date_start: options?.dateStart,
        date_end: options?.dateEnd,
        transaction_type: options?.transactionType ?? 'expense',
      }
    }
  );
  return response.data;
};
```

**Response (200):**
```typescript
{
  categories: [
    {
      tag_id: "tag-uuid",
      tag_name: "Alimentação",
      tag_color: "#FF5722",
      total: 1245.80,
      percentage: 38.5,
      transaction_count: 23
    },
    // ...
  ],
  total_amount: 3236.40,
  period_start: "2026-03-01",
  period_end: "2026-03-31"
}
```

---

### GET `/v1/analytics/spending-by-day`

Série **diária** de totais por dia civil (agregação no servidor), para o gráfico de “ritmo” no modal Nova transação / impacto financeiro. Um ponto por dia no intervalo; dias sem movimento retornam `total_expenses: 0`.

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `organization_id` | UUID | Sim | - | ID da organização |
| `date_start` | date (YYYY-MM-DD) | Sim | - | Início inclusivo |
| `date_end` | date (YYYY-MM-DD) | Sim | - | Fim inclusivo |
| `tag_id` | UUID | Não | - | Filtra despesas/receitas que tenham essa tag |
| `transaction_type` | string | Não | `expense` | `expense` ou `income` |

**Semântica (alinhada aos outros analytics):** agregação por `transactions.date` (datetime da transação, bucket por dia civil). Não inclui lógica de parcelas por `due_date` do cartão (igual a `monthly-evolution` / `by-category`).

**Request:**
```typescript
interface SpendingByDayPoint {
  date: string;
  total_expenses: string; // decimal as string
}

interface SpendingByDayResponse {
  points: SpendingByDayPoint[];
  currency: string; // ex.: "BRL"
  period: { start: string; end: string };
}

const getSpendingByDay = async (
  organizationId: string,
  dateStart: string,
  dateEnd: string,
  options?: { tagId?: string; transactionType?: 'expense' | 'income' }
): Promise<SpendingByDayResponse> => {
  const response = await apiClient.get<SpendingByDayResponse>('/v1/analytics/spending-by-day', {
    params: {
      organization_id: organizationId,
      date_start: dateStart,
      date_end: dateEnd,
      ...(options?.tagId && { tag_id: options.tagId }),
      ...(options?.transactionType && { transaction_type: options.transactionType }),
    },
  });
  return response.data;
};
```

**Response (200):** ver tipos acima.

**Erros:**
- `400`: `date_end` antes de `date_start` ou `transaction_type` inválido
- `403`: Sem acesso à organização

**Performance:** chame **uma vez** ao abrir o drawer (ou ao mudar mês/categoria); não precisa debounce por digitação de valor.

---

### GET `/v1/analytics/spending-rhythm`

Ritmo de gastos por categoria ao longo de vários meses — útil para gráficos de linha por categoria.

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `organization_id` | UUID | Sim | - | ID da organização |
| `months` | integer | Não | 6 | Número de meses |

**Request:**
```typescript
const getSpendingRhythm = async (
  organizationId: string,
  months = 6
): Promise<SpendingRhythmResponse> => {
  const response = await apiClient.get<SpendingRhythmResponse>(
    '/v1/analytics/spending-rhythm',
    { params: { organization_id: organizationId, months } }
  );
  return response.data;
};
```

**Response (200):**
```typescript
{
  months: ["out/2025", "nov/2025", "dez/2025", "jan/2026", "fev/2026", "mar/2026"],
  categories: [
    {
      tag_id: "tag-uuid",
      tag_name: "Alimentação",
      tag_color: "#FF5722",
      monthly_totals: [980, 1100, 1380, 950, 1050, 1245],
      average: 1117.50,
      trend: "up"
    }
  ],
  monthly_totals: [3200, 3800, 4500, 3100, 3400, 3600]
}
```

**Notas:**
- `monthly_totals` em cada categoria corresponde posição a posição com o array `months`
- `trend`: `"up"` (crescente), `"down"` (decrescente), `"stable"` (estável)

---

### GET `/v1/analytics/period-comparison`

Compara dois períodos (A vs B) mostrando variação percentual de receitas, despesas e saldo.

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `organization_id` | UUID | Sim | ID da organização |
| `period_a_start` | date | Sim | Início do período A (YYYY-MM-DD) |
| `period_a_end` | date | Sim | Fim do período A |
| `period_b_start` | date | Sim | Início do período B |
| `period_b_end` | date | Sim | Fim do período B |

**Request:**
```typescript
const getPeriodComparison = async (
  organizationId: string,
  periodAStart: string,
  periodAEnd: string,
  periodBStart: string,
  periodBEnd: string
): Promise<PeriodComparisonResponse> => {
  const response = await apiClient.get<PeriodComparisonResponse>(
    '/v1/analytics/period-comparison',
    {
      params: {
        organization_id: organizationId,
        period_a_start: periodAStart,
        period_a_end: periodAEnd,
        period_b_start: periodBStart,
        period_b_end: periodBEnd,
      }
    }
  );
  return response.data;
};
```

**Exemplo — comparar fevereiro vs março:**
```typescript
await getPeriodComparison(
  "org-uuid",
  "2026-02-01", "2026-02-28",
  "2026-03-01", "2026-03-31"
);
```

**Response (200):**
```typescript
{
  period_a: {
    start: "2026-02-01",
    end: "2026-02-28",
    total_income: 8000.00,
    total_expenses: 5200.00,
    balance: 2800.00
  },
  period_b: {
    start: "2026-03-01",
    end: "2026-03-31",
    total_income: 8500.00,
    total_expenses: 5800.00,
    balance: 2700.00
  },
  changes: {
    income_change_pct: 6.25,       // +6.25%
    expenses_change_pct: 11.54,    // +11.54%
    balance_change_pct: -3.57      // -3.57%
  }
}
```

**Notas:**
- `change_pct` é `null` quando o valor do período A é zero (divisão impossível)
- Valor positivo = aumento; negativo = redução

---

### GET `/v1/analytics/export-csv`

Exporta transações filtradas em formato CSV. Retorna o arquivo diretamente com header `Content-Disposition: attachment`.

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `organization_id` | UUID | Sim | ID da organização |
| `date_start` | date | Não | YYYY-MM-DD |
| `date_end` | date | Não | YYYY-MM-DD |
| `type` | string | Não | `"income"` ou `"expense"` |
| `payment_method` | string | Não | Método de pagamento |
| `status_filter` | string | Não | `"pending"`, `"completed"`, `"cancelled"` |
| `tag_id` | UUID | Não | Filtrar por tag |

**Request:**
```typescript
const exportTransactionsCsv = async (
  organizationId: string,
  options?: {
    dateStart?: string;
    dateEnd?: string;
    type?: string;
    paymentMethod?: string;
    statusFilter?: string;
    tagId?: string;
  }
): Promise<Blob> => {
  const response = await apiClient.get('/v1/analytics/export-csv', {
    params: {
      organization_id: organizationId,
      date_start: options?.dateStart,
      date_end: options?.dateEnd,
      type: options?.type,
      payment_method: options?.paymentMethod,
      status_filter: options?.statusFilter,
      tag_id: options?.tagId,
    },
    responseType: 'blob',
  });
  return response.data;
};

// Uso: baixar o arquivo
const downloadCsv = async (organizationId: string) => {
  const blob = await exportTransactionsCsv(organizationId, {
    dateStart: "2026-01-01",
    dateEnd: "2026-03-31",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'transactions.csv';
  link.click();
  URL.revokeObjectURL(url);
};
```

**Response (200):** Arquivo CSV com as colunas:
```
id,date,type,description,value,payment_method,status,tags
```

---

## 🔔 Endpoints de Notificações

### GET `/v1/notifications`

Lista as notificações do usuário autenticado com paginação.

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `organization_id` | UUID | Não | - | Filtrar por organização |
| `page` | integer | Não | 1 | Página |
| `limit` | integer | Não | 20 | Itens por página |

**Request:**
```typescript
const listNotifications = async (
  organizationId?: string,
  page = 1,
  limit = 20
): Promise<NotificationListResponse> => {
  const response = await apiClient.get<NotificationListResponse>(
    '/v1/notifications',
    { params: { organization_id: organizationId, page, limit } }
  );
  return response.data;
};
```

**Response (200):**
```typescript
{
  notifications: [
    {
      id: "notif-uuid",
      type: "budget_exceeded",
      title: "Orçamento excedido",
      body: "Você ultrapassou o limite de Alimentação em R$ 245,80",
      is_read: false,
      created_at: "2026-03-22T08:30:00",
      organization_id: "org-uuid",
      data: { budget_id: "budget-uuid", tag_name: "Alimentação", excess_amount: 245.80 },
      read_at: null
    }
  ],
  unread_count: 3,
  page: 1,
  limit: 20,
  total: 15,
  pages: 1,
  has_next: false,
  has_prev: false
}
```

---

### POST `/v1/notifications/{notification_id}/read`

Marca uma notificação específica como lida.

**Request:**
```typescript
const markNotificationRead = async (notificationId: string): Promise<void> => {
  await apiClient.post(`/v1/notifications/${notificationId}/read`);
};
```

**Response (204):** Sem conteúdo

**Erros:**
- `404`: Notificação não encontrada ou não pertence ao usuário

---

### POST `/v1/notifications/read-all`

Marca todas as notificações do usuário como lidas (opcionalmente filtrado por organização).

**Request:**
```typescript
const markAllNotificationsRead = async (
  organizationId?: string
): Promise<{ updated: number }> => {
  const response = await apiClient.post<{ updated: number }>(
    '/v1/notifications/read-all',
    null,
    { params: { organization_id: organizationId } }
  );
  return response.data;
};
```

**Response (200):**
```typescript
{
  updated: 5 // Número de notificações marcadas como lidas
}
```

---

## 👔 Endpoints da Área do Consultor

Endpoints exclusivos para usuários com perfil de **consultor**, que gerenciam múltiplas organizações (clientes). Requer autenticação e feature flags habilitadas (`multi_org_dashboard`, `client_list`, `consolidated_reports`).

### GET `/v1/consultant/summary`

Resumo consolidado de todas as organizações do consultor (multi_org_dashboard).

**Request:**
```typescript
interface ConsultantSummaryQuery {
  date_start?: string;  // YYYY-MM-DD (opcional)
  date_end?: string;    // YYYY-MM-DD (opcional)
}

interface ConsultantSummaryResponse {
  total_income: number;
  total_expenses: number;
  balance: number;
  total_transactions: number;
  organizations_count: number;
  period_start: string | null;  // YYYY-MM-DD
  period_end: string | null;    // YYYY-MM-DD
}

const getConsultantSummary = async (
  params?: ConsultantSummaryQuery
): Promise<ConsultantSummaryResponse> => {
  const response = await apiClient.get<ConsultantSummaryResponse>(
    '/v1/consultant/summary',
    { params }
  );
  return response.data;
};
```

**Exemplo:**
```typescript
// Resumo do período atual (padrão)
const summary = await getConsultantSummary();

// Resumo de um período específico
const janSummary = await getConsultantSummary({
  date_start: '2025-01-01',
  date_end: '2025-01-31'
});
console.log(`Balanço: ${janSummary.balance}, Clientes: ${janSummary.organizations_count}`);
```

**Response (200):**
```typescript
{
  total_income: 50000.00,
  total_expenses: 32000.00,
  balance: 18000.00,
  total_transactions: 245,
  organizations_count: 8,
  period_start: "2025-01-01",
  period_end: "2025-01-31"
}
```

**Erros:**
- `401`: Não autenticado
- `403`: Usuário não é consultor ou feature `multi_org_dashboard` ausente
- `500`: `CONSULTANT_SERVICE_ERROR` - Erro interno do serviço (ex.: falha ao buscar memberships)

---

### GET `/v1/consultant/clients`

Lista de clientes (organizações) vinculados ao consultor (client_list).

**Request:**
```typescript
interface ConsultantClient {
  organization_id: string;
  organization_name: string;
  role: 'owner' | 'member';  // Role in that organization (membership), not consultant
  membership_created_at: string;  // ISO 8601
}

interface ConsultantClientsResponse {
  total: number;
  clients: ConsultantClient[];
}

const getConsultantClients = async (): Promise<ConsultantClientsResponse> => {
  const response = await apiClient.get<ConsultantClientsResponse>(
    '/v1/consultant/clients'
  );
  return response.data;
};
```

**Exemplo:**
```typescript
const { total, clients } = await getConsultantClients();
clients.forEach((c) => {
  console.log(`${c.organization_name} (${c.role}) - desde ${c.membership_created_at}`);
});
```

**Response (200):**
```typescript
{
  total: 8,
  clients: [
    {
      organization_id: "123e4567-e89b-12d3-a456-426614174000",
      organization_name: "Empresa ABC",
      role: "owner",
      membership_created_at: "2024-06-15T10:00:00Z"
    },
    {
      organization_id: "223e4567-e89b-12d3-a456-426614174001",
      organization_name: "Empresa XYZ",
      role: "member",
      membership_created_at: "2024-08-20T14:30:00Z"
    }
  ]
}
```

**Erros:**
- `401`: Não autenticado
- `403`: Usuário não é consultor ou feature `client_list` ausente
- `500`: `CONSULTANT_SERVICE_ERROR` - Erro interno do serviço (ex.: falha ao buscar memberships)

---

### GET `/v1/consultant/reports/consolidated`

Relatório consolidado de todas as organizações do consultor (consolidated_reports). Mesmo formato de resposta do summary.

**Request:**
```typescript
interface ConsultantReportQuery {
  date_start?: string;  // YYYY-MM-DD (opcional)
  date_end?: string;    // YYYY-MM-DD (opcional)
}

const getConsultantConsolidatedReport = async (
  params?: ConsultantReportQuery
): Promise<ConsultantSummaryResponse> => {
  const response = await apiClient.get<ConsultantSummaryResponse>(
    '/v1/consultant/reports/consolidated',
    { params }
  );
  return response.data;
};
```

**Exemplo:**
```typescript
const report = await getConsultantConsolidatedReport({
  date_start: '2025-01-01',
  date_end: '2025-01-31'
});
console.log(`Receitas: ${report.total_income}, Despesas: ${report.total_expenses}`);
```

**Response (200):**
```typescript
{
  total_income: 50000.00,
  total_expenses: 32000.00,
  balance: 18000.00,
  total_transactions: 245,
  organizations_count: 8,
  period_start: "2025-01-01",
  period_end: "2025-01-31"
}
```

**Erros:**
- `401`: Não autenticado
- `403`: Usuário não é consultor ou feature `consolidated_reports` ausente
- `500`: `CONSULTANT_SERVICE_ERROR` - Erro interno do serviço (ex.: falha ao buscar memberships)

---

### GET `/v1/consultant/financial-health-index`

Índice de saúde financeira ponderado (saldo, dívida, reserva) de todas as organizações do consultor.

**Request:**
```typescript
interface FinancialHealthIndexQuery {
  date_start?: string;  // YYYY-MM-DD (opcional)
  date_end?: string;    // YYYY-MM-DD (opcional)
}

interface FinancialHealthIndexResponse {
  index: number;           // 0-100 (índice geral)
  balance_score: number;   // 0-100 (score de saldo)
  debt_score: number;      // 0-100 (score de endividamento)
  reserve_score: number;   // 0-100 (score de reserva)
  total_income: number;
  total_expenses: number;
  balance: number;
  total_debt: number;
  organizations_count: number;
  period_start: string;    // YYYY-MM-DD
  period_end: string;      // YYYY-MM-DD
  formula_info: string;    // Descrição da fórmula usada
}

const getFinancialHealthIndex = async (
  params?: FinancialHealthIndexQuery
): Promise<FinancialHealthIndexResponse> => {
  const response = await apiClient.get<FinancialHealthIndexResponse>(
    '/v1/consultant/financial-health-index',
    { params }
  );
  return response.data;
};
```

**Exemplo:**
```typescript
const health = await getFinancialHealthIndex({
  date_start: '2025-01-01',
  date_end: '2025-01-31'
});
console.log(`Índice de Saúde: ${health.index}/100`);
console.log(`Score Saldo: ${health.balance_score}, Score Dívida: ${health.debt_score}`);
```

**Response (200):**
```typescript
{
  index: 72.5,
  balance_score: 80.0,
  debt_score: 65.0,
  reserve_score: 72.5,
  total_income: 50000.00,
  total_expenses: 32000.00,
  balance: 18000.00,
  total_debt: 8500.00,
  organizations_count: 8,
  period_start: "2025-01-01",
  period_end: "2025-01-31",
  formula_info: "Média ponderada: 40% saldo, 40% dívida, 20% reserva"
}
```

**Erros:**
- `401`: Não autenticado
- `403`: Usuário não é consultor ou feature `multi_org_dashboard` ausente

---

### GET `/v1/consultant/active-goals-count`

Contagem de metas ativas em todas as organizações do consultor.

**Request:**
```typescript
interface ActiveGoalsCountQuery {
  as_of_date?: string;  // YYYY-MM-DD (opcional, padrão: hoje)
}

interface ActiveGoalsCountResponse {
  active_goals_count: number;
  organizations_count: number;
  as_of_date: string;  // YYYY-MM-DD
}

const getActiveGoalsCount = async (
  params?: ActiveGoalsCountQuery
): Promise<ActiveGoalsCountResponse> => {
  const response = await apiClient.get<ActiveGoalsCountResponse>(
    '/v1/consultant/active-goals-count',
    { params }
  );
  return response.data;
};
```

**Exemplo:**
```typescript
const goals = await getActiveGoalsCount();
console.log(`${goals.active_goals_count} metas ativas em ${goals.organizations_count} clientes`);
```

**Response (200):**
```typescript
{
  active_goals_count: 15,
  organizations_count: 8,
  as_of_date: "2025-01-31"
}
```

**Erros:**
- `401`: Não autenticado
- `403`: Usuário não é consultor ou feature `multi_org_dashboard` ausente

---

### GET `/v1/consultant/total-credit-card-debt`

Total de dívida de cartão de crédito não paga em todas as organizações do consultor.

**Request:**
```typescript
interface TotalCreditCardDebtQuery {
  as_of_date?: string;  // YYYY-MM-DD (opcional, padrão: hoje)
}

interface TotalCreditCardDebtResponse {
  total_debt: number;
  organizations_count: number;
  as_of_date: string;  // YYYY-MM-DD
}

const getTotalCreditCardDebt = async (
  params?: TotalCreditCardDebtQuery
): Promise<TotalCreditCardDebtResponse> => {
  const response = await apiClient.get<TotalCreditCardDebtResponse>(
    '/v1/consultant/total-credit-card-debt',
    { params }
  );
  return response.data;
};
```

**Exemplo:**
```typescript
const debt = await getTotalCreditCardDebt();
console.log(`Dívida total de cartões: R$ ${debt.total_debt}`);
```

**Response (200):**
```typescript
{
  total_debt: 12500.00,
  organizations_count: 8,
  as_of_date: "2025-01-31"
}
```

**Erros:**
- `401`: Não autenticado
- `403`: Usuário não é consultor ou feature `multi_org_dashboard` ausente

---

### GET `/v1/consultant/cash-flow`

Fluxo de caixa mensal (receitas, despesas, saldo) de todas as organizações do consultor.

**Request:**
```typescript
interface CashFlowQuery {
  date_start?: string;  // YYYY-MM-DD (opcional)
  date_end?: string;    // YYYY-MM-DD (opcional)
}

interface MonthlyCashFlowItem {
  month: string;        // YYYY-MM
  year: number;
  month_number: number; // 1-12
  total_income: number;
  total_expenses: number;
  balance: number;
}

interface CashFlowResponse {
  monthly_data: MonthlyCashFlowItem[];
  period_start: string;  // YYYY-MM-DD
  period_end: string;    // YYYY-MM-DD
}

const getCashFlow = async (
  params?: CashFlowQuery
): Promise<CashFlowResponse> => {
  const response = await apiClient.get<CashFlowResponse>(
    '/v1/consultant/cash-flow',
    { params }
  );
  return response.data;
};
```

**Exemplo:**
```typescript
const cashFlow = await getCashFlow({
  date_start: '2025-01-01',
  date_end: '2025-03-31'
});
cashFlow.monthly_data.forEach((month) => {
  console.log(`${month.month}: Receita ${month.total_income}, Despesa ${month.total_expenses}, Saldo ${month.balance}`);
});
```

**Response (200):**
```typescript
{
  monthly_data: [
    {
      month: "2025-01",
      year: 2025,
      month_number: 1,
      total_income: 50000.00,
      total_expenses: 32000.00,
      balance: 18000.00
    },
    {
      month: "2025-02",
      year: 2025,
      month_number: 2,
      total_income: 52000.00,
      total_expenses: 35000.00,
      balance: 17000.00
    }
  ],
  period_start: "2025-01-01",
  period_end: "2025-03-31"
}
```

**Erros:**
- `401`: Não autenticado
- `403`: Usuário não é consultor ou feature `multi_org_dashboard` ausente

---

### GET `/v1/consultant/expenses-by-category`

Despesas agrupadas por categoria de todas as organizações do consultor.

**Request:**
```typescript
interface ExpensesByCategoryQuery {
  date_start?: string;  // YYYY-MM-DD (opcional)
  date_end?: string;    // YYYY-MM-DD (opcional)
}

interface CategoryExpenseItem {
  name: string;       // Nome da categoria
  total: number;      // Total gasto
  percentage: number; // % do total
}

interface ExpensesByCategoryResponse {
  categories: CategoryExpenseItem[];
  total_expenses: number;
  period_start: string;  // YYYY-MM-DD
  period_end: string;    // YYYY-MM-DD
}

const getExpensesByCategory = async (
  params?: ExpensesByCategoryQuery
): Promise<ExpensesByCategoryResponse> => {
  const response = await apiClient.get<ExpensesByCategoryResponse>(
    '/v1/consultant/expenses-by-category',
    { params }
  );
  return response.data;
};
```

**Exemplo:**
```typescript
const expenses = await getExpensesByCategory({
  date_start: '2025-01-01',
  date_end: '2025-01-31'
});
expenses.categories.forEach((cat) => {
  console.log(`${cat.name}: R$ ${cat.total} (${cat.percentage}%)`);
});
```

**Response (200):**
```typescript
{
  categories: [
    { name: "alimentação", total: 8500.00, percentage: 26.56 },
    { name: "transporte", total: 6200.00, percentage: 19.38 },
    { name: "moradia", total: 12000.00, percentage: 37.50 },
    { name: "lazer", total: 5300.00, percentage: 16.56 }
  ],
  total_expenses: 32000.00,
  period_start: "2025-01-01",
  period_end: "2025-01-31"
}
```

**Erros:**
- `401`: Não autenticado
- `403`: Usuário não é consultor ou feature `multi_org_dashboard` ausente

---

### GET `/v1/consultant/income-commitment`

Comprometimento de renda (faturas de cartão vs receita) de todas as organizações do consultor.

**Request:**
```typescript
interface IncomeCommitmentQuery {
  date_start?: string;  // YYYY-MM-DD (opcional)
  date_end?: string;    // YYYY-MM-DD (opcional)
}

interface MonthlyIncomeCommitmentItem {
  month: string;
  year: number;
  month_number: number;
  income_commitment_percent: number;  // % da renda comprometida com cartões
  total_income: number;
  total_card_bills: number;
}

interface IncomeCommitmentResponse {
  monthly_data: MonthlyIncomeCommitmentItem[];
  period_start: string;  // YYYY-MM-DD
  period_end: string;    // YYYY-MM-DD
}

const getIncomeCommitment = async (
  params?: IncomeCommitmentQuery
): Promise<IncomeCommitmentResponse> => {
  const response = await apiClient.get<IncomeCommitmentResponse>(
    '/v1/consultant/income-commitment',
    { params }
  );
  return response.data;
};
```

**Exemplo:**
```typescript
const commitment = await getIncomeCommitment({
  date_start: '2025-01-01',
  date_end: '2025-03-31'
});
commitment.monthly_data.forEach((month) => {
  console.log(`${month.month}: ${month.income_commitment_percent}% comprometido`);
});
```

**Response (200):**
```typescript
{
  monthly_data: [
    {
      month: "2025-01",
      year: 2025,
      month_number: 1,
      income_commitment_percent: 35.5,
      total_income: 50000.00,
      total_card_bills: 17750.00
    }
  ],
  period_start: "2025-01-01",
  period_end: "2025-03-31"
}
```

**Erros:**
- `401`: Não autenticado
- `403`: Usuário não é consultor ou feature `multi_org_dashboard` ausente

---

### GET `/v1/consultant/goals-progress-by-type`

Progresso das metas agrupadas por tipo de todas as organizações do consultor.

**Request:**
```typescript
interface GoalsProgressByTypeQuery {
  as_of_date?: string;  // YYYY-MM-DD (opcional, padrão: hoje)
}

interface GoalProgressByTypeItem {
  goal_name: string;     // Nome/tipo da meta
  avg_progress: number;  // Progresso médio (0-100%)
  count: number;         // Quantidade de metas deste tipo
}

interface GoalsProgressByTypeResponse {
  by_type: GoalProgressByTypeItem[];
  organizations_count: number;
  as_of_date: string;  // YYYY-MM-DD
}

const getGoalsProgressByType = async (
  params?: GoalsProgressByTypeQuery
): Promise<GoalsProgressByTypeResponse> => {
  const response = await apiClient.get<GoalsProgressByTypeResponse>(
    '/v1/consultant/goals-progress-by-type',
    { params }
  );
  return response.data;
};
```

**Exemplo:**
```typescript
const progress = await getGoalsProgressByType();
progress.by_type.forEach((type) => {
  console.log(`${type.goal_name}: ${type.avg_progress}% médio (${type.count} metas)`);
});
```

**Response (200):**
```typescript
{
  by_type: [
    { goal_name: "reserva_emergencia", avg_progress: 65.5, count: 5 },
    { goal_name: "viagem", avg_progress: 42.0, count: 3 },
    { goal_name: "carro", avg_progress: 28.5, count: 2 }
  ],
  organizations_count: 8,
  as_of_date: "2025-01-31"
}
```

**Erros:**
- `401`: Não autenticado
- `403`: Usuário não é consultor ou feature `multi_org_dashboard` ausente

---

### GET `/v1/consultant/clients-at-risk`

Lista de clientes em risco (gastos > receita ou alto endividamento) do consultor.

**Título sugerido para a tabela:** "Clientes que Precisam de Atenção (Top Riscos)"

**Request:**
```typescript
interface ClientsAtRiskQuery {
  as_of_date?: string;              // YYYY-MM-DD (opcional, padrão: hoje)
  limit?: number;                   // Máximo de clientes (1-100, padrão: 10)
  gasto_maior_renda_meses?: number; // Meses com gasto > receita para flag (1-12, padrão: 3)
  endividamento_max_percent?: number; // % máximo dívida/renda para flag (0-100, padrão: 70)
  exigir_reserva_emergencia?: boolean; // Exigir reserva de emergência (padrão: false)
}

interface ClientAtRiskItem {
  organization_id: string;
  organization_name: string;
  client_name: string;        // Nome do cliente (owner) para exibição - usar na coluna Cliente
  main_situation: string;     // Motivo principal do risco (Situação Principal)
  current_balance: number;    // Saldo atual
  last_invoice_status: string; // Status da última fatura
  risk_score: number;         // 1-100 (maior = mais risco)
}

interface ClientsAtRiskResponse {
  clients: ClientAtRiskItem[];
  total: number;
  as_of_date: string;  // YYYY-MM-DD
}

const getClientsAtRisk = async (
  params?: ClientsAtRiskQuery
): Promise<ClientsAtRiskResponse> => {
  const response = await apiClient.get<ClientsAtRiskResponse>(
    '/v1/consultant/clients-at-risk',
    { params }
  );
  return response.data;
};
```

**Exemplo:**
```typescript
const atRisk = await getClientsAtRisk({
  limit: 5,
  gasto_maior_renda_meses: 3,
  endividamento_max_percent: 70
});
console.log(`${atRisk.total} clientes em risco:`);
atRisk.clients.forEach((client) => {
  // Usar client_name para exibir na coluna Cliente (avatar + nome)
  console.log(`${client.client_name}: ${client.main_situation} (score: ${client.risk_score})`);
});
```

**Response (200):**
```typescript
{
  clients: [
    {
      organization_id: "123e4567-e89b-12d3-a456-426614174000",
      organization_name: "Empresa ABC",
      client_name: "Ana Souza",
      main_situation: "gasto > renda em 3 meses consecutivos",
      current_balance: -2500.00,
      last_invoice_status: "unpaid",
      risk_score: 85
    },
    {
      organization_id: "223e4567-e89b-12d3-a456-426614174001",
      organization_name: "Empresa XYZ",
      client_name: "Carlos Lima",
      main_situation: "endividamento 75% (limite 70%)",
      current_balance: 500.00,
      last_invoice_status: "paid",
      risk_score: 72
    }
  ],
  total: 2,
  as_of_date: "2025-01-31"
}
```

**Erros:**
- `401`: Não autenticado
- `403`: Usuário não é consultor ou feature `multi_org_dashboard` ausente

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

## Ferramentas de teste E2E

Rotas disponíveis **somente** quando `APP_ENV` é `development`, `test` ou `staging`. Em **produção** esses paths não existem (`404`). Não use a partir da SPA em build de produção.

Autenticação: **não** usa JWT. Envie o header obrigatório `X-Test-Reset-Token` com o mesmo valor de `TEST_RESET_SECRET` configurado no servidor e no runner (Playwright/CI).

Variáveis típicas no runner:

| Variável | Descrição |
|----------|-----------|
| `TEST_RESET_SECRET` | Deve coincidir com `TEST_RESET_SECRET` do backend |
| `E2E_TEST_OWNER_EMAIL` / `E2E_TEST_OWNER_PASSWORD` | Credenciais do usuário técnico criado/reutilizado pelo reset quando `ensure_fixtures` é true |
| `TEST_ORG_ID` | Opcional; após o primeiro `200`, persistir `organization_id` retornado |

Organizações elegíveis para reset: nome começa com `__test_` (ver `docs/BACKEND_TEST_RESET_ORGANIZATION.md`).

### `POST /v1/test/reset-organization`

**Request body (JSON):**

```typescript
interface ResetTestOrganizationRequest {
  organization_id?: string; // UUID
  /** Default true nesta rota */
  ensure_fixtures?: boolean;
  owner_user_id?: string; // opcional: força membership owner deste usuário
}
```

**Response (200):**

```typescript
interface TestResetOrganizationResponse {
  organization_id: string;
  provisioned: {
    organization_created: boolean;
    owner_user_created: boolean;
    membership_created: boolean;
  };
  deleted: Record<string, number>;
  preserved: string[];
  owner_user_id?: string | null;
}
```

**Erros:** `401` token ausente/incorreto; `403` org não é de teste; `404` org não encontrada (com `ensure_fixtures: false`); `422` validação; `500` falha na transação ou credenciais E2E não configuradas no servidor.

**Exemplo (globalSetup Playwright):**

```typescript
const base = process.env.VITE_API_BASE_URL!.replace(/\/$/, '');
const res = await fetch(`${base}/v1/test/reset-organization`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Test-Reset-Token': process.env.TEST_RESET_SECRET!,
  },
  body: JSON.stringify({
    ensure_fixtures: true,
    ...(process.env.TEST_ORG_ID ? { organization_id: process.env.TEST_ORG_ID } : {}),
  }),
});
if (!res.ok) throw new Error(await res.text());
const data = await res.json();
// persistir data.organization_id em TEST_ORG_ID para o job
```

### `POST /v1/test/seed`

Sem JWT; mesmo header `X-Test-Reset-Token`.

**Request:**

```typescript
interface SeedTestOrganizationRequest {
  organization_id: string;
  /** empty | recurring_e2e | dashboard_e2e */
  profile: string;
}
```

**Response (200):**

```typescript
interface SeedTestOrganizationResponse {
  organization_id: string;
  profile: string;
  seeded: Record<string, number>;
}
```

Ordem recomendada no CI: `reset-organization` → `seed` (se usar perfil diferente de `empty`).

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
9. **Status de Transações**: O campo `status` em `Transaction` pode ser `"pending"`, `"completed"` ou `"cancelled"`. Use o filtro `status` em `GET /v1/transactions` para filtrar por status.
10. **Orçamentos**: O campo `status` em `Budget` é calculado automaticamente: `"ok"` (< 80% usado), `"warning"` (80-100%), `"exceeded"` (> 100%).
11. **Transações Recorrentes (legado)**: Após `POST /{rt_id}/generate`, a `next_occurrence` é avançada automaticamente. O frontend deve atualizar o objeto local após essa chamada. **Este modelo está sendo substituído por `/v1/recurring-series`.**
12. **Séries Recorrentes (novo)**: Use `/v1/recurring-series` para criar e gerenciar transações recorrentes. O backend materializa as ocorrências automaticamente (lazy) — o frontend não precisa chamar nenhum endpoint separado para "gerar" transações. Simplesmente consulte `/v1/transactions` com um `date_start`/`date_end` e as ocorrências já estarão presentes.
13. **Contribuições de Metas**: Ao registrar uma contribuição via `POST /v1/goals/{goal_id}/contributions`, o campo `current_amount` da meta é incrementado atomicamente no servidor — não é necessário fazer PATCH na meta separadamente.
14. **Notificações**: O campo `data` em `Notification` é um objeto JSON livre — seu conteúdo varia conforme o `type` da notificação (ex: `budget_exceeded`, `goal_progress`, `recurring_generated`).

---

**Última atualização**: Abril 2026 (v1 API — Fincla v2 + Recurring Series)

