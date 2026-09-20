import { describe, expect, it } from "vitest";

import { phoneDigitsMatch, normalizePhoneE164 } from "../whatsappPhoneMatch.js";

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

describe("normalizePhoneE164", () => {
  it("turns the placeholder layout into what the API accepts", () => {
    // the field suggests "+55 11 99999-0000"; the backend only takes E.164
    expect(normalizePhoneE164("+55 11 99999-0000")).toBe("+5511999990000");
    expect(normalizePhoneE164("+55 (11) 99999-0000")).toBe("+5511999990000");
    expect(normalizePhoneE164("  +55.11.99999.0000 ")).toBe("+5511999990000");
  });

  it("leaves an already-valid E.164 number untouched", () => {
    expect(normalizePhoneE164("+5511999990000")).toBe("+5511999990000");
    expect(normalizePhoneE164("+14155552671")).toBe("+14155552671");
  });

  it("without a leading + the input goes to the API exactly as typed", () => {
    // Fincla will run outside Brazil — the country code stays the user's job
    // (a country picker is the planned follow-up). It must NOT be reduced to
    // bare digits: the backend prefixes "+" to any digit-only string, so
    // "11999990000" would become a US number and a pending link that never
    // activates. As typed, the backend rejects it with the translated hint.
    expect(normalizePhoneE164("11 99999-0000")).toBe("11 99999-0000");
    expect(normalizePhoneE164("5511999990000")).toBe("5511999990000");
  });

  it("never invents digits: garbage goes through for the API to reject", () => {
    expect(normalizePhoneE164("")).toBe("");
    expect(normalizePhoneE164("   ")).toBe("");
    expect(normalizePhoneE164("abc")).toBe("abc");
    expect(normalizePhoneE164("+")).toBe("+");
  });
});
