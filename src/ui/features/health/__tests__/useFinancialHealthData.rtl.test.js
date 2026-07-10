// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";

import { HEALTH_INSUFFICIENT_DATA, useFinancialHealthData } from "../useFinancialHealthData";
import { getFinancialHealth } from "../../../../api/financialHealth";

vi.mock("../../../../api/financialHealth", () => ({ getFinancialHealth: vi.fn() }));

// `globals: false` desliga o cleanup automático: sem isto os hooks vazam entre testes.
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const render = () => renderHook(() => useFinancialHealthData({ organizationId: "org-1" }));

describe("useFinancialHealthData: 422 insufficient_data", () => {
  it("sinaliza `insufficientData` em vez de um erro genérico", async () => {
    getFinancialHealth.mockRejectedValue({
      response: { status: 422, data: { detail: { code: HEALTH_INSUFFICIENT_DATA, message: "x" } } },
    });

    const { result } = render();

    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(result.current.insufficientData).toBe(true);
    // A copy é nossa: "Request failed with status code 422" nunca chega ao usuário.
    expect(result.current.error).toMatch(/Ainda não há transações registradas/);
    expect(result.current.data).toBeNull();
  });

  it("um erro real continua sendo erro, sem a flag", async () => {
    getFinancialHealth.mockRejectedValue({
      response: { status: 403, data: { detail: "Access denied" } },
    });

    const { result } = render();

    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(result.current.insufficientData).toBe(false);
    expect(result.current.error).toBe("Access denied");
  });
});
