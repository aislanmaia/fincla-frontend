# Fincla v2 — Requisitos de Backend

> **Documento:** Especificação completa para o backend suportar todas as features do Fincla v2  
> **Base:** Análise de gaps entre `BACKEND_REFERENCE.md`, `FRONTEND_API_GUIDE.md` e o frontend Fincla v2 (ex-Finly v4)  
> **Audiência:** Time de backend responsável pela implementação  
> **Data:** Março 2026

---

## Índice

1. [Resumo Executivo](#1-resumo-executivo)
2. [Metodologia de Análise](#2-metodologia-de-análise)
3. [Gaps Identificados](#3-gaps-identificados)
4. [Novos Modelos de Dados](#4-novos-modelos-de-dados)
5. [Alterações em Modelos Existentes](#5-alterações-em-modelos-existentes)
6. [Novos Endpoints Requeridos](#6-novos-endpoints-requeridos)
7. [Alterações em Endpoints Existentes](#7-alterações-em-endpoints-existentes)
8. [Regras de Negócio Novas ou Alteradas](#8-regras-de-negócio-novas-ou-alteradas)
9. [Tabela de Prioridades](#9-tabela-de-prioridades)
10. [Referência Completa de Contratos de API](#10-referência-completa-de-contratos-de-api)

---

## 1. Resumo Executivo

O backend atual (Fincla v1) tem uma base sólida mas precisa de extensões significativas para suportar o Fincla v2. Os principais domínios de mudança são:

| Domínio | Status Atual | O que falta |
|---|---|---|
| **Orçamentos** | ❌ Inexistente | Modelo + CRUD completo + endpoints de comparação |
| **Recorrências** | ⚠️ Parcial | Apenas flag booleana; falta modelo dedicado com periodicidade, próxima ocorrência e controle de pausa |
| **Transações → Status** | ❌ Ausente | Campo `status` (pendente/confirmado) nas transações |
| **Metas → Contribuições** | ⚠️ Parcial | Falta histórico de aportes; falta DELETE de meta |
| **Organização → Onboarding** | ⚠️ Parcial | Falta `org_type`, `monthly_income`, `avatar_url` |
| **Dashboard** | ⚠️ Parcial | Falta endpoint dedicado de KPIs para o dashboard |
| **Relatórios** | ⚠️ Parcial | Falta série temporal por categoria e evolução mensal |
| **Perfil de Usuário** | ⚠️ Parcial | Falta `avatar_url`, `phone`, `PATCH /users/me` |
| **Categorização IA** | ⚠️ Parcial | Falta endpoint dedicado de sugestão por texto |
| **CSV Export** | ❌ Ausente | Endpoint de exportação de transações |
| **Notificações** | ❌ Ausente | Modelo + sistema mínimo de notificações |
| **Ritmo de Gastos** | ❌ Ausente | Endpoint de evolução temporal por categoria |

**Total de novos endpoints:** ~20 endpoints  
**Novos modelos:** 4 (budgets, recurring_transactions, goal_contributions, notifications)  
**Modelos alterados:** 4 (organizations, transactions, users, goals)

---

## 2. Metodologia de Análise

Para cada tela e feature do Fincla v2, foi verificado:
1. Quais dados a tela precisa consumir
2. Quais endpoints existem no backend atual para satisfazer essa necessidade
3. O que está faltando (endpoint, campo, modelo)
4. Qual a prioridade para o produto funcionar end-to-end

---

## 3. Gaps Identificados

### 3.1 Dashboard (DashboardPage)

**O que precisa:**
- KPIs do mês: total receitas, total despesas, saldo
- Evolução gráfica mensal (últimos 6 meses) — receitas vs despesas
- Distribuição de despesas por categoria (PieChart)
- Últimas 5 transações
- Alertas: orçamentos próximos do limite, metas com prazo chegando
- Saldo disponível em tempo real

**O que existe:**
- `GET /v1/transactions` (com filtros) — ✅ suficiente para últimas transações
- `GET /v1/transactions/summary` — ✅ suficiente para KPIs do mês com filtros de data

**O que falta:**
- Endpoint de evolução mensal: `GET /v1/transactions/monthly-evolution` — retorna receitas e despesas mês a mês
- Endpoint de breakdown por categoria: `GET /v1/transactions/by-category` (o endpoint da área consultiva existe mas não está acessível para usuários comuns)
- Alertas de orçamento — depende da implementação de orçamentos (ver seção 3.5)
- Campos calculados de saldo disponível por organização

---

### 3.2 Transações (TransacoesPage)

**O que precisa:**
- CRUD completo — ✅ existe
- Filtros: período, tipo, categoria, método, busca por texto, ordenação — ✅ existe
- Status da transação: `pendente` ou `confirmado`
- Exportação CSV das transações filtradas
- Tags em chips inline (max 2 visíveis) — ✅ o sistema de tags já suporta

**O que falta:**
- Campo `status` em `transactions` — `"pendente"` | `"confirmado"` (padrão: `"confirmado"`)
- `GET /v1/transactions/export/csv` — exportação das transações filtradas como arquivo CSV
- Filtro por `tag_id` na listagem de transações (atualmente só existe filtro por `category` textual)

---

### 3.3 Ritmo de Gastos (RitmoPage)

**O que precisa:**
- Evolução de gastos por categoria ao longo de N meses
- Gráfico de área empilhada: cada categoria empilhada mês a mês
- Identificação de meses anômalos (gasto acima da média)
- Comparativo mês atual vs mês anterior

**O que existe:**
- Nada específico para esse tipo de análise temporal por categoria

**O que falta:**
- `GET /v1/analytics/spending-rhythm` — série temporal de gastos por categoria e período

---

### 3.4 Recorrências (RecorrenciasPage)

**O que precisa:**
- Lista de recorrências com: nome, valor, dia de vencimento, método, periodicidade, status (ativo/pausado)
- Criar, editar, pausar/reativar, excluir recorrências
- Próximo vencimento calculado
- Total mensal de recorrências ativas
- Gerar transação a partir de recorrência

**O que existe:**
- Campo `recurring: boolean` em `transactions` — ⚠️ insuficiente: marca transação como recorrente mas não modela o ciclo, periodicidade, próximo vencimento, pausa

**O que falta:**
- Novo modelo `recurring_transactions` (ver seção 4.2)
- CRUD completo: `POST /v1/recurring-transactions`, `GET /v1/recurring-transactions`, `GET /v1/recurring-transactions/{id}`, `PATCH /v1/recurring-transactions/{id}`, `DELETE /v1/recurring-transactions/{id}`
- Endpoint de toggle: `PATCH /v1/recurring-transactions/{id}/toggle` (ativo ↔ pausado)
- Endpoint de geração de transação: `POST /v1/recurring-transactions/{id}/generate`

---

### 3.5 Orçamentos (OrcamentosPage)

**O que precisa:**
- Orçamentos por categoria, com valor limite e valor usado no período
- Indicador visual: verde (< 75%), amber (75–99%), vermelho (≥ 100%)
- Criar, editar, excluir orçamentos
- Resumo: total orçado vs total gasto

**O que existe:**
- ❌ Nada — o conceito de orçamento não existe no backend atual

**O que falta:**
- Novo modelo `budgets` (ver seção 4.1)
- CRUD completo com comparação automática vs transações reais

---

### 3.6 Simulação de Despesas (SimulacaoPage)

**O que precisa:**
- Simular impacto de novos compromissos (parcelamentos) no fluxo futuro
- Múltiplos cenários salvos para comparação
- Análise de viabilidade (viável / atenção / alto risco)

**O que existe:**
- `POST /v1/financial-impact/simulate` — ✅ satisfaz a simulação pontual

**O que falta:**
- Persistência de cenários: `POST /v1/simulation-scenarios`, `GET /v1/simulation-scenarios`, `DELETE /v1/simulation-scenarios/{id}`
- O frontend atual trata cenários em memória; para uma versão robusta, precisam ser salvos no backend

---

### 3.7 Metas (MetasPage)

**O que precisa:**
- CRUD de metas — ✅ existe (POST, GET, GET individual, PUT)
- Progresso: `current_amount` vs `target_amount` — ✅ existe
- **Adicionar contribuição** à meta (incrementar `current_amount` com registro de histórico)
- **Excluir** meta — ❌ `DELETE /v1/goals/{id}` não existe
- Histórico de aportes por meta — ❌ não existe

**O que falta:**
- `DELETE /v1/goals/{goal_id}` — excluir meta
- `POST /v1/goals/{goal_id}/contributions` — registrar aporte
- `GET /v1/goals/{goal_id}/contributions` — listar histórico de aportes
- Novo modelo `goal_contributions` (ver seção 4.3)

---

### 3.8 Cartões (CartõesPage)

**O que precisa:**
- CRUD de cartões — ✅ existe
- Fatura mensal — ✅ existe
- Compromissos futuros — ✅ existe
- Histórico de faturas — ✅ existe
- Limite disponível calculado — ✅ existe (retornado em listagem e detalhe)
- **Nome amigável** do cartão — ✅ campo `description` já existe
- Parcelas ativas com progresso — ✅ via fatura

**Status:** ✅ Bem coberto. Sem gaps críticos.

---

### 3.9 Relatórios (RelatoriosPage)

**O que precisa:**
- Resumo: KPIs do período — ✅ via `GET /v1/transactions/summary`
- Evolução mensal (LineChart receita vs despesa) — ⚠️ parcial via filtros iterados
- Breakdown por categoria (BarChart) — ⚠️ não existe endpoint público
- Comparativo período A vs período B — ❌ não existe

**O que falta:**
- `GET /v1/analytics/monthly-evolution` — evolução mensal de receitas e despesas
- `GET /v1/analytics/by-category` — agrupamento de gastos por categoria (versão para usuários comuns, análogo ao endpoint consultivo)
- `GET /v1/analytics/period-comparison` — comparativo entre dois períodos

---

### 3.10 Configurações/Perfil (ConfiguracoesPage)

**O que precisa:**
- Editar nome, sobrenome — ⚠️ `PUT /v1/users/me/password` existe; falta `PATCH /v1/users/me` para dados não-senha
- Avatar URL — ❌ campo não existe em `users`
- Telefone do usuário — ❌ campo não existe (diferente do WhatsApp connection)
- **Tipo de organização**: Personal/Família/Casal/Negócio — ❌ campo não existe em `organizations`
- **Renda mensal da organização** — ❌ campo não existe em `organizations`
- CRUD de Categorias (via tags) — ✅ existe via `POST/PATCH/DELETE /v1/tags`
- Tags por categoria — ✅ via sistema de tags
- Membros da organização — ✅ via memberships
- Avatar da organização — ❌ campo não existe

**O que falta:**
- `PATCH /v1/users/me` — atualizar perfil (nome, avatar_url, phone)
- Campo `avatar_url` em `users`
- Campo `phone` em `users`
- Campo `org_type` em `organizations` (enum: `personal` | `couple` | `family` | `business`)
- Campo `monthly_income` em `organizations` (renda mensal declarada)
- Campo `avatar_url` em `organizations`
- `PATCH /v1/organizations/{org_id}` — atualizar dados da organização

---

### 3.11 Onboarding (OnboardingFlow)

**O que precisa:**
- Registrar tipo da organização (`org_type`)
- Registrar nome da organização
- Registrar renda mensal (`monthly_income`)
- Adicionar primeiro cartão no onboarding

**O que falta:**
- Os campos `org_type` e `monthly_income` em `organizations` (ver 3.10)
- O `POST /v1/organizations` deve aceitar esses campos opcionais
- `GET /v1/users/me` deve indicar se o onboarding foi completado

---

### 3.12 Categorização por IA (feature de sugestão)

**O que precisa:**
- Dado o texto de uma descrição de transação, sugerir: categoria, tags, método provável
- Isso alimenta o botão "Sugerir com IA" na tela de Nova Transação

**O que existe:**
- `POST /v1/ai/chat` — chat geral com o assistente

**O que falta:**
- `POST /v1/ai/categorize` — endpoint dedicado e determinístico que recebe descrição e retorna sugestão estruturada (não chat livre)

---

### 3.13 Notificações (sininho na topbar)

**O que precisa:**
- Lista de notificações do usuário (alertas de orçamento, metas com prazo chegando, faturas vencendo)
- Marcar como lida
- Contador de não lidas

**O que existe:**
- ❌ Nenhum sistema de notificações

**O que falta:**
- Novo modelo `notifications` (ver seção 4.4)
- `GET /v1/notifications` — listar notificações do usuário
- `PATCH /v1/notifications/{id}/read` — marcar como lida
- `PATCH /v1/notifications/read-all` — marcar todas como lidas

---

## 4. Novos Modelos de Dados

### 4.1 `budgets` — Orçamentos

Representa o limite de gastos definido por categoria e período na organização.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | uuid | sim | Chave primária |
| `organization_id` | uuid | sim | FK → `organizations` |
| `tag_id` | uuid | sim | FK → `tags` (tag do tipo "categoria") |
| `amount` | decimal(12,2) | sim | Valor limite do orçamento |
| `period_type` | string | sim | `"monthly"` \| `"yearly"` (padrão: `"monthly"`) |
| `start_date` | date | não | Início da vigência (null = sem início definido) |
| `end_date` | date | não | Fim da vigência (null = recorrente) |
| `is_active` | boolean | sim | Se o orçamento está ativo |
| `created_at` | datetime | sim | Auditoria |
| `updated_at` | datetime | sim | Auditoria |

**Constraints:**
- PK: `id`
- FK: `organization_id → organizations.id` (cascade delete)
- FK: `tag_id → tags.id` (restrict delete)
- UNIQUE: (`organization_id`, `tag_id`, `period_type`) — um orçamento por categoria por tipo de período
- INDEX: `organization_id`

**Campos calculados (não persistidos, retornados na API):**
- `spent_amount` — soma das despesas do período atual que têm essa categoria
- `remaining_amount` — `amount - spent_amount`
- `usage_percent` — `(spent_amount / amount) * 100`
- `status` — `"ok"` | `"warning"` | `"exceeded"` (baseado em `usage_percent`)

---

### 4.2 `recurring_transactions` — Recorrências

Representa um template de transação recorrente com ciclo de repetição definido.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | uuid | sim | Chave primária |
| `organization_id` | uuid | sim | FK → `organizations` |
| `type` | string | sim | `"income"` \| `"expense"` |
| `description` | string | sim | Descrição da recorrência |
| `value` | decimal(12,2) | sim | Valor padrão por ocorrência |
| `payment_method` | string | sim | Mesmo enum de `transactions.payment_method` |
| `tag_ids` | array | sim | Tags aplicadas (armazenado como JSON ou tabela de associação) |
| `frequency` | string | sim | `"monthly"` \| `"weekly"` \| `"biweekly"` \| `"yearly"` |
| `day_of_month` | integer | não | Dia do mês (1-31) para frequência mensal |
| `day_of_week` | integer | não | Dia da semana (0=dom..6=sab) para frequência semanal |
| `start_date` | date | sim | Primeira ocorrência |
| `end_date` | date | não | Última ocorrência (null = sem fim) |
| `next_occurrence` | date | sim | Próxima data calculada |
| `is_active` | boolean | sim | Se a recorrência está ativa (false = pausada) |
| `credit_card_id` | integer | não | FK → `credit_cards` (se pagamento em cartão) |
| `notes` | string | não | Observações livres |
| `created_at` | datetime | sim | Auditoria |
| `updated_at` | datetime | sim | Auditoria |

**Tabela de associação (se não usar JSON):**

`recurring_transaction_tags`:
- `recurring_transaction_id` (uuid, FK)
- `tag_id` (uuid, FK)
- PK composta

**Constraints:**
- PK: `id`
- FK: `organization_id → organizations.id`
- FK: `credit_card_id → credit_cards.id` (nullable)
- INDEX: `organization_id`
- INDEX: `next_occurrence` (para processamento automático futuro)
- INDEX: `is_active`

**Campos calculados:**
- `monthly_total` — soma das recorrências ativas por mês (no contexto da listagem geral)

---

### 4.3 `goal_contributions` — Aportes em Metas

Representa cada contribuição individual feita a uma meta.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | uuid | sim | Chave primária |
| `goal_id` | uuid | sim | FK → `goals` |
| `organization_id` | uuid | sim | FK → `organizations` |
| `amount` | decimal(12,2) | sim | Valor do aporte |
| `note` | string | não | Observação livre |
| `contributed_at` | date | sim | Data do aporte (padrão: hoje) |
| `created_at` | datetime | sim | Auditoria |

**Constraints:**
- PK: `id`
- FK: `goal_id → goals.id` (cascade delete)
- FK: `organization_id → organizations.id`
- INDEX: `goal_id`

**Ao criar um contribution:**
- Incrementar `goals.current_amount` em `amount`
- Se `goals.current_amount >= goals.target_amount`, atualizar `goals.status = "completed"` automaticamente

---

### 4.4 `notifications` — Notificações

Representa notificações geradas pelo sistema para o usuário.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | uuid | sim | Chave primária |
| `user_id` | uuid | sim | FK → `users` |
| `organization_id` | uuid | não | Contexto da organização (pode ser global) |
| `type` | string | sim | Enum de tipos (ver abaixo) |
| `title` | string | sim | Título curto |
| `body` | string | sim | Mensagem completa |
| `data` | json | não | Metadados extras (ex: `goal_id`, `budget_id`) |
| `is_read` | boolean | sim | Se foi lida (padrão: false) |
| `read_at` | datetime | não | Quando foi lida |
| `created_at` | datetime | sim | Auditoria |

**Tipos de notificação (`type`):**
- `budget_warning` — orçamento > 75% do limite
- `budget_exceeded` — orçamento > 100%
- `goal_deadline_approaching` — meta com prazo em ≤ 7 dias
- `goal_completed` — meta atingida
- `invoice_due_soon` — fatura vence em ≤ 3 dias
- `recurring_generated` — transação recorrente gerada automaticamente

**Constraints:**
- PK: `id`
- FK: `user_id → users.id`
- FK: `organization_id → organizations.id` (nullable)
- INDEX: `user_id`
- INDEX: `is_read`
- INDEX: (`user_id`, `is_read`) — para contagem de não lidas

---

### 4.5 `simulation_scenarios` — Cenários de Simulação (Opcional para v2.1)

Representa um cenário de simulação salvo pelo usuário.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | uuid | sim | Chave primária |
| `organization_id` | uuid | sim | FK → `organizations` |
| `name` | string | sim | Nome do cenário |
| `card_commitments` | json | sim | Array de compromissos simulados |
| `savings_goals` | json | não | Array de metas de poupança simuladas |
| `simulation_months` | integer | sim | Horizonte em meses |
| `last_result` | json | não | Último resultado calculado (cache) |
| `created_at` | datetime | sim | Auditoria |
| `updated_at` | datetime | sim | Auditoria |

---

## 5. Alterações em Modelos Existentes

### 5.1 `transactions` — Adicionar campo `status`

| Campo novo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `status` | string | sim | `"pending"` \| `"confirmed"` (padrão: `"confirmed"`) |

**Impacto:**
- Filtro adicional em `GET /v1/transactions`: `status?`
- Campo retornado em todas as respostas de transação
- KPIs do summary devem ter opção de incluir/excluir pendentes
- Transações `"pending"` geradas por recorrências

**Migration:** `ALTER TABLE transactions ADD COLUMN status VARCHAR DEFAULT 'confirmed' NOT NULL;`

---

### 5.2 `organizations` — Adicionar campos de onboarding e perfil

| Campo novo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `org_type` | string | não | `"personal"` \| `"couple"` \| `"family"` \| `"business"` |
| `monthly_income` | decimal(12,2) | não | Renda mensal declarada (para cálculo de impacto) |
| `avatar_url` | string | não | URL do avatar/logo da organização |

**Impacto:**
- `POST /v1/organizations` aceita esses campos opcionais
- `PATCH /v1/organizations/{id}` para atualizar
- Retornados em `GET /v1/memberships/my-organizations` e `GET /v1/organizations/{id}`

---

### 5.3 `users` — Adicionar campos de perfil

| Campo novo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `avatar_url` | string | não | URL do avatar do usuário |
| `phone` | string | não | Telefone para contato (diferente do WhatsApp connection) |
| `onboarding_completed` | boolean | sim | Se completou o fluxo de onboarding (padrão: false) |

**Impacto:**
- `PATCH /v1/users/me` para atualizar `first_name`, `last_name`, `avatar_url`, `phone`
- `GET /v1/users/me` e `GET /v1/auth/me` retornam esses campos
- `onboarding_completed` setado para `true` após completar o onboarding

---

### 5.4 `goals` — Ajuste de comportamento

- Nenhum campo novo necessário no modelo
- Mas o campo `current_amount` deve ser **automaticamente atualizado** pelos `goal_contributions`
- `updated_at` deve ser `NOT NULL` (atualmente está marcado como `nao` na documentação — correção necessária)

---

### 5.5 `transactions` — Filtro por tag_id

Não requer mudança de modelo, mas o endpoint `GET /v1/transactions` precisa suportar filtragem por `tag_id` (UUID de uma tag específica). Atualmente só existe filtro por `category` (nome textual — campo legado).

---

## 6. Novos Endpoints Requeridos

### 6.1 Perfil do Usuário

#### `PATCH /v1/users/me`
Atualizar dados do perfil do usuário autenticado (exceto senha).

**Auth:** Bearer  
**Body:**
```json
{
  "first_name": "Aislan",
  "last_name": "Moraes",
  "avatar_url": "https://cdn.fincla.com/avatars/abc.jpg",
  "phone": "+5586999999999"
}
```
**Response 200:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "first_name": "Aislan",
  "last_name": "Moraes",
  "avatar_url": "https://...",
  "phone": "+5586999999999",
  "role": "owner",
  "onboarding_completed": true,
  "created_at": "2026-01-01T00:00:00"
}
```

---

### 6.2 Organizações

#### `PATCH /v1/organizations/{org_id}`
Atualizar dados da organização.

**Auth:** Bearer + owner na organização  
**Body (todos opcionais):**
```json
{
  "name": "Família Moraes",
  "description": "Nossa organização familiar",
  "org_type": "family",
  "monthly_income": 15000.00,
  "avatar_url": "https://cdn.fincla.com/orgs/abc.jpg"
}
```
**Response 200:** objeto `Organization` atualizado

#### `GET /v1/organizations/{org_id}`
Obter organização pelo ID.

**Auth:** Bearer + membership válido  
**Response 200:** objeto `Organization` com campos estendidos (`org_type`, `monthly_income`, `avatar_url`)

---

### 6.3 Orçamentos

#### `POST /v1/budgets`
Criar orçamento.

**Auth:** Bearer + membership  
**Body:**
```json
{
  "organization_id": "uuid",
  "tag_id": "uuid-da-tag-categoria",
  "amount": 2000.00,
  "period_type": "monthly"
}
```
**Response 201:** objeto `Budget` com campos calculados

---

#### `GET /v1/budgets`
Listar orçamentos com uso calculado.

**Auth:** Bearer + membership  
**Query:** `organization_id` (obrigatório), `period_type?`, `date_ref?` (data de referência para cálculo, padrão: hoje)  
**Response 200:**
```json
{
  "budgets": [
    {
      "id": "uuid",
      "organization_id": "uuid",
      "tag_id": "uuid",
      "tag_name": "Alimentação",
      "tag_color": "#059669",
      "amount": 2000.00,
      "period_type": "monthly",
      "is_active": true,
      "spent_amount": 1450.00,
      "remaining_amount": 550.00,
      "usage_percent": 72.5,
      "status": "warning",
      "created_at": "2026-01-01T00:00:00",
      "updated_at": "2026-03-01T00:00:00"
    }
  ],
  "summary": {
    "total_budgeted": 8000.00,
    "total_spent": 5200.00,
    "total_remaining": 2800.00,
    "budgets_exceeded": 1,
    "budgets_warning": 2,
    "budgets_ok": 5
  }
}
```

---

#### `GET /v1/budgets/{budget_id}`
Obter orçamento individual.

**Auth:** Bearer + membership  
**Query:** `organization_id`  
**Response 200:** objeto `Budget` com campos calculados

---

#### `PATCH /v1/budgets/{budget_id}`
Atualizar orçamento.

**Auth:** Bearer + membership  
**Query:** `organization_id`  
**Body (todos opcionais):** `amount`, `period_type`, `is_active`  
**Response 200:** objeto `Budget` atualizado

---

#### `DELETE /v1/budgets/{budget_id}`
Excluir orçamento (soft delete: `is_active = false` ou hard delete, a decidir).

**Auth:** Bearer + membership  
**Query:** `organization_id`  
**Response 204:** sem conteúdo

---

### 6.4 Recorrências

#### `POST /v1/recurring-transactions`
Criar recorrência.

**Auth:** Bearer + membership  
**Body:**
```json
{
  "organization_id": "uuid",
  "type": "expense",
  "description": "Assinatura Netflix",
  "value": 55.90,
  "payment_method": "credit_card",
  "tag_ids": ["uuid-categoria-lazer"],
  "frequency": "monthly",
  "day_of_month": 15,
  "start_date": "2026-04-15",
  "credit_card_id": 1
}
```
**Response 201:** objeto `RecurringTransaction`

---

#### `GET /v1/recurring-transactions`
Listar recorrências.

**Auth:** Bearer + membership  
**Query:** `organization_id`, `type?`, `is_active?`  
**Response 200:**
```json
{
  "recurring_transactions": [RecurringTransaction],
  "summary": {
    "total_monthly_income": 10000.00,
    "total_monthly_expense": 3200.50,
    "active_count": 12,
    "paused_count": 2
  }
}
```

---

#### `GET /v1/recurring-transactions/{id}`
Obter recorrência.

**Auth:** Bearer + membership  
**Query:** `organization_id`  
**Response 200:** objeto `RecurringTransaction`

---

#### `PATCH /v1/recurring-transactions/{id}`
Atualizar recorrência.

**Auth:** Bearer + membership  
**Response 200:** objeto atualizado

---

#### `DELETE /v1/recurring-transactions/{id}`
Excluir recorrência.

**Auth:** Bearer + membership  
**Response 204:** sem conteúdo

---

#### `PATCH /v1/recurring-transactions/{id}/toggle`
Alternar estado ativo/pausado.

**Auth:** Bearer + membership  
**Query:** `organization_id`  
**Response 200:**
```json
{
  "id": "uuid",
  "is_active": false,
  "updated_at": "2026-03-21T15:00:00"
}
```

---

#### `POST /v1/recurring-transactions/{id}/generate`
Gerar manualmente uma transação a partir de uma recorrência.

**Auth:** Bearer + membership  
**Query:** `organization_id`  
**Body:**
```json
{
  "occurrence_date": "2026-04-15",
  "value_override": null
}
```
**Response 201:**
```json
{
  "transaction": Transaction,
  "next_occurrence": "2026-05-15"
}
```

---

### 6.5 Metas — Complementos

#### `DELETE /v1/goals/{goal_id}`
Excluir meta.

**Auth:** Bearer + membership  
**Query:** `organization_id`  
**Response 204:** sem conteúdo

---

#### `POST /v1/goals/{goal_id}/contributions`
Registrar aporte em uma meta.

**Auth:** Bearer + membership  
**Query:** `organization_id`  
**Body:**
```json
{
  "amount": 500.00,
  "contributed_at": "2026-03-21",
  "note": "Bônus de março"
}
```
**Response 201:**
```json
{
  "contribution": {
    "id": "uuid",
    "goal_id": "uuid",
    "amount": 500.00,
    "note": "Bônus de março",
    "contributed_at": "2026-03-21",
    "created_at": "2026-03-21T10:00:00"
  },
  "goal": {
    "id": "uuid",
    "current_amount": 3500.00,
    "target_amount": 10000.00,
    "progress": 35.0,
    "status": "active"
  }
}
```

---

#### `GET /v1/goals/{goal_id}/contributions`
Listar aportes de uma meta.

**Auth:** Bearer + membership  
**Query:** `organization_id`, `page?`, `limit?`  
**Response 200:**
```json
{
  "contributions": [GoalContribution],
  "pagination": PaginationMetadata,
  "total_contributed": 3500.00
}
```

---

### 6.6 Analytics / Relatórios

#### `GET /v1/analytics/monthly-evolution`
Evolução mensal de receitas e despesas.

**Auth:** Bearer + membership  
**Query:** `organization_id`, `months?` (padrão: 6, máx: 24)  
**Response 200:**
```json
{
  "months": [
    {
      "year": 2026,
      "month": 3,
      "month_name": "março",
      "total_income": 9500.00,
      "total_expenses": 7200.00,
      "balance": 2300.00
    }
  ],
  "period_start": "2025-10-01",
  "period_end": "2026-03-31"
}
```

---

#### `GET /v1/analytics/by-category`
Breakdown de gastos por categoria no período.

**Auth:** Bearer + membership  
**Query:** `organization_id`, `date_start?`, `date_end?`, `type?` (padrão: `"expense"`)  
**Response 200:**
```json
{
  "categories": [
    {
      "tag_id": "uuid",
      "tag_name": "Alimentação",
      "tag_color": "#059669",
      "total": 2450.00,
      "percentage": 34.0,
      "transaction_count": 23
    }
  ],
  "total_amount": 7200.00,
  "period_start": "2026-03-01",
  "period_end": "2026-03-31"
}
```

---

#### `GET /v1/analytics/spending-rhythm`
Série temporal de gastos por categoria (para RitmoPage).

**Auth:** Bearer + membership  
**Query:** `organization_id`, `months?` (padrão: 6, máx: 12), `type?` (padrão: `"expense"`)  
**Response 200:**
```json
{
  "months": ["jan/26", "fev/26", "mar/26"],
  "categories": [
    {
      "tag_id": "uuid",
      "tag_name": "Alimentação",
      "tag_color": "#059669",
      "monthly_totals": [1800.00, 2100.00, 2450.00],
      "average": 2116.67,
      "trend": "increasing"
    }
  ],
  "monthly_totals": [7000.00, 7500.00, 7200.00]
}
```

---

#### `GET /v1/analytics/period-comparison`
Comparativo entre dois períodos.

**Auth:** Bearer + membership  
**Query:** `organization_id`, `period_a_start`, `period_a_end`, `period_b_start`, `period_b_end`  
**Response 200:**
```json
{
  "period_a": {
    "start": "2026-02-01", "end": "2026-02-28",
    "total_income": 9000.00, "total_expenses": 6800.00, "balance": 2200.00
  },
  "period_b": {
    "start": "2026-03-01", "end": "2026-03-31",
    "total_income": 9500.00, "total_expenses": 7200.00, "balance": 2300.00
  },
  "changes": {
    "income_change_pct": 5.56,
    "expenses_change_pct": 5.88,
    "balance_change_pct": 4.55
  }
}
```

---

### 6.7 Exportação CSV

#### `GET /v1/transactions/export/csv`
Exportar transações filtradas como arquivo CSV.

**Auth:** Bearer + membership  
**Query:** Mesmos parâmetros de `GET /v1/transactions` (sem `page` e `limit`)  
**Response 200:**
- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="transacoes_2026-03.csv"`
- Corpo: arquivo CSV com colunas: `data,descricao,tipo,valor,metodo_pagamento,categoria,tags,status,recorrente`

---

### 6.8 IA — Categorização

#### `POST /v1/ai/categorize`
Sugerir categoria e tags a partir de uma descrição de transação.

**Auth:** Bearer  
**Body:**
```json
{
  "description": "Mercado Extra - compras da semana",
  "organization_id": "uuid",
  "value": 187.40,
  "payment_method": "credit_card"
}
```
**Response 200:**
```json
{
  "suggested_tag_id": "uuid-alimentacao",
  "suggested_tag_name": "Alimentação",
  "suggested_tags": [
    { "tag_id": "uuid-mercado", "tag_name": "mercado", "confidence": 0.95 },
    { "tag_id": "uuid-compras", "tag_name": "compras", "confidence": 0.82 }
  ],
  "confidence": 0.92,
  "reasoning": "Descrição contém 'Mercado Extra' que é um supermercado — categoria Alimentação com alta confiança"
}
```

---

### 6.9 Notificações

#### `GET /v1/notifications`
Listar notificações do usuário autenticado.

**Auth:** Bearer  
**Query:** `organization_id?`, `is_read?`, `page?`, `limit?`  
**Response 200:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "budget_exceeded",
      "title": "Orçamento excedido",
      "body": "Você excedeu o orçamento de Alimentação em março.",
      "data": { "budget_id": "uuid", "tag_name": "Alimentação" },
      "is_read": false,
      "created_at": "2026-03-21T10:00:00"
    }
  ],
  "unread_count": 3,
  "pagination": PaginationMetadata
}
```

---

#### `PATCH /v1/notifications/{id}/read`
Marcar notificação como lida.

**Auth:** Bearer  
**Response 200:** `{ "id": "uuid", "is_read": true, "read_at": "2026-03-21T15:00:00" }`

---

#### `PATCH /v1/notifications/read-all`
Marcar todas as notificações como lidas.

**Auth:** Bearer  
**Query:** `organization_id?`  
**Response 200:** `{ "marked_count": 5 }`

---

### 6.10 Dashboard — KPIs

#### `GET /v1/dashboard`
Endpoint unificado de KPIs para o dashboard.

**Auth:** Bearer + membership  
**Query:** `organization_id`, `date_start?`, `date_end?`  
**Response 200:**
```json
{
  "period": {
    "start": "2026-03-01",
    "end": "2026-03-31"
  },
  "kpis": {
    "total_income": 9500.00,
    "total_expenses": 7200.00,
    "balance": 2300.00,
    "transaction_count": 47
  },
  "budgets_summary": {
    "total": 8,
    "exceeded": 1,
    "warning": 2,
    "ok": 5
  },
  "goals_summary": {
    "total": 3,
    "completed": 0,
    "active": 3,
    "closest_deadline": {
      "goal_id": "uuid",
      "goal_name": "Reserva de emergência",
      "days_remaining": 45,
      "progress": 68.5
    }
  },
  "recent_transactions": [Transaction],
  "top_categories": [CategoryExpenseItem],
  "unread_notifications": 3
}
```

---

## 7. Alterações em Endpoints Existentes

### 7.1 `GET /v1/transactions` — Novos filtros

Adicionar parâmetros:
- `status?`: `"pending"` | `"confirmed"` — filtrar por status da transação
- `tag_id?`: UUID de uma tag — filtrar transações que possuem essa tag específica
- `sort_by` — adicionar `"name"` como opção válida (atualmente o frontend Fincla v2 usa sort por nome)

---

### 7.2 `POST /v1/transactions` — Campo `status`

Aceitar e persistir o campo `status` no body:
```json
{
  "status": "pending"
}
```
Padrão quando não informado: `"confirmed"`.

---

### 7.3 `PUT /v1/transactions/{id}` — Campo `status`

Aceitar `status` como campo editável.

---

### 7.4 `GET /v1/transactions` — Resposta inclui `status`

Todas as respostas de transação devem incluir o campo `status`.

---

### 7.5 `GET /v1/transactions/summary` — Filtro por status

Adicionar parâmetro `include_pending?` (boolean, padrão: `true`).
Quando `false`, o summary exclui transações pendentes dos cálculos.

---

### 7.6 `POST /v1/organizations` — Campos de onboarding

Aceitar opcionalmente: `org_type`, `monthly_income`, `avatar_url` no body de criação.

---

### 7.7 `GET /v1/memberships/my-organizations` — Campos estendidos

Retornar os novos campos de `organizations`: `org_type`, `monthly_income`, `avatar_url`.

---

### 7.8 `GET /v1/auth/me` e `GET /v1/users/me` — Campos estendidos

Retornar os novos campos de `users`: `avatar_url`, `phone`, `onboarding_completed`, `first_name`, `last_name`.

---

### 7.9 `GET /v1/goals` e `GET /v1/goals/{id}` — Progresso calculado

Retornar campo calculado `progress` (`current_amount / target_amount * 100`) em todas as respostas de meta.
Atualmente o frontend calcula isso no lado do cliente, mas é melhor que venha do backend.

---

### 7.10 `PUT /v1/goals/{id}` — Campo `current_amount`

O campo `current_amount` não deve mais ser editável diretamente via `PUT /v1/goals/{id}` após a implementação de `goal_contributions`. Ele deve ser apenas a soma dos contributions. Manter compatibilidade retroativa: se `goal_contributions` não tiver registros, aceitar `current_amount` direto no PUT.

---

## 8. Regras de Negócio Novas ou Alteradas

### 8.1 Orçamentos — Cálculo de uso

O campo `spent_amount` de um orçamento deve ser calculado em tempo de query, somando todas as transações do tipo `expense` da organização que:
- Possuem a `tag_id` do orçamento em seus `transaction_tags`
- Estão dentro do período de referência (para `monthly`: mês da `date_ref`)
- Têm `status = "confirmed"` (transações pendentes não devem impactar o orçamento por padrão)

O campo `status` do orçamento:
- `"ok"` → `usage_percent < 75`
- `"warning"` → `75 <= usage_percent < 100`
- `"exceeded"` → `usage_percent >= 100`

---

### 8.2 Recorrências — Cálculo de `next_occurrence`

Quando uma recorrência é criada ou uma ocorrência é gerada:
- Calcular `next_occurrence` baseado em `frequency` + `day_of_month` ou `day_of_week` + data atual
- Para `monthly`: próximo `day_of_month` a partir de hoje
- Para `weekly`: próximo `day_of_week` a partir de hoje
- Para `biweekly`: próxima quinzena
- Para `yearly`: mesmo mês/dia do próximo ano

---

### 8.3 Metas — Auto-completar

Quando `goal_contributions` é inserido e `current_amount >= target_amount`:
- Atualizar `goals.status = "completed"` automaticamente
- Gerar notificação do tipo `goal_completed` para o usuário

---

### 8.4 Notificações — Geração automática

As notificações devem ser geradas automaticamente em momentos específicos:

| Evento | Tipo | Quando |
|---|---|---|
| Budget `usage_percent` cruza 75% | `budget_warning` | No momento da criação/edição de transação |
| Budget `usage_percent` cruza 100% | `budget_exceeded` | No momento da criação/edição de transação |
| Goal com deadline em ≤ 7 dias e não completado | `goal_deadline_approaching` | Job diário ou on-demand no dashboard |
| Goal completado (contributions) | `goal_completed` | No momento do POST /contributions |
| Invoice com due_date em ≤ 3 dias e não paga | `invoice_due_soon` | Job diário ou on-demand no dashboard |

---

### 8.5 Exportação CSV — Colunas e encoding

O CSV exportado deve:
- Usar encoding UTF-8 com BOM (para compatibilidade com Excel no Windows)
- Usar separador `,`
- Ter cabeçalho na primeira linha
- Colunas: `Data,Hora,Descrição,Tipo,Valor,Método de Pagamento,Categoria,Tags,Status,Recorrente`
- Valores monetários com ponto decimal (não vírgula)
- Datas em formato `dd/MM/yyyy`
- Tipo: `Receita` ou `Despesa` (em português)

---

### 8.6 Transações com status `pending`

- Transações `pending` são visíveis na lista de transações
- Transações `pending` devem ter visual diferenciado no frontend (já implementado)
- Os KPIs do dashboard **incluem** pendentes por padrão (pode ser configurável)
- Orçamentos **excluem** pendentes do cálculo de uso (apenas `confirmed` impacta o orçamento)

---

### 8.7 `monthly_income` da organização — uso nos cálculos de impacto

O campo `monthly_income` de `organizations` deve ser usado como referência base em:
- Cálculo de comprometimento de renda em `POST /v1/financial-impact/simulate`
- Cálculo de `usage_percent` no contexto de orçamentos relativos à renda
- Geração do campo `income_commitment_percent` nos relatórios

Quando `monthly_income = null`, esses cálculos retornam `null` para o campo percentual.

---

## 9. Tabela de Prioridades

### Prioridade 1 — Bloqueante para funcionamento básico

| # | Item | Domínio | Tipo |
|---|---|---|---|
| P1.1 | Campo `status` em `transactions` | Transações | Schema + Endpoint |
| P1.2 | `PATCH /v1/users/me` | Usuários | Novo endpoint |
| P1.3 | Campos `avatar_url`, `phone`, `onboarding_completed` em `users` | Usuários | Schema |
| P1.4 | Campos `org_type`, `monthly_income`, `avatar_url` em `organizations` | Organizações | Schema |
| P1.5 | `PATCH /v1/organizations/{org_id}` | Organizações | Novo endpoint |
| P1.6 | `DELETE /v1/goals/{goal_id}` | Metas | Endpoint faltante |
| P1.7 | `GET /v1/analytics/monthly-evolution` | Analytics | Novo endpoint |
| P1.8 | `GET /v1/analytics/by-category` | Analytics | Novo endpoint |

### Prioridade 2 — Importante para produto completo

| # | Item | Domínio | Tipo |
|---|---|---|---|
| P2.1 | Modelo `budgets` + CRUD completo | Orçamentos | Novo domínio |
| P2.2 | Modelo `recurring_transactions` + CRUD | Recorrências | Novo domínio |
| P2.3 | `POST /v1/goals/{id}/contributions` | Metas | Novo endpoint |
| P2.4 | `GET /v1/goals/{id}/contributions` | Metas | Novo endpoint |
| P2.5 | `GET /v1/analytics/spending-rhythm` | Analytics | Novo endpoint |
| P2.6 | `GET /v1/transactions/export/csv` | Exportação | Novo endpoint |
| P2.7 | `POST /v1/ai/categorize` | IA | Novo endpoint |
| P2.8 | Filtro `tag_id` em `GET /v1/transactions` | Transações | Alteração |
| P2.9 | `GET /v1/dashboard` | Dashboard | Novo endpoint |

### Prioridade 3 — Melhoria de experiência

| # | Item | Domínio | Tipo |
|---|---|---|---|
| P3.1 | Modelo `notifications` + endpoints | Notificações | Novo domínio |
| P3.2 | Geração automática de notificações | Notificações | Regra de negócio |
| P3.3 | `GET /v1/analytics/period-comparison` | Analytics | Novo endpoint |
| P3.4 | `PATCH /v1/recurring-transactions/{id}/toggle` | Recorrências | Endpoint de conveniência |
| P3.5 | `POST /v1/recurring-transactions/{id}/generate` | Recorrências | Endpoint de conveniência |
| P3.6 | Modelo `simulation_scenarios` + CRUD | Simulação | Novo domínio |
| P3.7 | Campo `progress` calculado nas respostas de goal | Metas | Melhoria de resposta |
| P3.8 | Filtro `status` em `GET /v1/transactions` | Transações | Alteração |

---

## 10. Referência Completa de Contratos de API

### Superfície HTTP Completa do Fincla v2

A tabela abaixo lista **todos** os endpoints que o backend Fincla v2 deve expor, indicando o que já existe e o que é novo.

#### Saúde

| Método | Path | Status | Prioridade |
|---|---|---|---|
| GET | `/health` | ✅ Existe | — |
| GET | `/ping` | ✅ Existe | — |

#### Autenticação

| Método | Path | Status | Prioridade |
|---|---|---|---|
| POST | `/v1/auth/login` | ✅ Existe | — |
| GET | `/v1/auth/me` | ✅ Existe (estender resposta) | P1 |

#### Usuários

| Método | Path | Status | Prioridade |
|---|---|---|---|
| POST | `/v1/users/register/owner` | ✅ Existe | — |
| POST | `/v1/users/register/member` | ✅ Existe | — |
| GET | `/v1/users/me` | ✅ Existe (estender resposta) | P1 |
| PATCH | `/v1/users/me` | 🆕 Novo | P1 |
| PUT | `/v1/users/me/password` | ✅ Existe | — |

#### Organizações

| Método | Path | Status | Prioridade |
|---|---|---|---|
| POST | `/v1/organizations` | ✅ Existe (estender body) | P1 |
| GET | `/v1/organizations/{org_id}` | 🆕 Novo | P2 |
| PATCH | `/v1/organizations/{org_id}` | 🆕 Novo | P1 |

#### Memberships

| Método | Path | Status | Prioridade |
|---|---|---|---|
| GET | `/v1/memberships/my-organizations` | ✅ Existe (estender resposta) | P1 |
| GET | `/v1/memberships/organizations/{org_id}/members` | ✅ Existe | — |
| DELETE | `/v1/memberships/organizations/{org_id}/members/{user_id}` | ✅ Existe | — |

#### Tags e Tipos

| Método | Path | Status | Prioridade |
|---|---|---|---|
| GET | `/v1/tag-types` | ✅ Existe | — |
| GET | `/v1/tags` | ✅ Existe | — |
| POST | `/v1/tags` | ✅ Existe | — |
| PATCH | `/v1/tags/{tag_id}` | ✅ Existe | — |
| DELETE | `/v1/tags/{tag_id}` | ✅ Existe | — |

#### Transações

| Método | Path | Status | Prioridade |
|---|---|---|---|
| POST | `/v1/transactions` | ✅ Existe (+ campo status) | P1 |
| GET | `/v1/transactions` | ✅ Existe (+ filtros tag_id, status) | P2 |
| GET | `/v1/transactions/summary` | ✅ Existe (+ filtro include_pending) | P1 |
| GET | `/v1/transactions/recurring` | ✅ Existe | — |
| GET | `/v1/transactions/export/csv` | 🆕 Novo | P2 |
| GET | `/v1/transactions/{id}` | ✅ Existe (+ campo status) | P1 |
| PUT | `/v1/transactions/{id}` | ✅ Existe (+ campo status) | P1 |
| DELETE | `/v1/transactions/{id}` | ✅ Existe | — |

#### Recorrências

| Método | Path | Status | Prioridade |
|---|---|---|---|
| POST | `/v1/recurring-transactions` | 🆕 Novo | P2 |
| GET | `/v1/recurring-transactions` | 🆕 Novo | P2 |
| GET | `/v1/recurring-transactions/{id}` | 🆕 Novo | P2 |
| PATCH | `/v1/recurring-transactions/{id}` | 🆕 Novo | P2 |
| DELETE | `/v1/recurring-transactions/{id}` | 🆕 Novo | P2 |
| PATCH | `/v1/recurring-transactions/{id}/toggle` | 🆕 Novo | P3 |
| POST | `/v1/recurring-transactions/{id}/generate` | 🆕 Novo | P3 |

#### Orçamentos

| Método | Path | Status | Prioridade |
|---|---|---|---|
| POST | `/v1/budgets` | 🆕 Novo | P2 |
| GET | `/v1/budgets` | 🆕 Novo | P2 |
| GET | `/v1/budgets/{budget_id}` | 🆕 Novo | P2 |
| PATCH | `/v1/budgets/{budget_id}` | 🆕 Novo | P2 |
| DELETE | `/v1/budgets/{budget_id}` | 🆕 Novo | P2 |

#### Metas

| Método | Path | Status | Prioridade |
|---|---|---|---|
| POST | `/v1/goals` | ✅ Existe | — |
| GET | `/v1/goals` | ✅ Existe (+ campo progress) | P3 |
| GET | `/v1/goals/{goal_id}` | ✅ Existe (+ campo progress) | P3 |
| PUT | `/v1/goals/{goal_id}` | ✅ Existe | — |
| DELETE | `/v1/goals/{goal_id}` | 🆕 Novo | P1 |
| POST | `/v1/goals/{goal_id}/contributions` | 🆕 Novo | P2 |
| GET | `/v1/goals/{goal_id}/contributions` | 🆕 Novo | P2 |

#### Cartões de Crédito

| Método | Path | Status | Prioridade |
|---|---|---|---|
| POST | `/v1/credit-cards` | ✅ Existe | — |
| GET | `/v1/credit-cards` | ✅ Existe | — |
| GET | `/v1/credit-cards/consolidated-commitments` | ✅ Existe | — |
| GET | `/v1/credit-cards/{card_id}` | ✅ Existe | — |
| PATCH | `/v1/credit-cards/{card_id}` | ✅ Existe | — |
| DELETE | `/v1/credit-cards/{card_id}` | ✅ Existe | — |
| GET | `/v1/credit-cards/{card_id}/future-commitments` | ✅ Existe | — |
| GET | `/v1/credit-cards/{card_id}/invoices/{year}/{month}` | ✅ Existe | — |
| GET | `/v1/credit-cards/{card_id}/invoices/history` | ✅ Existe | — |
| PATCH | `/v1/credit-cards/{card_id}/invoices/{year}/{month}/mark-paid` | ✅ Existe | — |
| PATCH | `/v1/credit-cards/{card_id}/invoices/{year}/{month}/unmark-paid` | ✅ Existe | — |
| PATCH | `/v1/credit-cards/{card_id}/charges/{charge_id}/installments/{installment_id}/invoice` | ✅ Existe | — |

#### Analytics / Relatórios

| Método | Path | Status | Prioridade |
|---|---|---|---|
| GET | `/v1/analytics/monthly-evolution` | 🆕 Novo | P1 |
| GET | `/v1/analytics/by-category` | 🆕 Novo | P1 |
| GET | `/v1/analytics/spending-rhythm` | 🆕 Novo | P2 |
| GET | `/v1/analytics/period-comparison` | 🆕 Novo | P3 |

#### Dashboard

| Método | Path | Status | Prioridade |
|---|---|---|---|
| GET | `/v1/dashboard` | 🆕 Novo | P2 |

#### Simulação Financeira

| Método | Path | Status | Prioridade |
|---|---|---|---|
| POST | `/v1/financial-impact/simulate` | ✅ Existe | — |
| POST | `/v1/simulation-scenarios` | 🆕 Novo (P3) | P3 |
| GET | `/v1/simulation-scenarios` | 🆕 Novo (P3) | P3 |
| DELETE | `/v1/simulation-scenarios/{id}` | 🆕 Novo (P3) | P3 |

#### Notificações

| Método | Path | Status | Prioridade |
|---|---|---|---|
| GET | `/v1/notifications` | 🆕 Novo | P3 |
| PATCH | `/v1/notifications/{id}/read` | 🆕 Novo | P3 |
| PATCH | `/v1/notifications/read-all` | 🆕 Novo | P3 |

#### IA

| Método | Path | Status | Prioridade |
|---|---|---|---|
| POST | `/v1/ai/chat` | ✅ Existe | — |
| POST | `/v1/ai/categorize` | 🆕 Novo | P2 |

#### WhatsApp

| Método | Path | Status | Prioridade |
|---|---|---|---|
| POST | `/v1/webhooks/whatsapp` | ✅ Existe | — |
| POST | `/v1/whatsapp-connections` | ✅ Existe | — |
| GET | `/v1/whatsapp-connections` | ✅ Existe | — |
| DELETE | `/v1/whatsapp-connections/{id}` | ✅ Existe | — |

#### Área do Consultor

| Método | Path | Status | Prioridade |
|---|---|---|---|
| GET | `/v1/consultant/*` (todos os endpoints existentes) | ✅ Existe | — |

---

### Resumo de Contagem

| Categoria | Endpoints Existentes | Novos | Alterados |
|---|---|---|---|
| Saúde | 2 | 0 | 0 |
| Auth | 2 | 0 | 1 |
| Usuários | 4 | 1 | 1 |
| Organizações | 1 | 2 | 1 |
| Memberships | 3 | 0 | 1 |
| Tags | 5 | 0 | 0 |
| Transações | 7 | 1 | 4 |
| Recorrências | 0 | 7 | 0 |
| Orçamentos | 0 | 5 | 0 |
| Metas | 4 | 3 | 1 |
| Cartões | 11 | 0 | 0 |
| Analytics | 0 | 4 | 0 |
| Dashboard | 0 | 1 | 0 |
| Simulação | 1 | 3 | 0 |
| Notificações | 0 | 3 | 0 |
| IA | 1 | 1 | 0 |
| WhatsApp | 4 | 0 | 0 |
| Consultor | 10 | 0 | 0 |
| **TOTAL** | **55** | **31** | **9** |

---

*Documento gerado em 21/03/2026 — Fincla v2 · Requisitos de Backend*
