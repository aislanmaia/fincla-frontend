/** @vitest-environment jsdom */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { BULK_MAX_IDS, categorizeRows } from "../ledgerActions.js";

const sent = [];
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { server.resetHandlers(); sent.length = 0; });
afterAll(() => server.close());

const rows = (count) => Array.from({ length: count }, (_, index) => ({ id: index + 1, description: `Item ${index + 1}` }));

describe("categorizeRows (lote do servidor)", () => {
  it("manda no máximo 200 por pedido e todos passam quando o servidor aceita", async () => {
    server.use(http.patch("*/v1/transactions/bulk", async ({ request }) => { sent.push((await request.json()).ids.length); return HttpResponse.json({ updated_ids: [], count: 0 }); }));
    const result = await categorizeRows({ rows: rows(450), categoryId: "c3", organizationId: "org" });
    expect(sent).toEqual([BULK_MAX_IDS, BULK_MAX_IDS, 50]);
    expect(result.done).toHaveLength(450);
    expect(result.failed).toEqual([]);
  });

  it("na primeira recusa para: o que foi aceito fica em done, o resto (inclusive o não enviado) em failed", async () => {
    server.use(http.patch("*/v1/transactions/bulk", async ({ request }) => {
      sent.push((await request.json()).ids.length);
      return sent.length === 2 ? HttpResponse.json({ detail: { code: "bulk_rejected", message: "x", failures: [{ id: 250, reason: "not_found" }] } }, { status: 422 }) : HttpResponse.json({ updated_ids: [], count: 0 });
    }));
    const result = await categorizeRows({ rows: rows(450), categoryId: "c3", organizationId: "org" });
    expect(sent).toEqual([200, 200]);
    expect(result.done).toHaveLength(200);
    expect(result.failed.map((row) => row.id)).toEqual(rows(450).slice(200).map((row) => row.id));
    expect(result.reason).toBe("Nada foi alterado: um dos lançamentos não existe mais (Item 250).");
  });

  it("recusa de fatura paga (409 com mensagem do servidor) vira o motivo, sem pedir para tentar de novo", async () => {
    server.use(http.patch("*/v1/transactions/bulk", () => HttpResponse.json({ detail: { code: "conflict", message: "Reabra a fatura paga antes de alterar seus lançamentos." } }, { status: 409 })));
    const result = await categorizeRows({ rows: rows(2), categoryId: "c3", organizationId: "org" });
    expect(result.failed).toHaveLength(2);
    expect(result.reason).toBe("Reabra a fatura paga antes de alterar seus lançamentos.");
  });
});
