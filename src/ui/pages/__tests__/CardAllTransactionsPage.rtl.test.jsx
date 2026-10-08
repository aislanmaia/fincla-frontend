/** @vitest-environment jsdom */
import React from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
import { CardAllTransactionsPage } from "../CardAllTransactionsPage.jsx";

const requests = [];
let cardRequests = 0;
const server = setupServer(
  http.get("*/v1/credit-cards", () => {
    cardRequests += 1;
    return HttpResponse.json([{ id: 7, public_id: CARD_ID, description: "Azul", last4: "7112", currency: "BRL" }]);
  }),
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
afterAll(() => server.close());
afterEach(() => { cleanup(); server.resetHandlers(); requests.length = 0; cardRequests = 0; navigate.mockReset(); });

describe("CardAllTransactionsPage", () => {
  it("filtra pelo cartão, pagina sem laço por mês e retorna ao Hub selecionado", async () => {
    render(<CardAllTransactionsPage organizationId={ORG_ID} />);
    expect(await screen.findByText("Mercado")).toBeInTheDocument();
    expect(requests).toHaveLength(1);
    expect(requests[0].searchParams.get("credit_card_id")).toBe("7");
    await userEvent.setup().click(screen.getByRole("button", { name: "Carregar mais lançamentos" }));
    expect(await screen.findByText("Farmácia")).toBeInTheDocument();
    expect(requests).toHaveLength(2);
    expect(cardRequests).toBe(1);
    await userEvent.setup().click(screen.getByRole("button", { name: "Voltar para o cartão" }));
    expect(navigate).toHaveBeenCalledWith({ to: "/cards", search: { view: "new", card: CARD_ID } });
  });

  it("exibe estado vazio sem buscar fatura", async () => {
    server.use(http.get("*/v1/transactions", ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json({ data: [], pagination: { total: 0, page: 1, limit: 30, pages: 0, has_next: false, has_prev: false } });
    }));
    render(<CardAllTransactionsPage organizationId={ORG_ID} isMobile />);
    expect(await screen.findByText("Este cartão ainda não tem lançamentos.")).toBeInTheDocument();
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(screen.queryByRole("button", { name: "Carregar mais lançamentos" })).not.toBeInTheDocument();
  });
});
