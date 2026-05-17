import { useNavigate } from "@tanstack/react-router";

import { UpgradeWall, useEntitlement } from "../features/entitlements/index.js";
import { useFinclaPages } from "./finclaPageContext.jsx";

/**
 * Variante do `<AuthenticatedPageOutlet>` que esconde a rota inteira atrás
 * de uma feature key. Quando a feature está ausente do plano do usuário,
 * renderizamos `<UpgradeWall>` em vez do conteúdo; o botão "Ver planos"
 * navega para `/profile/billing`.
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
  const navigate = useNavigate();
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
        onUpgradeClick={() =>
          navigate({ to: "/profile/billing", replace: false })
        }
      />
    );
  }

  return ctx.pages[segment] ?? null;
}
