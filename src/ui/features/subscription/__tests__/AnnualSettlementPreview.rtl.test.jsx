// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { AnnualSettlementPreview } from "../AnnualSettlementPreview.jsx";

vi.mock("../../../../api/subscriptions", () => ({
  getAnnualSettlementRequests: vi.fn().mockResolvedValue([]),
  requestAnnualSettlement: vi.fn(),
}));

import { requestAnnualSettlement } from "../../../../api/subscriptions";

const selection = {
  persona: "consultant",
  billing_cycle: "yearly",
  mode: "progressive",
  seats: 4,
  package_size: null,
};

beforeEach(() => vi.mocked(requestAnnualSettlement).mockReset());

it("normalizes package seats and shows the server-calculated capacity before acceptance", async () => {
  vi.mocked(requestAnnualSettlement).mockResolvedValue({
    status: "preview",
    amount_due_cents: 1000,
    effective_capacity: 25,
    message: "Revise a proposta e confirme para registrar a solicitação.",
  });
  const user = userEvent.setup();
  render(<AnnualSettlementPreview selection={selection} />);

  await user.click(screen.getByLabelText("Pacote", { exact: false }));
  expect(screen.getByLabelText("Vagas que você quer contratar")).toHaveValue(25);
  await user.click(screen.getByRole("button", { name: "Ver valor da alteração" }));

  expect(requestAnnualSettlement).toHaveBeenCalledWith({
    target: { ...selection, mode: "package", package_size: 25, seats: 25 },
    strategy: "preserve_anniversary",
    accept: false,
  });
  expect(await screen.findByText("Capacidade resultante: 25 vagas.")).toBeInTheDocument();
});
