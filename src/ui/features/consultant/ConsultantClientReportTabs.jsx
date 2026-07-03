import React from "react";

import { T } from "../../tokens";
import { G } from "../../typography";
import { CLIENT_REPORT_TABS } from "./consultantReportTabs";

/**
 * Barra de abas do relatório do cliente (A3.2a). Presentational — `active` = id da
 * aba corrente; `onSelect(id)` troca. Abas `soon` ficam desabilitadas com selo
 * "em breve" (Trilha das próximas fatias A3.3–A3.5).
 */
export function ConsultantClientReportTabs({ active, onSelect }) {
  return (
    <div role="tablist" aria-label="Seções do relatório" style={{ display: "flex", gap: 4, borderBottom: `1px solid ${T.border}`, overflowX: "auto" }}>
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
              ...G,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              borderBottom: `2px solid ${isActive ? T.blue : "transparent"}`,
              padding: "10px 14px",
              marginBottom: -1,
              fontSize: 13,
              fontWeight: isActive ? 800 : 600,
              color: tab.soon ? T.inkLight : isActive ? T.blue : T.ink,
              cursor: tab.soon ? "default" : "pointer",
              whiteSpace: "nowrap",
              opacity: tab.soon ? 0.6 : 1,
            }}
          >
            {tab.label}
            {tab.soon && (
              <span style={{ ...G, fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: T.inkLight, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 5, padding: "1px 5px" }}>
                em breve
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
