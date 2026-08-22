import React, { useEffect, useRef, useState } from "react";
import { T } from "../../../tokens";
import { G } from "../../../typography";
import { Icon } from "./shared/Icon.jsx";

/**
 * Os filtros ATIVOS, em linha, logo acima da lista.
 *
 * Sem isso, o que está filtrando mora dentro dos cards da FacetBar — que no
 * desktop compacto e no mobile ficam atrás de um botão. Era possível olhar uma
 * lista filtrada sem nenhum sinal na tela de por quê ela está curta.
 *
 * Cada chip faz duas coisas distintas, e o alvo de clique separa as duas:
 * o corpo ABRE o painel daquela facet (para ajustar), o "×" REMOVE só aquele
 * filtro. Um chip que só removesse obrigaria a reabrir o painel pelo caminho
 * longo para trocar um valor.
 *
 * Overflow: a partir de `maxVisible` os excedentes viram um "+N" que abre a
 * lista inteira. Uma linha que quebra em três empurraria a lista para baixo —
 * exatamente o problema que esta tela existe para resolver.
 */
export function TransactionsFilterChips({
  facets = [],
  searchActive = false,
  searchLabel = "",
  onOpenFacet,
  onClearFacet,
  onClearAll,
  maxVisible = 4,
  compact = false,
}) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef(null);

  const chips = [
    ...(searchActive
      ? [{ key: "busca", label: "Busca", value: `"${searchLabel}"`, icon: "search" }]
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

  // Some junto com o último filtro: uma faixa vazia ocupando altura é o oposto
  // do que esta tela precisa.
  useEffect(() => {
    if (chips.length <= maxVisible) setOverflowOpen(false);
  }, [chips.length, maxVisible]);

  if (chips.length === 0) return null;

  const shown = chips.slice(0, maxVisible);
  const hidden = chips.slice(maxVisible);

  return (
    <div
      role="group"
      aria-label="Filtros aplicados"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "nowrap",
        minWidth: 0,
        overflow: "visible",
      }}
    >
      {shown.map((f) => (
        <Chip
          key={f.key}
          facet={f}
          compact={compact}
          onOpen={onOpenFacet}
          onClear={onClearFacet}
        />
      ))}

      {hidden.length > 0 && (
        <div ref={overflowRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setOverflowOpen((v) => !v)}
            aria-expanded={overflowOpen}
            aria-label={`Mais ${hidden.length} ${hidden.length === 1 ? "filtro" : "filtros"}`}
            style={{
              ...G,
              padding: "4px 9px",
              borderRadius: 99,
              border: `1px dashed ${T.border}`,
              background: T.surface,
              color: T.inkMid,
              fontSize: 11.5,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            +{hidden.length}
          </button>
          {overflowOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
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
              className="fincla-scroll"
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
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onClearAll}
        style={{
          ...G,
          marginLeft: 2,
          padding: "4px 8px",
          borderRadius: 8,
          border: "none",
          background: "none",
          color: T.inkLight,
          fontSize: 11.5,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        Limpar tudo
      </button>
    </div>
  );
}

function Chip({ facet, onOpen, onClear, compact, block = false }) {
  const color = facet.color || T.ink;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        borderRadius: 99,
        border: `1px solid ${color}33`,
        background: `${color}0f`,
        flexShrink: 0,
        maxWidth: block ? "none" : compact ? 150 : 230,
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
          gap: 5,
          minWidth: 0,
          flex: block ? 1 : undefined,
          padding: "4px 4px 4px 9px",
          border: "none",
          background: "none",
          cursor: "pointer",
          fontSize: 11.5,
          color: T.ink,
          textAlign: "left",
        }}
      >
        {facet.icon && <Icon name={facet.icon} size={11} color={color} />}
        <span style={{ color: T.inkMid, fontWeight: 600, flexShrink: 0 }}>{facet.label}</span>
        <span
          style={{
            fontWeight: 700,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {facet.value}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onClear?.(facet.key)}
        aria-label={`Remover filtro ${facet.label}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          // 22px é o alvo mínimo que ainda cabe num chip de 24px de altura;
          // menor que isso o "×" vira uma armadilha de precisão no toque.
          width: 22,
          height: 22,
          marginRight: 3,
          borderRadius: "50%",
          border: "none",
          background: "none",
          color: T.inkLight,
          cursor: "pointer",
          flexShrink: 0,
          padding: 0,
        }}
      >
        <Icon name="x" size={11} color={T.inkLight} />
      </button>
    </span>
  );
}
