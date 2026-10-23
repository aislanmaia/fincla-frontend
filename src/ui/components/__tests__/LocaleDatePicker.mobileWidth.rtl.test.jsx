// @vitest-environment jsdom
/**
 * O calendário do celular abria com a largura do botão que o aciona. O botão "Paga em" da fatura tem ~156px,
 * então a grade de 7 colunas nascia com 156px: os dias vazavam para fora do balão e a semana colapsava em uma linha.
 */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { LocaleDatePicker } from "../LocaleDatePicker.jsx";

const rect = (width) => ({ width, height: 44, top: 600, bottom: 644, left: 40, right: 40 + width, x: 40, y: 600, toJSON: () => ({}) });

function openAt({ triggerWidth, viewport, variant = "mobile" }) {
  window.innerWidth = viewport;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(rect(triggerWidth));
  render(<LocaleDatePicker value="2026-10-22" onChange={() => {}} variant={variant} ariaLabel="Data do pagamento" />);
  fireEvent.click(screen.getByRole("button", { name: /Data do pagamento/ }));
  return document.querySelector("[data-fincla-locale-calendar-popover]");
}

beforeEach(() => { window.innerWidth = 1024; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("LocaleDatePicker no celular", () => {
  it.each([[390], [360]])("não encolhe com um botão estreito (viewport %ipx)", (viewport) => {
    const popover = openAt({ triggerWidth: 156, viewport });
    expect(parseFloat(popover.style.width)).toBeGreaterThanOrEqual(280);
    expect(parseFloat(popover.style.width)).toBeLessThanOrEqual(viewport - 24);
  });

  it("cabe em telas muito estreitas, com folga de 12px de cada lado", () => {
    const popover = openAt({ triggerWidth: 156, viewport: 320 });
    expect(parseFloat(popover.style.width)).toBeLessThanOrEqual(296);
    expect(parseFloat(popover.style.left)).toBeGreaterThanOrEqual(12);
  });

  it("não passa de 340px com um botão largo", () => {
    const popover = openAt({ triggerWidth: 600, viewport: 800 });
    expect(parseFloat(popover.style.width)).toBeLessThanOrEqual(340);
  });

  it("o desktop continua com 300px", () => {
    const popover = openAt({ triggerWidth: 156, viewport: 1280, variant: "desktop" });
    expect(parseFloat(popover.style.width)).toBe(300);
  });

  it("os dias e as setas têm alvo de 36px no celular e 28px no desktop", () => {
    openAt({ triggerWidth: 156, viewport: 390 });
    const day = screen.getByText("15").closest("[role=button]").firstElementChild;
    expect(day.style.width).toBe("36px");
    expect(screen.getByRole("button", { name: /Próximo mês|Next month/i }).style.width).toBe("36px");
    cleanup();
    openAt({ triggerWidth: 156, viewport: 1280, variant: "desktop" });
    expect(screen.getByText("15").closest("[role=button]").firstElementChild.style.width).toBe("28px");
  });

  it("o dia encolhe em vez de vazar quando a tela é muito estreita", () => {
    openAt({ triggerWidth: 156, viewport: 280 });
    const day = screen.getByText("15").closest("[role=button]").firstElementChild;
    // balão de 256px → (256 − 30) / 7 = 32px por coluna
    expect(parseFloat(day.style.width)).toBeLessThanOrEqual(32);
  });

  it("abre acima do botão com a altura real do balão quando não cabe embaixo", () => {
    window.innerHeight = 800;
    const popover = openAt({ triggerWidth: 156, viewport: 390 });
    // botão em top=600/bottom=644: embaixo não cabe (644 + 6 + 392 > 792), então sobe: 600 − 392 − 6
    expect(parseFloat(popover.style.top)).toBe(202);
  });
});
