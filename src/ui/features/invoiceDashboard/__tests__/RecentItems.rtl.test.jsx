// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecentItems } from "../RecentItems.jsx";

describe("RecentItems — atalho 'ver os N'", () => {
  afterEach(cleanup);

  it("com 1 lançamento não escreve 'ver os 1'", () => {
    render(<RecentItems items={[]} totalCount={1} currency="BRL" isMobile={false} onViewAll={vi.fn()} />);
    expect(screen.getByRole("button", { name: /ver o lançamento/ })).toBeTruthy();
    expect(screen.queryByText(/ver os 1/)).toBeNull();
  });

  it("com vários mantém 'ver os N'", () => {
    render(<RecentItems items={[]} totalCount={7} currency="BRL" isMobile={false} onViewAll={vi.fn()} />);
    expect(screen.getByRole("button", { name: /ver os 7/ })).toBeTruthy();
  });
});
