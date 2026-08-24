import React, { useEffect, useState } from "react";

import { T } from "../../tokens";
import { G } from "../../typography";

/**
 * Altura do cabeçalho da lista, exportada porque os cabeçalhos de DIA grudam
 * logo abaixo dele: os dois são sticky no mesmo container, então o `top` de um
 * é a altura do outro. Enquanto o número estava escrito à mão nos dois lugares,
 * mudar a altura aqui fez o cabeçalho de dia grudar POR BAIXO deste.
 */
export const LIST_HEADER_HEIGHT = 44;
export const LIST_HEADER_HEIGHT_COMPACT = 40;

/**
 * Cabeçalho da lista: quantas transações sobraram do filtro, quantas ainda não
 * entraram no saldo, e a soma.
 *
 * Esse número descreve a LISTA, não os KPIs — o lugar dele é encostado no
 * resultado, e não espremido entre valores financeiros que competem por largura.
 * Antes ele morava na faixa de KPIs e era o primeiro a quebrar em telas
 * estreitas; aqui ele tem a largura toda.
 *
 * Fica fixo no topo ao rolar: a contagem descreve o que está à vista e é aqui
 * que mora o desfazer — nenhum dos dois pode exigir que a pessoa volte ao topo
 * para reaparecer.
 */
export function TransactionsListHeader({
  total,
  totalUnfiltered = null,
  pending = 0,
  sum = null,
  fmt,
  loading = false,
  statusLabel = null,
  onPendingClick,
  canUndo = false,
  onUndo,
  undoLabel = "",
  canRedo = false,
  onRedo,
  redoLabel = "",
  /** Mobile: o resultado abre o resumo em sheet. Sem handler ele é só texto. */
  onSumClick,
  sumOpen = false,
  compact = false,
}) {
  const num = (v) => (loading ? "—" : String(v));

  /* O ANÚNCIO é uma frase própria, separada do que se vê.
     A região viva antiga era o cabeçalho inteiro: ela recitava a linha toda a
     cada render, "—" incluído durante o carregamento, e quem usa leitor de tela
     ouvia ruído em vez de resultado. Aqui vai só o que mudou de fato — e só
     quando o número já é verdade. */
  const [anuncio, setAnuncio] = useState("");
  useEffect(() => {
    if (loading) return undefined;
    /* O atraso não é sobre a busca (essa já é debounced antes de virar
       consulta): é sobre trocas RÁPIDAS de filtro, em que anunciar cada estado
       intermediário atropela a leitura do anterior. */
    const id = setTimeout(() => {
      setAnuncio(
        pending > 0
          ? `${total} transaç${total === 1 ? "ão" : "ões"}, ${pending} a pagar`
          : `${total} transaç${total === 1 ? "ão" : "ões"}`,
      );
    }, 350);
    return () => clearTimeout(id);
  }, [total, pending, loading]);

  return (
    <div
      style={{
        ...G,
        position: "sticky",
        top: 0,
        // (o anúncio vive na região viva logo abaixo, fora do fluxo visual)
        zIndex: 3,
        // Raios explícitos em vez de `overflow:hidden` no card: recortar por
        // overflow criaria um scrollport e este `sticky` deixaria de grudar no
        // topo da região rolável. 11 = 12 do card menos a borda de 1 px.
        borderTopLeftRadius: 11,
        borderTopRightRadius: 11,
        // Maior e BRANCO, como o protótipo funcional da seção 07: o cabeçalho
        // é o topo do card, não uma tarja separadora. Em cinza ele lia como
        // divisória; em branco ele pertence à lista que descreve.
        height: compact ? LIST_HEADER_HEIGHT_COMPACT : LIST_HEADER_HEIGHT,
        flex: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: compact ? "0 12px" : "0 16px",
        borderBottom: `1px solid ${T.border}`,
        background: T.surface,
        fontSize: 12,
        fontWeight: 600,
        color: T.inkMid,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        {/* "17 de 20 transações": o filtro sozinho não diz nada sem o total de
            onde ele saiu. Só "17" deixa a pessoa sem saber se cortou muito ou
            pouco — e é essa relação que responde "meu filtro está certo?". */}
        <b style={{ fontFamily: "'Geist Mono',monospace", color: T.ink, fontSize: 14 }}>{num(total)}</b>
        {statusLabel ? (
          <span style={{ fontWeight: 500, color: T.inkLight }}>{statusLabel}</span>
        ) : (
          <span style={{ fontWeight: 500, color: T.inkLight }}>
            {totalUnfiltered != null && totalUnfiltered > total ? (
              <>
                de{" "}
                <b style={{ fontFamily: "'Geist Mono',monospace", color: T.inkMid, fontWeight: 600 }}>
                  {num(totalUnfiltered)}
                </b>{" "}
              </>
            ) : null}
            transaç{total === 1 ? "ão" : "ões"}
          </span>
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

      <span style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
        {/* Desfazer o último recorte. Sem ele, um clique acidental na categoria
            de uma linha (um gesto de UM toque) obrigaria a reconstruir o filtro
            à mão — e a tela puniria a exploração que ela quer incentivar. */}
        {(canUndo || canRedo) && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
            <HistoryButton
              dir="undo"
              enabled={canUndo}
              onClick={onUndo}
              label={undoLabel}
            />
            <HistoryButton
              dir="redo"
              enabled={canRedo}
              onClick={onRedo}
              label={redoLabel}
            />
          </span>
        )}
        {null}
        {sum != null && !loading ? (
          onSumClick ? (
            /* No mobile este número É o resumo: a faixa de KPIs não existe, e
               os outros dois totais abrem daqui. Sem caixa e colado ao valor,
               para ler como "abre este número" e não como mais um botão irmão
               do desfazer. */
            <button
              type="button"
              onClick={onSumClick}
              aria-expanded={sumOpen}
              aria-label={`Resultado ${sum >= 0 ? "positivo" : "negativo"} de ${fmt(Math.abs(sum))}. Ver resumo do filtro.`}
              style={{
                ...G,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 6px",
                borderRadius: 7,
                border: "none",
                background: sumOpen ? T.bg : "none",
                boxShadow: sumOpen ? `inset 0 0 0 1px ${T.border}` : "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <b
                style={{
                  fontFamily: "'Geist Mono',monospace",
                  fontSize: 13,
                  fontWeight: 800,
                  color: sum >= 0 ? T.green : T.red,
                }}
              >
                {sum >= 0 ? "+" : "−"}
                {fmt(Math.abs(sum))}
              </b>
              <span aria-hidden="true" style={{ fontSize: 11, color: T.inkGhost }}>
                {sumOpen ? "▲" : "▼"}
              </span>
            </button>
          ) : (
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
          )
        ) : null}
      </span>
      {/* A região viva propriamente dita: invisível, e com UMA frase.
          `role="status"` já implica `aria-live="polite"`; o par existe porque
          leitores antigos honram um ou outro. */}
      <span
        role="status"
        aria-live="polite"
        style={{
          position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
          overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0,
        }}
      >
        {anuncio}
      </span>
    </div>
  );
}

/**
 * Um passo do histórico de filtros. Ícone só — o rótulo do que vai acontecer
 * mora no `title` e no nome acessível, porque ele muda a cada passo ("voltar
 * para 3 filtros") e um texto que se reescreve sozinho na barra faria o
 * cabeçalho pular de largura a cada clique.
 *
 * Desabilitado continua DESENHADO, apagado: some-e-volta faria os dois botões
 * trocarem de posição conforme o histórico enche.
 */
function HistoryButton({ dir, enabled, onClick, label }) {
  const verb = dir === "undo" ? "Desfazer" : "Refazer";
  const title = enabled && label ? `${verb}: voltar para ${label}` : `${verb} filtro`;
  return (
    <button
      type="button"
      onClick={enabled ? onClick : undefined}
      disabled={!enabled}
      aria-label={enabled && label ? `${verb} filtro — ${label}` : `${verb} filtro`}
      title={title}
      style={{
        ...G,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        borderRadius: 6,
        border: `1px solid ${T.border}`,
        background: T.surface,
        color: enabled ? T.inkMid : T.border,
        opacity: enabled ? 1 : 0.32,
        cursor: enabled ? "pointer" : "default",
        padding: 0,
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={dir === "redo" ? { transform: "scaleX(-1)" } : undefined}
      >
        <path d="M9 14 4 9l5-5" />
        <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
      </svg>
    </button>
  );
}
