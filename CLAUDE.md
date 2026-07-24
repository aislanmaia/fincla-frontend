# Fincla Frontend

SaaS de finanças pessoais BR. A **UI** replica o protótipo de referência em `docs/` (objeto `T` + estilos inline), **sem Tailwind** por enquanto. Cliente REST em `src/api/` (TypeScript).


## Layout do shell — experiência de app nativo (regra dura)

O Fincla é uma **aplicação**, não um documento. `src/ui/app-shell.css` (importado uma única vez em `src/main.jsx`) é a fonte de verdade e trava três invariantes:

1. **Nem a viewport nem o `body` rolam.** `html` é `overflow: hidden` (propaga para a viewport) e `body` é `overflow: **clip**` — `clip` de propósito: com o overflow do html propagado, o valor usado do html vira `visible`, e um `body { overflow: hidden }` faria do body um container de rolagem invisível, onde um `scrollIntoView()` empurra o app para fora da tela sem volta.
2. **Cada tela é dona do seu scroll interno.** Se o conteúdo passa do espaço disponível, ele rola dentro da própria região. `.fincla-scroll` marca essas regiões e isola o gesto (`overscroll-behavior: contain`); `.fincla-scroll-y` é alias legado.
3. **A barra é invisível em repouso e aparece ao apontar** — vale para *toda* região rolável, não para uma lista de opt-ins, então tela nova nasce certa. Sem reflow: a calha é reservada e só a cor do thumb muda. No toque não há regra — o overlay nativo já aparece só durante o gesto.

Ao criar tela nova:

- **Nunca** use `vh` para dimensionar conteúdo — ignora a barra do browser no mobile. Peça altura ao pai: `height: 100%`, ou `flex: 1`. Quando a viewport é mesmo a referência (shell raiz, elemento `position: fixed`), use `dvh`.
- **Nunca** conte com o scroll da página; ponha `overflow-y: auto` (+ `.fincla-scroll` nas regiões grandes) na região rolável.
- **Nunca** centralize no eixo do scroll. `align-items: center` (linha) ou `justify-content: center` (coluna) num elemento que rola torna **inalcançável** tudo que passa da borda inicial — `scrollTop` não vai abaixo de zero. Use `safe center`, que degrada para `start` quando não cabe.
- **Nunca** use `min-height` fixo em painel que precisa caber na tela (ex.: card de chat) — empurra o conteúdo além do shell. Deixe encolher com `min-height: 0`.
- **Nunca** defina regras de `html`/`body` num `<style>` injetado — ele vence a folha empacotada e ressuscita o bug original.

Consequências aceitas conscientemente: `overscroll-behavior: none` desliga o pull-to-refresh e o swipe-back do trackpad em todo o app.

`src/ui/__tests__/appShell.test.js` guarda tudo isso — inclusive varrendo `src` inteiro atrás de `vh`, de containers de rolagem centralizados e de `<style>` injetado disputando o shell, e conferindo o contraste WCAG do thumb.

---

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
