import { Lock } from "lucide-react";

/**
 * Versão inline do upsell, para usar dentro de uma tela permitida quando
 * apenas uma sub-seção ou ação depende de uma feature.
 *
 * Exemplo: botão "Categorizar com IA" dentro da página de Transações
 * deveria ser substituído por `<UpgradePrompt feature="ai_categorization">`
 * quando o user está em Essential, sem esconder a página inteira.
 */
export function UpgradePrompt({
  feature,
  message = "Disponível no plano Pro.",
  ctaLabel = "Fazer upgrade",
  onUpgradeClick,
}) {
  return (
    <div
      role="note"
      aria-label={`Upgrade necessário: ${feature}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 10,
        background: "rgba(124, 58, 237, 0.08)",
        border: "1px dashed rgba(124, 58, 237, 0.4)",
      }}
    >
      <Lock size={18} color="#7C3AED" />
      <span style={{ flex: 1, fontSize: 13, color: "#334155" }}>{message}</span>
      <button
        type="button"
        onClick={onUpgradeClick}
        style={{
          padding: "6px 12px",
          borderRadius: 8,
          border: "none",
          background: "linear-gradient(135deg, #7C3AED, #2563EB)",
          color: "white",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {ctaLabel}
      </button>
    </div>
  );
}
