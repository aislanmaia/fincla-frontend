/** @vitest-environment jsdom */

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
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
    {
      id: "tx-3",
      date: "23/05",
      desc: "Notebook",
      cat: "Compras",
      val: -4299,
      method: "Cartão de crédito",
      paymentMethodKey: "credito",
      type: "expense",
      icon: "💳",
      status: "confirmado",
      rec: false,
      tags: [],
      parcela: {
        atual: 2,
        total: 12,
        valParcela: 358.25,
        cartao: "Nubank •• 1177",
        vencimento: "10/06/2026",
      },
    },
  ],
  total: 3,
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
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: 1440,
  });
  window.dispatchEvent(new Event("resize"));
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

describe("<TransacoesPage> — integração da Variação C", { timeout: 15000 }, () => {
  it("monta a página com TransactionsFilterBar (desktop)", () => {
    renderPage();
    expect(screen.getByText("Transações")).toBeInTheDocument();
    expect(screen.getByLabelText(/Buscar transações/i)).toBeInTheDocument();
    expect(screen.queryByText(/Visualizações salvas/i)).not.toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: /Filtros de transações/i })).toBeInTheDocument();
  });

  it("exibe visualizações salvas ao aplicar filtro (sem views persistidas)", async () => {
    renderPage();
    expect(screen.queryByText(/Visualizações salvas/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Tipo: Todos/i }));
    await userEvent.click(screen.getByRole("button", { name: "Despesa" }));
    expect(screen.getByText(/Visualizações salvas/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Limpar todos os filtros/i }));
    expect(screen.queryByText(/Visualizações salvas/i)).not.toBeInTheDocument();
  });

  it("atalho na FacetBar abre o formulário para salvar como nova visualização", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /Tipo: Todos/i }));
    await userEvent.click(screen.getByRole("button", { name: "Despesa" }));
    await userEvent.click(
      screen.getByRole("button", { name: /Salvar como nova visualização/i }),
    );
    expect(screen.getByText("Nova visualização")).toBeInTheDocument();
  });

  it("exibe visualizações salvas por padrão quando já existem views persistidas", () => {
    localStorage.setItem(
      "fincla.transactions.savedViews.v1",
      JSON.stringify({
        version: 1,
        orgs: {
          "org-test": [
            {
              id: "v1",
              label: "Minha view",
              icon: "bookmark",
              color: "#2563EB",
              filters: { period: "mes", type: "todos" },
              createdAt: 1,
            },
          ],
        },
      }),
    );
    renderPage();
    expect(screen.getByText(/Visualizações salvas/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Minha view" })).toBeInTheDocument();
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

  it("expande o painel inline da facet Tipo e a seleção atualiza o card e fecha o painel", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /Tipo: Todos/i }));
    expect(screen.getByRole("region", { name: /Filtro: tipo/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Despesa" }));
    expect(screen.getByRole("button", { name: /Tipo: Despesa/i })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Filtro: tipo/i })).not.toBeInTheDocument();
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

  it("renderiza KPIs (Receitas/Despesas/Resultado) a partir do summary", () => {
    renderPage();
    expect(screen.getByText("Receitas")).toBeInTheDocument();
    expect(screen.getByText("Despesas")).toBeInTheDocument();
    // Era "Saldo"; renomeado na S2 porque colidia com o saldo da conta.
    expect(screen.getByText("Resultado")).toBeInTheDocument();
  });

  // Também é o teste de regressão do modo live: a API já aplicou período, tipo,
  // categorias etc. Quando a página passou a refiltrar tudo no cliente, o
  // `periodFilter` descartava a lista inteira (as linhas de apresentação trazem
  // `date` = "21/05", sem ano) — tela vazia com dados no banco.
  it("renderiza lista de transações vinda do hook mockado", () => {
    renderPage();
    expect(screen.getAllByText("Almoço").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Salário").length).toBeGreaterThan(0);
  });

  it("mostra crédito inline com cartão quando paymentMethodKey indica crédito", () => {
    renderPage();
    expect(screen.getByText("Crédito")).toBeInTheDocument();
    expect(screen.getByText(/1177/)).toBeInTheDocument();
  });

  it("mobile: mostra search compacto + botão Filtros que abre o sheet com a Variação C", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 375 });
    window.dispatchEvent(new Event("resize"));
    renderPage({ isMobile: true });
    expect(screen.getByPlaceholderText(/Buscar por descrição, categoria ou tag/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Abrir filtros/i }));
    // Sheet aberto — toolbar dentro e botão de fechar
    expect(screen.getByRole("toolbar", { name: /Filtros de transações/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fechar filtros/i })).toBeInTheDocument();
  });

  it("criar saved view persiste em localStorage por org", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /Tipo: Todos/i }));
    await userEvent.click(screen.getByRole("button", { name: "Despesa" }));
    await userEvent.click(screen.getByRole("button", { name: /^Nova$/ }));
    await userEvent.type(screen.getByLabelText(/Nome da visualização/i), "Minha view");
    await userEvent.click(screen.getByRole("button", { name: /Salvar como nova visualização/i }));
    expect(screen.getByRole("button", { name: "Minha view" })).toBeInTheDocument();
    const raw = localStorage.getItem("fincla.transactions.savedViews.v1");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed.orgs["org-test"]).toBeDefined();
    expect(parsed.orgs["org-test"][0].label).toBe("Minha view");
  });

  it("clicar na view ativa desaplica filtros e desseleciona o card", async () => {
    renderPage();
    expect(screen.getByRole("button", { name: /Tipo: Todos/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Tipo: Todos/i }));
    await userEvent.click(screen.getByRole("button", { name: "Receita" }));
    await userEvent.click(screen.getByRole("button", { name: /^Nova$/ }));
    await userEvent.type(screen.getByLabelText(/Nome da visualização/i), "receitas");
    await userEvent.click(screen.getByRole("button", { name: /Salvar como nova visualização/i }));
    const card = screen.getByRole("button", { name: "receitas" });
    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Tipo: Receita/i })).toBeInTheDocument();
    await userEvent.click(card);
    expect(card).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Tipo: Todos/i })).toBeInTheDocument();
  });

  it("view dirty: card mostra Filtros alterados; Limpar tudo desseleciona", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /Tipo: Todos/i }));
    await userEvent.click(screen.getByRole("button", { name: "Receita" }));
    await userEvent.click(screen.getByRole("button", { name: /^Nova$/ }));
    await userEvent.type(screen.getByLabelText(/Nome da visualização/i), "receitas");
    await userEvent.click(screen.getByRole("button", { name: /Salvar como nova visualização/i }));
    const card = screen.getByRole("button", { name: "receitas" });
    expect(card).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: /Categoria:/i }));
    await userEvent.click(screen.getByRole("button", { name: "Alimentação" }));
    expect(screen.getByText(/Filtros alterados/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Limpar todos os filtros/i }));
    expect(card).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText(/Filtros alterados/i)).not.toBeInTheDocument();
  });

  it("desktop compacto: facets ocultos por padrão; botão Filtros expande inline", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1200 });
    window.dispatchEvent(new Event("resize"));
    renderPage();
    expect(screen.queryByRole("toolbar", { name: /Filtros de transações/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Abrir filtros/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Abrir filtros/i }));
    expect(screen.getByRole("toolbar", { name: /Filtros de transações/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Ocultar filtros/i }));
    expect(screen.queryByRole("toolbar", { name: /Filtros de transações/i })).not.toBeInTheDocument();
  });

  // Regressão do bug relatado: selecionar 2+ formas de pagamento fazia a lista
  // sumir. A causa era o recorte client-side por página — a API devolvia uma
  // página sem filtro de forma e a página descartava as linhas que não casavam
  // com `paymentMethodKey`. Agora a API filtra por todas as formas (param
  // repetido) e a página confia no resultado, sem refiltrar.
  it("modo live: selecionar várias formas de pagamento não esvazia a lista", async () => {
    renderPage();
    // Todas as linhas do hook aparecem antes de qualquer filtro.
    expect(screen.getAllByText("Almoço").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Salário").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Notebook").length).toBeGreaterThan(0);

    await userEvent.click(
      screen.getByRole("button", { name: /Forma de pagamento: Todas/i }),
    );
    const panel = screen.getByRole("region", { name: /Filtro: forma/i });
    await userEvent.click(within(panel).getByRole("button", { name: "Pix" }));
    await userEvent.click(within(panel).getByRole("button", { name: "Crédito" }));

    // Duas formas marcadas — a lista continua com todas as linhas do backend.
    expect(screen.getAllByText("Almoço").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Salário").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Notebook").length).toBeGreaterThan(0);

    // E o hook recebeu as duas formas mapeadas para os valores da API.
    const lastCall = transactionsDataMock.mock.calls.at(-1)[0];
    expect(lastCall.filters.filterMethod).toEqual(["pix", "credit_card"]);
  });
});

describe("<TransacoesPage> — liquidação (S1)", { timeout: 15000 }, () => {
  /** Uma pendente (pix), uma paga (pix) e uma de cartão. */
  function seedSettlement(setTransactionSettled = vi.fn()) {
    transactionsDataMock.mockReturnValue({
      isLoading: false,
      error: "",
      summary: { total_income: 0, total_expenses: 100, total_refunds: 0, balance: -100 },
      transactions: [
        { id: "tx-pend", date: "21/05", desc: "Boleto luz", cat: "Casa", val: -100, method: "Pix",
          type: "expense", icon: "💡", status: "confirmado", rec: false, tags: [],
          settled: false, settleable: true, paidAt: null },
        { id: "tx-paga", date: "22/05", desc: "Mercado", cat: "Alimentação", val: -50, method: "Pix",
          type: "expense", icon: "🍽", status: "confirmado", rec: false, tags: [],
          settled: true, settleable: true, paidAt: "2026-05-22T12:00:00" },
        { id: "tx-cartao", date: "23/05", desc: "Notebook", cat: "Compras", val: -4299,
          method: "Cartão de crédito", paymentMethodKey: "credito", type: "expense", icon: "💳",
          status: "confirmado", rec: false, tags: [], settled: false, settleable: false, paidAt: null },
      ],
      total: 3,
      hasMore: false,
      removeTransaction: vi.fn(),
      setTransactionSettled,
    });
  }

  it("marca com badge 'A pagar' só o que está pendente", () => {
    seedSettlement();
    renderPage();
    // Texto exato do badge: /A pagar/i casaria também com a linha-ponte e com o
    // botão "Ver só os a pagar", que não são badges de linha.
    expect(screen.getAllByText("⏳ A pagar").length).toBe(1);
  });

  it("cartão NÃO ganha badge 'A pagar' — ele liquida pela fatura, não por lançamento", () => {
    seedSettlement();
    renderPage();
    const badges = screen.getAllByText("⏳ A pagar");
    // Se o cartão entrasse, seriam dois. O badge mentiria sobre o que o usuário controla.
    expect(badges.length).toBe(1);
    expect(screen.getAllByText("Notebook").length).toBeGreaterThan(0);
  });

  it("'Marcar como pago' chama o hook com settled=true", async () => {
    const setTransactionSettled = vi.fn().mockResolvedValue({ settled: true });
    seedSettlement(setTransactionSettled);
    renderPage();

    await userEvent.click(screen.getAllByText("Boleto luz")[0]);
    await userEvent.click(await screen.findByRole("button", { name: /Marcar como pago/i }));

    expect(setTransactionSettled).toHaveBeenCalledWith("tx-pend", true);
  });

  it("reconcilia lista e summary depois de liquidar", async () => {
    const onTransactionsInvalidate = vi.fn();
    const setTransactionSettled = vi.fn().mockResolvedValue({ settled: true });
    seedSettlement(setTransactionSettled);
    renderPage({ onTransactionsInvalidate });

    await userEvent.click(screen.getAllByText("Boleto luz")[0]);
    await userEvent.click(await screen.findByRole("button", { name: /Marcar como pago/i }));

    // Sem isto, com Situação = "A pagar" a linha recém-paga continuaria visível sob
    // um filtro que a exclui, e o card "Resultado" somaria um conjunto que a lista
    // não mostra — a divergência que esta própria fatia existe para evitar.
    expect(onTransactionsInvalidate).toHaveBeenCalled();
  });

  it("mostra o erro ao lado da ação, não só na faixa do topo", async () => {
    const setTransactionSettled = vi.fn().mockRejectedValue(new Error("Servidor recusou"));
    seedSettlement(setTransactionSettled);
    renderPage();

    await userEvent.click(screen.getAllByText("Boleto luz")[0]);
    await userEvent.click(await screen.findByRole("button", { name: /Marcar como pago/i }));

    // No mobile o botão vive dentro do bottom sheet e a faixa global fica coberta:
    // uma falha pareceria "não aconteceu nada".
    expect(await screen.findByText("Servidor recusou")).toBeInTheDocument();
  });

  it("numa transação já paga a ação é desfazer, com settled=false", async () => {
    const setTransactionSettled = vi.fn().mockResolvedValue({ settled: false });
    seedSettlement(setTransactionSettled);
    renderPage();

    await userEvent.click(screen.getAllByText("Mercado")[0]);
    await userEvent.click(await screen.findByRole("button", { name: /Desfazer pagamento/i }));

    expect(setTransactionSettled).toHaveBeenCalledWith("tx-paga", false);
  });

  it("transação de cartão não oferece a ação de liquidar no detalhe", async () => {
    seedSettlement();
    renderPage();

    await userEvent.click(screen.getAllByText("Notebook")[0]);

    expect(screen.queryByRole("button", { name: /Marcar como pago/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Desfazer pagamento/i })).not.toBeInTheDocument();
  });

  it("o facet Situação chega ao hook de dados como settlement", async () => {
    seedSettlement();
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /Situação: Todas/i }));
    const panel = screen.getByRole("region", { name: /Filtro: situa/i });
    await userEvent.click(within(panel).getByRole("button", { name: /^A pagar$/i }));

    const lastCall = transactionsDataMock.mock.calls.at(-1)[0];
    expect(lastCall.filters.settlement).toBe("a-pagar");
  });
});

describe("<TransacoesPage> — desambiguação de nomes (S2)", { timeout: 15000 }, () => {
  it('o card chama-se "Resultado", não "Saldo" — o nome antigo colidia com o saldo da conta', () => {
    transactionsDataMock.mockReturnValue({
      isLoading: false, error: "",
      summary: { total_income: 100, total_expenses: 40, total_refunds: 0, balance: 60 },
      transactions: [
        { id: "t1", date: "21/05", desc: "Almoço", cat: "Alimentação", val: -40, method: "Pix",
          type: "expense", icon: "🍽", status: "confirmado", rec: false, tags: [],
          settled: true, settleable: true, paidAt: "2026-05-21T12:00:00" },
      ],
      total: 1, hasMore: false, removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    });
    renderPage();

    expect(screen.getByText("Resultado")).toBeInTheDocument();
    // "Saldo" sozinho não pode mais aparecer como rótulo de card nessa tela.
    expect(screen.queryByText(/^Saldo$/)).not.toBeInTheDocument();
  });

  it("oferece o caminho para os pendentes quando há algum fora do saldo", async () => {
    transactionsDataMock.mockReturnValue({
      isLoading: false, error: "",
      summary: { total_income: 0, total_expenses: 100, total_refunds: 0, balance: -100 },
      transactions: [
        { id: "t-pend", date: "21/05", desc: "Boleto luz", cat: "Casa", val: -100, method: "Pix",
          type: "expense", icon: "💡", status: "confirmado", rec: false, tags: [],
          settled: false, settleable: true, paidAt: null },
      ],
      total: 1, hasMore: false, removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    });
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /Ver só os a pagar/i }));

    const lastCall = transactionsDataMock.mock.calls.at(-1)[0];
    expect(lastCall.filters.settlement).toBe("a-pagar");
  });

  it("não polui a tela quando está tudo pago", () => {
    transactionsDataMock.mockReturnValue({
      isLoading: false, error: "",
      summary: { total_income: 0, total_expenses: 40, total_refunds: 0, balance: -40 },
      transactions: [
        { id: "t-ok", date: "21/05", desc: "Almoço", cat: "Alimentação", val: -40, method: "Pix",
          type: "expense", icon: "🍽", status: "confirmado", rec: false, tags: [],
          settled: true, settleable: true, paidAt: "2026-05-21T12:00:00" },
      ],
      total: 1, hasMore: false, removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    });
    renderPage();

    expect(screen.queryByRole("button", { name: /Ver só os a pagar/i })).not.toBeInTheDocument();
  });
});

describe("<TransacoesPage> — estabilidade das linhas (issue #66)", { timeout: 15000 }, () => {
  it("a linha NÃO é remontada quando a página re-renderiza", async () => {
    // Semeia o próprio conjunto: `mockReturnValue` de outro describe sobrevive ao
    // clearAllMocks (ele zera chamadas, não implementações).
    transactionsDataMock.mockReturnValue({
      isLoading: false,
      error: "",
      summary: { total_income: 0, total_expenses: 90, total_refunds: 0, balance: -90 },
      transactions: [
        { id: "row-a", date: "21/05", desc: "Almoço", cat: "Alimentação", val: -40, method: "Pix",
          type: "expense", icon: "🍽", status: "confirmado", rec: false, tags: [],
          settled: true, settleable: true, paidAt: "2026-05-21T12:00:00" },
        { id: "row-b", date: "22/05", desc: "Salário", cat: "Receita", val: 5000,
          method: "Transferência", type: "income", icon: "💸", status: "confirmado", rec: false,
          tags: [], settled: true, settleable: true, paidAt: "2026-05-22T12:00:00" },
      ],
      total: 2,
      hasMore: false,
      removeTransaction: vi.fn(),
      setTransactionSettled: vi.fn(),
    });
    renderPage();

    const before = screen.getAllByText("Almoço")[0].closest(".fincla-row");
    expect(before).toBeTruthy();

    // Re-render do corpo da página sem mexer na lista: selecionar OUTRA linha muda
    // `selected` (estado da página) e as transações continuam exatamente as mesmas.
    await userEvent.click(screen.getAllByText("Salário")[0]);

    const after = screen.getAllByText("Almoço")[0].closest(".fincla-row");

    // Se `TxRow`/`Tip` forem definidos dentro do corpo do componente, cada render
    // cria um TIPO novo e o React descarta a subárvore inteira em vez de atualizá-la:
    // o nó do DOM é outro objeto. Além do desperdício de CPU numa lista parada, é o
    // que faz o elemento nunca ficar "stable" para um clique automatizado — a caixa
    // que se mede num frame pertence a um nó que já não existe no seguinte.
    expect(after).toBe(before);
  });

  it("o drawer de detalhe também não é remontado", async () => {
    transactionsDataMock.mockReturnValue({
      isLoading: false, error: "",
      summary: { total_income: 0, total_expenses: 40, total_refunds: 0, balance: -40 },
      transactions: [
        { id: "row-a", date: "21/05", desc: "Almoço", cat: "Alimentação", val: -40, method: "Pix",
          type: "expense", icon: "🍽", status: "confirmado", rec: false, tags: [],
          settled: false, settleable: true, paidAt: null },
      ],
      total: 1, hasMore: false, removeTransaction: vi.fn(),
      setTransactionSettled: vi.fn().mockResolvedValue({ settled: true }),
    });
    renderPage();

    await userEvent.click(screen.getAllByText("Almoço")[0]);
    const before = screen.getByRole("button", { name: /Marcar como pago/i }).closest("div");

    // Abrir um facet re-renderiza a página com o drawer aberto. Se `DetailPanel`
    // fosse redefinido a cada render, todo o subárvore do drawer seria remontada —
    // inclusive a cada transição de `settlingId`, que o próprio botão dispara.
    await userEvent.click(screen.getByRole("button", { name: /Recorrência: Todas/i }));

    const after = screen.getByRole("button", { name: /Marcar como pago/i }).closest("div");
    expect(after).toBe(before);
  });
});
