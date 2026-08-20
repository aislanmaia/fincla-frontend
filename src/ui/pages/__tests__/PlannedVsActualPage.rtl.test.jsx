// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlannedVsActualPage } from "../PlannedVsActualPage.jsx";
import { getMonthlyPlan } from "../../../api/monthlyPlans";

vi.mock("../../../api/monthlyPlans", () => ({
  getMonthlyPlan: vi.fn(),
  upsertMonthlyPlan: vi.fn(),
}));

afterEach(cleanup);

describe("<PlannedVsActualPage>", () => {
  it("renderiza a comparação (mock) com categorias e 'fora do plano'", () => {
    const { container } = render(<PlannedVsActualPage dataMode="mock" organizationId={null} />);
    const t = container.textContent;
    expect(t).toContain("Planejado ×");
    expect(t).toContain("Realizado");
    expect(t).toContain("Despesas por categoria");
    expect(t).toContain("Alimentação");
    expect(t).toContain("fora do plano"); // Assinaturas (in_plan: false)
  });

  it("traduz tag_name cru do seed vindo de GET /monthly-plans/{ano}/{mes} (regressão #77)", async () => {
    // Payload real: `tag_name` chega em inglês (seed canônico), não já
    // traduzido como no MOCK deste arquivo.
    vi.mocked(getMonthlyPlan).mockResolvedValue({
      year: 2026,
      month: 8,
      has_plan: true,
      status: "active",
      notes: null,
      planned_income: 0,
      planned_expense: 1200,
      actual_income: 0,
      actual_expense: 1560,
      items: [
        {
          tag_id: "t1",
          tag_name: "Food & Groceries",
          kind: "expense",
          planned: 1200,
          actual: 1560,
          variance: 360,
          in_plan: true,
        },
      ],
    });

    render(<PlannedVsActualPage dataMode="live" organizationId="org-1" />);

    expect(await screen.findByText("Alimentação")).toBeInTheDocument();
    expect(screen.queryByText("Food & Groceries")).not.toBeInTheDocument();
  });
});
