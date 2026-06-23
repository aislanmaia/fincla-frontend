import { describe, expect, it } from "vitest";
import {
  deriveTerm,
  effectiveTerm,
  goalTypeMeta,
  priorityFromNumber,
  priorityToNumber,
  typeSupportsReturn,
} from "../goalMeta.js";

function isoMonthsAhead(months) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

describe("goalMeta", () => {
  it("deriveTerm classifica pelo horizonte do deadline", () => {
    expect(deriveTerm(isoMonthsAhead(6))).toBe("short");
    expect(deriveTerm(isoMonthsAhead(24))).toBe("medium");
    expect(deriveTerm(isoMonthsAhead(60))).toBe("long");
    expect(deriveTerm(null)).toBe(null);
  });

  it("effectiveTerm prioriza term explícito, senão deriva, senão none", () => {
    expect(effectiveTerm({ term: "long", deadline: null })).toBe("long");
    expect(effectiveTerm({ term: null, deadline: null })).toBe("none");
    expect(effectiveTerm({ term: null, deadline: isoMonthsAhead(6) })).toBe("short");
  });

  it("converte prioridade entre número e nível", () => {
    expect(priorityToNumber("alta")).toBe(3);
    expect(priorityToNumber("baixa")).toBe(1);
    expect(priorityFromNumber(3)).toBe("alta");
    expect(priorityFromNumber(2)).toBe("media");
    expect(priorityFromNumber(1)).toBe("baixa");
    expect(priorityFromNumber(null)).toBe("media");
  });

  it("goalTypeMeta cai em 'other' para tipo desconhecido", () => {
    expect(goalTypeMeta("zzz").id).toBe("other");
    expect(goalTypeMeta("travel").emoji).toBe("✈️");
  });

  it("typeSupportsReturn só para investimento/aposentadoria", () => {
    expect(typeSupportsReturn("investment")).toBe(true);
    expect(typeSupportsReturn("retirement")).toBe(true);
    expect(typeSupportsReturn("travel")).toBe(false);
  });
});
