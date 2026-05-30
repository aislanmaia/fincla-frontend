import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import { T } from "../../tokens";
import { G } from "../../typography";

/* ─── LOGIN PAGE ────────────────────────────────────────────── */
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
  const [showSlowConnectHint, setShowSlowConnectHint] = useState(false);

  useEffect(() => {
    if (!loading || view !== "login") {
      setShowSlowConnectHint(false);
      return;
    }
    const id = window.setTimeout(() => setShowSlowConnectHint(true), 2600);
    return () => window.clearTimeout(id);
  }, [loading, view]);

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

  const Input = ({ type="text", value, onChange, placeholder, icon, right, disabled=false }) => (
    <div style={{ position:"relative" }}>
      {icon && (
        <div style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", opacity: disabled ? 0.45 : 1 }}>
          {icon}
        </div>
      )}
      <input
        type={type} value={value}
        disabled={disabled}
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
          outline:"none", transition:"border-color 0.15s, box-shadow 0.15s, opacity 0.15s",
          boxSizing:"border-box",
          opacity: disabled ? 0.68 : 1,
          cursor: disabled ? "not-allowed" : "text",
        }}
        onFocus={e => { e.target.style.borderColor = T.blue; e.target.style.boxShadow = `0 0 0 3px ${T.blueLight}`; }}
        onBlur={e  => { e.target.style.borderColor = error ? T.red+"66" : T.border; e.target.style.boxShadow = "none"; }}
      />
      {right && (
        <button type="button" onClick={right.action} tabIndex={-1} disabled={disabled}
          style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor: disabled ? "not-allowed" : "pointer", padding:4, color:T.inkMid, opacity: disabled ? 0.45 : 1 }}>
          {right.icon}
        </button>
      )}
    </div>
  );

  const BtnPrimary = ({ onClick, children, disabled }) => (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ ...G, width:"100%", minHeight:48, padding:"14px", background: disabled ? T.inkGhost : T.ink, color:"#fff", border:"none", borderRadius:11, fontSize:14, fontWeight:700, cursor: disabled ? "not-allowed" : "pointer", transition:"opacity 0.15s, transform 0.12s", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}
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

      {/* Logo — asset em /public/logo.png (mesmo padrão do layout legado) */}
      <div style={{ display:"flex", alignItems:"center", gap:10, position:"relative", zIndex:1 }}>
        <img
          src="/logo.png"
          alt="Fincla"
          width={40}
          height={40}
          style={{ objectFit:"contain", display:"block", flexShrink:0 }}
        />
        <span style={{ fontFamily:"'Geist',sans-serif", fontSize:17, fontWeight:800, color:"#fff", letterSpacing:"0.02em" }}>Fincla</span>
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
                disabled: loading,
              })}
            </div>
            {error && <div style={{ ...G, fontSize:12, color:T.red }}>{error}</div>}
            {BtnPrimary({
              onClick: handleForgot,
              disabled: loading,
              children: loading ? (
                <>
                  <Loader2 size={16} style={{ animation: "spin 0.65s linear infinite" }} aria-hidden />
                  Enviando…
                </>
              ) : (
                "Enviar link de recuperação"
              ),
            })}
          </div>
        </div>
      </div>
    );

    // Default: login
    return (
      <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", padding:"clamp(24px,5vw,48px) clamp(20px,5vw,44px)", flex:1, overflowY:"auto" }}>
        <div
          data-testid="login-form-panel"
          style={{ maxWidth:380, margin:"0 auto", width:"100%" }}
          aria-busy={loading ? true : undefined}
        >
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
                disabled: loading,
              })}
            </div>

            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:7 }}>
                <label style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.07em" }}>Senha</label>
                <button type="button" onClick={() => { setView("forgot"); setError(""); }}
                  disabled={loading}
                  style={{ ...G, background:"none", border:"none", cursor: loading ? "not-allowed" : "pointer", fontSize:12, color:T.blue, fontWeight:600, padding:0, opacity: loading ? 0.45 : 1 }}>
                  Esqueci minha senha
                </button>
              </div>
              {Input({
                type: showPwd ? "text" : "password",
                value: password,
                onChange: setPassword,
                placeholder: "••••••••",
                icon: <Lock size={15} color={T.inkMid} />,
                disabled: loading,
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
                children: loading ? (
                  <>
                    <Loader2 size={16} style={{ animation: "spin 0.65s linear infinite" }} aria-hidden />
                    Entrando…
                  </>
                ) : (
                  "Entrar na conta"
                ),
              })}
            </div>

            {loading && (
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Carregando"
                style={{
                  marginTop: 2,
                  height: 3,
                  borderRadius: 9999,
                  background: `${T.border}`,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: "38%",
                    borderRadius: 9999,
                    background: `linear-gradient(90deg, ${T.blue}, ${T.purple})`,
                    animation: "finclaIndeterminate 1.15s ease-in-out infinite",
                  }}
                />
              </div>
            )}

            {loading && showSlowConnectHint && (
              <div
                style={{
                  ...G,
                  marginTop: 12,
                  padding: "12px 14px",
                  fontSize: 13,
                  color: T.inkMid,
                  lineHeight: 1.55,
                  background: T.blueLight,
                  borderRadius: 11,
                  border: `1px solid ${T.blue}18`,
                }}
              >
                <strong style={{ color: T.ink }}>Conectando ao servidor.</strong>{" "}
                Se o ambiente ficou um tempo sem uso, a primeira tentativa pode levar alguns segundos — não é necessário enviar de novo.
              </div>
            )}
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
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes finclaIndeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(280%); }
        }
      `}</style>
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
            <img
              src="/logo.png"
              alt="Fincla"
              width={36}
              height={36}
              style={{ objectFit:"contain", display:"block", flexShrink:0 }}
            />
            <span style={{ fontFamily:"'Geist',sans-serif", fontSize:15, fontWeight:800, color:T.ink, letterSpacing:"0.02em" }}>Fincla</span>
          </div>
          {FormPanel()}
        </div>
      </div>
    </>
  );
};
