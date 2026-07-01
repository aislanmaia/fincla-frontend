import { describe, expect, it } from "vitest";

import { buildRiskSemaphore } from "../consultantRiskSemaphore.js";

describe("buildRiskSemaphore", () => {
  it("splits the base into attention vs em dia", () => {
    const { segments, base } = buildRiskSemaphore({
      atRiskTotal: 3,
      organizationsCount: 10,
      healthIndex: 72,
    });
    expect(base).toBe(10);
    const byId = Object.fromEntries(segments.map((s) => [s.id, s.value]));
    expect(byId.attention).toBe(3);
    expect(byId.ok).toBe(7);
  });

  it("rounds the health index into the center value", () => {
    const { centerValue } = buildRiskSemaphore({
      atRiskTotal: 0,
      organizationsCount: 5,
      healthIndex: 71.6,
    });
    expect(centerValue).toBe("72");
  });

  it("clamps at-risk to the base so em dia never goes negative", () => {
    const { segments } = buildRiskSemaphore({
      atRiskTotal: 12,
      organizationsCount: 8,
      healthIndex: 40,
    });
    const byId = Object.fromEntries(segments.map((s) => [s.id, s.value]));
    expect(byId.attention).toBe(8);
    expect(byId.ok).toBe(0);
  });

  it("shows a loading center before load and a dash once loaded-empty", () => {
    expect(buildRiskSemaphore({ hasLoaded: false }).centerValue).toBe("…");
    expect(buildRiskSemaphore({ hasLoaded: true }).centerValue).toBe("—");
  });
});
