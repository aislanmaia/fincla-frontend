import React from "react";

import { AnimNum } from "../../components/primitives.jsx";
import { T } from "../../tokens";
import { G } from "../../typography";

const LABELS = [
  { key: "receitas", full: "Receitas", short: "Rec" },
  { key: "despesas", full: "Despesas", short: "Desp" },
  { key: "resultado", full: "Resultado", short: "Result" },
];

const divider = { paddingRight: 14, marginRight: 14, borderRight: `1px solid ${T.border}` };

/**
 * Faixa de estatísticas do filtro — mora na MESMA linha do título.
 *
 * Antes eram três cards de 87 px numa faixa própria. A linha do título era quase
 * toda espaço vazio à direita; ocupá-la devolve ~100 px para a lista sem esconder
 * nada.
 *
 * A expansão acontece DENTRO deste card, não abaixo dele: a linha compacta e o
 * detalhe compartilham a mesma grade, então cada detalhe nasce embaixo do seu
 * próprio KPI — e o detalhe traz só o que a linha compacta não tem. O valor
 * nunca se repete.
 *
 * @param {number} receita Soma das receitas do filtro.
 * @param {number} despesa Despesa líquida (já com estornos abatidos), positiva.
 * @param {number} resultado Receitas menos despesas do filtro.
 * @param {boolean} unknown Ainda não sabemos: mostra "—", nunca "R$ 0,00".
 * @param {(v:number)=>string} fmt Formatador de moeda da página.
 */
export function TransactionsStats({
  receita,
  despesa,
  resultado,
  countReceita,
  countDespesa,
  countEstorno,
  totalEstorno,
  filteredCount = null,
  countsArePartial = false,
  stacked = false,
  unknown = false,
  expanded = false,
  onToggleExpanded,
  compactLabels = false,
  /* O detalhe rico do §07: maior lançamento de cada lado, quanto ainda está a
     pagar e quanto do resultado já entrou no saldo. Tudo `null` fora do modo
     live — o detalhe some por coluna, não o card inteiro. */
  maiorReceita = null,
  maiorDespesa = null,
  aPagarCount = null,
  aPagarDespesas = null,
  saldoLiquidado = null,
  fmt,
}) {
  const despesaPositiva = despesa >= 0;
  /* Os KPIs ANIMAM até o novo valor. É o elo que faltava: a pessoa marca uma
     transação como paga e não vê efeito nenhum, porque o número está a 400 px
     dali — o movimento é o que liga a ação ao resultado. `AnimNum` já existe
     nas primitivas e é o mesmo usado na Visão Geral, então os dois lugares
     contam a mesma história do mesmo jeito. */
  const values = [
    { color: T.green, sinal: "+", valor: receita },
    { color: despesaPositiva ? T.red : T.green, sinal: "−", valor: Math.abs(despesa) },
    { color: resultado >= 0 ? T.green : T.red, sinal: resultado >= 0 ? "+" : "−", valor: Math.abs(resultado) },
  ];

  /* `receita` vem do summary remoto (o filtro INTEIRO), enquanto `countReceita`
     conta só as linhas carregadas. Dividir um pelo outro dava uma "média" que
     podia estar 10× alta. Só mostramos a média quando os dois descrevem o mesmo
     conjunto — ou seja, quando não há paginação remota no meio. */
  const canAverage = !countsArePartial && countReceita > 0;
  const media = canAverage ? receita / countReceita : null;

  const mono = (text) => (
    <b style={{ fontFamily: "'Geist Mono',monospace", color: T.ink, fontWeight: 700 }}>{text}</b>
  );

  const loaded = (n) =>
    countsArePartial ? (
      <>
        {n} carregada{n === 1 ? "" : "s"}
      </>
    ) : (
      <>
        {n} lançamento{n === 1 ? "" : "s"}
      </>
    );

  /* A contagem do filtro é a da API (`filteredCount`), não a das linhas já
     carregadas: logo acima o cabeçalho da lista mostra a da API, e os dois se
     contradiriam — "347" no cabeçalho e "23 no filtro" aqui. */
  const totalNoFiltro = filteredCount ?? countReceita + countDespesa + countEstorno;

  /* A barra de liquidação NÃO é `saldoLiquidado / resultado` sem guarda.
     Nenhum dos dois tem sinal garantido: uma receita de R$ 1.000 em aberto com
     uma despesa de R$ 500 já paga dá resultado 500 e liquidado −500 — uma barra
     de progresso em −100%. E clamp também mente: com o liquidado negativo,
     `max(0, …)` devolve 0% e diz "nada entrou" onde o que entrou foi prejuízo.
     Os DOIS lados precisam ser não negativos; fora disso, não se desenha barra
     nenhuma e a tela mostra os dois valores. */
  const pctLiquidado =
    saldoLiquidado != null && resultado > 0 && saldoLiquidado >= 0
      ? Math.min(1, saldoLiquidado / resultado)
      : null;

  const pctMaiorDespesa =
    maiorDespesa && despesa > 0 ? Math.min(1, maiorDespesa.value / despesa) : null;

  const Barra = ({ pct, cor, titulo }) => (
    <div
      role="img"
      aria-label={titulo}
      title={titulo}
      style={{ height: 3, borderRadius: 99, background: T.border, marginTop: 5, overflow: "hidden" }}
    >
      <i style={{ display: "block", height: "100%", width: `${Math.round(pct * 100)}%`, background: cor }} />
    </div>
  );

  const maiorLinha = (item, sufixo = null) =>
    item ? (
      <>
        maior: <span style={{ color: T.inkMid }}>{item.description}</span> · {mono(fmt(item.value))}
        {sufixo}
      </>
    ) : null;

  const details = [
    countReceita > 0 ? (
      <>
        <div>
          {loaded(countReceita)}
          {media != null ? <> · média {mono(fmt(media))}</> : null}
        </div>
        {maiorReceita ? <div>{maiorLinha(maiorReceita)}</div> : null}
      </>
    ) : (
      "Nenhuma receita carregada"
    ),
    <>
      <div>
        {loaded(countDespesa)}
        {countEstorno > 0 ? (
          <>
            {" · "}
            <em style={{ fontStyle: "normal", color: T.green, fontWeight: 600 }}>
              {fmt(totalEstorno)} em estornos abatidos
            </em>
          </>
        ) : null}
      </div>
      {maiorDespesa ? (
        <div>
          {maiorLinha(
            maiorDespesa,
            pctMaiorDespesa != null ? <> — {Math.round(pctMaiorDespesa * 100)}% do total</> : null,
          )}
          {pctMaiorDespesa != null ? (
            <Barra
              pct={pctMaiorDespesa}
              cor="#F87171"
              titulo={`O maior gasto é ${Math.round(pctMaiorDespesa * 100)}% do total de despesas`}
            />
          ) : null}
        </div>
      ) : null}
    </>,
    <>
      {aPagarCount != null && aPagarCount > 0 ? (
        <div>
          <i
            aria-hidden="true"
            style={{
              display: "inline-block", width: 7, height: 7, marginRight: 5,
              border: `1.75px solid ${T.amber}`, borderRadius: "50%", boxSizing: "border-box",
            }}
          />
          {aPagarCount} a pagar
          {aPagarDespesas ? <> somam {mono(fmt(aPagarDespesas))}</> : null}
        </div>
      ) : (
        <div>
          {totalNoFiltro} transaç{totalNoFiltro === 1 ? "ão" : "ões"} no filtro
        </div>
      )}
      {saldoLiquidado != null ? (
        <div>
          {/* Com SINAL: `fmt` devolve o absoluto, e um liquidado de −74 saía
              como "R$ 74,00" — dizendo que entrou o oposto do que entrou. */}
          já entrou no saldo:{" "}
          <b
            style={{
              fontFamily: "'Geist Mono',monospace",
              fontWeight: 700,
              color: saldoLiquidado >= 0 ? T.green : T.red,
            }}
          >
            {saldoLiquidado >= 0 ? "+" : "−"}
            {fmt(Math.abs(saldoLiquidado))}
          </b>
          {pctLiquidado != null ? <> — {Math.round(pctLiquidado * 100)}%</> : null}
          {pctLiquidado != null ? (
            <Barra
              pct={pctLiquidado}
              cor={T.green}
              titulo={`${Math.round(pctLiquidado * 100)}% do resultado já entrou no saldo`}
            />
          ) : null}
        </div>
      ) : null}
    </>,
  ];

  return (
    <div
      style={{
        display: "grid",
        /* Empilhado no mobile: três colunas de `rótulo + −R$ 1.234,56` com
           nowrap somam ~500 px de largura intrínseca, e o container do app tem
           `overflowX: hidden` — os números eram CORTADOS em silêncio, sem
           rolagem e sem transbordo que um teste de scrollWidth pegasse. */
        gridTemplateColumns: stacked
          ? "minmax(0, 1fr) minmax(0, 1fr) auto"
          : "repeat(3, minmax(0, 1fr)) auto",
        alignItems: "center",
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 11,
        padding: "8px 14px",
        minWidth: 0,
      }}
    >
      {LABELS.map((l, i) => (
        <div
          key={l.key}
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 7,
            minWidth: 0,
            ...divider,
            // Empilhado: "Resultado" ocupa a linha inteira, como a faixa de KPIs
            // que este card substituiu já fazia no mobile.
            ...(stacked && i === 2
              ? { gridColumn: "1 / -1", borderRight: "none", paddingRight: 0, marginRight: 0,
                  marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }
              : null),
            ...(stacked && i === 1
              ? { borderRight: "none", paddingRight: 0, marginRight: 0 }
              : null),
          }}
        >
          <span
            style={{
              ...G,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: T.inkGhost,
              whiteSpace: "nowrap",
            }}
          >
            {compactLabels ? l.short : l.full}
          </span>
          <span
            style={{
              ...G,
              fontFamily: "'Geist Mono',monospace",
              fontSize: 13,
              fontWeight: 800,
              whiteSpace: "nowrap",
              color: unknown ? T.inkLight : values[i].color,
            }}
          >
            {/* "—" e não "R$ 0,00": com a busca em espera, em voo ou falha, o
                valor é sempre zero porque a API nem respondeu. */}
            {unknown ? (
              "—"
            ) : (
              <>
                {values[i].sinal}
                <AnimNum value={values[i].valor} prefix="R$&nbsp;" />
              </>
            )}
          </span>
        </div>
      ))}

      <button
        type="button"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
        aria-label={expanded ? "Recolher detalhes das estatísticas" : "Ver detalhes das estatísticas"}
        style={{
          ...G,
          width: 24,
          height: 24,
          borderRadius: 7,
          border: `1px solid ${expanded ? "#BFD3FA" : T.border}`,
          background: expanded ? T.blueLight : T.surface,
          color: expanded ? T.blue : T.inkMid,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          cursor: "pointer",
          marginLeft: 12,
          flexShrink: 0,
        }}
      >
        {expanded ? "⌃" : "⌄"}
      </button>

      {expanded && !unknown ? (
        <>
          <div style={{ gridColumn: "1 / -1", height: 1, background: T.border, margin: "10px 0" }} />
          {details.map((node, i) => (
            <div
              key={LABELS[i].key}
              style={{
                gridRow: stacked ? undefined : 3,
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                ...divider,
                ...(stacked
                  ? { gridColumn: "1 / -1", borderRight: "none", paddingRight: 0, marginRight: 0 }
                  : null),
              }}
            >
              <div style={{ ...G, fontSize: 11, color: T.inkLight, lineHeight: 1.45 }}>{node}</div>
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}
