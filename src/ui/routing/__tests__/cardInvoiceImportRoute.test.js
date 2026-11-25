// Conciliar fatura (fincla-api#555): a URL usa o `public_id` do cartão, com `importId` opcional.
import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

import { CARD_INVOICE_RECONCILIATION_ROUTE_PATTERN, cardInvoiceReconciliationPath } from "../cardInvoiceImportRoute.js";
import { INVOICE_ROUTE_PATTERN } from "../invoiceRoute.js";

const CARD = "4249be0e-db17-4ec8-80d4-2db8e7be52cf";

function matchFor(pathname) {
  const rootRoute = createRootRoute();
  const reconcile = createRoute({ getParentRoute: () => rootRoute, path: CARD_INVOICE_RECONCILIATION_ROUTE_PATTERN });
  const invoice = createRoute({ getParentRoute: () => rootRoute, path: INVOICE_ROUTE_PATTERN });
  const router = createRouter({ routeTree: rootRoute.addChildren([reconcile, invoice]), history: createMemoryHistory({ initialEntries: ["/"] }) });
  return router.matchRoutes(pathname, {}).at(-1);
}

describe("cardInvoiceReconciliationPath", () => {
  it("o envio e o rascunho, com o public_id do cartão", () => {
    expect(cardInvoiceReconciliationPath(CARD)).toBe(`/cards/${CARD}/reconcile`);
    expect(cardInvoiceReconciliationPath(CARD, "abc")).toBe(`/cards/${CARD}/reconcile/abc`);
  });

  it("os dois caminhos caem na rota da conciliação da fatura, com os parâmetros", () => {
    const upload = matchFor(cardInvoiceReconciliationPath(CARD));
    expect(upload.routeId).toBe("/cards/$cardId/reconcile/{-$importId}");
    expect(upload.params.cardId).toBe(CARD);
    const draft = matchFor(cardInvoiceReconciliationPath(CARD, "abc"));
    expect(draft.params).toMatchObject({ cardId: CARD, importId: "abc" });
    expect(matchFor(`/cards/${CARD}/invoices/2026/12`).routeId).toBe("/cards/$cardId/invoices/$year/$month");
  });
});
