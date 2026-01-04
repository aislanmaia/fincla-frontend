# Prompt: Implementar Campos Adicionais na API de Cartões de Crédito

## Contexto

O frontend de gestão de cartões de crédito precisa de campos adicionais na API para implementar uma experiência de usuário mais completa. Atualmente a API retorna dados básicos, mas faltam informações para:

- Mostrar uso do limite em tempo real
- Exibir comparativos com meses anteriores
- Calcular dias até o vencimento
- Identificar a bandeira do cartão
- Agrupar transações por categoria
- Marcar faturas como pagas (controle manual)

> **IMPORTANTE:** Este sistema é **informacional** - serve para controle pessoal de finanças. 
> Não há integração com bancos ou operadoras de cartão. O usuário paga suas faturas 
> diretamente no app do banco e depois marca como "paga" no sistema para controle.

---

## Endpoint 1: GET /v1/credit-cards

### Resposta Atual

```json
{
  "id": 1,
  "name": "Nubank",
  "last_four_digits": "4444",
  "credit_limit": 5000.00,
  "closing_day": 3,
  "due_day": 10,
  "organization_id": 1,
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-15T10:00:00Z"
}
```

### Campos a Adicionar

| Campo | Tipo | Descrição | Obrigatório | Persistido |
|-------|------|-----------|-------------|------------|
| `brand` | `string` | Bandeira do cartão | Não | Sim (BD) |
| `color` | `string` | Cor hex para exibição visual | Não | Sim (BD) |
| `available_limit` | `float` | Limite disponível calculado | Sim | Não (calculado) |
| `used_limit` | `float` | Quanto do limite está comprometido | Sim | Não (calculado) |
| `limit_usage_percent` | `float` | Percentual do limite usado (0-100) | Sim | Não (calculado) |

### Valores Aceitos para `brand`

- `visa`
- `mastercard`
- `elo`
- `amex`
- `hipercard`
- `other`

### Resposta Esperada

```json
{
  "id": 1,
  "name": "Nubank",
  "last_four_digits": "4444",
  "credit_limit": 5000.00,
  "closing_day": 3,
  "due_day": 10,
  "brand": "mastercard",
  "color": "#8B5CF6",
  "available_limit": 3200.00,
  "used_limit": 1800.00,
  "limit_usage_percent": 36.0,
  "organization_id": 1,
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-15T10:00:00Z"
}
```

### Regras de Cálculo

#### `used_limit`

Soma de:
1. Total da fatura atual (se `status` for `open` ou `closed` e não paga)
2. Total de parcelas futuras comprometidas (parcelas 2+ de compras parceladas que cairão em faturas futuras)

#### `available_limit`

```
available_limit = credit_limit - used_limit
```

Se o resultado for negativo, retornar `0` ou o valor negativo para indicar "acima do limite" (decisão do backend).

#### `limit_usage_percent`

```
limit_usage_percent = (used_limit / credit_limit) * 100
```

Arredondar para 1 casa decimal.

---

## Endpoint 2: GET /v1/credit-cards/{card_id}/invoices/{year}/{month}

### Resposta Atual

```json
{
  "id": 1,
  "credit_card_id": 1,
  "month": "janeiro 2025",
  "total_amount": 2450.00,
  "due_date": "2025-01-10",
  "status": "open",
  "items": [...]
}
```

### Campos a Adicionar

| Campo | Tipo | Descrição | Persistido |
|-------|------|-----------|------------|
| `closing_date` | `date` | Data de fechamento da fatura | Não (calculado) |
| `days_until_due` | `int` | Dias até o vencimento | Não (calculado) |
| `is_overdue` | `bool` | Se a fatura está vencida | Não (calculado) |
| `paid_date` | `date \| null` | Data em que foi marcada como paga | Sim (BD) |
| `previous_month_total` | `float \| null` | Total da fatura do mês anterior | Não (calculado) |
| `month_over_month_change` | `float \| null` | Variação % vs mês anterior | Não (calculado) |
| `category_breakdown` | `array` | Resumo de gastos por categoria | Não (calculado) |
| `items_count` | `int` | Quantidade total de transações | Não (calculado) |
| `limit_usage_percent` | `float` | % do limite usado por esta fatura | Não (calculado) |

### Estrutura de `category_breakdown`

```json
{
  "category_id": 1,
  "category_name": "Alimentação",
  "category_color": "#22C55E",
  "total": 1102.50,
  "percentage": 45.0,
  "transaction_count": 15
}
```

Para itens sem categoria:
- `category_id`: `null`
- `category_name`: `"Sem Categoria"`
- `category_color`: `"#6B7280"`

### Resposta Esperada

```json
{
  "id": 1,
  "credit_card_id": 1,
  "month": "janeiro 2025",
  "total_amount": 2450.00,
  "due_date": "2025-01-10",
  "closing_date": "2025-01-03",
  "status": "open",
  "paid_date": null,
  "days_until_due": 7,
  "is_overdue": false,
  "previous_month_total": 2180.00,
  "month_over_month_change": 12.4,
  "limit_usage_percent": 49.0,
  "items_count": 32,
  "category_breakdown": [
    {
      "category_id": 1,
      "category_name": "Alimentação",
      "category_color": "#22C55E",
      "total": 1102.50,
      "percentage": 45.0,
      "transaction_count": 15
    },
    {
      "category_id": 2,
      "category_name": "Transporte",
      "category_color": "#3B82F6",
      "total": 539.00,
      "percentage": 22.0,
      "transaction_count": 8
    },
    {
      "category_id": null,
      "category_name": "Sem Categoria",
      "category_color": "#6B7280",
      "total": 368.40,
      "percentage": 15.0,
      "transaction_count": 4
    }
  ],
  "items": [...]
}
```

### Regras de Cálculo

#### `closing_date`

Data de fechamento baseada no `closing_day` do cartão para o mês/ano da fatura. Se `closing_day` for maior que o último dia do mês, usar o último dia do mês.

#### `days_until_due`

```
days_until_due = due_date - data_atual
```

Valor negativo indica dias de atraso.

#### `is_overdue`

```
is_overdue = (days_until_due < 0) AND (status != "paid")
```

#### `previous_month_total`

Total da fatura do mês anterior do mesmo cartão. Retornar `null` se não existir.

#### `month_over_month_change`

```
month_over_month_change = ((total_amount - previous_month_total) / previous_month_total) * 100
```

**Pode ser negativo!**
- Valor **positivo**: usuário gastou MAIS que no mês anterior
- Valor **negativo**: usuário gastou MENOS que no mês anterior
- Valor **zero**: gasto igual ao mês anterior

Retornar `null` se `previous_month_total` for `null` ou `0`.

#### `category_breakdown`

Agrupar `items` pela tag `categoria`, somar valores e calcular percentuais. Ordenar por `total` decrescente.

#### `limit_usage_percent`

```
limit_usage_percent = (total_amount / credit_limit) * 100
```

---

## Endpoint 3: GET /v1/credit-cards/{card_id}/invoices/history (NOVO)

Endpoint para retornar histórico de faturas para gráficos de evolução.

### Request

```
GET /v1/credit-cards/{card_id}/invoices/history?months=12
```

| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| `months` | `int` | 6 | Quantidade de meses (1-24) |

### Response

```json
{
  "card_id": 1,
  "card_name": "Nubank",
  "period": {
    "start": "2024-02-01",
    "end": "2025-01-31"
  },
  "summary": {
    "total_spent": 28540.00,
    "average_monthly": 2378.33,
    "highest_month": {
      "month": "dezembro 2024",
      "amount": 4520.00
    },
    "lowest_month": {
      "month": "fevereiro 2024",
      "amount": 1250.00
    }
  },
  "monthly_data": [
    {
      "year": 2024,
      "month": 2,
      "month_name": "fevereiro 2024",
      "total_amount": 1250.00,
      "status": "paid",
      "items_count": 18,
      "top_category": "Alimentação"
    },
    {
      "year": 2024,
      "month": 3,
      "month_name": "março 2024",
      "total_amount": 1890.00,
      "status": "paid",
      "items_count": 24,
      "top_category": "Transporte"
    }
  ]
}
```

### Campos de `monthly_data`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `year` | `int` | Ano da fatura |
| `month` | `int` | Mês (1-12) |
| `month_name` | `string` | Nome formatado (ex: "janeiro 2025") |
| `total_amount` | `float` | Total da fatura |
| `status` | `string` | Status da fatura |
| `items_count` | `int` | Quantidade de transações |
| `top_category` | `string \| null` | Categoria com maior valor |

### Campos de `summary`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `total_spent` | `float` | Soma de todas as faturas do período |
| `average_monthly` | `float` | Média mensal |
| `highest_month` | `object` | Mês com maior gasto |
| `lowest_month` | `object \| null` | Mês com menor gasto |

---

## Endpoint 4: PATCH /v1/credit-cards/{card_id}/invoices/{year}/{month}/mark-paid (NOVO)

Endpoint para marcar uma fatura como paga (controle manual do usuário).

> **Nota:** Este endpoint NÃO realiza pagamento real. Apenas atualiza o status da fatura 
> para que o usuário possa acompanhar quais faturas já foram pagas no app do banco.

### Request

```
PATCH /v1/credit-cards/{card_id}/invoices/{year}/{month}/mark-paid
```

### Request Body

```json
{
  "paid_date": "2025-01-08"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `paid_date` | `date` | Não | Data do pagamento. Se não informado, usar data atual. |

### Response (200 OK)

```json
{
  "id": 1,
  "credit_card_id": 1,
  "month": "janeiro 2025",
  "total_amount": 2450.00,
  "due_date": "2025-01-10",
  "status": "paid",
  "paid_date": "2025-01-08",
  "days_until_due": 2,
  "is_overdue": false
}
```

### Comportamento

1. Atualizar `status` para `"paid"`
2. Registrar `paid_date` (informado ou data atual)
3. Retornar a fatura atualizada com campos calculados

### Erros

| Status | Descrição |
|--------|-----------|
| 404 | Fatura não encontrada |
| 400 | Fatura já está paga |
| 400 | `paid_date` no futuro |

---

## Endpoint 5: PATCH /v1/credit-cards/{card_id}/invoices/{year}/{month}/unmark-paid (NOVO)

Endpoint para desfazer a marcação de pagamento (caso o usuário tenha marcado por engano).

### Request

```
PATCH /v1/credit-cards/{card_id}/invoices/{year}/{month}/unmark-paid
```

### Request Body

Vazio ou `{}`

### Response (200 OK)

```json
{
  "id": 1,
  "credit_card_id": 1,
  "month": "janeiro 2025",
  "total_amount": 2450.00,
  "due_date": "2025-01-10",
  "status": "open",
  "paid_date": null,
  "days_until_due": 2,
  "is_overdue": false
}
```

### Comportamento

1. Verificar se fatura está com `status = "paid"`
2. Atualizar `status` para `"open"` ou `"closed"` (baseado na `closing_date`)
3. Limpar `paid_date` (definir como `null`)
4. Retornar a fatura atualizada

### Regra para determinar novo status

```
Se data_atual < closing_date:
    status = "open"
Senão:
    status = "closed"
```

### Erros

| Status | Descrição |
|--------|-----------|
| 404 | Fatura não encontrada |
| 400 | Fatura não está marcada como paga |

---

## Endpoint 6: POST/PUT /v1/credit-cards (Atualizar)

Adicionar campos `brand` e `color` ao criar/atualizar cartão.

### Request Body Atualizado

```json
{
  "name": "Nubank",
  "last_four_digits": "4444",
  "credit_limit": 5000.00,
  "closing_day": 3,
  "due_day": 10,
  "brand": "mastercard",
  "color": "#8B5CF6"
}
```

### Validações

| Campo | Validação |
|-------|-----------|
| `brand` | Enum: `visa`, `mastercard`, `elo`, `amex`, `hipercard`, `other` |
| `color` | Regex: `^#[0-9A-Fa-f]{6}$` (hex color) |

Ambos os campos são opcionais.

---

## Alterações no Banco de Dados

### Tabela `credit_cards`

Adicionar colunas:

| Coluna | Tipo | Nullable | Default |
|--------|------|----------|---------|
| `brand` | `VARCHAR(20)` | Sim | `NULL` |
| `color` | `VARCHAR(7)` | Sim | `NULL` |

### Tabela `invoices`

Adicionar coluna:

| Coluna | Tipo | Nullable | Default |
|--------|------|----------|---------|
| `paid_date` | `DATE` | Sim | `NULL` |

---

## Prioridade de Implementação

### Alta Prioridade (Bloqueia frontend)

1. `available_limit`, `used_limit`, `limit_usage_percent` no CreditCard
2. `days_until_due`, `is_overdue` no Invoice
3. `category_breakdown` no Invoice
4. Endpoints `/mark-paid` e `/unmark-paid` (controle de pagamento)
5. Campo `paid_date` no Invoice

### Média Prioridade (Melhora UX)

6. `brand` e `color` no CreditCard
7. `previous_month_total`, `month_over_month_change` no Invoice
8. Endpoint `/invoices/history`

### Baixa Prioridade (Nice to have)

9. `closing_date` no Invoice

---

## Checklist de Implementação

**Banco de Dados:**
- [ ] Criar migration para `brand` e `color` em `credit_cards`
- [ ] Criar migration para `paid_date` em `invoices`

**Endpoint GET /credit-cards:**
- [ ] Adicionar `brand` e `color` na resposta
- [ ] Calcular e incluir `available_limit`
- [ ] Calcular e incluir `used_limit`
- [ ] Calcular e incluir `limit_usage_percent`

**Endpoint GET /credit-cards/{id}:**
- [ ] Mesmas alterações do endpoint de listagem

**Endpoint POST/PUT /credit-cards:**
- [ ] Aceitar `brand` e `color` no body
- [ ] Validar enum para `brand`
- [ ] Validar formato hex para `color`

**Endpoint GET /invoices/{year}/{month}:**
- [ ] Calcular e incluir `closing_date`
- [ ] Calcular e incluir `days_until_due`
- [ ] Calcular e incluir `is_overdue`
- [ ] Incluir `paid_date` na resposta
- [ ] Buscar e incluir `previous_month_total`
- [ ] Calcular e incluir `month_over_month_change`
- [ ] Calcular e incluir `limit_usage_percent`
- [ ] Calcular e incluir `items_count`
- [ ] Calcular e incluir `category_breakdown`

**Novo Endpoint PATCH /invoices/{year}/{month}/mark-paid:**
- [ ] Criar endpoint para marcar fatura como paga
- [ ] Aceitar `paid_date` opcional no body
- [ ] Atualizar `status` para `"paid"` e salvar `paid_date`
- [ ] Validar que `paid_date` não é no futuro
- [ ] Retornar erro se fatura já está paga

**Novo Endpoint PATCH /invoices/{year}/{month}/unmark-paid:**
- [ ] Criar endpoint para desfazer marcação de pagamento
- [ ] Atualizar `status` para `"open"` ou `"closed"` conforme regra
- [ ] Limpar `paid_date` (definir como `null`)
- [ ] Retornar erro se fatura não está paga

**Novo Endpoint GET /invoices/history:**
- [ ] Criar endpoint com parâmetro `months`
- [ ] Retornar `monthly_data` com histórico
- [ ] Calcular e retornar `summary`

**Testes:**
- [ ] Testes para cálculo de `available_limit`
- [ ] Testes para `category_breakdown`
- [ ] Testes para `days_until_due` e `is_overdue`
- [ ] Testes para endpoint `/invoices/history`
- [ ] Testes para `/mark-paid` e `/unmark-paid`

**Documentação:**
- [ ] Atualizar OpenAPI/Swagger com novos campos e endpoints
