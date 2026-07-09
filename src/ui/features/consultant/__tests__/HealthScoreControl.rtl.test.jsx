// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HealthScoreControl, fmtScoreAge, fmtScoreDate, isStaleScore, parseLocalDate } from "../HealthScoreControl";

/** jsdom não implementa matchMedia; o controle usa para detectar ponteiro fino. */
function mockFinePointer(matches = true) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe("datas do snapshot", () => {
  it("lê data sem hora como LOCAL, não UTC", () => {
    // `new Date("2026-05-30")` é UTC meia-noite; em BRT (UTC-3) isso voltava um dia
    // e a tela mostrava 29/05. Mesma classe do bug de timezone do backend.
    const d = parseLocalDate("2026-05-30");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4); // maio
    expect(d.getDate()).toBe(30);
    expect(fmtScoreDate("2026-05-30")).toBe("30/05/2026");
  });

  it("descreve a idade do score em linguagem humana", () => {
    const now = new Date(2026, 6, 9);
    expect(fmtScoreAge("2026-07-09", now)).toBe("hoje");
    expect(fmtScoreAge("2026-07-08", now)).toBe("ontem");
    expect(fmtScoreAge("2026-07-04", now)).toBe("há 5 dias");
    expect(fmtScoreAge("2026-05-30", now)).toBe("há 1 mês");
  });

  it("marca como velho um snapshot de mais de 30 dias", () => {
    const now = new Date(2026, 6, 9);
    expect(isStaleScore("2026-07-01", now)).toBe(false);
    expect(isStaleScore("2026-05-30", now)).toBe(true);
    expect(isStaleScore(null, now)).toBe(false);
  });
});

describe("HealthScoreControl", () => {
  beforeEach(() => mockFinePointer(true));
  afterEach(() => {
    // `globals: false` desliga o auto-cleanup do RTL; sem isto os portais de um
    // teste sobrevivem para o próximo e `getByRole("dialog")` acha o antigo.
    cleanup();
    vi.restoreAllMocks();
  });

  it("anuncia 'score não calculado' quando health é null", () => {
    render(<HealthScoreControl health={null} computedAt={null} />);
    expect(screen.getByRole("button", { name: /Score não calculado/i })).toBeInTheDocument();
  });

  it("clique abre o popover e mostra a data do snapshot", async () => {
    const user = userEvent.setup();
    render(<HealthScoreControl health={72} computedAt="2026-07-09" />);

    await user.click(screen.getByRole("button", { name: /Saúde 72 de 100/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Calculado em 09\/07\/2026/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Recalcular agora/i })).toBeInTheDocument();
  });

  it("sem score, o botão convida a calcular pela primeira vez", async () => {
    const user = userEvent.setup();
    render(<HealthScoreControl health={null} computedAt={null} />);

    await user.click(screen.getByRole("button", { name: /Score não calculado/i }));

    expect(screen.getByText("Nunca calculado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Calcular agora/i })).toBeInTheDocument();
  });

  it("avisa quando o score é de um mês anterior", async () => {
    const user = userEvent.setup();
    const old = new Date();
    old.setDate(old.getDate() - 45);
    render(<HealthScoreControl health={71} computedAt={old.toISOString()} />);

    await user.click(screen.getByRole("button", { name: /Saúde 71 de 100/i }));

    expect(screen.getByText(/pode não refletir a situação atual/i)).toBeInTheDocument();
  });

  it("hover abre o popover; sair fecha", async () => {
    render(<HealthScoreControl health={88} computedAt="2026-07-09" />);
    const anchor = screen.getByRole("button", { name: /Saúde 88 de 100/i }).parentElement;

    fireEvent.mouseEnter(anchor);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.mouseLeave(anchor);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("clique FIXA o popover: sair com o mouse não fecha", async () => {
    const user = userEvent.setup();
    render(<HealthScoreControl health={88} computedAt="2026-07-09" />);
    const button = screen.getByRole("button", { name: /Saúde 88 de 100/i });

    await user.click(button);
    fireEvent.mouseLeave(button.parentElement);

    // Sem o pin, o mouse morreria no caminho até "Recalcular agora".
    await new Promise((r) => setTimeout(r, 320));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Escape fecha o popover fixado", async () => {
    const user = userEvent.setup();
    render(<HealthScoreControl health={88} computedAt="2026-07-09" />);

    await user.click(screen.getByRole("button", { name: /Saúde 88 de 100/i }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("chama onRecompute e mostra 'Calculando…' enquanto roda", async () => {
    const user = userEvent.setup();
    let resolve;
    const onRecompute = vi.fn(() => new Promise((r) => { resolve = r; }));
    render(<HealthScoreControl health={null} computedAt={null} onRecompute={onRecompute} />);

    await user.click(screen.getByRole("button", { name: /Score não calculado/i }));
    await user.click(screen.getByRole("button", { name: /Calcular agora/i }));

    expect(onRecompute).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Calculando…/i })).toBeDisabled();

    resolve();
    await waitFor(() => expect(screen.getByRole("button", { name: /Calcular agora/i })).toBeEnabled());
  });

  it("uma falha no recálculo é mostrada, não engolida", async () => {
    const user = userEvent.setup();
    const onRecompute = vi.fn(() => Promise.reject(new Error("500")));
    render(<HealthScoreControl health={null} computedAt={null} onRecompute={onRecompute} />);

    await user.click(screen.getByRole("button", { name: /Score não calculado/i }));
    await user.click(screen.getByRole("button", { name: /Calcular agora/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/não foi possível recalcular/i));
  });

  it("em ponteiro grosso (touch) o hover não abre nada", async () => {
    mockFinePointer(false);
    render(<HealthScoreControl health={88} computedAt="2026-07-09" />);
    const anchor = screen.getByRole("button", { name: /Saúde 88 de 100/i }).parentElement;

    fireEvent.mouseEnter(anchor);
    await new Promise((r) => setTimeout(r, 200));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
