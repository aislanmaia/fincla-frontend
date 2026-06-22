/** Segmentos de URL (inglês) para área autenticada — alinhados às rotas do TanStack Router. */
export const AUTH_ROUTE_SEGMENTS = [
  "dashboard",
  "transactions",
  "rhythm",
  "planning",
  "budgets",
  "recurring",
  "simulation",
  "goals",
  "accounts",
  "cards",
  "reports",
  "profile",
];

export function firstPathSegment(pathname) {
  const raw = String(pathname ?? "").replace(/^\//, "");
  return raw.split("/").filter(Boolean)[0] ?? "";
}

export function isAuthRouteSegment(seg) {
  return AUTH_ROUTE_SEGMENTS.includes(seg);
}

/**
 * Chave estável para o scroll principal + animação de entrada: evita remount ao mudar
 * só o sufixo na mesma área (ex.: /transactions ↔ /transactions/:id), que causava
 * flicker, re-fetch e perda da suavidade do modal.
 */
export function finclaMainOutletRemountKey(pathname) {
  const p = String(pathname ?? "").replace(/\/$/, "") || "/";
  if (p === "/transactions" || /^\/transactions\/[^/]+$/.test(p)) {
    return "/transactions";
  }
  return p;
}
