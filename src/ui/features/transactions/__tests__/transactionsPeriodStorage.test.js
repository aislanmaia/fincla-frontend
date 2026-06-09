/** @vitest-environment jsdom */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  getTransactionsPeriodBootstrap,
  readTransactionsPeriodFromStorage,
  writeTransactionsPeriodToStorage,
} from "../transactionsPeriodStorage.js";

describe("transactionsPeriodStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("persiste custom com só data inicial (intervalo aberto)", () => {
    writeTransactionsPeriodToStorage("org-1", {
      period: "custom",
      customFrom: "2026-03-01",
      customTo: "",
    });
    expect(readTransactionsPeriodFromStorage("org-1")).toEqual({
      period: "custom",
      customFrom: "2026-03-01",
      customTo: "",
    });
    expect(getTransactionsPeriodBootstrap("org-1")).toEqual({
      period: "custom",
      customFrom: "2026-03-01",
      customTo: "",
    });
  });

  it("persiste custom com só data final", () => {
    writeTransactionsPeriodToStorage("org-1", {
      period: "custom",
      customFrom: "",
      customTo: "2026-06-30",
    });
    expect(readTransactionsPeriodFromStorage("org-1")).toEqual({
      period: "custom",
      customFrom: "",
      customTo: "2026-06-30",
    });
  });

  it("rejeita custom sem nenhuma data", () => {
    writeTransactionsPeriodToStorage("org-1", {
      period: "custom",
      customFrom: "",
      customTo: "",
    });
    expect(readTransactionsPeriodFromStorage("org-1")).toBeNull();
  });

  it("rejeita custom com from > to", () => {
    writeTransactionsPeriodToStorage("org-1", {
      period: "custom",
      customFrom: "2026-05-10",
      customTo: "2026-05-01",
    });
    expect(readTransactionsPeriodFromStorage("org-1")).toBeNull();
  });
});
