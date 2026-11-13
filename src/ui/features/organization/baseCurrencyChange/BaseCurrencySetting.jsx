import React, { useState } from "react";

import { T } from "../../../tokens";
import { G } from "../../../typography";
import { currencyInfo } from "../../../money/currencyRegistry.js";
import { BaseCurrencyChangeDialog } from "./BaseCurrencyChangeDialog.jsx";

/** Quem pode trocar a moeda base: o titular e o consultor da organização (fincla-api#465). */
export const BASE_CURRENCY_CHANGE_ROLES = new Set(["owner", "consultant"]);

/**
 * A linha "Moeda base" de Perfil › Organização, com o botão que abre a troca.
 *
 * Sem moeda conhecida, um travessão — nunca um "R$" chutado. O botão só aparece
 * para quem o servidor deixaria trocar; para os outros a linha é só leitura.
 */
export function BaseCurrencySetting({ organizationId, baseCurrency, membershipRole, isMobile = false, onChanged, onGoToTransactions = null }) {
  const [open, setOpen] = useState(false);
  const code = baseCurrency ? String(baseCurrency).toUpperCase() : null;
  const info = code ? currencyInfo(code) : null;
  const canChange = Boolean(organizationId && code && BASE_CURRENCY_CHANGE_ROLES.has(membershipRole));
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 24px", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Moeda base</div>
        <div data-testid="org-base-currency" style={{ ...G, fontSize: 14, color: T.ink }}>{info ? `${info.name} (${info.symbol})` : "—"}</div>
        <div style={{ ...G, fontSize: 11.5, color: T.inkMid, marginTop: 2 }}>A moeda dos saldos, resumos, orçamentos e metas.</div>
      </div>
      {canChange ? (
        <button type="button" onClick={() => setOpen(true)}
          style={{ ...G, background: "none", color: T.inkMid, border: `1px solid ${T.border}`, borderRadius: 9, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
          Trocar moeda base
        </button>
      ) : null}
      {open ? (
        <BaseCurrencyChangeDialog isMobile={isMobile} organizationId={organizationId} currentCurrency={code}
          onClose={() => setOpen(false)} onChanged={onChanged} onGoToTransactions={onGoToTransactions} />
      ) : null}
    </div>
  );
}
