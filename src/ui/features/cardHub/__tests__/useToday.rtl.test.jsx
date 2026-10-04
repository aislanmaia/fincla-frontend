/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useToday } from "../useToday.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 4, 23, 59, 0));
});
afterEach(() => vi.useRealTimers());

describe("useToday", () => {
  it("vira o dia à meia-noite sem recarregar a página", () => {
    const { result } = renderHook(() => useToday());
    expect(result.current.getDate()).toBe(4);
    act(() => { vi.advanceTimersByTime(90_000); });
    expect(result.current.getDate()).toBe(5);
  });

  it("ao voltar o foco para a aba, atualiza se o dia mudou", () => {
    const { result } = renderHook(() => useToday());
    vi.setSystemTime(new Date(2026, 9, 7, 9, 0, 0));
    act(() => { window.dispatchEvent(new Event("focus")); });
    expect(result.current.getDate()).toBe(7);
  });

  it("mantém a mesma referência enquanto o dia não muda (sem re-render à toa)", () => {
    const { result } = renderHook(() => useToday());
    const first = result.current;
    vi.setSystemTime(new Date(2026, 9, 4, 23, 59, 30));
    act(() => { window.dispatchEvent(new Event("focus")); });
    expect(result.current).toBe(first);
  });
});
