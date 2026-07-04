import { describe, expect, it } from "vitest";

import { buildBaseSemaphore } from "../consultantBaseSemaphore.js";

describe("buildBaseSemaphore", () => {
  it("conta os clientes por faixa de saúde (3-vias)", () => {
    const clients = [
      { organization_id: "a", health: 85 }, // healthy (≥70)
      { organization_id: "b", health: 90 }, // healthy
      { organization_id: "c", health: 55 }, // attention (40-69)
      { organization_id: "d", health: 30 }, // risk (<40)
    ];
    const r = buildBaseSemaphore({ clients, hasLoaded: true, healthIndex: 71.6 });
    expect(r.counts).toEqual({ healthy: 2, attention: 1, risk: 1 });
    expect(r.total).toBe(4);
    expect(r.splitAvailable).toBe(true);
    expect(r.centerValue).toBe("72"); // saúde média arredondada
  });

  it("split indisponível quando não carregou ou lista vazia", () => {
    expect(buildBaseSemaphore({ clients: [], hasLoaded: true }).splitAvailable).toBe(false);
    expect(buildBaseSemaphore({ clients: [{ health: 80 }], hasLoaded: false }).splitAvailable).toBe(false);
  });

  it("centro '—' sem health index; tolera entrada ausente", () => {
    expect(buildBaseSemaphore({ clients: [{ health: 80 }], hasLoaded: true }).centerValue).toBe("—");
    expect(buildBaseSemaphore().counts).toEqual({ healthy: 0, attention: 0, risk: 0 });
  });
});
