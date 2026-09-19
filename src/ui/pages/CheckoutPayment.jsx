import { useEffect, useRef, useState } from "react";
import { CheckoutRequestError, currentCheckout, payCheckout } from "../../api/checkout";
import { CancelSubscriptionDialog } from "../features/subscription/CancelSubscriptionDialog.jsx";
import { CheckoutBilling } from "./CheckoutBilling.jsx";
import { Btn } from "../components/primitives.jsx";
import { T } from "../tokens.js";
import { CheckoutField } from "./CheckoutAccount.jsx";

export function CheckoutPayment({ quote, session, onOffer, onRefresh }) {
  const TERMS_VERSION = "2026-09-15";
  const [offerChanged, setOfferChanged] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [attempt, setAttempt] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [readyToPay, setReadyToPay] = useState(false);
  const submitting = useRef(false);
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    let alive = true;
    currentCheckout().then((value) => {
      if (!alive) return;
      setAttempt(value);
      if (value && value.status !== "declined") onOffer(value.quote);
    }).catch(() => { if (alive) setError("Não foi possível retomar a contratação. Verifique o pagamento antes de continuar."); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [session.user?.id, onOffer]);

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
    try {
      const value = await payCheckout({selection:quote.selection,catalog_version:quote.catalog_version,
        terms_version: TERMS_VERSION,
        card:{holderName:fields.get("name"),number:String(fields.get("number")).replace(/\s/g,""),expiryMonth:fields.get("month"),expiryYear:fields.get("year"),ccv:fields.get("ccv")},
        holder:{name:fields.get("name"),email:session.user.email,cpfCnpj:fields.get("cpf"),postalCode:fields.get("postal"),addressNumber:fields.get("address"),phone:fields.get("phone")}});
      setAttempt(value); onOffer(value.quote);
    } catch (failure) {
      if (failure instanceof CheckoutRequestError && failure.code === "checkout_offer_changed") {
        setOfferChanged(true);
        setError("A oferta mudou. Atualize o resumo e confira o novo valor antes de confirmar o pagamento.");
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
  const active = attempt ? attempt.has_access === true : (session.user?.subscription?.is_entitled !== false && session.user?.subscription?.status === "active");
  const waiting = ["preparing", "processing", "reconciling", "pending_payment", "active"].includes(attempt?.status);
  function updateReadiness(event) {
    setReadyToPay(event.currentTarget.checkValidity());
  }
  return <section aria-labelledby="checkout-payment-title" style={{marginTop:24}}>
    <p style={{color:T.inkMid}}>Conta: {session.user?.email}</p>
    {error && <p role="alert">{error}</p>}
    {busy && <p role="status">Consultando a contratação…</p>}
    {active ? <><h2>Seu acesso está liberado</h2><Btn variant="dark" onClick={()=>window.location.assign(quote.selection.persona === "consultant" ? "/consultant/clients" : "/dashboard")}>Continuar para o Fincla</Btn></> : waiting ? <>
      <h2>{attempt.status === "active" ? "Verifique a renovação da sua assinatura" : attempt.status === "pending_payment" ? "Aguardando confirmação do pagamento" : "Confirmando o resultado da tentativa"}</h2>
      {attempt.status === "active" ? <p>O pagamento inicial já foi registrado, mas o acesso está indisponível. Consulte as faturas da assinatura e verifique a renovação para recuperar o acesso.</p> : <p>Você pode sair e voltar a esta página. Seu acesso será liberado quando o pagamento for confirmado.</p>}
      <Btn disabled={busy} onClick={check}>Verificar pagamento</Btn>
      {["pending_payment", "active"].includes(attempt.status) && <>
        <CheckoutBilling />
        <Btn disabled={busy} onClick={() => setShowCancel(true)}>Cancelar assinatura</Btn>
      </>}
    </> : attempt?.status === "cancelled" ? <p>Assinatura cancelada. Entre em contato com o suporte para uma nova contratação.</p> : !busy && !error && <>
      {attempt?.status === "declined" && <p role="alert">Não foi possível concluir o pagamento. Confira os dados e tente novamente.</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}><span style={{ width: 26, height: 26, borderRadius: 99, display: "grid", placeItems: "center", background: "#E8F2E2", color: "#2B632A", fontSize: 12, fontWeight: 800 }}>3</span><div><div style={{ color: T.inkGhost, fontSize: 11, fontWeight: 750, letterSpacing: ".08em" }}>ETAPA 3 DE 3</div><h2 id="checkout-payment-title" style={{ margin: "2px 0 0", fontSize: 24 }}>Pague com cartão</h2></div></div>
      <form key={formKey} onSubmit={pay} onInput={updateReadiness} onChange={updateReadiness} style={{display:"grid",gap:14}}>
        <CheckoutField label="Nome do titular" name="name" autoComplete="cc-name" />
        <CheckoutField label="Número do cartão" name="number" inputMode="numeric" autoComplete="cc-number" pattern="[0-9 ]{13,23}" />
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          <CheckoutField label="Mês (MM)" name="month" inputMode="numeric" autoComplete="cc-exp-month" pattern="0[1-9]|1[0-2]" maxLength={2} />
          <CheckoutField label="Ano (AAAA)" name="year" inputMode="numeric" autoComplete="cc-exp-year" pattern="20[0-9]{2}" maxLength={4} />
          <CheckoutField label="CVV" name="ccv" type="password" inputMode="numeric" autoComplete="cc-csc" pattern="[0-9]{3,4}" maxLength={4} />
        </div>
        <CheckoutField label="CPF/CNPJ do titular (somente números)" name="cpf" inputMode="numeric" pattern="[0-9]{11}|[0-9]{14}" />
        <CheckoutField label="CEP (somente números)" name="postal" inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{8}" />
        <CheckoutField label="Número do endereço" name="address" />
        <CheckoutField label="Telefone com DDD (somente números)" name="phone" inputMode="tel" autoComplete="tel-national" pattern="[0-9]{10,13}" />
        <label style={{display:"flex",gap:10,alignItems:"flex-start",lineHeight:1.5}}><input type="checkbox" required name="terms" />Li e aceito os <a href="https://fincla.com/termos" target="_blank" rel="noreferrer">Termos de contratação</a>, versão {TERMS_VERSION}.</label>
        <label style={{display:"flex",gap:10,alignItems:"flex-start",lineHeight:1.5}}><input type="checkbox" required name="recurring" />Autorizo a cobrança do valor apresentado agora e a renovação automática {quote.selection.billing_cycle === "yearly" ? "anual" : "mensal"} no cartão. Mudanças de preço serão comunicadas antes da renovação e exigirão meu novo aceite. Posso cancelar a renovação no meu perfil.</label>
        <Btn type="submit" variant="dark" full disabled={busy || !readyToPay}>Confirmar pagamento</Btn>
      </form>
    </>}
    {offerChanged && <Btn disabled={busy} onClick={onRefresh}>Atualizar oferta</Btn>}
    {error && !waiting && !offerChanged && <Btn disabled={busy} onClick={check}>Verificar pagamento</Btn>}
    {showCancel && <CancelSubscriptionDialog reactivationHint="Para uma nova contratação após cancelar, entre em contato com o suporte." onClose={() => setShowCancel(false)} onCancelled={() => { setShowCancel(false); setAttempt({status:"cancelled"}); }} />}
    <p style={{marginTop:20,color:T.inkMid}}>Para exercer arrependimento em até 7 dias, registre o pedido no seu perfil ou consulte os <a href="https://fincla.com/termos" target="_blank" rel="noreferrer">termos</a>.</p>
    <div style={{marginTop:20}}><Btn disabled={busy} onClick={session.signOut}>Sair da conta</Btn></div>
  </section>;
}
