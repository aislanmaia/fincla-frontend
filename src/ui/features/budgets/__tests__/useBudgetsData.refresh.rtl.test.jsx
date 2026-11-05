/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #300 (revisão) — hook real; o dublê são os leitores/escritores do adapter.
 */
const listBudgetsMock = vi.fn();
const createBudgetMock = vi.fn();
vi.mock("../../../data/budgetsAdapter.js", async (importOriginal) => ({
  ...(await importOriginal()),
  listBudgetsForUi: (...args) => listBudgetsMock(...args),
  listBudgetCategoryChoicesForUi: () => Promise.resolve([]),
  listBudgetHistoryForUi: () => Promise.resolve({ months: [] }),
  createBudgetForUi: (...args) => createBudgetMock(...args),
}));
import { useBudgetsData } from "../useBudgetsData.js";

const row = (id, spent = "10.00") => ({ id, tag_id: `t-${id}`, tag_name: id, amount: "100.00", spent_amount: spent,
  remaining_amount: "90.00", currency: "BRL", status: "ok", period_type: "monthly", is_active: true });
const body = (...budgetIds) => ({ budgets: budgetIds.map((id) => row(id)) });
const ids = (hook) => hook.current.data?.cats.map((c) => c.id) ?? [];
const deferred = () => { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

beforeEach(() => listBudgetsMock.mockResolvedValue(body("b1")));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useBudgetsData — revisão do #300", () => {
  it("org A ok, org B falha, volta à A: leitura nova (carregando, sem o erro da B)", async () => {
    const { result, rerender } = renderHook(({ org }) => useBudgetsData({ organizationId: org }), { initialProps: { org: "org-a" } });
    await waitFor(() => expect(ids(result)).toEqual(["b1"]));

    listBudgetsMock.mockRejectedValueOnce(new Error("boom"));
    rerender({ org: "org-b" });
    await waitFor(() => expect(result.current.error).not.toBe(""));

    const gate = deferred();
    listBudgetsMock.mockImplementationOnce(() => gate.promise);
    rerender({ org: "org-a" });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe("");
    await act(async () => gate.resolve(body("b1")));
    await waitFor(() => expect(ids(result)).toEqual(["b1"]));
  });

  it("recarga velha que chega DEPOIS do POST não apaga o orçamento novo", async () => {
    const { result, rerender } = renderHook(({ k }) => useBudgetsData({ organizationId: "org-a", refreshKey: k }), { initialProps: { k: 0 } });
    await waitFor(() => expect(ids(result)).toEqual(["b1"]));

    // A recarga começa ANTES do POST e responde com a lista sem o b2…
    const staleRefresh = deferred();
    listBudgetsMock.mockImplementationOnce(() => staleRefresh.promise);
    rerender({ k: 1 });

    createBudgetMock.mockResolvedValueOnce({});
    listBudgetsMock.mockResolvedValue(body("b1", "b2"));
    await act(async () => { await result.current.createBudget({ tag_id: "t-b2", amount: 100 }); });
    expect(ids(result)).toEqual(["b1", "b2"]);

    // …e só chega depois da releitura da mutação: descartada.
    await act(async () => staleRefresh.resolve(body("b1")));
    expect(ids(result)).toEqual(["b1", "b2"]);
  });

  it("recarga que chega durante um POST não reabre o Salvar e não apaga o orçamento novo", async () => {
    const { result, rerender } = renderHook(({ k }) => useBudgetsData({ organizationId: "org-a", refreshKey: k }), { initialProps: { k: 0 } });
    await waitFor(() => expect(ids(result)).toEqual(["b1"]));

    // A recarga começa ANTES do POST e responde com a lista sem o b2.
    const staleRefresh = deferred();
    listBudgetsMock.mockImplementationOnce(() => staleRefresh.promise);
    rerender({ k: 1 });

    const post = deferred();
    createBudgetMock.mockImplementationOnce(() => post.promise);
    let saving;
    act(() => { saving = result.current.createBudget({ tag_id: "t-b2", amount: 100 }); });
    await waitFor(() => expect(result.current.isSaving).toBe(true));

    // A recarga velha chega no meio do POST: descartada — Salvar continua travado.
    await act(async () => staleRefresh.resolve(body("b1")));
    expect(result.current.isSaving).toBe(true);

    listBudgetsMock.mockResolvedValue(body("b1", "b2"));
    await act(async () => { post.resolve({}); await saving; });
    expect(result.current.isSaving).toBe(false);
    expect(ids(result)).toEqual(["b1", "b2"]);
  });

  it("recarga que começa DURANTE o POST é aceita, mas não zera isSaving", async () => {
    const { result, rerender } = renderHook(({ k }) => useBudgetsData({ organizationId: "org-a", refreshKey: k }), { initialProps: { k: 0 } });
    await waitFor(() => expect(ids(result)).toEqual(["b1"]));

    const post = deferred();
    createBudgetMock.mockImplementationOnce(() => post.promise);
    let saving;
    act(() => { saving = result.current.createBudget({ tag_id: "t-b2", amount: 100 }); });
    await waitFor(() => expect(result.current.isSaving).toBe(true));

    const before = listBudgetsMock.mock.calls.length;
    listBudgetsMock.mockResolvedValueOnce(body("b1"));
    rerender({ k: 1 });
    await waitFor(() => expect(listBudgetsMock.mock.calls.length).toBeGreaterThan(before));
    await act(async () => {});
    expect(result.current.isSaving).toBe(true);

    listBudgetsMock.mockResolvedValue(body("b1", "b2"));
    await act(async () => { post.resolve({}); await saving; });
    expect(ids(result)).toEqual(["b1", "b2"]);
  });
});
