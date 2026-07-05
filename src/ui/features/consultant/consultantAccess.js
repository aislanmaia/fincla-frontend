import { firstPathSegment } from "../../routing/appSegments.js";
import { useEntitlement } from "../entitlements/useEntitlement.js";

export const CONSULTANT_SEGMENT = "consultant";
/**
 * Feature que libera a área do Consultor. Espelha o gate do backend
 * (`require_consultant_feature("multi_org_dashboard")`): assinatura ativa +
 * feature no plano. Inclui planos `consultant_*` e `beta` (testers) — exatamente
 * quem o backend serve em `/v1/consultant/*`. Usar a feature (e não `role ===
 * "consultant"`) mantém frontend e backend consistentes.
 */
export const CONSULTANT_FEATURE = "multi_org_dashboard";

/**
 * Decisão de acesso à área `/consultant` (pura/testável). Assume usuário já autenticado.
 * - `"passthrough"` — não é a área do consultor → segue o fluxo normal do app.
 * - `"allow"` — área do consultor e o usuário tem a capacidade → renderiza o shell do consultor.
 * - `"redirect"` — área do consultor mas o usuário NÃO tem a capacidade → mandar para "/".
 */
export function consultantAreaDecision(pathname, user) {
  if (firstPathSegment(pathname) !== CONSULTANT_SEGMENT) return "passthrough";
  return useEntitlement(CONSULTANT_FEATURE, user) ? "allow" : "redirect";
}

/**
 * `hasConsultantArea(user)` — o usuário tem a área do consultor disponível?
 * (assinatura ativa + feature `multi_org_dashboard`). Usado para rotear o login
 * direto para `/consultant` e para exibir o switcher "Consultor ⇄ Minha conta".
 */
export function hasConsultantArea(user) {
  return useEntitlement(CONSULTANT_FEATURE, user);
}
