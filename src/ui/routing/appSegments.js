/** Segmentos de URL (inglês) para área autenticada — alinhados às rotas do TanStack Router. */
export const AUTH_ROUTE_SEGMENTS = [
  "dashboard",
  "transactions",
  "rhythm",
  "planning",
  "recurring",
  "accounts",
  "cards",
  "reports",
  "profile",
];
// goals/budgets/simulation migraram para o hub Planejamento; suas rotas antigas
// redirecionam para /planning/$area (ver finclaRouter.jsx).

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
  // Hub de Planejamento: trocar de área (/planning/$area) não deve remontar o hub
  // (evita o "flick" do sub-menu). Mesma estratégia do /transactions.
  if (p === "/planning" || /^\/planning\/[^/]+$/.test(p)) {
    return "/planning";
  }
  // Dashboard da fatura: trocar de fatura (/cards/:id/invoices/:ano/:mes) mantém a tela
  // montada, senão cada troca refaria a carga e perderia o cache por fatura.
  const invoice = /^\/cards\/[^/]+\/invoices\/\d+\/\d+$/.exec(p);
  if (invoice) return p.replace(/\/\d+\/\d+$/, "");
  return p;
}
