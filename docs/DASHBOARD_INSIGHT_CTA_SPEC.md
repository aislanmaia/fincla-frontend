# Visão Geral — CTAs do card «Insight do dia»

Documento de especificação para implementação futura. Descreve o comportamento **pretendido** dos botões de ação do card de insights do dashboard, que variam conforme o **humor financeiro** (`mood`).

## Estado atual (implementação)

- Os rótulos e ícones vêm de `getMoodActions(moodKey)` em `src/ui/features/moodV4.jsx`.
- O card renderiza os botões em `src/ui/pages/DashboardPage.jsx` (bloco «INSIGHT DO DIA»).
- **Os botões não possuem `onClick` nem navegação:** são apenas CTAs visuais (`cursor: pointer` sem efeito).

Referências no código:

- Definição das ações: `getMoodActions` — `src/ui/features/moodV4.jsx`
- Renderização: `moodActions.map(...)` — `src/ui/pages/DashboardPage.jsx`

## Conceito de produto

O humor (`mood`) é derivado da relação entre **% do tempo decorrido no período** e **% das despesas em relação a uma referência** (envelope / ritmo), via `calcMood` em `moodV4.jsx`. Os CTAs devem **encaminhar o usuário** para as telas onde ele pode agir de acordo com a gravidade da situação.

Rotas úteis no shell atual (nomes usados em `onNav` / `page` no `App.jsx`):


| Destino provável | Id de página (exemplo) |
| ---------------- | ---------------------- |
| Metas            | `metas`                |
| Simulação        | `simulacao`            |
| Recorrências     | `recorrencias`         |
| Relatórios       | `relatorios`           |
| Transações       | `transacoes`           |
| Orçamentos       | `orcamentos`           |


(Ajustar ids se o app evoluir; manter esta tabela alinhada ao roteamento real.)

## Matriz: humor → ações → resultado esperado

Cada linha corresponde a um par **(label do botão → comportamento desejado)**.

### `serene` (sereno)


| Botão                  | Comportamento esperado                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Definir meta extra** | Navegar para **Metas** com contexto de «folga» (ex.: abrir modal de nova meta ou destacar metas ativas). Objetivo: aproveitar margem para poupar ou planejar. |
| **Ver projeção**       | Navegar para **Simulação** (ou relatório de projeção, se existir). Objetivo: visualizar cenários de saldo/gastos sem pressão imediata.                        |


### `healthy` (saudável)


| Botão                  | Comportamento esperado                                                                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Simular uma compra** | Navegar para **Simulação** com foco em «compra pontual» ou fluxo rápido de impacto. Objetivo: testar uma decisão sem desequilibrar o ritmo.               |
| **Ver categorias**     | Navegar para **Relatórios** (visão por categoria) ou **Transações** com filtro/âncora em categorias. Objetivo: transparência do para onde vai o dinheiro. |


### `watchful` (atento)


| Botão                    | Comportamento esperado                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **Simular impacto**      | Navegar para **Simulação** com copy ou estado inicial alinhado ao alerta de ritmo (ex.: «e se eu gastar X neste mês?»). |
| **Revisar recorrências** | Navegar para **Recorrências**. Objetivo: ajustar valores, frequências ou cancelar itens dispensáveis.                   |


### `tense` (tenso)


| Botão                   | Comportamento esperado                                                                                                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **O que posso cortar?** | Navegar para fluxo de **priorização de cortes**: combinação de Relatórios (maiores categorias) + Recorrências + eventual lista sugerida na própria Simulação. Primeira versão pode ser só **Relatórios** ou **Transações** com ordenação por valor. |
| **Recorrências caras**  | Navegar para **Recorrências** com ordenação por valor decrescente ou filtro «mais caras». Objetivo: atacar compromissos fixos primeiro.                                                                                                             |


### `alert` (alerta)


| Botão                   | Comportamento esperado                                                                                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Revisão urgente**     | Navegação para uma **visão de crise** mínima: ex. **Transações** (período atual) + link secundário para Orçamentos, ou um painel resumido (pode ser fase 2). Objetivo: parar sangria e revisar lançamentos recentes. |
| **Pausar recorrências** | Navegar para **Recorrências** com ênfase em pausar/desativar itens não essenciais (se a API/UI suportar «pausado»; caso contrário, edição rápida ou lista filtrada «assinaturas/lazer»).                             |


## Texto do insight (contexto)

O parágrafo abaixo do valor (`insightBody`) também varia por `moodKey` em `DashboardPage.jsx`. Os CTAs devem ser **coerentes** com esse texto (ex.: em `alert`, o copy fala em pausar recorrências — o segundo botão deve levar a Recorrências).

## Sugestões de implementação

1. **Estender `getMoodActions`**
  Além de `label` e `Icon`, incluir campos estáveis, por exemplo:  
   `actionId: 'nav' | 'modal'`, `targetPage: string`, `query?: Record<string, string>`.
2. **Passar `onNav` no `DashboardPage`**
  O componente já recebe callbacks de navegação em outros pontos; injetar o mesmo padrão nos botões do insight.
3. **Estado opcional na URL**
  Para Simulação/Relatórios, usar query params (`?from=insight&focus=...`) para mensagens e analytics.
4. **Acessibilidade**
  Manter `type="button"`, `aria-label` descritivo se o label for genérico, e foco visível após navegação.
5. **Mobile**
  Garantir que a navegação feche drawer da sidebar se aplicável (mesmo comportamento dos outros itens do menu).
6. **Modo mock / API indisponível**
  Quando o dashboard estiver em estado vazio ou erro, o card de insight pode não aparecer; não é obrigatório exibir CTAs nesse estado.

## Checklist rápido (para PR futuro)

- Mapear cada `(moodKey, label)` → `onNav(...)` (ou handler equivalente).
- Remover «botão fantasma» (pointer sem ação) ou desabilitar com tooltip até existir rota.
- (Opcional) Evento de analytics: `insight_cta_click` com `mood`, `label`, `targetPage`.
- Revisar copy PT-BR dos rótulos após primeira versão funcional.

## Histórico

- Especificação redigida a partir da análise do código v2 (JSX + `moodV4`).

