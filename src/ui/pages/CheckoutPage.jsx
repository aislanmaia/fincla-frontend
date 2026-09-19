import { useCallback, useEffect, useState } from "react";
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
  const effectiveSearch = selectionSearch || search;
  const recovery = !effectiveSearch || effectiveSearch === "?";
  const savedSelection = JSON.stringify(session?.user?.subscription?.checkout_selection ?? null);
  const persona = checkoutPersona(session?.user);
  const cycle = session?.user?.subscription?.billing_cycle || "monthly";
  useEffect(() => setSelectionSearch(search), [search]);
  useEffect(() => {
    if (recovery && session?.isBootstrapping) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort();
      setState({ status: "error", message: "A consulta demorou mais que o esperado. Tente novamente." });
    }, 10000);
    setState({ status: "loading" });
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
      if (!controller.signal.aborted) setState({ status: "ready", quote: receivedQuote });
    }).catch((error) => {
      if (!controller.signal.aborted) setState({ status: "error", message: error.message });
    }).finally(() => window.clearTimeout(timeout));
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [effectiveSearch, attempt, recovery, session?.isBootstrapping, session?.isAuthenticated, savedSelection, persona, cycle]);

  const onOffer = useCallback((acceptedOffer) => setState({status:"ready",quote:acceptedOffer}), []);
  const quote = state.status === "ready" ? state.quote : null;
  const step = session?.isAuthenticated ? 3 : 2;
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
    setState({ status: "loading" });
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
          <p style={{ color: T.green, fontSize: 12, fontWeight: 750, letterSpacing: ".08em", margin: 0 }}>FINALIZAR CONTRATAÇÃO</p>
          <h1 style={{ fontSize: 32, letterSpacing: "-.035em", lineHeight: 1.08, margin: "9px 0 0" }}>Configure sua assinatura</h1>
          <p style={{ color: T.inkMid, lineHeight: 1.6, margin: "10px 0 0" }}>Defina o período, crie seu acesso e confirme o pagamento no Fincla.</p>
        </div>
        {state.status === "loading" && <p role="status" style={{ color: T.inkMid, fontSize: 13, margin: "18px 0 0" }}>{quote ? "Atualizando o valor da sua oferta…" : "Consultando sua oferta…"}</p>}
        {state.status === "error" && <Card style={{ padding: 24 }}>
          <p role="alert">{state.message}</p>
          <Btn onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</Btn>
          {recovery && persona === "consultant" && <p><a href="https://fincla.com/para-consultores">Escolher vagas no site</a></p>}
          {session?.isAuthenticated && <Btn onClick={session.signOut}>Sair da conta</Btn>}
        </Card>}
        {quote && <>
          <CheckoutSteps activeStep={step} />
          <Card style={{ overflow: "hidden", marginTop: 18, border: "1px solid #DCE3D7", boxShadow: "0 18px 50px rgba(30, 43, 29, .10)" }}>
          <section style={{ background: "#182218", color: "#F8F7F5", padding: "24px 28px", display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "end" }}>
            <div>
              <div style={{ color: "#B5C6A8", fontSize: 12, letterSpacing: ".08em", fontWeight: 700 }}>OFERTA SELECIONADA</div>
              <h2 style={{ margin: "7px 0 0", fontSize: 24 }}>{quote.selection.persona === "personal" ? "Fincla Pessoal" : "Fincla Consultor"}</h2>
              {quote.capacity != null && <p style={{ ...NUM, color: "#D5E3CE", margin: "8px 0 0", lineHeight: 1.45 }}>{quote.capacity} vagas contratadas · {quote.selection.mode === "package" ? `Pacote de ${quote.selection.package_size}` : "Preço progressivo"}</p>}
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ ...NUM, fontSize: 32, fontWeight: 750, margin: 0, letterSpacing: "-.04em" }}>{money(quote.total_cents)}</p>
              <p style={{ color: "#B5C6A8", fontSize: 13, margin: "4px 0 0" }}>{quote.selection.billing_cycle === "yearly" ? "cobrança anual" : "cobrança mensal"}</p>
            </div>
          </section>
          <section style={{ padding: "28px", background: T.surface }}>
          <BillingCyclePicker value={quote.selection.billing_cycle} disabled={!canChangeCycle} onChange={changeCycle} />
          {quote.capacity != null && <p style={{ color: T.inkMid, lineHeight: 1.6, margin: "0 0 20px", padding: "12px 14px", background: "#F3F7F0", borderRadius: 10 }}>A capacidade é paga antecipadamente, inclusive vagas vazias. Você pode preenchê-las e reutilizá-las durante o período contratado.</p>}
          {session ? (session.isAuthenticated ? (persona !== quote.selection.persona ? <section style={{ marginTop: 4 }}>
            <p role="alert">Esta conta é do Fincla {persona === "consultant" ? "Consultor" : "Pessoal"}. Para contratar a outra área, use um perfil separado com outro email.</p>
            <Btn onClick={session.signOut}>Sair da conta</Btn>
          </section> : <CheckoutPayment quote={quote} session={session} onOffer={onOffer} onRefresh={() => setAttempt(value => value + 1)} />) : <CheckoutAccount quote={quote} session={session} />) : <p style={{ color: T.inkMid, lineHeight: 1.6 }}>A contratação online estará disponível em breve. Nenhuma cobrança foi realizada.</p>}
          </section>
          </Card>
        </>}
      </div>
    </main>
  );
}

function CheckoutSteps({ activeStep }) {
  const steps = ["Oferta", "Conta", "Pagamento"];
  return <ol aria-label="Etapas da contratação" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", padding: 0, margin: "28px 0 0", listStyle: "none", gap: 8 }}>
    {steps.map((label, index) => {
      const number = index + 1;
      const active = number === activeStep;
      const complete = number < activeStep;
      return <li key={label} aria-current={active ? "step" : undefined} style={{ display: "flex", alignItems: "center", gap: 8, color: active || complete ? T.ink : T.inkGhost, fontSize: 12, fontWeight: active ? 750 : 600 }}>
        <span aria-hidden="true" style={{ width: 22, height: 22, display: "grid", placeItems: "center", borderRadius: 99, background: active ? T.ink : complete ? T.green : "#E4E7E1", color: active || complete ? "#fff" : T.inkGhost, fontSize: 11 }}>{complete ? "✓" : number}</span>{label}
      </li>;
    })}
  </ol>;
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
