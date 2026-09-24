// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { CheckoutPage } from "./CheckoutPage.jsx";
import { checkoutFieldErrors } from "./CheckoutPayment.jsx";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("preserves the consultant selection and displays the server's annual quote", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    selection: { persona: "consultant", billing_cycle: "yearly", mode: "package", package_size: 25 },
    total_cents: 517400, capacity: 26, currency: "BRL",
  }) });
  vi.stubGlobal("fetch", fetch);
  render(<CheckoutPage search="?persona=consultant&billing_cycle=yearly&mode=package&seats=26&package_size=25&total_cents=1" />);
  expect(await screen.findByText("Fincla Consultor")).toBeTruthy();
  expect(screen.getAllByText(/5.174,00/)).toHaveLength(2);
  expect(screen.getByText(/26 vagas contratadas/)).toBeTruthy();
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({persona:"consultant",billing_cycle:"yearly",mode:"package",seats:26,package_size:25});
});

it("discards an obsolete response when the selection changes", async () => {
  let firstResponse;
  vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(() => new Promise((resolve) => { firstResponse = resolve; }))
    .mockResolvedValue({ok: true, json: async () => ({selection:{persona:"personal",billing_cycle:"yearly"},total_cents:29900,capacity:null})}));
  const view = render(<CheckoutPage search="?persona=personal&billing_cycle=monthly" />);
  view.rerender(<CheckoutPage search="?persona=personal&billing_cycle=yearly" />);
  expect(await screen.findByRole("button", { name: "Preencha os dados para continuar" })).toBeTruthy();
  firstResponse({ok:true,json:async () => ({selection:{persona:"personal",billing_cycle:"monthly"},total_cents:2990,capacity:null})});
  await waitFor(() => expect(screen.getByRole("button", { name: "Preencha os dados para continuar" })).toBeTruthy());
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
  expect(await screen.findByRole("button", { name: "Preencha os dados para continuar" })).toBeTruthy();
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ persona: "personal", billing_cycle: "yearly" });
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  expect(await screen.findByRole("button", { name: "Preencha seus dados para continuar" })).toBeDisabled();
});

it("sends the selected annual installment count to the server quote", async () => {
  const fetch = vi.fn(async (_url, options) => {
    const selection = JSON.parse(options.body);
    const installment_options = Array.from({ length: 12 }, (_, index) => {
      const installments = index + 1;
      return {
        installments,
        total_cents: installments >= 7 ? 31194 : 29900,
        installment_fee_cents: installments >= 7 ? 1294 : 0,
        regular_installment_cents: Math.floor((installments >= 7 ? 31194 : 29900) / installments),
        final_installment_cents: (installments >= 7 ? 31194 : 29900) - Math.floor((installments >= 7 ? 31194 : 29900) / installments) * (installments - 1),
      };
    });
    return { ok: true, json: async () => ({ selection, total_cents: 31194, installment_fee_cents: 1294, installment_options, capacity: null }) };
  });
  vi.stubGlobal("fetch", fetch);

  render(<CheckoutPage search="?persona=personal&billing_cycle=yearly&installments=12" session={{ isAuthenticated: false, signIn: vi.fn() }} />);

  expect(await screen.findByLabelText("Parcelas do plano anual")).toHaveValue("12");
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
    persona: "personal",
    billing_cycle: "yearly",
    installments: 12,
  });
  const labels = Array.from(screen.getByLabelText("Parcelas do plano anual").options).map((option) => option.text);
  expect(labels).toContainEqual(expect.stringMatching(/^6x de \$?R\$\s*49,83$/));
  expect(labels).toContainEqual(expect.stringMatching(/^12x de \$?R\$\s*25,99 · \+\$?R\$\s*12,94 de taxas$/));
  expect(await screen.findByText(/A última parcela pode variar alguns centavos por arredondamento/)).toBeTruthy();
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
  expect(await screen.findByRole("button", { name: "Preencha os dados para continuar" })).toBeTruthy();
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

it("validates account details in place and confirms matching passwords before payment", async () => {
  const { fireEvent } = await import("@testing-library/react");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ selection: { persona: "personal", billing_cycle: "monthly" }, total_cents: 2990, capacity: null }) }));
  render(<CheckoutPage search="?persona=personal&billing_cycle=monthly" session={{ isAuthenticated: false, signIn: vi.fn() }} />);
  fireEvent.click(await screen.findByRole("button", { name: "Continuar" }));
  fireEvent.change(screen.getByLabelText("Senha", { exact: true }), { target: { value: "Password123!" } });
  fireEvent.change(screen.getByLabelText("Confirme sua senha", { exact: true }), { target: { value: "outra-senha" } });
  fireEvent.blur(screen.getByLabelText("Confirme sua senha", { exact: true }));
  expect(screen.getByText("As senhas não coincidem.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Preencha seus dados para continuar" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Confirme sua senha", { exact: true }), { target: { value: "Password123!" } });
  expect(screen.getAllByText("As senhas coincidem")).toHaveLength(2);
});

it("shows an actionable error without offering payment for an invalid selection", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ok:false,status:422}));
  render(<CheckoutPage search="?persona=invalid" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("seleção de plano é inválida");
  expect(screen.queryByRole("button", {name:/pagar/i})).toBeNull();
});

it("keeps account details local until the final payment action", async () => {
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
  await screen.findByRole("button", { name: "Preencha os dados para continuar" });
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.change(screen.getByLabelText("Nome"), {target:{value:"Maria"}});
  fireEvent.change(screen.getByLabelText("Email"), {target:{value:"maria@example.com"}});
  fireEvent.change(screen.getByLabelText(/CPF\/CNPJ/), {target:{value:"24971563792"}});
  fireEvent.change(screen.getByLabelText(/Celular com DDD/), {target:{value:"4738010919"}});
  fireEvent.change(screen.getByLabelText("Senha"), {target:{value:"Password123!"}});
  fireEvent.change(screen.getByLabelText("Confirme sua senha"), {target:{value:"Password123!"}});
  fireEvent.click(screen.getByRole("button", {name:"Continuar para o pagamento"}));
  expect(signIn).not.toHaveBeenCalled();
  expect(fetch.mock.calls.find(([url]) => url.includes("/checkout/register"))).toBeUndefined();
  expect(screen.getByText(/outro email/i)).toBeTruthy();
  await screen.findByRole("heading", { name: "Pague com cartão" });
  fireEvent.change(screen.getByLabelText("Nome do titular"), { target: { value: "Maria Silva" } });
  fireEvent.change(screen.getByLabelText("Número do cartão"), { target: { value: "4242 4242 4242 4242" } });
  fireEvent.change(screen.getByLabelText("Validade (MM/AA)"), { target: { value: "12/30" } });
  fireEvent.change(screen.getByLabelText("CVV"), { target: { value: "123" } });
  fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01001-000" } });
  fireEvent.change(screen.getByLabelText("Número do endereço"), { target: { value: "10" } });
  fireEvent.click(screen.getByLabelText(/Termos de contratação/));
  fireEvent.click(screen.getByLabelText(/Autorizo a cobrança/));
  await waitFor(() => expect(screen.getAllByRole("button", { name: /Assinar por.*299,00/ })).toHaveLength(2));
  expect(screen.getAllByRole("button", { name: /Assinar por.*299,00/ }).every((button) => !button.disabled)).toBe(true);
  fireEvent.submit(screen.getByLabelText("Número do cartão").closest("form"));
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
  expect(await screen.findByRole("heading", { name: "Estamos confirmando seu pagamento" })).toBeTruthy();
  expect(screen.queryByLabelText("Número do cartão")).toBeNull();
  expect(screen.getByRole("button",{name:"Atualizar agora"})).toBeTruthy();
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
  fireEvent.change(screen.getByLabelText(/CPF\/CNPJ/), {target:{value:"24971563792"}});
  fireEvent.change(screen.getByLabelText(/Celular com DDD/), {target:{value:"4738010919"}});
  fireEvent.change(screen.getByLabelText("Senha"), {target:{value:"Password123!"}});
  fireEvent.change(screen.getByLabelText("Confirme sua senha"), {target:{value:"Password123!"}});
  fireEvent.click(screen.getByRole("button", {name:"Continuar para o pagamento"}));
  expect(signIn).not.toHaveBeenCalled();
  expect(fetch.mock.calls.find(([url]) => url.includes("/checkout/register"))).toBeUndefined();
  await screen.findByRole("heading", { name: "Pague com cartão" });
  fireEvent.change(screen.getByLabelText("Nome do titular"), { target: { value: "Maria Silva" } });
  fireEvent.change(screen.getByLabelText("Número do cartão"), { target: { value: "4242 4242 4242 4242" } });
  fireEvent.change(screen.getByLabelText("Validade (MM/AA)"), { target: { value: "12/30" } });
  fireEvent.change(screen.getByLabelText("CVV"), { target: { value: "123" } });
  fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01001-000" } });
  fireEvent.change(screen.getByLabelText("Número do endereço"), { target: { value: "10" } });
  fireEvent.click(screen.getByLabelText(/Termos de contratação/));
  fireEvent.click(screen.getByLabelText(/Autorizo a cobrança/));
  fireEvent.submit(screen.getByLabelText("Número do cartão").closest("form"));
  await waitFor(()=>expect(signIn).toHaveBeenCalledWith("consultora@example.com", "Password123!"));
  const registration = fetch.mock.calls.find(([url]) => url.includes("/checkout/register"));
  expect(JSON.parse(registration[1].body)).toMatchObject({persona:"consultant",billing_cycle:"yearly"});
});

it("explains the monthly equivalent and savings for the annual offer", async () => {
  const fetch = vi.fn(async (_url, options) => {
    const selection = JSON.parse(options.body);
    return {ok:true,json:async()=>({selection,total_cents:selection.billing_cycle === "yearly" ? 29900 : 2990,capacity:null})};
  });
  vi.stubGlobal("fetch", fetch);
  render(<CheckoutPage search="?persona=personal&billing_cycle=yearly" session={{isAuthenticated:false,signIn:vi.fn()}} />);
  expect(await screen.findByText((_, node) => node?.textContent?.replace(/\u00a0/g, " ") === "R$ 24,92/mês equivalente · renova a cada 12 meses.")).toBeTruthy();
  expect(await screen.findByText((_, node) => node?.textContent?.replace(/\u00a0/g, " ") === "✓ Você economiza R$ 59,80 (2 meses grátis)")).toBeTruthy();
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
  expect(screen.getAllByText(/5.174,00/)).toHaveLength(2);
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
  expect(await screen.findByRole("heading",{name:"Estamos confirmando seu pagamento"})).toBeTruthy();
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
  fireEvent.change(screen.getByLabelText("Nome do titular"), { target: { value: "Maria Silva" } });
  fireEvent.change(screen.getByLabelText("Número do cartão"), { target: { value: "4242 4242 4242 4242" } });
  fireEvent.change(screen.getByLabelText("Validade (MM/AA)"), { target: { value: "12/30" } });
  fireEvent.change(screen.getByLabelText("CVV"), { target: { value: "123" } });
  fireEvent.change(screen.getByLabelText(/CPF\/CNPJ do titular/), { target: { value: "24971563792" } });
  fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01001-000" } });
  fireEvent.change(screen.getByLabelText("Número do endereço"), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText(/Telefone com DDD/), { target: { value: "4738010919" } });
  fireEvent.click(screen.getByLabelText(/Termos de contratação/));
  fireEvent.submit(screen.getByLabelText('Número do cartão').closest('form'));
  const update = await screen.findByRole('button',{name:'Atualizar oferta'});
  expect(payments).toBe(1);
  refresh = true;
  fireEvent.click(update);
  expect((await screen.findAllByRole('button', { name: 'Preencha os dados para continuar' })).length).toBeGreaterThan(0);
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
  expect(await screen.findByRole("heading",{name:"Estamos confirmando seu pagamento"})).toBeTruthy();
  expect(screen.queryByLabelText("Número do cartão")).toBeNull();
  status = "declined";
  fireEvent.click(screen.getByRole("button",{name:"Atualizar agora"}));
  expect(await screen.findByLabelText("Número do cartão")).toHaveValue("");
});

it("keeps the payment form visible when the API rejects a known validation error", async () => {
  const { fireEvent } = await import("@testing-library/react");
  const quote = { selection: { persona: "personal", billing_cycle: "monthly" }, total_cents: 2990, capacity: null };
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    if (url.includes("checkout-quote")) return { ok: true, json: async () => quote };
    if (url.includes("checkout/current")) return { ok: true, json: async () => null };
    if (url.includes("checkout/pay")) return { ok: false, json: async () => ({ detail: { code: "invalid_checkout", message: "Confira os campos destacados.", fields: ["holder.addressNumber"] } }) };
    return { ok: true, json: async () => ({}) };
  }));
  render(<CheckoutPage search="?persona=personal&billing_cycle=monthly" session={{ isAuthenticated: true, user: { email: "maria@example.com", subscription: { status: "pending_payment" } }, signOut: vi.fn() }} />);
  await screen.findByRole("heading", { name: "Pague com cartão" });
  fireEvent.change(screen.getByLabelText("Nome do titular"), { target: { value: "Maria Silva" } });
  fireEvent.change(screen.getByLabelText("Número do cartão"), { target: { value: "4242 4242 4242 4242" } });
  fireEvent.change(screen.getByLabelText("Validade (MM/AA)"), { target: { value: "12/30" } });
  fireEvent.change(screen.getByLabelText("CVV"), { target: { value: "123" } });
  fireEvent.change(screen.getByLabelText(/CPF\/CNPJ do titular/), { target: { value: "24971563792" } });
  fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01001-000" } });
  fireEvent.change(screen.getByLabelText("Número do endereço"), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText(/Telefone com DDD/), { target: { value: "4738010919" } });
  fireEvent.click(screen.getByLabelText(/Termos de contratação/));
  fireEvent.click(screen.getByLabelText(/Autorizo a cobrança/));
  fireEvent.submit(screen.getByLabelText("Número do cartão").closest("form"));
  expect(await screen.findByText("Confira os campos destacados.")).toBeTruthy();
  expect(screen.getByText("Informe um número válido para o endereço.")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Pague com cartão" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Estamos confirmando seu pagamento" })).toBeNull();
  expect(screen.getByLabelText("Número do endereço")).toHaveValue(10);
});

it("preserves payment data when its accordion is collapsed and reopened", async () => {
  const { fireEvent } = await import("@testing-library/react");
  const quote = { selection: { persona: "personal", billing_cycle: "monthly" }, total_cents: 2990, capacity: null };
  vi.stubGlobal("fetch", vi.fn(async (url) => ({ ok: true, json: async () => url.includes("checkout-quote") ? quote : null })));
  render(<CheckoutPage search="?persona=personal&billing_cycle=monthly" session={{ isAuthenticated: true, user: { email: "maria@example.com", subscription: { status: "pending_payment" } }, signOut: vi.fn() }} />);
  await screen.findByRole("heading", { name: "Pague com cartão" });
  fireEvent.change(screen.getByLabelText("Número do cartão"), { target: { value: "4242 4242 4242 4242" } });
  fireEvent.click(screen.getByRole("button", { name: /Pagamento/ }));
  fireEvent.click(screen.getByRole("button", { name: /Pagamento/ }));
  expect(screen.getByLabelText("Número do cartão")).toHaveValue("4242 4242 4242 4242");
});

it("prefills the resumable payment form from the authenticated account", async () => {
  const quote = { selection: { persona: "personal", billing_cycle: "monthly" }, total_cents: 2990, capacity: null };
  vi.stubGlobal("fetch", vi.fn(async (url) => ({ ok: true, json: async () => url.includes("checkout-quote") ? quote : null })));
  render(<CheckoutPage search="?persona=personal&billing_cycle=monthly" session={{ isAuthenticated: true, user: { email: "maria@example.com", first_name: "Maria", phone: "4738010919", subscription: { status: "pending_payment" } }, signOut: vi.fn() }} />);
  await screen.findByRole("heading", { name: "Pague com cartão" });
  expect(screen.getByLabelText("Nome do titular")).toHaveValue("Maria");
  expect(screen.getByLabelText(/Telefone com DDD/)).toHaveValue("4738010919");
});

it("keeps an uncertain card submission in reconciliation instead of reopening the form", async () => {
  const { fireEvent } = await import("@testing-library/react");
  const quote = { selection: { persona: "personal", billing_cycle: "monthly" }, total_cents: 2990, capacity: null };
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    if (url.includes("checkout-quote")) return { ok: true, json: async () => quote };
    if (url.includes("checkout/current")) return { ok: true, json: async () => null };
    if (url.includes("checkout/pay")) throw new Error("network interrupted");
    return { ok: true, json: async () => ({}) };
  }));
  render(<CheckoutPage search="?persona=personal&billing_cycle=monthly" session={{ isAuthenticated: true, user: { email: "maria@example.com", subscription: { status: "pending_payment" } }, signOut: vi.fn() }} />);
  await screen.findByRole("heading", { name: "Pague com cartão" });
  fireEvent.change(screen.getByLabelText("Nome do titular"), { target: { value: "Maria Silva" } });
  fireEvent.change(screen.getByLabelText("Número do cartão"), { target: { value: "4242 4242 4242 4242" } });
  fireEvent.change(screen.getByLabelText("Validade (MM/AA)"), { target: { value: "12/30" } });
  fireEvent.change(screen.getByLabelText("CVV"), { target: { value: "123" } });
  fireEvent.change(screen.getByLabelText(/CPF\/CNPJ do titular/), { target: { value: "24971563792" } });
  fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01001-000" } });
  fireEvent.change(screen.getByLabelText("Número do endereço"), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText(/Telefone com DDD/), { target: { value: "4738010919" } });
  fireEvent.click(screen.getByLabelText(/Termos de contratação/));
  fireEvent.click(screen.getByLabelText(/Autorizo a cobrança/));
  fireEvent.submit(screen.getByLabelText("Número do cartão").closest("form"));
  expect(await screen.findByRole("heading", { name: "Estamos confirmando seu pagamento" })).toBeTruthy();
  expect(screen.queryByLabelText("Número do cartão")).toBeNull();
});


it("shows every local payment validation error before sending the card", async () => {
  const { fireEvent } = await import("@testing-library/react");
  const quote = { selection: { persona: "personal", billing_cycle: "monthly" }, total_cents: 2990, capacity: null };
  const fetch = vi.fn(async (url) => ({ ok: true, json: async () => url.includes("checkout-quote") ? quote : null }));
  vi.stubGlobal("fetch", fetch);
  render(<CheckoutPage search="?persona=personal&billing_cycle=monthly" session={{ isAuthenticated: true, user: { email: "maria@example.com", subscription: { status: "pending_payment" } }, signOut: vi.fn() }} />);
  await screen.findByRole("heading", { name: "Pague com cartão" });
  fireEvent.submit(screen.getByLabelText("Número do cartão").closest("form"));
  expect(await screen.findByText("Confira o número do cartão.")).toBeTruthy();
  expect(screen.getByText("Informe uma validade no formato MM/AA.")).toBeTruthy();
  expect(screen.getByText("Confira o código de segurança.")).toBeTruthy();
  expect(screen.getByText("Informe um CEP válido.")).toBeTruthy();
  expect(screen.getByText("Informe um número válido para o endereço.")).toBeTruthy();
  expect(fetch.mock.calls.some(([url]) => url.includes("/checkout/pay"))).toBe(false);
});


it("maps every safe server field path to its payment input feedback", () => {
  expect(checkoutFieldErrors([
    "card.holderName", "card.number", "card.expiryMonth", "card.expiryYear", "card.ccv",
    "holder.cpfCnpj", "holder.postalCode", "holder.addressNumber", "holder.phone",
  ])).toEqual({
    name: "Informe o nome como aparece no cartão.", number: "Confira o número do cartão.",
    expiry: "Informe uma validade no formato MM/AA.", ccv: "Confira o código de segurança.",
    cpf: "Confira o CPF/CNPJ do titular.", postal: "Informe um CEP válido.",
    address: "Informe um número válido para o endereço.", phone: "Informe um telefone com DDD válido.",
  });
});
