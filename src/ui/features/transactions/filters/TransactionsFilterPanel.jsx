import React from "react";
import { T } from "../../../tokens";
import { G } from "../../../typography";
import { FacetPanelContent } from "./facetBar/FacetPanelContent.jsx";

/**
 * O painel de filtros da proposta (seção 07 do artefato).
 *
 * Duas mudanças em relação à faixa de cards que existia antes:
 *
 * 1. **Trilho à esquerda, conteúdo à direita.** Antes, escolher uma faceta
 *    expandia um painel ABAIXO da barra e empurrava a lista; trocar de faceta
 *    fechava uma e abria outra, e a lista pulava a cada troca. Aqui as nove
 *    ficam sempre à vista num trilho, com o badge do que já está selecionado em
 *    cada uma, e só o conteúdo do lado direito muda.
 * 2. **Ancorado ao lado da lista, que comprime.** A lista continua visível e
 *    atualizando enquanto se filtra — é o que permite julgar o filtro pelo
 *    resultado em vez de pelo rótulo.
 *
 * O rodapé diz "aplica ao vivo" porque o filtro NÃO tem botão de confirmar: o
 * CTA só fecha o painel. Sem essa frase, um painel com um botão escuro no canto
 * lê como formulário que ainda não foi enviado.
 */

const RAIL = [
  { key: "periodo", icon: "📅", label: "Período" },
  { key: "tipo", icon: "⇅", label: "Tipo" },
  { key: "categoria", icon: "◍", label: "Categoria" },
  { key: "tag", icon: "🏷", label: "Tags" },
  { key: "forma", icon: "▤", label: "Pagamento" },
  { key: "cartao", icon: "▭", label: "Cartão" },
  { key: "valor", icon: "∿", label: "Valor" },
  { key: "recorrencia", icon: "↻", label: "Recorrência" },
  { key: "situacao", icon: "✓", label: "Situação" },
];

/** Quantos valores estão escolhidos em cada faceta — o badge do trilho. */
export function facetSelectionCounts(filter) {
  return {
    periodo: filter.period !== "mes" ? 1 : 0,
    tipo: filter.type !== "todos" ? 1 : 0,
    categoria: filter.cats.length,
    tag: filter.tags.length,
    forma: filter.method.length,
    cartao: filter.cardSel.length,
    valor: filter.valueMin || filter.valueMax ? 1 : 0,
    recorrencia: filter.rec !== "any" ? 1 : 0,
    situacao: filter.settlement !== "todas" ? 1 : 0,
  };
}

export function TransactionsFilterPanel({
  filter,
  facet,
  onFacetChange,
  categories = [],
  cards = [],
  allTags = [],
  allTagsLoading = false,
  allTagsError = false,
  facetCounts,
  activeFacets = [],
  onClearFacet,
  onClearAll,
  onApply,
  onClose,
  resultCount = 0,
  resultsLoading = false,
  compact = false,
  /** Largura real do painel — decide se as opções cabem em mais de uma coluna. */
  width = 396,
}) {
  const counts = facetSelectionCounts(filter);
  // Acima de ~560 px o pane comporta as opções em grade. Abaixo disso duas
  // colunas espremem os rótulos das categorias, que são longos ("Lazer &
  // Entretenimento"), e cada opção passa a truncar.
  const roomyPane = !compact && width >= 560;
  const activeTotal = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div
      role="region"
      aria-label="Filtros"
      style={{
        display: "grid",
        gridTemplateColumns: compact ? "minmax(0,1fr)" : "132px minmax(0,1fr)",
        gridTemplateRows: "minmax(0,1fr) auto",
        height: "100%",
        minHeight: 0,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {/* Trilho. No mobile ele deita e rola na horizontal — uma coluna de 132px
          numa tela de 360 comeria mais de um terço da largura. */}
      <div
        className={compact ? "fincla-scroll" : undefined}
        style={{
          background: "#FBFBFC",
          borderRight: compact ? "none" : `1px solid ${T.border}`,
          borderBottom: compact ? `1px solid ${T.border}` : "none",
          padding: 8,
          display: "flex",
          flexDirection: compact ? "row" : "column",
          gap: 2,
          overflowX: compact ? "auto" : "visible",
          overflowY: compact ? "visible" : "auto",
        }}
      >
        <RailButton
          icon="◉"
          label="Ativos"
          count={activeTotal}
          on={facet === "ativos"}
          compact={compact}
          onClick={() => onFacetChange("ativos")}
        />
        <span
          aria-hidden="true"
          style={
            compact
              ? { width: 1, background: T.border, margin: "4px 4px", flex: "none" }
              : { height: 1, background: T.border, margin: "5px 4px", flex: "none" }
          }
        />
        {RAIL.map((r) => (
          <RailButton
            key={r.key}
            icon={r.icon}
            label={r.label}
            count={counts[r.key]}
            on={facet === r.key}
            compact={compact}
            onClick={() => onFacetChange(r.key)}
          />
        ))}
      </div>

      {/* Painel da faceta escolhida. */}
      <div
        className="fincla-scroll"
        style={{
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 11,
          minWidth: 0,
          minHeight: 0,
          overflowY: "auto",
        }}
      >
        {facet === "ativos" ? (
          <ActiveFacetsPane
            facets={activeFacets}
            onClearFacet={onClearFacet}
            columns={roomyPane ? 2 : 1}
          />
        ) : (
          <FacetPanelContent
            facetKey={facet}
            period={filter.period}
            setPeriod={filter.setPeriod}
            customFrom={filter.customFrom}
            setCustomFrom={filter.setCustomFrom}
            customTo={filter.customTo}
            setCustomTo={filter.setCustomTo}
            type={filter.type}
            setType={filter.setType}
            method={filter.method}
            setMethod={filter.setMethod}
            cats={filter.cats}
            setCats={filter.setCats}
            categories={categories}
            tags={filter.tags}
            setTags={filter.setTags}
            allTags={allTags}
            allTagsLoading={allTagsLoading}
            allTagsError={allTagsError}
            cardSel={filter.cardSel}
            setCardSel={filter.setCardSel}
            cards={cards}
            valueMin={filter.valueMin}
            valueMax={filter.valueMax}
            setValueMin={filter.setValueMin}
            setValueMax={filter.setValueMax}
            rec={filter.rec}
            setRec={filter.setRec}
            settlement={filter.settlement}
            setSettlement={filter.setSettlement}
            counts={facetCounts}
            /* O × do cabeçalho fecha o PAINEL, não só o conteúdo da faceta —
               fechar só o conteúdo deixava o painel aberto e vazio. */
            onClose={onClose}
            compact={!roomyPane}
          />
        )}
      </div>

      <div
        style={{
          gridColumn: "1 / -1",
          borderTop: `1px solid ${T.border}`,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={onClearAll}
          disabled={activeTotal === 0}
          style={{
            ...G,
            background: "none",
            border: "none",
            padding: 0,
            fontSize: 11.5,
            fontWeight: 700,
            color: activeTotal === 0 ? T.inkGhost : T.red,
            cursor: activeTotal === 0 ? "default" : "pointer",
          }}
        >
          Limpar tudo
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Não existe "aplicar": o filtro já está valendo. Sem esta frase, o
              botão escuro ao lado lê como formulário pendente de envio. */}
          <span style={{ ...G, fontSize: 10.5, color: T.inkGhost }}>aplica ao vivo</span>
          <button
            type="button"
            onClick={onApply}
            style={{
              ...G,
              height: 34,
              padding: "0 16px",
              borderRadius: 9,
              border: "none",
              background: resultCount === 0 ? T.grayLight : T.ink,
              color: resultCount === 0 ? T.inkGhost : "#fff",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {resultsLoading ? "Atualizando…" : `Ver ${resultCount} ${resultCount === 1 ? "transação" : "transações"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function RailButton({ icon, label, count, on, onClick, compact }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        ...G,
        height: 31,
        borderRadius: 8,
        border: on ? `1px solid ${T.border}` : "1px solid transparent",
        background: on ? T.surface : "transparent",
        boxShadow: on ? "0 1px 2px rgba(0,0,0,.05)" : "none",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 9px",
        fontSize: 12,
        fontWeight: on ? 700 : 500,
        color: on ? T.ink : count > 0 ? T.blue : T.inkMid,
        textAlign: "left",
        width: compact ? "auto" : "100%",
        flex: compact ? "none" : undefined,
        whiteSpace: "nowrap",
        cursor: "pointer",
      }}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
      {count > 0 && (
        <span
          style={{
            ...G,
            marginLeft: compact ? 6 : "auto",
            minWidth: 16,
            height: 16,
            padding: "0 4px",
            borderRadius: 999,
            background: T.blue,
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "'Geist Mono', monospace",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/** A aba "Ativos": tudo o que está filtrando, num lugar só, com saída. */
function ActiveFacetsPane({ facets, onClearFacet, columns = 1 }) {
  if (facets.length === 0) {
    return (
      <div style={{ ...G, fontSize: 12, color: T.inkLight, padding: "6px 2px" }}>
        Nenhum filtro aplicado. Escolha uma faceta ao lado para começar.
      </div>
    );
  }
  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h4 style={{ ...G, fontSize: 14, fontWeight: 700, color: T.ink, margin: 0 }}>Filtros ativos</h4>
        <span style={{ ...G, fontSize: 10.5, color: T.inkGhost }}>
          {facets.length} {facets.length === 1 ? "filtro" : "filtros"}
        </span>
      </div>
      <div style={{ display: "grid", gap: 7,
        gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
        {facets.map((f) => (
          <div
            key={f.key}
            style={{
              minHeight: 36,
              border: `1px solid ${T.border}`,
              borderRadius: 9,
              background: T.surface,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 10px",
            }}
          >
            <span style={{ ...G, fontSize: 11, color: T.inkLight, flexShrink: 0 }}>{f.label}</span>
            <span
              style={{
                ...G,
                fontSize: 12,
                fontWeight: 600,
                color: T.ink,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {f.value}
            </span>
            <button
              type="button"
              onClick={() => onClearFacet?.(f.key)}
              aria-label={`Remover filtro ${f.label}`}
              style={{
                ...G,
                marginLeft: "auto",
                width: 22,
                height: 22,
                borderRadius: 6,
                border: "none",
                background: "none",
                color: T.inkLight,
                cursor: "pointer",
                flexShrink: 0,
                fontSize: 11,
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
