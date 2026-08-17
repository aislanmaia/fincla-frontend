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

/** "2026-08-13" -> "2026-08-12". Em UTC de propósito: é aritmética de calendário. */
function previousDayYmd(ymd) {
  const d = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
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
  /** `(adj, changes) => Promise<void>` — corrige uma âncora existente. */
  onEditAdjustment,
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
  /** null = ainda não respondeu. SEM pré-seleção de propósito: os dois casos são
   *  frequentes em qualquer data e nada no dado os distingue (transação não guarda
   *  hora, porque o usuário não lembra o minuto da compra). Um palpite errado aqui
   *  produz saldo errado sem nada na tela denunciando — o erro que as âncoras vieram
   *  consertar. Melhor um clique a mais numa ação rara. */
  const [includesSameDay, setIncludesSameDay] = useState(null);
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
    // "Antes" significa saldo no INÍCIO do dia, que é o fechamento do dia anterior.
    // Sem isso o "Ajuste a aplicar" — e o `amount` que fica gravado como auditoria —
    // erram pelo movimento daquele dia.
    const ymdForBalance = includesSameDay === false ? previousDayYmd(date) : date;
    loadBalanceAt(account.id, ymdForBalance)
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
  }, [loadBalanceAt, account?.id, date, includesSameDay]);

  const desiredNum = parseBRL(desired);
  const delta = (cents(desiredNum) - cents(current)) / 100;
  const hasDesired = desired.trim() !== "";
  // Sem exigir delta != 0: reafirmar o saldo que a tela já mostra é a forma natural
  // de fixar uma âncora numa data, e o backend passou a aceitar isso.
  const canSave = hasDesired && reason.trim() !== "" && includesSameDay !== null && !isSaving;

  function handleSubmit() {
    if (!canSave) return;
    // `asserted_balance` é o que o usuário DIGITOU; o `amount` vai junto só como
    // auditoria. Antes mandávamos só o delta e o backend derivava a afirmação a
    // partir dele — mas o delta foi calculado contra o saldo que ESTA tela exibia
    // (corte "agora"), que não é necessariamente o saldo da data escolhida.
    onSubmit({
      amount: delta,
      asserted_balance: desiredNum,
      includes_same_day: includesSameDay,
      reason: reason.trim(),
      date,
    });
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
      ? [...history]
          .filter((adj) => String(adj.date ?? "").slice(0, 10))
          .sort((a, b) => String(a.date).localeCompare(String(b.date)))
          .at(-1)
      : null;
    if (lastAdjustment) {
      return {
        ymd: String(lastAdjustment.date).slice(0, 10),
        // A fronteira da âncora atual é a RESPOSTA dela, não uma constante — usar a
        // errada erra a contagem do aviso por um dia inteiro de lançamentos.
        kind: lastAdjustment.includes_same_day === false ? "opening" : "adjustment",
      };
    }
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
            // A resposta muda o que este acerto passa a cobrir: "Antes" não engole o
            // movimento do próprio dia, "Depois" engole. Contar sem isso erraria o
            // aviso por um dia inteiro de lançamentos.
            kind: includesSameDay === false ? "opening" : "adjustment",
            sinceYmd: currentAnchor.ymd,
            sinceKind: currentAnchor.kind,
          })
        : null,
    [countCoveredEntries, account?.id, date, currentAnchor, includesSameDay],
  );

  return (
    <ModalShell
      titleSans="Ajustar"
      titleSerif="saldo"
      onClose={onClose}
      footer={
        <>
          <Btn variant="outGray" onClick={onClose}>Cancelar</Btn>
          <Btn variant="dark" onClick={handleSubmit} disabled={!canSave}>
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
          {balanceAtDate == null
            ? "Saldo atual"
            : includesSameDay === false
              ? `Saldo antes de ${String(date).split("-").reverse().join("/")}`
              : date !== todayISO()
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

      {/* A pergunta que o dado não responde. Escolha em vez de sim/não: negar frase
          composta ("não inclui os lançamentos até essa data") confunde, e sim/não
          convida resposta automática — aqui a gente QUER que a pessoa pare e pense. */}
      <div style={{ marginTop: 14 }}>
        <label style={labelStyle}>
          Esse saldo é de antes ou depois dos lançamentos de{" "}
          {String(date).split("-").reverse().join("/")}?
        </label>
        <div role="radiogroup" aria-label="Cobertura do acerto" style={{ display: "grid", gap: 8 }}>
          {[
            {
              value: true,
              titulo: "Depois",
              hint: "Inclui tudo que aconteceu nesse dia",
            },
            {
              value: false,
              titulo: "Antes",
              hint: "Os lançamentos desse dia ainda não estão nele",
            },
          ].map((opcao) => {
            const active = includesSameDay === opcao.value;
            return (
              <button
                type="button"
                key={String(opcao.value)}
                role="radio"
                aria-checked={active}
                onClick={() => setIncludesSameDay(opcao.value)}
                style={{
                  ...G,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 2,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1.5px solid ${active ? T.ink : T.border}`,
                  background: active ? T.grayLight : T.surface,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink }}>
                  {opcao.titulo}
                </span>
                <span style={{ ...G, fontSize: 11, color: T.inkLight }}>{opcao.hint}</span>
              </button>
            );
          })}
        </div>
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
          ser calculado a partir deste valor</strong>
          {includesSameDay === null
            ? " — lançamentos anteriores deixam de alterá-lo, porque já estão contemplados no que você está afirmando."
            : includesSameDay
              ? ` — lançamentos de ${String(date).split("-").reverse().join("/")} (inclusive) para trás deixam de alterá-lo.`
              : ` — lançamentos anteriores a ${String(date).split("-").reverse().join("/")} deixam de alterá-lo; os desse mesmo dia continuam contando.`}
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
                <div style={{ ...G, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                  {/* A resposta é o que mais se erra no automático, e é o que muda o
                      saldo — então ela fica visível na lista, não escondida na edição. */}
                  <span style={{ ...G, fontSize: 10.5, color: T.inkMid, background: T.grayLight,
                    borderRadius: 99, padding: "1px 6px", fontWeight: 600 }}>
                    {adj.includes_same_day === false ? "antes do dia" : "depois do dia"}
                  </span>
                  {adj.updated_at && adj.updated_at !== adj.created_at ? (
                    <span style={{ ...G, fontSize: 10.5, color: T.inkGhost }}>
                      editado em {String(adj.updated_at).slice(0, 10).split("-").reverse().join("/")}
                    </span>
                  ) : null}
                </div>
                <div style={{ ...G, fontSize: 11.5, color: T.inkLight, marginTop: 2, wordBreak: "break-word" }}>{adj.reason}</div>
              </div>
              {typeof onEditAdjustment === "function" ? (
                <button
                  onClick={async () => {
                    try {
                      await onEditAdjustment(adj, {
                        includes_same_day: !(adj.includes_same_day !== false),
                      });
                      // Sem isto o histórico, o "editado em", a âncora vigente, a
                      // cobertura e o "Saldo em DD/MM" continuam mostrando o estado
                      // anterior — o usuário troca a cobertura e a tela não muda.
                      refreshHistory();
                      setBalanceAtDate(null);
                    } catch (_) {
                      /* mensagem vai para `error` (prop) */
                    }
                  }}
                  aria-label={`Trocar para ${adj.includes_same_day === false ? "depois do dia" : "antes do dia"}`}
                  title="Trocar a cobertura deste acerto"
                  style={{ border: "none", background: "none", cursor: "pointer", color: T.blue, fontSize: 12, padding: 4, flex: "0 0 auto", fontWeight: 700 }}
                >
                  ⇄
                </button>
              ) : null}
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
