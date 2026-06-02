import React from "react";
import { T } from "../../../../tokens";

const MONO = { fontFamily: "'Geist Mono', ui-monospace, monospace" };

export function CountChip({ n, dark = false }) {
  return (
    <span
      style={{
        ...MONO,
        background: dark ? T.ink : "rgba(255,255,255,0.85)",
        color: dark ? "#fff" : T.ink,
        borderRadius: 99,
        fontSize: 9,
        fontWeight: 700,
        padding: "0 5px",
        lineHeight: "13px",
      }}
    >
      {n}
    </span>
  );
}
