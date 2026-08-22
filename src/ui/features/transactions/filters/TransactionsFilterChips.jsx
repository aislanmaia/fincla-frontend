import React, { useEffect, useRef, useState } from "react";
import { T } from "../../../tokens";
import { G } from "../../../typography";

/**
 * Os filtros ATIVOS, dentro da barra de comando.
 *
 * Substituem a faixa permanente de nove cards de faceta: aquela linha custava
 * 57 px de altura o tempo todo para mostrar sobretudo "Todas / Todos /
 * Qualquer" — nove rótulos que só informam quando algum sai do padrão, que é
 * exatamente o que um chip diz por si.
 *
 * Cada chip faz duas coisas distintas, e o alvo de clique separa as duas: o
 * corpo ABRE o painel daquela facet (para ajustar), o "✕" REMOVE só aquele
 * filtro. Um chip que só removesse obrigaria a reabrir o painel pelo caminho
 * longo para trocar um valor.
 *
 * Overflow: a partir de `maxVisible` os excedentes viram um chip de contagem
 * que abre a lista inteira. Uma linha que quebra em três empurraria a lista
 * para baixo — o problema que esta tela existe para resolver.
 */

const CHIP_H = 28;

/** Pílula base da barra. `tone`: 'on' (filtro ativo) | 'ghost' | 'plain'. */
function chipStyle(tone) {
  const base = {
    ...G,
    height: CHIP_H,
    padding: "0 10px",
    borderRadius: 999,
    fontSize: 11.5,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
    cursor: "pointer",
    flexShrink: 0,
  };
  if (tone === "on") {
    return { ...base, background: T.blueLight, border: "1px solid #BFD3FA", color: T.blue };
  }
  if (tone === "ghost") {
    return { ...base, background: T.surface, border: `1px dashed ${T.border}`, color: T.inkGhost };
  }
  return { ...base, background: T.surface, border: `1px solid ${T.border}`, color: T.inkMid };
}

/** Contador dentro de um chip (o "+3" do overflow). */
function CountBadge({ n }) {
  return (
    <span
      style={{
        ...G,
        background: T.blue,
        color: "#fff",
        borderRadius: 999,
        padding: "0 5px",
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.5,
      }}
    >
      +{n}
    </span>
  );
}

export function TransactionsFilterChips({
  facets = [],
  searchActive = false,
  searchLabel = "",
  onOpenFacet,
  onClearFacet,
  onClearAll,
  maxVisible = 3,
  compact = false,
  /** Abre/fecha o painel de facetas — o chip "＋ Filtros" da proposta. */
  filtersOpen = false,
  onToggleFilters,
  /** Recolhe TODOS os chips no contador do "＋ Filtros" (telas estreitas). */
  collapsed = false,
}) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef(null);

  const chips = [
    ...(searchActive
      ? [{ key: "busca", label: "Busca", value: `"${searchLabel}"` }]
      : []),
    ...facets.filter((f) => f.active),
  ];

  useEffect(() => {
    if (!overflowOpen) return undefined;
    const onDown = (e) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target)) setOverflowOpen(false);
    };
    const onEsc = (e) => {
      if (e.key === "Escape") setOverflowOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [overflowOpen]);

  useEffect(() => {
    if (chips.length <= maxVisible) setOverflowOpen(false);
  }, [chips.length, maxVisible]);

  // Abaixo de ~1200 px os chips não cabem sem espremer a busca: recolhem para o
  // contador do próprio "＋ Filtros", como já acontece no mobile.
  const shown = collapsed ? [] : chips.slice(0, maxVisible);
  const hidden = collapsed ? chips : chips.slice(maxVisible);

  const filtrosChip = (
    <button
      type="button"
      onClick={onToggleFilters}
      aria-expanded={filtersOpen}
      aria-label={filtersOpen ? "Ocultar filtros" : "Abrir filtros"}
      style={{
        ...chipStyle(filtersOpen ? "on" : "ghost"),
        ...(filtersOpen ? {} : { borderStyle: "dashed" }),
      }}
    >
      ＋ Filtros
      {collapsed && chips.length > 0 && <CountBadge n={chips.length} />}
    </button>
  );

  if (chips.length === 0) return filtrosChip;

  return (
    <div
      role="group"
      aria-label="Filtros aplicados"
      style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}
    >
      {shown.map((f) => (
        <Chip key={f.key} facet={f} compact={compact} onOpen={onOpenFacet} onClear={onClearFacet} />
      ))}

      {!collapsed && hidden.length > 0 && (
        <div ref={overflowRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setOverflowOpen((v) => !v)}
            aria-expanded={overflowOpen}
            aria-label={`Mais ${hidden.length} ${hidden.length === 1 ? "filtro" : "filtros"}`}
            style={chipStyle("on")}
          >
            <CountBadge n={hidden.length} />
          </button>
          {overflowOpen && (
            <div
              className="fincla-scroll"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                zIndex: 40,
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                boxShadow: "0 12px 32px rgba(15,25,40,.14)",
                padding: 8,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                minWidth: 200,
                maxHeight: "min(50dvh, 320px)",
                overflowY: "auto",
              }}
            >
              {hidden.map((f) => (
                <Chip
                  key={f.key}
                  facet={f}
                  compact={compact}
                  block
                  onOpen={(key) => {
                    setOverflowOpen(false);
                    onOpenFacet?.(key);
                  }}
                  onClear={onClearFacet}
                />
              ))}
              <button
                type="button"
                onClick={() => {
                  setOverflowOpen(false);
                  onClearAll?.();
                }}
                style={{
                  ...G,
                  marginTop: 2,
                  padding: "5px 8px",
                  borderRadius: 8,
                  border: "none",
                  background: "none",
                  color: T.inkLight,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                Limpar tudo
              </button>
            </div>
          )}
        </div>
      )}

      {filtrosChip}
    </div>
  );
}

function Chip({ facet, onOpen, onClear, compact, block = false }) {
  return (
    <span
      style={{
        ...chipStyle("on"),
        paddingRight: 4,
        cursor: "default",
        maxWidth: block ? "none" : compact ? 140 : 200,
        width: block ? "100%" : undefined,
      }}
    >
      <button
        type="button"
        onClick={() => onOpen?.(facet.key)}
        // Nome DISTINTO do card da FacetBar, que se chama "Tipo: Despesa".
        // Dois controles com o mesmo nome fazendo coisas diferentes são
        // indistinguíveis para quem navega por leitor de tela.
        aria-label={`Filtro aplicado — ${facet.label}, ${facet.value}. Ajustar.`}
        style={{
          ...G,
          display: "inline-flex",
          alignItems: "center",
          minWidth: 0,
          flex: block ? 1 : undefined,
          border: "none",
          background: "none",
          padding: 0,
          cursor: "pointer",
          fontSize: 11.5,
          fontWeight: 600,
          color: "inherit",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {facet.value}
      </button>
      <button
        type="button"
        onClick={() => onClear?.(facet.key)}
        aria-label={`Remover filtro ${facet.label}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          // 20px é o alvo mínimo que ainda cabe num chip de 28px de altura;
          // menor que isso o "✕" vira uma armadilha de precisão no toque.
          width: 20,
          height: 20,
          borderRadius: "50%",
          border: "none",
          background: "none",
          color: "inherit",
          opacity: 0.6,
          cursor: "pointer",
          flexShrink: 0,
          padding: 0,
          fontSize: 10,
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </span>
  );
}
