import { useState } from "react";

import { requestAnnualSettlement } from "../../../api/subscriptions";
import { T } from "../../tokens.js";
import { G } from "../../typography.js";

function brl(cents) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Shared checkout-facing annual option chooser; no payment fields exist here. */
export function AnnualSettlementPreview({ target }) {
  const [strategy, setStrategy] = useState("preserve_anniversary");
  const [operation, setOperation] = useState(null);
  const [error, setError] = useState("");

  async function preview() {
    setError("");
    try {
      setOperation(await requestAnnualSettlement({ target, strategy }));
    } catch (err) {
      setError(err?.response?.data?.detail || "Não foi possível calcular a alteração.");
    }
  }

  return <section aria-label="Opções da mudança anual" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
    <div style={{ ...G, fontWeight: 700 }}>Mudança anual</div>
    <label><input type="radio" checked={strategy === "preserve_anniversary"} onChange={() => setStrategy("preserve_anniversary")} /> Manter aniversário</label>
    <label style={{ marginLeft: 12 }}><input type="radio" checked={strategy === "restart_year"} onChange={() => setStrategy("restart_year")} /> Iniciar novo período de 12 meses</label>
    <button type="button" onClick={preview}>Ver valor da alteração</button>
    {error && <p role="alert">{error}</p>}
    {operation && <div role="status">
      <p>Valor calculado: {brl(operation.amount_due_cents)}.</p>
      <p>{operation.message}</p>
      {operation.apply_at === "next_renewal" && <p>Suas vagas já pagas continuam disponíveis até a renovação.</p>}
    </div>}
  </section>;
}
