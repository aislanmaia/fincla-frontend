/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CardTransactionsTable } from "../CardTransactionsTable.jsx";

const rows = [
  { id: "1", date: "2026-10-27T00:00:00", description: "Aluguel", value: 10, value_currency: "BRL", type: "expense", status: "confirmed", category: "Moradia" },
  { id: "2", date: "2026-10-28T00:00:00", description: "Luz", value: 20, value_currency: "BRL", type: "expense", status: "confirmed", category: "Moradia" },
];
const noop = () => {};
afterEach(cleanup);

describe("CardTransactionsTable · seleção em lote", () => {
  it("a barra quebra de linha e leva todas as ações, inclusive Limpar seleção, para dentro do toolbar", () => {
    render(<CardTransactionsTable rows={rows} total={2} cardCurrency="BRL" selected={["1", "2"]} onSelected={noop} onCategorize={noop} onMoveInstallment={noop} onExportSelected={noop} onInspect={noop} onMore={noop} isMobile />);
    const toolbar = screen.getByRole("toolbar", { name: "Ações em lote" });
    for (const name of ["Categorizar", "Mover parcela", "Exportar seleção", "Limpar seleção"]) expect(within(toolbar).getByRole("button", { name })).toBeTruthy();
    expect(toolbar.style.flexWrap).toBe("wrap");
    expect(toolbar.parentElement.style.flexWrap).toBe("wrap");
  });
});

describe("CardTransactionsTable · alvo de toque das caixas de seleção", () => {
  it("no celular cada caixa vive num rótulo de 32 px; no desktop continua a caixa nativa", () => {
    const { unmount } = render(<CardTransactionsTable rows={rows} total={2} cardCurrency="BRL" selected={[]} onSelected={noop} onInspect={noop} onMore={noop} isMobile />);
    for (const name of ["Selecionar Aluguel", "Selecionar lançamentos carregados"]) {
      const box = screen.getByRole("checkbox", { name });
      expect(box.closest("label")).not.toBeNull();
      expect(box.closest("label").style.width).toBe("32px");
      expect(box.closest("label").style.height).toBe("32px");
    }
    unmount();
    render(<CardTransactionsTable rows={rows} total={2} cardCurrency="BRL" selected={[]} onSelected={noop} onInspect={noop} onMore={noop} />);
    expect(screen.getByRole("checkbox", { name: "Selecionar Aluguel" }).closest("label")).toBeNull();
  });

  it("tocar na área do rótulo marca a linha", async () => {
    const picked = [];
    render(<CardTransactionsTable rows={rows} total={2} cardCurrency="BRL" selected={[]} onSelected={(ids) => picked.push(ids)} onInspect={noop} onMore={noop} isMobile />);
    screen.getByRole("checkbox", { name: "Selecionar Luz" }).closest("label").click();
    expect(picked.at(-1)).toEqual(["2"]);
  });
});
