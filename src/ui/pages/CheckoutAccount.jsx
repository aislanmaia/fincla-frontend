import { useState } from "react";
import { registerCheckout } from "../../api/checkout";
import { T } from "../tokens.js";
import { Btn } from "../components/primitives.jsx";

export function CheckoutField({ label, ...props }) {
  return <label style={{ display: "grid", gap: 7, fontSize: 12, fontWeight: 700, letterSpacing: ".015em", color: T.inkMid }}>
    {label}<input {...props} required style={{ width: "100%", boxSizing: "border-box", padding: "13px 14px", border: `1px solid ${T.border}`, borderRadius: 10, background: "#FCFCFB", color: T.ink, font: "inherit", outlineColor: T.green }} />
  </label>;
}

export function CheckoutAccount({ quote, session }) {
  const [login, setLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    const fields = new FormData(event.currentTarget);
    const email = fields.get("email"), password = fields.get("password");
    try {
      if (!login) await registerCheckout({ selection: quote.selection, persona: quote.selection.persona, email, password, first_name: fields.get("name"), billing_cycle: quote.selection.billing_cycle });
      await session.signIn(email, password);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="checkout-account-title" style={{ marginTop: 2 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
      <span style={{ width: 26, height: 26, borderRadius: 99, display: "grid", placeItems: "center", background: "#E8F2E2", color: "#2B632A", fontSize: 12, fontWeight: 800 }}>1</span>
      <div><div style={{ color: T.inkGhost, fontSize: 11, fontWeight: 750, letterSpacing: ".08em" }}>ETAPA 1 DE 2</div><h2 id="checkout-account-title" style={{ margin: "2px 0 0", fontSize: 24 }}>{login ? "Entre para continuar" : "Crie sua conta"}</h2></div>
    </div>
    <p style={{ color: T.inkMid, margin: "0 0 18px", lineHeight: 1.6 }}>{login ? "Use os dados da conta que já contratou esta oferta." : "Seus dados criam o acesso. Você seguirá ao pagamento logo depois."}</p>
    {!login && <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 10, background: "#F6F7F4", color: T.inkMid, fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}><span aria-hidden="true" style={{ color: T.green, fontWeight: 900 }}>✓</span><span>Sua oferta fica preservada. O acesso é liberado somente depois da confirmação do pagamento.</span></div>}
    <form onSubmit={submit} style={{ display: "grid", gap: 15 }}>
      {!login && <CheckoutField label="Nome" name="name" autoComplete="given-name" />}
      <CheckoutField label="Email" name="email" type="email" autoComplete="email" />
      <CheckoutField label="Senha" name="password" type="password" minLength={8} autoComplete={login ? "current-password" : "new-password"} />
      {!login && <p style={{ color: T.inkGhost, fontSize: 12, lineHeight: 1.5, margin: "-3px 0 0" }}>Use pelo menos 8 caracteres na senha.</p>}
      {error && <p role="alert" style={{ color: T.red, margin: 0 }}>{error}</p>}
      <Btn type="submit" variant="dark" full disabled={busy}>{busy ? "Aguarde…" : login ? "Entrar e continuar" : "Criar conta e continuar"}</Btn>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: T.inkGhost, fontSize: 13, paddingTop: 2 }}>
        <span>{login ? "Ainda não tem conta?" : "Já tem uma conta?"}</span><button type="button" disabled={busy} onClick={() => { setLogin(!login); setError(""); }} style={{ border: 0, padding: 0, background: "transparent", color: T.ink, font: "inherit", fontWeight: 750, textDecoration: "underline", cursor: "pointer" }}>{login ? "Criar conta" : "Entrar"}</button>
      </div>
    </form>
    {!login && <p style={{ color: T.inkGhost, fontSize: 12, lineHeight: 1.5, margin: "22px 0 0" }}>Pessoal e Consultor usam perfis separados. Para contratar a outra área, use outro email.</p>}
  </section>;
}
