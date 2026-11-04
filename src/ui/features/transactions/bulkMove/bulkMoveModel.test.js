import { describe, expect, it } from "vitest";

import { buildMovePayload, moveIneligibility, planBulkMove, rowCurrency, runWithConcurrency, suggestedMoveValue } from "./bulkMoveModel.js";

const A = { id: "acc-a", currency: "BRL" };
const B = { id: "acc-b", currency: "BRL" };
const W = { id: "acc-w", currency: "USD" };
const tx = (extra = {}) => ({
  id: 1, desc: "Jantar", val: -287.15, paymentMethodKey: "pix", categoryTagId: "cat", detailTagIds: [],
  dateIsoForEdit: "2026-11-10", rec: false, accountId: "acc-a", currency: "BRL", settleable: true, seriesId: null, type: "expense", ...extra,
});

describe("moveIneligibility", () => {
  it("cartão, recorrência, transferência, mesma conta", () => {
    expect(moveIneligibility(tx({ settleable: false }), B)).toMatch(/cartão/);
    expect(moveIneligibility(tx({ seriesId: "s" }), B)).toMatch(/recorrência/);
    expect(moveIneligibility(tx({ kind: "transfer" }), B)).toMatch(/Transferência/);
    expect(moveIneligibility(tx(), A)).toBe("Já está nessa conta");
    expect(moveIneligibility(tx(), B)).toBeNull();
  });
  it("estornos só são barrados ENTRE moedas", () => {
    expect(moveIneligibility(tx({ type: "refund", val: 50 }), B)).toBeNull();
    expect(moveIneligibility(tx({ type: "refund", val: 50 }), W)).toMatch(/Estorno/);
    expect(moveIneligibility(tx({ refundsSummary: { count: 1 } }), B)).toBeNull();
    expect(moveIneligibility(tx({ refundsSummary: { count: 1 } }), W)).toMatch(/estorno ligado/);
  });
  it("moeda desconhecida (linha e conta) nunca vira BRL", () => {
    expect(rowCurrency(tx({ currency: null }))).toBeNull();
    expect(moveIneligibility(tx({ currency: null }), B)).toBe("Moeda desconhecida");
    expect(moveIneligibility(tx({ currency: null }), B, "USD")).toBeNull();
    expect(moveIneligibility(tx(), { id: "acc-x", currency: null })).toBe("Moeda da conta de destino desconhecida");
  });
});

describe("planBulkMove", () => {
  it("separa mesma moeda, grupos por moeda de origem e inelegíveis", () => {
    const plan = planBulkMove([tx({ id: 1 }), tx({ id: 2, currency: "EUR" }), tx({ id: 3, settleable: false })], W);
    expect(plan.sameCurrency).toHaveLength(0);
    expect(plan.crossGroups.map((g) => g.from).sort()).toEqual(["BRL", "EUR"]);
    expect(plan.ineligible.map((i) => i.tx.id)).toEqual([3]);
  });
});

describe("suggestedMoveValue", () => {
  it("converter = origem ÷ taxa (HALF_UP); manter = o mesmo número; sem taxa = vazio (nunca taxa 1)", () => {
    expect(suggestedMoveValue(tx(), "convert", "5.4914")).toBe("52,29");
    expect(suggestedMoveValue(tx(), "keep", "5.4914")).toBe("287,15");
    expect(suggestedMoveValue(tx(), "keep", null)).toBe("287,15");
    expect(suggestedMoveValue(tx(), "convert", null)).toBe("");
  });
});

describe("buildMovePayload", () => {
  it("mesma moeda: só account_id (e a data obrigatória)", () => {
    const p = buildMovePayload(tx(), "acc-b");
    expect(p.account_id).toBe("acc-b");
    expect(p).not.toHaveProperty("value");
    expect(p).not.toHaveProperty("value_currency");
    expect(p).not.toHaveProperty("description");
  });
  it("entre moedas: account_id + value + value_currency", () => {
    expect(buildMovePayload(tx(), "acc-w", { value: 52.29, currency: "USD" })).toMatchObject({
      account_id: "acc-w", value: 52.29, value_currency: "USD",
    });
  });
});

describe("runWithConcurrency", () => {
  it("no máximo N em voo, resultados na ordem, falhas por item", async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await runWithConcurrency([1, 2, 3, 4, 5], 3, async (n) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      if (n === 4) throw new Error("x");
      return n * 10;
    });
    expect(peak).toBe(3);
    expect(out.map((r) => r.ok)).toEqual([true, true, true, false, true]);
    expect(out[0].value).toBe(10);
  });
});
