/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

/**
 * "+ Aportar" tem de mover a meta: o aporte vira uma contribuição (POST
 * /goals/{id}/contributions) e a meta volta do servidor com o `current_amount`
 * novo — ele é derivado das contribuições, não há outro jeito de a barra andar.
 */

const contributeToGoal = vi.fn();
const listGoals = vi.fn();
vi.mock("../../../../api/goals", () => ({
  contributeToGoal: (...a) => contributeToGoal(...a),
  listGoals: (...a) => listGoals(...a),
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
}));

import { useGoalsData } from "../useGoalsData.js";

const goal = (current) => ({
  id: "g1", name: "Viagem", description: null, target_amount: 6000, current_amount: current,
  deadline: "2027-12-01", status: "active", type: "travel", term: null, priority: 2,
  monthly_target: 400, annual_return_rate: null, currency: "BRL",
});

afterEach(() => vi.clearAllMocks());

describe("useGoalsData.contribute", () => {
  it("registra a contribuição na meta e recarrega o progresso", async () => {
    listGoals.mockResolvedValueOnce([goal(0)]).mockResolvedValueOnce([goal(400)]);
    contributeToGoal.mockResolvedValue({ id: "c1" });
    const { result } = renderHook(() => useGoalsData({ organizationId: "org-1" }));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(result.current.goals[0].atual).toBe(0);

    await act(() => result.current.contribute("g1", { amount: 400, contributed_at: "2026-11-05", note: null }));

    expect(contributeToGoal).toHaveBeenCalledWith("g1", "org-1", { amount: 400, contributed_at: "2026-11-05", note: null });
    expect(result.current.goals[0].atual).toBe(400);
    expect(result.current.isSaving).toBe(false);
  });

  it("erro do servidor fica em `error` e a meta não muda", async () => {
    listGoals.mockResolvedValueOnce([goal(0)]);
    contributeToGoal.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useGoalsData({ organizationId: "org-1" }));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    await act(async () => {
      await expect(result.current.contribute("g1", { amount: 400 })).rejects.toThrow();
    });

    expect(result.current.error).not.toBe("");
    expect(result.current.goals[0].atual).toBe(0);
    expect(listGoals).toHaveBeenCalledTimes(1);
  });
});
