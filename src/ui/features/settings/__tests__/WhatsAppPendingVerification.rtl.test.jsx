// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WhatsAppPendingVerification } from "../WhatsAppPendingVerification.jsx";

afterEach(() => cleanup());

const inTenMinutes = () => new Date(Date.now() + 10 * 60 * 1000).toISOString();

function renderCard(overrides = {}) {
  const props = {
    code: "123456",
    phoneNumber: "+5511999999999",
    expiresAt: inTenMinutes(),
    waMeUrl: "https://wa.me/15551502382?text=123456",
    onRegenerate: vi.fn(),
    ...overrides,
  };
  render(<WhatsAppPendingVerification {...props} />);
  return props;
}

describe("WhatsAppPendingVerification", () => {
  it("shows the code, a live countdown and the deep link to the bot", () => {
    renderCard();

    // Visible code, and an aria-label that reads the digits (not a bare label
    // that would hide them from a screen reader).
    expect(screen.getByText("123456")).toBeInTheDocument();
    expect(screen.getByLabelText(/Código de verificação: 1 2 3 4 5 6/)).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent(/Expira em \d+:\d{2}/);

    const openLink = screen.getByRole("link", { name: /Abrir no WhatsApp/ });
    expect(openLink).toHaveAttribute("href", "https://wa.me/15551502382?text=123456");
  });

  it("copies the code to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Copiar código" }));

    expect(writeText).toHaveBeenCalledWith("123456");
    expect(await screen.findByText("Copiado")).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it("regenerates on request", () => {
    const onRegenerate = vi.fn();
    renderCard({ onRegenerate });

    fireEvent.click(screen.getByRole("button", { name: /Gerar novo código/ }));

    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("marks an expired code, hides the deep link and disables copy", () => {
    renderCard({ expiresAt: new Date(Date.now() - 1000).toISOString() });

    expect(screen.getByRole("timer")).toHaveTextContent("Código expirado");
    expect(screen.queryByRole("link", { name: /Abrir no WhatsApp/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar código" })).toBeDisabled();
    // Regenerate stays available so the user can recover.
    expect(screen.getByRole("button", { name: /Gerar novo código/ })).toBeInTheDocument();
  });
});
