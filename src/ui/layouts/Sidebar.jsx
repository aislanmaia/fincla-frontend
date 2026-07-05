import React from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  CreditCard,
  Compass,
  Activity,
  X,
  Repeat,
  FileText,
  Settings,
  LogOut,
} from "lucide-react";
import { T } from "../tokens";
import { G } from "../typography";
import { PlanBadge } from "../features/entitlements/index.js";
import { AccountAreaSwitcher } from "../features/consultant/AccountAreaSwitcher.jsx";
import {
  getDisplayName,
  getInitials,
  getPlanBadge,
} from "../features/auth/userDisplay.js";

const NAV = [
  { sec: "PRINCIPAL" },
  { id: "dashboard", label: "Visão Geral", Icon: LayoutDashboard },
  { id: "transactions", label: "Transações", Icon: ArrowLeftRight },
  { id: "recurring", label: "Recorrências", Icon: Repeat },
  { id: "rhythm", label: "Ritmo de Gastos", Icon: Activity },
  { id: "planning", label: "Planejamento", Icon: Compass },
  { sec: "GESTÃO" },
  { id: "accounts", label: "Contas & Saldo", Icon: Wallet },
  { id: "cards", label: "Cartões", Icon: CreditCard },
  { id: "reports", label: "Relatórios", Icon: FileText, proFeature: "advanced_reports" },
  { sec: "CONFIGURAÇÕES" },
  { id: "profile", label: "Perfil", Icon: Settings },
];

function userHasFeature(user, featureKey) {
  if (!featureKey) return true;
  const features = user?.subscription?.features;
  return Array.isArray(features) && features.includes(featureKey);
}

function SidebarInner({ page, onNav, onClose, user }) {
  return (
    <div
      style={{
        width: 195,
        minWidth: 195,
        background: T.surface,
        borderRight: `1px solid ${T.border}`,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
      }}
    >
      <div
        style={{
          padding: "18px 14px 14px",
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img
            src="/logo.png"
            alt="Fincla"
            width={24}
            height={24}
            style={{ objectFit: "contain", display: "block", flexShrink: 0 }}
          />
          <span style={{ ...G, fontSize: 14, fontWeight: 700, color: T.ink, letterSpacing: "-0.02em" }}>Fincla</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = T.bg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none";
            }}
          >
            <X size={16} color={T.inkLight} />
          </button>
        )}
      </div>

      <nav style={{ flex: 1, padding: "6px 8px", overflowY: "auto" }}>
        {NAV.map((item, i) => {
          if (item.sec) {
            return (
              <div
                key={i}
                style={{
                  ...G,
                  fontSize: 10,
                  fontWeight: 500,
                  color: T.inkGhost,
                  textTransform: "uppercase",
                  letterSpacing: "0.09em",
                  padding: "14px 6px 3px",
                  userSelect: "none",
                }}
              >
                {item.sec}
              </div>
            );
          }
          const active = page === item.id;
          const { Icon } = item;
          const locked = item.proFeature && !userHasFeature(user, item.proFeature);
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => {
                onNav(item.id);
                if (onClose) onClose();
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = T.bg;
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
              style={{
                ...G,
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                marginBottom: 1,
                transition: "background 0.12s",
                background: active ? T.ink : "transparent",
                color: active ? "#fff" : T.inkMid,
                fontWeight: active ? 600 : 400,
                fontSize: 13,
              }}
            >
              <Icon size={14} strokeWidth={active ? 2.5 : 1.8} color={active ? "#fff" : T.inkLight} />
              <span style={{ flex: 1, textAlign: "left", color: active ? "#fff" : T.inkMid }}>{item.label}</span>
              {locked ? (
                <PlanBadge tier="pro" />
              ) : item.badge ? (
                <span
                  style={{
                    ...G,
                    fontSize: 10,
                    fontWeight: 700,
                    color: active ? "rgba(255,255,255,0.8)" : T.blue,
                    background: active ? "rgba(255,255,255,0.15)" : T.blueLight,
                    padding: "1px 6px",
                    borderRadius: 99,
                  }}
                >
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: "10px 12px 14px", borderTop: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
        <AccountAreaSwitcher current="personal" user={user} onNavigate={onClose} />
        <div
          role="presentation"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 8px",
            borderRadius: 9,
            cursor: "pointer",
            transition: "background 0.13s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = T.bg;
            const lb = e.currentTarget.querySelector(".sb-logout");
            if (lb) lb.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            const lb = e.currentTarget.querySelector(".sb-logout");
            if (lb) lb.style.opacity = "0";
          }}
          onClick={() => onNav("profile")}
        >
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              width={28}
              height={28}
              style={{ borderRadius: 9999, objectFit: "cover", flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 9999,
                background: `linear-gradient(135deg,${T.blue},${T.purple})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 800,
                color: "#fff",
                flexShrink: 0,
              }}
            >
              {getInitials(user)}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                ...G,
                fontSize: 12,
                fontWeight: 600,
                color: T.ink,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={getDisplayName(user)}
            >
              {getDisplayName(user)}
            </div>
            {(() => {
              const badge = getPlanBadge(user);
              if (!badge) return null;
              return (
                <span
                  data-testid="sidebar-plan-badge"
                  style={{
                    ...G,
                    fontSize: 10,
                    fontWeight: 700,
                    color: badge.color,
                    background: badge.bg,
                    padding: "1px 6px",
                    borderRadius: 99,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {badge.label}
                </span>
              );
            })()}
          </div>
          <button
            type="button"
            className="sb-logout"
            onClick={(e) => {
              e.stopPropagation();
              onNav("__logout__");
            }}
            title="Sair da conta"
            style={{
              opacity: 0,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 5,
              borderRadius: 7,
              display: "flex",
              alignItems: "center",
              transition: "opacity 0.15s, background 0.12s",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.stopPropagation();
              e.currentTarget.style.background = T.redLight;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none";
            }}
          >
            <LogOut size={13} color={T.red} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ page, onNav, isMobile, open, onClose, user }) {
  if (!isMobile) return <SidebarInner page={page} onNav={onNav} user={user} />;

  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, overflow: "hidden", display: "flex" }}>
      <style>{`@keyframes sidebarIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>
      <div
        role="presentation"
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(15,23,35,0.42)" }}
      />
      <div style={{ position: "relative", animation: "sidebarIn 0.22s ease-out" }}>
        <SidebarInner page={page} onNav={onNav} onClose={onClose} user={user} />
      </div>
    </div>
  );
}
