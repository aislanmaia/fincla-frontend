/**
 * E2E refund golden path (API-driven).
 *
 * Cobre:
 *  - POST /v1/transactions com type='refund' e refund_of_transaction_id
 *  - GET  /v1/transactions/summary devolve total_refunds e balance líquido
 *  - GET  /v1/transactions?type=refund filtra apenas estornos
 *
 * Não usa UI — valida o contrato HTTP real exposto pela API.
 */
import { test, expect } from "@playwright/test";
import { loginOwnerBearer, fetchFirstCategoriaTagId } from "./helpers/api-owner";
import { resetAndSeedOrganization } from "./helpers/test-org";

const e2eReady = Boolean(
  process.env.TEST_RESET_SECRET &&
    process.env.E2E_TEST_OWNER_EMAIL &&
    process.env.E2E_TEST_OWNER_PASSWORD,
);

test.skip(!e2eReady, "Defina TEST_RESET_SECRET, E2E_TEST_OWNER_EMAIL e E2E_TEST_OWNER_PASSWORD.");

function apiBase(): string {
  return (process.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
}

type CreatedTransaction = { id: number; type: string; value: number };

async function createTransaction(
  bearer: string,
  body: Record<string, unknown>,
): Promise<CreatedTransaction> {
  const res = await fetch(`${apiBase()}/v1/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`POST /v1/transactions: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as CreatedTransaction;
}

test.describe("refund golden path (API)", () => {
  let bearer: string;
  let orgId: string;
  let categoriaTagId: string;

  test.beforeAll(async () => {
    if (!e2eReady) return;
    orgId = await resetAndSeedOrganization("empty");
    bearer = await loginOwnerBearer();
    categoriaTagId = await fetchFirstCategoriaTagId(bearer, orgId);
  });

  test("expense + refund linkado: summary devolve total_refunds e balance líquido", async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Compra original
    const expense = await createTransaction(bearer, {
      type: "expense",
      description: "E2E refund test - compra",
      value: 100,
      payment_method: "pix",
      date: today,
      organization_id: orgId,
      tag_ids: [categoriaTagId],
      status: "confirmed",
      recurring: false,
    });
    expect(expense.id).toBeGreaterThan(0);

    // Estorno linkado
    const refund = await createTransaction(bearer, {
      type: "refund",
      description: "E2E refund test - estorno",
      value: 30,
      payment_method: "pix",
      date: today,
      organization_id: orgId,
      tag_ids: [categoriaTagId],
      status: "confirmed",
      recurring: false,
      refund_of_transaction_id: expense.id,
    });
    expect(refund.id).toBeGreaterThan(0);
    expect(refund.type).toBe("refund");

    // Summary do dia: total_refunds deve aparecer e balance ser líquido
    const summaryRes = await fetch(
      `${apiBase()}/v1/transactions/summary?organization_id=${encodeURIComponent(
        orgId,
      )}&date_start=${today}&date_end=${today}`,
      { headers: { Authorization: `Bearer ${bearer}` } },
    );
    expect(summaryRes.ok).toBeTruthy();
    const summary = (await summaryRes.json()) as {
      total_income: number;
      total_expenses: number;
      total_refunds: number;
      balance: number;
    };

    expect(summary.total_expenses).toBeCloseTo(100, 2);
    expect(summary.total_refunds).toBeCloseTo(30, 2);
    // balance líquido = income - expenses + refunds = 0 - 100 + 30 = -70
    expect(summary.balance).toBeCloseTo(-70, 2);

    // Listagem filtrada por type=refund retorna apenas o estorno
    const listRes = await fetch(
      `${apiBase()}/v1/transactions?organization_id=${encodeURIComponent(
        orgId,
      )}&date_start=${today}&date_end=${today}&type=refund`,
      { headers: { Authorization: `Bearer ${bearer}` } },
    );
    expect(listRes.ok).toBeTruthy();
    const list = (await listRes.json()) as {
      data: Array<{
        id: number;
        type: string;
        refund_of_transaction_id: number | null;
      }>;
    };
    expect(list.data.length).toBeGreaterThan(0);
    const found = list.data.find((t) => t.id === refund.id);
    expect(found).toBeTruthy();
    expect(found?.type).toBe("refund");
    expect(found?.refund_of_transaction_id).toBe(expense.id);
  });

  test("refund recorrente é rejeitado pela API (v1)", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`${apiBase()}/v1/transactions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "refund",
        description: "E2E refund test - recorrente proibido",
        value: 10,
        payment_method: "pix",
        date: today,
        organization_id: orgId,
        tag_ids: [categoriaTagId],
        status: "confirmed",
        recurring: true,
      }),
    });
    expect(res.ok).toBeFalsy();
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
