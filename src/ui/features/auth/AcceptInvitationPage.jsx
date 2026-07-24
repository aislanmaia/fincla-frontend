import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
} from "lucide-react";
import { formatInvitationApiError } from "../../data/invitationAdapter.js";
import { T } from "../../tokens";
import { G } from "../../typography";

/* ─── ACEITAR CONVITE (token na URL) ──────────────────────── */
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
      <div className="fincla-scroll" style={{ display:"flex", height:"100dvh", background:T.surface, fontFamily:"'Geist',sans-serif", overflowY:"auto", alignItems:"center", justifyContent:"center", padding:24 }}>
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
                  ? <><Loader2 size={16} style={{ animation:"spin 0.65s linear infinite" }} aria-hidden /> Criando acesso…</>
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
