// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => {},
  useSearch: () => ({}),
}));

import { LifeProjectsPage } from "../LifeProjectsPage.jsx";

afterEach(cleanup);

describe("<LifeProjectsPage>", () => {
  it("renderiza projetos (mock) agrupados por prazo", () => {
    const { container } = render(<LifeProjectsPage dataMode="mock" organizationId={null} />);
    const text = container.textContent;
    expect(text).toContain("Projetos de");
    expect(text).toContain("Vida");
    expect(text).toContain("Reserva de emergência");
    expect(text).toContain("Aposentadoria");
    expect(text).toContain("Curto");
    expect(text).toContain("Longo");
  });

  it("mostra o estado vazio quando não há projetos", () => {
    const { container } = render(
      <LifeProjectsPage dataMode="empty" organizationId={null} initialMetas={[]} />,
    );
    expect(container.textContent).toContain("Comece seus projetos de vida");
  });
});
