import React from "react";
import { X } from "lucide-react";
import { T } from "../../tokens";
import { G } from "../../typography";
import { getDisplayName, getInitials } from "../auth/userDisplay.js";
import { CONSULTANT_NAV, isConsultantNavActive } from "./consultantNav.js";
import { AccountAreaSwitcher } from "./AccountAreaSwitcher.jsx";

function ComingSoonPill({ active }) {
  return (
    <span
      style={{
        ...G,
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: active ? "rgba(255,255,255,0.9)" : T.inkGhost,
        background: active ? "rgba(255,255,255,0.18)" : T.grayLight,
        padding: "1px 7px",
        borderRadius: 99,
        flexShrink: 0,
      }}
    >
      em breve
    </span>
  );
}

/**
 * Sidebar da área do Consultor (A0.3) — espelha `cons-shell.jsx` do handoff de
 * design, reimplementada no design system do Fincla (tokens + lucide, sem Tailwind).
 * Apresentacional: o roteamento entra via `pathname`/`onNav`.
 *
 * - Mensagens aparece desabilitado com selo "em breve" (Trilha B); Copiloto IA (A4)
 *   já é navegável.
 * - `onClose` (opcional) renderiza o "X" do drawer mobile.
 */
export function ConsultantSidebar({ pathname, onNav, user, onClose }) {
  return (
    <div
      style={{
        width: 208,
        minWidth: 208,
        background: T.surface,
        borderRight: `1px solid ${T.border}`,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Marca */}
      <div
        style={{
          padding: "16px 16px 14px",
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 9,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <img
            src="/logo.png"
            alt="Fincla"
            width={24}
            height={24}
            style={{ objectFit: "contain", display: "block", flexShrink: 0 }}
          />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink, letterSpacing: "-0.02em" }}>
              Fincla
            </span>
            <span
              style={{
                ...G,
                fontSize: 9.5,
                fontWeight: 700,
                color: T.purple,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Consultor
            </span>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={16} color={T.inkLight} />
          </button>
        )}
      </div>

      {/* Navegação */}
      <nav style={{ flex: 1, padding: "6px 9px", overflowY: "auto" }}>
        {CONSULTANT_NAV.map((item, i) => {
          if (item.sec) {
            return (
              <div
                key={`sec-${i}`}
                style={{
                  ...G,
                  fontSize: 9.5,
                  fontWeight: 600,
                  color: T.inkGhost,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  padding: "13px 6px 3px",
                  userSelect: "none",
                }}
              >
                {item.sec}
              </div>
            );
          }
          const active = isConsultantNavActive(pathname, item.to);
          const { Icon } = item;
          const disabled = Boolean(item.comingSoon);
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              aria-current={active ? "page" : undefined}
              onClick={() => {
                if (disabled) return;
                onNav(item.to);
              }}
              onMouseEnter={(e) => {
                if (!active && !disabled) e.currentTarget.style.background = T.bg;
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
              style={{
                ...G,
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "8px 10px",
                borderRadius: 9,
                border: "none",
                cursor: disabled ? "default" : "pointer",
                marginBottom: 1,
                transition: "background 0.12s",
                background: active ? T.ink : "transparent",
                color: active ? "#fff" : T.inkMid,
                fontWeight: active ? 600 : 500,
                fontSize: 13,
                opacity: disabled ? 0.6 : 1,
              }}
            >
              <Icon
                size={15}
                strokeWidth={active ? 2.3 : 1.8}
                color={active ? "#fff" : item.ai ? T.purple : T.inkLight}
              />
              <span style={{ flex: 1, textAlign: "left", color: active ? "#fff" : T.inkMid }}>
                {item.label}
              </span>
              {disabled && <ComingSoonPill active={active} />}
            </button>
          );
        })}
      </nav>

      {/* Rodapé — consultor */}
      <div style={{ padding: "10px 12px 14px", borderTop: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
        <AccountAreaSwitcher current="consultant" user={user} onNavigate={onClose} />
        <button
          type="button"
          onClick={() => onNav("/consultant/profile")}
          onMouseEnter={(e) => (e.currentTarget.style.background = T.bg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          style={{
            ...G,
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "6px 6px",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            background: "transparent",
            transition: "background 0.13s",
          }}
        >
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              width={30}
              height={30}
              style={{ borderRadius: 9999, objectFit: "cover", flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 9999,
                background: `linear-gradient(135deg, ${T.ink}, ${T.purple})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 800,
                fontSize: 11,
                ...G,
                flexShrink: 0,
              }}
            >
              {getInitials(user)}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <div
              style={{
                ...G,
                fontSize: 12,
                fontWeight: 700,
                color: T.ink,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={getDisplayName(user)}
            >
              {getDisplayName(user)}
            </div>
            <div style={{ ...G, fontSize: 9.5, fontWeight: 700, color: T.purple, letterSpacing: "0.04em" }}>
              CONSULTOR
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
