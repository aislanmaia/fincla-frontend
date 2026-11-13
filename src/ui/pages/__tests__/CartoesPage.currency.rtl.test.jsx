/** @vitest-environment jsdom */

/**
 * #315 — a tela de Cartões escrevia todo valor com `"R$ " + número` (`formatBRL`) e
 * o eixo, o tooltip e a média das análises com "R$" chapado, qualquer que fosse a
 * moeda do cartão. A moeda do cartão é a da conta que liquida a fatura, e vem da API
 * (`currency`). Backend falso na camada HTTP (`installFakeCardsApi`).
 */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeCard, fakeInvoice, fakeItem, installFakeCardsApi } from "../../../test/fakeCardsApi.js";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));
// O eixo e a linha de média chamam o formatador como o recharts: os dublês põem o
// texto no DOM para a unidade aparecer.
vi.mock("recharts", () => {
  const passthrough = ({ children }) => <div>{children}</div>;
  const nothing = () => null;
  return {
    ResponsiveContainer: passthrough, BarChart: passthrough, Bar: passthrough, Cell: nothing, CartesianGrid: nothing,
    XAxis: nothing, Tooltip: nothing,
    YAxis: ({ tickFormatter }) => <span data-testid="y-tick">{tickFormatter?.(2000, 1)}</span>,
    ReferenceLine: ({ label }) => <span data-testid="ref-label">{label?.value}</span>,
  };
});

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

function renderLive(currency) {
  api = installFakeCardsApi({
    cards: [fakeCard({ id: 1, last4: "4580", closing_day: null, due_day: 10, description: "Viagem", currency })],
    today: TODAY,
    hiddenFromFuture: ["2026-11"],
    invoices: {
      1: [
        fakeInvoice({ year: 2026, month: 9, status: "open", closingDate: "2026-09-03", total: 40, items: [fakeItem({ id: 9, year: 2026, month: 9, amount: 40 })] }),
        fakeInvoice({ year: 2026, month: 10, status: "open", closingDate: "2026-10-03", total: 65, items: [fakeItem({ id: 1, year: 2026, month: 10, amount: 65 })] }),
        fakeInvoice({ year: 2026, month: 11, status: "open", closingDate: "2026-11-03", total: 35, items: [fakeItem({ id: 2, year: 2026, month: 11, amount: 35, description: "Padaria" })] }),
      ],
    },
  });
  return render(<CartoesPage onNav={vi.fn()} onNewItem={vi.fn()} isMobile={false} dataMode="live" organizationId="org-1" transactionsRefreshToken={0} />);
}
const text = () => document.body.textContent ?? "";
const user = () => userEvent.setup({ advanceTimers: () => {} });

describe("Cartões — moeda do cartão (#315)", () => {
  it("cartão em US$: fatura, análises e planejamento em US$, nenhum R$", async () => {
    renderLive("USD");
    await screen.findByText("Padaria");
    expect(text()).toContain("US$\u00a035,00");

    await user().click(screen.getAllByText("Análises")[0]);
    expect(screen.getAllByTestId("y-tick")[0]).toHaveTextContent("US$2.0k");
    expect(screen.getByTestId("ref-label").textContent).toMatch(/^Média US\$ /);

    await user().click(screen.getAllByText("Planejamento")[0]);
    expect(text()).toContain("US$ 0,00");
    expect(text()).not.toMatch(/R\$/);
  });

  it("cartão em R$: como antes", async () => {
    renderLive("BRL");
    await screen.findByText("Padaria");
    expect(text()).toContain("R$\u00a035,00");
    await user().click(screen.getAllByText("Análises")[0]);
    expect(screen.getAllByTestId("y-tick")[0]).toHaveTextContent("R$2.0k");
    expect(screen.getByTestId("ref-label").textContent).toMatch(/^Média R\$ /);
    await user().click(screen.getAllByText("Planejamento")[0]);
    expect(text()).toContain("R$ 0,00");
  });

  it("cartão sem moeda declarada: travessão, nunca R$", async () => {
    renderLive(undefined);
    await screen.findByText("Padaria");
    expect(text()).not.toMatch(/R\$/);
  });
});
