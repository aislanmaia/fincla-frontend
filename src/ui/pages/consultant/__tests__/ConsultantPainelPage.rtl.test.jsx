// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ConsultantPainelPage } from "../ConsultantPainelPage.jsx";

afterEach(cleanup);

describe("<ConsultantPainelPage> (A0.1 placeholder)", () => {
  it("renderiza o título da área do consultor", () => {
    const { container } = render(<ConsultantPainelPage />);
    expect(container.textContent).toContain("Painel da");
    expect(container.textContent).toContain("base");
    expect(container.textContent).toContain("Área do Consultor");
  });
});
