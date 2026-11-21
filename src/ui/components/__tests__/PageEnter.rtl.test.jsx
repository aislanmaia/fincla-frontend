/** @vitest-environment jsdom */
// PageEnter `fillMin`: a página ocupa pelo menos o que sobra na área de conteúdo (que continua rolando);
// `fill` (telas que rolam por conta própria) e o padrão continuam como eram.
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { PageEnter } from "../primitives.jsx";

afterEach(cleanup);
const wrapperOf = (text) => screen.getByText(text).parentElement;

describe("PageEnter", () => {
  it("fillMin: cresce até o que sobra na área de conteúdo (coluna flex), em coluna, sem prender a rolagem", () => {
    render(<PageEnter fillMin><span>conteúdo</span></PageEnter>);
    const w = wrapperOf("conteúdo");
    // `flex: 1 0 auto` e não `minHeight: 100%`: 100% mediria a área inteira e, com o aviso de acesso
    // em cima, a tela passaria a rolar pela altura do aviso (G3 achado 9).
    expect(w.style.flexGrow).toBe("1");
    expect(w.style.flexShrink).toBe("0");
    expect(w.style.flexBasis).toBe("auto");
    expect(w.style.minHeight).toBe("");
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
