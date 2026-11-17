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

describe("Extratos importados ao lado da área (computador)", () => {
  it("a lista mede o próprio conteúdo até 480px e só então rola; nunca encolhe até a área (G4 BUG-03)", async () => {
    const { ImportedStatementsList } = await import("../ImportedStatements.jsx");
    const item = { id: "a", status: "concluded", period: { start: "2026-05-01", end: "2026-05-12" }, summary: { total: 6, to_create: 5, grouped: 0, groups: 0, ignored: 0, unanswered: 0 }, final_difference: 0, final_difference_currency: "BRL", created_at: "2026-11-15T10:00:00", concluded_at: "2026-11-15T10:00:00", undone_at: null, latest_concluded: true };
    render(<ImportedStatementsList items={[item]} onOpen={() => {}} onUndo={() => {}} />);

    const scroll = screen.getByTestId("imported-statements-scroll");
    expect(scroll.style.position).not.toBe("absolute");
    expect(scroll.style.maxHeight).toBe("480px");
    expect(scroll.style.overflowY).toBe("auto");
  });

  it("esticada (tela inicial sem rascunho, computador): a lista ocupa a coluna inteira e rola dentro dela, sem teto e sem empurrar a linha (G3 achado 3)", async () => {
    const { ImportedStatementsList } = await import("../ImportedStatements.jsx");
    render(<ImportedStatementsList items={[]} fill onOpen={() => {}} onUndo={() => {}} />);

    const scroll = screen.getByTestId("imported-statements-scroll");
    // Fora do fluxo: o conteúdo não dá altura à linha; a coluna toma a altura da linha.
    expect(scroll.style.position).toBe("absolute");
    expect([scroll.style.top, scroll.style.right, scroll.style.bottom, scroll.style.left]).toEqual(["0px", "0px", "0px", "0px"]);
    expect(scroll.style.maxHeight).toBe("");
    expect(scroll.style.overflowY).toBe("auto");
    const box = scroll.parentElement;
    expect(box.style.position).toBe("relative");
    expect(box.style.flexGrow).toBe("1");
    expect(box.style.minHeight).toBe("0px");
    // O cartão segue com o mínimo de 280px (a coluna nunca some).
    expect(screen.getByRole("region", { name: "Extratos importados" }).style.minHeight).toBe("280px");
  });
});
