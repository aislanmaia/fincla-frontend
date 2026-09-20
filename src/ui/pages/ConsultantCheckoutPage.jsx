import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckoutAccount } from "./CheckoutAccount.jsx";
import { CheckoutPayment } from "./CheckoutPayment.jsx";
import { quoteCheckout } from "../../api/checkout";
import { checkoutPersona } from "../features/auth/checkoutIdentity.js";
import { T } from "../tokens.js";
import { G, NUM, S } from "../typography.js";

const money = (cents) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);
const STEP_COPY = [
  ["01", "Defina sua carteira", "Escolha a capacidade e o ciclo da sua assinatura."],
  ["02", "Crie seu acesso", "Seus dados ficam prontos para concluir o pagamento."],
  ["03", "Finalize com segurança", "O acesso é liberado após a confirmação."],
];

function SelectionCard({ selected, onClick, title, copy, badge }) {
  return <button type="button" onClick={onClick} aria-pressed={selected} style={{ padding: "16px", textAlign: "left", borderRadius: 13, border: `1.5px solid ${selected ? "#315FB5" : T.border}`, background: selected ? "#EEF4FF" : T.surface, color: T.ink, cursor: "pointer" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}><strong style={{ fontSize: 14 }}>{title}</strong>{badge && <span style={{ padding: "3px 7px", borderRadius: 99, background: "#DDEAFE", color: "#254E95", fontSize: 11, fontWeight: 800 }}>{badge}</span>}</div><span style={{ display: "block", marginTop: 5, color: T.inkMid, fontSize: 12, lineHeight: 1.45 }}>{copy}</span></button>;
}

export function ConsultantCheckoutPage({ session }) {
  const savedSelection = session?.user?.subscription?.checkout_selection;
  const savedSelectionKey = JSON.stringify(savedSelection ?? null);
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 820);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState("progressive");
  const [seats, setSeats] = useState(10);
  const [packageSize, setPackageSize] = useState(25);
  const [cycle, setCycle] = useState("monthly");
  const [quoteState, setQuoteState] = useState({ status: "loading", quote: null, message: "" });
  const [accountDetails, setAccountDetails] = useState(null);
  const [quoteRefresh, setQuoteRefresh] = useState(0);
  const selectedSeats = mode === "package" ? Math.max(seats, packageSize) : seats;
  const selectionKey = `${mode}:${selectedSeats}:${mode === "package" ? packageSize : ""}:${cycle}`;
  const selection = useMemo(() => ({ persona: "consultant", billing_cycle: cycle, mode, seats: selectedSeats, ...(mode === "package" ? { package_size: packageSize } : {}) }), [cycle, mode, packageSize, selectedSeats]);

  useEffect(() => { const sync = () => setMobile(window.innerWidth < 820); window.addEventListener("resize", sync); return () => window.removeEventListener("resize", sync); }, []);
  useEffect(() => {
    if (!savedSelection || savedSelection.persona !== "consultant") return;
    setMode(savedSelection.mode === "package" ? "package" : "progressive");
    setSeats(Math.max(1, Number(savedSelection.seats) || 1));
    setPackageSize(Math.max(1, Number(savedSelection.package_size) || 25));
    setCycle(savedSelection.billing_cycle === "yearly" ? "yearly" : "monthly");
  }, [savedSelectionKey]);
  useEffect(() => {
    const controller = new AbortController();
    setQuoteState((current) => ({ status: "loading", quote: current.quote, message: "" }));
    const query = new URLSearchParams(Object.entries(selection).map(([key, value]) => [key, String(value)])).toString();
    quoteCheckout(query, controller.signal).then((nextQuote) => setQuoteState({ status: "ready", quote: nextQuote, message: "" })).catch((error) => { if (!controller.signal.aborted) setQuoteState({ status: "error", quote: null, message: error instanceof Error ? error.message : "Não foi possível consultar a oferta." }); });
    return () => controller.abort();
  }, [quoteRefresh, selectionKey]);

  const quote = quoteState.quote;
  const personaMismatch = session?.isAuthenticated && checkoutPersona(session.user) !== "consultant";
  const move = (next) => setStep(Math.max(0, Math.min(2, next)));
  const acceptOffer = useCallback((nextQuote) => setQuoteState({ status: "ready", quote: nextQuote, message: "" }), []);
  const refreshQuote = useCallback(() => setQuoteRefresh((value) => value + 1), []);
  const leftStep = STEP_COPY[step];
  return <main style={{ ...G, height: "100%", overflow: "hidden", display: "flex", flexDirection: mobile ? "column" : "row", background: T.bg, color: T.ink }}>
    <aside style={{ width: mobile ? "100%" : 334, minHeight: mobile ? 186 : "100%", flexShrink: 0, position: "relative", overflow: "hidden", padding: mobile ? "22px 22px 20px" : "38px 34px", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#183858", color: "#F7FBFF" }}>
      <div aria-hidden="true" style={{ position: "absolute", width: 240, height: 240, right: -96, top: -76, borderRadius: "50%", background: "rgba(147, 197, 253, .13)" }} />
      <a href="/signup" style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start", color: "#EAF3FF", fontSize: 13, fontWeight: 750, textDecoration: "none" }}><img src="/logo.png" alt="" width={26} height={26} />Fincla</a>
      <div style={{ position: "relative", marginTop: mobile ? 18 : 0 }}><p style={{ ...NUM, margin: 0, color: "rgba(147,197,253,.36)", fontSize: mobile ? 44 : 70, lineHeight: 1, fontWeight: 800 }}>{leftStep[0]}</p><h1 style={{ ...S, margin: "9px 0 8px", color: "#F7FBFF", fontSize: mobile ? 23 : 29, lineHeight: 1.15 }}>{leftStep[1]}</h1><p style={{ margin: 0, maxWidth: 240, color: "rgba(234,243,255,.7)", fontSize: 13, lineHeight: 1.58 }}>{leftStep[2]}</p></div>
      {!mobile && <nav aria-label="Progresso da contratação" style={{ position: "relative", display: "grid", gap: 10 }}>{STEP_COPY.map(([number, title], index) => <button key={number} type="button" onClick={() => index <= step && move(index)} disabled={index > step} style={{ display: "flex", alignItems: "center", gap: 9, padding: 0, border: 0, background: "transparent", color: index === step ? "#fff" : index < step ? "#B9D7FF" : "rgba(234,243,255,.38)", textAlign: "left", cursor: index <= step ? "pointer" : "default", fontSize: 12, fontWeight: index === step ? 800 : 650 }}><span style={{ display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: 99, background: index < step ? "#75B6F7" : index === step ? "#fff" : "rgba(255,255,255,.16)", color: index === step ? "#183858" : "#183858", fontSize: 11 }}>{index < step ? "✓" : index + 1}</span>{title}</button>)}</nav>}
    </aside>
    <section className="fincla-scroll" style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: "auto", background: "#F7F8F5" }}>
      <div aria-label={`Progresso: etapa ${step + 1} de 3`} role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step + 1} style={{ height: 8, background: "#DCE7F1" }}><div style={{ width: `${((step + 1) / 3) * 100}%`, height: "100%", borderRadius: "0 6px 6px 0", background: "#315FB5", transition: "width .32s ease" }} /></div>
      <div style={{ width: "min(100% - 40px, 620px)", margin: "0 auto", padding: mobile ? "24px 0 40px" : "42px 0 54px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 28 }}><span style={{ color: "#315FB5", fontSize: 12, fontWeight: 800, letterSpacing: ".09em" }}>ETAPA {step + 1} DE 3</span><a href="mailto:contato@fincla.com" style={{ color: T.inkMid, fontSize: 12, fontWeight: 700 }}>Precisa de ajuda?</a></div>
        {step === 0 && <section aria-labelledby="consultant-offer-title"><h2 id="consultant-offer-title" style={{ margin: 0, fontSize: mobile ? 28 : 34, letterSpacing: "-.035em" }}>Monte a assinatura para a sua carteira</h2><p style={{ margin: "10px 0 26px", color: T.inkMid, fontSize: 15, lineHeight: 1.6 }}>Você contrata uma capacidade de atendimento. As vagas não precisam ser preenchidas agora e ficam disponíveis durante o período.</p>
          <div style={{ display: "grid", gap: 11 }}><p style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>Como prefere contratar?</p><div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 10 }}><SelectionCard selected={mode === "progressive"} onClick={() => setMode("progressive")} title="Quantidade flexível" copy="Defina exatamente quantos clientes você atende." /><SelectionCard selected={mode === "package"} onClick={() => setMode("package")} title="Pacote de vagas" copy="Uma capacidade maior para sua carteira crescer." badge="MAIS USADO" /></div></div>
          <div style={{ marginTop: 24 }}><label htmlFor="consultant-seats" style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 800 }}>{mode === "package" ? "Quantos clientes você pretende atender?" : "Quantos clientes você atende hoje?"}</label><input id="consultant-seats" type="number" min="1" value={seats} onChange={(event) => setSeats(Math.max(1, Number(event.target.value) || 1))} style={{ ...G, width: "100%", boxSizing: "border-box", padding: "14px", border: `1.5px solid ${T.border}`, borderRadius: 12, background: T.surface, color: T.ink, fontSize: 16, fontWeight: 700 }} /></div>
          {mode === "package" && <div style={{ marginTop: 16 }}><p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800 }}>Escolha o pacote inicial</p><div role="radiogroup" aria-label="Pacote inicial" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 9 }}>{[25, 50, 100].map((size) => <button key={size} type="button" role="radio" aria-checked={packageSize === size} onClick={() => setPackageSize(size)} style={{ padding: "13px 8px", borderRadius: 11, border: `1.5px solid ${packageSize === size ? "#315FB5" : T.border}`, background: packageSize === size ? "#EEF4FF" : T.surface, color: T.ink, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>{size} vagas</button>)}</div></div>}
          <div style={{ marginTop: 24 }}><p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800 }}>Ciclo de contratação</p><div role="radiogroup" aria-label="Ciclo de contratação" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><SelectionCard selected={cycle === "monthly"} onClick={() => setCycle("monthly")} title="Mensal" copy="Renovação todo mês." /><SelectionCard selected={cycle === "yearly"} onClick={() => setCycle("yearly")} title="Anual" copy="Equivale a dez mensalidades." badge="2 MESES INCLUSOS" /></div></div>
          <OfferSummary quote={quote} loading={quoteState.status === "loading"} error={quoteState.message} /><button type="button" disabled={!quote || quoteState.status === "loading"} onClick={() => move(1)} style={{ ...G, width: "100%", minHeight: 50, marginTop: 24, border: 0, borderRadius: 12, background: quote && quoteState.status !== "loading" ? "#183858" : "#D5DEE8", color: quote && quoteState.status !== "loading" ? "#fff" : "#718092", fontSize: 14, fontWeight: 800, cursor: quote && quoteState.status !== "loading" ? "pointer" : "wait" }}>Continuar para seus dados →</button>
        </section>}
        {step === 1 && <section aria-labelledby="consultant-account-title"><h2 id="consultant-account-title" style={{ margin: 0, fontSize: mobile ? 28 : 34, letterSpacing: "-.035em" }}>Seu acesso profissional</h2><p style={{ margin: "10px 0 24px", color: T.inkMid, fontSize: 15, lineHeight: 1.6 }}>Criaremos sua conta junto da assinatura. Ela será liberada depois que o pagamento for confirmado.</p>{session?.isAuthenticated ? <><p style={{ padding: 14, borderRadius: 11, background: "#EEF4FF", color: T.inkMid, fontSize: 14 }}>Você está usando a conta <strong>{session.user?.email}</strong>.</p><button type="button" onClick={() => move(2)} style={{ ...G, width: "100%", minHeight: 50, marginTop: 16, border: 0, borderRadius: 12, background: "#183858", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Continuar para o pagamento →</button></> : <CheckoutAccount session={session} onContinue={(details) => { setAccountDetails(details); move(2); }} />}<BackButton onClick={() => move(0)} /></section>}
        {step === 2 && <section aria-labelledby="consultant-payment-heading"><h2 id="consultant-payment-heading" style={{ margin: 0, fontSize: mobile ? 28 : 34, letterSpacing: "-.035em" }}>Confirme sua assinatura</h2><p style={{ margin: "10px 0 20px", color: T.inkMid, fontSize: 15, lineHeight: 1.6 }}>Você só será cobrado após confirmar os dados do cartão.</p>{personaMismatch ? <div role="alert" style={{ padding: 16, borderRadius: 12, background: "#FFF2ED", color: T.inkMid, fontSize: 14, lineHeight: 1.55 }}>Esta conta já pertence à experiência pessoal. Para contratar o Fincla Consultor, use outro e-mail.</div> : quote && <CheckoutPayment quote={quote} accountDetails={accountDetails} session={session} onOffer={acceptOffer} onRefresh={refreshQuote} showStepLabel={false} />}<BackButton onClick={() => move(1)} /></section>}
      </div>
    </section>
  </main>;
}

function OfferSummary({ quote, loading, error }) {
  if (error) return <p role="alert" style={{ margin: "20px 0 0", padding: 13, borderRadius: 11, background: "#FFF2ED", color: T.inkMid, fontSize: 13 }}>{error}</p>;
  return <div aria-live="polite" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginTop: 24, padding: "16px 18px", borderRadius: 13, background: "#183858", color: "#fff" }}><div><p style={{ margin: 0, color: "#BBD7F7", fontSize: 11, fontWeight: 800, letterSpacing: ".08em" }}>SUA ASSINATURA</p><p style={{ margin: "4px 0 0", fontSize: 13, color: "#EAF3FF" }}>{loading ? "Atualizando a oferta" : `${quote?.capacity} vagas disponíveis`}</p></div><p aria-busy={loading || undefined} style={{ ...NUM, margin: 0, minWidth: 112, textAlign: "right", fontSize: 25, fontWeight: 800 }}>{loading ? <span style={{ display: "inline-block", width: 94, height: 25, borderRadius: 7, background: "#345776" }} /> : money(quote?.total_cents)}</p></div>;
}

function BackButton({ onClick }) { return <button type="button" onClick={onClick} style={{ ...G, marginTop: 26, padding: 0, border: 0, background: "transparent", color: T.inkMid, fontSize: 13, fontWeight: 750, textDecoration: "underline", cursor: "pointer" }}>← Voltar e revisar</button>; }
