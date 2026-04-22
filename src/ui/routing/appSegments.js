/** Segmentos de URL (inglês) para área autenticada — alinhados às rotas do TanStack Router. */
export const AUTH_ROUTE_SEGMENTS = [
  "dashboard",
  "transactions",
  "rhythm",
  "budgets",
  "recurring",
  "simulation",
  "goals",
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
