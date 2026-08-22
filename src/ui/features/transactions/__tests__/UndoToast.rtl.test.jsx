// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UndoToast } from "../UndoToast.jsx";

afterEach(cleanup);

const TOAST = { id: "tx-1", label: '"Mercado" marcada como paga', revert: true };

describe("<UndoToast>", () => {
  it("não renderiza nada sem torrada", () => {
    const { container } = render(<UndoToast toast={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("anuncia sem interromper — role status, aria-live polite", () => {
    render(<UndoToast toast={TOAST} />);
    const region = screen.getByRole("status");
    // A ação JÁ aconteceu; um `alert` interromperia o que a pessoa faz agora.
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent('"Mercado" marcada como paga');
  });

  it("Desfazer chama o consumidor", async () => {
    const onUndo = vi.fn();
    render(<UndoToast toast={TOAST} onUndo={onUndo} />);
    await userEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("o × fecha sem desfazer", async () => {
    const onUndo = vi.fn();
    const onDismiss = vi.fn();
    render(<UndoToast toast={TOAST} onUndo={onUndo} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole("button", { name: "Fechar aviso" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onUndo).not.toHaveBeenCalled();
  });

  it("some sozinha depois do TTL", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<UndoToast toast={TOAST} onDismiss={onDismiss} ttlMs={3000} />);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(3000));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("um `onDismiss` novo a cada render NÃO reinicia o relógio", () => {
    // A página recria o callback a cada render; se ele fosse dependência do
    // efeito, o timer reiniciaria para sempre e a torrada nunca sumiria.
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { rerender } = render(
      <UndoToast toast={TOAST} onDismiss={() => onDismiss()} ttlMs={3000} />,
    );
    act(() => vi.advanceTimersByTime(2000));
    rerender(<UndoToast toast={TOAST} onDismiss={() => onDismiss()} ttlMs={3000} />);
    act(() => vi.advanceTimersByTime(1000));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("uma torrada NOVA reinicia a contagem", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { rerender } = render(
      <UndoToast toast={TOAST} onDismiss={onDismiss} ttlMs={3000} />,
    );
    act(() => vi.advanceTimersByTime(2500));
    rerender(
      <UndoToast
        toast={{ id: "tx-2", label: "outra", revert: false }}
        onDismiss={onDismiss}
        ttlMs={3000}
      />,
    );
    act(() => vi.advanceTimersByTime(2500));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(500));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
