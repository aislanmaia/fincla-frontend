// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PlannedVsActualPage } from "../PlannedVsActualPage.jsx";

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
});
