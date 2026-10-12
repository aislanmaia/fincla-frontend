import { Card } from "../../components/primitives.jsx";
import { formatMoney } from "../../money/formatMoney.js";
import { T } from "../../tokens.js";
import { G, NUM } from "../../typography.js";

/**
 * "Saídas por mês/semana": o gráfico do recorte filtrado. Com uma fatura mostra as
 * semanas dela; com várias (ou por período) mostra uma barra por fatura. Barra de
 * fatura é clicável e marca/desmarca a fatura no recorte de tempo.
 */
export function CardOutflowsChart({ outflows, currency, loading, error, message, onPickInvoice, isMobile = false }) {
  const bars = outflows?.bars ?? [];
  const ceiling = Math.max(1, ...bars.map((bar) => bar.amount));
  const weekly = outflows?.kind === "weeks";
  return <Card as="section" aria-label="Saídas por mês e semana" style={{ padding: 18, minWidth: 0 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
      <h2 style={{ ...G, fontSize: 15, margin: 0 }}>{weekly ? "Saídas por semana" : "Saídas por fatura"}</h2>
      <span style={{ ...G, fontSize: 11, color: T.inkMid }}>{weekly ? "Semanas da fatura marcada" : "Clique numa barra para marcar ou desmarcar a fatura"}</span>
    </div>
    {message && <p role="status" style={{ ...G, fontSize: 12, color: T.inkMid }}>{message}</p>}
    {!message && error && <p role="alert" style={{ ...G, fontSize: 12, color: T.inkMid }}>Não foi possível carregar as saídas.</p>}
    {!message && !error && loading && <p role="status" style={{ ...G, fontSize: 12, color: T.inkMid }}>Carregando saídas…</p>}
    {!message && !error && !loading && bars.length === 0 && <p style={{ ...G, fontSize: 12, color: T.inkMid }}>Sem saídas neste recorte.</p>}
    {!message && !error && !loading && bars.length > 0 && <div role="group" aria-label={weekly ? "Saídas por semana da fatura" : "Saídas por fatura"} style={{ height: isMobile ? 150 : 164, display: "flex", alignItems: "end", gap: isMobile ? 8 : 14, marginTop: 12 }}>
      {bars.map((bar) => {
        const display = formatMoney(bar.amount, currency) ?? "—";
        const body = <>
          <span style={{ ...G, ...NUM, fontSize: 10, color: T.inkMid, whiteSpace: "nowrap" }}>{display}</span>
          <span aria-hidden="true" style={{ width: "100%", maxWidth: 72, height: `${Math.max(3, bar.amount / ceiling * 100)}px`, borderRadius: "6px 6px 0 0", background: bar.selected ? T.blue : T.grayLight, border: bar.selected ? 0 : `1px solid ${T.border}` }} />
          <span style={{ ...G, ...NUM, fontSize: 10, color: bar.selected ? T.ink : T.inkMid, fontWeight: bar.selected ? 700 : 400 }}>{bar.label}</span>
        </>;
        const cell = { flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", justifyContent: "end", alignItems: "center", gap: 5 };
        return bar.clickable
          ? <button key={bar.key} type="button" aria-pressed={bar.selected} aria-label={`${bar.title}: ${display}`} title={bar.title} onClick={() => onPickInvoice?.(bar.key)} style={{ ...cell, border: 0, background: "none", padding: 0, cursor: "pointer" }}>{body}</button>
          : <div key={bar.key} title={`${bar.title}: ${display}`} style={cell}>{body}</div>;
      })}
    </div>}
  </Card>;
}
