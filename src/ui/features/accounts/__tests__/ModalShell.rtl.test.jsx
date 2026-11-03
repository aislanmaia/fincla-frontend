// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ModalShell } from "../ModalShell.jsx";

// jsdom does no layout; the real check is a 390px browser measurement (card 358px wide, inside the screen).
// This pins the constraint that makes it fit: a column capped at the card width that may shrink to 0,
// instead of an `auto` column that grew with long unwrapped content past a phone screen.
it("never lets the card grow past the screen: the column is capped and may shrink", () => {
  render(<ModalShell titleSans="Ajustar" titleSerif="saldo" onClose={() => {}} footer={null}>conteúdo</ModalShell>);
  const card = screen.getByRole("dialog");
  expect(card.parentElement.style.gridTemplateColumns).toBe("minmax(0, 460px)");
  expect(card.style.width).toBe("100%");
});
