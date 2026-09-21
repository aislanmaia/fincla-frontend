import { handleApiError } from "../../api/client";
import { listTags } from "../../api/tags";
import {
  categoryLabelPtForTag,
  resolveCategoryColorForTag,
} from "./categoryLabels.js";

export async function listCategoryTagsForUi(organizationId) {
  return listTags(organizationId, "categoria");
}

/**
 * Uma linha por nome de tag API (dedupe), ordenada por sort_order e nome.
 * @param {import("../../api/types").Tag[] | undefined | null} tags
 * @returns {{ id: string; apiName: string; labelPt: string; iconKey: string | null; color: string; sortOrder: number }[]}
 */
export function mapCategoryTagsForUi(tags) {
  const list = (tags ?? []).filter((t) => t?.name && t?.id);
  const bestByName = new Map();
  for (const t of list) {
    const prev = bestByName.get(t.name);
    const order = t.sort_order ?? 1e9;
    const prevOrder = prev ? (prev.sort_order ?? 1e9) : 1e9;
    if (!prev || order < prevOrder) bestByName.set(t.name, t);
  }
  return [...bestByName.values()]
    .sort((a, b) => {
      const ao = a.sort_order ?? 1e9;
      const bo = b.sort_order ?? 1e9;
      if (ao !== bo) return ao - bo;
      return String(a.name).localeCompare(String(b.name), "pt-BR");
    })
    .map((t) => ({
      id: t.id,
      apiName: t.name,
      labelPt: categoryLabelPtForTag(t),
      iconKey: t.icon_key ?? null,
      color: resolveCategoryColorForTag(t),
      sortOrder: t.sort_order ?? 1e9,
    }));
}

/**
 * Maps the localized catalog contract to the transaction selector shape.
 * Labels come from the API locale resolver, never from an icon heuristic.
 * @param {import("../../api/types").CategoryCatalogItem[] | undefined | null} categories
 * @returns {{ id: string; apiName: string; labelPt: string; iconKey: string | null; color: string; sortOrder: number; details: object[]; isFallback: boolean }[]}
 */
export function mapCategoryCatalogForUi(categories) {
  return [...(categories ?? [])]
    .filter((category) => category?.id && category?.label)
    .map((category, index) => ({
      id: category.id,
      apiName: category.system_key ?? category.label,
      labelPt: category.label,
      iconKey: category.icon_key ?? null,
      color: category.color ?? resolveCategoryColorForTag(category),
      sortOrder: index,
      details: category.details ?? [],
      isFallback: category.is_fallback === true,
    }));
}

/** @deprecated Prefer {@link mapCategoryTagsForUi} — mantido para testes e rótulos simples */
export function mapCategoryTagsToOptions(tags) {
  return mapCategoryTagsForUi(tags).map((c) => c.labelPt);
}

export function formatTagsApiError(error) {
  return handleApiError(error);
}
