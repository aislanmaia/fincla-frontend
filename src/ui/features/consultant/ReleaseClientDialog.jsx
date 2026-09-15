import { useEffect, useRef, useState } from "react";
import { releaseConsultantClient } from "../../../api/consultant";
import { handleApiError } from "../../../api/client";
import { Btn } from "../../components/primitives.jsx";
import { T } from "../../tokens.js";
import { G } from "../../typography.js";

export function ReleaseClientDialog({ client, onClose, onReleased }) {
  const dialog = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  async function release() {
    if (busy) return;
    setBusy(true); setError("");
    try { await releaseConsultantClient(client.organization_id); onReleased(); }
    catch (failure) { setError(handleApiError(failure)); setBusy(false); }
  }
  return <dialog ref={dialog} aria-label={`Liberar vaga de ${client.client_name}`} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} className="fincla-release-client fincla-scroll" style={{ ...G, width: 440, maxWidth: "calc(100% - 32px)", maxHeight: "calc(100dvh - 32px)", boxSizing: "border-box", overflowY: "auto", padding: 24, background: T.surface, color: T.ink, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.lg }}>
    <style>{`.fincla-release-client::backdrop { background: ${T.ink}8c; }`}</style>
    <h2 style={{ marginTop: 0 }}>Liberar vaga de {client.client_name}?</h2>
    <p style={{ color: T.inkMid, lineHeight: 1.6 }}>Você deixará de acompanhar {client.organization_name}, sem apagar a organização nem os dados do cliente.</p>
    <p style={{ color: T.inkMid, lineHeight: 1.6 }}>O acesso patrocinado por você será encerrado. A vaga ficará disponível para outro cliente durante o período já pago. O valor e a capacidade da sua assinatura permanecem iguais.</p>
    {error && <p role="alert">{error}</p>}
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
      <Btn disabled={busy} onClick={onClose}>Manter cliente</Btn>
      <Btn variant="outRed" disabled={busy} onClick={release}>{busy ? "Liberando…" : "Liberar vaga"}</Btn>
    </div>
  </dialog>;
}
