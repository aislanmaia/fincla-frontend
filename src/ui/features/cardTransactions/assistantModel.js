import { pickCategoryTagFromApiTransaction } from "../../data/transactionsAdapter.js";

const categoryOf = (row) => { const tag = pickCategoryTagFromApiTransaction(row); return tag?.label || tag?.name || row.category || null; };
const norm = (text) => String(text ?? "").trim().toLocaleLowerCase("pt-BR");
const spend = (row) => (row.type === "refund" || row.type === "income" ? -1 : 1) * Math.abs(Number(row.value) || 0);

/**
 * O Assistente da tela de Lançamentos: observações determinísticas sobre as linhas
 * carregadas (sem LLM, sem número inventado). Cada observação diz de quais linhas fala.
 */
export function assistantInsights(rows) {
  const items = [];
  const uncategorized = rows.filter((row) => !categoryOf(row));
  if (uncategorized.length) items.push({ kind: "uncategorized", title: `${uncategorized.length} ${uncategorized.length === 1 ? "item sem categoria" : "itens sem categoria"}`, detail: uncategorized.slice(0, 3).map((row) => row.description).join(", "), rowIds: uncategorized.map((row) => row.id) });
  const seen = new Map();
  for (const row of rows) {
    if (row.type === "refund") continue;
    const key = `${String(row.date).slice(0, 10)}|${norm(row.description)}|${Math.abs(Number(row.value) || 0)}|${row.value_currency ?? ""}`;
    seen.set(key, [...(seen.get(key) ?? []), row]);
  }
  for (const group of seen.values()) {
    if (group.length > 1) items.push({ kind: "duplicate", title: "Possível duplicata", detail: `${group.length}× “${group[0].description}” no mesmo dia, mesmo valor`, rowIds: group.map((row) => row.id) });
  }
  const totals = new Map();
  for (const row of rows) { const name = categoryOf(row); if (name && spend(row) > 0) totals.set(name, (totals.get(name) ?? 0) + spend(row)); }
  const sum = [...totals.values()].reduce((a, b) => a + b, 0);
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && sum > 0) items.push({ kind: "insight", title: "Insight", detail: `${top[0]} é ${Math.round(top[1] / sum * 100)}% das saídas carregadas`, rowIds: [] });
  const alerts = items.filter((item) => item.kind !== "insight");
  const duplicates = alerts.filter((item) => item.kind === "duplicate").length;
  const others = alerts.filter((item) => item.kind !== "duplicate");
  const alertSummary = alerts.length === 1 ? `${alerts[0].title}: ${alerts[0].detail}` : [...(duplicates ? [`${duplicates} ${duplicates === 1 ? "possível duplicata" : "possíveis duplicatas"}`] : []), ...others.map((item) => item.title)].join(" · ");
  return { items, alerts, alertCount: alerts.length, alertSummary };
}

/** "1 alerta" / "3 alertas": a única regra de plural dos avisos do Assistente. */
export const alertsLabel = (count) => `${count} ${count === 1 ? "alerta" : "alertas"}`;
