# Fincla v2 — branch `v2-total-refactoring`

SaaS de finanças pessoais BR. Nesta branch a **UI** replica o protótipo de referência em `docs/` (objeto `T` + estilos inline), **sem Tailwind** por enquanto. Cliente REST em `src/api/` (TypeScript).

## Stack atual
- **Vite 5** + **React 18**
- **Recharts** + **lucide-react**
- **TypeScript** apenas em `src/api/`; UI em `.jsx` com `allowJs` / `checkJs: false`
- **Tailwind v4**: depois da componentização e integração com API, sem alterar pixel-perfect

## Estrutura

```
src/
  main.jsx                 ← entry → <App /> de ui/App.jsx
  ui/
    App.jsx                ← app principal (dados mock + telas; ir fatiando)
    formatters.js          ← fmtAbs, fmtSgn, fmtK
    tokens.js              ← objeto T (hex)
    injectFonts.js         ← Google Fonts (id DOM: fincla-fonts)
    animations.jsx         ← keyframes + classes .fincla-row / .fincla-btn / …
    typography.js          ← G, S, NUM
    layouts/
      Sidebar.jsx
      Topbar.jsx
    components/
      primitives.jsx       ← PageEnter, AnimNum, Card, Btn, …
    data/
      mockFinance.js       ← ritmo, transações mock, fluxos, etc.
    features/
      moodV4.jsx           ← MOODS, calcMood, CATS_V4, RhythmTooltipV4, …
      onboarding/OnboardingFlow.jsx
      shellExtras.jsx      ← MiniChecklist, StatePanelV4, EmptyState
      authViews.jsx        ← LoginPage, ErrorBoundary
    pages/                 ← (reservado) telas grandes (dashboard, cartões, …)
  api/                     ← REST: client, config, types, domínios
```

## API
- Base: `VITE_API_BASE_URL` — `src/api/config.ts` acrescenta `/v1`
- Auth: Bearer em `localStorage.getItem('auth_token')`
- **`docs/FRONTEND_API_GUIDE.md`** — fonte de verdade da API: o backend deve registrar aqui **todas** as mudanças (endpoints, parâmetros, retornos, erros).
- **`docs/FRONTEND_AUTH_INVITE_LINKS.md`** — repasse **só** ao backend para **compliance** dos **links de e-mail** com o SPA (reset/convite); não substitui o guia da API.

## Próximos passos
1. Continuar **fatiando** `App.jsx` → `layouts/`, `components/`, `pages/` (marcadores `/* ─── … ─── */` no arquivo de referência em `docs/`).
2. **Integrar** API real (`src/api/` + guia).
3. **Tailwind v4** (`@theme` espelhando `T`).

## Comandos
```bash
npm run dev
npm run build
npm run check
```

## Referências
- `docs/finly-v4-full (13).jsx` — especificação visual canônica (nomes de produto na UI do repo: **Fincla**)
- `docs/finly-design-system.md`, `docs/fincla-v2-frontend-guide.md`
