import React, { useEffect, useRef, useState } from "react";
import { T } from "../../../../tokens";
import { G } from "../../../../typography";
import { Icon } from "../shared/Icon.jsx";
import { SORT_FIELDS } from "./sortModel.js";
import { SortMenu } from "./SortMenu.jsx";
import { SortTooltip } from "./SortTooltip.jsx";

const FIELD_SHORT = {
  date: "Data",
  val: "Valor",
  tipo: "Tipo",
  desc: "Descrição",
  cat: "Categoria",
};

function ruleLabel(rule) {
  const dir = rule.dir === "asc" ? "↑" : "↓";
  return `${FIELD_SHORT[rule.field] || rule.field} ${dir}`;
}

function summary(sort) {
  if (sort.length === 0) return "Sem ordenação";
  if (sort.length === 1) return ruleLabel(sort[0]);
  if (sort.length === 2) return `${ruleLabel(sort[0])} · ${ruleLabel(sort[1])}`;
  return `${ruleLabel(sort[0])} · +${sort.length - 1}`;
}

/**
 * Botão "Ordenar por X" da Search bar. Abre `SortMenu` no click e mostra
 * `SortTooltip` no hover (somente com menu fechado).
 */
export function SortButton({ sort, setSort, compact = false, soIcone = false }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "relative",
        display: compact ? "flex" : "inline-flex",
        alignItems: "center",
        gap: 6,
        width: compact ? "100%" : undefined,
        flexWrap: compact ? "wrap" : undefined,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* O rótulo "ORDENAR POR" só existe no modo compacto. Na barra de
          comando do desktop o chip já se lê como "⇅ Data ↓" — o prefixo
          gastava largura que a busca e os chips disputam, para dizer o que o
          próprio ícone diz. */}
      {compact && (
        <span
          style={{
            ...G,
            fontSize: 11,
            fontWeight: 700,
            color: T.inkLight,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            whiteSpace: "nowrap",
          }}
        >
          Ordenar por
        </span>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Ordenar transações: ${summary(sort)}`}
        title={soIcone ? `Ordenar: ${summary(sort)}` : undefined}
        style={{
          ...G,
          display: compact ? "flex" : "inline-flex",
          alignItems: "center",
          justifyContent: compact ? "space-between" : undefined,
          gap: 5,
          /* No modo ícone a caixa é FIXA em 32×32, igual aos vizinhos. Com
             `padding: 5px 10px` e sem altura, o botão nascia da altura do
             ícone — ~23 px contra os 32 dos outros —, e uma fileira de alvos
             desalinhados lê como defeito, não como hierarquia. */
          ...(soIcone
            ? { width: 32, height: 32, padding: 0, justifyContent: "center", gap: 2 }
            : null),
          padding: compact ? "10px 14px" : soIcone ? 0 : "5px 10px",
          borderRadius: compact ? 10 : 7,
          border: `1px solid ${open ? T.ink : T.border}`,
          background: open ? T.bg : T.surface,
          fontSize: compact ? 13 : 11.5,
          fontWeight: 600,
          color: T.inkMid,
          cursor: "pointer",
          flex: compact ? 1 : undefined,
        }}
      >
        {/* `flexShrink: 0`: no modo ícone a caixa é fixa em 32 e o badge de
            múltiplos critérios tem `minWidth`, então quem cedia era o ÍCONE —
            renderizava ~9 px e lia como um glifo espremido ao lado dos
            vizinhos em tamanho cheio. O ícone é a identidade do controle; se
            algo tem de apertar, é o resto. */}
        <span style={{ display: "inline-flex", flexShrink: 0 }}>
          <Icon name="arrow-up-down" size={11} />
        </span>
        {/* Abaixo de 1280 o RÓTULO sai e fica o ícone. O `aria-label` já carrega
            o critério inteiro ("Ordenar transações: data, mais recente
            primeiro"), então some o texto, não a informação — e é ele que o
            `title` repete para quem enxerga. */}
        {!soIcone && <span>{summary(sort)}</span>}
        {sort.length > 1 && (
          <span
            style={{
              ...G,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 99,
              background: T.ink,
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
            }}
            aria-label={`${sort.length} critérios`}
          >
            {sort.length}
          </span>
        )}
      </button>
      {open && (
        <SortMenu sort={sort} setSort={setSort} onClose={() => setOpen(false)} compact={compact} />
      )}
      {hover && !open && sort.length > 0 && !compact && <SortTooltip rules={sort} />}
    </div>
  );
}

// Expor para testes
SortButton._summary = summary;
SortButton._fields = SORT_FIELDS;
