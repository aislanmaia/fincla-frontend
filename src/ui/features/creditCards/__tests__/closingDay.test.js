import { describe, expect, it } from "vitest";

import { isValidMonthDay, suggestedClosingDay } from "../closingDay.js";

describe("suggestedClosingDay (mesma regra do backend)", () => {
  it.each([[10, 3], [15, 8], [8, 1], [7, 28], [5, 28], [31, 24], [1, 25]])("vencimento %i sugere fechamento %i", (due, expected) => {
    expect(suggestedClosingDay(due)).toBe(expected);
  });

  it.each([[0], [32], ["abc"], [""], [null]])("sem sugestão para vencimento inválido (%s)", (due) => {
    expect(suggestedClosingDay(due)).toBeNull();
  });
});

describe("isValidMonthDay", () => {
  it.each([["1", true], ["31", true], ["05", true], ["0", false], ["32", false], ["", false], ["a", false], [" 3 ", true]])("%j -> %s", (value, expected) => {
    expect(isValidMonthDay(value)).toBe(expected);
  });
});
