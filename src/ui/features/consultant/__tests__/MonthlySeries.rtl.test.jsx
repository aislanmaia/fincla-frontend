// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MonthlySeries } from "../MonthlySeries.jsx";

afterEach(cleanup);

const points = (count) => Array.from({ length: count }, (_, index) => {
  const month = String((index % 12) + 1).padStart(2, "0");
  return { key: `p${index}`, periodEnd: `2026-${month}-28`, amount: index === 8 ? 28377.8 : index * 100 };
});

const renderSeries = (count, narrow) => render(
  <MonthlySeries points={points(count)} currency="BRL" narrow={narrow} ariaLabel="Tendência mensal: teste" sheetTitle="Série mensal completa" height={90} />,
);

describe("MonthlySeries", () => {
  it("shows every month with full values when the series is short", () => {
    renderSeries(4, true);
    const chart = screen.getByRole("img", { name: "Tendência mensal: teste" });
    expect(within(chart).getAllByRole("group")).toHaveLength(4);
    expect(chart).not.toHaveClass("portfolio-expense__trend-bars--dense");
    expect(screen.queryByRole("button", { name: /Ver os/ })).not.toBeInTheDocument();
  });

  it("shrinks a long series to fit on wide screens", () => {
    renderSeries(12, false);
    const chart = screen.getByRole("img", { name: "Tendência mensal: teste" });
    expect(chart).toHaveClass("portfolio-expense__trend-bars--dense");
    expect(within(chart).getAllByRole("group")).toHaveLength(12);
    expect(screen.queryByRole("button", { name: /Ver os/ })).not.toBeInTheDocument();
  });

  it("on narrow screens keeps only the six most recent months and offers the full series", () => {
    renderSeries(12, true);
    const chart = screen.getByRole("img", { name: "Tendência mensal: teste" });
    const groups = within(chart).getAllByRole("group");
    expect(groups).toHaveLength(6);
    expect(groups[5].getAttribute("aria-label")).toMatch(/dez/i);
    expect(groups[0].getAttribute("aria-label")).toMatch(/jul/i);
    expect(screen.getByRole("button", { name: "Ver os 12 meses" })).toBeInTheDocument();
  });

  it("opens the full series in a bottom sheet with exact values and closes it again", () => {
    renderSeries(12, true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver os 12 meses" }));
    const sheet = screen.getByRole("dialog", { name: "Série mensal completa" });
    expect(within(sheet).getAllByRole("listitem")).toHaveLength(12);
    expect(within(sheet).getByText(/28\.377,80/)).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "Fechar série mensal" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the sheet with Escape", () => {
    renderSeries(12, true);
    fireEvent.click(screen.getByRole("button", { name: "Ver os 12 meses" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps Escape inside the sheet, so a drawer underneath is not closed by the same keypress", () => {
    const outside = vi.fn();
    window.addEventListener("keydown", outside);
    renderSeries(12, true);
    fireEvent.click(screen.getByRole("button", { name: "Ver os 12 meses" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    window.removeEventListener("keydown", outside);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(outside).not.toHaveBeenCalled();
  });

  it("names the unit once when labels are compact, since compact numbers carry no currency", () => {
    renderSeries(12, false);
    expect(screen.getByText(/Valores em R\$/)).toBeInTheDocument();
  });

  it("does not add a unit note to short series, which show full money", () => {
    renderSeries(4, false);
    expect(screen.queryByText(/Valores em/)).not.toBeInTheDocument();
  });
});
