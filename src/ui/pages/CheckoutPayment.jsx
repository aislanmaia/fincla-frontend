import { useEffect, useRef, useState } from "react";
import { CheckoutRequestError, currentCheckout, payCheckout, registerCheckout } from "../../api/checkout";
import { CancelSubscriptionDialog } from "../features/subscription/CancelSubscriptionDialog.jsx";
import { CheckoutBilling } from "./CheckoutBilling.jsx";
import { Btn } from "../components/primitives.jsx";
import { T } from "../tokens.js";
import { CheckoutField } from "./CheckoutAccount.jsx";

const money = (cents) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

function digits(value, maximum) {
  return String(value).replace(/\D/g, "").slice(0, maximum);
}

function formatCardNumber(value) {
  return digits(value, 19).replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(value) {
  const valueDigits = digits(value, 4);
  return valueDigits.length > 2 ? `${valueDigits.slice(0, 2)}/${valueDigits.slice(2)}` : valueDigits;
}

function formatPostalCode(value) {
  const valueDigits = digits(value, 8);
  return valueDigits.length > 5 ? `${valueDigits.slice(0, 5)}-${valueDigits.slice(5)}` : valueDigits;
}

export function CheckoutPayment({ quote, accountDetails, session, onOffer, onRefresh, onReadinessChange }) {
  const TERMS_VERSION = "2026-09-15";
  const [offerChanged, setOfferChanged] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [attempt, setAttempt] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [readyToPay, setReadyToPay] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(4);
  const submitting = useRef(false);
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (!session?.isAuthenticated) {
      setBusy(false);
      return undefined;
    }
    let alive = true;
    currentCheckout().then((value) => {
      if (!alive) return;
      setAttempt(value);
      if (value && value.status !== "declined") onOffer(value.quote);
    }).catch(() => { if (alive) setError("Não foi possível retomar a contratação. Verifique o pagamento antes de continuar."); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [session?.isAuthenticated, session?.user?.id, onOffer]);

  async function check() {
    if (submitting.current) return;
    setBusy(true); setError("");
    try {
      const value = await currentCheckout();
      setAttempt(value);
      if (value) onOffer(value.quote);
    } catch { setError("Não foi possível confirmar agora. Tente verificar novamente."); }
    finally { setBusy(false); }
  }
  async function pay(event) {
    event.preventDefault();
    if (submitting.current || busy) return;
    submitting.current = true; setBusy(true); setError("");
    const form = event.currentTarget;
    const fields = new FormData(form);
    let paymentSubmitted = false;
    try {
      if (accountDetails && !session?.isAuthenticated) {
        await registerCheckout({ selection: quote.selection, persona: quote.selection.persona, email: accountDetails.email, password: accountDetails.password, first_name: accountDetails.name, cpf_cnpj: accountDetails.cpfCnpj, phone: accountDetails.phone, billing_cycle: quote.selection.billing_cycle });
        await session.signIn(accountDetails.email, accountDetails.password);
      }
      paymentSubmitted = true;
      const value = await payCheckout({selection:quote.selection,catalog_version:quote.catalog_version,
        terms_version: TERMS_VERSION,
        card:{holderName:fields.get("name"),number:digits(fields.get("number"), 19),expiryMonth:String(fields.get("expiry")).slice(0, 2),expiryYear:`20${String(fields.get("expiry")).slice(-2)}`,ccv:digits(fields.get("ccv"), 4)},
        holder:{name:fields.get("name"),email:accountDetails?.email || session?.user?.email,cpfCnpj:accountDetails?.cpfCnpj || fields.get("cpf"),postalCode:digits(fields.get("postal"), 8),addressNumber:fields.get("address"),phone:accountDetails?.phone || fields.get("phone")}});
      setAttempt(value); onOffer(value.quote);
    } catch (failure) {
      if (failure instanceof CheckoutRequestError && failure.code === "checkout_offer_changed") {
        setOfferChanged(true);
        setError("A oferta mudou. Atualize o resumo e confira o novo valor antes de confirmar o pagamento.");
      } else if (!paymentSubmitted) {
        setError(failure instanceof Error ? failure.message : "Não foi possível preparar seu acesso. Confira os dados e tente novamente.");
      } else {
        // Browser uncertainty cannot authorize another payment submission.
        setAttempt({status:"reconciling"});
        setError("A resposta demorou ou foi interrompida. Verifique o resultado para continuar com segurança.");
      }
    } finally {
      form.reset(); setFormKey((value)=>value+1);
      submitting.current = false; setBusy(false);
    }
  }
  const active = attempt ? attempt.has_access === true : (session?.user?.subscription?.is_entitled !== false && session?.user?.subscription?.status === "active");
  const waiting = ["preparing", "processing", "reconciling", "pending_payment", "active"].includes(attempt?.status);
  const awaitingConfirmation = waiting && !active;

  useEffect(() => {
    if (!awaitingConfirmation) return undefined;
    const timer = window.setTimeout(async () => {
      try {
        const value = await currentCheckout();
        setAttempt(value);
        if (value) onOffer(value.quote);
      } catch {
        // The recovery action remains available; a transient polling failure
        // must not replace the calm confirmation state with an alarm.
      }
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [attempt?.status, awaitingConfirmation, onOffer]);

  useEffect(() => {
    if (!active) return undefined;
    setRedirectCountdown(4);
    const countdown = window.setInterval(() => {
      setRedirectCountdown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    const redirect = window.setTimeout(() => window.location.assign("/"), 4000);
    return () => {
      window.clearInterval(countdown);
      window.clearTimeout(redirect);
    };
  }, [active]);
  function updateReadiness(event) {
    setReadyToPay(event.currentTarget.checkValidity());
  }
  useEffect(() => {
    onReadinessChange?.(readyToPay);
    return () => onReadinessChange?.(false);
  }, [onReadinessChange, readyToPay]);
  return <section aria-labelledby="checkout-payment-title" style={{marginTop:24}}>
    {error && <p role="alert">{error}</p>}
    {busy && !attempt ? <ConfirmationCard tone="waiting"><div style={{ display:"flex", alignItems:"center", gap:11 }}><span aria-hidden="true" style={{ width:24, height:24, borderRadius:99, border:`3px solid ${T.border}`, borderTopColor:T.green, animation:"checkout-confirm-spin .8s linear infinite" }} /><div><div style={{ color:T.green, fontSize:11, fontWeight:800, letterSpacing:".09em" }}>ASSINATURA</div><h2 id="checkout-payment-title" style={{ margin:"3px 0 0", fontSize:23 }}>Carregando sua contratação</h2></div></div></ConfirmationCard> : active ? <ConfirmationCard tone="success">
      <div aria-hidden="true" style={{ display:"grid", placeItems:"center", width:48, height:48, borderRadius:99, background:"#DCF5E8", color:T.green, fontSize:25, fontWeight:900, boxShadow:"inset 0 0 0 1px rgba(8,151,99,.12)" }}>✓</div>
      <div><div style={{ color:T.green, fontSize:11, fontWeight:800, letterSpacing:".09em" }}>PAGAMENTO CONFIRMADO</div><h2 id="checkout-payment-title" style={{ margin:"4px 0 6px", fontSize:25 }}>Sua assinatura está ativa</h2><p style={{ margin:0, color:T.inkMid, lineHeight:1.55 }}>Tudo certo. Vamos abrir sua configuração inicial para deixar o Fincla pronto para você.</p></div>
      <div style={{ display:"grid", gap:8, marginTop:4 }}><div style={{ display:"flex", justifyContent:"space-between", color:T.inkMid, fontSize:12 }}><span>Preparando seu início</span><strong style={{ color:T.ink }}>{redirectCountdown}s</strong></div><div aria-hidden="true" style={{ height:5, overflow:"hidden", borderRadius:99, background:"#E4EEE8" }}><div style={{ height:"100%", width:`${((4 - redirectCountdown) / 4) * 100}%`, minWidth: redirectCountdown < 4 ? 8 : 0, borderRadius:"inherit", background:T.green, transition:"width .45s ease" }} /></div></div>
      <Btn variant="dark" full onClick={()=>window.location.assign("/")}>Abrir configuração inicial</Btn>
    </ConfirmationCard> : awaitingConfirmation ? <ConfirmationCard tone="waiting">
      <div style={{ display:"flex", alignItems:"center", gap:11 }}><span aria-hidden="true" style={{ width:26, height:26, borderRadius:99, border:`3px solid ${T.border}`, borderTopColor:T.green, animation:"checkout-confirm-spin .8s linear infinite" }} /><div><div style={{ color:T.green, fontSize:11, fontWeight:800, letterSpacing:".09em" }}>PAGAMENTO ENVIADO</div><h2 id="checkout-payment-title" style={{ margin:"3px 0 0", fontSize:24 }}>Estamos confirmando seu pagamento</h2></div></div>
      <p style={{ margin:0, color:T.inkMid, lineHeight:1.55 }}>Isso costuma levar poucos segundos. Acompanhe esta tela: ela será atualizada automaticamente assim que o Asaas confirmar a cobrança.</p>
      <div role="status" aria-live="polite" style={{ display:"grid", gap:10, padding:"13px 14px", borderRadius:11, background:"#F4F7F3", border:`1px solid ${T.border}` }}>
        <ConfirmationRow done label="Assinatura criada com segurança" />
        <ConfirmationRow done label="Pagamento enviado ao processador" />
        <ConfirmationRow loading label="Aguardando a confirmação do pagamento" />
      </div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, color:T.inkMid, fontSize:12 }}><span>Demorou mais que o esperado?</span><button type="button" disabled={busy} onClick={check} style={{ appearance:"none", border:0, padding:0, background:"transparent", color:T.green, fontWeight:800, textDecoration:"underline", cursor:busy ? "wait" : "pointer" }}>Atualizar agora</button></div>
      {["pending_payment", "active"].includes(attempt.status) && <details style={{ color:T.inkMid, fontSize:12 }}><summary style={{ cursor:"pointer" }}>Gerenciar ou cancelar esta assinatura</summary><div style={{ display:"grid", gap:12, marginTop:12 }}><CheckoutBilling /><Btn disabled={busy} onClick={() => setShowCancel(true)}>Cancelar assinatura</Btn></div></details>}
    </ConfirmationCard> : attempt?.status === "cancelled" ? <p>Assinatura cancelada. Entre em contato com o suporte para uma nova contratação.</p> : !busy && !error && <>
      {attempt?.status === "declined" && <p role="alert">Não foi possível concluir o pagamento. Confira os dados e tente novamente.</p>}
      <div style={{ marginBottom: 18 }}><div style={{ color: T.inkGhost, fontSize: 11, fontWeight: 750, letterSpacing: ".08em" }}>ETAPA 3 DE 3</div><h2 id="checkout-payment-title" style={{ margin: "2px 0 0", fontSize: 24 }}>Pague com cartão</h2></div>
      <form id="checkout-payment-form" key={formKey} onSubmit={pay} onInput={updateReadiness} onChange={updateReadiness} style={{display:"grid",gap:14}}>
        <div aria-label="Forma de pagamento selecionada" style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: `1.5px solid ${T.green}`, borderRadius: 10, background: "#F3F8F0", color: T.ink, fontSize: 13, fontWeight: 750 }}><span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 22, height: 22, borderRadius: 7, background: T.green, color: "#fff", fontSize: 14 }}>▭</span>Cartão de crédito</div>
        <CheckoutField label="Nome do titular" name="name" autoComplete="cc-name" />
        <CheckoutField label="Número do cartão" name="number" inputMode="numeric" autoComplete="cc-number" pattern="[0-9 ]{15,23}" maxLength={23} onInput={(event) => { event.currentTarget.value = formatCardNumber(event.currentTarget.value); }} />
        <div style={{display:"grid",gridTemplateColumns:"minmax(0, 2fr) minmax(0, 1fr)",gap:10}}>
          <CheckoutField label="Validade (MM/AA)" name="expiry" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" pattern="(0[1-9]|1[0-2])/[0-9]{2}" maxLength={5} onInput={(event) => { event.currentTarget.value = formatExpiry(event.currentTarget.value); }} />
          <CheckoutField label="CVV" name="ccv" type="password" inputMode="numeric" autoComplete="cc-csc" pattern="[0-9]{3,4}" maxLength={4} onInput={(event) => { event.currentTarget.value = digits(event.currentTarget.value, 4); }} />
        </div>
        {!accountDetails && <CheckoutField label="CPF/CNPJ do titular (somente números)" name="cpf" inputMode="numeric" pattern="[0-9]{11}|[0-9]{14}" />}
        <CheckoutField label="CEP" name="postal" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" pattern="[0-9]{5}-?[0-9]{3}" maxLength={9} onInput={(event) => { event.currentTarget.value = formatPostalCode(event.currentTarget.value); }} />
        <CheckoutField label="Número do endereço" name="address" />
        {!accountDetails && <CheckoutField label="Telefone com DDD (somente números)" name="phone" inputMode="tel" autoComplete="tel-national" pattern="[0-9]{10,13}" />}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "13px 14px", borderRadius: 10, background: "#F7E8E1", color: T.inkMid, fontSize: 12, lineHeight: 1.45 }}><span aria-hidden="true" style={{ display: "grid", placeItems: "center", flex: "0 0 auto", width: 24, height: 24, borderRadius: 99, background: "#E85D3B", color: "#fff", fontSize: 14 }}>▣</span><span>Conexão <strong>criptografada</strong>. Os dados do cartão são enviados com segurança para processar o pagamento e não ficam armazenados no Fincla.</span></div>
        <label style={{display:"flex",gap:10,alignItems:"flex-start",lineHeight:1.45,fontSize:12,color:T.inkMid}}><input type="checkbox" required name="terms" />Li e aceito os <a href="https://fincla.com/termos" target="_blank" rel="noreferrer">Termos de contratação</a>, versão {TERMS_VERSION}.</label>
        <label style={{display:"flex",gap:10,alignItems:"flex-start",lineHeight:1.45,fontSize:12,color:T.inkMid}}><input type="checkbox" required name="recurring" />Autorizo a cobrança e a renovação automática {quote.selection.billing_cycle === "yearly" ? "anual" : "mensal"}. Posso cancelar a renovação no meu perfil.</label>
        <Btn type="submit" variant="green" full disabled={busy || !readyToPay} style={{ minHeight: 44, fontSize: 14, boxShadow: readyToPay ? "0 7px 16px rgba(5, 150, 105, .20)" : "none" }}>{readyToPay ? `Assinar por ${money(quote.total_cents)}` : "Preencha os dados para continuar"}</Btn>
      </form>
    </>}
    {offerChanged && <Btn disabled={busy} onClick={onRefresh}>Atualizar oferta</Btn>}
    {error && !waiting && !offerChanged && <Btn disabled={busy} onClick={check}>Verificar pagamento</Btn>}
    {showCancel && <CancelSubscriptionDialog reactivationHint="Para uma nova contratação após cancelar, entre em contato com o suporte." onClose={() => setShowCancel(false)} onCancelled={() => { setShowCancel(false); setAttempt({status:"cancelled"}); }} />}
    {session?.isAuthenticated && <div style={{marginTop:20}}><Btn disabled={busy} onClick={session.signOut}>Sair da conta</Btn></div>}
  </section>;
}

function ConfirmationCard({ children, tone }) {
  return <><style>{"@keyframes checkout-confirm-spin { to { transform: rotate(360deg); } }"}</style><div style={{ display:"grid", gap:16, padding:"22px", border:`1px solid ${tone === "success" ? "#B8E7CC" : T.border}`, borderRadius:16, background:tone === "success" ? "linear-gradient(145deg, #FBFFFC, #F2FAF5)" : "#FFFEFB", boxShadow:"0 14px 34px rgba(38, 31, 22, .07)" }}>{children}</div></>;
}

function ConfirmationRow({ done, loading, label }) {
  return <div style={{ display:"flex", alignItems:"center", gap:9, color:done ? T.ink : T.inkMid, fontSize:13, fontWeight:done ? 700 : 500 }}><span aria-hidden="true" style={{ display:"grid", placeItems:"center", width:18, height:18, borderRadius:99, background:done ? "#DCF5E8" : "#F0E9DC", color:done ? T.green : T.inkMid, fontSize:12, fontWeight:900 }}>{done ? "✓" : loading ? "…" : ""}</span>{label}</div>;
}
