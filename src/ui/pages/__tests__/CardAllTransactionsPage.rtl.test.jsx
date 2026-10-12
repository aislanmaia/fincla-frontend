/** @vitest-environment jsdom */
import React from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const CARD_ID = "00000000-0000-4000-8000-000000000001";
const ORG_ID = "11111111-1111-4111-8111-111111111111";
const navigate = vi.fn();
const route = vi.hoisted(() => ({ search: {} }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useParams: () => ({ cardId: CARD_ID }),
  useSearch: () => route.search,
}));
import { CardAllTransactionsPage } from "../CardAllTransactionsPage.jsx";
import { csvCell } from "../../features/cardTransactions/ledgerExport.js";

const requests = [];
let cardRequests = 0;
const server = setupServer(
  http.get("*/v1/credit-cards", () => {
    cardRequests += 1;
    return HttpResponse.json([{ id: 7, public_id: CARD_ID, description: "Azul", last4: "7112", currency: "BRL" }]);
  }),
  http.get("*/v1/credit-cards/:id/invoices/history", () => HttpResponse.json({ monthly_data: [] })),
  http.get("*/v1/credit-cards/:id/invoices/current", () => HttpResponse.json(null)),
  http.get("*/v1/transactions/summary", () => HttpResponse.json({ total_transactions: 2, breakdown: { by_category: [], by_month: [] } })),
  http.get("*/v1/transactions/facets", () => HttpResponse.json({ total: 2, category: [], type: [], tag: [], payment_method: [], settlement: null, recurring: null, value_bucket: [] })),
  http.get("*/v1/tags/catalog", () => HttpResponse.json({ categories: [] })),
  http.get("*/v1/tags", () => HttpResponse.json({ tags: [] })),
  http.get("*/v1/transactions", ({ request }) => {
    const url = new URL(request.url);
    requests.push(url);
    const page = Number(url.searchParams.get("page"));
    return HttpResponse.json({
      data: [{ id: page, date: "2026-09-01", description: page === 1 ? "Mercado" : "Farmácia", value: 12, value_currency: "BRL", type: "expense" }],
      pagination: { total: 2, page, limit: 30, pages: 2, has_next: page === 1, has_prev: page > 1 },
    });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => { Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 }); });
afterAll(() => server.close());
afterEach(() => { route.search = {}; cleanup(); server.resetHandlers(); requests.length = 0; cardRequests = 0; navigate.mockReset(); vi.unstubAllGlobals(); });

describe("CardAllTransactionsPage", () => {
  it("neutraliza fórmulas de planilha no CSV de descrições informadas pelo usuário", () => {
    expect(csvCell('=HYPERLINK("https://example.com","Abrir")', true)).toBe('"\'=HYPERLINK(""https://example.com"",""Abrir"")"');
    expect(csvCell("  @SUM(1,2)", true)).toBe('"\'  @SUM(1,2)"');
    expect(csvCell("-35.00", false)).toBe('"-35.00"');
  });
  it("mostra gasto por categoria do recorte completo na moeda recebida da API", async () => {
    server.use(http.get("*/v1/transactions/summary", ({ request }) => {
      const url = new URL(request.url);
      expect(url.searchParams.get("credit_card_id")).toBe("7");
      expect(url.searchParams.get("include_breakdown")).toBe("true");
      return HttpResponse.json({ total_transactions: 45, by_currency: [{ amount: "25.50", currency: "USD" }], breakdown: { by_category: [{ category: "Alimentação", amount: { amount: "25.50", currency: "USD" } }], by_month: [] } });
    }));
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    const summary = await screen.findByRole("region", { name: "Resumo dos lançamentos filtrados" });
    expect(await within(summary).findByText("45 lançamentos")).toBeInTheDocument();
    expect(within(summary).getByText("Total movimentado no recorte")).toBeInTheDocument();
    expect(within(summary).getAllByText(/25,50/)).toHaveLength(2);
    expect(within(summary).queryByText(/R\$\s*25,50/)).not.toBeInTheDocument();
  });

  it.each([[1440, "absolute"], [1700, ""]])("com %ipx o dock de filtros %s a tabela", async (width, position) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    await userEvent.setup().click(await screen.findByRole("button", { name: /Abrir filtros/ }));
    const dock = screen.getByRole("region", { name: "Filtros" }).parentElement;
    expect(dock.style.position).toBe(position);
  });

  it("chega do Dashboard da fatura já filtrado: fatura, tipo e busca vêm da URL", async () => {
    route.search = { fc_inv: "2026-09", fc_kind: "installment", fc_q: "Mercado" };
    server.use(http.get("*/v1/credit-cards/:id/invoices/history", () => HttpResponse.json({ monthly_data: [{ year: 2026, month: 10, invoice_id: 56, status: "open", total_amount: "20.00", items_count: 2 }, { year: 2026, month: 9, invoice_id: 55, status: "closed", total_amount: "10.00", items_count: 1 }] })));
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    await waitFor(() => expect(requests.at(-1).searchParams.get("invoice_id")).toBe("55"));
    const query = requests.at(-1).searchParams;
    expect(query.get("invoice_id")).toBe("55");
    expect(query.get("commitment_kind")).toBe("installment");
    expect(query.get("description")).toBe("Mercado");
    const chip = await screen.findByTestId("kind-chip");
    expect(chip).toHaveTextContent("Parcelas");
    await userEvent.setup().click(chip);
    await waitFor(() => expect(requests.at(-1).searchParams.get("commitment_kind")).toBeNull());
  });

  it("deep link para fatura inexistente cai na fatura padrão e o tipo do link pode ser removido", async () => {
    route.search = { fc_inv: "2025-01", fc_q: "Mercado", fc_kind: "refund" };
    server.use(http.get("*/v1/credit-cards/:id/invoices/history", () => HttpResponse.json({ monthly_data: [{ year: 2026, month: 10, invoice_id: 56, status: "open", total_amount: "20.00", items_count: 2 }] })));
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    await waitFor(() => expect(requests.at(-1)?.searchParams.get("invoice_id")).toBe("56"));
    expect(requests.at(-1).searchParams.get("type")).toBe("refund");
    const user = userEvent.setup();
    expect(requests.at(-1).searchParams.get("description")).toBe("Mercado");
    await user.click(await screen.findByRole("button", { name: "Remover filtro: Estornos" }));
    await waitFor(() => expect(requests.at(-1).searchParams.get("type")).toBeNull());
  });

  it("abre o dock desktop e aplica categoria real na query do cartão", async () => {
    server.use(http.get("*/v1/tags/catalog", () => HttpResponse.json({ categories: [{ id: "food", label: "Alimentação", system_key: "food", color: "#059669" }] })));
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    expect(await screen.findByRole("button", { name: /Abrir filtros/ })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /Abrir filtros/ }));
    expect(screen.getByRole("region", { name: "Filtros" })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /Categoria/ }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Alimentação" }));
    await waitFor(() => expect(requests.at(-1).searchParams.get("category")).toBe("food"));
    expect(requests.at(-1).searchParams.get("credit_card_id")).toBe("7");
    await userEvent.setup().click(screen.getByRole("button", { name: "Remover filtro Categoria" }));
    await waitFor(() => expect(requests.at(-1).searchParams.has("category")).toBe(false));
  });

  it("filtra todos os cartões pela faceta Cartão sem reutilizar o id selecionado", async () => {
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    expect(await screen.findByText("Mercado")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /Abrir filtros/ }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Cartão" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Todos os cartões" }));
    await waitFor(() => expect(requests.at(-1).searchParams.get("payment_method")).toBe("credit_card"));
    expect(requests.at(-1).searchParams.has("credit_card_id")).toBe(false);
    expect(screen.getByRole("region", { name: "Resumo dos lançamentos filtrados" })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /Ativos 1/ }));
    await userEvent.setup().click(screen.getByRole("button", { name: /Remover filtro Cartão:/ }));
    await waitFor(() => expect(requests.at(-1).searchParams.get("credit_card_id")).toBe("7"));
  });

  it("abre detalhes de uma linha desktop com Enter e devolve o foco ao fechar", async () => {
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    const row = await screen.findByRole("button", { name: "Ver detalhes de Mercado" });
    row.focus();
    await userEvent.setup().keyboard("{Enter}");
    const dialog = screen.getByRole("dialog", { name: "Detalhes do lançamento" });
    expect(dialog).toHaveTextContent("Mercado");
    expect(screen.getByRole("button", { name: "Fechar detalhes" })).toHaveFocus();
    await userEvent.setup().keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Detalhes do lançamento" })).not.toBeInTheDocument();
    expect(row).toHaveFocus();
  });

  it("usa grade de facetas no sheet mobile", async () => {
    server.use(http.get("*/v1/transactions", ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json({ data: [{ id: 1, date: "2026-09-01", description: "Mercado", value: 12, value_currency: "BRL", type: "expense", status: "confirmed" }], pagination: { total: 2, page: 1, limit: 30, pages: 1, has_next: false, has_prev: false } });
    }));
    render(<CardAllTransactionsPage organizationId={ORG_ID} isMobile />);
    expect(await screen.findByRole("button", { name: "Filtros" })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Filtros" }));
    const sheet = screen.getByRole("dialog", { name: "Filtros dos lançamentos" });
    expect(sheet.querySelector(".fincla-scroll")).toHaveStyle({ overflowY: "auto" });
    expect(within(sheet).getByRole("button", { name: "Ver 2 lançamentos" })).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Categoria" })).toBeInTheDocument();
    await userEvent.setup().click(within(sheet).getByRole("button", { name: "Categoria" }));
    expect(within(sheet).queryByRole("button", { name: "Ver 2 lançamentos" })).not.toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Ver 2 transações" })).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "← Voltar" })).toBeInTheDocument();
    expect(await screen.findByRole("listitem")).toHaveTextContent("Mercado");
    expect(screen.getByRole("listitem")).toHaveTextContent("A pagar");
    expect(within(sheet).getByRole("heading", { name: "Categoria" })).toHaveFocus();
    await userEvent.setup().click(within(sheet).getByRole("button", { name: "← Voltar" }));
    expect(within(sheet).getByRole("button", { name: "Categoria" })).toHaveFocus();
    await userEvent.setup().click(within(sheet).getByRole("button", { name: "Fechar filtros" }));
    await userEvent.setup().click(screen.getByRole("button", { name: /Mercado/ }));
    expect(screen.getByRole("dialog", { name: "Detalhes do lançamento" })).toHaveTextContent("Mercado");
    await userEvent.setup().keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Detalhes do lançamento" })).not.toBeInTheDocument();
  });

  it("carrega a próxima página automaticamente ao chegar ao fim da lista", async () => {
    let intersect;
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback) { intersect = callback; }
      observe() {}
      disconnect() {}
    });
    server.use(http.get("*/v1/transactions", ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      const page = Number(url.searchParams.get("page"));
      const data = page === 1
        ? Array.from({ length: 30 }, (_, index) => ({ id: index + 1, date: "2026-09-01", description: `Compra ${index + 1}`, value: 12, value_currency: "BRL", type: "expense" }))
        : [{ id: 31, date: "2026-08-01", description: "Compra final", value: 20, value_currency: "BRL", type: "expense" }];
      return HttpResponse.json({ data, pagination: { total: 31, page, limit: 30, pages: 2, has_next: page === 1, has_prev: page > 1 } });
    }));
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    expect(await screen.findByText("Compra 1")).toBeInTheDocument();
    await waitFor(() => expect(intersect).toBeTypeOf("function"));
    await act(async () => intersect([{ isIntersecting: true }]));
    expect(await screen.findByText("Compra final")).toBeInTheDocument();
    expect(requests.map((request) => request.searchParams.get("page"))).toEqual(["1", "2"]);
  });
  it("filtra pelo cartão, pagina sem laço por mês e retorna ao Hub selecionado", async () => {
    server.use(http.get("*/v1/transactions", ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      const page = Number(url.searchParams.get("page"));
      const rows = page === 1
        ? Array.from({ length: 30 }, (_, index) => ({ id: index + 1, date: "2026-09-01", description: index === 0 ? "Mercado" : `Compra ${index}`, value: 12, value_currency: "BRL", type: "expense" }))
        : [{ id: 31, date: "2026-08-01", description: "Farmácia", value: 12, value_currency: "BRL", type: "expense" }];
      return HttpResponse.json({ data: rows, pagination: { total: 31, page, limit: 30, pages: 2, has_next: page === 1, has_prev: page > 1 } });
    }));
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    expect(await screen.findByText("Mercado")).toBeInTheDocument();
    expect(requests).toHaveLength(1);
    expect(requests[0].searchParams.get("credit_card_id")).toBe("7");
    await userEvent.setup().click(screen.getByRole("checkbox", { name: "Selecionar lançamentos carregados" }));
    expect(screen.getByText(/30 selecionados/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Limpar seleção" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(await screen.findByText("Farmácia")).toBeInTheDocument();
    expect(requests).toHaveLength(2);
    expect(cardRequests).toBe(1);
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Voltar para o cartão" }));
    expect(navigate).toHaveBeenCalledWith({ to: "/cards", search: { view: "new", card: CARD_ID } });
  });

  it("exibe estado vazio sem buscar fatura", async () => {
    server.use(http.get("*/v1/transactions", ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json({ data: [], pagination: { total: 0, page: 1, limit: 30, pages: 0, has_next: false, has_prev: false } });
    }));
    render(<CardAllTransactionsPage organizationId={ORG_ID} isMobile />);
    expect(await screen.findByText("Nenhum lançamento corresponde aos filtros.")).toBeInTheDocument();
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
  });

  it("deduplica a carga inicial no StrictMode", async () => {
    render(<React.StrictMode><CardAllTransactionsPage organizationId={ORG_ID} /></React.StrictMode>);
    expect(await screen.findByText("Mercado")).toBeInTheDocument();
    expect(cardRequests).toBe(1);
    expect(requests).toHaveLength(1);
  });

  it("inclui lançamentos futuros e aplica busca em toda a lista do cartão", async () => {
    server.use(http.get("*/v1/transactions", ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      const searched = url.searchParams.get("description");
      const row = searched
        ? { id: 2, date: "2026-11-02", description: "Farmácia futura", value: 20, value_currency: "BRL", type: "expense" }
        : { id: 1, date: "2026-11-01", description: "Reserva futura", value: 10, value_currency: "BRL", type: "expense" };
      return HttpResponse.json({ data: [row], pagination: { total: 1, page: 1, limit: 30, pages: 1, has_next: false, has_prev: false } });
    }));
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    expect(await screen.findByText("Reserva futura")).toBeInTheDocument();
    expect(requests[0].searchParams.has("date_end")).toBe(false);
    await userEvent.setup().type(screen.getByRole("textbox", { name: "Buscar transações" }), "Farmácia");
    expect(await screen.findByText("Farmácia futura")).toBeInTheDocument();
    expect(screen.queryByText("Reserva futura")).not.toBeInTheDocument();
    expect(requests.at(-1).searchParams.get("description")).toBe("Farmácia");
    expect(requests.at(-1).searchParams.get("credit_card_id")).toBe("7");
    await userEvent.setup().click(screen.getByRole("button", { name: /Densidade da lista: Padrão/i }));
    expect(screen.getByRole("menuitemradio", { name: "Padrão" })).toHaveAttribute("aria-checked", "true");
    await userEvent.setup().click(screen.getByRole("menuitemradio", { name: "Compacto" }));
    expect(screen.getByRole("button", { name: /Densidade da lista: Compacto/i })).toBeInTheDocument();
    expect(screen.queryByRole("menu", { name: "Densidade da lista" })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /Densidade da lista: Compacto/i }));
    await userEvent.setup().keyboard("{Escape}");
    expect(screen.queryByRole("menu", { name: "Densidade da lista" })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /Agrupamento da lista/i }));
    expect(screen.getByRole("menuitemradio", { name: "Lista contínua" })).toHaveAttribute("aria-checked", "true");
    await userEvent.setup().click(screen.getByRole("menuitemradio", { name: "Agrupar por data" }));
    expect(screen.queryByRole("menu", { name: "Agrupamento da lista" })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /Agrupamento da lista/i }));
    expect(screen.getByRole("menuitemradio", { name: "Agrupar por data" })).toHaveAttribute("aria-checked", "true");
    await userEvent.setup().click(screen.getByRole("button", { name: /Abrir filtros/ }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Preset: Este mês" }));
    await waitFor(() => expect(requests.at(-1).searchParams.has("date_start")).toBe(true));
    expect(requests.at(-1).searchParams.has("date_end")).toBe(true);
    expect(requests.at(-1).searchParams.get("credit_card_id")).toBe("7");
  });
});

describe("CardAllTransactionsPage · recorte de tempo", () => {
  const history = {
    monthly_data: [
      { year: 2026, month: 8, month_name: "agosto 2026", invoice_id: 38, status: "paid", total_amount: "100.00", items_count: 3 },
      { year: 2026, month: 9, month_name: "setembro 2026", invoice_id: 39, status: "closed", total_amount: "200.00", items_count: 4 },
      { year: 2026, month: 10, month_name: "outubro 2026", invoice_id: 40, status: "open", total_amount: "300.00", items_count: 5 },
      { year: 2027, month: 1, month_name: "janeiro 2027", invoice_id: 50, status: "open", total_amount: "10.00", items_count: 1 },
    ],
  };
  const withHistory = (data = history) => server.use(http.get("*/v1/credit-cards/:id/invoices/history", () => HttpResponse.json(data)));
  const ids = (url) => url.searchParams.getAll("invoice_id").sort();

  it("abre na fatura aberta, sem intervalo de datas, e mostra o recorte num chip fixo", async () => {
    withHistory({ monthly_data: history.monthly_data.slice(0, 3) });
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    expect(await screen.findByText("Mercado")).toBeInTheDocument();
    expect(ids(requests.at(-1))).toEqual(["40"]);
    expect(requests.at(-1).searchParams.has("date_start")).toBe(false);
    expect(requests.at(-1).searchParams.has("date_end")).toBe(false);
    expect(screen.getByRole("button", { name: "Recorte de tempo: Fatura: Out. Ajustar." })).toBeInTheDocument();
  });

  it("abre na fatura atual do backend mesmo quando ela é do mês que o histórico não cobre", async () => {
    withHistory({ monthly_data: history.monthly_data.slice(0, 3).map((row) => ({ ...row, status: "closed" })) });
    server.use(http.get("*/v1/credit-cards/:id/invoices/current", () => HttpResponse.json({ month: "2026-11", invoice_id: 60, status: "open", total_amount: "5.00", items_count: 1, items: [] })));
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    expect(await screen.findByText("Mercado")).toBeInTheDocument();
    expect(ids(requests.at(-1))).toEqual(["60"]);
    expect(screen.getByRole("button", { name: /Recorte de tempo: Fatura: Nov/ })).toBeInTheDocument();
  });

  it("marca várias faturas, manda os ids repetidos e põe o ano nas de outro ano", async () => {
    withHistory({ monthly_data: history.monthly_data.slice(0, 3) });
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    expect(await screen.findByText("Mercado")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Recorte de tempo/ }));
    await user.click(screen.getByRole("checkbox", { name: "Fatura de setembro 2026" }));
    await waitFor(() => expect(ids(requests.at(-1))).toEqual(["39", "40"]));
    expect(screen.getByRole("button", { name: "Recorte de tempo: Faturas: Set, Out. Ajustar." })).toBeInTheDocument();
  });

  it("mostra o ano da fatura que não é do ano corrente", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 11));
    withHistory({ monthly_data: history.monthly_data.map((row) => row.year === 2027 ? { ...row, status: "closed" } : row) });
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    try {
      expect(await screen.findByText("Mercado")).toBeInTheDocument();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /Recorte de tempo/ }));
      await user.click(screen.getByRole("checkbox", { name: "Fatura de janeiro 2027" }));
      expect(await screen.findByRole("button", { name: /Faturas: Jan\/2027, Out|Faturas: Out, Jan\/2027/ })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("sem nenhuma fatura marcada não busca e pede para marcar", async () => {
    withHistory({ monthly_data: history.monthly_data.slice(2, 3) });
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    expect(await screen.findByText("Mercado")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Recorte de tempo/ }));
    const before = requests.length;
    await user.click(screen.getByRole("checkbox", { name: "Fatura de outubro 2026" }));
    expect(await screen.findByText("Marque ao menos uma fatura para ver os lançamentos.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recorte de tempo: Nenhuma fatura. Ajustar." })).toBeInTheDocument();
    expect(requests.length).toBe(before);
  });

  it("no modo Período livre usa datas e abandona o filtro de fatura", async () => {
    withHistory({ monthly_data: history.monthly_data.slice(2, 3) });
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    expect(await screen.findByText("Mercado")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Recorte de tempo/ }));
    await user.click(screen.getByRole("button", { name: "Período livre" }));
    await user.click(screen.getByRole("button", { name: "Preset: Este mês" }));
    await waitFor(() => expect(requests.at(-1).searchParams.has("date_start")).toBe(true));
    expect(requests.at(-1).searchParams.has("invoice_id")).toBe(false);
    expect(screen.getByRole("button", { name: "Recorte de tempo: Período: Este mês. Ajustar." })).toBeInTheDocument();
  });
});

describe("CardAllTransactionsPage · saídas por mês/semana", () => {
  const money = (amount) => ({ amount, currency: "BRL" });
  const history = { monthly_data: [
    { year: 2026, month: 9, invoice_id: 39, status: "closed", total_amount: "200.00", items_count: 4 },
    { year: 2026, month: 10, invoice_id: 40, status: "open", total_amount: "300.00", items_count: 5 },
  ] };
  const summaryWith = (breakdown) => http.get("*/v1/transactions/summary", ({ request }) => {
    const url = new URL(request.url);
    const invoices = url.searchParams.getAll("invoice_id");
    const kind = invoices.length === 1 ? "week" : "invoice";
    return HttpResponse.json({ total_transactions: 3, by_currency: [money("90.00")], breakdown: { by_category: [{ category: "Alimentação", amount: money("90.00") }], by_month: [], ...breakdown[kind] } });
  });

  it("com uma fatura mostra as semanas dela, cruzando a virada de mês", async () => {
    server.use(http.get("*/v1/credit-cards/:id/invoices/history", () => HttpResponse.json({ monthly_data: history.monthly_data.slice(1) })));
    server.use(summaryWith({ week: { by_invoice: [], by_week: [{ week_start: "2026-09-28", amount: money("40.00") }, { week_start: "2026-10-05", amount: money("50.00") }] } }));
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    const chart = await screen.findByRole("region", { name: "Saídas por mês e semana" });
    expect(await within(chart).findByRole("heading", { name: "Saídas por semana" })).toBeInTheDocument();
    const group = await within(chart).findByRole("group", { name: "Saídas por semana da fatura" });
    expect(within(group).getByText("28/09")).toBeInTheDocument();
    expect(within(group).getByText("05/10")).toBeInTheDocument();
  });

  it("com várias faturas desenha uma barra por fatura e o clique desmarca a fatura", async () => {
    server.use(http.get("*/v1/credit-cards/:id/invoices/history", () => HttpResponse.json(history)));
    const calls = [];
    server.use(http.get("*/v1/transactions/summary", ({ request }) => {
      const url = new URL(request.url);
      calls.push(url);
      const ids = url.searchParams.getAll("invoice_id");
      return HttpResponse.json({ total_transactions: 3, by_currency: [money("90.00")], breakdown: { by_category: [], by_month: [], by_week: ids.length === 1 ? [{ week_start: "2026-10-05", amount: money("50.00") }] : [], by_invoice: ids.length === 1 ? [] : [{ invoice_id: 39, credit_card_id: 7, year: 2026, month: 9, amount: money("40.00") }, { invoice_id: 40, credit_card_id: 7, year: 2026, month: 10, amount: money("50.00") }] } });
    }));
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Saídas por semana" });
    await user.click(screen.getByRole("button", { name: /Recorte de tempo/ }));
    await user.click(screen.getByRole("checkbox", { name: "Fatura de setembro 2026" }));
    const sept = await screen.findByRole("button", { name: /Fatura de Set 2026/ });
    expect(sept).toHaveAttribute("aria-pressed", "true");
    // a barra vem da consulta SEM o recorte de fatura, para que fatura desmarcada também apareça
    expect(calls.some((url) => url.searchParams.getAll("invoice_id").length === 0 && url.searchParams.get("credit_card_id") === "7")).toBe(true);
    await user.click(sept);
    await waitFor(() => expect(screen.getByRole("button", { name: "Recorte de tempo: Fatura: Out. Ajustar." })).toBeInTheDocument());
  });

  it("sem fatura marcada pede para marcar em vez de desenhar zero", async () => {
    server.use(http.get("*/v1/credit-cards/:id/invoices/history", () => HttpResponse.json({ monthly_data: history.monthly_data.slice(1) })));
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Saídas por semana" });
    await user.click(screen.getByRole("button", { name: /Recorte de tempo/ }));
    await user.click(screen.getByRole("checkbox", { name: "Fatura de outubro 2026" }));
    expect(await screen.findByText("Marque ao menos uma fatura pra ver as saídas.")).toBeInTheDocument();
  });

  it("a legenda do donut isola a categoria na query da tela inteira", async () => {
    server.use(http.get("*/v1/tags/catalog", () => HttpResponse.json({ categories: [{ id: "food", label: "Alimentação", system_key: "food", color: "#059669" }] })));
    server.use(http.get("*/v1/credit-cards/:id/invoices/history", () => HttpResponse.json({ monthly_data: history.monthly_data.slice(1) })));
    server.use(summaryWith({ week: { by_invoice: [], by_week: [] } }));
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Filtrar por Alimentação" }));
    await waitFor(() => expect(requests.at(-1).searchParams.getAll("category").length).toBeGreaterThan(0));
    expect(screen.getByRole("button", { name: "Filtrar por Alimentação" })).toHaveAttribute("aria-pressed", "true");
  });

  it("filtrar pela categoria oferece Desfazer/Refazer, como em /transactions", async () => {
    server.use(http.get("*/v1/tags/catalog", () => HttpResponse.json({ categories: [{ id: "food", label: "Alimentação", system_key: "food", color: "#059669" }] })));
    server.use(http.get("*/v1/credit-cards/:id/invoices/history", () => HttpResponse.json({ monthly_data: history.monthly_data.slice(1) })));
    server.use(summaryWith({ week: { by_invoice: [], by_week: [] } }));
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    const user = userEvent.setup();
    const food = await screen.findByRole("button", { name: "Filtrar por Alimentação" });
    // abrir a tela e escolher a fatura padrão não são passos do usuário
    expect(screen.queryByTestId("ledger-history")).toBeNull();
    await user.click(food);
    const undo = await screen.findByRole("button", { name: "Desfazer: remover Alimentação" });
    await user.click(undo);
    await waitFor(() => expect(screen.getByRole("button", { name: "Filtrar por Alimentação" })).toHaveAttribute("aria-pressed", "false"));
    await user.click(await screen.findByRole("button", { name: "Refazer: aplicar Alimentação" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Filtrar por Alimentação" })).toHaveAttribute("aria-pressed", "true"));
  });

  it("link para fatura inexistente cai na padrão sem oferecer Desfazer", async () => {
    route.search = { fc_inv: "2020-01" };
    server.use(http.get("*/v1/credit-cards/:id/invoices/history", () => HttpResponse.json({ monthly_data: history.monthly_data.slice(1) })));
    server.use(summaryWith({ week: { by_invoice: [], by_week: [] } }));
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    expect(await screen.findByRole("button", { name: "Recorte de tempo: Fatura: Out. Ajustar." })).toBeInTheDocument();
    expect(screen.queryByTestId("ledger-history")).toBeNull();
    route.search = {};
  });

  it("clicar numa semana recorta a lista nas datas dela e mantém as outras barras", async () => {
    server.use(http.get("*/v1/credit-cards/:id/invoices/history", () => HttpResponse.json({ monthly_data: history.monthly_data.slice(1) })));
    server.use(summaryWith({ week: { by_invoice: [], by_week: [{ week_start: "2026-10-05", amount: money("50.00") }, { week_start: "2026-10-12", amount: money("40.00") }] } }));
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Semana de 05\/10/ }));
    await waitFor(() => expect(requests.some((url) => url.searchParams.get("date_start") === "2026-10-05" && url.searchParams.get("date_end") === "2026-10-11")).toBe(true));
    expect(await screen.findByTestId("week-chip")).toHaveTextContent("Semana 05/10–11/10");
    // as outras semanas continuam no gráfico (consulta sem o recorte de datas)
    expect(screen.getByRole("button", { name: /Semana de 12\/10/ })).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByTestId("week-chip"));
    await waitFor(() => expect(screen.queryByTestId("week-chip")).toBeNull());
  });
});

describe("CardAllTransactionsPage · ações do ledger", () => {
  const tag = (id, label) => ({ categoria: [{ id, name: label, label, type: "category" }] });
  const ledger = [
    { id: 11, date: "2026-10-02", description: "Notebook", value: 100, value_currency: "BRL", type: "expense", status: "confirmed", tags: tag("c1", "Compras"), installment_info: [{ installment_number: 3, total_installments: 10, due_date: "2026-10-15", amount: 100 }] },
    { id: 12, date: "2026-10-02", description: "Padaria", value: 20, value_currency: "BRL", type: "expense", status: "confirmed", tags: tag("c2", "Alimentação") },
  ];
  const withLedger = (rows = ledger) => server.use(
    http.get("*/v1/transactions", ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json({ data: rows, pagination: { total: rows.length, page: 1, limit: 30, pages: 1, has_next: false, has_prev: false } });
    }),
    // Como no backend real: o catálogo de estorno tem categorias próprias, as de despesa não valem para refund.
    http.get("*/v1/tags/catalog", ({ request }) => HttpResponse.json({ categories: new URL(request.url).searchParams.get("transaction_type") === "refund"
      ? [{ id: "r1", label: "Não classificado", system_key: "unclassified", color: "#6B7280" }]
      : [{ id: "c1", label: "Compras", system_key: "shopping", color: "#2563EB" }, { id: "c3", label: "Lazer", system_key: "fun", color: "#059669" }] })),
  );

  it("mostra Parcela, Restam, Fim previsto e o subtotal do dia", async () => {
    withLedger();
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    expect(await screen.findByText("Notebook")).toBeInTheDocument();
    const list = screen.getByRole("list");
    expect(within(list).getByText("3/10")).toBeInTheDocument();
    expect(within(list).getByText(/7×/)).toBeInTheDocument();
    expect(within(list).getByText("mai/27")).toBeInTheDocument();
    expect(within(list).getByText(/2 itens/)).toBeInTheDocument();
    expect(within(list).getByText(/120,00/)).toBeInTheDocument();
  });

  it("categoriza em lote mandando só tag_ids e a data", async () => {
    withLedger();
    const bodies = [];
    server.use(http.put("*/v1/transactions/:id", async ({ request, params }) => { bodies.push({ id: params.id, body: await request.json() }); return HttpResponse.json({ id: Number(params.id) }); }));
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    const user = userEvent.setup();
    await screen.findByText("Notebook");
    await user.click(screen.getByRole("checkbox", { name: "Selecionar lançamentos carregados" }));
    await user.click(screen.getByRole("button", { name: "Categorizar" }));
    const dialog = screen.getByRole("dialog", { name: "Categorizar lançamentos" });
    await user.selectOptions(within(dialog).getByLabelText("Nova categoria"), "c3");
    await user.click(within(dialog).getByRole("button", { name: "Aplicar categoria" }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies.map((entry) => entry.body.tag_ids)).toEqual([["c3"], ["c3"]]);
    expect(Object.keys(bodies[0].body).sort()).toEqual(["date", "tag_ids"]);
    expect(await screen.findByText("2 lançamentos recategorizados.")).toBeInTheDocument();
  });

  it("categoriza em lote sem tocar nos estornos selecionados", async () => {
    withLedger([...ledger, { id: 13, date: "2026-10-03", description: "Estorno loja", value: 5, value_currency: "BRL", type: "refund", status: "confirmed", tags: tag("r1", "Não classificado") }]);
    const ids = [];
    server.use(http.put("*/v1/transactions/:id", ({ params }) => { ids.push(params.id); return HttpResponse.json({ id: Number(params.id) }); }));
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    const user = userEvent.setup();
    await screen.findByText("Notebook");
    await user.click(screen.getByRole("checkbox", { name: "Selecionar lançamentos carregados" }));
    await user.click(screen.getByRole("button", { name: "Categorizar" }));
    const dialog = screen.getByRole("dialog", { name: "Categorizar lançamentos" });
    expect(dialog).toHaveTextContent("1 estorno fica de fora");
    await user.selectOptions(within(dialog).getByLabelText("Nova categoria"), "c3");
    await user.click(within(dialog).getByRole("button", { name: "Aplicar categoria" }));
    await waitFor(() => expect(ids.sort()).toEqual(["11", "12"]));
  });

  it("depois de falha parcial, tentar de novo reenvia só o que falhou", async () => {
    withLedger();
    const attempts = [];
    server.use(http.put("*/v1/transactions/:id", ({ params }) => {
      attempts.push(params.id);
      return params.id === "12" && attempts.filter((id) => id === "12").length === 1 ? new HttpResponse(null, { status: 400 }) : HttpResponse.json({ id: Number(params.id) });
    }));
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    const user = userEvent.setup();
    await screen.findByText("Notebook");
    await user.click(screen.getByRole("checkbox", { name: "Selecionar lançamentos carregados" }));
    await user.click(screen.getByRole("button", { name: "Categorizar" }));
    const dialog = screen.getByRole("dialog", { name: "Categorizar lançamentos" });
    await user.selectOptions(within(dialog).getByLabelText("Nova categoria"), "c3");
    await user.click(within(dialog).getByRole("button", { name: "Aplicar categoria" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("1 de 2 não puderam ser alterados; 1 já foram");
    await user.click(within(dialog).getByRole("button", { name: "Aplicar categoria" }));
    await waitFor(() => expect(attempts.sort()).toEqual(["11", "12", "12"]));
  });

  it("em todos os cartões o detalhe não oferece mover nem estornar (a ação é do cartão da tela)", async () => {
    withLedger();
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    const user = userEvent.setup();
    await screen.findByText("Notebook");
    await user.click(screen.getByRole("button", { name: /Abrir filtros/ }));
    await user.click(screen.getByRole("button", { name: "Cartão" }));
    await user.click(screen.getByRole("button", { name: "Todos os cartões" }));
    await user.click(await screen.findByRole("button", { name: "Ver detalhes de Notebook" }));
    const detail = screen.getByRole("dialog", { name: "Detalhes do lançamento" });
    expect(within(detail).queryByRole("button", { name: /Mover para outra fatura/ })).not.toBeInTheDocument();
    expect(within(detail).queryByRole("button", { name: /Lançar estorno/ })).not.toBeInTheDocument();
  });

  it("move só as parcelas para a fatura escolhida e avisa dos itens à vista", async () => {
    withLedger();
    const moves = [];
    server.use(http.patch("*/v1/credit-cards/:card/installments/:tx/move-invoice", async ({ request, params }) => { moves.push({ card: params.card, tx: params.tx, body: await request.json() }); return HttpResponse.json({ success: true, message: "ok" }); }));
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    const user = userEvent.setup();
    await screen.findByText("Notebook");
    await user.click(screen.getByRole("checkbox", { name: "Selecionar lançamentos carregados" }));
    await user.click(screen.getByRole("button", { name: "Mover parcela" }));
    const dialog = screen.getByRole("dialog", { name: "Mover parcela de fatura" });
    expect(dialog).toHaveTextContent("1 item(ns) à vista foram ignorados");
    const option = within(dialog).getAllByRole("option").find((entry) => /dezembro 2026/.test(entry.textContent));
    await user.selectOptions(within(dialog).getByLabelText("Fatura de destino"), option.value);
    await user.click(within(dialog).getByRole("button", { name: "Mover parcela" }));
    await waitFor(() => expect(moves).toHaveLength(1));
    expect(moves[0]).toEqual({ card: "7", tx: "11", body: { target_year: 2026, target_month: 12 } });
  });

  it("lança estorno vinculado à compra, na categoria do catálogo de estorno, e recusa valor acima da compra", async () => {
    withLedger();
    const posted = [];
    server.use(http.post("*/v1/transactions", async ({ request }) => { posted.push(await request.json()); return HttpResponse.json({ id: 99, type: "refund" }); }));
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Ver detalhes de Notebook" }));
    await user.click(screen.getByRole("button", { name: /Lançar estorno desta compra/ }));
    const dialog = screen.getByRole("dialog", { name: "Lançar estorno" });
    const value = within(dialog).getByLabelText("Valor do estorno");
    await user.clear(value);
    await user.type(value, "150");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("O estorno não pode passar do valor da compra.");
    expect(within(dialog).getByRole("button", { name: "Lançar estorno" })).toBeDisabled();
    await user.clear(value);
    await user.type(value, "40");
    await user.click(within(dialog).getByRole("button", { name: "Lançar estorno" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ type: "refund", value: 40, refund_of_transaction_id: 11, card_id: 7, tag_ids: ["r1"], payment_method: "credit_card" });
  });

  it("exporta o conjunto inteiro do recorte, não só a página carregada", async () => {
    const pages = [];
    server.use(
      http.get("*/v1/transactions", ({ request }) => {
        const url = new URL(request.url);
        requests.push(url);
        const page = Number(url.searchParams.get("page"));
        const limit = Number(url.searchParams.get("limit"));
        pages.push({ page, limit });
        return HttpResponse.json({ data: [{ id: page, date: "2026-10-02", description: `Linha ${page}`, value: 5, value_currency: "BRL", type: "expense", status: "paid" }], pagination: { total: 2, page, limit, pages: 2, has_next: page === 1, has_prev: page > 1 } });
      }),
    );
    const created = [];
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: (blob) => { created.push(blob); return "blob:x"; }, revokeObjectURL: () => {} }));
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    const user = userEvent.setup();
    await screen.findByText("Linha 1");
    await user.click(screen.getByRole("button", { name: /Exportar/ }));
    const dialog = screen.getByRole("dialog", { name: "Exportar lançamentos" });
    expect(dialog).toHaveTextContent("2 lançamentos");
    await user.click(within(dialog).getByRole("button", { name: "Exportar CSV" }));
    await waitFor(() => expect(created).toHaveLength(1));
    expect(await created[0].text()).toContain("Linha 2");
    expect(pages.some((entry) => entry.limit === 100)).toBe(true);
  });

  it("o Assistente aponta itens sem categoria e abre a categorização deles", async () => {
    withLedger([{ id: 21, date: "2026-10-02", description: "Sem dono", value: 9, value_currency: "BRL", type: "expense", status: "confirmed" }, ledger[1]]);
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    const user = userEvent.setup();
    await screen.findByText("Sem dono");
    expect(screen.getByLabelText("1 alertas")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Assistente/ }));
    const drawer = screen.getByRole("dialog", { name: "Assistente" });
    expect(within(drawer).getByText("1 item sem categoria")).toBeInTheDocument();
    await user.click(within(drawer).getByRole("button", { name: "Categorizar" }));
    expect(screen.getByRole("dialog", { name: "Categorizar lançamentos" })).toHaveTextContent("1 lançamento selecionado");
  });
});
