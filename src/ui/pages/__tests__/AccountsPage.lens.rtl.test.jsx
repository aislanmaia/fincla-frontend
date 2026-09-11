/** @vitest-environment jsdom */

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * O SELETOR DE LENTE (#138): trocar a moeda em que se LÊ o total.
 *
 * Três coisas o definem, e todas as três estão presas aqui:
 *
 * 1. **Não grava nada.** A lente vive num `useState` e some ao recarregar. Se ela
 *    fosse persistida, viraria na prática uma segunda moeda base — não declarada,
 *    e que relatório, IA e painel do consultor não conhecem. Dois números iguais
 *    em unidades diferentes na mesma conversa é como se perde a confiança num
 *    relatório.
 * 2. **Só aparece onde significa algo.** Organização de moeda única não tem lente
 *    para trocar; oferecer a troca ali é oferecer uma pergunta sem resposta.
 * 3. **A cotação e a data continuam à mostra.** Um total convertido sem a taxa
 *    que o produziu é um número que ninguém consegue conferir.
 */

const useAccountsDataMock = vi.fn();
vi.mock("../../features/accounts/useAccountsData.js", () => ({
  useAccountsData: (args) => useAccountsDataMock(args),
}));
vi.mock("../../data/transactionsAdapter.js", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchAllTransactionsPages: vi.fn().mockResolvedValue({ data: [], pagination: { has_next: false } }),
}));
vi.mock("../../../api/balances", () => ({
  getAccountBalance: vi.fn().mockResolvedValue({ balance: 0 }),
}));

import { AccountsPage } from "../AccountsPage.jsx";
import { clearCurrencyRegistry, setCurrencyRegistry } from "../../money/currencyRegistry.js";

const REGISTRO = [
  { code: "BRL", name: "Real brasileiro", symbol: "R$", decimal_places: 2, is_active: true },
  { code: "EUR", name: "Euro", symbol: "€", decimal_places: 2, is_active: true },
];

const CONTAS_MULTIMOEDA = [
  { id: "a1", account_id: "a1", name: "Conta BRL", type: "checking", currency: "BRL", balance: 1000, include_in_total: true },
  { id: "a2", account_id: "a2", name: "Conta EUR", type: "checking", currency: "EUR", balance: 100, include_in_total: true },
];

function estado(extra = {}) {
  return {
    isLoading: false,
    isSaving: false,
    error: "",
    hasLoaded: true,
    total: 1594.19,
    totalAll: 1594.19,
    asOf: null,
    accounts: CONTAS_MULTIMOEDA,
    consolidation: {
      target_currency: "BRL",
      rates: [{ base: "EUR", quote: "BRL", rate: "5.9419", quoted_on: "2026-09-09" }],
      unavailable: null,
    },
    createAccount: vi.fn(),
    updateAccount: vi.fn(),
    deactivateAccount: vi.fn(),
    transfer: vi.fn(),
    reload: vi.fn(),
    ...extra,
  };
}

beforeEach(() => {
  setCurrencyRegistry(REGISTRO);
  useAccountsDataMock.mockReset();
  useAccountsDataMock.mockImplementation(() => estado());
});
afterEach(() => {
  cleanup();
  clearCurrencyRegistry();
});

describe("organização com mais de uma moeda", () => {
  it("oferece a lente, com a moeda base como padrão", () => {
    render(<AccountsPage organizationId="org-1" dataMode="live" />);

    const seletor = screen.getByLabelText(/Ver o total em/i);
    expect(seletor).toBeInTheDocument();
    // Sair da lente tem de ser tão fácil quanto entrar: a base é a opção padrão.
    expect(seletor.value).toBe("");
    expect(screen.getByText(/BRL \(base\)/)).toBeInTheDocument();
  });

  it("escolher uma moeda passa a lente para a leitura — e não grava nada", async () => {
    render(<AccountsPage organizationId="org-1" dataMode="live" />);

    await userEvent.selectOptions(screen.getByLabelText(/Ver o total em/i), "EUR");

    await waitFor(() => {
      expect(useAccountsDataMock).toHaveBeenCalledWith(expect.objectContaining({ lente: "EUR" }));
    });
    // Nada de localStorage: a lente é da SESSÃO da tela, não uma preferência.
    expect(Object.keys(window.localStorage)).toHaveLength(0);
  });

  it("a primeira leitura é sempre na moeda base", () => {
    render(<AccountsPage organizationId="org-1" dataMode="live" />);

    expect(useAccountsDataMock).toHaveBeenCalledWith(expect.objectContaining({ lente: null }));
  });

  it("a cotação e a data continuam à mostra", () => {
    // Um total convertido sem a taxa que o produziu é um número que ninguém
    // consegue conferir — e a data é o que torna uma taxa velha visivelmente
    // velha em vez de silenciosamente errada.
    const { container } = render(<AccountsPage organizationId="org-1" dataMode="live" />);

    expect(container.textContent).toContain("1 EUR =");
    expect(container.textContent).toContain("09/09");
  });
});

describe("organização de moeda única", () => {
  beforeEach(() => {
    useAccountsDataMock.mockImplementation(() =>
      estado({
        accounts: [CONTAS_MULTIMOEDA[0]],
        consolidation: { target_currency: "BRL", rates: [], unavailable: null },
      }),
    );
  });

  it("não vê seletor de lente", () => {
    render(<AccountsPage organizationId="org-1" dataMode="live" />);

    expect(screen.queryByLabelText(/Ver o total em/i)).not.toBeInTheDocument();
  });

  it("não vê aviso de cotação", () => {
    const { container } = render(<AccountsPage organizationId="org-1" dataMode="live" />);

    expect(container.textContent).not.toContain("Convertido com");
  });
});

describe("quando não deu para converter", () => {
  it("o aviso aparece e o total vira travessão — nunca zero", () => {
    useAccountsDataMock.mockImplementation(() =>
      estado({
        total: null,
        consolidation: {
          target_currency: "BRL",
          rates: [],
          unavailable: "sem cotação EUR→BRL",
        },
      }),
    );
    const { container } = render(<AccountsPage organizationId="org-1" dataMode="live" />);

    expect(container.textContent).toContain("Não deu para somar as moedas agora");
    // "R$ 0,00" afirmaria que a pessoa não tem dinheiro.
    expect(container.textContent).not.toContain("R$ 0,00");
  });
});
