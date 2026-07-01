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

  it("maps real data for clients and health", () => {
    const kpis = buildConsultantKpis({
      summary: { organizations_count: 8 },
      healthIndex: { index: 71.6 },
    });
    const byKey = Object.fromEntries(kpis.map((k) => [k.id, k]));
    expect(byKey.clients.value).toBe("8");
    expect(byKey.clients.soon).toBe(false);
    // health index is rounded and labelled "de 100"
    expect(byKey.health.value).toBe("72");
    expect(byKey.health.sub).toBe("de 100");
  });

  it("marks patrimonio and mrr as 'em breve' without inventing a number", () => {
    const kpis = buildConsultantKpis({
      summary: { organizations_count: 8 },
      healthIndex: { index: 72 },
    });
    const byKey = Object.fromEntries(kpis.map((k) => [k.id, k]));
    expect(byKey.patrimonio.soon).toBe(true);
    expect(byKey.patrimonio.value).toBe("—");
    expect(byKey.mrr.soon).toBe(true);
    expect(byKey.mrr.value).toBe("—");
  });

  it("shows a loading placeholder for real KPIs before data arrives", () => {
    const kpis = buildConsultantKpis({ isLoading: true });
    const byKey = Object.fromEntries(kpis.map((k) => [k.id, k]));
    expect(byKey.clients.value).toBe("…");
    expect(byKey.health.value).toBe("…");
  });

  it("falls back to a dash when not loading and no data", () => {
    const kpis = buildConsultantKpis({ isLoading: false });
    const byKey = Object.fromEntries(kpis.map((k) => [k.id, k]));
    expect(byKey.clients.value).toBe("—");
    expect(byKey.health.value).toBe("—");
    expect(byKey.health.sub).toBe("semáforo");
  });
});
