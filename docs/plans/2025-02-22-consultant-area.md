# Área do Consultor — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar a área do consultor com dashboard consolidado, lista de clientes e visão dedicada por cliente com URLs compartilháveis.

**Architecture:** Rotas explícitas (`/consultant`, `/consultant/clients/:organizationId`). `useOrganization` prioriza `organizationId` da URL quando em rota de cliente. Reuso total de Dashboard, Transações, Relatórios, etc. Consultor detectado via `user.subscription.features`.

**Tech Stack:** React, TypeScript, wouter, TanStack Query, axios. Ver `docs/FRONTEND_API_GUIDE.md` (seção "Endpoints da Área do Consultor").

**Design doc:** `docs/plans/2025-02-22-consultant-area-design.md`

---

## Task 1: Tipos e API do consultor

**Files:**
- Modify: `src/types/api.ts`
- Create: `src/api/consultant.ts`

**Step 1: Adicionar tipos em `src/types/api.ts`**

Adicionar após os tipos de Goals (ou em seção apropriada):

```typescript
// ===== CONSULTANT =====
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

export interface ConsultantClient {
  organization_id: string;
  organization_name: string;
  role: 'owner' | 'member';
  membership_created_at: string;
}

export interface ConsultantClientsResponse {
  total: number;
  clients: ConsultantClient[];
}
```

**Step 2: Criar `src/api/consultant.ts`**

```typescript
import apiClient from './client';
import type {
  ConsultantSummaryQuery,
  ConsultantSummaryResponse,
  ConsultantClientsResponse,
} from '../types/api';

export const getConsultantSummary = async (
  params?: ConsultantSummaryQuery
): Promise<ConsultantSummaryResponse> => {
  const response = await apiClient.get<ConsultantSummaryResponse>(
    '/consultant/summary',
    { params }
  );
  return response.data;
};

export const getConsultantClients = async (): Promise<ConsultantClientsResponse> => {
  const response = await apiClient.get<ConsultantClientsResponse>(
    '/consultant/clients'
  );
  return response.data;
};

export const getConsultantConsolidatedReport = async (
  params?: ConsultantSummaryQuery
): Promise<ConsultantSummaryResponse> => {
  const response = await apiClient.get<ConsultantSummaryResponse>(
    '/consultant/reports/consolidated',
    { params }
  );
  return response.data;
};
```

**Step 3: Verificar compilação**

Run: `npm run check`  
Expected: PASS

**Step 4: Commit**

```bash
git add src/types/api.ts src/api/consultant.ts
git commit -m "feat(consultant): add API types and client"
```

---

## Task 2: Utilitário isConsultant

**Files:**
- Create: `src/lib/consultant.ts`

**Step 1: Criar `src/lib/consultant.ts`**

```typescript
import type { User } from '@/types/api';

const CONSULTANT_FEATURES = [
  'multi_org_dashboard',
  'client_list',
  'consolidated_reports',
] as const;

export function isConsultant(user: User | null | undefined): boolean {
  if (!user?.subscription?.features?.length) return false;
  return CONSULTANT_FEATURES.some((f) =>
    user.subscription!.features!.includes(f)
  );
}
```

**Step 2: Escrever teste**

Create: `src/lib/__tests__/consultant.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { isConsultant } from '../consultant';
import type { User } from '@/types/api';

describe('isConsultant', () => {
  it('returns false when user is null', () => {
    expect(isConsultant(null)).toBe(false);
  });

  it('returns false when user has no subscription', () => {
    expect(isConsultant({ id: '1', email: 'a@b.com', role: 'owner', created_at: '' } as User)).toBe(false);
  });

  it('returns true when user has multi_org_dashboard', () => {
    const user: User = {
      id: '1',
      email: 'a@b.com',
      role: 'owner',
      created_at: '',
      subscription: { plan: 'premium', status: 'active', max_organizations: 10, max_users_per_org: 5, features: ['multi_org_dashboard'] },
    };
    expect(isConsultant(user)).toBe(true);
  });

  it('returns false when user has no consultant features', () => {
    const user: User = {
      id: '1',
      email: 'a@b.com',
      role: 'owner',
      created_at: '',
      subscription: { plan: 'free', status: 'active', max_organizations: 1, max_users_per_org: 1, features: [] },
    };
    expect(isConsultant(user)).toBe(false);
  });
});
```

**Step 3: Rodar teste**

Run: `npm run test -- src/lib/__tests__/consultant.test.ts`  
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/consultant.ts src/lib/__tests__/consultant.test.ts
git commit -m "feat(consultant): add isConsultant utility"
```

---

## Task 3: useOrganization com suporte a URL

**Files:**
- Modify: `src/hooks/useOrganization.ts`

**Step 1: Adicionar lógica de URL**

- Importar `useRoute` e `useLocation` de `wouter`.
- No início do hook, chamar `const [match, params] = useRoute('/consultant/clients/:organizationId*');` (wouter usa `*` para subrotas) — ou usar `useLocation` e regex/parse para extrair orgId.
- Alternativa mais simples: `useRoute` com padrão exato `/consultant/clients/:organizationId` e, para subrotas, usar outro `useRoute` ou `useLocation` + parse.

Verificar documentação wouter: `useRoute('/consultant/clients/:organizationId')` retorna `[match, params]`. Para subrotas como `/consultant/clients/xyz/transactions`, o padrão `/consultant/clients/:organizationId` pode não dar match. Usar `useRoute('/consultant/clients/:organizationId/:rest*')` ou `useLocation()` e extrair o segundo segmento.

Solução: `const [location] = useLocation();` e `const match = /^\/consultant\/clients\/([^/]+)/.exec(location); const urlOrgId = match?.[1] ?? null;`

**Implementação em `useOrganization.ts`:**

```typescript
import { useLocation } from 'wouter';

// No início do hook, após os imports:
const [location] = useLocation();
const urlOrgIdMatch = /^\/consultant\/clients\/([^/]+)/.exec(location);
const urlOrgId = urlOrgIdMatch?.[1] ?? null;

// O activeOrgId efetivo: URL tem prioridade
const effectiveOrgId = urlOrgId ?? activeOrgId;
```

- Trocar todas as referências a `activeOrgId` no retorno e em `activeOrganization` por `effectiveOrgId` quando for o valor "efetivo" usado pelas páginas.
- Manter `activeOrgId` e `setActiveOrgId` para o estado persistido (localStorage); `effectiveOrgId` é o que as páginas consomem.
- `selectOrganization` ao ser chamado: se estamos em rota de cliente, navegar para `/consultant/clients/${organizationId}` em vez de só setar state (para atualizar a URL).

**Step 2: Atualizar retorno**

Retornar `activeOrgId: effectiveOrgId` (ou `effectiveOrgId` como `activeOrgId` para não quebrar consumidores). Os consumidores usam `activeOrgId` para requests — então o valor retornado deve ser `effectiveOrgId`. Manter o nome `activeOrgId` para compatibilidade.

**Step 3: Garantir que selectOrganization em rota de cliente navegue**

Quando `urlOrgId` existe e chamamos `selectOrganization(newId)`, fazer `setLocation(`/consultant/clients/${newId}`)` para atualizar a URL. Caso contrário, apenas `setActiveOrgId` + localStorage.

**Step 4: Rodar testes existentes**

Run: `npm run test -- src/hooks/`  
Expected: testes passam (pode ser necessário ajustar mocks se useOrganization for testado).

**Step 5: Commit**

```bash
git add src/hooks/useOrganization.ts
git commit -m "feat(consultant): useOrganization prioritizes orgId from URL"
```

---

## Task 4: Hook useConsultantData

**Files:**
- Create: `src/hooks/useConsultantData.ts`

**Step 1: Criar hook**

```typescript
import { useQuery } from '@tanstack/react-query';
import { getConsultantSummary, getConsultantClients } from '@/api/consultant';
import type { ConsultantSummaryQuery } from '@/types/api';

export function useConsultantSummary(params?: ConsultantSummaryQuery) {
  return useQuery({
    queryKey: ['consultant-summary', params?.date_start, params?.date_end],
    queryFn: () => getConsultantSummary(params),
  });
}

export function useConsultantClients() {
  return useQuery({
    queryKey: ['consultant-clients'],
    queryFn: getConsultantClients,
  });
}
```

**Step 2: Commit**

```bash
git add src/hooks/useConsultantData.ts
git commit -m "feat(consultant): add useConsultantSummary and useConsultantClients"
```

---

## Task 5: Página ConsultantDashboard

**Files:**
- Create: `src/pages/consultant/index.tsx`
- Create: `src/components/consultant/ConsultantSummaryCards.tsx`
- Create: `src/components/consultant/ConsultantClientList.tsx`

**Step 1: Criar ConsultantSummaryCards**

Componente que recebe `ConsultantSummaryResponse` e exibe cards (Receitas, Despesas, Balanço, Transações, Clientes). Reutilizar estilos do `SummaryCards` existente.

**Step 2: Criar ConsultantClientList**

Tabela ou lista de clientes com: nome, role, data de vínculo, botão "Ver detalhes" que navega para `/consultant/clients/${client.organization_id}`.

**Step 3: Criar ConsultantDashboard**

Página com DateRangePicker, ConsultantSummaryCards, ConsultantClientList. Usar `useConsultantSummary` e `useConsultantClients`. Tratar loading e erro (403 → toast + mensagem).

**Step 4: Verificar compilação**

Run: `npm run check`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/consultant/index.tsx src/components/consultant/
git commit -m "feat(consultant): add ConsultantDashboard page and components"
```

---

## Task 6: ConsultantClientLayout e rotas

**Files:**
- Create: `src/layouts/ConsultantClientLayout.tsx`
- Modify: `src/App.tsx`
- Modify: `src/layouts/AppLayout.tsx`

**Step 1: Criar ConsultantClientLayout**

Layout que:
- Lê `organizationId` da URL (via `useRoute` ou `useLocation` + parse).
- Garante que `useOrganization` já retorna esse ID (Task 3).
- Renderiza `AppLayout` com children.
- Adiciona breadcrumb: Consultor > [Nome do cliente] (nome vindo de `organizations.find(o => o.id === orgId)`).

**Step 2: Adicionar rotas no App.tsx**

- Rota `/` deve redirecionar para `/consultant` se consultor (componente wrapper ou Redirect).
- Adicionar `<Route path="/consultant" component={ConsultantDashboard} />`.
- Adicionar rotas aninhadas para `/consultant/clients/:organizationId` com ConsultantClientLayout, renderizando Dashboard, Transactions, Reports, etc.

Estrutura sugerida:

```tsx
<Route path="/">
  <DashboardOrRedirect />
</Route>
<Route path="/consultant" component={ConsultantDashboard} />
<Route path="/consultant/clients/:organizationId">
  <ConsultantClientLayout>
    <Switch>
      <Route path="/consultant/clients/:organizationId" component={Dashboard} />
      <Route path="/consultant/clients/:organizationId/transactions" component={TransactionsPage} />
      ...
    </Switch>
  </ConsultantClientLayout>
</Route>
```

Nota: wouter pode precisar de estrutura diferente para rotas aninhadas. Verificar se `Route path="/consultant/clients/:organizationId"` com `component` que renderiza children funciona.

**Step 3: Atualizar AppLayout**

- Adicionar item "Consultor" na sidebar quando `isConsultant(user)`.
- Adicionar `ROUTE_TITLES` para `/consultant` e `/consultant/clients/:organizationId`.
- Em rotas de cliente, o seletor de org deve listar os clientes e navegar para `/consultant/clients/:id` ao trocar.

**Step 4: Criar DashboardOrRedirect**

Componente que usa `useAuth` e `isConsultant`; se consultor, `<Redirect to="/consultant" />`, senão `<Dashboard />`.

**Step 5: Verificar fluxo**

Run: `npm run dev`, navegar manualmente para `/consultant` e `/consultant/clients/:id`.  
Expected: páginas carregam sem erro.

**Step 6: Commit**

```bash
git add src/App.tsx src/layouts/AppLayout.tsx src/layouts/ConsultantClientLayout.tsx
git commit -m "feat(consultant): add routes and ConsultantClientLayout"
```

---

## Task 7: Breadcrumb e navegação

**Files:**
- Modify: `src/components/Breadcrumb.tsx` (ou criar ConsultantBreadcrumb)
- Modify: `src/layouts/AppLayout.tsx`

**Step 1: Breadcrumb para consultor**

Quando em `/consultant`: "Consultor".  
Quando em `/consultant/clients/:id`: "Consultor > [Nome do cliente] > [Página]".

**Step 2: Links na sidebar para cliente**

Os links de Transações, Relatórios, etc. devem apontar para `/consultant/clients/:organizationId/transactions` quando em rota de cliente, em vez de `/transactions`.

**Step 3: Ajustar AppLayout**

AppLayout precisa saber se está em "modo consultor cliente" (via `useLocation` ou prop) para gerar os links corretos.

**Step 4: Commit**

```bash
git add src/components/Breadcrumb.tsx src/layouts/AppLayout.tsx
git commit -m "feat(consultant): breadcrumb and sidebar links for client view"
```

---

## Task 8: Tratamento de erros e estados

**Files:**
- Modify: `src/pages/consultant/index.tsx`
- Modify: `src/hooks/useConsultantData.ts` (opcional: retry false em 403)

**Step 1: Tratar 403**

Se `getConsultantSummary` ou `getConsultantClients` retornar 403, exibir toast "Acesso negado" e opcionalmente redirecionar para `/`. Usar `onError` no useQuery ou verificar `error?.response?.status === 403` no componente.

**Step 2: Estados vazios**

Lista de clientes vazia: mensagem "Nenhum cliente vinculado". Summary com zeros: exibir normalmente.

**Step 3: Commit**

```bash
git add src/pages/consultant/index.tsx src/hooks/useConsultantData.ts
git commit -m "feat(consultant): error handling and empty states"
```

---

## Task 9: Testes e validação final

**Files:**
- Create: `src/pages/consultant/__tests__/ConsultantDashboard.test.tsx` (opcional)
- Modify: `test/mocks/handlers.ts` (mock dos endpoints de consultor)

**Step 1: Mock MSW para consultant**

Adicionar handlers para `GET /v1/consultant/summary` e `GET /v1/consultant/clients` em `test/mocks/handlers.ts`.

**Step 2: Teste de integração (opcional)**

Teste que verifica: usuário consultor vê redirect para /consultant; página consultant exibe summary e lista.

**Step 3: Rodar suite completa**

Run: `npm run test`  
Run: `npm run check`  
Expected: PASS

**Step 4: Commit**

```bash
git add test/mocks/handlers.ts
git commit -m "test(consultant): add MSW handlers for consultant API"
```

---

## Resumo de arquivos

**Criar:**
- `src/api/consultant.ts`
- `src/lib/consultant.ts`
- `src/lib/__tests__/consultant.test.ts`
- `src/hooks/useConsultantData.ts`
- `src/pages/consultant/index.tsx`
- `src/components/consultant/ConsultantSummaryCards.tsx`
- `src/components/consultant/ConsultantClientList.tsx`
- `src/layouts/ConsultantClientLayout.tsx`

**Modificar:**
- `src/types/api.ts`
- `src/hooks/useOrganization.ts`
- `src/App.tsx`
- `src/layouts/AppLayout.tsx`
- `src/components/Breadcrumb.tsx` (ou novo ConsultantBreadcrumb)
- `test/mocks/handlers.ts`
