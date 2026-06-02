/** @vitest-environment jsdom */

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mocks: router (TransacoesPage usa useSearch + useNavigate) ─────────────────
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

// Mocks: hooks de dados ─────────────────────────────────────────────────────
const transactionsDataMock = vi.fn(() => ({
  isLoading: false,
  error: "",
  summary: { total_income: 1000, total_expenses: 300, total_refunds: 0, balance: 700 },
  transactions: [
    {
      id: "tx-1",
      date: "21/05",
      desc: "Almoço",
      cat: "Alimentação",
      val: -42.5,
      method: "Pix",
      type: "expense",
      icon: "🍽",
      status: "confirmado",
      rec: false,
      tags: ["trabalho"],
    },
    {
      id: "tx-2",
      date: "22/05",
      desc: "Salário",
      cat: "Receita",
      val: 5000,
      method: "Transferência",
      type: "income",
      icon: "💸",
      status: "confirmado",
      rec: true,
      tags: [],
    },
  ],
  total: 2,
  hasMore: false,
  removeTransaction: vi.fn(),
}));
vi.mock("../../features/transactions/useTransactionsData.js", () => ({
  useTransactionsData: (...args) => transactionsDataMock(...args),
}));

const categoryTagsDataMock = vi.fn(() => ({
  isLoading: false,
  categories: [
    { id: "cat-alim", labelPt: "Alimentação", color: "#059669" },
    { id: "cat-trans", labelPt: "Transporte", color: "#2563EB" },
  ],
}));
vi.mock("../../features/tags/useCategoryTagsData.js", () => ({
  useCategoryTagsData: (...args) => categoryTagsDataMock(...args),
}));

import { TransacoesPage } from "../TransacoesPage.jsx";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

function renderPage(overrides = {}) {
  return render(
    <TransacoesPage
      onNav={vi.fn()}
      onNewTx={vi.fn()}
      onEditTx={vi.fn()}
      isMobile={false}
      dataMode="live"
      organizationId="org-test"
      transactionsRefreshToken={0}
      onTransactionsInvalidate={vi.fn()}
      {...overrides}
    />,
  );
}

describe("<TransacoesPage> — integração da Variação C", () => {
  it("monta a página com TransactionsFilterBar (desktop)", () => {
    renderPage();
    // Título da página
    expect(screen.getByText("Transações")).toBeInTheDocument();
    // Variação C — busca, saved views, facets
    expect(screen.getByLabelText(/Buscar transações/i)).toBeInTheDocument();
    expect(screen.getByText(/Visualizações salvas/i)).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: /Filtros de transações/i })).toBeInTheDocument();
  });

  it("renderiza os 7 facet cards com valores derivados do estado inicial", () => {
    renderPage();
    // Período inicial: Este mês (default)
    expect(screen.getByRole("button", { name: /Período: Este mês/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tipo: Todos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Categoria: Todas/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tags:/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cartão: Todos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Valor: Qualquer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Recorrência: Todas/i })).toBeInTheDocument();
  });

  it("expande o painel inline da facet Tipo e a seleção atualiza o card", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /Tipo: Todos/i }));
    expect(screen.getByRole("region", { name: /Filtro: tipo/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Despesa" }));
    expect(screen.getByRole("button", { name: /Tipo: Despesa/i })).toBeInTheDocument();
  });

  it("ordenação multi-nível é acessível via SortButton da SearchBar", async () => {
    renderPage();
    const sortBtn = screen.getByRole("button", { name: /Ordenar transações: Data ↓/i });
    await userEvent.click(sortBtn);
    expect(screen.getByRole("dialog", { name: /Editor de ordenação/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Adicionar Valor/i }));
    expect(
      screen.getByRole("button", { name: /Ordenar transações: Data ↓ · Valor ↓/i }),
    ).toBeInTheDocument();
  });

  it("Limpar tudo zera os filtros aplicados", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /Tipo: Todos/i }));
    await userEvent.click(screen.getByRole("button", { name: "Despesa" }));
    expect(screen.getByRole("button", { name: /Tipo: Despesa/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Limpar todos os filtros/i }));
    expect(screen.getByRole("button", { name: /Tipo: Todos/i })).toBeInTheDocument();
  });

  it("renderiza KPIs (Receitas/Despesas/Saldo) a partir do summary", () => {
    renderPage();
    expect(screen.getByText("Receitas")).toBeInTheDocument();
    expect(screen.getByText("Despesas")).toBeInTheDocument();
    expect(screen.getByText("Saldo")).toBeInTheDocument();
  });

  it("renderiza lista de transações vinda do hook mockado", () => {
    renderPage();
    expect(screen.getAllByText("Almoço").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Salário").length).toBeGreaterThan(0);
  });

  it("mobile: mostra search compacto + botão Filtros que abre o sheet com a Variação C", async () => {
    renderPage({ isMobile: true });
    expect(screen.getByPlaceholderText(/Buscar por descrição, categoria ou tag/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Abrir filtros/i }));
    // Sheet aberto — toolbar dentro e botão de fechar
    expect(screen.getByRole("toolbar", { name: /Filtros de transações/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fechar filtros/i })).toBeInTheDocument();
  });

  it("criar saved view persiste em localStorage por org", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /^Nova$/ }));
    await userEvent.type(screen.getByLabelText(/Nome da visualização/i), "Minha view");
    await userEvent.click(screen.getByRole("button", { name: /Salvar visualização/i }));
    expect(screen.getByRole("button", { name: "Minha view" })).toBeInTheDocument();
    // localStorage gravado para a org
    const raw = localStorage.getItem("fincla.transactions.savedViews.v1");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed.orgs["org-test"]).toBeDefined();
    expect(parsed.orgs["org-test"][0].label).toBe("Minha view");
  });
});
