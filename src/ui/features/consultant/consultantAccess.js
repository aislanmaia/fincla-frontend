import { firstPathSegment } from "../../routing/appSegments.js";
import { useEntitlement } from "../entitlements/useEntitlement.js";

export const CONSULTANT_SEGMENT = "consultant";
/**
 * Feature que libera as CAPACIDADES do consultor (endpoints agregados). Continua
 * exportada porque é o que o backend exige em `/v1/consultant/*`, mas **não é
 * mais o que decide a área** — ver `hasConsultantArea`.
 */
export const CONSULTANT_FEATURE = "multi_org_dashboard";

/**
 * O usuário É consultor? Vem do backend (`is_consultant` em `/me` e no login),
 * onde a resposta sai da CARTEIRA (memberships `role="consultant"`), com os
 * planos de consultor PAGOS como fallback para quem acabou de assinar e ainda
 * não tem cliente.
 *
 * **Por que não a feature.** Este gate usava `multi_org_dashboard`, e o plano
 * `beta` a concede — então todo usuário beta era mandado para o painel do
 * consultor no login, inclusive quem nunca assessorou ninguém. Aconteceu em
 * produção com a conta pessoal do Owner.
 *
 * Plano e papel são eixos independentes: `beta` significa "tudo liberado do que
 * você for" — para um cliente, tudo de cliente. Ele nunca deveria TORNAR alguém
 * consultor. Quem decide é o backend, que é quem enxerga a carteira; o frontend
 * só lê a resposta.
 */
function isConsultant(user) {
  return user?.is_consultant === true;
}

/**
 * Decisão de acesso à área `/consultant` (pura/testável). Assume usuário já autenticado.
 * - `"passthrough"` — não é a área do consultor → segue o fluxo normal do app.
 * - `"allow"` — área do consultor e o usuário tem a capacidade → renderiza o shell do consultor.
 * - `"redirect"` — área do consultor mas o usuário NÃO tem a capacidade → mandar para "/".
 */
export function consultantAreaDecision(pathname, user) {
  if (firstPathSegment(pathname) !== CONSULTANT_SEGMENT) return "passthrough";
  return hasConsultantArea(user) ? "allow" : "redirect";
}

/**
 * `hasConsultantArea(user)` — o usuário tem a área do consultor disponível?
 * (assinatura ativa + feature `multi_org_dashboard`). Usado para rotear o login
 * direto para `/consultant` e para exibir o switcher "Consultor ⇄ Minha conta".
 */
export function hasConsultantArea(user) {
  // As DUAS condições: ser consultor E ter a assinatura ativa liberando as
  // capacidades. Só a primeira deixaria um consultor com pagamento vencido
  // entrar num painel cujos endpoints devolvem 403 — tela cheia de erro em vez
  // do aviso de cobrança.
  return isConsultant(user) && useEntitlement(CONSULTANT_FEATURE, user);
}
