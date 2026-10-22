/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HistoryButton } from "../TransactionsListHeader.jsx";

afterEach(cleanup);

describe("HistoryButton · alvo de toque", () => {
  it("desfazer e refazer têm ao menos 24x24 px (WCAG 2.2, 2.5.8)", () => {
    render(<><HistoryButton dir="undo" enabled onClick={() => {}} label="Desfazer: remover Moradia" /><HistoryButton dir="redo" enabled onClick={() => {}} label="Refazer: aplicar Moradia" /></>);
    for (const name of ["Desfazer: remover Moradia", "Refazer: aplicar Moradia"]) {
      const button = screen.getByRole("button", { name });
      expect(parseInt(button.style.width, 10)).toBeGreaterThanOrEqual(24);
      expect(parseInt(button.style.height, 10)).toBeGreaterThanOrEqual(24);
    }
  });
});
