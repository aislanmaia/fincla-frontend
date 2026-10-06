/** @vitest-environment jsdom */
import React from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
let historyCurrency = "BRL";
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
  http.get("*/v1/credit-cards/7/invoices/history", ({ request }) => {
    calls.push(new URL(request.url).pathname);
    const params = new URL(request.url).searchParams;
    if (params.get("include_commitments") !== "true" || params.get("months") !== "13") return HttpResponse.json({}, { status: 400 });
    return HttpResponse.json({ monthly_data: [
      { year: 2026, month: 9, month_name: "setembro", total_amount: money("500"), installments_amount: money("60"), recurrences_amount: { amount: "10", currency: historyCurrency } },
      { year: 2026, month: 10, month_name: "outubro", total_amount: money("400"), installments_amount: money("20"), recurrences_amount: money("10") },
      { year: 2026, month: 7, month_name: "julho", total_amount: money("75") },
    ] });
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
afterEach(() => { cleanup(); calls.length = 0; futureOverride = null; historyCurrency = "BRL"; server.resetHandlers(); navigate.mockReset(); vi.useRealTimers(); });

for (const isMobile of [false, true]) {
  describe(isMobile ? "mobile" : "desktop", () => {
    it("soma parcelas e recorrências do mês, mostra detalhe e limita as chamadas", async () => {
      render(<CardCommitmentsPage organizationId={ORG} isMobile={isMobile} />);
      expect((await screen.findAllByText("Notebook")).length).toBeGreaterThan(0);
      expect(screen.getAllByText("Assinatura").length).toBeGreaterThan(0);
      expect(screen.getByTestId("monthly-committed")).toHaveTextContent("R$ 150,00");
      expect(screen.getByTestId("committed-total")).toHaveTextContent("R$ 200,00");
      expect(screen.getByTestId("recurring-monthly")).toHaveTextContent("R$ 50,00");
      expect(screen.getByText("Dias 1–10 · 2 itens")).toBeInTheDocument();
      expect(screen.getAllByText("Serviços").length).toBeGreaterThan(0);
      expect(screen.queryByText("À vista")).not.toBeInTheDocument();
      expect(calls.filter((c) => c.startsWith("/v1/credit-cards"))).toHaveLength(3);
      const timeline = screen.getByRole("region", { name: "Linha do tempo do compromisso" });
      expect(within(timeline).getByText("R$ 70,00")).toBeInTheDocument();
      expect(within(timeline).getAllByText("Sem dados").length).toBeGreaterThan(0);
      expect(within(timeline).getByText("R$ 150,00")).toBeInTheDocument();
      expect(Number.parseInt(screen.getByTestId("timeline-bar-2026-09").style.height)).toBeLessThan(Number.parseInt(screen.getByTestId("timeline-bar-2026-10").style.height));
      expect(screen.queryByTestId("timeline-bar-2026-08")).not.toBeInTheDocument();
      const monthlyDetail = screen.getByRole("region", { name: "Detalhe por mês" });
      expect(within(monthlyDetail).getAllByText(/Histórico · parcelas/).some((item) => item.textContent.includes("60,00") && item.textContent.includes("10,00"))).toBe(true);
      expect(within(monthlyDetail).getAllByText("Sem dados").length).toBeGreaterThan(0);
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

it("alterna histórico e projeção sem novas chamadas e não inventa zero em mês sem fatura", async () => {
  const user = userEvent.setup();
  render(<CardCommitmentsPage organizationId={ORG} />);
  const timeline = await screen.findByRole("region", { name: "Linha do tempo do compromisso" });
  await user.click(within(screen.getByRole("group", { name: "Histórico" })).getByRole("button", { name: "Sem histórico" }));
  expect(within(timeline).queryByText("setembro 2026")).not.toBeInTheDocument();
  await user.click(within(screen.getByRole("group", { name: "Histórico" })).getByRole("button", { name: "6 meses" }));
  expect(within(timeline).getByText("setembro 2026")).toBeInTheDocument();
  expect(within(timeline).getAllByText("Sem dados").length).toBeGreaterThan(0);
  await user.click(within(screen.getByRole("group", { name: "Projeção" })).getByRole("button", { name: "3 meses" }));
  expect(within(timeline).queryByText("janeiro 2027")).not.toBeInTheDocument();
  expect(calls.filter((c) => c.startsWith("/v1/credit-cards"))).toHaveLength(3);
});

it("não soma moedas diferentes no histórico", async () => {
  historyCurrency = "EUR";
  render(<CardCommitmentsPage organizationId={ORG} />);
  expect(await screen.findByTestId("timeline-2026-09")).toHaveTextContent("Sem dados");
  expect(screen.queryByText("R$ 70,00")).not.toBeInTheDocument();
});

it("não formata compromisso futuro com a moeda errada do cartão", async () => {
  futureOverride = { monthly_breakdown: [
    { year: 2026, month: 10, month_name: "outubro", installments: [
      { transaction_id: 11, series_id: "a", description: "Notebook", amount: { amount: "100", currency: "EUR" }, installment_number: 2, total_installments: 3, due_date: "2026-10-10", category_name: "Tecnologia" },
    ], recurrences: [] },
  ] };
  render(<CardCommitmentsPage organizationId={ORG} />);
  expect(await screen.findByText(/A moeda dos compromissos recebidos não corresponde/)).toBeInTheDocument();
  expect(screen.getByTestId("committed-total")).toHaveTextContent("—");
  expect(screen.getByTestId("monthly-committed")).toHaveTextContent("—");
  expect(screen.queryByText("R$ 100,00")).not.toBeInTheDocument();
});

it("não converte ausência de limite e inventário em zero", async () => {
  server.use(http.get("*/v1/credit-cards", () => HttpResponse.json([{ id: 7, public_id: "public-card", description: "Azul", brand: "Visa", last4: "7112", currency: "BRL", credit_limit: null }])));
  render(<CardCommitmentsPage organizationId={ORG} />);
  expect((await screen.findAllByText("Notebook")).length).toBeGreaterThan(0);
  expect(screen.getByText("Limite não informado")).toBeInTheDocument();
});

it("não presume que uma recorrência é de baixo uso quando o catálogo falha", async () => {
  server.use(http.get("*/v1/recurring-series", () => HttpResponse.json({}, { status: 500 })));
  render(<CardCommitmentsPage organizationId={ORG} />);
  expect((await screen.findAllByText("Notebook")).length).toBeGreaterThan(0);
  expect(screen.getByText("Baixo uso indisponível")).toBeInTheDocument();
  expect(screen.queryByRole("checkbox", { name: /baixo uso/i })).not.toBeInTheDocument();
});

it("não assume BRL quando a moeda do cartão falta", async () => {
  server.use(http.get("*/v1/credit-cards", () => HttpResponse.json([{ id: 7, public_id: "public-card", description: "Azul", brand: "Visa", last4: "7112", currency: null, credit_limit: money("1000") }])));
  render(<CardCommitmentsPage organizationId={ORG} />);
  expect(await screen.findByText("Moeda do cartão indisponível")).toBeInTheDocument();
  expect(screen.getByTestId("committed-total")).toHaveTextContent("—");
});

it("agrupa por categoria e valor e ordena por categoria", async () => {
  const user = userEvent.setup();
  futureOverride = {
    monthly_breakdown: [
      { year: 2026, month: 10, month_name: "outubro", installments: [{ transaction_id: 11, description: "Notebook", amount: money("100"), installment_number: 2, total_installments: 3, category_name: "Tecnologia", due_date: "2026-10-10" }], recurrences: [] },
      { year: 2026, month: 11, month_name: "novembro", installments: [{ transaction_id: 12, description: "Notebook", amount: money("150"), installment_number: 3, total_installments: 3, category_name: "Tecnologia", due_date: "2026-11-10" }], recurrences: [] },
    ],
  };
  render(<CardCommitmentsPage organizationId={ORG} />);
  expect(await screen.findByText("Nenhuma parcela termina neste ciclo")).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Agrupar por"), "category");
  expect(screen.getByText("Tecnologia · 2 itens")).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Agrupar por"), "value");
  expect(screen.getByText("R$ 100,00 · 1 item")).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Ordenar por"), "category");
  expect(screen.getByLabelText("Ordenar por")).toHaveValue("category");
  await user.selectOptions(screen.getByLabelText("Agrupar por"), "month");
  expect(screen.getByText("Termina após o período consultado · 1 item")).toBeInTheDocument();
  expect(screen.getByText("Termina em novembro 2026 · 1 item")).toBeInTheDocument();
});

it("mostra alívio por parcela que termina, mesmo quando outros compromissos aumentam", async () => {
  futureOverride = { monthly_breakdown: [
    { year: 2026, month: 10, month_name: "outubro", installments: [
      { transaction_id: 11, series_id: "a", description: "Notebook", amount: money("100"), installment_number: 3, total_installments: 3, due_date: "2026-10-10", category_name: "Tecnologia" },
    ], recurrences: [{ series_id: "r", description: "Assinatura", amount: money("50"), due_date: "2026-10-10", projected: true, category_name: "Serviços" }] },
    { year: 2026, month: 11, month_name: "novembro", installments: [
      { transaction_id: 12, series_id: "b", description: "Geladeira", amount: money("300"), installment_number: 1, total_installments: 6, due_date: "2026-11-10", category_name: "Casa" },
    ], recurrences: [{ series_id: "r", description: "Assinatura", amount: money("50"), due_date: "2026-11-10", projected: true, category_name: "Serviços" }] },
  ] };
  render(<CardCommitmentsPage organizationId={ORG} />);
  expect((await screen.findAllByText("Notebook")).length).toBeGreaterThan(0);
  expect(screen.getByText("Redução de R$ 100,00")).toBeInTheDocument();
  expect(screen.getByText("1 parcela termina neste ciclo")).toBeInTheDocument();
  const detail = screen.getByRole("region", { name: "Detalhe por mês" });
  expect(within(detail).getByText("Próximo")).toBeInTheDocument();
  expect(within(detail).getByText("Geladeira")).toBeInTheDocument();
  expect(within(detail).getAllByText(/em assinaturas/).length).toBeGreaterThan(0);
});

it("inventário mostra cada compra uma vez e agrupa pelo mês de término", async () => {
  futureOverride = { monthly_breakdown: [
    { year: 2026, month: 10, month_name: "outubro", installments: [{ transaction_id: 11, series_id: "a", description: "Notebook", amount: money("100"), installment_number: 2, total_installments: 3, due_date: "2026-10-10", category_name: "Tecnologia" }], recurrences: [] },
    { year: 2026, month: 11, month_name: "novembro", installments: [{ transaction_id: 12, series_id: "a", description: "Notebook", amount: money("100"), installment_number: 3, total_installments: 3, due_date: "2026-11-10", category_name: "Tecnologia" }], recurrences: [] },
  ] };
  const user = userEvent.setup();
  render(<CardCommitmentsPage organizationId={ORG} />);
  const inventory = await screen.findByRole("region", { name: "Inventário de compromissos" });
  expect(within(inventory).getAllByText("Notebook")).toHaveLength(1);
  await user.selectOptions(screen.getByLabelText("Agrupar por"), "month");
  expect(within(inventory).getByText("Termina em novembro 2026 · 1 item")).toBeInTheDocument();
});
