# Design: Área do Consultor

**Data:** 2025-02-22  
**Status:** Aprovado

---

## Resumo

Implementar a área do consultor no frontend Fincla: dashboard consolidado com resumo de todas as organizações do consultor, lista de clientes, e visão dedicada por cliente com URLs compartilháveis e reuso total dos componentes existentes.

---

## Decisões de produto

1. **Acesso:** Quando o usuário é consultor, o Dashboard (`/`) redireciona para `/consultant`.
2. **Layout:** Visão consolidada em destaque (cards de resumo), lista de clientes em segundo plano.
3. **Clique no cliente:** Navega para página dedicada `/consultant/clients/:organizationId` com visão completa e análises.
4. **Resumo por cliente:** Usar `GET /v1/transactions/summary?organization_id=X` (endpoint existente).
5. **URLs compartilháveis:** Rotas explícitas para compartilhamento e contexto claro.

---

## Arquitetura e rotas

### Rotas

| Rota | Quem | Comportamento |
|------|------|---------------|
| `/` | Não consultor | Dashboard normal (atual) |
| `/` | Consultor | Redireciona para `/consultant` |
| `/consultant` | Consultor | Dashboard consolidado |
| `/consultant/clients/:organizationId` | Consultor | Visão do cliente (Dashboard) |
| `/consultant/clients/:organizationId/transactions` | Consultor | Transações do cliente |
| `/consultant/clients/:organizationId/reports` | Consultor | Relatórios do cliente |
| `/consultant/clients/:organizationId/credit-cards` | Consultor | Cartões do cliente |
| `/consultant/clients/:organizationId/goals` | Consultor | Metas do cliente |

### Detecção de consultor

`isConsultant(user)`: retorna `true` se `user?.subscription?.features` inclui pelo menos uma de: `multi_org_dashboard`, `client_list`, `consolidated_reports`.

### useOrganization e URL

- Em rotas `/consultant/clients/:organizationId` (e subrotas), o `organizationId` da URL tem prioridade sobre localStorage.
- `useOrganization` usa `useRoute` para detectar e retornar `params.organizationId` como `activeOrgId` efetivo.
- Ao sair da rota de cliente, volta ao valor do localStorage.

---

## Layout e componentes

### Dashboard consolidado (`/consultant`)

- Mesmo `AppLayout`, título "Consultor".
- Seletor de org no header: oculto ou "Visão consolidada".
- Blocos: DateRangePicker → ConsultantSummaryCards → ConsultantClientList.
- Botão "Ver detalhes" na lista → navega para `/consultant/clients/:organizationId`.

### Visão do cliente (`/consultant/clients/:organizationId`)

- `AppLayout` com breadcrumb: **Consultor** > **[Nome do cliente]** > [Página].
- Seletor de org mostra cliente atual; permite trocar para outro cliente.
- Conteúdo: reuso de Dashboard, Transações, Relatórios, Cartões, Metas.

### Sidebar

- Item "Consultor" (ícone `Users` ou `Briefcase`) → `/consultant`.
- Visível apenas se `isConsultant(user)`.

---

## API

- `GET /v1/consultant/summary` — resumo consolidado (multi_org_dashboard).
- `GET /v1/consultant/clients` — lista de clientes (client_list).
- `GET /v1/consultant/reports/consolidated` — relatório consolidado (consolidated_reports).
- `GET /v1/transactions/summary?organization_id=X` — resumo por cliente (existente).

---

## Tratamento de erros

- 403 em endpoints de consultor: usuário não é consultor ou feature ausente → toast e/ou redirecionar para `/`.
- 401: fluxo padrão (logout).
- Loading e estados vazios: skeletons e mensagens adequadas.
