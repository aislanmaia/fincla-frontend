import { Lock } from "lucide-react";

const TIER_STYLES = {
  pro: {
    label: "Pro",
    bg: "linear-gradient(135deg, #7C3AED, #2563EB)",
    color: "white",
  },
  business: {
    label: "Business",
    bg: "linear-gradient(135deg, #F59E0B, #DC2626)",
    color: "white",
  },
  beta: {
    label: "Beta",
    bg: "#1F2937",
    color: "white",
  },
};

/**
 * Badge pequeno colado em itens de menu/CTA que estão atrás de um plano
 * superior. Usado na sidebar para sinalizar `/reports` e `/simulation` para
 * usuários Essential, por exemplo.
 */
export function PlanBadge({ tier = "pro", showLock = true }) {
  const style = TIER_STYLES[tier] ?? TIER_STYLES.pro;
  return (
    <span
      role="img"
      aria-label={`Recurso disponível no plano ${style.label}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 999,
        background: style.bg,
        color: style.color,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: "uppercase",
      }}
    >
      {showLock && <Lock size={10} />}
      {style.label}
    </span>
  );
}
