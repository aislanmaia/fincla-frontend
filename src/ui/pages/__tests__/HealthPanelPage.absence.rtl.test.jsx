/** @vitest-environment jsdom */

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

/**
 * Ausência não pode virar zero na última camada.
 *
 * O backend passou a devolver `null` (e `cash_flow_risk: "unknown"`) quando o cliente
 * tem contas em mais de uma moeda e faltou cotação para converter — de propósito, para
 * não inventar um número nem um diagnóstico. A tela desfazia isso:
 *
 *  - `Number(v || 0)` transformava `null` em "R$ 0,00", que AFIRMA que a pessoa não
 *    tem nada — o oposto de "nós é que não sabemos ler";
 *  - `scoreBand(null)` caía no `else` e pintava "Em risco" de VERMELHO para alguém
 *    sobre quem não sabemos nada;
 *  - `riskBadge("unknown")` caía no `else` e dizia "Fluxo saudável".
 *
 * Uma revisão adversarial achou os três. Estes casos existem para eles não voltarem.
 */

const getFinancialHealthMock = vi.fn();
vi.mock("../../../api/financialHealth", () => ({
  getFinancialHealth: (...args) => getFinancialHealthMock(...args),
  getEconomyCapacity: vi.fn(),
}));
vi.mock("../../dataMode.js", () => ({ shouldUseRealData: () => true }));

const { HealthPanelPage } = await import("../HealthPanelPage.jsx");

const SEM_COTACAO = {
  reference_month: "2026-09-01",
  ativo: null,
  passivo: null,
  patrimonio_liquido: null,
  avg_income: null,
  avg_expense: null,
  avg_surplus: null,
  income_commitment: null,
  savings_rate: null,
  emergency_fund_months: null,
  goals_on_track: 0,
  goals_total: 0,
  goal_progress_avg: 0,
  cash_flow_risk: "unknown",
  score: null,
  passivo_by_currency: [
    { amount: "300.00", currency: "USD" },
    { amount: "4000.00", currency: "BRL" },
  ],
  consolidation: { target_currency: "BRL", rates: [], unavailable: "USD/BRL: sem cotação" },
};

afterEach(cleanup);

describe("painel de saúde sem cotação", () => {
  it("não mostra R$ 0,00 no lugar do que não foi possível calcular", async () => {
    getFinancialHealthMock.mockResolvedValue(SEM_COTACAO);

    render(<HealthPanelPage organizationId="org-1" />);

    await waitFor(() => expect(getFinancialHealthMock).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.queryByText("R$ 0,00")).toBeNull();
    });
  });

  it("não inventa um diagnóstico para quem não foi avaliado", async () => {
    getFinancialHealthMock.mockResolvedValue(SEM_COTACAO);

    render(<HealthPanelPage organizationId="org-1" />);

    await waitFor(() => {
      // "Em risco" seria um diagnóstico; "Sem diagnóstico" é a ausência de um.
      expect(screen.queryByText("Em risco")).toBeNull();
      expect(screen.queryByText("Fluxo saudável")).toBeNull();
    });
  });
});
