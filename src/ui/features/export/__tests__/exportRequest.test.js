import { describe, expect, it } from "vitest";

import { filePrefixOf } from "../exportRequest.js";

const SERVER_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;

describe("filePrefixOf", () => {
  it.each([
    ["cartao", "Azul •7112", "cartao-azul-7112"],
    ["cartao", "Crédito Pão & Cia •0042", "cartao-credito-pao-cia-0042"],
    ["cartoes", "", "cartoes"],
    ["", "", "lancamentos"],
  ])("%s + %s → %s", (base, label, expected) => {
    expect(filePrefixOf(base, label)).toBe(expected);
    expect(filePrefixOf(base, label)).toMatch(SERVER_PATTERN);
  });

  it("nunca passa do limite do servidor nem termina em hífen", () => {
    const prefix = filePrefixOf("cartao", `${"a".repeat(94)} b`);
    expect(prefix.length).toBeLessThanOrEqual(100);
    expect(prefix).toMatch(SERVER_PATTERN);
    expect(prefix.endsWith("-")).toBe(false);
  });
});
