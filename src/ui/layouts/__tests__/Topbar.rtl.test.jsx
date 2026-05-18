// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Topbar } from "../Topbar.jsx";

afterEach(cleanup);

describe("<Topbar>", () => {
  it("renders user initials derived from first_name + last_name", () => {
    render(
      <Topbar
        onNew={vi.fn()}
        isMobile={false}
        onMenuOpen={vi.fn()}
        onNav={vi.fn()}
        page="dashboard"
        user={{
          first_name: "Maria",
          last_name: "Silva",
          email: "maria@example.com",
        }}
      />,
    );
    expect(screen.getByText("MS")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /conta de maria silva/i }),
    ).toBeInTheDocument();
  });

  it("falls back to the email local part as initials when name is missing", () => {
    render(
      <Topbar
        onNew={vi.fn()}
        isMobile={false}
        onMenuOpen={vi.fn()}
        onNav={vi.fn()}
        page="dashboard"
        user={{ first_name: null, last_name: null, email: "carlos@x.com" }}
      />,
    );
    expect(screen.getByText("CA")).toBeInTheDocument();
  });

  it("renders the avatar image when avatar_url is set", () => {
    render(
      <Topbar
        onNew={vi.fn()}
        isMobile={false}
        onMenuOpen={vi.fn()}
        onNav={vi.fn()}
        page="dashboard"
        user={{
          first_name: "Ana",
          last_name: "Costa",
          avatar_url: "https://example.com/a.png",
        }}
      />,
    );
    expect(
      document.querySelector('img[src="https://example.com/a.png"]'),
    ).not.toBeNull();
    expect(screen.queryByText("AC")).not.toBeInTheDocument();
  });

  it("renders a '?' placeholder when no user is provided (defensive)", () => {
    render(
      <Topbar
        onNew={vi.fn()}
        isMobile={false}
        onMenuOpen={vi.fn()}
        onNav={vi.fn()}
        page="dashboard"
      />,
    );
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});
