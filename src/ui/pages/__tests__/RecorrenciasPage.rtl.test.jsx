/** @vitest-environment jsdom */

import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RecorrenciasPage } from "../RecorrenciasPage.jsx";

vi.mock("../../features/recurringTransactions/useRecurringTransactionsData.js", () => ({
  useRecurringTransactionsData: () => ({
    isLoading: false,
    error: "",
    isTogglingId: null,
    isDeletingId: null,
    list: [
      {
        id: "rt-1",
        logicalSeriesId: "log-1",
        desc: "Conta de luz",
        cat: "Utilidades",
        tipo: "despesa",
        val: 180,
        ativa: true,
        dia: 13,
        metodo: "Boleto",
        nextOccurrenceIso: "2026-04-13",
        proximo: "13/04/2026",
        proximoFull: "13/04/2026",
        freq: "Mensal · dia 13",
        inicio: "Jan 2020",
        enc: "Sem data fim",
        urgente: false,
        diasUrg: null,
        pago: false,
        categoryIconKey: null,
        valorTipo: "fixo",
        progPct: 0,
        status: "ativa",
        freqId: "mensal",
        methodId: "boleto",
        encId: "sem-fim",
        endDateRaw: null,
        creditCardId: null,
        categoryTagId: "t1",
      },
    ],
    summary: {
      totalRec: 0,
      totalDesp: 180,
      saldoFixo: -180,
      activeCount: 1,
      pausedCount: 0,
    },
    toggleRecurring: vi.fn(),
    deleteRecurring: vi.fn(),
    hasRealData: true,
  }),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="recharts-rc">{children}</div>,
  BarChart: ({ children }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  Tooltip: () => null,
}));

describe("RecorrenciasPage (RTL)", () => {
  afterEach(() => cleanup());


  it("mostra título e seção de despesas fixas com dados mockados", () => {
    render(
      <RecorrenciasPage
        onNav={vi.fn()}
        cenarios={[]}
        dataMode="live"
        organizationId="org-rtl"
        recurringRefreshToken={0}
        onNovaRec={vi.fn()}
        onEditar={vi.fn()}
        isMobile={false}
      />,
    );
    expect(screen.getByText("Compromissos")).toBeInTheDocument();
    expect(screen.getByText("Despesas Fixas")).toBeInTheDocument();
    expect(screen.getAllByText("Conta de luz").length).toBeGreaterThanOrEqual(1);
  });

  const renderPage = (isMobile) => {
    const onNovaRec = vi.fn();
    render(
      <RecorrenciasPage
        onNav={vi.fn()}
        cenarios={[]}
        dataMode="live"
        organizationId="org-rtl"
        recurringRefreshToken={0}
        onNovaRec={onNovaRec}
        onEditar={vi.fn()}
        isMobile={isMobile}
      />,
    );
    return onNovaRec;
  };

  it("mobile: o botão Nova fica na mesma linha do título, sem quebrar para baixo, e continua clicável", () => {
    const onNovaRec = renderPage(true);
    const button = screen.getByRole("button", { name: "Nova recorrência" });
    const row = button.parentElement.parentElement;
    expect(row.style.flexWrap).toBe("nowrap");
    expect(row).toHaveTextContent("Compromissos");
    expect(button.parentElement.style.flexShrink).toBe("0");
    expect(button).not.toHaveTextContent("Nova");
    button.click();
    expect(onNovaRec).toHaveBeenCalledTimes(1);
  });

  it("desktop mantém o botão com texto", () => {
    renderPage(false);
    expect(screen.getByRole("button", { name: "Nova recorrência" })).toHaveTextContent("Nova Recorrência");
  });
});
