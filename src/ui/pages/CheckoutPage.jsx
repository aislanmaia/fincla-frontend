import { useCallback, useEffect, useState } from "react";
import { CheckoutPayment } from "./CheckoutPayment.jsx";
import { CheckoutAccount } from "./CheckoutAccount.jsx";
import { currentCheckout, quoteCheckout } from "../../api/checkout";
import { T } from "../tokens.js";
import { G, NUM } from "../typography.js";
import { Card, Btn, PageTitle } from "../components/primitives.jsx";

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
    <main className="fincla-scroll" style={{ ...G, minHeight: "100%", overflowY: "auto", boxSizing: "border-box", background: "linear-gradient(135deg, #F8F7F5 0%, #F2F5EF 100%)", color: T.ink, padding: "28px 20px 56px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 28 }}>
          <img src="/logo.png" alt="Fincla" width={38} height={38} />
          <span style={{ fontSize: 12, letterSpacing: ".08em", fontWeight: 700, color: T.inkGhost }}>CONTRATAÇÃO SEGURA</span>
        </header>
        <div style={{ maxWidth: 470 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: T.green, fontSize: 12, fontWeight: 750, letterSpacing: ".08em" }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: T.green }} /> SUA ASSINATURA</div>
          <div style={{ marginTop: 10 }}><PageTitle sans="Sua escolha no" serif="Fincla" /></div>
          <p style={{ color: T.inkMid, lineHeight: 1.6, margin: "10px 0 0" }}>Revise a oferta. Em seguida, crie sua conta para seguir ao pagamento.</p>
        </div>
        {state.status === "loading" && <p role="status">Consultando sua oferta…</p>}
        {state.status === "error" && <Card style={{ padding: 24 }}>
          <p role="alert">{state.message}</p>
          <Btn onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</Btn>
          {recovery && persona === "consultant" && <p><a href="https://fincla.com/para-consultores">Escolher vagas no site</a></p>}
          {session?.isAuthenticated && <Btn onClick={session.signOut}>Sair da conta</Btn>}
        </Card>}
        {quote && <Card style={{ overflow: "hidden", marginTop: 28, border: "1px solid #DCE3D7", boxShadow: "0 18px 50px rgba(30, 43, 29, .10)" }}>
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
          {quote.capacity != null && <p style={{ color: T.inkMid, lineHeight: 1.6, margin: "0 0 20px", padding: "12px 14px", background: "#F3F7F0", borderRadius: 10 }}>A capacidade é paga antecipadamente, inclusive vagas vazias. Você pode preenchê-las e reutilizá-las durante o período contratado.</p>}
          {session ? (session.isAuthenticated ? (persona !== quote.selection.persona ? <section style={{ marginTop: 4 }}>
            <p role="alert">Esta conta é do Fincla {persona === "consultant" ? "Consultor" : "Pessoal"}. Para contratar a outra área, use um perfil separado com outro email.</p>
            <Btn onClick={session.signOut}>Sair da conta</Btn>
          </section> : <CheckoutPayment quote={quote} session={session} onOffer={onOffer} onRefresh={() => setAttempt(value => value + 1)} />) : <CheckoutAccount quote={quote} session={session} />) : <p style={{ color: T.inkMid, lineHeight: 1.6 }}>A contratação online estará disponível em breve. Nenhuma cobrança foi realizada.</p>}
          </section>
        </Card>}
      </div>
    </main>
  );
}
