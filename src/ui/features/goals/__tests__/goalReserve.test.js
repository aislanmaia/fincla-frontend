import { describe, expect, it } from "vitest";
import { reserveView } from "../goalReserve.js";

const summary = (total, currency = "BRL") => ({ total_available: total, consolidation: currency ? { target_currency: currency } : undefined });
const reserved = (totals, byGoal = []) => ({ totals, by_account: [], by_goal: byGoal });

describe("reserveView — disponível = total − reservado", () => {
  it("desconta só o reservado na moeda do total", () => {
    const v = reserveView(summary(5000), reserved(
      [{ currency: "BRL", amount: 400 }, { currency: "EUR", amount: 100 }],
      [{ goal_id: "g1", name: "Viagem", currency: "BRL", amount: 400 }, { goal_id: "g2", name: "Lisboa", currency: "EUR", amount: 100 }],
    ));
    expect(v).toMatchObject({ total: 5000, reserved: 400, free: 4600, goalCount: 1 });
    expect(v.elsewhere).toEqual([{ currency: "EUR", amount: 100 }]);
  });

  it("gastos que comem a reserva viram disponível negativo, sem esconder", () => {
    expect(reserveView(summary(250), reserved([{ currency: "BRL", amount: 400 }])).free).toBe(-150);
  });

  it("sem reserva, sem leitura de reserva, sem moeda ou sem total: nada muda na tela", () => {
    expect(reserveView(summary(5000), reserved([]))).toBeNull();
    expect(reserveView(summary(5000), null)).toBeNull();
    expect(reserveView(summary(5000, null), reserved([{ currency: "BRL", amount: 400 }]))).toBeNull();
    expect(reserveView({ total_available: null, consolidation: { target_currency: "BRL" } }, reserved([{ currency: "BRL", amount: 400 }]))).toBeNull();
  });
});
