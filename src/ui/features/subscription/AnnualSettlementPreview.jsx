import { useEffect, useState } from "react";

import { getAnnualSettlementRequests, requestAnnualSettlement } from "../../../api/subscriptions";
import { T } from "../../tokens.js";
import { G } from "../../typography.js";
import { Btn } from "../../components/primitives.jsx";

function brl(cents) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Shared checkout-facing annual option chooser; no payment fields exist here. */
export function AnnualSettlementPreview({ selection }) {
  const [strategy, setStrategy] = useState("preserve_anniversary");
  const [target, setTarget] = useState(null);
  const [operation, setOperation] = useState(null);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setTarget(selection ? { ...selection, billing_cycle: "yearly" } : null);
    setOperation(null);
  }, [selection]);

  useEffect(() => {
    let active = true;
    getAnnualSettlementRequests()
      .then((items) => active && setRequests(items))
      .catch(() => active && setRequests([]));
    return () => { active = false; };
  }, []);

  async function preview(accept = false) {
    setError("");
    try {
      const result = await requestAnnualSettlement({ target, strategy, accept });
      setOperation(result);
      if (accept) setRequests(await getAnnualSettlementRequests());
    } catch (err) {
      setError(err?.response?.data?.detail || "Não foi possível calcular a alteração.");
    }
  }

  if (!selection || selection.persona !== "consultant" || selection.billing_cycle !== "yearly" || !target) return null;
  return <section aria-label="Opções da mudança anual" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
    <div style={{ ...G, fontWeight: 700 }}>Mudança anual</div>
    <label style={{ display: "block", marginTop: 8 }}>Vagas que você quer contratar
      <input aria-label="Vagas que você quer contratar" type="number" min="1" value={target.seats ?? ""} onChange={(event) => {
        const seats = Number(event.target.value);
        setTarget((current) => ({ ...current, seats: Number.isInteger(seats) && seats > 0 ? seats : null }));
        setOperation(null);
      }} style={{ display: "block", marginTop: 4 }} />
    </label>
    <fieldset style={{ border: 0, padding: 0, margin: "8px 0" }}><legend style={{ ...G, fontSize: 12 }}>Modalidade</legend>
      <label><input name="annual-settlement-mode" type="radio" checked={target.mode === "progressive"} onChange={() => { setTarget((current) => ({ ...current, mode: "progressive", package_size: null })); setOperation(null); }} /> Preço progressivo</label>
      <label style={{ marginLeft: 12 }}><input name="annual-settlement-mode" type="radio" checked={target.mode === "package"} onChange={() => { setTarget((current) => ({ ...current, mode: "package", package_size: current.package_size ?? 25 })); setOperation(null); }} /> Pacote</label>
    </fieldset>
    {target.mode === "package" && <label>Pacote <select aria-label="Pacote" value={target.package_size ?? 25} onChange={(event) => { setTarget((current) => ({ ...current, package_size: Number(event.target.value) })); setOperation(null); }}><option value={25}>25 vagas</option><option value={50}>50 vagas</option><option value={100}>100 vagas</option></select></label>}
    <fieldset style={{ border: 0, padding: 0, margin: "8px 0" }}><legend style={{ ...G, fontSize: 12 }}>Novo período</legend>
    <label><input name="annual-settlement-strategy" type="radio" checked={strategy === "preserve_anniversary"} onChange={() => setStrategy("preserve_anniversary")} /> Manter aniversário</label>
    <label style={{ marginLeft: 12 }}><input name="annual-settlement-strategy" type="radio" checked={strategy === "restart_year"} onChange={() => setStrategy("restart_year")} /> Iniciar novo período de 12 meses</label></fieldset>
    <Btn onClick={() => preview(false)} disabled={!target.seats}>Ver valor da alteração</Btn>
    {error && <p role="alert">{error}</p>}
    {operation && <div role="status">
      <p>Valor calculado: {brl(operation.amount_due_cents)}.</p>
      <p>{operation.message}</p>
      {operation.status === "preview" && <Btn variant="purple" onClick={() => preview(true)}>Confirmar solicitação</Btn>}
      {operation.status === "support_requested" && <p>Protocolo: <strong>{operation.support_protocol}</strong>. Envie-o para contato@fincla.com.</p>}
      {operation.apply_at === "next_renewal" && <p>Suas vagas já pagas continuam disponíveis até a renovação. A alteração só será efetivada depois do atendimento.</p>}
    </div>}
    {requests.filter((item) => item.status === "support_requested").map((item) => (
      <p key={item.id} role="status">Solicitação pendente: protocolo <strong>{item.support_protocol}</strong>. Envie-o para contato@fincla.com.</p>
    ))}
  </section>;
}
