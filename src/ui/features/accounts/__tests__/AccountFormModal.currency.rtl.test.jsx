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

    // O caso do smoke em prod (#289): US$ escolhido, placeholder em US$.
    fireEvent.click(screen.getByText(/Dólar/i));
    expect(screen.getByPlaceholderText("US$ 0,00")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("R$ 0,00")).toBeNull();
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

/**
 * #290 — trocar a moeda depois de digitar o saldo inicial mudava o significado do
 * número sem aviso: "1,500" em R$ (1,5) virava 1.500 em US$. O texto é relido na
 * moeda ANTIGA e reescrito na nova com o MESMO número.
 */
describe("AccountFormModal: trocar a moeda com o saldo já digitado (#290)", () => {
  const fillName = () =>
    fireEvent.change(screen.getByPlaceholderText(/Conta corrente/i), { target: { value: "Conta" } });
  const field = () => screen.getByRole("textbox", { name: "Saldo inicial" });

  it("R$ → US$: '1,500' (1,5) vira '1,50' no campo e 1,5 no envio", () => {
    const onSubmit = renderModal();
    fillName();
    fireEvent.change(field(), { target: { value: "1,500" } });
    fireEvent.click(screen.getByText(/Dólar/i));

    expect(field()).toHaveValue("1,50");
    fireEvent.click(screen.getByText(/Salvar conta/i));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ currency: "USD", initial_balance: 1.5 }));
  });

  it("US$ → R$: '1,500' (1.500) vira '1.500,00' no campo e 1500 no envio", () => {
    const onSubmit = renderModal();
    fillName();
    fireEvent.click(screen.getByText(/Dólar/i));
    fireEvent.change(field(), { target: { value: "1,500" } });
    fireEvent.click(screen.getByText(/Real/i));

    expect(field()).toHaveValue("1.500,00");
    fireEvent.click(screen.getByText(/Salvar conta/i));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ currency: "BRL", initial_balance: 1500 }));
  });

  it("US$ → R$: '52.40' (52,40) continua 52,40", () => {
    const onSubmit = renderModal();
    fillName();
    fireEvent.click(screen.getByText(/Dólar/i));
    fireEvent.change(field(), { target: { value: "52.40" } });
    fireEvent.click(screen.getByText(/Real/i));

    expect(field()).toHaveValue("52,40");
    fireEvent.click(screen.getByText(/Salvar conta/i));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ initial_balance: 52.4 }));
  });

  it("texto ilegível na moeda antiga fica como está e a tela pede para conferir", () => {
    renderModal();
    fireEvent.click(screen.getByText(/Dólar/i));
    fireEvent.change(field(), { target: { value: "1,5000" } }); // inválido em US$
    fireEvent.click(screen.getByText(/Real/i));

    expect(field()).toHaveValue("1,5000");
    expect(screen.getByRole("status")).toHaveTextContent(/Confira o saldo inicial/);
  });

  it("aviso ativo: trocar de novo NÃO reescreve, o texto e o aviso ficam e Salvar trava (revisão #302)", () => {
    const onSubmit = renderModal();
    fillName();
    fireEvent.click(screen.getByText(/Dólar/i));
    fireEvent.change(field(), { target: { value: "1.2345" } }); // ilegível em US$
    fireEvent.click(screen.getByText(/Real/i));
    fireEvent.click(screen.getByText(/Dólar/i));

    expect(field()).toHaveValue("1.2345");
    expect(screen.getByRole("status")).toHaveTextContent(/Confira o saldo inicial/);
    const save = screen.getByText(/Salvar conta/i).closest("button");
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("aviso ativo com texto que a moeda do meio LERIA: mesmo assim nada é reescrito", () => {
    renderModal();
    fireEvent.click(screen.getByText(/Dólar/i));
    fireEvent.change(field(), { target: { value: "1,5000" } }); // ilegível em US$, "1,5" em R$
    fireEvent.click(screen.getByText(/Real/i));
    fireEvent.click(screen.getByText(/Dólar/i));

    expect(field()).toHaveValue("1,5000");
    expect(screen.getByRole("status")).toHaveTextContent(/Confira o saldo inicial/);
  });

  it("editar o campo tira o aviso e destrava; a próxima troca volta a reescrever", () => {
    const onSubmit = renderModal();
    fillName();
    fireEvent.click(screen.getByText(/Dólar/i));
    fireEvent.change(field(), { target: { value: "1.2345" } });
    fireEvent.click(screen.getByText(/Real/i));
    fireEvent.change(field(), { target: { value: "1,50" } });

    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getByText(/Dólar/i));
    expect(field()).toHaveValue("1,50");
    fireEvent.click(screen.getByText(/Salvar conta/i));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ currency: "USD", initial_balance: 1.5 }));
  });

  it("mais casas do que a moeda nova guarda: não arredonda — mantém o texto e avisa (revisão #302)", () => {
    renderModal();
    fireEvent.change(field(), { target: { value: "1,2345" } }); // 1,2345 em R$
    fireEvent.click(screen.getByText(/Dólar/i));

    expect(field()).toHaveValue("1,2345");
    expect(screen.getByRole("status")).toHaveTextContent(/Confira o saldo inicial/);
  });

  it("campo vazio: trocar a moeda não escreve nada", () => {
    renderModal();
    fireEvent.click(screen.getByText(/Dólar/i));
    expect(field()).toHaveValue("");
  });
});
