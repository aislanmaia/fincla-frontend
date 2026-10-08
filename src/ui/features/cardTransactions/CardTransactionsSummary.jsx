import { useMemo } from "react";
import { Card } from "../../components/primitives.jsx";
import { pickCategoryTagFromApiTransaction } from "../../data/transactionsAdapter.js";
import { formatMoneyAbs } from "../../money/formatMoney.js";
import { T } from "../../tokens.js";
import { G, NUM } from "../../typography.js";

const COLORS = [T.purple, T.blue, T.amber, T.green, T.red];

/** Honest partial summary: the API has no card-scoped aggregate yet (#327). */
export function CardTransactionsSummary({ rows, total, currency, categories, selectedCategories, onCategory }) {
  const summary = useMemo(() => {
    const byCategory = new Map();
    const eligible = rows.filter((row) => row.type === "expense" && Number.isFinite(Number(row.value)));
    if (eligible.length === 0) return { available: true, categories: [], amount: null, count: 0, code: currency };
    const codes = new Set(eligible.map((row) => row.value_currency || currency).filter(Boolean));
    if (codes.size !== 1 || eligible.some((row) => !row.value_currency && !currency)) return { available: false, categories: [], amount: null, count: eligible.length };
    for (const row of eligible) {
      const tag = pickCategoryTagFromApiTransaction(row);
      const name = tag?.label || tag?.name || row.category || "Sem categoria";
      byCategory.set(name, (byCategory.get(name) || 0) + Math.abs(Number(row.value)));
    }
    const parts = [...byCategory].sort((a, b) => b[1] - a[1]);
    return { available: true, categories: parts, amount: parts.reduce((sum, [, value]) => sum + value, 0), count: eligible.length, code: [...codes][0] };
  }, [rows, currency]);
  const chart = useMemo(() => {
    if (!summary.available || !summary.amount) return T.grayLight;
    let used = 0;
    return `conic-gradient(${summary.categories.map(([, value], index) => {
      const start = used;
      used += value / summary.amount * 100;
      return `${COLORS[index % COLORS.length]} ${start}% ${used}%`;
    }).join(",")})`;
  }, [summary]);
  const countLabel = total == null ? `${rows.length} itens carregados` : `${rows.length} de ${total} itens carregados`;
  return <Card as="section" aria-label="Resumo dos lançamentos carregados" style={{ padding: 18, minWidth: 0 }}>
    <h2 style={{ ...G, fontSize: 15, margin: "0 0 4px" }}>Resumo dos itens carregados</h2>
    <p style={{ ...G, fontSize: 11, color: T.inkMid, margin: "0 0 14px" }}>{countLabel} · apenas compras; estornos fora deste gráfico</p>
    {summary.available && summary.count === 0 && <p style={{ ...G, fontSize: 12, color: T.inkMid }}>Nenhuma compra carregada neste recorte.</p>}
    {summary.available && summary.count > 0 && <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <div role="img" aria-label="Distribuição por categoria das compras carregadas" style={{ width: 112, height: 112, borderRadius: "50%", background: chart, position: "relative", flexShrink: 0 }}><div style={{ position: "absolute", inset: 23, borderRadius: "50%", background: T.surface }} /></div>
      <div style={{ minWidth: 0, flex: 1 }}><strong style={{ ...G, ...NUM, fontSize: 19 }}>{summary.code ? formatMoneyAbs(summary.amount, summary.code) : "—"}</strong><div style={{ ...G, ...NUM, color: T.inkMid, fontSize: 11 }}>{summary.count} compras carregadas</div>
        <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 3 }}>{summary.categories.slice(0, 5).map(([name, amount], index) => {
          const match = categories.find((category) => category.label === name);
          const on = match && selectedCategories.includes(match.id);
          return <button key={name} type="button" disabled={!match} onClick={() => onCategory(on ? selectedCategories.filter((id) => id !== match.id) : [...selectedCategories, match.id])} style={{ ...G, border: 0, background: on ? T.blueLight : "none", color: T.inkMid, textAlign: "left", padding: "2px 4px", display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, cursor: match ? "pointer" : "default" }}><span><span style={{ color: COLORS[index % COLORS.length] }}>●</span> {name}</span><span style={NUM}>{summary.amount ? Math.round(amount / summary.amount * 100) : 0}%</span></button>;
        })}</div>
      </div>
    </div>}
    {!summary.available && <p style={{ ...G, fontSize: 12, color: T.inkMid }}>Não é possível somar compras de moedas diferentes ou sem moeda conhecida.</p>}
  </Card>;
}
