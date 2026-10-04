/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { InvoiceCarousel, dotWindow } from "../InvoiceCarousel.jsx";

const inv = (month) => ({
  key: `2026-${String(month).padStart(2, "0")}`, year: 2026, month, status: "paid", total: 100, itemsCount: 1,
  dueDate: null, paidDate: null, limitUsagePercent: null, topCategory: null, isEmpty: false, vsPercent: null, prevKey: null,
});
const INVOICES = [inv(7), inv(8), inv(9), inv(10)];

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => { cleanup(); vi.useRealTimers(); });

/** jsdom não tem layout: cada card ocupa 300px, o scroller tem 390 de largura. */
function mockLayout(scroller) {
  scroller.scrollTo = vi.fn(({ left }) => { scroller.scrollLeft = left; });
  Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 390 });
  Array.from(scroller.children).forEach((child, i) => {
    Object.defineProperty(child, "offsetLeft", { configurable: true, value: i * 312 });
    Object.defineProperty(child, "clientWidth", { configurable: true, value: 300 });
  });
}

function setup(selectedKey = "2026-10") {
  const onSelect = vi.fn();
  const utils = render(
    <InvoiceCarousel invoices={INVOICES} cardId={1} currency="BRL" selectedKey={selectedKey} onSelect={onSelect}
      onNavigate={vi.fn()} isMobile now={new Date(2026, 9, 4)} />,
  );
  const scroller = screen.getByTestId("invoice-carousel");
  mockLayout(scroller);
  return { onSelect, scroller, ...utils };
}

const scrollTo = (scroller, left) => { scroller.scrollLeft = left; fireEvent.scroll(scroller); };

describe("InvoiceCarousel (mobile) — seleção por rolagem", () => {
  it("ao soltar o dedo, seleciona o card mais próximo do centro", () => {
    const { onSelect, scroller } = setup();
    act(() => { vi.advanceTimersByTime(1000); }); // termina a rolagem programática inicial
    // centro do card 1 (i=1): 312 + 150 = 462; scrollLeft = 462 - 195 = 267
    scrollTo(scroller, 267);
    act(() => { vi.advanceTimersByTime(200); });
    expect(onSelect).toHaveBeenCalledWith("2026-08");
  });

  it("enquanto a rolagem programática (toque num card) está em andamento, uma pausa não reseleciona o card antigo", () => {
    const { onSelect, scroller, rerender } = setup("2026-10");
    act(() => { vi.advanceTimersByTime(1000); });
    onSelect.mockClear();

    // toque no card 2026-07: o pai troca a seleção e o carrossel inicia scrollTo suave
    rerender(<InvoiceCarousel invoices={INVOICES} cardId={1} currency="BRL" selectedKey="2026-07" onSelect={onSelect}
      onNavigate={vi.fn()} isMobile now={new Date(2026, 9, 4)} />);
    // a animação passa por um ponto mais perto do card antigo e faz uma pausa > 140 ms
    scrollTo(scroller, 700);
    act(() => { vi.advanceTimersByTime(300); });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("depois de scrollend, a rolagem do usuário volta a selecionar", () => {
    const { onSelect, scroller } = setup("2026-10");
    act(() => { scroller.dispatchEvent(new Event("scrollend")); });
    scrollTo(scroller, 267);
    act(() => { vi.advanceTimersByTime(200); });
    expect(onSelect).toHaveBeenCalledWith("2026-08");
  });

  it("o toque do usuário interrompe a rolagem programática", async () => {
    const { onSelect, scroller } = setup("2026-10");
    fireEvent.touchStart(scroller);
    scrollTo(scroller, 267);
    act(() => { vi.advanceTimersByTime(200); });
    expect(onSelect).toHaveBeenCalledWith("2026-08");
  });

  it("clicar num card chama onSelect", async () => {
    const { onSelect } = setup();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByTestId("invoice-card-2026-08"));
    expect(onSelect).toHaveBeenCalledWith("2026-08");
  });
});

describe("dotWindow", () => {
  it("janela de 7 pontos acompanha a seleção", () => {
    expect(dotWindow(29, 0)).toEqual({ start: 0, end: 7 });
    expect(dotWindow(29, 14)).toEqual({ start: 11, end: 18 });
    expect(dotWindow(29, 28)).toEqual({ start: 22, end: 29 });
    expect(dotWindow(4, 2)).toEqual({ start: 0, end: 4 });
  });
});
