import { useState } from "react";

import { T } from "../../tokens";
import { G } from "../../typography";
import { Btn } from "../../components/primitives";
import { LocaleDatePicker } from "../../components/LocaleDatePicker.jsx";
import { APP_UI_LOCALE } from "../../appLocale.js";
import { dayMonth, localYmd } from "./invoiceFormat.js";

/**
 * Pagar / desfazer pagamento de UMA fatura. O estado da fatura vive no hook de
 * dados; aqui só a data escolhida. `key` por fatura (no pai) zera a data ao trocar.
 */
export function PayControls({ status, paidDate, mutation, onMarkPaid, onUnmarkPaid, now, stacked = false }) {
  const today = localYmd(now);
  const [date, setDate] = useState(today);
  const pending = mutation.pending;

  const wrap = {
    display: "flex", flexDirection: "column", gap: 6, alignItems: stacked ? "stretch" : "flex-end",
  };

  const error = mutation.error ? (
    <div role="alert" style={{ ...G, fontSize: 11, color: T.red, textAlign: stacked ? "left" : "right" }}>{mutation.error}</div>
  ) : null;

  if (status === "paid") {
    return (
      <div style={wrap} data-testid="pay-controls">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: stacked ? "space-between" : "flex-end" }}>
          <span data-testid="paid-note" style={{ ...G, fontSize: 12, fontWeight: 700, color: T.green }}>
            ✓ Fatura paga{dayMonth(paidDate) ? ` em ${dayMonth(paidDate)}` : ""}
          </span>
          <Btn variant="outGray" small disabled={pending} onClick={onUnmarkPaid} data-testid="unmark-paid">
            {pending ? "Desfazendo…" : "Desfazer pagamento"}
          </Btn>
        </div>
        {error}
      </div>
    );
  }

  return (
    <div style={wrap} data-testid="pay-controls">
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: stacked ? "space-between" : "flex-end" }}>
        <div style={{ ...G, fontSize: 11, color: T.inkMid, display: "flex", alignItems: "center", gap: 6 }}>
          <span>Paga em</span>
          <div style={{ width: 156, maxWidth: "100%" }}>
            <LocaleDatePicker value={date} onChange={setDate} max={today} disabled={pending}
              locale={APP_UI_LOCALE} variant={stacked ? "mobile" : "desktop"} ariaLabel="Data do pagamento" />
          </div>
        </div>
        <Btn variant="green" small disabled={pending || !date || date > today} onClick={() => onMarkPaid(date)} data-testid="mark-paid">
          {pending ? "Salvando…" : "✓ Marcar como paga"}
        </Btn>
      </div>
      {error}
    </div>
  );
}
