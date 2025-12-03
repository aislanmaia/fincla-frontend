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

// ===== TRANSAÇÕES =====
export interface CreateTransactionRequest {
  organization_id: string;
  type: 'income' | 'expense';
  description: string;
  category: string;
  value: number; // Decimal como number
  payment_method: string;
  date: string; // ISO date string (YYYY-MM-DD)
  // Campos opcionais para cartão de crédito
  card_last4?: string | null;
  modality?: 'cash' | 'installment' | null;
  installments_count?: number | null;
  tag_ids?: string[];
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
  // Tags retornadas como array (formato real da API)
  tags?: Tag[];
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
  brand: string; // Ex: "Visa", "Mastercard"
  due_day: number; // 1-31
  description?: string | null;
}

export interface UpdateCreditCardRequest {
  organization_id: string;
  last4?: string;
  brand?: string;
  due_day?: number;
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
  status: 'open' | 'closed' | 'overdue' | 'paid';
  items: InvoiceItemResponse[];
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
export interface FinancialSimulationRequest {
  purchase_amount: number;
  installments: number;
  start_date?: string; // ISO date string (YYYY-MM-DD)
}

export type SimulationVerdict = 'viable' | 'caution' | 'high-risk';
export type SimulationStatus = 'success' | 'warning' | 'danger';

export interface SimulationTimelineItem {
  month: string; // Nome do mês (ex: "Janeiro")
  year: number;
  month_iso: string; // "YYYY-MM"
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
