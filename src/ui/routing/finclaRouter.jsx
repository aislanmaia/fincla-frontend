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
import { FinclaNotFoundPage } from "./FinclaNotFoundPage.jsx";
import { FinclaAuthenticatedRouteError } from "./FinclaAuthenticatedRouteError.jsx";
import { AUTH_ROUTE_SEGMENTS } from "./appSegments.js";
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

const segmentRoutes = AUTH_ROUTE_SEGMENTS.filter(
  (s) => s !== "profile" && s !== "transactions",
).map((segment) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: segment,
    beforeLoad: requireSessionTokenBeforeLoad,
    errorComponent: FinclaAuthenticatedRouteError,
    component: function SegmentPage() {
      return <AuthenticatedPageOutlet segment={segment} />;
    },
  }),
);

const transactionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "transactions",
  beforeLoad: requireSessionTokenBeforeLoad,
  errorComponent: FinclaAuthenticatedRouteError,
  component: () => <Outlet />,
});

const transactionsIndexRoute = createRoute({
  getParentRoute: () => transactionsRoute,
  path: "/",
  component: function TransactionsIndexPage() {
    return <AuthenticatedPageOutlet segment="transactions" />;
  },
});

const transactionsDetailRoute = createRoute({
  getParentRoute: () => transactionsRoute,
  path: "$transactionId",
  beforeLoad: ({ params }) => {
    if (!isTransactionEditPathId(params.transactionId)) {
      throw notFound();
    }
  },
  errorComponent: FinclaAuthenticatedRouteError,
  component: function TransactionsDetailPage() {
    return <AuthenticatedPageOutlet segment="transactions" />;
  },
});

transactionsRoute.addChildren([transactionsIndexRoute, transactionsDetailRoute]);

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

profileRoute.addChildren([profileIndexRoute, profileTabRoute]);

const notFoundRoute = new NotFoundRoute({
  getParentRoute: () => rootRoute,
  component: FinclaNotFoundPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  ...segmentRoutes,
  transactionsRoute,
  profileRoute,
  notFoundRoute,
]);

export const finclaRouter = createRouter({
  routeTree,
  defaultPreload: false,
});
