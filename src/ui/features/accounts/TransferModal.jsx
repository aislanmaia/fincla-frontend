import React, { useEffect, useState } from "react";
import { T } from "../../tokens";
import { G } from "../../typography";
import { Btn } from "../../components/primitives";
import { ModalShell } from "./ModalShell.jsx";
import { CURRENCIES, accountMeta, formatDay, formatMoney, parseBRL } from "./accountMeta.js";

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
export function TransferModal({ accounts, onClose, onSubmit, onQuote, isSaving, error }) {
  const [fromId, setFromId] = useState(accounts[0]?.account_id || "");
  const [toId, setToId] = useState(accounts[1]?.account_id || accounts[0]?.account_id || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");

  const [toAmount, setToAmount] = useState("");
  const [quotation, setQuotation] = useState(null);
  const [quotationError, setQuotationError] = useState("");

  const byId = Object.fromEntries(accounts.map((a) => [a.account_id, a]));
  const fromCurrency = byId[fromId]?.currency || "BRL";
  const toCurrency = byId[toId]?.currency || "BRL";
  const crossCurrency = !!fromId && !!toId && fromCurrency !== toCurrency;

  const sameAccount = !!fromId && fromId === toId;
  const amountNum = parseBRL(amount);
  const toAmountNum = parseBRL(toAmount);
  // Entre moedas, o valor que ENTROU é obrigatório: o backend não calcula, porque
  // gravar a taxa de mercado deixaria o saldo errado para sempre.
  const canSave =
    !!fromId && !!toId && !sameAccount && amountNum > 0 && !isSaving &&
    (!crossCurrency || toAmountNum > 0);

  // A cotação SUGERE. Busca só quando as moedas diferem, e o valor sugerido é
  // sobrescrevível — quem confirma é quem viu o extrato do banco.
  useEffect(() => {
    if (!crossCurrency || !onQuote) {
      setQuotation(null);
      setQuotationError("");
      return;
    }
    let cancelled = false;
    setQuotationError("");
    onQuote(fromCurrency, toCurrency)
      .then((q) => {
        if (!cancelled) setQuotation(q);
      })
      .catch(() => {
        if (!cancelled) {
          setQuotation(null);
          // Sem taxa a tela não trava: o usuário digita o valor que caiu na conta,
          // que é o número que vale de qualquer forma.
          setQuotationError("Não consegui buscar a cotação agora — informe o valor que entrou.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [crossCurrency, fromCurrency, toCurrency, onQuote]);

  // Pré-preenche enquanto o usuário não digitou nada no campo de destino.
  useEffect(() => {
    if (!crossCurrency || !quotation || toAmount !== "") return;
    const sugerido = amountNum * Number(quotation.rate);
    if (Number.isFinite(sugerido) && sugerido > 0) {
      setToAmount(sugerido.toFixed(2).replace(".", ","));
    }
  }, [crossCurrency, quotation, amountNum, toAmount]);

  function handleSubmit() {
    if (!canSave) return;
    onSubmit({
      from_account_id: fromId,
      to_account_id: toId,
      amount: amountNum,
      ...(crossCurrency ? { to_amount: toAmountNum } : {}),
      date: `${date}T12:00:00`,
      note: note.trim() || null,
    });
  }

  function optionLabel(a) {
    const m = accountMeta(a.type);
    // Na moeda da conta: no seletor de transferência, unidade errada é o que
    // faz alguém mandar 100 achando que são reais.
    return `${m.emoji}  ${a.name} — ${formatMoney(a.balance, a.currency) ?? "—"}`;
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
          <label style={labelStyle}>{crossCurrency ? "Valor que sai" : "Valor"}</label>
          <input
            style={{ ...inputStyle, fontVariantNumeric: "tabular-nums" }}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`${CURRENCIES.find((c) => c.code === fromCurrency)?.symbol || "R$"} 0,00`}
            inputMode="decimal"
          />
        </div>
        <div>
          <label style={labelStyle}>Data</label>
          <input style={{ ...inputStyle, fontVariantNumeric: "tabular-nums" }} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {crossCurrency ? (
        <div style={{ marginTop: 14 }}>
          <label style={labelStyle}>Valor que entrou</label>
          <input
            style={{ ...inputStyle, fontVariantNumeric: "tabular-nums" }}
            value={toAmount}
            onChange={(e) => setToAmount(e.target.value)}
            placeholder={`${CURRENCIES.find((c) => c.code === toCurrency)?.symbol || ""} 0,00`}
            inputMode="decimal"
          />
          <div style={{ ...G, fontSize: 11, color: T.inkGhost, marginTop: 6, lineHeight: 1.45 }}>
            {quotationError ? (
              <span style={{ color: T.amber }}>{quotationError}</span>
            ) : quotation ? (
              <>
                {/* A data junto do número. Sem ela, uma taxa de sexta parece de hoje. */}
                Sugerido pela cotação de {formatDay(quotation.quoted_on)} (1 {quotation.base} ={" "}
                {formatMoney(quotation.rate, quotation.quote)}). <strong>Confira no extrato</strong> —
                o banco cobra spread e IOF, e o que vale é o que entrou de verdade.
              </>
            ) : (
              <>Informe o valor que de fato caiu na conta em {toCurrency}.</>
            )}
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 14 }}>
        <label style={labelStyle}>
          Nota <span style={{ color: T.inkGhost, fontWeight: 500 }}>(opcional)</span>
        </label>
        <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: reserva do mês" />
      </div>

      <div style={{ ...G, display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: T.inkGhost, marginTop: 14 }}>
        <span style={{ width: 7, height: 7, borderRadius: 9999, background: T.inkFaint, flex: "0 0 7px" }} />
        Não conta como receita ou despesa — só move o saldo.
      </div>
    </ModalShell>
  );
}
