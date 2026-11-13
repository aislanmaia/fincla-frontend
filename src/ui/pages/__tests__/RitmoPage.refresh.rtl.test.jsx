/** @vitest-environment jsdom */

/**
 * #272 — depois de lançar uma despesa, o Ritmo seguia com o gasto antigo até o F5.
 * `useSpendingPaceData` roda de verdade; o dublê é a leitura das transações e dos
 * orçamentos no adapter (o limite HTTP). O mês é o corrente, sem orçamento: a tela
 * mostra a curva e o total gasto.
 */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
vi.mock("recharts", () => {
  const passthrough = ({ children }) => <div>{children}</div>;
  const nothing = () => null;
  return {
    ResponsiveContainer: passthrough, AreaChart: passthrough, BarChart: passthrough, ComposedChart: passthrough,
    LineChart: passthrough, Area: nothing, Bar: nothing, Line: nothing, Cell: nothing, XAxis: nothing,
    YAxis: nothing, CartesianGrid: nothing, Tooltip: nothing, ReferenceLine: nothing, ReferenceDot: nothing,
    Legend: nothing,
  };
});

// Base em real, já resolvida: aqui o assunto é a recarga. A moeda (#310) está em
// RitmoPage.currency.rtl.test.jsx, pela rede.
vi.mock("../../money/useOrganizationBaseCurrency.js", () => ({
  useOrganizationBaseCurrency: () => ({ status: "ready", currency: "BRL" }),
}));

const fetchTxMock = vi.fn();
vi.mock("../../data/dashboardAdapter.js", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchAllTransactionsPages: (...args) => fetchTxMock(...args),
}));
vi.mock("../../data/budgetsAdapter.js", async (importOriginal) => ({
  ...(await importOriginal()),
  listBudgetsForUi: () => Promise.resolve({ budgets: [] }),
}));

import { RitmoPage } from "../RitmoPage.jsx";

const today = new Date();
const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
const txPage = (value) => ({
  data: [{ id: 1, type: "expense", value, amount: -value, date: `${ymd}T12:00:00`, payment_method: "pix", tags: {} }],
  pagination: { has_next: false },
});

let gate;
beforeEach(() => {
  gate = null;
  fetchTxMock.mockImplementation(() => Promise.resolve(txPage(123)));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const page = (token) => <RitmoPage dataMode="live" organizationId="org-1" onNav={vi.fn()} transactionsRefreshToken={token} />;
const text = () => document.body.textContent ?? "";

describe("Ritmo — recarrega depois de uma transação (#272)", () => {
  it("o token de transação salva relê e a tela mostra o gasto novo", async () => {
    const { rerender } = render(page(0));
    await waitFor(() => expect(text()).toContain("123"));

    fetchTxMock.mockImplementation(() => Promise.resolve(txPage(987)));
    rerender(page(1));

    await waitFor(() => expect(text()).toContain("987"));
    expect(fetchTxMock).toHaveBeenCalledTimes(2);
  });

  it("durante a recarga o gráfico anterior continua (sem piscar 'carregando')", async () => {
    const { rerender } = render(page(0));
    await waitFor(() => expect(text()).toContain("123"));

    fetchTxMock.mockImplementation(() => new Promise((resolve) => { gate = () => resolve(txPage(987)); }));
    rerender(page(1));
    await waitFor(() => expect(fetchTxMock).toHaveBeenCalledTimes(2));

    expect(text()).toContain("123");
    expect(screen.queryByText(/Carregando/i)).toBeNull();
    gate();
    await waitFor(() => expect(text()).toContain("987"));
  });

  it("uma falha na recarga não apaga o que se sabia e avisa que os números são os anteriores", async () => {
    const { rerender } = render(page(0));
    await waitFor(() => expect(text()).toContain("123"));

    fetchTxMock.mockImplementation(() => Promise.reject(new Error("boom")));
    rerender(page(1));

    expect(await screen.findByText(/Não foi possível atualizar o ritmo agora/)).toBeInTheDocument();
    expect(text()).toContain("123");
  });
});
