import React from "react";

import { T } from "../../tokens";
import { G } from "../../typography";

/**
 * Cabeçalho da lista: quantas transações sobraram do filtro, quantas ainda não
 * entraram no saldo, e a soma.
 *
 * Esse número descreve a LISTA, não os KPIs — o lugar dele é encostado no
 * resultado, e não espremido entre valores financeiros que competem por largura.
 * Antes ele morava na faixa de KPIs e era o primeiro a quebrar em telas
 * estreitas; aqui ele tem a largura toda.
 *
 * Fica fixo no topo ao rolar: a contagem descreve o que está à vista e, mais
 * adiante, é aqui que mora o desfazer — nenhum dos dois pode exigir que a pessoa
 * volte ao topo para reaparecer.
 */
export function TransactionsListHeader({
  total,
  pending = 0,
  sum = null,
  fmt,
  loading = false,
  statusLabel = null,
  onPendingClick,
  compact = false,
}) {
  const num = (v) => (loading ? "—" : String(v));
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        ...G,
        position: "sticky",
        top: 0,
        zIndex: 3,
        height: compact ? 32 : 28,
        flex: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: compact ? "0 12px" : "0 14px",
        borderBottom: `1px solid ${T.border}`,
        background: T.grayLight,
        fontSize: 11,
        fontWeight: 600,
        color: T.inkMid,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <b style={{ fontFamily: "'Geist Mono',monospace", color: T.ink, fontSize: 12 }}>{num(total)}</b>
        {/* Quando não sabemos, o motivo vem junto do "—". Antes esse texto morava
            na terceira linha de cada card de KPI; aqui ele aparece uma vez, ao
            lado do número que ele explica. */}
        {statusLabel ? (
          <span style={{ fontWeight: 500, color: T.inkLight }}>{statusLabel}</span>
        ) : compact ? null : (
          <>transaç{total === 1 ? "ão" : "ões"}</>
        )}
        {pending > 0 ? (
          <>
            <span aria-hidden="true" style={{ color: T.border }}>·</span>
            <button
              type="button"
              onClick={onPendingClick}
              // O `title` não vira nome acessível quando o botão tem texto —
              // e a marca de anel é decorativa, então sozinha não diz nada.
              aria-label={`${pending} a pagar — ainda não entraram no saldo da conta`}
              title="Ainda não entraram no saldo da conta"
              style={{
                ...G,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "none",
                border: "none",
                padding: 0,
                cursor: onPendingClick ? "pointer" : "default",
                color: T.amber,
                fontWeight: 700,
                fontSize: 11,
              }}
            >
              {/* Anel vazado, não ampulheta: o lançamento não está "processando",
                  ele existe e simplesmente ainda não entrou no saldo. A gramática
                  da tela já usa ponto cheio para categoria — cheio = tem valor,
                  vazado = ainda não. */}
              <i
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: 9,
                  height: 9,
                  border: "2px solid currentColor",
                  borderRadius: "50%",
                  boxSizing: "border-box",
                }}
              />
              {num(pending)}
              {compact ? null : " a pagar"}
            </button>
          </>
        ) : null}
      </span>

      {sum != null && !loading ? (
        <span style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          soma
          <b
            style={{
              fontFamily: "'Geist Mono',monospace",
              fontSize: 12,
              color: sum >= 0 ? T.green : T.red,
            }}
          >
            {sum >= 0 ? "+" : "−"}
            {fmt(Math.abs(sum))}
          </b>
        </span>
      ) : null}
    </div>
  );
}
