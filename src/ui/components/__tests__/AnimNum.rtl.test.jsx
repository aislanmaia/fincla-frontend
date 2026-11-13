/** @vitest-environment jsdom */

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { AnimNum } from "../primitives.jsx";

afterEach(cleanup);

/**
 * #315 — `AnimNum` tinha `prefix = "R$\u00a0"` como padrão: o mesmo padrão silencioso
 * que os formatadores perderam no #310. Esquecido o prefixo, um valor em dólar saía
 * em real. Agora o prefixo é obrigatório.
 */
describe("AnimNum — prefixo obrigatório (#315)", () => {
  it("sem prefixo é defeito de quem chama: no teste, lança", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<AnimNum value={10} />)).toThrow(/prefixo ausente/);
    console.error.mockRestore();
  });

  it("escreve o prefixo que recebe", () => {
    const { container } = render(<AnimNum value={1234.5} prefix={"US$\u00a0"} />);
    expect(container.textContent).toBe("US$\u00a01.234,50");
  });

  it("prefixo vazio é um número sem unidade, permitido", () => {
    const { container } = render(<AnimNum value={3} prefix="" />);
    expect(container.textContent).toBe("3,00");
  });
});
