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
  const recovery = !search || search === "?";
  const savedSelection = JSON.stringify(session?.user?.subscription?.checkout_selection ?? null);
  const persona = checkoutPersona(session?.user);
  const cycle = session?.user?.subscription?.billing_cycle || "monthly";
  useEffect(() => {
    if (recovery && session?.isBootstrapping) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort();
      setState({ status: "error", message: "A consulta demorou mais que o esperado. Tente novamente." });
    }, 10000);
    setState({ status: "loading" });
    async function loadQuote() {
      if (!recovery) return quoteCheckout(search, controller.signal);
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
  }, [search, attempt, recovery, session?.isBootstrapping, session?.isAuthenticated, savedSelection, persona, cycle]);

  const onOffer = useCallback((acceptedOffer) => setState({status:"ready",quote:acceptedOffer}), []);
  const quote = state.status === "ready" ? state.quote : null;
  return (
    <main className="fincla-scroll" style={{ ...G, height: "100%", overflowY: "auto", boxSizing: "border-box", background: T.bg, color: T.ink, padding: "32px 20px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <img src="/logo.png" alt="Fincla" width={40} height={40} />
        <h1 style={{ fontSize: 30, letterSpacing: "-0.03em", marginTop: 32 }}>Sua escolha no Fincla</h1>
        <p style={{ color: T.inkMid, lineHeight: 1.6 }}>Confira sua oferta e o período de contratação.</p>
        {state.status === "loading" && <p role="status">Consultando sua oferta…</p>}
        {state.status === "error" && <Card style={{ padding: 24 }}>
          <p role="alert">{state.message}</p>
          <Btn onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</Btn>
          {recovery && persona === "consultant" && <p><a href="https://fincla.com/para-consultores">Escolher vagas no site</a></p>}
          {session?.isAuthenticated && <Btn onClick={session.signOut}>Sair da conta</Btn>}
        </Card>}
        {quote && <Card style={{ padding: 28, marginTop: 24 }}>
          <h2>{quote.selection.persona === "personal" ? "Fincla Pessoal" : "Fincla Consultor"}</h2>
          {quote.capacity != null && <p>{quote.capacity} vagas contratadas · {quote.selection.mode === "package" ? `Pacote de ${quote.selection.package_size}` : "Preço progressivo"}</p>}
          <p style={{ ...NUM, fontSize: 38, fontWeight: 700, marginBottom: 8 }}>{money(quote.total_cents)}</p>
          {quote.capacity != null && <p style={{ color: T.inkMid, lineHeight: 1.6 }}>A capacidade é paga antecipadamente, inclusive as vagas vazias. Você pode preencher e reutilizar as vagas durante o período contratado.</p>}
          <p>{quote.selection.billing_cycle === "yearly" ? "Pagamento anual antecipado" : "Pagamento mensal antecipado"}</p>
          {session ? (session.isAuthenticated ? (persona !== quote.selection.persona ? <section style={{ marginTop: 24 }}>
            <p role="alert">Esta conta é do Fincla {persona === "consultant" ? "Consultor" : "Pessoal"}. Para contratar a outra área, use um perfil separado com outro email.</p>
            <Btn onClick={session.signOut}>Sair da conta</Btn>
          </section> : <CheckoutPayment quote={quote} session={session} onOffer={onOffer} onRefresh={() => setAttempt(value => value + 1)} />) : <CheckoutAccount quote={quote} session={session} />) : <p style={{ color: T.inkMid, lineHeight: 1.6 }}>A contratação online estará disponível em breve. Nenhuma cobrança foi realizada.</p>}
        </Card>}
      </div>
    </main>
  );
}
