import React from "react";
import { T } from "../../../../tokens";

/** Caixa de popover ancorada em um elemento `position: relative` pai. */
export function PopoverShell({ anchorRight = false, minWidth = 420, maxWidth = 480, children, style }) {
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
        border: `1px solid ${T.border}`,
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
