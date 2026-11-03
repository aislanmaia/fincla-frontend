/** @vitest-environment jsdom */

/**
 * A série recorrente guarda a categoria pelo nome canônico do seed, em inglês
 * ("Services Provided"). A lista de Recorrências & Compromissos mostrava esse
 * texto cru — `Mensal · dia 5 · Services Provided` — porque o mapa de tradução
 * só cobria as categorias de despesa.
 *
 * O mock fica na camada da API (`listRecurringSeries`), não no hook nem no
 * adapter: a tradução acontece no adapter, e mockar acima dele deixaria o teste
 * verde sobre o próprio defeito.
 */

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RecorrenciasPage } from "../RecorrenciasPage.jsx";

const baseSeries = {
  organization_id: "org-rtl",
  type: "income",
  value: 3000,
  value_kind: "exact",
  payment_method: "pix",
  frequency: "monthly",
  day_of_month: 5,
  start_date: "2026-01-05",
  next_occurrence: "2026-12-05",
  is_active: true,
  created_at: "",
  updated_at: "",
};

vi.mock("../../../api/recurringSeries", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listRecurringSeries: vi.fn(async () => ({
      series: [
        {
          ...baseSeries,
          id: "rs-tag",
          logical_series_id: "log-tag",
          description: "Cliente Acme",
          category: "Services Provided",
          tags: [
            {
              id: "cat-sp",
              name: "Services Provided",
              icon_key: "handshake",
              is_default: true,
              tag_type: { name: "categoria" },
            },
          ],
        },
        {
          ...baseSeries,
          id: "rs-raw",
          logical_series_id: "log-raw",
          description: "Empresa XYZ",
          // Sem tag: só o texto livre `category` — o caminho que exibia o nome cru.
          category: "Work & Salary",
          tags: [],
        },
      ],
      summary: {
        total_monthly_income: 6000,
        total_monthly_expense: 0,
        currency: "BRL",
        by_currency: [],
        active_count: 2,
        paused_count: 0,
      },
    })),
  };
});

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="recharts-rc">{children}</div>,
  BarChart: ({ children }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  Tooltip: () => null,
}));

describe("Recorrências: categoria do seed aparece em português", () => {
  afterEach(() => cleanup());

  it("mostra 'Serviços prestados' e 'Trabalho e salário', nunca o nome em inglês", async () => {
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

    expect(
      (await screen.findAllByText("Mensal · dia 5 · Serviços prestados")).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Mensal · dia 5 · Trabalho e salário").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Services Provided/)).toBeNull();
    expect(screen.queryByText(/Work & Salary/)).toBeNull();
  });
});
