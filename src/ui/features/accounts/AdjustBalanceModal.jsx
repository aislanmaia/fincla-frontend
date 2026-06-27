import React, { useEffect, useState } from "react";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Btn } from "../../components/primitives";
import { ModalShell } from "./ModalShell.jsx";
import { formatBRL, parseBRL } from "./accountMeta.js";

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

function cents(n) {
  return Math.round(Number(n || 0) * 100);
}

/**
 * Ajuste de saldo (reconciliação). O usuário informa o SALDO DESEJADO; o app
 * calcula o delta (= desejado − atual). NÃO é receita/despesa — só desloca o saldo.
 */
export function AdjustBalanceModal({ account, onClose, onSubmit, isSaving, error, loadAdjustments, onDeleteAdjustment }) {
  const current = Number(account?.balance || 0);
  const [desired, setDesired] = useState("");
  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState(null); // null = loading
  const [deletingId, setDeletingId] = useState(null);

  const refreshHistory = React.useCallback(() => {
    if (!account?.id || !loadAdjustments) return;
    loadAdjustments(account.id)
      .then((rows) => setHistory(rows || []))
      .catch(() => setHistory([]));
  }, [account?.id, loadAdjustments]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const desiredNum = parseBRL(desired);
  const delta = (cents(desiredNum) - cents(current)) / 100;
  const hasDesired = desired.trim() !== "";
  const canSave = hasDesired && cents(delta) !== 0 && reason.trim() !== "" && !isSaving;

  function handleSubmit() {
    if (!canSave) return;
    onSubmit({ amount: delta, reason: reason.trim(), date });
  }

  async function handleDelete(id) {
    setDeletingId(id);
    try {
      await onDeleteAdjustment(id);
      refreshHistory();
    } catch {
      /* erro fica em error (prop) */
    } finally {
      setDeletingId(null);
    }
  }

  const deltaColor = delta > 0 ? T.green : delta < 0 ? T.red : T.inkLight;

  return (
    <ModalShell
      titleSans="Ajustar"
      titleSerif="saldo"
      onClose={onClose}
      footer={
        <>
          <Btn variant="outGray" onClick={onClose}>Cancelar</Btn>
          <Btn variant="dark" onClick={handleSubmit}>
            {isSaving ? "Aplicando…" : "Aplicar ajuste"}
          </Btn>
        </>
      }
    >
      {error ? (
        <div style={{ ...G, fontSize: 12, color: T.red, background: T.redLight, borderRadius: 9, padding: "8px 10px", marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      <div style={{ ...G, fontSize: 12.5, color: T.inkLight, marginTop: 6 }}>
        {account?.name}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 10 }}>
        <span style={{ ...G, fontSize: 12, color: T.inkMid }}>Saldo atual</span>
        <span style={{ ...G, ...NUM, fontSize: 15, fontWeight: 700, color: T.ink }}>{formatBRL(current)}</span>
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Saldo desejado</label>
        <input
          style={{ ...inputStyle, ...NUM }}
          value={desired}
          onChange={(e) => setDesired(e.target.value)}
          placeholder="R$ 0,00"
          inputMode="decimal"
          autoFocus
        />
      </div>

      {hasDesired ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 10, padding: "8px 10px", background: T.grayLight, borderRadius: 9 }}>
          <span style={{ ...G, fontSize: 12, color: T.inkMid }}>Ajuste a aplicar</span>
          <span style={{ ...G, ...NUM, fontSize: 14, fontWeight: 700, color: deltaColor }}>
            {delta > 0 ? "+" : ""}{formatBRL(delta)}
          </span>
        </div>
      ) : null}

      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Data do ajuste</label>
        <input
          style={{ ...inputStyle, ...NUM }}
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Justificativa</label>
        <textarea
          style={{ ...inputStyle, minHeight: 64, resize: "vertical" }}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex.: conciliação com o extrato do banco em DD/MM/AAAA"
          maxLength={500}
        />
      </div>

      <div style={{ ...G, display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: T.inkGhost, marginTop: 12 }}>
        <span style={{ width: 7, height: 7, borderRadius: 9999, background: T.inkGhost, flex: "0 0 7px" }} />
        Não conta como receita ou despesa — só corrige o saldo a partir da data.
      </div>

      {/* Histórico */}
      <div style={{ marginTop: 18, borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
        <div style={{ ...G, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.inkLight, marginBottom: 8 }}>
          Ajustes anteriores
        </div>
        {history === null ? (
          <div style={{ ...G, fontSize: 12, color: T.inkGhost }}>Carregando…</div>
        ) : history.length === 0 ? (
          <div style={{ ...G, fontSize: 12, color: T.inkGhost }}>Nenhum ajuste ainda.</div>
        ) : (
          history.map((adj) => (
            <div key={adj.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...G, ...NUM, fontSize: 13, fontWeight: 700, color: Number(adj.amount) >= 0 ? T.green : T.red }}>
                  {Number(adj.amount) > 0 ? "+" : ""}{formatBRL(adj.amount)}
                  <span style={{ ...G, fontWeight: 500, fontSize: 11, color: T.inkGhost, marginLeft: 8 }}>
                    {String(adj.date).slice(0, 10).split("-").reverse().join("/")}
                  </span>
                </div>
                <div style={{ ...G, fontSize: 11.5, color: T.inkLight, marginTop: 2, wordBreak: "break-word" }}>{adj.reason}</div>
              </div>
              <button
                onClick={() => handleDelete(adj.id)}
                disabled={deletingId === adj.id}
                aria-label="Excluir ajuste"
                style={{ border: "none", background: "none", cursor: "pointer", color: T.inkGhost, fontSize: 13, padding: 4, flex: "0 0 auto" }}
              >
                {deletingId === adj.id ? "…" : "🗑"}
              </button>
            </div>
          ))
        )}
      </div>
    </ModalShell>
  );
}
