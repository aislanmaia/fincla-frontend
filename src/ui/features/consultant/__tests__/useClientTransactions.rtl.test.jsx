// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../data/transactionsAdapter.js", () => ({
  listTransactionsForUi: vi.fn(),
  mapApiTransactionToUi: (transaction) => transaction,
}));

import { listTransactionsForUi } from "../../../data/transactionsAdapter.js";
import { useClientTransactions } from "../useClientTransactions.js";

describe("useClientTransactions", () => {
  beforeEach(() => {
    vi.mocked(listTransactionsForUi).mockReset();
    vi.mocked(listTransactionsForUi).mockResolvedValue({ data: [] });
  });

  it("encaminha o período do relatório e recarrega quando ele muda", async () => {
    const { rerender } = renderHook(
      (props) => useClientTransactions(props),
      {
        initialProps: {
          organizationId: "org-1",
          dateStart: "2026-08-01",
          dateEnd: "2026-08-31",
        },
      },
    );

    await waitFor(() => expect(listTransactionsForUi).toHaveBeenLastCalledWith({
      organization_id: "org-1",
      date_start: "2026-08-01",
      date_end: "2026-08-31",
      limit: 100,
      sort_by: "date",
      sort_order: "desc",
    }));

    rerender({
      organizationId: "org-1",
      dateStart: "2026-09-01",
      dateEnd: "2026-09-24",
    });

    await waitFor(() => expect(listTransactionsForUi).toHaveBeenLastCalledWith(expect.objectContaining({
      date_start: "2026-09-01",
      date_end: "2026-09-24",
    })));
    expect(listTransactionsForUi).toHaveBeenCalledTimes(2);
  });
});
