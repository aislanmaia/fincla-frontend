import { describe, expect, it } from "vitest";
import { formatCustomPeriodLabel } from "../../filters/customPeriodLabel.js";

describe("formatCustomPeriodLabel", () => {
  it("mesmo mês: dia–dia mês", () => {
    expect(formatCustomPeriodLabel("2026-10-01", "2026-10-15")).toMatch(/1–15 out/i);
  });

  it("meses diferentes no mesmo ano", () => {
    expect(formatCustomPeriodLabel("2026-10-01", "2026-12-15")).toMatch(/1 out.*15 dez/i);
  });

  it("anos diferentes inclui ano", () => {
    const label = formatCustomPeriodLabel("2025-12-20", "2026-01-05");
    expect(label).toMatch(/2025/);
    expect(label).toMatch(/2026/);
  });

  it("somente data inicial", () => {
    expect(formatCustomPeriodLabel("2026-05-01", "")).toMatch(/A partir de 1 mai/i);
  });

  it("somente data final", () => {
    expect(formatCustomPeriodLabel("", "2026-05-31")).toMatch(/Até 31 mai/i);
  });

  it("sem datas válidas cai em Personalizado", () => {
    expect(formatCustomPeriodLabel("", "")).toBe("Personalizado");
  });
});
