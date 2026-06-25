/** @vitest-environment jsdom */

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

import { CartoesPage } from "../CartoesPage.jsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const TEST_CARDS = [
  {
    id: "card-test",
    banco: "Banco Teste",
    nome: "Cartao QA",
    dig: "1234",
    bandeira: "Visa",
    vencimento: 10,
    fechamento: 3,
    limite: 5000,
    disponivel: 4200,
    cor1: "#111827",
    cor2: "#1F2937",
    corChip: "#9CA3AF",
    corText: "#FFFFFF",
    faturas: [
      { id: "f1", mes: "Out'25", val: 100, pago: true, venc: "10/11/2025" },
      { id: "f2", mes: "Nov'25", val: 100, pago: true, venc: "10/12/2025" },
      { id: "f3", mes: "Dez'25", val: 100, pago: true, venc: "10/01/2026" },
      { id: "f4", mes: "Jan'26", val: 100, pago: true, venc: "10/02/2026" },
      { id: "f5", mes: "Fev'26", val: 100, pago: true, venc: "10/03/2026" },
      { id: "f6", mes: "Mar'26", val: 363.45, pago: false, venc: "10/04/2026", atual: true },
    ],
    tendencia: [],
    itens: [
      { id: 1, desc: "Mercado Extra", cat: "Alimentação", val: 123.45, data: "09/03", icon: "🛒", rec: false, parcela: null },
      { id: 2, desc: "Cinema", cat: "Lazer", val: 80, data: "10/03", icon: "🎬", rec: false, parcela: null },
      { id: 3, desc: "Notebook Gamer", cat: "Eletrônicos", val: 40, data: "11/03", icon: "💻", rec: false, parcela: { n: 1, t: 3, val: 40, total: 120 } },
    ],
    parcelas_ativas: [
      { id: "p1", desc: "Notebook Gamer", cat: "Eletrônicos", vParcela: 40, pago: 1, total: 3, vTotal: 120, icon: "💻" },
    ],
  },
];

function renderPage() {
  return render(
    <CartoesPage
      onNav={vi.fn()}
      onNewItem={vi.fn()}
      onLaunchRefund={vi.fn()}
      onOpenTransaction={vi.fn()}
      onTransactionsInvalidate={vi.fn()}
      isMobile={false}
      cards={TEST_CARDS}
      dataMode="mock"
      organizationId={null}
      transactionsRefreshToken={0}
    />,
  );
}

describe("CartoesPage - busca na aba Fatura", () => {
  it("mantem a busca existente por nome e categoria", async () => {
    renderPage();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText(/Buscar lançamentos, categoria ou valor/i);

    expect(screen.getByText("3 de 3 lançamentos")).toBeInTheDocument();

    await user.type(input, "mercado");
    expect(screen.getByText("1 de 3 lançamentos")).toBeInTheDocument();
    expect(screen.getByText("Mercado Extra")).toBeInTheDocument();
    expect(screen.queryByText("Cinema")).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "alimentação");
    expect(screen.getByText("1 de 3 lançamentos")).toBeInTheDocument();
    expect(screen.getByText("Mercado Extra")).toBeInTheDocument();
    expect(screen.queryByText("Notebook Gamer")).not.toBeInTheDocument();
  });

  it("permite buscar por valor do lançamento, da parcela e do total da compra", async () => {
    renderPage();
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText(/Buscar lançamentos, categoria ou valor/i);

    await user.type(input, "123,45");
    expect(screen.getByText("1 de 3 lançamentos")).toBeInTheDocument();
    expect(screen.getByText("Mercado Extra")).toBeInTheDocument();
    expect(screen.queryByText("Notebook Gamer")).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "40,00");
    expect(screen.getByText("1 de 3 lançamentos")).toBeInTheDocument();
    expect(screen.getByText("Notebook Gamer")).toBeInTheDocument();
    expect(screen.queryByText("Mercado Extra")).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "120,00");
    expect(screen.getByText("1 de 3 lançamentos")).toBeInTheDocument();
    expect(screen.getByText("Notebook Gamer")).toBeInTheDocument();
    expect(screen.queryByText("Cinema")).not.toBeInTheDocument();
  });
});
