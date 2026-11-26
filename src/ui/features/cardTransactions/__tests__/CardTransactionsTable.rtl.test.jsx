/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CardTransactionsTable, ledgerGrid } from "../CardTransactionsTable.jsx";

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
  it("cada caixa vive num rótulo de 28 px, no celular e no desktop (tablet e notebook com toque incluídos)", () => {
    for (const isMobile of [true, false]) {
      const { unmount } = render(<CardTransactionsTable rows={rows} total={2} cardCurrency="BRL" selected={[]} onSelected={noop} onInspect={noop} onMore={noop} isMobile={isMobile} />);
      for (const name of ["Selecionar Aluguel", "Selecionar lançamentos carregados"]) {
        const label = screen.getByRole("checkbox", { name }).closest("label");
        expect(label).not.toBeNull();
        expect(label.style.width).toBe("28px");
        expect(label.style.height).toBe("28px");
      }
      unmount();
    }
  });

  it("tocar na área do rótulo marca a linha", () => {
    const picked = [];
    render(<CardTransactionsTable rows={rows} total={2} cardCurrency="BRL" selected={[]} onSelected={(ids) => picked.push(ids)} onInspect={noop} onMore={noop} isMobile />);
    screen.getByRole("checkbox", { name: "Selecionar Luz" }).closest("label").click();
    expect(picked.at(-1)).toEqual(["2"]);
  });
});

describe("CardTransactionsTable · concordância da contagem", () => {
  const table = (props) => render(<CardTransactionsTable cardCurrency="BRL" selected={[]} onSelected={noop} onInspect={noop} onMore={noop} isMobile={false} {...props} />);

  it("cabeçalho e rodapé: 1 lançamento no singular, vários no plural", () => {
    const { unmount } = table({ rows: rows.slice(0, 1), total: 1 });
    expect(screen.getByTestId("ledger-count")).toHaveTextContent(/^1 lançamento$/);
    expect(screen.getByTestId("ledger-footer-count")).toHaveTextContent(/^1 de 1 lançamento$/);
    expect(screen.queryByText(/Você viu todos/)).toBeNull();
    unmount();
    table({ rows, total: 2 });
    expect(screen.getByTestId("ledger-count")).toHaveTextContent(/^2 lançamentos$/);
    expect(screen.getByText("Você viu todos os 2 lançamentos")).toBeInTheDocument();
  });

  it("sem total, o rodapé conta os carregados com concordância", () => {
    const { unmount } = table({ rows: rows.slice(0, 1), total: null });
    expect(screen.getByTestId("ledger-footer-count")).toHaveTextContent(/^1 lançamento carregado$/);
    unmount();
    table({ rows, total: null });
    expect(screen.getByTestId("ledger-footer-count")).toHaveTextContent(/^2 lançamentos carregados$/);
  });
});

describe("CardTransactionsTable · ações rápidas como em /transactions", () => {
  const table = (props) => render(<CardTransactionsTable rows={rows} total={2} cardCurrency="BRL" selected={[]} onSelected={noop} onInspect={noop} onMore={noop} onEdit={noop} onDelete={noop} isMobile={false} {...props} />);
  afterEach(() => { Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 }); });

  it("as ações moram no vão logo antes do valor, não na coluna de categoria", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
    table();
    const edit = screen.getByRole("button", { name: "Editar Aluguel" });
    const gapCell = edit.closest(".fincla-quick").parentElement;
    expect(gapCell.nextElementSibling).toHaveTextContent("−R$ 10,00");
    expect(gapCell.previousElementSibling).toHaveTextContent("—");
    expect(screen.getAllByText("Moradia")[0].closest(".fincla-quick")).toBeNull();
  });

  it("com lista larga o botão abre o rótulo no hover; estreita, fica só o ícone (mesma régua de 1000 px)", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
    const { unmount } = table();
    expect(screen.getByRole("button", { name: "Editar Aluguel" })).not.toHaveClass("fincla-qa-mute");
    unmount();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
    table();
    expect(screen.getByRole("button", { name: "Excluir Aluguel" })).toHaveClass("fincla-qa-mute");
  });
});

describe("CardTransactionsTable · grade pela largura medida da lista (Valor e Status nunca cortados)", () => {
  // Soma dos pisos + 10 px entre colunas + 24 px de respiro da linha: o mínimo que a grade pede.
  const floorOf = (columns) => columns.split(" ").reduce((sum, track) => sum + Number((track.match(/minmax\((\d+)px/) ?? track.match(/^(\d+)px$/) ?? [0, 0])[1]), 0) + (columns.split(" ").length - 1) * 10 + 24;

  it.each([[600], [759], [819], [820], [971], [1049], [1050], [1300]])("com %ipx de lista a grade cabe", (width) => {
    expect(floorOf(ledgerGrid({ width, actions: true }).columns)).toBeLessThanOrEqual(width);
  });

  it("ordem de sacrifício: rótulos só com folga; Restam e Fim previsto saem abaixo de 820 px", () => {
    expect(ledgerGrid({ width: 1050, actions: true })).toMatchObject({ labels: true, compact: false });
    expect(ledgerGrid({ width: 1049, actions: true })).toMatchObject({ labels: false, compact: false });
    expect(ledgerGrid({ width: 819, actions: true })).toMatchObject({ labels: false, compact: true });
    expect(ledgerGrid({ width: 1300, actions: false }).labels).toBe(false);
  });

  it("mede a LISTA, não a janela: painel aberto (760 px) desliga os rótulos e as colunas de parcela mesmo com a janela larga", () => {
    let report = null;
    vi.stubGlobal("ResizeObserver", class { constructor(cb) { report = cb; } observe() {} disconnect() {} });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
    try {
      render(<CardTransactionsTable rows={rows} total={2} cardCurrency="BRL" selected={[]} onSelected={noop} onInspect={noop} onMore={noop} onEdit={noop} onDelete={noop} isMobile={false} />);
      expect(screen.getByRole("button", { name: "Editar Aluguel" })).not.toHaveClass("fincla-qa-mute");
      expect(screen.getByText("Fim previsto")).toBeInTheDocument();
      act(() => report([{ contentRect: { width: 760 } }]));
      expect(screen.getByRole("button", { name: "Editar Aluguel" })).toHaveClass("fincla-qa-mute");
      expect(screen.queryByText("Fim previsto")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    }
  });
});
