import React, { useState } from "react";
import { T } from "../../tokens";
import { G } from "../../typography";
import { Btn } from "../../components/primitives";
import { ModalShell } from "./ModalShell.jsx";
import { accountMeta, formatBRL, parseBRL } from "./accountMeta.js";

const inputStyle = {
  ...G,
  width: "100%",
  fontSize: 14,
  color: T.ink,
  background: T.surface,
  border: `1.5px solid ${T.border}`,
  borderRadius: 10,
  padding: "11px 12px",
  outline: "none",
  boxSizing: "border-box",
};
const labelStyle = { ...G, fontSize: 12, fontWeight: 600, color: T.inkMid, marginBottom: 6, display: "block" };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Modal de transferência entre contas próprias da org. */
export function TransferModal({ accounts, onClose, onSubmit, isSaving, error }) {
  const [fromId, setFromId] = useState(accounts[0]?.account_id || "");
  const [toId, setToId] = useState(accounts[1]?.account_id || accounts[0]?.account_id || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");

  const sameAccount = !!fromId && fromId === toId;
  const amountNum = parseBRL(amount);
  const canSave = !!fromId && !!toId && !sameAccount && amountNum > 0 && !isSaving;

  function handleSubmit() {
    if (!canSave) return;
    onSubmit({
      from_account_id: fromId,
      to_account_id: toId,
      amount: amountNum,
      date: `${date}T12:00:00`,
      note: note.trim() || null,
    });
  }

  function optionLabel(a) {
    const m = accountMeta(a.type);
    return `${m.emoji}  ${a.name} — ${formatBRL(a.balance)}`;
  }

  return (
    <ModalShell
      titleSans="Nova"
      titleSerif="transferência"
      onClose={onClose}
      footer={
        <>
          <Btn variant="outGray" onClick={onClose}>Cancelar</Btn>
          <Btn variant="dark" onClick={handleSubmit}>{isSaving ? "Transferindo…" : "Transferir"}</Btn>
        </>
      }
    >
      {error ? (
        <div style={{ ...G, fontSize: 12, color: T.red, background: T.redLight, borderRadius: 9, padding: "8px 10px", marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 8 }}>
        <label style={labelStyle}>De</label>
        <select style={inputStyle} value={fromId} onChange={(e) => setFromId(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.account_id} value={a.account_id}>{optionLabel(a)}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", placeItems: "center", color: T.inkGhost, fontSize: 15, margin: "6px 0" }}>↓</div>

      <div>
        <label style={labelStyle}>Para</label>
        <select style={inputStyle} value={toId} onChange={(e) => setToId(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.account_id} value={a.account_id}>{optionLabel(a)}</option>
          ))}
        </select>
        {sameAccount ? (
          <div style={{ ...G, fontSize: 11, color: T.amber, marginTop: 6 }}>Escolha contas diferentes para a transferência.</div>
        ) : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <div>
          <label style={labelStyle}>Valor</label>
          <input style={{ ...inputStyle, fontVariantNumeric: "tabular-nums" }} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="R$ 0,00" inputMode="decimal" />
        </div>
        <div>
          <label style={labelStyle}>Data</label>
          <input style={{ ...inputStyle, fontVariantNumeric: "tabular-nums" }} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={labelStyle}>
          Nota <span style={{ color: T.inkGhost, fontWeight: 500 }}>(opcional)</span>
        </label>
        <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: reserva do mês" />
      </div>

      <div style={{ ...G, display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: T.inkGhost, marginTop: 14 }}>
        <span style={{ width: 7, height: 7, borderRadius: 9999, background: T.inkGhost, flex: "0 0 7px" }} />
        Não conta como receita ou despesa — só move o saldo.
      </div>
    </ModalShell>
  );
}
