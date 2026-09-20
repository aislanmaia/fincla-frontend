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
    for (const c of PHONE_COUNTRIES) {
      expect(c.dial).toMatch(/^\d{1,3}$/);
      expect(c.nationalDigits[0]).toBeLessThanOrEqual(c.nationalDigits[1]);
    }
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

  it("does not prefix the country code twice when the user typed it without +", () => {
    // how WhatsApp itself displays numbers — under Brasil this used to become
    // "+5555 11…", well-formed for the backend and a pending link that never activates
    expect(buildE164("55", "55 11 99999-0000")).toBe("+5511999990000");
    expect(buildE164("351", "351 912 345 678")).toBe("+351912345678");
  });

  it("keeps a genuine national number that merely starts with the dial digits", () => {
    // DDD 55 (Santa Maria, RS) is a real Brazilian area code
    expect(buildE164("55", "55 99999-0000")).toBe("+5555999990000");
  });

  it("drops a trunk zero, except under +1 where 0 is never a trunk prefix", () => {
    expect(buildE164("55", "011 99999-0000")).toBe("+5511999990000");
    expect(buildE164("44", "07400 123456")).toBe("+447400123456");
    expect(buildE164("1", "0201 555 0123")).toBe("0201 555 0123");
  });

  it("returns a number outside the country's national length as typed for the API to reject", () => {
    expect(buildE164("351", "912 345 67")).toBe("912 345 67");
    expect(buildE164("55", "99999-0000")).toBe("99999-0000");
  });

  it("never invents digits", () => {
    expect(buildE164("55", "")).toBe("");
    expect(buildE164("55", "   ")).toBe("");
    expect(buildE164("55", "abc")).toBe("abc");
    expect(buildE164("55", "+")).toBe("+");
  });
});
