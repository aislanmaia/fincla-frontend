# Exibição de Transações com Parcelas no Frontend

> **Objetivo:** Este documento descreve como o frontend deve exibir transações de cartão de crédito parcelado na tela de listagem, utilizando o campo `installment_info` retornado pela API.

---

## 1. Contexto

O endpoint `GET /v1/transactions` passou a incluir transações de cartão de crédito com base no **vencimento das parcelas** (e não na data da compra) quando filtros de data (`date_start` e `date_end`) são informados.

Quando uma transação aparece na lista por causa de parcelas que vencem no período, a API retorna a **transação original** com um array opcional `installment_info`, contendo as parcelas cujo vencimento está no range.

---

## 2. Estrutura da API

### 2.1. Resposta do endpoint

```typescript
interface Transaction {
  id: number;
  organization_id: string;
  type: 'income' | 'expense';
  description: string;
  tags: Record<string, Tag[]>;
  value: number;                    // Valor total da transação
  payment_method: string;           // Ex: "pix", "credit_card", "debit_card"
  date: string;                    // Data da compra (ISO datetime)
  recurring: boolean;
  created_at: string;
  updated_at: string;
  credit_card_charge?: CreditCardChargeInfo | null;
  installment_info?: InstallmentInfo[] | null;  // ← NOVO: parcelas no range
  category?: string | null;
}

interface InstallmentInfo {
  installment_number: number;   // Ex: 1, 2, 3
  total_installments: number;   // Ex: 6
  due_date: string;            // YYYY-MM-DD (data de vencimento)
  amount: number;               // Valor da parcela
}
```

### 2.2. Quando `installment_info` está presente

- `installment_info` só existe quando a transação foi incluída na lista **por causa de parcelas** cujo vencimento está no período filtrado.
- O array contém **todas as parcelas** dessa transação que vencem no range.
- Pode haver 1 ou mais parcelas no array (ex.: compra em 6x com 2 parcelas vencendo em fevereiro).

### 2.3. Exemplo de resposta

```json
{
  "id": 351,
  "description": "Geladeira - Magazine Luiza",
  "value": 600.00,
  "payment_method": "credit_card",
  "date": "2026-01-05T10:00:00",
  "credit_card_charge": { "charge": {...}, "card": {...} },
  "installment_info": [
    { "installment_number": 1, "total_installments": 6, "due_date": "2026-02-05", "amount": 100.00 },
    { "installment_number": 2, "total_installments": 6, "due_date": "2026-02-12", "amount": 100.00 }
  ]
}
```

---

## 3. Regras de Exibição na Tabela

### 3.1. Transação sem `installment_info`

Exibir **uma linha** usando os dados da própria transação:

| Campo | Fonte |
|-------|-------|
| Descrição | `transaction.description` |
| Categoria | `transaction.tags.categoria[0].name` ou `transaction.category` |
| Data | `transaction.date` (formatado) |
| Forma de Pagamento | Mapear `transaction.payment_method` (PIX, Cartão de Débito, Cartão à vista, etc.) |
| Valor | `transaction.value` |
| Ações | Editar/Excluir usando `transaction.id` |

### 3.2. Transação com `installment_info`

Exibir **uma linha por parcela**, em sequência, ordenadas por `due_date`:

| Campo | Fonte |
|-------|-------|
| Descrição | `transaction.description` (mesma em todas as linhas) |
| Categoria | `transaction.tags.categoria[0].name` ou `transaction.category` |
| Data | `installment.due_date` (formatado) |
| Forma de Pagamento | `Cartão parcelado (X/Y)` onde X = `installment_number`, Y = `total_installments` |
| Valor | `installment.amount` |
| Ações | Editar/Excluir usando `transaction.id` (sempre a transação original) |

**Importante:** As linhas devem ficar **consecutivas** (uma logo após a outra), agrupadas pela mesma transação.

---

## 4. Mockup da Tabela

### 4.1. Exemplo completo

```
┌─────────────────────┬──────────────────┬──────────────┬─────────────────────────┬────────────┬────────┐
│ Descrição           │ Categoria        │ Data         │ Forma de Pagamento      │ Valor      │ Ações  │
├─────────────────────┼──────────────────┼──────────────┼─────────────────────────┼────────────┼────────┤
│ Contas e Trans...   │ Transporte       │ 16/02/2026   │ PIX                     │ -R$ 571,50 │ ✏️ 🗑️  │
│ Padaria             │ Alimentação      │ 13/02/2026   │ Cartão à vista          │ -R$ 35,00  │ ✏️ 🗑️  │
│ Supermercado Assaí  │ Alimentação      │ 10/02/2026   │ Cartão parcelado (1/3)  │ -R$ 100,00 │ ✏️ 🗑️  │
│ Geladeira           │ Casa & Decoração │ 05/02/2026   │ Cartão parcelado (1/6) │ -R$ 100,00 │ ✏️ 🗑️  │
│ Geladeira           │ Casa & Decoração │ 12/02/2026   │ Cartão parcelado (2/6)  │ -R$ 100,00 │ ✏️ 🗑️  │
│ Salário February    │ Salário & Pró-.. │ 06/02/2026   │ PIX                     │ +R$ 7.500  │ ✏️ 🗑️  │
└─────────────────────┴──────────────────┴──────────────┴─────────────────────────┴────────────┴────────┘
```

### 4.2. Casos de uso

| Cenário | Linhas exibidas |
|---------|-----------------|
| Transação PIX | 1 linha |
| Transação cartão à vista | 1 linha |
| Transação parcelada, 1 parcela no período | 1 linha |
| Transação parcelada, 2 parcelas no período | 2 linhas consecutivas |
| Transação parcelada, N parcelas no período | N linhas consecutivas |

---

## 5. Implementação Sugerida

### 5.1. Função para expandir transações em linhas da tabela

```typescript
interface TableRow {
  transactionId: number;
  description: string;
  category: string;
  displayDate: string;
  displayPaymentMethod: string;
  displayValue: number;
  type: 'income' | 'expense';
  // ... outros campos necessários para a linha
}

function expandTransactionsToRows(transactions: Transaction[]): TableRow[] {
  const rows: TableRow[] = [];

  for (const tx of transactions) {
    if (tx.installment_info?.length) {
      // Ordenar parcelas por due_date
      const sorted = [...tx.installment_info].sort(
        (a, b) => a.due_date.localeCompare(b.due_date)
      );

      for (const inst of sorted) {
        rows.push({
          transactionId: tx.id,
          description: tx.description,
          category: tx.category ?? tx.tags?.categoria?.[0]?.name ?? '-',
          displayDate: formatDate(inst.due_date),  // Ex: "10/02/2026"
          displayPaymentMethod: `Cartão parcelado (${inst.installment_number}/${inst.total_installments})`,
          displayValue: inst.amount,
          type: tx.type,
          // ... copiar outros campos necessários
        });
      }
    } else {
      rows.push({
        transactionId: tx.id,
        description: tx.description,
        category: tx.category ?? tx.tags?.categoria?.[0]?.name ?? '-',
        displayDate: formatDate(tx.date),
        displayPaymentMethod: mapPaymentMethod(tx.payment_method),
        displayValue: tx.value,
        type: tx.type,
        // ...
      });
    }
  }

  return rows;
}
```

### 5.2. Mapeamento de `payment_method`

Para transações **sem** `installment_info`, mapear o valor da API para o label exibido:

```typescript
function mapPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    pix: 'PIX',
    debit_card: 'Cartão de Débito',
    credit_card: 'Cartão à vista',  // Quando não tem installment_info
    bank_transfer: 'Transferência',
    // ... outros
  };
  return map[method] ?? method;
}
```

### 5.3. Tooltip / Hover — Informações detalhadas da parcela

Ao passar o mouse sobre a célula **Forma de Pagamento** (ex.: "Cartão parcelado (1/3)"), exibir um tooltip com:

| Campo | Fonte |
|-------|-------|
| Data da compra | `transaction.date` (formatado) |
| Parcela | `installment_number` de `total_installments` |
| Vencimento | `installment.due_date` (formatado) |
| Valor da parcela | `installment.amount` |
| Valor total da compra | `transaction.value` |

**Exemplo visual do tooltip:**

```
┌─────────────────────────────┐
│ Compra: 10/01/2026           │
│ Parcela 1 de 3               │
│ Vencimento: 10/02/2026       │
│ Valor da parcela: R$ 100,00  │
│ Valor total: R$ 300,00       │
└─────────────────────────────┘
```

**Implementação sugerida:**

```typescript
// Componente de tooltip para linha com installment_info
function InstallmentTooltip({ tx, inst }: { tx: Transaction; inst: InstallmentInfo }) {
  return (
    <Tooltip>
      <TooltipTrigger>Cartão parcelado ({inst.installment_number}/{inst.total_installments})</TooltipTrigger>
      <TooltipContent>
        <p>Compra: {formatDate(tx.date)}</p>
        <p>Parcela {inst.installment_number} de {inst.total_installments}</p>
        <p>Vencimento: {formatDate(inst.due_date)}</p>
        <p>Valor da parcela: {formatCurrency(inst.amount)}</p>
        <p>Valor total: {formatCurrency(tx.value)}</p>
      </TooltipContent>
    </Tooltip>
  );
}
```

### 5.4. Ações (Editar / Excluir)

Sempre usar `transactionId` (ou `transaction.id`) para as ações:

- **Editar:** navegar para `/transactions/{transactionId}/edit`
- **Excluir:** chamar API `DELETE /v1/transactions/{transactionId}`

Isso vale tanto para linhas normais quanto para linhas de parcelas — a edição/exclusão é sempre da transação original.

---

## 6. Ordenação

A API já retorna as transações ordenadas por data efetiva (compra ou vencimento). O frontend deve:

1. Manter a ordem recebida da API.
2. Ao expandir transações com `installment_info`, garantir que as linhas de parcelas fiquem consecutivas e ordenadas por `due_date` entre si.

---

## 7. Paginação e Total

- O `total` retornado na paginação refere-se ao **número de transações** (não ao número de linhas expandidas).
- Se uma transação com 2 parcelas no período estiver na página atual, a tabela terá 2 linhas a mais que o `limit` de transações.
- O frontend não precisa alterar a lógica de paginação; apenas expande as transações da página atual em linhas.

---

## 8. Resumo dos Pontos Críticos

| Item | Regra |
|------|-------|
| **Quando expandir** | Sempre que `installment_info` existir e tiver length > 0 |
| **Linhas por parcela** | Uma linha por item em `installment_info` |
| **Ordem das parcelas** | Por `due_date` ascendente |
| **Agrupamento** | Linhas da mesma transação devem ficar consecutivas |
| **ID para ações** | Sempre `transaction.id` |
| **Valor exibido** | `installment.amount` (não `transaction.value`) |
| **Data exibida** | `installment.due_date` (não `transaction.date`) |
| **Label da parcela** | `Cartão parcelado (X/Y)` |
| **Tooltip no hover** | Exibir: data da compra, parcela X/Y, vencimento, valor da parcela, valor total |

---

## 9. Referências

- **API:** `docs/FRONTEND_API_GUIDE.md` — seção `GET /v1/transactions`
- **Tipos TypeScript:** `Transaction`, `InstallmentInfo` já documentados no guia
- **Exemplo de resposta:** Ver seção 2.3 deste documento
