import { useCallback, useEffect, useRef, useState } from "react";
import { CheckoutPayment } from "./CheckoutPayment.jsx";
import { CheckoutAccount } from "./CheckoutAccount.jsx";
import { currentCheckout, quoteCheckout } from "../../api/checkout";
import { T } from "../tokens.js";
import { G, NUM } from "../typography.js";
import { Card, Btn } from "../components/primitives.jsx";

import { checkoutPersona } from "../features/auth/checkoutIdentity.js";

const money = (cents) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function CheckoutPage({ search = window.location.search, session }) {
  const [state, setState] = useState({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [selectionSearch, setSelectionSearch] = useState(search);
  const [activeSection, setActiveSection] = useState("plan");
  const [wide, setWide] = useState(() => typeof window === "undefined" || window.innerWidth >= 820);
  const cycleChange = useRef(false);
  const effectiveSearch = selectionSearch || search;
  const recovery = !effectiveSearch || effectiveSearch === "?";
  const savedSelection = JSON.stringify(session?.user?.subscription?.checkout_selection ?? null);
  const persona = checkoutPersona(session?.user);
  const cycle = session?.user?.subscription?.billing_cycle || "monthly";
  useEffect(() => setSelectionSearch(search), [search]);
  useEffect(() => {
    const sync = () => setWide(window.innerWidth >= 820);
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);
  useEffect(() => { if (session?.isAuthenticated) setActiveSection("payment"); }, [session?.isAuthenticated]);
  useEffect(() => {
    if (recovery && session?.isBootstrapping) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort();
      setState({ status: "error", message: "A consulta demorou mais que o esperado. Tente novamente." });
    }, 10000);
    setState((current) => cycleChange.current && current.quote
      ? { status: "loading", quote: current.quote, preserveQuote: true }
      : { status: "loading" });
    async function loadQuote() {
      if (!recovery) return quoteCheckout(effectiveSearch, controller.signal);
      if (session?.isAuthenticated) {
        const existing = await currentCheckout();
        if (existing) return existing.quote;
      }
      const selection = JSON.parse(savedSelection);
      if (!selection && persona === "consultant") {
        throw new Error("Escolha a modalidade e a quantidade de vagas no site para continuar sua contratação.");
      }
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(selection || { persona, billing_cycle: cycle })) {
        if (value != null) params.set(key, String(value));
      }
      return quoteCheckout(params.toString(), controller.signal);
    }
    loadQuote().then((receivedQuote) => {
      if (!controller.signal.aborted) {
        cycleChange.current = false;
        setState({ status: "ready", quote: receivedQuote });
      }
    }).catch((error) => {
      if (!controller.signal.aborted) {
        cycleChange.current = false;
        setState({ status: "error", message: error.message });
      }
    }).finally(() => window.clearTimeout(timeout));
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [effectiveSearch, attempt, recovery, session?.isBootstrapping, session?.isAuthenticated, savedSelection, persona, cycle]);

  const onOffer = useCallback((acceptedOffer) => setState({status:"ready",quote:acceptedOffer}), []);
  const quote = state.status === "ready" || state.preserveQuote ? state.quote : null;
  const canChangeCycle = !session?.isAuthenticated && state.status !== "loading";
  const changeCycle = useCallback((billingCycle) => {
    if (!quote || billingCycle === quote.selection.billing_cycle) return;
    const params = new URLSearchParams(effectiveSearch || "");
    for (const [key, value] of Object.entries(quote.selection)) {
      if (value != null) params.set(key, String(value));
    }
    params.set("billing_cycle", billingCycle);
    const nextSearch = `?${params.toString()}`;
    window.history.replaceState({}, "", `${window.location.pathname}${nextSearch}`);
    cycleChange.current = true;
    setState((current) => ({ status: "loading", quote: current.quote, preserveQuote: true }));
    setSelectionSearch(nextSearch);
  }, [effectiveSearch, quote]);
  return (
    <main className="fincla-scroll" style={{ ...G, minHeight: "100%", overflowY: "auto", boxSizing: "border-box", background: "#F7F8F5", color: T.ink, padding: "0 20px 56px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <header style={{ height: 66, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, borderBottom: `1px solid ${T.border}`, marginBottom: 38 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><img src="/logo.png" alt="Fincla" width={28} height={28} /><span style={{ fontWeight: 750, fontSize: 14 }}>Fincla</span><span aria-hidden="true" style={{ color: T.inkGhost }}>·</span><span style={{ color: T.inkMid, fontSize: 13 }}>Assinatura</span></div>
          <a href="mailto:contato@fincla.com" style={{ color: T.inkMid, fontSize: 13, textDecoration: "none" }}>Precisa de ajuda?</a>
        </header>
        <div style={{ maxWidth: 530 }}>
          <p style={{ color: T.green, fontSize: 12, fontWeight: 750, letterSpacing: ".08em", margin: 0 }}>ASSINATURA</p>
          <h1 style={{ fontSize: 30, letterSpacing: "-.035em", lineHeight: 1.08, margin: "9px 0 0" }}>Conclua sua contratação</h1>
          <p style={{ color: T.inkMid, lineHeight: 1.6, margin: "10px 0 0" }}>Escolha o ciclo, crie seu acesso e faça o pagamento com segurança.</p>
        </div>
        {state.status === "loading" && (quote
          ? <span role="status" style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>Atualizando o valor da sua oferta…</span>
          : <p role="status" style={{ color: T.inkMid, fontSize: 13, margin: "18px 0 0" }}>Consultando sua oferta…</p>)}
        {state.status === "error" && <Card style={{ padding: 24 }}>
          <p role="alert">{state.message}</p>
          <Btn onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</Btn>
          {recovery && persona === "consultant" && <p><a href="https://fincla.com/para-consultores">Escolher vagas no site</a></p>}
          {session?.isAuthenticated && <Btn onClick={session.signOut}>Sair da conta</Btn>}
        </Card>}
        {quote && <div style={{ display: "grid", gridTemplateColumns: wide ? "minmax(0, 1.22fr) minmax(290px, .78fr)" : "1fr", gap: 20, alignItems: "start", marginTop: 28 }}>
          <Card style={{ overflow: "hidden", border: `1px solid ${T.border}` }}>
            <CheckoutPanel number="1" title="Plano e ciclo" detail="Escolha como prefere pagar" open={activeSection === "plan"} complete={activeSection !== "plan"}>
              <BillingCyclePicker value={quote.selection.billing_cycle} disabled={!canChangeCycle} onChange={changeCycle} />
              {quote.capacity != null && <p style={{ color: T.inkMid, lineHeight: 1.6, margin: "0 0 20px", padding: "12px 14px", background: "#F3F7F0", borderRadius: 10 }}>A capacidade é paga antecipadamente, inclusive vagas vazias. Você pode preenchê-las e reutilizá-las durante o período contratado.</p>}
              <Btn variant="dark" full onClick={() => setActiveSection("account")}>Continuar</Btn>
            </CheckoutPanel>
            <CheckoutPanel number="2" title="Seus dados" detail="Crie ou acesse sua conta" open={activeSection === "account"} complete={session?.isAuthenticated} locked={activeSection === "plan"}>
              {session ? <CheckoutAccount quote={quote} session={session} /> : <p style={{ color: T.inkMid }}>A contratação online estará disponível em breve.</p>}
            </CheckoutPanel>
            <CheckoutPanel number="3" title="Pagamento" detail="Confirme a assinatura" open={activeSection === "payment"} locked={!session?.isAuthenticated}>
              {session?.isAuthenticated && (persona !== quote.selection.persona ? <section style={{ marginTop: 4 }}><p role="alert">Esta conta é do Fincla {persona === "consultant" ? "Consultor" : "Pessoal"}. Para contratar a outra área, use um perfil separado com outro email.</p><Btn onClick={session.signOut}>Sair da conta</Btn></section> : <CheckoutPayment quote={quote} session={session} onOffer={onOffer} onRefresh={() => setAttempt(value => value + 1)} />)}
            </CheckoutPanel>
          </Card>
          <OrderSummary quote={quote} wide={wide} />
        </div>}
      </div>
    </main>
  );
}

function CheckoutPanel({ number, title, detail, open, complete, locked, children }) {
  return <section aria-labelledby={`checkout-step-${number}`} style={{ borderBottom: number === "3" ? 0 : `1px solid ${T.border}`, padding: open ? "22px 24px 26px" : "18px 24px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <span aria-hidden="true" style={{ width: 27, height: 27, borderRadius: 9, display: "grid", placeItems: "center", background: complete ? T.green : open ? T.ink : "#EEF0EC", color: complete || open ? "#fff" : T.inkGhost, fontSize: 12, fontWeight: 800 }}>{complete ? "✓" : number}</span>
      <div><h2 id={`checkout-step-${number}`} style={{ fontSize: 16, margin: 0 }}>{title}</h2><p style={{ color: T.inkGhost, fontSize: 12, margin: "3px 0 0" }}>{locked ? "Disponível após a etapa anterior" : detail}</p></div>
    </div>
    {open && <div style={{ marginTop: 22 }}>{children}</div>}
  </section>;
}

function OrderSummary({ quote, wide }) {
  const planName = quote.selection.persona === "personal" ? "Fincla Pessoal" : "Fincla Consultor";
  const cycle = quote.selection.billing_cycle === "yearly" ? "anual" : "mensal";
  return <aside style={{ position: wide ? "sticky" : "static", top: 18 }}><Card style={{ overflow: "hidden", background: "#24201A", color: "#FFFDF8", border: 0 }}>
    <div style={{ padding: "24px" }}><p style={{ color: "#C9BDAF", fontSize: 11, fontWeight: 750, letterSpacing: ".1em", margin: 0 }}>SEU PLANO</p><h2 style={{ margin: "8px 0 0", fontSize: 23 }}>{planName}</h2>{quote.capacity != null && <p style={{ color: "#D6CCC0", fontSize: 13, margin: "8px 0 0" }}>{quote.capacity} vagas contratadas</p>}<div style={{ borderTop: "1px solid #4A433B", marginTop: 22, paddingTop: 18 }}><p style={{ color: "#C9BDAF", fontSize: 12, margin: 0 }}>Você paga hoje</p><p style={{ ...NUM, fontSize: 34, fontWeight: 750, letterSpacing: "-.04em", margin: "4px 0" }}>{money(quote.total_cents)}</p><p style={{ color: "#C9BDAF", fontSize: 13, margin: 0 }}>Cobrança {cycle}</p></div></div>
    <div style={{ padding: "20px 24px", background: "#FFFDF8", color: T.ink }}><p style={{ fontSize: 11, color: T.inkGhost, fontWeight: 750, letterSpacing: ".08em", margin: 0 }}>INCLUSO NA ASSINATURA</p><ul style={{ display: "grid", gap: 10, padding: 0, margin: "16px 0 0", listStyle: "none", fontSize: 13, color: T.inkMid }}><li>✓ Acesso liberado após a confirmação</li><li>✓ Renovação gerenciada no seu perfil</li><li>✓ Cancelamento de renovação pelo app</li></ul></div>
  </Card></aside>;
}

function BillingCyclePicker({ value, disabled, onChange }) {
  return <section aria-labelledby="billing-cycle-heading" style={{ margin: "0 0 24px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, marginBottom: 10 }}>
      <div><h2 id="billing-cycle-heading" style={{ fontSize: 18, margin: 0 }}>Período de contratação</h2><p style={{ color: T.inkMid, fontSize: 13, margin: "4px 0 0" }}>{disabled ? "O período será alterado depois no seu perfil." : "Você pode escolher mensal ou anual antes de continuar."}</p></div>
    </div>
    <div role="radiogroup" aria-label="Período de contratação" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <CycleOption value="monthly" active={value === "monthly"} disabled={disabled} onChange={onChange} title="Mensal" detail="Cobrança todo mês" />
      <CycleOption value="yearly" active={value === "yearly"} disabled={disabled} onChange={onChange} title="Anual" detail="Cobrança uma vez por ano" />
    </div>
  </section>;
}

function CycleOption({ value, active, disabled, onChange, title, detail, badge }) {
  return <button type="button" role="radio" aria-checked={active} disabled={disabled} onClick={() => onChange(value)} style={{ textAlign: "left", padding: "14px", borderRadius: 11, border: `1.5px solid ${active ? T.green : T.border}`, background: active ? "#F2F8EE" : "#FCFCFB", color: T.ink, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled && !active ? 0.55 : 1 }}>
    <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 14, fontWeight: 750 }}>{title}{badge && <span style={{ fontSize: 10, padding: "3px 6px", borderRadius: 99, background: "#DFF0D8", color: "#226122" }}>{badge}</span>}</span>
    <span style={{ display: "block", marginTop: 4, color: T.inkMid, fontSize: 12 }}>{detail}</span>
  </button>;
}
