import { describe, expect, it } from "vitest";

import { buildConsultantKpis } from "../consultantKpis.js";

describe("buildConsultantKpis", () => {
  it("returns the 4 KPIs in the spec order", () => {
    const kpis = buildConsultantKpis({});
    expect(kpis.map((k) => k.id)).toEqual([
      "clients",
      "patrimonio",
      "health",
      "mrr",
    ]);
  });

  it("maps real data for clients and health from the health-index aggregate", () => {
    const kpis = buildConsultantKpis({
      healthIndex: { organizations_count: 8, index: 71.6 },
      hasLoaded: true,
    });
    const byId = Object.fromEntries(kpis.map((k) => [k.id, k]));
    expect(byId.clients.value).toBe("8");
    expect(byId.clients.soon).toBe(false);
    // health index is rounded and labelled "de 100"
    expect(byId.health.value).toBe("72");
    expect(byId.health.sub).toBe("de 100");
  });

  it("marks patrimonio and mrr as deferred without inventing a number", () => {
    const kpis = buildConsultantKpis({
      healthIndex: { organizations_count: 8, index: 72 },
      hasLoaded: true,
    });
    const byId = Object.fromEntries(kpis.map((k) => [k.id, k]));
    expect(byId.patrimonio.soon).toBe(true);
    expect(byId.patrimonio.value).toBe("—");
    expect(byId.mrr.soon).toBe(true);
    expect(byId.mrr.value).toBe("—");
  });

  it("shows a loading placeholder for real KPIs before the first load", () => {
    const kpis = buildConsultantKpis({ hasLoaded: false });
    const byId = Object.fromEntries(kpis.map((k) => [k.id, k]));
    expect(byId.clients.value).toBe("…");
    expect(byId.health.value).toBe("…");
  });

  it("falls back to a dash once loaded with no data", () => {
    const kpis = buildConsultantKpis({ hasLoaded: true });
    const byId = Object.fromEntries(kpis.map((k) => [k.id, k]));
    expect(byId.clients.value).toBe("—");
    expect(byId.health.value).toBe("—");
    expect(byId.health.sub).toBe("semáforo");
  });
});
