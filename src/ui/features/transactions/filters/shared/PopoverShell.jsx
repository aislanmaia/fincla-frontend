import React from "react";
import { T } from "../../../../tokens";

/**
 * Caixa de popover.
 *
 * Modo padrão (desktop): ancorada em um elemento `position: relative` pai com
 * largura fixa (minWidth/maxWidth) flutuando absoluto abaixo dele.
 *
 * Modo `compact` (mobile/sheet): renderiza inline (position: static), ocupa
 * 100% da largura disponível e não tem min/max — útil dentro de um bottom
 * sheet ou em qualquer container narrow onde uma posição absoluta vazaria
 * para fora dos limites visíveis.
 */
export function PopoverShell({
  anchorRight = false,
  minWidth = 420,
  maxWidth = 480,
  compact = false,
  dashed = false,
  children,
  style,
}) {
  const borderStyle = dashed ? "dashed" : "solid";
  const borderColor = dashed ? T.border : T.border;

  if (compact) {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          marginTop: 10,
          background: T.surface,
          border: `1px ${borderStyle} ${borderColor}`,
          borderRadius: 14,
          boxShadow: T.md,
          padding: "16px 14px",
          animation: "fadeInDown 0.16s ease",
          ...style,
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        ...(anchorRight ? { right: 0 } : { left: 0 }),
        zIndex: 70,
        minWidth,
        maxWidth,
        background: T.surface,
        border: `1px ${borderStyle} ${borderColor}`,
        borderRadius: 12,
        boxShadow: T.lg,
        padding: "16px 18px",
        animation: "fadeInDown 0.16s ease",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
