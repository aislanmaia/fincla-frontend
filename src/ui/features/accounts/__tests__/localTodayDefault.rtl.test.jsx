// @vitest-environment jsdom
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AdjustBalanceModal } from "../AdjustBalanceModal.jsx";
import { TransferModal } from "../TransferModal.jsx";

/**
 * "Today" is the user's calendar day, not UTC's. At 23:30 in Brasília it is already
 * the next day in UTC: the modals used to pick tomorrow, and the API refused the
 * balance adjustment as "in the future".
 */
const originalTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Sao_Paulo";
});
afterAll(() => {
  process.env.TZ = originalTz;
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-11T02:30:00Z")); // 2026-11-10 23:30 in Brasília
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const dateInput = (container) => container.querySelector('input[type="date"]');

describe("account modals default to the local day", () => {
  it("AdjustBalanceModal starts on the local date and does not allow tomorrow", () => {
    const { container } = render(
      <AdjustBalanceModal
        account={{ id: "acc-1", name: "Conta principal", balance: 0 }}
        onClose={() => {}}
        onSubmit={vi.fn()}
        isSaving={false}
        error=""
        loadAdjustments={vi.fn().mockResolvedValue([])}
        onDeleteAdjustment={vi.fn()}
      />,
    );
    expect(dateInput(container).value).toBe("2026-11-10");
    expect(dateInput(container).max).toBe("2026-11-10");
  });

  it("TransferModal starts on the local date", () => {
    const { container } = render(
      <TransferModal
        accounts={[
          { account_id: "a", name: "Conta A", type: "checking", currency: "BRL", balance: 100 },
          { account_id: "b", name: "Conta B", type: "checking", currency: "BRL", balance: 0 },
        ]}
        onClose={() => {}}
        onSubmit={vi.fn()}
        onQuote={vi.fn()}
      />,
    );
    expect(dateInput(container).value).toBe("2026-11-10");
  });
});
