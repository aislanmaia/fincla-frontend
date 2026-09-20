import { useEffect, useState } from "react";
import { T } from "../tokens.js";
import { G, S } from "../typography.js";

const OPTIONS = [
  {
    id: "personal",
    eyebrow: "Para organizar a sua vida financeira",
    title: "Quero usar o Fincla para mim",
    copy: "Acompanhe contas, cartões, faturas, metas e gastos em um só lugar.",
    action: "Continuar como pessoa",
    href: "/checkout?persona=personal&billing_cycle=yearly",
    accent: T.green,
    soft: "#ECF8F1",
    icon: "✦",
  },
  {
    id: "consultant",
    eyebrow: "Para quem atende clientes",
    title: "Sou consultor financeiro",
    copy: "Organize a carteira, acompanhe clientes e tenha visão do trabalho que pede atenção.",
    action: "Conhecer o plano para consultores",
    href: "/consultant-checkout",
    accent: "#315FB5",
    soft: "#EEF4FF",
    icon: "◌",
  },
];

export function SignupChoicePage() {
  const [wide, setWide] = useState(() => typeof window === "undefined" || window.innerWidth >= 768);
  useEffect(() => { const sync = () => setWide(window.innerWidth >= 768); window.addEventListener("resize", sync); return () => window.removeEventListener("resize", sync); }, []);
  return <main style={{ ...G, height: "100%", minHeight: 0, display: "flex", overflow: "hidden", background: T.surface, color: T.ink }}>
    {wide && <AuthBrand />}
    <section className="fincla-scroll" style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: "auto", background: T.surface }}>
      <div style={{ width: "min(100% - 40px, 760px)", margin: "0 auto", padding: wide ? "64px 0" : "28px 0 44px" }}>
        {!wide && <a href="https://fincla.com" style={{ display: "inline-flex", alignItems: "center", gap: 9, color: T.ink, textDecoration: "none", fontSize: 15, fontWeight: 800 }}><img src="/logo.png" alt="" width={34} height={34} />Fincla</a>}
        <section aria-labelledby="signup-choice-title" style={{ marginTop: wide ? 0 : 46 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}><p style={{ margin: 0, color: T.green, fontSize: 12, fontWeight: 800, letterSpacing: ".1em" }}>COMECE POR AQUI</p><a href="/" style={{ color: T.inkMid, fontSize: 13, fontWeight: 700 }}>Já tenho uma conta</a></div>
          <h1 id="signup-choice-title" style={{ ...S, fontSize: wide ? 46 : 36, letterSpacing: "-.035em", lineHeight: 1.04, margin: "14px 0", maxWidth: 600 }}>Como você vai usar o Fincla?</h1>
          <p style={{ margin: 0, maxWidth: 560, color: T.inkMid, fontSize: 16, lineHeight: 1.6 }}>Escolha a experiência que faz sentido para você. A contratação e a configuração seguem o seu contexto.</p>
          <div style={{ display: "grid", gridTemplateColumns: wide ? "1fr 1fr" : "1fr", gap: 16, marginTop: 32 }}>
          {OPTIONS.map((option) => <a key={option.id} href={option.href} style={{ minHeight: 278, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 15, padding: "25px", borderRadius: 18, border: `1.5px solid ${T.border}`, background: T.surface, color: T.ink, textDecoration: "none", boxShadow: "0 8px 24px rgba(26, 34, 27, .05)", transition: "transform .18s ease, border-color .18s ease, box-shadow .18s ease" }} onMouseEnter={(event) => { event.currentTarget.style.transform = "translateY(-3px)"; event.currentTarget.style.borderColor = option.accent; event.currentTarget.style.boxShadow = `0 14px 30px ${option.accent}1C`; }} onMouseLeave={(event) => { event.currentTarget.style.transform = "none"; event.currentTarget.style.borderColor = T.border; event.currentTarget.style.boxShadow = "0 8px 24px rgba(26, 34, 27, .05)"; }}>
            <span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 46, height: 46, borderRadius: 14, background: option.soft, color: option.accent, fontSize: 25, fontWeight: 800 }}>{option.icon}</span>
            <div><p style={{ margin: 0, color: T.inkGhost, fontSize: 12, lineHeight: 1.4, fontWeight: 700 }}>{option.eyebrow}</p><h2 style={{ margin: "8px 0 7px", fontSize: 22, letterSpacing: "-.025em", lineHeight: 1.18 }}>{option.title}</h2><p style={{ margin: 0, color: T.inkMid, fontSize: 14, lineHeight: 1.55 }}>{option.copy}</p></div>
            <span style={{ marginTop: "auto", color: option.accent, fontSize: 14, fontWeight: 800 }}>{option.action} →</span>
          </a>)}
          </div>
          <p style={{ margin: "22px 0 0", color: T.inkGhost, fontSize: 12, lineHeight: 1.55 }}>Você poderá concluir a contratação com segurança antes de ter acesso à plataforma.</p>
        </section>
      </div>
    </section>
  </main>;
}

function AuthBrand() {
  return <aside style={{ flex: "0 0 42%", minWidth: 350, padding: "48px 44px", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0F0F0D", color: "#fff" }}>
    <div aria-hidden="true" style={{ position: "absolute", width: 300, height: 300, top: -80, right: -80, borderRadius: "50%", background: "rgba(37,99,235,.08)" }} />
    <a href="https://fincla.com" style={{ position: "relative", display: "inline-flex", alignItems: "center", alignSelf: "flex-start", gap: 10, color: "#fff", textDecoration: "none", fontSize: 17, fontWeight: 800 }}><img src="/logo.png" alt="" width={40} height={40} />Fincla</a>
    <div style={{ position: "relative" }}><p style={{ ...S, margin: 0, color: "#fff", fontSize: 42, lineHeight: 1.15 }}>Um jeito mais claro<br />de cuidar das suas<br /><span style={{ color: "#86EFAC" }}>finanças.</span></p><p style={{ margin: "20px 0 0", maxWidth: 320, color: "rgba(255,255,255,.48)", fontSize: 14, lineHeight: 1.7 }}>Escolha a experiência certa para começar com clareza, no seu ritmo.</p></div>
    <p style={{ position: "relative", margin: 0, paddingTop: 22, borderTop: "1px solid rgba(255,255,255,.09)", color: "rgba(255,255,255,.48)", fontSize: 13, lineHeight: 1.6 }}>Uma escolha agora deixa toda a sua experiência mais simples depois.</p>
  </aside>;
}
