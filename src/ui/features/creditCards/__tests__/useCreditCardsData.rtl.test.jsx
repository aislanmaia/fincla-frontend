/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import * as adapter from "../../../data/creditCardsAdapter.js";
import { useCreditCardsData } from "../useCreditCardsData.js";

vi.mock("../../../data/creditCardsAdapter.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listCreditCardsForUi: vi.fn(),
  };
});

describe("useCreditCardsData (RTL)", () => {
  beforeEach(() => {
    vi.mocked(adapter.listCreditCardsForUi).mockResolvedValue({
      cards: [],
      consolidatedCommitments: null,
    });
  });

  it("recarrega lista quando transactionsRefreshToken muda", async () => {
    const { rerender } = renderHook(
      ({ token }) =>
        useCreditCardsData({
          organizationId: "org-1",
          enabled: true,
          transactionsRefreshToken: token,
        }),
      { initialProps: { token: 0 } },
    );

    await waitFor(() => {
      expect(adapter.listCreditCardsForUi).toHaveBeenCalled();
    });
    vi.mocked(adapter.listCreditCardsForUi).mockClear();

    rerender({ token: 1 });

    await waitFor(() => {
      expect(adapter.listCreditCardsForUi).toHaveBeenCalledTimes(1);
    });
    expect(adapter.listCreditCardsForUi).toHaveBeenCalledWith("org-1");
  });
});
