// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingFlow } from "../OnboardingFlow.jsx";
import {
  clearCurrencyRegistry,
  setCurrencyRegistry,
} from "../../../money/currencyRegistry.js";

/**
 * A moeda no onboarding: **presente para quem precisa, invisível para quem não**.
 *
 * O critério da issue #137 tem duas metades que puxam em direções opostas — "quem
 * mora fora consegue dizer em que moeda vive" e "quem é do Brasil não vê pergunta
 * nova". Um passo a mais no funil para 100% das pessoas por causa de uma minoria
 * seria caro do jeito errado; um campo escondido demais não serve a ninguém.
 *
 * A resposta é uma LINHA de texto que diz o que já está escolhido, com um "usar
 * outra moeda" ao lado. Estes testes prendem as duas metades.
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

/** Avança do "welcome" até o passo da organização. */
function ateOPassoDaOrganizacao() {
  const onComplete = vi.fn();
  render(<OnboardingFlow onComplete={onComplete} isMobile={false} />);
  fireEvent.click(screen.getByText(/Começar/i));
  return onComplete;
}

describe("quem é do Brasil não vê pergunta nova", () => {
  it("o passo da organização não abre um seletor de moeda", () => {
    ateOPassoDaOrganizacao();

    // O que aparece é uma linha dizendo o que já está escolhido — não uma escolha
    // a fazer. Nenhum botão de moeda está na tela até alguém pedir.
    expect(screen.queryByText(/Dólar americano/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Real brasileiro/i)).toBeInTheDocument();
  });

  it("não existe passo novo no funil", () => {
    ateOPassoDaOrganizacao();

    // "Passo 1 de N" — o N não pode ter crescido por causa da moeda.
    expect(screen.getByText(/Passo 1 de 5/i)).toBeInTheDocument();
  });
});

describe("quem mora fora tem por onde", () => {
  it("o 'usar outra moeda' revela as ativas do registro", () => {
    ateOPassoDaOrganizacao();

    fireEvent.click(screen.getByText(/usar outra moeda/i));

    expect(screen.getByText(/Dólar americano/i)).toBeInTheDocument();
    expect(screen.getByText(/Euro/i)).toBeInTheDocument();
  });

  it("explica o que a moeda base significa, e o que ela NÃO impede", () => {
    ateOPassoDaOrganizacao();
    fireEvent.click(screen.getByText(/usar outra moeda/i));

    const texto = document.body.textContent;
    expect(texto).toMatch(/lê os próprios totais/i);
    // A dúvida óbvia de quem escolhe: "então só posso ter contas nessa moeda?"
    expect(texto).toMatch(/Contas em\s+outras moedas continuam possíveis/i);
  });

  it("as moedas vêm do REGISTRO, não de uma lista escrita aqui", () => {
    clearCurrencyRegistry();
    setCurrencyRegistry([
      { code: "BRL", name: "Real brasileiro", symbol: "R$", decimal_places: 2, is_active: true },
      { code: "GBP", name: "Libra esterlina", symbol: "£", decimal_places: 2, is_active: true },
    ]);
    ateOPassoDaOrganizacao();

    fireEvent.click(screen.getByText(/usar outra moeda/i));

    expect(screen.getByText(/Libra esterlina/i)).toBeInTheDocument();
    expect(screen.queryByText(/Dólar americano/i)).not.toBeInTheDocument();
  });
});
