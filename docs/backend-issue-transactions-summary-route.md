# Problema: Rota `/v1/transactions/summary` não está funcionando

## Erro em Produção

**Status Code:** `422 Unprocessable Content`

**Erro retornado:**
```json
{
    "detail": [
        {
            "type": "int_parsing",
            "loc": [
                "path",
                "transaction_id"
            ],
            "msg": "Input should be a valid integer, unable to parse string as an integer",
            "input": "summary"
        }
    ]
}
```

**URL da requisição:**
```
GET /v1/transactions/summary?organization_id=43390fa6-2a2e-4e4e-86ca-d71bd810518f
```

## Causa do Problema

O backend está interpretando `"summary"` como um `transaction_id` na rota `/v1/transactions/{transaction_id}`, em vez de reconhecer a rota específica `/v1/transactions/summary`.

Isso acontece porque **a ordem das rotas está incorreta**: a rota com parâmetro dinâmico `/v1/transactions/{transaction_id}` está sendo capturada **antes** da rota específica `/v1/transactions/summary`.

## Solução

### ⚠️ CRÍTICO: Ordem das Rotas

**A rota específica DEVE ser definida ANTES da rota com parâmetro dinâmico.**

**❌ Ordem Incorreta (causa o problema):**
```python
# Rota com parâmetro dinâmico primeiro
@router.get("/transactions/{transaction_id}")
async def get_transaction(transaction_id: int, ...):
    ...

# Rota específica depois (nunca será alcançada)
@router.get("/transactions/summary")
async def get_transactions_summary(...):
    ...
```

**✅ Ordem Correta (resolve o problema):**
```python
# Rota específica PRIMEIRO
@router.get("/transactions/summary")
async def get_transactions_summary(...):
    ...

# Rota com parâmetro dinâmico DEPOIS
@router.get("/transactions/{transaction_id}")
async def get_transaction(transaction_id: int, ...):
    ...
```

### Por que isso acontece?

Frameworks de roteamento (FastAPI, Flask, Express, etc.) processam rotas na ordem em que são definidas. Quando uma requisição chega:

1. O framework tenta fazer match com a primeira rota
2. Se a rota `/transactions/{transaction_id}` estiver primeiro, ela tenta fazer match com `/transactions/summary`
3. O framework interpreta `"summary"` como o valor do parâmetro `{transaction_id}`
4. Tenta converter `"summary"` para `int`, falha e retorna erro 422
5. A rota `/transactions/summary` nunca é alcançada

### Solução no Backend

1. **Verificar a ordem das rotas** no arquivo de rotas de transações
2. **Mover a rota `/transactions/summary` para ANTES de `/transactions/{transaction_id}`**
3. **Testar** que ambas as rotas funcionam:
   - `GET /v1/transactions/summary` → retorna summary
   - `GET /v1/transactions/123` → retorna transação com ID 123

### Exemplo de Estrutura Correta

```python
# ✅ CORRETO: Rotas específicas primeiro
router = APIRouter(prefix="/transactions", tags=["transactions"])

# 1. Rota específica primeiro
@router.get("/summary")
async def get_transactions_summary(
    organization_id: str = Query(...),
    # ... outros parâmetros
):
    """Obtém estatísticas agregadas das transações"""
    ...

# 2. Rota de listagem
@router.get("")
async def list_transactions(
    organization_id: str = Query(...),
    # ... outros parâmetros
):
    """Lista transações com filtros e paginação"""
    ...

# 3. Rotas com parâmetros dinâmicos por último
@router.get("/{transaction_id}")
async def get_transaction(
    transaction_id: int,
    organization_id: str = Query(...),
):
    """Obtém uma transação específica por ID"""
    ...

@router.put("/{transaction_id}")
async def update_transaction(
    transaction_id: int,
    # ...
):
    ...

@router.delete("/{transaction_id}")
async def delete_transaction(
    transaction_id: int,
    # ...
):
    ...
```

## Verificação

Após corrigir, testar:

1. **Rota summary funciona:**
   ```bash
   curl -X GET "https://api.fincla.com/v1/transactions/summary?organization_id=..." \
     -H "Authorization: Bearer ..."
   ```
   Deve retornar `200 OK` com dados de summary.

2. **Rota por ID ainda funciona:**
   ```bash
   curl -X GET "https://api.fincla.com/v1/transactions/123?organization_id=..." \
     -H "Authorization: Bearer ..."
   ```
   Deve retornar `200 OK` com a transação de ID 123.

3. **Rota summary não tenta converter para int:**
   - Não deve retornar erro 422
   - Não deve tentar buscar transação com ID "summary"

## Impacto

- **Frontend:** Não consegue carregar os cards de estatísticas (KPIs) na página `/transactions`
- **Usuários:** Veem erro ao acessar a página de transações
- **Sistema:** Funcionalidade crítica quebrada em produção

## Prioridade

**🔴 ALTA** - Funcionalidade crítica quebrada em produção.

## Nota

O frontend está chamando o endpoint corretamente:
```typescript
// src/api/transactions.ts
export const getTransactionsSummary = async (
  filters: TransactionsSummaryQuery
): Promise<TransactionsSummaryResponse> => {
  const response = await apiClient.get<TransactionsSummaryResponse>(
    '/transactions/summary',  // ✅ Correto
    { params: filters }
  );
  return response.data;
};
```

O problema está exclusivamente na ordem das rotas no backend.

