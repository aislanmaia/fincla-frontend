import { useEffect, useState } from "react";
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
                  ? <><Loader2 size={16} style={{ animation:"spin 0.65s linear infinite" }} aria-hidden /> Salvando…</>
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
