import { useEffect, useRef } from "react";

import { Card } from "../../components/primitives.jsx";
import { formatMoney } from "../../money/formatMoney.js";
import { plural } from "../../plural.js";
import { T } from "../../tokens.js";
import { G, NUM } from "../../typography.js";

/**
 * "Saídas por mês/semana": o gráfico do recorte filtrado. Com uma fatura mostra as
 * semanas dela; com várias (ou por período) mostra uma barra por fatura. Barra de
 * fatura é clicável e marca/desmarca a fatura no recorte de tempo; barra de semana recorta a lista nas datas dela.
 */
export function CardOutflowsChart({ outflows, currency, loading, error, message, onPickInvoice, onPickWeek, isMobile = false }) {
  const bars = outflows?.bars ?? [];
  const total = (bar) => bar.amount + (bar.projected?.amount ?? 0);
  const ceiling = Math.max(1, ...bars.map(total));
  const weekly = outflows?.kind === "weeks";
  const groupRef = useRef(null);
  const selectedKeys = bars.filter((bar) => bar.selected).map((bar) => bar.key).join("|");
  const ownClick = useRef(false);
  // Com rolagem, a seleção não pode ficar escondida: só rola quando nenhuma barra marcada está à vista.
  // Clique no próprio gráfico não move a rolagem (o usuário já está olhando para o que clicou).
  useEffect(() => {
    if (ownClick.current) { ownClick.current = false; return; }
    const group = groupRef.current;
    const marked = group ? [...group.querySelectorAll('[aria-pressed="true"]')] : [];
    if (!group || marked.length === 0) return;
    const view = group.getBoundingClientRect();
    const visible = marked.some((node) => { const box = node.getBoundingClientRect(); return box.left >= view.left && box.right <= view.right; });
    if (!visible) group.scrollLeft += marked[0].getBoundingClientRect().left - view.left - 24;
  }, [selectedKeys, bars.length, loading]);
  return <Card as="section" aria-label="Saídas por mês e semana" style={{ padding: 18, minWidth: 0 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
      <h2 style={{ ...G, fontSize: 15, margin: 0 }}>{weekly ? "Saídas por semana" : "Saídas por fatura"}</h2>
      <span style={{ ...G, fontSize: 11, color: T.inkMid }}>{weekly ? "Clique numa semana para filtrar a lista" : "Clique numa barra para marcar ou desmarcar a fatura"}</span>
    </div>
    {message && <p role="status" style={{ ...G, fontSize: 12, color: T.inkMid }}>{message}</p>}
    {!message && error && <p role="alert" style={{ ...G, fontSize: 12, color: T.inkMid }}>Não foi possível carregar as saídas.</p>}
    {!message && !error && loading && <p role="status" style={{ ...G, fontSize: 12, color: T.inkMid }}>Carregando saídas…</p>}
    {!message && !error && !loading && bars.length === 0 && <p style={{ ...G, fontSize: 12, color: T.inkMid }}>Sem saídas neste recorte.</p>}
    {!message && !error && !loading && bars.length > 0 && <div ref={groupRef} role="group" aria-label={weekly ? "Saídas por semana da fatura" : "Saídas por fatura"} style={{ height: isMobile ? 160 : 180, display: "flex", alignItems: "end", gap: isMobile ? 8 : 14, marginTop: 12, overflowX: "auto", padding: "4px 2px 6px" }}>
      {bars.map((bar) => {
        const display = bar.amount > 0 ? formatMoney(bar.amount, currency) ?? "—" : "—";
        const estimate = bar.projected ? formatMoney(bar.projected.amount, currency) : null;
        const estimateNote = estimate ? `~${estimate} estimados em ${plural(bar.projected.count, "recorrência prevista", "recorrências previstas")}${bar.projected.approximate ? " (algum valor é aproximado)" : ""}` : null;
        const description = `${bar.title}: ${bar.amount > 0 ? `${display} confirmados` : "nada confirmado ainda"}${estimateNote ? ` + ${estimateNote}` : ""}`;
        const confirmedHeight = bar.amount / ceiling * 100;
        const projectedHeight = estimate ? (bar.projected?.amount ?? 0) / ceiling * 100 : 0;
        const body = <>
          <span style={{ ...G, ...NUM, fontSize: 11, color: T.inkMid, whiteSpace: "nowrap" }}>{display}</span>
          {estimate && <span data-testid="outflow-estimate" style={{ ...G, ...NUM, fontSize: 11, color: T.blue, fontStyle: "italic", whiteSpace: "nowrap" }}>+ ~{estimate}</span>}
          <span aria-hidden="true" style={{ width: "100%", maxWidth: 72, display: "flex", flexDirection: "column", justifyContent: "end" }}>
            {projectedHeight > 0 && <span style={{ display: "block", height: `${Math.max(2, projectedHeight)}px`, borderRadius: "6px 6px 0 0", border: `1px dashed ${bar.selected ? T.blue : T.border}`, borderBottom: 0, background: `repeating-linear-gradient(135deg, ${bar.selected ? `${T.blue}55` : T.border} 0 3px, transparent 3px 7px)` }} />}
            {(bar.amount > 0 || projectedHeight === 0) && <span style={{ display: "block", height: `${Math.max(2, confirmedHeight)}px`, borderRadius: projectedHeight > 0 ? 0 : "6px 6px 0 0", background: bar.selected ? T.blue : T.grayLight, border: bar.selected ? 0 : `1px solid ${T.border}` }} />}
          </span>
          <span style={{ ...G, ...NUM, fontSize: 11, color: bar.selected ? T.ink : T.inkMid, fontWeight: bar.selected ? 700 : 400 }}>{bar.label}</span>
        </>;
        // Largura mínima por fatura: com muitas barras o gráfico rola em vez de sobrepor valores e meses (semanas são poucas e cabem).
        const cell = { flex: weekly ? 1 : "1 0 84px", minWidth: weekly ? 0 : undefined, height: "100%", display: "flex", flexDirection: "column", justifyContent: "end", alignItems: "center", gap: 4 };
        return bar.clickable
          ? <button key={bar.key} type="button" aria-pressed={bar.selected} aria-label={description} title={description} onClick={() => { ownClick.current = true; return weekly ? onPickWeek?.(bar) : onPickInvoice?.(bar.key); }} style={{ ...cell, border: 0, background: "none", padding: 0, cursor: "pointer" }}>{body}</button>
          : <div key={bar.key} role="img" aria-label={description} title={description} style={cell}>{body}</div>;
      })}
    </div>}
    {!message && !error && !loading && outflows?.hasProjection && <p data-testid="outflow-projection-note" style={{ ...G, fontSize: 11, color: T.inkMid, margin: "10px 0 0", display: "flex", gap: 6, alignItems: "baseline" }}>
      <span aria-hidden="true" style={{ flex: "none", width: 12, height: 8, border: `1px dashed ${T.blue}`, background: `repeating-linear-gradient(135deg, ${T.blue}55 0 3px, transparent 3px 6px)` }} />
      <span><strong>Hachurado = estimativa</strong>, não valor confirmado: recorrências do cartão que ainda não foram cobradas. Podem mudar (pausa, reajuste, cobrança fora do dia){bars.some((bar) => bar.projected?.approximate) ? " e algumas têm valor aproximado." : "."}</span>
    </p>}
  </Card>;
}
