// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HealthPanelPage } from "../HealthPanelPage.jsx";

afterEach(cleanup);

describe("<HealthPanelPage>", () => {
  it("renderiza score, patrimônio e métricas (mock)", () => {
    const { container } = render(<HealthPanelPage dataMode="mock" organizationId={null} />);
    const t = container.textContent;
    expect(t).toContain("Saúde");
    expect(t).toContain("Financeira");
    expect(t).toContain("Patrimônio líquido");
    expect(t).toContain("Comprometimento da renda");
    expect(t).toContain("Metas no prazo");
    expect(t).toContain("72"); // mock score
  });
});
