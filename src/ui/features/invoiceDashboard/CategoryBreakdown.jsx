import { useState } from "react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { formatMoney } from "../../money/formatMoney.js";
import { HubDialog } from "../cardHub/HubDialog.jsx";
import { buildCategoryRows, buildDonutArcs, groupCategoryRows } from "./invoiceDashboardModel.js";
import { plural } from "./invoiceFormat.js";

const RADIUS = 56;
const CIRC = 2 * Math.PI * RADIUS;

function Donut({ rows, size, centerLabel }) {
  const arcs = buildDonutArcs(rows);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label="Gasto por categoria">
        <g transform="rotate(-90 70 70)">
          <circle cx="70" cy="70" r={RADIUS} fill="none" stroke={T.grayLight} strokeWidth="18" />
          {arcs.map((arc) => (
            <circle key={arc.key} cx="70" cy="70" r={RADIUS} fill="none" stroke={arc.color} strokeWidth="18"
              strokeDasharray={`${arc.fraction * CIRC} ${CIRC}`} strokeDashoffset={-arc.offset * CIRC} />
          ))}
        </g>
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 22, textAlign: "center" }}>
        <span style={{ ...G, ...NUM, fontSize: size < 130 ? 12 : 14, fontWeight: 800, color: T.ink, lineHeight: 1.1 }}>{centerLabel}</span>
      </div>
    </div>
  );
}

function Legend({ rows, currency, detailed = false }) {
  return (
    <div data-testid="category-list" style={{ display: "flex", flexDirection: "column", gap: detailed ? 12 : 7, flex: 1, minWidth: 0 }}>
      {rows.map((row) => (
        <div key={row.key} data-testid="category-row" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: row.color, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...G, fontSize: detailed ? 13 : 12, fontWeight: detailed ? 600 : 400, color: T.inkMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</div>
            {detailed && row.count !== null && (
              <div style={{ ...G, fontSize: 11, color: T.inkLight }}>{plural(row.count, "lançamento", "lançamentos")}</div>
            )}
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            {detailed && <div style={{ ...G, ...NUM, fontSize: 13, fontWeight: 700, color: T.ink }}>{formatMoney(row.total, currency) ?? "—"}</div>}
            <div style={{ ...G, ...NUM, fontSize: detailed ? 11 : 12, fontWeight: detailed ? 400 : 700, color: detailed ? T.inkLight : T.ink }}>
              {row.percentage === null ? "—" : `${Math.round(row.percentage)}%`}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** "Por categoria": donut + lista; no mobile o card abre um bottom sheet com o detalhe completo. */
export function CategoryBreakdown({ breakdown, total, currency, isMobile }) {
  const [open, setOpen] = useState(false);
  const rows = buildCategoryRows(breakdown);
  const { visible } = groupCategoryRows(rows, 4);
  const hasMore = visible.some((r) => r.isOthers);
  const centerLabel = formatMoney(total, currency) ?? "—";

  const body = rows.length === 0 ? (
    <div style={{ ...G, fontSize: 12, color: T.inkMid }}>Sem categorias nesta fatura.</div>
  ) : (
    <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 16 : 20 }}>
      <Donut rows={rows} size={isMobile ? 120 : 140} centerLabel={centerLabel} />
      <Legend rows={visible} currency={currency} />
    </div>
  );

  return (
    <>
      <section data-testid="category-breakdown" aria-label="Por categoria"
        style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.sm, padding: isMobile ? 16 : 20, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <h3 style={{ ...G, margin: 0, fontSize: 14, fontWeight: 800, color: T.ink }}>Por categoria</h3>
          {rows.length > 0 && hasMore && (
            <button type="button" onClick={() => setOpen(true)} data-testid="category-open-sheet"
              style={{ ...G, background: "none", border: "none", padding: 0, fontSize: 11, fontWeight: 700, color: T.blue, cursor: "pointer" }}>
              ver tudo →
            </button>
          )}
          {rows.length > 0 && !hasMore && isMobile && (
            <button type="button" onClick={() => setOpen(true)} data-testid="category-open-sheet"
              style={{ ...G, background: "none", border: "none", padding: 0, fontSize: 11, fontWeight: 700, color: T.blue, cursor: "pointer" }}>
              detalhes →
            </button>
          )}
        </div>
        {body}
      </section>
      {open && (
        <HubDialog title="Por categoria" isMobile={isMobile} onClose={() => setOpen(false)}>
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Donut rows={rows} size={150} centerLabel={centerLabel} />
            </div>
            <Legend rows={rows} currency={currency} detailed />
          </div>
        </HubDialog>
      )}
    </>
  );
}
