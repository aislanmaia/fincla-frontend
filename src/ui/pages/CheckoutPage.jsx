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
  const [counterpartQuote, setCounterpartQuote] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [selectionSearch, setSelectionSearch] = useState(search);
  const [activeSection, setActiveSection] = useState("plan");
  const [accountVisited, setAccountVisited] = useState(false);
  const [accountDetails, setAccountDetails] = useState(null);
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
  const quoteSelectionKey = JSON.stringify(quote?.selection ?? null);
  useEffect(() => {
    if (!quote) {
      setCounterpartQuote(null);
      return undefined;
    }
    const controller = new AbortController();
    const counterpartSelection = { ...quote.selection, billing_cycle: quote.selection.billing_cycle === "yearly" ? "monthly" : "yearly" };
    setCounterpartQuote({ selectionKey: quoteSelectionKey, totalCents: null });
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(counterpartSelection)) {
      if (value != null) params.set(key, String(value));
    }
    quoteCheckout(params.toString(), controller.signal).then((receivedQuote) => {
      if (!controller.signal.aborted) {
        setCounterpartQuote({ selectionKey: quoteSelectionKey, totalCents: receivedQuote.total_cents });
      }
    }).catch(() => {
      if (!controller.signal.aborted) setCounterpartQuote({ selectionKey: quoteSelectionKey, totalCents: null });
    });
    return () => controller.abort();
  }, [quoteSelectionKey, quote?.selection.billing_cycle]);
  const counterpartTotalCents = counterpartQuote?.selectionKey === quoteSelectionKey ? counterpartQuote.totalCents : null;
  const monthlyTotalCents = quote?.selection.billing_cycle === "monthly" ? quote.total_cents : counterpartTotalCents;
  const annualTotalCents = quote?.selection.billing_cycle === "yearly" ? quote.total_cents : counterpartTotalCents;
  const annualSavingsCents = monthlyTotalCents != null && annualTotalCents != null
    ? Math.max(0, monthlyTotalCents * 12 - annualTotalCents)
    : null;
  const annualFreeMonths = annualSavingsCents != null && monthlyTotalCents
    ? Math.floor(annualSavingsCents / monthlyTotalCents)
    : null;
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
    <main className="fincla-scroll" style={{ ...G, height: "100%", minHeight: 0, overflowY: "auto", overflowX: "hidden", boxSizing: "border-box", background: "#F7F8F5", color: T.ink, padding: "0 20px 56px" }}>
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
        {state.status === "loading" && !quote && <p role="status" style={{ color: T.inkMid, fontSize: 13, margin: "18px 0 0" }}>Consultando sua oferta…</p>}
        {state.status === "error" && <Card style={{ padding: 24 }}>
          <p role="alert">{state.message}</p>
          <Btn onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</Btn>
          {recovery && persona === "consultant" && <p><a href="https://fincla.com/para-consultores">Escolher vagas no site</a></p>}
          {session?.isAuthenticated && <Btn onClick={session.signOut}>Sair da conta</Btn>}
        </Card>}
        {quote && <div style={{ display: "grid", gridTemplateColumns: wide ? "minmax(0, 1.22fr) minmax(290px, .78fr)" : "1fr", gap: 20, alignItems: "start", marginTop: 28 }}>
          <Card style={{ overflow: "hidden", border: `1px solid ${T.border}` }}>
            <CheckoutPanel number="1" title="Plano e ciclo" detail="Escolha como prefere pagar" open={activeSection === "plan"} complete={activeSection !== "plan"} onOpen={() => setActiveSection("plan")}>
              <BillingCyclePicker value={quote.selection.billing_cycle} monthlyTotalCents={monthlyTotalCents} annualTotalCents={annualTotalCents} annualFreeMonths={annualFreeMonths} disabled={!canChangeCycle} onChange={changeCycle} />
              {quote.capacity != null && <p style={{ color: T.inkMid, lineHeight: 1.6, margin: "0 0 20px", padding: "12px 14px", background: "#F3F7F0", borderRadius: 10 }}>A capacidade é paga antecipadamente, inclusive vagas vazias. Você pode preenchê-las e reutilizá-las durante o período contratado.</p>}
              <Btn variant="dark" full onClick={() => { setAccountVisited(true); setActiveSection("account"); }}>Continuar</Btn>
            </CheckoutPanel>
            <CheckoutPanel number="2" title="Seus dados" detail="Crie ou acesse sua conta" open={activeSection === "account"} complete={session?.isAuthenticated} locked={!accountVisited && activeSection === "plan"} keepMounted={accountVisited} onOpen={() => { setAccountVisited(true); setActiveSection("account"); }}>
              {session?.isAuthenticated ? <p style={{ color: T.inkMid, margin: 0 }}>Conta criada com <strong>{session.user?.email}</strong>.</p> : session ? <CheckoutAccount quote={quote} session={session} onAccountDetails={setAccountDetails} /> : <p style={{ color: T.inkMid }}>A contratação online estará disponível em breve.</p>}
            </CheckoutPanel>
            <CheckoutPanel number="3" title="Pagamento" detail="Confirme a assinatura" open={activeSection === "payment"} locked={!session?.isAuthenticated} onOpen={() => setActiveSection("payment")}>
              {session?.isAuthenticated && (persona !== quote.selection.persona ? <section style={{ marginTop: 4 }}><p role="alert">Esta conta é do Fincla {persona === "consultant" ? "Consultor" : "Pessoal"}. Para contratar a outra área, use um perfil separado com outro email.</p><Btn onClick={session.signOut}>Sair da conta</Btn></section> : <CheckoutPayment quote={quote} accountDetails={accountDetails} session={session} onOffer={onOffer} onRefresh={() => setAttempt(value => value + 1)} />)}
            </CheckoutPanel>
          </Card>
          <OrderSummary quote={quote} annualSavingsCents={annualSavingsCents} annualFreeMonths={annualFreeMonths} wide={wide} refreshing={state.status === "loading" && state.preserveQuote} />
        </div>}
      </div>
    </main>
  );
}

function CheckoutPanel({ number, title, detail, open, complete, locked, keepMounted = false, onOpen, children }) {
  return <section aria-labelledby={`checkout-step-${number}`} style={{ borderBottom: number === "3" ? 0 : `1px solid ${T.border}`, padding: open ? "22px 24px 26px" : "18px 24px" }}>
    <button type="button" disabled={locked} onClick={onOpen} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: 0, border: 0, background: "transparent", color: locked ? "#AEB5BE" : T.ink, textAlign: "left", cursor: locked ? "not-allowed" : "pointer" }}>
      <span aria-hidden="true" style={{ width: 27, height: 27, borderRadius: 9, display: "grid", placeItems: "center", background: complete ? T.green : open ? T.ink : locked ? "#F3F4F2" : "#EEF0EC", color: complete || open ? "#fff" : locked ? "#AEB5BE" : T.inkGhost, fontSize: 12, fontWeight: 800 }}>{complete ? "✓" : number}</span>
      <div><h2 id={`checkout-step-${number}`} style={{ fontSize: 16, margin: 0, color: locked ? "#9DA5AF" : undefined }}>{title}</h2><p style={{ color: locked ? "#B5BCC4" : T.inkGhost, fontSize: 12, margin: "3px 0 0" }}>{locked ? "Disponível após a etapa anterior" : detail}</p></div>
    </button>
    {(open || keepMounted) && <div hidden={!open} style={{ display: open ? "block" : "none", marginTop: 22 }}>{children}</div>}
  </section>;
}

function OrderSummary({ quote, annualSavingsCents, annualFreeMonths, wide, refreshing }) {
  const planName = quote.selection.persona === "personal" ? "Fincla Pessoal" : "Fincla Consultor";
  const cycle = quote.selection.billing_cycle === "yearly" ? "anual" : "mensal";
  const annual = quote.selection.billing_cycle === "yearly";
  const monthlyEquivalent = annual ? Math.round(quote.total_cents / 12) : null;
  return <aside style={{ position: wide ? "sticky" : "static", top: 18, alignSelf: "start" }}><Card style={{ overflow: "hidden", background: "#24201A", color: "#FFFDF8", border: 0 }}>
    <div style={{ padding: "24px" }}><p style={{ color: "#C9BDAF", fontSize: 11, fontWeight: 750, letterSpacing: ".1em", margin: 0 }}>SEU PLANO</p><h2 style={{ margin: "8px 0 0", fontSize: 23 }}>{planName}</h2>{quote.capacity != null && <p style={{ color: "#D6CCC0", fontSize: 13, margin: "8px 0 0" }}>{quote.capacity} vagas contratadas</p>}<div style={{ borderTop: "1px solid #4A433B", marginTop: 22, paddingTop: 18 }}><p style={{ color: "#C9BDAF", fontSize: 12, margin: 0 }}>Você paga hoje</p><p aria-busy={refreshing || undefined} aria-label={refreshing ? "Atualizando valor" : undefined} style={{ ...NUM, fontSize: 34, fontWeight: 750, letterSpacing: "-.04em", margin: "4px 0", height: 41 }}>{refreshing ? <span aria-hidden="true" style={{ display: "block", width: "68%", height: 34, borderRadius: 7, background: "#51483D" }} /> : money(quote.total_cents)}</p><p style={{ color: "#C9BDAF", fontSize: 13, margin: 0 }}>{annual ? "Cobrança uma vez por ano" : "Cobrança todos os meses"}</p>{annual && <div style={{ minHeight: 54, marginTop: 16, padding: "11px 12px", borderRadius: 9, background: "#343027" }}><p style={{ color: "#E7DED2", fontSize: 12, margin: 0 }}>Equivale a <strong>{money(monthlyEquivalent)}/mês</strong></p>{annualFreeMonths != null && annualFreeMonths > 0 && <p style={{ color: "#BEE8A9", fontSize: 12, fontWeight: 750, margin: "5px 0 0" }}>{annualFreeMonths} {annualFreeMonths === 1 ? "mês grátis" : "meses grátis"} no anual</p>}{annualSavingsCents != null && annualSavingsCents > 0 && <p style={{ color: "#C9BDAF", fontSize: 11, margin: "4px 0 0" }}>Economia total de {money(annualSavingsCents)}</p>}</div>}</div></div>
    <div style={{ padding: "20px 24px", background: "#FFFDF8", color: T.ink }}><p style={{ fontSize: 11, color: T.inkGhost, fontWeight: 750, letterSpacing: ".08em", margin: 0 }}>INCLUSO NA ASSINATURA</p><ul style={{ display: "grid", gap: 10, padding: 0, margin: "16px 0 0", listStyle: "none", fontSize: 13, color: T.inkMid }}><li>✓ Acesso liberado após a confirmação</li><li>✓ Renovação gerenciada no seu perfil</li><li>✓ Cancelamento de renovação pelo app</li></ul></div>
  </Card></aside>;
}

function BillingCyclePicker({ value, monthlyTotalCents, annualTotalCents, annualFreeMonths, disabled, onChange }) {
  const annualMonthlyEquivalent = annualTotalCents == null ? null : Math.round(annualTotalCents / 12);
  const annualBadge = annualFreeMonths != null && annualFreeMonths > 0 ? `${annualFreeMonths} ${annualFreeMonths === 1 ? "mês grátis" : "meses grátis"}` : undefined;
  return <section aria-labelledby="billing-cycle-heading" style={{ margin: "0 0 24px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, marginBottom: 10 }}>
      <div><h2 id="billing-cycle-heading" style={{ fontSize: 18, margin: 0 }}>Período de contratação</h2><p style={{ color: T.inkMid, fontSize: 13, margin: "4px 0 0" }}>Você pode escolher mensal ou anual antes de continuar.</p></div>
    </div>
    <div role="radiogroup" aria-label="Período de contratação" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <CycleOption value="monthly" active={value === "monthly"} disabled={disabled} onChange={onChange} title="Mensal" detail={monthlyTotalCents == null ? "" : `${money(monthlyTotalCents)}/mês`} />
      <CycleOption value="yearly" active={value === "yearly"} disabled={disabled} onChange={onChange} title="Anual" detail={annualMonthlyEquivalent == null ? "" : `${money(annualMonthlyEquivalent)}/mês`} badge={annualBadge} featured />
    </div>
  </section>;
}

function CycleOption({ value, active, disabled, onChange, title, detail, badge, featured = false }) {
  return <button type="button" role="radio" aria-checked={active} disabled={disabled} onClick={() => onChange(value)} style={{ position: "relative", textAlign: "left", padding: "14px", borderRadius: 11, border: `1.5px solid ${active ? T.green : T.border}`, background: active ? "#F2F8EE" : "#FCFCFB", color: T.ink, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled && !active ? 0.55 : 1 }}>
    {featured && <span aria-hidden="true" style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", padding: "3px 8px", borderRadius: 99, background: T.green, color: "#fff", fontSize: 9, fontWeight: 800, letterSpacing: ".06em" }}>MELHOR OFERTA</span>}
    <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 14, fontWeight: 750 }}>{title}{badge && <span style={{ fontSize: 10, padding: "3px 6px", borderRadius: 99, background: "#DFF0D8", color: "#226122" }}>{badge}</span>}</span>
    <span style={{ display: "block", marginTop: 4, color: T.inkMid, fontSize: 12 }}>{detail}</span>
  </button>;
}
