import React from "react";

import { T } from "../../tokens";
import { G } from "../../typography";
import { Icon } from "./consultantUi";
import { CLIENT_REPORT_TABS } from "./consultantReportTabs";

/**
 * Barra de abas do relatório do cliente (RF.1b) — fiel a `cons-relatorio.jsx`:
 * ícone + rótulo, sublinhado na ativa. `active` = id corrente; `onSelect(id)`
 * troca. Abas `soon` ficam desabilitadas com selo "em breve" (RF.2–RF.4).
 */
export function ConsultantClientReportTabs({ active, onSelect }) {
  return (
    <div role="tablist" aria-label="Seções do relatório" style={{ display: "flex", gap: 4, borderBottom: `1px solid ${T.border}`, marginBottom: 2, overflowX: "auto" }}>
      {CLIENT_REPORT_TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.soon}
            onClick={tab.soon ? undefined : () => onSelect?.(tab.id)}
            style={{
              ...G, display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 14px",
              border: "none", background: "transparent",
              borderBottom: `2px solid ${isActive ? T.ink : "transparent"}`, marginBottom: -1,
              color: tab.soon ? T.inkGhost : isActive ? T.ink : T.inkLight,
              fontSize: 13, fontWeight: isActive ? 700 : 500,
              cursor: tab.soon ? "default" : "pointer", whiteSpace: "nowrap",
            }}
          >
            <Icon name={tab.icon} size={14} color={tab.soon ? T.inkGhost : isActive ? T.ink : T.inkLight} strokeWidth={isActive ? 2.2 : 1.8} />
            {tab.label}
            {tab.soon && (
              <span style={{ ...G, fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: T.inkLight, background: T.grayLight, borderRadius: 5, padding: "1px 5px" }}>
                em breve
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
