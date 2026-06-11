import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePeriodDisplayBounds } from "../periodDateBounds.js";

describe("resolvePeriodDisplayBounds", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 8, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mes retorna primeiro e último dia do mês corrente", () => {
    expect(resolvePeriodDisplayBounds("mes")).toEqual({
      from: "2026-06-01",
      to: "2026-06-30",
    });
  });

  it("3m retorna intervalo rolling de 3 meses até hoje", () => {
    expect(resolvePeriodDisplayBounds("3m")).toEqual({
      from: "2026-03-08",
      to: "2026-06-08",
    });
  });

  it("custom usa customFrom/customTo", () => {
    expect(resolvePeriodDisplayBounds("custom", "2026-01-01", "2026-01-15")).toEqual({
      from: "2026-01-01",
      to: "2026-01-15",
    });
  });

  it("tudo retorna vazio", () => {
    expect(resolvePeriodDisplayBounds("tudo")).toEqual({ from: "", to: "" });
  });
});
