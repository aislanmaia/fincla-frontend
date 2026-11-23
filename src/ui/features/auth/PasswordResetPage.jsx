import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
} from "lucide-react";
import { T } from "../../tokens";
import { G } from "../../typography";

/* ─── RESET PASSWORD (token na URL) ───────────────────────── */
/* ─── RESET PASSWORD (token na URL) ───────────────────────── */
export function PasswordResetPage({ token, onResetPassword, onComplete, onValidateToken, onRequestNewLink }) {
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  // Pré-validação do token: "checking" | "ok" | "invalid". Sem token → inválido.
  // Sem `onValidateToken` (ou erro de rede) → segue para o form (fail-open).
  const [linkStatus, setLinkStatus] = useState(() => (token?.trim() ? "checking" : "invalid"));
  // The API says when the link is an invite to create the FIRST password (#342);
  // without that answer (older API, network error) the screen keeps the reset copy.
  const [firstPassword, setFirstPassword] = useState(false);
  // An expired invite (3 days) reaches people who never logged in and don't know
  // "Esqueci minha senha": the expired screen asks for a new link right there.
  const [newLinkEmail, setNewLinkEmail] = useState("");
  const [newLinkState, setNewLinkState] = useState("idle"); // "idle" | "sending" | "sent"
  const [newLinkError, setNewLinkError] = useState("");
  const [sentTo, setSentTo] = useState("");
  // Each forgot-password request voids the previous link: a second Enter while the
  // first is in flight would send two e-mails and leave only the last one working.
  const sendingNewLink = useRef(false);

  const requestNewLink = async () => {
    const email = newLinkEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setNewLinkError("Informe o e-mail da sua conta."); return; }
    if (sendingNewLink.current) return;
    sendingNewLink.current = true;
    setNewLinkState("sending"); setNewLinkError("");
    try {
      await onRequestNewLink(email);
      setSentTo(email);
      setNewLinkState("sent");
    } catch (nextError) {
      setNewLinkState("idle");
      setNewLinkError(nextError instanceof Error && nextError.message ? nextError.message : "Não foi possível enviar o e-mail. Tente novamente.");
    } finally {
      sendingNewLink.current = false;
    }
  };
  const canRequestNewLink = typeof onRequestNewLink === "function";

  useEffect(() => {
    let cancelled = false;
    const t = token?.trim();
    if (!t) { setLinkStatus("invalid"); return; }
    if (typeof onValidateToken !== "function") { setLinkStatus("ok"); return; }
    setLinkStatus("checking");
    setFirstPassword(false);
    onValidateToken(t)
      .then((res) => { if (!cancelled) { setLinkStatus(res?.valid ? "ok" : "invalid"); setFirstPassword(res?.valid === true && res?.first_password === true); } })
      .catch(() => { if (!cancelled) setLinkStatus("ok"); }); // rede falhou → deixa tentar
    return () => { cancelled = true; };
  }, [token, onValidateToken]);

  const BtnPrimary = ({ onClick, children, disabled }) => (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ ...G, width:"100%", padding:"14px", background: disabled ? T.inkFaint : T.ink, color:"#fff", border:"none", borderRadius:11, fontSize:14, fontWeight:700, cursor: disabled ? "not-allowed" : "pointer", transition:"opacity 0.15s, transform 0.12s", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.opacity = "0.88"; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}>
      {children}
    </button>
  );

  const handleSubmit = async () => {
    if (!token?.trim()) {
      setError("Link inválido ou incompleto. O e-mail deve conter reset_token (ou action=reset_password&token=). Solicite um novo link.");
      return;
    }
    if (!password || password.length < 8) {
      setError("Use uma senha com pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPwd) {
      setError("As senhas não coincidem.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onResetPassword(token.trim(), password);
      setSuccess(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Nao foi possivel redefinir a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div className="fincla-scroll" style={{ display:"flex", height:"100dvh", background:T.surface, fontFamily:"'Geist',sans-serif", overflowY:"auto", alignItems:"safe center", justifyContent:"center", padding:24 }}>
        <div style={{ width:"100%", maxWidth:400 }}>
          <div style={{ ...G, fontSize:22, fontWeight:800, color:T.ink, marginBottom:8 }}>
            {success ? (firstPassword ? "Senha criada" : "Senha atualizada") : linkStatus === "invalid" ? (newLinkState === "sent" ? "Enviamos um novo link" : "Link inválido ou expirado") : firstPassword ? "Crie sua senha" : "Nova senha"}
          </div>
          <div role="status" aria-live="polite" style={{ ...G, fontSize:14, color:T.inkMid, lineHeight:1.65, marginBottom:24 }}>
            {success
              ? (firstPassword ? "Sua senha foi criada. Você já pode entrar no Fincla." : "Sua senha foi redefinida. Você já pode entrar com a nova senha.")
              : linkStatus === "invalid"
                ? (canRequestNewLink
                  ? (newLinkState === "sent"
                    ? `Se ${sentTo} tiver conta no Fincla, enviamos um novo link para ele. Confira a caixa de entrada e o spam.`
                    : "Este link já foi utilizado ou expirou. Informe seu e-mail e enviamos um novo.")
                  : "Este link já foi utilizado ou expirou. Peça um novo link e tente novamente.")
                : firstPassword ? "Escolha a senha que você vai usar para entrar no Fincla." : "Defina uma nova senha para sua conta Fincla."}
          </div>

          {!success && linkStatus === "checking" && (
            <div style={{ ...G, fontSize:13, color:T.inkMid, display:"flex", alignItems:"center", gap:8 }}>
              <Loader2 size={16} style={{ animation:"spin 0.65s linear infinite" }} aria-hidden /> Verificando o link…
            </div>
          )}

          {!success && linkStatus === "invalid" && canRequestNewLink && newLinkState !== "sent" && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label htmlFor="new-link-email" style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:7 }}>E-mail</label>
                <input
                  id="new-link-email"
                  type="email"
                  autoComplete="email"
                  value={newLinkEmail}
                  readOnly={newLinkState === "sending"}
                  onChange={(e) => { setNewLinkEmail(e.target.value); setNewLinkError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") void requestNewLink(); }}
                  placeholder="seu@email.com"
                  style={{ ...G, width:"100%", padding:"13px 14px", border:`1.5px solid ${newLinkError ? T.red+"66" : T.border}`, borderRadius:11, fontSize:14, color:T.ink, background:T.surface, outline:"none", boxSizing:"border-box" }}
                />
              </div>
              {newLinkError && (
                <div role="alert" style={{ ...G, fontSize:12, color:T.red, display:"flex", alignItems:"center", gap:6 }}>
                  <AlertTriangle size={13}/> {newLinkError}
                </div>
              )}
              {BtnPrimary({
                onClick: () => { void requestNewLink(); },
                disabled: newLinkState === "sending",
                children: newLinkState === "sending"
                  ? <><Loader2 size={16} style={{ animation:"spin 0.65s linear infinite" }} aria-hidden /> Enviando…</>
                  : "Enviar novo link",
              })}
              <button type="button" onClick={onComplete} disabled={newLinkState === "sending"}
                style={{ ...G, alignSelf:"center", background:"none", border:"none", padding:4, color:T.inkMid, fontSize:13, textDecoration:"underline", cursor:"pointer" }}>
                Ir para o login
              </button>
            </div>
          )}

          {!success && linkStatus === "invalid" && (!canRequestNewLink || newLinkState === "sent") && BtnPrimary({
            onClick: onComplete,
            disabled: false,
            children: "Ir para o login",
          })}

          {!success && linkStatus === "invalid" && canRequestNewLink && newLinkState === "sent" && (
            <button type="button" onClick={() => { setNewLinkState("idle"); setNewLinkError(""); }}
              style={{ ...G, display:"block", margin:"12px auto 0", background:"none", border:"none", padding:4, color:T.inkMid, fontSize:13, textDecoration:"underline", cursor:"pointer" }}>
              Usar outro e-mail
            </button>
          )}

          {!success && linkStatus === "ok" && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:7 }}>{firstPassword ? "Senha" : "Nova senha"}</label>
                <div style={{ position:"relative" }}>
                  <div style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}>
                    <Lock size={15} color={T.inkMid} />
                  </div>
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    placeholder="••••••••"
                    style={{ ...G, width:"100%", padding:"13px 14px 13px 42px", border:`1.5px solid ${error ? T.red+"66" : T.border}`, borderRadius:11, fontSize:14, color:T.ink, background:T.surface, outline:"none", boxSizing:"border-box" }}
                  />
                  <button type="button" onClick={() => setShowPwd((p) => !p)} tabIndex={-1}
                    style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:4, color:T.inkMid }}>
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:7 }}>Confirmar senha</label>
                <input
                  type={showPwd ? "text" : "password"}
                  value={confirmPwd}
                  onChange={(e) => { setConfirmPwd(e.target.value); setError(""); }}
                  placeholder="••••••••"
                  onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
                  style={{ ...G, width:"100%", padding:"13px 14px", border:`1.5px solid ${error ? T.red+"66" : T.border}`, borderRadius:11, fontSize:14, color:T.ink, background:T.surface, outline:"none", boxSizing:"border-box" }}
                />
              </div>
              {error && (
                <div style={{ ...G, fontSize:12, color:T.red, display:"flex", alignItems:"center", gap:6 }}>
                  <AlertTriangle size={13}/> {error}
                </div>
              )}
              {BtnPrimary({
                onClick: () => { void handleSubmit(); },
                disabled: loading,
                children: loading
                  ? <><Loader2 size={16} style={{ animation:"spin 0.65s linear infinite" }} aria-hidden /> Salvando…</>
                  : firstPassword ? "Criar senha" : "Salvar nova senha",
              })}
            </div>
          )}

          {success && BtnPrimary({
            onClick: onComplete,
            disabled: false,
            children: "Ir para o login",
          })}
        </div>
      </div>
    </>
  );
}
