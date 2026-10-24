// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readStoredNovaTransacaoDate,
  todayLocalYmd,
  writeStoredNovaTransacaoDate,
} from "../transactionsAdapter.js";

describe("data lembrada do modal Nova transação", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 3, 10, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("vale no mesmo dia em que foi gravada", () => {
    writeStoredNovaTransacaoDate("org-1", "2026-10-03");
    expect(readStoredNovaTransacaoDate("org-1")).toBe("2026-10-03");
  });

  it("no dia seguinte não vale mais: o modal abre em hoje", () => {
    writeStoredNovaTransacaoDate("org-1", "2026-10-03");
    vi.setSystemTime(new Date(2026, 9, 24, 9, 0, 0));
    expect(readStoredNovaTransacaoDate("org-1")).toBeNull();
    expect(todayLocalYmd()).toBe("2026-10-24");
  });

  it("valor antigo (só a data, sem o dia da gravação) é ignorado", () => {
    localStorage.setItem("fincla.v2.novaTxDate.org-1", "2026-10-03");
    expect(readStoredNovaTransacaoDate("org-1")).toBeNull();
  });

  it("não quebra sem localStorage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => writeStoredNovaTransacaoDate("org-1", "2026-10-03")).not.toThrow();
    expect(readStoredNovaTransacaoDate("org-1")).toBeNull();
  });
});

describe("valor antigo", () => {
  it("é removido do armazenamento ao ser lido", () => {
    localStorage.setItem("fincla.v2.novaTxDate.org-2", "2026-10-03");
    expect(readStoredNovaTransacaoDate("org-2")).toBeNull();
    expect(localStorage.getItem("fincla.v2.novaTxDate.org-2")).toBeNull();
  });
});
