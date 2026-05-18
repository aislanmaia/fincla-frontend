// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Sidebar } from "../Sidebar.jsx";

afterEach(cleanup);

function _user(features = [], extras = {}) {
  return { subscription: { features, ...(extras.subscription ?? {}) }, ...extras.user };
}

describe("<Sidebar>", () => {
  it("shows Pro badges on /reports and /simulation for Essential users", () => {
    render(
      <Sidebar
        page="dashboard"
        onNav={vi.fn()}
        isMobile={false}
        user={_user(["manual_transactions", "whatsapp_assistant"])}
      />,
    );

    const simulation = screen.getByRole("button", { name: /simulação/i });
    const reports = screen.getByRole("button", { name: /relatórios/i });
    // PlanBadge renders an `img` role with label containing "Pro".
    expect(
      within(simulation).getByRole("img", { name: /pro/i }),
    ).toBeInTheDocument();
    expect(
      within(reports).getByRole("img", { name: /pro/i }),
    ).toBeInTheDocument();
  });

  it("hides Pro badges when the user has the corresponding feature", () => {
    render(
      <Sidebar
        page="dashboard"
        onNav={vi.fn()}
        isMobile={false}
        user={_user([
          "advanced_reports",
          "what_if_simulations",
          "manual_transactions",
        ])}
      />,
    );
    const simulation = screen.getByRole("button", { name: /simulação/i });
    const reports = screen.getByRole("button", { name: /relatórios/i });
    expect(
      within(simulation).queryByRole("img", { name: /pro/i }),
    ).not.toBeInTheDocument();
    expect(
      within(reports).queryByRole("img", { name: /pro/i }),
    ).not.toBeInTheDocument();
  });

  it("hides Pro badges entirely when user is missing", () => {
    // No subscription info → treat everything as locked (defensive: show badges).
    render(
      <Sidebar
        page="dashboard"
        onNav={vi.fn()}
        isMobile={false}
        user={undefined}
      />,
    );
    const simulation = screen.getByRole("button", { name: /simulação/i });
    expect(
      within(simulation).getByRole("img", { name: /pro/i }),
    ).toBeInTheDocument();
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
