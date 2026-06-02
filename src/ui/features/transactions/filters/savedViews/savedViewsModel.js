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

import { FILTER_ICONS } from "../shared/Icon.jsx";

const VALID_ICONS = new Set(FILTER_ICONS);

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
  if (snapshot.period && snapshot.period !== "mes") n += 1;
  if (snapshot.type && snapshot.type !== "todos") n += 1;
  if (Array.isArray(snapshot.cats) && snapshot.cats.length) n += 1;
  if (Array.isArray(snapshot.tags) && snapshot.tags.length) n += 1;
  if (Array.isArray(snapshot.cardSel) && snapshot.cardSel.length) n += 1;
  if (snapshot.rec && snapshot.rec !== "any") n += 1;
  if (snapshot.valueMin || snapshot.valueMax) n += 1;
  return n;
}
