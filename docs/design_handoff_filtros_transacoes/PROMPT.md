# Prompt inicial para o Claude Code

---

```
Leia `design/handoff-filtros-transacoes/README.md` e todos os arquivos .jsx dessa pasta
(variation-c.jsx, variation-c-panels.jsx, shared.jsx). É a referência de design da tela
de Filtros de Transações — a "Variação C · Faceted Pills", já aprovada.

Contexto do projeto: respeite o `CLAUDE.md` e o `docs/finly-design-system.md`. Estilos
inline com o objeto de tokens `T` (sem Tailwind). React + JSX. A UI é fatiada
progressivamente de `src/ui/App.jsx` para `layouts/`, `components/`, `pages/`.

IMPORTANTE — os arquivos são REFERÊNCIA, não código de produção:
- NÃO copie literalmente. Os `window.X` (compartilhamento entre scripts Babel) devem
  virar imports/exports normais.
- REMOVA o bloco de debug no topo de `VariationC` e o `Object.assign(window, {...})` no
  fim de variation-c.jsx (helper de screenshot `window.__SS` / hash `#ss=`).
- Os dados mock (TX, CATS, CARDS, TAGS, SAVED_VIEWS em shared.jsx) devem ser substituídos
  pelas fontes reais de dados do app.

Config aprovada da Variação C (fixar estes modos; os outros modos no JSX podem ser
removidos se não forem usados):
  savedViews: "cards"   — visualizações salvas como cards horizontais
  facetBar:   "cards"   — facets como cards (label + valor + chevron)
  facetPanel: "inline"  — painel de cada facet expande INLINE abaixo da barra (NÃO popover)

Plano de trabalho:
1. Primeiro, proponha ONDE cada componente deve morar em src/ui/ (pasta + nomes de
   arquivo) e confirme comigo antes de escrever código.
2. Implemente incrementalmente, um componente por vez, nesta ordem sugerida:
   SavedViewsCards → NewViewForm → DeleteViewControl → SearchBar → SortMenu (multi-nível)
   → SortTooltip → FacetBar/FacetCard → FacetPanelContent (inline) → integração na página.
3. Pare para revisão após cada componente.

Critérios de aceitação: use a seção "Interactions checklist" do README. Mantenha
fidelidade pixel-a-pixel (cores, tipografia, espaçamentos, raios, animações) — abra
`design/handoff-filtros-transacoes/preview.html` no navegador como fonte visual de verdade.

Fora de escopo (não implemente sem me perguntar): busca textual real, o componente da
lista de transações em si (use o que já existe no repo), persistência local/API,
drag-and-drop, e as Variações A e B.
```

---

## Depois de colar

- Deixe o **`preview.html` aberto no navegador** enquanto o Claude Code trabalha — é a referência interativa. As imagens em `screenshots/` complementam.
- Trabalhe **incremental**: aprove um componente antes de seguir pro próximo.
- Se ele divergir do design system, lembre-o de reler `docs/finly-design-system.md`.
- Quando integrar saved views / sort / filtros ao backend, defina os endpoints (o README tem uma sugestão de API na seção "Para o backend").
