# Seed operacional: categorias e tags para nova organização

Documento para o **backend** implementar criação automática (seed) de categorias e tags associadas **para cada organização nova**, espelhando o conjunto já usado no protótipo da área **Configurações → Categorias e Tags** (`src/ui/pages/ConfiguracoesPage.jsx` → `CAT_LIST`).

> **Contrato e notas de produto atualizados** pelo backend estão em [**FRONTEND_API_GUIDE.md**](../../fincla-api/docs/FRONTEND_API_GUIDE.md) no repositório **fincla-api** (`docs/FRONTEND_API_GUIDE.md`) (seção *Endpoints de Tags*): nomes canônicos semeados em **inglês**, tipo **`detalhe`** com `parent_category_tag_id`, `icon_key` Lucide, regras de i18n e `tag_ids` obrigatório em transações. Este arquivo permanece como referência de **rótulos PT do protótipo** e mapa `icon_key`; em caso de divergência, prevalece o guia da API.

---

## 1. Objetivo

- Toda **nova conta/organização** nasce com o mesmo **núcleo de categorias** (11 itens), cores e **tags filhas** sugeridas, para o usuário não começar com lista vazia.
- O usuário pode **criar, editar e remover** categorias e tags depois (produto já prevê isso na UI).
- O seed deve ser **idempotente**: reexecutar não deve duplicar nomes por organização (ver §4).

---

## 2. Quando executar

| Momento sugerido | Observação |
|------------------|------------|
| Imediatamente após `POST` criar organização (mesma transação ou job logo em seguida) | Garante que `listTags` já retorna dados no primeiro login. |
| Alternativa | Endpoint interno / comando `seed_org_tags(org_id)` chamado uma vez na criação. |

**Não** rodar seed em todo `GET`; apenas na criação da org (ou migração pontual explícita).

---

## 3. Dados canônicos do seed

### 3.1 Categorias (tipo de tag `categoria`)

Ordem de exibição: usar `sort_order` crescente (0, 1, 2, …) na ordem abaixo.

| sort_order | name | color (hex) | `icon_key` (Lucide, kebab-case) | is_default | is_active | is_onboarding_highlight |
|------------|------|-------------|----------------------------------|------------|-----------|-------------------------|
| 0 | Alimentação | `#059669` | `shopping-cart` | true | true | true |
| 1 | Transporte | `#2563EB` | `car` | true | true | true |
| 2 | Saúde | `#DC2626` | `pill` | true | true | true |
| 3 | Educação | `#7C3AED` | `book-open` | true | true | true |
| 4 | Lazer & Entretenimento | `#D97706` | `party-popper` | true | true | true |
| 5 | Compras Pessoais | `#DC2626` | `shopping-bag` | true | true | false |
| 6 | Serviços | `#6B7280` | `wrench` | true | true | false |
| 7 | Assinaturas & Software | `#0891B2` | `smartphone` | true | true | true |
| 8 | Impostos & Taxas | `#D97706` | `receipt` | true | true | false |
| 9 | Moradia | `#6B7280` | `home` | true | true | true |
| 10 | Receita | `#059669` | `wallet` | true | true | true |

- `tag_type_id`: o UUID do tipo cuja resposta de `GET /v1/tag-types` tem `name: "categoria"` (ou equivalente canônico acordado).
- Campos alinhados ao guia: ver `Tag` em [**FRONTEND_API_GUIDE.md**](../../fincla-api/docs/FRONTEND_API_GUIDE.md) (lista de tags).

### 3.2 Tags filhas (rótulos sob cada categoria)

No protótipo, são strings em minúsculas (ex.: `mercado`, `delivery`). O backend precisa de um **modelo** que as represente. Opções:

**A — Recomendada:** segundo tipo de tag, ex. `etiqueta` ou `marcador`, com vínculo à categoria:

- Cada linha de “tag” do seed tem: `name`, `organization_id`, `tag_type_id` (tipo etiqueta), **`parent_category_tag_id`** (FK para a tag categoria pai), `sort_order`, `is_active`, `color` opcional (null herdando cor da categoria na UI).

**B — MVP mínimo:** apenas as **11 categorias** no seed; tags filhas ficam para criação manual ou segunda fase.

**C — Metadados JSON** em `tags.metadata`: `{"parent_category_name":"Alimentação"}` — útil só se não houver FK; pior para integridade.

Tabela **canônica de filhos** (normalizar `name` como no protótipo: minúsculas, sem acento agudo nas chaves se o backend preferir ASCII):

| Categoria (pai) | Tags filhas (nomes) |
|-----------------|---------------------|
| Alimentação | `mercado`, `restaurante`, `delivery` |
| Transporte | `combustível`, `uber`, `ônibus` |
| Saúde | `farmácia`, `médico`, `plano` |
| Educação | `curso`, `livro` |
| Lazer & Entretenimento | `cinema`, `viagem`, `bar` |
| Compras Pessoais | `roupa`, `eletrônico` |
| Serviços | *(nenhuma)* |
| Assinaturas & Software | `netflix`, `app` |
| Impostos & Taxas | `imposto`, `taxa` |
| Moradia | `aluguel`, `energia`, `água` |
| Receita | `salário`, `freelance` |

**Transações:** o guia atual usa `tag_ids[]` com pelo menos uma tag do tipo categoria. As etiquetas são opcionais conforme regras de `max_per_transaction` do tipo — o backend deve definir se uma transação pode ter categoria + N etiquetas.

---

## 4. Idempotência e conflitos

- Antes de inserir, verificar se a organização **já possui** tags do tipo `categoria` (count > 0): se sim, **não** rodar seed automático (ou usar flag `seed_version` na org).
- Ou: seed com `ON CONFLICT (organization_id, tag_type_id, normalized_name) DO NOTHING` se houver constraint única.
- Nomes de categoria devem ser **únicos por organização** entre tags do mesmo tipo.

---

## 5. Ícones na API — `icon_key` (Lucide, kebab-case)

O backend **não renderiza** ícone: persiste e devolve uma **string estável** acordada com o frontend. O SPA usa a biblioteca **[Lucide](https://lucide.dev)** (`lucide-react`), já presente no projeto.

### 5.1 Convenção

| Regra | Detalhe |
|-------|---------|
| Nome do campo sugerido | `icon_key` (alternativa: reutilizar `icon` com semântica exclusiva de chave, nunca emoji). |
| Formato | **kebab-case**, igual ao slug em [lucide.dev/icons](https://lucide.dev/icons) (ex.: `shopping-cart`, `book-open`). |
| Seed | Usar exatamente os valores da coluna **`icon_key`** da tabela em **§3.1** (fonte única). |
| Tags filhas | `icon_key` **null** ou omitido; a UI pode mostrar só texto / `#tag`. |

### 5.2 Mapa canônico — `icon_key` ↔ componente `lucide-react`

O frontend deve manter um objeto **estático** `Record<string, LucideIcon>` (ou switch) mapeando **apenas** as chaves abaixo (+ fallback `Tag` ou `CircleDot` se vier chave desconhecida). Os nomes PascalCase são os **exports** oficiais do pacote `lucide-react` (equivalentes aos ícones em kebab no site).

| `icon_key` (API / seed) | Componente `lucide-react` |
|-------------------------|---------------------------|
| `shopping-cart` | `ShoppingCart` |
| `car` | `Car` |
| `pill` | `Pill` |
| `book-open` | `BookOpen` |
| `party-popper` | `PartyPopper` |
| `shopping-bag` | `ShoppingBag` |
| `wrench` | `Wrench` |
| `smartphone` | `Smartphone` |
| `receipt` | `Receipt` |
| `home` | `Home` |
| `wallet` | `Wallet` |

**Preview visual:** `https://lucide.dev/icons/<icon_key>` — exemplo: `https://lucide.dev/icons/shopping-cart`.

### 5.3 Alternativas (não recomendadas como padrão do seed)

| Abordagem | Nota |
|-----------|------|
| Emoji em string | Possível **fallback** legado na UI se `icon_key` ausente (ex.: mapa por `name` em `budgetsAdapter.js`); não duplicar no seed se `icon_key` já existir. |
| `icon_url` | Só se no futuro houver ícones fora do Lucide. |

### 5.4 Alteração no contrato da API

Após o backend implementar:

- Incluir `icon_key?: string | null` em `Tag` no OpenAPI / [**FRONTEND_API_GUIDE.md**](../../fincla-api/docs/FRONTEND_API_GUIDE.md) (**fincla-api**).
- `CreateTagRequest` / `UpdateTagRequest`: permitir `icon_key` opcional.
- Atualizar `src/api/types.ts` e adapters no frontend para ler `icon_key` e resolver o componente via §5.2.

---

## 6. Checklist de implementação (backend)

- [ ] Obter `tag_type_id` de `categoria` (e de etiqueta/marcador, se houver filhos).
- [ ] Inserir 11 tags categoria com `color`, `sort_order`, flags acima.
- [ ] (Opcional fase 2) Inserir tags filhas com vínculo ao pai.
- [ ] Tornar operação idempotente por organização.
- [ ] Preencher e expor `icon_key` em cada tag categoria do seed (valores §3.1).
- [ ] Atualizar documentação da API consumida pelo SPA.

---

## 7. Referência no repositório frontend

- Lista visual/mock: `src/ui/pages/ConfiguracoesPage.jsx` (`CAT_LIST`).
- Fallback por **nome** (emoji / limite sugerido) quando a API ainda não manda `icon_key`: `src/ui/data/budgetsAdapter.js` (`CATEGORY_META`). Com `icon_key` populado, o frontend deve preferir o mapa §5.2.

---

*Última atualização: documento gerado para alinhar seed de backend ao conjunto de categorias/tags do protótipo Fincla v2.*
