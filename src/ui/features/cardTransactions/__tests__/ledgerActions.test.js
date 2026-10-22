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
    expect(result.reason).toBe("Este bloco não foi alterado: um dos lançamentos não existe mais (Item 250).");
  });

  it("recusa depois de blocos já aceitos não diz 'nada foi alterado' e conta o que o servidor alterou", async () => {
    server.use(http.patch("*/v1/transactions/bulk", async () => {
      sent.push(1);
      return sent.length === 1 ? HttpResponse.json({ updated_ids: [], count: 230 }) : HttpResponse.json({ detail: { code: "bulk_rejected", message: "x", failures: [{ id: 300, reason: "category_not_allowed_for_type" }] } }, { status: 422 });
    }));
    const result = await categorizeRows({ rows: rows(250), categoryId: "c3", organizationId: "org" });
    expect(result.updated).toBe(230);
    expect(result.done).toHaveLength(200);
    expect(result.reason).toMatch(/^Este bloco não foi alterado: /);
    expect(result.reason).not.toMatch(/Nada foi alterado/);
  });

  it("motivo desconhecido, id nulo e irmã não enviada ainda explicam a recusa; muitos motivos viram contagem", async () => {
    server.use(http.patch("*/v1/transactions/bulk", () => HttpResponse.json({ detail: { code: "bulk_rejected", message: "x", failures: [
      { id: null, reason: "something_new" },
      { id: 9999, reason: "detail_tag_outside_category" },
      ...[1, 2, 3, 4].map((id) => ({ id, reason: "not_found" })),
    ] } }, { status: 422 })));
    const { reason } = await categorizeRows({ rows: rows(4), categoryId: "c3", organizationId: "org" });
    expect(reason).toContain("o servidor recusou um dos lançamentos");
    expect(reason).toContain("(outra parcela da mesma compra)");
    expect(reason).toMatch(/ e mais 3\.$/);
    expect(reason).not.toMatch(/Tente novamente/);
  });

  it("recusa de fatura paga (409 com mensagem do servidor) vira o motivo, sem pedir para tentar de novo", async () => {
    server.use(http.patch("*/v1/transactions/bulk", () => HttpResponse.json({ detail: { code: "conflict", message: "Reabra a fatura paga antes de alterar seus lançamentos." } }, { status: 409 })));
    const result = await categorizeRows({ rows: rows(2), categoryId: "c3", organizationId: "org" });
    expect(result.failed).toHaveLength(2);
    expect(result.reason).toBe("Reabra a fatura paga antes de alterar seus lançamentos.");
  });
});
