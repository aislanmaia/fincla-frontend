import { describe, expect, it } from "vitest";

import { formatAdminDate } from "./adminDates";

describe("formatAdminDate (#340)", () => {
  it("lê data-hora sem fuso como UTC e mostra o dia de Brasília", () => {
    // 22:33 UTC = 19:33 em Brasília, ainda 22/11.
    expect(formatAdminDate("2026-11-22T22:33:00")).toBe("22/11/2026");
    // 01:30 UTC do dia 23 = 22:30 do dia 22 em Brasília.
    expect(formatAdminDate("2026-11-23T01:30:00.123456")).toBe("22/11/2026");
  });

  it("respeita o fuso quando a API manda um", () => {
    expect(formatAdminDate("2026-11-23T01:30:00Z")).toBe("22/11/2026");
    expect(formatAdminDate("2026-11-22T10:00:00-03:00")).toBe("22/11/2026");
  });

  it("mostra data pura como está escrita", () => {
    expect(formatAdminDate("2026-12-06")).toBe("06/12/2026");
  });

  it("vazio ou inválido vira travessão", () => {
    expect(formatAdminDate(null)).toBe("—");
    expect(formatAdminDate("")).toBe("—");
    expect(formatAdminDate("not a date")).toBe("—");
  });
});
