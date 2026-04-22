import { describe, expect, it } from "vitest";
import {
  isTransactionEditPathId,
  transactionEditIdFromPathname,
} from "../transactionPathId.js";

describe("isTransactionEditPathId", () => {
  it("aceita UUID v4 em minúsculas", () => {
    expect(
      isTransactionEditPathId("550e8400-e29b-41d4-a716-446655440000"),
    ).toBe(true);
  });

  it("aceita id numérico (mock)", () => {
    expect(isTransactionEditPathId("42")).toBe(true);
  });

  it("rejeita strings inválidas", () => {
    expect(isTransactionEditPathId("")).toBe(false);
    expect(isTransactionEditPathId("abc")).toBe(false);
    expect(isTransactionEditPathId("../hack")).toBe(false);
  });
});

describe("transactionEditIdFromPathname", () => {
  it("extrai id de /transactions/:id", () => {
    expect(
      transactionEditIdFromPathname(
        "/transactions/550e8400-e29b-41d4-a716-446655440000",
      ),
    ).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(transactionEditIdFromPathname("/transactions/7")).toBe("7");
  });

  it("devolve null fora do padrão", () => {
    expect(transactionEditIdFromPathname("/transactions")).toBeNull();
    expect(transactionEditIdFromPathname("/transactions/x")).toBeNull();
    expect(transactionEditIdFromPathname("/dashboard")).toBeNull();
  });
});
