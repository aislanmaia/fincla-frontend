// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountFormModal } from "../AccountFormModal.jsx";
import {
  clearCurrencyRegistry,
  setCurrencyRegistry,
} from "../../../money/currencyRegistry.js";

/**
 * A trava de moeda vista pela TELA.
 *
 * A recusa sempre existiu no servidor (422 `Moeda travada`). O que faltava era a
 * tela saber ANTES: ela desenhava o seletor igual em toda conta, e a pessoa só
 * descobria que não podia trocar depois de escolher e salvar.
 *
 * `currency_locked` tem TRÊS valores, e o terceiro é o que decide o desenho:
 * `null` não é "destravado", é "ninguém perguntou" — e aí a tela não promete nada,
 * mostra o campo e deixa o backend recusar, como sempre fez.
 */

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

const conta = (extra) => ({
  id: "acc-1",
  name: "Conta em euro",
  type: "checking",
  currency: "EUR",
  initial_balance: 0,
  ...extra,
});

const abrir = (account) => {
  const onSubmit = vi.fn();
  render(<AccountFormModal account={account} onClose={() => {}} onSubmit={onSubmit} />);
  return onSubmit;
};

describe("conta COM movimento: a moeda aparece travada, com o motivo", () => {
  it("os botões de moeda ficam desabilitados", () => {
    abrir(conta({ currency_locked: true }));

    for (const codigo of ["BRL", "EUR", "USD"]) {
      const botao = screen.getByText(new RegExp(codigo === "BRL" ? "Real" : codigo === "EUR" ? "Euro" : "Dólar", "i"))
        .closest("button");
      expect(botao, codigo).toBeDisabled();
    }
  });

  it("clicar não muda a moeda", () => {
    const onSubmit = abrir(conta({ currency_locked: true }));

    fireEvent.click(screen.getByText(/Real/i));
    fireEvent.click(screen.getByText(/Salvar/i));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ currency: "EUR" }));
  });

  it("o campo NÃO some — a pessoa precisa ver em que moeda a conta está", () => {
    // Esconder o seletor esconderia a informação que ela veio buscar.
    abrir(conta({ currency_locked: true }));

    expect(screen.getByText(/Euro/i)).toBeInTheDocument();
  });

  it("explica o motivo E ensina a saída", () => {
    abrir(conta({ currency_locked: true }));

    const texto = document.body.textContent;
    expect(texto).toContain("já tem lançamento");
    // Recusar sem dizer o que fazer é um beco: a saída é outra conta + transferência.
    expect(texto).toMatch(/abra outra conta/i);
    expect(texto).toMatch(/transfira/i);
  });
});

describe("conta SEM movimento: a moeda continua editável", () => {
  it("os botões respondem e a escolha viaja", () => {
    const onSubmit = abrir(conta({ currency_locked: false }));

    fireEvent.click(screen.getByText(/Real/i));
    fireEvent.click(screen.getByText(/Salvar/i));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ currency: "BRL" }));
  });

  it("não diz que está travada", () => {
    abrir(conta({ currency_locked: false }));

    expect(document.body.textContent).not.toContain("já tem lançamento");
  });
});

describe("currency_locked ausente: a tela não promete nada", () => {
  it("`null` NÃO é tratado como travado", () => {
    // É o contrato: `null` significa "ninguém perguntou". Tratá-lo como travado
    // impediria a edição de uma conta que o backend aceitaria mudar.
    const onSubmit = abrir(conta({ currency_locked: null }));

    fireEvent.click(screen.getByText(/Real/i));
    fireEvent.click(screen.getByText(/Salvar/i));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ currency: "BRL" }));
  });

  it("campo ausente se comporta igual a `null`", () => {
    const onSubmit = abrir(conta({}));

    fireEvent.click(screen.getByText(/Dólar/i));
    fireEvent.click(screen.getByText(/Salvar/i));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ currency: "USD" }));
  });
});
