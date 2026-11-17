// A tela de desfazer (fincla-api#509) vive debaixo da rota da conciliação, que tem `importId`
// opcional: o caminho com `/undo` tem de cair na tela de desfazer, e o da conciliação continuar
// caindo na conciliação.
import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

import {
  STATEMENT_IMPORT_UNDO_ROUTE_PATTERN,
  statementImportUndoPath,
  statementReconciliationPath,
} from "../statementImportRoute.js";

function routeIdFor(pathname) {
  const rootRoute = createRootRoute();
  const reconcile = createRoute({ getParentRoute: () => rootRoute, path: "accounts/$accountId/reconcile/{-$importId}" });
  const undo = createRoute({ getParentRoute: () => rootRoute, path: STATEMENT_IMPORT_UNDO_ROUTE_PATTERN });
  const router = createRouter({
    routeTree: rootRoute.addChildren([reconcile, undo]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const matches = router.matchRoutes(pathname, {});
  const last = matches[matches.length - 1];
  return { id: last.routeId, params: last.params };
}

describe("rota de desfazer importação", () => {
  it("monta o caminho da conta e da importação", () => {
    expect(statementImportUndoPath("acc-1", "imp-2")).toBe("/accounts/acc-1/reconcile/imp-2/undo");
  });

  it("o caminho com /undo abre a tela de desfazer, com os dois ids", () => {
    const { id, params } = routeIdFor(statementImportUndoPath("acc-1", "imp-2"));

    expect(id).toBe(`/${STATEMENT_IMPORT_UNDO_ROUTE_PATTERN}`);
    expect(params).toMatchObject({ accountId: "acc-1", importId: "imp-2" });
  });

  it("monta o caminho da conciliação, com ou sem a importação", () => {
    expect(statementReconciliationPath("acc-1")).toBe("/accounts/acc-1/reconcile");
    expect(statementReconciliationPath("acc-1", "imp-2")).toBe("/accounts/acc-1/reconcile/imp-2");
    expect(routeIdFor(statementReconciliationPath("acc-1")).params).toMatchObject({ accountId: "acc-1" });
  });

  it("a conciliação continua abrindo a conciliação", () => {
    expect(routeIdFor("/accounts/acc-1/reconcile/imp-2").id).toBe("/accounts/$accountId/reconcile/{-$importId}");
  });
});

describe("fillsAvailableHeight (área de soltar ocupa a altura que sobra)", async () => {
  const { fillsAvailableHeight } = await import("../statementImportRoute.js");
  it("só a tela inicial da conta, no computador", () => {
    expect(fillsAvailableHeight("/accounts/abc/reconcile", false)).toBe(true);
    expect(fillsAvailableHeight("/accounts/abc/reconcile/", false)).toBe(true);
  });
  it("nunca no celular, nem dentro de uma conciliação, nem em outra tela", () => {
    expect(fillsAvailableHeight("/accounts/abc/reconcile", true)).toBe(false);
    expect(fillsAvailableHeight("/accounts/abc/reconcile/imp-1", false)).toBe(false);
    expect(fillsAvailableHeight("/accounts/abc/reconcile/imp-1/undo", false)).toBe(false);
    expect(fillsAvailableHeight("/accounts", false)).toBe(false);
    expect(fillsAvailableHeight("/transactions", false)).toBe(false);
  });
});
