// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountFormModal } from "../AccountFormModal.jsx";
import { AdjustBalanceModal } from "../AdjustBalanceModal.jsx";
import { TransferModal } from "../TransferModal.jsx";
import { clearCurrencyRegistry, setCurrencyRegistry } from "../../../money/currencyRegistry.js";

/**
 * #284: num campo em US$, "1,500" é mil e quinhentos — não 1,5. Em R$ nada muda:
 * "1.500" continua 1500 e "1,5" continua 1,5.
 */
beforeEach(() => setCurrencyRegistry([
  { code: "BRL", name: "Real brasileiro", symbol: "R$", decimal_places: 2, is_active: true },
  { code: "USD", name: "Dólar americano", symbol: "US$", decimal_places: 2, is_active: true },
]));
afterEach(() => {
  cleanup();
  clearCurrencyRegistry();
});

const CONTAS = [
  { account_id: "usd", name: "Wise USD", type: "checking", currency: "USD", balance: 0 },
  { account_id: "usd2", name: "Outra USD", type: "checking", currency: "USD", balance: 0 },
  { account_id: "brl", name: "Conta BRL", type: "checking", currency: "BRL", balance: 0 },
  { account_id: "brl2", name: "Outra BRL", type: "checking", currency: "BRL", balance: 0 },
];

function renderTransfer(from, to) {
  const onSubmit = vi.fn();
  render(<TransferModal accounts={CONTAS} onClose={() => {}} onSubmit={onSubmit} onQuote={() => new Promise(() => {})} />);
  const [fromSel, toSel] = screen.getAllByRole("combobox");
  fireEvent.change(fromSel, { target: { value: from } });
  fireEvent.change(toSel, { target: { value: to } });
  return onSubmit;
}

describe("TransferModal: cada valor lido na moeda da sua conta", () => {
  it("US$ → US$: '1,500' sai como 1500 e aparece '1.500,00' ao sair do campo", () => {
    const onSubmit = renderTransfer("usd", "usd2");
    const field = screen.getByLabelText("Valor");
    fireEvent.change(field, { target: { value: "1,500" } });
    fireEvent.blur(field);
    expect(field).toHaveValue("1.500,00");
    fireEvent.click(screen.getByText("Transferir"));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: 1500 }));
  });

  it("US$ ambíguo ('1234,567') = 'Valor inválido' e não transfere", () => {
    const onSubmit = renderTransfer("usd", "usd2");
    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "1234,567" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Valor inválido");
    fireEvent.click(screen.getByText("Transferir"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("R$ → US$: a saída em R$ como sempre ('1.500' = 1500), a entrada em US$ ('2,000.50' = 2000,50)", () => {
    const onSubmit = renderTransfer("brl", "usd");
    fireEvent.change(screen.getByLabelText("Valor que sai"), { target: { value: "1.500" } });
    fireEvent.change(screen.getByLabelText("Valor que entrou"), { target: { value: "2,000.50" } });
    fireEvent.click(screen.getByText("Transferir"));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: 1500, to_amount: 2000.5 }));
  });

  it("R$ → R$: '1,5' continua 1,5 (nada muda em real)", () => {
    const onSubmit = renderTransfer("brl", "brl2");
    const field = screen.getByLabelText("Valor");
    fireEvent.change(field, { target: { value: "1,5" } });
    fireEvent.blur(field);
    expect(field).toHaveValue("1,5");
    fireEvent.click(screen.getByText("Transferir"));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: 1.5 }));
  });
});

describe("AdjustBalanceModal: saldo desejado na moeda da conta", () => {
  const renderAdjust = (currency) => {
    const onSubmit = vi.fn();
    render(
      <AdjustBalanceModal account={{ id: "acc-1", name: "Conta", balance: 200, currency }} onClose={() => {}} onSubmit={onSubmit}
        isSaving={false} error="" loadAdjustments={vi.fn().mockResolvedValue([])} onDeleteAdjustment={vi.fn()} />,
    );
    return onSubmit;
  };
  const fillAndSave = (value) => {
    fireEvent.change(screen.getByLabelText("Saldo desejado"), { target: { value } });
    fireEvent.change(screen.getByPlaceholderText(/conciliação/i), { target: { value: "extrato" } });
    fireEvent.click(screen.getByText("Depois"));
    fireEvent.click(screen.getByText("Aplicar ajuste"));
  };

  it("conta em US$: '1,500' afirma 1500", () => {
    const onSubmit = renderAdjust("USD");
    fillAndSave("1,500");
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ asserted_balance: 1500 }));
  });

  it("conta em R$: '1.500' afirma 1500 (como sempre)", () => {
    const onSubmit = renderAdjust("BRL");
    fillAndSave("1.500");
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ asserted_balance: 1500 }));
  });
});

describe("AccountFormModal: saldo inicial na moeda escolhida", () => {
  it("conta em Dólar: '1,500' vira saldo inicial 1500", () => {
    const onSubmit = vi.fn();
    render(<AccountFormModal onClose={() => {}} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(/Conta corrente/i), { target: { value: "Conta lá fora" } });
    fireEvent.click(screen.getByText(/Dólar/i));
    fireEvent.change(screen.getByLabelText("Saldo inicial"), { target: { value: "1,500" } });
    fireEvent.click(screen.getByText(/Salvar conta/i));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ currency: "USD", initial_balance: 1500 }));
  });

  it("conta em Real: '1,5' continua 1,5", () => {
    const onSubmit = vi.fn();
    render(<AccountFormModal onClose={() => {}} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(/Conta corrente/i), { target: { value: "Minha conta" } });
    fireEvent.change(screen.getByLabelText("Saldo inicial"), { target: { value: "1,5" } });
    fireEvent.click(screen.getByText(/Salvar conta/i));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ currency: "BRL", initial_balance: 1.5 }));
  });
});
