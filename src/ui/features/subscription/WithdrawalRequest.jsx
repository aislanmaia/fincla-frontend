import { useState } from "react";
import { requestWithdrawal } from "../../../api/checkout";
import { Btn } from "../../components/primitives.jsx";

/** Records a receipt only; review and any refund are deliberately not implied. */
export function WithdrawalRequest() {
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setError("");
    try { setReceipt(await requestWithdrawal()); }
    catch { setError("Não foi possível registrar o pedido agora. Tente novamente ou escreva para contato@fincla.com."); }
    finally { setBusy(false); }
  }
  if (receipt) return <p role="status">Pedido de arrependimento recebido em {new Date(receipt.requested_at).toLocaleString("pt-BR")}. Protocolo: {receipt.id}. A análise e eventual devolução serão informadas por atendimento.</p>;
  return <div style={{ marginTop: 12 }}><p>Se a contratação foi há até 7 dias, registre aqui seu pedido de arrependimento. Você receberá um protocolo imediato; este pedido não confirma estorno automático.</p>{error && <p role="alert">{error}</p>}<Btn type="button" disabled={busy} onClick={submit}>Registrar pedido de arrependimento</Btn></div>;
}
