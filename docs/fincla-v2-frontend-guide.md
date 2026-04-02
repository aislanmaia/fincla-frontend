# Fincla v2 — Guia Completo de Implementação do Frontend

> **Objetivo:** Transformar o frontend atual do Fincla (React + Tailwind v3) no Fincla v2, replicando fielmente o design, comportamento, telas e features do **Finly v4** (`finly-v4-full.jsx`, 11.341 linhas).  
> **Referência de código:** Todos os números de linha neste documento referem-se ao arquivo `finly-v4-full.jsx`.  
> **Screenshots:** Não incluídos nesta versão — renderize o arquivo localmente com Vite + React para referência visual.

---

## Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Setup do Projeto](#2-setup-do-projeto)
3. [Design Tokens — globals.css](#3-design-tokens--globalscss)
4. [Tipografia](#4-tipografia)
5. [Animações e Keyframes](#5-animações-e-keyframes)
6. [Componentes Primitivos](#6-componentes-primitivos)
7. [Layout Base: Sidebar + Topbar](#7-layout-base-sidebar--topbar)
8. [Navegação e Roteamento](#8-navegação-e-roteamento)
9. [Bottom Sheets (Mobile)](#9-bottom-sheets-mobile)
10. [Modal: Nova Transação](#10-modal-nova-transação)
11. [Tela: Login](#11-tela-login)
12. [Tela: Onboarding](#12-tela-onboarding)
13. [Tela: Dashboard (Visão Geral)](#13-tela-dashboard-visão-geral)
14. [Tela: Transações](#14-tela-transações)
15. [Tela: Ritmo de Gastos](#15-tela-ritmo-de-gastos)
16. [Tela: Orçamentos](#16-tela-orçamentos)
17. [Tela: Recorrências](#17-tela-recorrências)
18. [Tela: Simulação](#18-tela-simulação)
19. [Tela: Metas](#19-tela-metas)
20. [Tela: Relatórios](#20-tela-relatórios)
21. [Tela: Cartões](#21-tela-cartões)
22. [Tela: Configurações / Perfil](#22-tela-configurações--perfil)
23. [Padrões de Interação Mobile](#23-padrões-de-interação-mobile)
24. [Utilitários e Helpers](#24-utilitários-e-helpers)
25. [Checklist de Implementação](#25-checklist-de-implementação)

---

## 1. Visão Geral da Arquitetura

### Estrutura de arquivos recomendada

```
src/
├── styles/
│   └── globals.css              # Tokens @theme, keyframes, utilities
├── lib/
│   ├── utils.ts                 # cn(), fmtBRL(), parseDate()
│   └── tokens.ts                # Espelho JS dos tokens para Recharts
├── components/
│   ├── primitives/
│   │   ├── AnimNum.tsx
│   │   ├── AnimBar.tsx
│   │   ├── PageTitle.tsx
│   │   ├── EmptyState.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Btn.tsx
│   │   ├── ProgBar.tsx
│   │   ├── SectionDiv.tsx
│   │   └── InfoTip.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx          # Desktop sidebar (195px)
│   │   ├── SidebarMobile.tsx    # Drawer lateral mobile
│   │   ├── Topbar.tsx           # Barra superior 56px
│   │   └── DragScrollTabs.tsx   # Tabs horizontais scrolláveis
│   ├── sheets/
│   │   └── BottomSheet.tsx      # Componente base de bottom sheet
│   └── features/
│       ├── NovaTransacaoModal.tsx
│       ├── PeriodCalendar.tsx
│       ├── ParcelaHybrid.tsx
│       └── MiniChecklist.tsx
├── screens/
│   ├── Login/
│   ├── Onboarding/
│   ├── Dashboard/
│   ├── Transacoes/
│   ├── Ritmo/
│   ├── Orcamentos/
│   ├── Recorrencias/
│   ├── Simulacao/
│   ├── Metas/
│   ├── Relatorios/
│   ├── Cartoes/
│   └── Configuracoes/
└── App.tsx                      # Router + estado global
```

### Padrão de estado global (App.tsx)

O `App` mantém o seguinte estado global — replicar exatamente (ref: linhas 10997–11095):

```tsx
// Auth
const [isLoggedIn, setIsLoggedIn] = useState(false);

// Roteamento interno
const [page, setPage] = useState<PageId>('dashboard');

// Modal de nova transação
const [modal, setModal] = useState(false);
const [modalMode, setModalMode] = useState<'transacao' | 'recorrencia'>('transacao');
const [modalPreConfig, setModalPreConfig] = useState<PreConfig | null>(null);

// Dados onboarding
const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
const [extraRecs, setExtraRecs] = useState<Rec[]>([]);
const [extraCards, setExtraCards] = useState<Card[]>([]);

// UI state
const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
const [sidebarOpen, setSidebarOpen] = useState(false);
const [mounted, setMounted] = useState(false);

// Onboarding checklist
const [checklistDismissed, setChecklistDismissed] = useState(false);
const [completedTx, setCompletedTx] = useState(false);
const [completedBudget, setCompletedBudget] = useState(false);
```

### Breakpoint mobile

```tsx
// Detectado em runtime, sem CSS media queries
const isMobile = window.innerWidth < 768;

// Atualizado no resize:
useEffect(() => {
  const onResize = () => setIsMobile(window.innerWidth < 768);
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}, []);
```

---

## 2. Setup do Projeto

```bash
npm create vite@latest fincla-v2 -- --template react-ts
cd fincla-v2
npm install tailwindcss @tailwindcss/vite
npm install lucide-react recharts
npm install clsx tailwind-merge
```

**vite.config.ts:**
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

**main.tsx:**
```tsx
import './styles/globals.css'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
```

**index.html — fontes Google (no `<head>`):**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@1&family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

---

## 3. Design Tokens — globals.css

Replicar **exatamente** estes valores (ref: linhas 169–183 do JSX para os tokens `T`):

```css
/* src/styles/globals.css */
@import "tailwindcss";

@theme {
  /* ─── FUNDOS ────────────────────────────────────────── */
  --color-bg:           #F8F7F5;   /* warm off-white — fundo global */
  --color-surface:      #FFFFFF;   /* cards, modais */
  --color-surface-hov:  #F9FAFB;
  --color-gray-light:   #F3F4F6;

  /* ─── BORDAS ─────────────────────────────────────────── */
  --color-border:       #E2E5EA;
  --color-border-hov:   #D1D5DB;

  /* ─── INK (texto) ───────────────────────────────────── */
  --color-ink:          #0F0F0D;   /* quase preto, leve warm */
  --color-ink-mid:      #374151;
  --color-ink-light:    #4B5563;
  --color-ink-ghost:    #9CA3AF;

  /* ─── AZUL ───────────────────────────────────────────── */
  --color-blue:         #2563EB;
  --color-blue-light:   #EFF6FF;
  --color-blue-mid:     #BFDBFE;

  /* ─── VERMELHO ───────────────────────────────────────── */
  --color-red:          #DC2626;
  --color-red-light:    #FEF2F2;
  --color-red-bar:      #F87171;

  /* ─── VERDE ──────────────────────────────────────────── */
  --color-green:        #059669;
  --color-green-light:  #ECFDF5;
  --color-green-bar:    #34D399;

  /* ─── AMBER ──────────────────────────────────────────── */
  --color-amber:        #D97706;
  --color-amber-light:  #FFFBEB;

  /* ─── ROXO ───────────────────────────────────────────── */
  --color-purple:       #7C3AED;
  --color-purple-light: #F5F3FF;
  --color-purple-bar:   #A78BFA;

  /* ─── DARK MODE (Login / painel esquerdo) ───────────── */
  --color-dark-bg:      #1A1A2E;
  --color-dark-text:    #F1F5F9;
  --color-dark-muted:   #94A3B8;
  --color-dark-purple:  #C4B5FD;
  --color-dark-red:     #F87171;

  /* ─── TIPOGRAFIA ─────────────────────────────────────── */
  --font-sans:  'Geist', 'DM Sans', system-ui, sans-serif;
  --font-serif: 'Instrument Serif', Georgia, serif;
  --font-mono:  'Geist Mono', monospace;

  /* ─── SOMBRAS ────────────────────────────────────────── */
  --shadow-sm:    0 1px 2px rgba(0,0,0,0.05);
  --shadow-md:    0 4px 12px rgba(0,0,0,0.07);
  --shadow-lg:    0 8px 28px rgba(0,0,0,0.10);
  --shadow-dark:  0 8px 32px rgba(0,0,0,0.35);
  --shadow-sheet: 0 -2px 0 rgba(0,0,0,0.05),
                  0 -8px 32px rgba(0,0,0,0.14),
                  0 -24px 80px rgba(0,0,0,0.08);

  /* ─── Z-INDEX ────────────────────────────────────────── */
  --z-sidebar:  100;
  --z-topbar:   100;
  --z-drawer:   300;
  --z-sheet:    400;
  --z-filter:   500;
  --z-modal:    1000;
  --z-tooltip:  9999;
}

/* ─── BASE ───────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; }

body {
  font-family: var(--font-sans);
  background: var(--color-bg);
  color: var(--color-ink);
  -webkit-font-smoothing: antialiased;
}

/* ─── SCROLLBAR OCULTA (DragScrollTabs) ─────────────────── */
.scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
.scrollbar-none::-webkit-scrollbar { display: none; }

/* ─── TABULAR NUMS ───────────────────────────────────────── */
.tabular-nums { font-variant-numeric: tabular-nums; }

/* ─── HOVER ROWS ─────────────────────────────────────────── */
.finly-row { transition: background 0.11s; }
.finly-row:hover { background: #F0EFEB !important; }

/* ─── CARD LIFT ──────────────────────────────────────────── */
.finly-card-lift {
  transition: box-shadow 0.18s ease, transform 0.18s ease;
}
.finly-card-lift:hover {
  box-shadow: 0 8px 24px rgba(0,0,0,0.09) !important;
  transform: translateY(-1px);
}

/* ─── BUTTON PRESS ───────────────────────────────────────── */
.finly-btn { transition: opacity 0.13s, transform 0.13s; }
.finly-btn:active { transform: scale(0.97) !important; }
```

### tokens.ts — espelho para Recharts

```ts
// src/lib/tokens.ts
// Valores espelhados dos tokens CSS para uso em props JS (Recharts, etc.)
export const C = {
  bg:           '#F8F7F5',
  surface:      '#FFFFFF',
  border:       '#E2E5EA',
  ink:          '#0F0F0D',
  inkMid:       '#374151',
  inkLight:     '#4B5563',
  inkGhost:     '#9CA3AF',
  blue:         '#2563EB',
  blueLight:    '#EFF6FF',
  red:          '#DC2626',
  redLight:     '#FEF2F2',
  redBar:       '#F87171',
  green:        '#059669',
  greenLight:   '#ECFDF5',
  greenBar:     '#34D399',
  amber:        '#D97706',
  amberLight:   '#FFFBEB',
  purple:       '#7C3AED',
  purpleLight:  '#F5F3FF',
  purpleBar:    '#A78BFA',
  grayLight:    '#F3F4F6',
} as const;
```

### cn() helper

```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const fmtBRL = (v: number) =>
  Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const parseDate = (str: string) => {
  // Suporta "DD/MM" e "YYYY-MM-DD"
  if (str.includes('/')) {
    const [d, m] = str.split('/');
    return new Date(2026, parseInt(m) - 1, parseInt(d));
  }
  return new Date(str);
};
```

---

## 4. Tipografia

Três objetos de estilo controlam toda a tipografia (ref: linhas 184–186):

| Token JS | CSS Tailwind | Uso |
|---|---|---|
| `{...G}` | `font-sans` | Todo texto de interface |
| `{...S}` | `font-serif italic` | Palavras decorativas em títulos |
| `{...NUM}` | `tabular-nums` | **Todos** os valores monetários sem exceção |

### Escala de tamanhos

| px | Uso |
|---|---|
| 38–48 | Input de valor hero (NovaTransacaoModal) |
| 30–32 | PageTitle |
| 22–26 | KPI hero em cards |
| 18–20 | Cabeçalhos de seção |
| 16 | Títulos de bottom sheet |
| 14 | Corpo principal, botões |
| 13 | Texto secundário, metadados |
| 12 | Labels de campo |
| 11 | Labels uppercase de seção, chips |
| 10 | Micro-labels, badges |

---

## 5. Animações e Keyframes

Adicionar ao `globals.css` (ref: linhas 71–129 do JSX — bloco `ANIM_CSS`):

```css
/* ─── KEYFRAMES ──────────────────────────────────────────── */
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
@keyframes sidebarIn {
  from { transform: translateX(-100%); }
  to   { transform: translateX(0); }
}
@keyframes drawerIn {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
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
@keyframes countUp {
  from { opacity: 0; transform: translateY(4px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes progressFill {
  from { width: 0% !important; }
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
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes sfwd  { from { opacity:0; transform:translateX(26px); } to { opacity:1; transform:translateX(0); } }
@keyframes sback { from { opacity:0; transform:translateX(-26px);} to { opacity:1; transform:translateX(0); } }

/* ─── ANIMATION UTILITIES ────────────────────────────────── */
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
@utility animate-fade-slide-up {
  animation: fadeSlideUp 0.18s ease both;
}
@utility animate-slide-right {
  animation: slideInRight 0.22s ease-out both;
}
@utility animate-drawer-in {
  animation: drawerIn 0.22s ease-out both;
}
@utility animate-count-up {
  animation: countUp 0.3s ease both;
}
@utility animate-progress-fill {
  animation: progressFill 0.85s cubic-bezier(0.16,1,0.3,1) both;
}
@utility animate-shimmer {
  background-size: 200% 100%;
  animation: shimmer 1.4s linear infinite;
}
@utility animate-spin {
  animation: spin 1s linear infinite;
}
```

### Curvas de animação importantes

| Nome | Valor | Uso |
|---|---|---|
| iOS Sheet | `cubic-bezier(0.32,0.72,0,1)` | Bottom sheets — entrada e saída |
| Spring | `cubic-bezier(0.16,1,0.3,1)` | Progress bars, expansões |
| Onboarding | `cubic-bezier(0.4,0,0.2,1)` | Transições entre steps |

---

## 6. Componentes Primitivos

### 6.1 `PageTitle`
*ref: linha 358*

Título editorial com palavra sans + palavra em Instrument Serif italic.

```tsx
// components/primitives/PageTitle.tsx
export const PageTitle = ({ sans, serif }: { sans: string; serif?: string }) => (
  <h1 className="m-0 leading-[1.1] flex items-baseline flex-wrap gap-[7px]">
    <span className="font-sans text-[30px] font-extrabold text-ink tracking-[-0.025em]">
      {sans}
    </span>
    {serif && (
      <span className="font-serif italic text-[32px] text-ink">
        {serif}
      </span>
    )}
  </h1>
);

// Exemplos de uso em cada tela:
// <PageTitle sans="Visão" serif="Geral" />
// <PageTitle sans="Minhas" serif="Transações" />
// <PageTitle sans="Ritmo de" serif="Gastos" />
// <PageTitle sans="Seus" serif="Objetivos" />
// <PageTitle sans="Cartões e" serif="Faturas" />
```

### 6.2 `Card`
*ref: linha 340*

Superfície branca elevada com hover opcional.

```tsx
export const Card = ({
  children, className, onClick, style
}: CardProps) => (
  <div
    onClick={onClick}
    className={cn(
      'bg-surface rounded-[14px] border border-border shadow-sm',
      onClick && 'cursor-pointer finly-card-lift',
      className
    )}
    style={style}
  >
    {children}
  </div>
);
```

**Variações de padding por contexto:**
- KPI strip: `p-[13px_14px]`
- Seção com conteúdo: `p-4` ou `p-5`
- Card hero (Dashboard): `p-[20px_24px]`

### 6.3 `Badge`
*ref: linha 348*

```tsx
export const Badge = ({ children, color, bg }: BadgeProps) => (
  <span
    className="font-sans tabular-nums text-[10px] font-semibold px-[7px] py-[2px] rounded-full whitespace-nowrap tracking-[0.02em]"
    style={{ color: color ?? C.inkMid, background: bg ?? C.grayLight }}
  >
    {children}
  </span>
);
```

### 6.4 `SectionDiv`
*ref: linha 365*

Separador com label e opcionalmente um valor total à direita.

```tsx
export const SectionDiv = ({ label, count, total, color = C.inkMid }: SectionDivProps) => (
  <div className="flex items-center gap-2 my-[10px]">
    <div className="w-[18px] h-[2px] rounded-full shrink-0" style={{ background: color }} />
    <span
      className="font-sans text-[10px] font-bold uppercase tracking-[0.09em]"
      style={{ color }}
    >
      {label}
    </span>
    {count && (
      <span className="font-sans text-[10px] font-normal text-ink-light">{count}</span>
    )}
    {total && (
      <span className="font-sans tabular-nums text-[12px] font-bold ml-auto" style={{ color }}>
        {total}
      </span>
    )}
  </div>
);
```

### 6.5 `EmptyState`
*ref: linha 1424*

Estado vazio padrão para todas as telas sem dados.

```tsx
export const EmptyState = ({
  icon, title, sub, cta, ctaLabel, onCta, secondaryCta, secondaryLabel, onSecondaryCta
}: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center text-center px-8 py-16 gap-4 min-h-[320px]">
    <div className="text-[48px] leading-none mb-1">{icon}</div>
    <div className="font-sans text-[20px] font-extrabold text-ink max-w-[320px] leading-[1.3]">
      {title}
    </div>
    <div className="font-sans text-[14px] text-ink-mid max-w-[380px] leading-[1.7]">{sub}</div>
    {cta && (
      <div className="flex gap-[10px] mt-2 flex-wrap justify-center">
        <button
          onClick={onCta}
          className="finly-btn font-sans bg-ink text-white border-none rounded-[11px] px-[22px] py-[11px] text-[13px] font-bold cursor-pointer flex items-center gap-1.5"
        >
          {cta}
        </button>
        {secondaryCta && (
          <button
            onClick={onSecondaryCta}
            className="finly-btn font-sans bg-transparent text-ink-mid border border-border rounded-[11px] px-[22px] py-[11px] text-[13px] font-semibold cursor-pointer"
          >
            {secondaryCta}
          </button>
        )}
      </div>
    )}
  </div>
);
```

### 6.6 `AnimNum`
*ref: linha 160*

Contador animado de 0 até o valor alvo em 700ms com easing ease-out-cubic.

```tsx
export const AnimNum = ({
  value, prefix = 'R$\u00a0', suffix = '', className
}: AnimNumProps) => {
  const [display, setDisplay] = useState(0);
  const target = typeof value === 'number'
    ? value
    : parseFloat(String(value).replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;

  useEffect(() => {
    let start: number | null = null;
    const dur = 700;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3); // ease-out-cubic
      setDisplay(target * ease);
      if (p < 1) requestAnimationFrame(step);
      else setDisplay(target);
    };
    const raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const fmt = display.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <span className={cn('animate-count-up', className)}>
      {prefix}{fmt}{suffix}
    </span>
  );
};
```

### 6.7 `ProgBar`
*ref: linha 374*

```tsx
export const ProgBar = ({
  pct, color, h = 3, delay = 0
}: { pct: number; color: string; h?: number; delay?: number }) => (
  <div
    className="w-full rounded-full overflow-hidden bg-gray-light"
    style={{ height: h }}
  >
    <div
      className="h-full rounded-full animate-progress-fill"
      style={{
        width: `${Math.min(100, Math.max(0, pct))}%`,
        background: color,
        animationDelay: `${delay}ms`,
      }}
    />
  </div>
);
```

### 6.8 `Btn`
*ref: linha 380*

```tsx
const BTN_VARIANTS = {
  dark:     { bg: C.ink,          txt: '#fff',   brd: C.ink       },
  red:      { bg: C.red,          txt: '#fff',   brd: C.red       },
  purple:   { bg: C.purple,       txt: '#fff',   brd: C.purple    },
  outGray:  { bg: 'transparent',  txt: C.inkMid, brd: C.border    },
  outPurp:  { bg: 'transparent',  txt: C.purple, brd: C.purple    },
  outRed:   { bg: 'transparent',  txt: C.red,    brd: C.red       },
  outAmber: { bg: C.amberLight,   txt: C.amber,  brd: C.amber     },
  ghost:    { bg: 'transparent',  txt: C.inkMid, brd: 'transparent' },
} as const;

export const Btn = ({
  children, variant = 'outGray', onClick, full, small
}: BtnProps) => {
  const v = BTN_VARIANTS[variant];
  return (
    <button
      onClick={onClick}
      className={cn(
        'finly-btn font-sans font-bold cursor-pointer border rounded-[10px] flex items-center justify-center gap-1.5',
        full ? 'w-full' : '',
        small ? 'text-[11px] px-3 py-[7px]' : 'text-[13px] px-4 py-[10px]',
      )}
      style={{ background: v.bg, color: v.txt, borderColor: v.brd }}
    >
      {children}
    </button>
  );
};
```

### 6.9 `DragScrollTabs`
*ref: linha 7894*

Tabs com scroll horizontal por drag (mouse) e touch nativo. Fade nas bordas indica overflow.

```tsx
export const DragScrollTabs = ({
  children, bg = C.bg
}: { children: React.ReactNode; bg?: string }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const fadeL = useRef<HTMLDivElement>(null);
  const fadeR = useRef<HTMLDivElement>(null);

  const updateFades = () => {
    const el = scrollRef.current;
    if (!el) return;
    const canScroll = el.scrollWidth > el.clientWidth + 4;
    if (fadeL.current) fadeL.current.style.opacity = el.scrollLeft > 8 ? '1' : '0';
    if (fadeR.current)
      fadeR.current.style.opacity =
        canScroll && el.scrollLeft + el.clientWidth < el.scrollWidth - 8 ? '1' : '0';
  };

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(updateFades));
    return () => cancelAnimationFrame(id);
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    const startX = e.clientX;
    const startL = el.scrollLeft;
    el.style.cursor = 'grabbing';
    const onMove = (mv: MouseEvent) => { el.scrollLeft = startL - (mv.clientX - startX); };
    const onUp = () => {
      el.style.cursor = 'grab';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="relative max-w-full">
      <div
        ref={fadeL}
        className="absolute left-0 top-0 bottom-0 w-7 z-[2] pointer-events-none opacity-0 transition-opacity duration-[180ms]"
        style={{ background: `linear-gradient(to right, ${bg}, transparent)` }}
      />
      <div
        ref={fadeR}
        className="absolute right-0 top-0 bottom-0 w-9 z-[2] pointer-events-none opacity-0 transition-opacity duration-[180ms]"
        style={{ background: `linear-gradient(to left, ${bg}, transparent)` }}
      />
      <div
        ref={scrollRef}
        className="scrollbar-none overflow-x-auto cursor-grab select-none"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onMouseDown={handleMouseDown}
        onScroll={updateFades}
      >
        {children}
      </div>
    </div>
  );
};
```

---

## 7. Layout Base: Sidebar + Topbar

### 7.1 Estrutura do layout App

```tsx
// App.tsx — estrutura de layout (ref: linhas 11100–11260)
<div className="flex h-dvh overflow-hidden">
  {/* Sidebar desktop — fixo à esquerda */}
  {!isMobile && <Sidebar page={page} onNav={navTo} />}

  {/* Sidebar mobile — drawer */}
  {isMobile && (
    <SidebarMobile
      open={sidebarOpen}
      page={page}
      onNav={navTo}
      onClose={() => setSidebarOpen(false)}
    />
  )}

  {/* Conteúdo principal */}
  <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
    <Topbar
      isMobile={isMobile}
      onNew={() => setModal(true)}
      onMenuOpen={() => setSidebarOpen(true)}
      onNav={navTo}
      page={page}
    />

    {/* Scroll container */}
    <div className="flex-1 overflow-y-auto overflow-x-hidden px-3.5 py-[14px] pb-10 md:px-7 md:py-5">
      <PageEnter key={page}>
        {/* renderizar tela ativa */}
      </PageEnter>
    </div>
  </div>
</div>
```

### 7.2 `Sidebar` (Desktop)
*ref: linhas 419–526*

```tsx
// Dimensões exatas:
width: 195px  (min-width: 195px)
height: 100vh
border-right: 1px solid C.border

// Logo:
<div className="w-7 h-7 rounded-[7px] flex items-center justify-center"
  style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}>
  <Activity size={14} color="#fff" strokeWidth={2.5} />
</div>
<span className="font-sans text-[14px] font-extrabold text-ink tracking-[0.02em]">
  FINCLA
</span>
```

**Nav items:** (ref: linha 402)
```tsx
const NAV = [
  { sec: 'PRINCIPAL' },
  { id: 'dashboard',    label: 'Visão Geral',    Icon: LayoutDashboard },
  { id: 'transacoes',   label: 'Transações',      Icon: ArrowLeftRight  },
  { id: 'ritmo',        label: 'Ritmo de Gastos', Icon: Activity        },
  { sec: 'PLANEJAR' },
  { id: 'orcamentos',   label: 'Orçamentos',      Icon: Target          },
  { id: 'recorrencias', label: 'Recorrências',    Icon: Repeat          },
  { id: 'simulacao',    label: 'Simulação',       Icon: FlaskConical, badge: '1' },
  { id: 'metas',        label: 'Metas',           Icon: BarChart2       },
  { sec: 'GESTÃO' },
  { id: 'cartoes',      label: 'Cartões',         Icon: CreditCard      },
  { id: 'relatorios',   label: 'Relatórios',      Icon: BarChart2       },
  { sec: 'CONTA' },
  { id: 'perfil',       label: 'Configurações',   Icon: Settings        },
];
```

**Estado ativo de nav item:**
```
background: C.ink  (#0F0F0D)
color: #fff
fontWeight: 600
icon strokeWidth: 2.5, color: #fff
borderRadius: 8px
padding: 8px 10px
```

**Estado inativo:**
```
background: transparent (hover → C.bg)
color: C.inkMid
fontWeight: 400
icon strokeWidth: 1.8, color: C.inkLight
```

**Footer do sidebar (usuário):**
- Avatar: gradiente `135deg, C.blue, C.purple`, iniciais em branco, `border-radius: 9999px`, 28×28px
- Nome: 12px, fontWeight 600
- Badge PREMIUM: roxo, uppercase, fontSize 10
- Botão Logout: oculto, aparece no hover da área do footer, ícone `LogOut` vermelho

### 7.3 `Topbar`
*ref: linhas 547–644*

```
height: 56px
position: fixed
top: 0, left: 0, right: 0
zIndex: 100
background: C.surface
border-bottom: 1px solid C.border
```

**Desktop:**
- Esquerda: nada (sidebar já tem o logo)
- Centro/direita: buscador `⌘K` (140px, rounded-full), botão `+ Nova transação`, sino, avatar

**Mobile:**
- Esquerda: botão hamburguer `Menu` size 20
- Centro: logo FINCLA
- Direita: botão `+ Transação` (menor), sino

**Command palette (⌘K):**
- Tecla `Ctrl+K` / `Cmd+K` abre overlay
- Input de busca no topo
- Lista agrupada por "Navegar" e "Ação"
- Fechar com `Escape`

### 7.4 `PageEnter`
*ref: linha 142*

```tsx
export const PageEnter = ({ children }: { children: React.ReactNode }) => (
  <div className="animate-fade-in" style={{ animationDuration: '0.18s' }}>
    {children}
  </div>
);
```

---

## 8. Navegação e Roteamento

### Router baseado em useState

```tsx
// App.tsx
type PageId = 'dashboard' | 'transacoes' | 'ritmo' | 'orcamentos' |
              'recorrencias' | 'simulacao' | 'metas' | 'cartoes' |
              'relatorios' | 'perfil';

const navTo = (dest: string, opts: NavOpts = {}) => {
  if (dest === '__logout__') {
    setIsLoggedIn(false);
    setPage('dashboard');
    return;
  }
  setNavOpts(opts);
  setPage(dest as PageId);
  setTimeout(() => setNavOpts({}), 100);
};

const pages: Record<PageId, React.ReactNode> = {
  dashboard:    <DashboardPage    onNav={navTo} ... />,
  transacoes:   <TransacoesPage   onNav={navTo} ... />,
  ritmo:        <RitmoPage        onNav={navTo} ... />,
  orcamentos:   <OrcamentosPage   onNav={navTo} ... />,
  recorrencias: <RecorrenciasPage onNav={navTo} ... />,
  simulacao:    <SimulacaoPage    onNav={navTo} ... />,
  metas:        <MetasPage        onNav={navTo} ... />,
  cartoes:      <CartõesPage      onNav={navTo} ... />,
  relatorios:   <RelatoriosPage   onNav={navTo} ... />,
  perfil:       <ConfiguracoesPage onNav={navTo} ... />,
};
```

---

## 9. Bottom Sheets (Mobile)

### Especificação visual obrigatória

```
border-radius: 24px 24px 0 0
background: C.surface
box-shadow: var(--shadow-sheet)  /* 3 camadas */
```

**Handle:**
```
width: 36px, height: 4px
border-radius: 99px
background: rgba(0,0,0,0.15)
zona de toque: padding 12px 0 6px, min-height 44px (Apple HIG)
touchAction: none  ← impede scroll nativo na zona do handle
```

**Animações:**
- Entrada: `sheetUp 0.5s cubic-bezier(0.32,0.72,0,1) both`
- Saída: `sheetDown 0.38s cubic-bezier(0.32,0.72,0,1) both`
- Backdrop entrada: `backdropIn 0.22s ease-out both`
- Backdrop saída: `backdropOut 0.38s ease-in both`

**Componente permanece montado durante saída** via estado `isClosing`:

```tsx
// O sheet só desmonta DEPOIS da animação de saída
const [isClosing, setIsClosing] = useState(false);
const isClosingRef = useRef(false);

const closeSheet = () => {
  if (isClosingRef.current) return;
  isClosingRef.current = true;
  setIsClosing(true);
  setTimeout(() => {
    setOpen(false);
    setIsClosing(false);
    isClosingRef.current = false;
  }, 420);
};

// JSX: sheet visível enquanto open OU isClosing
{(open || isClosing) && (
  <div className="fixed inset-0 z-[500]">
    {/* backdrop */}
    <div
      onClick={closeSheet}
      className={cn(
        'absolute inset-0 bg-black/45',
        isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
      )}
    />
    {/* sheet */}
    <div
      ref={sheetRef}
      className={cn(
        'absolute bottom-0 left-0 right-0 bg-surface flex flex-col',
        'rounded-t-[24px] shadow-sheet will-change-transform',
        isClosing ? 'animate-sheet-down' : 'animate-sheet-up',
        snapFull ? 'max-h-[92dvh]' : 'max-h-[72dvh]'
      )}
      style={{ transition: 'max-height 0.38s cubic-bezier(0.32,0.72,0,1)' }}
    >
      {/* Handle — ÚNICA zona de drag */}
      <div
        onTouchStart={onHandleTouchStart}
        className="flex flex-col items-center gap-1 pt-3 pb-1.5 shrink-0 cursor-grab select-none"
        style={{ touchAction: 'none', minHeight: 44 }}
      >
        <div className="w-9 h-1 rounded-full bg-black/[0.18]" />
        <div className="text-[7px] text-black/20">{snapFull ? '▼' : '▲'}</div>
      </div>
      {/* Conteúdo scrollável — NÃO tem touch handlers */}
      <div className="overflow-y-auto flex-1 overscroll-contain pb-4">
        {children}
      </div>
    </div>
  </div>
)}
```

**Drag handler — manipulação DOM direta durante gesto, zero setState:**

```tsx
const snapFullRef = useRef(false);
const [snapFull, _setSnapFull] = useState(false);
const setSnapFull = (v: boolean) => { snapFullRef.current = v; _setSnapFull(v); };

const onHandleTouchStart = (e: React.TouchEvent) => {
  const el = sheetRef.current;
  if (!el) return;
  const startY = e.touches[0].clientY;
  const startT = Date.now();
  let lastDelta = 0;

  const onMove = (ev: TouchEvent) => {
    const delta = ev.touches[0].clientY - startY;
    lastDelta = delta;
    if (delta < 0) {
      if (!snapFullRef.current && delta < -52) {
        setSnapFull(true);
        el.style.transform = '';
        cleanup();
      } else if (snapFullRef.current) {
        el.style.transform = `translateY(${delta / 3}px)`;
      }
    } else {
      if (snapFullRef.current && delta > 64) {
        setSnapFull(false);
        el.style.transform = '';
        cleanup();
      } else {
        el.style.transform = `translateY(${Math.max(0, delta)}px)`;
      }
    }
  };

  const onEnd = () => {
    const elapsed = Date.now() - startT;
    const velocity = lastDelta / Math.max(elapsed, 1);
    const sheetH = el.offsetHeight || 400;
    el.style.transition = 'transform 0.38s cubic-bezier(0.32,0.72,0,1)';
    if (!snapFullRef.current && (velocity > 0.45 || lastDelta > sheetH * 0.30)) {
      el.style.transform = 'translateY(105%)';
      setTimeout(() => { el.style.transform = ''; el.style.transition = ''; closeSheet(); }, 380);
    } else {
      el.style.transform = '';
      setTimeout(() => { el.style.transition = ''; }, 400);
    }
    cleanup();
  };

  const cleanup = () => {
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
  };
  document.addEventListener('touchmove', onMove, { passive: true });
  document.addEventListener('touchend', onEnd);
};
```

**Safe area no CTA footer:**
```tsx
style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
```

---

## 10. Modal: Nova Transação

*ref: linhas 5115–6457*

### Estrutura geral

**Desktop:** Drawer lateral direito (abre da direita), 2 painéis lado a lado:
- Painel esquerdo (quando `method === 'credito'`): seleção de cartão, modalidade, grid de parcelas, `ParcelaHybrid`
- Painel direito: form principal

**Mobile:** Step-by-step em 3 passos:
1. Tipo + valor + descrição
2. Categoria + data + tags + método
3. Review

### Estado interno do modal (ref: linhas 5115–5160)

```tsx
const [tipo, setTipo] = useState<'despesa' | 'receita'>('despesa');
const [centavos, setCentavos] = useState(18740); // banking-style: integer cents
const [desc, setDesc] = useState('Mercado Extra - compras da semana');
const [cat, setCat] = useState('Alimentação');
const [tags, setTags] = useState(['mercado', 'compras']);
const [method, setMethod] = useState<PayMethod>('credito');
const [parcelas, setParcelas] = useState(3);
const [modalidade, setMod] = useState<'parcelado' | 'avista'>('parcelado');
const [cartao, setCartao] = useState('nubank');
const [recorre, setRecorre] = useState(false);
const [panel, setPanel] = useState<'cartao' | 'recorrencia'>('cartao');
const [review, setReview] = useState(false);
const [success, setSuccess] = useState(false);
const [mStep, setMStep] = useState(1); // mobile only
// AI suggestion
const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
const [aiApplied, setAiApplied] = useState(false);
```

### Input de valor — banking-style

O valor é armazenado em **centavos** (integer), atualizado pelo teclado numérico. Nunca usar `<input type="number">` para isso:

```tsx
// Captura global de teclas numéricas quando modal está aberto
useEffect(() => {
  if (!open) return;
  const handler = (e: KeyboardEvent) => {
    const tag = document.activeElement?.tagName;
    const isOtherInput = (tag === 'INPUT' || tag === 'TEXTAREA') &&
                         document.activeElement !== valorInputRef.current;
    if (isOtherInput) return;
    if (/^\d$/.test(e.key)) {
      setCentavos(prev => Math.min(prev * 10 + parseInt(e.key), 9999999));
    } else if (e.key === 'Backspace') {
      setCentavos(prev => Math.floor(prev / 10));
    }
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, [open]);

// Display: centavos / 100 formatado como moeda
const valorNum = centavos / 100;
const valorDisplay = valorNum.toLocaleString('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
// Exibir: "R$ 187,40"
```

### Valor hero com info de parcela (Opção D)
*ref: linha 5662*

```tsx
{/* Valor hero */}
<div className="flex items-baseline gap-1">
  <span className="font-sans text-[14px] font-semibold text-ink-light">R$</span>
  <span className="font-sans tabular-nums text-[42px] font-extrabold text-ink tracking-[-0.03em]">
    {valorDisplay}
  </span>
</div>
{/* Info de parcela inline (apenas quando parcelado no crédito) */}
{method === 'credito' && modalidade === 'parcelado' && parcelas > 1 && valorNum > 0 && (
  <div className="flex items-baseline gap-[5px] mt-1">
    <span className="font-sans text-[11px] text-ink-ghost">em</span>
    <span className="font-sans tabular-nums text-[13px] font-bold text-ink-mid">
      {parcelas}×
    </span>
    <span className="font-sans tabular-nums text-[13px] font-semibold text-blue opacity-80">
      R$ {(valorNum / parcelas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
    </span>
  </div>
)}
```

### Botão de sugestão IA

```tsx
{desc.length > 5 && !aiApplied && (
  <button
    onClick={handleAiSuggest}
    className="finly-btn flex items-center gap-1.5 px-3 py-[6px] rounded-[8px] text-[11px] font-bold cursor-pointer"
    style={{ background: C.purpleLight, color: C.purple, border: 'none' }}
  >
    <Sparkles size={11} />
    Sugerir com IA
  </button>
)}
```

---

## 11. Tela: Login

*ref: linhas 10708–10996*

### Layout

**Desktop:** dois painéis 50/50:
- **Painel esquerdo** (`background: C.darkBg = #1A1A2E`):
  - Logo, tagline editorial, depoimento de usuário
  - Decoração: círculos com `rgba(134,239,172,0.07)` e `rgba(196,181,253,0.06)`
- **Painel direito** (branco): formulário

**Mobile:** só painel direito com logo simplificado no topo.

### Estados do form

```tsx
type LoginView = 'login' | 'forgot' | 'sent';
```

- `login`: email + senha + botão Entrar
- `forgot`: email + botão Enviar link
- `sent`: confirmação com email mascarado

### Input de formulário

Focus state com `border-color: C.blue` e `box-shadow: 0 0 0 3px C.blueLight`.

```tsx
onFocus={e => {
  e.target.style.borderColor = C.blue;
  e.target.style.boxShadow = `0 0 0 3px ${C.blueLight}`;
}}
onBlur={e => {
  e.target.style.borderColor = error ? `${C.red}66` : C.border;
  e.target.style.boxShadow = 'none';
}}
```

---

## 12. Tela: Onboarding

*ref: linhas 790–1278*

### Steps

*ref: linha 722*

```
welcome   → Boas-vindas
org       → Nome e tipo da organização
categorias→ Selecionar categorias de interesse
cartoes   → Tem cartão de crédito?
receita   → Tem receita fixa/recorrente?
membros   → Adicionar membros (família)
pronto    → Conclusão
```

### Layout

- Mobile: coluna única
- Desktop: dois painéis — esquerdo com contexto/brand (`leftBg` muda por step), direito com o form

### Animações entre steps

```css
.fwd  { animation: sfwd  0.30s cubic-bezier(0.4,0,0.2,1) both; }
.back { animation: sback 0.30s cubic-bezier(0.4,0,0.2,1) both; }
```

### Tipos de organização

```tsx
const ORG_TIPOS = [
  { id: 'pessoal',  label: 'Pessoal',   icon: '👤', desc: 'Só eu' },
  { id: 'casal',    label: 'Casal',     icon: '💑', desc: 'Eu e meu parceiro(a)' },
  { id: 'familia',  label: 'Família',   icon: '👨‍👩‍👧', desc: 'Família com filhos' },
  { id: 'negocio',  label: 'Negócio',   icon: '💼', desc: 'Empresa ou freelance' },
];
```

### Dados coletados e passados ao App

```tsx
// onComplete callback:
onComplete({
  orgNome,        // string
  orgTipo,        // 'pessoal' | 'casal' | 'familia' | 'negocio'
  cats,           // string[] — categorias selecionadas
  temCartao,      // boolean
  cardNome,       // string
  cardLim,        // string (valor)
  cardVenc,       // string (dia)
  temRec,         // boolean
  recDesc,        // 'Salário'
  recVal,         // string (valor)
  recDia,         // string (dia do mês)
  recTipo,        // 'fixo' | 'estimado'
  membros,        // string[] (emails/nomes)
});
```

---

## 13. Tela: Dashboard (Visão Geral)

*ref: linhas 1454–1989*

### Dois modos

**1. `dataMode === 'empty'` (sem transações):**
- Se tem receita recorrente: hero escuro com valor da receita animado + KPI strip + gráficos fantasmas com lock
- Se sem receita: empty state com CTA para adicionar

**2. `dataMode === 'mock'` (com dados):**
- KPI strip: Receitas / Despesas / Saldo — valores com `AnimNum`
- Gráfico de fluxo mensal (LineChart Recharts)
- Distribuição por categoria (PieChart)
- Transações recentes (últimas 5)
- Alertas de orçamento

### KPI Strip

```tsx
// Grid 3 colunas desktop, 2 colunas mobile (Saldo ocupa full width no mobile)
<div className="grid gap-2.5"
  style={{ gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)' }}>
  <Card style={{ padding: '13px 14px', borderColor: C.green, borderWidth: 1.5 }}>
    <div className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-green mb-1">
      Receitas
    </div>
    <AnimNum value={9500} className="font-sans tabular-nums text-[22px] font-extrabold text-green" />
  </Card>
  {/* Despesas — vermelho */}
  {/* Saldo — azul */}
</div>
```

### Hero card escuro (Dashboard empty com receita)

```tsx
// background: C.darkBg (#1A1A2E)
// border-radius: 16px
// overflow: hidden
// Decoração: círculo rgba(134,239,172,0.07) posicionado absolute
// Valor em: #86EFAC (verde-claro)
// Texto secundário: rgba(255,255,255,0.35)
```

### `MiniChecklist`
*ref: linhas 1279–1365*

Aparece no topo do Dashboard quando onboarding foi completado mas checklist não foi descartado.

Items:
1. Adicionar primeira transação
2. Criar orçamento para categoria
3. Conectar cartão de crédito
4. Definir primeira meta

Cada item tem ícone, label, status de completado e ação (navegar ou abrir modal).

---

## 14. Tela: Transações

*ref: linhas 2553–3690*

### Estado da tela

```tsx
const [search, setSearch] = useState('');
const [filterType, setFilterType] = useState<'todos'|'receita'|'despesa'>('todos');
const [filterCat, setFilterCat] = useState('todas');
const [filterMethod, setFilterMethod] = useState('todos');
const [sortBy, setSortBy] = useState('date-desc');
const [period, setPeriod] = useState('mes');
const [customFrom, setCustomFrom] = useState('');
const [customTo, setCustomTo] = useState('');
const [selected, setSelected] = useState<Tx | null>(null);
const [visible, setVisible] = useState(PAGE_SIZE); // 10
const [filtersOpen, setFiltersOpen] = useState(false); // mobile sheet
```

### Layout

**Desktop:** master-detail — lista à esquerda + `DetailPanel` sticky à direita (320px)
**Mobile:** lista full-width + bottom sheet ao selecionar uma transação

### TxRow — linha de transação

Hierarquia visual em 4 linhas:

```tsx
<div className="finly-row flex items-start gap-3 px-[18px] py-3 cursor-pointer border-b border-border"
  onClick={() => setSelected(tx)}>
  
  {/* Ícone de categoria */}
  <div className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center text-[18px] shrink-0 mt-[1px]"
    style={{ background: catBg(tx.cat) }}>
    {tx.icon}
  </div>

  <div className="flex-1 min-w-0">
    {/* Linha 1: descrição */}
    <div className="font-sans text-[13px] font-semibold text-ink truncate mb-[3px]">
      {tx.desc}
    </div>

    {/* Linha 2: categoria · método · flags */}
    <div className="flex items-center gap-[5px] flex-wrap mb-1">
      <span className="text-[11px] font-semibold" style={{ color: catColor(tx.cat) }}>
        {tx.cat}
      </span>
      {tx.method && (
        <span className="text-[10px] text-ink-ghost">· {methodLabel(tx.method)}</span>
      )}
      {tx.rec && <Repeat size={10} color={C.purple} />}
      {tx.status === 'pendente' && (
        <span className="text-[10px] text-amber-500">⏳ Pendente</span>
      )}
    </div>

    {/* Linha 3: info de parcela (quando parcelado) */}
    {tx.parcela && (
      <div className="font-mono tabular-nums text-[11px] text-blue mb-1">
        {tx.parcela.num}/{tx.parcela.total}× · R$ {fmtBRL(tx.parcela.valor)}/mês · {tx.parcela.restantes} restantes
      </div>
    )}

    {/* Linha 4: tags */}
    {tx.tags && tx.tags.length > 0 && (
      <div className="flex gap-1 flex-wrap">
        {tx.tags.slice(0, 2).map(tag => (
          <span key={tag} className="text-[10px] font-semibold px-2 py-[2px] rounded-full bg-gray-light text-ink-mid">
            #{tag}
          </span>
        ))}
        {tx.tags.length > 2 && (
          <span className="text-[10px] font-semibold px-2 py-[2px] rounded-full bg-gray-light text-ink-ghost">
            +{tx.tags.length - 2}
          </span>
        )}
      </div>
    )}
  </div>

  {/* Valor total */}
  <div className={cn(
    'font-sans tabular-nums text-[14px] font-bold shrink-0',
    tx.val > 0 ? 'text-green' : 'text-ink'
  )}>
    {tx.val > 0 ? '+' : '−'} R$ {fmtBRL(tx.val)}
  </div>
</div>
```

### DetailPanel (desktop)

```
position: sticky
height: calc(100dvh - 116px)  ← topbar(56) + paddingTop(20) + paddingBottom(40)
min-height: 0
display: flex
flex-direction: column
overflow: hidden
```

Estrutura interna:
1. Header: ícone grande + nome + chip de categoria
2. Valor hero: fonte grande tabular-nums
3. Campos (scroll): categoria, data, método, status, parcelas, progress bar, tags
4. Footer fixo: botões Editar + Excluir (sempre visível)

### Filtros desktop

- Período: dropdown com `PeriodCalendar` (componente inline)
- Ordenação: dropdown com lista radio
- Filtros: FilterBar com pills de tipo, categoria, método

### Bottom sheet de filtros (mobile)

Snap points: `72dvh` (padrão) → `92dvh` (arrastar handle para cima).

Seções em ordem (por frequência de uso):
1. Período (chips + inputs date nativos quando "Personalizado")
2. Ordenação (lista radio)
3. Tipo (3 botões: Todos / Receita / Despesa)
4. Método (pills scroll horizontal)
5. Categoria (pills wrap)

CTA: `"Ver {N} transações"` com contador dinâmico filtrado.

### Active filter chips

```tsx
const activeChips = [
  period !== 'tudo'    && { key: 'period',  label: periodLabel,  onRemove: () => setPeriod('tudo') },
  filterCat !== 'todas' && { key: 'cat',   label: filterCat,    onRemove: () => setFilterCat('todas') },
  // ...
].filter(Boolean);

// Renderizar acima da lista:
{activeChips.map(chip => (
  <div key={chip.key} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink text-white text-[10px] font-semibold">
    {chip.label}
    <button onClick={chip.onRemove} className="w-[14px] h-[14px] rounded-full bg-white/20 flex items-center justify-center text-[8px]">
      ×
    </button>
  </div>
))}
```

---

## 15. Tela: Ritmo de Gastos

*ref: linhas 2014–2403*

### Componente principal: gráfico de barras diário

```tsx
// AreaChart com dados diários do mês
// Eixo X: dias do mês
// Eixo Y: valor gasto
// Linha de referência: média diária esperada
// Tooltip customizado: RhythmTooltipV4 (ref: linha 708)
```

### Tabs de período

```
3 meses | 6 meses | 12 meses | Personalizado
```

Usando `DragScrollTabs`.

### Dados esperados da API

Para cada mês do período:
- Array de valores diários de gasto
- Média do mês
- Comparativo com mês anterior

---

## 16. Tela: Orçamentos

*ref: linhas 9686–10065*

### Card de orçamento

```tsx
// Cada orçamento exibe:
// - Ícone + nome da categoria (colorido)
// - Valor usado vs limite
// - ProgBar com cor dinâmica:
//   < 75%: C.green
//   75–99%: C.amber
//   >= 100%: C.red
// - % utilizado
// - Valor restante ou excedente

const barColor = (pct: number) =>
  pct >= 100 ? C.red :
  pct >= 75  ? C.amber :
  C.green;
```

### Grid layout

```
Desktop: grid 3 colunas
Mobile: grid 2 colunas
```

### Resumo geral no topo

KPI strip: Total orçado / Total gasto / Saldo livre.

---

## 17. Tela: Recorrências

*ref: linhas 3691–3962*

### Lista de recorrências

Cada item:
- Ícone fixo (ex: TV para Netflix, Home para aluguel)
- Nome + categoria
- Valor (tabular-nums)
- Próximo vencimento
- Badge de periodicidade (mensal, semanal, etc.)
- Toggle ativo/pausado
- Menu de ações (editar, excluir)

### Resumo mensal

```
Total de despesas recorrentes: R$ X.XXX,XX
Total de receitas recorrentes: R$ X.XXX,XX
Ativas: N | Pausadas: N
```

### Filtros

- Tipo: Todos / Despesas / Receitas
- Status: Todos / Ativos / Pausados

---

## 18. Tela: Simulação

*ref: linhas 4310–4987*

### Input de novo compromisso

1. Selecionar cartão
2. Informar valor total
3. Selecionar número de parcelas (grid de botões 2/3/4/5/6/8/10/12/custom)
4. Adicionar descrição

### Projeção visual

`LineChart` com:
- Linha de receita projetada (pontilhada)
- Linha de despesas atuais
- Linha de despesas com o novo compromisso
- Área de risco sombreada

### Veredito global

```
viable    → fundo verde-claro, ✓ Viável
caution   → fundo amber-claro, ⚠ Atenção
high-risk → fundo vermelho-claro, ✗ Alto risco
```

### Cenários salvos

Lista de cenários com nome, data de criação, veredito. Botão para adicionar novo cenário via `ModalNovoCenario`.

---

## 19. Tela: Metas

*ref: linhas 6480–7076*

### Card de meta

```tsx
<Card className="p-4">
  {/* Header: ícone + nome + badge de status */}
  <div className="flex items-start justify-between mb-3">
    <div className="text-[28px]">{meta.icon}</div>
    <span className={cn(
      'text-[10px] font-bold px-2 py-[3px] rounded-full',
      meta.status === 'completed' ? 'bg-green-light text-green' : 'bg-gray-light text-ink-mid'
    )}>
      {meta.status === 'completed' ? 'Concluída ✓' : 'Em andamento'}
    </span>
  </div>

  {/* Nome + descrição */}
  <div className="font-sans text-[15px] font-bold text-ink mb-1">{meta.nome}</div>
  <div className="font-sans text-[12px] text-ink-light mb-3">{meta.desc}</div>

  {/* Progresso */}
  <div className="flex items-end justify-between mb-2">
    <div>
      <div className="font-sans text-[10px] font-semibold text-ink-ghost uppercase tracking-wide mb-[2px]">
        Acumulado
      </div>
      <div className="font-sans tabular-nums text-[18px] font-extrabold text-ink">
        R$ {fmtBRL(meta.atual)}
      </div>
    </div>
    <div className="text-right">
      <div className="font-sans text-[10px] font-semibold text-ink-ghost uppercase tracking-wide mb-[2px]">
        Meta
      </div>
      <div className="font-sans tabular-nums text-[14px] font-bold text-ink-mid">
        R$ {fmtBRL(meta.alvo)}
      </div>
    </div>
  </div>

  <ProgBar pct={(meta.atual / meta.alvo) * 100} color={C.blue} h={6} />

  <div className="font-sans text-[11px] text-ink-ghost mt-1.5">
    {Math.round((meta.atual / meta.alvo) * 100)}% · prazo: {meta.prazo}
  </div>

  {/* CTA contribuição */}
  <button
    onClick={() => openContribuicao(meta)}
    className="finly-btn mt-3 w-full font-sans text-[12px] font-bold px-0 py-[9px] rounded-[9px] border border-border text-ink-mid bg-surface flex items-center justify-center gap-1.5"
  >
    <Plus size={12} /> Contribuir
  </button>
</Card>
```

### Drawer de criação/edição de meta

Drawer lateral direito no desktop, bottom sheet no mobile.

Campos: nome, valor alvo, prazo (date picker), ícone, descrição.
Campos calculados exibidos: aporte mensal necessário.

---

## 20. Tela: Relatórios

*ref: linhas 7141–7757*

### Tabs

```
Resumo | Categorias | Tendências | Comparativo
```

### Seletor de período

Chips horizontais: Este mês | Mês anterior | 3 meses | 6 meses | 12 meses | Personalizado.

### Tab Resumo

- KPI strip (receitas, despesas, saldo)
- LineChart: receita vs despesa mês a mês (últimos 6 meses)
- Top 3 categorias por gasto

### Tab Categorias

- BarChart horizontal com gastos por categoria
- Ordenado por valor (maior → menor)
- Cor da barra = cor da categoria

### Tab Tendências

- AreaChart empilhado por categoria ao longo do tempo
- Identificação de meses acima da média

### Tab Comparativo

- Lado a lado: período A vs período B
- Delta percentual com seta ↑↓

---

## 21. Tela: Cartões

*ref: linhas 7968–9652*

### Carousel de cartões

`DragScrollTabs` com cards visuais 280×160px.

**Card visual:**
```tsx
<div
  className="w-[280px] min-w-[280px] h-[160px] rounded-[16px] p-5 relative overflow-hidden cursor-pointer shrink-0"
  style={{
    background: `linear-gradient(135deg, ${card.color}, ${darken(card.color, 20)})`,
    boxShadow: `0 8px 24px ${card.color}40`,
  }}
>
  {/* Decoração: círculo grande semi-transparente */}
  <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
  
  {/* Bandeira */}
  <div className="text-white/90 text-[12px] font-bold uppercase tracking-wider mb-4">
    {card.brand}
  </div>
  
  {/* Últimos 4 dígitos */}
  <div className="font-mono text-white text-[16px] font-bold tracking-[0.2em] mb-2">
    •••• {card.last4}
  </div>
  
  {/* Nome amigável */}
  <div className="text-white/70 text-[12px]">{card.nome}</div>
  
  {/* Limite */}
  <div className="absolute bottom-4 right-5 text-right">
    <div className="text-white/50 text-[9px] uppercase tracking-wider">Disponível</div>
    <div className="font-mono text-white text-[14px] font-bold">
      R$ {fmtBRL(card.disponivel)}
    </div>
  </div>
</div>
```

### Tabs de conteúdo por cartão

```
Fatura | Recorrências | Parcelas | Análises | Histórico | Planejamento
```

Usando `DragScrollTabs`.

### Tab Fatura

- Cabeçalho: mês, data de fechamento, data de vencimento, total, status (Aberta/Fechada/Paga)
- Lista de lançamentos agrupada por data
- CTA "Marcar como Paga"

### Tab Parcelas

Lista de parcelas ativas com:
- Descrição + categoria
- `N/total × · R$ valor/mês`
- Progress bar de progresso do parcelamento
- Meses restantes

### Tab Histórico

BarChart de faturas dos últimos N meses.

---

## 22. Tela: Configurações / Perfil

*ref: linhas 10066–10707*

### Tabs

```
Perfil | Preferências | Categorias | Tags | Membros | Segurança | Plano
```

Usando `DragScrollTabs`.

### Tab Perfil

- Avatar circular com iniciais (fallback) ou foto
- Nome, sobrenome (editáveis inline)
- Email (só leitura)
- Telefone
- Tipo de organização (badge colorido)

### Tab Categorias

- Lista de categorias com ícone colorido
- Cada categoria expansível: mostra tags filhas
- Botão de nova categoria
- CRUD inline (editar nome, cor, ícone)
- Soft delete (inativar)

### Tab Tags

- Grid de chips de tags por categoria
- Input inline para nova tag (confirmar com Enter)
- Clique em tag existente = editar/remover

### Tab Membros

- Lista de membros com avatar, nome, papel (owner/member)
- Botão de convidar novo membro
- Remover membro (só owner)

---

## 23. Padrões de Interação Mobile

### Regras gerais

1. **Touch target mínimo:** 44×44px para todos elementos interativos (Apple HIG / Material)
2. **Sem hover states** que dependem de mouse — usar `:active` para feedback tátil
3. **Bottom sheets** em vez de modais para seleções complexas
4. **Safe area:** sempre `env(safe-area-inset-bottom, 0px)` nos footers fixos
5. **Scroll nativo** no conteúdo — nunca interceptar com JS

### Gestos esperados pelos usuários

| Gesto | Ação |
|---|---|
| Arrastar handle para cima | Expandir sheet para fullscreen (92dvh) |
| Arrastar handle para baixo | Fechar sheet (com animação) |
| Tap no backdrop | Fechar sheet/modal |
| Swipe horizontal | DragScrollTabs |
| Scroll vertical | Conteúdo normal |

### Inputs nativos de data

Para seleção de datas no mobile, **usar `<input type="date">`** — abre o picker nativo do SO:

```tsx
<input
  type="date"
  value={customFrom}
  onChange={e => setCustomFrom(e.target.value)}
  className="font-sans w-full px-3 py-2.5 rounded-[9px] border border-border text-[13px] text-ink bg-surface"
/>
```

---

## 24. Utilitários e Helpers

### Formatação monetária

```tsx
// Sempre usar para exibição de valores
const fmtBRL = (v: number) =>
  Math.abs(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Com prefixo
const fmtBRLFull = (v: number) => `R$ ${fmtBRL(v)}`;
```

### Cores de categoria

```tsx
const CAT_COLORS: Record<string, string> = {
  'Alimentação':   '#059669',
  'Moradia':       '#7C3AED',
  'Transporte':    '#2563EB',
  'Lazer':         '#D97706',
  'Saúde':         '#DC2626',
  'Compras':       '#0891B2',
  'Educação':      '#7C3AED',
  'Investimento':  '#059669',
  // fallback:
  default:         '#374151',
};

const catColor = (cat: string) => CAT_COLORS[cat] ?? CAT_COLORS.default;
const catBg    = (cat: string) => `${catColor(cat)}18`; // 9% opacidade
```

### Métodos de pagamento — labels PT-BR

```tsx
const METHOD_LABELS: Record<string, string> = {
  credit_card:   'Crédito',
  debit_card:    'Débito',
  pix:           'Pix',
  cash:          'Dinheiro',
  bank_transfer: 'Transferência',
  boleto:        'Boleto',
};
```

---

## 25. Checklist de Implementação

### Fase 1 — Setup e design system
- [ ] Projeto Vite + React + TypeScript criado
- [ ] Tailwind v4 configurado com `@tailwindcss/vite`
- [ ] `globals.css` com todos os tokens `@theme`
- [ ] Todos os keyframes definidos
- [ ] `cn()`, `fmtBRL()` implementados
- [ ] `tokens.ts` criado para Recharts
- [ ] Google Fonts carregadas no `index.html`

### Fase 2 — Componentes primitivos
- [ ] `PageTitle` (sans + serif)
- [ ] `Card` com hover lift
- [ ] `Badge`
- [ ] `SectionDiv`
- [ ] `EmptyState`
- [ ] `AnimNum` (contador animado)
- [ ] `AnimBar`
- [ ] `ProgBar`
- [ ] `Btn` com variantes
- [ ] `InfoTip`
- [ ] `DragScrollTabs`

### Fase 3 — Layout base
- [ ] `SidebarInner` / `Sidebar` desktop (195px, fixo)
- [ ] `SidebarMobile` (drawer com overlay)
- [ ] `Topbar` (56px, fixo, command palette ⌘K)
- [ ] `PageEnter` (fade entre telas)
- [ ] App.tsx com router useState + estado global
- [ ] Navegação funcional entre todas as telas

### Fase 4 — Bottom sheet base
- [ ] `BottomSheet` componente reutilizável
- [ ] Entrada `sheetUp` 0.5s iOS easing
- [ ] Saída `sheetDown` 0.38s (componente mountado durante saída)
- [ ] Backdrop com fade independente
- [ ] Handle com drag-to-dismiss (DOM direto, zero setState durante gesto)
- [ ] Expand para fullscreen (92dvh) ao arrastar para cima
- [ ] Safe area no CTA footer
- [ ] `overscrollBehavior: contain` no scroll

### Fase 5 — Telas (ordem de complexidade)
- [ ] LoginPage (2 painéis, 3 views)
- [ ] OnboardingFlow (7 steps, animações laterais)
- [ ] MetasPage
- [ ] OrcamentosPage
- [ ] RecorrenciasPage
- [ ] RitmoPage (Recharts AreaChart)
- [ ] RelatoriosPage (4 tabs, múltiplos charts)
- [ ] SimulacaoPage (projeção + cenários)
- [ ] DashboardPage (2 modos: empty + mock)
- [ ] CartõesPage (carousel + 6 tabs)
- [ ] ConfiguracoesPage (7 tabs + CRUD)
- [ ] TransacoesPage (master-detail + filtros + bottom sheet)

### Fase 6 — Modal Nova Transação
- [ ] Drawer lateral desktop (2 painéis)
- [ ] Input banking-style (centavos + teclado global)
- [ ] Valor hero com info de parcela inline
- [ ] Seleção de cartão e parcelas
- [ ] `ParcelaHybrid` (timeline A + split B + pills C)
- [ ] Botão sugestão IA
- [ ] Toggle recorrência
- [ ] Review screen
- [ ] Mobile step-by-step (3 passos)
- [ ] Success animation

### Fase 7 — QA Visual
- [ ] Pixel comparison: mobile 375px vs JSX original
- [ ] Desktop 1280px vs JSX original
- [ ] Animações de entrada/saída de todas as telas
- [ ] Bottom sheets: entrada, dismiss, expand fullscreen
- [ ] Valores monetários com tabular-nums
- [ ] Instrument Serif italic nos PageTitles
- [ ] Hover states desktop (rows, cards, nav)
- [ ] Active scale nos botões

---

*Documento gerado em 22/03/2026 — Fincla v2 · Guia de Implementação Frontend*  
*Referência: `finly-v4-full.jsx` (11.341 linhas)*
