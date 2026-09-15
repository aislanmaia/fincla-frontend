import { useState } from "react";
import { registerCheckout } from "../../api/checkout";
import { T } from "../tokens.js";
import { Btn } from "../components/primitives.jsx";

export function CheckoutField({ label, ...props }) {
  return <label style={{ display: "grid", gap: 6, fontSize: 13, color: T.inkMid }}>
    {label}<input {...props} required style={{ width: "100%", boxSizing: "border-box", padding: 12, border: `1px solid ${T.border}`, borderRadius: 9, background: T.surface, color: T.ink, font: "inherit" }} />
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
      if (!login) await registerCheckout({ email, password, first_name: fields.get("name"), billing_cycle: quote.selection.billing_cycle });
      await session.signIn(email, password);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <section style={{ marginTop: 24 }}>
    <h2>{login ? "Entre para continuar" : "Crie sua conta"}</h2>
    <p style={{ color: T.inkMid }}>Sua escolha fica preservada. O acesso será liberado após a confirmação do pagamento.</p>
    <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
      {!login && <CheckoutField label="Nome" name="name" autoComplete="given-name" />}
      <CheckoutField label="Email" name="email" type="email" autoComplete="email" />
      <CheckoutField label="Senha" name="password" type="password" minLength={8} autoComplete={login ? "current-password" : "new-password"} />
      {error && <p role="alert">{error}</p>}
      <Btn type="submit" variant="dark" disabled={busy}>{busy ? "Aguarde…" : login ? "Entrar e continuar" : "Criar conta e continuar"}</Btn>
      <Btn type="button" disabled={busy} onClick={() => { setLogin(!login); setError(""); }}>{login ? "Quero criar uma conta" : "Já tenho uma conta"}</Btn>
    </form>
  </section>;
}
