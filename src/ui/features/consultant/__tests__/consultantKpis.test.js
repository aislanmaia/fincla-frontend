import { describe, expect, it } from "vitest";

import { buildConsultantKpis } from "../consultantKpis.js";

describe("buildConsultantKpis", () => {
  it("returns the 4 KPIs in the spec order", () => {
    const kpis = buildConsultantKpis({});
    expect(kpis.map((k) => k.id)).toEqual([
      "clients",
      "patrimonio",
      "health",
      "attention",
    ]);
  });

  it("has no deferred (soon) KPIs — all 4 are backed by real data", () => {
    const kpis = buildConsultantKpis({});
    expect(kpis.every((k) => k.soon === false)).toBe(true);
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

  it("maps the aggregated patrimônio (BRL, no cents) and attention count", () => {
    const kpis = buildConsultantKpis({
      healthIndex: { organizations_count: 10, index: 92 },
      hasLoaded: true,
      patrimonio: 384210,
      patrimonioLoaded: true,
      attention: 1,
      attentionLoaded: true,
    });
    const byId = Object.fromEntries(kpis.map((k) => [k.id, k]));
    expect(byId.patrimonio.value).toBe("R$ 384.210");
    expect(byId.patrimonio.soon).toBe(false);
    expect(byId.attention.value).toBe("1");
    expect(byId.attention.sub).toBe("de 10 clientes");
  });

  it("shows real zero (not a dash) once loaded — R$ 0 and 0 em atenção", () => {
    const kpis = buildConsultantKpis({
      healthIndex: { organizations_count: 3, index: 88 },
      hasLoaded: true,
      patrimonio: 0,
      patrimonioLoaded: true,
      attention: 0,
      attentionLoaded: true,
    });
    const byId = Object.fromEntries(kpis.map((k) => [k.id, k]));
    expect(byId.patrimonio.value).toBe("R$ 0");
    expect(byId.attention.value).toBe("0");
  });

  it("shows a loading placeholder for real KPIs before the first load", () => {
    const kpis = buildConsultantKpis({ hasLoaded: false });
    const byId = Object.fromEntries(kpis.map((k) => [k.id, k]));
    expect(byId.clients.value).toBe("…");
    expect(byId.health.value).toBe("…");
    expect(byId.patrimonio.value).toBe("…");
    expect(byId.attention.value).toBe("…");
  });

  it("falls back to a dash once loaded with no data", () => {
    const kpis = buildConsultantKpis({ hasLoaded: true, patrimonioLoaded: true, attentionLoaded: true });
    const byId = Object.fromEntries(kpis.map((k) => [k.id, k]));
    expect(byId.clients.value).toBe("—");
    expect(byId.health.value).toBe("—");
    expect(byId.health.sub).toBe("semáforo");
    expect(byId.patrimonio.value).toBe("—");
    expect(byId.attention.value).toBe("—");
    expect(byId.attention.sub).toBe("acompanhamento");
  });
});
