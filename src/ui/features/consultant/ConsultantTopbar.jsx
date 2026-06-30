import React from "react";
import { Menu, Search, Plus, Sparkles, Bell } from "lucide-react";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { getDisplayName, getInitials } from "../auth/userDisplay.js";

const MONO = { fontFamily: "'Geist Mono', ui-monospace, monospace" };

/**
 * Topbar da área do Consultor (A0.3) — espelha `cons-shell.jsx`.
 * Apresentacional. Itens de IA aparecem como "em breve" (Trilha B); a busca (⌘K)
 * e "Adicionar cliente" são stubs cujo comportamento real chega em fatias futuras.
 */
export function ConsultantTopbar({ isMobile, onOpenMenu, onNav, onAddClient, user }) {
  return (
    <div
      style={{
        height: 56,
        borderBottom: `1px solid ${T.border}`,
        background: T.surface,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isMobile ? "0 14px" : "0 24px",
        flexShrink: 0,
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {isMobile && (
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Abrir menu"
            style={{
              background: T.bg,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: 8,
              cursor: "pointer",
              display: "flex",
              flexShrink: 0,
            }}
          >
            <Menu size={16} color={T.ink} />
          </button>
        )}
        {!isMobile && (
          <button
            type="button"
            onClick={() => { /* ⌘K — paleta de comandos (stub) */ }}
            style={{
              ...G,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: T.bg,
              border: `1px solid ${T.border}`,
              borderRadius: 9,
              padding: "7px 13px",
              cursor: "text",
              width: 280,
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = T.borderHov)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.border)}
          >
            <Search size={13} color={T.inkMid} />
            <span style={{ ...G, fontSize: 12, color: T.inkMid, flex: 1, textAlign: "left" }}>
              Buscar cliente, meta, transação…
            </span>
            <span style={{ ...MONO, fontSize: 10, color: T.inkGhost, background: T.grayLight, borderRadius: 5, padding: "1px 6px" }}>
              ⌘K
            </span>
          </button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onAddClient}
          style={{
            ...G,
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: T.ink,
            color: "#fff",
            border: "none",
            borderRadius: 9,
            padding: "8px 13px",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <Plus size={14} color="#fff" />
          {!isMobile && "Adicionar cliente"}
        </button>

        {!isMobile && (
          <button
            type="button"
            disabled
            title="Em breve"
            style={{
              ...G,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: T.purpleLight,
              color: T.purple,
              border: "none",
              borderRadius: 9,
              padding: "8px 13px",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "default",
              opacity: 0.6,
            }}
          >
            <Sparkles size={14} color={T.purple} />
            Perguntar à IA
            <span
              style={{
                ...G,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: T.purple,
                background: T.surface,
                padding: "1px 6px",
                borderRadius: 99,
              }}
            >
              em breve
            </span>
          </button>
        )}

        <button
          type="button"
          aria-label="Notificações"
          style={{
            background: T.bg,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: 8,
            cursor: "pointer",
            display: "flex",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = T.grayLight)}
          onMouseLeave={(e) => (e.currentTarget.style.background = T.bg)}
        >
          <Bell size={15} color={T.ink} />
        </button>

        <button
          type="button"
          onClick={() => onNav("/consultant/profile")}
          aria-label={`Conta de ${getDisplayName(user)}`}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0, ...NUM }}
        >
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              width={32}
              height={32}
              style={{ borderRadius: 9999, objectFit: "cover", display: "block" }}
            />
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9999,
                background: `linear-gradient(135deg, ${T.ink}, ${T.purple})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 800,
                fontSize: 11,
                ...G,
              }}
            >
              {getInitials(user)}
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
