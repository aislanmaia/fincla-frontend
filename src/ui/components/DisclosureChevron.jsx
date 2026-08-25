import React from "react";

/**
 * A seta de "isto abre".
 *
 * Existe porque o que estava no lugar dela era `{aberto ? "⌃" : "⌄"}` —
 * `U+2303 UP ARROWHEAD` e `U+2304 DOWN ARROWHEAD`. Não são ícones: são
 * caracteres de notação técnica, e a fonte os desenha com a métrica de um
 * DIACRÍTICO — finos, altos, com a caixa deslocada para cima. Na tela lêem como
 * um acento circunflexo solto, e o alinhamento vertical depende da fonte que o
 * sistema resolver usar, não de nós.
 *
 * E trocar um caractere por outro SALTA. Não há interpolação possível entre
 * dois glifos; a mudança de estado acontece sem que nada tenha se movido, então
 * ela não é lida como "virou", só como "está diferente". Um ícone que gira
 * mostra o próprio ato de abrir.
 */
export function DisclosureChevron({ open = false, size = 14, style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        display: "block",
        flexShrink: 0,
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform var(--mo-fast, 120ms) var(--mo-fast-ease, ease-out)",
        ...style,
      }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
