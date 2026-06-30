import { firstPathSegment } from "../../routing/appSegments.js";
import { isConsultant } from "./isConsultant.js";

export const CONSULTANT_SEGMENT = "consultant";

/**
 * Decisão de acesso à área `/consultant` (pura/testável). Assume usuário já autenticado.
 * - `"passthrough"` — não é a área do consultor → segue o fluxo normal do app.
 * - `"allow"` — área do consultor e o usuário é consultor → renderiza o shell do consultor.
 * - `"redirect"` — área do consultor mas o usuário NÃO é consultor → mandar para "/".
 */
export function consultantAreaDecision(pathname, user) {
  if (firstPathSegment(pathname) !== CONSULTANT_SEGMENT) return "passthrough";
  return isConsultant(user) ? "allow" : "redirect";
}
