import { useNavigate } from "@tanstack/react-router";
import { T } from "../tokens";
import { G } from "../typography";

export function FinclaNotFoundPage() {
  const navigate = useNavigate();
  return (
    <div style={{ paddingTop: 48, textAlign: "center", maxWidth: 420, margin: "0 auto" }}>
      <div style={{ ...G, fontSize: 40, marginBottom: 10 }}>404</div>
      <div style={{ ...G, fontSize: 16, fontWeight: 700, color: T.ink, marginBottom: 8 }}>
        Página não encontrada
      </div>
      <div style={{ ...G, fontSize: 13, color: T.inkMid, lineHeight: 1.6, marginBottom: 22 }}>
        Esse endereço não existe no Fincla. Verifique o link ou volte ao painel.
      </div>
      <button
        type="button"
        onClick={() => navigate({ to: "/dashboard", replace: true })}
        style={{
          ...G,
          background: T.ink,
          color: "#fff",
          border: "none",
          borderRadius: 11,
          padding: "10px 20px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Ir para Visão geral
      </button>
    </div>
  );
}
