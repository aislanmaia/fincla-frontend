import { describe, expect, it } from "vitest";
import { reserveView } from "../goalReserve.js";

const summary = (total, { currency = "BRL", rates = [] } = {}) => ({
  total_available: total,
  consolidation: currency ? { target_currency: currency, rates } : undefined,
});
const reserved = (byAccount, byGoal = []) => ({ totals: [], by_account: byAccount, by_goal: byGoal });
const inTotal = (...ids) => new Set(ids);

describe("reserveView — disponível = total − reservado que o total contém", () => {
  it("desconta o reservado em contas do total", () => {
    const v = reserveView(
      summary(5000),
      reserved([{ account_id: "main", currency: "BRL", amount: 400 }], [{ goal_id: "g1", name: "Viagem", currency: "BRL", amount: 400 }]),
      inTotal("main"),
    );
    expect(v).toMatchObject({ total: 5000, reserved: 400, free: 4600, goalCount: 1 });
  });

  it("conta fora do total não sai do total: ele nunca teve aquele dinheiro", () => {
    const v = reserveView(
      summary(3000),
      reserved([
        { account_id: "main", currency: "BRL", amount: 100 },
        { account_id: "invest", currency: "BRL", amount: 5000 },
      ]),
      inTotal("main"),
    );
    expect(v).toMatchObject({ reserved: 100, free: 2900 });
  });

  it("reserva em outra moeda é convertida pela cotação que consolidou o total", () => {
    const v = reserveView(
      summary(10000, { rates: [{ base: "EUR", quote: "BRL", rate: "6.0", quoted_on: "2026-11-09" }] }),
      reserved([{ account_id: "eur", currency: "EUR", amount: 100 }]),
      inTotal("eur"),
    );
    expect(v).toMatchObject({ reserved: 600, free: 9400 });
  });

  it("sem a cotação da reserva em outra moeda: não afirma disponível nenhum", () => {
    // Com reais reservados junto: pular o euro daria um disponível maior do que é.
    const v = reserveView(
      summary(10000),
      reserved([
        { account_id: "main", currency: "BRL", amount: 400 },
        { account_id: "eur", currency: "EUR", amount: 100 },
      ]),
      inTotal("main", "eur"),
    );
    expect(v).toBeNull();
  });

  it("gastos que comem a reserva viram disponível negativo, sem esconder", () => {
    const v = reserveView(summary(250), reserved([{ account_id: "main", currency: "BRL", amount: 400 }]), inTotal("main"));
    expect(v.free).toBe(-150);
  });

  it("sem reserva, sem leitura, sem contas, sem moeda ou sem total: nada muda na tela", () => {
    const r = reserved([{ account_id: "main", currency: "BRL", amount: 400 }]);
    expect(reserveView(summary(5000), reserved([]), inTotal("main"))).toBeNull();
    expect(reserveView(summary(5000), null, inTotal("main"))).toBeNull();
    expect(reserveView(summary(5000), r, null)).toBeNull();
    expect(reserveView(summary(5000, { currency: null }), r, inTotal("main"))).toBeNull();
    expect(reserveView({ total_available: null, consolidation: { target_currency: "BRL" } }, r, inTotal("main"))).toBeNull();
  });
});
