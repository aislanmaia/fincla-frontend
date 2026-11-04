# Deep link de Lançamentos (`/transactions`)

**Público:** backend / assistente do WhatsApp (quem monta o link) e quem mexe no contrato de query do SPA.

O assistente envia ao usuário um link para a tela de Lançamentos já filtrada. A allowlist da query vive em
`src/ui/routing/searchContract.js` (chaves `FC`) e `src/ui/routing/finclaRootSearchSchema.js` (validação Zod).

## Formato

```
https://app.fincla.com/transactions?fc_from=YYYY-MM-DD&fc_to=YYYY-MM-DD&fc_type=expense|income&fc_status=paid|to_pay&fc_category=<id ou nome>
```

Todos os parâmetros são opcionais e independentes (exceto o par de datas).

| Parâmetro | Valores | Efeito |
|---|---|---|
| `fc_from`, `fc_to` | `YYYY-MM-DD`, data real de calendário | Período personalizado (inclusivo). **Os dois são obrigatórios juntos** e `fc_from <= fc_to`. |
| `fc_type` | `expense` \| `income` | Filtro Tipo = Despesa / Receita. |
| `fc_status` | `paid` \| `to_pay` | Filtro Situação = Paga / A pagar (`settled=true/false` na API). |
| `fc_category` | **id** da categoria **ou** o nome (`labelPt`) | Ver abaixo. Semântica anterior, inalterada. |

### `fc_category`

Semântica existente (não mudou): o valor é casado primeiro contra o **id** da categoria no catálogo da organização
(`categoryTagsData.categories[].id`) e, se não houver, contra o **nome em português** (`labelPt`, comparação exata,
sensível a maiúsculas/acentos — ex.: `Alimentação`, URL-encoded `Alimenta%C3%A7%C3%A3o`). Sem correspondência no
catálogo, o valor cru é usado como id. Aceita qualquer um dos dois; **o backend pode emitir o id (preferível, estável)
ou o nome**. É de uso único: depois de aplicado, o parâmetro é removido da URL (comportamento pré-existente).

## Validação (nunca quebra, nunca mostra dado errado)

- Data inexistente (`2026-02-31`), formato diferente (`2026-10-1`), só uma das pontas, ou `fc_from > fc_to`: **o período inteiro é ignorado** (a tela abre no período padrão do usuário). Nunca se aplica meio período.
- `fc_type` / `fc_status` fora dos valores acima (inclusive outra caixa, `EXPENSE`, ou listas `a,b`): ignorado; os demais parâmetros válidos seguem valendo.
- Chaves desconhecidas são descartadas pelo Zod.

## Comportamento na tela

- Os filtros entram no **estado inicial** da página: a primeira requisição já sai filtrada.
- O período aparece no chip "Período" (rótulo com as datas do intervalo, não "Este mês"), e Tipo/Situação como chips ativos.
- O período do link é **transiente**: não é gravado como período padrão do usuário (mesma regra do `fc_date` do Calendário).
- Os parâmetros ficam na URL enquanto o usuário está na tela (como `fc_date`); a página não reescreve a URL ao mudar filtros. Navegar para outra tela pelo menu os descarta (`mergeNavSearch`).

## Retorno pós-login

Usuário deslogado que abre o link: o SPA guarda `pathname + query` (sessionStorage, `postLoginRedirect.js`), manda para a tela de login e, após autenticar, volta para **a mesma URL com todos os parâmetros** (e não para `/dashboard`).

- Só caminhos internos conhecidos (`/transactions`, `/transactions/:id`, `/profile/:tab`, segmentos autenticados) — nunca URL absoluta, `//host`, `\`, `..`; query com `<`, `>` ou `"` ou acima de 1024 caracteres não é guardada (cai no fallback `/dashboard`).
- Tokens de e-mail (`invite_token`, `reset_token`, `action`+`token`; ver `FRONTEND_AUTH_INVITE_LINKS.md`) ficam fora do prefixo `fc_` e não são afetados: esses fluxos são tratados na raiz `/`, que nunca é um destino de retorno.
- Mantenha o link curto (< 1 KB de query).
