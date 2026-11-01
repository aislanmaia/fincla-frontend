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

it("hands the consultant checkout's reset offer to the sign-in step after a refused registration", async () => {
  const fetch = vi.fn(async (url, options) => {
    if (url.includes("/checkout/register")) return { ok: false, status: 409, json: async () => ({ detail: { code: "checkout_account_exists", message: "Este email já tem uma conta no Fincla. Entre com sua senha para continuar.", password_reset_available: true } }) };
    const selection = JSON.parse(options.body);
    return { ok: true, json: async () => ({ catalog_version: "2026-09-15", selection, total_cents: 24900, capacity: selection.seats, currency: "BRL" }) };
  });
  vi.stubGlobal("fetch", fetch);
  const requestPasswordReset = vi.fn().mockResolvedValue(undefined);
  render(<ConsultantCheckoutPage session={{ isAuthenticated: false, signIn: vi.fn(), requestPasswordReset }} />);
  fireEvent.click(await screen.findByRole("button", { name: /continuar para seus dados/i }));
  fireEvent.change(await screen.findByLabelText("Nome"), { target: { value: "Ana" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@example.com" } });
  fireEvent.change(screen.getByLabelText(/CPF\/CNPJ/), { target: { value: "24971563792" } });
  fireEvent.change(screen.getByLabelText(/Celular com DDD/), { target: { value: "4738010919" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "Another123!" } });
  fireEvent.change(screen.getByLabelText("Confirme sua senha"), { target: { value: "Another123!" } });
  fireEvent.click(screen.getByRole("button", { name: "Continuar para o pagamento" }));
  await screen.findByRole("heading", { name: /pague com cartão/i });
  fireEvent.change(screen.getByLabelText("Nome do titular"), { target: { value: "Ana Souza" } });
  fireEvent.change(screen.getByLabelText("Número do cartão"), { target: { value: "4242 4242 4242 4242" } });
  fireEvent.change(screen.getByLabelText("Validade (MM/AA)"), { target: { value: "12/30" } });
  fireEvent.change(screen.getByLabelText("CVV"), { target: { value: "123" } });
  fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01001-000" } });
  fireEvent.change(screen.getByLabelText("Número do endereço"), { target: { value: "10" } });
  fireEvent.click(screen.getByLabelText(/Termos de contratação/));
  fireEvent.click(screen.getByLabelText(/Autorizo a cobrança/));
  fireEvent.submit(screen.getByLabelText("Número do cartão").closest("form"));
  fireEvent.click(await screen.findByRole("button", { name: "Entrar com este email" }));

  fireEvent.click(await screen.findByRole("button", { name: "Esqueci minha senha" }));
  await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledWith("ana@example.com"));
});
