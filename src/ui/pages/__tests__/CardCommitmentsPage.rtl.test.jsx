/** @vitest-environment jsdom */
import React from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate, useParams: () => ({ cardId: "public-card" }) }));
import { CardCommitmentsPage } from "../CardCommitmentsPage.jsx";

const ORG = "org";
const money = (amount) => ({ amount, currency: "BRL" });
const calls = [];
let futureOverride = null;
const server = setupServer(
  http.get("*/v1/credit-cards", ({ request }) => {
    calls.push(new URL(request.url).pathname);
    return HttpResponse.json([{ id: 7, public_id: "public-card", description: "Azul", brand: "Visa", last4: "7112", currency: "BRL", credit_limit: money("1000") }]);
  }),
  http.get("*/v1/credit-cards/7/future-commitments", ({ request }) => {
    calls.push(new URL(request.url).pathname);
    if (new URL(request.url).searchParams.get("include_inventory") !== "true") return HttpResponse.json({}, { status: 400 });
    return HttpResponse.json(futureOverride ?? {
      card_id: 7, card_name: "Azul", card_last4: "7112", summary: { total_committed: money("999") },
      monthly_breakdown: [
        { year: 2026, month: 10, month_name: "outubro", total_amount: money("150"), installments: [
          { transaction_id: 11, series_id: "a", description: "Notebook", amount: money("100"), installment_number: 2, total_installments: 3, due_date: "2026-10-10", purchase_date: "2026-09-10", category_name: "Tecnologia", category_id: "tech" },
          { transaction_id: 13, series_id: null, description: "À vista", amount: money("20"), installment_number: 1, total_installments: 1, due_date: "2026-10-12", purchase_date: "2026-10-12", category_name: "Casa", category_id: "home" },
        ], recurrences: [
          { series_id: "r", transaction_id: null, description: "Assinatura", amount: money("50"), due_date: "2026-10-10", category_name: "Serviços", category_id: "service", projected: true },
        ] },
        { year: 2026, month: 11, month_name: "novembro", total_amount: money("50"), installments: [], recurrences: [
          { series_id: "r", transaction_id: null, description: "Assinatura", amount: money("50"), due_date: "2026-11-10", category_name: "Serviços", category_id: "service", projected: true },
        ] },
      ], ending_soon: [], insights: [],
    });
  }),
  http.get("*/v1/recurring-series", () => HttpResponse.json({ series: [{ id: "r", is_low_usage: false }], summary: {} })),
  http.patch("*/v1/recurring-series/r", async ({ request }) => {
    calls.push(`low:${JSON.stringify(await request.json())}`);
    return HttpResponse.json({ id: "r", is_low_usage: true });
  }),
  http.patch("*/v1/credit-cards/7/installments/11/move-invoice", async ({ request }) => {
    calls.push(`move:${JSON.stringify(await request.json())}`);
    return HttpResponse.json({ success: true, message: "ok" });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 9, 6, 12)); });
afterEach(() => { cleanup(); calls.length = 0; futureOverride = null; server.resetHandlers(); navigate.mockReset(); vi.useRealTimers(); });

for (const isMobile of [false, true]) {
  describe(isMobile ? "mobile" : "desktop", () => {
    it("soma parcelas e recorrências do mês, mostra detalhe e limita as chamadas", async () => {
      render(<CardCommitmentsPage organizationId={ORG} isMobile={isMobile} />);
      expect(await screen.findByText("Notebook")).toBeInTheDocument();
      expect(screen.getAllByText("Assinatura").length).toBeGreaterThan(0);
      expect(screen.getByTestId("monthly-committed")).toHaveTextContent("R$ 150,00");
      expect(screen.getByTestId("committed-total")).toHaveTextContent("R$ 200,00");
      expect(screen.queryByText("À vista")).not.toBeInTheDocument();
      expect(calls.filter((c) => c.startsWith("/v1/credit-cards"))).toHaveLength(2);
    });
  });
}

it("marca baixo uso e move parcela pelo contrato", async () => {
  const user = userEvent.setup();
  render(<CardCommitmentsPage organizationId={ORG} />);
  await user.click(await screen.findByRole("checkbox", { name: /baixo uso.*Assinatura/i }));
  await waitFor(() => expect(calls).toContain('low:{"is_low_usage":true}'));
  await user.click(screen.getByRole("button", { name: /Mover Notebook/i }));
  await user.selectOptions(screen.getByLabelText("Fatura de destino"), "2026-11");
  await user.click(screen.getByRole("button", { name: /Confirmar mudança/i }));
  await waitFor(() => expect(calls).toContain('move:{"target_year":2026,"target_month":11}'));
});

it("não converte ausência de limite e inventário em zero", async () => {
  server.use(http.get("*/v1/credit-cards", () => HttpResponse.json([{ id: 7, public_id: "public-card", description: "Azul", brand: "Visa", last4: "7112", currency: "BRL", credit_limit: null }])));
  render(<CardCommitmentsPage organizationId={ORG} />);
  expect(await screen.findByText("Notebook")).toBeInTheDocument();
  expect(screen.getByText("Limite não informado")).toBeInTheDocument();
});

it("não presume que uma recorrência é de baixo uso quando o catálogo falha", async () => {
  server.use(http.get("*/v1/recurring-series", () => HttpResponse.json({}, { status: 500 })));
  render(<CardCommitmentsPage organizationId={ORG} />);
  expect(await screen.findByText("Notebook")).toBeInTheDocument();
  expect(screen.getByText("Baixo uso indisponível")).toBeInTheDocument();
  expect(screen.queryByRole("checkbox", { name: /baixo uso/i })).not.toBeInTheDocument();
});

it("não assume BRL quando a moeda do cartão falta", async () => {
  server.use(http.get("*/v1/credit-cards", () => HttpResponse.json([{ id: 7, public_id: "public-card", description: "Azul", brand: "Visa", last4: "7112", currency: null, credit_limit: money("1000") }])));
  render(<CardCommitmentsPage organizationId={ORG} />);
  expect(await screen.findByText("Notebook")).toBeInTheDocument();
  expect(screen.getByText("Moeda do cartão indisponível")).toBeInTheDocument();
  expect(screen.getByTestId("committed-total")).toHaveTextContent("—");
});

it("agrupa por categoria e valor, ordena por categoria e revela aumento", async () => {
  const user = userEvent.setup();
  futureOverride = {
    monthly_breakdown: [
      { year: 2026, month: 10, month_name: "outubro", installments: [{ transaction_id: 11, description: "Notebook", amount: money("100"), installment_number: 2, total_installments: 3, category_name: "Tecnologia", due_date: "2026-10-10" }], recurrences: [] },
      { year: 2026, month: 11, month_name: "novembro", installments: [{ transaction_id: 12, description: "Notebook", amount: money("150"), installment_number: 3, total_installments: 3, category_name: "Tecnologia", due_date: "2026-11-10" }], recurrences: [] },
    ],
  };
  render(<CardCommitmentsPage organizationId={ORG} />);
  expect(await screen.findByText("Aumento de R$ 50,00")).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Agrupar por"), "category");
  expect(screen.getByText("Tecnologia · 2 itens")).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Agrupar por"), "value");
  expect(screen.getByText("R$ 100,00 · 1 item")).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Ordenar por"), "category");
  expect(screen.getByLabelText("Ordenar por")).toHaveValue("category");
  await user.selectOptions(screen.getByLabelText("Agrupar por"), "month");
  expect(screen.getByText("outubro 2026 · 1 item")).toBeInTheDocument();
  expect(screen.getByText("novembro 2026 · 1 item")).toBeInTheDocument();
});
