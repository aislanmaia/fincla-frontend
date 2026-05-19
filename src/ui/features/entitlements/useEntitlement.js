/**
 * `useEntitlement(featureKey, user)` — booleano "esse usuário pode usar essa feature?".
 *
 * Combina dois sinais:
 *   1. ``user.subscription.status === 'active'`` (subscription rodando).
 *   2. ``featureKey`` está em ``user.subscription.features`` (plano libera).
 *
 * Estados intermediários (`pending_payment`, `past_due`, `cancelled`,
 * `expired`, `inactive`) revogam o acesso visual imediatamente —
 * espelhando o `is_entitled` no backend, que também valida que
 * `current_period_end > now`. Como o `EmbeddedSubscription` não
 * carrega o `current_period_end`, o backend é a autoridade final para
 * o caso "status=active mas período vencido" — devolve 403 e o frontend
 * cai pra UI de erro. Defesa em profundidade.
 *
 * Não é um hook React de fato — não usa state nem effect. O nome `use…` segue
 * a convenção do projeto e mantém porta aberta para versão que leia de
 * contexto no futuro, sem mudar o call site.
 */
export function useEntitlement(featureKey, user) {
  if (!featureKey) return false;
  const subscription = user?.subscription;
  if (!subscription) return false;
  if (subscription.status !== "active") return false;
  const features = subscription.features;
  if (!Array.isArray(features)) return false;
  return features.includes(featureKey);
}
