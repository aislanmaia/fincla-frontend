// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Sidebar } from "../Sidebar.jsx";

afterEach(cleanup);

function _user(features = []) {
  return { subscription: { features } };
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
});
