/** @vitest-environment jsdom */
// G4 BUG-02: a área de soltar mora numa coluna (UploadArea). Uma base fixa em `flex` ali vira ALTURA,
// e a área "compacta" ficava com os mesmos 460px da grande. A base tem de ser `auto`: a altura vem do
// mínimo de cada tamanho (240px compacta, 420px grande) ou do que a linha esticar.
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { StatementDropZone } from "../StatementDropZone.jsx";

afterEach(cleanup);

const rootOf = (name) => screen.getByRole("button", { name }).parentElement;

describe("a área de soltar dentro da coluna", () => {
  it("compacta: sem base fixa no flex (que viraria altura) e com o mínimo de 240px", () => {
    render(<StatementDropZone compact onFile={() => {}} />);

    const root = rootOf(/Ou solte aqui outro extrato/);
    expect(root.style.flexBasis).toBe("auto");
    expect(screen.getByRole("button", { name: /Ou solte aqui outro extrato/ }).style.minHeight).toBe("240px");
  });

  it("grande: a mesma regra, com o mínimo de 420px", () => {
    render(<StatementDropZone onFile={() => {}} />);

    const root = rootOf(/Solte aqui o extrato do banco/);
    expect(root.style.flexBasis).toBe("auto");
    expect(screen.getByRole("button", { name: /Solte aqui o extrato do banco/ }).style.minHeight).toBe("420px");
  });
});
