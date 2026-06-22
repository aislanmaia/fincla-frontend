import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  notFound,
  NotFoundRoute,
  redirect,
} from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import App from "../App.jsx";
import { AuthenticatedPageOutlet } from "./AuthenticatedPageOutlet.jsx";
import { BillingReturnPage } from "../pages/BillingReturnPage.jsx";
import { FinclaNotFoundPage } from "./FinclaNotFoundPage.jsx";
import { FinclaAuthenticatedRouteError } from "./FinclaAuthenticatedRouteError.jsx";
import { GatedAuthenticatedPageOutlet } from "./GatedAuthenticatedPageOutlet.jsx";
import { AUTH_ROUTE_SEGMENTS } from "./appSegments.js";
import { isPlanningArea, DEFAULT_PLANNING_AREA } from "../features/planning/planningAreas.js";
import { finclaRootSearchSchema } from "./finclaRootSearchSchema.js";
import { requireSessionTokenBeforeLoad } from "./requireSessionTokenBeforeLoad.js";
import { isProfileSettingsTabSlug } from "./profileSettingsTabs.js";
import { isTransactionEditPathId } from "./transactionPathId.js";

const rootRoute = createRootRoute({
  validateSearch: zodValidator(finclaRootSearchSchema),
  component: App,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => null,
});

/**
 * Segmentos cuja tela inteira só está disponível em planos com a feature
 * key correspondente. O backend já bloqueia os endpoints via
 * ``require_feature(...)``; aqui adicionamos UX antecipada (UpgradeWall)
 * para evitar 403 ruidoso no navegador.
 */
const GATED_SEGMENTS = {
  reports: {
    feature: "advanced_reports",
    title: "Relatórios avançados — disponível no Pro",
    description:
      "Veja para onde seu dinheiro está indo com gráficos detalhados, comparações entre períodos e exportação completa.",
    benefits: [
      "6 visualizações analíticas",
      "Comparações entre meses e categorias",
      "Exportação em CSV de todos os relatórios",
    ],
  },
  simulation: {
    feature: "what_if_simulations",
    title: "Simulação financeira — disponível no Pro",
    description:
      "Antes de assumir um novo compromisso, simule o impacto no seu orçamento e veja se cabe no plano.",
    benefits: [
      "Compare cenários antes de decidir",
      "Veja o impacto lado a lado com o real",
      "Análise de risco automática",
    ],
  },
};

const segmentRoutes = AUTH_ROUTE_SEGMENTS.filter(
  (s) => s !== "profile" && s !== "transactions" && s !== "planning",
).map((segment) => {
  const gate = GATED_SEGMENTS[segment];
  return createRoute({
    getParentRoute: () => rootRoute,
    path: segment,
    beforeLoad: requireSessionTokenBeforeLoad,
    errorComponent: FinclaAuthenticatedRouteError,
    component: function SegmentPage() {
      if (gate) {
        return (
          <GatedAuthenticatedPageOutlet
            segment={segment}
            feature={gate.feature}
            title={gate.title}
            description={gate.description}
            benefits={gate.benefits}
          />
        );
      }
      return <AuthenticatedPageOutlet segment={segment} />;
    },
  });
});

/** Um único componente para lista + detalhe evita remount ao abrir edição pela URL. */
function transactionsOptionalBeforeLoad(ctx) {
  requireSessionTokenBeforeLoad(ctx);
  const raw = ctx.params?.transactionId;
  if (raw == null || String(raw).trim() === "") return;
  if (!isTransactionEditPathId(String(raw))) {
    throw notFound();
  }
}

const transactionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "transactions/{-$transactionId}",
  beforeLoad: transactionsOptionalBeforeLoad,
  errorComponent: FinclaAuthenticatedRouteError,
  component: function TransactionsPage() {
    return <AuthenticatedPageOutlet segment="transactions" />;
  },
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "profile",
  beforeLoad: requireSessionTokenBeforeLoad,
  errorComponent: FinclaAuthenticatedRouteError,
  component: () => <Outlet />,
});

const profileIndexRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/profile/account", replace: true });
  },
});

const profileTabRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: "$tab",
  beforeLoad: ({ params }) => {
    const tab = params.tab;
    if (!isProfileSettingsTabSlug(tab)) {
      throw notFound();
    }
  },
  errorComponent: FinclaAuthenticatedRouteError,
  component: function ProfileTabPage() {
    return <AuthenticatedPageOutlet segment="profile" />;
  },
});

const profileBillingReturnRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: "billing/return",
  errorComponent: FinclaAuthenticatedRouteError,
  component: BillingReturnPage,
});

profileRoute.addChildren([profileIndexRoute, profileBillingReturnRoute, profileTabRoute]);

/* ─── Hub Planejamento: /planning/$area (deep-linkável, estilo /profile/$tab) ─── */
const planningRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "planning",
  beforeLoad: requireSessionTokenBeforeLoad,
  errorComponent: FinclaAuthenticatedRouteError,
  component: () => <Outlet />,
});

const planningIndexRoute = createRoute({
  getParentRoute: () => planningRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: `/planning/${DEFAULT_PLANNING_AREA}`, replace: true });
  },
});

const planningAreaRoute = createRoute({
  getParentRoute: () => planningRoute,
  path: "$area",
  beforeLoad: ({ params }) => {
    if (!isPlanningArea(params.area)) {
      throw notFound();
    }
  },
  errorComponent: FinclaAuthenticatedRouteError,
  component: function PlanningAreaPage() {
    return <AuthenticatedPageOutlet segment="planning" />;
  },
});

planningRoute.addChildren([planningIndexRoute, planningAreaRoute]);

/** Rotas antigas → hub (back-compat de bookmarks/links). */
function planningRedirectRoute(path, area) {
  return createRoute({
    getParentRoute: () => rootRoute,
    path,
    beforeLoad: () => {
      throw redirect({ to: `/planning/${area}`, replace: true });
    },
  });
}
const goalsRedirectRoute = planningRedirectRoute("goals", "goals");
const budgetsRedirectRoute = planningRedirectRoute("budgets", "budgets");
const simulationRedirectRoute = planningRedirectRoute("simulation", "simulator");

const notFoundRoute = new NotFoundRoute({
  getParentRoute: () => rootRoute,
  component: FinclaNotFoundPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  ...segmentRoutes,
  transactionsRoute,
  profileRoute,
  planningRoute,
  goalsRedirectRoute,
  budgetsRedirectRoute,
  simulationRedirectRoute,
  notFoundRoute,
]);

export const finclaRouter = createRouter({
  routeTree,
  defaultPreload: false,
});
