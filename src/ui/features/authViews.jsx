import React, { useState } from "react";
import {
  Activity,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ChevronLeft,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { formatInvitationApiError } from "../data/invitationAdapter.js";
import { T } from "../tokens";
import { G } from "../typography";

/* ─── LOGIN PAGE ────────────────────────────────────────────── */
export const LoginPage = ({
  onLogin,
  initialError = "",
  onRequestPasswordReset,
  showDemoAccessHint = false,
}) => {
  const [view,     setView]     = useState("login");   // "login" | "forgot" | "sent"
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(initialError);

  const handleLogin = async () => {
    if (!email || !password) { setError("Preencha e-mail e senha."); return; }
    setError("");
    setLoading(true);

    try {
      await onLogin(email, password);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Nao foi possivel entrar.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!email) { setError("Informe seu e-mail."); return; }
    setError("");
    setLoading(true);
    try {
      if (onRequestPasswordReset) {
        await onRequestPasswordReset(email);
      }
      setView("sent");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Nao foi possivel enviar o e-mail.");
    } finally {
      setLoading(false);
    }
  };

  const maskEmail = (e) => {
    const [u, d] = e.split("@");
    if (!d) return e;
    return u.slice(0,2) + "•".repeat(Math.max(1, u.length-2)) + "@" + d;
  };

  const Input = ({ type="text", value, onChange, placeholder, icon, right }) => (
    <div style={{ position:"relative" }}>
      {icon && (
        <div style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}>
          {icon}
        </div>
      )}
      <input
        type={type} value={value}
        onChange={e => { onChange(e.target.value); setError(""); }}
        placeholder={placeholder}
        onKeyDown={e => {
          if (e.key !== "Enter") return;
          if (view === "login") {
            void handleLogin();
            return;
          }
          handleForgot();
        }}
        style={{
          ...G, width:"100%", padding: icon ? "13px 14px 13px 42px" : "13px 14px",
          border:`1.5px solid ${error ? T.red+"66" : T.border}`,
          borderRadius:11, fontSize:14, color:T.ink, background:T.surface,
          outline:"none", transition:"border-color 0.15s, box-shadow 0.15s",
          boxSizing:"border-box",
        }}
        onFocus={e => { e.target.style.borderColor = T.blue; e.target.style.boxShadow = `0 0 0 3px ${T.blueLight}`; }}
        onBlur={e  => { e.target.style.borderColor = error ? T.red+"66" : T.border; e.target.style.boxShadow = "none"; }}
      />
      {right && (
        <button onClick={right.action} tabIndex={-1}
          style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:4, color:T.inkMid }}>
          {right.icon}
        </button>
      )}
    </div>
  );

  const BtnPrimary = ({ onClick, children, disabled }) => (
    <button onClick={onClick} disabled={disabled}
      style={{ ...G, width:"100%", padding:"14px", background: disabled ? T.inkGhost : T.ink, color:"#fff", border:"none", borderRadius:11, fontSize:14, fontWeight:700, cursor: disabled ? "not-allowed" : "pointer", transition:"opacity 0.15s, transform 0.12s", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = "0.88"; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
      {children}
    </button>
  );

  // ── Brand panel ────────────────────────────────────────────────────────────
  const BrandPanel = () => (
    <div style={{ background:"#0F0F0D", display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"48px 44px", position:"relative", overflow:"hidden", flex:1, minHeight:"100vh" }}>
      {/* Decorative circles */}
      <div style={{ position:"absolute", top:-80, right:-80, width:300, height:300, borderRadius:"50%", background:"rgba(37,99,235,0.08)" }}/>
      <div style={{ position:"absolute", bottom:-60, left:-60, width:220, height:220, borderRadius:"50%", background:"rgba(124,58,237,0.1)" }}/>
      <div style={{ position:"absolute", top:"40%", right:-20, width:140, height:140, borderRadius:"50%", background:"rgba(37,99,235,0.05)" }}/>

      {/* Logo */}
      <div style={{ display:"flex", alignItems:"center", gap:10, position:"relative", zIndex:1 }}>
        <div style={{ width:34, height:34, borderRadius:9, background:`linear-gradient(135deg, ${T.blue}, ${T.purple})`, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Activity size={17} color="#fff" strokeWidth={2.5}/>
        </div>
        <span style={{ fontFamily:"'Geist',sans-serif", fontSize:17, fontWeight:800, color:"#fff", letterSpacing:"0.02em" }}>FINCLA</span>
      </div>

      {/* Central copy */}
      <div style={{ position:"relative", zIndex:1 }}>
        <div style={{ fontFamily:"'Instrument Serif',serif", fontStyle:"italic", fontSize:42, lineHeight:1.15, color:"#fff", marginBottom:20 }}>
          Suas finanças,<br/>
          <span style={{ color:"#86EFAC" }}>finalmente</span><br/>
          sob controle.
        </div>
        <div style={{ fontFamily:"'Geist',sans-serif", fontSize:14, color:"rgba(255,255,255,0.45)", lineHeight:1.7, maxWidth:320 }}>
          Controle gastos, planeje metas e tome decisões financeiras com clareza — tudo em um só lugar.
        </div>
      </div>

      {/* Bottom testimonial */}
      <div style={{ position:"relative", zIndex:1, borderTop:"1px solid rgba(255,255,255,0.08)", paddingTop:24 }}>
        <div style={{ fontFamily:"'Geist',sans-serif", fontSize:13, color:"rgba(255,255,255,0.5)", fontStyle:"italic", lineHeight:1.65, marginBottom:12 }}>
          "O Fincla mudou minha relação com dinheiro. Finalmente sei para onde vai cada centavo."
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:9999, background:`linear-gradient(135deg,${T.blue},${T.purple})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:"#fff", flexShrink:0 }}>MC</div>
          <div>
            <div style={{ fontFamily:"'Geist',sans-serif", fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.7)" }}>Mariana Costa</div>
            <div style={{ fontFamily:"'Geist',sans-serif", fontSize:11, color:"rgba(255,255,255,0.35)" }}>Designer · São Paulo</div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Form panel ─────────────────────────────────────────────────────────────
  const FormPanel = () => {
    if (view === "sent") return (
      <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", padding:"clamp(24px,5vw,48px) clamp(20px,5vw,44px)", flex:1, overflowY:"auto" }}>
        <div style={{ maxWidth:380, margin:"0 auto", width:"100%", textAlign:"center" }}>
          <div style={{ fontSize:44, marginBottom:20 }}>📬</div>
          <div style={{ ...G, fontSize:24, fontWeight:800, color:T.ink, marginBottom:10 }}>Verifique seu e-mail</div>
          <div style={{ ...G, fontSize:14, color:T.inkMid, lineHeight:1.7, marginBottom:32 }}>
            Enviamos um link de recuperação para<br/>
            <strong style={{ color:T.ink }}>{maskEmail(email)}</strong>.<br/>
            Verifique sua caixa de entrada e spam.
          </div>
          {BtnPrimary({
            onClick: () => { setView("login"); setPassword(""); },
            children: "Voltar para o login",
          })}
          <button onClick={() => handleForgot()} style={{ ...G, marginTop:14, width:"100%", background:"none", border:"none", cursor:"pointer", fontSize:13, color:T.inkMid }}>
            Não recebeu? Reenviar e-mail
          </button>
        </div>
      </div>
    );

    if (view === "forgot") return (
      <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", padding:"clamp(24px,5vw,48px) clamp(20px,5vw,44px)", flex:1, overflowY:"auto" }}>
        <div style={{ maxWidth:380, margin:"0 auto", width:"100%" }}>
          <button onClick={() => { setView("login"); setError(""); }}
            style={{ ...G, display:"flex", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", color:T.inkMid, fontSize:13, marginBottom:32, padding:0 }}>
            <ChevronLeft size={15}/> Voltar
          </button>

          <div style={{ ...G, fontSize:26, fontWeight:800, color:T.ink, marginBottom:6 }}>
            Recuperar acesso
          </div>
          <div style={{ ...G, fontSize:14, color:T.inkMid, lineHeight:1.65, marginBottom:32 }}>
            Informe seu e-mail e enviaremos um link para redefinir sua senha.
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <label style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:7 }}>E-mail</label>
              {Input({
                type: "email",
                value: email,
                onChange: setEmail,
                placeholder: "seu@email.com",
                icon: <Mail size={15} color={T.inkMid} />,
              })}
            </div>
            {error && <div style={{ ...G, fontSize:12, color:T.red }}>{error}</div>}
            {BtnPrimary({
              onClick: handleForgot,
              disabled: loading,
              children: loading ? "Enviando…" : "Enviar link de recuperação",
            })}
          </div>
        </div>
      </div>
    );

    // Default: login
    return (
      <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", padding:"clamp(24px,5vw,48px) clamp(20px,5vw,44px)", flex:1, overflowY:"auto" }}>
        <div style={{ maxWidth:380, margin:"0 auto", width:"100%" }}>
          <div style={{ marginBottom:36 }}>
            <div style={{ ...G, fontSize:26, fontWeight:800, color:T.ink, marginBottom:6 }}>
              Bom ver você de volta
            </div>
            <div style={{ ...G, fontSize:14, color:T.inkMid }}>
              Acesse sua conta para continuar.
            </div>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div>
              <label style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:7 }}>E-mail</label>
              {Input({
                type: "email",
                value: email,
                onChange: setEmail,
                placeholder: "seu@email.com",
                icon: <Mail size={15} color={T.inkMid} />,
              })}
            </div>

            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:7 }}>
                <label style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.07em" }}>Senha</label>
                <button onClick={() => { setView("forgot"); setError(""); }}
                  style={{ ...G, background:"none", border:"none", cursor:"pointer", fontSize:12, color:T.blue, fontWeight:600, padding:0 }}>
                  Esqueci minha senha
                </button>
              </div>
              {Input({
                type: showPwd ? "text" : "password",
                value: password,
                onChange: setPassword,
                placeholder: "••••••••",
                icon: <Lock size={15} color={T.inkMid} />,
                right: {
                  icon: showPwd ? <EyeOff size={15} /> : <Eye size={15} />,
                  action: () => setShowPwd((p) => !p),
                },
              })}
            </div>

            {error && (
              <div style={{ ...G, fontSize:12, color:T.red, display:"flex", alignItems:"center", gap:6 }}>
                <AlertTriangle size={13}/> {error}
              </div>
            )}

            <div style={{ marginTop:4 }}>
              {BtnPrimary({
                onClick: () => { void handleLogin(); },
                disabled: loading,
                children: loading
                  ? <><RefreshCw size={14} style={{ animation:"spin 0.7s linear infinite" }}/> Entrando…</>
                  : "Entrar na conta",
              })}
            </div>
          </div>

          {showDemoAccessHint && (
            <div style={{ marginTop:28, padding:"16px 18px", background:T.blueLight, borderRadius:11, border:`1px solid ${T.blue}22` }}>
              <div style={{ ...G, fontSize:11, fontWeight:700, color:T.blue, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Acesso demo</div>
              <div style={{ ...G, fontSize:12, color:T.inkMid, lineHeight:1.6 }}>
                Com dados de demonstração ativos no ambiente, você pode explorar telas com cenários mock. Login real usa sua conta na API.
              </div>
            </div>
          )}

          <div style={{ marginTop:28, textAlign:"center" }}>
            <span style={{ ...G, fontSize:13, color:T.inkMid }}>Não tem uma conta? </span>
            <button style={{ ...G, background:"none", border:"none", cursor:"pointer", fontSize:13, color:T.blue, fontWeight:700, padding:0 }}>
              Solicitar acesso
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display:"flex", height:"100vh", minHeight:"100dvh", background:T.surface, fontFamily:"'Geist',sans-serif", overflow:"hidden" }}>
        {/* Brand panel — hidden on mobile */}
        <div style={{ flex:"0 0 42%", display:"none", minHeight:"100vh" }} id="fincla-brand-panel">
          {BrandPanel()}
        </div>
        <style>{`
          @media (min-width: 768px) {
            #fincla-brand-panel { display: flex !important; flex-direction: column; }
            #fincla-mobile-logo { display: none !important; }
          }
        `}</style>

        {/* Form panel */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflowY:"auto", background:T.surface }}>
          {/* Logo — visible on mobile, hidden on desktop when brand panel shows */}
          <div style={{ padding:"28px 28px 0", display:"flex", alignItems:"center", gap:10 }} id="fincla-mobile-logo">
            <div style={{ width:30, height:30, borderRadius:8, background:`linear-gradient(135deg,${T.blue},${T.purple})`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Activity size={15} color="#fff" strokeWidth={2.5}/>
            </div>
            <span style={{ fontFamily:"'Geist',sans-serif", fontSize:15, fontWeight:800, color:T.ink, letterSpacing:"0.02em" }}>FINCLA</span>
          </div>
          {FormPanel()}
        </div>
      </div>
    </>
  );
};

/* ─── ACEITAR CONVITE (token na URL) ──────────────────────── */
export function AcceptInvitationPage({ token, onAccept, onComplete }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successUser, setSuccessUser] = useState(null);

  const BtnPrimary = ({ onClick, children, disabled }) => (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ ...G, width:"100%", padding:"14px", background: disabled ? T.inkGhost : T.ink, color:"#fff", border:"none", borderRadius:11, fontSize:14, fontWeight:700, cursor: disabled ? "not-allowed" : "pointer", transition:"opacity 0.15s", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.opacity = "0.88"; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}>
      {children}
    </button>
  );

  const handleSubmit = async () => {
    if (!token?.trim()) {
      setError("Link de convite inválido ou incompleto. Peça um novo convite ao administrador.");
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
      const payload = {
        token: token.trim(),
        password,
      };
      const fn = firstName.trim();
      const ln = lastName.trim();
      if (fn) payload.first_name = fn;
      if (ln) payload.last_name = ln;
      const data = await onAccept(payload);
      setSuccessUser(data?.user ?? null);
    } catch (nextError) {
      setError(formatInvitationApiError(nextError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display:"flex", height:"100vh", minHeight:"100dvh", background:T.surface, fontFamily:"'Geist',sans-serif", overflow:"hidden", alignItems:"center", justifyContent:"center", padding:24 }}>
        <div style={{ width:"100%", maxWidth:420 }}>
          <div style={{ ...G, fontSize:22, fontWeight:800, color:T.ink, marginBottom:8 }}>
            {successUser ? "Convite aceito" : "Entrar na organização"}
          </div>
          <div style={{ ...G, fontSize:14, color:T.inkMid, lineHeight:1.65, marginBottom:24 }}>
            {successUser
              ? (
                <>
                  Sua conta está pronta
                  {successUser.email ? (
                    <>
                      {" "}(
                      <strong style={{ color:T.ink }}>{successUser.email}</strong>
                      ).
                    </>
                  ) : null}
                  {" "}Use a senha que você definiu para acessar o Fincla.
                </>
              )
              : "Você foi convidado para uma organização no Fincla. Defina sua senha para continuar (nome é opcional)."}
          </div>

          {!successUser && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ display:"flex", gap:10, flexDirection:"row", flexWrap:"wrap" }}>
                <div style={{ flex:"1 1 140px", minWidth:0 }}>
                  <label style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:7 }}>Nome</label>
                  <input
                    value={firstName}
                    onChange={(e) => { setFirstName(e.target.value); setError(""); }}
                    placeholder="Opcional"
                    style={{ ...G, width:"100%", padding:"13px 14px", border:`1.5px solid ${error ? T.red+"66" : T.border}`, borderRadius:11, fontSize:14, color:T.ink, background:T.surface, outline:"none", boxSizing:"border-box" }}
                  />
                </div>
                <div style={{ flex:"1 1 140px", minWidth:0 }}>
                  <label style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:7 }}>Sobrenome</label>
                  <input
                    value={lastName}
                    onChange={(e) => { setLastName(e.target.value); setError(""); }}
                    placeholder="Opcional"
                    style={{ ...G, width:"100%", padding:"13px 14px", border:`1.5px solid ${error ? T.red+"66" : T.border}`, borderRadius:11, fontSize:14, color:T.ink, background:T.surface, outline:"none", boxSizing:"border-box" }}
                  />
                </div>
              </div>
              <div>
                <label style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:7 }}>Senha</label>
                <div style={{ position:"relative" }}>
                  <div style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}>
                    <Lock size={15} color={T.inkMid} />
                  </div>
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    placeholder="Mínimo 8 caracteres"
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
                  ? <><RefreshCw size={14} style={{ animation:"spin 0.7s linear infinite" }}/> Criando acesso…</>
                  : "Aceitar convite e criar acesso",
              })}
            </div>
          )}

          {successUser && BtnPrimary({
            onClick: onComplete,
            disabled: false,
            children: "Ir para o login",
          })}
        </div>
      </div>
    </>
  );
}

/* ─── RESET PASSWORD (token na URL) ───────────────────────── */
export function PasswordResetPage({ token, onResetPassword, onComplete }) {
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const BtnPrimary = ({ onClick, children, disabled }) => (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ ...G, width:"100%", padding:"14px", background: disabled ? T.inkGhost : T.ink, color:"#fff", border:"none", borderRadius:11, fontSize:14, fontWeight:700, cursor: disabled ? "not-allowed" : "pointer", transition:"opacity 0.15s, transform 0.12s", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}
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
      <div style={{ display:"flex", height:"100vh", minHeight:"100dvh", background:T.surface, fontFamily:"'Geist',sans-serif", overflow:"hidden", alignItems:"center", justifyContent:"center", padding:24 }}>
        <div style={{ width:"100%", maxWidth:400 }}>
          <div style={{ ...G, fontSize:22, fontWeight:800, color:T.ink, marginBottom:8 }}>
            {success ? "Senha atualizada" : "Nova senha"}
          </div>
          <div style={{ ...G, fontSize:14, color:T.inkMid, lineHeight:1.65, marginBottom:24 }}>
            {success
              ? "Sua senha foi redefinida. Você já pode entrar com a nova senha."
              : "Defina uma nova senha para sua conta Fincla."}
          </div>

          {!success && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:7 }}>Nova senha</label>
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
                  ? <><RefreshCw size={14} style={{ animation:"spin 0.7s linear infinite" }}/> Salvando…</>
                  : "Salvar nova senha",
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

/* ─── ERROR BOUNDARY ───────────────────────────────────────── */
export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e, info) { console.error("fincla render error:", e, info); }
  render() {
    if (this.state.error) return (
      <div style={{ padding:24, background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:12, margin:16 }}>
        <div style={{ fontWeight:700, color:"#DC2626", marginBottom:8 }}>Erro ao renderizar esta tela</div>
        <div style={{ fontFamily:"monospace", fontSize:12, color:"#374151" }}>{this.state.error.message}</div>
      </div>
    );
    return this.props.children;
  }
}


