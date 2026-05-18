import { describe, expect, it } from "vitest";

import {
  getDisplayName,
  getInitials,
  getPlanBadge,
} from "../userDisplay.js";

describe("getDisplayName", () => {
  it("joins first_name + last_name when both present", () => {
    expect(getDisplayName({ first_name: "Maria", last_name: "Silva" })).toBe(
      "Maria Silva",
    );
  });

  it("returns only first_name when last_name is empty", () => {
    expect(getDisplayName({ first_name: "Maria", last_name: "" })).toBe(
      "Maria",
    );
    expect(getDisplayName({ first_name: "Maria", last_name: null })).toBe(
      "Maria",
    );
  });

  it("falls back to email local part when no name fields are set", () => {
    expect(getDisplayName({ email: "carlos@example.com" })).toBe("carlos");
  });

  it("returns a dash placeholder when user is missing entirely", () => {
    expect(getDisplayName(null)).toBe("—");
    expect(getDisplayName(undefined)).toBe("—");
  });
});

describe("getInitials", () => {
  it("returns first letter of first + last name", () => {
    expect(getInitials({ first_name: "Maria", last_name: "Silva" })).toBe(
      "MS",
    );
  });

  it("uppercases lowercase names", () => {
    expect(getInitials({ first_name: "maria", last_name: "silva" })).toBe(
      "MS",
    );
  });

  it("returns single initial when only first_name is provided", () => {
    expect(getInitials({ first_name: "Solo" })).toBe("S");
  });

  it("falls back to two letters of the email when name is empty", () => {
    expect(getInitials({ email: "carlos@example.com" })).toBe("CA");
  });

  it("returns '?' when nothing identifiable is provided", () => {
    expect(getInitials({})).toBe("?");
    expect(getInitials(null)).toBe("?");
  });
});

describe("getPlanBadge", () => {
  it("returns the Essential badge for the essential slug", () => {
    const badge = getPlanBadge({ subscription: { plan: "essential" } });
    expect(badge.label).toBe("Essential");
  });

  it("returns the Pro badge for the pro slug", () => {
    expect(getPlanBadge({ subscription: { plan: "pro" } }).label).toBe("Pro");
  });

  it("returns the Beta badge for the beta slug", () => {
    expect(getPlanBadge({ subscription: { plan: "beta" } }).label).toBe(
      "Beta",
    );
  });

  it("returns null when no subscription is present", () => {
    expect(getPlanBadge({})).toBeNull();
    expect(getPlanBadge(null)).toBeNull();
  });

  it("falls back to the raw slug when the plan is unknown", () => {
    const badge = getPlanBadge({ subscription: { plan: "enterprise_x" } });
    expect(badge.label).toBe("enterprise_x");
  });
});
