# Handoff: Filtros — Transações (Variação C · Faceted Pills)

> **Usando com Claude Code?** Comece pelo **`PROMPT.md`** — ele tem o prompt inicial pronto pra colar.

## Overview

UI completa de filtros + listagem de transações para a página **Transações** do Fincla. A variação **C — Faceted Pills** combina:

- **Visualizações salvas** (saved views) com criação inline, ativação por click e exclusão com confirmação;
- **Barra de busca + ordenação multi-nível** (até 5 critérios encadeados, com tooltip de hover);
- **Barra de facets** com painéis de filtro que expandem **inline** abaixo da barra (Período, Tipo, Categoria, Tags, Cartão, Valor, Recorrência);
- **Lista de transações** já filtrada e ordenada conforme o estado.

Esta variação foi a **escolhida pelo usuário** entre três alternativas (A · Filter Bar, B · Painel lateral persistente, C · Faceted Pills). Os handoffs A e B não estão neste pacote.

## About the design files

Os arquivos JSX/HTML deste bundle são **referências de design** — protótipos em React via Babel inline, mostrando a aparência e o comportamento pretendidos. **Não é código de produção.** A tarefa é **recriar essas telas dentro do codebase `aislanmaia/fincla-frontend`** seguindo os padrões já estabelecidos:

- React + JSX, sem TypeScript no UI até agora;
- **Sem Tailwind**: estilos inline com o objeto de tokens `T` (espelhado em `shared.jsx` aqui — já está alinhado com `docs/finly-design-system.md` no repo);
- Componentização progressiva: `src/ui/App.jsx` é gradualmente fatiado em `layouts/`, `components/`, `pages/`. A Variação C pertence a `pages/Transactions/` (ou similar) e os subcomponentes (`SavedViewsCards`, `SortMenu`, `NewViewForm`, `DeleteViewControl`, `FacetBar`, `FacetPanelContent`, etc.) devem virar módulos próprios em `components/transactions/`.

## Fidelity

**Hi-fi.** Cores, tipografia, espaçamentos, raios, animações e estados estão definidos com precisão. Reproduzir pixel-perfect.

## Files included

| Arquivo | O que é |
| --- | --- |
| `preview.html` | Abra direto no navegador para ver a variação C funcionando (estática, sem Tweaks). |
| `_states_scaffold.html` | Renderiza os sub-componentes isolados (usado para gerar os prints de estados). |
| `variation-c.jsx` | Componente principal `VariationC` + sub-componentes (SearchBar, SortMenu, SavedViewsCards/Pills, NewViewForm, DeleteViewControl, SortTooltip, FacetBar, FacetPill/Card/Button, PopoverShell, FacetPanelContent-mux). |
| `variation-c-panels.jsx` | Painéis de facet individuais: PeriodPanel, TypePanel, CategoryPanel, TagPanel, CardPanel, ValuePanel, RecPanel. |
| `shared.jsx` | Tokens (`T`), helper de Geist (`G`), componente `Icon` (SVGs inline), dados mock (`window.TX`, `window.CATS`, `window.CAT_BY_ID`, `window.TAGS`, `window.CARDS`). |

> **Nota:** o protótipo usa `window.X` para compartilhar entre scripts Babel separados. **Na implementação no codebase**, troque por imports/exports normais.
>
> **Código de debug:** o topo de `VariationC` (e o bloco `Object.assign(window, {...})` no fim do arquivo) contém um pequeno helper de screenshot (`window.__SS` / hash `#ss=`) usado só para forçar estados iniciais nos prints. **Remover na implementação de produção.**

## Screenshots (`screenshots/`)

| Arquivo | Mostra |
| --- | --- |
| `01-default.png` | Tela completa no estado aprovado (`facetPanel: inline`): saved views em cards, barra de busca com "ORDENAR POR", barra de facets em cards, KPIs e lista. |
| `02-component-states.png` | Os 5 estados de popover/menu capturados isoladamente: **NewViewForm**, **SortMenu** (1 nível e multi-nível com reordenação/reset/campos inativos), **SortTooltip** (hover) e **DeleteConfirmPopover**. |

> Para ver **todos os estados interativos ao vivo** (incluindo o **painel de facet expandindo inline** abaixo da barra), abra `preview.html` e clique nos controles. `_states_scaffold.html` renderiza os sub-componentes isolados (usado para gerar `02-component-states.png`).
>
> Observação de captura: no `02-component-states.png` alguns nomes de campo do SortMenu aparecem truncados ("Da…", "Val…") — isso é artefato da largura isolada do print; no componente a largura do menu é 384px e os rótulos cabem ("Data", "Valor", "Tipo", "Descrição", "Categoria").

## Tweaks / configuração escolhida

A C foi feita tweakable para explorar 3 eixos. **A configuração final aprovada é:**

```js
{
  savedViews: "cards",  // saved views como cards horizontais com hint embaixo
  facetBar:   "cards",  // facets como cards com label uppercase + valor + chevron
  facetPanel: "inline", // painel de cada facet expande INLINE abaixo da barra de facets
}
```

Os outros modos (`pills`, `menu`, `buttons`, `popover`, `drawer`) existem no JSX e podem ser deletados na implementação se não fizerem parte do MVP.

---

## Layout geral

Container de filtros vertical, gap 12px, padding 0. Largura útil ≈ 1280px (preview), mas o layout é fluido (flex). Composição de cima pra baixo:

```
┌────────────────────────────────────────────────────────────────────┐
│ Visualizações salvas (cards horizontais)                           │
│ [📅 Despesas do mês]  [💳 Cartão Nubank]  …  [+ Nova]              │
├────────────────────────────────────────────────────────────────────┤
│ Search bar:                                                        │
│ 🔍 Buscar por descrição, valor, tag…       ORDENAR POR [Data ↓]   │
├────────────────────────────────────────────────────────────────────┤
│ Facet bar (cards):                                                 │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐             │
│ │ PERÍODO│ │ TIPO   │ │ CATEG. │ │ TAGS   │ │ CARTÃO │ + Mais ▾   │
│ │ Este mês│ │ Despesa│ │ 2 cat. │ │ #trab. │ │ Nubank │            │
│ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘             │
├────────────────────────────────────────────────────────────────────┤
│ Lista de transações (cards/rows)                                   │
└────────────────────────────────────────────────────────────────────┘
```

---

## Componentes (em ordem visual)

### 1. Saved Views — modo `cards`

Componente: `SavedViewsCards` em `variation-c.jsx`.

**Layout:**
- Label "VISUALIZAÇÕES SALVAS" uppercase 10px, fontWeight 700, color `T.inkMid`, letterSpacing 0.08em, com ícone `bookmark` 11px. Margin-bottom 8px.
- Linha horizontal de cards, `display: flex`, `gap: 8px`, `overflowX: visible`, `paddingBottom: 4px`.
- Cada card: `padding: 10px 14px 10px 12px`, `borderRadius: 11px`, `border: 1px solid T.border`, `background: T.surface`, `boxShadow: T.sm`. Quando ativo: `border: T.ink`, `background: T.ink`, `boxShadow: T.md`, texto branco.
- Conteúdo do card: badge quadrado 26×26 com radius 7 (cor `${v.color}15` = cor com 15% alpha) + ícone do tipo do view + bloco de texto (label 12.5px bold + hint 10.5px light).
- Card "+ Nova" no fim: `border: 1px dashed T.border` (vira `T.ink` no hover/open), `background: transparent`, ícone `plus` + texto "Nova".

**Estados:**
- Hover de card: revela `×` no canto superior direito (botão 18×18, top 4px right 4px, border `T.border`, fundo `T.surface`). Hover do `×`: fundo vermelho-claro `#FEF2F2`, cor `T.red`.
- Click no card ativo: deseleciona (não há sempre um ativo).
- Click no `×`: abre `DeleteConfirmPopover` (ver §3).
- Click em "+ Nova": abre `NewViewForm` (ver §2).

**Dados** (mock, no JSX):

```js
[
  { id: "v1", label: "Despesas do mês", icon: "calendar", color: T.ink,     hint: "42 transações" },
  { id: "v2", label: "Cartão Nubank",   icon: "card",     color: "#7C3AED", hint: "23 lançamentos" },
  { id: "v3", label: "Acima de R$ 200", icon: "trending", color: T.amber,   hint: "17 transações" },
  { id: "v4", label: "Recorrentes",     icon: "repeat",   color: T.blue,    hint: "8 ativas" },
  { id: "v5", label: "Reembolsáveis",   icon: "bookmark", color: T.green,   hint: "5 pendentes" },
]
```

Na implementação real, esses vêm de `GET /api/saved-views` (ou localStorage preferencialmente) e persistem por usuário. Cada saved view armazena o **snapshot dos filtros** aplicados (período, tipo, categoria, tags, cartão, valor, recorrência). O `hint` é uma contagem viva — calcular no backend ou no cliente.

### 2. New View Form (popover)

Componente: `NewViewForm` em `variation-c.jsx`. Width 340px. Aberto a partir do card "+ Nova". Renderizado dentro de `PopoverShell`.

**Campos:**

1. **Preview** do chip resultante (ícone + cor + nome ao vivo). Fundo `T.bg`, border tracejada `T.border`, radius 10. Mostra "Sem filtros" / "N filtros" embaixo do nome.
2. **Nome** (input). Autofocus. `Enter` salva, `Esc` cancela. Border `T.border` → `T.ink` no focus.
3. **Ícone** — grid 10 colunas, opções: `bookmark, calendar, card, trending, trending-down, repeat, tag, wallet, star, filter`. Ativo: border `color` selecionada + fundo `${color}15`.
4. **Cor** — 6 swatches circulares 24×24: `T.ink, T.blue, T.green, T.amber, T.red, T.purple`. Ativo: ring de 2px na cor + check branco no centro.
5. **Filtros aplicados** — chips somente leitura mostrando snapshot dos facets ativos no momento. Se nenhum: caixa tracejada cinza em itálico "Nenhum filtro ativo — será uma visualização vazia."
6. **Ações** — botões "Cancelar" (secundário) + "Salvar visualização" (primário, preto, com ícone `save`). Disabled quando nome vazio.

**Comportamento ao salvar:**
- `id = "v" + Date.now()`
- Adiciona à lista de saved views
- Ativa a view recém-criada (`setSavedActive(id)`)
- Fecha o popover

### 3. Delete View Control

Componente: `DeleteViewControl` em `variation-c.jsx`. Renderizado dentro de cada saved view (cards, pills, ou rows do menu).

**Visibilidade:** `opacity: 0; pointer-events: none` por padrão. Visível quando:
- Pai está em hover (`:hover .delete-view-*`),
- Botão tem class `.open` (popover aberto),
- Botão tem foco visível.

**Variantes:**
- `corner` (cards): 18×18, posição absoluta top:4 right:4, fundo `T.surface`, border 1px.
- `inline` (pills): 16×16, inline no fim do pill, sem border.
- `row` (menu): 22×22, hover-revealed à direita da row.

**Click:** abre `DeleteConfirmPopover` (240px wide):
- Header com mini-card mostrando ícone+cor+nome da view (entre aspas tipográficas "…")
- "Excluir esta visualização?"
- Botões: **Cancelar** (border `T.border`, fundo branco, texto `T.inkMid`) + **Excluir** (fundo `T.red`, texto branco, ícone `x` + label "Excluir", `autoFocus` — Enter confirma)

**Fecha em:** click fora, Esc, ou confirm/cancel.

**Se a view excluída era a ativa:** a seleção é limpa (`setSavedActive(null)`).

### 4. Search Bar

Componente: `SearchBar` em `variation-c.jsx`.

**Layout:** flex row, `gap: 10px`, `background: T.surface`, `border: 1px solid T.border`, `padding: 8px 12px`, `borderRadius: 10px`, `boxShadow: T.sm`.

Composição da esquerda pra direita:
- Ícone `search` 15px, cor `T.inkLight`
- `<input>` flex:1, sem border/bg, font-size 14px, color `T.ink`, placeholder "Buscar por descrição, valor, tag…" cor `#9CA3AF`
- Bloco de ordenação:
  - Label "ORDENAR POR" uppercase 10px, weight 700, color `T.inkLight`, letterSpacing 0.08em
  - Botão de sort (ver §5)

### 5. Sort button + Tooltip + Menu

**Botão** (visível na search bar):
- `padding: 5px 10px`, `borderRadius: 7`, border `T.border` (→ `T.ink` quando popover aberto), background `T.surface` (→ `T.bg` quando aberto).
- Conteúdo: ícone `arrow-up-down` 11px + label dinâmico + badge contador quando >1 critério.
- Label dinâmico:
  - 1 critério: `"Data ↓"`
  - 2 critérios: `"Data ↓ · Valor ↑"`
  - 3+ critérios: `"Data ↓ · +2"` (mostra primeiro + "+N")
- Badge contador (à direita do label): círculo preto 16px, número da quantidade de critérios.

**Tooltip** (hover do botão, **só quando popover fechado**):
- Componente: `SortTooltip`. Position absolute, top calc(100% + 6px), right 0.
- Fundo `T.ink`, texto branco, padding 8px 10px, radius 8px, shadow `T.lg`.
- Header em uppercase: "Ordenando por" ou "Ordenando por N critérios".
- Lista de regras: badge numerado + ícone do campo + nome + " · " + label da direção + seta ↑/↓.
- Triângulo decorativo (`transform: rotate(45deg)`) apontando para o botão.
- `pointer-events: none` (não captura mouse).

**Menu / Popover de edição** (click no botão):

Componente: `SortMenu`. Width 340px. Position absolute, top calc(100% + 6px), right 0. `zIndex: 80`.

Estrutura:

```
ORDENAR POR · [N níveis]                       [RESETAR]
─────────────────────────────────────────────────────────
[1] 📅 Data        [Mais recente primeiro ↓]      ↕ ×
[2] 📈 Valor       [Menor valor primeiro ↑]       ↕ ×

DISPONÍVEIS · CLIQUE PARA ADICIONAR

[+] 🔽 Tipo        Receitas primeiro ↓  (itálico, dim)
[+] ↕  Descrição   A → Z ↑               (itálico, dim)
[+] ◯  Categoria   A → Z ↑               (itálico, dim)
```

**Princípio chave:** todos os 5 campos sempre visíveis. Os ativos no topo (com número de prioridade), os inativos abaixo (com borda tracejada + ícone `+` + direção padrão em itálico/dim). Click em inativo o promove para ativo no fim da lista. **Nada escondido atrás de "+ Adicionar".**

**Regras de prioridade:** comparação em cascata — empate no critério 1 → vai pro 2 → etc.

**Campos disponíveis** (`SORT_FIELDS` em `variation-c.jsx`):

| Campo | Comparação | Direção `asc` | Direção `desc` |
| --- | --- | --- | --- |
| `date` | parse de `"dd/mm"` | "Mais antiga primeiro" | "Mais recente primeiro" *(padrão)* |
| `val`  | `x.val - y.val` (numérico) | "Menor valor primeiro" | "Maior valor primeiro" *(padrão)* |
| `tipo` | `Math.sign(x.val) - Math.sign(y.val)` | "Despesas primeiro" | "Receitas primeiro" *(padrão)* |
| `desc` | `localeCompare("pt-BR")` | "A → Z" *(padrão)* | "Z → A" |
| `cat`  | `localeCompare()` | "A → Z" *(padrão)* | "Z → A" |

**Defaults:** `DEFAULT_DIR = { date: "desc", val: "desc", tipo: "desc", desc: "asc", cat: "asc" }`. Estado inicial: `[{ field: "date", dir: "desc" }]`.

**Ações no menu:**
- Toggle de direção: botão com label da direção atual + seta. Click inverte.
- Reorder ↑/↓: setinhas verticais à direita (só visíveis quando há >1 regra). Desabilitadas nas pontas.
- Remover `×`: hover vira vermelho, click remove.
- Click em inativo: adiciona ao fim da lista com direção padrão.
- "Resetar" (canto superior direito do popover): só aparece quando o estado não é o default. Restaura `[{ field: "date", dir: "desc" }]`.

### 6. Facet Bar — modo `cards`

Componente: `FacetBar` (mode="cards") + `FacetCard` em `variation-c.jsx`.

Cards horizontais, gap 8px, `padding: 6px`. Cada card 130-150px:
- Header: label uppercase 9.5px weight 700 color `T.inkLight` + chevron-down 10px
- Body: ícone 13px (cor varia por facet ativa) + valor formatado 13px weight 700
- Badge "+N" quando multi-seleção (`cats.length > 1` etc.)
- Estado ativo (filtro não vazio): border `T.ink`, sombra `T.md`

Click no card **expande inline um painel abaixo da barra de facets** (`FacetPanelContent` no modo `inline`). Esc / click fora / click no mesmo card colapsa. Só um painel aberto por vez. Largura total da barra; padding 18-22px.

> Modo `popover` (popover anchored ao card) também existe no JSX, mas a config aprovada é `inline`.

**Facets disponíveis (com ícone e cor):**

| Key | Label | Icon | Cor ativa | Painel |
| --- | --- | --- | --- | --- |
| `periodo` | Período | `calendar` | — | `PeriodPanel` |
| `tipo` | Tipo | `trending`/`trending-down`/`filter` | `T.green`/`T.red`/— | `TypePanel` |
| `categoria` | Categoria | `circle` | — | `CategoryPanel` |
| `tag` | Tags | `tag` | — | `TagPanel` |
| `cartao` | Cartão | `card` | — | `CardPanel` |
| `valor` | Valor | `wallet` | — | `ValuePanel` |
| `recorrencia` | Recorrência | `repeat` | — | `RecPanel` |

Ver `variation-c-panels.jsx` para detalhes de cada painel.

### 7. Lista de transações

Renderizada abaixo da facet bar com o resultado de `sortItems(filtered)`. O JSX do protótipo é simples (não foi escopo desta conversa); o backend real deve devolver itens compatíveis com o shape `{ id, date: "dd/mm", desc, val, cat, tag, cardId, recurring }`.

---

## State

Tudo gerenciado no componente `VariationC` (root), via `React.useState`. Em produção, mover para um store/contexto compartilhado com a página de Transações.

| State | Tipo | Default | Propósito |
| --- | --- | --- | --- |
| `expanded` | `string \| null` | `null` | Facet com painel aberto |
| `savedActive` | `string \| null` | `"v1"` | ID da saved view ativa |
| `savedMenuOpen` | `boolean` | `false` | (modo `menu` — não usado em `cards`) |
| `newViewOpen` | `"cards" \| "pills" \| "menu" \| null` | `null` | Qual New View popover está aberto |
| `sortOpen` | `boolean` | `false` | Popover de ordenação aberto |
| `sort` | `Array<{field, dir}>` | `[{ field: "date", dir: "desc" }]` | Regras de ordenação encadeadas |
| `search` | `string` | `""` | Texto da busca (ainda não filtra a lista no protótipo) |
| `cats` | `string[]` | `["alim", "trans"]` | IDs de categorias selecionadas |
| `tags` | `string[]` | `["trabalho"]` | Tags selecionadas |
| `cardSel` | `string[]` | `["nub-1177"]` | IDs de cartões |
| `period` | `string` | `"mes"` | Período (mes/hoje/semana/3m/ano) |
| `type` | `string` | `"despesa"` | Tipo (todos/receita/despesa) |
| `rec` | `string` | `"any"` | Recorrência (any/sim/nao) |
| `savedViews` | `Array<{id,label,icon,color,hint}>` | (5 seeds) | Coleção de saved views |

---

## Design tokens

Tudo definido em `shared.jsx` no objeto `T`. Espelha `docs/finly-design-system.md` no repo. Principais:

### Cores

| Token | Valor | Uso |
| --- | --- | --- |
| `T.bg` | `#F8F7F5` | Background base da app |
| `T.surface` | `#FFFFFF` | Cards, inputs, popovers |
| `T.surfaceHov` | (do shared.jsx) | Hover de superfícies |
| `T.ink` | `#0F0F0D` | Texto principal, estado ativo |
| `T.inkMid` | (do shared.jsx) | Texto secundário |
| `T.inkLight` | (do shared.jsx) | Labels uppercase, hints, ícones secundários |
| `T.inkGhost` | (do shared.jsx) | Texto desabilitado, placeholders fortes |
| `T.border` | (do shared.jsx) | Bordas neutras 1px |
| `T.blue`, `T.green`, `T.amber`, `T.red`, `T.purple` | (do shared.jsx) | Cores de saved views, status de facets |
| `T.redLight` | `#FEF2F2` (fallback) | Hover de delete |

> Confirmar todos os valores hex em `shared.jsx` e cruzar com `docs/finly-design-system.md` no repo. Onde houver divergência, o `docs/` é a fonte canônica.

### Tipografia

- **Geist** (sans-serif) — UI principal, weights 400/500/600/700/800. Variável helper `G = { fontFamily: "'Geist', ..." }`.
- **Geist Mono** — números financeiros, kbd.
- **Instrument Serif** — títulos editoriais (usado em `preview.html`).

Tamanhos correntes na variação:
- Labels uppercase: 10px / weight 700 / letterSpacing 0.08em
- Body de cards: 12.5px / weight 700 (ativo) ou 600
- Hint: 10.5px / weight normal / color `T.inkLight`
- Input principal: 14px
- Direção/dir labels: 10.5–11.5px

### Espaçamento, raios, sombras

- Spacing: múltiplos de 2 (gap 4, 6, 8, 10, 12, 14).
- Border radius: 6 (chips pequenos), 7 (chips), 8 (cards menores), 10 (cards grandes/popovers), 11 (saved view cards), 99 (pills).
- Shadows: `T.sm`, `T.md`, `T.lg` (ver `shared.jsx`).

### Animações

```css
@keyframes fadeIn      { from { opacity: 0 } to { opacity: 1 } }
@keyframes fadeInDown  { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: translateY(0) } }
@keyframes drawerIn    { from { opacity: 0; transform: translateX(20px) } to { opacity: 1; transform: translateX(0) } }
```

Durações 0.12s–0.24s, easing padrão `ease` exceto drawer (`cubic-bezier(0.32, 0.72, 0, 1)`).

---

## Interactions checklist

- [ ] Click num saved view ativa-o. Click no ativo desativa.
- [ ] Hover num saved view revela `×`. Click abre popover de confirmação. Esc / fora / Cancelar fecha. Excluir remove e limpa `savedActive` se for o ativo.
- [ ] Click em "+ Nova" abre form. Enter salva (se nome preenchido). Esc cancela. Salvar fecha popover + ativa nova view.
- [ ] Click no botão de ordenação abre menu. Click fora fecha.
- [ ] Hover no botão de ordenação (com menu fechado) mostra tooltip preto. Sai do botão / abre menu → tooltip some.
- [ ] No menu de sort: click no toggle de direção inverte. Setinhas reordenam prioridade (desabilitadas nas pontas). `×` remove. Click em inativo promove pra ativo no fim. "Resetar" volta pro default.
- [ ] Lista de transações reflete `sortItems(filtered)` em tempo real após qualquer mudança nos critérios.
- [ ] Click num facet card abre popover do facet correspondente. Click fora / esc fecha.

## Acessibilidade

- Todos os controles interativos têm `aria-label` ou rótulo visível.
- Saved view "card" usa `role="button" tabIndex={0}` com handler de `Enter`/`Space`.
- Botão "Excluir" no popover de confirmação tem `autoFocus` — Enter confirma. Esc cancela e fecha.
- Foco visível: `.delete-view-btn:focus-visible` força opacidade 1.
- Tooltip de sort tem `role="tooltip"` e `pointer-events: none`.

## Para o backend / API (sugerido)

Não definido nesta conversa, mas pra encaixe limpo:

```
GET    /api/saved-views                      → SavedView[]
POST   /api/saved-views                      ← { name, icon, color, filters }
DELETE /api/saved-views/:id

GET    /api/transactions?view=<id>&sort=<encoded>&filters=<encoded>
```

`sort` pode ser serializado como `date:desc,val:asc` (lista ordenada de `field:dir`).

## Out of scope deste handoff

- Comportamento real da busca (`search` ainda não filtra a lista no protótipo).
- Estilo da lista de transações em si (só é renderizada de forma genérica no protótipo — usar o componente de lista que já existe no repo).
- Drag-and-drop para reordenar saved views ou prioridades de sort (atualmente via setinhas).
- Persistência local de preferências (`localStorage` / API).
- Variações A e B (ficaram fora do bundle conforme decisão do usuário).
