# Prompt para Backend: API de Planejamento Futuro de Cartões

## Contexto

O frontend possui uma área de "Planejamento Futuro" (`/credit-cards/planning`) que permite aos usuários visualizar seus compromissos futuros com cartões de crédito e simular novas compras.

**Problema atual:** O frontend precisa fazer múltiplas chamadas API (6 chamadas por cartão × N cartões) para montar a visão de compromissos futuros, resultando em:
- Lentidão no carregamento (2-5 segundos)
- Impossibilidade de saber quando parcelas terminam
- Código complexo de agregação no frontend
- Experiência ruim para o usuário

**Solução:** Implementar endpoints otimizados que retornem dados agregados e calculados.

---

## Novos Endpoints Necessários

### Endpoint 1: GET `/v1/credit-cards/{card_id}/future-commitments`

Retorna uma visão consolidada dos compromissos futuros de um cartão específico.

#### Query Parameters

| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `organization_id` | UUID | Sim | - | ID da organização |
| `months` | integer | Não | 6 | Número de meses futuros (1-12) |

#### Response (200 OK)

```json
{
  "card_id": 1,
  "card_name": "Nubank Roxinho",
  "card_last4": "4580",
  "credit_limit": 5000.00,
  "current_available_limit": 3200.00,
  
  "summary": {
    "total_committed": 2100.00,
    "average_monthly": 350.00,
    "lowest_month": {
      "year": 2026,
      "month": 6,
      "month_name": "junho",
      "amount": 200.00
    },
    "highest_month": {
      "year": 2026,
      "month": 2,
      "month_name": "fevereiro",
      "amount": 450.00
    }
  },
  
  "monthly_breakdown": [
    {
      "year": 2026,
      "month": 2,
      "month_name": "fevereiro",
      "total_amount": 450.00,
      "limit_usage_percent": 9.0,
      "installments_count": 3,
      "top_installments": [
        {
          "description": "Notebook Dell",
          "amount": 350.00,
          "installment_number": 2,
          "total_installments": 10,
          "category_name": "Eletrônicos",
          "category_color": "#3B82F6"
        },
        {
          "description": "iPhone 15",
          "amount": 100.00,
          "installment_number": 5,
          "total_installments": 12,
          "category_name": "Eletrônicos",
          "category_color": "#3B82F6"
        }
      ]
    }
  ],
  
  "ending_soon": [
    {
      "description": "Notebook Dell",
      "purchase_date": "2025-05-10",
      "total_value": 3500.00,
      "monthly_amount": 350.00,
      "total_installments": 10,
      "remaining_installments": 3,
      "last_installment_date": "2026-04-10",
      "last_installment_month": "abril 2026",
      "category_name": "Eletrônicos"
    },
    {
      "description": "iPhone 15",
      "purchase_date": "2024-12-15",
      "total_value": 1200.00,
      "monthly_amount": 100.00,
      "total_installments": 12,
      "remaining_installments": 5,
      "last_installment_date": "2026-07-15",
      "last_installment_month": "julho 2026",
      "category_name": "Eletrônicos"
    }
  ],
  
  "insights": [
    {
      "type": "ending_commitment",
      "icon": "trending_down",
      "message": "Em abril seu compromisso cairá R$ 350,00 com o fim da parcela do Notebook Dell"
    },
    {
      "type": "best_month",
      "icon": "lightbulb",
      "message": "Melhor mês para nova compra: junho (menor compromisso: R$ 200,00)"
    },
    {
      "type": "limit_warning",
      "icon": "warning",
      "message": "Em fevereiro você usará 45% do limite com compromissos"
    }
  ]
}
```

#### Campos Calculados

| Campo | Cálculo |
|-------|---------|
| `summary.total_committed` | Soma de `total_amount` de todos os meses |
| `summary.average_monthly` | `total_committed / months` |
| `summary.lowest_month` | Mês com menor `total_amount` |
| `summary.highest_month` | Mês com maior `total_amount` |
| `limit_usage_percent` | `(total_amount / credit_limit) * 100` |
| `remaining_installments` | `total_installments - installment_number + 1` (parcelas restantes a partir do mês atual) |
| `last_installment_date` | `purchase_date + (total_installments meses)` |

#### Regras para `ending_soon`

1. Listar compras parceladas que terminam nos próximos 6 meses
2. Ordenar por `last_installment_date` (mais próximas primeiro)
3. Limitar a 5 itens
4. Incluir apenas parcelas com `remaining_installments <= 6`

#### Regras para `insights`

Gerar insights automáticos baseados em:

| Tipo | Condição | Mensagem |
|------|----------|----------|
| `ending_commitment` | Parcela termina nos próximos 3 meses | "Em {mês} seu compromisso cairá R$ {valor} com o fim da parcela de {descrição}" |
| `best_month` | Sempre gerar | "Melhor mês para nova compra: {mês} (menor compromisso: R$ {valor})" |
| `limit_warning` | `limit_usage_percent > 50%` em algum mês | "Em {mês} você usará {percent}% do limite com compromissos" |
| `decreasing_trend` | Compromissos diminuem ao longo dos meses | "Seus compromissos diminuirão R$ {diff} até {último_mês}" |
| `no_commitments` | Algum mês sem compromissos | "Em {mês} você não terá compromissos de parcelas" |

#### Erros

| Status | Descrição |
|--------|-----------|
| 403 | Usuário não tem acesso à organização |
| 404 | Cartão não encontrado |

---

### Endpoint 2: GET `/v1/credit-cards/consolidated-commitments`

Retorna uma visão consolidada de TODOS os cartões da organização.

#### Query Parameters

| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `organization_id` | UUID | Sim | - | ID da organização |
| `months` | integer | Não | 6 | Número de meses futuros (1-12) |

#### Response (200 OK)

```json
{
  "organization_id": "uuid-here",
  "total_cards": 3,
  "total_credit_limit": 15000.00,
  "total_available_limit": 8500.00,
  
  "summary": {
    "total_committed_all_cards": 6500.00,
    "average_monthly_all_cards": 1083.33,
    "lowest_month": {
      "year": 2026,
      "month": 7,
      "month_name": "julho",
      "amount": 650.00
    },
    "highest_month": {
      "year": 2026,
      "month": 2,
      "month_name": "fevereiro",
      "amount": 1450.00
    }
  },
  
  "by_card": [
    {
      "card_id": 1,
      "card_name": "Nubank Roxinho",
      "card_last4": "4580",
      "credit_limit": 5000.00,
      "total_committed": 2100.00,
      "percentage_of_total": 32.3
    },
    {
      "card_id": 2,
      "card_name": "Inter Black",
      "card_last4": "7890",
      "credit_limit": 8000.00,
      "total_committed": 3200.00,
      "percentage_of_total": 49.2
    },
    {
      "card_id": 3,
      "card_name": "C6 Carbon",
      "card_last4": "1234",
      "credit_limit": 2000.00,
      "total_committed": 1200.00,
      "percentage_of_total": 18.5
    }
  ],
  
  "monthly_total": [
    {
      "year": 2026,
      "month": 2,
      "month_name": "fevereiro",
      "total_amount": 1450.00,
      "by_card": [
        { "card_id": 1, "card_name": "Nubank", "amount": 450.00 },
        { "card_id": 2, "card_name": "Inter", "amount": 700.00 },
        { "card_id": 3, "card_name": "C6", "amount": 300.00 }
      ]
    },
    {
      "year": 2026,
      "month": 3,
      "month_name": "março",
      "total_amount": 1250.00,
      "by_card": [
        { "card_id": 1, "card_name": "Nubank", "amount": 350.00 },
        { "card_id": 2, "card_name": "Inter", "amount": 600.00 },
        { "card_id": 3, "card_name": "C6", "amount": 300.00 }
      ]
    }
  ],
  
  "ending_soon_all_cards": [
    {
      "card_id": 1,
      "card_name": "Nubank",
      "description": "Notebook Dell",
      "monthly_amount": 350.00,
      "remaining_installments": 3,
      "last_installment_month": "abril 2026"
    },
    {
      "card_id": 2,
      "card_name": "Inter",
      "description": "Geladeira Brastemp",
      "monthly_amount": 250.00,
      "remaining_installments": 2,
      "last_installment_month": "março 2026"
    }
  ],
  
  "global_insights": [
    {
      "type": "card_distribution",
      "message": "49% dos seus compromissos estão no cartão Inter Black"
    },
    {
      "type": "total_reduction",
      "message": "A partir de maio seus compromissos totais cairão R$ 600,00/mês"
    },
    {
      "type": "best_card_for_purchase",
      "message": "Cartão com mais folga: C6 Carbon (40% do limite livre)"
    }
  ]
}
```

#### Campos Calculados

| Campo | Cálculo |
|-------|---------|
| `total_credit_limit` | Soma de `credit_limit` de todos os cartões |
| `total_available_limit` | Soma de `available_limit` de todos os cartões |
| `percentage_of_total` | `(card_total / total_committed_all_cards) * 100` |

#### Erros

| Status | Descrição |
|--------|-----------|
| 403 | Usuário não tem acesso à organização |

---

## Alterações em Endpoints Existentes

### GET `/v1/credit-cards/{card_id}/invoices/{year}/{month}`

Adicionar campo opcional no item da fatura:

```json
{
  "items": [
    {
      "id": 123,
      "description": "Notebook Dell",
      "amount": 350.00,
      "installment_number": 2,
      "total_installments": 10,
      "tags": {...},
      
      // NOVO CAMPO
      "purchase_info": {
        "purchase_date": "2025-05-10",
        "total_value": 3500.00,
        "last_installment_date": "2026-02-10",
        "remaining_after_this": 8
      }
    }
  ]
}
```

> **Nota:** Este campo é opcional e pode ser omitido para manter retrocompatibilidade. Incluir apenas se `total_installments > 1`.

---

## Tipos TypeScript para Frontend

```typescript
// Resposta do endpoint /future-commitments
interface FutureCommitmentsResponse {
  card_id: number;
  card_name: string;
  card_last4: string;
  credit_limit: number;
  current_available_limit: number;
  
  summary: {
    total_committed: number;
    average_monthly: number;
    lowest_month: MonthSummary;
    highest_month: MonthSummary;
  };
  
  monthly_breakdown: MonthlyCommitment[];
  ending_soon: EndingInstallment[];
  insights: Insight[];
}

interface MonthSummary {
  year: number;
  month: number;
  month_name: string;
  amount: number;
}

interface MonthlyCommitment {
  year: number;
  month: number;
  month_name: string;
  total_amount: number;
  limit_usage_percent: number;
  installments_count: number;
  top_installments: InstallmentItem[];
}

interface InstallmentItem {
  description: string;
  amount: number;
  installment_number: number;
  total_installments: number;
  category_name: string | null;
  category_color: string | null;
}

interface EndingInstallment {
  description: string;
  purchase_date: string;
  total_value: number;
  monthly_amount: number;
  total_installments: number;
  remaining_installments: number;
  last_installment_date: string;
  last_installment_month: string;
  category_name: string | null;
}

interface Insight {
  type: 'ending_commitment' | 'best_month' | 'limit_warning' | 'decreasing_trend' | 'no_commitments';
  icon: string;
  message: string;
}

// Resposta do endpoint /consolidated-commitments
interface ConsolidatedCommitmentsResponse {
  organization_id: string;
  total_cards: number;
  total_credit_limit: number;
  total_available_limit: number;
  
  summary: {
    total_committed_all_cards: number;
    average_monthly_all_cards: number;
    lowest_month: MonthSummary;
    highest_month: MonthSummary;
  };
  
  by_card: CardCommitmentSummary[];
  monthly_total: MonthlyTotalAllCards[];
  ending_soon_all_cards: EndingInstallmentAllCards[];
  global_insights: Insight[];
}

interface CardCommitmentSummary {
  card_id: number;
  card_name: string;
  card_last4: string;
  credit_limit: number;
  total_committed: number;
  percentage_of_total: number;
}

interface MonthlyTotalAllCards {
  year: number;
  month: number;
  month_name: string;
  total_amount: number;
  by_card: { card_id: number; card_name: string; amount: number }[];
}

interface EndingInstallmentAllCards {
  card_id: number;
  card_name: string;
  description: string;
  monthly_amount: number;
  remaining_installments: number;
  last_installment_month: string;
}
```

---

## Exemplos de Uso no Frontend

### Carregar compromissos de um cartão

```typescript
const getFutureCommitments = async (
  cardId: number,
  organizationId: string,
  months: number = 6
): Promise<FutureCommitmentsResponse> => {
  const response = await apiClient.get<FutureCommitmentsResponse>(
    `/v1/credit-cards/${cardId}/future-commitments`,
    {
      params: { organization_id: organizationId, months }
    }
  );
  return response.data;
};
```

### Carregar visão consolidada

```typescript
const getConsolidatedCommitments = async (
  organizationId: string,
  months: number = 6
): Promise<ConsolidatedCommitmentsResponse> => {
  const response = await apiClient.get<ConsolidatedCommitmentsResponse>(
    `/v1/credit-cards/consolidated-commitments`,
    {
      params: { organization_id: organizationId, months }
    }
  );
  return response.data;
};
```

---

## Prioridade de Implementação

### Alta Prioridade (Bloqueia frontend)

1. **GET `/v1/credit-cards/{card_id}/future-commitments`**
   - Sem este endpoint, o frontend continua fazendo 6+ chamadas
   - Campo `ending_soon` é impossível calcular no frontend

### Média Prioridade

2. **GET `/v1/credit-cards/consolidated-commitments`**
   - Melhora UX para usuários com múltiplos cartões
   - Pode ser implementado após o endpoint 1

### Baixa Prioridade

3. **Campo `purchase_info` no endpoint de invoices**
   - Nice to have para detalhamento
   - Frontend pode funcionar sem isso

---

## Impacto no Frontend

### Antes (Atual)

```
Carregamento: 6 chamadas API × N cartões = 6-18 chamadas
Tempo: 2-5 segundos
Código: ~150 linhas de lógica de agregação
Features impossíveis: "Parcelas que terminam"
```

### Depois (Com novos endpoints)

```
Carregamento: 1-2 chamadas API
Tempo: 200-500ms
Código: ~30 linhas (apenas renderização)
Features novas: Tudo disponível
```

---

## Checklist de Implementação

- [ ] Endpoint `GET /v1/credit-cards/{card_id}/future-commitments`
  - [ ] Query de parcelas futuras por cartão
  - [ ] Cálculo de `summary`
  - [ ] Cálculo de `monthly_breakdown`
  - [ ] Identificação de `ending_soon`
  - [ ] Geração de `insights`
  
- [ ] Endpoint `GET /v1/credit-cards/consolidated-commitments`
  - [ ] Agregação de todos os cartões
  - [ ] Cálculo de `by_card`
  - [ ] Cálculo de `monthly_total`
  - [ ] `ending_soon_all_cards`
  - [ ] `global_insights`

- [ ] Atualizar `FRONTEND_API_GUIDE.md` com novos endpoints

- [ ] Testes
  - [ ] Cartão sem parcelas futuras
  - [ ] Cartão com muitas parcelas
  - [ ] Organização com múltiplos cartões
  - [ ] Organização sem cartões

---

**Última atualização:** Janeiro 2026

