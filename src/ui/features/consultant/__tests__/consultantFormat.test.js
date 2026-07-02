import { describe, expect, it } from "vitest";

import {
  DASH,
  aggregateValue,
  fmtLastActive,
  fmtMoney,
  fmtPct,
  healthTone,
  trendGlyph,
} from "../consultantFormat.js";

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

describe("fmtPct — robusto a valor ausente/não-finito", () => {
  it("formata número com 1 casa (inclui negativo)", () => {
    expect(fmtPct(-17.6)).toBe("-17.6%");
    expect(fmtPct(0)).toBe("0.0%");
    expect(fmtPct(53)).toBe("53.0%");
  });
  it("degrada para 0.0% em null/undefined/NaN/Infinity (não quebra o render)", () => {
    expect(fmtPct(null)).toBe("0.0%");
    expect(fmtPct(undefined)).toBe("0.0%");
    expect(fmtPct(Number.NaN)).toBe("0.0%");
    expect(fmtPct(Number.POSITIVE_INFINITY)).toBe("0.0%");
  });
});

describe("fmtMoney — sinal só quando negativo", () => {
  it("aceita string decimal e número", () => {
    expect(fmtMoney("18280.00")).toBe("R$ 18.280,00");
    expect(fmtMoney("-3340.00")).toBe("−R$ 3.340,00");
    expect(fmtMoney(0)).toBe("R$ 0,00");
  });
  it("valor ausente vira R$ 0,00", () => {
    expect(fmtMoney(null)).toBe("R$ 0,00");
  });
});

describe("fmtLastActive", () => {
  it("YYYY-MM-DD → dd/mm/aaaa", () => {
    expect(fmtLastActive("2026-06-28")).toBe("28/06/2026");
    expect(fmtLastActive("2026-06-28T10:00:00Z")).toBe("28/06/2026");
  });
  it("null/malformado → DASH", () => {
    expect(fmtLastActive(null)).toBe(DASH);
    expect(fmtLastActive("")).toBe(DASH);
    expect(fmtLastActive("nope")).toBe(DASH);
  });
});

describe("healthTone — faixa por saúde", () => {
  it("rotula em dia / atenção / em risco", () => {
    expect(healthTone(92).label).toBe("Em dia");
    expect(healthTone(55).label).toBe("Atenção");
    expect(healthTone(30).label).toBe("Em risco");
  });
});

describe("trendGlyph", () => {
  it("mapeia up/down/flat (default →)", () => {
    expect(trendGlyph("up").glyph).toBe("↑");
    expect(trendGlyph("down").glyph).toBe("↓");
    expect(trendGlyph("flat").glyph).toBe("→");
    expect(trendGlyph(undefined).glyph).toBe("→");
  });
});
