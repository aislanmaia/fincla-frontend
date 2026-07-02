import { describe, expect, it } from "vitest";

import { aggregateValue } from "../consultantFormat.js";

describe("aggregateValue", () => {
  it("formats a present value", () => {
    expect(aggregateValue(8, true, (n) => String(n))).toBe("8");
    expect(aggregateValue(0, true, (n) => String(n))).toBe("0");
  });

  it("shows the loading placeholder before load", () => {
    expect(aggregateValue(null, false, String)).toBe("…");
    expect(aggregateValue(undefined, false, String)).toBe("…");
  });

  it("shows a dash once loaded with no value", () => {
    expect(aggregateValue(null, true, String)).toBe("—");
  });
});
