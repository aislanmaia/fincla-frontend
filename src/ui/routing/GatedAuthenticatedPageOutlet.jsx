import { UpgradeWall, useEntitlement } from "../features/entitlements/index.js";
import { useFinclaPages } from "./finclaPageContext.jsx";

/**
 * Variante do `<AuthenticatedPageOutlet>` que esconde a rota inteira atrás
 * de uma feature key. Quando a feature está ausente do plano do usuário,
 * renderizamos `<UpgradeWall>` em vez do conteúdo; o CTA "Ver planos" abre
 * o `PlansComparisonModal` no próprio overlay (mantém o contexto que
 * trouxe o usuário ao paywall em vez de navegar para outra tela).
 *
 * Usado em rotas inteiramente Pro como `/reports` (`advanced_reports`) e
 * `/simulation` (`what_if_simulations`).
 */
export function GatedAuthenticatedPageOutlet({
  segment,
  feature,
  title,
  description,
  benefits = [],
}) {
  const ctx = useFinclaPages();
  const allowed = useEntitlement(feature, ctx?.user);

  if (!ctx?.pages) return null;

  if (!allowed) {
    return (
      <UpgradeWall
        feature={feature}
        title={title ?? "Disponível em outro plano"}
        description={
          description ??
          "Faça upgrade do seu plano para desbloquear este recurso."
        }
        benefits={benefits}
        ctaLabel="Ver planos"
        currentPlanId={ctx.user?.subscription?.plan}
      />
    );
  }

  return ctx.pages[segment] ?? null;
}
