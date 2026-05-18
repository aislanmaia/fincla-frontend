import React, { useState, useEffect, useRef } from "react";
import { Menu, Search, Plus, Bell, ChevronRight } from "lucide-react";
import { T } from "../tokens";
import { G } from "../typography";
import {
  getDisplayName,
  getInitials,
} from "../features/auth/userDisplay.js";

export function Topbar({ onNew, isMobile, onMenuOpen, onNav, page: _page, user }) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQ, setCmdQ] = useState("");
  const cmdRef = useRef(null);
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(true);
        setCmdQ("");
      }
      if (e.key === "Escape") setCmdOpen(false);
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);
  useEffect(() => {
    if (cmdOpen && cmdRef.current) cmdRef.current.focus();
  }, [cmdOpen]);

  const CMD_ITEMS = [
    { group: "Navegar", icon: "📊", label: "Visão Geral", action: () => { onNav && onNav("dashboard"); setCmdOpen(false); } },
    { group: "Navegar", icon: "💸", label: "Transações", action: () => { onNav && onNav("transactions"); setCmdOpen(false); } },
    { group: "Navegar", icon: "💳", label: "Cartões", action: () => { onNav && onNav("cards"); setCmdOpen(false); } },
    { group: "Navegar", icon: "📈", label: "Relatórios", action: () => { onNav && onNav("reports"); setCmdOpen(false); } },
    { group: "Navegar", icon: "🎯", label: "Metas", action: () => { onNav && onNav("goals"); setCmdOpen(false); } },
    { group: "Navegar", icon: "📋", label: "Orçamentos", action: () => { onNav && onNav("budgets"); setCmdOpen(false); } },
    { group: "Navegar", icon: "🔄", label: "Recorrências", action: () => { onNav && onNav("recurring"); setCmdOpen(false); } },
    { group: "Navegar", icon: "⚙️", label: "Configurações", action: () => { onNav && onNav("profile"); setCmdOpen(false); } },
    { group: "Ação", icon: "✚", label: "Nova transação", action: () => { onNew && onNew(); setCmdOpen(false); } },
  ];
  const filtered = cmdQ.trim()
    ? CMD_ITEMS.filter((i) => i.label.toLowerCase().includes(cmdQ.toLowerCase()))
    : CMD_ITEMS;
  const grouped = filtered.reduce((a, i) => {
    if (!a[i.group]) a[i.group] = [];
    a[i.group].push(i);
    return a;
  }, {});

  return (
    <>
      <div
        style={{
          height: 56,
          borderBottom: `1px solid ${T.border}`,
          background: T.surface,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isMobile ? "0 16px" : "0 28px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isMobile && (
            <button
              onClick={onMenuOpen}
              style={{
                background: "none",
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: "7px 8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Menu size={15} color={T.ink} />
            </button>
          )}
          {!isMobile && (
            <button
              onClick={() => {
                setCmdOpen(true);
                setCmdQ("");
              }}
              style={{
                ...G,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: T.bg,
                border: `1px solid ${T.border}`,
                borderRadius: 9,
                padding: "7px 14px",
                cursor: "text",
                width: 240,
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = T.ink)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.border)}
            >
              <Search size={12} color={T.inkMid} />
              <span style={{ ...G, fontSize: 12, color: T.inkMid, flex: 1, textAlign: "left" }}>Buscar ou navegar…</span>
              <span
                style={{
                  ...G,
                  fontSize: 10,
                  color: T.inkGhost,
                  background: T.grayLight,
                  borderRadius: 5,
                  padding: "1px 6px",
                  fontFamily: "monospace",
                }}
              >
                ⌘K
              </span>
            </button>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={onNew}
            style={{
              ...G,
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: T.ink,
              color: "#fff",
              border: "none",
              borderRadius: 9,
              padding: isMobile ? "8px 10px" : "9px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            <Plus size={13} strokeWidth={2.5} /> {isMobile ? "Transação" : "Nova transação"}
          </button>
          <button
            style={{
              background: T.bg,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: "8px",
              cursor: "pointer",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = T.grayLight)}
            onMouseLeave={(e) => (e.currentTarget.style.background = T.bg)}
          >
            <Bell size={14} color={T.ink} />
            <div
              style={{
                position: "absolute",
                top: 5,
                right: 5,
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: T.red,
                border: `1.5px solid ${T.surface}`,
              }}
            />
          </button>
          <button
            onClick={() => onNav && onNav("profile")}
            title={getDisplayName(user)}
            aria-label={`Conta de ${getDisplayName(user)}`}
            style={{
              width: 32,
              height: 32,
              borderRadius: 9999,
              background: user?.avatar_url
                ? "transparent"
                : `linear-gradient(135deg,${T.blue},${T.purple})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 800,
              color: "#fff",
              border: "none",
              cursor: "pointer",
              flexShrink: 0,
              padding: 0,
              overflow: "hidden",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                width={32}
                height={32}
                style={{ objectFit: "cover", display: "block" }}
              />
            ) : (
              getInitials(user)
            )}
          </button>
        </div>
      </div>
      {cmdOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: "15vh",
          }}
          onClick={() => setCmdOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: T.surface,
              borderRadius: 16,
              boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 18px",
                borderBottom: `1px solid ${T.border}`,
              }}
            >
              <Search size={16} color={T.inkMid} />
              <input
                ref={cmdRef}
                value={cmdQ}
                onChange={(e) => setCmdQ(e.target.value)}
                placeholder="Buscar ou navegar…"
                style={{
                  ...G,
                  flex: 1,
                  border: "none",
                  outline: "none",
                  fontSize: 15,
                  color: T.ink,
                  background: "transparent",
                }}
              />
              <span
                style={{
                  ...G,
                  fontSize: 11,
                  color: T.inkGhost,
                  background: T.bg,
                  borderRadius: 6,
                  padding: "2px 8px",
                  fontFamily: "monospace",
                }}
              >
                ESC
              </span>
            </div>
            <div style={{ maxHeight: 360, overflowY: "auto", padding: "8px 0" }}>
              {Object.entries(grouped).map(([group, items]) => (
                <div key={group}>
                  <div
                    style={{
                      ...G,
                      fontSize: 10,
                      fontWeight: 700,
                      color: T.inkMid,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      padding: "8px 18px 4px",
                    }}
                  >
                    {group}
                  </div>
                  {items.map((item, i) => (
                    <button
                      key={i}
                      onClick={item.action}
                      style={{
                        ...G,
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 18px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = T.bg)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                    >
                      <span style={{ fontSize: 16 }}>{item.icon}</span>
                      <span style={{ ...G, fontSize: 13, color: T.ink }}>{item.label}</span>
                      <ChevronRight size={12} color={T.inkGhost} style={{ marginLeft: "auto" }} />
                    </button>
                  ))}
                </div>
              ))}
              {filtered.length === 0 && (
                <div style={{ ...G, fontSize: 13, color: T.inkMid, textAlign: "center", padding: "24px" }}>
                  {`Nenhum resultado para "${cmdQ}"`}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
