/**
 * Saved views = snapshots de filtros nomeados.
 *
 * Persistência local por organização (mesmo padrão de `transactionsPeriodStorage.js`).
 * O endpoint real (`GET/POST/DELETE /api/saved-views`) ainda não existe — quando
 * existir, basta substituir a leitura/escrita do `useSavedViews` por chamadas HTTP.
 *
 * Shape de cada view:
 *   {
 *     id: string,         // "v" + Date.now() na criação
 *     label: string,      // nome exibido
 *     icon: string,       // nome do ícone (ver FILTER_ICONS)
 *     color: string,      // hex
 *     filters: object,    // snapshot dos facets aplicados
 *     createdAt: number,  // epoch ms
 *   }
 */

import { DEFAULT_SORT } from "../search/sortModel.js";
import { FILTER_ICONS } from "../shared/Icon.jsx";

const VALID_ICONS = new Set(FILTER_ICONS);

function sortedStrings(arr) {
  return [...(Array.isArray(arr) ? arr : [])].sort();
}

/** Normaliza snapshot para comparação (inclui busca e sort). */
export function normalizeViewSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return {
      period: "mes",
      customFrom: "",
      customTo: "",
      type: "todos",
      method: "todos",
      cats: [],
      tags: [],
      cardSel: [],
      rec: "any",
      valueMin: "",
      valueMax: "",
      search: "",
      sort: JSON.stringify(DEFAULT_SORT),
    };
  }
  const search = String(
    snapshot.searchInput ?? snapshot.debouncedSearch ?? snapshot.search ?? "",
  ).trim();
  return {
    period: snapshot.period ?? "mes",
    customFrom: snapshot.customFrom ?? "",
    customTo: snapshot.customTo ?? "",
    type: snapshot.type ?? "todos",
    method: snapshot.method ?? "todos",
    cats: sortedStrings(snapshot.cats),
    tags: sortedStrings(snapshot.tags),
    cardSel: sortedStrings(snapshot.cardSel),
    rec: snapshot.rec ?? "any",
    valueMin: snapshot.valueMin ?? "",
    valueMax: snapshot.valueMax ?? "",
    search,
    sort: JSON.stringify(
      Array.isArray(snapshot.sort) && snapshot.sort.length ? snapshot.sort : DEFAULT_SORT,
    ),
  };
}

export function viewSnapshotsEqual(a, b) {
  return (
    JSON.stringify(normalizeViewSnapshot(a)) === JSON.stringify(normalizeViewSnapshot(b))
  );
}

export function isValidView(v) {
  if (!v || typeof v !== "object") return false;
  if (typeof v.id !== "string" || !v.id) return false;
  if (typeof v.label !== "string" || !v.label.trim()) return false;
  if (typeof v.color !== "string" || !v.color) return false;
  if (typeof v.icon !== "string" || !VALID_ICONS.has(v.icon)) return false;
  return true;
}

export function normalizeView(raw) {
  if (!isValidView(raw)) return null;
  return {
    id: raw.id,
    label: raw.label.trim(),
    icon: raw.icon,
    color: raw.color,
    filters: raw.filters && typeof raw.filters === "object" ? raw.filters : {},
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
  };
}

/** Cria uma nova view a partir do form e do snapshot atual de filtros. */
export function buildNewView({ name, icon, color, filters, now = Date.now() }) {
  return normalizeView({
    id: "v" + now,
    label: name,
    icon,
    color,
    filters: filters || {},
    createdAt: now,
  });
}

/** Dica curta exibida abaixo do label no card, derivada do snapshot. */
export function describeView(view, activeFacetsCount = 0) {
  if (!view) return "";
  const n =
    typeof activeFacetsCount === "number"
      ? activeFacetsCount
      : countActiveFiltersInSnapshot(view.filters);
  if (n === 0) return "Sem filtros";
  return n === 1 ? "1 filtro" : `${n} filtros`;
}

export function countActiveFiltersInSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return 0;
  let n = 0;
  const search = String(
    snapshot.searchInput ?? snapshot.debouncedSearch ?? snapshot.search ?? "",
  ).trim();
  if (search) n += 1;
  if (snapshot.period && snapshot.period !== "mes") n += 1;
  if (snapshot.type && snapshot.type !== "todos") n += 1;
  if (snapshot.method && snapshot.method !== "todos") n += 1;
  if (Array.isArray(snapshot.cats) && snapshot.cats.length) n += 1;
  if (Array.isArray(snapshot.tags) && snapshot.tags.length) n += 1;
  if (Array.isArray(snapshot.cardSel) && snapshot.cardSel.length) n += 1;
  if (snapshot.rec && snapshot.rec !== "any") n += 1;
  if (snapshot.valueMin || snapshot.valueMax) n += 1;
  return n;
}

/** Mescla metadados + filtros ao atualizar uma view existente. */
export function buildUpdatedView(view, { name, icon, color, filters }) {
  if (!view) return null;
  return normalizeView({
    ...view,
    label: typeof name === "string" ? name.trim() : view.label,
    icon: icon ?? view.icon,
    color: color ?? view.color,
    filters: filters ?? view.filters,
  });
}

/**
 * Exibe a seção de visualizações salvas acima da busca quando:
 *  - já existe ao menos uma view salva, ou
 *  - há filtros/busca ativos (para permitir "+ Nova").
 */
export function shouldShowSavedViewsSection(savedViewsCount, filtersActive) {
  return savedViewsCount > 0 || Boolean(filtersActive);
}
