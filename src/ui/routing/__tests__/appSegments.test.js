import { describe, expect, it } from "vitest";
import {
  AUTH_ROUTE_SEGMENTS,
  firstPathSegment,
  isAuthRouteSegment,
} from "../appSegments.js";

describe("appSegments", () => {
  it("lista segmentos autenticados em inglês", () => {
    expect(AUTH_ROUTE_SEGMENTS).toContain("dashboard");
    expect(AUTH_ROUTE_SEGMENTS).toContain("rhythm");
    expect(AUTH_ROUTE_SEGMENTS).toContain("transactions");
  });

  it("firstPathSegment extrai o primeiro segmento", () => {
    expect(firstPathSegment("/dashboard")).toBe("dashboard");
    expect(firstPathSegment("/transactions/foo")).toBe("transactions");
    expect(firstPathSegment("/")).toBe("");
    expect(firstPathSegment("")).toBe("");
  });

  it("isAuthRouteSegment reconhece apenas rotas conhecidas", () => {
    expect(isAuthRouteSegment("dashboard")).toBe(true);
    expect(isAuthRouteSegment("rhythm")).toBe(true);
    expect(isAuthRouteSegment("typo")).toBe(false);
  });
});
