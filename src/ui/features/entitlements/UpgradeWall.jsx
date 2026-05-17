import { Lock, Sparkles } from "lucide-react";

/**
 * Tela cheia exibida quando uma rota inteira não está disponível no plano
 * atual (ex.: usuário Essential abrindo `/reports`).
 *
 * Visual segue o tom dark/gradient já usado no app. O CTA delega ao caller
 * via `onUpgradeClick` — assim a abertura do `PlansComparisonModal` ou a
 * navegação para `/profile/billing` fica desacoplada deste componente.
 */
export function UpgradeWall({
  feature,
  title = "Disponível no Pro",
  description = "Faça upgrade do seu plano para desbloquear este recurso.",
  ctaLabel = "Ver planos",
  onUpgradeClick,
  benefits = [],
}) {
  return (
    <div
      role="region"
      aria-label={`Recurso bloqueado: ${feature}`}
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          padding: "32px",
          borderRadius: 20,
          background:
            "linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(37, 99, 235, 0.15))",
          border: "1px solid rgba(124, 58, 237, 0.25)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #7C3AED, #2563EB)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <Lock size={26} color="white" />
        </div>
        <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700 }}>
          {title}
        </h2>
        <p style={{ margin: "0 0 20px", color: "#475569", fontSize: 15 }}>
          {description}
        </p>
        {benefits.length > 0 && (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "0 0 24px",
              textAlign: "left",
            }}
          >
            {benefits.map((b) => (
              <li
                key={b}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 0",
                  fontSize: 14,
                }}
              >
                <Sparkles size={16} color="#7C3AED" />
                {b}
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onUpgradeClick}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(135deg, #7C3AED, #2563EB)",
            color: "white",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
