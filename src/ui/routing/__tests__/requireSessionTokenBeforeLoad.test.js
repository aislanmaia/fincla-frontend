import { describe, expect, it, vi } from "vitest";
import { isRedirect } from "@tanstack/react-router";

vi.mock("../../data/sessionAdapter.js", () => ({
  isAuthenticated: vi.fn(),
}));

import { isAuthenticated } from "../../data/sessionAdapter.js";
import { requireSessionTokenBeforeLoad } from "../requireSessionTokenBeforeLoad.js";

describe("requireSessionTokenBeforeLoad", () => {
  it("lança redirect quando não há token de sessão", () => {
    vi.mocked(isAuthenticated).mockReturnValue(false);
    try {
      requireSessionTokenBeforeLoad({
        location: { pathname: "/transactions", searchStr: "" },
      });
      expect.fail("deveria lançar");
    } catch (e) {
      expect(isRedirect(e)).toBe(true);
    }
  });

  it("não lança quando há token", () => {
    vi.mocked(isAuthenticated).mockReturnValue(true);
    expect(() =>
      requireSessionTokenBeforeLoad({
        location: { pathname: "/transactions", searchStr: "" },
      }),
    ).not.toThrow();
  });
});
