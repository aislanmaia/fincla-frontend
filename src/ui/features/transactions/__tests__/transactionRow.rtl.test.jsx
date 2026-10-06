/** @vitest-environment jsdom */
/* Caracterização da linha de lançamento e da formatação compartilhada.
   Importa pelo caminho da página de propósito: este arquivo fixa o
   comportamento observável ANTES e DEPOIS da extração, sem edição. */

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  TxRow,
  fmtBRL,
  fmtValorDaLinha,
  catColor,
  shortDateLabel,
} from "../../../pages/TransacoesPage.jsx";
import { transactionStatus } from "../shared/transactionFormat.js";

afterEach(cleanup);

const nbsp = " ";

const expense = {
  id: "t1",
  date: "21/05",
  desc: "Almoço",
  cat: "Alimentação",
  val: -42.5,
  method: "Pix",
  type: "expense",
  icon: "🍽",
  rec: false,
  tags: ["trabalho", "mercado", "extra"],
};
const income = { ...expense, id: "t2", desc: "Salário", cat: "Receita", val: 5000, type: "income", method: "Transferência", tags: [] };
const refund = { ...expense, id: "t3", desc: "Estorno", type: "refund", val: 10, tags: [] };

function row(props = {}) {
  const onSelect = vi.fn();
  const utils = render(
    <TxRow tx={expense} isMobile={false} isSelected={false} onSelect={onSelect}
      coveringAnchor={null} dateLabel={{ top: "21 mai", sub: "qui" }} {...props} />,
  );
  return { onSelect, ...utils };
}

describe("formatação de valor, cor e data", () => {
  it("preserva os rótulos e cores do status nos detalhes", () => {
    expect(transactionStatus("confirmado")).toEqual({ label: "✓ Confirmado", background: "#ECFDF5", color: "#059669" });
    expect(transactionStatus("pendente")).toEqual({ label: "⏳ Pendente", background: "#FFFBEB", color: "#D97706" });
  });
  it("fmtBRL usa valor absoluto, R$ + nbsp e vírgula decimal", () => {
    expect(fmtBRL(-1234.5)).toBe(`R$${nbsp}1.234,50`);
    expect(fmtBRL(0)).toBe(`R$${nbsp}0,00`);
  });

  it("fmtValorDaLinha respeita a moeda da linha e cai no real sem moeda", () => {
    expect(fmtValorDaLinha(-100)).toBe(`R$${nbsp}100,00`);
    expect(fmtValorDaLinha(-100, "BRL")).toBe(`R$${nbsp}100,00`);
    expect(fmtValorDaLinha(-100, "EUR")).toBe(`€${nbsp}100,00`);
    expect(fmtValorDaLinha(5, "ZZZZ")).toBe(`ZZZZ${nbsp}5,00`);
  });

  it("catColor devolve a cor mapeada e um cinza para categoria desconhecida", () => {
    expect(catColor("Alimentação")).toBe("#059669");
    expect(catColor("Moradia")).toBe("#6B7280");
    expect(catColor("Inexistente")).toBeTruthy();
    expect(catColor("Inexistente")).not.toBe("#059669");
  });

  it("shortDateLabel: hoje, ontem, dia da semana, vazio e inválido", () => {
    const today = new Date(2026, 4, 21);
    expect(shortDateLabel("21/05", today)).toEqual({ top: "21 mai", sub: "hoje" });
    expect(shortDateLabel("20/05/2026", today)).toEqual({ top: "20 mai", sub: "ontem" });
    expect(shortDateLabel("15/05/2026", today)).toEqual({ top: "15 mai", sub: "sex" });
    expect(shortDateLabel("", today)).toEqual({ top: "—", sub: "" });
    expect(shortDateLabel("xx/99", today)).toEqual({ top: "xx/99", sub: "" });
  });
});

describe("TxRow desktop", () => {
  it("despesa: sinal menos, rótulo acessível e clique seleciona", () => {
    const { onSelect } = row();
    const el = screen.getByRole("button", { name: /^Almoço, despesa de R\$.42,50 em 21\/05$/ });
    expect(el.textContent).toContain(`−R$${nbsp}42,50`);
    expect(el.getAttribute("aria-expanded")).toBe("false");
    expect(el.getAttribute("data-tx-row")).toBe("t1");
    fireEvent.click(el);
    expect(onSelect).toHaveBeenCalledWith(expense);
  });

  it("receita: sinal mais; estorno também é crédito", () => {
    row({ tx: income });
    expect(screen.getByRole("button", { name: /Salário, receita de/ }).textContent).toContain(`+R$${nbsp}5.000,00`);
    cleanup();
    row({ tx: refund });
    expect(screen.getByRole("button", { name: /Estorno, receita de/ }).textContent).toContain("+R$");
  });

  it("moeda estrangeira não é formatada como real", () => {
    row({ tx: { ...expense, val: -100, currency: "EUR" } });
    const el = screen.getByRole("button", { name: /Almoço/ });
    expect(el.textContent).toContain(`−€${nbsp}100,00`);
    expect(el.textContent).not.toContain("R$");
  });

  it("selecionada: aria-expanded e Enter/Espaço abrem; teclas de filho não", () => {
    const { onSelect } = row({ isSelected: true });
    const el = screen.getByRole("button", { name: /Almoço, despesa/ });
    expect(el.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(el, { key: "Enter" });
    fireEvent.keyDown(el, { key: " " });
    fireEvent.keyDown(el, { key: "a" });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("roving tabindex: só a parada do Tab tem 0", () => {
    row({ isRovingStop: true });
    expect(screen.getByRole("button", { name: /Almoço/ }).getAttribute("tabindex")).toBe("0");
    cleanup();
    row();
    expect(screen.getByRole("button", { name: /Almoço/ }).getAttribute("tabindex")).toBe("-1");
  });

  it("data em coluna só com showDate; método e conta na linha de metadados", () => {
    row({ tx: { ...expense, accountLabel: "Itaú" } });
    expect(screen.getByText("21 mai")).toBeTruthy();
    expect(screen.getByText("qui")).toBeTruthy();
    expect(screen.getByText(/Pix · Itaú/)).toBeTruthy();
    cleanup();
    row({ showDate: false });
    expect(screen.queryByText("21 mai")).toBeNull();
  });

  it("parcela, recorrência, âncora e estorno vinculado aparecem", () => {
    row({
      tx: {
        ...expense, method: "Crédito", rec: true,
        parcela: { atual: 2, total: 12, cartao: "Nubank ••1234", valParcela: 100 },
        refundsSummary: { count: 2, totalValue: 30 },
      },
      coveringAnchor: { kind: "opening", ymd: "2026-05-01" },
    });
    expect(screen.getByText("2/12×")).toBeTruthy();
    expect(screen.getByText("↻")).toBeTruthy();
    expect(screen.getByText("↺")).toBeTruthy();
    expect(screen.getByText("Antes da abertura")).toBeTruthy();
    expect(screen.getByText(/Crédito ●● 1234/)).toBeTruthy();
  });

  it("anel 'A pagar' só quando liquidável e não liquidado", () => {
    row({ tx: { ...expense, settleable: true, settled: false } });
    expect(screen.getByText("A pagar")).toBeTruthy();
    cleanup();
    row({ tx: { ...expense, settleable: true, settled: true } });
    expect(screen.queryByText("A pagar")).toBeNull();
  });

  it("ocupada: troca o valor por spinner e marca aria-busy", () => {
    row({ busy: true });
    const el = screen.getByRole("button", { name: /Almoço/ });
    expect(el.getAttribute("aria-busy")).toBe("true");
    expect(el.querySelector(".fincla-spin")).toBeTruthy();
    expect(el.textContent).not.toContain("42,50");
  });

  it("classes de animação: flash, leaving, born", () => {
    row({ flash: true, leaving: true, born: true });
    const cls = screen.getByRole("button", { name: /Almoço/ }).className;
    expect(cls).toContain("fincla-row");
    expect(cls).toContain("fincla-tx-settled");
    expect(cls).toContain("fincla-tx-leaving-cor");
    expect(cls).toContain("fincla-tx-born-cor");
  });

  it("pílula de categoria filtra sem selecionar a linha", () => {
    const onFilterByCategory = vi.fn();
    const { onSelect } = row({ onFilterByCategory });
    fireEvent.click(screen.getByRole("button", { name: "Filtrar por categoria Alimentação" }));
    expect(onFilterByCategory).toHaveBeenCalledTimes(1);
    expect(onFilterByCategory.mock.calls[0][0]).toBe(expense);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("sem handler a categoria é texto; no estreito ela desce para a linha de metadados", () => {
    row();
    expect(screen.queryByRole("button", { name: /Filtrar por categoria/ })).toBeNull();
    expect(screen.getByText("Alimentação")).toBeTruthy();
    cleanup();
    row({ catNaLinhaDeMeta: true, onFilterByCategory: vi.fn() });
    expect(screen.getByRole("button", { name: "Filtrar por categoria Alimentação" })).toBeTruthy();
  });

  it("coluna de tags: 2 visíveis, +N, rótulo alterna adicionar/remover e clique filtra", () => {
    const onFilterByTag = vi.fn();
    const { onSelect } = row({ tagsColPx: 150, onFilterByTag, tagsAtivas: ["mercado"] });
    expect(screen.getByRole("button", { name: "Adicionar a tag trabalho ao filtro" })).toBeTruthy();
    const ativa = screen.getByRole("button", { name: "Remover a tag mercado do filtro" });
    expect(ativa.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("extra")).toBeNull();
    expect(screen.getByText("+1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar a tag trabalho ao filtro" }));
    expect(onFilterByTag.mock.calls[0][0]).toBe("trabalho");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("ações rápidas: pagar/desfazer, editar, duplicar, excluir, sem selecionar a linha", () => {
    const quickActions = { onSettle: vi.fn(), onEdit: vi.fn(), onDuplicate: vi.fn(), onDelete: vi.fn() };
    const tx = { ...expense, settleable: true, settled: false };
    const { onSelect } = row({ tx, quickActions });
    fireEvent.click(screen.getByRole("button", { name: "Marcar Almoço como pago" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar Almoço" }));
    fireEvent.click(screen.getByRole("button", { name: "Duplicar Almoço" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir Almoço" }));
    for (const k of Object.keys(quickActions)) expect(quickActions[k]).toHaveBeenCalledWith(tx);
    expect(onSelect).not.toHaveBeenCalled();
    cleanup();
    row({ tx: { ...tx, settled: true }, quickActions: { ...quickActions, onDuplicate: undefined } });
    expect(screen.getByRole("button", { name: "Desfazer pagamento de Almoço" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Duplicar/ })).toBeNull();
  });

  it("sem quickActions não há botões de ação", () => {
    row();
    expect(screen.queryByRole("button", { name: /^Editar/ })).toBeNull();
  });
});

describe("TxRow mobile", () => {
  it("mostra descrição, data, categoria, método e tags por vírgula (não compacto)", () => {
    row({ isMobile: true, rowHeight: 56 });
    const el = screen.getByRole("button", { name: /Almoço, despesa/ });
    expect(el.textContent).toContain("21 mai");
    expect(el.textContent).toContain("Alimentação");
    expect(el.textContent).toContain("Pix");
    expect(el.textContent).toContain("trabalho, mercado, extra");
    expect(el.textContent).toContain(`−R$${nbsp}42,50`);
  });

  it("densidade compacta esconde a linha de tags", () => {
    row({ isMobile: true, rowHeight: 40 });
    expect(screen.getByRole("button", { name: /Almoço/ }).textContent).not.toContain("trabalho");
  });

  it("anel A pagar e ocupado no mobile", () => {
    row({ isMobile: true, tx: { ...expense, settleable: true, settled: false } });
    expect(screen.getByText("A pagar")).toBeTruthy();
    cleanup();
    row({ isMobile: true, busy: true });
    expect(screen.getByRole("button", { name: /Almoço/ }).querySelector(".fincla-spin")).toBeTruthy();
  });

  it("swipe: ações estacionadas, excluir chama quickActions e fecha", () => {
    const swipe = { isOpen: (id) => id === "t1", close: vi.fn(), handlers: () => ({}) };
    const quickActions = { onSettle: vi.fn(), onDelete: vi.fn() };
    const tx = { ...expense, settleable: true, settled: false };
    row({ isMobile: true, swipe, quickActions, tx });
    fireEvent.click(screen.getByRole("button", { name: "Excluir Almoço" }));
    expect(quickActions.onDelete).toHaveBeenCalledWith(tx);
    fireEvent.click(screen.getByRole("button", { name: "Marcar Almoço como pago" }));
    expect(quickActions.onSettle).toHaveBeenCalledWith(tx);
    expect(swipe.close).toHaveBeenCalledTimes(2);
  });

  it("clique com swipe aberto fecha em vez de selecionar", () => {
    const swipe = { isOpen: () => true, close: vi.fn(), handlers: () => ({}) };
    const { onSelect } = row({ isMobile: true, swipe });
    fireEvent.click(screen.getByRole("button", { name: /Almoço, despesa/ }));
    expect(swipe.close).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
