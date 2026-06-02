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
export function SortButton({ sort, setSort }) {
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
      style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6 }}
      onClick={(e) => e.stopPropagation()}
    >
      <span
        style={{
          ...G,
          fontSize: 10,
          fontWeight: 700,
          color: T.inkLight,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          whiteSpace: "nowrap",
        }}
      >
        Ordenar por
      </span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Ordenar transações: ${summary(sort)}`}
        style={{
          ...G,
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "5px 10px",
          borderRadius: 7,
          border: `1px solid ${open ? T.ink : T.border}`,
          background: open ? T.bg : T.surface,
          fontSize: 11.5,
          fontWeight: 600,
          color: T.inkMid,
          cursor: "pointer",
        }}
      >
        <Icon name="arrow-up-down" size={11} />
        <span>{summary(sort)}</span>
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
              fontSize: 9.5,
              fontWeight: 700,
            }}
            aria-label={`${sort.length} critérios`}
          >
            {sort.length}
          </span>
        )}
      </button>
      {open && <SortMenu sort={sort} setSort={setSort} onClose={() => setOpen(false)} />}
      {hover && !open && sort.length > 0 && <SortTooltip rules={sort} />}
    </div>
  );
}

// Expor para testes
SortButton._summary = summary;
SortButton._fields = SORT_FIELDS;
