import { useId, useState } from "react";
import { T } from "../tokens.js";
import { Btn } from "../components/primitives.jsx";

export function CheckoutField({ label, hint, error, ...props }) {
  const generatedId = useId();
  const id = props.id || `checkout-field-${generatedId}`;
  return <div style={{ display: "grid", gap: 7, fontSize: 12, fontWeight: 700, letterSpacing: ".015em", color: T.inkMid }}>
    <label htmlFor={id}>{label}</label><span style={{ position: "relative", display: "block" }}><input {...props} id={id} aria-invalid={Boolean(error) || undefined} required style={{ width: "100%", boxSizing: "border-box", padding: hint ? "13px 142px 13px 14px" : "13px 14px", border: `1px solid ${error ? T.red : T.border}`, borderRadius: 10, background: "#FCFCFB", color: T.ink, font: "inherit", outlineColor: T.green }} />{hint && <span aria-live="polite" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", display: "inline-flex", alignItems: "center", gap: 5, color: T.green, fontSize: 10, fontWeight: 750, whiteSpace: "nowrap" }}><span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 16, height: 16, borderRadius: 99, background: T.green, color: "#fff", fontSize: 10 }}>✓</span>{hint}</span>}</span>
    {error && <span role="alert" style={{ color: T.red, fontSize: 11, fontWeight: 600, letterSpacing: 0 }}>{error}</span>}
  </div>;
}

export function CheckoutAccount({ session, onContinue }) {
  const [login, setLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState({});
  const [values, setValues] = useState({ name: "", email: "", cpfCnpj: "", phone: "", password: "", passwordConfirmation: "" });
  const validEmail = /^\S+@\S+\.\S+$/.test(values.email);
  const validDocument = /^\d{11}$|^\d{14}$/.test(values.cpfCnpj);
  const validPhone = /^\d{10,13}$/.test(values.phone);
  const canSubmit = !busy && validEmail && values.password.length >= 8 && (login || (values.name.trim().length > 1 && validDocument && validPhone && values.password === values.passwordConfirmation));
  const fieldError = (field) => {
    if (!touched[field]) return "";
    if (field === "name" && values.name.trim().length < 2) return "Informe seu nome completo.";
    if (field === "email" && !validEmail) return "Informe um email válido.";
    if (field === "cpfCnpj" && !validDocument) return "Use um CPF (11) ou CNPJ (14) somente com números.";
    if (field === "phone" && !validPhone) return "Use o celular com DDD, somente números.";
    if (field === "password" && values.password.length < 8) return "Use pelo menos 8 caracteres.";
    if (field === "passwordConfirmation" && values.passwordConfirmation && values.password !== values.passwordConfirmation) return "As senhas não coincidem.";
    return "";
  };
  const touch = (field) => () => setTouched((current) => ({ ...current, [field]: true }));
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    const fields = new FormData(event.currentTarget);
    const email = fields.get("email"), password = fields.get("password");
    try {
      if (login) {
        await session.signIn(email, password);
      } else {
        onContinue?.({ name: String(fields.get("name")), email: String(email), cpfCnpj: String(fields.get("cpfCnpj")), phone: String(fields.get("phone")), password: String(password) });
      }
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby={login ? "checkout-account-title" : undefined} aria-label={login ? undefined : "Dados de acesso"} style={{ marginTop: 2 }}>
    {login && <h2 id="checkout-account-title" style={{ margin: "0 0 14px", fontSize: 20 }}>Entre para continuar</h2>}
    <p style={{ color: T.inkMid, margin: "0 0 22px", lineHeight: 1.6 }}>{login ? "Use os dados da conta que já contratou esta oferta." : "Informe os dados que usará no Fincla. Sua conta será criada ao confirmar a assinatura e o acesso será liberado após o pagamento."}</p>
    <form onSubmit={submit} style={{ display: "grid", gap: 15 }}>
      {!login && <CheckoutField label="Nome" name="name" autoComplete="given-name" value={values.name} error={fieldError("name")} onBlur={touch("name")} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} />}
      <CheckoutField label="Email" name="email" type="email" autoComplete="email" value={values.email} error={fieldError("email")} onBlur={touch("email")} onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))} />
      {!login && <><CheckoutField label="CPF/CNPJ (somente números)" name="cpfCnpj" inputMode="numeric" pattern="[0-9]{11}|[0-9]{14}" value={values.cpfCnpj} error={fieldError("cpfCnpj")} onBlur={touch("cpfCnpj")} onChange={(event) => setValues((current) => ({ ...current, cpfCnpj: event.target.value.replace(/\D/g, "") }))} /><CheckoutField label="Celular com DDD (somente números)" name="phone" inputMode="tel" autoComplete="tel-national" pattern="[0-9]{10,13}" value={values.phone} error={fieldError("phone")} onBlur={touch("phone")} onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value.replace(/\D/g, "") }))} /></>}
      <CheckoutField label="Senha" name="password" type="password" minLength={8} autoComplete={login ? "current-password" : "new-password"} value={values.password} error={fieldError("password")} hint={!login && values.password && values.password === values.passwordConfirmation ? "As senhas coincidem" : ""} onBlur={touch("password")} onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))} />
      {!login && <CheckoutField label="Confirme sua senha" name="passwordConfirmation" type="password" minLength={8} autoComplete="new-password" value={values.passwordConfirmation} error={fieldError("passwordConfirmation")} hint={values.password && values.password === values.passwordConfirmation ? "As senhas coincidem" : ""} onBlur={touch("passwordConfirmation")} onChange={(event) => setValues((current) => ({ ...current, passwordConfirmation: event.target.value }))} />}
      {!login && <p style={{ color: T.inkGhost, fontSize: 12, lineHeight: 1.5, margin: "-3px 0 0" }}>Use pelo menos 8 caracteres na senha.</p>}
      {error && <p role="alert" style={{ color: T.red, margin: 0 }}>{error}</p>}
      <Btn type="submit" variant="dark" full disabled={!canSubmit}>{busy ? "Aguarde…" : canSubmit ? "Continuar para o pagamento" : "Preencha seus dados para continuar"}</Btn>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: T.inkGhost, fontSize: 13, paddingTop: 2 }}>
        <span>{login ? "Ainda não tem conta?" : "Já tem uma conta?"}</span><button type="button" disabled={busy} onClick={() => { setLogin(!login); setError(""); }} style={{ border: 0, padding: 0, background: "transparent", color: T.ink, font: "inherit", fontWeight: 750, textDecoration: "underline", cursor: "pointer" }}>{login ? "Criar conta" : "Entrar"}</button>
      </div>
    </form>
    {!login && <p style={{ color: T.inkGhost, fontSize: 12, lineHeight: 1.5, margin: "22px 0 0" }}>Pessoal e Consultor usam perfis separados. Para contratar a outra área, use outro email.</p>}
  </section>;
}
