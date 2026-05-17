# Fincla Frontend

SaaS de finanças pessoais BR. A **UI** replica o protótipo de referência em `docs/` (objeto `T` + estilos inline), **sem Tailwind** por enquanto. Cliente REST em `src/api/` (TypeScript).


## API
- Base: `VITE_API_BASE_URL` — `src/api/config.ts` acrescenta `/v1`
- Auth: Bearer em `localStorage.getItem('auth_token')`
- **Contrato da API (canônico, só em fincla-api):** [`fincla-api/docs/FRONTEND_API_GUIDE.md`](../fincla-api/docs/FRONTEND_API_GUIDE.md) — caminho local no monorepo; no clone só do backend: `docs/FRONTEND_API_GUIDE.md`; no GitHub: https://github.com/aislanmaia/fincla-api/blob/main/docs/FRONTEND_API_GUIDE.md — o backend registra ali **todas** as mudanças (endpoints, parâmetros, retornos, erros).
- **`docs/FRONTEND_AUTH_INVITE_LINKS.md`** — repasse **só** ao backend para **compliance** dos **links de e-mail** com o SPA (reset/convite); não substitui o guia da API.
- **`docs/DASHBOARD_INSIGHT_CTA_SPEC.md`** — especificação dos botões do card «Insight do dia» (humor/mood → navegação); **implementação pendente**.

### Integração com a API (status)

O fluxo **padrão** autenticado com organização ativa (`live`, sem `VITE_ENABLE_UI_MOCKS`) já consome `src/api/` em várias telas (ex.: Visão Geral, transações, metas, orçamentos, relatórios, recorrências, ritmo). **Não** se considera «100% concluído»: ainda existe modo **mock/empty** para demo, fallbacks quando não há org/dados, trechos só no `App.jsx`, e CTAs sem ação (ver spec do insight acima). O [guia da API](../fincla-api/docs/FRONTEND_API_GUIDE.md) continua sendo a referência para o que falta no contrato.

### Assinatura + feature gating (Fase A→C de billing)

A aba `/profile/billing` consome dados reais via `getCurrentSubscription()` e `listPlans()` (substituiu o mock de "Plano Premium" com limites fake). Fluxo de upgrade redireciona para a hosted checkout da ASAAS (`window.location.href = checkout_url`); ao voltar, `/profile/billing/return` faz polling em `/v1/subscriptions/me` até o status sair de `pending_payment`.

- **Tipos** (`src/api/types.ts`): `Plan`, `Subscription`, `Invoice`, `ChangePlanRequest/Response`, `CancelSubscriptionResponse`, `EmbeddedSubscription` (a forma legada usada por `/auth/login` e `/auth/me`).
- **Clientes API**: `src/api/plans.ts`, `src/api/subscriptions.ts`, `src/api/invoices.ts`.
- **Hook**: `src/ui/features/subscription/useSubscriptionData.js` (fetch + refresh).
- **UI billing**: `src/ui/features/subscription/{BillingPanel,PlansComparisonModal,CancelSubscriptionDialog}.jsx` + `src/ui/pages/BillingReturnPage.jsx`.
- **Entitlements**: `src/ui/features/entitlements/{useEntitlement,FeatureGate,UpgradeWall,UpgradePrompt,PlanBadge}` consomem `user.subscription.features[]`.
- **Bloqueio de rotas Pro**: `src/ui/routing/GatedAuthenticatedPageOutlet.jsx` envolve `/reports` (`advanced_reports`) e `/simulation` (`what_if_simulations`); a sidebar mostra `<PlanBadge tier="pro">` nos itens bloqueados.
- **Catálogo é dinâmico**: planos são `GET /v1/plans` — nunca hardcoded no frontend.

## Próximos passos
1. Continuar **fatiando** `App.jsx` → `layouts/`, `components/`, `pages/` (marcadores `/* ─── … ─── */` no arquivo de referência em `docs/`).
2. **Evoluir integração e hardening**: lacunas por tela, alinhar com [`fincla-api/docs/FRONTEND_API_GUIDE.md`](../fincla-api/docs/FRONTEND_API_GUIDE.md); implementar CTAs do insight (`docs/DASHBOARD_INSIGHT_CTA_SPEC.md`).
3. **Tailwind v4** (`@theme` espelhando `T`).

## Comandos
```bash
npm run dev
npm run build
npm run check
npm run test           # Vitest (test files com `.rtl.test.*` rodam em jsdom; demais em node)
npm run test:e2e       # Playwright (precisa de TEST_RESET_SECRET, E2E_TEST_OWNER_*, e Vite em :3000)
```

## Referências
- `docs/finly-v4-full (13).jsx` — especificação visual canônica (nomes de produto na UI do repo: **Fincla**)
- `docs/finly-design-system.md`, `docs/fincla-v2-frontend-guide.md`
