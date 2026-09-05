// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TransferModal } from "../TransferModal.jsx";

afterEach(cleanup);

/**
 * Entre moedas, a transferência guarda DOIS valores. O backend não calcula o
 * segundo: o banco cobra spread e IOF, e a taxa de mercado não é o que caiu na
 * conta. A tela sugere; quem confirma é quem viu o extrato.
 */
const CONTAS = [
  { account_id: "eur", name: "Conta EUR", type: "checking", currency: "EUR", balance: 500 },
  { account_id: "brl", name: "Conta BRL", type: "checking", currency: "BRL", balance: 0 },
  { account_id: "brl2", name: "Outra BRL", type: "checking", currency: "BRL", balance: 100 },
];

const renderModal = ({ onQuote, ...props } = {}) => {
  const onSubmit = vi.fn();
  // O override tem de ser DEVOLVIDO, senão o teste afirma sobre um mock que a
  // tela nunca usou — e passa sem provar nada.
  const quote =
    onQuote ||
    vi.fn().mockResolvedValue({
      base: "EUR",
      quote: "BRL",
      rate: "6.00",
      quoted_on: "2026-09-03",
    });
  render(
    <TransferModal
      accounts={CONTAS}
      onClose={() => {}}
      onSubmit={onSubmit}
      onQuote={quote}
      {...props}
    />,
  );
  return { onSubmit, onQuote: quote };
};

const selects = () => screen.getAllByRole("combobox");
const escolher = (indice, valor) => fireEvent.change(selects()[indice], { target: { value: valor } });

describe("TransferModal entre moedas", () => {
  it("não pede o segundo valor quando as duas contas estão na mesma moeda", () => {
    const { onQuote } = renderModal();
    // As contas padrão do modal são EUR→BRL, então a cotação já foi buscada uma
    // vez na montagem. O que importa aqui é o que acontece DEPOIS de escolher
    // duas contas na mesma moeda.
    escolher(0, "brl");
    escolher(1, "brl2");
    onQuote.mockClear();

    expect(screen.queryByText("Valor que entrou")).not.toBeInTheDocument();
    expect(onQuote).not.toHaveBeenCalled();
  });

  it("pede o valor que entrou quando as moedas diferem", async () => {
    renderModal();
    escolher(0, "eur");
    escolher(1, "brl");

    expect(await screen.findByText("Valor que entrou")).toBeInTheDocument();
    // E o primeiro campo passa a dizer que é o que SAI, senão os dois ficam iguais.
    expect(screen.getByText("Valor que sai")).toBeInTheDocument();
  });

  it("pré-preenche pela cotação e mostra a data dela", async () => {
    renderModal();
    escolher(0, "eur");
    escolher(1, "brl");
    fireEvent.change(screen.getByPlaceholderText("€ 0,00"), { target: { value: "100" } });

    // 100 × 6,00 = 600,00
    await waitFor(() => expect(screen.getByDisplayValue("600,00")).toBeInTheDocument());
    // A data junto: sem ela, uma taxa de sexta parece de hoje.
    expect(screen.getByText(/03\/09/)).toBeInTheDocument();
  });

  it("o valor sugerido é sobrescrevível — é ele que vai gravado", async () => {
    const { onSubmit } = renderModal();
    escolher(0, "eur");
    escolher(1, "brl");
    fireEvent.change(screen.getByPlaceholderText("€ 0,00"), { target: { value: "100" } });
    await waitFor(() => expect(screen.getByDisplayValue("600,00")).toBeInTheDocument());

    // O extrato do banco disse 592,30: spread e IOF comeram a diferença.
    fireEvent.change(screen.getByDisplayValue("600,00"), { target: { value: "592,30" } });
    fireEvent.click(screen.getByText("Transferir"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 100, to_amount: 592.3 }),
    );
  });

  it("não manda `to_amount` na mesma moeda", () => {
    const { onSubmit } = renderModal();
    escolher(0, "brl");
    escolher(1, "brl2");
    fireEvent.change(screen.getByPlaceholderText("R$ 0,00"), { target: { value: "30" } });
    fireEvent.click(screen.getByText("Transferir"));

    const enviado = onSubmit.mock.calls[0][0];
    expect(enviado.amount).toBe(30);
    expect(enviado).not.toHaveProperty("to_amount");
  });

  it("sem o valor que entrou, não deixa transferir entre moedas", async () => {
    const { onSubmit, onQuote } = renderModal({ onQuote: vi.fn().mockRejectedValue(new Error("fora")) });
    escolher(0, "eur");
    escolher(1, "brl");
    fireEvent.change(screen.getByPlaceholderText("€ 0,00"), { target: { value: "100" } });
    await screen.findByText(/informe o valor que entrou/i);

    fireEvent.click(screen.getByText("Transferir"));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onQuote).toHaveBeenCalled();
  });

  it("cotação fora do ar não trava a tela — o usuário digita o que caiu", async () => {
    // O número que vale é o do extrato, com ou sem cotação nossa.
    const { onSubmit } = renderModal({ onQuote: vi.fn().mockRejectedValue(new Error("fora")) });
    escolher(0, "eur");
    escolher(1, "brl");
    fireEvent.change(screen.getByPlaceholderText("€ 0,00"), { target: { value: "100" } });
    await screen.findByText(/informe o valor que entrou/i);

    // Os dois campos têm placeholder com "0,00"; o de destino é o segundo.
    const campos = screen.getAllByPlaceholderText(/0,00/);
    fireEvent.change(campos[1], { target: { value: "580,00" } });
    fireEvent.click(screen.getByText("Transferir"));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ to_amount: 580 }));
  });
});
