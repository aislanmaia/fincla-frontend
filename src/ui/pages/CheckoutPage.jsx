import { useCallback, useEffect, useRef, useState } from "react";
import { CheckoutPayment } from "./CheckoutPayment.jsx";
import { CheckoutAccount, RegisteredCheckoutAccount } from "./CheckoutAccount.jsx";
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
  const [paymentReady, setPaymentReady] = useState(false);
  const [paymentErrorKind, setPaymentErrorKind] = useState(false);
  const [wide, setWide] = useState(() => typeof window === "undefined" || window.innerWidth >= 820);
  const [compactViewport, setCompactViewport] = useState(() => typeof window !== "undefined" && window.innerHeight < 1000);
  const [constrainedViewport, setConstrainedViewport] = useState(() => typeof window !== "undefined" && window.innerHeight < 700);
  const cycleChange = useRef(false);
  const effectiveSearch = selectionSearch || search;
  const recovery = !effectiveSearch || effectiveSearch === "?";
  const savedSelection = JSON.stringify(session?.user?.subscription?.checkout_selection ?? null);
  const persona = checkoutPersona(session?.user);
  const cycle = session?.user?.subscription?.billing_cycle || "monthly";
  useEffect(() => setSelectionSearch(search), [search]);
  useEffect(() => {
    const sync = () => {
      setWide(window.innerWidth >= 820);
      setCompactViewport(window.innerHeight < 1000);
      setConstrainedViewport(window.innerHeight < 700);
    };
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
    const counterpartCycle = quote.selection.billing_cycle === "yearly" ? "monthly" : "yearly";
    const counterpartSelection = {
      ...quote.selection,
      billing_cycle: counterpartCycle,
      installments: counterpartCycle === "monthly" ? 1 : (quote.selection.installments || 1),
    };
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
  const planName = quote?.selection.persona === "consultant" ? "Fincla Consultor" : "Fincla Pessoal";
  const cycleName = quote?.selection.billing_cycle === "yearly" ? "Anual" : "Mensal";
  const changeInstallments = useCallback((installments) => {
    if (!quote || installments === quote.selection.installments) return;
    const params = new URLSearchParams(effectiveSearch || "");
    for (const [key, value] of Object.entries(quote.selection)) {
      if (value != null) params.set(key, String(value));
    }
    params.set("installments", String(installments));
    const nextSearch = `?${params.toString()}`;
    window.history.replaceState({}, "", `${window.location.pathname}${nextSearch}`);
    cycleChange.current = true;
    setState((current) => ({ status: "loading", quote: current.quote, preserveQuote: true }));
    setSelectionSearch(nextSearch);
  }, [effectiveSearch, quote]);
  const changeCycle = useCallback((billingCycle) => {
    if (!quote || billingCycle === quote.selection.billing_cycle) return;
    const params = new URLSearchParams(effectiveSearch || "");
    for (const [key, value] of Object.entries(quote.selection)) {
      if (value != null) params.set(key, String(value));
    }
    params.set("billing_cycle", billingCycle);
    if (billingCycle === "monthly") params.set("installments", "1");
    const nextSearch = `?${params.toString()}`;
    window.history.replaceState({}, "", `${window.location.pathname}${nextSearch}`);
    cycleChange.current = true;
    setState((current) => ({ status: "loading", quote: current.quote, preserveQuote: true }));
    setSelectionSearch(nextSearch);
  }, [effectiveSearch, quote]);
  const toggleSection = useCallback((section) => {
    setActiveSection((current) => current === section ? null : section);
  }, []);
  return (
    <main className={wide ? undefined : "fincla-scroll"} style={{ ...G, height: "100%", minHeight: 0, display: "flex", flexDirection: "column", overflowX: "hidden", overflowY: wide ? "hidden" : "auto", boxSizing: "border-box", background: "#F7F8F5", color: T.ink, padding: wide ? "0 20px" : "0 16px 32px" }}>
      <div style={{ width: "100%", maxWidth: 1120, minHeight: 0, margin: "0 auto", display: "flex", flexDirection: "column", flex: wide ? 1 : undefined }}>
        <div style={{ flexShrink: 0, background: "#F7F8F5" }}>
          <header style={{ height: wide ? 66 : 58, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: wide ? 10 : 8 }}><img src="/logo.png" alt="Fincla" width={wide ? 28 : 25} height={wide ? 28 : 25} /><span style={{ fontWeight: 750, fontSize: 14 }}>Fincla</span><span aria-hidden="true" style={{ color: T.inkGhost }}>·</span><span style={{ color: T.inkMid, fontSize: 13 }}>Assinatura</span></div>
            <a href="mailto:contato@fincla.com" style={{ color: T.inkMid, fontSize: wide ? 13 : 12, textDecoration: "none", whiteSpace: "nowrap" }}>Ajuda</a>
          </header>
          <div style={{ maxWidth: 530, padding: wide ? (compactViewport ? "14px 0 12px" : "26px 0 18px") : "24px 0 20px" }}>
            <p style={{ color: T.green, fontSize: 12, fontWeight: 750, letterSpacing: ".08em", margin: 0 }}>ASSINATURA</p>
            <h1 style={{ fontSize: wide ? (compactViewport ? 26 : 30) : 27, letterSpacing: "-.035em", lineHeight: 1.08, margin: "8px 0 0" }}>Conclua sua contratação</h1>
            <p style={{ color: T.inkMid, lineHeight: 1.55, margin: "8px 0 0", fontSize: wide ? (compactViewport ? 14 : undefined) : 14 }}>Escolha o ciclo, informe seus dados e faça o pagamento com segurança.</p>
          </div>
        </div>
        {state.status === "loading" && !quote && <p role="status" style={{ color: T.inkMid, fontSize: 13, margin: "18px 0 0" }}>Consultando sua oferta…</p>}
        {state.status === "error" && <Card style={{ padding: 24 }}>
          <p role="alert">{state.message}</p>
          <Btn onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</Btn>
          {recovery && persona === "consultant" && <p><a href="https://fincla.com/para-consultores">Escolher vagas no site</a></p>}
          {session?.isAuthenticated && <Btn onClick={session.signOut}>Sair da conta</Btn>}
        </Card>}
        {quote && <div style={{ display: "grid", gridTemplateColumns: wide ? "minmax(0, 1.22fr) minmax(310px, .78fr)" : "1fr", gridTemplateRows: wide ? undefined : "max-content max-content", alignContent: "start", gap: wide ? 20 : 14, alignItems: "start", marginTop: wide ? (compactViewport ? 10 : 16) : 0, flex: wide ? 1 : undefined, minHeight: 0, overflowY: wide ? "hidden" : "visible" }}>
          <Card style={{ height: wide && ((activeSection && activeSection !== "plan") || constrainedViewport) ? "100%" : "auto", minHeight: 0, display: wide ? "flex" : "block", flexDirection: "column", overflow: "hidden", border: `1px solid ${T.border}`, order: wide ? 0 : 1 }}>
            <CheckoutPanel mobile={!wide} scrollable={wide && compactViewport} number="1" title="Plano e ciclo" detail="Escolha como prefere pagar" summary={`${planName} · ${cycleName} · ${money(quote.total_cents)}`} open={activeSection === "plan"} complete={accountVisited || Boolean(accountDetails) || session?.isAuthenticated} keepMounted onOpen={() => toggleSection("plan")}>
              <BillingCyclePicker value={quote.selection.billing_cycle} monthlyTotalCents={monthlyTotalCents} annualTotalCents={annualTotalCents} annualFreeMonths={annualFreeMonths} disabled={!canChangeCycle} onChange={changeCycle} />
              {quote.selection.persona === "personal" && quote.selection.billing_cycle === "yearly" && <InstallmentPicker value={quote.selection.installments || 1} quote={quote} disabled={!canChangeCycle} onChange={changeInstallments} />}
              {quote.capacity != null && <p style={{ color: T.inkMid, lineHeight: 1.6, margin: "0 0 20px", padding: "12px 14px", background: "#F3F7F0", borderRadius: 10 }}>A capacidade é paga antecipadamente, inclusive vagas vazias. Você pode preenchê-las e reutilizá-las durante o período contratado.</p>}
              <div style={{ marginBottom: 18 }}><Btn variant="dark" full onClick={() => { setAccountVisited(true); setActiveSection("account"); }}>Continuar</Btn></div>
            </CheckoutPanel>
            <CheckoutPanel mobile={!wide} scrollable={wide} number="2" title="Seus dados" detail="Informe seus dados de acesso" summary={accountDetails ? `${accountDetails.name} · ${accountDetails.email}` : session?.isAuthenticated ? session.user?.email : ""} open={activeSection === "account"} complete={Boolean(accountDetails) || session?.isAuthenticated} locked={!accountVisited && !session?.isAuthenticated} keepMounted={accountVisited} onOpen={() => { setAccountVisited(true); toggleSection("account"); }}>
              {session?.isAuthenticated ? <RegisteredCheckoutAccount details={accountDetails} email={session.user?.email} /> : session ? <CheckoutAccount session={session} onContinue={(details) => { setPaymentReady(false); setAccountDetails(details); setActiveSection("payment"); }} /> : <p style={{ color: T.inkMid }}>A contratação online estará disponível em breve.</p>}
            </CheckoutPanel>
            <CheckoutPanel mobile={!wide} scrollable={wide} number="3" title="Pagamento" detail="Finalize sua assinatura" errorDetail={paymentErrorKind === "fields" ? "Revise os campos destacados" : "Pagamento não aprovado. Tente novamente."} summary={`Cartão de crédito · ${money(quote.total_cents)}`} open={activeSection === "payment"} locked={!session?.isAuthenticated && !accountDetails} error={Boolean(paymentErrorKind)} keepMounted={Boolean(accountDetails) || session?.isAuthenticated} onOpen={() => toggleSection("payment")}>
              {(session?.isAuthenticated || accountDetails) && (session?.isAuthenticated && persona !== quote.selection.persona ? <section style={{ marginTop: 4 }}><p role="alert">Esta conta é do Fincla {persona === "consultant" ? "Consultor" : "Pessoal"}. Para contratar a outra área, use um perfil separado com outro email.</p><Btn onClick={session.signOut}>Sair da conta</Btn></section> : <CheckoutPayment quote={quote} accountDetails={accountDetails} session={session} onOffer={onOffer} onRefresh={() => setAttempt(value => value + 1)} onReadinessChange={setPaymentReady} onValidationErrorChange={setPaymentErrorKind} />)}
            </CheckoutPanel>
          </Card>
          <OrderSummary quote={quote} annualSavingsCents={annualSavingsCents} annualFreeMonths={annualFreeMonths} constrained={wide && compactViewport} compact={!wide} refreshing={state.status === "loading" && state.preserveQuote} readyToSubmit={Boolean(accountDetails || session?.isAuthenticated) && activeSection === "payment" && paymentReady} />
        </div>}
      </div>
    </main>
  );
}

function CheckoutPanel({ number, title, detail, errorDetail, summary, open, complete, locked, error = false, keepMounted = false, onOpen, children, scrollable = false, mobile = false }) {
  const openContent = open || keepMounted;
  return <section aria-labelledby={`checkout-step-${number}`} style={{ borderBottom: number === "3" ? 0 : `1px solid ${T.border}`, padding: open ? (mobile ? "18px 16px 0" : "22px 24px 0") : (mobile ? "15px 16px" : "18px 24px"), flex: scrollable && open ? "1 1 auto" : "0 0 auto", minHeight: 0, display: scrollable ? "flex" : "block", flexDirection: "column" }}>
    <button type="button" disabled={locked} onClick={onOpen} style={{ position: "relative", flexShrink: 0, display: "flex", flexWrap: mobile ? "wrap" : "nowrap", alignItems: "center", gap: mobile ? "3px 11px" : 11, width: "100%", padding: error ? "9px 10px" : 0, margin: error ? "-9px -10px" : 0, border: 0, borderRadius: error ? 10 : 0, background: error ? "#FFF5F2" : "transparent", color: locked ? "#AEB5BE" : T.ink, textAlign: "left", cursor: locked ? "not-allowed" : "pointer", boxShadow: error ? "inset 0 0 0 1px rgba(222, 76, 52, .18)" : undefined }}>
      <span aria-hidden="true" style={{ width: 27, height: 27, borderRadius: 9, display: "grid", placeItems: "center", background: error ? T.red : complete ? T.green : open ? T.ink : locked ? "#F3F4F2" : "#EEF0EC", color: error || complete || open ? "#fff" : locked ? "#AEB5BE" : T.inkGhost, fontSize: 12, fontWeight: 800 }}>{error ? "!" : complete ? "✓" : number}</span>
      <div style={{ minWidth: 0, paddingRight: mobile ? 24 : 0 }}><h2 id={`checkout-step-${number}`} style={{ fontSize: 16, margin: 0, color: error ? T.red : locked ? "#9DA5AF" : undefined }}>{title}</h2><p style={{ color: error ? "#B53D2B" : locked ? "#B5BCC4" : T.inkGhost, fontSize: 12, margin: "3px 0 0" }}>{error ? errorDetail : locked ? "Disponível após a etapa anterior" : detail}</p></div>{summary && !open && <span title={summary} style={{ order: mobile ? 3 : undefined, width: mobile ? "calc(100% - 38px)" : undefined, marginLeft: mobile ? 38 : "auto", marginTop: mobile ? 4 : undefined, maxWidth: mobile ? undefined : "45%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: locked ? "#B5BCC4" : T.inkMid, fontSize: 12, fontWeight: 700 }}>{summary}</span>}<span aria-hidden="true" style={{ position: mobile ? "absolute" : undefined, right: mobile ? 0 : undefined, top: mobile ? 6 : undefined, marginLeft: mobile ? undefined : (summary && !open ? 12 : "auto"), color: error ? T.red : locked ? "#B5BCC4" : T.inkMid, fontSize: 16, lineHeight: 1 }}>{open ? "▴" : "▾"}</span>
    </button>
    {openContent && <div hidden={!open} className={scrollable && open ? "fincla-scroll" : undefined} style={{ display: open ? "block" : "none", flex: scrollable && open ? "1 1 auto" : undefined, minHeight: 0, overflowY: scrollable && open ? "auto" : "visible", overflowX: "hidden", marginTop: mobile ? 18 : 22, paddingBottom: scrollable && open ? 26 : (mobile ? 4 : 0) }}>{children}</div>}
  </section>;
}

function OrderSummary({ quote, annualSavingsCents, annualFreeMonths, constrained, compact, refreshing, readyToSubmit }) {
  const planName = quote.selection.persona === "personal" ? "Fincla Pessoal" : "Fincla Consultor";
  const cycle = quote.selection.billing_cycle === "yearly" ? "anual" : "mensal";
  const annual = quote.selection.billing_cycle === "yearly";
  const twelveInstallments = annual && quote.selection.installments === 12;
  const monthlyEquivalent = annual ? Math.round(quote.total_cents / 12) : null;
  const benefits = quote.selection.persona === "personal" ? ["Assistente no WhatsApp para registro rápido de receitas e despesas, com áudio", "Lançamentos, recorrências e parcelamentos ilimitados", "Contas, saldo e cartões com gerenciamento e análise de faturas", "Relatórios e acompanhamento do fluxo de gastos", "Orçamentos, metas e projetos de vida", "Exportação dos seus dados quando quiser"] : ["Gestão da sua carteira de clientes", "Vagas contratadas para usar durante o período", "Acompanhamento financeiro por cliente", "Renovação e ajuste pelo seu perfil", "Suporte para sua operação"];
  return <aside style={{ order: compact ? 0 : 1, alignSelf: "start", height: constrained ? "100%" : "auto", minHeight: 0, overflowY: constrained ? "auto" : "visible", paddingRight: constrained ? 2 : 0 }}><Card style={{ overflow: "hidden", background: "#24201A", color: "#FFFDF8", border: 0, boxShadow: compact ? "0 8px 22px rgba(38, 31, 22, .12)" : undefined }}>
    <div style={{ padding: compact ? "16px" : "24px" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}><div><p style={{ color: "#C9BDAF", fontSize: 11, fontWeight: 750, letterSpacing: ".1em", margin: 0 }}>SEU PLANO</p><div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}><h2 style={{ margin: 0, fontSize: compact ? 17 : 23 }}>{planName}</h2><span style={{ padding: "4px 8px", borderRadius: 99, background: "#4B443C", color: "#F0E6D9", fontSize: 11, fontWeight: 750, textTransform: "capitalize" }}>{cycle}</span></div></div><div style={{ textAlign: "right" }}><p style={{ color: "#C9BDAF", fontSize: 11, margin: 0 }}>Hoje</p><p aria-busy={refreshing || undefined} aria-label={refreshing ? "Atualizando valor" : undefined} style={{ ...NUM, fontSize: compact ? 23 : 34, fontWeight: 750, letterSpacing: "-.04em", margin: "2px 0 0", minHeight: compact ? 28 : 41 }}>{refreshing ? <span aria-hidden="true" style={{ display: "block", width: compact ? 82 : "68%", height: compact ? 24 : 34, borderRadius: 7, background: "#51483D" }} /> : money(quote.total_cents)}</p></div></div>{quote.capacity != null && <p style={{ color: "#D6CCC0", fontSize: 13, margin: "8px 0 0" }}>{quote.capacity} vagas contratadas</p>}{!compact && <div style={{ borderTop: "1px solid #4A433B", marginTop: 22, paddingTop: 18 }}><p style={{ color: "#C9BDAF", fontSize: 12, margin: 0 }}>{annual ? twelveInstallments ? <><strong style={{ color: "#FFFDF8" }}>12x de {money(monthlyEquivalent)}</strong> · renovação anual.</> : <><strong style={{ color: "#FFFDF8" }}>{money(monthlyEquivalent)}/mês</strong> equivalente · renova a cada 12 meses.</> : "Cobrança mensal recorrente no cartão."}</p>{" "}</div>}</div>
    {annual && annualSavingsCents != null && annualSavingsCents > 0 && <div style={{ padding: "10px 24px", background: "#DFF0D8", color: "#17653A", fontSize: 12, fontWeight: 750 }}>✓ Você economiza {money(annualSavingsCents)}{annualFreeMonths ? ` (${annualFreeMonths} ${annualFreeMonths === 1 ? "mês grátis" : "meses grátis"})` : ""}</div>}
    <div style={{ padding: compact ? "12px 16px" : "20px 24px", background: "#FFFDF8", color: T.ink }}>{compact ? <MobileIncludedBenefits benefits={benefits} /> : <><p style={{ fontSize: 11, color: T.inkGhost, fontWeight: 750, letterSpacing: ".08em", margin: 0 }}>INCLUSO NO SEU PLANO</p><ul style={{ display: "grid", gap: 10, padding: 0, margin: "16px 0 0", listStyle: "none", fontSize: 13, color: T.inkMid }}>{benefits.map((benefit) => <li key={benefit} style={{ display: "flex", gap: 9 }}><span aria-hidden="true" style={{ color: T.green, fontWeight: 800 }}>✓</span>{benefit}</li>)}</ul><p style={{ margin: "14px 0 0", fontSize: 12, color: T.inkMid }}>… e <a href="https://fincla.com/recursos" target="_blank" rel="noreferrer" style={{ color: T.green, fontWeight: 750 }}>muito mais</a>.</p><button type={readyToSubmit ? "submit" : "button"} form={readyToSubmit ? "checkout-payment-form" : undefined} disabled={!readyToSubmit} style={{ ...G, width: "100%", marginTop: 20, padding: "13px 16px", border: 0, borderRadius: 10, background: readyToSubmit ? T.green : "#D9DEDA", color: readyToSubmit ? "#fff" : "#7D8580", fontSize: 14, fontWeight: 750, cursor: readyToSubmit ? "pointer" : "not-allowed", boxShadow: readyToSubmit ? "0 7px 16px rgba(5, 150, 105, .20)" : "none" }}>{readyToSubmit ? `Assinar por ${money(quote.total_cents)}` : "Preencha os dados para continuar"} <span aria-hidden="true" style={{ marginLeft: 4 }}>→</span></button><div style={{ display: "grid", gap: 9, marginTop: 20, paddingTop: 18, borderTop: `1px solid ${T.border}`, color: T.inkMid, fontSize: 12, lineHeight: 1.4 }}><p style={{ margin: 0 }}>♧ <strong style={{ color: T.ink }}>Garantia de 7 dias.</strong> Reembolso integral se não fizer sentido para você.</p></div><div aria-label="Informações de segurança" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 14px", marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}`, color: T.inkGhost, fontSize: 11 }}><span>♙ Ambiente seguro</span><span>♢ Dados protegidos</span><span>✓ Compra garantida</span></div></>}</div>
  </Card></aside>;
}

function MobileIncludedBenefits({ benefits }) {
  return <details>
    <summary style={{ cursor: "pointer", color: T.inkMid, fontSize: 12, fontWeight: 750 }}>Ver o que está incluso no plano</summary>
    <div aria-label="Itens inclusos no plano" style={{ maxHeight: "clamp(220px, 34dvh, 320px)", overflowY: "auto", overscrollBehavior: "contain", scrollbarWidth: "thin", scrollbarColor: "#A8B0A9 transparent", padding: "13px 8px 2px 0", marginTop: 1 }}>
      <ul style={{ display: "grid", gap: 9, padding: 0, margin: 0, listStyle: "none", fontSize: 12, color: T.inkMid }}>{benefits.map((benefit) => <li key={benefit} style={{ display: "flex", gap: 8 }}><span aria-hidden="true" style={{ color: T.green, fontWeight: 800 }}>✓</span>{benefit}</li>)}</ul>
      <p style={{ margin: "13px 0 0", fontSize: 12, color: T.inkMid }}>… e <a href="https://fincla.com/recursos" target="_blank" rel="noreferrer" style={{ color: T.green, fontWeight: 750 }}>muito mais</a>.</p>
    </div>
  </details>;
}

function InstallmentPicker({ value, quote, disabled, onChange }) {
  const options = quote.installment_options || [];
  const selectedOption = options.find((item) => item.installments === value) || quote;
  const selectedRegularInstallment = selectedOption.regular_installment_cents ?? Math.floor(selectedOption.total_cents / value);
  const selectedFinalInstallment = selectedOption.final_installment_cents ?? selectedOption.total_cents - selectedRegularInstallment * (value - 1);
  const hasFinalAdjustment = selectedFinalInstallment !== selectedRegularInstallment;
  return <label style={{ display: "grid", gap: 7, margin: "-8px 0 24px", color: T.ink, fontSize: 13, fontWeight: 750 }}>
    Em quantas vezes?
    <select aria-label="Parcelas do plano anual" value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} style={{ ...G, width: "100%", padding: "12px 13px", border: `1px solid ${T.border}`, borderRadius: 10, background: "#FCFCFB", color: T.ink, fontSize: 14 }}>
      {Array.from({ length: 12 }, (_, index) => index + 1).map((count) => {
        const option = options.find((item) => item.installments === count) || (count === value ? quote : null);
        if (!option) return null;
        const total = option.total_cents;
        const regularInstallment = option.regular_installment_cents ?? Math.floor(total / count);
        const installmentLabel = `${count}x de ${money(regularInstallment)}`;
        return <option key={count} value={count}>{installmentLabel} · total {money(total)}</option>;
      })}
    </select>
    {hasFinalAdjustment && <span style={{ color: T.inkMid, fontSize: 12, fontWeight: 500, lineHeight: 1.45 }}>A última parcela pode variar alguns centavos por arredondamento.</span>}
  </label>;
}

function BillingCyclePicker({ value, monthlyTotalCents, annualTotalCents, annualFreeMonths, disabled, onChange }) {
  const annualMonthlyEquivalent = annualTotalCents == null ? null : Math.round(annualTotalCents / 12);
  const annualBadge = annualFreeMonths != null && annualFreeMonths > 0 ? `${annualFreeMonths} ${annualFreeMonths === 1 ? "mês grátis" : "meses grátis"}` : undefined;
  return <section aria-labelledby="billing-cycle-heading" style={{ margin: "0 0 24px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, marginBottom: 10 }}>
      <div><div style={{ color: T.inkGhost, fontSize: 11, fontWeight: 750, letterSpacing: ".08em", marginBottom: 3 }}>ETAPA 1 DE 3</div><h2 id="billing-cycle-heading" style={{ fontSize: 18, margin: 0 }}>Período de contratação</h2><p style={{ color: T.inkMid, fontSize: 13, margin: "4px 0 0" }}>Você pode escolher mensal ou anual antes de continuar.</p></div>
    </div>
    <div role="radiogroup" aria-label="Período de contratação" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <CycleOption value="monthly" active={value === "monthly"} disabled={disabled} onChange={onChange} title="Mensal" detail={monthlyTotalCents == null ? "" : `${money(monthlyTotalCents)}/mês`} />
      <CycleOption value="yearly" active={value === "yearly"} disabled={disabled} onChange={onChange} title="Anual" detail={annualMonthlyEquivalent == null ? "" : `${money(annualMonthlyEquivalent)}/mês`} badge={annualBadge} featured />
    </div>
  </section>;
}

function CycleOption({ value, active, disabled, onChange, title, detail, badge, featured = false }) {
  return <button type="button" role="radio" aria-checked={active} disabled={disabled} onClick={() => onChange(value)} style={{ position: "relative", textAlign: "left", padding: "14px", borderRadius: 11, border: `1.5px solid ${active ? T.green : T.border}`, background: active ? "#F2F8EE" : "#FCFCFB", color: T.ink, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled && !active ? 0.55 : 1 }}>
    {featured && <span aria-hidden="true" style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", padding: "3px 8px", borderRadius: 99, background: T.green, color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: ".06em" }}>MELHOR OFERTA</span>}
    <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 14, fontWeight: 750 }}>{title}{badge && <span style={{ fontSize: 11, padding: "3px 6px", borderRadius: 99, background: "#DFF0D8", color: "#226122" }}>{badge}</span>}</span>
    <span style={{ display: "block", marginTop: 4, color: T.inkMid, fontSize: 12 }}>{detail}</span>
  </button>;
}
