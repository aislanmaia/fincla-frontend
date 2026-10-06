/** @vitest-environment jsdom */

import React from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const CARD_ID = "00000000-0000-4000-8000-000000000001";
const ORG_ID = "11111111-1111-4111-8111-111111111111";
const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useParams: () => ({ cardId: CARD_ID, year: "2026", month: "10" }),
}));

import { CardTransactionsPage } from "../CardTransactionsPage.jsx";

const money = (amount) => ({ amount, currency: "BRL" });
const item = (id, description, amount, date, category, modality = "cash") => ({
  id, series_id: `series-${id}`, transaction_id: id, transaction_date: date, description,
  amount: money(amount), installment_number: 1, total_installments: 1, modality,
  tags: { categoria: [{ id: category === "Alimentação" ? "food" : "fuel", name: category, color: "#2563EB" }], etiqueta: [{ id: category === "Alimentação" ? "market" : "fuel-tag", name: category === "Alimentação" ? "mercado" : "combustível" }] },
});
const items = [
  item(1, "Mercado", "100.00", "2026-09-28", "Alimentação"),
  { ...item(2, "Posto", "60.00", "2026-10-12", "Transporte"), purchase_info: { purchase_date: "2026-08-03", total_value: money("60.00") } },
  item(3, "Estorno Posto", "20.00", "2026-10-19", "Transporte", "refund"),
];
const detail = {
  month: "2026-10", due_date: "2026-10-10", total_amount: money("140.00"), status: "open",
  closing_date: "2026-10-15", paid_date: null, days_until_due: 6, is_overdue: false,
  previous_month_total: null, month_over_month_change: null, limit_usage_percent: null,
  items_count: 3, items,
  category_breakdown: [
    { category_id: "food", category_name: "Alimentação", category_color: "#2563EB", total: money("100.00"), percentage: 71.4, transaction_count: 1 },
    { category_id: "fuel", category_name: "Transporte", category_color: "#059669", total: money("40.00"), percentage: 28.6, transaction_count: 2 },
  ],
};
const cards = [{ id: 1, public_id: CARD_ID, description: "Azul", brand: "Visa", last4: "7112", currency: "BRL" }];
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
beforeEach(() => { navigate.mockReset(); localStorage.clear(); });
afterEach(() => { server.resetHandlers(); cleanup(); vi.useRealTimers(); });

function serve({ invoice = detail, cardList = cards } = {}) {
  const calls = [];
  server.use(
    http.get("*/v1/credit-cards", ({ request }) => {
      calls.push(new URL(request.url).pathname);
      expect(new URL(request.url).searchParams.get("organization_id")).toBe(ORG_ID);
      return HttpResponse.json(cardList);
    }),
    http.get("*/v1/credit-cards/:id/invoices/:year/:month", ({ request, params }) => {
      calls.push(new URL(request.url).pathname);
      expect(params).toMatchObject({ id: "1", year: "2026", month: "10" });
      return HttpResponse.json(invoice);
    }),
  );
  return calls;
}

describe("Lançamentos de um cartão", () => {
  it("usa o public_id na rota, carrega duas chamadas e mantém o resumo da fatura inteira ao filtrar", async () => {
    const calls = serve();
    const user = userEvent.setup();
    render(<CardTransactionsPage organizationId={ORG_ID} />);
    expect(await screen.findByRole("heading", { name: "Lançamentos da fatura" })).toBeInTheDocument();
    expect((await screen.findAllByText("R$ 140,00")).length).toBeGreaterThan(0);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toBe("/v1/credit-cards/1/invoices/2026/10");
    const list = within(screen.getByRole("region", { name: "Lançamentos da fatura" })).getByRole("list");
    expect(within(list).getByRole("listitem", { name: /Posto, compra de R\$.*60,00 em 12\/10\/2026/ })).toBeInTheDocument();
    expect(within(list).queryByRole("button", { name: /Posto/ })).not.toBeInTheDocument();
    expect(within(list).queryByText("A pagar")).not.toBeInTheDocument();
    expect(within(list).queryByRole("button", { name: /Editar|Excluir|Pagar/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Categoria: Todas/ }));
    await user.click(screen.getByRole("button", { name: "Alimentação" }));
    expect(within(screen.getByRole("region", { name: "Lançamentos da fatura" })).getByText("Mercado")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Lançamentos da fatura" })).queryByText("Posto")).not.toBeInTheDocument();
    expect(screen.getByText("Exibindo 1 de 3 lançamentos. Os filtros não alteram o resumo da fatura.")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 140,00").length).toBeGreaterThan(0);
    expect(calls).toHaveLength(2);
  });

  it("oferece densidade e agrupamento compartilhados com Transações no mobile", async () => {
    serve();
    const user = userEvent.setup();
    render(<CardTransactionsPage organizationId={ORG_ID} isMobile />);
    await screen.findByText("Mercado");
    await user.selectOptions(screen.getByRole("combobox", { name: "Densidade da lista" }), "compacto");
    await user.click(screen.getByRole("checkbox", { name: "Agrupar por data" }));
    expect(screen.getByText("28 de setembro de 2026")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Semana de 28\/09: R\$\s*100,00/ })).toBeInTheDocument();
    expect(screen.getByText("Mercado").closest(".fincla-row")).toHaveStyle({ minHeight: "48px" });
    const mobileList = within(screen.getByRole("region", { name: "Lançamentos da fatura" })).getByRole("list");
    expect(within(mobileList).getByRole("listitem", { name: /Mercado, compra de R\$.*100,00/ })).not.toHaveAttribute("tabindex");
    expect(within(mobileList).queryByRole("button")).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("fincla:transactions:list-prefs"))).toMatchObject({ density: "compacto", grouped: true });
  });

  it("usa a altura confortável da lista de Transações no desktop", async () => {
    serve();
    const user = userEvent.setup();
    render(<CardTransactionsPage organizationId={ORG_ID} />);
    await screen.findByText("Mercado");
    await user.selectOptions(screen.getByRole("combobox", { name: "Densidade da lista" }), "confortavel");
    expect(screen.getByText("Mercado").closest(".fincla-row")).toHaveStyle({ height: "56px" });
    expect(within(screen.getByRole("region", { name: "Lançamentos da fatura" })).getAllByRole("listitem")).toHaveLength(3);
  });

  it("aplica a faceta Período localmente e mantém o total agregado da fatura", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 6, 12));
    const calls = serve();
    const user = userEvent.setup();
    render(<CardTransactionsPage organizationId={ORG_ID} />);
    await screen.findByText("Mercado");
    await user.click(screen.getByRole("button", { name: /Período: Todo período/ }));
    await user.click(screen.getByRole("button", { name: "Preset: Este mês" }));
    expect(within(screen.getByRole("region", { name: "Lançamentos da fatura" })).queryByText("Mercado")).not.toBeInTheDocument();
    expect(screen.getByText("Exibindo 2 de 3 lançamentos. Os filtros não alteram o resumo da fatura.")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 140,00").length).toBeGreaterThan(0);
    expect(calls).toHaveLength(2);
  });

  it("aplica a faceta Tags sobre os itens da fatura sem refazer o resumo", async () => {
    const calls = serve();
    const user = userEvent.setup();
    render(<CardTransactionsPage organizationId={ORG_ID} />);
    await screen.findByText("Mercado");
    await user.click(screen.getByRole("button", { name: /Tags:/ }));
    await user.click(screen.getByRole("button", { name: "Tag combustível" }));
    expect(within(screen.getByRole("region", { name: "Lançamentos da fatura" })).queryByText("Mercado")).not.toBeInTheDocument();
    expect(screen.getByText("Exibindo 2 de 3 lançamentos. Os filtros não alteram o resumo da fatura.")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 140,00").length).toBeGreaterThan(0);
    expect(calls).toHaveLength(2);
  });

  it("aplica Valor e modalidade de estorno com o total da fatura estável", async () => {
    const calls = serve();
    const user = userEvent.setup();
    render(<CardTransactionsPage organizationId={ORG_ID} />);
    await screen.findByText("Mercado");
    await user.click(screen.getByRole("button", { name: /Valor: Qualquer/ }));
    await user.type(screen.getByRole("textbox", { name: "Valor mínimo" }), "70");
    expect(screen.getByText("Exibindo 1 de 3 lançamentos. Os filtros não alteram o resumo da fatura.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpar todos os filtros" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrar modalidade" }), "refund");
    expect(within(screen.getByRole("region", { name: "Lançamentos da fatura" })).getByText("Estorno Posto")).toBeInTheDocument();
    expect(screen.getByText("Exibindo 1 de 3 lançamentos. Os filtros não alteram o resumo da fatura.")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 140,00").length).toBeGreaterThan(0);
    expect(calls).toHaveLength(2);
  });

  it("não consulta fatura de cartão fora da organização", async () => {
    const calls = serve({ cardList: [] });
    render(<CardTransactionsPage organizationId={ORG_ID} />);
    expect(await screen.findByText("Cartão não encontrado ou sem acesso.")).toBeInTheDocument();
    expect(calls).toEqual(["/v1/credit-cards"]);
  });

  it("deduplica as requisições durante o replay de efeitos do React", async () => {
    const calls = serve();
    render(<React.StrictMode><CardTransactionsPage organizationId={ORG_ID} /></React.StrictMode>);
    await screen.findByText("Mercado");
    await waitFor(() => expect(calls).toHaveLength(2));
  });

  it("usa a moeda do agregado para cartão em EUR", async () => {
    const euro = (amount) => ({ amount, currency: "EUR" });
    const invoice = {
      ...detail,
      total_amount: euro("140.00"),
      items: detail.items.map((entry) => ({ ...entry, amount: euro(entry.amount.amount) })),
      category_breakdown: detail.category_breakdown.map((entry) => ({ ...entry, total: euro(entry.total.amount) })),
    };
    serve({ invoice, cardList: [{ ...cards[0], currency: "EUR" }] });
    render(<CardTransactionsPage organizationId={ORG_ID} />);
    expect((await screen.findAllByText(/140,00/))[0].textContent).toContain("€");
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
  });

  it("recupera a moeda do agregado quando cartão não a informa e mostra ausência se ambos faltam", async () => {
    serve({ cardList: [{ ...cards[0], currency: null }] });
    const view = render(<CardTransactionsPage organizationId={ORG_ID} />);
    expect((await screen.findAllByText("R$ 140,00")).length).toBeGreaterThan(0);
    view.unmount();
    server.resetHandlers();
    const unknown = {
      ...detail,
      total_amount: 140,
      items: detail.items.map((entry) => ({ ...entry, amount: Number(entry.amount.amount) })),
      category_breakdown: detail.category_breakdown.map((entry) => ({ ...entry, total: Number(entry.total.amount) })),
    };
    serve({ invoice: unknown, cardList: [{ ...cards[0], currency: null }] });
    render(<CardTransactionsPage organizationId={ORG_ID} />);
    expect(await screen.findByText("Moeda da fatura indisponível; os valores não podem ser exibidos com segurança.")).toBeInTheDocument();
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
  });
});
