import { describe, expect, it } from "vitest";

import { DEFAULT_PHONE_COUNTRY, PHONE_COUNTRIES, buildE164, findPhoneCountry } from "../phoneCountries.js";

describe("PHONE_COUNTRIES", () => {
  it("has Brazil first and as the default", () => {
    expect(PHONE_COUNTRIES[0].code).toBe("BR");
    expect(DEFAULT_PHONE_COUNTRY).toBe("BR");
    expect(findPhoneCountry("BR")).toMatchObject({ dial: "55", flag: "🇧🇷" });
  });

  it("has unique ISO codes and numeric dial codes", () => {
    const codes = PHONE_COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of PHONE_COUNTRIES) expect(c.dial).toMatch(/^\d{1,3}$/);
  });

  it("falls back to Brazil for an unknown code", () => {
    expect(findPhoneCountry("ZZ").code).toBe("BR");
  });
});

describe("buildE164", () => {
  it("composes the picked country and the national number as typed", () => {
    expect(buildE164("55", "11 99999-0000")).toBe("+5511999990000");
    expect(buildE164("55", "(11) 99999-0000")).toBe("+5511999990000");
    expect(buildE164("351", "912 345 678")).toBe("+351912345678");
  });

  it("takes a number typed with its own + as complete, ignoring the picker", () => {
    // otherwise "+55 11…" under Brasil would become "+5555 11…"
    expect(buildE164("55", "+55 11 99999-0000")).toBe("+5511999990000");
    expect(buildE164("55", "+351 912 345 678")).toBe("+351912345678");
  });

  it("never invents digits", () => {
    expect(buildE164("55", "")).toBe("");
    expect(buildE164("55", "   ")).toBe("");
    expect(buildE164("55", "abc")).toBe("abc");
    expect(buildE164("55", "+")).toBe("+");
  });
});
