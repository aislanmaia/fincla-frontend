import { describe, expect, it } from "vitest";
import {
  resolveDataMode,
  resolveLocalData,
  shouldUseRealData,
} from "../dataMode.js";

describe("dataMode", () => {
  it("desliga mock e estado vazio forçado quando a feature flag não está ativa", () => {
    expect(resolveDataMode("mock", false)).toBe("live");
    expect(resolveDataMode("empty", false)).toBe("live");
  });

  it("preserva modos mock e empty quando a feature flag está ativa", () => {
    expect(resolveDataMode("mock", true)).toBe("mock");
    expect(resolveDataMode("empty", true)).toBe("empty");
  });

  it("usa dados locais só no modo mock explícito", () => {
    expect(resolveLocalData({
      dataMode: "mock",
      mockData: [1, 2, 3],
      emptyData: [],
    })).toEqual([1, 2, 3]);

    expect(resolveLocalData({
      dataMode: "live",
      mockData: [1, 2, 3],
      emptyData: [],
    })).toEqual([]);
  });

  it("usa API real sempre que existir organização e o modo não for empty", () => {
    expect(shouldUseRealData("org-1", "live")).toBe(true);
    expect(shouldUseRealData("org-1", "mock")).toBe(true);
    expect(shouldUseRealData("org-1", "empty")).toBe(false);
    expect(shouldUseRealData(null, "live")).toBe(false);
  });
});
