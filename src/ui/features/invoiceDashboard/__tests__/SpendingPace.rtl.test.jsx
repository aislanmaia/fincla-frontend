// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SpendingPace } from "../SpendingPace.jsx";

afterEach(() => cleanup());

const money = (amount) => ({ amount, currency: "BRL" });
const pace = {
  cycle_start: "2026-09-26",
  cycle_end: "2026-10-25",
  current: [
    { day: 1, date: "2026-09-26", cumulative: money("0.00") },
    { day: 2, date: "2026-09-27", cumulative: money("150.00") },
  ],
  previous: null,
};

describe("SpendingPace", () => {
  /* O aviso para leitor de tela é `position: absolute` sem `top`: fica onde estaria no
     fluxo. Sem um ancestral posicionado DENTRO do componente, o bloco de contenção é a
     janela — e a rolagem da tela não o corta, então ele esticava o documento (a janela
     rolava, ferindo "o shell não rola"). */
  it("keeps the screen-reader status inside a positioned ancestor of the card", () => {
    render(<SpendingPace pace={pace} currency="BRL" isMobile />);
    const status = screen.getByRole("status");
    let el = status.parentElement;
    let positioned = null;
    while (el && el !== document.body) {
      if (el.style.position === "relative") { positioned = el; break; }
      el = el.parentElement;
    }
    expect(positioned).not.toBeNull();
    // O contêiner posicionado é o do gráfico, não o cartão inteiro: o título fica fora dele.
    expect(positioned.contains(screen.getByRole("group", { name: "Escala de valores" }))).toBe(true);
    expect(positioned.contains(screen.getByRole("heading", { name: "Velocidade de gasto" }))).toBe(false);
  });
});
