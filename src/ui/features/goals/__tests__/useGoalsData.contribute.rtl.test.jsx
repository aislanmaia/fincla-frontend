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
const getGoal = vi.fn();
vi.mock("../../../../api/goals", () => ({
  contributeToGoal: (...a) => contributeToGoal(...a),
  listGoals: (...a) => listGoals(...a),
  getGoal: (...a) => getGoal(...a),
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
}));

import { useGoalsData } from "../useGoalsData.js";

const goal = (current, id = "g1") => ({
  id, name: "Viagem", description: null, target_amount: 6000, current_amount: current,
  deadline: "2027-12-01", status: "active", type: "travel", term: null, priority: 2,
  monthly_target: 400, annual_return_rate: null, currency: "BRL",
});

afterEach(() => vi.clearAllMocks());

async function loaded(org = "org-1") {
  const hook = renderHook(({ organizationId }) => useGoalsData({ organizationId }), { initialProps: { organizationId: org } });
  await waitFor(() => expect(hook.result.current.hasLoaded).toBe(true));
  return hook;
}

describe("useGoalsData.contribute", () => {
  it("registra a contribuição na meta e relê só ela", async () => {
    listGoals.mockResolvedValueOnce([goal(0), goal(100, "g2")]);
    contributeToGoal.mockResolvedValue({ id: "c1" });
    getGoal.mockResolvedValue(goal(400));
    const { result } = await loaded();

    await act(() => result.current.contribute("g1", { amount: 400, contributed_at: "2026-11-05", note: null }));

    expect(contributeToGoal).toHaveBeenCalledWith("g1", "org-1", { amount: 400, contributed_at: "2026-11-05", note: null });
    expect(getGoal).toHaveBeenCalledWith("g1", "org-1");
    expect(result.current.goals.map((g) => g.atual)).toEqual([400, 100]);
    expect(result.current.isSaving).toBe(false);
    expect(listGoals).toHaveBeenCalledTimes(1);
  });

  it("POST recusado rejeita com a mensagem e não suja o erro da página", async () => {
    listGoals.mockResolvedValueOnce([goal(0)]);
    contributeToGoal.mockRejectedValue(new Error("boom"));
    const { result } = await loaded();

    await act(async () => {
      await expect(result.current.contribute("g1", { amount: 400 })).rejects.toThrow();
    });

    expect(result.current.error).toBe("");
    expect(result.current.goals[0].atual).toBe(0);
    expect(result.current.isSaving).toBe(false);
  });

  it("gravou mas a releitura falhou: resolve (não convida a repetir) e avisa a página", async () => {
    listGoals.mockResolvedValueOnce([goal(0)]);
    contributeToGoal.mockResolvedValue({ id: "c1" });
    getGoal.mockRejectedValue(new Error("timeout"));
    const { result } = await loaded();

    await act(async () => {
      await expect(result.current.contribute("g1", { amount: 400 })).resolves.toEqual({ id: "c1" });
    });

    expect(result.current.error).toMatch(/Aporte registrado/);
    expect(result.current.isSaving).toBe(false);
  });

  it("falha atrasada de outra organização não deixa aviso na organização atual", async () => {
    listGoals.mockResolvedValueOnce([goal(0)]).mockResolvedValueOnce([goal(50, "b1")]);
    contributeToGoal.mockResolvedValue({ id: "c1" });
    let fail;
    getGoal.mockReturnValue(new Promise((_, reject) => { fail = reject; }));
    const hook = await loaded("org-a");

    let pending;
    act(() => { pending = hook.result.current.contribute("g1", { amount: 400 }); });
    hook.rerender({ organizationId: "org-b" });
    await waitFor(() => expect(hook.result.current.goals[0]?.id).toBe("b1"));
    await act(async () => { fail(new Error("timeout")); await pending; });

    expect(hook.result.current.error).toBe("");
    expect(hook.result.current.goals.map((g) => g.id)).toEqual(["b1"]);
  });
});
