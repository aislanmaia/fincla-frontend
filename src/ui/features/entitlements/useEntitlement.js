/**
 * `useEntitlement(featureKey, user)` — booleano "esse usuário pode usar essa feature?".
 *
 * Lê de ``user.subscription.features``. Se a feature não está presente (ou se
 * o user/subscription estão ausentes), retorna ``false``. Mantemos a função
 * pura para evitar acoplar a camada de entitlements à forma do `useSession`
 * atual; o caller passa o user que já tem em mãos.
 *
 * Não é um hook React de fato — não usa state nem effect. O nome `use…` segue
 * a convenção do projeto e mantém porta aberta para versão que leia de
 * contexto no futuro, sem mudar o call site.
 */
export function useEntitlement(featureKey, user) {
  if (!featureKey) return false;
  const features = user?.subscription?.features;
  if (!Array.isArray(features)) return false;
  return features.includes(featureKey);
}
