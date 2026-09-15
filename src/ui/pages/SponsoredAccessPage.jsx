import { Card, Btn } from "../components/primitives.jsx";
import { T } from "../tokens.js";
import { G } from "../typography.js";

export function SponsoredAccessPage({ session }) {
  const hasAccess = session.user?.subscription?.is_entitled === true;
  return <main className="fincla-scroll" style={{ ...G, height: "100%", overflowY: "auto", boxSizing: "border-box", padding: "32px 20px", background: T.bg, color: T.ink }}>
    <Card style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
      <img src="/logo.png" alt="Fincla" width={40} height={40} />
      <h1>{hasAccess ? "Seu acesso é patrocinado pelo consultor" : "Seu acesso patrocinado está indisponível"}</h1>
      <p>Conta: {session.user?.email}</p>
      <p style={{ lineHeight: 1.6, color: T.inkMid }}>Seu acesso depende do vínculo e da capacidade contratada pelo consultor. Sua conta e seus dados permanecem preservados.</p>
      <p style={{ lineHeight: 1.6, color: T.inkMid }}>Fale com seu consultor ou com o suporte para esclarecer a situação do acesso.</p>
      <p><a href="mailto:contato@fincla.com" style={{ color: T.blue }}>Falar com o suporte</a></p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {hasAccess ? <Btn variant="dark" onClick={() => window.location.assign("/dashboard")}>Continuar para o Fincla</Btn> : <Btn disabled={session.isLoading} onClick={session.bootstrap}>Verificar acesso</Btn>}
        <Btn onClick={session.signOut}>Sair da conta</Btn>
      </div>
    </Card>
  </main>;
}
