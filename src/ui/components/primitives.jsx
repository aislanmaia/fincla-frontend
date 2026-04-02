import React, { useState, useEffect } from "react";
import { T } from "../tokens";
import { G, S, NUM } from "../typography";

/** Transição de página — só opacity (evita quebrar position:fixed) */
export function PageEnter({ children }) {
  return (
    <div style={{ animation: "fadeIn 0.18s ease both" }}>
      {children}
    </div>
  );
}

export function AnimBar({ pct, color, h = 4, delay = 0 }) {
  return (
    <div style={{ height: h, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          width: `${Math.min(100, pct)}%`,
          background: color,
          borderRadius: 99,
          animation: `progressFill 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
        }}
      />
    </div>
  );
}

export function AnimNum({ value, prefix = "R$\u00a0", style = {}, suffix = "" }) {
  const [display, setDisplay] = useState(0);
  const target =
    typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;
  useEffect(() => {
    let start = null;
    const dur = 700;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(target * ease);
      if (p < 1) requestAnimationFrame(step);
      else setDisplay(target);
    };
    const raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  const fmt = display.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <span style={{ ...style, animation: "countUp 0.3s ease both" }}>
      {prefix}
      {fmt}
      {suffix}
    </span>
  );
}

export function InfoTip({ text, width = 220 }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 14,
          height: 14,
          borderRadius: 9999,
          background: T.grayLight,
          color: T.inkMid,
          fontSize: 10,
          fontWeight: 700,
          cursor: "default",
          userSelect: "none",
          fontFamily: "system-ui",
          flexShrink: 0,
        }}
      >
        ⓘ
      </span>
      {show && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            width,
            background: T.ink,
            color: "#fff",
            borderRadius: 9,
            padding: "9px 12px",
            fontSize: 11,
            lineHeight: 1.55,
            fontFamily: "'Geist', sans-serif",
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
            zIndex: 999,
            pointerEvents: "none",
            whiteSpace: "pre-wrap",
          }}
        >
          {text}
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: `5px solid ${T.ink}`,
            }}
          />
        </div>
      )}
    </span>
  );
}

export function Card({ children, style = {}, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: T.surface,
        borderRadius: 14,
        border: `1px solid ${T.border}`,
        boxShadow: T.sm,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.boxShadow = T.md;
          e.currentTarget.style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.boxShadow = T.sm;
          e.currentTarget.style.transform = "";
        }
      }}
    >
      {children}
    </div>
  );
}

export function Badge({ children, color, bg }) {
  return (
    <span
      style={{
        ...G,
        ...NUM,
        fontSize: 10,
        fontWeight: 600,
        color: color || T.inkMid,
        background: bg || T.grayLight,
        padding: "2px 7px",
        borderRadius: 9999,
        whiteSpace: "nowrap",
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </span>
  );
}

export function Breadcrumb({ label }) {
  return (
    <div style={{ ...G, fontSize: 11, fontWeight: 500, color: T.inkLight, marginBottom: 6, letterSpacing: "0.02em" }}>
      {label}
    </div>
  );
}

export function PageTitle({ sans, serif: serifWord }) {
  return (
    <h1 style={{ margin: 0, lineHeight: 1.1, display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 7 }}>
      <span style={{ ...G, fontSize: 30, fontWeight: 800, color: T.ink, letterSpacing: "-0.025em" }}>{sans}</span>
      {serifWord && <span style={{ ...S, fontSize: 32, color: T.ink }}>{serifWord}</span>}
    </h1>
  );
}

export function SectionDiv({ label, count, total, color = T.inkMid }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "20px 0 10px" }}>
      <div style={{ width: 18, height: 2, background: color, borderRadius: 99, flexShrink: 0 }} />
      <span style={{ ...G, fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.09em" }}>
        {label}
      </span>
      {count && <span style={{ ...G, fontSize: 10, color: T.inkLight, fontWeight: 400 }}>{count}</span>}
      {total && (
        <span style={{ ...G, ...NUM, fontSize: 12, fontWeight: 700, color, marginLeft: "auto" }}>{total}</span>
      )}
    </div>
  );
}

export function ProgBar({ pct, color, h = 3, delay = 0 }) {
  return (
    <div style={{ width: "100%", height: h, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
      <div
        style={{
          width: `${Math.min(100, Math.max(0, pct))}%`,
          height: "100%",
          background: color,
          borderRadius: 99,
          animation: `progressFill 0.85s cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
        }}
      />
    </div>
  );
}

export function CollapsibleSection({ open, children }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        transition: "grid-template-rows 0.22s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden",
      }}
    >
      <div style={{ minHeight: 0 }}>{children}</div>
    </div>
  );
}

export function Btn({ children, variant = "outline", color = T.ink, onClick, full, small }) {
  const styles = {
    dark: { bg: T.ink, txt: "#fff", brd: T.ink },
    red: { bg: T.red, txt: "#fff", brd: T.red },
    purple: { bg: T.purple, txt: "#fff", brd: T.purple },
    outGray: { bg: "transparent", txt: T.inkMid, brd: T.border },
    outPurp: { bg: "transparent", txt: T.purple, brd: T.purple },
    outRed: { bg: "transparent", txt: T.red, brd: T.red },
    outAmber: { bg: T.amberLight, txt: T.amber, brd: T.amber },
    ghost: { bg: "transparent", txt: T.inkMid, brd: "transparent" },
  };
  const s = styles[variant] || styles.outGray;
  return (
    <button
      onClick={onClick}
      style={{
        ...G,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        padding: small ? "5px 10px" : "8px 14px",
        borderRadius: 9,
        border: `1.5px solid ${s.brd}`,
        background: s.bg,
        color: s.txt,
        fontSize: small ? 11 : 12,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
        width: full ? "100%" : undefined,
        transition: "opacity 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.82")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
    >
      {children}
    </button>
  );
}
