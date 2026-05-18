// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CancelSubscriptionDialog } from "../CancelSubscriptionDialog.jsx";

vi.mock("../../../../api/subscriptions", () => ({
  cancelSubscription: vi.fn(),
}));

import { cancelSubscription } from "../../../../api/subscriptions";

beforeEach(() => {
  vi.mocked(cancelSubscription).mockReset();
});
afterEach(cleanup);

describe("<CancelSubscriptionDialog>", () => {
  it("shows the effective-until date when provided", () => {
    render(
      <CancelSubscriptionDialog
        effectiveUntil="2026-07-01T00:00:00"
        onClose={vi.fn()}
        onCancelled={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/permanecerá ativa até 01\/07\/2026/i),
    ).toBeInTheDocument();
  });

  it("calls cancelSubscription and triggers onCancelled on confirm", async () => {
    vi.mocked(cancelSubscription).mockResolvedValue({
      subscription_id: "sub_x",
      status: "active",
      cancel_at_period_end: true,
      effective_until: "2026-07-01T00:00:00",
    });

    const handleCancelled = vi.fn();
    render(
      <CancelSubscriptionDialog
        effectiveUntil="2026-07-01T00:00:00"
        onClose={vi.fn()}
        onCancelled={handleCancelled}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /confirmar cancelamento/i }),
    );

    await waitFor(() => {
      expect(handleCancelled).toHaveBeenCalledTimes(1);
    });
    expect(cancelSubscription).toHaveBeenCalledTimes(1);
  });

  it("surfaces backend error inside the dialog", async () => {
    vi.mocked(cancelSubscription).mockRejectedValue(new Error("boom"));

    render(
      <CancelSubscriptionDialog
        effectiveUntil={null}
        onClose={vi.fn()}
        onCancelled={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /confirmar cancelamento/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
