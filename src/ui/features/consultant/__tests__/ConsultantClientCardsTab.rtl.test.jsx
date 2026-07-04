// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConsultantClientCardsTab } from "../ConsultantClientCardsTab.jsx";

function adapterCard(over = {}) {
  return {
    id: 7,
    nome: "Nubank Roxinho",
    dig: "1234",
    bandeira: "Mastercard",
    vencimento: 10,
    fechamento: 3,
    cor1: "#6016A8",
    cor2: "#8B11D4",
    limite: 10000,
    disponivel: 4000,
    itens: [
      { id: 1, desc: "Mercado Extra", data: "10/06", val: 320, icon: "🛒", catColor: "#059669", parcela: null },
    ],
    analytics: { currentInvoice: { total_amount: 820 } },
    ...over,
  };
}

function state(over = {}) {
  return { loading: false, error: "", hasLoaded: true, cards: [adapterCard()], ...over };
}

afterEach(() => cleanup());

describe("ConsultantClientCardsTab", () => {
  it("mostra o visual do cartão, uso do limite e itens da fatura", () => {
    render(<ConsultantClientCardsTab cards={state()} clientName="Mariana Costa" />);
    expect(screen.getByText("Nubank Roxinho")).toBeInTheDocument();
    expect(screen.getByText("•••• 1234")).toBeInTheDocument();
    expect(screen.getByText("Limite usado")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText(/Itens da fatura/)).toBeInTheDocument();
    expect(screen.getByText("fecha dia 3")).toBeInTheDocument();
    expect(screen.getByText("Mercado Extra")).toBeInTheDocument();
  });

  it("empty state usa o primeiro nome e stub 'Adicionar cartão' (desabilitado)", () => {
    render(<ConsultantClientCardsTab cards={state({ cards: [] })} clientName="Mariana Costa" />);
    expect(screen.getByText("Nenhum cartão cadastrado")).toBeInTheDocument();
    expect(screen.getByText(/^Mariana ainda não registrou/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Adicionar cartão/ })).toBeDisabled();
  });

  it("fatura sem itens mostra o empty state da lista", () => {
    render(<ConsultantClientCardsTab cards={state({ cards: [adapterCard({ itens: [] })] })} />);
    expect(screen.getByText("Sem itens na fatura atual.")).toBeInTheDocument();
  });

  it("estados de carregamento e erro", () => {
    const { rerender } = render(<ConsultantClientCardsTab cards={state({ loading: true, hasLoaded: false, cards: [] })} />);
    expect(screen.getByText("Carregando cartões…")).toBeInTheDocument();
    rerender(<ConsultantClientCardsTab cards={state({ error: "boom", cards: [] })} />);
    expect(screen.getByText("Não foi possível carregar os cartões.")).toBeInTheDocument();
  });
});
