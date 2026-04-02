# Finly v4 — Design System & Reference Document

> **Versão:** 4.x — Março 2026  
> **Arquivo fonte:** `finly-v4-full.jsx` (~11.300 linhas, ~680 KB)  
> **Arquitetura:** Single-file React JSX, zero bundler, CDN-only dependencies

---

## Índice

1. [Visão Geral do Produto](#1-visão-geral-do-produto)
2. [Stack Técnica](#2-stack-técnica)
3. [Paleta de Cores — Design Tokens](#3-paleta-de-cores--design-tokens)
4. [Tipografia](#4-tipografia)
5. [Espaçamento & Layout](#5-espaçamento--layout)
6. [Sistema de Sombras](#6-sistema-de-sombras)
7. [Animações & Keyframes](#7-animações--keyframes)
8. [Componentes Globais](#8-componentes-globais)
9. [Ícones](#9-ícones)
10. [Padrões de CTAs](#10-padrões-de-ctas)
11. [Estados Vazios](#11-estados-vazios)
12. [Bottom Sheets (Mobile)](#12-bottom-sheets-mobile)
13. [Navegação](#13-navegação)
14. [Telas — Descrição Completa](#14-telas--descrição-completa)
15. [Fluxos de Usuário](#15-fluxos-de-usuário)
16. [Padrões de Hierarquia Visual](#16-padrões-de-hierarquia-visual)
17. [Filosofia de Design](#17-filosofia-de-design)

---

## 1. Visão Geral do Produto

**Finly** é um SaaS de finanças pessoais voltado ao mercado brasileiro. Proposta central: **controle manual e consciente** — sem integrações bancárias automáticas. O usuário lança tudo à mão, o que promove atenção e consciência financeira.

**Público-alvo:** Profissionais brasileiros, 25–45 anos, que querem visibilidade real sobre gastos sem abrir mão do controle.

**Princípio editorial:** "Luxury Editorial Finance" — sofisticação visual sem ostentação. Fontes editoriais, espaçamento generoso, microanimações precisas. Parece um app caro sem ser chamativo.

**Idioma:** Português brasileiro exclusivamente.

**Modelo:** Premium individual (`PREMIUM` badge no sidebar). Plano de evolução para modo família/negócio (configurável via `orgTipo`).

---

## 2. Stack Técnica

### Runtime
- **React 18** via CDN (`cdn.jsdelivr.net/npm/react@18`)
- **ReactDOM 18** via CDN
- **Babel Standalone** para transpilação in-browser de JSX
- **Zero bundler** — arquivo único servido diretamente

### Bibliotecas UI
| Biblioteca | Versão | Uso |
|---|---|---|
| `lucide-react` | latest CDN | Sistema de ícones (80+ ícones usados) |
| `recharts` | CDN | Gráficos (LineChart, BarChart, PieChart, RadarChart, AreaChart) |
| Google Fonts | CDN | Geist, DM Sans, Instrument Serif |

### Padrões React Utilizados
- `useState` — estado de UI, formulários, filtros
- `useEffect` — efeitos colaterais, listeners de teclado
- `useRef` — refs de DOM para animações, drag handlers, evitar stale closures
- `useMemo` — filtragem e ordenação de transações, agrupamentos
- `useCallback` — não usado explicitamente (funções inline ou memoizadas via closure)
- Class Components — apenas `ErrorBoundary`

### Arquitetura de Arquivo Único
```
finly-v4-full.jsx
├── Imports (React, lucide-react, recharts)
├── Design tokens (T, G, S, NUM)
├── ANIM_CSS (keyframes globais injetados via AnimStyles)
├── Dados mock (TRANSACTIONS, RECORRENCIAS, CAT_LIST, etc.)
├── Componentes primitivos (AnimStyles, PageEnter, AnimNum, etc.)
├── Componentes de layout (Sidebar, Topbar)
├── Componentes de feature (PeriodCalendar, ParcelaHybrid, NovaTransacaoModal, etc.)
├── Telas (DashboardPage, TransacoesPage, ... LoginPage)
└── App (router principal, estado global, onboarding)
```

---

## 3. Paleta de Cores — Design Tokens

Todos os tokens ficam no objeto `T` e são referenciados como `T.nomeDaPropriedade`.

### Fundos
| Token | Hex | Uso |
|---|---|---|
| `T.bg` | `#F8F7F5` | Background global da aplicação (warm off-white) |
| `T.surface` | `#FFFFFF` | Cards, modais, superfícies elevadas |
| `T.surfaceHov` | `#F9FAFB` | Hover state de superfícies |
| `T.grayLight` | `#F3F4F6` | Fundos de inputs, badges neutros, separadores leves |

### Bordas
| Token | Hex | Uso |
|---|---|---|
| `T.border` | `#E2E5EA` | Borda padrão de cards, inputs, separadores |
| `T.borderHov` | `#D1D5DB` | Borda em hover |

### Tipografia (ink scale)
| Token | Hex | Uso |
|---|---|---|
| `T.ink` | `#0F0F0D` | Texto principal — quase preto com leve warmth |
| `T.inkMid` | `#374151` | Texto secundário, labels de formulário |
| `T.inkLight` | `#4B5563` | Texto terciário, metadados |
| `T.inkGhost` | `#9CA3AF` | Placeholders, textos desabilitados, separadores textuais |

### Cores Semânticas
Cada cor semântica tem: cor principal + light (fundo tinted) + bar (para barras de progresso).

| Cor | Principal | Light | Bar | Uso |
|---|---|---|---|---|
| Blue | `#2563EB` | `#EFF6FF` | — | Ação primária, links, saldo, parcelas |
| Red | `#DC2626` | `#FEF2F2` | `#F87171` | Despesas, alertas, exclusão |
| Green | `#059669` | `#ECFDF5` | `#34D399` | Receitas, confirmados, positivo |
| Amber | `#D97706` | `#FFFBEB` | — | Pendente, avisos, impacto moderado |
| Purple | `#7C3AED` | `#F5F3FF` | `#A78BFA` | IA/features especiais, recorrências, simulação |

### Dark Mode (Login panel esquerdo)
| Token | Hex | Uso |
|---|---|---|
| `T.darkBg` | `#1A1A2E` | Fundo do painel brand do login |
| `T.darkText` | `#F1F5F9` | Texto no painel escuro |
| `T.darkMuted` | `#94A3B8` | Texto secundário no painel escuro |
| `T.darkPurple` | `#C4B5FD` | Destaque roxo no painel escuro |
| `T.darkRed` | `#F87171` | Destaque vermelho no painel escuro |

### Regras de Uso de Cor
1. **Nunca usar hex diretamente no JSX** — sempre via token `T.*`
2. **Receitas = verde** (`T.green` / `T.greenLight`), **Despesas = tinta** (`T.ink`) ou vermelho apenas quando negativo
3. **Azul = ações interativas** — botões primários, links, campos em foco
4. **Roxo = IA e features premium** — Sugerir com IA, calculadora de parcela, onboarding
5. **Amber = atenção não-urgente** — pendente, impacto financeiro moderado
6. **`+` / `−` em vez de cores** para valores nos KPIs (acessibilidade)

---

## 4. Tipografia

### Famílias de Fonte

```js
const G   = { fontFamily: "'Geist', 'DM Sans', system-ui, sans-serif" }
const S   = { fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic" }
const NUM = { fontVariantNumeric: "tabular-nums" }
```

| Token | Fonte | Uso |
|---|---|---|
| `G` (Geist) | Geist → DM Sans → system-ui | Todo texto de interface: labels, botões, parágrafos, navegação |
| `S` (Serif) | Instrument Serif italic | Títulos editoriais — a palavra em itálico nas PageTitles |
| `NUM` | tabular-nums via font-variant | Todos os valores monetários — garante alinhamento em listas |

### Escala Tipográfica

| Tamanho | Uso típico |
|---|---|
| `38–48px` | Hero de valor monetário em modais (input de valor) |
| `30–32px` | PageTitle (título de cada tela) |
| `22–26px` | Valores grandes em KPI cards |
| `18–20px` | Cabeçalhos de seção, títulos de card |
| `16px` | Títulos de bottom sheet, subtítulos importantes |
| `14px` | Corpo padrão, valores de lista, botões |
| `13px` | Texto secundário, metadados de transação |
| `12px` | Labels de campo, subtextos de card |
| `11px` | Labels uppercase de seção, chips de filtro |
| `10px` | Micro-labels, badges, counters |
| `9–8px` | Labels mínimos (evitar abaixo de 10px exceto em casos muito específicos) |

### Pesos Usados
- `400` — corpo de texto normal
- `500` — texto ligeiramente enfatizado
- `600` — labels de campo, texto secundário importante
- `700` — títulos, valores, botões, navegação ativa
- `800` — PageTitles, valores hero, CTAs primários

### Regras Tipográficas
1. **Valores monetários sempre com `{...NUM}`** — nunca sem tabular-nums
2. **Itálico apenas para a palavra serif nos títulos** — nunca para corpo de texto
3. **`letter-spacing: -0.02em` a `-0.03em`** para títulos grandes (>24px)
4. **`letter-spacing: 0.07–0.10em`** para labels uppercase de seção
5. **Monoespaçado para valores**: `fontFamily: "'Geist Mono', monospace"` em badges de parcela e info inline

---

## 5. Espaçamento & Layout

### Grid do App
```
Desktop:
├── Sidebar: 192px fixo, height: 100vh, position: fixed
├── Content area: calc(100% - 192px), marginLeft: 192px
│   ├── Topbar: height 56px, position: fixed, top: 0
│   └── Page scroll: paddingTop: 56px
│       └── Padding interno: 20px top, 24px horizontal, 40px bottom

Mobile:
├── Topbar: height 56px, position: fixed
├── Page content: paddingTop: 56px
└── Sem sidebar (drawer via botão ≡)
```

### Breakpoint Mobile
```js
const isMobile = window.innerWidth < 768
```
Detectado em tempo de renderização, sem CSS media queries (inline styles only).

### Espaçamentos Recorrentes
| Valor | Uso |
|---|---|
| `4px` | Gap mínimo entre elementos inline |
| `6–8px` | Gap entre chips, gap em flex rows |
| `10–12px` | Padding de cards pequenos, gap em grids |
| `14–16px` | Padding padrão de seções |
| `18–20px` | Padding de seções internas de tela |
| `24px` | Padding lateral de conteúdo |
| `28–32px` | Espaçamento entre seções maiores |

### Border Radius
| Valor | Uso |
|---|---|
| `99px / 9999px` | Pills, chips, badges, inputs rounded |
| `8–10px` | Botões médios, inputs de formulário |
| `12px` | Cards de KPI, seções de dados |
| `14–16px` | Cards maiores, popovers |
| `18–20px` | Modais, drawers |
| `24px` | Bottom sheets (top corners only: `24px 24px 0 0`) |

---

## 6. Sistema de Sombras

```js
T.sm   = "0 1px 2px rgba(0,0,0,0.05)"       // elevação mínima: inputs, chips
T.md   = "0 4px 12px rgba(0,0,0,0.07)"       // cards elevados, dropdowns
T.lg   = "0 8px 28px rgba(0,0,0,0.10)"       // modais, popovers grandes
T.dark = "0 8px 32px rgba(0,0,0,0.35)"       // sobreposições escuras
```

**Bottom sheets** usam sombra em 3 camadas (design nativo):
```js
"0 -2px 0 rgba(0,0,0,0.05),       // borda fina no topo
 0 -8px 32px rgba(0,0,0,0.14),    // elevação próxima
 0 -24px 80px rgba(0,0,0,0.08)"   // penumbra difusa
```

---

## 7. Animações & Keyframes

Todos os keyframes são definidos em `ANIM_CSS` e injetados via `<AnimStyles/>` uma vez no DOM.

| Keyframe | Duração recomendada | Easing | Uso |
|---|---|---|---|
| `fadeIn` | 120–150ms | `ease` | Entrada de dropdowns, tooltips, overlays |
| `fadeSlideUp` | 160ms | `ease` | Elementos que entram de baixo (não usado em sheets) |
| `slideInRight` | 220ms | `cubic-bezier(0.16,1,0.3,1)` | Drawers laterais (desktop) |
| `sheetUp` | 500ms | `cubic-bezier(0.32,0.72,0,1)` | Entrada de bottom sheets (iOS-accurate) |
| `sheetDown` | 380ms | `cubic-bezier(0.32,0.72,0,1)` | Saída de bottom sheets |
| `backdropIn` | 220ms | `ease-out` | Fade-in de backdrops |
| `backdropOut` | 380ms | `ease-in` | Fade-out de backdrops |
| `drawerIn` | 220ms | `ease-out` | Nova Transação drawer |
| `successPop` | 180ms | `ease-out` | Feedback de ação bem-sucedida |
| `progressFill` | 800ms | `cubic-bezier(0.16,1,0.3,1)` | Barras de progresso ao entrar |
| `countUp` | 400ms | `ease-out` | AnimNum (contagem de valores) |
| `pulseOnce` | 600ms | `ease-out` | Destaque em elemento após ação |
| `shimmer` | 1.4s infinite | `linear` | Skeleton loading |
| `spin` | 1s infinite | `linear` | Spinners de carregamento |

### Easing Curves Explicadas
- `cubic-bezier(0.32,0.72,0,1)` — **iOS Sheet**: começa rápido, desacelera pronunciado. Curva real das sheet presentations do iOS.
- `cubic-bezier(0.16,1,0.3,1)` — **Spring**: decelera com leve overshoot visual. Boa para slides e expansões.
- `cubic-bezier(0.22,1,0.36,1)` — **EaseOutExpo**: aceleração intensa no início, quase-instantâneo. **Evitar para sheets** (parece teleporte).

### `PageEnter`
Componente wrapper que aplica `fadeIn 0.18s ease` em cada troca de tela. Não usa `transform` para não criar `containing block` que quebraria `position:fixed` dos modais.

---

## 8. Componentes Globais

### Primitivos de UI

#### `AnimNum`
Anima numericamente um valor de 0 até o alvo em 400ms. Usa `requestAnimationFrame`.
```jsx
<AnimNum value={9550} prefix="R$" suffix="" format="brl"/>
```

#### `AnimBar`
Barra de progresso que preenche de 0% ao valor alvo ao montar. Usada em orçamentos, metas.

#### `ProgBar`
Barra de progresso estática com cor configurável. Base para AnimBar.

#### `PageTitle`
```jsx
<PageTitle sans="Minhas" serif="Transações"/>
```
Renderiza `<h1>` com a palavra sans em Geist 800 e a palavra serif em Instrument Serif italic.

#### `EmptyState`
```jsx
<EmptyState icon="📭" title="Sem transações" desc="Adicione sua primeira transação"/>
```
Centro-alinhado, ícone 48px, título ink, descrição inkMid. Padding 48px 24px.

#### `SectionDiv`
Divisor com label opcional centralizado. Usado para separar seções dentro de cards.

#### `InfoTip`
Ícone de `?` com tooltip ao hover. Para informações contextuais em campos.

#### `Btn`
Botão com variantes `primary` / `secondary` / `danger`. Inclui estado de loading com spinner.

#### `Badge`
Chip inline com cor configurável. Usado para status, categorias.

### Componentes de Layout

#### `Topbar`
- Altura: `56px`, `position: fixed`, `zIndex: 100`
- Desktop: busca command palette (⌘K), botão `+ Nova transação`, sininho, avatar
- Mobile: hamburguer, `+ Transação`, sininho, avatar
- Sem `position: relative` ou `zIndex` no wrapper de conteúdo (evita `containing block`)

#### `Sidebar`
- Largura: `192px`, `position: fixed`, `height: 100vh`
- Seções: PRINCIPAL, PLANEJAR, GESTÃO, CONTA
- Item ativo: fundo `T.ink`, texto branco, `border-radius: 9px`
- Items inativos: texto `T.inkMid`, hover `T.bg`
- Footer: avatar + nome + badge PREMIUM + botão de logout (aparece no hover)

#### `SidebarInner` (Mobile)
Drawer lateral que abre do lado esquerdo via `slideInRight`.

#### `DragScrollTabs`
Tabs horizontais com scroll por drag (mouse e touch). Fade de indicação nas bordas. Scrollbar escondida via CSS.

---

## 9. Ícones

**Biblioteca:** `lucide-react` (stroke icons, 24×24 padrão).

### Ícones de Navegação
| Ícone | Componente | Tela |
|---|---|---|
| `LayoutDashboard` | Visão Geral | DashboardPage |
| `ArrowLeftRight` | Transações | TransacoesPage |
| `Activity` | Ritmo | RitmoPage |
| `FlaskConical` | Simulação | SimulacaoPage |
| `Target` | Metas | MetasPage |
| `BarChart2` | Relatórios | RelatoriosPage |
| `CreditCard` | Cartões | CartõesPage |
| `Filter` | Orçamentos | OrcamentosPage |
| `Settings` | Perfil/Config | ConfiguracoesPage |

### Ícones de Ação
| Ícone | Uso |
|---|---|
| `Plus` / `PlusCircle` | Adicionar item |
| `Pencil` / `Edit3` | Editar |
| `Trash2` | Excluir |
| `X` | Fechar / remover |
| `Check` | Confirmar / selecionado |
| `Download` | Exportar CSV |
| `Upload` | Importar |
| `Search` | Busca |
| `SlidersHorizontal` | Filtros avançados |
| `ArrowUpDown` | Ordenação |
| `Calendar` | Seletor de período |
| `LogOut` | Sair da conta |

### Ícones Semânticos
| Ícone | Significado |
|---|---|
| `TrendingUp` / `ArrowUpRight` | Crescimento, receita |
| `TrendingDown` | Queda, despesa |
| `AlertTriangle` | Aviso |
| `ShieldCheck` | Segurança, confirmado |
| `Zap` | Impacto financeiro, ação rápida |
| `Star` | IA, feature premium |
| `Sparkles` | IA suggestion |
| `Repeat` / `RefreshCw` | Recorrente |
| `Clock` | Histórico, tempo |
| `Trophy` / `Award` | Meta atingida |
| `Bell` | Notificações |

### Tamanhos Padrão
- `12–13px` — ícones inline em texto, dentro de chips
- `14px` — ícones em campos de formulário, labels
- `16px` — ícones de navegação (sidebar items)
- `18px` — botões médios
- `20–24px` — botões primários, ícones de destaque
- `28–32px` — empty states, heroes

---

## 10. Padrões de CTAs

### Hierarquia de Botões

#### CTA Primário
```
background: T.ink (#0F0F0D)
color: #fff
borderRadius: 10–12px
padding: 12–15px 20px
fontSize: 14–15px
fontWeight: 800
```
Uso: confirmação principal de formulários, "Registrar Despesa", "Salvar", "Aplicar".

#### CTA Secundário
```
background: T.surface
border: 1px solid T.border
color: T.inkMid
```
Uso: "Cancelar", ações alternativas.

#### CTA Destrutivo
```
background: T.red
color: #fff
```
Uso: "Confirmar exclusão". Sempre precedido de um passo de confirmação.

#### CTA Ghost
```
background: none
border: none
color: T.inkMid ou T.blue
```
Uso: ações secundárias, links inline.

#### Pill Button (seleção)
```
padding: 8px 14px
borderRadius: 99px
border: 1.5px solid T.border → T.ink (selected)
background: T.surface → T.ink (selected)
```
Uso: filtros, categorias, presets de período, tipo de transação.

### Estados de Botão
- **Default:** conforme acima
- **Hover:** `background` ligeiramente escurecido (via `onMouseEnter/Leave` inline)
- **Active:** `transform: scale(0.97)` via `.finly-btn:active` CSS global
- **Loading:** ícone substituído por spinner `spin`, `opacity: 0.7`, `cursor: not-allowed`
- **Disabled:** `opacity: 0.5`, `cursor: not-allowed`, sem hover effects

### Floating Action Button (Mobile)
Botão `+ Transação` na topbar mobile. `padding: 10px 18px`, `borderRadius: 12px`, `background: T.ink`.

---

## 11. Estados Vazios

Padrão consistente para todas as telas sem dados:

```jsx
<EmptyState
  icon="📭"           // emoji relevante ao contexto
  title="Sem dados"   // título direto
  desc="Explicação e chamada para ação"
/>
```

**Layout:** `textAlign: center`, `padding: 48px 24px`, ícone `fontSize: 48px`, título `fontSize: 16px fontWeight: 700`, descrição `fontSize: 13px color: T.inkMid`.

### Por Tela
| Tela | Ícone | Título |
|---|---|---|
| Transações | 📭 | Nenhuma transação encontrada |
| Recorrências | 🔁 | Nenhuma recorrência |
| Orçamentos | 🎯 | Nenhum orçamento criado |
| Metas | 🏆 | Nenhuma meta definida |
| Cartões | 💳 | Nenhum cartão cadastrado |
| Relatórios | 📊 | Dados insuficientes |

---

## 12. Bottom Sheets (Mobile)

### Especificação Visual
```
borderRadius: 24px 24px 0 0
background: T.surface (#FFFFFF)
boxShadow: 3 camadas
  0 -2px 0 rgba(0,0,0,0.05)      // borda fina
  0 -8px 32px rgba(0,0,0,0.14)   // elevação
  0 -24px 80px rgba(0,0,0,0.08)  // penumbra
```

### Handle
```
width: 36px
height: 4px
borderRadius: 99px
background: rgba(0,0,0,0.15)
margin: 10px auto 0
touchAction: none
minHeight de zona de toque: 44px (Apple HIG spec)
```

### Animações
- **Entrada:** `sheetUp 0.5s cubic-bezier(0.32,0.72,0,1)` + backdrop `backdropIn 0.22s ease-out`
- **Saída:** `sheetDown 0.38s cubic-bezier(0.32,0.72,0,1)` + backdrop `backdropOut 0.38s ease-in`
- **O componente permanece montado durante a saída** via estado `isClosing`

### Drag-to-Dismiss
- Handlers apenas no handle (não no conteúdo)
- `document.addEventListener('touchmove')` durante o gesto — zero re-renders React
- Dismiss se: velocidade > 0.45px/ms OU delta > 30% da altura do sheet
- Snap-back com spring `cubic-bezier(0.32,0.72,0,1) 0.4s`
- `overscrollBehavior: contain` na área scrollável

### Snap Points (Filtros)
- **Padrão:** `maxHeight: 72dvh`
- **Fullscreen:** `maxHeight: 92dvh` (arraste handle > 52px para cima)
- **Colapso:** arraste para baixo > 64px do estado fullscreen
- Transição entre snaps: `max-height 0.38s cubic-bezier(0.32,0.72,0,1)`

### Safe Area
```js
paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))"
```
Aplicado no footer CTA de todos os bottom sheets.

### Backdrop
```
position: absolute
inset: 0
background: rgba(0,0,0,0.45)
```
Clique fecha o sheet.

---

## 13. Navegação

### Estrutura de Rotas
```
PRINCIPAL
├── /dashboard     → DashboardPage       (Visão Geral)
├── /transacoes    → TransacoesPage      (Minhas Transações)
└── /ritmo         → RitmoPage           (Ritmo de Gastos)

PLANEJAR
├── /orcamentos    → OrcamentosPage      (Orçamentos)
├── /recorrencias  → RecorrenciasPage    (Recorrências)
├── /simulacao     → SimulacaoPage       (Simulação de Despesas)
└── /metas         → MetasPage           (Metas)

GESTÃO
├── /cartoes       → CartõesPage         (Cartões)
└── /relatorios    → RelatoriosPage      (Relatórios)

CONTA
└── /perfil        → ConfiguracoesPage   (Perfil & Configurações)
```

### Comportamento
- Router baseado em `useState(page)` — SPA sem URL real
- Troca de tela: `setPage('nomedatela')` via `navTo()`
- `PageEnter` wrapper em cada troca aplica fadeIn
- `__logout__` é interceptado antes do roteamento

---

## 14. Telas — Descrição Completa

---

### 14.1 LoginPage

**Objetivo:** Autenticação do usuário. Ponto de entrada da aplicação.

**Layout:** Dois painéis lado a lado (desktop):
- **Painel esquerdo** (dark, `#1A1A2E`): branding, tagline editorial, depoimento de usuário
- **Painel direito** (branco): formulário de login/recuperação

**Mobile:** Painel esquerdo oculto. Logo no topo, form centralizado com padding `clamp()`.

**Fluxo interno:**
1. `login` — email + senha, botão "Entrar"
2. `forgot` — email, botão "Enviar link"
3. `sent` — confirmação de envio

**Demo mode:** Qualquer email + senha válidos fazem login (dados mock).

**Particularidades:**
- `height: 100dvh` (não `100vh`) para mobile correto
- Validação inline sem libs externas
- Loading state no botão de submit

---

### 14.2 DashboardPage (Visão Geral)

**Objetivo:** Painel executivo com resumo financeiro do mês atual.

**Seções:**
1. **MiniChecklist** — onboarding progressivo ("Configure suas metas", "Adicione um cartão", etc.)
2. **KPI strip** — Saldo disponível, Receitas, Despesas do mês. Valores animados via `AnimNum`.
3. **Gráfico de fluxo** — LineChart (Recharts) com receitas vs despesas dos últimos 6 meses
4. **Distribuição por categoria** — PieChart com legenda inline
5. **Transações recentes** — últimas 5, com link para ver todas
6. **Alertas** — orçamentos próximos do limite, metas com prazo chegando

**Animações:**
- `AnimNum` nos valores KPI ao montar
- `progressFill` nas barras de categoria
- `AnimBar` nos indicadores de orçamento

**Empty state:** Cards com estado vazio quando `dataMode === "empty"`.

**StatePanelV4:** Painel lateral (toggle) que mostra estado financeiro estendido. `position: fixed`, abre pela direita.

---

### 14.3 TransacoesPage (Minhas Transações)

**Objetivo:** Centro de controle de todos os lançamentos financeiros.

**Features:**
- **Busca full-text** em descrição, categoria e tags
- **Período:** 8 presets (Hoje, Esta semana, Este mês, Mês anterior, Últimos 3m, Este ano, Todo período, Personalizado). Desktop: dropdown com `PeriodCalendar`. Mobile: no sheet de filtros.
- **Ordenação:** Data ↓↑, Valor ↓↑, Nome A→Z/Z→A
- **Filtros avançados:** Tipo (Receita/Despesa/Todos), Categoria, Método de pagamento
- **Active filter chips** — pills removíveis para cada filtro ativo
- **KPI strip** — Receitas / Despesas / Saldo calculados nos dados filtrados
- **Lista agrupada por data** — cabeçalhos sticky com total do dia
- **Paginação** — 10 por vez, botão "Carregar mais (N restantes)"
- **Export CSV** — dados filtrados
- **Detail panel** — master-detail no desktop (painel 320px lateral), bottom sheet no mobile
- **Editar transação** — abre `NovaTransacaoModal` pré-populado
- **Excluir** — dois passos (confirmar)

**TxRow (linha de transação):**
- Ícone de categoria (emoji)
- Linha 1: descrição (truncada)
- Linha 2: Categoria · Método · [●● 1177] · [↻] · [⏳ Pendente]
- Linha 3 (se parcelada): `1/12× · R$300/mês · 11 restantes`
- Linha 4 (se tags): chips de tag (máx 2 visíveis + chip `+N`)
- Coluna direita: valor total + chevron

**DetailPanel:**
- Hero: ícone grande + valor + nome da transação
- Campos: Categoria, Data, Método, Status, Recorrente
- Se parcelada: Parcela Nª de N, Vencimento, Valor parcela, Total, Já pago, Residual, Progress bar
- Tags
- Footer fixo: Editar + Excluir (com confirmação)

**Mobile bottom sheet de filtros:**
- Snap points: 72dvh (padrão) / 92dvh (fullscreen ao arrastar handle para cima)
- Drag-to-dismiss pelo handle
- Seções: Período → Ordenação → Tipo → Método → Categoria
- CTA "Ver N transações" no footer

---

### 14.4 RitmoPage (Ritmo de Gastos)

**Objetivo:** Análise visual do comportamento de gastos ao longo do tempo.

**Features:**
- Gráfico de área empilhada (AreaChart) por categoria ao longo dos meses
- Seletor de período (3m, 6m, 12m, Personalizado)
- Tabela de tendências por categoria
- Indicadores de anomalia (meses com gasto acima da média)
- Comparativo mês atual vs mês anterior

**Particularidade:** Atualmente usa dados mock estáticos (não lê `TRANSACTIONS` reais). Item de melhoria pendente.

---

### 14.5 OrcamentosPage (Orçamentos)

**Objetivo:** Controle de limites de gasto por categoria.

**Features:**
- Cards de orçamento com `AnimBar` mostrando % utilizado
- Código de cor: verde (< 75%), amber (75–99%), vermelho (100%+)
- Modal de criação/edição com campo de valor e categoria
- Resumo geral (total orçado vs total gasto)
- Filtro por período

---

### 14.6 RecorrenciasPage (Recorrências)

**Objetivo:** Gerenciar assinaturas e pagamentos automáticos.

**Features:**
- Lista com ícone, nome, valor, dia de vencimento, método
- Filtro por status (Ativo/Pausado/Todos) e tipo (Despesa/Receita)
- Toggle ativo/pausado por item
- Modal de criação com campos: descrição, valor, dia, categoria, método, periodicidade
- Resumo: total mensal de recorrências ativas
- Próximos vencimentos em destaque

---

### 14.7 SimulacaoPage (Simulação de Despesas)

**Objetivo:** Simular o impacto de novos gastos no orçamento.

**Features:**
- Input de valor com calculadora de parcela integrada
- Selector de parcelas com prévia de impacto
- Análise de impacto em 3 níveis: BAIXO / MÉDIO / ALTO
- Gráfico de fluxo futuro mostrando o compromisso ao longo dos meses
- Múltiplos cenários salvos para comparação
- `SimOnboarding` para novos usuários

---

### 14.8 MetasPage (Metas)

**Objetivo:** Acompanhamento de objetivos financeiros de longo prazo.

**Features:**
- Cards de meta com progresso visual (barra + %)
- Categorias: Reserva de emergência, Investimento, Viagem, etc.
- Drawer lateral de criação/edição com: nome, valor alvo, prazo, ícone
- Cálculo automático de aporte mensal necessário
- Progress bar animada com `progressFill`
- Estado de conquista (meta atingida) com animação `pulseOnce`

**Pendente:** Botão de contribuição não incrementa `meta.atual` nos dados.

---

### 14.9 RelatoriosPage (Relatórios)

**Objetivo:** Análise aprofundada com múltiplos tipos de visualização.

**Features:**
- Seletor de período no topo
- **Aba Resumo:** KPIs do período, evolução de saldo
- **Aba Categorias:** BarChart com gastos por categoria, ranking
- **Aba Tendências:** LineChart de receita vs despesa histórico
- **Aba Comparativo:** período atual vs período anterior
- RadarChart de distribuição de categorias
- Export PDF (stub) / Export CSV

---

### 14.10 CartõesPage (Cartões)

**Objetivo:** Gestão de cartões de crédito e acompanhamento de faturas.

**Features:**
- Carousel de cards com `DragScrollTabs`
- Card visual com gradiente por bandeira (Nubank roxo, Itaú laranja, etc.)
- Informações: limite total, disponível, fatura atual
- Tabs de conteúdo por cartão: Fatura, Recorrências, Parcelas, Análises, Histórico, Planejamento
- Detalhes de fatura: lançamentos do período, data de fechamento/vencimento
- Lista de parcelas ativas com progresso

**Mobile:** DragScrollTabs para cards e para tabs. Layout colapsado.

---

### 14.11 ConfiguracoesPage (Perfil & Configurações)

**Objetivo:** Centralizar todas as configurações da conta.

**Abas:**
- **Perfil** — nome, email, avatar, tipo de organização
- **Preferências** — moeda, tema (light/dark pendente), notificações
- **Categorias** — CRUD de categorias com tags. Cards expansíveis por categoria.
- **Tags** — gerenciamento inline (chips adicionáveis com Enter)
- **Membros** — adicionar/remover membros do plano família/negócio
- **Segurança** — alterar senha, 2FA (stub)
- **Plano** — informações do plano atual, upgrade

**DragScrollTabs** na navegação entre abas (mobile + desktop).

---

### 14.12 NovaTransacaoModal

**Objetivo:** Lançamento de novas transações. Modal central do app.

**Versão Desktop:** Drawer lateral direito 2 painéis.
- **Painel esquerdo** (quando `method === "credito"`): seleção de cartão, modalidade (à vista/parcelado), grid de parcelas, `ParcelaHybrid` (summary A+B+C)
- **Painel direito:** tipo (Despesa/Receita), valor hero com `em N× R$xx` inline, descrição + sugestão IA, categoria, data, tags, método de pagamento, toggle recorrente, impacto financeiro

**Versão Mobile:** Step-by-step (mStep 1: Tipo+Valor+Descrição → mStep 2: Detalhes → Review)

**Features:**
- **Calculadora de parcela:** inverte o cálculo (usuário digita valor da parcela, sistema calcula total)
- **Sugestão IA:** botão "Sugerir com IA" que detecta categoria + tags pelo texto da descrição
- **Impacto financeiro:** `<Zap/>` expansível mostrando análise do comprometimento
- **Transação recorrente:** toggle que transforma em recorrência
- **Review screen:** confirmação antes de registrar
- **ParcelaHybrid:** componente de detalhamento de parcelas (Split card + Timeline + Pills + Impact)

**`ParcelaHybrid`** (componente separado pré-`NovaTransacaoModal`):
- Split card (B): Por mês | Total
- Timeline (A): dots representando meses, `···` quando > 5
- Pills (C): chips de meses, `+N meses` quando > 5
- Impact alert (B): ⚡ normal / ⚠️ vermelho se > 10% do orçamento

---

## 15. Fluxos de Usuário

### Fluxo de Login
```
App abre → isLoggedIn === false → <LoginPage/>
  → Preenche email + senha → submit → setIsLoggedIn(true)
  → App principal com OnboardingFlow (se novo usuário)
```

### Fluxo de Onboarding
```
OnboardingFlow (se !onboardingCompleto)
  Step 1: Tipo de organização (Personal/Casal/Família/Negócio)
  Step 2: Nome da organização
  Step 3: Renda mensal estimada
  Step 4: Cartão principal
  → Completa → MiniChecklist mostra próximos passos
```

### Fluxo de Nova Transação
```
Topo de qualquer tela: + Nova transação
  → NovaTransacaoModal abre
  → [Desktop] Seleciona Despesa/Receita nas tabs
  → [Se Despesa] Opcionalmente: painel cartão → seleciona cartão → parcelas
  → Preenche Valor (hero input) → [Sugestão IA opcional]
  → Categoria, Data, Tags
  → Método de pagamento
  → [Opcional] Toggle Recorrente → configura periodicidade
  → Impacto financeiro expande
  → Review → Registrar
```

### Fluxo de Filtros Mobile
```
TransacoesPage → botão Filtros (com badge de ativos)
  → Bottom sheet sobe (sheetUp animation)
  → Usuário configura: Período, Ordenação, Tipo, Método, Categoria
  → Filtros aplicados em tempo real (KPI atualiza)
  → "Ver N transações" fecha sheet
  → Active chips aparecem abaixo da barra de busca
  → Cada chip tem × para remover filtro individual
```

---

## 16. Padrões de Hierarquia Visual

### Níveis de Leitura
1. **Nível 1 (hero):** Valores monetários grandes, PageTitle
2. **Nível 2 (primário):** Títulos de card, valores de KPI
3. **Nível 3 (secundário):** Descrições, metadados de transação, labels de campo
4. **Nível 4 (terciário):** Timestamps, textos de suporte, placeholders

### Hierarquia de Cards
```
Page background (T.bg #F8F7F5)
  └── Card surface (T.surface #FFF)
       ├── Section header (uppercase, T.inkGhost, letterSpacing 0.08em)
       ├── Primary content (T.ink, fontWeight 700)
       ├── Secondary content (T.inkMid, fontWeight 400)
       └── Tertiary / metadata (T.inkLight / T.inkGhost)
```

### Hierarquia de Ação
```
CTA Primário (T.ink background, #fff text)
  └── CTA Secundário (T.surface, T.border, T.inkMid)
       └── CTA Ghost (transparent, T.blue ou T.inkMid)
            └── Link inline (T.blue, underline em hover)
```

### Hierarquia de Informação em TxRow
```
Linha 1: Descrição — T.ink 13px 600 (identidade principal)
Linha 2: Categoria · Método [chip de status] — T.catColor/T.inkMid 11px
Linha 3: Parcela (se existir) — T.blue 11px mono
Linha 4: Tags — T.inkMid 10px chips
Coluna direita: Valor — T.ink 14px 700 mono
```

---

## 17. Filosofia de Design

### "Luxury Editorial Finance"
Finly não compete por atenção — ela **comanda** atenção. A estética é deliberadamente sóbria, com momentos editoriais nos títulos (Instrument Serif italic) que quebram a uniformidade sem perder o profissionalismo.

### Princípios
1. **Informação antes de decoração** — cada elemento existe porque carrega informação, não para decorar
2. **Hierarquia clara** — o olho do usuário sempre sabe onde está o dado mais importante
3. **Suavidade funcional** — animações servem para orientar, não para impressionar. Se uma animação não ajuda o usuário a entender o que aconteceu, ela não deveria existir
4. **Mobile-first com upgrade** — o design começa no mobile e ganha densidade no desktop, nunca o contrário
5. **Zero automação** — sem integrações bancárias. O lançamento manual é feature, não limitação

### Padrões de Interação
- **Hover states** em todos os elementos interativos (53 `onMouseEnter` no codebase)
- **Touch feedback** via `active: scale(0.97)` CSS global (`.finly-btn:active`)
- **Transições** padrão `all 0.15s` para cor/background, `0.18s` para transformações
- **Tooltips (`Tip`):** `position: fixed` via `getBoundingClientRect()` — nunca clipado por `overflow: hidden` de containers

---

*Documento gerado em 21/03/2026 — Finly v4 · Aislan M.*

---

---

# Apêndice: Migração para Tailwind CSS v4

> **Objetivo:** Reestruturar o Finly v4 com Tailwind CSS 4.x mantendo **100% do visual, 100% das features e zero regressão** de comportamento.  
> **Escopo de trabalho:** ~2.675 ocorrências de `style={{}}`, ~393 estilos condicionais com ternários, ~11.300 linhas de JSX.  
> **Estimativa:** Migração completa em 3–4 dias para 1 desenvolvedor experiente com Tailwind.

---

## A.1 Por que Tailwind v4 e não v3?

| Feature | Tailwind v3 | Tailwind v4 |
|---|---|---|
| Configuração | `tailwind.config.js` | CSS puro (`@theme`) |
| Engine | PostCSS | Oxide (Rust, 100× mais rápido) |
| CSS Variables nativas | Não | Sim — `var(--color-ink)` automático |
| Arbitrary values | Sim | Sim (melhorado) |
| P3 color gamut | Não | Sim |
| `@apply` | Sim | Sim |
| Container queries | Plugin | Nativo |
| Zero config padrão | Não | Sim (detecção automática) |

No v4, **cada token `@theme` vira automaticamente uma CSS custom property**. Isso significa que `T.ink = #0F0F0D` vira `var(--color-ink)` — acessível tanto no Tailwind quanto em JS quando necessário para o `recharts` (que precisa de cores via props JS).

---

## A.2 Pré-requisitos e Setup Inicial

### A.2.1 Requisitos de Ambiente
```
Node.js >= 18.0
npm >= 9.0  (ou pnpm >= 8 / bun >= 1.0)
```

### A.2.2 Criar projeto Vite + React

```bash
# Criar projeto
npm create vite@latest finly-v4 -- --template react
cd finly-v4

# Instalar dependências base
npm install

# Instalar Tailwind v4 com plugin Vite
npm install tailwindcss @tailwindcss/vite

# Instalar dependências do projeto
npm install lucide-react recharts

# Instalar clsx para classes condicionais (essencial para migração)
npm install clsx

# Instalar tw-merge para resolver conflitos de classes
npm install tailwind-merge

# Combinar os dois (padrão de mercado)
npm install clsx tailwind-merge
```

### A.2.3 Configurar Vite

`vite.config.js`:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),    // Tailwind v4 via plugin Vite (sem PostCSS separado)
  ],
})
```

### A.2.4 Estrutura de arquivos

```
finly-v4/
├── public/
├── src/
│   ├── styles/
│   │   └── globals.css          ← CSS principal (tokens + keyframes)
│   ├── lib/
│   │   └── utils.js             ← cn() helper
│   ├── data/
│   │   └── mock.js              ← TRANSACTIONS, RECORRENCIAS, etc.
│   ├── components/
│   │   ├── primitives/          ← AnimNum, PageTitle, EmptyState, etc.
│   │   ├── layout/              ← Sidebar, Topbar, DragScrollTabs
│   │   └── features/            ← NovaTransacaoModal, ParcelaHybrid, etc.
│   ├── screens/                 ← Uma pasta por tela
│   │   ├── Dashboard/
│   │   ├── Transacoes/
│   │   └── ...
│   ├── App.jsx
│   └── main.jsx
├── vite.config.js
└── package.json
```

---

## A.3 Configuração do Tema — `globals.css`

Este é o arquivo central. No Tailwind v4, **não há `tailwind.config.js`**. Todo o design system vive aqui.

```css
/* src/styles/globals.css */

@import "tailwindcss";

/* ─── TOKENS DE COR ─────────────────────────────────────────────── */
@theme {
  /* Fundos */
  --color-bg:           #F8F7F5;
  --color-surface:      #FFFFFF;
  --color-surface-hov:  #F9FAFB;
  --color-gray-light:   #F3F4F6;

  /* Bordas */
  --color-border:       #E2E5EA;
  --color-border-hov:   #D1D5DB;

  /* Ink scale (tipografia) */
  --color-ink:          #0F0F0D;
  --color-ink-mid:      #374151;
  --color-ink-light:    #4B5563;
  --color-ink-ghost:    #9CA3AF;

  /* Azul */
  --color-blue:         #2563EB;
  --color-blue-light:   #EFF6FF;
  --color-blue-mid:     #BFDBFE;

  /* Vermelho */
  --color-red:          #DC2626;
  --color-red-light:    #FEF2F2;
  --color-red-bar:      #F87171;

  /* Verde */
  --color-green:        #059669;
  --color-green-light:  #ECFDF5;
  --color-green-bar:    #34D399;

  /* Amber */
  --color-amber:        #D97706;
  --color-amber-light:  #FFFBEB;
  --color-amber-mid:    #FDE68A;

  /* Roxo */
  --color-purple:       #7C3AED;
  --color-purple-light: #F5F3FF;
  --color-purple-bar:   #A78BFA;

  /* Dark mode (Login panel) */
  --color-dark-bg:      #1A1A2E;
  --color-dark-text:    #F1F5F9;
  --color-dark-muted:   #94A3B8;
  --color-dark-purple:  #C4B5FD;
  --color-dark-red:     #F87171;

  /* ─── TIPOGRAFIA ────────────────────────────────────────────── */
  --font-sans:   'Geist', 'DM Sans', system-ui, sans-serif;
  --font-serif:  'Instrument Serif', Georgia, serif;
  --font-mono:   'Geist Mono', 'DM Mono', monospace;

  /* Font sizes customizados (além dos padrões Tailwind) */
  --text-2xs:  0.625rem;   /* 10px */
  --text-xs:   0.6875rem;  /* 11px */

  /* ─── ESPAÇAMENTO ───────────────────────────────────────────── */
  /* Tailwind v4 usa escala 4 por padrão (4px = 1 unit) */
  /* Valores do projeto já são compatíveis com a escala padrão */

  /* ─── BORDER RADIUS ─────────────────────────────────────────── */
  --radius-sheet:  1.5rem;  /* 24px — bottom sheets */
  --radius-modal:  1.125rem; /* 18px — modais */
  --radius-card:   0.75rem;  /* 12px — cards KPI */
  --radius-btn:    0.625rem; /* 10px — botões */

  /* ─── SOMBRAS ───────────────────────────────────────────────── */
  --shadow-sm:    0 1px 2px rgba(0,0,0,0.05);
  --shadow-md:    0 4px 12px rgba(0,0,0,0.07);
  --shadow-lg:    0 8px 28px rgba(0,0,0,0.10);
  --shadow-dark:  0 8px 32px rgba(0,0,0,0.35);
  --shadow-sheet: 0 -2px 0 rgba(0,0,0,0.05),
                  0 -8px 32px rgba(0,0,0,0.14),
                  0 -24px 80px rgba(0,0,0,0.08);

  /* ─── Z-INDEX ───────────────────────────────────────────────── */
  --z-sidebar:    100;
  --z-topbar:     100;
  --z-dropdown:   200;
  --z-drawer:     300;
  --z-sheet:      400;
  --z-filter:     500;
  --z-modal:      1000;
  --z-tooltip:    9999;
}

/* ─── KEYFRAMES ─────────────────────────────────────────────────── */
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(18px); }
  to   { opacity: 1; transform: translateX(0); }
}

@keyframes sheetUp {
  from { transform: translateY(100%); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

@keyframes sheetDown {
  from { transform: translateY(0);    opacity: 1; }
  to   { transform: translateY(100%); opacity: 0; }
}

@keyframes backdropIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes backdropOut {
  from { opacity: 1; }
  to   { opacity: 0; }
}

@keyframes drawerIn {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}

@keyframes successPop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.04); }
  100% { transform: scale(1); }
}

@keyframes progressFill {
  from { width: 0% !important; }
}

@keyframes countUp {
  from { opacity: 0; transform: translateY(4px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes pulseOnce {
  0%   { box-shadow: 0 0 0 0 rgba(37,99,235,0.25); }
  70%  { box-shadow: 0 0 0 8px rgba(37,99,235,0); }
  100% { box-shadow: 0 0 0 0 rgba(37,99,235,0); }
}

@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ─── ANIMAÇÕES COMO UTILITIES ──────────────────────────────────── */
@utility animate-sheet-up {
  animation: sheetUp 0.5s cubic-bezier(0.32,0.72,0,1) both;
}
@utility animate-sheet-down {
  animation: sheetDown 0.38s cubic-bezier(0.32,0.72,0,1) both;
}
@utility animate-backdrop-in {
  animation: backdropIn 0.22s ease-out both;
}
@utility animate-backdrop-out {
  animation: backdropOut 0.38s ease-in both;
}
@utility animate-fade-in {
  animation: fadeIn 0.15s ease both;
}
@utility animate-slide-right {
  animation: slideInRight 0.22s ease-out both;
}
@utility animate-drawer-in {
  animation: drawerIn 0.22s ease-out both;
}
@utility animate-success-pop {
  animation: successPop 0.18s ease-out both;
}
@utility animate-count-up {
  animation: countUp 0.4s ease-out both;
}
@utility animate-spin {
  animation: spin 1s linear infinite;
}
@utility animate-shimmer {
  animation: shimmer 1.4s linear infinite;
  background-size: 200% 100%;
}

/* ─── BASE STYLES ───────────────────────────────────────────────── */
* {
  box-sizing: border-box;
}

body {
  font-family: var(--font-sans);
  background-color: var(--color-bg);
  color: var(--color-ink);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ─── COMPONENT UTILITIES ───────────────────────────────────────── */

/* Scrollbar oculta (DragScrollTabs) */
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}

/* Números tabulares */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}

/* Active scale feedback em botões */
.btn-press:active {
  transform: scale(0.97);
}

/* Skeleton shimmer base */
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-gray-light) 25%,
    var(--color-border) 50%,
    var(--color-gray-light) 75%
  );
  background-size: 200% 100%;
}
```

---

## A.4 Utilitário `cn()` — Classes Condicionais

Substitui os ternários inline de `style={{}}`. **Essencial** para a migração.

```js
// src/lib/utils.js
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combina classes Tailwind resolvendo conflitos.
 * Substitui o padrão: style={{ color: isActive ? T.ink : T.inkMid }}
 * Por: cn('text-ink-mid', isActive && 'text-ink')
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
```

**Exemplo de uso:**
```jsx
// Antes (inline style com ternário)
<button style={{
  background: isActive ? T.ink : T.surface,
  color: isActive ? '#fff' : T.inkMid,
  border: `1px solid ${isActive ? T.ink : T.border}`
}}>

// Depois (Tailwind com cn)
<button className={cn(
  'border rounded-btn px-4 py-2 text-sm font-bold transition-all',
  isActive
    ? 'bg-ink text-white border-ink'
    : 'bg-surface text-ink-mid border-border'
)}>
```

---

## A.5 Como expor tokens para Recharts e JS

O Recharts recebe cores via props JavaScript. Como os tokens agora são CSS variables, crie um arquivo de constantes:

```js
// src/lib/tokens.js

/**
 * Espelha os tokens CSS para uso em libs JS (Recharts, animações, etc.)
 * Manter sincronizado com globals.css @theme
 */
export const colors = {
  bg:          '#F8F7F5',
  surface:     '#FFFFFF',
  border:      '#E2E5EA',
  ink:         '#0F0F0D',
  inkMid:      '#374151',
  inkLight:    '#4B5563',
  inkGhost:    '#9CA3AF',
  blue:        '#2563EB',
  blueLight:   '#EFF6FF',
  red:         '#DC2626',
  redLight:    '#FEF2F2',
  redBar:      '#F87171',
  green:       '#059669',
  greenLight:  '#ECFDF5',
  greenBar:    '#34D399',
  amber:       '#D97706',
  amberLight:  '#FFFBEB',
  purple:      '#7C3AED',
  purpleLight: '#F5F3FF',
  purpleBar:   '#A78BFA',
  grayLight:   '#F3F4F6',
}

// Alternativa: ler do DOM em runtime (mais robusto se tema mudar)
export function getCSSVar(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name).trim()
}
// uso: getCSSVar('--color-blue') → '#2563EB'
```

---

## A.6 Mapeamento Completo: Tokens → Classes Tailwind

### Cores de Fundo
| Antes (JS) | Depois (Tailwind) |
|---|---|
| `background: T.bg` | `bg-bg` |
| `background: T.surface` | `bg-surface` |
| `background: T.surfaceHov` | `bg-surface-hov` |
| `background: T.grayLight` | `bg-gray-light` |
| `background: T.blueLight` | `bg-blue-light` |
| `background: T.redLight` | `bg-red-light` |
| `background: T.greenLight` | `bg-green-light` |
| `background: T.amberLight` | `bg-amber-light` |
| `background: T.purpleLight` | `bg-purple-light` |
| `background: T.ink` | `bg-ink` |
| `background: T.blue` | `bg-blue` |
| `background: T.red` | `bg-red` |
| `background: T.green` | `bg-green` |
| `background: "#fff"` | `bg-white` |
| `background: "none"` | `bg-transparent` |
| `background: "rgba(0,0,0,0.45)"` | `bg-black/45` |

### Cores de Texto
| Antes | Depois |
|---|---|
| `color: T.ink` | `text-ink` |
| `color: T.inkMid` | `text-ink-mid` |
| `color: T.inkLight` | `text-ink-light` |
| `color: T.inkGhost` | `text-ink-ghost` |
| `color: T.blue` | `text-blue` |
| `color: T.red` | `text-red` |
| `color: T.green` | `text-green` |
| `color: T.amber` | `text-amber` |
| `color: T.purple` | `text-purple` |
| `color: "#fff"` | `text-white` |

### Bordas
| Antes | Depois |
|---|---|
| `border: \`1px solid ${T.border}\`` | `border border-border` |
| `border: \`1.5px solid ${T.ink}\`` | `border-[1.5px] border-ink` |
| `borderBottom: \`1px solid ${T.border}\`` | `border-b border-border` |
| `borderTop: \`1px solid ${T.border}\`` | `border-t border-border` |
| `borderLeft: \`3px solid ${T.ink}\`` | `border-l-[3px] border-ink` |
| `borderLeft: "3px solid transparent"` | `border-l-[3px] border-transparent` |

### Border Radius
| Antes | Depois |
|---|---|
| `borderRadius: 99` | `rounded-full` |
| `borderRadius: 9999` | `rounded-full` |
| `borderRadius: "50%"` | `rounded-full` |
| `borderRadius: 8` | `rounded-lg` (8px) |
| `borderRadius: 9` ou `10` | `rounded-[10px]` |
| `borderRadius: 12` | `rounded-xl` (12px) |
| `borderRadius: 14` | `rounded-[14px]` |
| `borderRadius: 16` | `rounded-2xl` (16px) |
| `borderRadius: 18` | `rounded-[18px]` |
| `borderRadius: "24px 24px 0 0"` | `rounded-t-[24px] rounded-b-none` |

### Tipografia
| Antes | Depois |
|---|---|
| `fontSize: 10, ...G` | `text-[10px] font-sans` |
| `fontSize: 11, ...G` | `text-xs font-sans` (11px) |
| `fontSize: 12, ...G` | `text-[12px] font-sans` |
| `fontSize: 13, ...G` | `text-[13px] font-sans` |
| `fontSize: 14, ...G` | `text-sm font-sans` |
| `fontSize: 16, ...G` | `text-base font-sans` |
| `fontSize: 18, ...G` | `text-lg font-sans` |
| `...S` (Instrument Serif) | `font-serif italic` |
| `...NUM` | `tabular-nums` |
| `fontFamily: "'Geist Mono'"` | `font-mono` |
| `fontWeight: 400` | `font-normal` |
| `fontWeight: 500` | `font-medium` |
| `fontWeight: 600` | `font-semibold` |
| `fontWeight: 700` | `font-bold` |
| `fontWeight: 800` | `font-extrabold` |
| `textTransform: "uppercase"` | `uppercase` |
| `letterSpacing: "0.07em"` | `tracking-[0.07em]` |
| `letterSpacing: "0.08em"` | `tracking-[0.08em]` |
| `letterSpacing: "-0.02em"` | `tracking-[-0.02em]` |

### Layout & Flexbox
| Antes | Depois |
|---|---|
| `display: "flex"` | `flex` |
| `display: "grid"` | `grid` |
| `display: "none"` | `hidden` |
| `display: "inline-flex"` | `inline-flex` |
| `flexDirection: "column"` | `flex-col` |
| `flexDirection: "row"` | `flex-row` |
| `alignItems: "center"` | `items-center` |
| `alignItems: "flex-start"` | `items-start` |
| `alignItems: "baseline"` | `items-baseline` |
| `justifyContent: "center"` | `justify-center` |
| `justifyContent: "space-between"` | `justify-between` |
| `justifyContent: "flex-end"` | `justify-end` |
| `flex: 1` | `flex-1` |
| `flexShrink: 0` | `shrink-0` |
| `flexWrap: "wrap"` | `flex-wrap` |
| `flexWrap: "nowrap"` | `flex-nowrap` |
| `gap: 4` | `gap-1` |
| `gap: 6` | `gap-1.5` |
| `gap: 8` | `gap-2` |
| `gap: 10` | `gap-2.5` |
| `gap: 12` | `gap-3` |
| `gap: 16` | `gap-4` |
| `gap: 20` | `gap-5` |
| `gap: 24` | `gap-6` |

### Grid
| Antes | Depois |
|---|---|
| `gridTemplateColumns: "1fr 1fr"` | `grid-cols-2` |
| `gridTemplateColumns: "1fr 1fr 1fr"` | `grid-cols-3` |
| `gridTemplateColumns: "repeat(4,1fr)"` | `grid-cols-4` |
| `gridTemplateColumns: "repeat(7,1fr)"` | `grid-cols-7` |

### Padding
| Antes | Depois |
|---|---|
| `padding: "8px 14px"` | `px-3.5 py-2` |
| `padding: "9px 13px"` | `px-[13px] py-[9px]` |
| `padding: "10px 16px"` | `px-4 py-2.5` |
| `padding: "12px 16px"` | `px-4 py-3` |
| `padding: "14px 16px"` | `px-4 py-3.5` |
| `padding: "16px 20px"` | `px-5 py-4` |
| `padding: "18px 20px"` | `px-5 py-[18px]` |

> **Nota:** Valores ímpares como `9px`, `13px`, `18px` usam `px-[valor]` (arbitrary value).

### Posicionamento
| Antes | Depois |
|---|---|
| `position: "fixed"` | `fixed` |
| `position: "absolute"` | `absolute` |
| `position: "relative"` | `relative` |
| `position: "sticky"` | `sticky` |
| `inset: 0` | `inset-0` |
| `top: 0` | `top-0` |
| `zIndex: 100` | `z-[100]` |
| `zIndex: 200` | `z-[200]` |
| `zIndex: 500` | `z-[500]` |
| `zIndex: 9999` | `z-[9999]` |

### Dimensões
| Antes | Depois |
|---|---|
| `width: "100%"` | `w-full` |
| `height: "100%"` | `h-full` |
| `width: 192` | `w-48` |
| `height: 56` | `h-14` |
| `minWidth: 0` | `min-w-0` |
| `minHeight: 0` | `min-h-0` |
| `maxHeight: "92dvh"` | `max-h-[92dvh]` |
| `height: "100dvh"` | `h-dvh` |

### Overflow & Scroll
| Antes | Depois |
|---|---|
| `overflow: "hidden"` | `overflow-hidden` |
| `overflowY: "auto"` | `overflow-y-auto` |
| `overflowX: "hidden"` | `overflow-x-hidden` |
| `overscrollBehavior: "contain"` | `overscroll-contain` |

### Sombras
| Antes | Depois |
|---|---|
| `boxShadow: T.sm` | `shadow-sm` |
| `boxShadow: T.md` | `shadow-md` |
| `boxShadow: T.lg` | `shadow-lg` |
| `boxShadow: T.dark` | `shadow-dark` |
| `boxShadow: "0 -2px 0..."` (sheet) | `shadow-sheet` |

### Transições
| Antes | Depois |
|---|---|
| `transition: "all 0.15s"` | `transition-all duration-150` |
| `transition: "all 0.18s"` | `transition-all duration-[180ms]` |
| `transition: "background 0.15s"` | `transition-colors duration-150` |
| `transition: "border-color 0.15s"` | `transition-colors duration-150` |

### Animações
| Antes | Depois |
|---|---|
| `animation: "fadeIn 0.15s ease both"` | `animate-fade-in` |
| `animation: "sheetUp 0.5s ..."` | `animate-sheet-up` |
| `animation: "sheetDown 0.38s ..."` | `animate-sheet-down` |
| `animation: "backdropIn 0.22s ..."` | `animate-backdrop-in` |
| `animation: "backdropOut 0.38s ..."` | `animate-backdrop-out` |
| `animation: "slideInRight 0.22s ..."` | `animate-slide-right` |
| `animation: "drawerIn 0.22s ..."` | `animate-drawer-in` |
| `animation: "spin 1s linear infinite"` | `animate-spin` |
| `animation: "shimmer 1.4s ..."` | `animate-shimmer skeleton` |

---

## A.7 Padrão para Estilos Condicionais

O padrão mais frequente no Finly é: **aparência diferente quando ativo vs inativo**. Com Tailwind:

```jsx
// Antes — pill button com estado ativo
<button style={{
  padding: '8px 14px',
  borderRadius: 99,
  border: `1.5px solid ${isActive ? T.ink : T.border}`,
  background: isActive ? T.ink : T.surface,
  color: isActive ? '#fff' : T.inkMid,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}}>

// Depois
<button className={cn(
  'px-3.5 py-2 rounded-full border-[1.5px] text-[13px] font-semibold cursor-pointer',
  'transition-colors duration-150',
  isActive
    ? 'border-ink bg-ink text-white'
    : 'border-border bg-surface text-ink-mid hover:border-border-hov'
)}>
```

```jsx
// Antes — sort row com estado ativo
<button style={{
  display: 'flex',
  justifyContent: 'space-between',
  padding: '14px 16px',
  borderLeft: sortBy === key ? `3px solid ${T.ink}` : '3px solid transparent',
  background: sortBy === key ? `${T.ink}06` : T.surface,
  color: sortBy === key ? T.ink : T.inkMid,
  fontWeight: sortBy === key ? 700 : 400,
}}>

// Depois
<button className={cn(
  'flex justify-between w-full px-4 py-3.5 border-l-[3px]',
  sortBy === key
    ? 'border-ink bg-ink/[0.04] text-ink font-bold'
    : 'border-transparent bg-surface text-ink-mid font-normal'
)}>
```

### Padrão para catColor (cores dinâmicas por categoria)

As cores de categoria são **completamente dinâmicas** (calculadas em runtime por string). Estas **não podem** ser classes Tailwind estáticas — devem permanecer como `style` inline para a parte da cor:

```jsx
// Manter como style inline — cor calculada em runtime
<span
  style={{ color: catColor(tx.cat), borderColor: catColor(tx.cat) }}
  className="text-xs font-semibold rounded-full border px-2 py-0.5"
>
  {tx.cat}
</span>
```

> **Regra:** Qualquer cor que depende de dados dinâmicos (categoria, cartão, usuário) **permanece em `style`**. Classes Tailwind são para valores estáticos de design.

---

## A.8 Estratégia de Migração — Passo a Passo

### Fase 0 — Preparação (½ dia)

```bash
# 1. Copiar arquivo fonte
cp finly-v4-full.jsx src/App.jsx

# 2. Separar dados mock
# Extrair TRANSACTIONS, RECORRENCIAS, CAT_LIST, etc. para src/data/mock.js

# 3. Criar globals.css com todo o conteúdo da Seção A.3

# 4. Importar no main.jsx
# import './styles/globals.css'

# 5. Instalar e configurar (ver Seção A.2)

# 6. Verificar que o app renderiza identicamente (com inline styles ainda)
npm run dev
```

### Fase 1 — Componentes Primitivos (½ dia)

Migrar primeiro os componentes menores e mais reutilizados:

**Prioridade:**
1. `PageTitle` — padrão de tipografia editorial
2. `EmptyState` — padrão de layout centralizado
3. `Badge` / `Btn` — padrões de botão
4. `ProgBar` / `AnimBar` — padrão de progress bar
5. `SectionDiv` — separador

**Técnica:** Para cada componente, substituir `style={{...}}` por `className={cn(...)}`. Testar visualmente após cada componente.

```jsx
// Exemplo: PageTitle migrado
const PageTitle = ({ sans, serif: serifWord }) => (
  <h1 className="m-0 leading-[1.1] flex items-baseline flex-wrap gap-[7px]">
    <span className="font-sans text-[30px] font-extrabold text-ink tracking-[-0.025em]">
      {sans}
    </span>
    {serifWord && (
      <span className="font-serif italic text-[32px] text-ink">
        {serifWord}
      </span>
    )}
  </h1>
)
```

### Fase 2 — Layout Base (½ dia)

1. `Topbar` — posicionamento fixed, z-index, altura 56px
2. `Sidebar` / `SidebarInner` — largura 192px, scroll, itens de nav
3. `DragScrollTabs` — scroll horizontal, fade edges

**Atenção especial em Topbar:**
```jsx
// Topbar — o z-index é crítico (não pode ter position:relative que crie stacking context)
<header className="fixed top-0 left-0 right-0 h-14 bg-surface border-b border-border z-[100] flex items-center justify-between px-4">
```

### Fase 3 — Telas em ordem de complexidade (1,5 dias)

**Ordem recomendada (menos → mais complexa):**

1. `LoginPage` — layout two-column, form states
2. `MetasPage` — cards simples com progress
3. `OrcamentosPage` — cards + modal
4. `RecorrenciasPage` — lista + modal
5. `RitmoPage` — gráficos (recharts permanece igual)
6. `RelatoriosPage` — tabs + gráficos
7. `CartõesPage` — carousel + tabs
8. `DashboardPage` — múltiplos componentes
9. `SimulacaoPage` — calculadora + gráficos
10. `ConfiguracoesPage` — múltiplas tabs + CRUD
11. `TransacoesPage` — mais complexa (filtros, master-detail, bottom sheet)

### Fase 4 — Modais e Overlays (½ dia)

1. `NovaTransacaoModal` — drawer + painel duplo
2. `PeriodCalendar` — calendário customizado
3. `ParcelaHybrid` — componente de parcelas
4. Bottom sheets — animações de entrada/saída
5. `StatePanelV4` — painel lateral
6. `OnboardingFlow` — steps animados

### Fase 5 — QA Visual (½ dia)

Para cada tela:
1. Comparar screenshots antes/depois pixel a pixel
2. Testar em mobile (375px) e desktop (1280px)
3. Testar interações (hover, active, focus)
4. Testar animações de entrada/saída de modais
5. Testar bottom sheets: entrada, dismiss, expand

---

## A.9 Armadilhas e Casos Especiais

### 9.1 O padrão `{...G}` (spread de objeto de estilo)

O `{...G}` espalha `{ fontFamily: "'Geist'..." }` em praticamente todos os elementos. No Tailwind, isso se torna **implícito** (o `font-sans` é a fonte padrão do `body`). Remover todos os `{...G}` é seguro — a fonte já está aplicada globalmente.

```css
/* No globals.css */
body { font-family: var(--font-sans); }
/* Todos os elementos herdam — {…G} se torna desnecessário */
```

O `{...S}` (Instrument Serif) e `{...NUM}` (tabular-nums) **precisam** ser classes explícitas onde usados.

### 9.2 Template literals com tokens

```jsx
// Antes — borda condicional com template literal
border: `1px solid ${isActive ? T.ink : T.border}`

// Depois — não pode misturar Tailwind com template literal
// Solução: cn() com classes completas
className={cn(
  'border',
  isActive ? 'border-ink' : 'border-border'
)}
```

### 9.3 Cores com opacidade

```jsx
// Antes
background: `${T.ink}08`    // ink com 3% opacidade (hex)
background: `${T.blue}18`   // blue com 9% opacidade

// Depois — Tailwind v4 suporta opacidade via /N
className="bg-ink/[0.03]"
className="bg-blue/[0.09]"

// Ou via arbitrary value
className="bg-[color:oklch(from_var(--color-ink)_l_c_h_/_0.03)]"
// (use bg-ink/[valor_decimal] que é mais simples)
```

### 9.4 `calc()` e `env()` — manter como arbitrary values

```jsx
// Antes
paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))"

// Depois — arbitrary value
className="pb-[calc(12px+env(safe-area-inset-bottom,0px))]"

// Ou como CSS custom property definida no globals.css:
// --safe-bottom: env(safe-area-inset-bottom, 0px);
// E usar: className="pb-[calc(12px+var(--safe-bottom))]"
```

### 9.5 Recharts — manter 100% em JS

```jsx
// Recharts recebe cores via props — não muda com Tailwind
// Usar o arquivo tokens.js (Seção A.5)
import { colors } from '../lib/tokens'

<LineChart>
  <Line stroke={colors.blue} />
  <Line stroke={colors.green} />
</LineChart>
```

### 9.6 Drag handlers — nenhuma mudança

Os `onTouchStart`, `onTouchMove`, `onTouchEnd` e a lógica de DOM manipulation direta (`el.style.transform`) **não mudam**. São JS puro, independentes de CSS.

### 9.7 `catColor()` e cores dinâmicas

A função `catColor(categoria)` retorna uma cor em runtime com base no nome da categoria. Essas cores **não podem ser classes Tailwind** — usar `style` inline somente para a parte da cor:

```jsx
// Padrão recomendado para elementos com cor dinâmica
<span
  className="text-xs font-semibold px-2.5 py-1 rounded-full border"
  style={{
    color: catColor(cat),
    borderColor: catColor(cat),
    background: catBg(cat),  // versão transparente da cor
  }}
>
```

### 9.8 AnimNum — manter lógica JS, migrar apenas o container

```jsx
// O useEffect com requestAnimationFrame não muda
// Apenas a div wrapper muda:
<div className={cn(
  'font-mono tabular-nums font-extrabold tracking-[-0.02em]',
  isPositive ? 'text-green' : 'text-red'
)}>
  {displayValue}
</div>
```

### 9.9 ErrorBoundary — classe component, não muda

```jsx
// Class components não usam hooks — nenhuma incompatibilidade
class ErrorBoundary extends React.Component { ... }
```

### 9.10 `drawerIn` — animação inline em alguns componentes

Verificar todos os `<style>` tags inline em componentes (NovaTransacaoModal, MetasPage, etc.) e mover para `globals.css`. No Tailwind v4, **não deve haver `@keyframes` em `<style>` tags JSX** — tudo no CSS global.

---

## A.10 Scripts de Verificação

### Checar imports do Babel (remover após migração)
```bash
grep -n "cdn.jsdelivr\|unpkg.com\|babel.min\|react.production" src/ -r
# Deve retornar vazio após migração para Vite
```

### Checar style={{ }} residuais
```bash
# Contar ocorrências de style={{ por arquivo
grep -c 'style={{' src/**/*.jsx | sort -t: -k2 -n -r | head -20

# Aceito: style inline apenas para cores dinâmicas, transforms de drag, recharts
# Não aceito: padding, margin, color, fontSize estáticos
```

### Checar token T.* residuais
```bash
grep -rn '\bT\.' src/ --include="*.jsx" | grep -v "//\|tokens\|catColor\|catBg\|recharts"
# Deve retornar apenas usos legítimos de tokens dinâmicos
```

---

## A.11 Checklist Final de Migração

### Setup
- [ ] Projeto Vite criado e rodando
- [ ] Tailwind v4 instalado com `@tailwindcss/vite`
- [ ] `globals.css` com todos os tokens `@theme`
- [ ] Keyframes definidos no CSS global
- [ ] `cn()` utilitário criado
- [ ] `tokens.js` com espelho das cores para JS
- [ ] Google Fonts importadas no `index.html` (não via CSS `@import`)
- [ ] `main.jsx` importa `globals.css`

### Componentes
- [ ] `AnimStyles` removido (keyframes agora no CSS global)
- [ ] `PageTitle` migrado
- [ ] `EmptyState` migrado
- [ ] `Badge`, `Btn`, `ProgBar`, `AnimBar` migrados
- [ ] `SectionDiv`, `InfoTip` migrados
- [ ] `Topbar` migrado (verificar z-index, sem stacking context)
- [ ] `Sidebar` / `SidebarInner` migrados
- [ ] `DragScrollTabs` migrado (scrollbar-none via CSS class)
- [ ] `PeriodCalendar` migrado
- [ ] `ParcelaHybrid` migrado
- [ ] `NovaTransacaoModal` migrado

### Telas
- [ ] `LoginPage` migrada
- [ ] `DashboardPage` migrada
- [ ] `TransacoesPage` migrada (incluindo bottom sheet)
- [ ] `RitmoPage` migrada
- [ ] `OrcamentosPage` migrada
- [ ] `RecorrenciasPage` migrada
- [ ] `SimulacaoPage` migrada
- [ ] `MetasPage` migrada
- [ ] `RelatoriosPage` migrada
- [ ] `CartõesPage` migrada
- [ ] `ConfiguracoesPage` migrada

### Comportamento
- [ ] Drag bottom sheet funciona igual
- [ ] Expand (snap fullscreen) funciona igual
- [ ] Dismiss com animação funciona igual
- [ ] Recharts renderiza com cores corretas
- [ ] Animações de entrada de tela (PageEnter) funcionam
- [ ] Animações de modal (drawerIn, sheetUp) funcionam
- [ ] Hover states consistentes
- [ ] Active scale (`.btn-press:active`) funciona
- [ ] Tooltips (`Tip`) com `position: fixed` funcionam
- [ ] Safe area no CTA de bottom sheets funciona

### QA Visual
- [ ] Mobile 375px — todas as telas
- [ ] Mobile 390px (iPhone 14) — todas as telas
- [ ] Desktop 1280px — todas as telas
- [ ] Desktop 1440px — todas as telas
- [ ] Bottom sheets — entrada/saída/expand
- [ ] Modal Nova Transação — desktop e mobile
- [ ] Cores de categoria dinâmicas corretas
- [ ] Valores monetários com tabular-nums
- [ ] Instrument Serif italic nos títulos

---

## A.12 Exemplo Completo — TxRow Migrado

Para ilustrar a migração de um componente real e complexo:

```jsx
// ANTES (inline styles)
const TxRow = ({ tx }) => {
  const isSelected = selected?.id === tx.id
  const isReceita  = tx.val > 0
  const hasParcela = !!tx.parcela
  const tags       = tx.tags || []

  return (
    <div
      onClick={() => setSelected(isSelected ? null : tx)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: isMobile ? '13px 16px' : '12px 18px',
        background: isSelected ? `${catColor(tx.cat)}08` : 'transparent',
        borderLeft: isSelected ? `3px solid ${catColor(tx.cat)}` : '3px solid transparent',
        cursor: 'pointer', transition: 'background 0.12s, border-color 0.12s',
      }}>

      <div style={{ width: 38, height: 38, borderRadius: 11,
        background: catBg(tx.cat), display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0, marginTop: 1 }}>
        {tx.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: '...', fontSize: 13, fontWeight: 600,
          color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', marginBottom: 3 }}>
          {tx.desc}
        </div>

        <div style={{ display: 'flex', alignItems: 'center',
          gap: 5, flexWrap: 'wrap', marginBottom: hasParcela ? 4 : 0 }}>
          <span style={{ fontSize: 11, color: catColor(tx.cat), fontWeight: 600 }}>
            {tx.cat}
          </span>
          ...
        </div>
      </div>

      <div style={{ fontFamily: 'Geist Mono', fontSize: 14, fontWeight: 700,
        color: isReceita ? T.green : T.ink }}>
        {isReceita ? '+' : '−'}{fmtBRL(tx.val)}
      </div>
    </div>
  )
}

// DEPOIS (Tailwind + cn + style inline apenas para dinâmicos)
const TxRow = ({ tx }) => {
  const isSelected = selected?.id === tx.id
  const isReceita  = tx.val > 0
  const hasParcela = !!tx.parcela
  const tags       = tx.tags || []

  return (
    <div
      onClick={() => setSelected(isSelected ? null : tx)}
      className={cn(
        'flex items-start gap-3 cursor-pointer',
        'transition-[background,border-color] duration-[120ms]',
        isMobile ? 'px-4 py-[13px]' : 'px-[18px] py-3',
        'border-l-[3px]',
      )}
      style={{
        // Cor dinâmica de categoria — não pode ser classe Tailwind
        background: isSelected ? `${catColor(tx.cat)}08` : 'transparent',
        borderLeftColor: isSelected ? catColor(tx.cat) : 'transparent',
      }}
    >
      <div
        className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center text-[18px] shrink-0 mt-px"
        style={{ background: catBg(tx.cat) }}
      >
        {tx.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-ink truncate mb-[3px]">
          {tx.desc}
        </div>

        <div className={cn(
          'flex items-center gap-[5px] flex-wrap',
          hasParcela ? 'mb-1' : 'mb-0'
        )}>
          <span
            className="text-[11px] font-semibold"
            style={{ color: catColor(tx.cat) }}
          >
            {tx.cat}
          </span>
          ...
        </div>
      </div>

      <div className={cn(
        'font-mono tabular-nums text-sm font-bold shrink-0',
        isReceita ? 'text-green' : 'text-ink'
      )}>
        {isReceita ? '+' : '−'}{fmtBRL(tx.val)}
      </div>
    </div>
  )
}
```

---

*Apêndice adicionado em 21/03/2026 — Finly v4 · Design System & Migration Guide*
