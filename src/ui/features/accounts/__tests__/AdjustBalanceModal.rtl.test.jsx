// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdjustBalanceModal } from "../AdjustBalanceModal.jsx";

afterEach(cleanup);

const account = { id: "acc-1", name: "Conta principal", balance: 200 };

function setup(overrides = {}) {
  const onSubmit = vi.fn();
  const onDeleteAdjustment = vi.fn().mockResolvedValue(undefined);
  const loadAdjustments = vi.fn().mockResolvedValue(overrides.history ?? []);
  const utils = render(
    <AdjustBalanceModal
      account={account}
      onClose={() => {}}
      onSubmit={onSubmit}
      isSaving={false}
      error=""
      loadAdjustments={loadAdjustments}
      onDeleteAdjustment={onDeleteAdjustment}
    />,
  );
  return { ...utils, onSubmit, onDeleteAdjustment, loadAdjustments };
}

describe("<AdjustBalanceModal>", () => {
  it("mostra saldo atual e calcula o delta a partir do saldo desejado", () => {
    const { getByPlaceholderText, container } = setup();
    expect(container.textContent).toContain("Saldo atual");
    expect(container.textContent).toContain("200,00");
    fireEvent.change(getByPlaceholderText("R$ 0,00"), { target: { value: "150" } });
    // delta = 150 - 200 = -50
    expect(container.textContent).toContain("Ajuste a aplicar");
    expect(container.textContent).toMatch(/-\s?R\$\s?50,00/);
  });

  it("submete amount = desejado − atual, com justificativa e data", () => {
    const { getByPlaceholderText, getByText, onSubmit } = setup();
    fireEvent.change(getByPlaceholderText("R$ 0,00"), { target: { value: "150" } });
    fireEvent.change(getByPlaceholderText(/conciliação/i), { target: { value: "reconc extrato" } });
    fireEvent.click(getByText("Aplicar ajuste"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.amount).toBe(-50);
    expect(arg.reason).toBe("reconc extrato");
    expect(arg.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("não submete sem justificativa ou sem delta", () => {
    const { getByPlaceholderText, getByText, onSubmit } = setup();
    // desired = current -> delta 0
    fireEvent.change(getByPlaceholderText("R$ 0,00"), { target: { value: "200" } });
    fireEvent.change(getByPlaceholderText(/conciliação/i), { target: { value: "x" } });
    fireEvent.click(getByText("Aplicar ajuste"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("carrega e exclui ajustes do histórico", async () => {
    const history = [{ id: "adj-1", amount: -100, date: "2026-05-29", reason: "reconc maio", created_at: "x" }];
    const { findByText, getByLabelText, onDeleteAdjustment } = setup({ history });
    expect(await findByText("reconc maio")).toBeTruthy();
    fireEvent.click(getByLabelText("Excluir ajuste"));
    await waitFor(() => expect(onDeleteAdjustment).toHaveBeenCalledWith("adj-1"));
  });
});
