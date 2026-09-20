// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";

import { SignupChoicePage } from "./SignupChoicePage.jsx";
import { ConsultantCheckoutPage } from "./ConsultantCheckoutPage.jsx";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("sends each new visitor to the fitting acquisition flow", () => {
  render(<SignupChoicePage />);
  expect(screen.getByRole("link", { name: /continuar como pessoa/i })).toHaveAttribute("href", "/checkout?persona=personal&billing_cycle=yearly");
  expect(screen.getByRole("link", { name: /plano para consultores/i })).toHaveAttribute("href", "/consultant-checkout");
});

it("quotes the consultant selection before allowing the user to continue", async () => {
  const fetch = vi.fn(async (_url, options) => {
    const selection = JSON.parse(options.body);
    return { ok: true, json: async () => ({ catalog_version: "2026-09-15", selection, total_cents: 24900, capacity: selection.seats, currency: "BRL" }) };
  });
  vi.stubGlobal("fetch", fetch);
  render(<ConsultantCheckoutPage session={{ isAuthenticated: false, signIn: vi.fn() }} />);
  expect(await screen.findByText(/10 vagas disponíveis/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /pacote de vagas/i }));
  fireEvent.click(screen.getByRole("radio", { name: "50 vagas" }));
  await waitFor(() => expect(JSON.parse(fetch.mock.calls.at(-1)[1].body)).toMatchObject({ persona: "consultant", mode: "package", seats: 50, package_size: 50 }));
  fireEvent.click(screen.getByRole("button", { name: /continuar para seus dados/i }));
  expect(await screen.findByRole("heading", { name: /seu acesso profissional/i })).toBeTruthy();
});

it("restores the consultant offer chosen by an account returning to finish payment", async () => {
  const fetch = vi.fn(async (_url, options) => {
    if (!options?.body) return { ok: true, json: async () => null };
    const selection = JSON.parse(options.body);
    return { ok: true, json: async () => ({ catalog_version: "2026-09-15", selection, total_cents: 970000, capacity: 50, currency: "BRL" }) };
  });
  vi.stubGlobal("fetch", fetch);
  render(<ConsultantCheckoutPage session={{ isAuthenticated: true, user: { is_consultant: true, subscription: { checkout_selection: { persona: "consultant", mode: "package", package_size: 50, seats: 52, billing_cycle: "yearly" } } }, signIn: vi.fn() }} />);
  await waitFor(() => expect(JSON.parse(fetch.mock.calls.at(-1)[1].body)).toMatchObject({ persona: "consultant", mode: "package", package_size: 50, seats: 52, billing_cycle: "yearly" }));
  expect(await screen.findByText(/50 vagas disponíveis/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /continuar para seus dados/i }));
  fireEvent.click(await screen.findByRole("button", { name: /continuar para o pagamento/i }));
  expect(await screen.findByRole("heading", { name: /pague com cartão/i })).toBeTruthy();
});
