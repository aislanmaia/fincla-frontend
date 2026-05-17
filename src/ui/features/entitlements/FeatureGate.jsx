import { useEntitlement } from "./useEntitlement.js";

/**
 * `<FeatureGate feature="..." user={user} fallback={<X/>}>{children}</FeatureGate>`
 *
 * Renderiza `children` quando `user.subscription.features` inclui `feature`;
 * caso contrário renderiza `fallback` (default `null`).
 *
 * Mantém-se agnóstico ao componente de upsell — quem decide o que mostrar
 * é o caller. Para uma tela inteira protegida, passar `<UpgradeWall />`;
 * para um botão escondido, deixar `fallback` em branco; para um inline
 * prompt, passar `<UpgradePrompt />`.
 */
export function FeatureGate({ feature, user, fallback = null, children }) {
  const allowed = useEntitlement(feature, user);
  return allowed ? children : fallback;
}
