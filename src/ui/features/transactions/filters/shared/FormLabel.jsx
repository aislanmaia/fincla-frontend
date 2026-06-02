import React from "react";
import { T } from "../../../../tokens";
import { G } from "../../../../typography";

export function FormLabel({ children }) {
  return (
    <div
      style={{
        ...G,
        fontSize: 10,
        fontWeight: 700,
        color: T.inkMid,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}
