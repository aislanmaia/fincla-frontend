import { describe, expect, it } from "vitest";

import { phoneDigitsMatch } from "../whatsappPhoneMatch.js";

describe("phoneDigitsMatch", () => {
  it("matches the same number across formatting", () => {
    expect(phoneDigitsMatch("+55 11 99999-9999", "5511999999999")).toBe(true);
    expect(phoneDigitsMatch("5511999999999", "+5511999999999")).toBe(true);
  });

  it("matches across the Brazilian 9th-digit variance", () => {
    // stored with the 9, incoming without it (and vice-versa)
    expect(phoneDigitsMatch("+5589981248808", "+558981248808")).toBe(true);
    expect(phoneDigitsMatch("+558981248808", "+5589981248808")).toBe(true);
  });

  it("does NOT match a different DDD sharing the last 8 digits", () => {
    // the false-positive the naive endsWith(-8) heuristic allowed
    expect(phoneDigitsMatch("+5511912345678", "+5521912345678")).toBe(false);
  });

  it("does not match unrelated numbers", () => {
    expect(phoneDigitsMatch("+5511999999999", "+5511888888888")).toBe(false);
  });

  it("is false for empty / missing input", () => {
    expect(phoneDigitsMatch("", "+5511999999999")).toBe(false);
    expect(phoneDigitsMatch("+5511999999999", null)).toBe(false);
    expect(phoneDigitsMatch(undefined, undefined)).toBe(false);
  });
});
