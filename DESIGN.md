# DESIGN.md — Fincla Frontend (guia prático)

> Porta de entrada concisa do design. A **referência canônica completa** é
> [`docs/finly-design-system.md`](docs/finly-design-system.md) (2047 linhas) + a spec visual
> [`docs/finly-v4-full (13).jsx`](docs/finly-v4-full%20(13).jsx). O código-fonte da verdade são
> `src/ui/tokens.js`, `src/ui/typography.js`, `src/ui/components/primitives.jsx` e
> `src/ui/features/moodV4.jsx`. **Este arquivo distila o essencial e define como construir telas
> novas (Fase 2).** Em conflito, vencem tokens.js/primitives.jsx.

## Princípios
- **Inline styles + objeto `T`** (de `tokens.js`). **Sem Tailwind** por enquanto.
- **Mobile-first.** Layout de coluna única no mobile; o desktop expande para multi-coluna.
- **Lógica financeira mora no backend.** A UI só apresenta (nunca recalcula saldo/capacidade).
- Números sempre com `...NUM` (`tabular-nums`).

## Paleta (de `tokens.js`, objeto `T`)
- Fundo app `bg #F8F7F5` · superfície `surface #FFFFFF` · borda `border #E2E5EA`.
- Tinta: `ink #0F0F0D` · `inkMid #374151` · `inkLight #4B5563` · `inkGhost #9CA3AF`.
- Semânticas: `blue #2563EB`, `red #DC2626`, `green #059669`, `amber #D97706`, `purple #7C3AED`
  (cada uma com `*Light` para fundos e `*Bar` para barras).
- Sombras: `sm` (cards), `md` (hover/elevado), `lg` (modais), `dark` (painel dark do login).

## Tipografia
- **Sans** `G` = Geist (`'Geist','DM Sans',system-ui`). Corpo/labels/números.
- **Serif itálica** `S` = Instrument Serif itálico — **acento** em títulos (a "assinatura" Fincla).
- **Mono** `M_MONO` = Geist Mono (rótulos técnicos/mood).
- **Título de página = dual-font** via `<PageTitle sans="..." serif="..." />`: Geist 30/800 +
  Instrument Serif itálico 32. Ex.: "Minhas **Contas**" (a 2ª palavra em serif itálico).

## Componentes base (de `primitives.jsx`) — use sempre estes
- `Card` — `borderRadius 14`, `border 1px T.border`, `boxShadow T.sm`; hover (se clicável) → `md` + `translateY(-1px)`.
- `Btn` — `borderRadius 9`, `border 1.5px`; variantes: `dark` (CTA primário), `outGray` (default),
  `outPurp`/`outRed`/`outAmber`, `ghost`; props `full`, `small`.
- `Badge` — pill (`radius 9999`), 10px/600, `grayLight` por padrão (use `*Light` + cor p/ status).
- `SectionDiv` — label uppercase 10px/700, `letterSpacing .09em`, com barrinha; aceita `count`/`total`.
- `ProgBar` / `AnimBar` — trilho `grayLight`, fill animado; altura 3–4px.
- `AnimNum` — número animado com prefixo `R$`.
- `Breadcrumb`, `InfoTip`, `CollapsibleSection`, `PageEnter`.

## Layout
- Sidebar (desktop) 195px, `surface`, borda à direita; grupos **PRINCIPAL/PLANEJAR/GESTÃO/CONTA**.
- Mobile: sidebar vira drawer; conteúdo em coluna única; ações em barra/sheet.
- Radius: cards 14 · botões 9 · pills 9999 · inputs ~9–10.
- Espaçamento recorrente: gaps 6–8–10–20; padding de card ~14–16.

## Mood system (`moodV4.jsx`)
Estados `Sereno → Saudável → Atenção → Tenso → Crítico` (verde→amber→vermelho), via
`calcMood(...)`. Usar para tom de alertas/insights (ex.: alerta de capacidade em M3, saúde em M7).

## Como construir uma tela nova (Fase 2)
1. Reusar `primitives.jsx` (Card/Btn/Badge/SectionDiv/ProgBar) — não recriar.
2. Título com `PageTitle` dual-font.
3. Cores só do `T`; status com a cor semântica + `*Light` de fundo.
4. Mobile-first: validar a coluna única antes do desktop.
5. Dados reais via `src/api/` (cliente novo por recurso) + camada `dataMode` (live/mock/empty).
6. Contrato em [`fincla-api/docs/FRONTEND_API_GUIDE.md`](../fincla-api/docs/FRONTEND_API_GUIDE.md).
