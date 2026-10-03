import { ArrowUpRight, CalendarDays } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { T } from "../../tokens.js";
import { G } from "../../typography.js";
import { expiringAccess } from "./accessState.js";

export function AccessNotice({ user }) {
  const navigate = useNavigate();
  const notice = expiringAccess(user?.subscription);
  if (!notice) return null;
  const date = new Date(notice.deadline).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const courtesy = notice.kind === "courtesy";
  return <aside role="status" style={{ ...G, display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px 16px", padding: "13px 16px", marginBottom: 16, background: "#F5EBDC", color: T.ink, border: "1px solid #E7D1AF", borderRadius: 12 }}>
    <CalendarDays size={18} color="#926019" aria-hidden="true" />
    <span style={{ flex: 1, minWidth: 190, fontSize: 13, lineHeight: 1.45 }}>
      {courtesy ? <>Sua cortesia termina em <strong>{date}</strong>. Depois, entre nesta conta para escolher um plano.</> : <>Sua assinatura termina em <strong>{date}</strong>. Você mantém o acesso até lá.</>}
    </span>
    <button type="button" onClick={() => navigate({ to: "/access" })} style={{ ...G, display: "inline-flex", alignItems: "center", gap: 5, padding: 0, border: 0, background: "transparent", color: "#6D4613", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
      Ver plano e acesso <ArrowUpRight size={14} aria-hidden="true" />
    </button>
  </aside>;
}
