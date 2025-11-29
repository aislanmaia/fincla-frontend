# Especificação do Backend: Simulador de Impacto Financeiro

Este documento define o contrato de API e a lógica de negócio esperada para o endpoint de simulação de impacto financeiro do cartão de crédito.

## Visão Geral

O objetivo é fornecer ao frontend uma análise proativa de "Viabilidade Financeira" para uma nova compra parcelada, cruzando dados de receitas recorrentes, despesas médias, parcelas já comprometidas e metas de economia.

## Endpoint

`POST /api/v1/financial-impact/simulate`

### Request Payload

```json
{
  "purchase_amount": 2500.00,
  "installments": 10,
  "description": "Novo Notebook", // Opcional, para logs/contexto
  "card_id": "uuid-do-cartao", // Opcional, se quiser considerar limite do cartão específico
  "start_date": "2025-01-15" // Opcional, data da compra (default: hoje)
}
```

### Response Payload

```json
{
  "simulation_id": "uuid-da-simulacao", // Para logs ou auditoria
  "summary": {
    "verdict": "viable" | "caution" | "high-risk",
    "verdict_message": "Compra segura! Seu orçamento comporta esta despesa sem afetar suas metas.",
    "total_impact": 250.00, // Valor da parcela mensal
    "duration_months": 10
  },
  "timeline": [
    {
      "month": "Fevereiro",
      "year": 2025,
      "month_iso": "2025-02",
      "financial_data": {
        "projected_income": 5000.00,
        "base_expenses": 2500.00,
        "existing_commitments": 800.00, // Parcelas de outros cartões/compras
        "new_installment": 250.00,
        "total_obligations": 3550.00,
        "savings_goal": 1000.00
      },
      "result": {
        "projected_balance": 1450.00, // Income - Obligations
        "status": "success" | "warning" | "danger",
        "meets_goal": true
      }
    },
    // ... próximos meses
  ]
}
```

## Lógica de Cálculo (Backend)

1.  **Base Income (Receita)**:
    *   Identificar transações de entrada recorrentes dos últimos 6 meses.
    *   Calcular média ou usar o valor mais frequente.
    *   *Futuro*: Permitir usuário definir "Renda Base".

2.  **Base Expenses (Despesas Essenciais)**:
    *   Calcular média de gastos dos últimos 3 meses, excluindo pagamentos de fatura de cartão (para não duplicar com os compromissos de cartão).
    *   Remover outliers (gastos muito acima da média padrão).

3.  **Existing Commitments (Compromissos de Cartão)**:
    *   Somar todas as parcelas futuras de **todos** os cartões do usuário para cada mês da simulação.
    *   Isso é crucial: considerar o endividamento global, não só do cartão atual.

4.  **Savings Goal (Meta de Economia)**:
    *   Buscar meta configurada pelo usuário.
    *   Se não houver, assumir 10% a 20% da renda como "margem de segurança" padrão.

5.  **Cálculo do Veredicto Global**:
    *   `high-risk` (Vermelho): Se em *qualquer* mês o `projected_balance` for negativo (Dívida).
    *   `caution` (Amarelo): Se em *qualquer* mês o `projected_balance` for positivo, mas menor que a `savings_goal`.
    *   `viable` (Verde): Se em *todos* os meses o saldo projetado cobrir despesas + nova parcela + meta de economia.

## Benefícios desta Abordagem

*   **Frontend "Burro"**: O frontend apenas renderiza os estados (cores, ícones, textos) decididos pelo backend.
*   **Consistência**: A lógica de "o que é arriscado" fica centralizada. Se mudarmos a regra de risco (ex: inflação), o frontend não precisa de deploy.
*   **Performance**: O backend tem acesso direto ao banco para agregar milhares de transações passadas eficientemente.
