// types/api.ts

// ===== AUTENTICAÇÃO =====
export type UserRole = 'owner' | 'member' | 'consultant';

export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Compact subscription embedded in legacy auth payloads.
 *
 * Returned by ``POST /auth/login`` and ``GET /auth/me``. The richer object
 * with the embedded ``Plan`` and full billing lifecycle lives at
 * ``GET /v1/subscriptions/me`` (see ``Subscription`` further down).
 */
export interface EmbeddedSubscription {
  /** Slug do plano (``essential``, ``pro``, ``beta``, …). */
  plan: string;
  status:
    | 'active'
    | 'pending_payment'
    | 'past_due'
    | 'cancelled'
    | 'expired'
    | 'inactive';
  max_organizations: number;
  max_users_per_org: number;
  /** Feature keys; lê do plano subjacente quando o backend popula. */
  features?: string[];
}

export interface LoginResponse {
  token: string;
  user_id: string;
  email: string;
  role: UserRole;
  subscription: EmbeddedSubscription;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  onboarding_completed: boolean;
  created_at: string;
  subscription?: EmbeddedSubscription;
}

// ===== PLANOS, ASSINATURA E FATURAS =====

export type PlanAudience = 'standard' | 'consultant';

export interface Plan {
  id: string;
  name: string;
  description: string;
  audience: PlanAudience;
  monthly_price_cents: number;
  yearly_price_cents: number | null;
  max_organizations: number;
  max_users_per_org: number;
  features: string[];
  display_order: number;
}

export interface ListPlansResponse {
  items: Plan[];
}

export type SubscriptionStatus =
  | 'active'
  | 'pending_payment'
  | 'past_due'
  | 'cancelled'
  | 'expired';

export type SubscriptionGatewayProvider = 'asaas' | 'manual';

export type BillingCycle = 'monthly' | 'yearly';

export interface Subscription {
  id: string;
  plan: Plan;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  gateway_provider: SubscriptionGatewayProvider;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  recent_invoices: Invoice[];
}

export type InvoiceStatus =
  | 'pending'
  | 'paid'
  | 'overdue'
  | 'refunded'
  | 'cancelled';

export type InvoicePaymentMethod = 'credit_card' | 'pix' | 'boleto';

export interface Invoice {
  id: string;
  subscription_id?: string;
  amount_cents: number;
  currency: string;
  status: InvoiceStatus;
  due_date: string;
  paid_at: string | null;
  payment_method: InvoicePaymentMethod | null;
  invoice_url: string | null;
  pdf_url: string | null;
  description: string;
}

export interface ListInvoicesResponse {
  items: Invoice[];
  limit: number;
  offset: number;
}

export interface ChangePlanRequest {
  target_plan_id: string;
  billing_cycle?: BillingCycle;
  /**
   * Apenas dígitos (11 para CPF, 14 para CNPJ). Enviado quando o backend
   * sinaliza ``code: "cpf_required"`` — primeira contratação de quem chegou
   * sem ter passado o documento no signup (beta tester, conta legada).
   * Não persistimos localmente; vai direto para o gateway de pagamento.
   */
  cpf_cnpj?: string;
}

export interface ChangePlanResponse {
  subscription_id: string;
  target_plan_id: string;
  status: SubscriptionStatus;
  /** ASAAS hosted checkout. ``null`` quando o gateway só aplicou um update. */
  checkout_url: string | null;
}

export interface CancelSubscriptionResponse {
  subscription_id: string;
  status: SubscriptionStatus;
  cancel_at_period_end: boolean;
  /** ISO 8601 datetime. ``null`` quando ainda não há período pago. */
  effective_until: string | null;
}

export interface UpdateProfileRequest {
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  onboarding_completed?: boolean | null;
}

// ===== ORGANIZAÇÕES =====
/** Valores canônicos em respostas; no POST/PATCH o backend aceita aliases em PT. */
export type OrgTypeCanonical = 'personal' | 'couple' | 'family' | 'business';

export interface CreateOrganizationRequest {
  name: string;
  description?: string | null;
  org_type?: OrgTypeCanonical | string;
  monthly_income?: number | string | null;
  avatar_url?: string | null;
}

export interface Organization {
  id: string;
  name: string;
  description: string | null;
  org_type: string | null;
  monthly_income: number | null;
  avatar_url: string | null;
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

export type OrganizationInvitationStatus =
  | 'pending'
  | 'accepted'
  | 'cancelled'
  | 'expired';

export interface OrganizationInvitation {
  id: string;
  email: string;
  organization_id: string;
  status: OrganizationInvitationStatus;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  cancelled_at: string | null;
  last_sent_at: string | null;
}

export interface CreateOrganizationInvitationsResponse {
  invitations: OrganizationInvitation[];
}

export interface ListOrganizationInvitationsResponse {
  total: number;
  invitations: OrganizationInvitation[];
}

export interface ResendOrganizationInvitationResponse {
  invitation: OrganizationInvitation;
}

export interface AcceptInvitationRequest {
  token: string;
  first_name?: string | null;
  last_name?: string | null;
  password: string;
}

export interface AcceptInvitationResponse {
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
    role: 'member';
    created_at: string;
  };
  invitation: OrganizationInvitation;
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

/**
 * Resposta do POST /whatsapp-connections: o vínculo nasce PENDENTE. O
 * `verification_code` (6 dígitos) aparece só aqui — o usuário precisa enviá-lo
 * ao bot pelo WhatsApp, do número que está vinculando, para ativar.
 */
export interface PendingWhatsAppLink {
  status: 'pending';
  connection_id: string;
  phone_number: string;
  verification_code: string;
  expires_at: string; // ISO 8601
  wa_me_url: string; // deep link para o bot com o código: "https://wa.me/55...?text=123456"
}

/** Número do próprio bot, para a UI exibir e criar deep link. */
export interface WhatsAppAssistantInfo {
  phone_number: string;
  display_name: string;
  wa_me_url: string;
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

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface ChangePasswordResponse {
  message: string;
  user_id: string;
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

export interface CreateTagTypeRequest {
  name: string;
  description?: string | null;
  is_required?: boolean;
  max_per_transaction?: number | null;
}

export interface UpdateTagTypeRequest {
  name?: string;
  description?: string | null;
  is_required?: boolean;
  max_per_transaction?: number | null;
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
  /** Lucide em kebab-case; ver fincla-api/docs/FRONTEND_API_GUIDE.md — Tags */
  icon_key: string | null;
  /** Tipo `detalhe`: UUID da categoria pai; `null` para categorias */
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
  type: 'income' | 'expense' | 'refund';
  description: string;
  /** Obrigatório: pelo menos uma tag do tipo categoria (ver guia da API) */
  tag_ids: string[];
  value: number;
  payment_method: string;
  date: string; // ISO datetime string (YYYY-MM-DDTHH:MM or YYYY-MM-DDTHH:MM:SS)
  card_id?: number | null;
  modality?: 'cash' | 'installment' | 'refund' | null;
  installments_count?: number | null;
  recurring?: boolean;
  category?: string | null; // Campo legado
  /** FK opcional para a transação estornada. Só válida quando type='refund'. */
  refund_of_transaction_id?: number | null;
  /** Conta de liquidação (Fase 0). Omitido => conta default da org. */
  account_id?: string | null;
  /** Quando preenchido, a transação nasce paga (status='paid'); omitir => compromisso pendente (confirmed). */
  paid_at?: string | null;
}

export interface UpdateTransactionRequest {
  type?: 'income' | 'expense' | 'refund';
  description?: string;
  tag_ids?: string[];
  value?: number;
  payment_method?: string;
  date: string; // REQUIRED - ISO datetime string
  recurring?: boolean;
  category?: string; // Campo legado
  /** Obrigatório para associar cobrança de cartão; não use last4 no lugar (ver guia da API). */
  card_id?: number;
  modality?: 'cash' | 'installment' | 'refund';
  installments_count?: number;
}

/** Resumo agregado dos estornos linkados a uma transação. */
export interface RefundsSummary {
  count: number;
  total_value: number;
}

export interface Transaction {
  id: number;
  organization_id: string;
  type: 'income' | 'expense' | 'refund';
  description: string;
  tags: Record<string, Tag[]>;
  value: number;
  payment_method: string;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
  recurring: boolean;
  /** Presente quando a transação foi materializada a partir de uma série (`/v1/recurring-series`). */
  series_id?: string | null;
  created_at: string;
  updated_at: string;
  /** Occurrence-based: set when the transaction is a credit-card installment. */
  credit_card_id?: number | null;
  installment_info?: InstallmentInfo[] | null;
  category?: string | null; // Campo legado
  // Campos derivados (modality é inferido de installment_info no adapter)
  card_last4?: string | null;
  modality?: 'cash' | 'installment' | 'refund' | null;
  installments_count?: number | null;
  /** Set apenas quando type='refund' e o estorno aponta para uma compra original. */
  refund_of_transaction_id?: number | null;
  /** Resumo dos estornos linkados a esta transação. Sempre vem populado quando count > 0. */
  refunds_summary?: RefundsSummary | null;
  /** Lista completa dos estornos linkados. Só vem quando include_refunds=true. */
  refunds?: Transaction[] | null;
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
  organization_id: string;
  type?: 'income' | 'expense' | 'refund';
  category?: string;
  /** Um valor, ou vários (casa com qualquer um) — serializado como param repetido. */
  payment_method?: string | string[];
  description?: string;
  status?: 'pending' | 'completed' | 'cancelled';
  tag_id?: string;
  date_start?: string;
  date_end?: string;
  value_min?: number;
  value_max?: number;
  recurring?: boolean;
  page?: number;
  limit?: number;
  sort_by?: SortByField;
  sort_order?: SortOrder;
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
  organization_id: string;
  type?: 'income' | 'expense' | 'refund';
  category?: string;
  /** Quando o filtro da UI usa UUID da tag categoria (alinhado a GET /transactions) */
  tag_id?: string;
  /** Um valor, ou vários (casa com qualquer um) — serializado como param repetido. */
  payment_method?: string | string[];
  description?: string;
  date_start?: string;
  date_end?: string;
  value_min?: number;
  value_max?: number;
  /** `true` = só transações recorrentes; `false` = só não recorrentes */
  recurring?: boolean;
}

export interface PeriodInfo {
  start_date: string | null;
  end_date: string | null;
}

export interface FiltersInfo {
  organization_id: string;
  type: string | null;
  category: string | null;
  /** Eco dos métodos aplicados, já normalizados. */
  payment_methods: string[] | null;
  date_start: string | null;
  date_end: string | null;
  recurring?: boolean | null;
  tag_id?: string | null;
}

/** Projeção de recorrências na mesma janela que date_start/date_end (séries ativas; não é soma de linhas em transactions). */
export interface RecurringInPeriod {
  total_expense: number;
  total_income: number;
  period: {
    start_date: string;
    end_date: string;
  };
  series_count_expense?: number;
  series_count_income?: number;
}

export interface TransactionsSummaryResponse {
  total_transactions: number;
  total_value: number;
  total_income: number;
  /** Bruto — soma absoluta de transações type='expense' (não desconta estornos). */
  total_expenses: number;
  /** Bruto — soma absoluta de transações type='refund'. */
  total_refunds: number;
  /** Líquido — total_income − total_expenses + total_refunds. */
  balance: number;
  average_transaction: number;
  period: PeriodInfo;
  filters_applied: FiltersInfo;
  /** Presente quando date_start e date_end são enviados e válidos (inclusivos). */
  recurring_in_period?: RecurringInPeriod;
}

// ===== CARTÕES DE CRÉDITO =====
export interface CreateCreditCardRequest {
  organization_id: string;
  last4: string;
  brand: string;
  due_day: number;
  description?: string | null;
  credit_limit?: number;
  closing_day?: number;
  color?: string;
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
  credit_limit: number | null;
  closing_day: number | null;
  color: string | null;
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

export interface PurchaseInfo {
  purchase_date: string;
  total_value: number;
  last_installment_date: string;
  remaining_after_this: number;
}

export interface InvoiceItemResponse {
  id: number;
  // Occurrence-based: the installment IS a transaction; `id` and `transaction_id`
  // are the installment transaction id; `series_id` groups the purchase.
  series_id: string | null;
  transaction_id: number;
  transaction_date: string;
  description: string;
  amount: number;
  installment_number: number;
  total_installments: number;
  tags: Record<string, Tag[]>;
  purchase_info?: PurchaseInfo;
}

export interface InvoiceResponse {
  month: string;
  due_date: string;
  total_amount: number;
  status: 'open' | 'closed' | 'paid';
  items: InvoiceItemResponse[];
  closing_date: string | null;
  days_until_due: number;
  is_overdue: boolean;
  paid_date: string | null;
  previous_month_total: number | null;
  month_over_month_change: number | null;
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
  paid_date?: string;
}

export interface InvoiceMarkPaidResponse {
  card_id: number;
  year: number;
  month: number;
  status: string;
  paid_date: string | null;
}

// ===== MOVER PARCELA ENTRE FATURAS =====
export interface MoveInstallmentRequest {
  target_year: number;
  target_month: number;
}

export interface MoveInstallmentResponse {
  success: boolean;
  message: string;
}

// ===== COMPROMISSOS FUTUROS (CARTÕES) =====
export interface MonthSummary {
  year: number;
  month: number;
  month_name: string;
  amount: number;
}

export interface FutureInstallmentItem {
  description: string;
  amount: number;
  installment_number: number;
  total_installments: number;
  category_name: string | null;
  category_color: string | null;
}

export interface MonthlyBreakdown {
  year: number;
  month: number;
  month_name: string;
  total_amount: number;
  limit_usage_percent: number | null;
  installments_count: number;
  top_installments: FutureInstallmentItem[];
}

export interface EndingInstallment {
  description: string;
  purchase_date: string;
  total_value: number;
  monthly_amount: number;
  total_installments: number;
  remaining_installments: number;
  last_installment_date: string;
  last_installment_month: string;
  category_name: string | null;
}

export interface FutureCommitmentsInsight {
  type: 'ending_commitment' | 'best_month' | 'limit_warning' | 'decreasing_trend' | 'no_commitments' | 'card_distribution' | 'total_reduction' | 'best_card_for_purchase';
  icon: string;
  message: string;
}

export interface FutureCommitmentsResponse {
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
  insights: FutureCommitmentsInsight[];
}

export interface CardCommitmentSummary {
  card_id: number;
  card_name: string;
  card_last4: string;
  credit_limit: number | null;
  total_committed: number;
  percentage_of_total: number;
}

export interface MonthlyTotal {
  year: number;
  month: number;
  month_name: string;
  total_amount: number;
  by_card: { card_id: number; card_name: string; amount: number }[];
}

export interface EndingInstallmentAllCards {
  card_id: number;
  card_name: string;
  description: string;
  monthly_amount: number;
  remaining_installments: number;
  last_installment_month: string;
}

export interface ConsolidatedCommitmentsResponse {
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
  global_insights: FutureCommitmentsInsight[];
}

// ===== METAS (GOALS) =====
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

export type GoalTerm = 'short' | 'medium' | 'long';

/** M4: resumo de projeção embutido em cada Goal (alimenta o chip). */
export interface GoalProjectionSummary {
  months_to_target: number | null;
  completion_date: string | null;
  on_track: boolean | null;
  months_vs_deadline: number | null; // >0 atrasado, <0 adiantado
}

/** M4: projeção detalhada (endpoint /goals/{id}/projection → modal). */
export interface GoalProjection {
  summary: GoalProjectionSummary;
  monthly_contribution: number;
  annual_return_rate: number;
  required_monthly: number | null;
  series: number[];
}

export interface Goal {
  id: string;
  organization_id: string;
  name: string;
  target_amount: number;
  current_amount: number; // derivado (read-only)
  deadline: string | null;
  status: 'active' | 'completed' | 'cancelled';
  description: string | null;
  created_at: string;
  updated_at: string | null;
  progress: number; // Porcentagem 0-100
  // Campos de planejamento (M1):
  type: string | null;
  term: GoalTerm | null;
  priority: number | null;
  monthly_target: number | null;
  annual_return_rate: number | null;
  // Projeção (M4):
  projection: GoalProjectionSummary | null;
}

// ===== CONTRIBUIÇÕES DE METAS =====
export interface CreateGoalContributionRequest {
  amount: number;
  contributed_at?: string | null; // YYYY-MM-DD (default: hoje)
  note?: string | null;
}

export interface GoalContribution {
  id: string;
  goal_id: string;
  amount: number;
  contributed_at: string;
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

// ===== ORÇAMENTOS (BUDGETS) =====
/** Alinhado ao domínio da API (`VALID_PERIOD_TYPES`). */
export type BudgetPeriodType = 'monthly' | 'yearly';

export interface CreateBudgetRequest {
  tag_id: string;
  amount: number;
  period_type?: BudgetPeriodType;
  start_date?: string | null;
  end_date?: string | null;
}

export interface UpdateBudgetRequest {
  amount?: number | null;
  period_type?: BudgetPeriodType | null;
  is_active?: boolean | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface Budget {
  id: string;
  organization_id: string;
  tag_id: string;
  tag_name: string;
  /** Quando o backend enviar, alinha ícone à UI (Lucide `icon_key`) */
  tag_icon_key?: string | null;
  tag_color: string | null;
  amount: number;
  period_type: BudgetPeriodType;
  is_active: boolean;
  spent_amount: number;
  remaining_amount: number;
  usage_percent: number;
  status: 'ok' | 'warning' | 'exceeded';
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

/** POST /v1/budgets/preview-transaction */
export interface PreviewTransactionRequest {
  organization_id: string;
  type: 'expense' | 'income';
  value: number;
  tag_id: string | null;
  date: string;
  payment_method?: string | null;
  installments_count?: number | null;
  card_id?: number | null;
}

export interface PreviewTransactionCategoryBlock {
  tag_id: string | null;
  tag_name: string | null;
  budget_amount: string | null;
  spent_before: string;
  spent_after: string;
  usage_percent_before: number | null;
  usage_percent_after: number | null;
  remaining_before: string | null;
  remaining_after: string | null;
}

export interface PreviewTransactionBudgetsSummary {
  total_budgeted: string;
  total_spent_before: string;
  total_spent_after: string;
  total_remaining_after: string;
  percent_of_total_budget_after: number | null;
}

export interface PreviewTransactionMonthProjection {
  projected_total_expenses_end_of_month: string;
  projected_percent_of_budget: number | null;
  label_context: string;
}

export interface PreviewTransactionResponse {
  category: PreviewTransactionCategoryBlock;
  budgets_summary: PreviewTransactionBudgetsSummary;
  month_projection: PreviewTransactionMonthProjection | null;
}

/** GET /v1/analytics/spending-by-day */
export interface SpendingByDayPoint {
  date: string;
  total_expenses: string;
}

export interface SpendingByDayResponse {
  points: SpendingByDayPoint[];
  currency: string;
  period: { start: string; end: string };
}

// ===== TRANSAÇÕES RECORRENTES =====
export interface CreateRecurringTransactionRequest {
  type: 'income' | 'expense';
  description: string;
  value: number;
  payment_method: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  tag_ids?: string[];
  day_of_month?: number | null;
  day_of_week?: number | null;
  end_date?: string | null;
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
  start_date: string;
  next_occurrence: string;
  is_active: boolean;
  tags: Array<{
    id: string;
    name: string;
    color: string | null;
    icon_key?: string | null;
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
  occurrence_date: string;
  value_override?: number | null;
}

export interface GenerateFromRecurringResponse {
  next_occurrence: string;
  /** Presente quando o backend retorna o ID da transação gerada */
  transaction_id?: number;
}

// ===== SÉRIES RECORRENTES (novo modelo; substitui gradualmente recurring-transactions) =====

/** Tag associada a uma série (mesmo perfil das tags em `RecurringTransaction`). */
export interface SeriesTag {
  id: string;
  name: string;
  color: string | null;
  icon_key?: string | null;
  is_default: boolean;
  is_active: boolean;
  organization_id: string;
  tag_type: { id: string; name: string } | null;
}

export type RecurringSeriesFrequency = 'monthly' | 'weekly' | 'biweekly' | 'yearly' | 'custom';
export type RecurringSeriesIntervalUnit = 'day' | 'week' | 'month';
export type RecurringSeriesValueKind = 'exact' | 'approximate';

export interface RecurringSeries {
  id: string;
  organization_id: string;
  type: 'income' | 'expense';
  description: string;
  value: number;
  value_kind: RecurringSeriesValueKind;
  category: string;
  payment_method: string;
  frequency: RecurringSeriesFrequency;
  start_date: string;
  next_occurrence: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tags: SeriesTag[];
  day_of_month?: number | null;
  /** 0 = domingo … 6 = sábado (contrato do guia para séries). */
  day_of_week?: number | null;
  end_date?: string | null;
  credit_card_id?: number | null;
  notes?: string | null;
  /** Quantos `interval_unit`s entre ocorrências; sempre 1 quando frequency ≠ 'custom'. */
  interval: number;
  /** Obrigatório quando frequency='custom'; null caso contrário. */
  interval_unit: RecurringSeriesIntervalUnit | null;
}

/** Resumo da lista de séries; mesmos campos que `RecurringTransactionsSummary`. */
export type RecurringSeriesListSummary = RecurringTransactionsSummary;

/** Mesma semântica que `TransactionsSummaryResponse.recurring_in_period`. */
export interface RecurringSeriesSummaryForPeriod {
  total_expense: number;
  total_income: number;
  period: { start_date: string; end_date: string };
  series_count_expense?: number;
  series_count_income?: number;
}

export interface RecurringSeriesListResponse {
  series: RecurringSeries[];
  summary: RecurringSeriesListSummary;
  /** Com date_start + date_end válidos na query. */
  summary_for_period?: RecurringSeriesSummaryForPeriod;
}

/** Parâmetros opcionais de `GET /recurring-series`. */
export interface ListRecurringSeriesParams {
  isActive?: boolean;
  dateStart?: string;
  dateEnd?: string;
}

export interface CreateRecurringSeriesRequest {
  type: 'income' | 'expense';
  description: string;
  value: number;
  payment_method: string;
  frequency: RecurringSeriesFrequency;
  start_date: string;
  tag_ids?: string[];
  value_kind?: RecurringSeriesValueKind;
  category?: string;
  day_of_month?: number | null;
  day_of_week?: number | null;
  end_date?: string | null;
  credit_card_id?: number | null;
  notes?: string | null;
  /** Obrigatório quando frequency='custom' (>=1). */
  interval?: number;
  /** Obrigatório quando frequency='custom'. */
  interval_unit?: RecurringSeriesIntervalUnit | null;
}

export interface UpdateRecurringSeriesRequest {
  description?: string;
  value?: number;
  value_kind?: RecurringSeriesValueKind;
  category?: string;
  payment_method?: string;
  frequency?: RecurringSeriesFrequency;
  start_date?: string;
  day_of_month?: number | null;
  day_of_week?: number | null;
  end_date?: string | null;
  credit_card_id?: number | null;
  notes?: string | null;
  tag_ids?: string[] | null;
  interval?: number | null;
  interval_unit?: RecurringSeriesIntervalUnit | null;
}

export interface RecurringSeriesToggleRequest {
  is_active: boolean;
}

export interface ChangeSeriesValueRequest {
  new_value: number;
  value_kind?: RecurringSeriesValueKind;
  notes?: string | null;
}

export interface ChangeSeriesValueResponse {
  series: RecurringSeries;
}

// ===== ANALYTICS =====
export interface MonthDataPoint {
  year: number;
  month: number;
  month_name: string;
  total_income: number;
  total_expenses: number;
  balance: number;
}

export interface MonthlyEvolutionResponse {
  months: MonthDataPoint[];
  period_start: string;
  period_end: string;
}

export interface CategoryDataPoint {
  tag_id: string;
  tag_name: string;
  /** Quando o backend enviar, melhora o mapa PT + Lucide */
  tag_icon_key?: string | null;
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
  tag_icon_key?: string | null;
  monthly_totals: number[];
  average: number;
  trend: 'up' | 'down' | 'stable';
  tag_color: string | null;
}

export interface SpendingRhythmResponse {
  months: string[];
  categories: SpendingRhythmCategory[];
  monthly_totals: number[];
}

export interface PeriodSummary {
  start: string;
  end: string;
  total_income: number;
  total_expenses: number;
  balance: number;
}

export interface PeriodChanges {
  income_change_pct: number | null;
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
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  organization_id: string | null;
  data: Record<string, unknown> | null;
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
  confidence: number;
  processing_time: number;
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
  target_date: string;
}

export interface SimulateFinancialImpactRequest {
  organization_id: string;
  new_card_commitments?: NewCardCommitment[];
  savings_goals?: SavingsGoal[];
  simulation_months?: number; // 1-60, default: 6
}

export type SimulationVerdict = 'viable' | 'caution' | 'high-risk';
export type SimulationStatus = 'success' | 'warning' | 'danger';

export interface MonthlyProjection {
  month: string;
  projected_income: number;
  base_expenses: number;
  card_commitments: number;
  savings_goal: number;
  total_expenses: number;
  balance: number;
  status: SimulationStatus;
}

export interface SimulateFinancialImpactResponse {
  months: MonthlyProjection[];
  global_verdict: SimulationVerdict;
  summary: {
    income: number;
    base_expenses: number;
    card_commitments: number;
    savings_goal: number;
  };
}

// ===== CONSULTANT DASHBOARD =====
export interface ConsultantSummaryQuery {
  date_start?: string;
  date_end?: string;
}

export interface ConsultantSummaryResponse {
  total_income: number;
  total_expenses: number;
  balance: number;
  total_transactions: number;
  organizations_count: number;
  period_start: string | null;
  period_end: string | null;
}

// Alias for naming consistency
export type ConsultantConsolidatedSummaryResponse = ConsultantSummaryResponse;

export interface ConsultantClient {
  organization_id: string;
  organization_name: string;
  /** Always 'consultant' — the consultant's own org (role owner) is excluded server-side. */
  role: 'consultant';
  membership_created_at: string;
  /** Owner's display name; falls back to organization_name. */
  client_name: string;
  /**
   * Canonical 0–100 financial health score (`financial_health_scores`) — the same
   * number the client's own panel and the AI evaluation report.
   *
   * `null` means "not computed yet", NOT zero. A client that was never evaluated
   * must not be painted green or red, does not belong to any health band, and
   * sorts last. Use `POST /consultant/clients/{id}/health/recompute` to force it.
   */
  health: number | null;
  /** ISO 8601 timestamp of the canonical snapshot, or null when never computed. */
  health_computed_at: string | null;
  /** income − expenses over the trailing 12-month window (decimal string). */
  balance: string;
  /** balance / income * 100 (can be negative). */
  savings_pct: number;
  /** unpaid card debt / income * 100. */
  debt_pct: number;
  /** last vs previous month balance. */
  trend: 'up' | 'down' | 'flat';
  /** date (YYYY-MM-DD) of the most recent transaction, or null. */
  last_active: string | null;
  /** net worth: total_all (all active accounts) − unpaid card debt (decimal string). */
  patrimonio: string;
  /** true = consultant-created client who hasn't set their password yet. */
  pending_activation?: boolean;
}

export interface ConsultantClientsResponse {
  total: number;
  clients: ConsultantClient[];
  /**
   * Clients still without a score in THIS response, because the server-side
   * backfill hit its per-request cap. They are filled in on later visits.
   */
  health_pending: number;
}

/** `POST /consultant/clients/{organization_id}/health/recompute`. */
export interface ClientHealthResponse {
  organization_id: string;
  score: number;
  /** Read back from the persisted snapshot — never the caller's clock. */
  computed_at: string;
}

// Alias for naming consistency
export type ListConsultantClientsResponse = ConsultantClientsResponse;

export interface ActiveGoalsCountQuery {
  as_of_date?: string;
}

export interface TotalCreditCardDebtQuery {
  as_of_date?: string;
}

export interface CashFlowQuery {
  date_start?: string;
  date_end?: string;
}

export interface ExpensesByCategoryQuery {
  date_start?: string;
  date_end?: string;
}

export interface IncomeCommitmentQuery {
  date_start?: string;
  date_end?: string;
}

export interface GoalsProgressByTypeQuery {
  as_of_date?: string;
}

export interface ClientsAtRiskQuery {
  as_of_date?: string;
  limit?: number;
  gasto_maior_renda_meses?: number;
  endividamento_max_percent?: number;
  exigir_reserva_emergencia?: boolean;
}

export interface FinancialHealthIndexResponse {
  /**
   * Mean of the canonical health score of every client that has a snapshot.
   * `null` when nobody has been scored yet — NOT `0`, which would read as
   * "the whole wallet is bankrupt".
   */
  index: number | null;
  /** How many clients entered the mean. */
  clients_scored: number;
  /** Clients without a snapshot: excluded from the mean, never counted as zero. */
  clients_pending: number;
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
  client_name: string;
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

// ===== FERRAMENTAS DE TESTE E2E (rotas só em dev/test/staging) =====

export interface ResetTestOrganizationRequest {
  organization_id?: string;
  ensure_fixtures?: boolean;
  owner_user_id?: string;
}

export interface TestResetOrganizationResponse {
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

export interface SeedTestOrganizationRequest {
  organization_id: string;
  profile: string;
}

export interface SeedTestOrganizationResponse {
  organization_id: string;
  profile: string;
  seeded: Record<string, number>;
}

// ===== ERROS =====
export interface ApiError {
  detail: string;
  status?: number;
}

// ===== Tipos legados mantidos para compatibilidade (deprecated) =====
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

// ===== CONTAS / SALDO / TRANSFERÊNCIAS (Fase 0 — cash model) =====

export type AccountType = 'checking' | 'savings' | 'investment' | 'wallet' | 'crypto';

export interface Account {
  id: string;
  organization_id: string;
  name: string;
  type: AccountType;
  currency: string;
  initial_balance: number;
  initial_date: string; // YYYY-MM-DD
  is_active: boolean;
  include_in_total: boolean;
  created_at: string;
  institution?: string | null;
  color?: string | null;
  icon_key?: string | null;
  updated_at?: string | null;
}

export interface CreateAccountRequest {
  name: string;
  type: AccountType;
  initial_balance?: number;
  initial_date?: string | null; // YYYY-MM-DD
  currency?: string;
  institution?: string | null;
  color?: string | null;
  icon_key?: string | null;
  include_in_total?: boolean | null;
}

export interface UpdateAccountRequest {
  name?: string;
  type?: AccountType;
  institution?: string | null;
  color?: string | null;
  icon_key?: string | null;
  is_active?: boolean;
  include_in_total?: boolean;
}

/** Saldo realizado de uma conta (caixa). */
export interface AccountBalance {
  account_id: string;
  name: string;
  type: AccountType;
  currency: string;
  initial_balance: number;
  balance: number;
  include_in_total: boolean;
}

export interface OrgBalances {
  as_of: string;
  total: number; // soma das contas include_in_total
  accounts: AccountBalance[];
}

export interface TypeBalance {
  type: AccountType;
  balance: number;
  account_count: number;
}

export interface BalanceSummary {
  as_of: string;
  total_available: number; // contas include_in_total
  total_all: number;       // todas as contas ativas
  account_count: number;
  by_type: TypeBalance[];
}

export interface CreateTransferRequest {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  date?: string | null;
  note?: string | null;
}

export interface Transfer {
  id: string;
  organization_id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  date: string;
  created_at: string;
  note?: string | null;
}

// ===== AJUSTES DE SALDO (Balance Adjustments) =====

/** Body para criar um ajuste de saldo (reconciliação). */
export interface CreateBalanceAdjustmentRequest {
  amount: number; // delta com sinal, != 0
  reason: string; // justificativa obrigatória (1..500)
  date?: string | null; // "YYYY-MM-DD"; default: agora; futura é rejeitada
}

/** Ajuste de saldo retornado pela API. NÃO é transação (fora de receita/despesa). */
export interface BalanceAdjustment {
  id: string;
  account_id: string;
  amount: number;
  date: string; // datetime
  reason: string;
  created_by: string | null;
  created_at: string;
}

// ===== SAÚDE FINANCEIRA · CAPACIDADE DE ECONOMIA (M3) =====

export interface MonthlyCapacityPoint {
  year: number;
  month: number;
  month_name: string;
  income: number;
  expense: number; // líquido (bruto − estornos)
  surplus: number; // income − expense
}

export interface EconomyCapacity {
  window_months: number;       // tamanho da janela pedida
  months_with_data: number;    // meses da janela que tiveram movimento
  avg_income: number;
  avg_expense: number;
  avg_surplus: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  months: MonthlyCapacityPoint[];        // meses completos, do mais antigo ao mais recente
  current_month: MonthlyCapacityPoint | null; // mês corrente parcial (não entra na média)
}

// ===== M5 — PLANEJADO × REALIZADO (MONTHLY PLANS) =====
export interface MonthlyPlanItemComparison {
  tag_id: string | null;
  tag_name: string | null;
  kind: 'income' | 'expense';
  planned: number;
  actual: number;
  variance: number; // actual - planned
  in_plan: boolean; // false = realizado sem alvo
}
export interface MonthlyPlanComparison {
  year: number;
  month: number;
  has_plan: boolean;
  status: string;
  notes: string | null;
  planned_income: number;
  planned_expense: number;
  actual_income: number;
  actual_expense: number;
  items: MonthlyPlanItemComparison[];
}
export interface MonthlyPlanItemBody {
  tag_id?: string | null;
  kind: 'income' | 'expense';
  planned_amount: number;
  notes?: string | null;
}
export interface MonthlyPlanUpsertBody {
  planned_income: number;
  planned_expense: number;
  notes?: string | null;
  status?: string;
  items: MonthlyPlanItemBody[];
}

// ===== M7 — PAINEL DE SAÚDE FINANCEIRA =====
export interface FinancialHealth {
  reference_month: string;
  ativo: number;
  passivo: number;
  patrimonio_liquido: number;
  avg_income: number;
  avg_expense: number;
  avg_surplus: number;
  income_commitment: number; // despesa/renda (0..1+)
  savings_rate: number; // sobra/renda (0..1)
  emergency_fund_months: number;
  goals_on_track: number;
  goals_total: number;
  goal_progress_avg: number;
  cash_flow_risk: 'low' | 'medium' | 'high';
  score: number; // 0..100
}

// ===== CONSULTOR IA — A1 ("Avaliar com IA") =====
// Contrato canônico: fincla-api/src/application/ai/contracts.py (`EvaluateClientOutput`).
// O `FRONTEND_API_GUIDE.md` §17 documenta o mesmo contrato — se os dois divergirem,
// o Pydantic ganha. O modelo nunca gera imagens nem hex: só `ChartSpec` com tokens.

/** Tokens do design system que o modelo pode referenciar. Nunca hex. */
export type ChartColor = 'green' | 'red' | 'ink' | 'purple' | 'amber' | 'blue';

/** Conjunto FECHADO: cada tipo exige um renderer correspondente no <AiChart>. */
export type ChartType = 'line' | 'bar' | 'composed' | 'donut';

/** Como a série é desenhada. Relevante sobretudo em `composed`. */
export type ChartSeriesKind = 'bar' | 'line' | 'area';

/** Formatadores que já existem no FE. O backend escolhe; o FE aplica. */
export type ChartValueFormat = 'brl0' | 'pct' | 'int';

export type ActionPriority = 'high' | 'medium' | 'low';

export interface ChartSeries {
  key: string;
  name: string;
  kind: ChartSeriesKind;
  color: ChartColor;
}

export interface ChartAxis {
  key: string;
}

export interface ChartSpec {
  type: ChartType;
  title: string;
  x: ChartAxis;
  series: ChartSeries[];
  data: Array<Record<string, unknown>>;
  value_format: ChartValueFormat;
}

/** Liga um item do plano de ação a uma métrica real de tool (grounding). */
export interface EvidenceItem {
  metric: string;
  value: string | number | boolean | null;
  source_tool: string;
}

export interface ActionPlanItem {
  title: string;
  rationale: string;
  priority: ActionPriority;
  evidence: EvidenceItem[];
}

/** Indicador a acompanhar. É um OBJETO, não uma string. */
export interface WatchPoint {
  metric: string;
  note: string;
}

export interface HealthRead {
  score: number;
  label: string;
  headline: string;
}

export interface EvaluateClientOutput {
  summary: string;
  health_read: HealthRead;
  action_plan: ActionPlanItem[];
  watch_points: WatchPoint[];
  charts: ChartSpec[];
  /** Obrigatório (>= 1) — framing CVM, advisor-facing. */
  disclaimers: string[];
}

export interface AiEvaluationRequest {
  /** Continuidade de sessão Agno. A1 é one-shot — normalmente ausente. */
  session_id?: string;
}

export interface AiEvaluationResponse {
  correlation_id: string;
  session_id: string;
  run_id: string;
  output: EvaluateClientOutput;
}
