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


it("registers a separate consultant profile while preserving the quoted package and extras", async () => {
  const { fireEvent } = await import("@testing-library/react");
  const signIn = vi.fn().mockResolvedValue({});
  const quote = {selection:{persona:"consultant",billing_cycle:"yearly",mode:"package",seats:26,package_size:25},total_cents:517400,capacity:26};
  const fetch = vi.fn().mockResolvedValueOnce({ok:true,json:async()=>quote})
    .mockResolvedValueOnce({ok:true,json:async()=>({persona:"consultant",status:"pending_payment"})});
  vi.stubGlobal("fetch", fetch);
  render(<CheckoutPage search="?persona=consultant&billing_cycle=yearly&mode=package&seats=26&package_size=25" session={{isAuthenticated:false,signIn}} />);
  await screen.findByText(/26 vagas contratadas/);
  fireEvent.change(screen.getByLabelText("Nome"), {target:{value:"Maria"}});
  fireEvent.change(screen.getByLabelText("Email"), {target:{value:"consultora@example.com"}});
  fireEvent.change(screen.getByLabelText("Senha"), {target:{value:"Password123!"}});
  fireEvent.click(screen.getByRole("button", {name:"Criar conta e continuar"}));
  await waitFor(()=>expect(signIn).toHaveBeenCalledWith("consultora@example.com", "Password123!"));
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({persona:"consultant",billing_cycle:"yearly"});
  expect(screen.getByText(/outro email/i)).toBeTruthy();
});

it("recovers the saved consultant offer without URL parameters or a financial attempt", async () => {
  const selection = {persona:"consultant",billing_cycle:"yearly",mode:"package",seats:26,package_size:25};
  const quote = {selection,total_cents:517400,capacity:26};
  vi.stubGlobal("fetch", vi.fn(async (url, options)=>({ok:true,json:async()=>{
    if (!url.includes("checkout-quote")) return null;
    expect(JSON.parse(options.body)).toEqual(selection);
    return quote;
  }})));
  render(<CheckoutPage search="" session={{isAuthenticated:true,user:{is_consultant:true,email:"consultora@example.com",subscription:{status:"pending_payment",checkout_selection:selection}},signOut:vi.fn()}} />);
  expect(await screen.findByRole("heading",{name:"Pague com cartão"})).toBeTruthy();
  expect(screen.getByText(/26 vagas contratadas/)).toBeTruthy();
  expect(screen.getByText(/5.174,00/)).toBeTruthy();
});

it("prevents a personal account from paying for a consultant offer", async () => {
  const quote = {selection:{persona:"consultant",billing_cycle:"monthly",mode:"progressive",seats:25},total_cents:54750,capacity:25};
  vi.stubGlobal("fetch", vi.fn(async url=>({ok:true,json:async()=>url.includes('checkout-quote') ? quote : null})));
  render(<CheckoutPage search="?persona=consultant&billing_cycle=monthly&mode=progressive&seats=25" session={{isAuthenticated:true,user:{is_consultant:false,email:"pessoal@example.com",subscription:{status:"active"}},signOut:vi.fn()}} />);
  expect(await screen.findByText(/Esta conta é do Fincla Pessoal/)).toBeTruthy();
  expect(screen.queryByLabelText("Número do cartão")).toBeNull();
  expect(screen.queryByRole("button",{name:"Continuar para o Fincla"})).toBeNull();
});

it("offers renewal verification and billing for a historical active attempt without access", async () => {
  const quote = {selection:{persona:"personal",billing_cycle:"monthly"},total_cents:2990,capacity:null};
  vi.stubGlobal("fetch", vi.fn(async url=>({ok:true,json:async()=>url.includes('checkout-quote') ? quote : {id:"old-attempt",status:"active",has_access:false,quote}})));
  render(<CheckoutPage search="?persona=personal&billing_cycle=monthly" session={{isAuthenticated:true,user:{email:"pessoal@example.com",subscription:{status:"past_due",is_entitled:false}},signOut:vi.fn()}} />);
  expect(await screen.findByRole("heading",{name:"Verifique a renovação da sua assinatura"})).toBeTruthy();
  expect(screen.getByRole("button",{name:"Consultar faturas"})).toBeTruthy();
  expect(screen.getByRole("button",{name:"Cancelar assinatura"})).toBeTruthy();
  expect(screen.queryByLabelText("Número do cartão")).toBeNull();
});

it("requires a refreshed offer and new consent when the server rejects an outdated catalog", async () => {
  const { fireEvent } = await import("@testing-library/react");
  const firstQuote = {catalog_version:"old",selection:{persona:"personal",billing_cycle:"monthly"},total_cents:2990,capacity:null};
  let refresh = false;
  let payments = 0;
  vi.stubGlobal("fetch", vi.fn(async (url, options) => {
    if (url.endsWith('/checkout/pay')) {
      payments++;
      expect(JSON.parse(options.body).catalog_version).toBe('old');
      return {ok:false,status:400,json:async()=>({detail:{code:'checkout_offer_changed',message:'A oferta mudou. Atualize o resumo e confirme novamente antes de pagar.'}})};
    }
    return {ok:true,json:async()=>url.includes('checkout-quote') ? {...firstQuote,...(refresh ? {catalog_version:'new',total_cents:3090} : {})} : null};
  }));
  render(<CheckoutPage search="?persona=personal&billing_cycle=monthly" session={{isAuthenticated:true,user:{email:"pessoal@example.com",subscription:{status:"pending_payment"}},signOut:vi.fn()}} />);
  await screen.findByRole("heading",{name:"Pague com cartão"});
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.submit(screen.getByRole('button',{name:'Confirmar pagamento'}).closest('form'));
  const update = await screen.findByRole('button',{name:'Atualizar oferta'});
  expect(payments).toBe(1);
  refresh = true;
  fireEvent.click(update);
  await screen.findByText(/30,90/);
  expect(await screen.findByRole('checkbox')).not.toBeChecked();
  expect(screen.getByLabelText('Número do cartão')).toHaveValue('');
  expect(payments).toBe(1);
});
