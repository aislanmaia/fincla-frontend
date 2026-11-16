/** @vitest-environment jsdom */

/**
 * Relatórios no exportador único (fincla-api#526). "Exportar" abre o painel compartilhado com os lançamentos do
 * período do relatório (todas as contas da organização); o arquivo sai de `GET /v1/transactions/export` e os totais
 * do painel, do resumo do MESMO recorte com `slice_currency`. O caminho antigo (`/analytics/export-csv`, que só
 * passava o período e falhava calado) não é mais chamado.
 *
 * A camada HTTP é simulada (msw); tela, painel, hook do resumo e clientes de API são reais. Os gráficos vêm de um
 * dublê da leitura de análise do adapter — eles não entram no arquivo.
 */
import React from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { setCurrencyRegistry } from "../../money/currencyRegistry.js";

vi.mock("../../data/reportsAdapter.js", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchReportsAnalytics: () => Promise.resolve({
    monthlyData: [{ mes: "Nov'26", receita: 100, gasto: 40 }],
    drift: { driftData: [], driftColors: {} },
    compositionData: [],
    compositionWindowLabel: null,
    waterfallRows: [],
    velocityDaily: [],
    currencyUnavailable: null,
    byCurrency: [],
  }),
}));
vi.mock("../../../api/recurringSeries", () => ({
  listRecurringSeries: vi.fn(() => Promise.resolve({ series: [] })),
}));
vi.mock("recharts", () => {
  const passthrough = ({ children }) => <div>{children}</div>;
  const none = () => null;
  return {
    ResponsiveContainer: passthrough, AreaChart: passthrough, BarChart: passthrough, ComposedChart: passthrough,
    PieChart: passthrough, Area: none, Pie: none, Bar: none, Line: none, Cell: none, XAxis: none, YAxis: none,
    CartesianGrid: none, Tooltip: none, ReferenceLine: none,
  };
});

import { RelatoriosPage } from "../RelatoriosPage.jsx";

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const ORG = "org-1";
const money = (amount, currency = "BRL") => ({ amount, currency });
/** Contas em real e em dólar: os totais saem na base (BRL) com a cotação; o Resultado de cada moeda vem junto. */
const MIXED_SUMMARY = {
  total_transactions: 7,
  total_income: money("5000.00"),
  total_expenses: money("1530.00"),
  total_refunds: money("0.00"),
  balance: money("3470.00"),
  unsettled_count: 2,
  consolidation: { target_currency: "BRL", rates: [{ base: "USD", quote: "BRL", rate: "5.1000", quoted_on: "2026-11-14" }], unavailable: null },
  result_by_currency: [
    { currency: "BRL", total_transactions: 5, total_income: money("5000.00"), total_expenses: money("1020.00"), total_refunds: money("0.00"), balance: money("3980.00") },
    { currency: "USD", total_transactions: 2, total_income: money("0.00", "USD"), total_expenses: money("100.00", "USD"), total_refunds: money("0.00", "USD"), balance: money("-100.00", "USD") },
  ],
};

const server = setupServer();
let seen;
const withApi = ({ summary = () => HttpResponse.json(MIXED_SUMMARY), exported } = {}) => {
  seen = { summaries: [], exports: [], legacy: [] };
  server.use(
    http.get("*/v1/organizations/:id", () => HttpResponse.json({ id: ORG, base_currency: "BRL" })),
    http.get("*/v1/transactions/summary", ({ request }) => { seen.summaries.push(new URL(request.url).searchParams); return summary(); }),
    http.get("*/v1/transactions/export", ({ request }) => {
      seen.exports.push(new URL(request.url).searchParams);
      return exported ? exported() : new HttpResponse("%PDF-1.4", {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="relatorios-2026-06-a-2026-11-2026-11-16.pdf"' },
      });
    }),
    http.get("*/v1/analytics/export-csv", ({ request }) => { seen.legacy.push(new URL(request.url).searchParams); return new HttpResponse("x"); }),
  );
};

let downloads;
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
beforeEach(() => {
  // 16/11/2026 às 22h no fuso local: em UTC já é dia 17 — o período não pode depender disso.
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 10, 16, 22, 0) });
  setCurrencyRegistry([
    { code: "BRL", name: "Real", symbol: "R$", decimal_places: 2, is_active: true },
    { code: "USD", name: "Dólar", symbol: "US$", decimal_places: 2, is_active: true },
  ]);
  downloads = [];
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function recordClick() { downloads.push(this.download); });
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const openPanel = async (user) => {
  render(<RelatoriosPage dataMode="live" organizationId={ORG} />);
  await user.click(await screen.findByRole("button", { name: /Exportar/ }));
  return screen.findByRole("dialog", { name: "Exportar" });
};

const ONLY_PERIOD = ["organization_id", "date_start", "date_end"];

describe("Relatórios — Exportar pelo exportador único (fincla-api#526)", () => {
  it.each([
    ["6m", null, "2026-06-01", "2026-11-30", "Período: 01/06/2026 a 30/11/2026", "relatorios-2026-06-a-2026-11"],
    ["3m", "3m", "2026-09-01", "2026-11-30", "Período: 01/09/2026 a 30/11/2026", "relatorios-2026-09-a-2026-11"],
    ["12m", "12m", "2025-12-01", "2026-11-30", "Período: 01/12/2025 a 30/11/2026", "relatorios-2025-12-a-2026-11"],
  ])("período %s: painel com o período como filtro e o pedido só com as datas do relatório", async (_label, pick, from, to, periodLine, prefix) => {
    withApi();
    const user = userEvent.setup();
    render(<RelatoriosPage dataMode="live" organizationId={ORG} />);
    // Espera a tela assentar (relatório e moeda base carregados): antes disso o seletor ainda se redesenha.
    await waitFor(() => expect(document.body.textContent).toMatch(/R\$\s?100/));
    if (pick) await user.click(screen.getByRole("button", { name: pick }));
    await user.click(await screen.findByRole("button", { name: /Exportar/ }));
    // O botão só abre o painel: nada é baixado nem pedido ao exportador.
    expect(downloads).toEqual([]);
    const panel = await screen.findByRole("dialog", { name: "Exportar" });
    expect(within(panel).getByRole("list", { name: "Filtros ativos" })).toHaveTextContent(periodLine);

    await waitFor(() => expect(seen.summaries).toHaveLength(1));
    const summary = seen.summaries[0];
    // Todas as contas da organização: nenhum filtro além do período.
    expect([...new Set(summary.keys())].sort()).toEqual([...ONLY_PERIOD, "locale", "slice_currency"].sort());
    expect(summary.get("organization_id")).toBe(ORG);
    expect(summary.get("date_start")).toBe(from);
    expect(summary.get("date_end")).toBe(to);
    expect(summary.get("slice_currency")).toBe("true");
    // A contagem do painel é a do resumo do recorte inteiro.
    expect(await within(panel).findByText("7 lançamentos")).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "Exportar PDF" }));
    await waitFor(() => expect(seen.exports).toHaveLength(1));
    const asked = seen.exports[0];
    expect([...new Set(asked.keys())].sort()).toEqual(
      [...ONLY_PERIOD, "format", "content", "title", "filters_text", "file_prefix", "timezone", "locale"].sort(),
    );
    expect(asked.get("organization_id")).toBe(ORG);
    expect(asked.get("date_start")).toBe(from);
    expect(asked.get("date_end")).toBe(to);
    expect(asked.get("format")).toBe("pdf");
    expect(asked.get("content")).toBe("full");
    expect(asked.get("title")).toBe("Relatórios");
    expect(asked.getAll("filters_text")).toEqual([periodLine]);
    expect(asked.get("file_prefix")).toBe(prefix);
    await waitFor(() => expect(downloads).toEqual(["relatorios-2026-06-a-2026-11-2026-11-16.pdf"]));
    // O caminho antigo não é chamado.
    expect(seen.legacy).toEqual([]);
  });

  it("contas em moedas diferentes: totais na moeda base com a cotação e o Resultado de cada moeda", async () => {
    withApi();
    const user = userEvent.setup();
    const panel = await openPanel(user);
    const totals = await within(panel).findByTestId("export-totals");
    expect(totals).toHaveTextContent(/R\$\s?3\.470,00/);
    expect(totals).toHaveTextContent(/R\$\s?5\.000,00/);
    expect(panel).toHaveTextContent("1 US$ = R$ 5,1000");
    expect(panel).toHaveTextContent(/USD −US\$\s?100,00 \(2\)/);
  });

  it("falha do resumo aparece no painel, nunca engolida", async () => {
    withApi({ summary: () => HttpResponse.json({ detail: "boom" }, { status: 500 }) });
    const user = userEvent.setup();
    const panel = await openPanel(user);
    expect(await within(panel).findByText(/Não foi possível calcular os totais/)).toBeInTheDocument();
  });

  it("falha do exportador aparece no painel, que continua aberto", async () => {
    withApi({ exported: () => HttpResponse.json({ detail: "boom" }, { status: 500 }) });
    const user = userEvent.setup();
    const panel = await openPanel(user);
    await within(panel).findByTestId("export-totals");
    await user.click(within(panel).getByRole("button", { name: "Exportar PDF" }));
    await waitFor(() => expect(seen.exports).toHaveLength(1));
    expect(await within(panel).findAllByRole("alert")).not.toHaveLength(0);
    expect(screen.getByRole("dialog", { name: "Exportar" })).toBeInTheDocument();
    expect(downloads).toEqual([]);
    expect(seen.legacy).toEqual([]);
  });

  it("a tela não usa mais o cliente antigo de exportação", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(path.resolve(__dirname, "../RelatoriosPage.jsx"), "utf8");
    expect(source).not.toMatch(/downloadReportsCsvForUi|exportTransactionsCsv|downloadTransactionsCsv|export-csv/);
  });
});
