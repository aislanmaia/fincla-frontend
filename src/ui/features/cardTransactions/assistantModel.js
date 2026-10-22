/**
 * O Assistente da tela de Lançamentos: observações determinísticas (sem LLM, sem número inventado) que o servidor
 * calcula sobre o RECORTE INTEIRO dos filtros, não só as linhas carregadas. Cada observação diz de quais lançamentos
 * fala; as sugestões de categoria dizem em que se baseiam e só são aplicadas por uma ação explícita do usuário.
 */
export function assistantFromApi(data) {
  const items = (data?.items ?? []).map((item) => ({
    kind: item.kind,
    title: item.title,
    detail: item.detail,
    rowIds: item.transaction_ids ?? [],
    suggestions: (item.suggestions ?? []).map((suggestion) => ({ categoryTagId: suggestion.category_tag_id, categoryName: suggestion.category_name, rowIds: suggestion.transaction_ids ?? [], basis: suggestion.basis })),
  }));
  const alerts = items.filter((item) => item.kind !== "insight");
  const duplicates = alerts.filter((item) => item.kind === "duplicate").length;
  const others = alerts.filter((item) => item.kind !== "duplicate");
  const alertSummary = alerts.length === 1 ? `${alerts[0].title}: ${alerts[0].detail}` : [...(duplicates ? [`${duplicates} ${duplicates === 1 ? "possível duplicata" : "possíveis duplicatas"}`] : []), ...others.map((item) => item.title)].join(" · ");
  return { items, alerts, alertCount: alerts.length, alertSummary, scanned: data?.scanned ?? 0 };
}

/** "1 alerta" / "3 alertas": a única regra de plural dos avisos do Assistente. */
export const alertsLabel = (count) => `${count} ${count === 1 ? "alerta" : "alertas"}`;

/** Por que o Assistente não leu o recorte, em português (recorte grande demais tem causa que o usuário resolve). */
export function assistantFailureMessage(error) {
  const detail = error?.response?.data?.detail;
  if (detail?.code === "slice_too_large" && Number.isFinite(detail.total) && Number.isFinite(detail.limit)) {
    const fmt = (value) => value.toLocaleString("pt-BR");
    return `O recorte tem ${fmt(detail.total)} lançamentos e o Assistente analisa até ${fmt(detail.limit)}. Estreite os filtros.`;
  }
  return "Não foi possível analisar o recorte agora.";
}
