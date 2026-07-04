import React from "react";

import { Badge, Card, PageTitle } from "../../components/primitives";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { useFinclaPages } from "../../routing/finclaPageContext.jsx";
import { getDisplayName, getInitials } from "../../features/auth/userDisplay.js";
import { Icon } from "../../features/consultant/consultantUi";
import { fmtMoney } from "../../features/consultant/consultantFormat";
import { totalPatrimonio } from "../../features/consultant/consultantClientsView";
import { useConsultantClients } from "../../features/consultant/useConsultantClients";

function Kicker({ children }) {
  return <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{children}</div>;
}

/** "consultant_pro" → "Consultant Pro" (slug → rótulo legível). */
function prettyPlan(slug) {
  if (!slug) return null;
  return String(slug).split(/[_-]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function StatCard({ label, value, icon, soon }) {
  return (
    <Card style={{ padding: "16px 18px" }}>
      <Icon name={icon} size={17} color={T.purple} />
      <div style={{ ...G, ...NUM, fontSize: 20, fontWeight: 800, color: soon ? T.inkGhost : T.ink, marginTop: 10 }}>{value}</div>
      <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
        {label}
        {soon && <span style={{ ...G, fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: T.inkLight, background: T.grayLight, borderRadius: 4, padding: "1px 4px" }}>em breve</span>}
      </div>
    </Card>
  );
}

function InfoRow({ icon, label, value, soon, last }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 18px", borderBottom: last ? "none" : `1px solid ${T.border}` }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon name={icon} size={15} color={T.inkMid} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...G, fontSize: 11, color: T.inkLight }}>{label}</div>
        <div style={{ ...G, fontSize: 13.5, fontWeight: 600, color: soon ? T.inkGhost : T.ink, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      </div>
      {soon && <span style={{ ...G, fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: T.inkLight, background: T.grayLight, borderRadius: 5, padding: "2px 6px" }}>em breve</span>}
    </div>
  );
}

/**
 * Perfil do consultor (S6) — reimplementado fiel à referência (`cons-perfil.jsx`):
 * cartão de conta (avatar + nome + plano) + stats (clientes / patrimônio sob gestão /
 * honorários) + lista de dados (e-mail / plano / notificações). Consome dado real do
 * usuário logado (`useFinclaPages`) e da carteira (`useConsultantClients`). Sem
 * fonte de dado — **honorários/MRR**, **notificações de risco** (sem toggle no
 * backend) e **editar perfil** — ficam como **stub "em breve"** (não inventa número).
 */
export function ConsultantProfilePage() {
  const pages = useFinclaPages();
  const user = pages?.user;
  const { clients } = useConsultantClients();

  const name = getDisplayName(user);
  const initials = getInitials(user);
  const email = user?.email || "—";
  const planLabel = prettyPlan(user?.subscription?.plan);
  const active = user?.subscription?.status === "active";
  const patrimonio = totalPatrimonio(clients);

  return (
    <div style={{ ...G, width: "100%", boxSizing: "border-box", padding: "clamp(18px, 3.5vw, 32px) clamp(16px, 3.5vw, 40px) 48px", display: "flex", flexDirection: "column", gap: 18, minWidth: 0, maxWidth: 820 }}>
      <div>
        <Kicker>Sua conta profissional</Kicker>
        <PageTitle sans="Perfil do" serif="consultor" />
      </div>

      <Card style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ width: 64, height: 64, borderRadius: 9999, background: `linear-gradient(135deg, ${T.ink}, ${T.purple})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 22, ...G, flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...G, fontSize: 19, fontWeight: 800, color: T.ink }}>{name}</div>
            <div style={{ ...G, fontSize: 12.5, color: T.inkLight, marginTop: 2 }}>Consultor financeiro</div>
            <div style={{ display: "flex", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
              {planLabel && <Badge color={T.purple} bg={T.purpleLight}><Icon name="check-circle" size={11} color={T.purple} /> {planLabel}</Badge>}
              {active && <Badge color={T.green} bg={T.greenLight}><Icon name="check" size={11} color={T.green} /> Ativo</Badge>}
            </div>
          </div>
          <button type="button" disabled title="Em breve"
            style={{ ...G, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: `1.5px solid ${T.border}`, background: T.surface, color: T.inkLight, fontSize: 12, fontWeight: 600, cursor: "default", opacity: 0.6 }}>
            <Icon name="pencil" size={14} color={T.inkLight} /> Editar
            <span style={{ ...G, fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: T.inkLight, background: T.grayLight, borderRadius: 5, padding: "1px 5px" }}>em breve</span>
          </button>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <StatCard label="Clientes" value={clients.length} icon="users" />
        <StatCard label="Patrimônio sob gestão" value={fmtMoney(patrimonio)} icon="wallet" />
        <StatCard label="Honorários recorrentes" value="—" icon="repeat" soon />
      </div>

      <Card style={{ padding: 0 }}>
        <InfoRow icon="message" label="E-mail" value={email} />
        <InfoRow icon="card" label="Plano" value={planLabel ? `${planLabel}${active ? " · ativo" : ""}` : "—"} />
        <InfoRow icon="bell" label="Notificações de risco" value="Configuração chega em breve" soon last />
      </Card>
    </div>
  );
}
