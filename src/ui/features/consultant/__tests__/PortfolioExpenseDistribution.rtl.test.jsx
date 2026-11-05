// @vitest-environment jsdom
import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getConsultantPortfolioCategoryContributors, streamConsultantPortfolioExpenseAnalysis } from "../../../../api/consultant.ts";
import { PortfolioExpenseDistribution } from "../PortfolioExpenseDistribution.jsx";

vi.mock("../../../../api/consultant.ts", () => ({ streamConsultantPortfolioExpenseAnalysis: vi.fn(), getConsultantPortfolioCategoryContributors: vi.fn() }));

const money = (amount) => ({ amount: String(amount), currency: "BRL" });
const report = {
  type: "portfolio_expense_distribution", period_start: "2026-01-01", period_end: "2026-01-31", reading_currency: "BRL",
  total_expenses: money(1200), client_count: 3, clients_with_expenses: 3, clients_without_expenses: 0, clients_converted: 3, clients_not_converted: 0,
  categories: [{ name: "Alimentação", total: money(1000), percentage: 83.33, client_count: 2 }, { name: "Moradia", total: money(200), percentage: 16.67, client_count: 1 }],
  original_currency_slices: [], conversion_issues: [], conversion_rates: [], converted_cohorts: [],
  highlights: { top_categories: [{ name: "Alimentação", percentage: 83.33, client_count: 2 }], combined_percentage: 83.33 },
};
const analysis = (value = report) => ({
  report: value,
  comparison: { period_start: "2025-12-01", period_end: "2025-12-31", current_total: value.total_expenses || money(0), previous_total: money(800), delta: money(400), delta_percentage: 50, comparable_client_count: 3, current_client_count: 3, excluded_from_comparison: 0, quotation_policy: "same_reading_quotation" },
  categories: value.categories.map((category) => ({ name: category.name, current_total: category.total, previous_total: money(100), delta: money(900), delta_percentage: 900, share_delta_pp: 10, client_count: category.client_count, top_client_share: 50 })),
  monthly_trend: [{ period_start: value.period_start, period_end: value.period_end, total: value.total_expenses || money(0), categories: { Alimentação: money(1000), Moradia: money(200) } }],
  insights: [],
});

describe("PortfolioExpenseDistribution", () => {
  beforeEach(() => {
    cleanup();
    vi.mocked(streamConsultantPortfolioExpenseAnalysis).mockReset();
    vi.mocked(getConsultantPortfolioCategoryContributors).mockReset();
    vi.mocked(streamConsultantPortfolioExpenseAnalysis).mockImplementation(async (_params, onEvent) => {
      onEvent({ type: "report.ready", data: analysis() });
      onEvent({ type: "insight.started", data: {} });
      onEvent({ type: "insight.ready", data: { period_start: report.period_start, period_end: report.period_end, insights: [{ title: "Alimentação concentra gastos", description: "Dois clientes registraram despesas nessa categoria.", follow_up: "Quais clientes mais contribuíram para Alimentação?", evidence_keys: ["top_categories"] }] } });
      onEvent({ type: "completed", data: {} });
    });
  });

  it("loads comparison and trend while hiding routine currency/coverage notices", async () => {
    render(<PortfolioExpenseDistribution block={report} />);
    expect(await screen.findByRole("heading", { name: "Ritmo mensal da carteira" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Distribuição de gastos da carteira" })).toBeInTheDocument();
    expect(screen.getByText("Análise concluída")).toBeInTheDocument();
    expect(screen.getByText(/Inclui despesas ainda não pagas mas já lançadas\./)).toBeInTheDocument();
    expect(screen.getByText(/vs R\$ 800,00 no período anterior/)).toBeInTheDocument();
    expect(await screen.findByText(/Alimentação concentra gastos/)).toBeInTheDocument();
    expect(screen.queryByText(/alcance e concentração não são a mesma coisa/i)).not.toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Gastos agregados por categoria" })).getByText("Alimentação")).toBeInTheDocument();
    expect(screen.queryByText("Cobertura da carteira")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Conversões aplicadas" })).not.toBeInTheDocument();
  });

  it("fits a long monthly trend in the drawer with compact values and exact amounts for assistive tech", async () => {
    vi.mocked(getConsultantPortfolioCategoryContributors).mockResolvedValue({ category_name: "Alimentação", category_total: money(1000), reading_currency: "BRL", period_start: report.period_start, period_end: report.period_end, client_count: 1, truncated: false, clients: [] });
    const months = Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, "0");
      return { period_start: `2026-${month}-01`, period_end: `2026-${month}-28`, total: money(0), categories: { Alimentação: money(index === 8 ? 12713 : 0) } };
    });
    vi.mocked(streamConsultantPortfolioExpenseAnalysis).mockImplementationOnce(async (_params, onEvent) => {
      onEvent({ type: "report.ready", data: { ...analysis(), monthly_trend: months } });
      onEvent({ type: "completed", data: {} });
    });
    render(<PortfolioExpenseDistribution block={report} />);
    fireEvent.click(await screen.findByRole("button", { name: "Detalhar Alimentação" }));
    const chart = await screen.findByRole("img", { name: "Gastos mensais de Alimentação" });
    expect(chart).toHaveClass("portfolio-expense__trend-bars--dense");
    expect(within(chart).getAllByRole("group")).toHaveLength(12);
    expect(within(chart).getByRole("group", { name: /set.*R\$\s?12\.713,00/i })).toBeInTheDocument();
    expect(within(chart).getByText(/12,7\s?mil/)).toBeInTheDocument();
  });

  it("fits a long monthly rhythm in the main chart instead of hiding months behind a scroll", async () => {
    const months = Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, "0");
      return { period_start: `2026-${month}-01`, period_end: `2026-${month}-28`, total: money(index === 8 ? 28377.8 : 0), categories: {} };
    });
    vi.mocked(streamConsultantPortfolioExpenseAnalysis).mockImplementationOnce(async (_params, onEvent) => {
      onEvent({ type: "report.ready", data: { ...analysis(), monthly_trend: months } });
      onEvent({ type: "completed", data: {} });
    });
    render(<PortfolioExpenseDistribution block={report} />);
    const chart = await screen.findByRole("img", { name: /Tendência mensal/ });
    expect(chart).toHaveClass("portfolio-expense__trend-bars--dense");
    expect(within(chart).getAllByRole("group")).toHaveLength(12);
    expect(within(chart).getByRole("group", { name: /set.*R\$\s?28\.377,80/i })).toBeInTheDocument();
    expect(within(chart).getByText(/28,4\s?mil/)).toBeInTheDocument();
  });

  it("keeps the short monthly rhythm with full values", async () => {
    render(<PortfolioExpenseDistribution block={report} />);
    const chart = await screen.findByRole("img", { name: /Tendência mensal/ });
    expect(chart).not.toHaveClass("portfolio-expense__trend-bars--dense");
  });

  it("never leaves the reading spinner stuck when the stream completes without an outcome", async () => {
    vi.mocked(streamConsultantPortfolioExpenseAnalysis).mockImplementationOnce(async (_params, onEvent) => {
      onEvent({ type: "report.ready", data: analysis() });
      onEvent({ type: "completed", data: {} });
    });
    render(<PortfolioExpenseDistribution block={report} />);
    expect(await screen.findByRole("button", { name: "Tentar leitura novamente" })).toBeInTheDocument();
    expect(screen.queryByText("Interpretando os dados do período…")).not.toBeInTheDocument();
  });

  it("shows an error, not 'no observations', when a retry ends without an outcome", async () => {
    vi.mocked(streamConsultantPortfolioExpenseAnalysis)
      .mockImplementationOnce(async (_params, onEvent) => {
        onEvent({ type: "report.ready", data: analysis() });
        onEvent({ type: "insight.failed", data: { code: "unavailable", message: "x" } });
        onEvent({ type: "completed", data: {} });
      })
      .mockImplementationOnce(async (_params, onEvent) => { onEvent({ type: "completed", data: {} }); });
    render(<PortfolioExpenseDistribution block={report} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tentar leitura novamente" }));
    expect(await screen.findByRole("button", { name: "Tentar leitura novamente" })).toBeInTheDocument();
    expect(screen.queryByText(/Sem observações adicionais/)).not.toBeInTheDocument();
  });

  it("gives each retry its own controller and cancels the previous stream", async () => {
    vi.mocked(streamConsultantPortfolioExpenseAnalysis)
      .mockImplementationOnce(async (_params, onEvent) => {
        onEvent({ type: "report.ready", data: analysis() });
        onEvent({ type: "insight.failed", data: { code: "unavailable", message: "x" } });
        onEvent({ type: "completed", data: {} });
      })
      .mockImplementationOnce(() => new Promise(() => {}));
    render(<PortfolioExpenseDistribution block={report} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tentar leitura novamente" }));
    await waitFor(() => expect(streamConsultantPortfolioExpenseAnalysis).toHaveBeenCalledTimes(2));
    const [first, second] = vi.mocked(streamConsultantPortfolioExpenseAnalysis).mock.calls;
    expect(second[2]).not.toBe(first[2]);
    expect(first[2].aborted).toBe(true);
    expect(second[2].aborted).toBe(false);
  });

  it("aborts the in-flight stream when the report unmounts", async () => {
    let signal;
    vi.mocked(streamConsultantPortfolioExpenseAnalysis).mockImplementationOnce((_params, onEvent, receivedSignal) => {
      signal = receivedSignal;
      onEvent({ type: "report.ready", data: analysis() });
      return new Promise(() => {});
    });
    const { unmount } = render(<PortfolioExpenseDistribution block={report} />);
    await screen.findByRole("table", { name: "Gastos agregados por categoria" });
    unmount();
    await waitFor(() => expect(signal.aborted).toBe(true));
  });

  it("still loads under React StrictMode, whose dev double-mount must not cancel the first load for good", async () => {
    render(<StrictMode><PortfolioExpenseDistribution block={report} /></StrictMode>);
    expect(await screen.findByText(/Alimentação concentra gastos/)).toBeInTheDocument();
    expect(await screen.findByRole("table", { name: "Gastos agregados por categoria" })).toBeInTheDocument();
    // The dev double-mount must not turn one load into two paid readings.
    expect(streamConsultantPortfolioExpenseAnalysis).toHaveBeenCalledTimes(1);
  });

  it("loads named contributors only when category drilldown is requested", async () => {
    vi.mocked(getConsultantPortfolioCategoryContributors).mockResolvedValue({ category_name: "Alimentação", category_total: money(1000), reading_currency: "BRL", period_start: report.period_start, period_end: report.period_end, client_count: 1, clients_not_converted: 0, truncated: false, clients: [{ organization_id: "client-a", client_name: "Ana Silva", total: money(600), percentage_of_category: 60 }] });
    render(<PortfolioExpenseDistribution block={report} />);
    await screen.findByRole("heading", { name: "Ritmo mensal da carteira" });
    expect(getConsultantPortfolioCategoryContributors).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Detalhar Alimentação" }));
    expect(await screen.findByText("Ana Silva")).toBeInTheDocument();
    expect(getConsultantPortfolioCategoryContributors).toHaveBeenCalledWith({ category_name: "Alimentação", date_start: "2026-01-01", date_end: "2026-01-31", limit: 10, offset: 0 });
  });

  it("keeps verified metrics available when AI interpretation fails and retries only the interpretation", async () => {
    vi.mocked(streamConsultantPortfolioExpenseAnalysis).mockImplementationOnce(async (_params, onEvent) => {
      onEvent({ type: "report.ready", data: analysis() });
      onEvent({ type: "insight.failed", data: { message: "provider unavailable" } });
    });
    render(<PortfolioExpenseDistribution block={report} />);
    expect(await screen.findByRole("table", { name: "Gastos agregados por categoria" })).toBeInTheDocument();
    expect(await screen.findByText("Não foi possível gerar a leitura deste período.")).toBeInTheDocument();
    expect(screen.queryByText(/alcance e concentração não são a mesma coisa/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar leitura novamente" }));
    expect(await screen.findByText(/Alimentação concentra gastos/)).toBeInTheDocument();
    expect(streamConsultantPortfolioExpenseAnalysis).toHaveBeenCalledTimes(2);
    expect(streamConsultantPortfolioExpenseAnalysis).toHaveBeenLastCalledWith(
      { date_start: report.period_start, date_end: report.period_end },
      expect.any(Function), expect.anything(), true,
    );
  });

  it("explains a monthly insight limit without offering a futile retry", async () => {
    vi.mocked(streamConsultantPortfolioExpenseAnalysis).mockImplementationOnce(async (_params, onEvent) => {
      onEvent({ type: "report.ready", data: analysis() });
      onEvent({ type: "insight.failed", data: { code: "quota_exceeded", message: "Limite mensal de leituras automáticas atingido" } });
      onEvent({ type: "completed", data: {} });
    });
    render(<PortfolioExpenseDistribution block={report} />);
    expect(await screen.findByRole("table", { name: "Gastos agregados por categoria" })).toBeInTheDocument();
    expect(await screen.findByText("Limite mensal de leituras automáticas atingido")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar leitura novamente" })).not.toBeInTheDocument();
  });

  it("states that observations are data readings, not causal claims, when insights exist", async () => {
    render(<PortfolioExpenseDistribution block={report} />);
    expect(await screen.findByText(/Alimentação concentra gastos/)).toBeInTheDocument();
    expect(screen.getByText("Essas são observações dos dados. A IA não atribui causa à alta sem analisar transações e contexto de cada cliente.")).toBeInTheDocument();
  });

  it("does not show the observations note when there are no insights", async () => {
    vi.mocked(streamConsultantPortfolioExpenseAnalysis).mockImplementationOnce(async (_params, onEvent) => {
      onEvent({ type: "report.ready", data: analysis() });
      onEvent({ type: "insight.failed", data: { code: "unavailable", message: "x" } });
      onEvent({ type: "completed", data: {} });
    });
    render(<PortfolioExpenseDistribution block={report} />);
    await screen.findByText("Não foi possível gerar a leitura deste período.");
    expect(screen.queryByText(/Essas são observações dos dados/)).not.toBeInTheDocument();
  });

  it("decides the quota state by the event code, not by the message wording", async () => {
    vi.mocked(streamConsultantPortfolioExpenseAnalysis).mockImplementationOnce(async (_params, onEvent) => {
      onEvent({ type: "report.ready", data: analysis() });
      onEvent({ type: "insight.failed", data: { code: "quota_exceeded", message: "Cota do mês esgotada" } });
      onEvent({ type: "completed", data: {} });
    });
    render(<PortfolioExpenseDistribution block={report} />);
    expect(await screen.findByText("Cota do mês esgotada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar leitura novamente" })).not.toBeInTheDocument();
  });

  it("pages category contributors on explicit demand", async () => {
    vi.mocked(getConsultantPortfolioCategoryContributors)
      .mockResolvedValueOnce({ category_name: "Alimentação", category_total: money(1000), reading_currency: "BRL", period_start: report.period_start, period_end: report.period_end, client_count: 11, clients_not_converted: 0, truncated: true, clients: [{ organization_id: "client-a", client_name: "Ana Silva", total: money(600), percentage_of_category: 60 }] })
      .mockResolvedValueOnce({ category_name: "Alimentação", category_total: money(1000), reading_currency: "BRL", period_start: report.period_start, period_end: report.period_end, client_count: 11, clients_not_converted: 0, truncated: false, clients: [{ organization_id: "client-b", client_name: "Bruno Silva", total: money(400), percentage_of_category: 40 }] });
    render(<PortfolioExpenseDistribution block={report} />);
    await screen.findByRole("button", { name: "Detalhar Alimentação" });
    fireEvent.click(screen.getByRole("button", { name: "Detalhar Alimentação" }));
    await screen.findByText("Ana Silva");
    fireEvent.click(screen.getByRole("button", { name: /Ver mais clientes/ }));
    expect(await screen.findByText("Bruno Silva")).toBeInTheDocument();
    expect(getConsultantPortfolioCategoryContributors).toHaveBeenLastCalledWith({ category_name: "Alimentação", date_start: "2026-01-01", date_end: "2026-01-31", limit: 10, offset: 1 });
  });

  it("replaces the dashboard with a skeleton when the period changes", async () => {
    render(<PortfolioExpenseDistribution block={report} />);
    await screen.findByRole("heading", { name: "Ritmo mensal da carteira" });
    let resolveNext;
    vi.mocked(streamConsultantPortfolioExpenseAnalysis).mockImplementationOnce((_params, onEvent) => new Promise((resolve) => { resolveNext = () => { onEvent({ type: "report.ready", data: analysis({ ...report, period_start: "2026-09-02", period_end: "2026-10-01" }) }); onEvent({ type: "completed", data: {} }); resolve(); }; }));
    fireEvent.click(document.querySelector(".portfolio-expense__period-control button"));
    fireEvent.click(screen.getByRole("tab", { name: "Predefinido" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "30 dias" }));
    expect(screen.getByRole("status")).toHaveTextContent("Atualizando análise");
    expect(screen.queryByRole("table", { name: "Gastos agregados por categoria" })).not.toBeInTheDocument();
    resolveNext();
    await screen.findByRole("table", { name: "Gastos agregados por categoria" });
  });

  it("offers retry without presenting stale data as complete", async () => {
    vi.mocked(streamConsultantPortfolioExpenseAnalysis).mockRejectedValueOnce(new Error("offline"));
    render(<PortfolioExpenseDistribution block={report} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível atualizar este relatório");
    expect(screen.getByRole("button", { name: /Exportar/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.getByText("Análise concluída")).toBeInTheDocument());
  });

  it("sends the AI-suggested follow-up scoped to the current period", async () => {
    const onFollowUp = vi.fn();
    render(<PortfolioExpenseDistribution block={report} onFollowUp={onFollowUp} />);
    await screen.findByRole("button", { name: /Quais clientes mais contribuíram para Alimentação/ });
    fireEvent.click(screen.getByRole("button", { name: /Quais clientes mais contribuíram para Alimentação/ }));
    expect(onFollowUp).toHaveBeenCalledWith(expect.stringContaining("2026-01-01 a 2026-01-31"));
  });

  it("does not display a model suggestion when no insights are justified", async () => {
    vi.mocked(streamConsultantPortfolioExpenseAnalysis).mockImplementationOnce(async (_params, onEvent) => {
      onEvent({ type: "report.ready", data: { ...analysis(), comparison: { ...analysis().comparison, previous_total: money(0), delta_percentage: null }, insights: [] } });
      onEvent({ type: "insight.ready", data: { period_start: report.period_start, period_end: report.period_end, insights: [] } });
      onEvent({ type: "completed", data: {} });
    });
    render(<PortfolioExpenseDistribution block={report} onFollowUp={vi.fn()} />);
    expect(await screen.findByText(/Sem observações adicionais sustentadas/)).toBeInTheDocument();
    expect(screen.queryByText(/alcance e concentração não são a mesma coisa/i)).not.toBeInTheDocument();
  });
});
