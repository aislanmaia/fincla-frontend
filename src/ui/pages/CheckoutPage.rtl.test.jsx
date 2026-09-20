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

it("lets a visitor choose annual billing and waits for the server quote before continuing", async () => {
  const { fireEvent } = await import("@testing-library/react");
  const fetch = vi.fn(async (_url, options) => {
    const selection = JSON.parse(options.body);
    return { ok: true, json: async () => ({ selection, total_cents: selection.billing_cycle === "yearly" ? 29900 : 2990, capacity: null }) };
  });
  vi.stubGlobal("fetch", fetch);
  render(<CheckoutPage search="?persona=personal&billing_cycle=monthly" session={{ isAuthenticated: false, signIn: vi.fn() }} />);
  fireEvent.click(await screen.findByRole("radio", { name: /Anual/ }));
  expect(await screen.findByText(/299,00/)).toBeTruthy();
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ persona: "personal", billing_cycle: "yearly" });
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  expect(await screen.findByRole("button", { name: "Criar conta e continuar" })).toBeDisabled();
});

it("keeps the selected checkout visible while an annual quote is loading", async () => {
  const { fireEvent } = await import("@testing-library/react");
  let resolveAnnual;
  let annualRequests = 0;
  const fetch = vi.fn(async (_url, options) => {
    const selection = JSON.parse(options.body);
    if (selection.billing_cycle === "monthly") return { ok: true, json: async () => ({ selection, total_cents: 2990, capacity: null }) };
    annualRequests += 1;
    if (annualRequests === 1) return { ok: true, json: async () => ({ selection, total_cents: 29900, capacity: null }) };
    return new Promise((resolve) => { resolveAnnual = resolve; });
  });
  vi.stubGlobal("fetch", fetch);
  render(<CheckoutPage search="?persona=personal&billing_cycle=monthly" session={{ isAuthenticated: false, signIn: vi.fn() }} />);
  const annual = await screen.findByRole("radio", { name: /Anual/ });
  fireEvent.click(annual);
  expect(screen.getByText("Fincla Pessoal")).toBeTruthy();
  expect(screen.queryByText("Atualizando o valor da sua oferta…")).toBeNull();
  expect(screen.getByLabelText("Atualizando valor")).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("radio", { name: /Anual/ })).toBeDisabled();
  resolveAnnual({ ok: true, json: async () => ({ selection: { persona: "personal", billing_cycle: "yearly" }, total_cents: 29900, capacity: null }) });
  expect(await screen.findByText(/299,00/)).toBeTruthy();
});

it("lets the visitor review a previous step without losing the account draft", async () => {
  const { fireEvent } = await import("@testing-library/react");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ selection: { persona: "personal", billing_cycle: "monthly" }, total_cents: 2990, capacity: null }) }));
  render(<CheckoutPage search="?persona=personal&billing_cycle=monthly" session={{ isAuthenticated: false, signIn: vi.fn() }} />);
  fireEvent.click(await screen.findByRole("button", { name: "Continuar" }));
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Maria" } });
  fireEvent.click(screen.getByRole("button", { name: /Plano e ciclo/ }));
  fireEvent.click(screen.getByRole("button", { name: /Seus dados/ }));
  expect(screen.getByLabelText("Nome")).toHaveValue("Maria");
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
  const fetch = vi.fn(async (url, options) => {
    if (url.includes("checkout-quote")) {
      const selection = JSON.parse(options.body);
      return {ok:true,json:async()=>({selection,total_cents:selection.billing_cycle === "yearly" ? 29900 : 2990,capacity:null})};
    }
    return {ok:true,json:async()=>({status:"pending_payment"})};
  });
  vi.stubGlobal("fetch", fetch);
  render(<CheckoutPage search="?persona=personal&billing_cycle=yearly" session={{isAuthenticated:false,signIn}} />);
  await screen.findByText(/299,00/);
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.change(screen.getByLabelText("Nome"), {target:{value:"Maria"}});
  fireEvent.change(screen.getByLabelText("Email"), {target:{value:"maria@example.com"}});
  fireEvent.change(screen.getByLabelText("Senha"), {target:{value:"Password123!"}});
  fireEvent.click(screen.getByRole("button", {name:"Criar conta e continuar"}));
  await waitFor(()=>expect(signIn).toHaveBeenCalledWith("maria@example.com", "Password123!"));
  const registration = fetch.mock.calls.find(([url]) => url.includes("/checkout/register"));
  expect(registration[0]).toContain("/checkout/register");
  expect(JSON.parse(registration[1].body).billing_cycle).toBe("yearly");
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
  const fetch = vi.fn(async (url, options) => {
    if (url.includes("checkout-quote")) {
      const selection = JSON.parse(options.body);
      return {ok:true,json:async()=>selection.billing_cycle === "yearly" ? quote : {...quote, selection, total_cents: 54750}};
    }
    return {ok:true,json:async()=>({persona:"consultant",status:"pending_payment"})};
  });
  vi.stubGlobal("fetch", fetch);
  render(<CheckoutPage search="?persona=consultant&billing_cycle=yearly&mode=package&seats=26&package_size=25" session={{isAuthenticated:false,signIn}} />);
  await screen.findByText(/26 vagas contratadas/);
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.change(screen.getByLabelText("Nome"), {target:{value:"Maria"}});
  fireEvent.change(screen.getByLabelText("Email"), {target:{value:"consultora@example.com"}});
  fireEvent.change(screen.getByLabelText("Senha"), {target:{value:"Password123!"}});
  fireEvent.click(screen.getByRole("button", {name:"Criar conta e continuar"}));
  await waitFor(()=>expect(signIn).toHaveBeenCalledWith("consultora@example.com", "Password123!"));
  const registration = fetch.mock.calls.find(([url]) => url.includes("/checkout/register"));
  expect(JSON.parse(registration[1].body)).toMatchObject({persona:"consultant",billing_cycle:"yearly"});
  expect(screen.getByText(/outro email/i)).toBeTruthy();
});

it("explains the monthly equivalent and savings for the annual offer", async () => {
  const fetch = vi.fn(async (_url, options) => {
    const selection = JSON.parse(options.body);
    return {ok:true,json:async()=>({selection,total_cents:selection.billing_cycle === "yearly" ? 29900 : 2990,capacity:null})};
  });
  vi.stubGlobal("fetch", fetch);
  render(<CheckoutPage search="?persona=personal&billing_cycle=yearly" session={{isAuthenticated:false,signIn:vi.fn()}} />);
  expect(await screen.findByText((_, node) => node?.textContent?.replace(/\u00a0/g, " ") === "Equivale a R$ 24,92/mês")).toBeTruthy();
  expect(await screen.findByText("2 meses grátis no anual")).toBeTruthy();
  expect(screen.getByText((_, node) => node?.textContent?.replace(/\u00a0/g, " ") === "Economia total de R$ 59,80")).toBeTruthy();
  expect(screen.getAllByText((_, node) => node?.textContent?.replace(/\u00a0/g, " ") === "R$ 24,92/mês")).toHaveLength(2);
  expect(screen.getByText("2 meses grátis")).toBeTruthy();
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
  fireEvent.click(screen.getByLabelText(/Termos de contratação/));
  fireEvent.submit(screen.getByRole('button',{name:'Confirmar pagamento'}).closest('form'));
  const update = await screen.findByRole('button',{name:'Atualizar oferta'});
  expect(payments).toBe(1);
  refresh = true;
  fireEvent.click(update);
  await screen.findByText(/30,90/);
  expect(await screen.findByLabelText(/Termos de contratação/)).not.toBeChecked();
  expect(screen.getByLabelText('Número do cartão')).toHaveValue('');
  expect(payments).toBe(1);
});

it("waits for healthy preparation and permits new card input after interrupted preparation expires", async () => {
  const { fireEvent } = await import("@testing-library/react");
  const quote = {selection:{persona:"personal",billing_cycle:"monthly"},total_cents:2990,capacity:null};
  let status = "preparing";
  vi.stubGlobal("fetch", vi.fn(async url => ({ok:true,json:async()=>url.includes('checkout-quote') ? quote : {id:"preparation",status,has_access:false,quote}})));
  render(<CheckoutPage search="?persona=personal&billing_cycle=monthly" session={{isAuthenticated:true,user:{email:"pessoal@example.com",subscription:{status:"pending_payment"}},signOut:vi.fn()}} />);
  expect(await screen.findByRole("heading",{name:"Confirmando o resultado da tentativa"})).toBeTruthy();
  expect(screen.queryByLabelText("Número do cartão")).toBeNull();
  status = "declined";
  fireEvent.click(screen.getByRole("button",{name:"Verificar pagamento"}));
  expect(await screen.findByLabelText("Número do cartão")).toHaveValue("");
});
