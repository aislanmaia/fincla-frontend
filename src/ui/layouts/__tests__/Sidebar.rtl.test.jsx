// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Sidebar } from "../Sidebar.jsx";

afterEach(cleanup);

function _user(features = [], extras = {}) {
  return { subscription: { features, ...(extras.subscription ?? {}) }, ...extras.user };
}

describe("<Sidebar>", () => {
  // Nenhum item do menu é trancado por plano: o assinante individual tem um
  // plano só e ele carrega tudo. O badge de plano no rodapé é outra coisa —
  // é diferenciação nominal, e continua.
  it("does not lock /reports for any plan", () => {
    render(
      <Sidebar
        page="dashboard"
        onNav={vi.fn()}
        isMobile={false}
        user={_user(["manual_transactions"])}
      />,
    );

    const reports = screen.getByRole("button", { name: /relatórios/i });
    expect(
      within(reports).queryByRole("img", { name: /pro/i }),
    ).not.toBeInTheDocument();
  });

  it("does not lock /reports when there is no subscription info", () => {
    // Antes isto era trancado por precaução; sem gating por plano, ausência de
    // informação não pode virar um cadeado.
    render(
      <Sidebar page="dashboard" onNav={vi.fn()} isMobile={false} user={undefined} />,
    );
    const reports = screen.getByRole("button", { name: /relatórios/i });
    expect(
      within(reports).queryByRole("img", { name: /pro/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the user display name, initials and plan badge in the footer", () => {
    render(
      <Sidebar
        page="dashboard"
        onNav={vi.fn()}
        isMobile={false}
        user={{
          first_name: "Maria",
          last_name: "Silva",
          email: "maria@example.com",
          subscription: { plan: "pro", features: ["advanced_reports"] },
        }}
      />,
    );
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("MS")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-plan-badge")).toHaveTextContent("Pro");
  });

  it("falls back to the email local part when name is missing", () => {
    render(
      <Sidebar
        page="dashboard"
        onNav={vi.fn()}
        isMobile={false}
        user={{
          first_name: null,
          last_name: null,
          email: "carlos@example.com",
          subscription: { plan: "essential", features: [] },
        }}
      />,
    );
    expect(screen.getByText("carlos")).toBeInTheDocument();
    expect(screen.getByText("CA")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-plan-badge")).toHaveTextContent("Essential");
  });

  it("renders the avatar image when avatar_url is set", () => {
    render(
      <Sidebar
        page="dashboard"
        onNav={vi.fn()}
        isMobile={false}
        user={{
          first_name: "Ana",
          last_name: "Costa",
          avatar_url: "https://example.com/a.png",
          subscription: { plan: "beta", features: [] },
        }}
      />,
    );
    const img = document.querySelector('img[src="https://example.com/a.png"]');
    expect(img).not.toBeNull();
    expect(screen.queryByText("AC")).not.toBeInTheDocument();
    expect(screen.getByTestId("sidebar-plan-badge")).toHaveTextContent("Beta");
  });

  it("omits the plan badge when no subscription is present", () => {
    render(
      <Sidebar
        page="dashboard"
        onNav={vi.fn()}
        isMobile={false}
        user={{ first_name: "Solo", last_name: "Dev", email: "solo@x.io" }}
      />,
    );
    expect(screen.getByText("Solo Dev")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-plan-badge")).not.toBeInTheDocument();
  });
});
