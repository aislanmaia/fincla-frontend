import React from "react";
import { useNavigate } from "@tanstack/react-router";
import { Briefcase, User, Check, ChevronsUpDown } from "lucide-react";

import { T } from "../../tokens";
import { G } from "../../typography";
import { hasConsultantArea } from "./consultantAccess.js";

const AREAS = {
  consultant: { label: "Área do consultor", to: "/consultant", Icon: Briefcase, accent: T.purple },
  personal: { label: "Minha conta", to: "/dashboard", Icon: User, accent: T.ink },
};
const ORDER = ["consultant", "personal"];

/**
 * Switcher "Consultor ⇄ Minha conta" (padrão PF/PJ do Nubank). Só aparece para
 * quem tem a área do consultor (`hasConsultantArea`) — para os demais é `null`,
 * então pode ser montado incondicionalmente nas duas sidebars.
 *
 * `current`: `"consultant"` (sidebar do consultor) ou `"personal"` (app pessoal).
 * Trocar de área navega para `/consultant` ou `/dashboard`; o pós-login já cai
 * na área do consultor por padrão (ver `useAuthRedirects`).
 */
export function AccountAreaSwitcher({ current, user, onNavigate }) {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);

  if (!hasConsultantArea(user)) return null;

  const cur = AREAS[current] ?? AREAS.personal;
  const CurIcon = cur.Icon;

  const go = (areaKey) => {
    setOpen(false);
    if (areaKey === current) return;
    onNavigate?.();
    navigate({ to: AREAS[areaKey].to });
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={(e) => (e.currentTarget.style.background = T.bg)}
        onMouseLeave={(e) => (e.currentTarget.style.background = T.surface)}
        style={{
          ...G,
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 9px",
          borderRadius: 9,
          border: `1px solid ${T.border}`,
          background: T.surface,
          cursor: "pointer",
          transition: "background 0.12s, border-color 0.12s",
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 7,
            background: T.grayLight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <CurIcon size={13} color={cur.accent} strokeWidth={2.1} />
        </span>
        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <div style={{ ...G, fontSize: 8.5, fontWeight: 700, color: T.inkGhost, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Você está em
          </div>
          <div style={{ ...G, fontSize: 12, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {cur.label}
          </div>
        </div>
        <ChevronsUpDown size={14} color={T.inkLight} style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <>
          <div
            role="presentation"
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
          />
          <div
            role="menu"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: "calc(100% + 6px)",
              zIndex: 41,
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 11,
              boxShadow: "0 12px 32px rgba(15,23,35,0.16)",
              padding: 5,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {ORDER.map((key) => {
              const area = AREAS[key];
              const Icon = area.Icon;
              const isCurrent = key === current;
              return (
                <button
                  key={key}
                  type="button"
                  role="menuitem"
                  onClick={() => go(key)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = T.bg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  style={{
                    ...G,
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "8px 9px",
                    borderRadius: 8,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    transition: "background 0.12s",
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 7,
                      background: T.grayLight,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={13} color={area.accent} strokeWidth={2.1} />
                  </span>
                  <span style={{ ...G, flex: 1, textAlign: "left", fontSize: 12.5, fontWeight: isCurrent ? 700 : 500, color: T.ink }}>
                    {area.label}
                  </span>
                  {isCurrent && <Check size={14} color={T.green} strokeWidth={2.4} style={{ flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
