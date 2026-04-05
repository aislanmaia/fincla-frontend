# Recorrências no período do Visão Geral — extensão de `GET /v1/transactions/summary`

**Audiência:** backend (contrato e cálculo) e frontend (consumo e fallback).  
**Problema:** o datepicker do **Visão Geral** usa `date_start` / `date_end` arbitrários; os KPIs de transações já respeitam o período, mas a fatia **“Comprometido”** usa `GET /v1/recurring-series` → `summary.total_monthly_expense` (**valor mensal fixo**), gerando inconsistência dimensional.

**Documentos relacionados:** `docs/BACKEND_TEST_RESET_ORGANIZATION.md` (E2E), `docs/FRONTEND_API_GUIDE.md` (contrato oficial após merge).

---

## 1. Estado atual (frontend) — referência de código


| Arquivo                                         | Comportamento                                                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/ui/features/dashboard/useDashboardData.js` | `getTransactionsSummary({ organization_id, date_start, date_end })` + `listRecurringSeries(orgId, true)` em paralelo. |
| `src/ui/pages/DashboardPage.jsx`                | `committed = recurringSummary.total_monthly_expense` na barra “Gasto / Comprometido / Livre”.                         |


**Conclusão:** `total_expenses` do summary = realizado no período; `committed` = **projeção mensal global**, não proporcional ao intervalo.

---

## 2. Objetivos da mudança

1. **Despesas recorrentes no intervalo:** soma das ocorrências **esperadas** de séries `expense` ativas entre `date_start` e `date_end` (inclusive).
2. **Receitas recorrentes no intervalo:** idem para `income` — **mesma entrega** que (1), para relatórios/KPIs/UI futura sem novo endpoint.
3. **Uma única fonte de período:** reutilizar os mesmos `date_start` / `date_end` já enviados ao summary de transações.

---

## 3. Contrato canônico — backend

### 3.1 Endpoint

`GET /v1/transactions/summary` (sem mudança de path).

### 3.2 Query params existentes (inalterados)

Incluem `organization_id`, `date_start`, `date_end`, filtros opcionais já documentados no guia.

### 3.3 Quando incluir o bloco novo


| Condição                                                                                    | `recurring_in_period` na resposta                                                                                                        |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `date_start` **e** `date_end` presentes, válidos (`YYYY-MM-DD`), e `date_start <= date_end` | Objeto conforme §3.4                                                                                                                     |
| Caso contrário (datas ausentes, inválidas ou range invertido)                               | Omitir o campo **ou** `null` — o backend escolhe **um** comportamento e documenta no guia; o frontend trata os dois como “indisponível”. |


**Intervalo:** datas **inclusivas** nos dois extremos, em **calendário civil** alinhado ao restante da API (mesma regra de timezone que transações).

### 3.4 Formato do objeto `recurring_in_period`

```typescript
/** Extensão de TransactionsSummaryResponse */
interface RecurringInPeriod {
  /** Soma das despesas recorrentes ativas: valor × ocorrências no [date_start, date_end] */
  total_expense: number;
  /** Soma das receitas recorrentes ativas: mesma lógica */
  total_income: number;
  /** Eco do período aplicado (normalizado pelo backend se necessário) */
  period: {
    start_date: string; // YYYY-MM-DD
    end_date: string;   // YYYY-MM-DD
  };
  /** Opcional: contagem de séries que contribuíram */
  series_count_expense?: number;
  series_count_income?: number;
}
```

**Tipos numéricos:** mesmo padrão de precisão do restante do summary (ex.: decimal com 2 casas no JSON).

### 3.5 Semântica de cálculo (obrigatória para implementação)

Para **cada** série recorrente **ativa** (`is_active === true`):

- Filtrar por `type === 'expense'` → acumular em `total_expense`.
- Filtrar por `type === 'income'` → acumular em `total_income`.
- Considerar apenas séries cuja **vigência** intercepta `[date_start, date_end]` (respeitar `start_date`, `end_date` da série e versionamento / `replaces_series_id` se existir no modelo).
- Para cada série elegível: contar quantas **ocorrências** cairiam dentro do intervalo, usando a **mesma regra de calendário** usada para materialização de transações / `next_occurrence`.
- Contribuição da série = `value * (número de ocorrências no intervalo)`.
- `value_kind === 'approximate'`: usar o mesmo `value` cadastrado (sem multiplicador extra).

**Não** misturar com lançamentos reais: isto é **projeção a partir das séries**, não soma de linhas em `transactions`.

### 3.6 Tabela anti-confusão (nomes no JSON)


| Campo no JSON                       | Significado                                                             |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `total_income` (raiz do summary)    | Receitas **realizadas** (transações) no período filtrado.               |
| `total_expenses` (raiz)             | Despesas **realizadas** no período.                                     |
| `recurring_in_period.total_income`  | **Projeção** de receitas recorrentes (ocorrências esperadas na janela). |
| `recurring_in_period.total_expense` | **Projeção** de despesas recorrentes (comprometido esperado na janela). |


Sugestão de tooltip/copy na UI futura: “Comprometido (recorrente no período)” para distinguir de “Gasto (realizado)”.

---

## 4. Erros e bordas


| Situação                   | Comportamento esperado                                                        |
| -------------------------- | ----------------------------------------------------------------------------- |
| Range invertido no request | **422** ou normalizar trocando início/fim — **uma** política só, documentada. |
| Sem séries recorrentes     | `total_expense: 0`, `total_income: 0`, contagens `0` ou omitidas.             |
| Série pausada              | Não entra.                                                                    |
| Apenas uma data enviada    | Tratar como §3.3 “sem bloco” **ou** 422 — documentar.                         |


---

## 5. Duas frentes complementares (dashboard vs outras telas)

### 5.1 Por que priorizar `GET /v1/transactions/summary` no Visão Geral

Para a **Visão Geral**, o melhor contrato é enriquecer o **mesmo** response que já carrega KPIs do período (`total_income`, `total_expenses`, `balance`, etc.) com `recurring_in_period`. Assim:

- uma única requisição alinha **realizado** e **projetado recorrente** ao mesmo `date_start` / `date_end`;
- não há risco de o datepicker disparar dois fetches com períodos levemente diferentes.

Isso não invalida melhorar o endpoint de séries — são **casos de uso** distintos.

### 5.2 Contraponto: `GET /v1/recurring-series` flexível **é** desejável

Em **Relatórios**, **Recorrências** (e outras telas que listam ou agregam séries sem precisar do summary de transações), ter `GET /v1/recurring-series` com **`date_start` e `date_end` opcionais** (e um bloco explícito de totais **no intervalo**, por exemplo `summary_for_period` ou extensão de `summary`) é **interessante e recomendável**:

- a tela já está “no mundo” das recorrências: filtrar ou resumir por janela no **mesmo** endpoint que devolve a lista evita o cliente reimplementar contagem de ocorrências;
- relatórios que cruzam “o que está cadastrado” com “quanto isso representa em X dias/meses” podem usar só esse GET com query params;
- a página de Recorrências pode exibir cards como “Comprometido no período selecionado” ou comparar com o mês cheio **sem** depender do dashboard.

Ou seja: a “direção secundária” no sentido de **prioridade para o Visão Geral** continua sendo o summary; no sentido de **valor do produto**, estender `/recurring-series` **não** é um plano B fraco — é um **complemento** para outras superfícies.

### 5.3 Implementação no backend (evitar divergência)

Se existirem **dois** pontos de entrada (`transactions/summary` e `recurring-series` com período), o cálculo de ocorrências e somas no intervalo deve ser **uma função interna compartilhada** (mesma regra de calendário, vigência de série, pausas, versionamento). Assim não há “número no dashboard” diferente do “número em Relatórios”.

### 5.4 Resumo

| Abordagem | Onde brilha |
|-----------|-------------|
| `recurring_in_period` em `GET /v1/transactions/summary` | Visão Geral: um request, período único, KPI + comprometido + projeção de receita recorrente. |
| `date_start` / `date_end` + agregados em `GET /v1/recurring-series` | Recorrências, Relatórios, exports, qualquer fluxo centrado na lista de séries. |

**Conclusão:** não é “summary **ou** recurring-series”; pode ser **summary para o dashboard** e **recurring-series enriquecido para o restante**, desde que o núcleo de cálculo seja único.

---

## 6. Guia de implementação — frontend

### 6.1 Depois que o backend estiver em produção/staging

1. `src/api/types.ts`: estender o tipo da resposta de `getTransactionsSummary` com `recurring_in_period?: RecurringInPeriod | null`.
2. `useDashboardData.js`: ao processar o summary, expor algo como `recurringInPeriod: summary.recurring_in_period ?? null`.
3. `DashboardPage.jsx`:
   - `committed = recurringInPeriod?.total_expense ?? fallback`
   - **Fallback:** usar `recurringSummary.total_monthly_expense` **somente** se `recurring_in_period` vier ausente na resposta (caso excepcional após alinhamento completo backend/front em todos os ambientes).
   - **Regra normal:** sempre que `recurring_in_period` estiver presente, usar `total_expense` na barra — alinhado ao `date_start`/`date_end` do mesmo request de summary.
4. **Projeção `total_income`:** disponibilizar no hook (`recurringInPeriod.total_income`) para relatórios e evolução da UI sem novo fetch.

### 6.2 Testes

- **Unitário:** mapeamento `summary → estado` com mock contendo `recurring_in_period`.
- **E2E:** após backend, mudar datepicker e assertar que “Comprometido” acompanha intervalo curto/longo (não valor mensal fixo).
- **Até lá:** cenário **12.3** = gap conhecido — não assertar coerência da barra com período arbitrário.

---

## 7. Documentação e tipos

- Atualizar `docs/FRONTEND_API_GUIDE.md` na seção `GET /v1/transactions/summary` com o bloco `recurring_in_period`, exemplos (7 dias, 90 dias, período personalizado) e a tabela §3.6.
- Se o backend estender `GET /v1/recurring-series` com intervalo (§5.2), documentar query params, formato de `summary` / `summary_for_period` e exemplos para telas de Relatórios e Recorrências.
- Regenerar ou editar tipos em `src/api/types.ts`.

---

## 8. Testes sugeridos (backend)

- Mês civil cheio: contagens mensais = 1 por série mensal.
- 7 dias com séries semanais/quinzenais.
- Períodos personalizados.
- `end_date` da série no meio do período.
- `is_active: false` excluída.
- Anual em janela de 15 meses.
- Só receitas: `total_expense === 0`, `total_income > 0`.
- Só despesas: inverso.
- Sem `date_start`/`date_end`: sem `recurring_in_period` (ou `null`), conforme §3.3.

---

## 9. Critérios de aceite

1. Com `date_start` e `date_end` válidos, `recurring_in_period.total_expense` reflete o comprometido recorrente na janela.
2. `recurring_in_period.total_income` reflete receitas recorrentes projetadas na mesma janela, mesma lógica de ocorrências.
3. Documentação e tipos deixam explícita a diferença entre totais **realizados** (raiz) e **projetados** (`recurring_in_period`).
4. Frontend usa `recurring_in_period` em todos os ambientes; fallback para `total_monthly_expense` apenas se o bloco vier ausente (exceção).
5. Visão Geral / relatórios podem usar um único request de summary para período + projeção recorrente.

---

## 10. Referência rápida de arquivos (repo frontend)


| Arquivo                                         | Ação                                                            |
| ----------------------------------------------- | --------------------------------------------------------------- |
| `src/ui/features/dashboard/useDashboardData.js` | Passar `recurring_in_period` para a UI.                         |
| `src/ui/pages/DashboardPage.jsx`                | Origem de `committed` + futuro uso de `total_income` projetado. |
| `src/api/transactions.ts`                       | Tipagem da resposta de summary.                                 |
| `src/api/types.ts`                              | Interface `RecurringInPeriod`.                                  |


