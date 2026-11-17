/** @vitest-environment jsdom */
// PageEnter `fillMin`: a página ocupa pelo menos a altura da área de conteúdo (que continua rolando);
// `fill` (telas que rolam por conta própria) e o padrão continuam como eram.
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { PageEnter } from "../primitives.jsx";

afterEach(cleanup);
const wrapperOf = (text) => screen.getByText(text).parentElement;

describe("PageEnter", () => {
  it("fillMin: no mínimo a altura toda, em coluna, sem prender a rolagem", () => {
    render(<PageEnter fillMin><span>conteúdo</span></PageEnter>);
    const w = wrapperOf("conteúdo");
    expect(w.style.minHeight).toBe("100%");
    expect(w.style.display).toBe("flex");
    expect(w.style.flexDirection).toBe("column");
    expect(w.style.overflow).toBe("");
  });

  it("padrão: nenhuma altura imposta", () => {
    render(<PageEnter><span>conteúdo</span></PageEnter>);
    const w = wrapperOf("conteúdo");
    expect(w.style.minHeight).toBe("");
    expect(w.style.display).toBe("");
  });
});
