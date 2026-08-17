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
export function AdjustBalanceModal({
  account,
  onClose,
  onSubmit,
  isSaving,
  error,
  loadAdjustments,
  onDeleteAdjustment,
  /** `({ accountId, ymd, sinceYmd }) => ({count, total})` — o que este acerto cobre. */
  countCoveredEntries,
  /** `(accountId, ymd) => Promise<number>` — saldo da conta NAQUELA data. */
  loadBalanceAt,
}) {
  const balanceToday = Number(account?.balance || 0);
  // Saldo da DATA escolhida. Sem isto, o delta era calculado contra o saldo de HOJE
  // enquanto o backend passou a ancorar o valor digitado NAQUELE DIA: o usuário
  // conciliava contra o extrato de 01/08, digitava 800, a tela mostrava "ajuste
  // −R$ 200" e o saldo final virava 1300 (800 + o que entrou desde então). Um número
  // na tela, outro no servidor — exatamente o que esta fatia existe para impedir.
  const [balanceAtDate, setBalanceAtDate] = useState(null);
  const current = balanceAtDate ?? balanceToday;
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

  useEffect(() => {
    if (typeof loadBalanceAt !== "function" || !account?.id || !date) return undefined;
    let cancelled = false;
    setBalanceAtDate(null);
    loadBalanceAt(account.id, date)
      .then((value) => {
        if (!cancelled && Number.isFinite(Number(value))) setBalanceAtDate(Number(value));
      })
      .catch(() => {
        // Cai no saldo de hoje. Só é impreciso quando a data escolhida é passada, e
        // aí o rótulo abaixo deixa de prometer que é o saldo daquele dia.
        if (!cancelled) setBalanceAtDate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [loadBalanceAt, account?.id, date]);

  const desiredNum = parseBRL(desired);
  const delta = (cents(desiredNum) - cents(current)) / 100;
  const hasDesired = desired.trim() !== "";
  // Sem exigir delta != 0: reafirmar o saldo que a tela já mostra é a forma natural
  // de fixar uma âncora numa data, e o backend passou a aceitar isso.
  const canSave = hasDesired && reason.trim() !== "" && !isSaving;

  function handleSubmit() {
    if (!canSave) return;
    // `asserted_balance` é o que o usuário DIGITOU; o `amount` vai junto só como
    // auditoria. Antes mandávamos só o delta e o backend derivava a afirmação a
    // partir dele — mas o delta foi calculado contra o saldo que ESTA tela exibia
    // (corte "agora"), que não é necessariamente o saldo da data escolhida.
    onSubmit({ amount: delta, asserted_balance: desiredNum, reason: reason.trim(), date });
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

  // Quantos lançamentos este acerto passaria a cobrir. Calculado sob demanda: o
  // usuário merece ver o tamanho do efeito ANTES de confirmar, não descobrir depois
  // que o saldo parou de responder aos lançamentos antigos.
  /** Âncora que já existe nesta conta — o que ela cobre não "passa" a ser coberto.
   *
   *  Pode ser um ajuste anterior OU o saldo de abertura declarado da conta, e as duas
   *  fronteiras diferem: ajuste cobre o dia inteiro, abertura não cobre o próprio dia.
   *  Usar a semântica errada aqui erra a contagem em um dia inteiro de lançamentos. */
  const currentAnchor = React.useMemo(() => {
    const lastAdjustment = Array.isArray(history) && history.length > 0
      ? (history.map((adj) => String(adj.date ?? "").slice(0, 10)).filter(Boolean).sort().at(-1) ?? "")
      : "";
    if (lastAdjustment) return { ymd: lastAdjustment, kind: "adjustment" };
    const opening = Number(account?.initial_balance ?? 0);
    if (opening && account?.initial_date) {
      return { ymd: String(account.initial_date).slice(0, 10), kind: "opening" };
    }
    return { ymd: "", kind: "adjustment" };
  }, [history, account?.initial_balance, account?.initial_date]);

  const coverage = React.useMemo(
    () =>
      typeof countCoveredEntries === "function" && account?.id && date
        ? countCoveredEntries({
            accountId: account.id,
            ymd: date,
            sinceYmd: currentAnchor.ymd,
            sinceKind: currentAnchor.kind,
          })
        : null,
    [countCoveredEntries, account?.id, date, currentAnchor],
  );

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
        <span style={{ ...G, fontSize: 12, color: T.inkMid }}>
          {balanceAtDate != null && date !== todayISO()
            ? `Saldo em ${String(date).split("-").reverse().join("/")}`
            : "Saldo atual"}
        </span>
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

      <div style={{ ...G, display: "flex", alignItems: "flex-start", gap: 7, fontSize: 11, color: T.inkGhost, marginTop: 12 }}>
        <span style={{ width: 7, height: 7, borderRadius: 9999, background: T.inkGhost, flex: "0 0 7px", marginTop: 4 }} />
        <span>
          Não conta como receita ou despesa. <strong>Deste dia em diante o saldo passa a
          ser calculado a partir deste valor</strong> — lançamentos de{" "}
          {String(date).split("-").reverse().join("/")} (inclusive) para trás deixam de
          alterá-lo, porque já estão contemplados no que você está afirmando. O acerto
          cobre o dia inteiro, como o fechamento de um extrato.
        </span>
      </div>
      {coverage && coverage.count > 0 ? (
        <div style={{ ...G, display: "flex", alignItems: "flex-start", gap: 7, fontSize: 11.5,
          color: T.amber, background: T.amberLight, borderRadius: 9, padding: "8px 10px", marginTop: 8 }}>
          <span aria-hidden="true">⏳</span>
          <span>
            {coverage.count === 1
              ? "1 lançamento desta conta"
              : `${coverage.count} lançamentos desta conta`}{" "}
            {coverage.count === 1 ? "passa" : "passam"} a ser
            {coverage.count === 1 ? " coberto" : " cobertos"} por este acerto e não
            {coverage.count === 1 ? " altera" : " alteram"} mais o saldo
            {coverage.net !== 0
              ? ` (efeito líquido de ${coverage.net > 0 ? "+" : "−"}${formatBRL(Math.abs(coverage.net))})`
              : ""}
            .
          </span>
        </div>
      ) : null}

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
