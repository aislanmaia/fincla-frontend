// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

import { AccountFormModal } from "../AccountFormModal.jsx";

/**
 * Sem seletor de moeda, a conta em dólar era inalcançável pela tela: o backend
 * aceitava desde o registro de moedas, e nenhum usuário conseguia pedir.
 */
const renderModal = (props = {}) => {
  const onSubmit = vi.fn();
  render(<AccountFormModal onClose={() => {}} onSubmit={onSubmit} {...props} />);
  return onSubmit;
};

describe("AccountFormModal: moeda", () => {
  it("cria em real por padrão — quem não escolhe nada não muda de comportamento", () => {
    const onSubmit = renderModal();
    fireEvent.change(screen.getByPlaceholderText(/Conta corrente/i), { target: { value: "Minha conta" } });
    fireEvent.click(screen.getByText(/Salvar conta/i));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ currency: "BRL" }));
  });

  it("envia a moeda escolhida", () => {
    const onSubmit = renderModal();
    fireEvent.change(screen.getByPlaceholderText(/Conta corrente/i), { target: { value: "Conta lá fora" } });
    fireEvent.click(screen.getByText(/Dólar/i));
    fireEvent.click(screen.getByText(/Salvar conta/i));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ currency: "USD" }));
  });

  it("o placeholder do saldo inicial segue a moeda escolhida", () => {
    // "R$ 0,00" numa conta em euro pede o número na unidade errada.
    renderModal();
    expect(screen.getByPlaceholderText("R$ 0,00")).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Euro/i));
    expect(screen.getByPlaceholderText("€ 0,00")).toBeInTheDocument();
  });

  it("na edição, parte da moeda da conta e explica a trava", () => {
    renderModal({ account: { name: "Conta EUR", type: "checking", currency: "EUR" } });

    // O campo NÃO é escondido: o usuário não saberia que dá para corrigir.
    expect(screen.getByText(/Euro/i)).toBeInTheDocument();
    expect(screen.getByText(/não tem nenhum lançamento/i)).toBeInTheDocument();
  });

  it("a edição envia a moeda junto, para o backend decidir", () => {
    const onSubmit = renderModal({ account: { name: "Conta", type: "checking", currency: "BRL" } });
    fireEvent.click(screen.getByText(/Salvar conta/i));

    // Reenviar a moeda atual não é mudança e o backend não barra.
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ currency: "BRL" }));
  });
});
