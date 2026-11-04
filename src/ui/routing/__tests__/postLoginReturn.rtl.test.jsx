/** @vitest-environment jsdom */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";

vi.mock("../../data/sessionAdapter.js", () => ({ isAuthenticated: vi.fn() }));

import { isAuthenticated } from "../../data/sessionAdapter.js";
import { finclaRootSearchSchema } from "../finclaRootSearchSchema.js";
import { requireSessionTokenBeforeLoad } from "../requireSessionTokenBeforeLoad.js";
import { useAuthRedirects } from "../useAuthRedirects.js";

const KEY = "fincla_post_login_return";
const DEEP = "/transactions?fc_from=2026-10-01&fc_to=2026-10-31&fc_type=expense&fc_status=paid&fc_category=Alimenta%C3%A7%C3%A3o";

/** Mesmo desenho do finclaRouter: raiz valida o search; /transactions exige token. */
function buildRouter(initial, sessionRef) {
  const Root = () => {
    // Faz o papel do App: o hook REAL de redirects, dirigido pela sessão do teste.
    const { pathname, searchStr } = useRouterState({
      select: (s) => ({ pathname: s.location.pathname, searchStr: s.location.searchStr ?? "" }),
    });
    const [session, setSession] = React.useState(sessionRef.current);
    sessionRef.set = setSession;
    useAuthRedirects({ session, pathname, searchStr, showOnboarding: false });
    return <Outlet />;
  };
  const root = createRootRoute({ validateSearch: zodValidator(finclaRootSearchSchema), component: Root });
  const index = createRoute({ getParentRoute: () => root, path: "/", component: () => <div>login</div> });
  const tx = createRoute({
    getParentRoute: () => root,
    path: "transactions/{-$transactionId}",
    beforeLoad: requireSessionTokenBeforeLoad,
    component: () => <div>transactions-page</div>,
  });
  const dash = createRoute({ getParentRoute: () => root, path: "dashboard", component: () => <div>dashboard</div> });
  const router = createRouter({
    routeTree: root.addChildren([index, tx, dash]),
    history: createMemoryHistory({ initialEntries: [initial] }),
  });
  return router;
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe("retorno pós-login do deep link /transactions", () => {
  it("deslogado: guarda path+query; logado em '/': volta à MESMA URL, não ao dashboard", async () => {
    vi.mocked(isAuthenticated).mockReturnValue(false);
    const sessionRef = { current: { isBootstrapping: false, isAuthenticated: false, user: null } };
    const router = buildRouter(DEEP, sessionRef);
    const { findByText } = render(<RouterProvider router={router} />);

    await findByText("login");
    expect(router.state.location.pathname).toBe("/");
    expect(sessionStorage.getItem(KEY)).toBe(DEEP);

    // Faz login: token passa a existir e a sessão vira autenticada.
    vi.mocked(isAuthenticated).mockReturnValue(true);
    await act(async () => {
      sessionRef.set({ isBootstrapping: false, isAuthenticated: true, user: { subscription: null } });
    });

    await findByText("transactions-page");
    await waitFor(() => expect(router.state.location.pathname).toBe("/transactions"));
    const search = router.state.location.search;
    expect(search).toMatchObject({
      fc_from: "2026-10-01",
      fc_to: "2026-10-31",
      fc_type: "expense",
      fc_status: "paid",
      fc_category: "Alimentação",
    });
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it("deep link com params inválidos: volta à rota, os inválidos são descartados pelo schema", async () => {
    vi.mocked(isAuthenticated).mockReturnValue(false);
    const sessionRef = { current: { isBootstrapping: false, isAuthenticated: false, user: null } };
    const router = buildRouter("/transactions?fc_from=2026-02-31&fc_type=transfer&fc_status=paid", sessionRef);
    const { findByText } = render(<RouterProvider router={router} />);
    await findByText("login");
    vi.mocked(isAuthenticated).mockReturnValue(true);
    await act(async () => {
      sessionRef.set({ isBootstrapping: false, isAuthenticated: true, user: { subscription: null } });
    });
    await findByText("transactions-page");
    const search = router.state.location.search;
    expect(search.fc_status).toBe("paid");
    expect(search.fc_from).toBeUndefined();
    expect(search.fc_type).toBeUndefined();
  });
});
