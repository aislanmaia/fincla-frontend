/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeCard, fakeInvoice, fakeItem, installFakeCardsApi } from "../../../test/fakeCardsApi.js";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

import { CartoesPage } from "../CartoesPage.jsx";

const TODAY = new Date(2026, 9, 4, 12, 0, 0);
let api;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  cleanup();
  api?.uninstall();
  vi.useRealTimers();
});

function renderLive() {
  const cards = [
    fakeCard({ id: 1, last4: "4580", closing_day: null, due_day: 10, description: "Primeiro" }),
    fakeCard({ id: 2, last4: "1234", closing_day: null, due_day: 5, description: "Segundo" }),
  ];
  api = installFakeCardsApi({
    cards,
    today: TODAY,
    hiddenFromFuture: ["2026-11"],
    latencyMs: 15,
    invoices: {
      1: [
        fakeInvoice({ year: 2026, month: 9, status: "open", closingDate: "2026-09-03", total: 40, items: [fakeItem({ id: 9, year: 2026, month: 9, amount: 40 })] }),
        fakeInvoice({ year: 2026, month: 10, status: "open", closingDate: "2026-10-03", total: 65, items: [fakeItem({ id: 1, year: 2026, month: 10, amount: 65 })] }),
        fakeInvoice({ year: 2026, month: 11, status: "open", closingDate: "2026-11-03", total: 35, items: [fakeItem({ id: 2, year: 2026, month: 11, amount: 35, description: "Padaria" })] }),
      ],
      2: [],
    },
  });
  return render(
    <CartoesPage
      onNav={vi.fn()}
      onNewItem={vi.fn()}
      isMobile={false}
      dataMode="live"
      organizationId="org-1"
      transactionsRefreshToken={0}
    />,
  );
}

describe("CartoesPage em dados reais: troca de cartão", () => {
  it("mostra a fatura atual real do primeiro cartão (compra só à vista no mês seguinte)", async () => {
    renderLive();
    expect(await screen.findByText("Padaria")).toBeInTheDocument();
    expect(screen.getAllByText(/Nov'26/).length).toBeGreaterThan(0);
  });

  it("ao trocar de cartão mantém a competência que estava em vista", async () => {
    renderLive();
    await screen.findByText("Padaria");
    const user = userEvent.setup({ advanceTimers: () => {} });
    await user.click(screen.getAllByText(/1234/)[0]);
    await waitFor(() => expect(screen.queryByText("Padaria")).not.toBeInTheDocument());
    expect(screen.getAllByText(/Nov'26/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText("ATUAL")).toEqual([]);
  });
});

describe("CartoesPage em dados reais: mês seguinte com fatura real", () => {
  it("navegar para o mês seguinte (sem status no histórico) lista os itens da fatura real", async () => {
    // Cartão com fechamento 15: outubro só com compra à vista; novembro (parcelado)
    // aparece nos compromissos futuros SEM status, mas a fatura existe e tem item.
    const card = fakeCard({ id: 1, last4: "1001", closing_day: 15, due_day: 25 });
    api = installFakeCardsApi({
      cards: [card],
      today: TODAY,
      latencyMs: 10,
      invoices: {
        1: [
          fakeInvoice({ year: 2026, month: 10, status: "open", closingDate: "2026-10-15", total: 120, items: [fakeItem({ id: 1, year: 2026, month: 10, amount: 120, description: "A cash out" })] }),
          fakeInvoice({ year: 2026, month: 11, status: "open", closingDate: "2026-11-15", total: 100, items: [fakeItem({ id: 2, year: 2026, month: 11, amount: 100, description: "A parcelado nov-jan", installment: 1, total: 3 })] }),
        ],
      },
    });
    render(
      <CartoesPage onNav={vi.fn()} onNewItem={vi.fn()} isMobile={false} dataMode="live" organizationId="org-1" transactionsRefreshToken={0} />,
    );
    await screen.findByText("A cash out");

    const user = userEvent.setup({ advanceTimers: () => {} });
    const next = screen.getAllByText("Atual")[0].parentElement.nextElementSibling;
    await user.click(next);

    expect(await screen.findByText("A parcelado nov-jan")).toBeInTheDocument();
  });
});
