# Consultant Dashboard Full Implementation Plan

## Overview

This plan details the complete implementation of the consultant dashboard feature, including:
- Updated sidebar menu items
- Full API integration (11 endpoints)
- KPI cards with financial metrics
- Charts and visualizations
- Date range and snapshot date pickers

## Architecture

### Data Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                     Consultant Dashboard                         │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────┐ │
│  │ Date Range  │  │  Snapshot   │  │   Query Parameters    │ │
│  │   Picker    │  │ Date Picker │  │   (date_start,        │ │
│  └──────┬──────┘  └──────┬──────┘  │    date_end,         │ │
│         │                │         │    as_of_date)        │ │
│         └────────────────┼─────────┴───────────────────────┘ │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              useConsultantData Hook (Custom)                ││
│  │  - useConsultantSummary()                                  ││
│  │  - useConsultantClients()                                  ││
│  │  - useFinancialHealthIndex()                               ││
│  │  - useActiveGoalsCount()                                   ││
│  │  - useTotalCreditCardDebt()                                ││
│  │  - useCashFlow()                                           ││
│  │  - useExpensesByCategory()                                 ││
│  │  - useIncomeCommitment()                                   ││
│  │  - useGoalsProgressByType()                                ││
│  │  - useClientsAtRisk()                                      ││
│  └────────────────────────────┬────────────────────────────────┘│
└───────────────────────────────┼─────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                    API Client Layer                              │
│  src/api/consultant.ts                                          │
│  - getConsultantSummary()                                       │
│  - getConsultantClients()                                       │
│  - getFinancialHealthIndex()                                    │
│  - getActiveGoalsCount()                                        │
│  - getTotalCreditCardDebt()                                     │
│  - getCashFlow()                                                │
│  - getExpensesByCategory()                                      │
│  - getIncomeCommitment()                                        │
│  - getGoalsProgressByType()                                     │
│  - getClientsAtRisk()                                           │
└──────────────────────────────────────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Backend API (/v1/consultant/*)               │
└──────────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Phase 1: Core Infrastructure

#### 1.1 Update Sidebar Menu Items
**File:** `src/layouts/AppLayout.tsx`

Add new menu items for consultant area:
- Dashboard (`/consultant`)
- Meus Clientes (`/consultant/clients`)
- Relatórios (`/consultant/reports`)
- Metas dos Clientes (`/consultant/clients-goals`)
- Configurações (`/consultant/settings`)

```typescript
// New sidebar items to add:
const consultantMenuItems = [
  { href: '/consultant', icon: LayoutGrid, label: 'Dashboard' },
  { href: '/consultant/clients', icon: Users, label: 'Meus Clientes' },
  { href: '/consultant/reports', icon: PieChart, label: 'Relatórios' },
  { href: '/consultant/clients-goals', icon: Target, label: 'Metas dos Clientes' },
  { href: '/consultant/settings', icon: Settings, label: 'Configurações' },
];
```

#### 1.2 Add TypeScript Types
**File:** `src/types/api.ts`

Add types for all consultant endpoints:

```typescript
// Query types
export interface ConsultantSummaryQuery {
  date_start?: string;
  date_end?: string;
}

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

// Response types
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
```

#### 1.3 Implement API Endpoints
**File:** `src/api/consultant.ts`

Add all 8 missing API functions:

```typescript
export const getFinancialHealthIndex = async (
  params?: ConsultantSummaryQuery
): Promise<FinancialHealthIndexResponse> => {
  const response = await apiClient.get<FinancialHealthIndexResponse>(
    '/consultant/financial-health-index',
    { params }
  );
  return response.data;
};

export const getActiveGoalsCount = async (
  params?: ActiveGoalsCountQuery
): Promise<ActiveGoalsCountResponse> => {
  const response = await apiClient.get<ActiveGoalsCountResponse>(
    '/consultant/active-goals-count',
    { params }
  );
  return response.data;
};

export const getTotalCreditCardDebt = async (
  params?: TotalCreditCardDebtQuery
): Promise<TotalCreditCardDebtResponse> => {
  const response = await apiClient.get<TotalCreditCardDebtResponse>(
    '/consultant/total-credit-card-debt',
    { params }
  );
  return response.data;
};

export const getCashFlow = async (
  params?: CashFlowQuery
): Promise<CashFlowResponse> => {
  const response = await apiClient.get<CashFlowResponse>(
    '/consultant/cash-flow',
    { params }
  );
  return response.data;
};

export const getExpensesByCategory = async (
  params?: ExpensesByCategoryQuery
): Promise<ExpensesByCategoryResponse> => {
  const response = await apiClient.get<ExpensesByCategoryResponse>(
    '/consultant/expenses-by-category',
    { params }
  );
  return response.data;
};

export const getIncomeCommitment = async (
  params?: IncomeCommitmentQuery
): Promise<IncomeCommitmentResponse> => {
  const response = await apiClient.get<IncomeCommitmentResponse>(
    '/consultant/income-commitment',
    { params }
  );
  return response.data;
};

export const getGoalsProgressByType = async (
  params?: GoalsProgressByTypeQuery
): Promise<GoalsProgressByTypeResponse> => {
  const response = await apiClient.get<GoalsProgressByTypeResponse>(
    '/consultant/goals-progress-by-type',
    { params }
  );
  return response.data;
};

export const getClientsAtRisk = async (
  params?: ClientsAtRiskQuery
): Promise<ClientsAtRiskResponse> => {
  const response = await apiClient.get<ClientsAtRiskResponse>(
    '/consultant/clients-at-risk',
    { params }
  );
  return response.data;
};
```

#### 1.4 Create Custom Hooks
**File:** `src/hooks/useConsultantData.ts`

Extend existing hooks and add new ones:

```typescript
// Existing hooks to extend
export function useConsultantSummary(params?: ConsultantSummaryQuery) {
  return useQuery({
    queryKey: ['consultant-summary', params?.date_start, params?.date_end],
    queryFn: () => getConsultantSummary(params),
    retry: false,
  });
}

export function useConsultantClients() {
  return useQuery({
    queryKey: ['consultant-clients'],
    queryFn: getConsultantClients,
    retry: false,
  });
}

// New hooks to add
export function useFinancialHealthIndex(params?: ConsultantSummaryQuery) {
  return useQuery({
    queryKey: ['consultant-financial-health', params?.date_start, params?.date_end],
    queryFn: () => getFinancialHealthIndex(params),
    retry: false,
  });
}

export function useActiveGoalsCount(asOfDate?: string) {
  return useQuery({
    queryKey: ['consultant-active-goals', asOfDate],
    queryFn: () => getActiveGoalsCount({ as_of_date: asOfDate }),
    retry: false,
  });
}

export function useTotalCreditCardDebt(asOfDate?: string) {
  return useQuery({
    queryKey: ['consultant-credit-card-debt', asOfDate],
    queryFn: () => getTotalCreditCardDebt({ as_of_date: asOfDate }),
    retry: false,
  });
}

export function useCashFlow(params?: CashFlowQuery) {
  return useQuery({
    queryKey: ['consultant-cash-flow', params?.date_start, params?.date_end],
    queryFn: () => getCashFlow(params),
    retry: false,
  });
}

export function useExpensesByCategory(params?: ExpensesByCategoryQuery) {
  return useQuery({
    queryKey: ['consultant-expenses-category', params?.date_start, params?.date_end],
    queryFn: () => getExpensesByCategory(params),
    retry: false,
  });
}

export function useIncomeCommitment(params?: IncomeCommitmentQuery) {
  return useQuery({
    queryKey: ['consultant-income-commitment', params?.date_start, params?.date_end],
    queryFn: () => getIncomeCommitment(params),
    retry: false,
  });
}

export function useGoalsProgressByType(asOfDate?: string) {
  return useQuery({
    queryKey: ['consultant-goals-progress', asOfDate],
    queryFn: () => getGoalsProgressByType({ as_of_date: asOfDate }),
    retry: false,
  });
}

export function useClientsAtRisk(params?: ClientsAtRiskQuery) {
  return useQuery({
    queryKey: ['consultant-clients-at-risk', params?.as_of_date, params?.limit],
    queryFn: () => getClientsAtRisk(params),
    retry: false,
  });
}
```

### Phase 2: UI Components

#### 2.1 KPI Cards Component
**File:** `src/components/consultant/ConsultantKPICards.tsx`

Update to show:
- Total de Clientes (from `organizations_count`)
- Índice de Saúde Financeira Médio (from `FinancialHealthIndexResponse.index`)
- Dívida Total em Cartões (from `TotalCreditCardDebtResponse.total_debt`)
- Metas de Economia em Progresso (from `ActiveGoalsCountResponse.active_goals_count`)

```typescript
interface ConsultantKPICardsProps {
  summary?: ConsultantSummaryResponse;
  healthIndex?: FinancialHealthIndexResponse;
  creditCardDebt?: TotalCreditCardDebtResponse;
  activeGoals?: ActiveGoalsCountResponse;
  isLoading?: boolean;
}

// Layout: 4 cards in a row
// Card 1: Clients (icon: Users)
// Card 2: Financial Health Index (icon: Heart/Pulse) - show as percentage gauge
// Card 3: Credit Card Debt (icon: CreditCard) - show as currency
// Card 4: Active Goals (icon: Target)
```

#### 2.2 Financial Health Index Gauge
**File:** `src/components/consultant/FinancialHealthGauge.tsx`

A radial gauge showing:
- Overall index (0-100)
- Balance score
- Debt score  
- Reserve score

```typescript
interface FinancialHealthGaugeProps {
  data?: FinancialHealthIndexResponse;
  isLoading?: boolean;
}

// Implementation: Use radial bar chart or custom SVG gauge
// Colors: Green (70+), Yellow (40-70), Red (<40)
```

#### 2.3 Cash Flow Chart
**File:** `src/components/consultant/CashFlowChart.tsx`

Bar chart showing monthly:
- Income (green bars)
- Expenses (red bars)
- Balance line overlay

```typescript
interface CashFlowChartProps {
  data?: CashFlowResponse;
  isLoading?: boolean;
}

// Implementation: Use existing IncomeExpenseBarChart or create new
```

#### 2.4 Expenses by Category Pie Chart
**File:** `src/components/consultant/ExpensesByCategoryChart.tsx`

Pie/Donut chart showing expense distribution by category.

```typescript
interface ExpensesByCategoryChartProps {
  data?: ExpensesByCategoryResponse;
  isLoading?: boolean;
}

// Implementation: Use existing ExpensePieChart component
```

#### 2.5 Income Commitment Chart
**File:** `src/components/consultant/IncomeCommitmentChart.tsx`

Line/Area chart showing monthly income commitment percentage.

```typescript
interface IncomeCommitmentChartProps {
  data?: IncomeCommitmentResponse;
  isLoading?: boolean;
}
```

#### 2.6 Goals Progress Chart
**File:** `src/components/consultant/GoalsProgressChart.tsx`

Horizontal bar chart showing progress by goal type.

```typescript
interface GoalsProgressChartProps {
  data?: GoalsProgressByTypeResponse;
  isLoading?: boolean;
}
```

#### 2.7 Clients at Risk List
**File:** `src/components/consultant/ClientsAtRiskList.tsx`

List of clients with risk indicators:
- Organization name
- Risk score (with color coding)
- Main situation
- Current balance

```typescript
interface ClientsAtRiskListProps {
  data?: ClientsAtRiskResponse;
  isLoading?: boolean;
}
```

#### 2.8 Date/Snapshot Picker Component
**File:** `src/components/consultant/ConsultantDateControls.tsx`

Combined controls for:
- Date range picker (for period-based data)
- Snapshot date picker (for point-in-time data)

```typescript
interface ConsultantDateControlsProps {
  dateRange?: { from: Date; to: Date };
  snapshotDate?: Date;
  onDateRangeChange?: (range: { from: Date; to: Date } | undefined) => void;
  onSnapshotDateChange?: (date: Date | undefined) => void;
}

// Implementation: Combine existing DateRangePicker with single date picker
// Show/hide based on which data types need which
```

### Phase 3: Dashboard Integration

#### 3.1 Update Consultant Dashboard Page
**File:** `src/pages/consultant/index.tsx`

Update to include all components:

```tsx
export default function ConsultantDashboard() {
  // State for date controls
  const [dateRange, setDateRange] = useState<DateRange>(...);
  const [snapshotDate, setSnapshotDate] = useState<Date>(...);

  // Query params construction
  const periodParams = dateRange ? {
    date_start: format(dateRange.from, 'yyyy-MM-dd'),
    date_end: format(dateRange.to, 'yyyy-MM-dd'),
  } : undefined;

  const snapshotParams = snapshotDate 
    ? { as_of_date: format(snapshotDate, 'yyyy-MM-dd') }
    : undefined;

  // Data fetching
  const { data: summary } = useConsultantSummary(periodParams);
  const { data: healthIndex } = useFinancialHealthIndex(periodParams);
  const { data: creditCardDebt } = useTotalCreditCardDebt(snapshotDate ? format(snapshotDate, 'yyyy-MM-dd') : undefined);
  const { data: activeGoals } = useActiveGoalsCount(snapshotDate ? format(snapshotDate, 'yyyy-MM-dd') : undefined);
  const { data: cashFlow } = useCashFlow(periodParams);
  const { data: expensesByCategory } = useExpensesByCategory(periodParams);
  const { data: incomeCommitment } = useIncomeCommitment(periodParams);
  const { data: goalsProgress } = useGoalsProgressByType(snapshotDate ? format(snapshotDate, 'yyyy-MM-dd') : undefined);
  const { data: clientsAtRisk } = useClientsAtRisk({ ...snapshotParams, limit: 10 });
  const { data: clients } = useConsultantClients();

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Date Controls */}
        <ConsultantDateControls
          dateRange={dateRange}
          snapshotDate={snapshotDate}
          onDateRangeChange={setDateRange}
          onSnapshotDateChange={setSnapshotDate}
        />

        {/* KPI Cards Row */}
        <ConsultantKPICards
          summary={summary}
          healthIndex={healthIndex}
          creditCardDebt={creditCardDebt}
          activeGoals={activeGoals}
        />

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CashFlowChart data={cashFlow} />
          <ExpensesByCategoryChart data={expensesByCategory} />
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FinancialHealthGauge data={healthIndex} />
          <IncomeCommitmentChart data={incomeCommitment} />
        </div>

        {/* Goals Progress */}
        <GoalsProgressChart data={goalsProgress} />

        {/* Clients at Risk */}
        <ClientsAtRiskList data={clientsAtRisk} />

        {/* Client List */}
        <ConsultantClientList clients={clients?.clients} />
      </div>
    </PageTransition>
  );
}
```

### Phase 4: Routing

#### 4.1 Add New Routes
**File:** `src/App.tsx`

Add routes for new consultant pages:

```tsx
<Route path="/consultant/clients" component={ConsultantClientsPage} />
<Route path="/consultant/reports" component={ConsultantReportsPage} />
<Route path="/consultant/clients-goals" component={ConsultantClientsGoalsPage} />
<Route path="/consultant/settings" component={ConsultantSettingsPage} />
```

### Phase 5: Testing

#### 5.1 Test Coverage
- Unit tests for all new hooks
- Integration tests for API calls
- Component tests for UI elements

## Summary

### Files to Create
1. `src/components/consultant/ConsultantKPICards.tsx`
2. `src/components/consultant/FinancialHealthGauge.tsx`
3. `src/components/consultant/CashFlowChart.tsx`
4. `src/components/consultant/ExpensesByCategoryChart.tsx`
5. `src/components/consultant/IncomeCommitmentChart.tsx`
6. `src/components/consultant/GoalsProgressChart.tsx`
7. `src/components/consultant/ClientsAtRiskList.tsx`
8. `src/components/consultant/ConsultantDateControls.tsx`

### Files to Modify
1. `src/types/api.ts` - Add TypeScript types
2. `src/api/consultant.ts` - Add API functions
3. `src/hooks/useConsultantData.ts` - Add hooks
4. `src/layouts/AppLayout.tsx` - Update sidebar
5. `src/pages/consultant/index.tsx` - Update dashboard
6. `src/App.tsx` - Add routes

### Dependencies
- Reuse existing chart components from `src/components/charts/`
- Reuse existing UI components from `src/components/ui/`
- Use existing `DateRangePicker` component
