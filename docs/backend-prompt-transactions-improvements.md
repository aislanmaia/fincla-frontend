# Melhorias no Endpoint de Transações

## Objetivo

Implementar melhorias no endpoint de listagem de transações para suportar paginação adequada e criar um endpoint dedicado para estatísticas agregadas, melhorando a performance e eficiência do frontend.

## 1. Adicionar Metadata de Paginação ao GET `/v1/transactions`

### Mudança na Estrutura de Resposta

**Antes:**
- Retornava array direto: `Transaction[]`

**Depois:**
- Retornar objeto com dados e metadata de paginação:

```typescript
{
  "data": Transaction[],  // ou "transactions" para manter compatibilidade
  "pagination": {
    "page": number,           // Página atual (1-indexed)
    "limit": number,           // Itens por página
    "total": number,           // Total de registros que atendem aos filtros
    "pages": number,           // Total de páginas
    "has_next": boolean,       // Se existe próxima página
    "has_prev": boolean        // Se existe página anterior
  }
}
```

### Parâmetros de Query

Adicionar suporte aos seguintes parâmetros de query (todos opcionais):
- `page`: Número da página (padrão: 1, mínimo: 1)
- `limit`: Itens por página (padrão: 20, máximo: 100, mínimo: 1)

### Comportamento

1. Se `page` e `limit` não forem fornecidos, usar valores padrão (page=1, limit=20)
2. Calcular `total` baseado nos filtros aplicados (date_start, date_end, type, category, payment_method, description, organization_id)
3. Calcular `pages` como `ceil(total / limit)`
4. `has_next` = `page < pages`
5. `has_prev` = `page > 1`
6. Aplicar paginação SQL (OFFSET/LIMIT) após aplicar todos os filtros
7. Manter todos os filtros existentes funcionando: `organization_id`, `type`, `category`, `payment_method`, `description`, `date_start`, `date_end`, `value_min`, `value_max`

### Compatibilidade

- Manter compatibilidade com código existente que espera array direto (opcional, via header ou query param `format=legacy`)
- Ou fazer breaking change documentado, já que é uma melhoria importante

## 2. Criar Endpoint GET `/v1/transactions/summary`

### Objetivo

Retornar estatísticas agregadas (KPIs) para os filtros fornecidos, sem retornar as transações individuais. Isso permite que o frontend carregue os cards de estatísticas rapidamente sem precisar buscar todas as transações.

### Parâmetros de Query

Aceitar os mesmos filtros do endpoint de listagem:
- `organization_id` (obrigatório)
- `date_start` (opcional, formato: YYYY-MM-DD)
- `date_end` (opcional, formato: YYYY-MM-DD)
- `type` (opcional: 'income' | 'expense')
- `category` (opcional)
- `payment_method` (opcional)
- `description` (opcional, busca parcial)
- `value_min` (opcional, número)
- `value_max` (opcional, número)

### Estrutura de Resposta

```typescript
{
  "total_transactions": number,      // COUNT(*) de transações que atendem aos filtros
  "total_value": number,              // SUM(ABS(value)) - soma absoluta de todos os valores
  "total_income": number,             // SUM(value) WHERE type = 'income'
  "total_expenses": number,           // SUM(value) WHERE type = 'expense' (valor positivo)
  "balance": number,                  // total_income - total_expenses
  "average_transaction": number,      // AVG(ABS(value)) - média do valor absoluto
  "period": {
    "start_date": string | null,      // date_start fornecido ou null
    "end_date": string | null         // date_end fornecido ou null
  },
  "filters_applied": {
    "organization_id": string,
    "type": string | null,
    "category": string | null,
    "payment_method": string | null,
    "date_start": string | null,
    "date_end": string | null
  }
}
```

### Comportamento

1. Aplicar os mesmos filtros do endpoint de listagem
2. Usar queries SQL agregadas (COUNT, SUM, AVG) para calcular as estatísticas
3. Retornar valores numéricos (não strings formatadas)
4. Se não houver transações que atendem aos filtros, retornar zeros:
   - `total_transactions: 0`
   - `total_value: 0`
   - `total_income: 0`
   - `total_expenses: 0`
   - `balance: 0`
   - `average_transaction: 0`

### Performance

- Usar queries agregadas no banco de dados (não buscar todas as transações e calcular no código)
- Considerar índices nas colunas usadas para filtros (date, type, organization_id, category, payment_method)
- Otimizar para retornar rapidamente mesmo com milhões de transações

## 3. Documentação

Atualizar a documentação da API (`FRONTEND_API_GUIDE.md` ou similar) para incluir:

1. Nova estrutura de resposta do GET `/v1/transactions` com paginação
2. Novos parâmetros `page` e `limit`
3. Novo endpoint GET `/v1/transactions/summary`
4. Exemplos de uso de ambos os endpoints
5. Explicação dos campos de paginação
6. Explicação dos campos de summary

## 4. Testes

Garantir que:
- Paginação funciona corretamente com todos os filtros
- Summary retorna valores corretos para diferentes combinações de filtros
- Performance é adequada mesmo com grandes volumes de dados
- Validação de parâmetros (page >= 1, limit entre 1 e 100)
- Tratamento de casos edge (sem transações, filtros que não retornam nada)

## Notas de Implementação

- A paginação deve ser aplicada APÓS todos os filtros serem aplicados
- O cálculo de `total` deve considerar os mesmos filtros aplicados na query principal
- Para summary, usar uma única query com múltiplas agregações quando possível (mais eficiente)
- Considerar cache para summary se os dados não mudarem frequentemente
- Manter consistência entre os filtros aceitos em ambos os endpoints

