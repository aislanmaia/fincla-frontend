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
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useParams: () => ({ cardId: CARD_ID }),
}));
import { CardAllTransactionsPage, csvCell } from "../CardAllTransactionsPage.jsx";

const requests = [];
let cardRequests = 0;
const server = setupServer(
  http.get("*/v1/credit-cards", () => {
    cardRequests += 1;
    return HttpResponse.json([{ id: 7, public_id: CARD_ID, description: "Azul", last4: "7112", currency: "BRL" }]);
  }),
  http.get("*/v1/credit-cards/:id/invoices/history", () => HttpResponse.json({ monthly_data: [] })),
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
afterEach(() => { cleanup(); server.resetHandlers(); requests.length = 0; cardRequests = 0; navigate.mockReset(); vi.unstubAllGlobals(); });

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

  it("preserva valor e moeda reais do histórico de faturas", async () => {
    server.use(http.get("*/v1/credit-cards/:id/invoices/history", () => HttpResponse.json({ monthly_data: [{ year: 2026, month: 9, total_amount: { amount: "25.00", currency: "USD" }, status: "paid" }] })));
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    const chart = await screen.findByRole("img", { name: /Valores das últimas faturas do cartão em USD/ });
    const bar = chart.querySelector("[title]");
    expect(bar?.title).toMatch(/25,00/);
    expect(bar?.title).not.toContain("R$");
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
    expect(screen.getByRole("button", { name: /Densidade da lista: Compacto/i })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Agrupar por data" }));
    expect(screen.getByRole("button", { name: "Agrupar por data" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.setup().click(screen.getByRole("button", { name: /Abrir filtros/ }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Preset: Este mês" }));
    await waitFor(() => expect(requests.at(-1).searchParams.has("date_start")).toBe(true));
    expect(requests.at(-1).searchParams.has("date_end")).toBe(true);
    expect(requests.at(-1).searchParams.get("credit_card_id")).toBe("7");
  });
});
