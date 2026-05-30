import { useCallback, useEffect, useState } from "react";

/**
 * Catálogo de heurísticas por substring no `desc` → sugestão de categoria + tags.
 * É a "simulação de IA" do drawer; quando o backend tiver um modelo, este map sai.
 */
const AI_RULES = [
  {
    keywords: ["mercado", "supermercado", "extra", "pão de açúcar"],
    suggestion: { cat: "Alimentação", iconKey: "shopping-cart", tags: ["mercado", "compras"] },
  },
  {
    keywords: ["uber", "99", "gasolina", "combustível"],
    suggestion: { cat: "Transporte", iconKey: "car", tags: ["transporte"] },
  },
  {
    keywords: ["netflix", "spotify", "adobe", "amazon"],
    suggestion: { cat: "Assinaturas", iconKey: "smartphone", tags: ["streaming", "assinatura"] },
  },
  {
    keywords: ["academia", "smartfit", "farmácia", "remédio"],
    suggestion: { cat: "Saúde", iconKey: "pill", tags: ["saúde"] },
  },
  {
    keywords: ["aluguel", "condomínio", "iptu"],
    suggestion: { cat: "Moradia", iconKey: "home", tags: ["moradia", "fixo"] },
  },
  {
    keywords: ["salário", "freela", "aporte"],
    suggestion: { cat: "Receita", iconKey: "wallet", tags: ["receita"] },
  },
];

function detectSuggestion(desc) {
  if (!desc || desc.length < 4) return null;
  const lower = desc.toLowerCase();
  for (const rule of AI_RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) return rule.suggestion;
  }
  return null;
}

/**
 * Sugestão automática de categoria + tags com base no `desc` da transação.
 * Repõe `aiSuggestion` toda vez que `desc` muda; `applyAi()` integra com as
 * categorias/tags live (quando disponíveis), criando tags de detalhe via
 * `ensureDetailTag` quando preciso.
 */
export function useAiSuggestion({
  desc,
  useLiveCategoryTags,
  useLiveDetailTags,
  categoryTagsData,
  ensureDetailTag,
  setCat,
  setCategoryTagId,
  setDetailTagIds,
  setDetailTagLabelById,
  setTags,
}) {
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiApplied, setAiApplied] = useState(false);

  useEffect(() => {
    const suggestion = detectSuggestion(desc);
    setAiSuggestion(suggestion);
    setAiApplied(false);
  }, [desc]);

  const applyAi = useCallback(async () => {
    if (!aiSuggestion) return;
    const rows = useLiveCategoryTags ? categoryTagsData.categories : [];
    const byKey =
      aiSuggestion.iconKey && rows.length
        ? rows.find((c) => c.iconKey === aiSuggestion.iconKey)
        : null;
    const byLabel = rows.find((c) => c.labelPt === aiSuggestion.cat);
    const row = byKey || byLabel;
    if (row?.labelPt) setCat(row.labelPt);
    else setCat(aiSuggestion.cat);
    const catIdForDetailTags = row?.id ?? null;
    if (row?.id) setCategoryTagId(row.id);
    if (useLiveDetailTags && catIdForDetailTags) {
      const nextIds = [];
      const nextLabels = {};
      for (const t of aiSuggestion.tags || []) {
        try {
          const id = await ensureDetailTag(String(t), catIdForDetailTags);
          if (!nextIds.includes(id)) {
            nextIds.push(id);
            nextLabels[String(id)] = String(t);
          }
        } catch {
          /* ignora tag individual */
        }
      }
      setDetailTagIds(nextIds);
      setDetailTagLabelById(nextLabels);
      setTags([]);
    } else {
      setTags(aiSuggestion.tags || []);
      setDetailTagIds([]);
      setDetailTagLabelById({});
    }
    setAiApplied(true);
  }, [
    aiSuggestion,
    useLiveCategoryTags,
    useLiveDetailTags,
    categoryTagsData,
    ensureDetailTag,
    setCat,
    setCategoryTagId,
    setDetailTagIds,
    setDetailTagLabelById,
    setTags,
  ]);

  const resetAi = useCallback(() => {
    setAiSuggestion(null);
    setAiApplied(false);
  }, []);

  return { aiSuggestion, aiApplied, applyAi, resetAi };
}
