import React from "react";

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
  fmt,
}) {
  const despesaPositiva = despesa >= 0;
  const values = [
    { color: T.green, text: `+${fmt(receita)}` },
    { color: despesaPositiva ? T.red : T.green, text: `−${fmt(Math.abs(despesa))}` },
    { color: resultado >= 0 ? T.green : T.red, text: `${resultado >= 0 ? "+" : "−"}${fmt(Math.abs(resultado))}` },
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

  const details = [
    countReceita > 0 ? (
      <>
        {loaded(countReceita)}
        {media != null ? <> · média {mono(fmt(media))}</> : null}
      </>
    ) : (
      "Nenhuma receita carregada"
    ),
    <>
      {loaded(countDespesa)}
      {countEstorno > 0 ? (
        <>
          {" · "}
          <em style={{ fontStyle: "normal", color: T.green, fontWeight: 600 }}>
            {fmt(totalEstorno)} em estornos abatidos
          </em>
        </>
      ) : null}
    </>,
    <>
      {totalNoFiltro} transaç{totalNoFiltro === 1 ? "ão" : "ões"} no filtro
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
            {unknown ? "—" : values[i].text}
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
