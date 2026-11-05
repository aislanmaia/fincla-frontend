// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdjustBalanceModal } from "../AdjustBalanceModal.jsx";
import { clearCurrencyRegistry, setCurrencyRegistry } from "../../../money/currencyRegistry.js";

/**
 * #289 — "Ajustar saldo" numa conta em dólar mostrava o saldo com "R$" e o campo
 * pedia "R$ 0,00": o número certo com a unidade errada. Tudo nesta tela é da conta.
 */
const REGISTRO = [
  { code: "BRL", name: "Real brasileiro", symbol: "R$", decimal_places: 2, is_active: true },
  { code: "USD", name: "Dólar americano", symbol: "US$", decimal_places: 2, is_active: true },
];
beforeEach(() => setCurrencyRegistry(REGISTRO));
afterEach(() => {
  cleanup();
  clearCurrencyRegistry();
});

const renderFor = (account, history = []) =>
  render(
    <AdjustBalanceModal
      account={account}
      onClose={() => {}}
      onSubmit={vi.fn()}
      isSaving={false}
      error=""
      loadAdjustments={vi.fn().mockResolvedValue(history)}
      onDeleteAdjustment={vi.fn()}
    />,
  );

describe("<AdjustBalanceModal> na moeda da conta", () => {
  it("conta em US$: saldo, campo, ajuste e histórico em US$, nada em R$", async () => {
    const { container } = renderFor(
      { id: "acc-usd", name: "Wise", balance: 200, currency: "USD" },
      [{ id: "adj-1", amount: 25, date: "2026-10-01", reason: "extrato", includes_same_day: true }],
    );

    expect(screen.getByPlaceholderText("US$ 0,00")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("US$ 0,00"), { target: { value: "150" } });
    await screen.findByText(/extrato/);

    const text = container.textContent;
    expect(text).toMatch(/US\$\s200,00/);
    expect(text).toMatch(/-\s?US\$\s50,00/);
    expect(text).toMatch(/\+US\$\s25,00/);
    expect(text).not.toContain("R$");
  });

  it("conta em R$ segue exatamente como era", () => {
    const { container } = renderFor({ id: "acc-brl", name: "Itaú", balance: 200, currency: "BRL" });
    expect(screen.getByPlaceholderText("R$ 0,00")).toBeInTheDocument();
    expect(container.textContent).toMatch(/R\$\s200,00/);
  });
});
