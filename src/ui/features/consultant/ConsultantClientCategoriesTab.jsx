import React from "react";

import { Card, ProgBar } from "../../components/primitives";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { getCategoryLucideIcon } from "../../data/categoryLucideIcons.js";
import { fmtBRL0 } from "./consultantFormat";
import { Icon, useIsNarrow } from "./consultantUi";
import { selectClientCategories } from "./consultantClientCategories";

function CatIcon({ iconKey, color }) {
  const Lucide = getCategoryLucideIcon(iconKey);
  if (Lucide) return <Lucide size={16} color={color} />;
  return <Icon name="wallet" size={16} color={color} />;
}

function IconBox({ row }) {
  return (
    <div style={{ width: 34, height: 34, borderRadius: 9, background: row.color + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <CatIcon iconKey={row.iconKey} color={row.color} />
    </div>
  );
}

// ── Linha de categoria (responsiva) ─────────────────────────────
function CategoryRow({ row, max, narrow }) {
  const barPct = max > 0 ? (row.value / max) * 100 : 0;
  const label = (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</div>
      <div style={{ ...G, fontSize: 10.5, color: T.inkLight }}>{row.pct}% do total</div>
    </div>
  );
  const value = (
    <div style={{ ...G, ...NUM, fontSize: 14, fontWeight: 800, color: T.ink, textAlign: "right", whiteSpace: "nowrap" }}>{fmtBRL0(row.value)}</div>
  );

  // Estreito: ícone | (label + pct·tx + barra) | valor.
  if (narrow) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "34px minmax(0,1fr) auto", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: `1px solid ${T.border}` }}>
        <IconBox row={row} />
        <div style={{ minWidth: 0 }}>
          <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</div>
          <div style={{ ...G, fontSize: 10.5, color: T.inkLight, marginBottom: 6 }}>{row.pct}% do total · {row.count} transaç{row.count === 1 ? "ão" : "ões"}</div>
          <ProgBar pct={barPct} color={row.color} h={7} />
        </div>
        {value}
      </div>
    );
  }

  // Largo (fiel): ícone+label | barra + "N transações" | valor. (Sem coluna de
  // tendência: MoM por categoria não vem em `by-category`.)
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(160px,1.4fr) 1.6fr 120px", alignItems: "center", gap: 14, padding: "13px 18px", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
        <IconBox row={row} />
        {label}
      </div>
      <div>
        <ProgBar pct={barPct} color={row.color} h={8} />
        <div style={{ ...G, fontSize: 10, color: T.inkGhost, marginTop: 5 }}>{row.count} transaç{row.count === 1 ? "ão" : "ões"}</div>
      </div>
      {value}
    </div>
  );
}

/**
 * Aba "Categorias" do relatório do cliente (RF.4), fiel a `CategoriasTab` da
 * referência: lista de gasto por categoria (ícone/label + % do total + barra
 * relativa + valor). Read-only. Consome `GET /analytics/by-category` (mesmo read
 * do donut da Visão geral) via `useClientCategories`. **Gaps honestos:** orçamento
 * (não vem no endpoint) → mostra `N transações`; tendência MoM (single-period) →
 * omitida. Recebe o estado do hook via prop.
 */
export function ConsultantClientCategoriesTab({ categories }) {
  const narrow = useIsNarrow(760);
  const { rows, max } = selectClientCategories(categories.categories || []);

  const body = () => {
    if (categories.loading && !categories.hasLoaded) {
      return <div style={{ ...G, padding: 40, textAlign: "center", color: T.inkLight, fontSize: 13 }}>Carregando categorias…</div>;
    }
    if (categories.error && rows.length === 0) {
      return <div style={{ ...G, padding: 40, textAlign: "center", color: T.inkLight, fontSize: 13 }}>Não foi possível carregar as categorias.</div>;
    }
    if (rows.length === 0) {
      return <div style={{ ...G, padding: 40, textAlign: "center", color: T.inkLight, fontSize: 13 }}>Nenhum gasto por categoria neste mês.</div>;
    }
    return rows.map((row) => <CategoryRow key={row.id} row={row} max={max} narrow={narrow} />);
  };

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink }}>Gasto por categoria · este mês</div>
        <span style={{ ...G, fontSize: 11, color: T.inkLight, whiteSpace: "nowrap" }}>{rows.length} categoria{rows.length === 1 ? "" : "s"} ativa{rows.length === 1 ? "" : "s"}</span>
      </div>
      {body()}
    </Card>
  );
}
