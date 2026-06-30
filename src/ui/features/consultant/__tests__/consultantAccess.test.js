import { describe, it, expect } from "vitest";
import { isConsultant } from "../isConsultant.js";
import { consultantAreaDecision } from "../consultantAccess.js";

describe("isConsultant", () => {
  it("true só quando role === 'consultant'", () => {
    expect(isConsultant({ role: "consultant" })).toBe(true);
    expect(isConsultant({ role: "owner" })).toBe(false);
    expect(isConsultant({ role: "member" })).toBe(false);
    expect(isConsultant(null)).toBe(false);
    expect(isConsultant(undefined)).toBe(false);
    expect(isConsultant({})).toBe(false);
  });
});

describe("consultantAreaDecision", () => {
  const consultant = { role: "consultant" };
  const owner = { role: "owner" };

  it("passthrough fora da área /consultant (qualquer usuário)", () => {
    expect(consultantAreaDecision("/", consultant)).toBe("passthrough");
    expect(consultantAreaDecision("/dashboard", owner)).toBe("passthrough");
    expect(consultantAreaDecision("/planning/goals", consultant)).toBe("passthrough");
  });

  it("allow na área /consultant quando é consultor", () => {
    expect(consultantAreaDecision("/consultant", consultant)).toBe("allow");
    expect(consultantAreaDecision("/consultant/clients", consultant)).toBe("allow");
  });

  it("redirect na área /consultant quando NÃO é consultor", () => {
    expect(consultantAreaDecision("/consultant", owner)).toBe("redirect");
    expect(consultantAreaDecision("/consultant/clients", null)).toBe("redirect");
  });
});
