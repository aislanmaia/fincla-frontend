# Problema: Movimentação de Despesas de 1 Parcela

## ⚠️ ERRO CRÍTICO: Duplicação de Dados

O endpoint `PATCH /v1/credit-cards/{card_id}/charges/{charge_id}/installments/{installment_id}/invoice` está **duplicando parcelas** em vez de movê-las para despesas de 1 parcela.

**A parcela aparece tanto na fatura de origem quanto na fatura de destino**, causando:
- ❌ Duplicação de valores nas faturas
- ❌ Inconsistência de dados
- ❌ Problemas de integridade financeira

## Descrição do Problema

O endpoint está retornando sucesso (`200 OK` com `{success: true}`) para despesas de 1 parcela, mas **não está realmente movendo a parcela no banco de dados**. Em vez disso, está **criando uma cópia** ou **duplicando a entrada**.

## Comportamento Observado

### Despesas com Múltiplas Parcelas ✅
- Funciona corretamente
- A parcela é removida da fatura de origem
- A parcela aparece na fatura de destino
- Todas as outras parcelas são recalculadas

### Despesas de 1 Parcela ❌ **ERRO CRÍTICO**
- Backend retorna sucesso: `{success: true, message: 'Installment 93 moved to invoice 2026-02'}`
- **MAS** a parcela permanece na fatura de origem
- **E** a parcela também aparece na fatura de destino
- **A parcela foi DUPLICADA** - está em ambas as faturas simultaneamente
- Isso causa **duplicação de valores** e **inconsistência de dados**

## Exemplo de Requisição

```http
PATCH /v1/credit-cards/1/charges/66/installments/93/invoice?organization_id=96e4e4d6-f22f-466e-bce4-95ebae64f78d
Content-Type: application/json

{
  "target_year": 2026,
  "target_month": 2
}
```

## Resposta do Backend

```json
{
  "success": true,
  "message": "Installment 93 moved to invoice 2026-02"
}
```

## Verificação no Banco de Dados

Após a requisição:
- ❌ A parcela 93 ainda está associada à fatura `2026-01` (origem)
- ❌ A parcela 93 também está associada à fatura `2026-02` (destino)
- ❌ **A parcela foi DUPLICADA** - existe em ambas as faturas
- ❌ O campo `invoice_month` não foi atualizado corretamente
- ❌ Pode haver duas entradas no banco com o mesmo `installment_id` ou `charge_id`

## Possíveis Causas

1. **Criação de nova entrada em vez de atualização**: O backend pode estar criando uma nova entrada na fatura de destino sem remover a da origem
2. **Falta de transação atômica**: A operação pode não estar sendo executada em uma transação única, causando duplicação
3. **Lógica de INSERT em vez de UPDATE**: Pode estar fazendo INSERT na fatura de destino sem fazer DELETE/UPDATE na origem
4. **Validação que impede despesas de 1 parcela**: Pode haver uma validação que retorna sucesso mas não processa despesas de 1 parcela corretamente
5. **Lógica de recálculo**: A lógica pode estar assumindo múltiplas parcelas e não tratando o caso de 1 parcela
6. **Condição específica**: Pode haver uma condição `if total_installments > 1` que pula o processamento correto para despesas de 1 parcela

## O que Verificar no Backend

1. **⚠️ CRÍTICO**: Verificar se está criando uma nova entrada em vez de atualizar a existente
2. **⚠️ CRÍTICO**: Verificar se a operação está sendo executada em uma transação atômica (tudo ou nada)
3. Verificar se está fazendo INSERT na fatura de destino sem DELETE/UPDATE na origem
4. Verificar se há alguma condição que impede o processamento correto de despesas de 1 parcela
5. Verificar se a lógica de atualização está sendo executada para `total_installments === 1`
6. Verificar logs do backend durante a execução
7. Verificar se o campo `invoice_month` está sendo atualizado corretamente (UPDATE, não INSERT)
8. Verificar se há constraints de unicidade que deveriam impedir duplicatas

## Comportamento Esperado

Para despesas de 1 parcela, o comportamento deve ser:
1. Atualizar o `invoice_month` da parcela para o mês/ano de destino
2. Recalcular a `due_date` baseada no `due_day` do cartão e no novo mês/ano
3. Remover a parcela da fatura de origem
4. Adicionar a parcela à fatura de destino
5. Retornar sucesso apenas se a operação foi realmente persistida

## Nota

O frontend está funcionando corretamente e detectando o problema através de verificações após a movimentação. O problema está exclusivamente no backend.


