// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getConsultantPortfolioExpenseAnalysis, getConsultantPortfolioCategoryContributors } from "../../../../api/consultant.ts";
import { PortfolioExpenseDistribution } from "../PortfolioExpenseDistribution.jsx";

vi.mock("../../../../api/consultant.ts", () => ({ getConsultantPortfolioExpenseAnalysis: vi.fn(), getConsultantPortfolioCategoryContributors: vi.fn() }));

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
  insights: [{ kind: "growth", title: "Alimentação puxa a alta.", description: "A categoria cresceu no período comparável.", evidence_amount: money(900) }],
});

describe("PortfolioExpenseDistribution", () => {
  beforeEach(() => {
    cleanup();
    vi.mocked(getConsultantPortfolioExpenseAnalysis).mockReset();
    vi.mocked(getConsultantPortfolioCategoryContributors).mockReset();
    vi.mocked(getConsultantPortfolioExpenseAnalysis).mockResolvedValue(analysis());
  });

  it("loads comparison and trend while hiding routine currency/coverage notices", async () => {
    render(<PortfolioExpenseDistribution block={report} />);
    expect(screen.getByRole("status")).toHaveTextContent("Atualizando análise");
    expect(await screen.findByRole("heading", { name: "Ritmo mensal da carteira" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Distribuição de gastos da carteira" })).toBeInTheDocument();
    expect(screen.getByText("Análise concluída")).toBeInTheDocument();
    expect(screen.getByText(/vs R\$ 800,00 no período anterior/)).toBeInTheDocument();
    expect(screen.getByText(/Alimentação puxa a alta/)).toBeInTheDocument();
    expect(screen.getByText(/R\$ 900,00 ante o período anterior/)).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Gastos agregados por categoria" })).getByText("Alimentação")).toBeInTheDocument();
    expect(screen.queryByText("Cobertura da carteira")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Conversões aplicadas" })).not.toBeInTheDocument();
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
    vi.mocked(getConsultantPortfolioExpenseAnalysis).mockImplementationOnce(() => new Promise((resolve) => { resolveNext = resolve; }));
    fireEvent.click(document.querySelector(".portfolio-expense__period-control button"));
    fireEvent.click(screen.getByRole("tab", { name: "Predefinido" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "30 dias" }));
    expect(screen.getByRole("status")).toHaveTextContent("Atualizando análise");
    expect(screen.queryByRole("table", { name: "Gastos agregados por categoria" })).not.toBeInTheDocument();
    resolveNext(analysis({ ...report, period_start: "2026-09-02", period_end: "2026-10-01" }));
    await screen.findByRole("table", { name: "Gastos agregados por categoria" });
  });

  it("offers retry without presenting stale data as complete", async () => {
    vi.mocked(getConsultantPortfolioExpenseAnalysis).mockRejectedValueOnce(new Error("offline"));
    render(<PortfolioExpenseDistribution block={report} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível atualizar este relatório");
    expect(screen.getByRole("button", { name: /Exportar/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.getByText("Análise concluída")).toBeInTheDocument());
  });

  it("sends a suggested follow-up scoped to the current period", async () => {
    const onFollowUp = vi.fn();
    render(<PortfolioExpenseDistribution block={report} onFollowUp={onFollowUp} />);
    await screen.findByRole("button", { name: /Comparar mesma coorte/ });
    fireEvent.click(screen.getByRole("button", { name: /Comparar mesma coorte/ }));
    expect(onFollowUp).toHaveBeenCalledWith(expect.stringContaining("2026-01-01 a 2026-01-31"));
    expect(onFollowUp).toHaveBeenCalledWith(expect.stringContaining("2025-12-01 a 2025-12-31"));
  });

  it("does not suggest a rise when the previous period has no spending", async () => {
    vi.mocked(getConsultantPortfolioExpenseAnalysis).mockResolvedValueOnce({
      ...analysis(),
      comparison: { ...analysis().comparison, previous_total: money(0), delta_percentage: null },
      insights: [],
    });
    render(<PortfolioExpenseDistribution block={report} onFollowUp={vi.fn()} />);
    expect(await screen.findByRole("button", { name: /O que explica esta distribuição/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Por que esses gastos subiram/ })).not.toBeInTheDocument();
  });
});
