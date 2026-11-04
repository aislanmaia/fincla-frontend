import React from "react";
import { T } from "../../../../../tokens";
import { G } from "../../../../../typography";
import { Icon } from "../../shared/Icon.jsx";
import { PanelHeader } from "./PanelHeader.jsx";

/**
 * Faceta "Conta" (#268): uma ou mais contas, OU entre si. Só é montada com 2+
 * contas ativas — com uma só, filtrar não muda nada.
 *
 * @param {{ accountSel: string[], setAccountSel: (v: string[]) => void,
 *   accounts: Array<{ id: string, label: string, currency?: string }>, onClose?: () => void, compact?: boolean }} props
 */
export function AccountPanel({ accountSel, setAccountSel, accounts = [], onClose, compact = false }) {
  const currencies = new Set(accounts.map((a) => a.currency).filter(Boolean));
  return (
    <div>
      <PanelHeader title="Conta" hint="Filtre por uma ou mais contas" onClose={onClose} compact={compact} />
      <div role="group" aria-label="Contas" style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", gap: 8 }}>
        {accounts.map((a) => {
          const active = accountSel.includes(String(a.id));
          return (
            <button
              type="button"
              key={a.id}
              aria-pressed={active}
              onClick={() =>
                setAccountSel(active ? accountSel.filter((x) => x !== String(a.id)) : [...accountSel, String(a.id)])
              }
              style={{
                ...G,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "11px 13px",
                borderRadius: 10,
                border: `1.5px solid ${active ? T.ink : T.border}`,
                background: active ? T.bg : T.surface,
                cursor: "pointer",
                textAlign: "left",
                fontSize: 13,
                fontWeight: 600,
                color: T.ink,
              }}
            >
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.label}
                {/* A moeda só quando há mais de uma entre as contas: aí ela distingue. */}
                {currencies.size > 1 && a.currency ? <span style={{ color: T.inkLight, fontWeight: 500 }}> · {a.currency}</span> : null}
              </span>
              {active ? <Icon name="check" size={12} color={T.ink} /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
