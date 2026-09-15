// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { CheckoutPage } from "./CheckoutPage.jsx";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("preserves the consultant selection and displays the server's annual quote", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    selection: { persona: "consultant", billing_cycle: "yearly", mode: "package", package_size: 25 },
    total_cents: 517400, capacity: 26, currency: "BRL",
  }) });
  vi.stubGlobal("fetch", fetch);
  render(<CheckoutPage search="?persona=consultant&billing_cycle=yearly&mode=package&seats=26&package_size=25&total_cents=1" />);
  expect(await screen.findByText("Fincla Consultor")).toBeTruthy();
  expect(screen.getByText(/5.174,00/)).toBeTruthy();
  expect(screen.getByText(/26 vagas contratadas/)).toBeTruthy();
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({persona:"consultant",billing_cycle:"yearly",mode:"package",seats:26,package_size:25});
});

it("discards an obsolete response when the selection changes", async () => {
  let firstResponse;
  vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(() => new Promise((resolve) => { firstResponse = resolve; }))
    .mockResolvedValue({ok: true, json: async () => ({selection:{persona:"personal",billing_cycle:"yearly"},total_cents:29900,capacity:null})}));
  const view = render(<CheckoutPage search="?persona=personal&billing_cycle=monthly" />);
  view.rerender(<CheckoutPage search="?persona=personal&billing_cycle=yearly" />);
  expect(await screen.findByText(/299,00/)).toBeTruthy();
  firstResponse({ok:true,json:async () => ({selection:{persona:"personal",billing_cycle:"monthly"},total_cents:2990,capacity:null})});
  await waitFor(() => expect(screen.queryByText(/29,90/)).toBeNull());
});

it("shows an actionable error without offering payment for an invalid selection", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ok:false,status:422}));
  render(<CheckoutPage search="?persona=invalid" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("seleção de plano é inválida");
  expect(screen.queryByRole("button", {name:/pagar/i})).toBeNull();
});
