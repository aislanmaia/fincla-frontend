# Impacto financeiro no modal Nova transação — requisitos de API

## Objetivo

Documentar o que o **frontend** exibe hoje no bloco **Impacto financeiro** dentro do modal **Nova transação** (`NovaTransacaoModal` em `src/ui/App.jsx`), e o que o **backend** precisa expor para que valores, percentuais e séries temporais reflitam a realidade da organização (sem dados mockados).

Após implementação, o guia canônico [**FRONTEND_API_GUIDE.md**](../../fincla-api/docs/FRONTEND_API_GUIDE.md) (**fincla-api:** `docs/FRONTEND_API_GUIDE.md`) deve ser atualizado com paths, query/body e exemplos de resposta.

---

## Contexto na UI

O usuário preenche valor, categoria (tag de categoria), forma de pagamento, data, etc. Na etapa de **revisão** (e em painel colapsável no desktop), o modal mostra:

1. **Gráfico de linha** — intenção: “ritmo” de gastos com série **real** e **projetada** (no protótipo: eixo por **dia** do mês).
2. **Três cartões de métrica** — rótulos no protótipo:
   - **Após lançamento** — gasto agregado considerando o valor que o usuário está prestes a registrar.
   - **% do orçamento** — relação com limite(s) de orçamento (escopo a definir: global vs por categoria).
   - **Projeção fim do mês** — estimativa ao fim do período, coerente com as mesmas regras do servidor.
3. **Margem restante** — saldo de folga em relação ao “limite” usado na narrativa (orçamento total ou categoria, conforme produto).
4. **Linha por categoria** — gasto atual na categoria selecionada, **projeção após o lançamento**, limite do orçamento daquela tag e barra de progresso.

Hoje esses números e o gráfico diário são **placeholders** (valores fixos e `rhythmData` de `mockFinance`). O cliente REST já possui **`GET /v1/budgets`**, **`GET /v1/analytics/spending-rhythm`** (agregação **mensal**) e **`POST /v1/financial-impact/simulate`** (foco em compromissos de cartão/metas), mas **não** há contrato único que cubra o preview “esta despesa nesta data nesta categoria” nem ritmo **diário**.

---

## Decisão de desenho: dois endpoints

| Responsabilidade | Motivo |
|------------------|--------|
| **Série diária (gráfico)** | `GET` cacheável, reutilizável fora do modal; resposta pequena (`GROUP BY` dia). |
| **Preview do impacto do rascunho** | Depende de corpo dinâmico (valor, tag, data, tipo, parcelas/cartão); evita o front recriar regras de orçamento e totais. |

O preview foi alinhado ao domínio de **orçamento**, sugerindo exposição sob **`/v1/budgets/...`** (ver abaixo). A série diária permanece em **`/v1/analytics/...`** como os demais relatórios.

---

## 1) Ritmo de gastos diário (gráfico)

### Sugestão de path (novo, sem quebrar o existente)

**`GET /v1/analytics/spending-by-day`**

Não estender apenas `spending-rhythm` com flag, para não misturar semântica mensal vs diária na mesma resposta sem versionar; um path dedicado deixa o OpenAPI e o cache mais claros.

### Query (mínimo)

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `organization_id` | UUID | Sim | Organização |
| `date_start` | string (YYYY-MM-DD) | Sim | Início do intervalo (inclusivo) |
| `date_end` | string (YYYY-MM-DD) | Sim | Fim do intervalo (inclusivo) |
| `tag_id` | UUID | Não | Se informado, filtrar despesas da categoria |
| `transaction_type` | string | Não | Padrão: apenas despesas relevantes ao gráfico (ex.: `expense`) |

### Regras sugeridas

- Agregar **soma de valores** por **dia civil** no fuso da organização ou UTC documentado (o mesmo critério usado em `GET /v1/transactions`).
- Definir se entram transações `pending` vs só `completed` — **igual** à listagem usada em relatórios.
- Parcelas/cartão: mesma regra de “data de competência” que o produto já usa nas transações.

### Resposta sugerida (200)

```typescript
interface SpendingByDayPoint {
  date: string;           // YYYY-MM-DD
  total_expenses: number; // >= 0
  // opcional: projeção simples calculada no servidor para linha tracejada
  projected_cumulative?: number | null;
}

interface SpendingByDayResponse {
  points: SpendingByDayPoint[];
  currency: string;       // ex.: "BRL"
  period: { start: string; end: string };
}
```

O frontend pode montar o gráfico “real” com `points[].total_expenses` (ou acumulado, se o backend preferir devolver cumulativo). A série **projetada** pode ser calculada no servidor (recomendado para uma única definição) ou omitida na v1 e o front desenha só a série real.

### Performance

Implementação típica: uma agregação indexada por `(organization_id, date)` — custo **O(dias no intervalo)** na resposta, não O(n transações) no payload.

---

## 2) Preview de impacto (KPIs + barra de categoria)

### Sugestão de path

**`POST /v1/budgets/preview-transaction`**

Colocar em **budgets** porque o núcleo da mensagem é **orçamento por tag** + totais coerentes com o que o usuário vê em **`GET /v1/budgets`**. Alternativa aceitável: `POST /v1/transactions/preview-impact` — desde que a documentação deixe claro o vínculo com `tag_id` e limites.

### Body (exemplo)

```typescript
interface PreviewTransactionRequest {
  organization_id: string;
  type: 'expense' | 'income';
  value: number;              // valor do lançamento (positivo)
  tag_id: string | null;      // categoria (UUID); null se a UI permitir sem categoria
  date: string;               // YYYY-MM-DD — data do lançamento
  payment_method?: string | null;
  // opcional, se já refletir regras de parcela/cartão no backend
  installments_count?: number | null;
  card_id?: number | null;
}
```

### Resposta sugerida (200)

Objeto único que alimente **os três cartões** e a **linha da categoria** sem o front somar manualmente de forma divergente do servidor:

```typescript
interface CategoryBudgetPreview {
  tag_id: string | null;
  tag_name: string | null;
  budget_amount: number | null;        // null se não houver orçamento para a tag
  spent_before: number;
  spent_after: number;                 // inclui o valor hipotético se expense
  usage_percent_before: number | null;
  usage_percent_after: number | null;
  remaining_before: number | null;
  remaining_after: number | null;
}

interface PreviewTransactionResponse {
  category: CategoryBudgetPreview;
  /** Totais agregados de todos os orçamentos ativos do período de referência */
  budgets_summary: {
    total_budgeted: number;
    total_spent_before: number;
    total_spent_after: number;
    total_remaining_after: number;
    percent_of_total_budget_after: number | null; // se fizer sentido com “% do orçamento” da UI
  };
  /** Opcional: projeção fim de mês com regra única documentada */
  month_projection?: {
    projected_total_expenses_end_of_month: number;
    projected_percent_of_budget: number | null;
    label_context: string; // ex.: "monthly_budget" | "category_budget"
  } | null;
}
```

### Comportamento

- Período de referência do orçamento: o mesmo usado em **`GET /v1/budgets`** com `date_ref` (ex.: mês corrente).
- **Receitas** (`income`): definir se alteram apenas saldo global ou também metas; a UI de “Impacto” no modal hoje é pensada para **despesa** — pode retornar `category` vazio ou zeros com mensagem clara.
- Erros: `400` body inválido; `403` sem membership; `404` org.

### Chamadas na UI

- Debounce no front ao mudar valor/categoria/data (ex.: 300–400 ms) para não martelar o servidor.
- Opcional: `GET` com query string se o time quiser evitar POST — menos adequado para muitos campos e extensões futuras.

---

## Checklist para o backend

- [ ] Novo **`GET /v1/analytics/spending-by-day`** (ou nome final alinhado ao guia).
- [ ] Novo **`POST /v1/budgets/preview-transaction`** (ou path acordado).
- [ ] Documentar fuso, status de transação e regras de parcela.
- [ ] Atualizar [**FRONTEND_API_GUIDE.md**](../../fincla-api/docs/FRONTEND_API_GUIDE.md) (**fincla-api**) e, se existir, OpenAPI/Swagger no repositório da API.
- [ ] Índices e testes de carga leves no intervalo “mês atual” (31 pontos).

---

## Referências no repositório frontend

- Componente: `NovaTransacaoModal` — blocos “Impacto financeiro”, `MobileImpact`, `ReviewBody` (`src/ui/App.jsx`).
- Cliente analytics atual: `src/api/analytics.ts` (`monthly-evolution`, `by-category`, `spending-rhythm`, `period-comparison`, `export-csv`).
- Orçamentos: `src/api/budgets.ts`, tipos `Budget` / `BudgetListResponse` em `src/api/types.ts`.
