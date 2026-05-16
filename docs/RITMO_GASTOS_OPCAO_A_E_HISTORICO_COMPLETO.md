# Ritmo de Gastos: temporalidade, Opção A e caminho para histórico completo

Documento de referência para produto, frontend e backend. Complementa o plano de implementação da RitmoPage (dados reais + estados de UI) e registra **decisões** que evitam inconsistências entre mês selecionado e dados de orçamento.

---

## 1. Resumo executivo

A tela **Ritmo de Gastos** compara, no ideal, **gasto acumulado real** com uma **régua de orçamento** (distribuição linear do teto no mês) e projeta o fechamento do período.

Com a API atual (`GET /v1/budgets` sem mês de referência explícito):

- O **gasto real** por período pode ser obtido com precisão via **`GET /v1/transactions`** com `date_start`, `date_end` e `type=expense`.
- O **teto orçamentário** retornado por orçamentos reflete o **estado atual** dos limites, não necessariamente o que valia num mês passado; além disso, `spent_amount` / `total_spent` podem estar calculados para o **período corrente** do sistema, não para o mês que o usuário escolhe na UI.

**Decisão (Opção A):**

- **Mês civil atual:** experiência **completa** — comparação com `total_budgeted` + curva real + extrapolação “se mantiver ritmo”, KPIs e painel lateral como hoje no protótipo.
- **Meses passados:** modo **histórico leve** — mostrar **apenas** o que as transações permitem afirmar (curva real, totais, gasto por dia da semana), **sem** régua de orçamento nem narrativa “vs limite daquele mês”, até existir suporte de backend para tetos temporais.

Isso **não exige mudança de backend** para a primeira entrega da Ritmo com dados reais e seletor de mês retroativo.

**Evolução futura (histórico completo):** quando o backend expuser **orçamento (e opcionalmente consumo) indexado ao mês de referência** — via vigência, snapshot mensal ou query explícita — a UI poderá reutilizar o mesmo layout do mês atual também para meses passados.

---

## 2. Importância da feature

- **Mês atual:** responde à pergunta frequente *“estou gastando mais rápido ou mais devagar do que deveria para caber no meu teto?”* — útil para decisão **imediata** (quanto pode gastar por dia até o fim do mês).
- **Meses passados (modo leve):** responde *“como foi o formato do meu gasto naquele mês?”* (acumulado, dias da semana mais pesados) — útil para **reflexão e padrão**, sem afirmar algo falso sobre limites que mudaram ou sobre `spent` agregado no período errado.
- **Histórico completo (futuro):** permite a mesma pergunta do mês atual **retroativamente**, com **mesma honestidade intelectual**, quando o teto histórico for dado garantido pelo sistema.

---

## 3. Problemas que a Opção A evita

### 3.1 Gasto no período errado

Se o front usasse `summary.total_spent` ou `spent_amount` de `GET /v1/budgets` para desenhar fevereiro enquanto o backend calcula esses campos para março, a **linha verde** e os KPIs ficariam **incorretos**.

**Mitigação Opção A:** curva real e totais de gasto vêm **só** de transações filtradas pelo intervalo do mês selecionado.

### 3.2 Teto do mês errado (limites mudam)

Exemplo: em fevereiro a soma dos limites era R$ 3.000; em março o usuário ajustou para R$ 6.000. Se em março ele abre “ritmo de fevereiro” e a UI desenha a régua linear com **R$ 6.000**, a comparação **não reproduz** o ritmo que existia em fevereiro.

**Mitigação Opção A:** em meses passados **não** desenhamos essa régua com `total_budgeted` atual; só mostramos o gasto real daquele intervalo.

---

## 4. Comportamento por modo (Opção A)

### 4.1 Mês atual (`current`)

**Fontes de dados**

- Despesas: `GET /v1/transactions` com `date_start` / `date_end` do mês, `type=expense`, paginação (`limit` ≤ 100, múltiplas páginas se necessário).
- Teto: `GET /v1/budgets` → `summary.total_budgeted` (via adapter existente).

**UI (alvo)**

- Projeção linear (cinza), real (verde), “se mantiver ritmo” (roxo) até o fim do mês, com `todayInView` = dia de hoje.
- KPIs: gasto real até hoje, ritmo esperado linear hoje, diferença.
- Painel lateral: projeção fim de período, orçamento do período, diferença estimada, barras tempo vs consumo, ritmo necessário (dias restantes).
- Banner de status (abaixo/acima do linear).
- Gasto por dia da semana (médias no mês, com “hoje” = weekday real).
- Estados vazios: sem orçamento, sem despesas, erro, loading — alinhados à Visão Geral (`CardEmptyWithCta`, refetch).

### 4.2 Mês passado (`pastLight`)

**Fontes de dados**

- Mesmas transações filtradas pelo mês escolhido.
- **Não** depende de `GET /v1/budgets` para o gráfico principal (opcional omitir a chamada para economizar uma requisição).

**UI (alvo)**

- Gráfico: **só** série **real** (acumulado dia a dia no mês inteiro — mês “fechado” na visualização).
- **Sem** linha de orçamento linear, **sem** extrapolação roxa como no mês aberto, **sem** KPIs que digam “abaixo do esperado” em relação a um teto não garantido.
- Painel lateral **simplificado**: ex. total gasto no mês, talvez média diária; sem “projeção vs orçamento atual”.
- **Copy** visível: ex. *“Visão do gasto real neste mês. Comparativo com seu orçamento está disponível no mês atual.”*
- DOW: mantido (mesma base de transações).
- Empty: sem despesas no mês — CTA para registrar / ir a transações; não exigir “criar orçamento” só por estar em mês passado.

### 4.3 Mês futuro

Não permitir no seletor (ou mostrar estado vazio explicativo).

---

## 5. O que o frontend precisa implementar (Opção A)

Resumo alinhado ao plano em `.cursor/plans/ritmopage_api_+_estados_a457a9ef.plan.md` (ou cópia no repositório):

1. **`spendingPaceModel.js`** em `src/ui/features/spendingPace/` (diretório em inglês; funções puras + testes):
   - Limites do mês (`start`, `end`, `daysInMonth`, `todayInView`).
   - Detecção `viewMode`: `current` vs `pastLight`.
   - Builders de séries: `buildSpendingPaceChartRowsCurrent` vs `buildSpendingPaceChartRowsPastLight`.
   - Médias por dia da semana a partir da lista de transações.

2. **`useSpendingPaceData.js`** (mesmo diretório):
   - Sempre buscar transações do intervalo.
   - Buscar orçamentos **somente** se `viewMode === 'current'`.
   - Expor `refetch`, erros, loading, flags (`hasBudget`, `hasAnyExpense`, …).

3. **`RitmoPage.jsx`** (live):
   - Ramo mock (`dataMode === "mock"`) preservando protótipo.
   - Ramo live com dois layouts conforme `viewMode`.
   - Seletor de mês real; bloqueio de mês futuro.
   - Integração com `organizationId`, `onNewTx` / navegação (via `App.jsx`).

4. **Acessibilidade e consistência:** mesmos padrões de empty/erro da Visão Geral.

**Não** é necessário, para Opção A, alterar [**FRONTEND_API_GUIDE.md**](../../fincla-api/docs/FRONTEND_API_GUIDE.md) (**fincla-api**) além de eventual nota futura quando o backend oferecer histórico completo.

---

## 6. Histórico completo — visão futura

**Definição:** o usuário seleciona um mês passado e vê **a mesma** experiência do mês atual: régua linear, comparação “esperado vs real”, projeção ao ritmo, painel lateral e KPIs — **todos coerentes com o mês selecionado**.

**Pré-condição:** o sistema deve fornecer **teto (e, se desejado, agregados de consumo) para aquele mês de referência**, não apenas o snapshot atual de limites.

---

## 7. O que o frontend precisaria para histórico completo

1. **Novo contrato de dados** (a definir com backend), por exemplo:
   - `GET /v1/budgets?organization_id=&reference_month=2026-02` retornando `summary.total_budgeted` (e por tag, se necessário) **válidos para aquele mês**, **ou**
   - Endpoint dedicado `GET /v1/budgets/summary-for-period?...` com `period_start` / `period_end`.

2. **Hook / modelo:**
   - Unificar série “current” para qualquer mês onde exista `totalBudgetedRef` confiável.
   - Em mês passado: `todayInView` = último dia do mês; sem extrapolação “para frente” no tempo real, ou extrapolação apenas dentro do mês já encerrada (decisão de produto).
   - Remover ou fundir `pastLight` com o fluxo completo quando `historicalBudget` estiver disponível.

3. **UI:** remover copy de “só mês atual”; opcionalmente manter tooltips de auditoria (“limites vigentes naquele mês conforme cadastro”).

4. **Testes:** casos com mudança de limite entre meses (fixtures simulando respostas do novo contrato).

---

## 8. Possibilidades de backend para histórico completo

Qualquer solução deve ser **documentada no [FRONTEND_API_GUIDE.md](../../fincla-api/docs/FRONTEND_API_GUIDE.md)** (**fincla-api:** `docs/FRONTEND_API_GUIDE.md`) com parâmetros, semântica de período e exemplos.

### 8.1 Versão com vigência

- Cada alteração de `amount` de orçamento gera registro com `valid_from` / `valid_until` (ou equivalente por mês).
- **Consulta:** para `reference_month`, resolver versão ativa de cada tag naquele intervalo e somar limites.

**Prós:** auditável, reflete mudanças intra-mês se necessário.  
**Contras:** modelo e queries mais ricos; regras de borda (mudança no dia 15).

### 8.2 Snapshot mensal

- Tabela (ou materialização) `org_id + year + month` → `total_budgeted`, opcionalmente breakdown por tag; preenchida na virada do mês, no primeiro evento do mês ou sob demanda.

**Prós:** leitura simples para a Ritmo; contrato de API direto.  
**Contras:** jobs ou gatilhos; retrabalho se política de “reabrir mês” existir.

### 8.3 Reconstrução por eventos / log (sem “tabela de histórico mensal” de limites)

A ideia é **não** materializar, mês a mês, “quanto era o teto em fevereiro” em uma tabela de snapshots. Em vez disso, o sistema guarda **apenas o que mudou** ao longo do tempo; o valor “válido em um mês passado” é **calculado na hora da consulta**.

**Formas comuns:**

1. **Log de alterações (append-only)**  
   Cada mudança de `amount` gera um registro: `(budget_id ou tag_id, new_amount, effective_at, opcional user_id)`. Para `reference_month`, o serviço percorre o log (ou faz busca binária por data) e descobre **qual era o último valor anunciado antes ou durante** aquele mês. Não há linha “fevereiro” no banco — há só eventos.

2. **Tabela temporal nativa (SQL Server, alguns outros)**  
   O banco versiona linhas automaticamente; uma query com `FOR SYSTEM_TIME AS OF '2026-02-15'` devolve o estado da linha naquela data. O “histórico” não é uma segunda tabela de negócio, é infraestrutura do SGBD.

3. **Versões explícitas (parentesco com 8.1)**  
   Parecido com vigência, mas a “fonte da verdade” pode ser só a sequência de versões; `valid_from`/`valid_until` são **derivados** ou **mantidos** para consulta rápida. O 8.3 enfatiza o caso em que você **não** pré-grava totais por mês — só versões ou eventos.

**Prós:** não duplica dados por mês; histórico auditável; correções retroativas podem ser modeladas como novo evento (com regras de negócio).  
**Contras:** consultas mais pesadas ou exigem índices por `(budget_id, effective_at)`; semântica de “mudança no dia 15 do mês” precisa estar bem definida no guia da API.

### 8.4 Consumo agregado (`spent`) por mês

Opcional para KPIs que hoje poderiam ser derivados de transações. Se o backend passar a expor `total_spent` para `reference_month`, o front pode **cruzar** com transações para validação ou simplificar telas — desde que o guia garanta a mesma janela de datas que o usuário espera.

**Recomendação:** mesmo com agregados server-side, **transações** permanecem fonte da verdade para **curva diária** e **DOW**, salvo endpoint agregado **por dia** explícito.

### 8.5 Migração: de “um valor por categoria” para `valid_from` / `valid_until`

Hoje o modelo típico é: **uma linha** por orçamento ativo (tag + `amount`). Não há histórico de limites.

Ao introduzir **vigência** (8.1) ou **versões** compatíveis com consulta por mês, a migração em produção costuma seguir estes princípios:

1. **Adicionar colunas** `valid_from` (obrigatório após migração) e `valid_until` (`NULL` = vigência aberta / “versão atual”).  
   Alternativa: nova tabela `budget_versions` com FK para `budgets` e manter na tabela antiga só o “ponteiro” para a versão atual — útil se quiser preservar o formato atual do `GET /budgets` com uma view ou join.

2. **Backfill para cada orçamento existente:**  
   - **`valid_from`:** usar um marco único acordado, por exemplo `created_at` do orçamento, ou **início do mês** de `created_at`, ou a **data do deploy** da feature (tudo documentado — importa ser **consistente** e previsível).  
   - **`valid_until`:** `NULL` (esta versão continua valendo até a primeira edição pós-migração).

3. **Comportamento pós-deploy:** ao **editar** o valor, o backend **não** deve apenas fazer `UPDATE` do `amount` in-place se o objetivo for histórico: deve **encerrar** a versão anterior (`valid_until` = véspera da vigência da nova, ou fim do dia anterior) e **inserir** nova linha (ou nova versão) com o novo `amount` e `valid_from` = data efetiva da mudança (geralmente “hoje” ou início do mês seguinte, conforme regra de produto).

4. **Meses anteriores ao `valid_from`:** antes do primeiro registro histórico, não há limite conhecido — a API pode retornar `total_budgeted: null` para `reference_month` antigo demais, ou zero, ou inferir só a partir da primeira versão (também documentar).

5. **Rollback / feature flag:** migração só de schema + backfill é reversível com cuidado; se já houver edições que criaram múltiplas versões, rollback exige política explícita.

Em resumo: **cada orçamento atual vira a “primeira versão”** com vigência aberta até a próxima alteração; **nenhum dado monetário antigo se perde**; o que não existe é **limite antes** da primeira linha — aí só transações descrevem o passado (alinhado à Opção A até existir histórico completo).

---

## 9. Referências no repositório

- Plano de implementação: `ritmopage_api_+_estados` (Cursor plans / cópia versionada se existir).
- Guia de API: [**FRONTEND_API_GUIDE.md**](../../fincla-api/docs/FRONTEND_API_GUIDE.md) (**fincla-api:** `docs/FRONTEND_API_GUIDE.md`) — `GET /v1/transactions`, `GET /v1/budgets`.
- Cliente TS: `src/api/transactions.ts`, `src/api/budgets.ts`.
- Paginação de transações: `fetchAllTransactionsPages` em `src/ui/data/transactionsAdapter.js`.
- Orçamento consolidado no UI: `mapBudgetsResponseToUi` em `src/ui/data/budgetsAdapter.js`.

---

## 10. Changelog deste documento

| Data       | Nota                                      |
| ---------- | ----------------------------------------- |
| 2026-03-26 | Criação: Opção A, escopo front, roadmap backend para histórico completo. |
| 2026-03-26 | Caminhos de código: feature em `src/ui/features/spendingPace/` (`spendingPaceModel.js`, `useSpendingPaceData.js`). |
| 2026-03-26 | Expandido §8.3 (eventos / reconstrução); novo §8.5 migração `valid_from`/`valid_until`. |
