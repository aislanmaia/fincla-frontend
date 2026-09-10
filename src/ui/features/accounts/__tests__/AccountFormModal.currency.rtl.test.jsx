// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountFormModal } from "../AccountFormModal.jsx";
import {
  clearCurrencyRegistry,
  setCurrencyRegistry,
} from "../../../money/currencyRegistry.js";

// O registro vem do backend (`GET /v1/currencies`, #136); aqui ele é semeado com
// o que produção tem, para o teste medir a TELA e não a requisição.
const REGISTRO = [
  { code: "BRL", name: "Real brasileiro", symbol: "R$", decimal_places: 2, is_active: true },
  { code: "EUR", name: "Euro", symbol: "€", decimal_places: 2, is_active: true },
  { code: "USD", name: "Dólar americano", symbol: "US$", decimal_places: 2, is_active: true },
];

beforeEach(() => setCurrencyRegistry(REGISTRO));
afterEach(() => {
  cleanup();
  clearCurrencyRegistry();
});

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

  it("na edição sem `currency_locked`, parte da moeda da conta e explica a regra", () => {
    // Sem o campo, a tela não sabe se esta conta tem movimento (`null` é "ninguém
    // perguntou"): ela mostra a moeda atual e explica a regra em termos gerais,
    // deixando o backend recusar se for o caso. A conta que SABE estar travada
    // recebe outra copy, presa em `AccountFormModal.lock.rtl.test.jsx`.
    renderModal({ account: { name: "Conta EUR", type: "checking", currency: "EUR" } });

    // O campo NÃO é escondido: o usuário não saberia que dá para corrigir.
    expect(screen.getByText(/Euro/i)).toBeInTheDocument();
    expect(screen.getByText(/enquanto a conta não tiver nenhum lançamento/i)).toBeInTheDocument();
  });

  it("a edição envia a moeda junto, para o backend decidir", () => {
    const onSubmit = renderModal({ account: { name: "Conta", type: "checking", currency: "BRL" } });
    fireEvent.click(screen.getByText(/Salvar conta/i));

    // Reenviar a moeda atual não é mudança e o backend não barra.
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ currency: "BRL" }));
  });
});
