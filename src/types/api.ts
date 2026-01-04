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
  first_name?: string | null;
  last_name?: string | null;
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

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface ChangePasswordResponse {
  message: string;
  user_id: string;
}

// ===== TRANSAÇÕES =====
export interface CreateTransactionRequest {
  organization_id: string;
  type: 'income' | 'expense';
  description: string;
  category: string;
  value: number; // Decimal como number
  payment_method: string;
  date: string; // ISO datetime string (YYYY-MM-DDTHH:MM or YYYY-MM-DDTHH:MM:SS) - REQUIRED, supports minute granularity
  // Campos opcionais para cartão de crédito
  card_last4?: string | null;
  card_id?: number | null; // ID do cartão (usado para atualizar credit_card_charge)
  modality?: 'cash' | 'installment' | null;
  installments_count?: number | null;
  tag_ids?: string[];
  // Marcador de recorrência para previsões futuras
  recurring?: boolean;
}

export interface CreditCardCharge {
  charge: {
    id: number;
    organization_id: string;
    card_id: number;
    transaction_id: number;
    total_amount: number;
    installments_count: number;
    modality: 'cash' | 'installment';
    purchase_date: string;
  };
  card: {
    id: number;
    organization_id: string;
    last4: string;
    brand: string;
    due_day: number;
    description: string | null;
  };
}

export interface Transaction {
  id: number;
  organization_id: string;
  type: 'income' | 'expense';
  description: string;
  category: string;
  value: number;
  payment_method: string;
  date: string; // ISO date string
  // Tags agrupadas por nome do tipo (ex: { "categoria": [Tag], "projeto": [Tag] })
  tags?: Record<string, Tag[]> | Tag[]; // Suporta ambos os formatos para compatibilidade
  // Campos opcionais para cartão de crédito (legado - mantido para compatibilidade)
  card_last4?: string | null;
  modality?: 'cash' | 'installment' | null;
  installments_count?: number | null;
  recurring?: boolean;
  // Novo campo retornado pelo GET quando payment_method é "Cartão de Crédito" ou "credit_card"
  credit_card_charge?: CreditCardCharge | null;
  // Timestamps de criação e atualização
  created_at?: string; // ISO datetime string - timestamp quando a transação foi criada
  updated_at?: string; // ISO datetime string - timestamp quando a transação foi atualizada
}

export interface ListTransactionsQuery {
  organization_id?: string;
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
  brand: string; // "visa" | "mastercard" | "elo" | "amex" | "hipercard" | "other"
  due_day: number; // 1-31
  description?: string | null;
  credit_limit?: number;
  closing_day?: number; // 1-31
  color?: string; // Hex color pattern: ^#[0-9A-Fa-f]{6}$
}

export interface UpdateCreditCardRequest {
  organization_id: string;
  last4?: string;
  brand?: string;
  due_day?: number;
  description?: string | null;
  credit_limit?: number;
  closing_day?: number;
  color?: string;
}

export interface CreditCard {
  id: number;
  organization_id: string;
  last4: string;
  brand: string;
  due_day: number;
  description: string | null;
  // Novos campos
  credit_limit: number | null;
  closing_day: number | null;
  color: string | null; // Hex color like #FF5733
  // Campos calculados (read-only)
  available_limit: number | null;
  used_limit: number;
  limit_usage_percent: number | null;
}

export interface CategoryBreakdown {
  category_id: string | null;
  category_name: string;
  category_color: string;
  total: number;
  percentage: number;
  transaction_count: number;
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
  status: 'open' | 'closed' | 'paid';
  items: InvoiceItemResponse[];
  // Novos campos calculados
  closing_date: string | null;
  days_until_due: number;
  is_overdue: boolean;
  paid_date: string | null;
  previous_month_total: number | null;
  month_over_month_change: number | null; // Pode ser negativo (gastou menos)
  limit_usage_percent: number | null;
  items_count: number;
  category_breakdown: CategoryBreakdown[];
}

// ===== HISTÓRICO DE FATURAS =====
export interface InvoiceHistoryItem {
  year: number;
  month: number;
  month_name: string;
  total_amount: number;
  status: string;
  items_count: number;
  top_category: string | null;
}

export interface InvoiceHistorySummary {
  total_spent: number;
  average_monthly: number;
  highest_month: { month: string; amount: number } | null;
  lowest_month: { month: string; amount: number } | null;
}

export interface InvoiceHistoryResponse {
  card_id: number;
  card_name: string;
  period_start: string;
  period_end: string;
  summary: InvoiceHistorySummary;
  monthly_data: InvoiceHistoryItem[];
}

// ===== MARCAR FATURA COMO PAGA =====
export interface MarkInvoicePaidRequest {
  paid_date?: string; // ISO date, defaults to today
}

export interface InvoiceMarkPaidResponse {
  card_id: number;
  year: number;
  month: number;
  status: string;
  paid_date: string | null;
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

// ===== ERROS =====
export interface ApiError {
  detail: string;
  status?: number;
}

// ===== METAS (GOALS) =====
export interface Goal {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  target_amount: number;
  current_amount: number;
  target_date?: string; // ISO date string
  category?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateGoalRequest {
  organization_id: string;
  name: string;
  description?: string;
  target_amount: number;
  target_date?: string;
  category?: string;
}

export interface UpdateGoalRequest {
  name?: string;
  description?: string;
  target_amount?: number;
  current_amount?: number;
  target_date?: string;
  category?: string;
}

// ===== SIMULADOR FINANCEIRO =====
export interface NewCardCommitment {
  card_last4: string; // Últimos 4 dígitos do cartão
  value: number; // Valor total da compra (decimal)
  installments_count: number; // Número de parcelas (1-120)
  description: string; // Descrição da compra (1-255 caracteres)
}

export interface SavingsGoal {
  target_amount: number; // Valor alvo da meta (decimal)
  current_amount: number; // Valor já economizado (decimal, >= 0)
  target_date: string; // Data alvo no formato YYYY-MM-DD
}

export interface SimulateFinancialImpactRequest {
  organization_id: string; // UUID da organização
  new_card_commitments?: NewCardCommitment[]; // Novos compromissos de cartão (opcional)
  savings_goals?: SavingsGoal[]; // Metas de economia (opcional)
  simulation_months?: number; // Número de meses para simular (1-12, padrão: 6)
}

export type SimulationVerdict = 'viable' | 'caution' | 'high-risk';
export type SimulationStatus = 'success' | 'warning' | 'danger';

export interface MonthlyProjection {
  month: string; // Formato: "YYYY-MM" (ex: "2025-01")
  projected_income: number; // Receita projetada do mês
  base_expenses: number; // Despesas base (excluindo cartões)
  card_commitments: number; // Compromissos de cartão do mês
  savings_goal: number; // Contribuição para metas de economia
  total_expenses: number; // Total de despesas (base + cartões + metas)
  balance: number; // Saldo (receita - despesas)
  status: SimulationStatus; // Status do mês
}

export interface SimulateFinancialImpactResponse {
  months: MonthlyProjection[]; // Projeções mês a mês
  global_verdict: SimulationVerdict; // Veredito global
  summary: {
    income: number; // Total de receita no período
    base_expenses: number; // Total de despesas base
    card_commitments: number; // Total de compromissos de cartão
    savings_goal: number; // Total de contribuições para metas
  };
}

// Tipos legados mantidos para compatibilidade (deprecated)
/** @deprecated Use SimulateFinancialImpactRequest instead */
export interface FinancialSimulationRequest {
  purchase_amount: number;
  installments: number;
  start_date?: string;
}

/** @deprecated Use SimulateFinancialImpactResponse instead */
export interface FinancialSimulationResponse {
  simulation_id: string;
  summary: {
    verdict: SimulationVerdict;
    verdict_message: string;
    total_impact: number;
    duration_months: number;
  };
  timeline: SimulationTimelineItem[];
}

/** @deprecated Use MonthlyProjection instead */
export interface SimulationTimelineItem {
  month: string;
  year: number;
  month_iso: string;
  financial_data: {
    projected_income: number;
    base_expenses: number;
    existing_commitments: number;
    new_installment: number;
    total_obligations: number;
    savings_goal: number;
  };
  result: {
    projected_balance: number;
    status: SimulationStatus;
    meets_goal: boolean;
  };
}
