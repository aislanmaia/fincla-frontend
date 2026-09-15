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

it("keeps the yearly offer through account creation and never uses legacy signup", async () => {
  const { fireEvent } = await import("@testing-library/react");
  const signIn = vi.fn().mockResolvedValue({});
  const fetch = vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({selection:{persona:"personal",billing_cycle:"yearly"},total_cents:29900,capacity:null})})
    .mockResolvedValueOnce({ok:true,json:async()=>({status:"pending_payment"})});
  vi.stubGlobal("fetch", fetch);
  render(<CheckoutPage search="?persona=personal&billing_cycle=yearly" session={{isAuthenticated:false,signIn}} />);
  await screen.findByText(/299,00/);
  fireEvent.change(screen.getByLabelText("Nome"), {target:{value:"Maria"}});
  fireEvent.change(screen.getByLabelText("Email"), {target:{value:"maria@example.com"}});
  fireEvent.change(screen.getByLabelText("Senha"), {target:{value:"Password123!"}});
  fireEvent.click(screen.getByRole("button", {name:"Criar conta e continuar"}));
  await waitFor(()=>expect(signIn).toHaveBeenCalledWith("maria@example.com", "Password123!"));
  expect(fetch.mock.calls[1][0]).toContain("/checkout/register");
  expect(JSON.parse(fetch.mock.calls[1][1].body).billing_cycle).toBe("yearly");
});

it("shows resumable pending payment without a second pay button", async () => {
  const fetch = vi.fn().mockImplementation(async (url) => ({ok:true,json:async()=>url.includes('checkout-quote')
    ? {selection:{persona:"personal",billing_cycle:"monthly"},total_cents:2990,capacity:null}
    : {id:'attempt',status:'pending_payment',quote:{selection:{persona:"personal",billing_cycle:"monthly"},total_cents:2990,capacity:null}}}));
  vi.stubGlobal("fetch", fetch);
  render(<CheckoutPage search="?persona=personal&billing_cycle=monthly" session={{isAuthenticated:true,user:{email:'maria@example.com',subscription:{status:'pending_payment'}},signOut:vi.fn()}} />);
  expect(await screen.findByText(/Aguardando confirmação do pagamento/)).toBeTruthy();
  expect(screen.queryByLabelText("Número do cartão")).toBeNull();
  expect(screen.getByRole("button",{name:"Verificar pagamento"})).toBeTruthy();
});
