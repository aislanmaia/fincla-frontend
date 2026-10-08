import { useEffect, useRef, useState } from "react";
import { DENSITIES } from "./listPrefs.js";
import { G } from "../../typography.js";
import { T } from "../../tokens.js";

export function TransactionsListDisplayControls({ density, grouped, canGroup, onDensityChange, onGroupChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return <div style={{ display: "flex", alignItems: "center", gap: 7, flex: "none" }}>
    <div ref={containerRef} style={{ position: "relative", flex: "none" }}>
    <button ref={triggerRef} type="button" onClick={() => setOpen((value) => !value)}
      title={`Densidade da lista: ${DENSITIES[density].label}`}
      aria-label={`Densidade da lista: ${DENSITIES[density].label}. Abrir opções.`}
      aria-haspopup="menu" aria-expanded={open}
      style={{ ...G, flex: "none", width: 32, height: 32, borderRadius: 9, cursor: "pointer",
        border: `1px solid ${open ? T.ink : T.border}`, background: open ? T.bg : T.surface, color: T.inkMid,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
      ▤
    </button>
    {open && <div role="menu" aria-label="Densidade da lista"
      style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 30,
        width: 230, background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 12, boxShadow: "0 14px 40px rgba(0,0,0,.16)", padding: 6 }}>
      <div style={{ ...G, fontFamily: "'Geist Mono',monospace", fontSize: 11,
        letterSpacing: "0.09em", textTransform: "uppercase", color: T.inkGhost,
        padding: "7px 9px 3px" }}>Densidade</div>
      <div style={{ display: "flex", gap: 4, padding: "0 4px 5px" }}>
        {Object.entries(DENSITIES).map(([key, option]) => <button key={key} type="button" role="menuitemradio"
          aria-checked={density === key}
          onClick={() => { onDensityChange(key); setOpen(false); triggerRef.current?.focus(); }}
          style={{ ...G, flex: 1, height: 30, borderRadius: 8, cursor: "pointer",
            fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
            border: `1px solid ${density === key ? T.ink : T.border}`,
            background: density === key ? T.ink : T.surface,
            color: density === key ? "#fff" : T.inkMid }}>
          {option.label}
        </button>)}
      </div>
    </div>}
    </div>
    <button type="button" disabled={!canGroup} onClick={onGroupChange}
      title={canGroup ? (grouped ? "Agrupado por data" : "Lista contínua") : "Agrupar por data só vale ordenando por data"}
      aria-pressed={grouped} aria-label="Agrupar por data"
      style={{ ...G, flex: "none", width: 32, height: 32, borderRadius: 9,
        cursor: canGroup ? "pointer" : "not-allowed", opacity: canGroup ? 1 : 0.4,
        border: `1px solid ${grouped ? "#BFD3FA" : T.border}`,
        background: grouped ? T.blueLight : T.surface, color: grouped ? T.blue : T.inkMid,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
      ▦
    </button>
  </div>;
}
