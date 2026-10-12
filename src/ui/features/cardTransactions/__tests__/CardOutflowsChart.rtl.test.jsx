/** @vitest-environment jsdom */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardOutflowsChart } from "../CardOutflowsChart.jsx";

afterEach(cleanup);
const bar = (key, over = {}) => ({ key, label: key, title: `Fatura ${key}`, amount: 1000, projected: null, selected: true, clickable: true, ...over });

describe("CardOutflowsChart — estimativa", () => {
  it("diz que o hachurado é estimativa e nomeia o caráter aproximado", () => {
    render(<CardOutflowsChart currency="BRL" outflows={{ kind: "invoices", hasProjection: true, bars: [bar("2026-11", { projected: { amount: 521.4, count: 7, approximate: true } })] }} />);
    expect(screen.getByTestId("outflow-estimate")).toHaveTextContent(/\+ ~R\$\s521,40/);
    expect(screen.getByTestId("outflow-projection-note")).toHaveTextContent("Hachurado = estimativa");
    expect(screen.getByTestId("outflow-projection-note")).toHaveTextContent("algumas têm valor aproximado");
    const named = screen.getByRole("button", { name: /R\$\s1\.000,00 confirmados \+ ~R\$\s521,40 estimados em 7 recorrências previstas \(algum valor é aproximado\)/ });
    expect(named).toBeInTheDocument();
  });

  it("só fala em valor aproximado quando alguma série é aproximada", () => {
    render(<CardOutflowsChart currency="BRL" outflows={{ kind: "invoices", hasProjection: true, bars: [bar("2026-11", { projected: { amount: 10, count: 1, approximate: false } })] }} />);
    expect(screen.getByTestId("outflow-projection-note")).not.toHaveTextContent("aproximado");
  });

  it("barra só com estimativa não é clicável e diz que nada foi confirmado", async () => {
    const onPick = vi.fn();
    render(<CardOutflowsChart currency="BRL" onPickInvoice={onPick} outflows={{ kind: "invoices", hasProjection: true, bars: [bar("2027-03", { amount: 0, clickable: false, projected: { amount: 100, count: 1, approximate: false } })] }} />);
    const only = screen.getByRole("img", { name: /nada confirmado ainda \+ ~R\$\s100,00 estimados em 1 recorrência prevista/ });
    await userEvent.setup().click(only);
    expect(onPick).not.toHaveBeenCalled();
  });

  it("sem estimativa não mostra a legenda", () => {
    render(<CardOutflowsChart currency="BRL" outflows={{ kind: "invoices", hasProjection: false, bars: [bar("2026-11")] }} />);
    expect(screen.queryByTestId("outflow-projection-note")).toBeNull();
    expect(screen.queryByTestId("outflow-estimate")).toBeNull();
  });

  it("barra de semana é botão e entrega a própria barra ao clicar", async () => {
    const onPickWeek = vi.fn();
    const weekBar = { key: "2026-10-05", label: "05/10", title: "Semana de 05/10", amount: 735.77, from: "2026-10-05", to: "2026-10-11", selected: true, clickable: true };
    render(<CardOutflowsChart currency="BRL" onPickWeek={onPickWeek} outflows={{ kind: "weeks", bars: [weekBar] }} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Semana de 05\/10/ }));
    expect(onPickWeek).toHaveBeenCalledWith(weekBar);
  });
});
